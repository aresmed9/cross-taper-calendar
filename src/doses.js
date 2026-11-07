// Day-by-day dose rules, shared by validate.js and schedule.js.
// Spec: SPEC.md sections 4 and 5. These functions only read the drug; they never change it.

/**
 * The last day a drug's steps run (SPEC section 4).
 * @param {{ startDay: number, steps: { days: number }[] }} drug
 * @returns {number}
 */
export function lastStepDay(drug) {
  const totalStepDays = drug.steps.reduce((sum, step) => sum + step.days, 0);
  return drug.startDay + totalStepDays - 1;
}

/**
 * The last calendar day for a drug: its last step day, plus one more day when it stops.
 * @param {{ startDay: number, steps: { days: number }[], afterLastStep: string }} drug
 * @returns {number}
 */
export function lastCalendarDay(drug) {
  return lastStepDay(drug) + (drug.afterLastStep === 'stop' ? 1 : 0);
}

/**
 * The mg taken at each of the drug's times on one calendar day (SPEC section 5).
 * Every time of the drug is in the result, with 0 where nothing is taken.
 * @param {{ times: string[], startDay: number, steps: object[], afterLastStep: string }} drug
 * @param {number} day Day number, from 1
 * @returns {Record<string, number>}
 */
export function dosesOnDay(drug, day) {
  const result = {};
  for (const time of drug.times) result[time] = 0;

  if (day < drug.startDay) return result;

  let source = null;
  if (day <= lastStepDay(drug)) {
    // Find the step that covers this day.
    let stepStart = drug.startDay;
    for (const step of drug.steps) {
      if (day < stepStart + step.days) {
        source = step;
        break;
      }
      stepStart += step.days;
    }
  } else if (drug.afterLastStep === 'continue') {
    source = drug.steps[drug.steps.length - 1];
  }

  if (source !== null) {
    for (const time of drug.times) {
      result[time] = source.doses[time] ?? 0;
    }
  }
  return result;
}
