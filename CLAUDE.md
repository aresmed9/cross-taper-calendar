# Cross-Taper Calendar

A static web page that turns a prescriber's chosen medication switch plan into a printable day-by-day calendar for the patient. Educational project, not a medical device. The owner is a medical student learning to code: explain changes in plain language and keep the code easy to read.

The specification is the source of truth: @SPEC.md

## Commands

- `npm test` runs every test (Node's built-in test runner, nothing to install)
- `node --test tests/tablets.test.js` runs one test file
- `npm run serve` previews the site at http://127.0.0.1:8080 (Ctrl+C stops it)

## Layout

- `src/` is the engine: pure functions, no DOM, no file or network access. `constants.js` holds spec values. Internal helper modules may be added here.
- `tests/` has one `*.test.js` per module plus `fixtures.js` (example plans), using `node:test` and `node:assert/strict`.
- `index.html`, `app.js`, and `styles.css` are the page. DOM code lives only in `app.js`.
- `scripts/serve.js` is the local preview server.

## Rules that are never broken

- Never add logic that suggests, chooses, or changes a drug, dose, step length, start day, or timing. The tool formats and checks the prescriber's plan, nothing more.
- Never add fields for patient identifiers (name, MRN, date of birth, address, phone, email). `validatePlan` rejects unknown fields on purpose; keep it that way.
- Never add network requests, analytics, cookies, localStorage, sessionStorage, IndexedDB, or third-party scripts, fonts, or CDNs. Keep the Content-Security-Policy meta tag in `index.html`.
- No npm dependencies. Standard JavaScript and Node built-ins only.
- Dose math uses whole micrograms (half-micrograms for split tablets), never floating-point milligrams.
- Dates go through `src/dates.js`, which does UTC calendar math. Never do local-time `Date` arithmetic.

## How to work

- Behavior changes start in SPEC.md and the tests, then the code, all in the same commit.
- Never edit or delete an existing test to make code pass. If a test looks wrong, stop and explain why.
- Run `npm test` after each change and before each commit. Commit only when everything passes.
- Keep commits small, with messages like `feat: ...`, `fix: ...`, `test: ...`, `docs: ...`.
- For anything bigger than a small fix, propose a plan and wait for approval before editing.
- End each task with a plain-language summary of what changed and how to check it by hand.
