/**
 * @file tests/penyata.test.js
 * Tests for customer statement (Penyata Pelanggan) feature:
 *  - buildStatement (ledger.js)
 *  - daysSinceOldestUnpaid (ledger.js)
 *  - search matching helpers (pure functions tested directly)
 *  - MCP get_statement tool (mcp/debts.js)
 *
 * Run with: node --test tests/penyata.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  createEntry,
  buildStatement,
  daysSinceOldestUnpaid,
  normaliseMsisdn,
  customerTotal,
  formatLocalDate,
} from '../ledger.js';
import { callTool, ToolError } from '../mcp/debts.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let _id = 0;
/** @returns {import('../ledger.js').LedgerEntry} */
function entry(overrides = {}) {
  _id++;
  return createEntry({
    id: `ps-${_id}`,
    customer: 'Kak Ros',
    item: 'kembung',
    qty: 2,
    amountRM: 18.00,
    dueDate: null,
    raw: 'test',
    createdAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  });
}

const TODAY = new Date(2026, 10, 8); // 8 Nov 2026 (local)

// ---------------------------------------------------------------------------
// buildStatement — unit tests
// ---------------------------------------------------------------------------

describe('buildStatement — empty cases', () => {
  it('returns empty text and url for unknown customer', () => {
    const result = buildStatement([], [], 'Unknown', '0123456789', TODAY, 'ms');
    assert.equal(result.text, '');
    assert.equal(result.url, '');
  });

  it('returns empty text and url when ledger has no entries for that customer', () => {
    const ledger = [entry({ customer: 'Pak Mat' })];
    const result = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.equal(result.text, '');
    assert.equal(result.url, '');
  });
});

describe('buildStatement — malay (ms)', () => {
  it('includes Penyata Akaun header', () => {
    const ledger = [entry()];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Penyata Akaun'), `Expected "Penyata Akaun" in: ${text}`);
  });

  it('includes customer name in header', () => {
    const ledger = [entry()];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Kak Ros'), `Expected "Kak Ros" in: ${text}`);
  });

  it('includes the RM amount for each entry', () => {
    const ledger = [entry({ amountRM: 18 })];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('18.00'), `Expected "18.00" in: ${text}`);
  });

  it('shows Belum bayar for unpaid entry', () => {
    const ledger = [entry()];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Belum bayar'), `Expected "Belum bayar" in: ${text}`);
  });

  it('shows paid label for paid entry', () => {
    const e = { ...entry(), paid: true, paidAt: '2026-10-15T10:00:00.000Z' };
    const { text } = buildStatement([e], [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Dah bayar'), `Expected "Dah bayar" in: ${text}`);
    // Should NOT include "Belum bayar"
    assert.ok(!text.includes('Belum bayar'), `"Belum bayar" should not appear for paid entry`);
  });

  it('shows balance line when total > 0', () => {
    const ledger = [entry({ amountRM: 25 })];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Baki'), `Expected "Baki" in: ${text}`);
    assert.ok(text.includes('25.00'), `Expected "25.00" in: ${text}`);
  });

  it('shows "Tiada baki tertunggak" when all entries paid', () => {
    const e = { ...entry(), paid: true, paidAt: '2026-10-15T10:00:00.000Z' };
    const { text } = buildStatement([e], [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Tiada baki tertunggak'), `Expected zero-balance message in: ${text}`);
  });

  it('includes payment record lines', () => {
    const ledger = [entry()];
    const pmts = [{ id: 'p1', customer: 'Kak Ros', amountRM: 10, paidAt: '2026-10-10T09:00:00.000Z', raw: '' }];
    const { text } = buildStatement(ledger, pmts, 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('Bayar'), `Expected "Bayar" payment label in: ${text}`);
    assert.ok(text.includes('10.00'), `Expected "10.00" payment amount in: ${text}`);
  });

  it('includes the item name', () => {
    const ledger = [entry({ item: 'sardin' })];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('sardin'), `Expected item "sardin" in: ${text}`);
  });

  it('includes qty when present', () => {
    const ledger = [entry({ qty: 3, item: 'beras' })];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('×3'), `Expected "×3" in: ${text}`);
  });
});

describe('buildStatement — english (en)', () => {
  it('includes Account Statement header', () => {
    const ledger = [entry()];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'en');
    assert.ok(text.includes('Account Statement'), `Expected "Account Statement" in: ${text}`);
  });

  it('shows Unpaid for unpaid entry', () => {
    const ledger = [entry()];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'en');
    assert.ok(text.includes('Unpaid'), `Expected "Unpaid" in: ${text}`);
  });

  it('shows "No outstanding balance" when all paid', () => {
    const e = { ...entry(), paid: true, paidAt: '2026-10-15T10:00:00.000Z' };
    const { text } = buildStatement([e], [], 'Kak Ros', '0123456789', TODAY, 'en');
    assert.ok(text.includes('No outstanding balance'), `Expected zero-balance message in: ${text}`);
  });

  it('shows Balance line with correct RM', () => {
    const ledger = [entry({ amountRM: 30.5 })];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'en');
    assert.ok(text.includes('Balance'), `Expected "Balance" in: ${text}`);
    assert.ok(text.includes('30.50'), `Expected "30.50" in: ${text}`);
  });
});

