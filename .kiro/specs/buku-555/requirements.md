# Requirements — Buku 555 Berhantu

## Overview
A phone-first progressive web app for Malaysian market traders to track customer credit (hutang) using voice or text input in Bahasa Melayu.

---

## Functional Requirements

### FR-1: Voice & Text Entry

**FR-1.1** WHEN the trader taps the microphone button, the system SHALL activate Web Speech API (lang `ms-MY`) and transcribe speech to text in the input field.

**FR-1.2** WHEN the Web Speech API is not supported by the browser, the system SHALL hide the microphone button and display only a text input field.

**FR-1.3** WHEN the trader submits an entry (voice-transcribed or typed), the system SHALL pass the raw string to the parser and display a confirmation or an error.

---

### FR-2: Malay Input Parsing

**FR-2.1** WHEN the parser receives a Malay sentence, it SHALL extract the following fields:
- `customer` — name with optional honorific (Kak, Abang, Pak Cik, Mak Cik, Encik, Puan, Cik)
- `item` — description of goods
- `qty` — quantity as a number (optional)
- `amountRM` — amount owed in Malaysian Ringgit as a positive number
- `dueDate` — ISO date string or null

**FR-2.2** WHEN the parser encounters Malay cardinal numbers (satu, dua, tiga, empat, lima, enam, tujuh, lapan, sembilan, sepuluh, sebelas, dua belas … dua puluh, tiga puluh, etc.), it SHALL convert them to numeric values.

**FR-2.3** WHEN the parser encounters amount patterns, it SHALL recognise:
- `RM18`, `RM 18`, `RM18.50`
- `18 ringgit`, `18 ringgit 50 sen`
- `seringgit` (RM1), `dua ringgit` (RM2)

**FR-2.4** WHEN the parser encounters day references, it SHALL resolve them to an absolute ISO date:
- Named days: Isnin, Selasa, Rabu, Khamis, Jumaat, Sabtu, Ahad
- Relative: esok (tomorrow), lusa (day after tomorrow), minggu depan (next week), hujung bulan (last day of current month)

**FR-2.5** WHEN the parser cannot extract a required field (`customer` or `amountRM`), it SHALL return `null` for that field and the caller SHALL display an error asking the trader to retype.

---

### FR-3: Ledger

**FR-3.1** WHEN a valid entry is confirmed, the system SHALL append it to the ledger stored in localStorage under key `buku555.v1`.

**FR-3.2** WHEN the trader views the main screen, the system SHALL display all unpaid entries grouped by customer, showing item, amount, due date, and days overdue.

**FR-3.3** WHEN the trader taps "Bayar" (Mark Paid) on an entry, the system SHALL mark that entry as paid and remove the ghost animation from it.

**FR-3.4** WHEN an entry is overdue (due date < today and status is unpaid), the system SHALL highlight it and display a ghost icon next to it.

**FR-3.5** WHEN the trader views the summary, the system SHALL display total outstanding (sum of all unpaid entries).

---

### FR-4: WhatsApp Reminder

**FR-4.1** WHEN the trader taps "Hantar Peringatan" on any unpaid entry (overdue or not), the system SHALL construct a single reminder message covering ALL of that customer's unpaid entries and open `https://api.whatsapp.com/send?phone=<msisdn>&text=<encoded>` in a new tab.

**FR-4.2** WHEN constructing the WhatsApp link, the system SHALL normalise Malaysian phone numbers to the format `60XXXXXXXXX` (strip leading `0`, prepend `60`).

**FR-4.3** The system SHALL NOT send any message automatically; the trader must press Send in WhatsApp.

**FR-4.4** WHEN the trader taps "Hantar Peringatan" and no phone number is saved for that customer, the system SHALL display an in-app dialog (not `window.prompt`) with a telephone number input (`inputmode="tel"`), a "Simpan" (Save) button, and a "Batal" (Cancel) button; the dialog SHALL have a minimum tap-target size of 48 × 48 px.

