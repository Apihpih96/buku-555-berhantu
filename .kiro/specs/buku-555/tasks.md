# Tasks — Buku 555 Berhantu

Numbered checklist of implementation tasks. Each task references the requirement or design section it satisfies.

---

## Phase 1 — Project Setup

- [x] T-01 Create `package.json` with `"type": "module"`, `"scripts": { "test": "node --test" }`, and `fast-check` as devDependency (NFR-6)
- [x] T-02 Create `MIT LICENSE` file (copyright 2026 Mohammad Afif bin Mohd Saberi)

## Phase 2 — Core Logic

- [x] T-03 Implement `parser.js` — Malay number table, day resolver, amount extractor, customer/item tokeniser (FR-2.1–FR-2.5, Design §Parser Grammar)
- [x] T-04 Implement `ledger.js` — `addEntry`, `markPaid`, `totalOutstanding`, `overdueEntries`, `entriesByCustomer`, `exportJSON`, `importJSON` (FR-3, Design §Ledger)
- [x] T-05 Implement `i18n.js` — all UI strings in `ms` and `en`, exported `t(key, lang)` function (FR-5)

## Phase 3 — Application Layer

- [x] T-06 Implement `app.js` — localStorage bootstrap, voice/text wiring, ledger render, WhatsApp link builder, language toggle, export/import (FR-1, FR-3, FR-4, FR-5, FR-6)

## Phase 4 — UI

- [x] T-07 Create `index.html` — semantic HTML5, mobile viewport, links to `styles.css` and `app.js`, ARIA labels (NFR-1–NFR-4)
- [x] T-08 Create `styles.css` — aged paper background, Buku 555 red/blue palette, ghost animation, ≥48px tap targets, ≥18px font, high-contrast (NFR-1–NFR-3)
- [x] T-09 Create `assets/ghost.svg` — friendly translucent ghost, ~64px viewBox, used as inline decoration

## Phase 5 — Tests

- [x] T-10 Create `tests/parser.test.js` — unit tests for all example inputs from design.md + fast-check property tests (AC-1, AC-2, AC-7, Design §Correctness Properties 1–4)
- [x] T-11 Create `tests/ledger.test.js` — unit tests for ledger functions + fast-check property tests (AC-3, AC-4, AC-7, Design §Correctness Properties 5–9)

## Phase 6 — Docs

- [x] T-12 Create `README.md` — what it is, Kiro usage, test instructions, live link placeholder

## Phase 7 — Verification

- [x] T-13 Run `npm install` and `npm test`; fix all failures until green
- [x] T-14 Update this file — mark all completed tasks with `[x]`

## Phase 8 — Hantu Reminder (WhatsApp)

- [x] T-15 Add `buildReminder(entries, customer, msisdn, today, lang)` pure function to `ledger.js` — filters to unpaid entries for customer, formats each line with local dates (never `toISOString`), applies tone rules (gentle / today / overdue ghost), builds and returns `wa.me` URL (FR-4.1, FR-4.8–FR-4.13, Design §Hantu Reminder)
- [x] T-16 Extend `exportJSON` / `importJSON` in `ledger.js` to accept and carry a `phones` map `{ customerName → '60XXXXXXXXX' }` in the backup JSON (FR-4.7, Design §Storage)
- [x] T-17 Add i18n keys for phone dialog and reminder UI: `dialogPhoneTitle`, `dialogPhonePlaceholder`, `btnSimpan`, `btnBatal`, `linkTukarNombor`, `ariaPhoneDialog`, `ariaPhoneInput`, `ariaPhoneSimpan`, `ariaPhoneBatal` in both `ms` and `en` (FR-4.4, FR-5)
- [x] T-18 Add phone-number dialog `<dialog id="phone-dialog">` to `index.html` with `<input inputmode="tel">`, Simpan and Batal buttons, ≥48px tap targets, ARIA attributes (FR-4.4, NFR-1, NFR-4)
- [x] T-19 Load/save `phones` map from localStorage in `app.js` (`loadState` / `saveState`); wire "Hantar Peringatan" button on ALL unpaid entries (not just overdue); show "Tukar nombor" link when number already saved (FR-4.2, FR-4.4, FR-4.5, FR-4.6, FR-4.8)
- [x] T-20 Replace `window.prompt` phone-number flow in `app.js` with the in-app `<dialog>` — open dialog when number unknown, call `buildReminder` + `window.open` when confirmed or number already known (FR-4.4, FR-4.5)
- [x] T-21 Write `buildReminder` unit tests and PBT properties in `tests/ledger.test.js`: message total = sum of unpaid, paid entries excluded, URL starts `https://wa.me/60`, tone variants (AC-8, AC-9, AC-10, Design §Correctness Properties 10–13)
- [x] T-22 Run `npm test`; fix failures until all pass
- [x] T-23 Add `demoEntries(today)` sample ledger, 👻 Cuba Demo button and `?demo=1` deep link for judges; test it always yields overdue, due-today, upcoming and paid entries

