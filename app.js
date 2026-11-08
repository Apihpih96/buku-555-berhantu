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
  updateEntry,
  totalOutstanding,
  overdueEntries,
  entriesByCustomer,
  exportJSON,
  importJSON,
  buildReminder,
  buildStatement,
  normaliseMsisdn,
  demoEntries,
  topDebtors,
  applyPayment,
  migrateStorage,
  customerPayments,
  customerTotal,
  daysSinceOldestUnpaid,
  formatLocalDate,
  mergeSplitEntries,
} from './ledger.js';
import { t, DEFAULT_LANG } from './i18n.js';

/** Current search query (trimmed, lowercase after honorific strip). */
let searchQuery = '';

/**
 * Strip common Malay honorifics from the start of a name and lowercase it.
 * @param {string} name
 * @returns {string}
 */
function stripHonorifics(name) {
  return name
    .replace(/^(Pak Cik|Mak Cik|Abang|Encik|Puan|Kak|Cik)\s+/i, '')
    .toLowerCase()
    .trim();
}

/**
 * Returns true when customerName matches query after stripping honorifics.
 * Empty query always matches.
 * @param {string} customerName
 * @param {string} query
 * @returns {boolean}
 */
function matchesSearch(customerName, query) {
  if (!query) return true;
  const q = stripHonorifics(query);
  const n = stripHonorifics(customerName);
  return n.includes(q);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'buku555.v1';

/** @type {'ms' | 'en'} */
let lang = DEFAULT_LANG;

/** @type {import('./ledger.js').LedgerEntry[]} */
let ledger = [];

/**
 * Payment records.
 * @type {import('./ledger.js').PaymentRecord[]}
 */
let payments = [];

/**
 * Map of customer name → normalised 60XXXXXXXXX phone number.
 * @type {Record<string, string>}
 */
let phones = {};

/**
 * Deferred beforeinstallprompt event, held until the user taps the install button.
 * @type {Event|null}
 */
let deferredInstallPrompt = null;

// ---------------------------------------------------------------------------
// Undo history (in-memory only — never persisted to localStorage)
// ---------------------------------------------------------------------------

const UNDO_MAX = 20;
const UNDO_TIMEOUT_MS = 8000;

/**
 * @typedef {Object} Snapshot
 * @property {import('./ledger.js').LedgerEntry[]}  ledger
 * @property {import('./ledger.js').PaymentRecord[]} payments
 * @property {Record<string, string>}               phones
 * @property {string}                               label  — i18n key
 */

/** @type {Snapshot[]} */
let undoHistory = [];

/** @type {ReturnType<typeof setTimeout> | null} */
let undoTimer = null;

/** id of the entry being edited in the edit dialog */
let editingId = null;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, entries: ledger, payments, phones, lang })
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const migrated = migrateStorage(data);
    ledger = migrated.entries;
    payments = migrated.payments;
    phones = migrated.phones;
    lang = migrated.lang;
  } catch {
    ledger = [];
    payments = [];
    phones = {};
    lang = 'ms';
  }
}

// ---------------------------------------------------------------------------
// Undo helpers
// ---------------------------------------------------------------------------

/**
 * Capture the current state as a snapshot and push it to the undo history.
 * Caps the stack at UNDO_MAX entries (oldest discarded).
 *
 * @param {string} label — i18n key for the undo bar message
 */
function pushUndo(label) {
  undoHistory.push({
    ledger:   ledger.slice(),
    payments: payments.slice(),
    phones:   { ...phones },
    label,
  });
  if (undoHistory.length > UNDO_MAX) undoHistory.shift();
}

/**
 * Pop the most recent snapshot and restore all state from it.
 */
function doUndo() {
  const snap = undoHistory.pop();
  if (!snap) return;
  ledger   = snap.ledger;
  payments = snap.payments;
  phones   = snap.phones;
  saveState();
  renderAll();
  hideUndoBar();
  showFeedback(T('toastUndoDone'), 'success');
}

