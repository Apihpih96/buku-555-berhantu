# Requirements — Undo dan Edit (Batal & Kemaskini)

## Overview
Make mistakes safe for an older trader on a cheap Android phone. After any mutating action the trader can tap a large "Batal / Undo" bar for 8 seconds to fully restore the previous ledger state. Entries can be edited inline through a big-button form that reuses parser validation. Deleting requires confirmation via an in-app dialog (not native confirm). The last 20 actions are kept in an in-memory undo history.

---

## Functional Requirements

### FR-U1: Undo Bar

**FR-U1.1** WHEN the trader performs any of the following actions — add entry, mark paid, apply payment, delete entry, or edit entry — the system SHALL display an "Undo / Batal" bar prominently at the bottom of the viewport for exactly 8 seconds.

**FR-U1.2** WHEN the undo bar is visible and the trader taps "Batal / Undo", the system SHALL restore `ledger`, `payments`, and `phones` to exactly the state they held before that action, save the restored state to localStorage, and hide the undo bar immediately.

**FR-U1.3** WHEN the undo bar auto-dismisses after 8 seconds without a tap, the system SHALL hide the bar silently. The committed action is then permanent until another action is performed.

**FR-U1.4** WHEN a second action is performed while the undo bar is still showing, the system SHALL push the current snapshot to the history stack, start the 8-second timer fresh for the new action, and update the undo bar label to reflect the new action type.

**FR-U1.5** WHEN the undo bar is visible and the page is scrolled, the bar SHALL remain fixed at the bottom of the viewport.

**FR-U1.6** The undo bar tap target SHALL be at least 56px tall with a font size of at least 18px so it is easy for an older trader to tap on a cheap phone.

---

### FR-U2: Undo History

**FR-U2.1** The system SHALL keep the last 20 snapshots in an in-memory history array (not persisted to localStorage). The history is cleared on page reload.

**FR-U2.2** WHEN an undo is performed, the system SHALL pop the most recent snapshot from the history and restore it. Redo is not required.

**FR-U2.3** WHEN the history contains 20 snapshots and a new action is performed, the system SHALL discard the oldest snapshot to cap the array at 20.

---

### FR-E1: Edit Entry

**FR-E1.1** WHEN the trader taps an unpaid entry card, the system SHALL open a large-button edit dialog (using `<dialog>`) pre-filled with the current values: customer name, item, amount (RM), and due date (or blank).

**FR-E1.2** WHEN the trader confirms an edit, the system SHALL validate the fields — customer must be non-empty, amountRM must be > 0 — and update the entry in the ledger using the same rules as parser validation.

**FR-E1.3** WHEN validation fails on edit submit, the system SHALL display an error message inside the dialog and keep the dialog open.

**FR-E1.4** WHEN an edit is confirmed successfully, the system SHALL close the dialog, update the ledger, save to localStorage, re-render, show a success toast, and display the undo bar (so the edit can be undone).

**FR-E1.5** WHEN the trader taps "Batal" inside the edit dialog, the system SHALL close the dialog without making any changes.

**FR-E1.6** The edit dialog fields SHALL use font size ≥ 18px and tap targets ≥ 48px on all buttons and inputs.

**FR-E1.7** WHEN the trader taps a PAID entry, no edit action is taken (paid entries are read-only; the tap target is removed).

---

### FR-D1: Confirm Delete

**FR-D1.1** WHEN the trader taps "Padam / Delete" on an entry, the system SHALL open an in-app `<dialog>` asking for confirmation rather than using the native `window.confirm`.

**FR-D1.2** WHEN the trader confirms deletion, the system SHALL delete the entry, save to localStorage, re-render, and display the undo bar.

**FR-D1.3** WHEN the trader cancels the delete dialog, the system SHALL close the dialog without making any changes.

**FR-D1.4** The confirm dialog tap targets (Padam / Batal) SHALL be at least 56px tall so they are unambiguous on a small phone screen.

---

## Non-Functional Requirements

**NFR-U1** All new UI strings SHALL exist in both `ms` and `en` inside `i18n.js`.

**NFR-U2** The undo history array SHALL live entirely in memory; it SHALL NOT be written to localStorage.

**NFR-U3** The edit form SHALL reuse parser-level field validation (non-empty customer, positive amountRM) without coupling to the full sentence parser.

**NFR-U4** No new runtime npm dependencies. Implementation uses plain ES module JS matching the existing code style.

**NFR-U5** All new touch targets SHALL be at least 48px; the undo bar and delete confirm buttons SHALL be at least 56px.

---

## Acceptance Criteria

| ID    | Criterion |
|-------|-----------|
| AC-U1 | After adding an entry, tapping Undo within 8 s returns `totalOutstanding` to the value before the add. |
| AC-U2 | After marking an entry paid, tapping Undo within 8 s restores the entry to unpaid status. |
| AC-U3 | After applying a payment, tapping Undo within 8 s restores the ledger and payment records. |
| AC-U4 | After deleting an entry, tapping Undo within 8 s restores the entry to the ledger. |
| AC-U5 | After editing an entry, tapping Undo within 8 s restores the original field values. |
| AC-U6 | At most 20 snapshots exist in the history array at any time. |
| AC-U7 | Undo after every action type returns the ledger to exactly its previous state (property: `previousLedger deepEqual currentLedger` after undo). |
| AC-E1 | Tapping an unpaid entry opens the edit dialog pre-filled with the entry's current values. |
| AC-E2 | Submitting the edit dialog with empty customer shows an error and keeps the dialog open. |
| AC-E3 | Submitting the edit dialog with amountRM ≤ 0 shows an error and keeps the dialog open. |
| AC-E4 | Submitting a valid edit closes the dialog and updates the entry in the ledger. |
| AC-D1 | Tapping Padam opens the in-app confirm dialog (not native confirm). |
| AC-D2 | Confirming deletion removes the entry and shows the undo bar. |
| AC-D3 | Cancelling the delete dialog leaves the entry intact. |
