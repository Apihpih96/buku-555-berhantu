/**
 * @file tests/ledger.test.js
 * Unit tests and property-based tests for ledger.js.
 * Run with: node --test tests/ledger.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  createEntry,
  addEntry,
  markPaid,
  deleteEntry,
  totalOutstanding,
  overdueEntries,
  entriesByCustomer,
  exportJSON,
  importJSON,
  normaliseMsisdn,
  buildWhatsAppLink,
  customerTotal,
} from '../ledger.js';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

let _id = 0;
/** @returns {import('../ledger.js').LedgerEntry} */
function entry(overrides = {}) {
  _id++;
  return createEntry({
    id: `test-${_id}`,
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
// Unit tests — createEntry
// ---------------------------------------------------------------------------

describe('createEntry', () => {
  it('creates entry with correct fields', () => {
    const e = entry();
    assert.equal(e.customer, 'Kak Ros');
    assert.equal(e.item, 'kembung');
    assert.equal(e.amountRM, 18.00);
    assert.equal(e.paid, false);
    assert.equal(e.paidAt, null);
  });

  it('throws on negative amountRM', () => {
    assert.throws(() => entry({ amountRM: -1 }), /amountRM must be >= 0/);
  });

  it('rounds amountRM to 2dp', () => {
    const e = entry({ amountRM: 5.555 });
    assert.equal(e.amountRM, 5.56);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — addEntry / markPaid / deleteEntry
// ---------------------------------------------------------------------------

describe('addEntry', () => {
  it('returns a new array with the entry appended', () => {
    const e = entry();
    const ledger = addEntry([], e);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].id, e.id);
  });

  it('does not mutate original array', () => {
    const original = [];
    const e = entry();
    addEntry(original, e);
    assert.equal(original.length, 0);
  });

  it('rejects negative amount', () => {
    const bad = { ...entry(), amountRM: -5 };
    assert.throws(() => addEntry([], bad), /amountRM must be >= 0/);
  });
});

describe('markPaid', () => {
  it('marks the correct entry as paid', () => {
    const e1 = entry({ id: 'a' });
    const e2 = entry({ id: 'b' });
    const ledger = [e1, e2];
    const updated = markPaid(ledger, 'a');
    assert.equal(updated.find(e => e.id === 'a').paid, true);
    assert.equal(updated.find(e => e.id === 'b').paid, false);
  });

  it('does not mutate original', () => {
    const e = entry({ id: 'x' });
    const ledger = [e];
    markPaid(ledger, 'x');
    assert.equal(ledger[0].paid, false);
  });

  it('sets paidAt to a non-null string', () => {
    const e = entry({ id: 'y' });
    const updated = markPaid([e], 'y');
    assert.ok(typeof updated[0].paidAt === 'string');
  });
});

describe('deleteEntry', () => {
  it('removes the entry', () => {
    const e = entry({ id: 'del' });
    const ledger = addEntry([], e);
    const after = deleteEntry(ledger, 'del');
    assert.equal(after.length, 0);
  });

  it('returns same ledger if id not found', () => {
    const e = entry({ id: 'keep' });
    const ledger = [e];
    const after = deleteEntry(ledger, 'nope');
    assert.equal(after.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — totalOutstanding
// ---------------------------------------------------------------------------

describe('totalOutstanding', () => {
  it('empty ledger = 0', () => {
    assert.equal(totalOutstanding([]), 0);
  });

  it('sums only unpaid', () => {
    const e1 = entry({ id: '1', amountRM: 10 });
    const e2 = entry({ id: '2', amountRM: 20 });
    const paidE = { ...entry({ id: '3', amountRM: 5 }), paid: true };
    assert.equal(totalOutstanding([e1, e2, paidE]), 30);
  });

  it('all paid = 0', () => {
    const e = { ...entry(), paid: true };
    assert.equal(totalOutstanding([e]), 0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — overdueEntries
// ---------------------------------------------------------------------------

describe('overdueEntries', () => {
  it('returns entries with dueDate < today and unpaid', () => {
    const overdue = entry({ id: 'o', dueDate: '2026-10-01', amountRM: 10 });
    const future  = entry({ id: 'f', dueDate: '2026-12-01', amountRM: 5 });
    const noDue   = entry({ id: 'n', dueDate: null,         amountRM: 3 });
    const ledger  = [overdue, future, noDue];
    const result  = overdueEntries(ledger, '2026-10-30');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'o');
  });

  it('paid overdue entries are excluded', () => {
    const e = { ...entry({ dueDate: '2020-01-01' }), paid: true };
    assert.equal(overdueEntries([e], '2026-10-30').length, 0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — entriesByCustomer
// ---------------------------------------------------------------------------

describe('entriesByCustomer', () => {
  it('groups correctly', () => {
    const e1 = entry({ id: '1', customer: 'Ali',   amountRM: 10 });
    const e2 = entry({ id: '2', customer: 'Ali',   amountRM: 5  });
    const e3 = entry({ id: '3', customer: 'Siti',  amountRM: 8  });
    const map = entriesByCustomer([e1, e2, e3]);
    assert.equal(map.get('Ali').length, 2);
    assert.equal(map.get('Siti').length, 1);
  });

  it('excludes paid entries', () => {
    const paid = { ...entry({ id: '4', customer: 'Paid' }), paid: true };
    const map  = entriesByCustomer([paid]);
    assert.equal(map.has('Paid'), false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — customerTotal
// ---------------------------------------------------------------------------

describe('customerTotal', () => {
  it('sums unpaid for one customer', () => {
    const e1 = entry({ id: 'c1', customer: 'Ali', amountRM: 15 });
    const e2 = entry({ id: 'c2', customer: 'Ali', amountRM: 10 });
    assert.equal(customerTotal([e1, e2], 'Ali'), 25);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — exportJSON / importJSON
// ---------------------------------------------------------------------------

describe('exportJSON / importJSON', () => {
  it('export produces parseable JSON', () => {
    const e = entry();
    const json = exportJSON([e]);
    const obj = JSON.parse(json);
    assert.equal(obj.version, 1);
    assert.equal(obj.entries.length, 1);
  });

  it('import merges new entries, deduplicates existing', () => {
    const existing = [entry({ id: 'existing' })];
    const incoming = [
      existing[0],                    // duplicate — should be skipped
      entry({ id: 'new' }),           // new — should be added
    ];
    const json = JSON.stringify({ version: 1, entries: incoming });
    const merged = importJSON(json, existing);
    assert.equal(merged.length, 2);
    assert.ok(merged.some(e => e.id === 'new'));
  });

  it('import throws on bad JSON', () => {
    assert.throws(() => importJSON('not-json', []), SyntaxError);
  });

  it('round-trip: export then import produces same entries', () => {
    const ledger = [entry({ id: 'rt1' }), entry({ id: 'rt2' })];
    const json = exportJSON(ledger);
    const restored = importJSON(json, []);
    assert.equal(restored.length, 2);
    assert.equal(restored[0].id, 'rt1');
    assert.equal(restored[1].id, 'rt2');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — normaliseMsisdn
// ---------------------------------------------------------------------------

describe('normaliseMsisdn', () => {
  it('strips leading 0 and prepends 60', () => {
    assert.equal(normaliseMsisdn('0123456789'), '60123456789');
  });
  it('leaves 60-prefixed unchanged', () => {
    assert.equal(normaliseMsisdn('60123456789'), '60123456789');
  });
  it('strips + prefix', () => {
    assert.equal(normaliseMsisdn('+60123456789'), '60123456789');
  });
  it('strips dashes', () => {
    assert.equal(normaliseMsisdn('012-345-6789'), '60123456789');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — buildWhatsAppLink
// ---------------------------------------------------------------------------

describe('buildWhatsAppLink', () => {
  it('builds correct wa.me URL', () => {
    const url = buildWhatsAppLink('0123456789', 'Kak Ros', 'kembung', 18, '2026-11-01');
    assert.ok(url.startsWith('https://wa.me/60123456789?text='));
    assert.ok(url.includes('Kak+Ros') || url.includes('Kak%20Ros'));
  });

  it('encodes message', () => {
    const url = buildWhatsAppLink('0123456789', 'Ali', 'ayam', 25.5, null);
    assert.ok(url.includes('wa.me'));
    // Should be URI-encoded (spaces become %20 or +)
    assert.ok(!url.includes(' '));
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('ledger — PBT: total = sum of unpaid', () => {
  it('PBT: totalOutstanding === sum of unpaid amountRM', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constantFrom('Ali', 'Siti', 'Ros'),
      item:      fc.constantFrom('ayam', 'kembung', 'sayur'),
      qty:       fc.option(fc.integer({ min: 1, max: 20 })),
      amountRM:  fc.float({ min: 0, max: 500, noNaN: true }).map(n => Math.round(n * 100) / 100),
      dueDate:   fc.constant(null),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant('test'),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 0, maxLength: 20 }),
        (ledger) => {
          const expected = ledger
            .filter(e => !e.paid)
            .reduce((s, e) => s + e.amountRM, 0);
          const actual = totalOutstanding(ledger);
          // Allow tiny float rounding (compare within epsilon)
          return Math.abs(actual - Math.round(expected * 100) / 100) < 0.001;
        }
      ),
      { numRuns: 300 }
    );
  });
});

describe('ledger — PBT: mark paid reduces total', () => {
  it('PBT: markPaid(ledger, id) reduces totalOutstanding by entry.amountRM', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Test'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 0, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 15 }),
        (entries) => {
          const ledger = entries;
          const unpaid = ledger.filter(e => !e.paid);
          if (unpaid.length === 0) return true;
          const target = unpaid[0];
          const before = totalOutstanding(ledger);
          const after  = totalOutstanding(markPaid(ledger, target.id));
          const diff   = Math.round((before - after) * 100) / 100;
          return Math.abs(diff - target.amountRM) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('ledger — PBT: addEntry increases total', () => {
  it('PBT: totalOutstanding(addEntry(l, e)) === totalOutstanding(l) + e.amountRM', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Test'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 0, maxLength: 10 }),
        arbEntry,
        (ledger, newEntry) => {
          const before = totalOutstanding(ledger);
          const after  = totalOutstanding(addEntry(ledger, newEntry));
          const expected = Math.round((before + newEntry.amountRM) * 100) / 100;
          return Math.abs(after - expected) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('ledger — PBT: amounts never negative', () => {
  it('PBT: every entry in a valid ledger has amountRM >= 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100000, noNaN: true }),
        (amount) => {
          const e = createEntry({
            customer: 'Ali',
            item: 'item',
            qty: null,
            amountRM: Math.round(amount * 100) / 100,
            dueDate: null,
            raw: '',
          });
          return e.amountRM >= 0;
        }
      ),
      { numRuns: 500 }
    );
  });
});

describe('ledger — PBT: export/import round-trip', () => {
  it('PBT: importJSON(exportJSON(ledger), []) === original entries', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constantFrom('Ali', 'Siti'),
      item:      fc.constantFrom('ayam', 'ikan'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 0, maxLength: 10 }),
        (ledger) => {
          const json     = exportJSON(ledger);
          const restored = importJSON(json, []);
          if (restored.length !== ledger.length) return false;
          return ledger.every((e, i) => e.id === restored[i].id);
        }
      ),
      { numRuns: 200 }
    );
  });
});
