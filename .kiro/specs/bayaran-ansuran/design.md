# Design — Bayaran Ansuran (Partial Payments)

## Architecture

The partial payments feature extends three existing modules and adds no new files:

```
parser.js   — detects payment sentences; returns ParsedPayment | ParsedEntry | null
ledger.js   — applyPayment(), PaymentRecord type, migrateLedger()
i18n.js     — new string keys for payment UI
app.js      — routes payment parse results, renders payment history, overpayment guard
```

No new files, no new runtime dependencies.

---

## Data Model Changes

### New: ParsedPayment (output of parser for payment sentences)
```ts
{
  type:      'payment',          // discriminator
  customer:  string | null,      // e.g. "Kak Ros"
  amountRM:  number | null,      // null means "settle all" (langsai/settle semua)
}
```

The existing `ParsedEntry` is unchanged. `parse()` now returns `ParsedEntry | ParsedPayment | null-like`.

To distinguish: if `result.type === 'payment'`, route as payment; otherwise route as debt entry.

### New: PaymentRecord (stored in localStorage)
```ts
{
  id:        string,       // crypto.randomUUID() or fallback
  customer:  string,
  amountRM:  number,       // amount actually applied (>= 0)
  paidAt:    string,       // ISO timestamp
  raw:       string,       // original input string
}
```

### Updated: LedgerEntry (backward-compatible, no breaking changes)
The existing `LedgerEntry` shape is unchanged. The FIFO split strategy creates new entries via `createEntry`; there are no new fields on `LedgerEntry`.

### Updated: Storage schema (`buku555.v1`)
```json
{
  "version": 1,
  "entries":  [ ...LedgerEntry ],
  "payments": [ ...PaymentRecord ],
  "phones":   { "Customer Name": "60XXXXXXXXX" },
  "lang":     "ms"
}
```
Migration: any stored object missing `payments` gets `payments: []` added on load.

---

## Parser Extension

### Payment keyword detection
A sentence is classified as a **payment** when it contains one of these payment trigger words **before** or **after** the customer name:

```
PAYMENT_TRIGGERS = [
  'bayar', 'dah bayar', 'sudah bayar', 'bagi', 'settle', 'langsai',
  'settle semua', 'langsai semua', 'dah langsai', 'dah settle'
]
```

Detection order:
1. Normalise input (same pipeline as existing `parse()`).
2. Check if any payment trigger appears in the token stream (before amount extraction).
3. If yes → call `parsePayment(input, today)`.
4. If no → fall through to existing debt-entry parsing.

### `parsePayment(input, today)` algorithm
```
1. Normalise and tokenise (same as parse()).
2. Mark payment trigger tokens as used.
3. Extract amountRM (same extractAmount logic as parse()).
   - If trigger is 'langsai'/'settle semua'/'langsai semua' and no amount found → amountRM = null (settle all).
4. Extract customer name:
   a. Remove payment trigger tokens and amount tokens from remaining.
   b. Detect honorific at start of remaining.
   c. Take up to 2 name words after honorific (same as parse()).
5. Return { type: 'payment', customer, amountRM }.
```

Special handling: `seringgit` = RM1 is valid in payment sentences too.

---

## New Ledger Functions

### `applyPayment(ledger, payments, customer, amountRM, raw)`

Pure function. Returns `{ ledger: LedgerEntry[], payments: PaymentRecord[], warning: string | null }`.

