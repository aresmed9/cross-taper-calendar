# Cross-Taper Calendar: Specification

Version 0.1. This file is the source of truth. When the code and this spec disagree, the spec wins until someone changes it on purpose (section 12).

## 1. What it does

A prescriber enters a medication switch plan they have already decided on: one or two drugs, the doses, how long each step lasts, when each drug starts, and which tablet strengths are available. The page checks the plan and turns it into a day-by-day calendar a patient can follow: what to take, how many tablets, and which days something changes.

This is an educational project, not a medical device.

## 2. Rules that never change

1. The tool never suggests or changes a drug, a dose, a step length, a start day, or any timing. It formats and checks what the prescriber entered.
2. No patient identifiers. The plan has no field for a name, MRN, date of birth, address, phone number, or email, and the validator rejects any field it does not recognize.
3. Nothing leaves the browser tab: no network requests, analytics, cookies, or browser storage.
4. The same plan always produces the same calendar. Engine functions are pure and never change their inputs.
5. Dose arithmetic uses whole numbers of micrograms (half-micrograms for split tablets), never floating-point milligrams.

## 3. The plan

```js
{
  version: 1,
  startDate: '2026-11-02', // Day 1, written YYYY-MM-DD
  drugs: [ /* one or two drug plans */ ],
}
```

Each drug plan has exactly these fields:

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1 to 60 characters after trimming. Two drugs may not share a name (compared trimmed and case-insensitive). |
| `times` | string[] | One or more of `morning`, `midday`, `evening`, `bedtime`, with no repeats. The order given is the display order. |
| `strengths` | `{ mg, splittable }[]` | 1 to 6 tablet strengths with different mg values. `mg` is above 0 and at most 10000, with at most 3 decimals. `splittable` is `true` only for tablets that may be cut in half. |
| `alreadyTaking` | boolean | `true` if the patient takes this drug when the plan starts. |
| `currentDoses` | `{ [time]: mg }` | Required when `alreadyTaking` is true, and must add up to more than 0. Not allowed when `alreadyTaking` is false. The dose taken before Day 1. |
| `startDay` | integer | The day the first step begins, 1 to 365. Must be 1 when `alreadyTaking` is true. |
| `steps` | `{ days, doses }[]` | 1 to 52 steps in order. `days` is an integer from 1 to 365. `doses` maps a time to mg (0 to 10000, at most 3 decimals). A time left out means 0 mg. Every key must be one of the drug's `times`. |
| `afterLastStep` | `'stop'` or `'continue'` | What happens when the last step ends. |

A drug the patient is not already taking must have at least one step with a dose above 0.

Example (also in `tests/fixtures.js` as `overlapPlan`):

```js
{
  version: 1,
  startDate: '2026-11-02',
  drugs: [
    {
      name: 'Drug A',
      times: ['morning'],
      strengths: [{ mg: 50, splittable: true }, { mg: 25, splittable: false }],
      alreadyTaking: true,
      currentDoses: { morning: 100 },
      startDay: 1,
      steps: [
        { days: 7, doses: { morning: 75 } },
        { days: 7, doses: { morning: 50 } },
        { days: 7, doses: { morning: 25 } },
      ],
      afterLastStep: 'stop',
    },
    {
      name: 'Drug B',
      times: ['morning'],
      strengths: [{ mg: 10, splittable: true }],
      alreadyTaking: false,
      startDay: 8,
      steps: [
        { days: 7, doses: { morning: 5 } },
        { days: 7, doses: { morning: 10 } },
        { days: 7, doses: { morning: 20 } },
      ],
      afterLastStep: 'continue',
    },
  ],
}
```

## 4. Days and calendar length

- Day 1 is `startDate`, and Day n is `startDate` plus n - 1 days. Days are numbered from 1 everywhere a person sees them.
- A drug's last step day is `startDay + (sum of its step days) - 1`.
- A drug's last calendar day is its last step day, plus one more day when `afterLastStep` is `'stop'`, so the calendar shows the day it stops.
- The calendar runs from Day 1 through the latest last calendar day among the drugs. It may not be longer than 180 days.

## 5. Daily doses

For each drug on each calendar day d:

- Before `startDay`: 0 mg at every time.
- From `startDay` through the last step day: the doses of the step that covers d.
- After the last step day: the last step's doses if `afterLastStep` is `'continue'`, otherwise 0 mg.

Every one of the drug's `times` appears in each day's doses, with 0 where nothing is taken.

## 6. Status and change days

