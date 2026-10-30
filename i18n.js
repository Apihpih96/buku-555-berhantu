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