**FR-4.5** WHEN a phone number is already saved for a customer, the system SHALL reuse it without showing the dialog, and SHALL display a small "Tukar nombor" (Change number) link next to the reminder button so the trader can update it.

**FR-4.6** WHEN the trader saves a phone number, the system SHALL persist a map of `{ customerName → normalised 60XXXXXXXXX }` in localStorage alongside the ledger entries.

**FR-4.7** WHEN the trader exports a backup, the system SHALL include the phone-number map in the exported JSON so it survives export/import round-trips.

**FR-4.8** WHEN the reminder message is built, the system SHALL list each of the customer's unpaid items on its own line with the amount (e.g. `kembung × 2 — RM18.00`) and due date formatted as a local calendar string (e.g. `Jumaat, 6 Nov`), followed by the total amount owed.

**FR-4.9** WHEN all of a customer's unpaid entries are not yet overdue, the reminder tone SHALL be a gentle heads-up with no ghost jokes.

**FR-4.10** WHEN the due date is today, the reminder SHALL mention `hari ini` (or `today`).

**FR-4.11** WHEN at least one of the customer's unpaid entries is overdue, the reminder SHALL include a light ghost reference (e.g. `Hantu Buku 555 datang menjenguk 👻`) and end with a `kalau dah bayar, abaikan ya` (or `if already paid, please ignore`) line before `Terima kasih 🙏`.

**FR-4.12** WHEN the UI language is English, the reminder message SHALL be written in English following the same tone rules.

**FR-4.13** WHEN building the reminder, the system SHALL use local calendar dates (never `toISOString()`) for formatting due dates in the message body.

---

### FR-5: Language Toggle

**FR-5.1** WHEN the trader taps the language toggle, the system SHALL switch all UI labels between Bahasa Melayu (default) and English.

**FR-5.2** WHEN the language is changed, the system SHALL persist the preference in localStorage.

---

### FR-6: Data Backup

**FR-6.1** WHEN the trader taps "Eksport", the system SHALL download a JSON file containing all ledger entries.

**FR-6.2** WHEN the trader imports a JSON backup file, the system SHALL merge it with the current ledger (deduplicate by entry `id`).

---

## Non-Functional Requirements

**NFR-1** All interactive elements SHALL have a minimum tap target size of 48 × 48 px.

**NFR-2** All body text SHALL use a font size of at least 18 px.

**NFR-3** The UI SHALL maintain a minimum contrast ratio of 4.5:1 (WCAG AA) between text and background.

**NFR-4** All interactive elements SHALL carry descriptive `aria-label` attributes.

**NFR-5** The app SHALL function fully offline after first load (no external network requests at runtime).

**NFR-6** The app SHALL have no external runtime JavaScript dependencies (fast-check is devDependency only).

**NFR-7** The parser SHALL be pure and deterministic — same input always produces same output, no side effects.

---

### FR-7: Progressive Web App (PWA)

**FR-7.1** WHEN the browser supports service workers, the system SHALL register `sw.js` using a relative path so the app works under a GitHub Pages sub-path (e.g. `/buku-555-berhantu/`).

**FR-7.2** WHEN installed, the service worker SHALL cache the full app shell (index.html, styles.css, app.js, parser.js, ledger.js, i18n.js, manifest.json, and both SVG icons) using a versioned cache-first strategy; the cache name SHALL include a version string that is bumped on each deployment.

**FR-7.3** WHEN the service worker activates, it SHALL delete all caches that do not match the current version string.

**FR-7.4** WHEN a requested resource is not in the cache (network fallback), the service worker SHALL attempt a network fetch and return the response; if the network also fails, it SHALL return a minimal offline fallback.

**FR-7.5** WHEN the browser fires the `beforeinstallprompt` event, the app SHALL display a bilingual install button labelled 'Pasang app' (ms) / 'Install app' (en); the button SHALL be hidden at all other times.

**FR-7.6** WHEN the trader taps the install button, the system SHALL invoke the deferred prompt and hide the button after the user responds.