```
Preconditions:
  - customer is a non-empty string
  - amountRM > 0 (for partial) or amountRM === null (for langsai)

Algorithm:

If amountRM === null (settle all):
  1. Mark all of customer's unpaid entries as paid.
  2. Compute totalSettled = sum of those entries' amountRM.
  3. Append PaymentRecord { customer, amountRM: totalSettled, paidAt, raw }.
  4. Return { ledger: updatedLedger, payments: updatedPayments, warning: null }.

If amountRM > customerTotal(ledger, customer):
  → Return { ledger, payments, warning: 'overpayment' }.

If customerTotal(ledger, customer) === 0:
  → Return { ledger, payments, warning: 'no_debt' }.

Partial payment (FIFO):
  1. Sort customer's unpaid entries by createdAt ascending (oldest first).
  2. remaining = amountRM
  3. For each entry (in order):
     a. If remaining >= entry.amountRM:
        - Mark entry as paid (paid: true, paidAt: now).
        - remaining -= entry.amountRM
     b. Else (remaining < entry.amountRM):
        - Split entry:
          i.  Create a new "paid stub" entry: { ...entry, id: newUid(), amountRM: remaining, paid: true, paidAt: now }
          ii. Update original entry: { ...entry, amountRM: entry.amountRM - remaining }
        - remaining = 0
     c. If remaining === 0: stop.
  4. Append PaymentRecord { id, customer, amountRM (original payment amount), paidAt, raw }.
  5. Return { ledger: updatedLedger, payments: updatedPayments, warning: null }.
```

**Correctness note:** This does NOT add a new field to `LedgerEntry`. The paid stub has a fresh `id` so dedup by id works correctly on import.

### `migrateStorage(data)`

Pure function. Takes any parsed storage object and returns a normalised one:
```
{
  version: 1,
  entries:  data.entries  ?? [],
  payments: data.payments ?? [],   // ← migration: add if missing
  phones:   data.phones   ?? {},
  lang:     data.lang     ?? 'ms',
}
```

### `customerPayments(payments, customer)`

Pure query. Returns all `PaymentRecord[]` for a given customer, sorted by `paidAt` descending (newest first).

### `customerBalance(ledger, customer)`

Alias / convenience: `customerTotal(ledger, customer)` (already exists). No change needed — the balance is always computed from unpaid entries.

---

## Updated Functions

### `exportJSON(ledger, phones, payments)`
Add `payments` parameter (default `[]`). Include in the exported JSON.

### `importJSON(json, currentLedger, currentPhones, currentPayments)`
Add `currentPayments` parameter (default `[]`). Merge payments by id (existing take precedence). Return `{ ledger, phones, payments }`.

### `buildReminder(entries, customer, msisdn, today, lang)`
No change needed — it already filters to unpaid entries and uses `e.amountRM`. Because split entries replace the original with a smaller-`amountRM` unpaid remainder, the message automatically shows the correct balance.

---

## UI Changes (app.js)

### Input routing
In `onAddEntry()`, after calling `parse(raw)`:
```
if (result.type === 'payment') {
  onApplyPayment(result.customer, result.amountRM, raw);
  return;
}
// ... existing debt-entry path
```

### `onApplyPayment(customer, amountRM, raw)`
```
1. Call applyPayment(ledger, payments, customer, amountRM, raw).
2. If result.warning === 'overpayment':
   showFeedback(t('errOverpayment', lang).replace('{balance}', formatRM(customerTotal(ledger, customer))), 'error');
   return;
3. If result.warning === 'no_debt':
   showFeedback(t('errNoDebt', lang), 'error');
   return;
4. ledger = result.ledger;
5. payments = result.payments;
6. saveState();
7. renderLedger();
8. showFeedback(t('successPayment', lang)
     .replace('{customer}', customer)
     .replace('{amount}', formatRM(amountRM ?? customerTotal(ledger, customer))), 'success');
```

### Customer card — payment history
In `renderLedger()` / `buildEntryCard()`, after the unpaid entries for a customer section, add:
```html
<details class="payment-history">
  <summary>Sejarah bayaran (N)</summary>
  <ul>
    <li>RM10.00 — 30 Okt 2026</li>
    ...
  </ul>
</details>
```
Only shown when `customerPayments(payments, customer).length > 0`.

### Ghost logic
No change needed. The ghost appears when `overdueEntries` returns an entry. After `applyPayment`, split/paid entries are removed from the unpaid set, so the ghost disappears automatically when balance hits zero.

