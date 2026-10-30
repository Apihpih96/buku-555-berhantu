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

## Hantu Reminder — `buildReminder(entries, customer, today, lang)`

### Purpose
A pure function in `ledger.js` that builds a complete, tone-aware WhatsApp `wa.me` URL covering **all** of a customer's unpaid entries.

### Signature
```ts
buildReminder(
  entries:  LedgerEntry[],   // full ledger (function filters to unpaid for customer)
  customer: string,
  today:    Date,
  lang:     'ms' | 'en'
): string                    // full https://api.whatsapp.com/send?phone=60XXXXXXXXX?text=... URL
```
The phone number must be provided separately by the caller (looked up from the phones map in `app.js`) and passed to `normaliseMsisdn` before building the URL. `buildReminder` itself builds only the **message text** and wraps it into the URL using the normalised number.

Revised signature (phones managed by app.js):
```ts
buildReminder(
  entries:  LedgerEntry[],
  customer: string,
  msisdn:   string,          // raw phone — normalised internally
  today:    Date,
  lang:     'ms' | 'en'
): string
```

### Date formatting — local calendar, never toISOString
```js
// Correct (local time):
const d = new Date('2026-11-06T00:00:00');  // interpreted as local
const dayName = d.toLocaleDateString('ms-MY', { weekday: 'long' }); // "Jumaat"
const dateStr = d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }); // "6 Nov"
// Combined: "Jumaat, 6 Nov"

// For Node test environment (no locale data), use a manual table instead:
const MS_DAYS = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
const MS_MONTHS = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
```

### Tone rules
| Condition | Tone |
|-----------|------|
| All unpaid entries have `dueDate > today` OR `dueDate === null` | Gentle heads-up; no ghost |
| Any entry has `dueDate === today` (local) | Mention "hari ini" / "today" |
| Any entry has `dueDate < today` (local) | Ghost joke intro + ignore-if-paid sign-off |

### Message structure (ms)
```
Assalamualaikum {customer}, 👋

[if any overdue:]
Hantu Buku 555 datang menjenguk 👻

Hutang belum dijelaskan:
• {item} [×{qty}] — RM{amount}  [{due line}]
• …

Jumlah: RM{total}

[if no overdue:] Harap dapat dijelaskan tidak lama lagi. 🙏
[if overdue:]    Kalau dah bayar, abaikan ya. 🙏

Terima kasih 🙏
```

Due line variants (ms):
- No due date: *(omit)*
- Due today: `(hari ini)`
- Overdue: `(tertunggak sejak {date})`
- Future: `(bayar sebelum {date})`

### Message structure (en)
```
Hello {customer}, 👋

[if any overdue:]
The Buku 555 Ghost has come to visit 👻

Outstanding balance:
• {item} [×{qty}] — RM{amount}  [{due line}]
• …

Total: RM{total}

[if no overdue:] Hope to settle this soon. 🙏
[if overdue:]    If you've already paid, please ignore this. 🙏

Thank you 🙏
```

### Storage — phones map
```json
{
  "version": 1,
  "entries": [ ...LedgerEntry ],
  "phones":  { "Kak Ros": "60123456789", "Encik Ali": "60197654321" },
  "lang": "ms"
}
```
`phones` is optional (absent in old backups = empty map). `app.js` manages loading, saving, and updating it.

### Correctness Properties for `buildReminder` (PBT)
10. **Message total = sum of unpaid:** The RM total in the message equals `customerTotal(entries, customer)`.
11. **Paid entries excluded:** No paid entry's item appears in the message.
12. **URL prefix:** The returned URL starts with `https://api.whatsapp.com/send?phone=60`.
13. **Empty = empty URL:** If the customer has no unpaid entries, `buildReminder` returns `''` (or throws — callers must guard).

---

## Accessibility Notes
- All buttons: `aria-label` in active language
- Ghost icon: `aria-hidden="true"` (decorative)
- Input field: `role="textbox"`, `aria-label` describes purpose
- Tap targets: CSS `min-height: 48px; min-width: 48px`

---

## PWA Architecture

