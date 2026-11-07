// Example plans used by the tests.
// Each function returns a fresh copy, so a test can change it freely.
// Drug names are placeholders on purpose: these are arithmetic examples,
// not dosing recommendations.

/**
 * Overlapping cross-taper, once daily.
 * Drug A: already taking 100 mg, then 75, 50, 25 mg for 7 days each, then stop.
 * Drug B: starts Day 8 at 5 mg, then 10, 20 mg for 7 days each, then continues.
 */
export function overlapPlan() {
  return {
    version: 1,
    startDate: '2026-11-02',
    drugs: [
      {
        name: 'Drug A',
        times: ['morning'],
        strengths: [
          { mg: 50, splittable: true },
          { mg: 25, splittable: false },
        ],
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
  };
}

/**
 * Taper, gap with no medication, then start. Crosses the end of February 2027.
 * Drug A: already taking 50 mg morning + 100 mg bedtime.
 *   Days 1-3: 50 + 50. Days 4-6: bedtime 50 only. Day 7: stop.
 * Drug B: starts Day 10 at 10 mg (half of a 20 mg tablet), then continues.
 * Days 7-9 have no medication at all.
 */
export function washoutPlan() {
  return {
    version: 1,
    startDate: '2027-02-25',
    drugs: [
      {
        name: 'Drug A',
        times: ['morning', 'bedtime'],
        strengths: [
          { mg: 50, splittable: false },
          { mg: 100, splittable: false },
        ],
        alreadyTaking: true,
        currentDoses: { morning: 50, bedtime: 100 },
        startDay: 1,
        steps: [
          { days: 3, doses: { morning: 50, bedtime: 50 } },
          { days: 3, doses: { bedtime: 50 } },
        ],
        afterLastStep: 'stop',
      },
      {
        name: 'Drug B',
        times: ['morning'],
        strengths: [{ mg: 20, splittable: true }],
        alreadyTaking: false,
        startDay: 10,
        steps: [{ days: 4, doses: { morning: 10 } }],
        afterLastStep: 'continue',
      },
    ],
  };
}

/**
 * One drug, small decimal doses, spanning the 2027-03-14 daylight saving change.
 * Already taking 0.5 mg morning + 0.5 mg bedtime (1 mg total).
 * Days 1-2: 1 mg at bedtime only (same total, different split: "adjust").
 * Days 3-4: 0.5 mg. Days 5-6: 0.25 mg. Day 7: stop.
 */
export function redistributePlan() {
  return {
    version: 1,
    startDate: '2027-03-12',
    drugs: [
      {
        name: 'Drug C',
        times: ['morning', 'bedtime'],
        strengths: [
          { mg: 0.5, splittable: true },
          { mg: 1, splittable: true },
        ],
        alreadyTaking: true,
        currentDoses: { morning: 0.5, bedtime: 0.5 },
        startDay: 1,
        steps: [
          { days: 2, doses: { bedtime: 1 } },
          { days: 2, doses: { bedtime: 0.5 } },
          { days: 2, doses: { bedtime: 0.25 } },
        ],
        afterLastStep: 'stop',
      },
    ],
  };
}

/**
 * A new drug with one planned day off in the middle, then continues.
 * Days 1-2: 10 mg. Day 3: none. Days 4-5: 10 mg.
 */
export function restartPlan() {
  return {
    version: 1,
    startDate: '2026-11-02',
    drugs: [
      {
        name: 'Drug D',
        times: ['evening'],
        strengths: [{ mg: 10, splittable: false }],
        alreadyTaking: false,
        startDay: 1,
        steps: [
          { days: 2, doses: { evening: 10 } },
          { days: 1, doses: { evening: 0 } },
          { days: 2, doses: { evening: 10 } },
        ],
        afterLastStep: 'continue',
      },
    ],
  };
}

/**
 * Starts the new drug first, then tapers the old one. Crosses New Year.
 * Drug A: already taking 300 mg at bedtime. Days 1-10: 300. Days 11-15: 200.
 *   Days 16-20: 100. Days 21-25: 25. Day 26: stop.
 * Drug B: Days 1-4: 5 mg. Days 5-10: 10 mg, then continues at 10 mg.
 */
export function yearBoundaryPlan() {
  return {
    version: 1,
    startDate: '2026-12-28',
    drugs: [
      {
        name: 'Drug A',
        times: ['bedtime'],
        strengths: [
          { mg: 100, splittable: false },
          { mg: 25, splittable: false },
        ],
        alreadyTaking: true,
        currentDoses: { bedtime: 300 },
        startDay: 1,
        steps: [
          { days: 10, doses: { bedtime: 300 } },
          { days: 5, doses: { bedtime: 200 } },
          { days: 5, doses: { bedtime: 100 } },
          { days: 5, doses: { bedtime: 25 } },
        ],
        afterLastStep: 'stop',
      },
      {
        name: 'Drug B',
        times: ['morning'],
        strengths: [{ mg: 5, splittable: false }],
        alreadyTaking: false,
        startDay: 1,
        steps: [
          { days: 4, doses: { morning: 5 } },
          { days: 6, doses: { morning: 10 } },
        ],
        afterLastStep: 'continue',
      },
    ],
  };
}

/** A one-drug plan for a drug the patient is not taking yet. Handy for validation tests. */
export function newDrugPlan({
  strengths = [{ mg: 10, splittable: false }],
  steps = [{ days: 7, doses: { morning: 10 } }],
  afterLastStep = 'continue',
  startDay = 1,
} = {}) {
  return {
    version: 1,
    startDate: '2026-11-02',
    drugs: [
      {
        name: 'Drug N',
        times: ['morning'],
        strengths,
        alreadyTaking: false,
        startDay,
        steps,
        afterLastStep,
      },
    ],
  };
}
