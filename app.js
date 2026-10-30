/**
 * @file app.js
 * Main application logic for Buku 555 Berhantu.
 * Wires UI events, localStorage, Web Speech API, and rendering.
 *
 * @module app
 */

import { parse, formatRM } from './parser.js';
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
  buildWhatsAppLink,
} from './ledger.js';
import { t, DEFAULT_LANG } from './i18n.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'buku555.v1';

/** @type {'ms' | 'en'} */
let lang = DEFAULT_LANG;

/** @type {import('./ledger.js').LedgerEntry[]} */
let ledger = [];

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, entries: ledger, lang })
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    ledger = Array.isArray(data.entries) ? data.entries : [];
    lang = data.lang === 'en' ? 'en' : 'ms';
  } catch {
    ledger = [];
    lang = 'ms';
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => document.getElementById(id);

/** @param {string} key @returns {string} */
const T = (key) => t(key, lang);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderAll() {
  renderHeader();
  renderInput();
  renderLedger();
}

function renderHeader() {
  $('app-title').textContent = T('appTitle');
  $('app-subtitle').textContent = T('appSubtitle');
  $('btn-lang').textContent = T('langToggle');
  $('btn-lang').setAttribute('aria-label', T('ariaLangToggle'));
}

function renderInput() {
  $('entry-input').placeholder = T('inputPlaceholder');
  $('entry-input').setAttribute('aria-label', T('inputLabel'));
  $('btn-add').textContent = T('btnAdd');
  $('btn-add').setAttribute('aria-label', T('btnRecord'));

  const micBtn = $('btn-mic');
  if (micBtn) {
    micBtn.textContent = T('btnMic');
    micBtn.setAttribute('aria-label', T('ariaMicBtn'));
  }

  $('btn-export').textContent = T('btnExport');
  $('btn-import').textContent = T('btnImport');
}

function renderLedger() {
  $('section-title').textContent = T('sectionLedger');
  const total = totalOutstanding(ledger);
  $('total-amount').textContent = formatRM(total);
  $('total-label').textContent = T('totalOutstanding');

  const today = new Date();
  const overdue = new Set(overdueEntries(ledger, today).map(e => e.id));
  const byCustomer = entriesByCustomer(ledger);

  const container = $('ledger-list');
  container.innerHTML = '';

  if (byCustomer.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-msg';
    empty.textContent = T('noEntries');
    container.appendChild(empty);
    return;
  }

  for (const [customer, entries] of byCustomer) {
    const section = document.createElement('section');
    section.className = 'customer-section';

    const header = document.createElement('h2');
    header.className = 'customer-name';
    header.textContent = customer;
    section.appendChild(header);

    for (const entry of entries) {
      const card = buildEntryCard(entry, overdue.has(entry.id));
      section.appendChild(card);
    }

    container.appendChild(section);
  }

  // Paid entries (collapsed)
  const paidEntries = ledger.filter(e => e.paid);
  if (paidEntries.length > 0) {
    const details = document.createElement('details');
    details.className = 'paid-section';
    const summary = document.createElement('summary');
    summary.textContent = `${T('paidLabel')} (${paidEntries.length})`;
    details.appendChild(summary);

    for (const entry of paidEntries) {
      const card = buildEntryCard(entry, false);
      card.classList.add('paid');
      details.appendChild(card);
    }
    container.appendChild(details);
  }
}

/**
 * @param {import('./ledger.js').LedgerEntry} entry
 * @param {boolean} isOverdue
 * @returns {HTMLElement}
 */
function buildEntryCard(entry, isOverdue) {
  const card = document.createElement('article');
  card.className = 'entry-card' + (isOverdue ? ' overdue' : '') + (entry.paid ? ' paid' : '');
  card.setAttribute('aria-label', T('ariaEntry'));
  card.dataset.id = entry.id;

  const info = document.createElement('div');
  info.className = 'entry-info';

  const itemEl = document.createElement('span');
  itemEl.className = 'entry-item';
  itemEl.textContent = entry.item || '—';
  info.appendChild(itemEl);

  if (entry.qty) {
    const qtyEl = document.createElement('span');
    qtyEl.className = 'entry-qty';
    qtyEl.textContent = `×${entry.qty}`;
    info.appendChild(qtyEl);
  }

  const amtEl = document.createElement('span');
  amtEl.className = 'entry-amount';
  amtEl.textContent = formatRM(entry.amountRM);
  info.appendChild(amtEl);

  if (isOverdue) {
    const ghost = document.createElement('span');
    ghost.className = 'ghost-icon';
    ghost.setAttribute('aria-label', T('ariaGhost'));
    ghost.setAttribute('role', 'img');
    ghost.textContent = '👻';
    info.appendChild(ghost);
    const overdueLabel = document.createElement('span');
    overdueLabel.className = 'overdue-label';
    overdueLabel.textContent = T('labelOverdue');
    info.appendChild(overdueLabel);
  }

  if (entry.dueDate) {
    const dueEl = document.createElement('div');
    dueEl.className = 'entry-due';
    dueEl.textContent = `${T('labelDue')}: ${entry.dueDate}`;
    info.appendChild(dueEl);
  }

  card.appendChild(info);

  if (!entry.paid) {
    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const payBtn = document.createElement('button');
    payBtn.className = 'btn btn-pay';
    payBtn.textContent = T('btnPay');
    payBtn.setAttribute('aria-label', `${T('btnPay')} — ${entry.customer} ${entry.item}`);
    payBtn.addEventListener('click', () => onMarkPaid(entry.id));
    actions.appendChild(payBtn);

    if (isOverdue) {
      const waBtn = document.createElement('button');
      waBtn.className = 'btn btn-wa';
      waBtn.textContent = T('btnWhatsApp');
      waBtn.setAttribute('aria-label', `${T('btnWhatsApp')} ${entry.customer}`);
      waBtn.addEventListener('click', () => onWhatsApp(entry));
      actions.appendChild(waBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-del';
    delBtn.textContent = T('btnDelete');
    delBtn.setAttribute('aria-label', `${T('btnDelete')} — ${entry.customer}`);
    delBtn.addEventListener('click', () => onDelete(entry.id));
    actions.appendChild(delBtn);

    card.appendChild(actions);
  }

  return card;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onAddEntry() {
  const input = $('entry-input');
  const raw = input.value.trim();
  if (!raw) return;

  const parsed = parse(raw);

  if (!parsed.customer && !parsed.amountRM) {
    showFeedback(T('errParseBoth'), 'error');
    return;
  }
  if (!parsed.customer) {
    showFeedback(T('errParseCustomer'), 'error');
    return;
  }
  if (parsed.amountRM === null) {
    showFeedback(T('errParseAmount'), 'error');
    return;
  }

  const entry = createEntry({
    customer: parsed.customer,
    item: parsed.item ?? '—',
    qty: parsed.qty,
    amountRM: parsed.amountRM,
    dueDate: parsed.dueDate,
    raw,
  });

  ledger = addEntry(ledger, entry);
  saveState();
  renderLedger();
  input.value = '';
  showFeedback(T('successAdd'), 'success');
}

/** @param {string} id */
function onMarkPaid(id) {
  ledger = markPaid(ledger, id);
  saveState();
  renderLedger();
  showFeedback(T('exorcised'), 'success');
}

/** @param {string} id */
function onDelete(id) {
  if (!confirm(T('confirmDelete'))) return;
  ledger = deleteEntry(ledger, id);
  saveState();
  renderLedger();
}

/** @param {import('./ledger.js').LedgerEntry} entry */
function onWhatsApp(entry) {
  // Prompt for phone number if not stored
  const phone = prompt(`Nombor WhatsApp ${entry.customer}:`);
  if (!phone) return;
  const url = buildWhatsAppLink(phone, entry.customer, entry.item, entry.amountRM, entry.dueDate);
  window.open(url, '_blank', 'noopener');
}

function onLangToggle() {
  lang = lang === 'ms' ? 'en' : 'ms';
  saveState();
  renderAll();
}

function onExport() {
  const json = exportJSON(ledger);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `buku555-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function onImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm(T('confirmImport'))) return;
      ledger = importJSON(text, ledger);
      saveState();
      renderLedger();
    } catch {
      showFeedback(T('errImport'), 'error');
    }
  });
  input.click();
}

// ---------------------------------------------------------------------------
// Web Speech API
// ---------------------------------------------------------------------------

let recognition = null;
let micActive = false;

function setupSpeech() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const micBtn = $('btn-mic');
    if (micBtn) micBtn.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ms-MY';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    $('entry-input').value = transcript;
  };

  recognition.onend = () => {
    micActive = false;
    const micBtn = $('btn-mic');
    if (micBtn) {
      micBtn.textContent = T('btnMic');
      micBtn.classList.remove('recording');
    }
  };

  recognition.onerror = (event) => {
    console.warn('[speech]', event.error);
    micActive = false;
  };
}

function onMicToggle() {
  if (!recognition) return;
  const micBtn = $('btn-mic');
  if (micActive) {
    recognition.stop();
    micActive = false;
    micBtn.textContent = T('btnMic');
    micBtn.classList.remove('recording');
  } else {
    recognition.start();
    micActive = true;
    micBtn.textContent = T('btnMicStop');
    micBtn.classList.add('recording');
  }
}

// ---------------------------------------------------------------------------
// Feedback toast
// ---------------------------------------------------------------------------

/** @param {string} msg @param {'success'|'error'} type */
function showFeedback(msg, type = 'success') {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function init() {
  loadState();
  setupSpeech();

  $('btn-add').addEventListener('click', onAddEntry);
  $('entry-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAddEntry();
  });

  const micBtn = $('btn-mic');
  if (micBtn) micBtn.addEventListener('click', onMicToggle);

  $('btn-lang').addEventListener('click', onLangToggle);
  $('btn-export').addEventListener('click', onExport);
  $('btn-import').addEventListener('click', onImport);

  renderAll();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
