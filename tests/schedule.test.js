import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule } from '../src/schedule.js';
import { validatePlan } from '../src/validate.js';
import {
  overlapPlan,
  washoutPlan,
  redistributePlan,
  restartPlan,
  yearBoundaryPlan,
} from './fixtures.js';

const ALL_EXAMPLES = [overlapPlan, washoutPlan, redistributePlan, restartPlan, yearBoundaryPlan];
const NO_TABLETS = { exact: true, pieces: 0, items: [] };

const repeat = (value, times) => Array(times).fill(value);
const statusesOf = (schedule, drugIndex) => schedule.days.map((d) => d.drugs[drugIndex].status);
/** The entry for one drug on one day. Days are numbered from 1. */
const cell = (schedule, day, drugIndex) => schedule.days[day - 1].drugs[drugIndex];

test('rejects an invalid plan with a PlanValidationError', () => {
  const plan = overlapPlan();
  plan.patientName = 'Jane Doe';
  assert.throws(
    () => buildSchedule(plan),
    (err) => {
      assert.equal(err.name, 'PlanValidationError');
      assert.ok(Array.isArray(err.errors));
      assert.ok(err.errors.some((e) => e.code === 'UNKNOWN_FIELD'));
      return true;
    },
  );
});

test('the output has exactly the documented fields', () => {
  const s = buildSchedule(overlapPlan());
  assert.deepEqual(Object.keys(s).sort(), ['changeDays', 'days', 'drugs', 'endDate', 'startDate', 'totalDays', 'warnings']);
  assert.deepEqual(Object.keys(s.days[0]).sort(), ['date', 'day', 'drugs', 'isChangeDay', 'weekday']);
  assert.deepEqual(Object.keys(s.days[0].drugs[0]).sort(), ['doses', 'name', 'status', 'tablets', 'totalMg']);
  assert.deepEqual(Object.keys(s.drugs[0]).sort(), ['continuesAfterCalendar', 'lastDoseDay', 'name', 'times']);
});

// Overlap plan (tests/fixtures.js):
// Drug A 100 mg -> 75, 50, 25 mg for 7 days each, then stop.
// Drug B starts Day 8 at 5 mg -> 10 -> 20 mg, 7 days each, then continues.

test('overlap plan: calendar length and dates', () => {
  const s = buildSchedule(overlapPlan());
  assert.equal(s.startDate, '2026-11-02');
  assert.equal(s.endDate, '2026-11-29');
  assert.equal(s.totalDays, 28); // Drug B's last step ends Day 28; Drug A's stop day is Day 22
  assert.deepEqual(
    s.days.map((d) => d.day),
    Array.from({ length: 28 }, (_, i) => i + 1),
  );
  assert.equal(s.days[7].date, '2026-11-09');
  assert.equal(s.days[0].weekday, 1); // Monday
  assert.equal(s.days[27].weekday, 0); // Sunday
});

test('overlap plan: status of each drug on each day', () => {
  const s = buildSchedule(overlapPlan());
  assert.deepEqual(statusesOf(s, 0), [
    'decrease', ...repeat('same', 6), // Days 1-7: 75 mg (down from 100 mg)
    'decrease', ...repeat('same', 6), // Days 8-14: 50 mg
    'decrease', ...repeat('same', 6), // Days 15-21: 25 mg
    'stop', ...repeat('stopped', 6), // Days 22-28: none
  ]);
  assert.deepEqual(statusesOf(s, 1), [
    ...repeat('not-started', 7),
    'start', ...repeat('same', 6), // Days 8-14: 5 mg
    'increase', ...repeat('same', 6), // Days 15-21: 10 mg
    'increase', ...repeat('same', 6), // Days 22-28: 20 mg
  ]);
  assert.deepEqual(s.changeDays, [1, 8, 15, 22]);
  assert.deepEqual(
    s.days.filter((d) => d.isChangeDay).map((d) => d.day),
    [1, 8, 15, 22],
  );
});

