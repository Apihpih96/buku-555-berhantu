# Tasks — Penyata Pelanggan (Customer Statement)

Numbered checklist of implementation tasks. Each task references the requirement or design section it satisfies.

---

## Phase 1 — Core Logic

- [x] T-PS-01 Add `buildStatement(entries, payments, customer, msisdn, today, lang)` pure function to `ledger.js` — filters all customer entries (paid+unpaid) and payment records, builds chronological statement text, wraps into `https://api.whatsapp.com/send?phone=...&text=...` URL, returns `{ text, url }` (FR-PS-4, Design §buildStatement)

- [x] T-PS-02 Add `daysSinceOldestUnpaid(entries, customer, today)` helper to `ledger.js` — returns integer days between oldest unpaid `createdAt` and today, 0 if no unpaid (FR-PS-1.1, Design §daysSinceOldestUnpaid)

## Phase 2 — i18n

- [x] T-PS-03 Add all new i18n keys to `i18n.js`: `searchPlaceholder`, `searchLabel`, `noSearchMatch`, `btnTutup`, `customerPageTitle`, `labelCreatedAt`, `labelStatus`, `labelUnpaid`, `labelPaidOn`, `labelDaysOwed`, `labelTotalOwed`, `btnHantarPenyata`, `ariaCustomerPage`, `ariaBtnTutup`, `ariaBtnHantarPenyata`, `stmtHeader`, `stmtNoBalance`, `stmtBalance`, `stmtPayment`, `stmtUnpaid`, `stmtPaid` in both `ms` and `en` (FR-PS-3.6, Design §i18n.js additions)

## Phase 3 — MCP Tool

- [x] T-PS-04 Add `get_statement` tool to `mcp/debts.js`: tool descriptor in `TOOLS` array and `case 'get_statement'` handler in `callTool` — loads book, finds customer entries, calls `buildStatement`, returns `{ customer, statementText, totalOutstandingRM, entryCount, unpaidCount }`, throws `ToolError` if customer not found (FR-PS-5, Design §mcp/debts.js additions)

## Phase 4 — HTML

- [x] T-PS-05 Add search box `<input id="customer-search">` with label above the ledger section in `index.html` (FR-PS-2, Design §Search box)

- [x] T-PS-06 Add `<section id="customer-page">` panel (initially hidden) with header, meta row, list container, and action buttons to `index.html` (FR-PS-1, FR-PS-3, Design §HTML structure)

## Phase 5 — App Logic

- [x] T-PS-07 Add `matchesSearch(customerName, query)` and `stripHonorifics(name)` functions to `app.js`; wire the `#customer-search` input event to filter the ledger render in `renderLedger()` — hide Top Debtors card when query is non-empty (FR-PS-2, Design §Search Matching)

- [x] T-PS-08 Add `openCustomerPage(customer)`, `closeCustomerPage()`, and `renderCustomerPage(customer)` to `app.js`; wire customer name headings as tappable buttons calling `openCustomerPage`; wire `#btn-tutup` to `closeCustomerPage` (FR-PS-1, Design §Navigation pattern)

- [x] T-PS-09 Wire `#btn-hantar-penyata` in `app.js` to use the same phone-dialog flow as `onWhatsApp`, then call `buildStatement` and open the URL (FR-PS-3, Design §Customer Page UI)

## Phase 6 — Styles

- [x] T-PS-10 Add CSS for `.customer-page`, `.customer-page-header`, `.customer-page-name`, `.customer-page-meta`, `.customer-page-list`, `.customer-stmt-row`, `.customer-stmt-row.payment`, `.search-row`, `.customer-search` — ≥48px tap targets, ≥18px font, high contrast, consistent with existing palette (NFR-PS-1)

## Phase 7 — Tests

- [x] T-PS-11 Add `tests/penyata.test.js` with:
  - Unit tests for `buildStatement`: empty input → `{ text:'', url:'' }`; known customer → text contains total; paid entries labeled; URL prefix `https://api.whatsapp.com/send?phone=60`; both languages
  - Unit tests for `daysSinceOldestUnpaid`: no unpaid → 0; correct day count
  - Unit tests for search matching: case-insensitive; honorific stripping; empty query → all pass
  - PBT: statement total = sum of unpaid; all entries appear; URL prefix; empty customer → empty result (Design §Correctness Properties 1–9)

- [x] T-PS-12 Add MCP `get_statement` tests to `tests/penyata.test.js` (or inline in the file): unknown customer → ToolError; known customer → statementText matches `buildStatement`; totalOutstandingRM correct (AC-PS-9, AC-PS-10)

## Phase 8 — Agent

- [x] T-PS-13 Update `.kiro/agents/hantu-auditor.json` to add `get_statement` to `allowedTools` and update the `prompt` to instruct the agent to optionally call `get_statement` for flagged customers to include the statement text in its report (FR-PS-5.4)

## Phase 9 — Verification

- [x] T-PS-14 Run `npm test` and fix all failures until all tests pass without weakening existing tests

- [x] T-PS-15 Mark all completed tasks with `[x]`