Each drug gets one status per day, found by comparing that day's doses with the day before. For Day 1, "the day before" is `currentDoses` when `alreadyTaking` is true; otherwise the drug has not been taken yet.

| Status | When |
|---|---|
| `not-started` | The drug has not been taken yet and today's total is 0. |
| `start` | The first day with a total above 0, for a drug that was not already being taken. |
| `same` | Every time has the same dose as the day before. |
| `increase` | The total is higher than the day before. |
| `decrease` | The total is lower than the day before, but above 0. |
| `adjust` | The total equals the day before, but it is split differently across times. |
| `stop` | The total drops to 0 from above 0. |
| `stopped` | The total is 0 and was 0 the day before, after the drug had been taken. |
| `restart` | The total rises above 0 after a day at 0, after the drug had been taken. |

A change day is any day on which at least one drug's status is `start`, `increase`, `decrease`, `adjust`, `stop`, or `restart`.

## 7. Tablet solver

`solveTablets(doseMg, strengths)` works out how to make one dose (one time of day) from the listed strengths.

- Whole tablets of any strength may be used, and halves only of `splittable` strengths. No quarters.
- A piece is one whole tablet or one half tablet. A dose may use at most 12 pieces.
- When several combinations work, pick by these rules, in order:
  1. Fewest pieces.
  2. Fewest halves.
  3. More of the larger strengths: compare the largest strength first, counting a half as half a tablet.
- Returns `{ exact, pieces, items }`. `items` lists only the strengths used, largest first, each as `{ strengthMg, whole, halves }`.
- A 0 mg dose returns `{ exact: true, pieces: 0, items: [] }`.
- If no combination of 12 pieces or fewer makes the dose exactly, it returns `{ exact: false, pieces: 0, items: [] }`.
- Throws `RangeError` if the dose is negative, not a finite number, or has more than 3 decimals, or if a strength is not above 0 with at most 3 decimals.
- The order of the strengths does not matter, and the strengths array is not changed.

## 8. Validation

`validatePlan(plan)` returns `{ errors, warnings }`. It never throws and never changes the plan.

Each issue is `{ code, path, message }`, sometimes with extra fields. `path` points at the field using dots and brackets, for example `drugs[1].steps[0].days`, and plan-level issues use `''`. `message` is a short English sentence for people. Validation reports as many errors as it can instead of stopping at the first one, but it skips checks that depend on a field that is already broken (for example, dose keys are not checked when `times` is invalid).

### Errors

| Code | When | Path |
|---|---|---|
| `PLAN_NOT_OBJECT` | The plan is not a plain object. | `''` |
| `UNKNOWN_FIELD` | A field not listed in section 3, at any level (plan, drug, strength, step). This is how identifiers are kept out. | the unknown field, for example `patientName` or `drugs[0].mrn` |
| `VERSION_UNSUPPORTED` | `version` is not 1. | `version` |
| `START_DATE_INVALID` | `startDate` is not a real date in YYYY-MM-DD form. | `startDate` |
| `DRUG_COUNT` | `drugs` is missing, not an array, empty, or has more than 2 entries. | `drugs` |
| `DRUG_INVALID` | A drug entry is not a plain object. | `drugs[i]` |
| `DRUG_NAME_INVALID` | The name is missing, not a string, blank, or over 60 characters after trimming. | `drugs[i].name` |
| `DRUG_NAME_DUPLICATE` | Same name as an earlier drug (trimmed, case-insensitive). | the later drug's `name` |
| `TIMES_INVALID` | `times` is not a non-empty array of allowed times without repeats. | `drugs[i].times` |
| `STRENGTHS_INVALID` | The list is not an array of 1 to 6 entries, an entry is not an object, or `mg` or `splittable` is invalid. | `drugs[i].strengths`, `drugs[i].strengths[k]`, `drugs[i].strengths[k].mg`, or `drugs[i].strengths[k].splittable` |
| `DUPLICATE_STRENGTH` | Two strengths have the same mg. | the later `drugs[i].strengths[k].mg` |
| `ALREADY_TAKING_INVALID` | `alreadyTaking` is not a boolean. | `drugs[i].alreadyTaking` |
| `CURRENT_DOSES_INVALID` | Missing or not an object when required, present when not allowed, adds up to 0, or has a key that is not one of the drug's times or a value that is not a valid dose. The add-up check runs only when every key and value is valid. | `drugs[i].currentDoses` or `drugs[i].currentDoses.<time>` |
| `START_DAY_INVALID` | `startDay` is not an integer from 1 to 365. | `drugs[i].startDay` |
| `ALREADY_TAKING_START_DAY` | `alreadyTaking` is true and `startDay` is not 1. | `drugs[i].startDay` |
| `STEPS_INVALID` | The list is not an array of 1 to 52 steps, a step is not an object, `days` is invalid, or `doses` is missing, not an object, or has a bad key or value. | `drugs[i].steps`, `drugs[i].steps[j]`, `drugs[i].steps[j].days`, `drugs[i].steps[j].doses`, or `drugs[i].steps[j].doses.<time>` |
| `AFTER_LAST_STEP_INVALID` | Not `'stop'` or `'continue'`. | `drugs[i].afterLastStep` |
| `DRUG_HAS_NO_DOSES` | A drug that is not already being taken has no step with a dose above 0. | `drugs[i].steps` |
| `CALENDAR_TOO_LONG` | The calendar would be longer than 180 days (section 4). | `''` |
| `DOSE_NOT_MAKEABLE` | A dose cannot be made from the drug's strengths (section 7). Reported once per drug and dose value, at the first place it appears: current doses first, then steps in order, times in the drug's order. Extra fields: `drug` (index) and `doseMg`. | that dose, for example `drugs[0].steps[1].doses.morning` |

