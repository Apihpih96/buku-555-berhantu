# Design — Penyata Pelanggan (Customer Statement)

## Architecture Overview

All new logic is additive to the existing module structure:

```
ledger.js        ← add buildStatement() pure function
i18n.js          ← add new string keys
app.js           ← add customer page rendering, search box wiring
index.html       ← add #customer-page panel, search input
mcp/debts.js     ← add get_statement tool
tests/penyata.test.js  ← statement + search tests
```

No new files are required at the module level. The customer "page" is a hidden `<section>` panel that is shown/hidden in place (no routing library). This matches the existing single-page pattern.

---

## Module Additions

### ledger.js additions

#### `buildStatement(entries, payments, customer, msisdn, today, lang)`

A pure function — no DOM, no side-effects. Mirrors `buildReminder` in structure.

```ts
buildStatement(
  entries:  LedgerEntry[],
  payments: PaymentRecord[],
  customer: string,
  msisdn:   string,        // raw phone — normalised internally
  today:    Date,
  lang:     'ms' | 'en'
): { text: string, url: string }
```

**Algorithm:**
1. Filter all entries (paid and unpaid) for the customer; sort by `createdAt` ascending.
2. Filter payment records for the customer; sort by `paidAt` ascending.
3. If no entries exist → return `{ text: '', url: '' }`.
4. Compute `totalOwed = sum of unpaid entries`.
5. Build the statement lines (see §Statement Format below).
6. Build the WhatsApp URL: `https://api.whatsapp.com/send?phone=${normalised}&text=${encodeURIComponent(text)}`.
7. Return `{ text, url }`.

#### `daysSinceOldestUnpaid(entries, customer, today)`

A helper that returns the integer number of days between the `createdAt` of the oldest unpaid entry for the customer and `today`.

```ts
daysSinceOldestUnpaid(
  entries:  LedgerEntry[],
  customer: string,
  today:    Date
): number   // 0 if no unpaid entries
```

Algorithm: filter unpaid entries for customer → find minimum `createdAt` ISO string → compute `calendarDaysDiff` from that date to today (using existing local-date logic).

---

### i18n.js additions

New keys (both `ms` and `en`):

| Key | ms | en |
|-----|----|----|
| `searchPlaceholder` | `Cari pelanggan…` | `Search customer…` |
| `searchLabel` | `Cari pelanggan` | `Search customer` |
| `noSearchMatch` | `Tiada padanan.` | `No match.` |
| `btnTutup` | `✕ Tutup` | `✕ Close` |
| `customerPageTitle` | `Penyata Pelanggan` | `Customer Statement` |
| `labelCreatedAt` | `Tarikh` | `Date` |
| `labelStatus` | `Status` | `Status` |
| `labelUnpaid` | `Belum bayar` | `Unpaid` |
| `labelPaidOn` | `Dibayar` | `Paid` |
| `labelDaysOwed` | `Hari terhutang` | `Days owed` |
| `labelTotalOwed` | `Jumlah terhutang` | `Total owed` |
| `btnHantarPenyata` | `📄 Hantar Penyata` | `📄 Send Statement` |
| `ariaCustomerPage` | `Halaman penyata pelanggan` | `Customer statement page` |
| `ariaBtnTutup` | `Tutup halaman pelanggan` | `Close customer page` |
| `ariaBtnHantarPenyata` | `Hantar penyata ke WhatsApp` | `Send statement to WhatsApp` |
| `stmtHeader` | `Penyata Akaun` | `Account Statement` |
| `stmtNoBalance` | `Tiada baki tertunggak 🎉` | `No outstanding balance 🎉` |
| `stmtBalance` | `Baki` | `Balance` |
| `stmtPayment` | `✓ Bayar` | `✓ Payment` |
| `stmtUnpaid` | `Belum bayar` | `Unpaid` |
| `stmtPaid` | `✓ Dah bayar` | `✓ Paid` |

---

### mcp/debts.js additions

New tool descriptor appended to `TOOLS`:

```js
{
  name: 'get_statement',
  description: 'Get a full itemised account statement for one customer, in Malay or English. Returns statement text, total outstanding, entry count, and unpaid count.',
  inputSchema: {
    type: 'object',
    properties: {
      customer: { type: 'string', description: 'Customer name exactly as stored in the book.' },
      lang: { type: 'string', enum: ['ms', 'en'], description: 'Language for the statement. Default: ms.' },
    },
    required: ['customer'],
  },
},
```

`callTool` case handler for `'get_statement'`:
1. Load book.
2. Find all entries for `args.customer` (exact match, case-sensitive — same as the rest of the MCP tools).
3. If no entries found → `throw new ToolError(...)`.
4. Import `buildStatement` from `../ledger.js`.
5. Call `buildStatement(entries, payments, customer, '0000000000', new Date(), lang)` — msisdn is a dummy because MCP has no phone context (the `url` field in the result is omitted or set to `''`).
6. Return `{ customer, statementText: result.text, totalOutstandingRM: customerTotal(entries, customer), entryCount: customerEntries.length, unpaidCount }`.

