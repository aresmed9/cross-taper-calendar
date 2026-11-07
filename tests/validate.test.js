import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../src/validate.js';
import {
  overlapPlan,
  washoutPlan,
  redistributePlan,
  restartPlan,
  yearBoundaryPlan,
  newDrugPlan,
} from './fixtures.js';

/** Fails unless validatePlan(plan) reports this error code (at this path, if one is given). */
function expectError(plan, code, path) {
  const { errors } = validatePlan(plan);
  const found = errors.some((e) => e.code === code && (path === undefined || e.path === path));
  const where = path === undefined ? '' : ` at "${path}"`;
  assert.ok(found, `expected ${code}${where}, got ${JSON.stringify(errors, null, 2)}`);
}

function expectValid(plan) {
  assert.deepEqual(validatePlan(plan).errors, []);
}

test('all example plans are valid', () => {
  for (const make of [overlapPlan, washoutPlan, redistributePlan, restartPlan, yearBoundaryPlan, newDrugPlan]) {
    assert.deepEqual(validatePlan(make()).errors, [], `${make.name}() should have no errors`);
  }
});

test('every issue has a code, a path, and a readable message', () => {
  const plan = overlapPlan();
  plan.startDate = 'next Monday';
  plan.drugs[0].times = ['noon'];
  plan.drugs[1].steps[0].days = 0;
  const { errors } = validatePlan(plan);
  assert.ok(errors.length >= 3, JSON.stringify(errors, null, 2));
  for (const e of errors) {
    assert.equal(typeof e.code, 'string');
    assert.equal(typeof e.path, 'string');
    assert.equal(typeof e.message, 'string');
    assert.ok(e.message.length > 0);
  }
});

test('collects several errors instead of stopping at the first one', () => {
  const plan = overlapPlan();
  plan.startDate = '2026-02-30';
  plan.dob = '1990-01-01';
  const codes = validatePlan(plan).errors.map((e) => e.code);
  assert.ok(codes.includes('START_DATE_INVALID'));
  assert.ok(codes.includes('UNKNOWN_FIELD'));
});

test('rejects anything that is not a plan object', () => {
  for (const bad of [null, undefined, 42, 'plan', [], new Date()]) {
    expectError(bad, 'PLAN_NOT_OBJECT', '');
  }
});

test('rejects patient identifiers and any other unknown field', () => {
  const a = overlapPlan();
  a.patientName = 'Jane Doe';
  expectError(a, 'UNKNOWN_FIELD', 'patientName');

  const b = overlapPlan();
  b.drugs[0].mrn = '12345';
  expectError(b, 'UNKNOWN_FIELD', 'drugs[0].mrn');

  const c = overlapPlan();
  c.drugs[1].steps[0].note = 'call me';
  expectError(c, 'UNKNOWN_FIELD', 'drugs[1].steps[0].note');

  const d = overlapPlan();
  d.drugs[0].strengths[0].brand = 'X';
  expectError(d, 'UNKNOWN_FIELD', 'drugs[0].strengths[0].brand');
});

test('checks the version and the start date', () => {
  const a = overlapPlan();
  a.version = 2;
  expectError(a, 'VERSION_UNSUPPORTED', 'version');

  const b = overlapPlan();
  delete b.version;
  expectError(b, 'VERSION_UNSUPPORTED', 'version');

  const c = overlapPlan();
  c.startDate = '2026-02-29';
  expectError(c, 'START_DATE_INVALID', 'startDate');

  const d = overlapPlan();
  d.startDate = '11/02/2026';
  expectError(d, 'START_DATE_INVALID', 'startDate');
});

test('needs one or two drugs, each an object', () => {
  const a = overlapPlan();
  a.drugs = [];
  expectError(a, 'DRUG_COUNT', 'drugs');

  const b = overlapPlan();
  b.drugs.push(newDrugPlan().drugs[0]);
  expectError(b, 'DRUG_COUNT', 'drugs');

  const c = overlapPlan();
  delete c.drugs;
  expectError(c, 'DRUG_COUNT', 'drugs');

  const d = overlapPlan();
  d.drugs[1] = 'Drug B';
  expectError(d, 'DRUG_INVALID', 'drugs[1]');
});

test('checks drug names', () => {
  const a = overlapPlan();
  a.drugs[0].name = '   ';
  expectError(a, 'DRUG_NAME_INVALID', 'drugs[0].name');

  const b = overlapPlan();
  b.drugs[0].name = 'x'.repeat(61);
  expectError(b, 'DRUG_NAME_INVALID', 'drugs[0].name');

  const c = overlapPlan();
  c.drugs[1].name = '  drug a ';
  expectError(c, 'DRUG_NAME_DUPLICATE', 'drugs[1].name');

  const ok = overlapPlan();
  ok.drugs[0].name = 'x'.repeat(60);
  expectValid(ok);
});

