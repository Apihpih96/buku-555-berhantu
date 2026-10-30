/**
 * @file ledger.js
 * Pure ledger math and data-management functions.
 * No DOM access. All functions return new arrays/objects (immutable style).
 *
 * @module ledger
 */

import { round2 } from './parser.js';

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LedgerEntry
 * @property {string}       id
 * @property {string}       customer
 * @property {string}       item
 * @property {number|null}  qty
 * @property {number}       amountRM    — always >= 0
 * @property {string|null}  dueDate     — ISO-8601 YYYY-MM-DD
 * @property {boolean}      paid
 * @property {string|null}  paidAt      — ISO timestamp
 * @property {string}       createdAt   — ISO timestamp
 * @property {string}       raw         — original input string
 */

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * Create a new LedgerEntry from parsed fields.
 *
 * @param {object} fields
 * @param {string}       fields.customer
 * @param {string}       fields.item
 * @param {number|null}  fields.qty
 * @param {number}       fields.amountRM
 * @param {string|null}  fields.dueDate
 * @param {string}       fields.raw
 * @param {string}       [fields.id]        — override id (for import)
 * @param {string}       [fields.createdAt] — override timestamp (for import)
 * @returns {LedgerEntry}
 */
export function createEntry(fields) {
  if (fields.amountRM < 0) {
    throw new RangeError(`amountRM must be >= 0, got ${fields.amountRM}`);
  }
  return {
    id: fields.id ?? uid(),
    customer: fields.customer,
    item: fields.item,
    qty: fields.qty ?? null,
    amountRM: round2(fields.amountRM),
    dueDate: fields.dueDate ?? null,
    paid: false,
    paidAt: null,
    createdAt: fields.createdAt ?? new Date().toISOString(),
    raw: fields.raw ?? '',
  };
}

// ---------------------------------------------------------------------------
// Core operations (return new arrays — no mutation)
// ---------------------------------------------------------------------------

/**
 * Append a new entry to the ledger.
 *
 * @param {LedgerEntry[]} ledger
 * @param {LedgerEntry}   entry
 * @returns {LedgerEntry[]}
 */
export function addEntry(ledger, entry) {
  if (entry.amountRM < 0) {
    throw new RangeError(`amountRM must be >= 0, got ${entry.amountRM}`);
  }
  return [...ledger, entry];
}

/**
 * Mark an entry as paid.
 *
 * @param {LedgerEntry[]} ledger
 * @param {string}        id
 * @returns {LedgerEntry[]}
 */
export function markPaid(ledger, id) {
  return ledger.map(e =>
    e.id === id
      ? { ...e, paid: true, paidAt: new Date().toISOString() }
      : e
  );
}

/**
 * Delete an entry by id.
 *
 * @param {LedgerEntry[]} ledger
 * @param {string}        id
 * @returns {LedgerEntry[]}
 */
export function deleteEntry(ledger, id) {
  return ledger.filter(e => e.id !== id);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Sum of all unpaid entries.
 *
 * @param {LedgerEntry[]} ledger
 * @returns {number}
 */
export function totalOutstanding(ledger) {
  return round2(
    ledger
      .filter(e => !e.paid)
      .reduce((sum, e) => sum + e.amountRM, 0)
  );
}

/**
 * All unpaid entries whose due date is strictly before today.
 *
 * @param {LedgerEntry[]} ledger
 * @param {Date|string}   today
 * @returns {LedgerEntry[]}
 */
export function overdueEntries(ledger, today = new Date()) {
  const todayISO = typeof today === 'string' ? today : today.toISOString().slice(0, 10);
  return ledger.filter(e => !e.paid && e.dueDate !== null && e.dueDate < todayISO);
}

/**
 * Group unpaid entries by customer name.
 *
 * @param {LedgerEntry[]} ledger
 * @returns {Map<string, LedgerEntry[]>}
 */
export function entriesByCustomer(ledger) {
  /** @type {Map<string, LedgerEntry[]>} */
  const map = new Map();
  for (const e of ledger.filter(e => !e.paid)) {
    const list = map.get(e.customer) ?? [];
    list.push(e);
    map.set(e.customer, list);
  }
  return map;
}

/**
 * Total owed by a single customer (unpaid).
 *
 * @param {LedgerEntry[]} ledger
 * @param {string}        customer
 * @returns {number}
 */
export function customerTotal(ledger, customer) {
  return round2(
    ledger
      .filter(e => !e.paid && e.customer === customer)
      .reduce((sum, e) => sum + e.amountRM, 0)
  );
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

/**
 * Serialise ledger to JSON string.
 *
 * @param {LedgerEntry[]} ledger
 * @returns {string}
 */
export function exportJSON(ledger) {
  return JSON.stringify({ version: 1, entries: ledger }, null, 2);
}

/**
 * Merge an imported JSON backup into the current ledger.
 * Deduplicates by entry id (existing entries take precedence).
 *
 * @param {string}        json
 * @param {LedgerEntry[]} currentLedger
 * @returns {LedgerEntry[]}
 */
export function importJSON(json, currentLedger) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyntaxError('Invalid JSON backup file');
  }

  const incoming = Array.isArray(parsed)
    ? parsed
    : (parsed.entries ?? []);

  const existingIds = new Set(currentLedger.map(e => e.id));
  const newEntries = incoming.filter(e => !existingIds.has(e.id));
  return [...currentLedger, ...newEntries];
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

/**
 * Normalise a Malaysian phone number to 60XXXXXXXXX format.
 *
 * @param {string} raw  — e.g. "012-3456789", "60123456789", "+60123456789"
 * @returns {string}
 */
export function normaliseMsisdn(raw) {
  // Strip non-digits
  let digits = raw.replace(/\D/g, '');

  // Remove leading +
  if (digits.startsWith('60')) {
    return digits; // already normalised
  }
  if (digits.startsWith('0')) {
    return '60' + digits.slice(1);
  }
  return '60' + digits;
}

/**
 * Build a WhatsApp wa.me link with a pre-filled reminder message.
 *
 * @param {string} msisdn   — raw phone number (will be normalised)
 * @param {string} customer
 * @param {string} item
 * @param {number} amountRM
 * @param {string|null} dueDate
 * @returns {string}
 */
export function buildWhatsAppLink(msisdn, customer, item, amountRM, dueDate) {
  const normalised = normaliseMsisdn(msisdn);
  const due = dueDate ?? 'tidak dinyatakan';
  const msg =
    `Assalamualaikum ${customer}, ini peringatan hutang di kedai kami:\n` +
    `${item} — RM${round2(amountRM).toFixed(2)}\n` +
    `Tarikh bayar: ${due}\n` +
    `Terima kasih 🙏`;
  return `https://wa.me/${normalised}?text=${encodeURIComponent(msg)}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a simple unique id.
 * Uses crypto.randomUUID when available, falls back to timestamp+random.
 *
 * @returns {string}
 */
function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