describe('buildStatement — URL', () => {
  it('URL starts with https://api.whatsapp.com/send?phone=60', () => {
    const ledger = [entry()];
    const { url } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=60'),
      `Expected api.whatsapp.com URL, got: ${url}`);
  });

  it('URL is empty when msisdn is dummy "0000000000"', () => {
    const ledger = [entry()];
    const { url } = buildStatement(ledger, [], 'Kak Ros', '0000000000', TODAY, 'ms');
    assert.equal(url, '');
  });

  it('normalises 012-xxxxxxx to 60xxxxxxxxx', () => {
    const ledger = [entry()];
    const { url } = buildStatement(ledger, [], 'Kak Ros', '012-3456789', TODAY, 'ms');
    assert.ok(url.includes('phone=60123456789'), `Expected normalised phone in URL: ${url}`);
  });
});

describe('buildStatement — total correctness', () => {
  it('total in statement equals customerTotal for one unpaid entry', () => {
    const ledger = [entry({ amountRM: 42.5 })];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('42.50'), `Expected "42.50" in: ${text}`);
  });

  it('total in statement equals sum of all unpaid entries', () => {
    const ledger = [
      entry({ amountRM: 10 }),
      entry({ amountRM: 20 }),
      { ...entry({ amountRM: 5 }), paid: true, paidAt: '2026-10-02T00:00:00.000Z' },
    ];
    // Unpaid total = 10 + 20 = 30
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(text.includes('30.00'), `Expected "30.00" in: ${text}`);
    // The paid entry (5.00) should NOT appear in the balance
    assert.ok(!text.includes('Baki: RM35.00'), `Should not show 35.00 in: ${text}`);
  });

  it('multiple customers — only target customer entries appear', () => {
    const ledger = [
      entry({ customer: 'Kak Ros', amountRM: 18 }),
      entry({ customer: 'Pak Mat', amountRM: 99 }),
    ];
    const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
    assert.ok(!text.includes('Pak Mat'), `Pak Mat should not appear in Kak Ros statement`);
    assert.ok(!text.includes('99.00'), `Pak Mat's amount should not appear`);
  });
});

// ---------------------------------------------------------------------------
// daysSinceOldestUnpaid — unit tests
// ---------------------------------------------------------------------------