test('checks administration times', () => {
  for (const times of [[], ['noon'], ['morning', 'morning'], 'morning', undefined]) {
    const plan = overlapPlan();
    plan.drugs[0].times = times;
    expectError(plan, 'TIMES_INVALID', 'drugs[0].times');
  }
});

test('checks tablet strengths', () => {
  const a = overlapPlan();
  a.drugs[0].strengths = [];
  expectError(a, 'STRENGTHS_INVALID', 'drugs[0].strengths');

  const b = overlapPlan();
  b.drugs[0].strengths[0].mg = 0;
  expectError(b, 'STRENGTHS_INVALID', 'drugs[0].strengths[0].mg');

  const c = overlapPlan();
  c.drugs[0].strengths[0].mg = 1.2345;
  expectError(c, 'STRENGTHS_INVALID', 'drugs[0].strengths[0].mg');

  const d = overlapPlan();
  d.drugs[0].strengths[1].splittable = 'yes';
  expectError(d, 'STRENGTHS_INVALID', 'drugs[0].strengths[1].splittable');

  const e = overlapPlan();
  e.drugs[0].strengths.push({ mg: 50, splittable: false });
  expectError(e, 'DUPLICATE_STRENGTH', 'drugs[0].strengths[2].mg');

  const f = overlapPlan();
  f.drugs[1].strengths = [1, 2, 3, 4, 5, 6, 7].map((mg) => ({ mg, splittable: false }));
  expectError(f, 'STRENGTHS_INVALID', 'drugs[1].strengths');
});

test('checks already-taking and current doses', () => {
  const a = overlapPlan();
  delete a.drugs[0].currentDoses;
  expectError(a, 'CURRENT_DOSES_INVALID', 'drugs[0].currentDoses');

  const b = overlapPlan();
  b.drugs[0].currentDoses = { morning: 0 };
  expectError(b, 'CURRENT_DOSES_INVALID', 'drugs[0].currentDoses');

  const c = overlapPlan();
  c.drugs[0].currentDoses = { bedtime: 100 };
  expectError(c, 'CURRENT_DOSES_INVALID', 'drugs[0].currentDoses.bedtime');

  const d = overlapPlan();
  d.drugs[1].currentDoses = { morning: 10 };
  expectError(d, 'CURRENT_DOSES_INVALID', 'drugs[1].currentDoses');

  const e = overlapPlan();
  e.drugs[0].alreadyTaking = 'yes';
  expectError(e, 'ALREADY_TAKING_INVALID', 'drugs[0].alreadyTaking');

  const f = overlapPlan();
  f.drugs[0].startDay = 3;
  expectError(f, 'ALREADY_TAKING_START_DAY', 'drugs[0].startDay');
});

test('checks the start day', () => {
  for (const startDay of [0, 1.5, 366, '8', undefined]) {
    const plan = overlapPlan();
    plan.drugs[1].startDay = startDay;
    expectError(plan, 'START_DAY_INVALID', 'drugs[1].startDay');
  }
});

test('checks steps', () => {
  const a = overlapPlan();
  a.drugs[1].steps = [];
  expectError(a, 'STEPS_INVALID', 'drugs[1].steps');

  const b = overlapPlan();
  b.drugs[1].steps[0].days = 0;
  expectError(b, 'STEPS_INVALID', 'drugs[1].steps[0].days');

  const c = overlapPlan();
  c.drugs[1].steps[0].days = 7.5;
  expectError(c, 'STEPS_INVALID', 'drugs[1].steps[0].days');

  const d = overlapPlan();
  d.drugs[0].steps[0].doses = { bedtime: 75 };
  expectError(d, 'STEPS_INVALID', 'drugs[0].steps[0].doses.bedtime');

  const e = overlapPlan();
  e.drugs[0].steps[2].doses.morning = -25;
  expectError(e, 'STEPS_INVALID', 'drugs[0].steps[2].doses.morning');

  const f = overlapPlan();
  f.drugs[0].steps[1].doses.morning = '50';
  expectError(f, 'STEPS_INVALID', 'drugs[0].steps[1].doses.morning');

  const g = overlapPlan();
  delete g.drugs[0].steps[0].doses;
  expectError(g, 'STEPS_INVALID', 'drugs[0].steps[0].doses');

  const h = overlapPlan();
  h.drugs[1].steps = Array.from({ length: 53 }, () => ({ days: 1, doses: { morning: 10 } }));
  expectError(h, 'STEPS_INVALID', 'drugs[1].steps');
});

test('checks what happens after the last step', () => {
  const plan = overlapPlan();
  plan.drugs[0].afterLastStep = 'taper';
  expectError(plan, 'AFTER_LAST_STEP_INVALID', 'drugs[0].afterLastStep');
});

