/**
 * @file parser.js
 * Pure, deterministic parser for Malay hutang (debt) sentences.
 * No DOM access, no side effects — safe to import in Node test runner.
 *
 * @module parser
 */

// ---------------------------------------------------------------------------
// Malay number table
// ---------------------------------------------------------------------------

/** @type {Record<string, number>} */
const MALAY_UNITS = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, lapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14,
  'lima belas': 15, 'enam belas': 16, 'tujuh belas': 17,
  'lapan belas': 18, 'sembilan belas': 19,
};

/** @type {Record<string, number>} */
const MALAY_TENS = {
  'dua puluh': 20, 'tiga puluh': 30, 'empat puluh': 40,
  'lima puluh': 50, 'enam puluh': 60, 'tujuh puluh': 70,
  'lapan puluh': 80, 'sembilan puluh': 90,
};

/** @type {Record<string, number>} */
const MALAY_SPECIAL = {
  seringgit: 1,   // shorthand for RM1
  seratus: 100,
};

/**
 * Try to parse a Malay number phrase starting at position `pos` in `tokens`.
 * Returns `{ value: number, consumed: number }` or `null`.
 *
 * @param {string[]} tokens
 * @param {number} pos
 * @returns {{ value: number, consumed: number } | null}
 */
function parseMalayNumber(tokens, pos) {
  // Try two-word compound first (e.g. "dua puluh tiga")
  if (pos < tokens.length) {
    // tens + unit  e.g. "dua puluh tiga"
    const twoWord = tokens[pos] + ' ' + (tokens[pos + 1] ?? '');
    const threeWord = twoWord + ' ' + (tokens[pos + 2] ?? '');

    if (MALAY_TENS[twoWord] !== undefined) {
      const tens = MALAY_TENS[twoWord];
      // Check for following unit
      const unitWord = tokens[pos + 2];
      if (unitWord && MALAY_UNITS[unitWord] !== undefined && MALAY_UNITS[unitWord] <= 9) {
        return { value: tens + MALAY_UNITS[unitWord], consumed: 3 };
      }
      return { value: tens, consumed: 2 };
    }

    // two-word teens / units
    if (MALAY_UNITS[twoWord] !== undefined) {
      return { value: MALAY_UNITS[twoWord], consumed: 2 };
    }

    // single word
    const word = tokens[pos];
    if (MALAY_UNITS[word] !== undefined) {
      return { value: MALAY_UNITS[word], consumed: 1 };
    }
    if (MALAY_SPECIAL[word] !== undefined) {
      return { value: MALAY_SPECIAL[word], consumed: 1 };
    }

    // Plain digit
    const n = Number(word);
    if (!isNaN(n) && n >= 0) {
      return { value: n, consumed: 1 };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Day resolver
// ---------------------------------------------------------------------------

const DAY_NAMES_MS = ['ahad', 'isnin', 'selasa', 'rabu', 'khamis', 'jumaat', 'sabtu'];

/**
 * Resolve a day reference to an ISO date string (YYYY-MM-DD).
 *
 * @param {string} ref  — lowercase day reference
 * @param {Date} today
 * @returns {string | null}
 */
function resolveDay(ref, today) {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  if (ref === 'esok') {
    base.setDate(base.getDate() + 1);
    return toISO(base);
  }
  if (ref === 'lusa') {
    base.setDate(base.getDate() + 2);
    return toISO(base);
  }
  if (ref === 'minggu depan') {
    base.setDate(base.getDate() + 7);
    return toISO(base);
  }
  if (ref === 'hujung bulan') {
    base.setMonth(base.getMonth() + 1, 0); // last day of current month
    return toISO(base);
  }

  const dayIdx = DAY_NAMES_MS.indexOf(ref);
  if (dayIdx !== -1) {
    const todayIdx = base.getDay(); // 0=Sun
    let diff = dayIdx - todayIdx;
    if (diff <= 0) diff += 7; // always future
    base.setDate(base.getDate() + diff);
    return toISO(base);
  }

  return null;
}

/**
 * @param {Date} d
 * @returns {string}
 */
function toISO(d) {
  // Use local calendar date (toISOString shifts to UTC and is a day early in Malaysia, UTC+8)
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Honorifics
// ---------------------------------------------------------------------------

const HONORIFICS = [
  'pak cik', 'mak cik', 'abang', 'encik', 'puan', 'kak', 'cik',
];

// ---------------------------------------------------------------------------
// Amount extractor
// ---------------------------------------------------------------------------

/**
 * Extract RM amount from a token list starting at `pos`.
 * Recognises:
 *   - RM18, RM18.50
 *   - Malay number + "ringgit" [+ Malay number + "sen"]
 *   - seringgit
 *
 * @param {string[]} tokens
 * @param {number} pos
 * @returns {{ value: number, start: number, end: number } | null}
 */
function extractAmount(tokens, pos) {
  for (let i = pos; i < tokens.length; i++) {
    const tok = tokens[i];

    // RM literal: rm18 / rm18.50
    const rmMatch = tok.match(/^rm(\d+(?:[.,]\d{1,2})?)$/i);
    if (rmMatch) {
      const val = parseFloat(rmMatch[1].replace(',', '.'));
      return { value: val, start: i, end: i + 1 };
    }

    // seringgit = RM1
    if (tok === 'seringgit') {
      return { value: 1, start: i, end: i + 1 };
    }

    // Malay/digit number + "ringgit"
    {
      const num = parseMalayNumber(tokens, i);
      if (num !== null && tokens[i + num.consumed] === 'ringgit') {
        let endPos = i + num.consumed + 1; // +1 for "ringgit"
        let cents = 0;
        // check for "X sen"
        if (endPos < tokens.length) {
          const centsNum = parseMalayNumber(tokens, endPos);
          if (centsNum !== null && tokens[endPos + centsNum.consumed] === 'sen') {
            cents = centsNum.value;
            endPos += centsNum.consumed + 1;
          }
        }
        const val = num.value + cents / 100;
        return { value: val, start: i, end: endPos };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Due-date extractor
// ---------------------------------------------------------------------------

/**
 * Extract a due date reference from tokens, starting at `pos`.
 *
 * @param {string[]} tokens
 * @param {number} pos
 * @param {Date} today
 * @returns {{ iso: string, start: number, end: number } | null}
 */
function extractDueDate(tokens, pos, today) {
  const DUE_TRIGGERS = ['bayar', 'pada', 'due', 'sebelum'];

  for (let i = pos; i < tokens.length; i++) {
    if (!DUE_TRIGGERS.includes(tokens[i])) continue;

    // Two-word refs
    const twoWord = (tokens[i + 1] ?? '') + ' ' + (tokens[i + 2] ?? '');
    if (twoWord.trim() === 'minggu depan') {
      const iso = resolveDay('minggu depan', today);
      return iso ? { iso, start: i, end: i + 3 } : null;
    }
    if (twoWord.trim() === 'hujung bulan') {
      const iso = resolveDay('hujung bulan', today);
      return iso ? { iso, start: i, end: i + 3 } : null;
    }

    // Single word
    const ref = tokens[i + 1] ?? '';
    const iso = resolveDay(ref, today);
    if (iso) {
      return { iso, start: i, end: i + 2 };
    }
  }
  // Second pass: date phrases anywhere, without a trigger word
  for (let i = pos; i < tokens.length; i++) {
    const two = (tokens[i] ?? '') + ' ' + (tokens[i + 1] ?? '');
    if (two === 'minggu depan' || two === 'hujung bulan') {
      const iso = resolveDay(two, today);
      if (iso) return { iso, start: i, end: i + 2 };
    }
    const iso = resolveDay(tokens[i], today);
    if (iso) return { iso, start: i, end: i + 1 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Payment sentence detection
// ---------------------------------------------------------------------------

/**
 * Multi-word payment trigger phrases (checked before single-word triggers).
 * Order matters: longer phrases first so they match before their sub-words.
 * @type {string[]}
 */
const PAYMENT_TRIGGERS_MULTI = [
  'dah bayar', 'sudah bayar', 'settle semua', 'langsai semua',
  'dah langsai', 'dah settle',
];

/**
 * Single-word payment trigger tokens.
 * Note: 'bayar' is only a payment trigger when followed by an amount, not a day name.
 * @type {string[]}
 */
const PAYMENT_TRIGGERS_SINGLE_UNCONDITIONAL = ['bagi', 'settle', 'langsai'];

/**
 * Settle-all trigger phrases (amountRM becomes null).
 * @type {Set<string>}
 */
const SETTLE_ALL_TRIGGERS = new Set(['langsai', 'settle semua', 'langsai semua', 'dah langsai', 'dah settle']);

/**
 * Check whether a normalised token array represents a payment sentence.
 *
 * Rules:
 * - Multi-word triggers (dah bayar, sudah bayar, etc.) → always payment
 * - 'bagi', 'settle', 'langsai' → always payment
 * - 'bayar' alone: payment only when followed by an RM amount or Malay number + ringgit,
 *   NOT when followed by a day name (in which case it's a debt-entry due-date clause).
 *
 * @param {string[]} tokens
 * @returns {boolean}
 */
function isPaymentSentence(tokens) {
  const joined = tokens.join(' ');

  // Multi-word triggers always win
  for (const phrase of PAYMENT_TRIGGERS_MULTI) {
    if (joined.includes(phrase)) return true;
  }

  // Unconditional single-word triggers
  for (const word of PAYMENT_TRIGGERS_SINGLE_UNCONDITIONAL) {
    if (tokens.includes(word)) return true;
  }

  // 'bayar' — only a payment trigger when what follows looks like an amount, not a day name
  const bayarIdx = tokens.indexOf('bayar');
  if (bayarIdx !== -1) {
    // Check if there is an RM literal anywhere in the sentence
    const hasRmLiteral = tokens.some(t => /^rm\d/.test(t));
    if (hasRmLiteral) {
      // It's a payment only if there's also NO day name after bayar
      // (debt entry: "ambil kembung RM18 bayar Jumaat" — has RM but bayar is due-date marker)
      // (payment: "bayar RM10" or "dah bayar RM10")
      // Heuristic: if bayar appears BEFORE any RM token, it's a payment
      // If bayar appears AFTER any RM token, it's a due-date marker for a debt entry
      const firstRmIdx = tokens.findIndex(t => /^rm\d/.test(t));
      if (bayarIdx < firstRmIdx) {
        // "bayar RM10 ..." → payment
        return true;
      }
      // "... RM18 bayar Jumaat" → debt entry (due-date bayar)
      return false;
    }
    // No RM literal — check for Malay number + ringgit after bayar
    for (let i = bayarIdx + 1; i < tokens.length; i++) {
      if (tokens[i] === 'ringgit' || tokens[i] === 'seringgit') return true;
      const num = parseMalayNumber(tokens, i);
      if (num !== null && tokens[i + num.consumed] === 'ringgit') return true;
    }
  }

  return false;
}

/**
 * Find which payment trigger phrase is present and return it.
 * Returns the first match (longest first).
 *
 * @param {string[]} tokens
 * @returns {{ phrase: string, start: number, end: number } | null}
 */
function findPaymentTrigger(tokens) {
  const joined = tokens.join(' ');

  // Multi-word triggers first (longer → more specific)
  for (const phrase of PAYMENT_TRIGGERS_MULTI) {
    if (!joined.includes(phrase)) continue;
    const words = phrase.split(' ');
    for (let i = 0; i <= tokens.length - words.length; i++) {
      if (words.every((w, j) => tokens[i + j] === w)) {
        return { phrase, start: i, end: i + words.length };
      }
    }
  }

  // Unconditional single-word triggers
  for (const word of PAYMENT_TRIGGERS_SINGLE_UNCONDITIONAL) {
    const idx = tokens.indexOf(word);
    if (idx !== -1) {
      return { phrase: word, start: idx, end: idx + 1 };
    }
  }

  // 'bayar' as payment trigger (only if isPaymentSentence was true, so we can use it)
  const bayarIdx = tokens.indexOf('bayar');
  if (bayarIdx !== -1) {
    return { phrase: 'bayar', start: bayarIdx, end: bayarIdx + 1 };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Payment parser
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParsedPayment
 * @property {'payment'} type
 * @property {string | null} customer
 * @property {number | null} amountRM   — null means "settle all"
 */

/**
 * Parse a Malay payment sentence.
 *
 * @param {string} input
 * @param {Date} today
 * @returns {ParsedPayment}
 */
export function parsePayment(input, today) {
  const normalised = input
    .toLowerCase()
    .replace(/(rm\s*\d+)[.,](\d{1,2})/gi, '$1.$2')
    .replace(/[,،]/g, ' ')
    .replace(/(\D)\.|\.(\D)/g, '$1 $2')
    .replace(/^\.|\.$/, ' ')
    .replace(/(\d)(kilo|kg|tin|biji|botol|liter|litre|paket|pack|gelas)\b/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalised.split(' ');

  // Find the trigger
  const trigger = findPaymentTrigger(tokens);
  const isSettleAll = trigger ? SETTLE_ALL_TRIGGERS.has(trigger.phrase) : false;

  // Extract amount
  const amountResult = extractAmount(tokens, 0);
  let amountRM = amountResult ? round2(amountResult.value) : null;

  // If it's a settle-all trigger with no explicit amount, keep null
  if (isSettleAll && amountRM === null) {
    amountRM = null;
  }

  // Build "used" set: trigger tokens + amount tokens
  const usedRanges = [];
  if (trigger) usedRanges.push([trigger.start, trigger.end]);
  if (amountResult) usedRanges.push([amountResult.start, amountResult.end]);

  /** @param {number} idx */
  const isUsed = (idx) => usedRanges.some(([s, e]) => idx >= s && idx < e);

  const remaining = tokens.map((t, i) => ({ t, i })).filter(({ i }) => !isUsed(i));

  // Detect honorific
  let honorific = '';
  let nameStart = 0;

  if (remaining.length >= 2) {
    const twoWordH = remaining[0].t + ' ' + remaining[1].t;
    if (HONORIFICS.includes(twoWordH)) {
      honorific = titleCase(twoWordH);
      nameStart = 2;
    }
  }
  if (!honorific && remaining.length >= 1) {
    if (HONORIFICS.includes(remaining[0].t)) {
      honorific = titleCase(remaining[0].t);
      nameStart = 1;
    }
  }

  // Extract customer name (up to 2 words after honorific)
  const VERBS = ['ambil', 'beli', 'hutang', 'pinjam', 'nak', 'minta'];
  const UNITS_WORDS = ['kilo', 'kg', 'tin', 'biji', 'botol', 'liter', 'litre', 'paket', 'pack', 'gelas'];
  const nameTokens = [];
  let pos = nameStart;

  while (pos < remaining.length) {
    const word = remaining[pos].t;
    if (VERBS.includes(word)) { pos++; break; }
    if (MALAY_UNITS[word] !== undefined) break;
    const twoWord = word + ' ' + (remaining[pos + 1]?.t ?? '');
    if (MALAY_TENS[twoWord] !== undefined) break;
    if (!isNaN(Number(word)) && word !== '') break;
    if (UNITS_WORDS.includes(word)) break;
    nameTokens.push(word);
    pos++;
    if (nameTokens.length >= 2) break;
  }

  const nameStr = nameTokens.map(titleCase).join(' ');
  const customer = nameStr
    ? (honorific ? `${honorific} ${nameStr}` : nameStr)
    : (honorific || null);

  return {
    type: 'payment',
    customer: customer || null,
    amountRM,
  };
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParsedEntry
 * @property {string | null} customer
 * @property {string | null} item
 * @property {number | null} qty
 * @property {number | null} amountRM
 * @property {string | null} dueDate   ISO-8601 YYYY-MM-DD
 */

/**
 * Parse a Malay hutang sentence into structured fields.
 * If the sentence is a payment, returns a {@link ParsedPayment} instead.
 *
 * @param {string} input
 * @param {Date} [today]  — injectable for tests; defaults to new Date()
 * @returns {ParsedEntry | ParsedPayment}
 */
export function parse(input, today = new Date()) {
  if (!input || typeof input !== 'string') {
    return { customer: null, item: null, qty: null, amountRM: null, dueDate: null };
  }

  // Quick normalise for trigger detection (same pipeline as full normalise below)
  const quickNorm = input
    .toLowerCase()
    .replace(/(rm\s*\d+)[.,](\d{1,2})/gi, '$1.$2')
    .replace(/[,،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const quickTokens = quickNorm.split(' ');

  if (isPaymentSentence(quickTokens)) {
    return parsePayment(input, today);
  }

  // Normalise: lowercase, preserve decimals in RM amounts, strip other punctuation
  const normalised = input
    .toLowerCase()
    // Protect RM decimals: rm18.50 → rm18_50 (temp), restore after stripping
    .replace(/(rm\s*\d+)[.,](\d{1,2})/gi, '$1.$2')
    // Strip commas/Arabic comma/standalone periods (not already part of rm decimal)
    .replace(/[,،]/g, ' ')
    .replace(/(\D)\.|\.(\D)/g, '$1 $2')  // periods not between digits → space
    .replace(/^\.|\.$/, ' ')             // leading/trailing periods
    // Split digit+unit like "2kilo" / "3kg" into "2 kilo"
    .replace(/(\d)(kilo|kg|tin|biji|botol|liter|litre|paket|pack|gelas)\b/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalised.split(' ');

  // ---- Extract amount ----
  const amountResult = extractAmount(tokens, 0);
  const amountRM = amountResult ? round2(amountResult.value) : null;

  // ---- Extract due date ----
  const dueResult = extractDueDate(tokens, 0, today);
  const dueDate = dueResult ? dueResult.iso : null;

  // ---- Build "used" set to find customer / item ----
  // Tokens consumed by amount and due date are "known", the rest form name+item
  const usedRanges = [];
  if (amountResult) usedRanges.push([amountResult.start, amountResult.end]);
  if (dueResult) usedRanges.push([dueResult.start, dueResult.end]);

  /** @param {number} idx */
  const isUsed = (idx) => usedRanges.some(([s, e]) => idx >= s && idx < e);

  // Remaining tokens (not used by amount/due)
  const remaining = tokens.map((t, i) => ({ t, i })).filter(({ i }) => !isUsed(i));

  // ---- Detect honorific at start ----
  let honorific = '';
  let nameStart = 0;

  // Try two-word honorifics first
  if (remaining.length >= 2) {
    const twoWordH = remaining[0].t + ' ' + remaining[1].t;
    if (HONORIFICS.includes(twoWordH)) {
      honorific = titleCase(twoWordH);
      nameStart = 2;
    }
  }
  // Single-word honorific
  if (!honorific && remaining.length >= 1) {
    if (HONORIFICS.includes(remaining[0].t)) {
      honorific = titleCase(remaining[0].t);
      nameStart = 1;
    }
  }

  // ---- Extract customer name (1–2 words after honorific) ----
  // Skip verbs
  const VERBS = ['ambil', 'beli', 'hutang', 'pinjam', 'nak', 'minta'];
  const UNITS_WORDS = ['kilo', 'kg', 'tin', 'biji', 'botol', 'liter', 'litre', 'paket', 'pack', 'gelas'];

  let nameTokens = [];
  let pos = nameStart;

  while (pos < remaining.length) {
    const word = remaining[pos].t;
    if (VERBS.includes(word)) { pos++; break; }
    if (MALAY_UNITS[word] !== undefined || MALAY_TENS[word.slice(0, word.length)] !== undefined) break;
    if (!isNaN(Number(word))) break;
    if (UNITS_WORDS.includes(word)) break;
    nameTokens.push(word);
    pos++;
    if (nameTokens.length >= 2) break; // max 2 name words after honorific
  }

  // Skip verb if still present
  if (pos < remaining.length && VERBS.includes(remaining[pos].t)) pos++;

  // ---- Extract quantity ----
  let qty = null;
  const qtyResult = parseMalayNumber(remaining.map(r => r.t), pos);
  if (qtyResult !== null) {
    qty = qtyResult.value;
    pos += qtyResult.consumed;
    // Skip unit word
    if (pos < remaining.length && UNITS_WORDS.includes(remaining[pos].t)) pos++;
  }

  // ---- Remaining = item ----
  const itemTokens = remaining.slice(pos).map(r => r.t);
  const item = itemTokens.length > 0 ? itemTokens.join(' ') : null;

  // ---- Build customer name ----
  const nameStr = nameTokens.map(titleCase).join(' ');
  const customer = nameStr
    ? (honorific ? `${honorific} ${nameStr}` : nameStr)
    : (honorific || null);

  return {
    customer: customer || null,
    item: item || null,
    qty,
    amountRM,
    dueDate,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} s
 * @returns {string}
 */
function titleCase(s) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Round to 2 decimal places avoiding floating-point drift.
 * @param {number} n
 * @returns {number}
 */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Format a RM amount as a string, e.g. 18.5 → "RM18.50".
 * @param {number} n
 * @returns {string}
 */
export function formatRM(n) {
  return 'RM' + round2(n).toFixed(2);
}
