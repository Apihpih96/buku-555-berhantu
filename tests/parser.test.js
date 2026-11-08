/**
 * @file tests/parser.test.js
 * Unit tests and property-based tests for parser.js.
 * Run with: node --test tests/parser.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parse, formatRM, round2 } from '../parser.js';

// ---------------------------------------------------------------------------
// Helper — fixed "today" for deterministic date assertions
// ---------------------------------------------------------------------------
// Use a Friday so "bayar Jumaat" == today+7 and "esok" is predictable.
// 2026-10-30 is a Friday.
const TODAY = new Date('2026-10-30T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Unit tests — example sentences from design.md
// ---------------------------------------------------------------------------

describe('parser — example sentences', () => {

  it('Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat', () => {
    const r = parse('Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat', TODAY);
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.item, 'kembung');
    assert.equal(r.qty, 2);
    assert.equal(r.amountRM, 18.00);
    // Jumaat (Friday) — 2026-10-30 is already a Friday, so next Friday is +7
    assert.equal(r.dueDate, '2026-11-06');
  });

  it('Encik Ali hutang ayam RM25.50', () => {
    const r = parse('Encik Ali hutang ayam RM25.50', TODAY);
    assert.equal(r.customer, 'Encik Ali');
    assert.equal(r.item, 'ayam');
    assert.equal(r.qty, null);
    assert.equal(r.amountRM, 25.50);
    assert.equal(r.dueDate, null);
  });

  it('Mak Cik Timah beli tiga tin sardin dua ringgit lima puluh sen', () => {
    const r = parse('Mak Cik Timah beli tiga tin sardin dua ringgit lima puluh sen', TODAY);
    assert.equal(r.customer, 'Mak Cik Timah');
    assert.equal(r.item, 'sardin');
    assert.equal(r.qty, 3);
    assert.equal(r.amountRM, 2.50);
    assert.equal(r.dueDate, null);
  });

  it('Abang Zul ambil ikan pari seringgit bayar esok', () => {
    const r = parse('Abang Zul ambil ikan pari seringgit bayar esok', TODAY);
    assert.equal(r.customer, 'Abang Zul');
    // ikan pari or ikan are both acceptable — check at least "ikan" present
    assert.ok(r.item && r.item.includes('ikan'), `item should include 'ikan', got: ${r.item}`);
    assert.equal(r.amountRM, 1.00);
    assert.equal(r.dueDate, '2026-10-31'); // esok = tomorrow
  });

  it('Puan Hasnah RM50 bayar hujung bulan', () => {
    const r = parse('Puan Hasnah RM50 bayar hujung bulan', TODAY);
    assert.equal(r.customer, 'Puan Hasnah');
    assert.equal(r.amountRM, 50.00);
    assert.equal(r.dueDate, '2026-10-31'); // last day of October
  });

  it('simple: Ali RM10', () => {
    const r = parse('Ali RM10', TODAY);
    assert.equal(r.customer, 'Ali');
    assert.equal(r.amountRM, 10.00);
    assert.equal(r.dueDate, null);
  });

  it('handles decimal RM: RM12.99', () => {
    const r = parse('Cik Sara RM12.99', TODAY);
    assert.equal(r.amountRM, 12.99);
  });

  it('handles minggu depan', () => {
    const r = parse('Pak Cik Hamid beli sayur RM8 bayar minggu depan', TODAY);
    assert.equal(r.dueDate, '2026-11-06'); // +7 days
  });

  it('handles lusa', () => {
    const r = parse('Melor RM5 bayar lusa', TODAY);
    assert.equal(r.dueDate, '2026-11-01'); // +2 days
  });

  it('handles named day Isnin', () => {
    const r = parse('Hassan RM20 bayar Isnin', TODAY);
    // 2026-10-30 is Fri → next Isnin is 2026-11-02
    assert.equal(r.dueDate, '2026-11-02');
  });

  it('null input returns all nulls', () => {
    const r = parse(null);
    assert.equal(r.customer, null);
    assert.equal(r.amountRM, null);
  });

  it('empty string returns all nulls', () => {
    const r = parse('');
    assert.equal(r.customer, null);
    assert.equal(r.amountRM, null);
  });

  it('ringgit keyword: lima ringgit', () => {
    const r = parse('Dila beli limau lima ringgit', TODAY);
    assert.equal(r.amountRM, 5.00);
  });

  it('RM with no spaces: RM5.50', () => {
    const r = parse('Rozi RM5.50', TODAY);
    assert.equal(r.amountRM, 5.50);
  });

});

// ---------------------------------------------------------------------------
// Unit tests — formatRM
// ---------------------------------------------------------------------------

describe('formatRM', () => {
  it('whole number', () => assert.equal(formatRM(18), 'RM18.00'));
  it('decimal',      () => assert.equal(formatRM(25.5), 'RM25.50'));
  it('zero',         () => assert.equal(formatRM(0), 'RM0.00'));
  it('two decimals', () => assert.equal(formatRM(12.99), 'RM12.99'));
});

// ---------------------------------------------------------------------------
// Unit tests — round2
// ---------------------------------------------------------------------------

describe('round2', () => {
  it('2.505 rounds to 2.51', () => assert.equal(round2(2.505), 2.51));
  it('1.004 rounds to 1.00', () => assert.equal(round2(1.004), 1.00));
  it('0 stays 0',            () => assert.equal(round2(0), 0));
  it('negative rounds',      () => assert.equal(round2(-1.005), -1.0));
});

// ---------------------------------------------------------------------------
// Property-based tests (fast-check)
// ---------------------------------------------------------------------------

describe('parser — property: amountRM always non-negative for RM literal inputs', () => {
  it('PBT: RM literal always non-negative', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000, noNaN: true }),
        (amount) => {
          const cents = Math.round((amount % 1) * 100);
          const whole = Math.floor(amount);
          const input = `Pelanggan RM${whole}.${String(cents).padStart(2, '0')}`;
          const r = parse(input, TODAY);
          return r.amountRM === null || r.amountRM >= 0;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('parser — property: customer is non-empty string when not null', () => {
  it('PBT: customer non-empty', () => {
    const names = fc.constantFrom(
      'Ali', 'Kak Ros', 'Encik Ahmad', 'Puan Siti', 'Mak Cik Timah'
    );
    fc.assert(
      fc.property(names, (name) => {
        const r = parse(`${name} RM10`, TODAY);
        if (r.customer !== null) {
          return typeof r.customer === 'string' && r.customer.trim().length > 0;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

describe('parser — property: RM literal parsed precisely', () => {
  it('PBT: RMx.yy parses to x + yy/100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 99 }),
        (whole, cents) => {
          const str = `Pelanggan RM${whole}.${String(cents).padStart(2, '0')}`;
          const r = parse(str, TODAY);
          const expected = round2(whole + cents / 100);
          return r.amountRM === expected;
        }
      ),
      { numRuns: 300 }
    );
  });
});

describe('formatRM — property: idempotent', () => {
  it('PBT: formatRM(round2(n)) === formatRM(round2(round2(n)))', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100000, noNaN: true }),
        (n) => {
          const once = formatRM(round2(n));
          // parse back the number from the formatted string
          const back = parseFloat(once.replace('RM', ''));
          const twice = formatRM(round2(back));
          return once === twice;
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — payment sentence parsing (FR-PA-1)
// ---------------------------------------------------------------------------

describe('parser — payment sentences', () => {

  it('Kak Ros bayar RM10 → payment', () => {
    const r = parse('Kak Ros bayar RM10', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.amountRM, 10.00);
  });

  it('Kak Ros dah bayar dua puluh ringgit → payment', () => {
    const r = parse('Kak Ros dah bayar dua puluh ringgit', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.amountRM, 20.00);
  });

  it('Abang Jeff bagi RM5 → payment', () => {
    const r = parse('Abang Jeff bagi RM5', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Abang Jeff');
    assert.equal(r.amountRM, 5.00);
  });

  it('Mak Cik Timah settle RM30 → payment', () => {
    const r = parse('Mak Cik Timah settle RM30', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Mak Cik Timah');
    assert.equal(r.amountRM, 30.00);
  });

  it('Pak Cik Hamid langsai → settle-all (amountRM null)', () => {
    const r = parse('Pak Cik Hamid langsai', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Pak Cik Hamid');
    assert.equal(r.amountRM, null);
  });

  it('Kak Ros settle semua → settle-all', () => {
    const r = parse('Kak Ros settle semua', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.amountRM, null);
  });

  it('Kak Ros langsai semua → settle-all', () => {
    const r = parse('Kak Ros langsai semua', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.amountRM, null);
  });

  it('Kak Ros dah langsai RM18 → payment with amount', () => {
    const r = parse('Kak Ros dah langsai RM18', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.amountRM, 18.00);
  });

  it('sudah bayar: Ali sudah bayar RM25 → payment', () => {
    const r = parse('Ali sudah bayar RM25', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Ali');
    assert.equal(r.amountRM, 25.00);
  });

  it('seringgit in payment: Ali bayar seringgit', () => {
    // "bayar seringgit" — no RM literal so isPaymentSentence checks for seringgit after bayar
    const r = parse('Ali bayar seringgit', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Ali');
    assert.equal(r.amountRM, 1.00);
  });

  it('payment with decimal: Ali bayar RM12.50', () => {
    const r = parse('Ali bayar RM12.50', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Ali');
    assert.equal(r.amountRM, 12.50);
  });

  it('no customer returns null customer', () => {
    const r = parse('bayar RM10', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, null);
  });

  it('debt entry with bayar due-date is NOT a payment', () => {
    // "RM18 bayar Jumaat" — bayar comes AFTER RM, so it is a due-date marker
    const r = parse('Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat', TODAY);
    assert.ok(!r.type, `should not be payment, got type: ${r.type}`);
    assert.equal(r.customer, 'Kak Ros');
    assert.equal(r.amountRM, 18.00);
    assert.equal(r.dueDate, '2026-11-06');
  });

  it('Encik Ali hutang ayam RM25.50 is NOT a payment', () => {
    const r = parse('Encik Ali hutang ayam RM25.50', TODAY);
    assert.ok(!r.type, `should not be payment`);
    assert.equal(r.customer, 'Encik Ali');
    assert.equal(r.amountRM, 25.50);
  });

  it('Malay amount in payment: Ros bayar lima ringgit', () => {
    const r = parse('Ros bayar lima ringgit', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Ros');
    assert.equal(r.amountRM, 5.00);
  });

  it('dah settle: Encik Ali dah settle RM50', () => {
    const r = parse('Encik Ali dah settle RM50', TODAY);
    assert.equal(r.type, 'payment');
    assert.equal(r.customer, 'Encik Ali');
    assert.equal(r.amountRM, 50.00);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests — payment parsing
// ---------------------------------------------------------------------------

describe('parser — PBT: payment amountRM always non-negative', () => {
  it('PBT: payment amountRM >= 0 or null', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10000, noNaN: true }),
        (amount) => {
          const whole = Math.floor(amount);
          const cents = Math.round((amount % 1) * 100);
          const input = `Kak Ros bayar RM${whole}.${String(cents).padStart(2, '0')}`;
          const r = parse(input, TODAY);
          if (r.type !== 'payment') return true; // not detected as payment, skip
          return r.amountRM === null || r.amountRM >= 0;
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('parser — PBT: payment customer non-empty when detected', () => {
  it('PBT: payment customer non-empty string when not null', () => {
    const names = fc.constantFrom('Ali', 'Kak Ros', 'Mak Cik Timah', 'Encik Ahmad');
    fc.assert(
      fc.property(names, (name) => {
        const r = parse(`${name} langsai`, TODAY);
        if (r.customer !== null) {
          return typeof r.customer === 'string' && r.customer.trim().length > 0;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// Regression tests (Hark review fixes, 2026-11-09)
describe('parser — payment edge cases (review fixes)', () => {
  const D = new Date('2026-11-09T04:00:00Z');
  it('"bagi" after a debt verb stays a debt', () => {
    const r = parse('Kak Ros ambil roti bagi anak RM5', D);
    assert.notEqual(r.type, 'payment');
    assert.equal(r.amountRM, 5);
  });
  it('"dah bayar" with no amount is not settle-all', () => {
    const r = parse('Kak Ros dah bayar', D);
    assert.equal(r.type, 'payment');
    assert.equal(r.settleAll, false);
  });
  it('langsai is settle-all', () => {
    assert.equal(parse('Pak Ali langsai', D).settleAll, true);
  });
  it('filler words do not join the customer name', () => {
    assert.equal(parse('Kak Ros bayar RM10 dulu', D).customer, 'Kak Ros');
    assert.equal(parse('Kak Ros bayar dulu RM10', D).customer, 'Kak Ros');
  });
  it('"rm 5" with a space is read as RM5', () => {
    assert.equal(parse('kak ros dah bayar rm 5', D).amountRM, 5);
    assert.equal(parse('Kak Ros ambil gula rm 5', D).amountRM, 5);
  });
});