describe('daysSinceOldestUnpaid', () => {
  it('returns 0 when customer has no entries', () => {
    assert.equal(daysSinceOldestUnpaid([], 'Kak Ros', TODAY), 0);
  });

  it('returns 0 when all entries are paid', () => {
    const e = { ...entry(), paid: true };
    assert.equal(daysSinceOldestUnpaid([e], 'Kak Ros', TODAY), 0);
  });

  it('returns correct days since oldest createdAt', () => {
    // Entry created 2026-10-01, today is 2026-11-08 → 38 days
    const e = entry({ createdAt: '2026-10-01T08:00:00.000Z' });
    const days = daysSinceOldestUnpaid([e], 'Kak Ros', TODAY);
    assert.equal(days, 38);
  });

  it('uses oldest createdAt when multiple unpaid entries', () => {
    const older = entry({ createdAt: '2026-09-01T00:00:00.000Z' }); // 68 days ago
    const newer = entry({ createdAt: '2026-10-01T00:00:00.000Z' }); // 38 days ago
    const days = daysSinceOldestUnpaid([older, newer], 'Kak Ros', TODAY);
    assert.equal(days, 68);
  });

  it('ignores paid entries when computing oldest', () => {
    const paidOld = { ...entry({ createdAt: '2026-08-01T00:00:00.000Z' }), paid: true };
    const unpaid  = entry({ createdAt: '2026-10-15T00:00:00.000Z' }); // 24 days ago
    const days = daysSinceOldestUnpaid([paidOld, unpaid], 'Kak Ros', TODAY);
    assert.equal(days, 24);
  });

  it('only counts entries for the specified customer', () => {
    const other = entry({ customer: 'Pak Mat', createdAt: '2026-01-01T00:00:00.000Z' });
    const own   = entry({ createdAt: '2026-10-15T00:00:00.000Z' }); // 24 days ago
    const days = daysSinceOldestUnpaid([other, own], 'Kak Ros', TODAY);
    assert.equal(days, 24);
  });
});

// ---------------------------------------------------------------------------
// Search matching — pure helpers tested directly
// ---------------------------------------------------------------------------

/**
 * Inline copies of the search helpers for deterministic unit testing.
 * The production copies live in app.js (browser-only module).
 */