/**
 * Show the undo bar with the given label for UNDO_TIMEOUT_MS milliseconds.
 * @param {string} label — human-readable text to display
 */
function showUndoBar(label) {
  clearTimeout(undoTimer);
  $('undo-bar-label').textContent = label;
  $('undo-bar').hidden = false;
  $('btn-undo').setAttribute('aria-label', T('ariaUndo'));
  $('btn-undo').textContent = T('btnUndo');
  undoTimer = setTimeout(hideUndoBar, UNDO_TIMEOUT_MS);
}

/** Hide the undo bar and cancel its timer. */
function hideUndoBar() {
  clearTimeout(undoTimer);
  undoTimer = null;
  $('undo-bar').hidden = true;
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
  renderTopDebtors();
  renderLedger();
  renderSearchBox();
}

function renderHeader() {
  $('app-title').textContent = T('appTitle');
  $('app-subtitle').textContent = T('appSubtitle');
  $('btn-lang').textContent = T('langToggle');
  $('btn-lang').setAttribute('aria-label', T('ariaLangToggle'));

  // Update install button label when visible
  const installBtn = $('btn-install');
  if (installBtn) {
    const installLabel = lang === 'en' ? '📲 Install app' : '📲 Pasang app';
    installBtn.textContent = installLabel;
    installBtn.setAttribute('aria-label', installLabel);
  }
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
  if ($('btn-demo')) $('btn-demo').textContent = T('btnDemo');
  $('btn-import').textContent = T('btnImport');
}

/**
 * Update search box placeholder/aria label for current language.
 */
function renderSearchBox() {
  const searchInput = $('customer-search');
  if (!searchInput) return;
  searchInput.placeholder = T('searchPlaceholder');
  searchInput.setAttribute('aria-label', T('searchLabel'));
}

/**
 * Render the top-debtors card above the ledger.
 * Hidden when no unpaid entries exist.
 */
function renderTopDebtors() {
  const card = $('top-debtors');
  if (!card) return;

  const today = new Date();
  const debtors = topDebtors(ledger, today, 3);

  if (debtors.length === 0) {
    card.hidden = true;
    return;
  }

  // Hide top debtors card when a search query is active
  if (searchQuery) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  $('top-debtors-title').textContent = T('topDebtorsTitle');
  card.setAttribute('aria-label', T('ariaTopDebtors'));

  const list = $('top-debtors-list');
  list.innerHTML = '';

  for (const debtor of debtors) {
    const li = document.createElement('li');
    li.className = 'top-debtor-row' + (debtor.daysOverdue > 0 ? ' overdue' : '');

    const nameEl = document.createElement('span');
    nameEl.className = 'top-debtor-name';
    nameEl.textContent = debtor.customer;

    const amtEl = document.createElement('span');
    amtEl.className = 'top-debtor-amount';
    amtEl.textContent = `RM${debtor.totalOwed.toFixed(2)}`;

    const statusEl = document.createElement('span');
    statusEl.className = 'top-debtor-status';
    if (debtor.daysOverdue > 0) {
      if (lang === 'en') {
        statusEl.textContent = `${debtor.daysOverdue} ${T('topDebtorsDaysOverdue')}`;
      } else {
        statusEl.textContent = `${T('topDebtorsDaysOverdue')} ${debtor.daysOverdue} ${T('topDebtorsDaysSuffix')}`;
      }
      statusEl.classList.add('overdue-status');
    } else {
      statusEl.textContent = T('topDebtorsNotOverdue');
    }

    li.appendChild(nameEl);
    li.appendChild(amtEl);
    li.appendChild(statusEl);
    list.appendChild(li);
  }
}