test('overlap plan: doses and tablets', () => {
  const s = buildSchedule(overlapPlan());
  assert.deepEqual(cell(s, 1, 0), {
    name: 'Drug A',
    status: 'decrease',
    doses: { morning: 75 },
    totalMg: 75,
    tablets: {
      morning: {
        exact: true,
        pieces: 2,
        items: [
          { strengthMg: 50, whole: 1, halves: 0 },
          { strengthMg: 25, whole: 1, halves: 0 },
        ],
      },
    },
  });
  assert.deepEqual(cell(s, 1, 1), {
    name: 'Drug B',
    status: 'not-started',
    doses: { morning: 0 },
    totalMg: 0,
    tablets: { morning: NO_TABLETS },
  });
  assert.deepEqual(cell(s, 8, 1).tablets.morning, {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 10, whole: 0, halves: 1 }],
  });
  assert.deepEqual(cell(s, 15, 0).tablets.morning.items, [{ strengthMg: 25, whole: 1, halves: 0 }]);
  assert.deepEqual(cell(s, 22, 0).doses, { morning: 0 });
  assert.deepEqual(cell(s, 22, 1).doses, { morning: 20 });
  assert.deepEqual(cell(s, 22, 1).tablets.morning.items, [{ strengthMg: 10, whole: 2, halves: 0 }]);
});

test('overlap plan: drug summary and warnings', () => {
  const s = buildSchedule(overlapPlan());
  assert.deepEqual(s.drugs, [
    { name: 'Drug A', times: ['morning'], continuesAfterCalendar: false, lastDoseDay: 21 },
    { name: 'Drug B', times: ['morning'], continuesAfterCalendar: true, lastDoseDay: null },
  ]);
  assert.deepEqual(s.warnings, []);
});

test('washout plan: twice-daily doses, the end of February, and a gap with no medication', () => {
  const s = buildSchedule(washoutPlan());
  assert.equal(s.totalDays, 13);
  assert.equal(s.endDate, '2027-03-09');
  assert.equal(s.days[3].date, '2027-02-28');
  assert.equal(s.days[4].date, '2027-03-01');
  assert.deepEqual(statusesOf(s, 0), [
    'decrease', 'same', 'same', // Days 1-3: 50 + 50 (down from 50 + 100)
    'decrease', 'same', 'same', // Days 4-6: bedtime 50 only
    'stop', ...repeat('stopped', 6),
  ]);
  assert.deepEqual(statusesOf(s, 1), [...repeat('not-started', 9), 'start', 'same', 'same', 'same']);
  assert.deepEqual(cell(s, 1, 0).doses, { morning: 50, bedtime: 50 });
  assert.equal(cell(s, 1, 0).totalMg, 100);
  assert.deepEqual(cell(s, 4, 0).doses, { morning: 0, bedtime: 50 });
  assert.deepEqual(cell(s, 4, 0).tablets, {
    morning: NO_TABLETS,
    bedtime: { exact: true, pieces: 1, items: [{ strengthMg: 50, whole: 1, halves: 0 }] },
  });
  assert.deepEqual(s.changeDays, [1, 4, 7, 10]);
  assert.deepEqual(
    s.warnings.map(({ code, fromDay, toDay }) => ({ code, fromDay, toDay })),
    [{ code: 'NO_MEDICATION_DAYS', fromDay: 7, toDay: 9 }],
  );
  assert.deepEqual(
    s.drugs.map((d) => d.lastDoseDay),
    [6, null],
  );
});

test('redistribute plan: same total split differently is an adjust day, and decimals stay exact', () => {
  const s = buildSchedule(redistributePlan());
  assert.equal(s.totalDays, 7);
  assert.deepEqual(
    s.days.map((d) => d.date),
    ['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15', '2027-03-16', '2027-03-17', '2027-03-18'],
  );
  assert.deepEqual(
    s.days.map((d) => d.weekday),
    [5, 6, 0, 1, 2, 3, 4],
  );
  assert.deepEqual(statusesOf(s, 0), ['adjust', 'same', 'decrease', 'same', 'decrease', 'same', 'stop']);
  assert.deepEqual(
    s.days.map((d) => d.drugs[0].totalMg),
    [1, 1, 0.5, 0.5, 0.25, 0.25, 0],
  );
  assert.deepEqual(cell(s, 1, 0).doses, { morning: 0, bedtime: 1 });
  assert.deepEqual(cell(s, 5, 0).tablets.bedtime, {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 0.5, whole: 0, halves: 1 }],
  });
  assert.deepEqual(s.changeDays, [1, 3, 5, 7]);
  assert.equal(s.drugs[0].lastDoseDay, 6);
  assert.deepEqual(s.warnings, []);
});