function stripHonorifics(name) {
  return name
    .replace(/^(Pak Cik|Mak Cik|Abang|Encik|Puan|Kak|Cik)\s+/i, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(customerName, query) {
  if (!query) return true;
  const q = stripHonorifics(query);
  const n = stripHonorifics(customerName);
  return n.includes(q);
}

describe('stripHonorifics', () => {
  it('strips Kak', () => assert.equal(stripHonorifics('Kak Ros'), 'ros'));
  it('strips Abang', () => assert.equal(stripHonorifics('Abang Zul'), 'zul'));
  it('strips Pak Cik', () => assert.equal(stripHonorifics('Pak Cik Hassan'), 'hassan'));
  it('strips Mak Cik', () => assert.equal(stripHonorifics('Mak Cik Timah'), 'timah'));
  it('strips Encik', () => assert.equal(stripHonorifics('Encik Ali'), 'ali'));
  it('strips Puan', () => assert.equal(stripHonorifics('Puan Hasnah'), 'hasnah'));
  it('strips Cik', () => assert.equal(stripHonorifics('Cik Aishah'), 'aishah'));
  it('leaves names without honorifics unchanged', () => assert.equal(stripHonorifics('Farid'), 'farid'));
  it('is case-insensitive for honorific matching', () => assert.equal(stripHonorifics('KAK Ros'), 'ros'));
});

describe('matchesSearch', () => {
  it('empty query always matches', () => {
    assert.ok(matchesSearch('Kak Ros', ''));
    assert.ok(matchesSearch('Pak Mat', ''));
  });

  it('exact name match (no honorific)', () => {
    assert.ok(matchesSearch('Kak Ros', 'Ros'));
  });

  it('case-insensitive', () => {
    assert.ok(matchesSearch('Kak Ros', 'ros'));
    assert.ok(matchesSearch('Kak Ros', 'ROS'));
  });

  it('honorific in query stripped — "Kak Ros" matches query "Ros"', () => {
    assert.ok(matchesSearch('Kak Ros', 'Ros'));
  });

  it('honorific in customer stripped — query "ros" matches "Kak Ros"', () => {
    assert.ok(matchesSearch('Kak Ros', 'ros'));
  });

  it('partial name matches', () => {
    assert.ok(matchesSearch('Kak Rosmah', 'ros'));
  });

  it('non-matching query returns false', () => {
    assert.ok(!matchesSearch('Kak Ros', 'Mat'));
  });

  it('honorific in query is stripped — "Ros" matches "Kak Ros"', () => {
    assert.ok(matchesSearch('Kak Ros', 'Ros'));
    // Note: "Kak" alone (with no following name) is not stripped from a query —
    // it will match any customer whose name contains "kak" after lowercasing
    assert.ok(!matchesSearch('Pak Mat', 'kak ros'));
  });

  it('multiple honorific tests do not strip from middle of name', () => {
    // "Siti Kak" — 'Kak' not at start → not stripped
    assert.ok(matchesSearch('Siti Kak Mah', 'kak mah'));
  });
});

// ---------------------------------------------------------------------------
// Property-based tests — buildStatement
// ---------------------------------------------------------------------------

describe('PBT: buildStatement', () => {
  const arbCustomer = fc.constantFrom('Kak Ros', 'Pak Mat', 'Encik Ali');
  const arbAmount   = fc.float({ min: Math.fround(0.01), max: Math.fround(999), noNaN: true });
  const arbEntries  = fc.array(
    fc.record({
      customer: arbCustomer,
      amountRM: arbAmount,
      paid: fc.boolean(),
    }),
    { minLength: 1, maxLength: 10 }
  );

  it('PBT: statement total equals customerTotal for all unpaid', () => {
    fc.assert(
      fc.property(arbEntries, (rawEntries) => {
        const customer = 'Kak Ros';
        let i = 0;
        const ledger = rawEntries
          .filter(r => r.customer === customer)
          .map(r => {
            const e = createEntry({ ...r, item: 'test', raw: 'test', createdAt: '2026-10-01T00:00:00.000Z' });
            return r.paid ? { ...e, paid: true, paidAt: '2026-10-15T00:00:00.000Z' } : e;
          });

        if (ledger.length === 0) return true; // skip

        const total = customerTotal(ledger, customer);
        const { text } = buildStatement(ledger, [], customer, '0123456789', TODAY, 'ms');

        if (total > 0) {
          return text.includes(total.toFixed(2));
        }
        return text.includes('Tiada baki');
      }),
      { numRuns: 50 }
    );
  });

  it('PBT: URL always starts with correct prefix for valid phone', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ amountRM: arbAmount }),
          { minLength: 1, maxLength: 5 }
        ),
        (rawEntries) => {
          const ledger = rawEntries.map(r =>
            createEntry({ ...r, customer: 'Kak Ros', item: 'item', raw: 'test', createdAt: '2026-10-01T00:00:00.000Z' })
          );
          const { url } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
          return url.startsWith('https://api.whatsapp.com/send?phone=60');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('PBT: empty ledger always returns empty result', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (customer) => {
          const result = buildStatement([], [], customer, '0123456789', TODAY, 'ms');
          return result.text === '' && result.url === '';
        }
      ),
      { numRuns: 50 }
    );
  });

  it('PBT: all entry items appear in statement text', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ item: fc.string({ minLength: 1, maxLength: 10, unit: 'grapheme' }) }),
          { minLength: 1, maxLength: 5 }
        ),
        (rawEntries) => {
          const ledger = rawEntries.map(r =>
            createEntry({ ...r, customer: 'Kak Ros', amountRM: 5, raw: 'test', createdAt: '2026-10-01T00:00:00.000Z' })
          );
          const { text } = buildStatement(ledger, [], 'Kak Ros', '0123456789', TODAY, 'ms');
          return ledger.every(e => text.includes(e.item));
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// PBT: search matching
// ---------------------------------------------------------------------------

describe('PBT: matchesSearch', () => {
  it('PBT: subset — filtered customers always a subset of all', () => {
    const customers = ['Kak Ros', 'Pak Mat', 'Encik Ali', 'Mak Cik Timah', 'Abang Zul'];
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 8 }),
        (query) => {
          const filtered = customers.filter(c => matchesSearch(c, query));
          return filtered.every(c => customers.includes(c));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: empty query returns all customers', () => {
    const customers = ['Kak Ros', 'Pak Mat', 'Encik Ali'];
    fc.assert(
      fc.property(fc.constant(''), (query) => {
        const filtered = customers.filter(c => matchesSearch(c, query));
        return filtered.length === customers.length;
      })
    );
  });

  it('PBT: honorific invariance — searching name without honorific matches full name with honorific', () => {
    const pairs = [
      ['Kak Ros', 'Ros'],
      ['Abang Zul', 'Zul'],
      ['Pak Cik Hassan', 'Hassan'],
      ['Mak Cik Timah', 'Timah'],
      ['Encik Ali', 'Ali'],
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...pairs),
        ([fullName, nameOnly]) => matchesSearch(fullName, nameOnly)
      )
    );
  });
});

