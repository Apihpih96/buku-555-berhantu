# Design — Undo dan Edit

## Architecture Change Summary

The feature is entirely confined to `app.js` (undo stack, edit dialog wiring, custom confirm dialog, undo bar) and `i18n.js` (new strings). `ledger.js` gains one new pure function: `updateEntry`. The existing pure-immutable style means undo needs only to store shallow copies of the three state arrays.

```
app.js (modified)
  ├── undoHistory: Snapshot[]   ← new in-memory stack (max 20)
  ├── undoTimer: TimeoutId      ← 8-second countdown
  ├── pushUndo(label)           ← captures state snapshot
  ├── doUndo()                  ← pops + restores
  ├── showUndoBar(label)        ← displays the undo bar for 8 s
  ├── hideUndoBar()             ← removes bar / clears timer
  ├── onEditEntry(id)           ← opens edit dialog
  ├── onConfirmEdit()           ← validates + applies edit
  └── onDeleteConfirm(id)       ← opens custom delete dialog

ledger.js (modified)
  └── updateEntry(ledger, id, fields)   ← new pure function

i18n.js (modified)
  └── new keys: btnUndo, ariaUndo, toastUndo*, btnEdit, ariaEditEntry,
                dialogEditTitle, dialogEditCustomer, dialogEditItem,
                dialogEditAmount, dialogEditDueDate, dialogDeleteTitle,
                dialogDeleteMsg, ariaDeleteDialog, btnConfirmDelete,
                successEdit, errEditCustomer, errEditAmount
```

No new files. No new npm dependencies.

---

## Undo Stack Design

### Snapshot type
```js
/**
 * @typedef {Object} Snapshot
 * @property {LedgerEntry[]}         ledger
 * @property {PaymentRecord[]}       payments
 * @property {Record<string,string>} phones
 * @property {string}                label   — i18n key for undo bar message
 */
```

### `pushUndo(label)`
Captures the current state before a mutation:
```js
function pushUndo(label) {
  undoHistory.push({ ledger: ledger.slice(), payments: payments.slice(), phones: { ...phones }, label });
  if (undoHistory.length > UNDO_MAX) undoHistory.shift(); // cap at 20
}
```

The arrays are shallow-copied (`slice()` / `{...}`) — sufficient because ledger entries themselves are never mutated (immutable-style throughout).

### `doUndo()`
```js
function doUndo() {
  const snap = undoHistory.pop();
  if (!snap) return;
  ledger   = snap.ledger;
  payments = snap.payments;
  phones   = snap.phones;
  saveState();
  renderAll();
  hideUndoBar();
  showFeedback(T('toastUndoDone'), 'success');
}
```

### Integration with every mutating action

Before each existing `ledger = …` / `payments = …` mutation, insert `pushUndo(label)`:

| Action | i18n label key |
|--------|---------------|
| `onAddEntry` | `undoLabelAdd` |
| `onMarkPaid` | `undoLabelPaid` |
| `onApplyPayment` | `undoLabelPayment` |
| `onDelete` | `undoLabelDelete` |
| `onEditEntry` | `undoLabelEdit` |

After every successful mutation, call `showUndoBar(T(label))`.

---

## Undo Bar UI

### HTML element (added to `index.html`)
```html
<div id="undo-bar" class="undo-bar" role="status" aria-live="polite" hidden>
  <span id="undo-bar-label" class="undo-bar-label"></span>
  <button id="btn-undo" class="btn btn-undo" type="button" aria-label="Batal tindakan">
    ↩ Batal
  </button>
</div>
```

### CSS rules (added to `styles.css`)
- Fixed at bottom, full-width, high-contrast (dark red bar, white text)
- `min-height: 56px` for the bar itself
- `#btn-undo` has `min-height: 56px`, `font-size: 1.2rem`, `padding: 0 2rem`
- Slide-in animation from bottom on show; hidden = `display: none`
- z-index above entry cards but below `<dialog>` elements

