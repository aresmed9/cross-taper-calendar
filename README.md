# Cross-Taper Calendar

Turns a medication switch plan that a prescriber has already chosen into a printable day-by-day calendar for the patient: what to take each day, how many tablets, and which days something changes.

**Educational project, not a medical device.** It never recommends drugs or doses. Check every calendar against the prescription.

## Status

This is the starter. The tests in `tests/` describe the planning engine, and the engine functions in `src/` are still empty, so `npm test` fails on purpose until Milestone 1 is done. The test run on GitHub fails for the same reason. See [ROADMAP.md](ROADMAP.md).

## What is in the repository

```text
CLAUDE.md            rules Claude Code follows in this project
SPEC.md              what the engine must do (the source of truth)
ROADMAP.md           milestones, each with a prompt to paste into Claude Code
src/                 the engine: pure functions, no web page code
tests/               the tests and the example plans they use
scripts/serve.js     local preview server
index.html           the page (a placeholder until Milestone 2)
.github/workflows/   runs the tests on GitHub after every push
```

## Set up on Windows

1. Install [Git for Windows](https://git-scm.com/downloads/win) and [Node.js LTS](https://nodejs.org). The default options are fine. In PowerShell you can use `winget install --id Git.Git -e` and `winget install OpenJS.NodeJS.LTS` instead.
2. Open a new terminal and check that `git --version` and `node --version` both print a version (Node 20 or newer).
3. In the project folder, run `npm test`.

## Everyday commands

- `npm test` runs all the tests.
- `npm run serve` previews the page at http://127.0.0.1:8080 (Ctrl+C stops it).

## Privacy and safety

- No patient identifiers. The plan has no field for them, and the engine rejects any field it does not know.
- Everything runs in the browser tab: no network requests, analytics, cookies, or storage, and the page's Content-Security-Policy blocks them.
- The tool formats and checks the prescriber's plan. It does not suggest drugs, doses, or timing.

## License

MIT. See [LICENSE](LICENSE).