// ---------------------------------------------------------------------------
// MCP get_statement — unit tests
// ---------------------------------------------------------------------------

// In-memory store factory for MCP tests
function makeStore(entries = [], payments = []) {
  const data = { version: 1, entries, payments, phones: {} };
  return {
    load: () => JSON.parse(JSON.stringify(data)),
    save: (d) => { Object.assign(data, d); },
  };
}

describe('MCP get_statement', () => {
  it('throws ToolError for unknown customer', () => {
    const store = makeStore([]);
    assert.throws(
      () => callTool('get_statement', { customer: 'Unknown Person' }, store),
      (err) => err instanceof ToolError && err.message.includes('Unknown Person')
    );
  });

  it('throws ToolError when customer string is empty', () => {
    const store = makeStore([]);
    assert.throws(
      () => callTool('get_statement', { customer: '' }, store),
      (err) => err instanceof ToolError
    );
  });

  it('returns correct fields for a known customer', () => {
    const e = entry({ createdAt: new Date().toISOString() });
    const store = makeStore([e]);
    const result = callTool('get_statement', { customer: 'Kak Ros' }, store);

    assert.equal(result.customer, 'Kak Ros');
    assert.ok(typeof result.statementText === 'string');
    assert.ok(result.statementText.length > 0);
    assert.ok(typeof result.totalOutstandingRM === 'number');
    assert.equal(result.entryCount, 1);
    assert.equal(result.unpaidCount, 1);
  });

  it('unpaidCount is 0 when all entries are paid', () => {
    const e = { ...entry({ createdAt: new Date().toISOString() }), paid: true, paidAt: new Date().toISOString() };
    const store = makeStore([e]);
    const result = callTool('get_statement', { customer: 'Kak Ros' }, store);

    assert.equal(result.unpaidCount, 0);
    assert.equal(result.totalOutstandingRM, 0);
  });

  it('statementText matches buildStatement text (lang ms)', () => {
    const e = entry({ createdAt: new Date().toISOString() });
    const store = makeStore([e]);
    const now = new Date();

    const result = callTool('get_statement', { customer: 'Kak Ros', lang: 'ms' }, store, now);

    // Build the expected text directly
    const { text: expected } = buildStatement([e], [], 'Kak Ros', '0000000000', now, 'ms');
    assert.equal(result.statementText, expected);
  });

  it('statementText in English when lang=en', () => {
    const e = entry({ createdAt: new Date().toISOString() });
    const store = makeStore([e]);
    const result = callTool('get_statement', { customer: 'Kak Ros', lang: 'en' }, store);

    assert.ok(result.statementText.includes('Account Statement'),
      `Expected "Account Statement" in: ${result.statementText}`);
  });

  it('totalOutstandingRM equals sum of unpaid amountRM', () => {
    const e1 = entry({ amountRM: 10, createdAt: new Date().toISOString() });
    const e2 = entry({ amountRM: 20, createdAt: new Date().toISOString() });
    const e3 = { ...entry({ amountRM: 5, createdAt: new Date().toISOString() }), paid: true, paidAt: new Date().toISOString() };
    const store = makeStore([e1, e2, e3]);
    const result = callTool('get_statement', { customer: 'Kak Ros' }, store);

    assert.equal(result.totalOutstandingRM, 30);
    assert.equal(result.entryCount, 3);
    assert.equal(result.unpaidCount, 2);
  });

  it('entryCount only includes entries for the requested customer', () => {
    const e1 = entry({ customer: 'Kak Ros', createdAt: new Date().toISOString() });
    const e2 = entry({ customer: 'Pak Mat', createdAt: new Date().toISOString() });
    const store = makeStore([e1, e2]);
    const result = callTool('get_statement', { customer: 'Kak Ros' }, store);

    assert.equal(result.entryCount, 1);
  });
});

