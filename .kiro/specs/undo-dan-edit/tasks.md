# Tasks — Undo dan Edit

Numbered checklist for implementing undo, edit, and confirm-delete. Each task references the requirement or design section it satisfies.

---

## Phase 1 — Ledger: updateEntry

- [x] T-U01 Add `updateEntry(ledger, id, fields)` pure function to `ledger.js` — replaces mutable fields of a matching entry by id, validates amountRM >= 0, round2 the amount, returns new array (FR-E1.2, Design §updateEntry)

## Phase 2 — i18n: new strings

- [x] T-U02 Add all new i18n keys (btnUndo, ariaUndo, undoLabelAdd, undoLabelPaid, undoLabelPayment, undoLabelDelete, undoLabelEdit, toastUndoDone, btnEdit, ariaEditEntry, dialogEditTitle, dialogEditLabel*, successEdit, errEditCustomer, errEditAmount, dialogDeleteTitle, dialogDeleteMsg, btnConfirmDelete, ariaDeleteDialog, ariaConfirmDelete) in both `ms` and `en` inside `i18n.js` (NFR-U1, Design §i18n Keys)

## Phase 3 — HTML: new elements

- [x] T-U03 Add `<div id="undo-bar">` with label span and `#btn-undo` button to `index.html`, initially hidden (FR-U1.1, Design §Undo Bar UI)
- [x] T-U04 Add `<dialog id="edit-dialog">` with customer/item/amount/due-date inputs, error paragraph, Batal and Simpan buttons to `index.html` (FR-E1.1, Design §Edit Entry Dialog)
- [x] T-U05 Add `<dialog id="delete-dialog">` with message paragraph and Batal/Padam buttons to `index.html` (FR-D1.1, Design §Confirm Delete Dialog)

## Phase 4 — CSS: undo bar and dialog styles

- [x] T-U06 Add CSS for `#undo-bar` — fixed bottom, full-width, dark-red background, white text, `min-height: 56px`, slide-in animation, z-index above cards, `#btn-undo` ≥ 56px tall (FR-U1.5, FR-U1.6, NFR-U5)
- [x] T-U07 Add CSS for `#edit-dialog` — centred modal, large inputs (≥ 48px tap targets, ≥ 18px font), Batal/Simpan buttons ≥ 48px, error paragraph styled in red (FR-E1.6)
- [x] T-U08 Add CSS for `#delete-dialog` — centred modal, Padam/Batal buttons ≥ 56px tall (FR-D1.4)

## Phase 5 — app.js: undo stack and bar

- [x] T-U09 Add `undoHistory`, `undoTimer`, `UNDO_MAX = 20` constants; implement `pushUndo(label)` — shallow-copies ledger/payments/phones, caps history at 20 (FR-U2.1, FR-U2.3, Design §Undo Stack)
- [x] T-U10 Implement `doUndo()` — pops snapshot, restores state, calls saveState/renderAll/hideUndoBar, shows toast (FR-U1.2, FR-U2.2, Design §doUndo)
- [x] T-U11 Implement `showUndoBar(label)` and `hideUndoBar()` — manage #undo-bar visibility and 8-second timeout (FR-U1.1, FR-U1.3, FR-U1.4)
- [x] T-U12 Wire `#btn-undo` click to `doUndo()` in `init()` (FR-U1.2)

## Phase 6 — app.js: instrument all mutations with pushUndo + showUndoBar

- [x] T-U13 In `onAddEntry()`: call `pushUndo('undoLabelAdd')` before mutating, call `showUndoBar(T('undoLabelAdd'))` after success (AC-U1)
- [x] T-U14 In `onMarkPaid()`: call `pushUndo('undoLabelPaid')` before, `showUndoBar(T('undoLabelPaid'))` after (AC-U2)
- [x] T-U15 In `onApplyPayment()`: call `pushUndo('undoLabelPayment')` before mutating (after warning checks pass), `showUndoBar(T('undoLabelPayment'))` after (AC-U3)
- [x] T-U16 In `onDelete()`: replace `window.confirm` with in-app dialog; call `pushUndo('undoLabelDelete')` before mutating, `showUndoBar(T('undoLabelDelete'))` after (FR-D1.1, AC-U4, AC-D1, AC-D2)

## Phase 7 — app.js: edit entry

- [x] T-U17 Add `editingId` module-level variable; implement `onEditEntry(id)` — finds entry, pre-fills dialog fields, shows dialog via `showModal()` (FR-E1.1, AC-E1)
- [x] T-U18 Implement `onConfirmEdit()` — validates fields, calls `pushUndo`, `updateEntry`, `saveState`, `renderAll`, closes dialog, shows toast + undo bar; on error shows message inside dialog and keeps it open (FR-E1.2–FR-E1.4, AC-E2–AC-E4)
- [x] T-U19 Wire `#edit-dialog-batal` to close dialog; wire `#edit-dialog-simpan` to `onConfirmEdit()`; wire backdrop click to close (FR-E1.5)
- [x] T-U20 In `buildEntryCard()`: add tap handler on the card `<article>` (not on action buttons) that calls `onEditEntry(entry.id)` for unpaid entries; add visual Edit affordance (subtle underline / cursor pointer) (FR-E1.1, FR-E1.7, AC-E1)

## Phase 8 — Tests

- [x] T-U21 Create `tests/undo.test.js` — import `updateEntry` from `ledger.js`; write unit tests for `updateEntry`: updates fields, rejects negative amount, does not mutate original (T-U01 coverage)
- [x] T-U22 Write undo snapshot tests in `tests/undo.test.js` — simulate push/pop on plain state objects: undo after add, undo after markPaid, undo after applyPayment, undo after deleteEntry, undo after updateEntry each return ledger to exactly its previous state (AC-U1–AC-U7)
- [x] T-U23 Write history-cap unit test — after 21 pushes the history array length is ≤ 20 (AC-U6)
- [x] T-U24 Write PBT in `tests/undo.test.js` — for any sequence of n ≤ 5 add operations followed by n undos, the ledger always returns to the original state (AC-U7, Design §Correctness Properties 7)

## Phase 9 — Verification

- [x] T-U25 Run `npm test` and fix all failures without weakening any tests until all pass
- [x] T-U26 Mark all completed tasks with `[x]`