function renderLedger() {
  $('section-title').textContent = T('sectionLedger');
  const total = totalOutstanding(ledger);
  $('total-amount').textContent = formatRM(total);
  $('total-label').textContent = T('totalOutstanding');

  const today = new Date();
  const overdue = new Set(overdueEntries(ledger, today).map(e => e.id));
  const byCustomer = entriesByCustomer(ledger);

  // Apply search filter
  const filteredCustomers = searchQuery
    ? [...byCustomer.entries()].filter(([name]) => matchesSearch(name, searchQuery))
    : [...byCustomer.entries()];

  const container = $('ledger-list');
  container.innerHTML = '';

  if (filteredCustomers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-msg';
    empty.textContent = searchQuery ? T('noSearchMatch') : T('noEntries');
    container.appendChild(empty);
    return;
  }

  for (const [customer, entries] of filteredCustomers) {
    const section = document.createElement('section');
    section.className = 'customer-section';

    // Make the customer name a tappable button to open the detail page
    const header = document.createElement('button');
    header.className = 'customer-name customer-name-btn';
    header.type = 'button';
    header.setAttribute('aria-label', `${customer} — ${T('customerPageTitle')}`);
    header.textContent = customer;
    header.addEventListener('click', () => openCustomerPage(customer));
    section.appendChild(header);

    for (const entry of entries) {
      const card = buildEntryCard(entry, overdue.has(entry.id));
      section.appendChild(card);
    }

    // Payment history for this customer
    const custPayments = customerPayments(payments, customer);
    if (custPayments.length > 0) {
      const details = document.createElement('details');
      details.className = 'payment-history';
      details.setAttribute('aria-label', T('ariaPaymentHistory'));

      const summary = document.createElement('summary');
      summary.className = 'payment-history-summary';
      summary.textContent = `${T('labelPaymentHistory')} (${custPayments.length})`;
      details.appendChild(summary);

      const ul = document.createElement('ul');
      ul.className = 'payment-history-list';
      for (const p of custPayments) {
        const li = document.createElement('li');
        li.className = 'payment-history-item';
        const dateStr = p.paidAt ? p.paidAt.slice(0, 10) : '';
        li.textContent = `${formatRM(p.amountRM)}  —  ${dateStr}`;
        ul.appendChild(li);
      }
      details.appendChild(ul);
      section.appendChild(details);
    }

    container.appendChild(section);
  }

  // Paid entries (collapsed) — hide when a search query is active
  if (!searchQuery) {
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
    payBtn.addEventListener('click', (e) => { e.stopPropagation(); onMarkPaid(entry.id); });
    actions.appendChild(payBtn);

    // Show reminder button on ALL unpaid entries (not just overdue)
    const waBtn = document.createElement('button');
    waBtn.className = 'btn btn-wa';
    waBtn.textContent = T('btnWhatsApp');
    waBtn.setAttribute('aria-label', `${T('btnWhatsApp')} ${entry.customer}`);
    waBtn.addEventListener('click', (e) => { e.stopPropagation(); onWhatsApp(entry.customer); });
    actions.appendChild(waBtn);

    // "Tukar nombor" link — only shown if a number is already saved
    if (phones[entry.customer]) {
      const tukarBtn = document.createElement('button');
      tukarBtn.className = 'link-tukar';
      tukarBtn.textContent = T('linkTukarNombor');
      tukarBtn.setAttribute('aria-label', `${T('linkTukarNombor')} — ${entry.customer}`);
      tukarBtn.addEventListener('click', (e) => { e.stopPropagation(); onTukarNombor(entry.customer); });
      actions.appendChild(tukarBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-del';
    delBtn.textContent = T('btnDelete');
    delBtn.setAttribute('aria-label', `${T('btnDelete')} — ${entry.customer}`);
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(entry.id); });
    actions.appendChild(delBtn);

    card.appendChild(actions);

    // Tap the card body (not a button) to open the edit dialog
    card.addEventListener('click', (e) => {
      // Ignore clicks that landed on a button or the actions area
      if (/** @type {Element} */ (e.target).closest('button, .entry-actions, .link-tukar')) return;
      onEditEntry(entry.id);
    });
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

  // Route payment sentences
  if (parsed.type === 'payment') {
    if (!parsed.customer) {
      showFeedback(T('errParseCustomer'), 'error');
      return;
    }
    onApplyPayment(parsed.customer, parsed.amountRM, raw);
    input.value = '';
    return;
  }

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

  pushUndo('undoLabelAdd');
  ledger = addEntry(ledger, entry);
  saveState();
  renderLedger();
  input.value = '';
  showFeedback(T('successAdd'), 'success');
  showUndoBar(T('undoLabelAdd'));
}

/**
 * Apply a payment for a customer (called when parser returns type: 'payment').
 *
 * @param {string}      customer
 * @param {number|null} amountRM  — null = settle all
 * @param {string}      raw
 */
function onApplyPayment(customer, amountRM, raw) {
  const balanceBefore = customerTotal(ledger, customer);
  const result = applyPayment(ledger, payments, customer, amountRM, raw);

  if (result.warning === 'overpayment') {
    const balance = customerTotal(ledger, customer);
    const msg = T('errOverpayment').replace('{balance}', formatRM(balance));
    showFeedback(msg, 'error');
    return;
  }
  if (result.warning === 'no_debt') {
    showFeedback(T('errNoDebt'), 'error');
    return;
  }

  pushUndo('undoLabelPayment');
  ledger = result.ledger;
  payments = result.payments;
  saveState();
  renderLedger();

  // Build feedback message
  const appliedAmount = amountRM ?? balanceBefore;
  const msg = T('successPayment')
    .replace('{amount}', formatRM(appliedAmount))
    .replace('{customer}', customer);
  showFeedback(msg, 'success');
  showUndoBar(T('undoLabelPayment'));
}

/** @param {string} id */
function onMarkPaid(id) {
  pushUndo('undoLabelPaid');
  ledger = markPaid(ledger, id);
  saveState();
  renderLedger();
  showFeedback(T('exorcised'), 'success');
  showUndoBar(T('undoLabelPaid'));
}

/** @param {string} id */
function onDelete(id) {
  openDeleteDialog(id);
}

/**
 * Open the in-app delete confirmation dialog.
 * @param {string} id
 */
function openDeleteDialog(id) {
  const dialog = /** @type {HTMLDialogElement} */ ($('delete-dialog'));
  const msgEl  = $('delete-dialog-msg');
  const confirmBtn = $('delete-dialog-confirm');
  const batalBtn   = $('delete-dialog-batal');

  // i18n
  msgEl.textContent = T('dialogDeleteMsg');
  confirmBtn.textContent = T('btnConfirmDelete');
  confirmBtn.setAttribute('aria-label', T('ariaConfirmDelete'));
  batalBtn.textContent = T('btnBatal');
  batalBtn.setAttribute('aria-label', T('ariaPhoneBatal'));
  dialog.setAttribute('aria-label', T('ariaDeleteDialog'));

  // Clone buttons to remove stale listeners
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  const newBatal = batalBtn.cloneNode(true);
  batalBtn.replaceWith(newBatal);

  $('delete-dialog-confirm').addEventListener('click', () => {
    dialog.close();
    doDelete(id);
  });
  $('delete-dialog-batal').addEventListener('click', () => {
    dialog.close();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  }, { once: true });

  dialog.showModal();
}

/**
 * Execute deletion after confirmation.
 * @param {string} id
 */
function doDelete(id) {
  pushUndo('undoLabelDelete');
  ledger = deleteEntry(ledger, id);
  saveState();
  renderLedger();
  showUndoBar(T('undoLabelDelete'));
}

// ---------------------------------------------------------------------------
// Edit entry dialog
// ---------------------------------------------------------------------------

/**
 * Open the edit dialog pre-filled with the entry's current values.
 * @param {string} id
 */
function onEditEntry(id) {
  const entry = ledger.find(e => e.id === id);
  if (!entry) return;

  editingId = id;

  const dialog = /** @type {HTMLDialogElement} */ ($('edit-dialog'));

  // i18n labels
  $('edit-dialog-title').textContent = T('dialogEditTitle');
  $('edit-label-customer').textContent = T('dialogEditLabelCustomer');
  $('edit-label-item').textContent = T('dialogEditLabelItem');
  $('edit-label-amount').textContent = T('dialogEditLabelAmount');
  $('edit-label-due').textContent = T('dialogEditLabelDue');
  $('edit-dialog-batal').textContent = T('btnBatal');
  $('edit-dialog-simpan').textContent = T('btnSimpan');

  // Pre-fill values
  /** @type {HTMLInputElement} */($('edit-customer')).value = entry.customer ?? '';
  /** @type {HTMLInputElement} */($('edit-item')).value = entry.item ?? '';
  /** @type {HTMLInputElement} */($('edit-amount')).value = entry.amountRM != null ? String(entry.amountRM) : '';
  /** @type {HTMLInputElement} */($('edit-due')).value = entry.dueDate ?? '';

  // Hide any previous error
  const errEl = $('edit-dialog-error');
  errEl.textContent = '';
  errEl.hidden = true;

  dialog.showModal();
  requestAnimationFrame(() => /** @type {HTMLInputElement} */($('edit-customer')).focus());
}

/**
 * Validate and apply edit when Simpan is tapped.
 */
function onConfirmEdit() {
  const customer = /** @type {HTMLInputElement} */($('edit-customer')).value.trim();
  const item     = /** @type {HTMLInputElement} */($('edit-item')).value.trim() || '—';
  const amountRM = parseFloat(/** @type {HTMLInputElement} */($('edit-amount')).value);
  const dueDate  = /** @type {HTMLInputElement} */($('edit-due')).value.trim() || null;

  const errEl = $('edit-dialog-error');

  if (!customer) {
    errEl.textContent = T('errEditCustomer');
    errEl.hidden = false;
    $('edit-customer').focus();
    return;
  }
  if (isNaN(amountRM) || amountRM <= 0) {
    errEl.textContent = T('errEditAmount');
    errEl.hidden = false;
    $('edit-amount').focus();
    return;
  }

  errEl.hidden = true;

  const dialog = /** @type {HTMLDialogElement} */ ($('edit-dialog'));

  pushUndo('undoLabelEdit');
  ledger = updateEntry(ledger, editingId, { customer, item, amountRM, dueDate, raw: '' });
  editingId = null;
  saveState();
  renderAll();
  dialog.close();
  showFeedback(T('successEdit'), 'success');
  showUndoBar(T('undoLabelEdit'));
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
  const json = exportJSON(ledger, phones, payments);
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
      const result = importJSON(text, ledger, phones, payments);
      ledger = result.ledger;
      phones = result.phones;
      payments = result.payments;
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
// Customer Page
// ---------------------------------------------------------------------------

/** @type {string|null} Currently displayed customer name in the page panel */
let activeCustomer = null;

/**
 * Open the customer detail page for a given customer.
 * @param {string} customer
 */
function openCustomerPage(customer) {
  // Don't open if no entries at all
  const allEntries = ledger.filter(e => e.customer === customer);
  if (allEntries.length === 0) return;

  activeCustomer = customer;
  renderCustomerPage(customer);

  // Show customer page, hide main content
  $('customer-page').hidden = false;
  $('app-main').hidden = true;
  $('app-footer').hidden = true;
  $('undo-bar').hidden = true;
}

/**
 * Close the customer detail page and return to main view.
 */
function closeCustomerPage() {
  activeCustomer = null;
  $('customer-page').hidden = true;
  $('app-main').hidden = false;
  $('app-footer').hidden = false;
  // Bring the undo bar back if an undo is still available
  if (undoHistory.length > 0 && undoTimer) $('undo-bar').hidden = false;
}

/**
 * Render the customer statement page content for the given customer.
 * @param {string} customer
 */
function renderCustomerPage(customer) {
  // Update i18n labels
  $('customer-page-title').textContent = T('customerPageTitle');
  $('customer-page').setAttribute('aria-label', T('ariaCustomerPage'));
  $('btn-tutup').textContent = T('btnTutup');
  $('btn-tutup').setAttribute('aria-label', T('ariaBtnTutup'));
  $('btn-hantar-penyata').textContent = T('btnHantarPenyata');
  $('btn-hantar-penyata').setAttribute('aria-label', T('ariaBtnHantarPenyata'));

  // Customer name
  $('customer-page-name').textContent = customer;

  // Meta: total owed and days since oldest unpaid
  const today = new Date();
  const total = customerTotal(ledger, customer);
  const days  = daysSinceOldestUnpaid(ledger, customer, today);

  $('customer-total-owed').textContent =
    `${T('labelTotalOwed')}: RM${total.toFixed(2)}`;

  if (days > 0) {
    $('customer-days-owed').textContent =
      lang === 'en'
        ? `${T('labelDaysOwed')}: ${days} ${days === 1 ? 'day' : 'days'}`
        : `${T('labelDaysOwed')}: ${days} hari`;
  } else {
    $('customer-days-owed').textContent = '';
  }

  // Show/hide Hantar Penyata button
  const allEntries = ledger.filter(e => e.customer === customer);
  $('btn-hantar-penyata').disabled = allEntries.length === 0;

  // Build the chronological list
  const listEl = $('customer-page-list');
  listEl.innerHTML = '';

  // All entries sorted by createdAt
  const sortedEntries = allEntries
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // All payments sorted by paidAt
  const custPmts = customerPayments(payments, customer)
    .slice()
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));

  // Interleave entries and payments chronologically
  // We'll render entries first, then payment records separately
  // (interleaved by date would be complex; use simple two-section approach)

  // Entries section
  for (const e of mergeSplitEntries(sortedEntries)) {
    const fullyPaid = e.unpaidRM === 0;
    const row = document.createElement('div');
    row.className = 'customer-stmt-row' + (fullyPaid ? ' paid' : ' unpaid');
    row.setAttribute('role', 'listitem');

    const dateEl = document.createElement('span');
    dateEl.className = 'stmt-date';
    dateEl.textContent = formatLocalDate(e.createdAt.slice(0, 10), lang);

    const itemEl = document.createElement('span');
    itemEl.className = 'stmt-item';
    itemEl.textContent = e.qty ? `${e.item} ×${e.qty}` : e.item;

    const amtEl = document.createElement('span');
    amtEl.className = 'stmt-amount';
    amtEl.textContent = `RM${e.totalRM.toFixed(2)}`;

    const statusEl = document.createElement('span');
    statusEl.className = 'stmt-status';
    if (fullyPaid) {
      const paidDate = e.lastPaidAt ? formatLocalDate(e.lastPaidAt.slice(0, 10), lang) : '';
      statusEl.textContent = paidDate
        ? `${T('stmtPaid')} (${paidDate})`
        : T('stmtPaid');
      statusEl.classList.add('status-paid');
    } else if (e.unpaidRM < e.totalRM) {
      statusEl.textContent = `${T('stmtUnpaid')} (${T('labelBalance')} ${formatRM(e.unpaidRM)})`;
      statusEl.classList.add('status-unpaid');
    } else {
      statusEl.textContent = T('stmtUnpaid');
      statusEl.classList.add('status-unpaid');
    }

    if (e.dueDate) {
      const dueEl = document.createElement('span');
      dueEl.className = 'stmt-due';
      dueEl.textContent = `${T('labelDue')}: ${formatLocalDate(e.dueDate, lang)}`;
      row.append(dateEl, itemEl, amtEl, dueEl, statusEl);
    } else {
      row.append(dateEl, itemEl, amtEl, statusEl);
    }

    listEl.appendChild(row);
  }

  // Payment records section
  if (custPmts.length > 0) {
    const pmtHeader = document.createElement('div');
    pmtHeader.className = 'stmt-section-header';
    pmtHeader.textContent = T('labelPaymentHistory');
    listEl.appendChild(pmtHeader);

    for (const p of custPmts) {
      const row = document.createElement('div');
      row.className = 'customer-stmt-row payment';
      row.setAttribute('role', 'listitem');

      const dateEl = document.createElement('span');
      dateEl.className = 'stmt-date';
      dateEl.textContent = formatLocalDate(p.paidAt.slice(0, 10), lang);

      const labelEl = document.createElement('span');
      labelEl.className = 'stmt-item';
      labelEl.textContent = T('stmtPayment');

      const amtEl = document.createElement('span');
      amtEl.className = 'stmt-amount';
      amtEl.textContent = `RM${p.amountRM.toFixed(2)}`;

      row.append(dateEl, labelEl, amtEl);
      listEl.appendChild(row);
    }
  }

  // Summary at the bottom
  const summaryEl = document.createElement('div');
  summaryEl.className = 'stmt-summary';
  if (total > 0) {
    summaryEl.textContent = `${T('stmtBalance')}: RM${total.toFixed(2)}`;
    summaryEl.classList.add('stmt-balance-owed');
  } else {
    summaryEl.textContent = T('stmtNoBalance');
    summaryEl.classList.add('stmt-balance-clear');
  }
  listEl.appendChild(summaryEl);
}

