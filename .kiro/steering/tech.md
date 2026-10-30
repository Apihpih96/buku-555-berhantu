# Tech

- Pure static site: index.html, styles.css, app.js, parser.js (ES modules). No build step, no framework, no backend. Deployable to GitHub Pages.
- Storage: localStorage (key `buku555.v1`), with JSON export/import for backup.
- Voice: Web Speech API (`webkitSpeechRecognition`, lang `ms-MY`), with graceful fallback to text input when unsupported.
- Parser (parser.js) must be pure, deterministic and unit-testable in Node: input string -> { customer, item, qty, amountRM, dueDate|null }. Handle Malay numbers (satu..sepuluh, "dua puluh", "RM18", "18 ringgit", "seringgit"), days (Isnin..Ahad, "esok", "lusa", "minggu depan", "hujung bulan"), and common honorifics (Kak, Abang, Pak Cik, Mak Cik, Encik, Puan, Cik).
- Tests: Node built-in test runner (`node --test`), plus property-based tests with fast-check for the parser and money totals (amounts never negative, total = sum of unpaid entries, parsing is idempotent for formatted output).
- WhatsApp: build `https://api.whatsapp.com/send?phone=<msisdn>&text=<encoded>` links (wa.me redirects mangle emoji); Malaysian numbers normalised to 60XXXXXXXXX.
- Accessibility: min 48px tap targets, font >= 18px, high contrast, aria labels.
- Code style: small functions, JSDoc types, no external runtime deps except fast-check as a devDependency.
