/**
 * @file tests/undo.test.js
 * Unit tests and property-based tests for the undo/edit feature.
 *
 * Tests cover:
 *  - updateEntry (ledger.js) — T-U01 / T-U21
 *  - Undo snapshot logic — T-U22 (undo after every action type restores previous state)
 *  - History cap — T-U23 (max 20 snapshots)
 *  - PBT — T-U24 (n adds then n undos returns to original)
 *
 * All tests run in Node via: node --test tests/undo.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import {
  createEntry,
  addEntry,
  markPaid,
  deleteEntry,
  updateEntry,
  totalOutstanding,
  applyPayment,
} from '../ledger.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let _id = 0;
/** @returns {import('../ledger.js').LedgerEntry} */
function entry(overrides = {}) {
  _id++;
  return createEntry({
    id: `undo-${_id}`,
    customer: 'Kak Ros',
    item: 'kembung',
    qty: 2,
    amountRM: 18.00,
    dueDate: null,
    raw: 'test',
    createdAt: '2026-10-30T00:00:00.000Z',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// T-U21 — updateEntry unit tests
// ---------------------------------------------------------------------------

describe('updateEntry — unit tests', () => {

  it('updates customer field', () => {
    const e = entry({ id: 'ue1' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue1', { customer: 'Encik Azman' });
    assert.equal(updated[0].customer, 'Encik Azman');
  });

  it('updates item field', () => {
    const e = entry({ id: 'ue2' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue2', { item: 'sotong' });
    assert.equal(updated[0].item, 'sotong');
  });

  it('updates amountRM and rounds to 2dp', () => {
    const e = entry({ id: 'ue3' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue3', { amountRM: 12.555 });
    assert.equal(updated[0].amountRM, 12.56);
  });

  it('updates dueDate', () => {
    const e = entry({ id: 'ue4' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue4', { dueDate: '2026-12-01' });
    assert.equal(updated[0].dueDate, '2026-12-01');
  });

  it('updates dueDate to null', () => {
    const e = entry({ id: 'ue5', dueDate: '2026-11-01' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue5', { dueDate: null });
    assert.equal(updated[0].dueDate, null);
  });

  it('does not mutate the original ledger array', () => {
    const e = entry({ id: 'ue6' });
    const ledger = [e];
    updateEntry(ledger, 'ue6', { customer: 'Pak Cik Hamid' });
    assert.equal(ledger[0].customer, 'Kak Ros');   // unchanged
  });

  it('does not mutate the original entry object', () => {
    const e = entry({ id: 'ue7' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue7', { amountRM: 50 });
    assert.equal(e.amountRM, 18.00);               // original unchanged
    assert.equal(updated[0].amountRM, 50);
  });

  it('throws RangeError on negative amountRM', () => {
    const e = entry({ id: 'ue8' });
    const ledger = [e];
    assert.throws(
      () => updateEntry(ledger, 'ue8', { amountRM: -1 }),
      /amountRM must be >= 0/
    );
  });

  it('leaves entry unchanged when id does not match', () => {
    const e = entry({ id: 'ue9' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'no-such-id', { customer: 'Someone' });
    assert.equal(updated[0].customer, 'Kak Ros');
  });

  it('preserves paid/paidAt fields when not supplied', () => {
    const e = { ...entry({ id: 'ue10' }), paid: true, paidAt: '2026-10-30T06:00:00.000Z' };
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue10', { item: 'pari' });
    assert.equal(updated[0].paid, true);
    assert.equal(updated[0].paidAt, '2026-10-30T06:00:00.000Z');
  });

  it('can update multiple fields at once', () => {
    const e = entry({ id: 'ue11' });
    const ledger = [e];
    const updated = updateEntry(ledger, 'ue11', {
      customer: 'Mak Cik Timah',
      item: 'sardin',
      amountRM: 5.00,
      dueDate: '2026-11-15',
    });
    const u = updated[0];
    assert.equal(u.customer, 'Mak Cik Timah');
    assert.equal(u.item, 'sardin');
    assert.equal(u.amountRM, 5.00);
    assert.equal(u.dueDate, '2026-11-15');
  });
});

// ---------------------------------------------------------------------------
// T-U22 — Undo snapshot tests
// Simulate the pushUndo / doUndo logic as pure functions (no DOM).
// The contract: after pushing and then popping, state equals the pre-action state.
// ---------------------------------------------------------------------------

/**
 * Minimal undo-stack helpers that mirror exactly what app.js does —
 * but as pure functions so they are testable in Node with no DOM.
 *
 * @typedef {{ ledger: import('../ledger.js').LedgerEntry[], payments: any[], phones: object }} AppState
 */

/** @param {AppState} state @param {Array} history */
function simulatePushUndo(state, history) {
  history.push({
    ledger:   state.ledger.slice(),
    payments: state.payments.slice(),
    phones:   { ...state.phones },
  });
  if (history.length > 20) history.shift();
}

/** @param {AppState} state @param {Array} history @returns {boolean} */
function simulateDoUndo(state, history) {
  const snap = history.pop();
  if (!snap) return false;
  state.ledger   = snap.ledger;
  state.payments = snap.payments;
  state.phones   = snap.phones;
  return true;
}

describe('undo snapshots — every action type restores previous state', () => {

  it('undo after addEntry returns ledger to previous state', () => {
    const e1 = entry({ id: 'snap-add-1', amountRM: 10 });
    const state = { ledger: [e1], payments: [], phones: {} };
    const history = [];

    const before = totalOutstanding(state.ledger);
    simulatePushUndo(state, history);

    // mutate
    const e2 = entry({ id: 'snap-add-2', amountRM: 25 });
    state.ledger = addEntry(state.ledger, e2);
    assert.equal(totalOutstanding(state.ledger), 35);

    // undo
    simulateDoUndo(state, history);
    assert.equal(totalOutstanding(state.ledger), before);
    assert.equal(state.ledger.length, 1);
  });

  it('undo after markPaid restores entry to unpaid', () => {
    const e = entry({ id: 'snap-paid-1', amountRM: 18 });
    const state = { ledger: [e], payments: [], phones: {} };
    const history = [];

    simulatePushUndo(state, history);
    state.ledger = markPaid(state.ledger, 'snap-paid-1');
    assert.equal(state.ledger[0].paid, true);

    simulateDoUndo(state, history);
    assert.equal(state.ledger[0].paid, false);
  });

  it('undo after applyPayment restores payments array', () => {
    const e = entry({ id: 'snap-pay-1', customer: 'Ali', amountRM: 30 });
    const state = { ledger: [e], payments: [], phones: {} };
    const history = [];

    simulatePushUndo(state, history);
    const result = applyPayment(state.ledger, state.payments, 'Ali', 30, 'Ali bayar RM30');
    assert.equal(result.warning, null);
    state.ledger   = result.ledger;
    state.payments = result.payments;
    assert.equal(state.payments.length, 1);

    simulateDoUndo(state, history);
    assert.equal(state.payments.length, 0);
    assert.equal(state.ledger[0].paid, false);
  });

  it('undo after deleteEntry restores the entry', () => {
    const e = entry({ id: 'snap-del-1', amountRM: 12 });
    const state = { ledger: [e], payments: [], phones: {} };
    const history = [];

    simulatePushUndo(state, history);
    state.ledger = deleteEntry(state.ledger, 'snap-del-1');
    assert.equal(state.ledger.length, 0);

    simulateDoUndo(state, history);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.ledger[0].id, 'snap-del-1');
  });

  it('undo after updateEntry restores original field values', () => {
    const e = entry({ id: 'snap-edit-1', customer: 'Kak Ros', amountRM: 18 });
    const state = { ledger: [e], payments: [], phones: {} };
    const history = [];

    simulatePushUndo(state, history);
    state.ledger = updateEntry(state.ledger, 'snap-edit-1', { customer: 'Encik Azman', amountRM: 99 });
    assert.equal(state.ledger[0].customer, 'Encik Azman');

    simulateDoUndo(state, history);
    assert.equal(state.ledger[0].customer, 'Kak Ros');
    assert.equal(state.ledger[0].amountRM, 18);
  });

  it('undo restores phones map', () => {
    const e = entry({ id: 'snap-phones-1' });
    const state = { ledger: [e], payments: [], phones: { 'Kak Ros': '60123456789' } };
    const history = [];

    simulatePushUndo(state, history);
    state.phones['Kak Ros'] = '60199999999';   // pretend user changed number

    simulateDoUndo(state, history);
    assert.equal(state.phones['Kak Ros'], '60123456789');
  });

  it('multiple undos restore each prior state in sequence', () => {
    const e1 = entry({ id: 'seq-1', amountRM: 5 });
    const state = { ledger: [e1], payments: [], phones: {} };
    const history = [];

    // Action 1: add e2
    simulatePushUndo(state, history);
    const e2 = entry({ id: 'seq-2', amountRM: 10 });
    state.ledger = addEntry(state.ledger, e2);

    // Action 2: add e3
    simulatePushUndo(state, history);
    const e3 = entry({ id: 'seq-3', amountRM: 20 });
    state.ledger = addEntry(state.ledger, e3);

    assert.equal(state.ledger.length, 3);

    // Undo action 2 → back to 2 entries
    simulateDoUndo(state, history);
    assert.equal(state.ledger.length, 2);

    // Undo action 1 → back to 1 entry
    simulateDoUndo(state, history);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.ledger[0].id, 'seq-1');
  });
});

// ---------------------------------------------------------------------------
// T-U23 — History cap: after 21 pushes, length ≤ 20
// ---------------------------------------------------------------------------

describe('undo history cap', () => {

  it('history length never exceeds 20 after 21 pushes', () => {
    const state = { ledger: [], payments: [], phones: {} };
    const history = [];

    for (let i = 0; i < 21; i++) {
      state.ledger = addEntry(state.ledger, entry({ id: `cap-${i}`, amountRM: 1 }));
      simulatePushUndo(state, history);
      if (history.length > 20) history.shift();
    }

    assert.ok(history.length <= 20, `history.length was ${history.length}`);
  });

  it('oldest snapshot is evicted on 21st push', () => {
    const state = { ledger: [], payments: [], phones: {} };
    const history = [];

    // Push 21 times with a distinguishable amountRM in each snapshot
    for (let i = 1; i <= 21; i++) {
      // Capture current state
      history.push({
        ledger:   state.ledger.slice(),
        payments: state.payments.slice(),
        phones:   { ...state.phones },
        _marker: i,
      });
      if (history.length > 20) history.shift();

      // Mutate
      state.ledger = addEntry(state.ledger, entry({ id: `evict-${i}`, amountRM: i }));
    }

    // After 21 pushes, the oldest remaining snapshot should be marker=2, not marker=1
    assert.equal(history[0]._marker, 2);
    assert.equal(history.length, 20);
  });
});

// ---------------------------------------------------------------------------
// T-U24 — PBT: n adds followed by n undos returns ledger to original state
// ---------------------------------------------------------------------------

describe('undo PBT — n adds then n undos → original state', () => {

  it('PBT: adding and fully undoing any sequence of up to 5 entries leaves ledger unchanged', () => {
    const arbAmount = fc.integer({ min: 1, max: 10000 }).map(n => n / 100);
    const arbCustomer = fc.constantFrom('Ali', 'Kak Ros', 'Mak Cik Timah', 'Encik Ahmad', 'Puan Siti');
    const arbItem = fc.constantFrom('ayam', 'kembung', 'sardin', 'sayur', 'udang');

    const arbEntryFields = fc.record({
      customer: arbCustomer,
      item:     arbItem,
      amountRM: arbAmount,
    });

    fc.assert(
      fc.property(
        fc.array(arbEntryFields, { minLength: 1, maxLength: 5 }),
        (fields) => {
          // Start from empty ledger
          let counter = 0;
          const state = { ledger: [], payments: [], phones: {} };
          const history = [];

          const originalLedger = state.ledger.slice();

          // Perform n adds, pushing undo before each
          for (const f of fields) {
            simulatePushUndo(state, history);
            const e = createEntry({
              id: `pbt-${++counter}`,
              customer: f.customer,
              item: f.item,
              qty: null,
              amountRM: f.amountRM,
              dueDate: null,
              raw: '',
              createdAt: '2026-10-30T00:00:00.000Z',
            });
            state.ledger = addEntry(state.ledger, e);
          }

          // Now undo all n adds
          for (let i = 0; i < fields.length; i++) {
            simulateDoUndo(state, history);
          }

          // Ledger should be identical to originalLedger
          assert.deepEqual(state.ledger, originalLedger);
          return true;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('PBT: undo after updateEntry always restores the exact pre-edit field values', () => {
    const arbCustomer = fc.constantFrom('Ali', 'Kak Ros', 'Mak Cik Timah');
    const arbAmount = fc.integer({ min: 1, max: 50000 }).map(n => n / 100);

    fc.assert(
      fc.property(
        arbCustomer,
        arbAmount,
        arbCustomer,
        arbAmount,
        (origCustomer, origAmount, newCustomer, newAmount) => {
          let counter = 0;
          const e = createEntry({
            id: `pbt-edit-${++counter}`,
            customer: origCustomer,
            item: 'ayam',
            qty: null,
            amountRM: origAmount,
            dueDate: null,
            raw: '',
            createdAt: '2026-10-30T00:00:00.000Z',
          });
          const state = { ledger: [e], payments: [], phones: {} };
          const history = [];

          simulatePushUndo(state, history);
          state.ledger = updateEntry(state.ledger, e.id, { customer: newCustomer, amountRM: newAmount });

          simulateDoUndo(state, history);

          return (
            state.ledger[0].customer === origCustomer &&
            state.ledger[0].amountRM === e.amountRM   // round2 applied at creation
          );
        }
      ),
      { numRuns: 300 }
    );
  });

  it('PBT: totalOutstanding after n deletes then n undos equals original', () => {
    const arbEntryList = fc.array(
      fc.record({
        amountRM: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
      }),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(arbEntryList, (fieldsList) => {
        let counter = 0;
        const entries = fieldsList.map(f => createEntry({
          id: `pbt-del-${++counter}`,
          customer: 'Ali',
          item: 'ayam',
          qty: null,
          amountRM: f.amountRM,
          dueDate: null,
          raw: '',
          createdAt: '2026-10-30T00:00:00.000Z',
        }));

        const state = { ledger: entries, payments: [], phones: {} };
        const history = [];
        const originalTotal = totalOutstanding(state.ledger);

        // Delete all entries, recording undo before each
        const ids = entries.map(e => e.id);
        for (const id of ids) {
          simulatePushUndo(state, history);
          state.ledger = deleteEntry(state.ledger, id);
        }
        assert.equal(state.ledger.length, 0);

        // Undo all deletes
        for (let i = 0; i < ids.length; i++) {
          simulateDoUndo(state, history);
        }

        return totalOutstanding(state.ledger) === originalTotal;
      }),
      { numRuns: 250 }
    );
  });
});