/**
 * Handle "Hantar Penyata" button on the customer page.
 * Reuses the same phone-dialog flow as onWhatsApp.
 */
function onHantarPenyata() {
  if (!activeCustomer) return;
  const customer = activeCustomer;
  const savedPhone = phones[customer];
  if (savedPhone) {
    openStatementReminder(customer, savedPhone);
  } else {
    openPhoneDialog(customer, (msisdn) => {
      openStatementReminder(customer, msisdn);
    });
  }
}

/**
 * Build the statement URL and open it in WhatsApp.
 * @param {string} customer
 * @param {string} rawPhone
 */
function openStatementReminder(customer, rawPhone) {
  const { url } = buildStatement(ledger, payments, customer, rawPhone, new Date(), lang);
  if (!url) {
    showFeedback(T('noEntries'), 'error');
    return;
  }
  window.open(url, '_blank', 'noopener');
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
  if ($('btn-demo')) $('btn-demo').addEventListener('click', () => onLoadDemo(true));

  // ---- Undo bar ----
  $('btn-undo').addEventListener('click', doUndo);

  // ---- Customer search ----
  const searchInput = $('customer-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      renderTopDebtors();
      renderLedger();
    });
  }

  // ---- Customer page ----
  $('btn-tutup').addEventListener('click', closeCustomerPage);
  $('btn-hantar-penyata').addEventListener('click', onHantarPenyata);

  // ---- Edit dialog (wired once; onEditEntry fills values before showModal) ----
  $('edit-dialog-simpan').addEventListener('click', onConfirmEdit);
  $('edit-dialog-batal').addEventListener('click', () => {
    /** @type {HTMLDialogElement} */($('edit-dialog')).close();
  });
  $('edit-dialog').addEventListener('click', (e) => {
    if (e.target === $('edit-dialog')) /** @type {HTMLDialogElement} */($('edit-dialog')).close();
  });

  // ---- PWA: service worker registration ----
  if ('serviceWorker' in navigator) {
    // Use relative path so it works under /buku-555-berhantu/ on GitHub Pages
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[sw] Registration failed:', err);
    });
  }

  // ---- PWA: install button ----
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = $('btn-install');
    if (installBtn) {
      installBtn.hidden = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const installBtn = $('btn-install');
    if (installBtn) {
      installBtn.hidden = true;
    }
  });

  const installBtn = $('btn-install');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.hidden = true;
    });
  }

  if (new URLSearchParams(location.search).has('demo')) onLoadDemo(false);

  renderAll();
}

/**
 * Load the sample warung ledger (dates relative to today).
 * @param {boolean} ask — confirm before replacing a non-empty ledger
 */
function onLoadDemo(ask) {
  if (ask && ledger.length > 0 && !confirm(T('confirmDemo'))) return;
  const demo = demoEntries(new Date());
  pushUndo('undoLabelDemo');
  ledger   = demo.entries;
  payments = demo.payments;
  phones   = {};
  saveState();
  renderAll();
  showFeedback(T('toastDemo'));
  showUndoBar(T('undoLabelDemo'));
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
