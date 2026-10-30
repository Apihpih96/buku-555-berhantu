# Design — Buku 555 Berhantu

## Architecture

```
index.html
  └── <script type="module"> → app.js
        ├── parser.js   (pure, no DOM deps)
        ├── ledger.js   (pure, no DOM deps)
        └── i18n.js     (pure string map)
styles.css              (no JS deps)
assets/ghost.svg
```

No build step. ES modules loaded directly by the browser. Tests run with `node --test` against the same `.js` source files.

---

## Module Responsibilities

### parser.js
- **Input:** raw string (voice transcript or typed text)
- **Output:** `ParsedEntry | null`
- Pure function: `parse(input: string): ParsedEntry`
- Zero side-effects, zero DOM access, testable in Node

### ledger.js
- **Input/Output:** plain JS objects (no DOM)
- Functions:
  - `addEntry(ledger, entry)` → new ledger array
  - `markPaid(ledger, id)` → new ledger array
  - `totalOutstanding(ledger)` → number (RM, 2 dp)
  - `overdueEntries(ledger, today)` → Entry[]
  - `entriesByCustomer(ledger)` → Map<string, Entry[]>
  - `exportJSON(ledger)` → string
  - `importJSON(json, ledger)` → merged ledger array

### i18n.js
- Exports `t(key, lang)` → localised string
- Supports `'ms'` (default) and `'en'`
- All UI copy lives here; no hardcoded strings in app.js/index.html

### app.js
- Bootstraps the UI
- Reads/writes localStorage (`buku555.v1`)
- Wires Web Speech API → input field
- Calls `parse()`, validates result, calls `addEntry()`
- Renders ledger to DOM
- Builds WhatsApp `wa.me` links
- Handles language toggle, export, import

---

## Data Model

### ParsedEntry (output of parser)
```ts
{
  customer: string | null,   // e.g. "Kak Ros"
  item:     string | null,   // e.g. "kembung"
  qty:      number | null,   // e.g. 2
  amountRM: number | null,   // e.g. 18.00  (always >= 0)
  dueDate:  string | null,   // ISO-8601 date "YYYY-MM-DD" or null
}
```

### LedgerEntry (stored in localStorage)
```ts
{
  id:        string,   // crypto.randomUUID() or Date.now().toString()
  customer:  string,
  item:      string,
  qty:       number | null,
  amountRM:  number,   // >= 0
  dueDate:   string | null,
  paid:      boolean,
  paidAt:    string | null,  // ISO timestamp
  createdAt: string,         // ISO timestamp
  raw:       string,         // original input string
}
```

### Storage schema
```json
{
  "version": 1,
  "entries": [ ...LedgerEntry ],
  "lang": "ms"
}
```
Stored as `localStorage.setItem('buku555.v1', JSON.stringify(schema))`.

---

## Parser Grammar (informal BNF)

```
sentence    ::= honorific? name verb? qty? item amount due?
honorific   ::= "Kak" | "Abang" | "Pak Cik" | "Mak Cik"
              | "Encik" | "Puan" | "Cik"
name        ::= WORD+   (stops before known verb/amount/due token)
verb        ::= "ambil" | "beli" | "hutang" | "pinjam" | "bayar" (ignored)
qty         ::= malay_number | DIGIT+ ("kilo"|"kg"|"tin"|"biji"|"botol")?
item        ::= WORD+   (stops before amount token)
amount      ::= rm_literal | ringgit_phrase
rm_literal  ::= "RM" DIGIT+ ("." DIGIT{2})?
ringgit_phrase ::= malay_number "ringgit" (malay_number "sen")?
                 | "seringgit"
due         ::= ("bayar"|"pada"|"due") day_ref
day_ref     ::= named_day | "esok" | "lusa" | "minggu depan" | "hujung bulan"
named_day   ::= "Isnin"|"Selasa"|"Rabu"|"Khamis"|"Jumaat"|"Sabtu"|"Ahad"
malay_number ::= unit | teen | tens | tens unit
unit        ::= "satu"|"dua"|"tiga"|"empat"|"lima"
              | "enam"|"tujuh"|"lapan"|"sembilan"|"sepuluh"
teen        ::= "sebelas"|"dua belas"|"tiga belas"|"empat belas"
              | "lima belas"|"enam belas"|"tujuh belas"|"lapan belas"
              | "sembilan belas"
tens        ::= "dua puluh"|"tiga puluh"|"empat puluh"|"lima puluh"
              | "enam puluh"|"tujuh puluh"|"lapan puluh"|"sembilan puluh"
```

### Parsing strategy
1. Normalise: lowercase (except first letter of proper nouns), collapse whitespace, strip commas/periods.
2. Detect honorific prefix → consume as part of customer name.
3. Scan forward for `RM` or `ringgit` → extract `amountRM`.
4. Scan for due keywords → extract `dueDate`.
5. The token(s) between name-end and amount-start are `item` (+ optional `qty`).
6. Everything before the item cluster is `customer`.

---

## Example Inputs & Expected Outputs

| Input | customer | item | qty | amountRM | dueDate |
|-------|----------|------|-----|----------|---------|
| `Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat` | `Kak Ros` | `kembung` | 2 | 18.00 | next Friday |
| `Encik Ali hutang ayam RM25.50` | `Encik Ali` | `ayam` | null | 25.50 | null |
| `Mak Cik Timah beli tiga tin sardin dua ringgit lima puluh sen` | `Mak Cik Timah` | `sardin` | 3 | 2.50 | null |
| `Abang Zul ambil ikan pari seringgit bayar esok` | `Abang Zul` | `ikan pari` | null | 1.00 | tomorrow |
| `Puan Hasnah RM50 bayar hujung bulan` | `Puan Hasnah` | (empty/null) | null | 50.00 | end of month |

---

## Correctness Properties (for Property-Based Tests)

### Parser properties
1. **Amount non-negative:** for any valid parse, `result.amountRM >= 0`
2. **Customer non-empty when detected:** if `result.customer !== null`, then `result.customer.trim().length > 0`
3. **Numeric amounts consistent:** RM literal `RMx.yy` always parses to exactly `x + yy/100`
4. **Idempotence of amount formatting:** `formatRM(parseFloat(formatRM(n))) === formatRM(n)` for any `n >= 0`

### Ledger properties
5. **Total = sum of unpaid:** `totalOutstanding(ledger) === ledger.filter(e => !e.paid).reduce((s,e) => s + e.amountRM, 0)`
6. **Mark paid reduces total:** if entry `e` is unpaid, `totalOutstanding(markPaid(ledger, e.id)) === totalOutstanding(ledger) - e.amountRM`
7. **Add then total:** `totalOutstanding(addEntry(ledger, e)) === totalOutstanding(ledger) + e.amountRM`
8. **Export/import round-trip:** `importJSON(exportJSON(ledger), [])` produces a ledger with same entries as original
9. **Amounts never negative:** every entry in any ledger produced by `addEntry` has `amountRM >= 0`

---

## WhatsApp Message Template

```
Assalamualaikum {customer}, ini peringatan hutang di kedai kami:
{item} — RM{amountRM}
Tarikh bayar: {dueDate}
Terima kasih 🙏
```

---

## Accessibility Notes
- All buttons: `aria-label` in active language
- Ghost icon: `aria-hidden="true"` (decorative)
- Input field: `role="textbox"`, `aria-label` describes purpose
- Tap targets: CSS `min-height: 48px; min-width: 48px`
