# Buku 555 Berhantu 👻

> *Buku hutang digital untuk peniaga pasar Malaysia.*
> A haunted digital debt ledger for Malaysian market traders.

---


## 👻 Try the demo in 10 seconds

Open **https://apihpih96.github.io/buku-555-berhantu/?demo=1** (or tap **👻 Cuba Demo** in the footer).
It loads a sample warung book dated relative to today:

- **Pak Mat** and **Kak Ros** are overdue (ghosts appear 👻).
- **Kak Ros** has already made a partial payment of RM10 — her beras 5kg entry is split: RM10 paid, RM8.50 still owing. The payment history is visible under her name.
- **Abang Jeff** is due today; **Mak Cik Timah** is next week; **Adik Hafiz** has paid in full.

Try these actions to see the new features:

- **Edit** — tap any entry card (not a button) to open the inline edit dialog. Change amount, item, or due date. The undo bar appears for 8 seconds.
- **Undo** — tap **↩ Batal** in the yellow bar within 8 seconds to reverse the last action.
- **Customer statement** — tap a customer's name to open their full account page, then tap **📋 Hantar Penyata** to send an itemised statement via WhatsApp.
- **Partial payment** — type e.g. `Kak Ros bayar RM5` to apply a partial payment (FIFO, oldest entry first).

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
| Malay parser | Handles honorifics, Malay numbers, RM amounts, relative/named days, payment phrases |
| Partial payments | Type `Kak Ros bayar RM10` — FIFO allocation across oldest entries; full langsai with `settle semua`; payment history collapsible per customer |
| Undo / Edit | Every action (add, mark paid, pay, edit, delete) is undoable for 8 seconds via an undo bar; tap any entry card to edit inline |
| Customer statement | Tap a customer name for a full chronological account page; send an itemised WhatsApp statement via **Hantar Penyata** |
| Customer search | Honorific-aware search box filters the ledger in real time |
| Offline | Pure static site — works with no internet after first load |
| WhatsApp reminders | WhatsApp click-to-chat links (api.whatsapp.com/send, keeps emoji intact), Malaysian numbers normalised to `60XXXXXXXXX` |
| Backup | JSON export / import |
| Language | Bahasa Melayu (default) / English toggle |
| Halloween theme | Aged paper, Buku 555 red/blue, floating ghost animation |

---

## How Kiro was used

This project was built entirely using the **Kiro CLI** agentic development workflow:

1. **Steering docs** (`.kiro/steering/`) — product vision, tech constraints, and project structure were authored first, giving the AI a persistent specification to reference throughout.

2. **Spec generation** — Kiro generated spec files in `.kiro/specs/`:
   - **`buku-555/`** — initial core app: EARS-style user stories, architecture/data-model design, and T-1–T-27 implementation tasks.
   - **`bayaran-ansuran/`** — partial payments spec: FIFO payment allocation, `PaymentRecord` type, `applyPayment` function design, overpayment guard, payment history UI.
   - **`undo-dan-edit/`** — undo/edit spec: 8-second undo bar, in-memory snapshot stack (max 20), inline edit dialog, in-app delete confirm dialog.
   - **`penyata-pelanggan/`** — customer statement spec: customer page panel, `buildStatement` function, `daysSinceOldestUnpaid`, honorific-aware search, MCP `get_statement` tool.

3. **Implementation** — Kiro implemented all source files (`parser.js`, `ledger.js`, `i18n.js`, `app.js`, `index.html`, `styles.css`, `assets/ghost.svg`) following the specs, then extended them incrementally as each new spec was approved.

4. **Property-based testing (PBT)** — `fast-check` properties were designed in each spec's `design.md` first, then implemented in `tests/`. Properties include:
   - `amountRM` is always ≥ 0
   - `totalOutstanding` equals sum of unpaid entries
   - Marking paid reduces the total by exactly that entry's amount
   - Export → import round-trip preserves all entries
   - `applyPayment`: amounts never negative, total after partial pay = prior total − paid amount
   - Undo: n adds + n undos returns ledger to the original state
   - `buildStatement`: statement total equals `customerTotal`; all items appear in output; URL prefix is always correct

5. **Verification loop** — Kiro ran `npm install && npm test` and fixed failures until all tests were green, including after each new spec was integrated.

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
├── parser.js           # Pure Malay sentence parser (debt + payment phrases)
├── ledger.js           # Pure ledger math & data functions
├── i18n.js             # ms/en string translations
├── assets/
│   └── ghost.svg       # Friendly ghost SVG
├── tests/
│   ├── parser.test.js  # Unit + PBT for parser
│   ├── ledger.test.js  # Unit + PBT for ledger
│   ├── undo.test.js    # Unit + PBT for undo/edit (updateEntry, snapshot stack)
│   └── penyata.test.js # Unit + PBT for customer statement, search, MCP get_statement
├── mcp/
│   ├── server.js       # MCP stdio server
│   └── debts.js        # Tool implementations (list, add, mark paid, get_statement)
├── .kiro/
│   ├── steering/       # Product, tech & structure steering docs
│   └── specs/
│       ├── buku-555/          # Core app — requirements, design, tasks T-1–T-27
│       ├── bayaran-ansuran/   # Partial payments spec
│       ├── undo-dan-edit/     # Undo/edit spec
│       └── penyata-pelanggan/ # Customer statement spec
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

