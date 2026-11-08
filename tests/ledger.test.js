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
  buildReminder,
  formatLocalDate,
  customerTotal,
  topDebtors,
  applyPayment,
  migrateStorage,
  customerPayments,
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

  it('export includes phones map', () => {
    const e = entry();
    const json = exportJSON([e], { 'Kak Ros': '60123456789' });
    const obj = JSON.parse(json);
    assert.equal(obj.phones['Kak Ros'], '60123456789');
  });

  it('import merges new entries, deduplicates existing', () => {
    const existing = [entry({ id: 'existing' })];
    const incoming = [
      existing[0],                    // duplicate — should be skipped
      entry({ id: 'new' }),           // new — should be added
    ];
    const json = JSON.stringify({ version: 1, entries: incoming });
    const { ledger: merged } = importJSON(json, existing);
    assert.equal(merged.length, 2);
    assert.ok(merged.some(e => e.id === 'new'));
  });

  it('import merges phones map (existing takes precedence)', () => {
    const json = JSON.stringify({
      version: 1,
      entries: [],
      phones: { 'Ali': '60111111111', 'Siti': '60222222222' },
    });
    const { phones: merged } = importJSON(json, [], { 'Ali': '60999999999' });
    // Existing Ali takes precedence
    assert.equal(merged['Ali'], '60999999999');
    // Backup Siti is merged in
    assert.equal(merged['Siti'], '60222222222');
  });

  it('import throws on bad JSON', () => {
    assert.throws(() => importJSON('not-json', []), SyntaxError);
  });

  it('round-trip: export then import preserves entries and phones', () => {
    const ledger = [entry({ id: 'rt1' }), entry({ id: 'rt2' })];
    const phonesMap = { 'Kak Ros': '60123456789' };
    const json = exportJSON(ledger, phonesMap);
    const { ledger: restored, phones: restoredPhones } = importJSON(json, []);
    assert.equal(restored.length, 2);
    assert.equal(restored[0].id, 'rt1');
    assert.equal(restored[1].id, 'rt2');
    assert.equal(restoredPhones['Kak Ros'], '60123456789');
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
  it('builds correct WhatsApp URL', () => {
    const url = buildWhatsAppLink('0123456789', 'Kak Ros', 'kembung', 18, '2026-11-01');
    assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=60123456789&text='));
    assert.ok(url.includes('Kak+Ros') || url.includes('Kak%20Ros'));
  });

  it('encodes message', () => {
    const url = buildWhatsAppLink('0123456789', 'Ali', 'ayam', 25.5, null);
    assert.ok(url.includes('api.whatsapp.com/send'));
    // Should be URI-encoded (spaces become %20 or +)
    assert.ok(!url.includes(' '));
  });
});

// ---------------------------------------------------------------------------
// Unit tests — formatLocalDate
// ---------------------------------------------------------------------------