**FR-7.7** The `manifest.json` SHALL declare: `name` = 'Buku 555 Berhantu', `short_name` = 'Buku 555', `start_url` = './', `scope` = './', `display` = 'standalone', `theme_color` = '#8B0000', `background_color` = '#fdf6e3', and two icon entries (192 × 192 and 512 × 512, purpose 'any maskable').

**FR-7.8** PWA icons SHALL be SVG files stored in `assets/` and referenced from `manifest.json`; they SHALL be based on the existing `ghost.svg` and include the ghost motif inside a red square background matching the theme colour.

---

### FR-8: Kiro Agent Hooks

**FR-8.1** WHEN any `.js` file or `tests/*.js` file is saved in the editor, the Kiro agent hook `run-tests-on-save.kiro.hook` SHALL instruct the agent to run `npm test` and fix any failures without weakening existing tests.

**FR-8.2** WHEN `i18n.js` is saved, the Kiro agent hook `i18n-check.kiro.hook` SHALL instruct the agent to verify that every key in the `STRINGS` object has both a `ms` and an `en` value, and to add any missing translations.

**FR-8.3** Both hook files SHALL be stored under `.kiro/hooks/` in the JSON format required by the Kiro IDE hook schema (fields: `enabled`, `name`, `description`, `version`, `when`, `then`).

---

### FR-9: Top Debtors Card ('Siapa paling lama hutang')

**FR-9.1** WHEN there is at least one unpaid ledger entry, the system SHALL display a 'Siapa paling lama hutang' / 'Who has owed longest' card above the main ledger list showing the top N customers (default N = 3) with unpaid balances.

**FR-9.2** WHEN the top-debtors card is displayed, each row SHALL show the customer name, total amount owed, and how many days they are overdue (e.g. 'tertunggak 5 hari' / '5 days overdue'); customers whose oldest unpaid due date is not yet past SHALL show 0 days overdue.

**FR-9.3** WHEN there are no unpaid entries, the top-debtors card SHALL be hidden entirely.

**FR-9.4** The ranking function `topDebtors(ledger, today, n)` SHALL be a pure function in `ledger.js` that returns at most `n` customer objects sorted descending by days-overdue (oldest overdue first), breaking ties by total amount owed (largest first), and SHALL never include customers whose entries are all paid.

**FR-9.5** WHEN ranking, the system SHALL use local calendar dates (not UTC) to compute days overdue from the customer's oldest unpaid due date to today.

---

## Acceptance Criteria Summary

| ID | Criterion |
|----|-----------|
| AC-1 | Parser returns correct `{ customer, item, qty, amountRM, dueDate }` for all example inputs in design.md |
| AC-2 | `amountRM` is always ≥ 0 for any valid parse |
| AC-3 | `totalOutstanding` equals sum of all unpaid entry amounts |
| AC-4 | Marking paid removes entry from outstanding total |
| AC-5 | WhatsApp link opens with correct normalised number and pre-filled message |
| AC-6 | App loads and works with JavaScript disabled networking (offline) |
| AC-7 | All property-based tests pass (see design.md §Correctness Properties) |
| AC-8 | `buildReminder()` message total equals sum of the customer's unpaid amounts |
| AC-9 | Paid entries never appear in the reminder message |
| AC-10 | `buildReminder()` URL starts with `https://api.whatsapp.com/send?phone=60` |
| AC-11 | Phone-number map is preserved after export → import round-trip |
| AC-12 | "Hantar Peringatan" button is shown on every unpaid entry |
| AC-13 | In-app phone dialog appears when no number is saved; saved number is reused without dialog |
| AC-14 | App loads without network after first visit (service worker caches app shell) |
| AC-15 | 'Pasang app' / 'Install app' button is hidden until `beforeinstallprompt` fires |
| AC-16 | `topDebtors(ledger, today, n)` never returns customers whose entries are all paid |
| AC-17 | `topDebtors` result has at most `n` entries and is sorted descending by days overdue |
| AC-18 | Both Kiro hook files exist under `.kiro/hooks/` and match the hook JSON schema |