---

## Correctness Properties (for Property-Based Tests)

**PA-1. Balance never negative**
`customerTotal(resultLedger, customer) >= 0` for any valid `applyPayment` call.

**PA-2. Sum invariant**
`sum(payments for customer) + customerTotal(resultLedger, customer) === sum(original debts for customer)`

For the specific assertion: `customerBalance_after = customerBalance_before - paymentApplied`.

**PA-3. Overpayment always rejected**
If `amountRM > customerTotal(ledger, customer)`, `applyPayment` returns `warning: 'overpayment'` and the ledger is unchanged.

**PA-4. No payment never changes ledger**
If `applyPayment` returns a warning, `result.ledger === ledger` (referential equality or deep equal).

**PA-5. langsai clears all**
After `applyPayment(..., null)`, `customerTotal(result.ledger, customer) === 0`.

**PA-6. Partial payment reduces balance by exactly amountRM**
`customerTotal(before, customer) - customerTotal(after, customer) === amountRM` (within rounding epsilon).

**PA-7. FIFO order: oldest entry paid first**
After applying RM5 to entries of [RM10 created T1, RM20 created T2], the entry with createdAt T1 is the split/paid one.

**PA-8. Entry count conservation**
After a split, `result.ledger.length >= ledger.length` (new paid stub added; original updated in place — implementation may either replace or insert, but count must be ≥ original).

**PA-9. Payment records grow monotonically**
`result.payments.length === payments.length + 1` for a successful (non-warning) payment.

**PA-10. All payment amountRM non-negative**
Every `PaymentRecord` in `result.payments` has `amountRM >= 0`.

---

## Example Inputs & Expected Outputs

| Input | customer | amountRM | type |
|-------|----------|----------|------|
| `Kak Ros bayar RM10` | `Kak Ros` | 10.00 | payment |
| `Kak Ros dah bayar dua puluh ringgit` | `Kak Ros` | 20.00 | payment |
| `Abang Jeff bagi RM5` | `Abang Jeff` | 5.00 | payment |
| `Mak Cik Timah settle RM30` | `Mak Cik Timah` | 30.00 | payment |
| `Pak Cik Hamid langsai` | `Pak Cik Hamid` | null | payment (settle all) |
| `Kak Ros settle semua` | `Kak Ros` | null | payment (settle all) |
| `Kak Ros dah langsai RM18` | `Kak Ros` | 18.00 | payment |
| `Encik Ali hutang ayam RM25.50` | `Encik Ali` | 25.50 | entry (not payment) |

---

## i18n Keys to Add

| Key | ms | en |
|-----|----|----|
| `successPayment` | `Bayaran {amount} dicatat untuk {customer}` | `Payment {amount} recorded for {customer}` |
| `errOverpayment` | `Lebih bayar! Baki sebenar: {balance}` | `Overpayment! Actual balance: {balance}` |
| `errNoDebt` | `Tiada hutang untuk pelanggan ini.` | `No outstanding debt for this customer.` |
| `labelPaymentHistory` | `Sejarah bayaran` | `Payment history` |
| `labelBalance` | `Baki` | `Balance` |
| `labelSettleAll` | `Langsai semua` | `Settle all` |
| `ariaPaymentHistory` | `Sejarah bayaran pelanggan` | `Customer payment history` |

---

## WhatsApp Message — Partial Balance

When a customer has had partial payments applied, the reminder lists only the **remaining** unpaid entries with their current `amountRM` values (which already reflect the split). No change to `buildReminder` is needed.

Example after RM10 payment on a RM18 kembung entry:
```
• kembung ×2 — RM8.00  (bayar sebelum Jumaat, 6 Nov)
Jumlah: RM8.00
```

The original RM18 entry is replaced in the ledger by an RM8 unpaid remainder + an RM10 paid stub. `buildReminder` naturally shows only the unpaid RM8 entry.
