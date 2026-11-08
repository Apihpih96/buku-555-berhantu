/**
 * @file i18n.js
 * Internationalisation strings for Buku 555 Berhantu.
 * Supports 'ms' (Bahasa Melayu, default) and 'en' (English).
 *
 * @module i18n
 */

/** @type {'ms' | 'en'} */
export const DEFAULT_LANG = 'ms';

/**
 * @type {Record<string, Record<'ms' | 'en', string>>}
 */
const STRINGS = {
  // App shell
  appTitle:          { ms: 'Buku 555 Berhantu 👻',         en: 'Buku 555 Haunted 👻' },
  appSubtitle:       { ms: 'Buku Hutang Digital',           en: 'Digital Debt Ledger' },
  langToggle:        { ms: 'EN',                            en: 'MS' },

  // Input area
  inputPlaceholder:  { ms: 'Contoh: Kak Ros ambil 2 kilo kembung RM18, bayar Jumaat', en: 'e.g. Kak Ros took 2kg kembung RM18, pay Friday' },
  inputLabel:        { ms: 'Masukkan hutang baru',          en: 'Enter new debt entry' },
  btnRecord:         { ms: 'Rakam',                         en: 'Record' },
  btnMic:            { ms: '🎙️ Sebut',                      en: '🎙️ Speak' },
  btnMicStop:        { ms: '⏹ Berhenti',                    en: '⏹ Stop' },
  btnAdd:            { ms: '✚ Tambah',                      en: '✚ Add' },

  // Ledger
  sectionLedger:     { ms: 'Senarai Hutang',                en: 'Outstanding Debts' },
  totalOutstanding:  { ms: 'Jumlah Tertunggak',             en: 'Total Outstanding' },
  noEntries:         { ms: 'Tiada hutang. Alhamdulillah! 🎉', en: 'No debts. Alhamdulillah! 🎉' },
  labelItem:         { ms: 'Barang',                        en: 'Item' },
  labelQty:          { ms: 'Kuantiti',                      en: 'Qty' },
  labelAmount:       { ms: 'Jumlah',                        en: 'Amount' },
  labelDue:          { ms: 'Tarikh Bayar',                  en: 'Due Date' },
  labelNoDue:        { ms: 'Tiada tarikh',                  en: 'No date' },
  labelOverdue:      { ms: '⚠️ Tertunggak',                 en: '⚠️ Overdue' },

  // Actions
  btnPay:            { ms: '✓ Bayar',                       en: '✓ Mark Paid' },
  btnWhatsApp:       { ms: '📲 Hantar Peringatan',          en: '📲 Send Reminder' },
  btnDelete:         { ms: '🗑 Padam',                       en: '🗑 Delete' },
  btnExport:         { ms: '📤 Eksport',                    en: '📤 Export' },
  btnDemo:           { ms: '👻 Cuba Demo',                 en: '👻 Try Demo' },
  confirmDemo:       { ms: 'Ganti buku sekarang dengan data demo?', en: 'Replace your current book with demo data?' },
  toastDemo:         { ms: 'Data demo dimuatkan. Hantu dah sampai 👻', en: 'Demo data loaded. The ghosts have arrived 👻' },
  btnImport:         { ms: '📥 Import',                     en: '📥 Import' },

  // Ghost / paid
  ghostLabel:        { ms: 'Hantu hutang',                  en: 'Debt ghost' },
  paidLabel:         { ms: '✓ Dah bayar',                   en: '✓ Paid' },
  exorcised:         { ms: 'Hantu telah dihalau! 👻✨',      en: 'Ghost exorcised! 👻✨' },

  // Errors / feedback
  errParseCustomer:  { ms: 'Sila nyatakan nama pelanggan.',  en: 'Please include the customer name.' },
  errParseAmount:    { ms: 'Sila nyatakan jumlah ringgit.',  en: 'Please include the amount in RM.' },
  errParseBoth:      { ms: 'Tidak dapat memahami. Sila cuba semula.', en: 'Could not understand. Please try again.' },
  errImport:         { ms: 'Fail tidak sah.',               en: 'Invalid file.' },
  successAdd:        { ms: 'Hutang berjaya dicatat.',        en: 'Debt recorded.' },
  successPaid:       { ms: 'Bayaran dicatat.',              en: 'Payment recorded.' },

  // Confirm dialogs
  confirmDelete:     { ms: 'Padam hutang ini?',             en: 'Delete this entry?' },
  confirmImport:     { ms: 'Gabungkan data import?',        en: 'Merge imported data?' },

  // Phone number dialog
  dialogPhoneTitle:      { ms: 'Nombor WhatsApp',           en: 'WhatsApp Number' },
  dialogPhoneLabel:      { ms: 'Masukkan nombor telefon',   en: 'Enter phone number' },
  dialogPhonePlaceholder:{ ms: '0123456789',                en: '0123456789' },
  btnSimpan:             { ms: 'Simpan',                    en: 'Save' },
  btnBatal:              { ms: 'Batal',                     en: 'Cancel' },
  linkTukarNombor:       { ms: 'Tukar nombor',              en: 'Change number' },

  // Accessibility — phone dialog
  ariaPhoneDialog:  { ms: 'Dialog nombor WhatsApp',         en: 'WhatsApp number dialog' },
  ariaPhoneInput:   { ms: 'Nombor telefon WhatsApp',        en: 'WhatsApp phone number' },
  ariaPhoneSimpan:  { ms: 'Simpan nombor telefon',          en: 'Save phone number' },
  ariaPhoneBatal:   { ms: 'Batal — tutup dialog',           en: 'Cancel — close dialog' },

  // Partial payments
  successPayment:      { ms: 'Bayaran {amount} dicatat untuk {customer}', en: 'Payment {amount} recorded for {customer}' },
  errOverpayment:      { ms: 'Lebih bayar! Baki sebenar: {balance}',      en: 'Overpayment! Actual balance: {balance}' },
  errNoDebt:           { ms: 'Tiada hutang untuk pelanggan ini.',           en: 'No outstanding debt for this customer.' },
  labelPaymentHistory: { ms: 'Sejarah bayaran',                            en: 'Payment history' },
  labelBalance:        { ms: 'Baki',                                       en: 'Balance' },
  labelSettleAll:      { ms: 'Langsai semua',                              en: 'Settle all' },
  ariaPaymentHistory:  { ms: 'Sejarah bayaran pelanggan',                  en: 'Customer payment history' },

  // Top debtors card
  topDebtorsTitle:        { ms: 'Siapa paling lama hutang? 👻', en: 'Who has owed longest? 👻' },
  topDebtorsDaysOverdue:  { ms: 'tertunggak',                   en: 'days overdue' },
  topDebtorsDaysSuffix:   { ms: 'hari',                         en: '' },
  topDebtorsNotOverdue:   { ms: 'belum tertunggak',             en: 'not yet overdue' },
  ariaTopDebtors:         { ms: 'Kad penghutang terlama',       en: 'Longest outstanding debtors card' },

  // Accessibility
  ariaEntry:         { ms: 'Rekod hutang',                  en: 'Debt entry' },
  ariaGhost:         { ms: 'Ikon hantu (tertunggak)',        en: 'Ghost icon (overdue)' },
  ariaLangToggle:    { ms: 'Tukar ke Bahasa Inggeris',      en: 'Switch to Bahasa Melayu' },
  ariaMicBtn:        { ms: 'Butang mikrofon sebutan suara', en: 'Voice input microphone button' },

  // Undo bar
  btnUndo:           { ms: '↩ Batal',                       en: '↩ Undo' },
  ariaUndo:          { ms: 'Batal tindakan terakhir',        en: 'Undo last action' },
  undoLabelAdd:      { ms: 'Hutang baru dicatat. Nak batal?',  en: 'Entry added. Undo?' },
  undoLabelPaid:     { ms: 'Ditanda bayar. Nak batal?',        en: 'Marked paid. Undo?' },
  undoLabelPayment:  { ms: 'Bayaran dicatat. Nak batal?',      en: 'Payment recorded. Undo?' },
  undoLabelDelete:   { ms: 'Hutang dipadam. Nak batal?',       en: 'Entry deleted. Undo?' },
  undoLabelEdit:     { ms: 'Hutang dikemaskini. Nak batal?',   en: 'Entry updated. Undo?' },
  toastUndoDone:     { ms: 'Tindakan dibatalkan. ✓',           en: 'Action undone. ✓' },

  // Edit dialog
  btnEdit:                 { ms: '✏️ Edit',                          en: '✏️ Edit' },
  ariaEditEntry:           { ms: 'Edit rekod hutang',                en: 'Edit debt entry' },
  dialogEditTitle:         { ms: 'Kemaskini Hutang',                 en: 'Update Debt' },
  dialogEditLabelCustomer: { ms: 'Nama pelanggan',                   en: 'Customer name' },
  dialogEditLabelItem:     { ms: 'Barang',                           en: 'Item' },
  dialogEditLabelAmount:   { ms: 'Jumlah (RM)',                      en: 'Amount (RM)' },
  dialogEditLabelDue:      { ms: 'Tarikh bayar (YYYY-MM-DD)',        en: 'Due date (YYYY-MM-DD)' },
  successEdit:             { ms: 'Rekod dikemaskini.',               en: 'Entry updated.' },
  errEditCustomer:         { ms: 'Nama pelanggan tidak boleh kosong.', en: 'Customer name cannot be empty.' },
  errEditAmount:           { ms: 'Jumlah mesti lebih daripada RM0.', en: 'Amount must be greater than RM0.' },

  // Search
  searchPlaceholder:  { ms: 'Cari pelanggan…',                en: 'Search customer…' },
  searchLabel:        { ms: 'Cari pelanggan',                 en: 'Search customer' },
  noSearchMatch:      { ms: 'Tiada padanan.',                 en: 'No match.' },

  // Customer page
  btnTutup:           { ms: '✕ Tutup',                        en: '✕ Close' },
  customerPageTitle:  { ms: 'Penyata Pelanggan',              en: 'Customer Statement' },
  labelCreatedAt:     { ms: 'Tarikh',                         en: 'Date' },
  labelStatus:        { ms: 'Status',                         en: 'Status' },
  labelUnpaid:        { ms: 'Belum bayar',                    en: 'Unpaid' },
  labelPaidOn:        { ms: 'Dibayar',                        en: 'Paid' },
  labelDaysOwed:      { ms: 'Hari terhutang',                 en: 'Days owed' },
  labelTotalOwed:     { ms: 'Jumlah terhutang',               en: 'Total owed' },
  btnHantarPenyata:   { ms: '📄 Hantar Penyata',              en: '📄 Send Statement' },
  ariaCustomerPage:   { ms: 'Halaman penyata pelanggan',      en: 'Customer statement page' },
  ariaBtnTutup:       { ms: 'Tutup halaman pelanggan',        en: 'Close customer page' },
  ariaBtnHantarPenyata: { ms: 'Hantar penyata ke WhatsApp',   en: 'Send statement to WhatsApp' },

  // Statement text
  stmtHeader:   { ms: 'Penyata Akaun',              en: 'Account Statement' },
  stmtNoBalance:{ ms: 'Tiada baki tertunggak 🎉',   en: 'No outstanding balance 🎉' },
  stmtBalance:  { ms: 'Baki',                        en: 'Balance' },
  stmtPayment:  { ms: '✓ Bayar',                     en: '✓ Payment' },
  stmtUnpaid:   { ms: 'Belum bayar',                 en: 'Unpaid' },
  stmtPaid:     { ms: '✓ Dah bayar',                 en: '✓ Paid' },

  // Delete confirm dialog
  dialogDeleteTitle:   { ms: 'Padam Hutang',                                               en: 'Delete Entry' },
  dialogDeleteMsg:     { ms: 'Padam hutang ini? Tindakan ini boleh dibatalkan selepas.',   en: 'Delete this entry? You can undo immediately after.' },
  btnConfirmDelete:    { ms: 'Padam',                                                       en: 'Delete' },
  ariaDeleteDialog:    { ms: 'Dialog pengesahan padam',                                     en: 'Delete confirmation dialog' },
  ariaConfirmDelete:   { ms: 'Sahkan padam hutang',                                         en: 'Confirm delete entry' },
};

/**
 * Get a localised string by key.
 *
 * @param {string}       key
 * @param {'ms' | 'en'}  [lang]
 * @returns {string}
 */
export function t(key, lang = DEFAULT_LANG) {
  const entry = STRINGS[key];
  if (!entry) {
    console.warn(`[i18n] Missing key: ${key}`);
    return key;
  }
  return entry[lang] ?? entry[DEFAULT_LANG] ?? key;
}

/**
 * Returns an array of all available string keys (useful for testing completeness).
 * @returns {string[]}
 */
export function allKeys() {
  return Object.keys(STRINGS);
}
