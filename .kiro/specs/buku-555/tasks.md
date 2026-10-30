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
