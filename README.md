# Buku 555 Berhantu 👻

> *Buku hutang digital untuk peniaga pasar Malaysia.*
> A haunted digital debt ledger for Malaysian market traders.

---


## 👻 Try the demo in 10 seconds

Open **https://apihpih96.github.io/buku-555-berhantu/?demo=1** (or tap **👻 Cuba Demo** in the footer).
It loads a sample warung book dated relative to today: Pak Mat and Kak Ros are overdue (ghosts appear),
Abang Jeff is due today, Mak Cik Timah is next week, and Adik Hafiz has paid.

Then tap **📲 Hantar Peringatan** on Kak Ros: enter any number once, and WhatsApp opens with one polite
message listing everything she owes and the total. Nothing is sent until you press send.

## Apa ini? / What is this?

Malaysian market traders have tracked customer credit ("hutang") for decades using the iconic red-and-blue **Buku 555** notebook. Paper gets wet at the fish stall, pages get lost, and asking a neighbour for money is awkward.

**Buku 555 Berhantu** resurrects the Buku 555 as a phone-first web app:

- The trader **speaks or types** an entry in Bahasa Melayu
  (e.g. *"Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat"*)
- It **parses** customer, item, amount (RM) and due day
- It shows **who owes what**, total outstanding, and who is overdue
- For overdue customers, a polite **ghost reminder** message is prepared and
  opened in **WhatsApp** via a WhatsApp click-to-chat link. The trader always presses Send —
  nothing is sent automatically.
- Marking an entry paid **exorcises** the ghost 👻✨

Designed for a 60-year-old fish seller on a cheap Android phone at 5am:
big tap targets, Malay-first UI, works offline, no login, no server.

---

## Features

| Feature | Detail |
|---------|--------|
| Voice input | Web Speech API, `ms-MY` locale, graceful fallback to text |
| Malay parser | Handles honorifics, Malay numbers, RM amounts, relative/named days |
| Offline | Pure static site — works with no internet after first load |
| WhatsApp reminders | WhatsApp click-to-chat links (api.whatsapp.com/send, keeps emoji intact), Malaysian numbers normalised to `60XXXXXXXXX` |
| Backup | JSON export / import |
| Language | Bahasa Melayu (default) / English toggle |
| Halloween theme | Aged paper, Buku 555 red/blue, floating ghost animation |

---

## How Kiro was used

This project was built entirely using the **Kiro CLI** agentic development workflow:

1. **Steering docs** (`.kiro/steering/`) — product vision, tech constraints, and project structure were authored first, giving the AI a persistent specification to reference throughout.

2. **Spec generation** — Kiro generated three spec files in `.kiro/specs/buku-555/`:
   - `requirements.md` — EARS-style user stories (WHEN/THEN/SHALL)
   - `design.md` — architecture, data model, parser grammar, and correctness properties for property-based testing
   - `tasks.md` — numbered implementation checklist referenced during coding

3. **Implementation** — Kiro implemented all source files (`parser.js`, `ledger.js`, `i18n.js`, `app.js`, `index.html`, `styles.css`, `assets/ghost.svg`) following the specs.

4. **Property-based testing (PBT)** — `fast-check` properties were designed in `design.md` first, then implemented in `tests/`. Properties include:
   - `amountRM` is always ≥ 0
   - `totalOutstanding` equals sum of unpaid entries
   - Marking paid reduces the total by exactly that entry's amount
   - Export → import round-trip preserves all entries

5. **Verification loop** — Kiro ran `npm install && npm test` and fixed failures until all tests were green.

---

## Running the tests

```bash
# Install dev dependencies (fast-check only)
npm install

# Run all tests
npm test

# Run a specific suite
node --test tests/parser.test.js
node --test tests/ledger.test.js
```

Requires Node.js ≥ 18 (built-in test runner + `crypto.randomUUID`).

---

## Running the app

No build step needed. Open `index.html` directly in a browser, or serve locally:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080`.

---

## Project structure

```
buku555/
├── index.html          # App shell, semantic HTML5
├── styles.css          # Haunted notebook theme
├── app.js              # UI bootstrap, event wiring, localStorage
├── parser.js           # Pure Malay sentence parser
├── ledger.js           # Pure ledger math & data functions
├── i18n.js             # ms/en string translations
├── assets/
│   └── ghost.svg       # Friendly ghost SVG
├── tests/
│   ├── parser.test.js  # Unit + PBT for parser
│   └── ledger.test.js  # Unit + PBT for ledger
├── .kiro/
│   ├── steering/       # Product, tech & structure steering docs
│   └── specs/buku-555/ # Requirements, design, tasks
├── package.json
├── LICENSE             # MIT
└── README.md
```

---

## Example inputs

| Malay input | Parsed |
|-------------|--------|
| `Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat` | Kak Ros · kembung × 2 · RM18.00 · due Friday |
| `Encik Ali hutang ayam RM25.50` | Encik Ali · ayam · RM25.50 |
| `Mak Cik Timah beli tiga tin sardin dua ringgit lima puluh sen` | Mak Cik Timah · sardin × 3 · RM2.50 |
| `Abang Zul ambil ikan pari seringgit bayar esok` | Abang Zul · ikan pari · RM1.00 · due tomorrow |
| `Puan Hasnah RM50 bayar hujung bulan` | Puan Hasnah · RM50.00 · due end of month |

---

## License

MIT © 2026 Mohammad Afif bin Mohd Saberi

---

*"Hantu hutang paling menakutkan." 👻*

## 🛠️ Built with Kiro

- **Steering** (`.kiro/steering/`): Malay-first copy, no server or tracking, big tap targets for older traders.
- **Spec** (`.kiro/specs/buku-555/`): EARS requirements, a design with correctness properties, and tasks T-1 to T-27 that Kiro completed one by one.
- **Agent hooks** (`.kiro/hooks/`):
  - `run-tests-on-save` runs `npm test` whenever a `.js` file is saved and fixes failures without weakening tests.
  - `i18n-check` checks every key in `i18n.js` has both Malay and English when that file changes.
- **Tests**: node:test plus fast-check property tests for the parser, ledger, reminders and top-debtors ranking.

## 📲 Install it

Open the app in Chrome on Android and tap **📲 Pasang app** (or Add to Home screen). It works offline at the pasar malam.
