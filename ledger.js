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
  const todayISO = typeof today === 'string' ? today : localISO(today);
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
 * Serialise ledger to JSON string, optionally including the phones map.
 *
 * @param {LedgerEntry[]}            ledger
 * @param {Record<string,string>}    [phones]  — customer → normalised msisdn
 * @returns {string}
 */
export function exportJSON(ledger, phones = {}) {
  return JSON.stringify({ version: 1, entries: ledger, phones }, null, 2);
}

/**
 * Merge an imported JSON backup into the current ledger.
 * Deduplicates by entry id (existing entries take precedence).
 * Also extracts the phones map from the backup if present.
 *
 * @param {string}                   json
 * @param {LedgerEntry[]}            currentLedger
 * @param {Record<string,string>}    [currentPhones]
 * @returns {{ ledger: LedgerEntry[], phones: Record<string,string> }}
 */
export function importJSON(json, currentLedger, currentPhones = {}) {
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
  const mergedLedger = [...currentLedger, ...newEntries];

  // Merge phones: existing take precedence (same as entries dedup)
  const backupPhones = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
    ? (parsed.phones ?? {})
    : {};
  const mergedPhones = { ...backupPhones, ...currentPhones };

  return { ledger: mergedLedger, phones: mergedPhones };
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

/**
 * Build a WhatsApp wa.me link with a reminder covering ALL of a customer's
 * unpaid entries. Tone adapts based on whether any entry is overdue.
 *
 * Uses LOCAL calendar dates — never toISOString() for display.
 *
 * @param {LedgerEntry[]}  entries   — full ledger (function filters internally)
 * @param {string}         customer  — customer name
 * @param {string}         msisdn    — raw phone number (will be normalised)
 * @param {Date}           today     — reference date for overdue detection
 * @param {'ms' | 'en'}    [lang]    — UI language, default 'ms'
 * @returns {string}                 — full https://wa.me/... URL, or '' if no unpaid
 */
export function buildReminder(entries, customer, msisdn, today = new Date(), lang = 'ms') {
  const unpaid = entries.filter(e => !e.paid && e.customer === customer);
  if (unpaid.length === 0) return '';

  const todayISO = localDateISO(today);

  // Detect status: any overdue? any due today?
  let anyOverdue = false;
  let anyToday = false;
  for (const e of unpaid) {
    if (e.dueDate !== null) {
      if (e.dueDate < todayISO) anyOverdue = true;
      if (e.dueDate === todayISO) anyToday = true;
    }
  }

  const total = round2(unpaid.reduce((s, e) => s + e.amountRM, 0));

  const lines = [];

  if (lang === 'en') {
    lines.push(`Hello ${customer}, 👋`);
    lines.push('');
    if (anyOverdue) {
      lines.push('The Buku 555 Ghost has come to visit 👻');
      lines.push('');
    }
    lines.push('Outstanding balance:');
    for (const e of unpaid) {
      const itemStr = e.qty ? `${e.item} ×${e.qty}` : e.item;
      let duePart = '';
      if (e.dueDate) {
        if (e.dueDate < todayISO) {
          duePart = ` (overdue since ${formatLocalDate(e.dueDate, 'en')})`;
        } else if (e.dueDate === todayISO) {
          duePart = ' (today)';
        } else {
          duePart = ` (pay by ${formatLocalDate(e.dueDate, 'en')})`;
        }
      }
      lines.push(`• ${itemStr} — RM${e.amountRM.toFixed(2)}${duePart}`);
    }
    lines.push('');
    lines.push(`Total: RM${total.toFixed(2)}`);
    lines.push('');
    if (anyOverdue) {
      lines.push("If you've already paid, please ignore this.");
    } else {
      lines.push('Hope to settle this soon.');
    }
    lines.push('Thank you 🙏');
  } else {
    // Malay (default)
    lines.push(`Assalamualaikum ${customer}, 👋`);
    lines.push('');
    if (anyOverdue) {
      lines.push('Hantu Buku 555 datang menjenguk 👻');
      lines.push('');
    }
    lines.push('Hutang belum dijelaskan:');
    for (const e of unpaid) {
      const itemStr = e.qty ? `${e.item} ×${e.qty}` : e.item;
      let duePart = '';
      if (e.dueDate) {
        if (e.dueDate < todayISO) {
          duePart = ` (tertunggak sejak ${formatLocalDate(e.dueDate, 'ms')})`;
        } else if (e.dueDate === todayISO) {
          duePart = ' (hari ini)';
        } else {
          duePart = ` (bayar sebelum ${formatLocalDate(e.dueDate, 'ms')})`;
        }
      }
      lines.push(`• ${itemStr} — RM${e.amountRM.toFixed(2)}${duePart}`);
    }
    lines.push('');
    lines.push(`Jumlah: RM${total.toFixed(2)}`);
    lines.push('');
    if (anyOverdue) {
      lines.push('Kalau dah bayar, abaikan ya.');
    } else {
      lines.push('Harap dapat dijelaskan tidak lama lagi.');
    }
    lines.push('Terima kasih 🙏');
  }

  const text = lines.join('\n');
  const normalised = normaliseMsisdn(msisdn);
  return `https://wa.me/${normalised}?text=${encodeURIComponent(text)}`;
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

/**
 * Local calendar date as YYYY-MM-DD (not UTC).
 * @param {Date} d
 * @returns {string}
 */
function localISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local calendar date as YYYY-MM-DD from a Date object (exported alias).
 * @param {Date} d
 * @returns {string}
 */
export function localDateISO(d) {
  return localISO(d);
}

// Day/month name tables for local formatting (avoids locale dependency in Node tests)
const MS_DAYS   = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
const MS_MONTHS = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
const EN_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format an ISO date string (YYYY-MM-DD) as a human-readable local date.
 * Parses as midnight local time to avoid UTC-shift problems.
 *
 * @param {string}          isoDate  — "YYYY-MM-DD"
 * @param {'ms' | 'en'}     lang
 * @returns {string}                 — e.g. "Jumaat, 6 Nov" / "Friday, 6 Nov"
 */
export function formatLocalDate(isoDate, lang = 'ms') {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  // Construct as local midnight
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();      // 0=Sun
  const dom = d.getDate();
  const mon = d.getMonth();    // 0-based

  if (lang === 'en') {
    return `${EN_DAYS[dow]}, ${dom} ${EN_MONTHS[mon]}`;
  }
  return `${MS_DAYS[dow]}, ${dom} ${MS_MONTHS[mon]}`;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

/**
 * Sample warung ledger for judges and first-time users, dated relative to
 * `today` so it always shows one overdue ghost, one due today, one upcoming
 * and one paid entry.
 *
 * @param {Date} today
 * @returns {LedgerEntry[]}
 */
export function demoEntries(today = new Date()) {
  const shift = (days) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    return localISO(d);
  };
  const rows = [
    { customer: 'Kak Ros', item: 'beras 5kg', qty: 1, amountRM: 18.5, dueDate: shift(-3), raw: 'Kak Ros hutang beras 5kg RM18.50' },
    { customer: 'Kak Ros', item: 'gula', qty: 2, amountRM: 6, dueDate: shift(4), raw: 'Kak Ros 2kilo gula RM6 bayar minggu depan' },
    { customer: 'Pak Mat', item: 'rokok', qty: 1, amountRM: 17, dueDate: shift(-10), raw: 'Pak Mat rokok RM17' },
    { customer: 'Abang Jeff', item: 'minyak masak', qty: 1, amountRM: 9.9, dueDate: shift(0), raw: 'Abang Jeff minyak masak RM9.90 bayar hari ini' },
    { customer: 'Mak Cik Timah', item: 'telur sepapan', qty: 1, amountRM: 13, dueDate: shift(7), raw: 'Mak Cik Timah telur sepapan RM13' },
  ];
  const entries = rows.map((r) => createEntry(r));
  const paid = createEntry({ customer: 'Adik Hafiz', item: 'roti', qty: 1, amountRM: 3.2, dueDate: shift(-1), raw: 'Adik Hafiz roti RM3.20' });
  return [...entries, { ...paid, paid: true }];
}