---

## Statement Format

### Malay (lang = 'ms')

```
Penyata Akaun — {customer}
{date} (hari ini)

{date} | {item} [×{qty}] | RM{amount} | Belum bayar
{date} | {item} [×{qty}] | RM{amount} | ✓ Dah bayar ({paid-date})
{date} | ✓ Bayar | RM{amount}
...

Baki: RM{total}
```

Or if all paid:
```
Tiada baki tertunggak 🎉
```

### English (lang = 'en')

```
Account Statement — {customer}
{date} (today)

{date} | {item} [×{qty}] | RM{amount} | Unpaid
{date} | {item} [×{qty}] | RM{amount} | ✓ Paid ({paid-date})
{date} | ✓ Payment | RM{amount}
...

Balance: RM{total}
```

Date format: uses `formatLocalDate` from `ledger.js` (e.g. "Jumaat, 6 Nov").

---

## Customer Page UI (DOM)

### HTML structure (added to `index.html`)

```html
<section id="customer-page" class="customer-page" hidden aria-label="Halaman penyata pelanggan">
  <div class="customer-page-header">
    <button id="btn-tutup" class="btn btn-tutup" type="button" aria-label="Tutup halaman pelanggan">✕ Tutup</button>
    <h2 id="customer-page-title" class="customer-page-title">Penyata Pelanggan</h2>
    <span id="customer-page-name" class="customer-page-name"></span>
  </div>
  <div class="customer-page-meta">
    <span id="customer-total-owed"></span>
    <span id="customer-days-owed"></span>
  </div>
  <div id="customer-page-list" class="customer-page-list" role="list">
    <!-- Rows rendered by app.js -->
  </div>
  <div class="customer-page-actions">
    <button id="btn-hantar-penyata" class="btn btn-hantar-penyata" type="button" aria-label="Hantar penyata ke WhatsApp">📄 Hantar Penyata</button>
  </div>
</section>
```

### Search box (added above `#ledger-list` section)

```html
<div class="search-row">
  <input id="customer-search" type="search" class="customer-search" placeholder="Cari pelanggan…" aria-label="Cari pelanggan" autocomplete="off" />
</div>
```

### Navigation pattern in `app.js`

- `openCustomerPage(customer)` — populates the panel, hides `#app-main > .entry-section`, shows `#customer-page`.
- `closeCustomerPage()` — hides `#customer-page`, shows the main view.
- `renderCustomerPage(customer)` — called on open; builds the chronological list.
- Customer name headings become `<button>` or include a clickable affordance so that tapping them calls `openCustomerPage`.

---

## Search Matching

```js
/** Strip common Malay honorifics and lowercase for comparison. */
function stripHonorifics(name) {
  return name
    .replace(/^(Kak|Abang|Pak Cik|Mak Cik|Encik|Puan|Cik)\s+/i, '')
    .toLowerCase()
    .trim();
}

/** Returns true if customerName matches the query (after stripping honorifics). */
function matchesSearch(customerName, query) {
  if (!query) return true;
  const q = stripHonorifics(query);
  const n = stripHonorifics(customerName);
  return n.includes(q);
}
```

Both customer name and query are processed through `stripHonorifics` before the `includes` check.

---

## Correctness Properties (for PBT)

### buildStatement properties

1. **Statement total = sum of unpaid:** `buildStatement(...).text` contains `totalOutstandingRM.toFixed(2)` where `totalOutstandingRM = customerTotal(entries, customer)`.
2. **All entries appear:** every entry for the customer appears exactly once in the statement text.
3. **URL prefix:** `buildStatement(...).url` starts with `https://api.whatsapp.com/send?phone=60` (when msisdn is a valid Malaysian number).
4. **Empty for unknown customer:** `buildStatement([], [], 'X', ...)` returns `{ text: '', url: '' }`.
5. **Paid marker:** any entry with `paid === true` has the paid label in its line (not "Belum bayar").

### Search properties

6. **Subset:** filtered customers are always a subset of all customers.
7. **Honorific invariance:** searching "Ros" matches "Kak Ros" (honorific stripped).
8. **Case invariance:** searching "ros" matches "Kak Ros".
9. **Empty query = all:** empty query always returns all customers.

---

## Accessibility Notes

- `#customer-search` has `aria-label`, min 48px height, ≥18px font.
- Customer name headings that are tappable must be `<button>` elements (or have `role="button"` with `tabindex="0"` and keyboard handler) — prefer `<button>`.
- `#customer-page` panel has `aria-label`.
- `#btn-tutup` and `#btn-hantar-penyata` each have `aria-label`.
- Customer page list items have `role="listitem"`.
