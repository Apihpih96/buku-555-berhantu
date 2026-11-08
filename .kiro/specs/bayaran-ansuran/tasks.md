# Tasks — Bayaran Ansuran (Partial Payments)

Numbered checklist of implementation tasks. Each task references the requirement or design section it satisfies.

---

## Phase 1 — Parser

- [x] T-PA-01 Add payment keyword detection to `parser.js`: define `PAYMENT_TRIGGERS_MULTI`, `PAYMENT_TRIGGERS_SINGLE_UNCONDITIONAL`, `SETTLE_ALL_TRIGGERS` sets and add `isPaymentSentence(tokens)` and `findPaymentTrigger(tokens)` helpers (FR-PA-1, Design §Parser Extension)
- [x] T-PA-02 Implement `parsePayment(input, today)` in `parser.js`: marks trigger tokens as used, extracts amount with existing `extractAmount`, extracts customer name with existing honorific/name logic, returns `{ type: 'payment', customer, amountRM }` — `amountRM` is `null` for settle-all triggers (FR-PA-1.1–FR-PA-1.3, Design §parsePayment algorithm)
- [x] T-PA-03 Update `parse(input, today)` to call `isPaymentSentence` first and return `parsePayment(input, today)` if true; existing debt-entry path unchanged (FR-PA-1.4)

## Phase 2 — Ledger

- [x] T-PA-04 Add `PaymentRecord` JSDoc typedef to `ledger.js`: `{ id, customer, amountRM, paidAt, raw }` (Design §Data Model)
- [x] T-PA-05 Implement `applyPayment(ledger, payments, customer, amountRM, raw)` pure function in `ledger.js`: handles settle-all (amountRM null), overpayment guard, FIFO partial split, PaymentRecord append; returns `{ ledger, payments, warning }` (FR-PA-2, Design §applyPayment algorithm)
- [x] T-PA-06 Implement `migrateStorage(data)` pure function in `ledger.js`: adds `payments: []` when missing, normalises all fields; used in `loadState` in `app.js` (FR-PA-5.1, Design §migrateStorage)
- [x] T-PA-07 Implement `customerPayments(payments, customer)` pure query in `ledger.js`: returns PaymentRecord[] for customer sorted by paidAt descending (FR-PA-3.3, Design §customerPayments)
- [x] T-PA-08 Update `exportJSON(ledger, phones, payments)` to include `payments` in JSON output; update `importJSON` to merge payments array (deduplicate by id, existing take precedence); return `{ ledger, phones, payments }` (FR-PA-5.2, Design §Updated Functions)

## Phase 3 — i18n

- [x] T-PA-09 Add new i18n keys to `i18n.js`: `successPayment`, `errOverpayment`, `errNoDebt`, `labelPaymentHistory`, `labelBalance`, `labelSettleAll`, `ariaPaymentHistory` — both `ms` and `en` for every key (FR-PA-6.4, Design §i18n Keys)

## Phase 4 — App

- [x] T-PA-10 Update `loadState()` in `app.js`: add `payments` to state, call `migrateStorage()` to normalise loaded data, load `payments` from storage (FR-PA-5.1)
- [x] T-PA-11 Update `saveState()` in `app.js`: include `payments` in the serialised storage object (FR-PA-3.1)
- [x] T-PA-12 Route payment parse results in `onAddEntry()` in `app.js`: if `result.type === 'payment'` call `onApplyPayment(customer, amountRM, raw)` and return; otherwise keep existing debt-entry path (FR-PA-6.1, Design §Input routing)
- [x] T-PA-13 Implement `onApplyPayment(customer, amountRM, raw)` in `app.js`: call `applyPayment()`, handle `warning: 'overpayment'` / `warning: 'no_debt'` with feedback toasts, on success update ledger/payments, `saveState()`, `renderLedger()`, show success toast (FR-PA-6.1, FR-PA-6.2, Design §onApplyPayment)
- [x] T-PA-14 Update `renderLedger()` / customer section rendering in `app.js` to show payment history `<details>` under each customer when `customerPayments(payments, customer).length > 0`; display each payment as amount + formatted date; collapsed by default (FR-PA-3.3, FR-PA-6.3)

## Phase 5 — Tests

- [x] T-PA-15 Add parser unit tests in `tests/parser.test.js`: all example inputs from design.md table (AC-PA-1, AC-PA-2, AC-PA-3); null customer returns null; seringgit in payment; settle-all keywords (FR-PA-1, AC-PA-1–3)
- [x] T-PA-16 Add `applyPayment` unit tests in `tests/ledger.test.js`: single entry partial split (AC-PA-4), multi-entry FIFO (AC-PA-5), overpayment rejection (AC-PA-6), langsai clears all (AC-PA-7), no-debt rejection, exact remaining balance (FR-PA-2, AC-PA-4–7)
- [x] T-PA-17 Add `customerPayments` and `migrateStorage` unit tests in `tests/ledger.test.js`: migration adds payments field, customerPayments filters correctly, sorted newest first (FR-PA-5, FR-PA-3)
- [x] T-PA-18 Add property-based tests in `tests/ledger.test.js` for `applyPayment` (PA-1 through PA-10 from design.md §Correctness Properties): balance never negative, sum invariant, overpayment always rejected, langsai clears all, FIFO order, payment records grow monotonically (FR-PA-2, NFR-PA-1)

## Phase 6 — Verification

- [x] T-PA-19 Run `npm test` and fix all failures until all tests pass without weakening any existing tests
- [x] T-PA-20 Mark all tasks in this file as complete
