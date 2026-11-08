# Requirements — Penyata Pelanggan (Customer Statement)

## Overview
Allow the trader to tap a customer name, view a full chronological account (all entries and payments), and send a polished itemised WhatsApp statement via the existing wa.me link builder. A search box above the customer list helps the trader locate names quickly, ignoring honorifics. An MCP `get_statement` tool exposes the same statement data to agents (e.g. Hantu Auditor).

---

## Functional Requirements

### FR-PS-1: Customer Page

**FR-PS-1.1** WHEN the trader taps a customer name in the ledger list, the system SHALL navigate to (or display) a customer detail page/panel showing:
- All ledger entries for that customer (paid and unpaid), sorted oldest first by `createdAt`.
- All payment records for that customer, interleaved chronologically.
- Total amount currently owed (unpaid `amountRM` sum).
- Days since the oldest unpaid debt was created (not the due date).

**FR-PS-1.2** WHEN the customer detail page is displayed, each entry row SHALL show: date created (`createdAt` formatted as local date), item name, quantity (if any), amount (RM), due date (if any), and paid/unpaid status with paid-at date for paid entries.

**FR-PS-1.3** WHEN the customer detail page is displayed, each payment record row SHALL show: date paid, amount paid (RM), and be clearly labelled as a payment (e.g. "✓ Bayar").

**FR-PS-1.4** WHEN the trader taps a "Tutup" / "Close" button (or navigates back), the system SHALL return to the main ledger view.

**FR-PS-1.5** WHEN the customer has no entries at all, the customer detail page SHALL NOT be shown; tapping the name SHALL have no effect.

---

### FR-PS-2: Search Box

**FR-PS-2.1** WHEN the main ledger screen is shown, the system SHALL display a text search box above the customer list labelled "Cari pelanggan" (ms) / "Search customer" (en).

**FR-PS-2.2** WHEN the trader types in the search box, the system SHALL filter the customer list in real time (case-insensitive) to show only customers whose names match the query after stripping common Malay honorifics: `Kak`, `Abang`, `Pak Cik`, `Mak Cik`, `Encik`, `Puan`, `Cik`.

**FR-PS-2.3** WHEN the search box is empty, the system SHALL display all customers (no filtering).

**FR-PS-2.4** WHEN no customers match the search query, the system SHALL display an "empty" message (e.g. "Tiada padanan." / "No match.").

**FR-PS-2.5** WHEN a search query is active, the Top Debtors card SHALL be hidden (to avoid confusion with the filtered list).

---

### FR-PS-3: Hantar Penyata (Send Statement)

**FR-PS-3.1** WHEN the trader views the customer detail page, the system SHALL display a "Hantar Penyata" / "Send Statement" button.

**FR-PS-3.2** WHEN the trader taps "Hantar Penyata", the system SHALL:
1. Resolve the customer's phone number (using the same `phones` map and dialog flow as the existing "Hantar Peringatan" button).
2. Build an itemised statement message containing: greeting, each entry (date, item, qty, amount, status), each payment (date, amount), and a closing balance line.
3. Open `https://api.whatsapp.com/send?phone=<normalised>&text=<encoded>` in a new tab.

**FR-PS-3.3** The system SHALL NOT send any message automatically; the trader must press Send in WhatsApp.

**FR-PS-3.4** WHEN building the statement, the system SHALL use local calendar dates (never `toISOString()`) for all date formatting in the message body.

**FR-PS-3.5** WHEN the customer has no entries, the "Hantar Penyata" button SHALL be disabled or hidden.

**FR-PS-3.6** WHEN the UI language is English, the statement message SHALL be written in English following the same tone.

---

### FR-PS-4: `buildStatement` Pure Function

**FR-PS-4.1** The system SHALL expose a `buildStatement(entries, payments, customer, msisdn, today, lang)` pure function in `ledger.js` that:
- Accepts the full ledger, payment records, customer name, raw phone, reference date, and language.
- Returns an object `{ text: string, url: string }` where `text` is the full statement message and `url` is the complete `https://api.whatsapp.com/send?phone=...&text=...` link.
- Returns `{ text: '', url: '' }` when the customer has no entries at all.

**FR-PS-4.2** WHEN building the statement message, the function SHALL include:
- **ms:** "Penyata Akaun" header; each entry line as `{date} | {item} [{×qty}] | RM{amount} [{status}]`; each payment as `{date} | ✓ Bayar | RM{amount}`; total owed line.
- **en:** "Account Statement" header; same structure with English labels.

**FR-PS-4.3** WHEN the customer has unpaid entries, the statement SHALL include a closing line with total outstanding (e.g. "Baki: RM18.50" / "Balance: RM18.50").

**FR-PS-4.4** WHEN all entries are paid, the statement SHALL say "Tiada baki tertunggak 🎉" / "No outstanding balance 🎉".

---

### FR-PS-5: MCP `get_statement` Tool

**FR-PS-5.1** The MCP server (`mcp/debts.js`) SHALL expose a `get_statement` tool that accepts `{ customer: string }` and returns `{ customer, statementText, totalOutstandingRM, entryCount, unpaidCount }`.

**FR-PS-5.2** WHEN the customer name is not found in the book, `get_statement` SHALL throw a `ToolError` with a descriptive message.

**FR-PS-5.3** The `get_statement` tool SHALL use the same `buildStatement` logic as the UI (via import), so statement text is identical whether generated by the UI or the MCP tool.

**FR-PS-5.4** WHEN the Hantu Auditor agent calls `get_statement`, it SHALL receive the statement as a JSON object and MAY present the statement text to the user in its output.

---

## Non-Functional Requirements

**NFR-PS-1** All interactive elements on the customer page SHALL have a minimum tap target of 48 × 48 px and a font size ≥ 18 px (consistent with existing NFR-1 and NFR-2).

**NFR-PS-2** The `buildStatement` function SHALL be pure, deterministic, and testable in Node without DOM (consistent with existing NFR-7).

**NFR-PS-3** No new runtime JavaScript dependencies SHALL be introduced.

**NFR-PS-4** The search box SHALL be keyboard-accessible (focusable, responds to input event).

---

## Acceptance Criteria Summary

| ID | Criterion |
|----|-----------|
| AC-PS-1 | Tapping a customer name opens the detail view showing all entries and payments |
| AC-PS-2 | Detail view shows total owed and days since oldest unpaid debt |
| AC-PS-3 | "Hantar Penyata" opens the correct `api.whatsapp.com` URL in a new tab |
| AC-PS-4 | Statement URL starts with `https://api.whatsapp.com/send?phone=60` |
| AC-PS-5 | Statement text total equals sum of all unpaid entry amounts for the customer |
| AC-PS-6 | Paid entries appear in statement with "✓ Bayar" / "✓ Paid" label |
| AC-PS-7 | Search filters customers case-insensitively, ignoring honorifics |
| AC-PS-8 | Empty search shows all customers; no-match query shows empty message |
| AC-PS-9 | MCP `get_statement` returns same statement text as `buildStatement` |
| AC-PS-10 | MCP `get_statement` throws ToolError for unknown customer |
| AC-PS-11 | `buildStatement` returns `{ text: '', url: '' }` for customer with no entries |
| AC-PS-12 | Search box hides Top Debtors card when query is non-empty |
