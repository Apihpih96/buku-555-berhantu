# Requirements — Buku 555 Berhantu

## Overview
A phone-first progressive web app for Malaysian market traders to track customer credit (hutang) using voice or text input in Bahasa Melayu.

---

## Functional Requirements

### FR-1: Voice & Text Entry

**FR-1.1** WHEN the trader taps the microphone button, the system SHALL activate Web Speech API (lang `ms-MY`) and transcribe speech to text in the input field.

**FR-1.2** WHEN the Web Speech API is not supported by the browser, the system SHALL hide the microphone button and display only a text input field.

**FR-1.3** WHEN the trader submits an entry (voice-transcribed or typed), the system SHALL pass the raw string to the parser and display a confirmation or an error.

---

### FR-2: Malay Input Parsing

**FR-2.1** WHEN the parser receives a Malay sentence, it SHALL extract the following fields:
- `customer` — name with optional honorific (Kak, Abang, Pak Cik, Mak Cik, Encik, Puan, Cik)
- `item` — description of goods
- `qty` — quantity as a number (optional)
- `amountRM` — amount owed in Malaysian Ringgit as a positive number
- `dueDate` — ISO date string or null

**FR-2.2** WHEN the parser encounters Malay cardinal numbers (satu, dua, tiga, empat, lima, enam, tujuh, lapan, sembilan, sepuluh, sebelas, dua belas … dua puluh, tiga puluh, etc.), it SHALL convert them to numeric values.

**FR-2.3** WHEN the parser encounters amount patterns, it SHALL recognise:
- `RM18`, `RM 18`, `RM18.50`
- `18 ringgit`, `18 ringgit 50 sen`
- `seringgit` (RM1), `dua ringgit` (RM2)

**FR-2.4** WHEN the parser encounters day references, it SHALL resolve them to an absolute ISO date:
- Named days: Isnin, Selasa, Rabu, Khamis, Jumaat, Sabtu, Ahad
- Relative: esok (tomorrow), lusa (day after tomorrow), minggu depan (next week), hujung bulan (last day of current month)

**FR-2.5** WHEN the parser cannot extract a required field (`customer` or `amountRM`), it SHALL return `null` for that field and the caller SHALL display an error asking the trader to retype.

---

### FR-3: Ledger

**FR-3.1** WHEN a valid entry is confirmed, the system SHALL append it to the ledger stored in localStorage under key `buku555.v1`.

**FR-3.2** WHEN the trader views the main screen, the system SHALL display all unpaid entries grouped by customer, showing item, amount, due date, and days overdue.

**FR-3.3** WHEN the trader taps "Bayar" (Mark Paid) on an entry, the system SHALL mark that entry as paid and remove the ghost animation from it.

**FR-3.4** WHEN an entry is overdue (due date < today and status is unpaid), the system SHALL highlight it and display a ghost icon next to it.

**FR-3.5** WHEN the trader views the summary, the system SHALL display total outstanding (sum of all unpaid entries).

---

### FR-4: WhatsApp Reminder

**FR-4.1** WHEN the trader taps "Hantar Peringatan" (Send Reminder) on an overdue customer, the system SHALL construct a polite Malay message and open `https://wa.me/<msisdn>?text=<encoded>` in a new tab.

**FR-4.2** WHEN constructing the WhatsApp link, the system SHALL normalise Malaysian phone numbers to the format `60XXXXXXXXX` (strip leading `0`, prepend `60`).

**FR-4.3** The system SHALL NOT send any message automatically; the trader must press Send in WhatsApp.

---

### FR-5: Language Toggle

**FR-5.1** WHEN the trader taps the language toggle, the system SHALL switch all UI labels between Bahasa Melayu (default) and English.

**FR-5.2** WHEN the language is changed, the system SHALL persist the preference in localStorage.

---

### FR-6: Data Backup

**FR-6.1** WHEN the trader taps "Eksport", the system SHALL download a JSON file containing all ledger entries.

**FR-6.2** WHEN the trader imports a JSON backup file, the system SHALL merge it with the current ledger (deduplicate by entry `id`).

---

## Non-Functional Requirements

**NFR-1** All interactive elements SHALL have a minimum tap target size of 48 × 48 px.

**NFR-2** All body text SHALL use a font size of at least 18 px.

**NFR-3** The UI SHALL maintain a minimum contrast ratio of 4.5:1 (WCAG AA) between text and background.

**NFR-4** All interactive elements SHALL carry descriptive `aria-label` attributes.

**NFR-5** The app SHALL function fully offline after first load (no external network requests at runtime).

**NFR-6** The app SHALL have no external runtime JavaScript dependencies (fast-check is devDependency only).

**NFR-7** The parser SHALL be pure and deterministic — same input always produces same output, no side effects.

---

## Acceptance Criteria Summary

| ID | Criterion |
|----|-----------|
| AC-1 | Parser returns correct `{ customer, item, qty, amountRM, dueDate }` for all example inputs in design.md |
| AC-2 | `amountRM` is always ≥ 0 for any valid parse |
| AC-3 | `totalOutstanding` equals sum of all unpaid entry amounts |
| AC-4 | Marking paid removes entry from outstanding total |
| AC-5 | WhatsApp link opens with correct normalised number and pre-filled message |
| AC-6 | App loads and works with JavaScript disabled networking (offline) |
| AC-7 | All property-based tests pass (see design.md §Correctness Properties) |