### `showUndoBar(label)` / `hideUndoBar()`
```js
const UNDO_TIMEOUT_MS = 8000;
let undoTimer = null;

function showUndoBar(label) {
  clearTimeout(undoTimer);
  $('undo-bar-label').textContent = label;
  $('undo-bar').hidden = false;
  undoTimer = setTimeout(hideUndoBar, UNDO_TIMEOUT_MS);
}

function hideUndoBar() {
  clearTimeout(undoTimer);
  undoTimer = null;
  $('undo-bar').hidden = true;
}
```

---

## Edit Entry Dialog

### HTML element (added to `index.html`)
```html
<dialog id="edit-dialog" class="edit-dialog" aria-modal="true">
  <form id="edit-form" method="dialog" class="edit-dialog-form" novalidate>
    <h2 id="edit-dialog-title" class="edit-dialog-title">Kemaskini Hutang</h2>
    <p id="edit-dialog-error" class="edit-dialog-error" hidden></p>

    <label for="edit-customer" class="edit-label">Nama pelanggan</label>
    <input id="edit-customer" type="text" class="edit-input" autocomplete="off" />

    <label for="edit-item" class="edit-label">Barang</label>
    <input id="edit-item" type="text" class="edit-input" autocomplete="off" />

    <label for="edit-amount" class="edit-label">Jumlah (RM)</label>
    <input id="edit-amount" type="number" class="edit-input" inputmode="decimal" min="0.01" step="0.01" />

    <label for="edit-due" class="edit-label">Tarikh bayar (YYYY-MM-DD)</label>
    <input id="edit-due" type="date" class="edit-input" />

    <div class="edit-dialog-actions">
      <button id="edit-dialog-batal" type="button" class="btn btn-batal">Batal</button>
      <button id="edit-dialog-simpan" type="button" class="btn btn-simpan">Simpan</button>
    </div>
  </form>
</dialog>
```

### Opening the dialog
`buildEntryCard()` wraps the `<article>` in a click handler that calls `onEditEntry(entry.id)` when the click target is NOT one of the action buttons inside. Paid entries do NOT get this listener.

### `onEditEntry(id)` flow
1. Find entry by `id` in `ledger`.
2. Pre-fill dialog fields with `entry.customer`, `entry.item`, `entry.amountRM`, `entry.dueDate`.
3. Store `editingId = id` in module scope.
4. Show dialog via `editDialog.showModal()`.

### `onConfirmEdit()` flow (Simpan button)
1. Read and trim field values.
2. Validate: customer non-empty, amountRM > 0. Show error inside dialog if invalid.
3. `pushUndo('undoLabelEdit')`.
4. `ledger = updateEntry(ledger, editingId, { customer, item, amountRM, dueDate, raw: '' })`.
5. `saveState()`, `renderAll()`, `editDialog.close()`.
6. `showFeedback(T('successEdit'), 'success')`.
7. `showUndoBar(T('undoLabelEdit'))`.

---

## `updateEntry` — new pure function in `ledger.js`

```js
/**
 * Replace mutable fields of an entry by id.
 * @param {LedgerEntry[]} ledger
 * @param {string} id
 * @param {{ customer?: string, item?: string, qty?: number|null, amountRM?: number, dueDate?: string|null, raw?: string }} fields
 * @returns {LedgerEntry[]}
 */
export function updateEntry(ledger, id, fields) {
  if (fields.amountRM !== undefined && fields.amountRM < 0) {
    throw new RangeError(`amountRM must be >= 0, got ${fields.amountRM}`);
  }
  return ledger.map(e =>
    e.id === id
      ? { ...e, ...fields, amountRM: fields.amountRM !== undefined ? round2(fields.amountRM) : e.amountRM }
      : e
  );
}
```

---

## Confirm Delete Dialog

Replaces the `window.confirm(T('confirmDelete'))` call in `onDelete()`.

