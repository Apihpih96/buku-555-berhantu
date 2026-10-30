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
  buildReminder,
  normaliseMsisdn,
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

/**
 * Map of customer name → normalised 60XXXXXXXXX phone number.
 * @type {Record<string, string>}
 */
let phones = {};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, entries: ledger, phones, lang })
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    ledger = Array.isArray(data.entries) ? data.entries : [];
    phones = (data.phones && typeof data.phones === 'object') ? data.phones : {};
    lang = data.lang === 'en' ? 'en' : 'ms';
  } catch {
    ledger = [];
    phones = {};
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

    // Show reminder button on ALL unpaid entries (not just overdue)
    const waBtn = document.createElement('button');
    waBtn.className = 'btn btn-wa';
    waBtn.textContent = T('btnWhatsApp');
    waBtn.setAttribute('aria-label', `${T('btnWhatsApp')} ${entry.customer}`);
    waBtn.addEventListener('click', () => onWhatsApp(entry.customer));
    actions.appendChild(waBtn);

    // "Tukar nombor" link — only shown if a number is already saved
    if (phones[entry.customer]) {
      const tukarBtn = document.createElement('button');
      tukarBtn.className = 'link-tukar';
      tukarBtn.textContent = T('linkTukarNombor');
      tukarBtn.setAttribute('aria-label', `${T('linkTukarNombor')} — ${entry.customer}`);
      tukarBtn.addEventListener('click', () => onTukarNombor(entry.customer));
      actions.appendChild(tukarBtn);
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

/**
 * Handle "Hantar Peringatan" click for a customer.
 * If a phone is already saved, build and open immediately.
 * Otherwise, open the in-app dialog to collect the number.
 *
 * @param {string} customer
 */
function onWhatsApp(customer) {
  const savedPhone = phones[customer];
  if (savedPhone) {
    openWhatsAppReminder(customer, savedPhone);
  } else {
    openPhoneDialog(customer, (msisdn) => {
      openWhatsAppReminder(customer, msisdn);
    });
  }
}

/**
 * "Tukar nombor" — force the dialog even if a number is saved.
 * @param {string} customer
 */
function onTukarNombor(customer) {
  openPhoneDialog(customer, (msisdn) => {
    // After saving new number, open WhatsApp immediately
    openWhatsAppReminder(customer, msisdn);
  });
}

/**
 * Build reminder URL with buildReminder() and open in new tab.
 * @param {string} customer
 * @param {string} rawPhone
 */
function openWhatsAppReminder(customer, rawPhone) {
  const url = buildReminder(ledger, customer, rawPhone, new Date(), lang);
  if (!url) {
    showFeedback(T('noEntries'), 'error');
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function onLangToggle() {
  lang = lang === 'ms' ? 'en' : 'ms';
  saveState();
  renderAll();
}

function onExport() {
  const json = exportJSON(ledger, phones);
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
      const result = importJSON(text, ledger, phones);
      ledger = result.ledger;
      phones = result.phones;
      saveState();
      renderLedger();
    } catch {
      showFeedback(T('errImport'), 'error');
    }
  });
  input.click();
}

// ---------------------------------------------------------------------------
// Phone dialog
// ---------------------------------------------------------------------------

/**
 * Open the in-app phone dialog for a customer.
 * Calls onConfirm(normalisedMsisdn) when the user saves.
 *
 * @param {string}                  customer
 * @param {(msisdn: string) => void} onConfirm
 */
function openPhoneDialog(customer, onConfirm) {
  const dialog = /** @type {HTMLDialogElement} */ ($('phone-dialog'));
  const customerEl = $('phone-dialog-customer');
  const input = /** @type {HTMLInputElement} */ ($('phone-dialog-input'));
  const simpanBtn = $('phone-dialog-simpan');
  const batalBtn = $('phone-dialog-batal');

  // Update dialog text for current language
  $('phone-dialog-title').textContent = T('dialogPhoneTitle');
  $('phone-dialog').setAttribute('aria-label', T('ariaPhoneDialog'));
  input.setAttribute('aria-label', T('ariaPhoneInput'));
  input.placeholder = T('dialogPhonePlaceholder');
  simpanBtn.textContent = T('btnSimpan');
  simpanBtn.setAttribute('aria-label', T('ariaPhoneSimpan'));
  batalBtn.textContent = T('btnBatal');
  batalBtn.setAttribute('aria-label', T('ariaPhoneBatal'));

  customerEl.textContent = customer;

  // Pre-fill with existing number if any (for easy edit)
  input.value = phones[customer] ? phones[customer].replace(/^60/, '0') : '';

  // Remove old listeners to avoid accumulation
  const newSimpan = simpanBtn.cloneNode(true);
  simpanBtn.replaceWith(newSimpan);
  const newBatal = batalBtn.cloneNode(true);
  batalBtn.replaceWith(newBatal);

  $('phone-dialog-simpan').addEventListener('click', () => {
    const raw = $('phone-dialog-input').value.trim();
    if (!raw) {
      $('phone-dialog-input').focus();
      return;
    }
    const normalised = normaliseMsisdn(raw);
    phones[customer] = normalised;
    saveState();
    renderLedger(); // refresh to show/hide Tukar nombor link
    dialog.close();
    onConfirm(normalised);
  });

  $('phone-dialog-batal').addEventListener('click', () => {
    dialog.close();
  });

  // Close on backdrop click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  }, { once: true });

  dialog.showModal();
  // Focus input after modal opens
  requestAnimationFrame(() => $('phone-dialog-input').focus());
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