### Warnings

Warnings are computed only when there are no errors.

| Code | When | Extra fields |
|---|---|---|
| `MANY_PIECES` | A dose needs more than 4 pieces. Reported once per drug and dose value, at the first place it appears (same order as `DOSE_NOT_MAKEABLE`), and `path` points at that dose. | `drug`, `doseMg`, `pieces` |
| `NO_MEDICATION_DAYS` | A run of days on which no drug is taken, with dosing before it (a `currentDoses` counts) and dosing after it within the calendar. One warning per run, with `path` `''`. | `fromDay`, `toDay` |

## 9. The calendar: `buildSchedule(plan)`

`buildSchedule` runs `validatePlan` first. If there are errors it throws a `PlanValidationError`: an `Error` whose `name` is `'PlanValidationError'` and whose `errors` property holds the errors. Otherwise it returns exactly these fields:

```js
{
  startDate: '2026-11-02',
  endDate: '2026-11-29',      // the date of the last day
  totalDays: 28,
  changeDays: [1, 8, 15, 22], // day numbers, ascending
  days: [
    {
      day: 1,                 // numbered from 1
      date: '2026-11-02',
      weekday: 1,             // 0 = Sunday ... 6 = Saturday
      isChangeDay: true,
      drugs: [                // every drug, every day, in plan order
        {
          name: 'Drug A',     // trimmed
          status: 'decrease',
          doses: { morning: 75 }, // mg, for every time of the drug
          totalMg: 75,
          tablets: { morning: { exact: true, pieces: 2, items: [ /* section 7 */ ] } },
        },
      ],
    },
  ],
  drugs: [
    { name: 'Drug A', times: ['morning'], continuesAfterCalendar: false, lastDoseDay: 21 },
    { name: 'Drug B', times: ['morning'], continuesAfterCalendar: true, lastDoseDay: null },
  ],
  warnings: [], // the same warnings validatePlan returns
}
```

- `tablets` has an entry for every time, including 0 mg doses (`{ exact: true, pieces: 0, items: [] }`).
- `continuesAfterCalendar` is true when `afterLastStep` is `'continue'` and the last step's doses add up to more than 0.
- `lastDoseDay` is the last calendar day with a dose above 0 for a drug that does not continue (`null` if there is none), and always `null` for a drug that continues.
- No two days share an object, and the result shares nothing with the plan, so changing one part cannot change another.

## 10. Dates

- `isValidISODate(value)`: true only for a string in `YYYY-MM-DD` form that names a real calendar date, leap years included.
- `addDays(isoDate, n)`: the date `n` days later (`n` may be negative). Uses UTC calendar math so daylight saving time never shifts a date. Throws `RangeError` for an invalid date or a non-integer `n`.
- `weekdayIndex(isoDate)`: 0 for Sunday through 6 for Saturday. Throws `RangeError` for an invalid date.

## 11. Not in this version

Liquids, patches, and injections; quarter tablets; more than two drugs; as-needed doses; rounding doses to available strengths; translations (Milestone 6); saving or loading plans.

## 12. Changing this spec

Change this file and the tests first, then the code, in the same commit. Bump the version line at the top when behavior changes.
