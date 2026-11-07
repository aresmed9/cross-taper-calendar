# Roadmap

Each milestone is one Claude Code session. Paste the prompt, read the plan, review the changes, and commit when the tests pass.

## How to run a milestone

1. In the Claude desktop app, open the **Code** tab, choose this project folder, and start a new session.
2. Set the permission mode to **Plan**, paste the milestone prompt, and read the plan Claude proposes. Ask questions until it makes sense.
3. Switch to **Accept edits** (or **Manual** if you want to approve each change) and tell Claude to go ahead.
4. Read the diff. Ask "why" about anything you do not understand.
5. Run `npm test` yourself in the app's terminal (Ctrl+`).
6. Check the "Done when" list, then ask Claude to commit and push.

Habits that keep the project healthy:

- One milestone per session, so each session starts with a clean context.
- If Claude changes anything in `tests/` without being asked, say so and have it undo the change.
- When something breaks, paste the whole error and ask Claude to explain the cause before it fixes anything.

---

## Milestone 1: The engine passes every test

```text
Read CLAUDE.md and SPEC.md first. The tests in tests/ describe the planning engine,
and every engine function in src/ currently throws "Not implemented yet".

Implement src/dates.js, src/tablets.js, src/validate.js, and src/schedule.js so that
`npm test` passes. You may add internal helper modules in src/. Do not change anything
in tests/ or src/constants.js.

Work in this order and run that module's tests after each one: dates, tablets,
validate, schedule. If a test seems to contradict SPEC.md, stop and tell me instead of
working around it.

When everything passes, explain each module to me in plain language, including how
solveTablets picks 50 mg + 25 mg for a 75 mg dose. Then commit with the message
"feat: implement planning engine" and push.
```

Done when:

- `npm test` shows every test passing (58 at the start) and none failing.
- The **Actions** tab on GitHub shows a green check for the latest commit.
- You can say in one sentence what each of the four modules does.

Worth trying afterward: ask Claude to break something on purpose, such as making `addDays` use local time, run the tests, see which ones fail, then undo it. That is the fastest way to see what the tests protect.

## Milestone 2: The plan form

```text
Read CLAUDE.md and SPEC.md. Build the input form in index.html, with DOM code in a new
app.js (loaded with <script type="module">) and styles in styles.css. src/ stays free
of DOM code.

The form edits one plan in the format of SPEC.md section 3:
- start date
- one or two drugs, with "Add second drug" and "Remove" buttons
- for each drug: name; administration times as checkboxes; tablet strengths as rows of
  mg plus a "can be cut in half" checkbox, with add and remove; "already taking" with
  current doses per time; start day; steps as rows of days plus a dose per time, with
  add and remove; and stop or continue after the last step
- a "Load example" button that fills in the example from SPEC.md section 3 (copy the
  data into app.js; do not import test files)
- a "Check plan" button that calls validatePlan, shows each error next to the field its
  path points to, and lists all errors and warnings at the top

Keep the Content-Security-Policy meta tag as it is: no inline scripts or styles, no
network, no storage. Give every input a real <label>. Show me the plan before writing
code.
```

Done when:

- With `npm run serve` running, http://127.0.0.1:8080 loads, and "Load example" then "Check plan" shows no errors.
- Clearing a drug name, or setting a step to 0 days, shows a message next to that field.
- Reloading the page forgets everything. That is by design.
- `npm test` still passes.

## Milestone 3: The calendar

```text
Read CLAUDE.md and SPEC.md. When the plan has no errors, a "Make calendar" button
calls buildSchedule and shows the result below the form:
- a summary line with start date, end date, number of days, and change days
- one row per day: day number, date, weekday name, then for each drug and each of its
  times the dose in mg and the tablets, for example "1 x 50 mg + 1 x 25 mg" or
  "1/2 x 10 mg"
- change days clearly highlighted, with the status word (Start, Increase, Decrease,
  Adjust, Stop, Restart)
- a "continue at this dose" note for drugs that continue after the calendar
- any warnings above the table

Put the text formatting (tablets, dates, status words) in a new pure module
src/format.js. Write tests/format.test.js first, then the code, so the formatting is
tested without a browser.
```

Done when:

- The example makes a 28-day calendar with Days 1, 8, 15, and 22 highlighted and Drug A stopping on Day 22.
- 75 mg reads as one 50 mg plus one 25 mg tablet, and 5 mg reads as half of a 10 mg tablet.
- The new format tests pass along with the old ones.

## Milestone 4: Put it online

```text
Prepare the site for GitHub Pages at
https://<my-github-username>.github.io/cross-taper-calendar/ . Check that every path in
index.html and app.js is relative. Update README.md with what the tool does, how to use
it, and the safety rules. Then commit and push.
```

Then on GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, choose branch `main` and folder `/ (root)`, and save. A minute or two later the site is live at that address. Free GitHub Pages hosting needs the repository to be public.

Done when:

- The live site loads the example and makes a calendar.
- It works on your phone.

## Milestone 5: A printable handout

```text
Add a print layout with @media print in styles.css and a "Print calendar" button:
hide the form and buttons, show only the calendar, use at least 14 pt text, add a check
box beside each dose for the patient to tick, mark change days clearly, add a header
with the start date and "Prepared on <today's date>", and add a footer saying the
calendar was made from the prescriber's plan and to call the clinic with any questions.
No patient name field. Keep each day's row on one page.
```

Done when: the print preview (Ctrl+P) shows a clean handout with no form, and no day is split across two pages.

## Milestone 6: Spanish

```text
Add English and Spanish for everything the patient sees on the calendar and handout:
weekday names, status words, the "continue" note, the header and footer, and tablet
phrases. Put the strings in a new src/i18n.js and let src/format.js take a language.
Write the tests first in tests/i18n.test.js and tests/format.test.js, including phrases
like "1 tablet of 50 mg + 1 tablet of 25 mg", "1/2 tablet of 10 mg", and
"1 1/2 tablets of 10 mg", and their Spanish versions. Before connecting it to the page,
show me every Spanish string in a table so I can check the wording. Add a language
switch that changes only the calendar and handout.
```

Done when: you have read every Spanish string yourself and reworded anything a patient could misread.

## Milestone 7: Step builder

```text
Add a helper that fills in a drug's steps from four numbers the prescriber types:
from X mg to Y mg, changing by Z mg every N days. Write the SPEC.md section and the
tests first (src/steps.js and tests/steps.test.js). If the last change would overshoot,
the final step goes straight to Y and the form shows a note saying so. The helper only
fills in step rows; the prescriber can edit every row afterward. It never chooses X, Y,
Z, or N.
```

Done when: the tests cover tapering down, titrating up, uneven division, and rejecting Z = 0 or N = 0.

## Milestone 8: Find out whether it helps

No prompt for this one. Ask three co-residents or a pharmacist to turn five paper switch plans into patient calendars twice, once by hand and once with the tool. Time each one, count errors against the plan, and finish with the System Usability Scale questionnaire. With a short write-up, that is a poster, or a pitch for the APA's Psychiatry Innovation Lab.