// ---------------------------------------------------------------------------
// MCP get_statement — AC-PS-9 (statementText = buildStatement text)
// ---------------------------------------------------------------------------

describe('AC-PS-9: MCP statementText matches buildStatement', () => {
  it('statement text identical between MCP and direct buildStatement call', () => {
    const now = new Date(2026, 9, 15, 8, 0, 0); // 15 Oct 2026
    const e1 = createEntry({
      id: 'x1', customer: 'Kak Ros', item: 'kembung', qty: 2, amountRM: 18,
      dueDate: '2026-10-20', raw: 'test', createdAt: '2026-10-10T08:00:00.000Z',
    });
    const e2 = {
      ...createEntry({
        id: 'x2', customer: 'Kak Ros', item: 'beras', qty: 1, amountRM: 12,
        dueDate: null, raw: 'test', createdAt: '2026-10-12T08:00:00.000Z',
      }),
      paid: true,
      paidAt: '2026-10-14T10:00:00.000Z',
    };
    const entries = [e1, e2];

    const store = makeStore(entries);
    const mcpResult = callTool('get_statement', { customer: 'Kak Ros', lang: 'ms' }, store, now);

    const { text: directText } = buildStatement(entries, [], 'Kak Ros', '0000000000', now, 'ms');

    assert.equal(mcpResult.statementText, directText,
      'MCP statementText should exactly match buildStatement text');
  });
});

// Regression (Hark fix): a partial payment must not list the debt twice
import { applyPayment as _applyPayment } from '../ledger.js';
describe('buildStatement — partial payment regression', () => {
  it('shows one line per original debt with remaining balance', () => {
    const e = { id: 'a', customer: 'Kak Ros', item: 'kembung', qty: null, amountRM: 30, dueDate: null,
      paid: false, paidAt: null, createdAt: '2026-11-01T02:00:00.000Z', raw: 'Kak Ros kembung RM30' };
    const r = _applyPayment([e], [], 'Kak Ros', 10, 'Kak Ros bayar RM10');
    const { text } = buildStatement(r.ledger, r.payments, 'Kak Ros', null, new Date('2026-11-09T04:00:00Z'), 'ms');
    const itemLines = text.split('\n').filter(l => l.includes('kembung'));
    assert.equal(itemLines.length, 1, text);
    assert.ok(itemLines[0].includes('RM30.00'), text);
    assert.ok(itemLines[0].includes('baki RM20.00'), text);
    assert.ok(text.includes('✓ Bayar | RM10.00'), text);
    assert.ok(text.includes('Baki: RM20.00'), text);
  });
});