### HTML element (added to `index.html`)
```html
<dialog id="delete-dialog" class="delete-dialog" aria-modal="true">
  <div class="delete-dialog-body">
    <p id="delete-dialog-msg" class="delete-dialog-msg">Padam hutang ini?</p>
    <div class="delete-dialog-actions">
      <button id="delete-dialog-batal" type="button" class="btn btn-batal">Batal</button>
      <button id="delete-dialog-confirm" type="button" class="btn btn-del-confirm">Padam</button>
    </div>
  </div>
</dialog>
```

### `onDelete(id)` refactored
Opens the in-app dialog. Confirm button calls `doDelete(id)`. Batal closes dialog.

### `doDelete(id)`
```js
function doDelete(id) {
  pushUndo('undoLabelDelete');
  ledger = deleteEntry(ledger, id);
  saveState();
  renderLedger();
  showUndoBar(T('undoLabelDelete'));
}
```

---

## Correctness Properties

The following properties are verified by the new tests in `tests/undo.test.js`:

1. **Undo add:** `pushUndo` + `addEntry` then `doUndo` → ledger length unchanged, totalOutstanding unchanged.
2. **Undo markPaid:** `pushUndo` + `markPaid` then `doUndo` → entry.paid === false.
3. **Undo applyPayment:** `pushUndo` + `applyPayment` then `doUndo` → payments length unchanged.
4. **Undo delete:** `pushUndo` + `deleteEntry` then `doUndo` → entry still exists in ledger.
5. **Undo edit:** `pushUndo` + `updateEntry` then `doUndo` → entry fields match original.
6. **History cap:** after 21 pushes, `undoHistory.length <= 20`.
7. **PBT — undo invariant:** for any sequence of n ≤ 5 add operations followed by n undos, the ledger always returns to its original state.

---

## i18n Keys to Add

| Key | ms | en |
|-----|----|----|
| `btnUndo` | `↩ Batal` | `↩ Undo` |
| `ariaUndo` | `Batal tindakan terakhir` | `Undo last action` |
| `undoLabelAdd` | `Hutang baru dicatat. Nak batal?` | `Entry added. Undo?` |
| `undoLabelPaid` | `Ditanda bayar. Nak batal?` | `Marked paid. Undo?` |
| `undoLabelPayment` | `Bayaran dicatat. Nak batal?` | `Payment recorded. Undo?` |
| `undoLabelDelete` | `Hutang dipadam. Nak batal?` | `Entry deleted. Undo?` |
| `undoLabelEdit` | `Hutang dikemaskini. Nak batal?` | `Entry updated. Undo?` |
| `toastUndoDone` | `Tindakan dibatalkan. ✓` | `Action undone. ✓` |
| `btnEdit` | `✏️ Edit` | `✏️ Edit` |
| `ariaEditEntry` | `Edit rekod hutang` | `Edit debt entry` |
| `dialogEditTitle` | `Kemaskini Hutang` | `Update Debt` |
| `dialogEditLabelCustomer` | `Nama pelanggan` | `Customer name` |
| `dialogEditLabelItem` | `Barang` | `Item` |
| `dialogEditLabelAmount` | `Jumlah (RM)` | `Amount (RM)` |
| `dialogEditLabelDue` | `Tarikh bayar (YYYY-MM-DD)` | `Due date (YYYY-MM-DD)` |
| `successEdit` | `Rekod dikemaskini.` | `Entry updated.` |
| `errEditCustomer` | `Nama pelanggan tidak boleh kosong.` | `Customer name cannot be empty.` |
| `errEditAmount` | `Jumlah mesti lebih daripada RM0.` | `Amount must be greater than RM0.` |
| `dialogDeleteTitle` | `Padam Hutang` | `Delete Entry` |
| `dialogDeleteMsg` | `Padam hutang ini? Tindakan ini boleh dibatalkan selepas.` | `Delete this entry? You can undo immediately after.` |
| `btnConfirmDelete` | `Padam` | `Delete` |
| `ariaDeleteDialog` | `Dialog pengesahan padam` | `Delete confirmation dialog` |
| `ariaConfirmDelete` | `Sahkan padam hutang` | `Confirm delete entry` |