test('a drug the patient is not taking yet needs at least one real dose', () => {
  const plan = newDrugPlan({
    steps: [
      { days: 7, doses: {} },
      { days: 7, doses: { morning: 0 } },
    ],
  });
  expectError(plan, 'DRUG_HAS_NO_DOSES', 'drugs[0].steps');
});

test('stopping a current drug on Day 1 is allowed', () => {
  const plan = overlapPlan();
  plan.drugs[0].steps = [{ days: 1, doses: {} }];
  const { errors, warnings } = validatePlan(plan);
  assert.deepEqual(errors, []);
  // The current dose before Day 1 counts as earlier dosing, so Days 1-7 are a gap.
  const gap = warnings.find((w) => w.code === 'NO_MEDICATION_DAYS');
  assert.ok(gap, JSON.stringify(warnings, null, 2));
  assert.equal(gap.fromDay, 1);
  assert.equal(gap.toDay, 7);
});

test('limits the calendar to 180 days, counting the stop day', () => {
  expectValid(newDrugPlan({ steps: [{ days: 180, doses: { morning: 10 } }] }));
  expectError(newDrugPlan({ steps: [{ days: 181, doses: { morning: 10 } }] }), 'CALENDAR_TOO_LONG', '');
  expectValid(newDrugPlan({ steps: [{ days: 179, doses: { morning: 10 } }], afterLastStep: 'stop' }));
  expectError(
    newDrugPlan({ steps: [{ days: 180, doses: { morning: 10 } }], afterLastStep: 'stop' }),
    'CALENDAR_TOO_LONG',
    '',
  );
  expectError(newDrugPlan({ startDay: 175, steps: [{ days: 10, doses: { morning: 10 } }] }), 'CALENDAR_TOO_LONG', '');
});

test('flags doses that cannot be made from the listed tablets', () => {
  const plan = newDrugPlan({
    strengths: [{ mg: 20, splittable: false }],
    steps: [
      { days: 7, doses: { morning: 40 } }, // two 20 mg tablets: fine
      { days: 7, doses: { morning: 30 } }, // not possible without splitting
    ],
  });
  expectError(plan, 'DOSE_NOT_MAKEABLE', 'drugs[0].steps[1].doses.morning');

  // 110 mg cannot be made from 50 mg (scored) and 25 mg tablets.
  const current = overlapPlan();
  current.drugs[0].currentDoses = { morning: 110 };
  expectError(current, 'DOSE_NOT_MAKEABLE', 'drugs[0].currentDoses.morning');
});

test('warns when a dose needs more than 4 pieces', () => {
  const plan = newDrugPlan({
    strengths: [{ mg: 10, splittable: false }],
    steps: [
      { days: 7, doses: { morning: 40 } }, // exactly 4 pieces: no warning
      { days: 7, doses: { morning: 50 } }, // 5 pieces: warning
      { days: 7, doses: { morning: 50 } }, // same dose again: no second warning
    ],
  });
  const { errors, warnings } = validatePlan(plan);
  assert.deepEqual(errors, []);
  const many = warnings.filter((w) => w.code === 'MANY_PIECES');
  assert.equal(many.length, 1, JSON.stringify(warnings, null, 2));
  assert.equal(many[0].path, 'drugs[0].steps[1].doses.morning');
  assert.equal(many[0].drug, 0);
  assert.equal(many[0].doseMg, 50);
  assert.equal(many[0].pieces, 5);
});

test('warns about days with no medication between doses', () => {
  const gapsOf = (plan) =>
    validatePlan(plan)
      .warnings.filter((w) => w.code === 'NO_MEDICATION_DAYS')
      .map(({ fromDay, toDay }) => ({ fromDay, toDay }));
  assert.deepEqual(gapsOf(washoutPlan()), [{ fromDay: 7, toDay: 9 }]);
  assert.deepEqual(gapsOf(restartPlan()), [{ fromDay: 3, toDay: 3 }]);
  assert.deepEqual(validatePlan(overlapPlan()).warnings, []);
  // The stop day at the end of a single-drug taper is not a gap: nothing comes after it.
  assert.deepEqual(validatePlan(redistributePlan()).warnings, []);
});

test('only computes warnings for plans without errors', () => {
  const plan = newDrugPlan({
    strengths: [{ mg: 10, splittable: false }],
    steps: [{ days: 7, doses: { morning: 50 } }],
  });
  plan.startDate = 'soon';
  assert.deepEqual(validatePlan(plan).warnings, []);
});

test('does not change the plan it checks', () => {
  const plan = washoutPlan();
  const before = structuredClone(plan);
  validatePlan(plan);
  assert.deepEqual(plan, before);
});
