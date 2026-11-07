// Turns a valid plan into the day-by-day calendar.
// Spec: SPEC.md sections 4, 5, 6, and 9. Tests: tests/schedule.test.js.

import { PlanValidationError, validatePlan } from './validate.js';
import { addDays, weekdayIndex } from './dates.js';
import { solveTablets } from './tablets.js';
import { toThousandths } from './mg.js';
import { dosesOnDay, lastCalendarDay } from './doses.js';
import { CHANGE_STATUSES } from './constants.js';

export { PlanValidationError };

/**
 * Validates the plan, then builds the calendar described in SPEC.md section 9.
 *
 * @param {object} plan
 * @returns {object} the schedule
 * @throws {PlanValidationError} when validatePlan reports errors
 */
export function buildSchedule(plan) {
  const { errors, warnings } = validatePlan(plan);
  if (errors.length > 0) {
    throw new PlanValidationError(errors);
  }

  const totalDays = Math.max(...plan.drugs.map(lastCalendarDay));
  const endDate = addDays(plan.startDate, totalDays - 1);

  // Per-drug running state, used to work out each day's status.
  const states = plan.drugs.map((drug) => ({
    times: [...drug.times],
    // Doses on the day before, in thousandths of a mg. Before Day 1 this is currentDoses.
    previous: Object.fromEntries(
      drug.times.map((time) => [time, drug.alreadyTaking ? toThousandths(drug.currentDoses[time] ?? 0) : 0]),
    ),
    // True once the drug has been taken (from currentDoses, or from an earlier day).
    everTaken: drug.alreadyTaking === true,
    tabletsFor: tabletCache(drug.strengths),
  }));

  const days = [];
  const changeDays = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const date = addDays(plan.startDate, day - 1);
    let isChangeDay = false;

    const drugsToday = plan.drugs.map((drug, i) => {
      const state = states[i];
      const doses = dosesOnDay(drug, day);
      const current = Object.fromEntries(drug.times.map((time) => [time, toThousandths(doses[time])]));
      const status = statusFor(state.previous, current, state.times, state.everTaken);
      if (CHANGE_STATUSES.includes(status)) isChangeDay = true;

      const totalUnits = sumValues(current, state.times);
      state.everTaken = state.everTaken || totalUnits > 0;
      state.previous = current;

      return {
        name: drug.name.trim(),
        status,
        doses: { ...doses },
        totalMg: totalUnits / 1000,
        tablets: Object.fromEntries(drug.times.map((time) => [time, state.tabletsFor(doses[time])])),
      };
    });

    if (isChangeDay) changeDays.push(day);
    days.push({
      day,
      date,
      weekday: weekdayIndex(date),
      isChangeDay,
      drugs: drugsToday,
    });
  }

  const drugs = plan.drugs.map((drug, i) => {
    const continuesAfterCalendar =
      drug.afterLastStep === 'continue' &&
      Object.values(drug.steps[drug.steps.length - 1].doses).some((mg) => mg > 0);
    return {
      name: drug.name.trim(),
      times: [...drug.times],
      continuesAfterCalendar,
      lastDoseDay: continuesAfterCalendar ? null : lastDoseDayOf(days, i),
    };
  });

  return {
    startDate: plan.startDate,
    endDate,
    totalDays,
    changeDays,
    days,
    drugs,
    warnings,
  };
}

/**
 * The status of one drug on one day (SPEC section 6).
 * Amounts are whole thousandths of a mg, so the comparisons are exact.
 */
function statusFor(previous, current, times, everTaken) {
  const previousTotal = sumValues(previous, times);
  const currentTotal = sumValues(current, times);

  if (currentTotal === 0) {
    if (previousTotal > 0) return 'stop';
    return everTaken ? 'stopped' : 'not-started';
  }
  if (previousTotal === 0) return everTaken ? 'restart' : 'start';
  if (currentTotal > previousTotal) return 'increase';
  if (currentTotal < previousTotal) return 'decrease';
  const sameEachTime = times.every((time) => previous[time] === current[time]);
  return sameEachTime ? 'same' : 'adjust';
}

/** Adds up the amounts for the given times. */
function sumValues(amounts, times) {
  return times.reduce((sum, time) => sum + amounts[time], 0);
}

/** The last day with a dose above 0 for drug number i, or null if there is none. */
function lastDoseDayOf(days, i) {
  for (let k = days.length - 1; k >= 0; k -= 1) {
    if (days[k].drugs[i].totalMg > 0) return days[k].day;
  }
  return null;
}

/**
 * Returns a function that works out the tablets for one dose of this drug.
 * It remembers answers, so a dose repeated on many days is only worked out once.
 * Each answer is copied, so no two days share an object.
 */
function tabletCache(strengths) {
  const cache = new Map();
  return (doseMg) => {
    if (!cache.has(doseMg)) {
      cache.set(doseMg, solveTablets(doseMg, strengths));
    }
    return structuredClone(cache.get(doseMg));
  };
}