## 🔌 MCP server

`mcp/server.js` is a small, dependency-free [MCP](https://modelcontextprotocol.io) server (stdio) that lets Kiro read and update a debt book.

| Tool | What it does |
|------|--------------|
| `list_debts` | All debts + total outstanding (optional `status`: `all` / `unpaid` / `paid`) |
| `add_debt` | Add a debt: `name`, `item`, `amount` (RM, > 0) |
| `mark_debt_paid` | Mark a debt paid by `id` |
| `list_overdue_debts` | Unpaid debts written in the book more than 7 days ago (optional `days`) |

**Data:** the server reads and writes `data/buku555.json` (override with `BUKU555_DATA`), using the same format as the app's **Export** button: `{ "version": 1, "entries": [...], "phones": {} }`. The app itself stores data in your browser's localStorage, so to work with real data, export a backup from the app and save it as `data/buku555.json`. `data/` is git-ignored.

**Run it:**

```bash
node mcp/server.js          # Node ≥ 18, no npm install needed
```

It speaks JSON-RPC on stdin/stdout, so you won't see a prompt. Kiro starts it for you via `.kiro/settings/mcp.json` (server name `buku555`). Open the MCP panel in Kiro (or restart the session) and the four tools appear. Read-only tools are auto-approved; `add_debt` and `mark_debt_paid` ask first.

Quick manual check:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp/server.js
```

## 👻 Hantu Auditor agent

`.kiro/agents/hantu-auditor.json` is a custom Kiro agent that audits the debt book through the MCP server. It is **read-only** (it can only call `list_debts` and `list_overdue_debts`).

It looks for:
- **Overdue** debts: unpaid and older than 7 days, or past their due date.
- **Suspicious** debts: duplicates, unusually large amounts, blank or near-duplicate customer names, future dates, inconsistent paid fields, or many separate unpaid debts for one customer.

For each flagged debt it writes why it was flagged, plus a spooky-but-friendly reminder in **Bahasa Melayu** and **English**. It never sends anything; you review the messages and send them yourself.

Use it from the Kiro CLI with `kiro-cli --agent hantu-auditor` (or `/agent swap hantu-auditor` in a chat), then ask: *"Audit the book."*

## 🧰 How Kiro built this

- **Steering** (`.kiro/steering/`): `product.md`, `tech.md` and `structure.md` give Kiro the product vision and tech rules in every session: Malay-first copy, no server or tracking, big tap targets for older traders.
- **Specs** (`.kiro/specs/`):
  - `buku-555/` has the EARS requirements, a design with correctness properties, and tasks T-1 to T-27 that Kiro completed one by one.
  - `bayaran-ansuran/` defines the partial payments feature — FIFO `applyPayment`, `PaymentRecord` type, overpayment guard, payment history collapsible in the UI.
  - `undo-dan-edit/` defines the undo bar (8-second timer, max-20 in-memory snapshot stack) and the inline edit dialog with in-app delete confirm.
  - `penyata-pelanggan/` defines the customer statement page, `buildStatement` with WhatsApp URL, `daysSinceOldestUnpaid`, honorific-aware search, and the MCP `get_statement` tool.
  - `mcp-server/` defines the MCP server the same way.
- **Hooks** (`.kiro/hooks/`): `run-tests-on-save` runs `npm test` and fixes failures without weakening tests whenever a `.js` file is saved (root, `mcp/` or `tests/`); `i18n-check` makes sure every key in `i18n.js` has both Malay and English.
- **MCP server** (`mcp/`, `.kiro/settings/mcp.json`): lets Kiro list debts, add a debt, mark one paid, list debts older than 7 days, and fetch a customer statement via `get_statement`.
- **Hantu Auditor agent** (`.kiro/agents/hantu-auditor.json`): audits the book through the MCP server and drafts a bilingual spooky-but-friendly reminder for each overdue or suspicious debt.
- **Tests**: `node:test` plus `fast-check` property tests across four suites — parser, ledger, undo/edit, and customer statement. PBT properties cover amounts-never-negative, total = sum of unpaid, undo reversibility, and statement correctness.

## 📲 Install it

Open the app in Chrome on Android and tap **📲 Pasang app** (or Add to Home screen). It works offline at the pasar malam.
