# Requirements — Bayaran Ansuran (Partial Payments)

## Overview
Malaysian market traders frequently receive partial payments — "Kak Ros bayar RM10 dulu" (Kak Ros pays RM10 first). The system must recognise payment sentences in Bahasa Melayu, apply payments FIFO across a customer's unpaid entries, display remaining balances, and handle edge cases such as overpayment and full-settlement phrases ("langsai"/"settle semua").

---

## Functional Requirements

### FR-PA-1: Payment Sentence Parsing

**FR-PA-1.1** WHEN the parser receives a sentence containing a payment keyword (`bayar`, `dah bayar`, `bagi`, `settle`, `langsai`) with an amount, it SHALL return a `ParsedPayment` object with `{ type: 'payment', customer, amountRM }` instead of a debt entry.

**FR-PA-1.2** WHEN the parser receives a sentence with `langsai` or `settle semua` (with or without an amount), it SHALL set `amountRM: null` to signal full settlement of all of the customer's outstanding debt.

**FR-PA-1.3** WHEN the parser cannot identify a customer name in a payment sentence, it SHALL return `null` for `customer` so the caller can show an error.

**FR-PA-1.4** WHEN the parser receives an ambiguous sentence that contains both a payment keyword and debt keywords, the payment keyword SHALL take precedence and the sentence is parsed as a payment.

---

### FR-PA-2: Payment Application (Ledger)

**FR-PA-2.1** WHEN a payment is applied, the system SHALL apply it to the customer's unpaid entries in chronological order (oldest `createdAt` first — FIFO), splitting an entry when the payment covers only part of it.

**FR-PA-2.2** WHEN a payment fully covers an entry, the system SHALL mark that entry as paid (`paid: true`, `paidAt: now`).

**FR-PA-2.3** WHEN a payment partially covers an entry, the system SHALL split it into two: a paid entry for the amount covered and an updated unpaid entry for the remainder.

**FR-PA-2.4** WHEN a payment uses `langsai`/`settle semua` (amount null), the system SHALL mark all of the customer's unpaid entries as paid.

**FR-PA-2.5** WHEN a payment exceeds the customer's total outstanding balance (overpayment), the system SHALL NOT apply the payment and SHALL display a warning showing the actual outstanding balance.

**FR-PA-2.6** WHEN a customer has no unpaid entries, the system SHALL NOT apply the payment and SHALL display an error.

---

### FR-PA-3: Payment Records

**FR-PA-3.1** WHEN a payment is applied, the system SHALL append a `PaymentRecord` to the ledger's payment history, stored alongside entries in localStorage (`buku555.v1`).

**FR-PA-3.2** A `PaymentRecord` SHALL contain: `id`, `customer`, `amountRM`, `paidAt` (ISO timestamp), `raw` (original input string).

**FR-PA-3.3** WHEN the trader views a customer's card, the system SHALL display a short payment history section listing each recorded payment with its amount and date.

---

### FR-PA-4: Balance Display

**FR-PA-4.1** WHEN a customer has at least one partially-paid entry, the system SHALL display the remaining balance on the entry card.

**FR-PA-4.2** WHEN displaying the WhatsApp reminder, the system SHALL use the remaining balance (unpaid portion) not the original debt amount.

**FR-PA-4.3** WHEN a customer's total remaining balance is zero, the system SHALL remove the ghost icon and not show the customer in the outstanding section.

---

### FR-PA-5: Data Migration

**FR-PA-5.1** WHEN loading `buku555.v1` data that lacks the `payments` field, the system SHALL add `payments: []` automatically (backward-compatible migration).

**FR-PA-5.2** WHEN importing a backup JSON that contains a `payments` array, the system SHALL merge it with the current payments (deduplicate by `id`, existing entries take precedence).

---

### FR-PA-6: UI

**FR-PA-6.1** WHEN the parser returns a payment result, the system SHALL display a confirmation toast ("Bayaran RM10 dicatat untuk Kak Ros") before applying.

**FR-PA-6.2** WHEN an overpayment is detected, the system SHALL display a warning toast in the current language (ms/en) showing the actual outstanding balance; the payment SHALL NOT be applied.

**FR-PA-6.3** WHEN a customer card displays payment history, the history SHALL be collapsed by default (e.g. inside a `<details>`) so it does not clutter the main view.

**FR-PA-6.4** All new UI strings SHALL be present in both `ms` and `en` in `i18n.js`.

---

## Non-Functional Requirements

**NFR-PA-1** The `applyPayment` function in `ledger.js` SHALL be pure (no side effects, returns new ledger + payments arrays).

**NFR-PA-2** The `parsePayment` detection in `parser.js` SHALL be deterministic — same input always produces same output.

**NFR-PA-3** No external runtime dependencies SHALL be added; fast-check remains the only devDependency.

**NFR-PA-4** All new ledger functions SHALL work in Node without DOM access (testable with `node --test`).

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-PA-1 | `parse('Kak Ros bayar RM10')` returns `{ type: 'payment', customer: 'Kak Ros', amountRM: 10 }` |
| AC-PA-2 | `parse('Kak Ros langsai')` returns `{ type: 'payment', customer: 'Kak Ros', amountRM: null }` |
| AC-PA-3 | `parse('Kak Ros dah bayar dua puluh ringgit')` returns `{ type: 'payment', customer: 'Kak Ros', amountRM: 20 }` |
| AC-PA-4 | Applying RM10 to a customer with a single RM18 entry splits it into a RM10 paid entry + RM8 unpaid entry |
| AC-PA-5 | Applying RM30 to a customer with RM10 + RM15 entries marks both paid and leaves RM5 remaining as an unpaid entry |
| AC-PA-6 | Applying RM100 to a customer who owes RM18 is rejected with an overpayment warning |
| AC-PA-7 | Applying `langsai` marks all unpaid entries for that customer as paid |
| AC-PA-8 | WhatsApp reminder shows remaining balance (RM8 from AC-PA-4), not original debt (RM18) |
| AC-PA-9 | Old `buku555.v1` data (without `payments` key) loads without error; `payments` defaults to `[]` |
| AC-PA-10 | Total outstanding = sum of unpaid amountRM = sum of original debts minus sum of applied payments |
| AC-PA-11 | `totalOwed - sumPayments >= 0` at all times (no negative balance) |
| AC-PA-12 | All new i18n keys have both `ms` and `en` values |