### Service Worker (`sw.js`)
```
sw.js
  ├── CACHE_VERSION = 'buku555-v2'
  ├── APP_SHELL = [ './', './index.html', './styles.css', './app.js',
  │                 './parser.js', './ledger.js', './i18n.js',
  │                 './manifest.json', './assets/icon-192.svg',
  │                 './assets/icon-512.svg' ]
  ├── install event  → cache.addAll(APP_SHELL)
  ├── activate event → delete old caches (keys !== CACHE_VERSION)
  └── fetch event    → cache-first, then network, return cached or network response
```

**Registration** (in `app.js`):
```js
if ('serviceWorker' in navigator) {
  // Use relative path — works under /buku-555-berhantu/ on GitHub Pages
  navigator.serviceWorker.register('./sw.js');
}
```

**Install button** (`beforeinstallprompt`):
```js
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show #btn-install button
});
// On click: deferredPrompt.prompt(); hide button after response.
```

### `manifest.json`
```json
{
  "name": "Buku 555 Berhantu",
  "short_name": "Buku 555",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "theme_color": "#8B0000",
  "background_color": "#fdf6e3",
  "icons": [
    { "src": "assets/icon-192.svg", "sizes": "192x192", "type": "image/svg+xml", "purpose": "any maskable" },
    { "src": "assets/icon-512.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

### SVG Icons
Both icons reuse the existing ghost motif on a dark red (#8B0000) rounded-square background:
- `assets/icon-192.svg` — 192×192 viewBox, ghost centred
- `assets/icon-512.svg` — 512×512 viewBox, ghost centred

---

## Kiro Hooks Schema

Hook files live in `.kiro/hooks/` and follow this JSON shape:
```json
{
  "enabled": true,
  "name": "Human-readable hook name",
  "description": "What this hook does",
  "version": "1",
  "when": {
    "type": "fileEdited",
    "patterns": ["glob/pattern"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "Instruction to the Kiro agent…"
  }
}
```

### `run-tests-on-save.kiro.hook`
- **when:** `fileEdited` patterns `["*.js", "tests/*.js"]`
- **then:** run `npm test`; fix failures without weakening tests

### `i18n-check.kiro.hook`
- **when:** `fileEdited` patterns `["i18n.js"]`
- **then:** verify every key in `STRINGS` has both `ms` and `en`; add missing translations

---

## Top Debtors — `topDebtors(ledger, today, n)`

### Purpose
A pure function that returns the top-N customers with the most overdue (or outstanding) debt, to surface the most urgent collections at the top of the UI.

### Signature
```ts
topDebtors(
  ledger: LedgerEntry[],
  today:  Date | string,   // local calendar reference date
  n?:     number           // default 3
): DebtorSummary[]
```

### Return type
```ts
type DebtorSummary = {
  customer:    string,
  totalOwed:   number,   // sum of unpaid amountRM, 2 dp
  daysOverdue: number,   // days since oldest unpaid due date; 0 if not yet overdue
}
```

### Algorithm
1. Filter to unpaid entries only.
2. Group by customer name.
3. For each customer compute:
   - `totalOwed` — sum of their unpaid `amountRM` (rounded to 2 dp)
   - `oldestDue` — earliest (min) `dueDate` among their unpaid entries that have a `dueDate`; `null` if none have a due date
   - `daysOverdue` — if `oldestDue !== null && oldestDue < todayISO` then `differenceInCalendarDays(today, oldestDue)`, else `0`
4. Sort descending by `daysOverdue` (most overdue first), break ties by `totalOwed` descending.
5. Return first `n` results.

### Days calculation (local, integer)
```js
function calendarDaysDiff(fromISO, toDate) {
  // Parse fromISO as local midnight
  const [y, m, d] = fromISO.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const to   = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.floor((to - from) / 86400000);
}
```

### Correctness Properties (PBT)
14. **Never includes paid-only customers:** no customer in `topDebtors` result has all entries paid.
15. **At most n entries:** `topDebtors(ledger, today, n).length <= n`.
16. **Sorted:** result[i].daysOverdue >= result[i+1].daysOverdue for all i.
17. **totalOwed non-negative:** every result has `totalOwed >= 0`.