## Phase 9 — PWA

- [x] T-24 Create `manifest.json` with name 'Buku 555 Berhantu', short_name 'Buku 555', start_url './', scope './', display standalone, theme_color '#8B0000', background_color '#fdf6e3', and two SVG icon entries (192 and 512) with purpose 'any maskable' (FR-7.7)
- [x] T-24b Create `assets/icon-192.svg` and `assets/icon-512.svg` — ghost motif centred on a dark-red (#8B0000) rounded-square background (FR-7.8)
- [x] T-24c Create `sw.js` — versioned cache-first service worker caching full app shell; activate deletes old caches; fetch falls back to network (FR-7.2, FR-7.3, FR-7.4)
- [x] T-24d Register service worker in `app.js` using relative path `'./sw.js'`; capture `beforeinstallprompt`; show/hide `#btn-install` button; wire button click to `deferredPrompt.prompt()` (FR-7.1, FR-7.5, FR-7.6)
- [x] T-24e Add `#btn-install` button markup to `index.html` (initially hidden, shown by JS) with bilingual aria-label (FR-7.5)

## Phase 10 — Kiro Hooks

- [x] T-25 Create `.kiro/hooks/run-tests-on-save.kiro.hook` — enabled, triggers on `*.js` / `tests/*.js` edits, asks agent to run `npm test` and fix failures without weakening tests (FR-8.1, FR-8.3)
- [x] T-25b Create `.kiro/hooks/i18n-check.kiro.hook` — enabled, triggers on `i18n.js` edits, asks agent to verify every key has both `ms` and `en` values (FR-8.2, FR-8.3)
- [x] T-25c Update README with a 'Built with Kiro' section describing both hooks

## Phase 11 — Top Debtors Card

- [x] T-26 Implement `topDebtors(ledger, today, n=3)` pure function in `ledger.js` — filters unpaid, groups by customer, computes daysOverdue from oldest unpaid due date using local calendar dates, sorts descending by daysOverdue then totalOwed, returns at most n DebtorSummary objects (FR-9.4, FR-9.5, Design §Top Debtors)
- [x] T-26b Add i18n keys for top-debtors card in `i18n.js`: `topDebtorsTitle`, `topDebtorsDaysOverdue`, `topDebtorsDaysOverdueSuffix` in both `ms` and `en` (FR-9.2)
- [x] T-26c Add `#top-debtors` card section to `index.html`, hidden by default, above `#ledger-list` (FR-9.1, FR-9.3)
- [x] T-26d Wire top-debtors card in `app.js` — call `topDebtors()`, render rows, show/hide card based on whether any unpaid entries exist (FR-9.1, FR-9.3)
- [x] T-26e Write unit tests and fast-check properties for `topDebtors` in `tests/ledger.test.js`: never includes paid-only customers, at most n entries, sorted correctly (AC-16, AC-17, Design §Correctness Properties 14–17)

## Phase 12 — Final Verification

- [x] T-27 Run `npm test` until all tests pass; mark T-24..T-27 as complete