test('totals are compared exactly: 0.1 mg + 0.2 mg is the same as 0.3 mg', () => {
  // In floating point, 0.1 + 0.2 is 0.30000000000000004. Doing the math in
  // whole micrograms (100 + 200 = 300) makes Day 1 an adjust day, not a decrease.
  const plan = {
    version: 1,
    startDate: '2026-11-02',
    drugs: [
      {
        name: 'Drug E',
        times: ['morning', 'bedtime'],
        strengths: [{ mg: 0.1, splittable: false }],
        alreadyTaking: true,
        currentDoses: { morning: 0.1, bedtime: 0.2 },
        startDay: 1,
        steps: [{ days: 2, doses: { morning: 0.3 } }],
        afterLastStep: 'continue',
      },
    ],
  };
  const s = buildSchedule(plan);
  assert.deepEqual(statusesOf(s, 0), ['adjust', 'same']);
  assert.equal(cell(s, 1, 0).totalMg, 0.3);
  assert.deepEqual(cell(s, 1, 0).tablets.morning.items, [{ strengthMg: 0.1, whole: 3, halves: 0 }]);
});

test('restart plan: a planned day off, then a restart', () => {
  const s = buildSchedule(restartPlan());
  assert.equal(s.totalDays, 5);
  assert.deepEqual(statusesOf(s, 0), ['start', 'same', 'stop', 'restart', 'same']);
  assert.deepEqual(s.changeDays, [1, 3, 4]);
  assert.deepEqual(s.drugs, [
    { name: 'Drug D', times: ['evening'], continuesAfterCalendar: true, lastDoseDay: null },
  ]);
});

test('year-boundary plan: a continuing drug keeps its last dose after its steps end', () => {
  const s = buildSchedule(yearBoundaryPlan());
  assert.equal(s.totalDays, 26); // Drug A's stop day
  assert.equal(s.endDate, '2027-01-22');
  assert.equal(s.days[4].date, '2027-01-01');
  assert.equal(cell(s, 1, 0).status, 'same'); // already taking 300 mg; the first step is still 300 mg
  assert.equal(cell(s, 1, 1).status, 'start');
  assert.equal(cell(s, 5, 1).status, 'increase');
  for (let day = 11; day <= 26; day += 1) {
    assert.equal(cell(s, day, 1).status, 'same', `Drug B on Day ${day}`);
    assert.deepEqual(cell(s, day, 1).doses, { morning: 10 }, `Drug B on Day ${day}`);
  }
  assert.deepEqual(s.changeDays, [1, 5, 11, 16, 21, 26]);
  assert.deepEqual(cell(s, 1, 0).tablets.bedtime, {
    exact: true,
    pieces: 3,
    items: [{ strengthMg: 100, whole: 3, halves: 0 }],
  });
  assert.deepEqual(cell(s, 21, 0).tablets.bedtime.items, [{ strengthMg: 25, whole: 1, halves: 0 }]);
  assert.deepEqual(s.drugs, [
    { name: 'Drug A', times: ['bedtime'], continuesAfterCalendar: false, lastDoseDay: 25 },
    { name: 'Drug B', times: ['morning'], continuesAfterCalendar: true, lastDoseDay: null },
  ]);
});

test('every day lists every drug in plan order, with every administration time', () => {
  for (const make of ALL_EXAMPLES) {
    const plan = make();
    const s = buildSchedule(plan);
    for (const day of s.days) {
      assert.deepEqual(
        day.drugs.map((d) => d.name),
        plan.drugs.map((d) => d.name),
      );
      day.drugs.forEach((d, i) => {
        assert.deepEqual(Object.keys(d.doses).sort(), [...plan.drugs[i].times].sort());
        assert.deepEqual(Object.keys(d.tablets).sort(), [...plan.drugs[i].times].sort());
      });
    }
  }
});

test('trims drug names in the output', () => {
  const plan = overlapPlan();
  plan.drugs[0].name = '  Drug A  ';
  const s = buildSchedule(plan);
  assert.equal(cell(s, 1, 0).name, 'Drug A');
  assert.equal(s.drugs[0].name, 'Drug A');
});

test('warnings are the same ones validatePlan reports', () => {
  for (const make of ALL_EXAMPLES) {
    assert.deepEqual(buildSchedule(make()).warnings, validatePlan(make()).warnings, make.name);
  }
});

test('does not change the plan, and gives the same result every time', () => {
  const plan = yearBoundaryPlan();
  const before = structuredClone(plan);
  const first = buildSchedule(plan);
  assert.deepEqual(plan, before);
  assert.deepEqual(buildSchedule(plan), first);
});

test('days do not share objects, so changing one day cannot change another', () => {
  const s = buildSchedule(overlapPlan());
  s.days[1].drugs[0].tablets.morning.items.push({ strengthMg: 999, whole: 1, halves: 0 });
  s.days[1].drugs[0].doses.morning = 999;
  assert.equal(s.days[2].drugs[0].tablets.morning.items.length, 2);
  assert.equal(s.days[2].drugs[0].doses.morning, 75);
});