describe('formatLocalDate', () => {
  it('formats a known Friday in ms', () => {
    // 2026-11-06 is a Friday
    const result = formatLocalDate('2026-11-06', 'ms');
    assert.ok(result.includes('Jumaat'), `expected Jumaat in "${result}"`);
    assert.ok(result.includes('6'), `expected day 6 in "${result}"`);
    assert.ok(result.includes('Nov'), `expected Nov in "${result}"`);
  });

  it('formats a known Friday in en', () => {
    const result = formatLocalDate('2026-11-06', 'en');
    assert.ok(result.includes('Friday'), `expected Friday in "${result}"`);
    assert.ok(result.includes('Nov'), `expected Nov in "${result}"`);
  });

  it('returns empty string for falsy input', () => {
    assert.equal(formatLocalDate('', 'ms'), '');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — buildReminder
// ---------------------------------------------------------------------------

describe('buildReminder', () => {
  // Helper: today fixed to 2026-10-30 for deterministic tests
  const TODAY = new Date(2026, 9, 30); // October 30 local

  it('returns empty string when customer has no unpaid entries', () => {
    const paid = { ...entry({ id: 'p1', customer: 'Ali', amountRM: 10 }), paid: true };
    const url = buildReminder([paid], 'Ali', '0123456789', TODAY, 'ms');
    assert.equal(url, '');
  });

  it('URL starts with https://api.whatsapp.com/send?phone=60', () => {
    const e = entry({ id: 'r1', customer: 'Ali', amountRM: 20, dueDate: null });
    const url = buildReminder([e], 'Ali', '0123456789', TODAY, 'ms');
    assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=60'), `got: ${url.slice(0, 40)}`);
  });

  it('normalises phone number in URL', () => {
    const e = entry({ id: 'r2', customer: 'Ali', amountRM: 20, dueDate: null });
    const url = buildReminder([e], 'Ali', '012-345-6789', TODAY, 'ms');
    assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=60123456789'), `got: ${url.slice(0, 50)}`);
  });

  it('does not include paid entries in message', () => {
    const unpaid = entry({ id: 'u1', customer: 'Siti', item: 'ayam', amountRM: 15, dueDate: null });
    const paid   = { ...entry({ id: 'p2', customer: 'Siti', item: 'sayur', amountRM: 5, dueDate: null }), paid: true };
    const url = buildReminder([unpaid, paid], 'Siti', '0123456789', TODAY, 'ms');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(decoded.includes('ayam'), 'should include unpaid item');
    assert.ok(!decoded.includes('sayur'), 'should NOT include paid item');
  });

  it('filters to the correct customer', () => {
    const ali  = entry({ id: 'a1', customer: 'Ali',  item: 'ayam',   amountRM: 15, dueDate: null });
    const siti = entry({ id: 's1', customer: 'Siti', item: 'kembung', amountRM: 20, dueDate: null });
    const url = buildReminder([ali, siti], 'Ali', '0123456789', TODAY, 'ms');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(decoded.includes('ayam'), 'should include Ali item');
    assert.ok(!decoded.includes('kembung'), 'should NOT include Siti item');
  });

  it('includes Malay ghost line when any entry is overdue', () => {
    const overdue = entry({ id: 'o1', customer: 'Ros', item: 'ikan', amountRM: 10, dueDate: '2026-10-01' });
    const url = buildReminder([overdue], 'Ros', '0123456789', TODAY, 'ms');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(decoded.includes('Hantu Buku 555'), `expected ghost line, got: ${decoded.slice(0, 80)}`);
    assert.ok(decoded.includes('abaikan'), 'expected abaikan sign-off');
  });

  it('does NOT include ghost line when all entries are not overdue', () => {
    const future = entry({ id: 'f1', customer: 'Ros', item: 'ikan', amountRM: 10, dueDate: '2026-12-01' });
    const url = buildReminder([future], 'Ros', '0123456789', TODAY, 'ms');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(!decoded.includes('Hantu Buku 555'), 'should NOT have ghost for future entry');
    assert.ok(decoded.includes('Harap'), 'expected gentle sign-off');
  });

  it('mentions hari ini for entry due today', () => {
    const todayISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth()+1).padStart(2,'0')}-${String(TODAY.getDate()).padStart(2,'0')}`;
    const todayEntry = entry({ id: 't1', customer: 'Ros', item: 'ikan', amountRM: 10, dueDate: todayISO });
    const url = buildReminder([todayEntry], 'Ros', '0123456789', TODAY, 'ms');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(decoded.includes('hari ini'), `expected hari ini, got: ${decoded}`);
  });

  it('builds correct English message', () => {
    const e = entry({ id: 'en1', customer: 'Ali', item: 'chicken', amountRM: 25, dueDate: null });
    const url = buildReminder([e], 'Ali', '0123456789', TODAY, 'en');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(decoded.includes('Hello'), 'expected English greeting');
    assert.ok(decoded.includes('Thank you'), 'expected English sign-off');
    assert.ok(decoded.includes('Outstanding'), 'expected English heading');
  });

  it('English ghost line when overdue', () => {
    const overdue = entry({ id: 'eo1', customer: 'Ali', item: 'chicken', amountRM: 25, dueDate: '2026-09-01' });
    const url = buildReminder([overdue], 'Ali', '0123456789', TODAY, 'en');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    assert.ok(decoded.includes('Ghost'), 'expected English ghost line');
    assert.ok(decoded.includes('ignore'), 'expected English ignore sign-off');
  });

  it('message contains RM total for multi-entry customer', () => {
    const e1 = entry({ id: 'm1', customer: 'Ali', item: 'ayam',  amountRM: 15, dueDate: null });
    const e2 = entry({ id: 'm2', customer: 'Ali', item: 'ikan',  amountRM: 10, dueDate: null });
    const url = buildReminder([e1, e2], 'Ali', '0123456789', TODAY, 'ms');
    const decoded = decodeURIComponent(url.split('&text=')[1]);
    // Total is 25.00
    assert.ok(decoded.includes('25.00'), `expected total 25.00 in message: ${decoded}`);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests — buildReminder
// ---------------------------------------------------------------------------

describe('buildReminder — PBT: message total = sum of unpaid', () => {
  it('PBT: total in message equals customerTotal for unpaid entries', () => {
    const arbEntry = (customer) => fc.record({
      id:        fc.uuid(),
      customer:  fc.constant(customer),
      item:      fc.constantFrom('ayam', 'kembung', 'sayur'),
      qty:       fc.option(fc.integer({ min: 1, max: 5 })),
      amountRM:  fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry('Ali'), { minLength: 1, maxLength: 10 }),
        (entries) => {
          const unpaid = entries.filter(e => !e.paid);
          if (unpaid.length === 0) {
            // buildReminder returns '' for no unpaid — that's valid
            const url = buildReminder(entries, 'Ali', '0123456789', new Date(2026, 9, 30), 'ms');
            return url === '';
          }
          const url = buildReminder(entries, 'Ali', '0123456789', new Date(2026, 9, 30), 'ms');
          const decoded = decodeURIComponent(url.split('&text=')[1] ?? '');
          const expectedTotal = Math.round(unpaid.reduce((s, e) => s + e.amountRM, 0) * 100) / 100;
          return decoded.includes(expectedTotal.toFixed(2));
        }
      ),
      { numRuns: 150 }
    );
  });
});

describe('buildReminder — PBT: paid entries never appear', () => {
  it('PBT: no paid entry item appears in reminder message', () => {
    const ITEMS = ['ayam', 'kembung', 'sayur', 'sardin', 'udang'];
    const arbEntry = (customer, item) => fc.record({
      id:        fc.uuid(),
      customer:  fc.constant(customer),
      item:      fc.constant(item),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 100, max: 5000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(...ITEMS).chain(item => arbEntry('Ali', item)),
          { minLength: 1, maxLength: 8 }
        ),
        (entries) => {
          const unpaid = entries.filter(e => !e.paid);
          if (unpaid.length === 0) return true;

          const url = buildReminder(entries, 'Ali', '0123456789', new Date(2026, 9, 30), 'ms');
          const decoded = decodeURIComponent(url.split('&text=')[1] ?? '');

          // No paid-only item should appear unless it's also in an unpaid entry
          const unpaidItems = new Set(unpaid.map(e => e.item));
          const paidOnlyItems = entries
            .filter(e => e.paid)
            .map(e => e.item)
            .filter(item => !unpaidItems.has(item));

          return paidOnlyItems.every(item => !decoded.includes(item));
        }
      ),
      { numRuns: 150 }
    );
  });
});

describe('buildReminder — PBT: URL always starts https://api.whatsapp.com/send?phone=60', () => {
  it('PBT: URL prefix is correct for any non-empty unpaid ledger', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('ayam'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 5000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    const arbPhone = fc.constantFrom(
      '0123456789', '60123456789', '+60123456789', '011-1234567', '0197654321'
    );

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 5 }),
        arbPhone,
        (entries, phone) => {
          const url = buildReminder(entries, 'Ali', phone, new Date(2026, 9, 30), 'ms');
          return url.startsWith('https://api.whatsapp.com/send?phone=60');
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — buildWhatsAppLink
// ---------------------------------------------------------------------------

describe('buildWhatsAppLink', () => {
  it('builds correct WhatsApp URL', () => {
    const url = buildWhatsAppLink('0123456789', 'Kak Ros', 'kembung', 18, '2026-11-01');
    assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=60123456789&text='));
    assert.ok(url.includes('Kak+Ros') || url.includes('Kak%20Ros'));
  });

  it('encodes message', () => {
    const url = buildWhatsAppLink('0123456789', 'Ali', 'ayam', 25.5, null);
    assert.ok(url.includes('api.whatsapp.com/send'));
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
          const json = exportJSON(ledger);
          const { ledger: restored } = importJSON(json, []);
          if (restored.length !== ledger.length) return false;
          return ledger.every((e, i) => e.id === restored[i].id);
        }
      ),
      { numRuns: 200 }
    );
  });
});

it('demoEntries: always has overdue, due-today, upcoming and paid entries', async () => {
  const { demoEntries, overdueEntries } = await import('../ledger.js');
  const today = new Date(2026, 9, 31);
  const { entries: d } = demoEntries(today);
  assert.ok(d.some(e => e.paid));
  assert.ok(d.some(e => !e.paid && e.dueDate === '2026-10-31'));
  assert.ok(d.some(e => !e.paid && e.dueDate > '2026-10-31'));
  assert.ok(overdueEntries(d, today).length >= 2);
});

// ---------------------------------------------------------------------------
// Unit tests — topDebtors
// ---------------------------------------------------------------------------

describe('topDebtors', () => {
  const TODAY = '2026-10-30'; // fixed reference date

  it('returns empty array when ledger is empty', () => {
    assert.deepEqual(topDebtors([], TODAY), []);
  });

  it('returns empty array when all entries are paid', () => {
    const paid = { ...entry({ id: 'p', customer: 'Ali', amountRM: 20, dueDate: '2026-10-01' }), paid: true };
    assert.deepEqual(topDebtors([paid], TODAY), []);
  });

  it('returns at most n=3 by default', () => {
    const e = (id, cust, due) => entry({ id, customer: cust, amountRM: 10, dueDate: due });
    const ledger = [
      e('1', 'A', '2026-10-01'),
      e('2', 'B', '2026-10-02'),
      e('3', 'C', '2026-10-03'),
      e('4', 'D', '2026-10-04'),
    ];
    const result = topDebtors(ledger, TODAY);
    assert.equal(result.length, 3);
  });

  it('respects custom n', () => {
    const e = (id, cust) => entry({ id, customer: cust, amountRM: 10, dueDate: '2026-10-01' });
    const ledger = [e('1','A'), e('2','B'), e('3','C'), e('4','D'), e('5','E')];
    assert.equal(topDebtors(ledger, TODAY, 2).length, 2);
    assert.equal(topDebtors(ledger, TODAY, 5).length, 5);
  });

  it('sorts by daysOverdue descending', () => {
    // A: overdue 29 days (Oct 1), B: overdue 15 days (Oct 15), C: overdue 5 days (Oct 25)
    const a = entry({ id: 'a', customer: 'A', amountRM: 10, dueDate: '2026-10-01' });
    const b = entry({ id: 'b', customer: 'B', amountRM: 10, dueDate: '2026-10-15' });
    const c = entry({ id: 'c', customer: 'C', amountRM: 10, dueDate: '2026-10-25' });
    const result = topDebtors([c, a, b], TODAY);
    assert.equal(result[0].customer, 'A');
    assert.equal(result[1].customer, 'B');
    assert.equal(result[2].customer, 'C');
  });

  it('breaks ties by totalOwed descending', () => {
    // Both overdue same number of days, A owes more
    const a = entry({ id: 'a', customer: 'A', amountRM: 50, dueDate: '2026-10-20' });
    const b = entry({ id: 'b', customer: 'B', amountRM: 20, dueDate: '2026-10-20' });
    const result = topDebtors([b, a], TODAY);
    assert.equal(result[0].customer, 'A');
    assert.equal(result[1].customer, 'B');
  });

  it('aggregates multiple unpaid entries for same customer', () => {
    const e1 = entry({ id: 'e1', customer: 'Ali', amountRM: 15, dueDate: '2026-10-01' });
    const e2 = entry({ id: 'e2', customer: 'Ali', amountRM: 10, dueDate: '2026-10-10' });
    const result = topDebtors([e1, e2], TODAY, 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].customer, 'Ali');
    assert.equal(result[0].totalOwed, 25);
    // oldestDue is Oct 1 → 29 days overdue
    assert.equal(result[0].daysOverdue, 29);
  });

  it('computes daysOverdue = 0 for future due dates', () => {
    const e = entry({ id: 'f', customer: 'Siti', amountRM: 10, dueDate: '2026-12-01' });
    const result = topDebtors([e], TODAY, 1);
    assert.equal(result[0].daysOverdue, 0);
  });

  it('computes daysOverdue = 0 for entries with no due date', () => {
    const e = entry({ id: 'n', customer: 'Siti', amountRM: 10, dueDate: null });
    const result = topDebtors([e], TODAY, 1);
    assert.equal(result[0].daysOverdue, 0);
  });

  it('does not include paid-only customers', () => {
    const paid = { ...entry({ id: 'p', customer: 'Paid', amountRM: 100, dueDate: '2026-10-01' }), paid: true };
    const unpaid = entry({ id: 'u', customer: 'Unpaid', amountRM: 5, dueDate: '2026-10-28' });
    const result = topDebtors([paid, unpaid], TODAY);
    assert.ok(result.every(d => d.customer !== 'Paid'), 'Paid customer should not appear');
    assert.equal(result.length, 1);
    assert.equal(result[0].customer, 'Unpaid');
  });

  it('accepts Date object as today', () => {
    const e = entry({ id: 'd', customer: 'Ali', amountRM: 10, dueDate: '2026-10-01' });
    const result = topDebtors([e], new Date(2026, 9, 30), 1);
    assert.equal(result[0].daysOverdue, 29);
  });

  it('correct daysOverdue calculation: 29 days from Oct 1 to Oct 30', () => {
    const e = entry({ id: 'calc', customer: 'Ali', amountRM: 10, dueDate: '2026-10-01' });
    const result = topDebtors([e], TODAY, 1);
    assert.equal(result[0].daysOverdue, 29);
  });

  it('totalOwed is non-negative', () => {
    const e = entry({ id: 'nn', customer: 'Ali', amountRM: 0, dueDate: null });
    const result = topDebtors([e], TODAY, 1);
    assert.ok(result[0].totalOwed >= 0);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests — topDebtors
// ---------------------------------------------------------------------------

describe('topDebtors — PBT: never includes paid-only customers', () => {
  it('PBT: result never contains a customer whose entries are all paid', () => {
    const arbEntry = (customer) => fc.record({
      id:        fc.uuid(),
      customer:  fc.constant(customer),
      item:      fc.constant('ayam'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 5000 }).map(n => n / 100),
      dueDate:   fc.option(fc.constantFrom('2026-09-01', '2026-10-01', '2026-11-01')),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('Ali', 'Siti', 'Ros', 'Mat', 'Jeff').chain(
            c => arbEntry(c)
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (ledger) => {
          const result = topDebtors(ledger, new Date(2026, 9, 30));
          // For each result customer, they must have at least one unpaid entry
          return result.every(d => {
            const entries = ledger.filter(e => e.customer === d.customer);
            return entries.some(e => !e.paid);
          });
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('topDebtors — PBT: at most n entries returned', () => {
  it('PBT: result.length <= n for all inputs', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constantFrom('Ali', 'Siti', 'Ros', 'Mat', 'Jeff', 'Zul', 'Hafiz'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 5000 }).map(n => n / 100),
      dueDate:   fc.option(fc.constant('2026-10-01')),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 0, maxLength: 30 }),
        fc.integer({ min: 1, max: 10 }),
        (ledger, n) => {
          const result = topDebtors(ledger, new Date(2026, 9, 30), n);
          return result.length <= n;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('topDebtors — PBT: result is sorted by daysOverdue descending', () => {
  it('PBT: result[i].daysOverdue >= result[i+1].daysOverdue', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constantFrom('Ali', 'Siti', 'Ros', 'Mat'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 5000 }).map(n => n / 100),
      dueDate:   fc.option(fc.constantFrom(
        '2026-08-01', '2026-09-01', '2026-10-01', '2026-10-15', '2026-11-01', '2026-12-01'
      )),
      paid:      fc.boolean(),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 0, maxLength: 20 }),
        (ledger) => {
          const result = topDebtors(ledger, new Date(2026, 9, 30));
          for (let i = 0; i < result.length - 1; i++) {
            if (result[i].daysOverdue < result[i + 1].daysOverdue) return false;
          }
          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('topDebtors — PBT: totalOwed is always >= 0', () => {
  it('PBT: every result has totalOwed >= 0', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constantFrom('Ali', 'Siti'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.float({ min: 0, max: 1000, noNaN: true }).map(n => Math.round(n * 100) / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-30T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 10 }),
        (ledger) => {
          const result = topDebtors(ledger, new Date(2026, 9, 30));
          return result.every(d => d.totalOwed >= 0);
        }
      ),
      { numRuns: 150 }
    );
  });
});

describe('buildReminder — emoji survive URL encoding', () => {
  it('ghost emoji is encoded as real UTF-8, never U+FFFD', async () => {
    const { buildReminder } = await import('../ledger.js');
    const e = [{ id: 'x', customer: 'Kak Ros', item: 'beras', qty: 1, amountRM: 5, dueDate: '2026-10-01', paid: false }];
    const url = buildReminder(e, 'Kak Ros', '0123456789', new Date(2026, 9, 31), 'ms');
    assert.ok(url.includes('%F0%9F%91%BB'));
    assert.ok(!url.includes('%EF%BF%BD'));
  });
});

// ---------------------------------------------------------------------------
// Unit tests — migrateStorage (FR-PA-5)
// ---------------------------------------------------------------------------

describe('migrateStorage', () => {
  it('adds payments: [] when missing', () => {
    const data = { version: 1, entries: [], phones: {} };
    const result = migrateStorage(data);
    assert.deepEqual(result.payments, []);
  });

  it('preserves existing payments array', () => {
    const p = { id: 'p1', customer: 'Ali', amountRM: 10, paidAt: '2026-10-01T00:00:00Z', raw: '' };
    const data = { version: 1, entries: [], phones: {}, payments: [p] };
    const result = migrateStorage(data);
    assert.equal(result.payments.length, 1);
    assert.equal(result.payments[0].id, 'p1');
  });

  it('handles null/undefined input gracefully', () => {
    const result = migrateStorage(null);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.payments, []);
    assert.deepEqual(result.phones, {});
    assert.equal(result.lang, 'ms');
  });

  it('preserves entries array', () => {
    const e = entry({ id: 'e1' });
    const data = { entries: [e], payments: [], phones: {}, lang: 'en' };
    const result = migrateStorage(data);
    assert.equal(result.entries.length, 1);
    assert.equal(result.lang, 'en');
  });

  it('coerces missing payments to []', () => {
    const result = migrateStorage({ entries: [], phones: {} });
    assert.deepEqual(result.payments, []);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — customerPayments (FR-PA-3)
// ---------------------------------------------------------------------------

describe('customerPayments', () => {
  const makePayment = (id, customer, amountRM, paidAt) => ({ id, customer, amountRM, paidAt, raw: '' });

  it('returns empty array when no payments for customer', () => {
    const p = makePayment('p1', 'Siti', 10, '2026-10-30T00:00:00Z');
    assert.deepEqual(customerPayments([p], 'Ali'), []);
  });

  it('returns only payments for the specified customer', () => {
    const p1 = makePayment('p1', 'Ali', 10, '2026-10-30T00:00:00Z');
    const p2 = makePayment('p2', 'Siti', 20, '2026-10-29T00:00:00Z');
    const result = customerPayments([p1, p2], 'Ali');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'p1');
  });

  it('sorts by paidAt descending (newest first)', () => {
    const p1 = makePayment('p1', 'Ali', 10, '2026-10-28T00:00:00Z');
    const p2 = makePayment('p2', 'Ali', 5, '2026-10-30T00:00:00Z');
    const p3 = makePayment('p3', 'Ali', 8, '2026-10-29T00:00:00Z');
    const result = customerPayments([p1, p2, p3], 'Ali');
    assert.equal(result[0].id, 'p2');
    assert.equal(result[1].id, 'p3');
    assert.equal(result[2].id, 'p1');
  });

  it('does not mutate the input array', () => {
    const p1 = makePayment('p1', 'Ali', 10, '2026-10-28T00:00:00Z');
    const p2 = makePayment('p2', 'Ali', 5, '2026-10-30T00:00:00Z');
    const arr = [p1, p2];
    customerPayments(arr, 'Ali');
    assert.equal(arr[0].id, 'p1'); // original order preserved
  });
});

// ---------------------------------------------------------------------------
// Unit tests — applyPayment (FR-PA-2, AC-PA-4 through AC-PA-7)
// ---------------------------------------------------------------------------

describe('applyPayment', () => {
  const createdAt = (n) => `2026-10-${String(n).padStart(2,'0')}T00:00:00.000Z`;

  it('AC-PA-4: partial payment splits one entry into paid + unpaid remainder', () => {
    const e = entry({ id: 'e1', customer: 'Kak Ros', amountRM: 18, createdAt: createdAt(1) });
    const { ledger: l2, payments: p2, warning } = applyPayment([e], [], 'Kak Ros', 10, 'bayar RM10');
    assert.equal(warning, null);
    // There should be 2 entries: original updated to 8, plus a paid stub of 10
    const unpaid = l2.filter(x => !x.paid && x.customer === 'Kak Ros');
    const paid = l2.filter(x => x.paid && x.customer === 'Kak Ros');
    assert.equal(unpaid.length, 1);
    assert.equal(unpaid[0].amountRM, 8.00);
    assert.equal(paid.length, 1);
    assert.equal(paid[0].amountRM, 10.00);
    // Payment record created
    assert.equal(p2.length, 1);
    assert.equal(p2[0].amountRM, 10.00);
    assert.equal(p2[0].customer, 'Kak Ros');
  });

  it('AC-PA-5: payment covering two entries marks first paid, splits second', () => {
    const e1 = entry({ id: 'e1', customer: 'Ali', amountRM: 10, createdAt: createdAt(1) });
    const e2 = entry({ id: 'e2', customer: 'Ali', amountRM: 15, createdAt: createdAt(2) });
    const { ledger: l2, warning } = applyPayment([e1, e2], [], 'Ali', 20, 'bayar RM20');
    assert.equal(warning, null);
    const unpaid = l2.filter(x => !x.paid && x.customer === 'Ali');
    const paid = l2.filter(x => x.paid && x.customer === 'Ali');
    assert.equal(unpaid.length, 1);
    assert.equal(unpaid[0].amountRM, 5.00); // 15 - (20-10) = 5
    assert.equal(paid.length, 2); // e1 fully paid + paid stub for 10 out of 15
  });

  it('AC-PA-6: overpayment is rejected with warning', () => {
    const e = entry({ id: 'e1', customer: 'Ali', amountRM: 18, createdAt: createdAt(1) });
    const { ledger: l2, payments: p2, warning } = applyPayment([e], [], 'Ali', 100, 'bayar RM100');
    assert.equal(warning, 'overpayment');
    // Ledger unchanged
    assert.equal(l2.length, 1);
    assert.equal(l2[0].amountRM, 18);
    assert.equal(p2.length, 0);
  });

  it('AC-PA-7: langsai marks all unpaid entries for customer as paid', () => {
    const e1 = entry({ id: 'e1', customer: 'Ros', amountRM: 10, createdAt: createdAt(1) });
    const e2 = entry({ id: 'e2', customer: 'Ros', amountRM: 8, createdAt: createdAt(2) });
    const other = entry({ id: 'e3', customer: 'Ali', amountRM: 5, createdAt: createdAt(3) });
    const { ledger: l2, payments: p2, warning } = applyPayment([e1, e2, other], [], 'Ros', null, 'langsai');
    assert.equal(warning, null);
    // All Ros entries paid
    assert.ok(l2.filter(x => x.customer === 'Ros').every(x => x.paid));
    // Ali's entry untouched
    assert.equal(l2.find(x => x.id === 'e3').paid, false);
    // One payment record summing total
    assert.equal(p2.length, 1);
    assert.equal(p2[0].amountRM, 18.00);
  });

  it('no_debt warning when customer has no unpaid entries', () => {
    const paid = { ...entry({ id: 'p', customer: 'Ali', amountRM: 10, createdAt: createdAt(1) }), paid: true };
    const { warning } = applyPayment([paid], [], 'Ali', 5, 'bayar RM5');
    assert.equal(warning, 'no_debt');
  });

  it('no_debt warning for langsai when customer has no unpaid entries', () => {
    const { warning } = applyPayment([], [], 'Ali', null, 'langsai');
    assert.equal(warning, 'no_debt');
  });

  it('exact payment fully covers entry (no split)', () => {
    const e = entry({ id: 'e1', customer: 'Ali', amountRM: 18, createdAt: createdAt(1) });
    const { ledger: l2, warning } = applyPayment([e], [], 'Ali', 18, 'bayar RM18');
    assert.equal(warning, null);
    const unpaid = l2.filter(x => !x.paid && x.customer === 'Ali');
    assert.equal(unpaid.length, 0);
    const paid = l2.filter(x => x.paid && x.customer === 'Ali');
    assert.equal(paid.length, 1);
    assert.equal(paid[0].amountRM, 18);
  });

  it('FIFO: oldest entry paid first', () => {
    // e2 created first (lower date), e1 created later
    const e1 = entry({ id: 'e1', customer: 'Ali', amountRM: 10, createdAt: createdAt(5) });
    const e2 = entry({ id: 'e2', customer: 'Ali', amountRM: 20, createdAt: createdAt(1) });
    // Apply RM5 — should reduce e2 (oldest), not e1
    const { ledger: l2, warning } = applyPayment([e1, e2], [], 'Ali', 5, 'bayar RM5');
    assert.equal(warning, null);
    // e2 should be split: 5 paid + 15 unpaid
    const updatedE2 = l2.find(x => x.id === 'e2');
    assert.equal(updatedE2.amountRM, 15.00); // remainder
    assert.equal(updatedE2.paid, false);
    // e1 untouched
    const e1Updated = l2.find(x => x.id === 'e1');
    assert.equal(e1Updated.amountRM, 10);
    assert.equal(e1Updated.paid, false);
  });

  it('does not mutate the input ledger', () => {
    const e = entry({ id: 'e1', customer: 'Ali', amountRM: 18, createdAt: createdAt(1) });
    const originalLedger = [e];
    applyPayment(originalLedger, [], 'Ali', 10, 'bayar RM10');
    assert.equal(originalLedger.length, 1);
    assert.equal(originalLedger[0].amountRM, 18);
  });

  it('does not mutate the input payments array', () => {
    const e = entry({ id: 'e1', customer: 'Ali', amountRM: 18, createdAt: createdAt(1) });
    const originalPayments = [];
    applyPayment([e], originalPayments, 'Ali', 10, 'bayar RM10');
    assert.equal(originalPayments.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — exportJSON / importJSON with payments (FR-PA-5.2)
// ---------------------------------------------------------------------------

describe('exportJSON / importJSON with payments', () => {
  it('exportJSON includes payments array', () => {
    const e = entry({ id: 'e1' });
    const p = { id: 'p1', customer: 'Ali', amountRM: 10, paidAt: '2026-10-01T00:00:00Z', raw: '' };
    const json = exportJSON([e], {}, [p]);
    const parsed = JSON.parse(json);
    assert.equal(parsed.payments.length, 1);
    assert.equal(parsed.payments[0].id, 'p1');
  });

  it('importJSON merges payments and deduplicates by id', () => {
    const p1 = { id: 'p1', customer: 'Ali', amountRM: 10, paidAt: '2026-10-01T00:00:00Z', raw: '' };
    const p2 = { id: 'p2', customer: 'Ali', amountRM: 5, paidAt: '2026-10-02T00:00:00Z', raw: '' };
    const json = JSON.stringify({ version: 1, entries: [], phones: {}, payments: [p1, p2] });
    // currentPayments already has p1 — only p2 should be added
    const { payments } = importJSON(json, [], {}, [p1]);
    assert.equal(payments.length, 2);
    assert.ok(payments.some(p => p.id === 'p1'));
    assert.ok(payments.some(p => p.id === 'p2'));
  });

  it('importJSON with no payments in backup returns current payments', () => {
    const p1 = { id: 'p1', customer: 'Ali', amountRM: 10, paidAt: '2026-10-01T00:00:00Z', raw: '' };
    const json = JSON.stringify({ version: 1, entries: [], phones: {} });
    const { payments } = importJSON(json, [], {}, [p1]);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].id, 'p1');
  });

  it('old backup (array format) returns empty payments', () => {
    const e = entry({ id: 'e1' });
    const json = JSON.stringify([e]);
    const { payments } = importJSON(json, [], {}, []);
    assert.deepEqual(payments, []);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests — applyPayment (PA-1 through PA-10)
// ---------------------------------------------------------------------------

describe('applyPayment — PBT: balance never negative (PA-1)', () => {
  it('PBT: customerTotal after payment >= 0', () => {
    const arbEntry = (customer) => fc.record({
      id:        fc.uuid(),
      customer:  fc.constant(customer),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry('Ali'), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 500 }).map(n => n / 100),
        (entries, payAmt) => {
          const { ledger: l2, warning } = applyPayment(entries, [], 'Ali', payAmt, '');
          if (warning) return true; // overpayment or no_debt — ledger unchanged
          return customerTotal(l2, 'Ali') >= 0;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('applyPayment — PBT: sum invariant (PA-2)', () => {
  it('PBT: balance_before - paymentApplied = balance_after', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 2000 }).map(n => n / 100),
        (entries, payAmt) => {
          const before = customerTotal(entries, 'Ali');
          const { ledger: l2, warning } = applyPayment(entries, [], 'Ali', payAmt, '');
          if (warning) return true;
          const after = customerTotal(l2, 'Ali');
          const diff = Math.round((before - after) * 100) / 100;
          return Math.abs(diff - Math.round(payAmt * 100) / 100) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('applyPayment — PBT: overpayment always rejected (PA-3)', () => {
  it('PBT: amountRM > total → warning overpayment, ledger unchanged', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 500 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 5 }),
        (entries) => {
          const total = customerTotal(entries, 'Ali');
          // Pay 1 cent more than total
          const overAmt = Math.round((total + 0.01) * 100) / 100;
          const { warning, ledger: l2 } = applyPayment(entries, [], 'Ali', overAmt, '');
          if (warning !== 'overpayment') return false;
          // Ledger should be referentially or value-equal to input
          return customerTotal(l2, 'Ali') === total;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('applyPayment — PBT: langsai clears all (PA-5)', () => {
  it('PBT: applyPayment with null amount clears all customer entries', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 10 }),
        (entries) => {
          const { ledger: l2, warning } = applyPayment(entries, [], 'Ali', null, 'langsai');
          if (warning) return true; // no_debt case
          return customerTotal(l2, 'Ali') === 0;
        }
      ),
      { numRuns: 150 }
    );
  });
});

describe('applyPayment — PBT: payment records grow by 1 (PA-9)', () => {
  it('PBT: successful payment adds exactly 1 PaymentRecord', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 200 }).map(n => n / 100),
        (entries, payAmt) => {
          const total = customerTotal(entries, 'Ali');
          if (payAmt > total) return true; // would be overpayment
          const { payments: p2, warning } = applyPayment(entries, [], 'Ali', payAmt, '');
          if (warning) return true;
          return p2.length === 1;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('applyPayment — PBT: all payment amountRM non-negative (PA-10)', () => {
  it('PBT: every PaymentRecord has amountRM >= 0', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 2000 }).map(n => n / 100),
        (entries, payAmt) => {
          const { payments: p2 } = applyPayment(entries, [], 'Ali', payAmt, '');
          return p2.every(p => p.amountRM >= 0);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('applyPayment — PBT: total owed + payments = original debt (PA-2 full)', () => {
  it('PBT: sum of payments for customer + balance = original total', () => {
    const arbEntry = fc.record({
      id:        fc.uuid(),
      customer:  fc.constant('Ali'),
      item:      fc.constant('item'),
      qty:       fc.constant(null),
      amountRM:  fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
      dueDate:   fc.constant(null),
      paid:      fc.constant(false),
      paidAt:    fc.constant(null),
      createdAt: fc.constant('2026-10-01T00:00:00.000Z'),
      raw:       fc.constant(''),
    });

    fc.assert(
      fc.property(
        fc.array(arbEntry, { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
        (entries, payAmt) => {
          const originalTotal = customerTotal(entries, 'Ali');
          const { ledger: l2, payments: p2, warning } = applyPayment(entries, [], 'Ali', payAmt, '');
          if (warning) return true;
          const balanceAfter = customerTotal(l2, 'Ali');
          const sumPayments = p2.reduce((s, p) => s + p.amountRM, 0);
          const reconstructed = Math.round((balanceAfter + sumPayments) * 100) / 100;
          return Math.abs(reconstructed - Math.round(originalTotal * 100) / 100) < 0.001;
        }
      ),
      { numRuns: 200 }
    );
  });
});
