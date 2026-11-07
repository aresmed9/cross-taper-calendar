// Checks a plan before anything is built from it.
// Spec: SPEC.md sections 3, 4, 7, and 8. Tests: tests/validate.test.js.

import {
  PLAN_VERSION,
  TIMES,
  MAX_DRUGS,
  MAX_NAME_LENGTH,
  MAX_STRENGTHS,
  MAX_STEPS,
  MAX_STEP_DAYS,
  MAX_START_DAY,
  MAX_CALENDAR_DAYS,
  MAX_MG,
  WARN_PIECES,
} from './constants.js';
import { isValidISODate } from './dates.js';
import { solveTablets } from './tablets.js';
import { toThousandths } from './mg.js';
import { lastCalendarDay, dosesOnDay } from './doses.js';

/**
 * @typedef {{ code: string, path: string, message: string, [extra: string]: unknown }} Issue
 */

/** Thrown by buildSchedule when a plan has errors. */
export class PlanValidationError extends Error {
  /** @param {Issue[]} errors */
  constructor(errors) {
    super(`The plan has ${errors.length} error(s): ${errors.map((e) => e.code).join(', ')}`);
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

// The only fields each level of the plan may have (SPEC section 3).
// Anything else is rejected, which keeps patient identifiers out.
const PLAN_FIELDS = ['version', 'startDate', 'drugs'];
const DRUG_FIELDS = [
  'name',
  'times',
  'strengths',
  'alreadyTaking',
  'currentDoses',
  'startDay',
  'steps',
  'afterLastStep',
];
const STRENGTH_FIELDS = ['mg', 'splittable'];
const STEP_FIELDS = ['days', 'doses'];

/**
 * Checks a plan. Never throws and never changes the plan.
 * Warnings are only computed when there are no errors.
 *
 * @param {unknown} plan
 * @returns {{ errors: Issue[], warnings: Issue[] }}
 */
export function validatePlan(plan) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(plan)) {
    errors.push(issue('PLAN_NOT_OBJECT', '', 'The plan must be an object.'));
    return { errors, warnings };
  }

  checkUnknownFields(plan, PLAN_FIELDS, '', errors);
  if (plan.version !== PLAN_VERSION) {
    errors.push(issue('VERSION_UNSUPPORTED', 'version', `The plan version must be ${PLAN_VERSION}.`));
  }
  if (!isValidISODate(plan.startDate)) {
    errors.push(issue('START_DATE_INVALID', 'startDate', 'Start date must be a real date written YYYY-MM-DD.'));
  }

  const drugCountOk = Array.isArray(plan.drugs) && plan.drugs.length >= 1 && plan.drugs.length <= MAX_DRUGS;
  if (!drugCountOk) {
    errors.push(issue('DRUG_COUNT', 'drugs', 'Enter one or two drugs.'));
  }

  // Each drug's last calendar day, for the drugs whose timing fields are valid.
  const calendarEnds = [];
  if (drugCountOk) {
    const names = [];
    plan.drugs.forEach((drug, index) => {
      if (!isPlainObject(drug)) {
        errors.push(issue('DRUG_INVALID', `drugs[${index}]`, `Drug ${index + 1} must be an object.`));
        return;
      }
      const end = checkDrug(drug, index, names, errors);
      if (end !== null) calendarEnds.push(end);
    });
  }

  if (calendarEnds.length > 0) {
    const longest = Math.max(...calendarEnds);
    if (longest > MAX_CALENDAR_DAYS) {
      errors.push(
        issue('CALENDAR_TOO_LONG', '', `The calendar would be ${longest} days long. The limit is ${MAX_CALENDAR_DAYS}.`),
      );
    }
  }

  // Warnings only make sense for a plan that is otherwise valid.
  if (errors.length === 0) {
    plan.drugs.forEach((drug, index) => {
      warnings.push(...pieceWarnings(drug, index));
    });
    warnings.push(...gapWarnings(plan.drugs, Math.max(...calendarEnds)));
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// One drug
// ---------------------------------------------------------------------------

/**
 * Checks one drug and adds any errors to the list.
 * Returns the drug's last calendar day, or null if its timing fields are not valid enough to say.
 */
function checkDrug(drug, index, names, errors) {
  const p = `drugs[${index}]`;

  checkUnknownFields(drug, DRUG_FIELDS, p, errors);
  checkName(drug.name, index, names, errors);
  const timesOk = checkTimes(drug.times, `${p}.times`, errors);
  const strengthsOk = checkStrengths(drug.strengths, `${p}.strengths`, errors);

  const takingKnown = typeof drug.alreadyTaking === 'boolean';
  if (!takingKnown) {
    errors.push(issue('ALREADY_TAKING_INVALID', `${p}.alreadyTaking`, 'Say whether the patient already takes this drug.'));
  } else {
    checkCurrentDoses(drug, p, timesOk, errors);
  }

  const startDayOk = isIntegerInRange(drug.startDay, 1, MAX_START_DAY);
  if (!startDayOk) {
    errors.push(issue('START_DAY_INVALID', `${p}.startDay`, `Start day must be a whole number from 1 to ${MAX_START_DAY}.`));
  } else if (drug.alreadyTaking === true && drug.startDay !== 1) {
    errors.push(issue('ALREADY_TAKING_START_DAY', `${p}.startDay`, 'A drug the patient is already taking starts on Day 1.'));
  }

  const steps = checkSteps(drug.steps, p, timesOk ? drug.times : null, errors);

  const afterOk = drug.afterLastStep === 'stop' || drug.afterLastStep === 'continue';
  if (!afterOk) {
    errors.push(issue('AFTER_LAST_STEP_INVALID', `${p}.afterLastStep`, "Choose 'stop' or 'continue' after the last step."));
  }

  if (takingKnown && drug.alreadyTaking === false && steps.valid && !steps.anyDose) {
    errors.push(issue('DRUG_HAS_NO_DOSES', `${p}.steps`, 'A drug not yet being taken needs at least one step with a dose above 0.'));
  }

  // Every dose must be made from the tablets listed for this drug.
  if (timesOk && strengthsOk) {
    forEachDose(drug, index, (doseMg, path) => {
      const result = solveTablets(doseMg, drug.strengths);
      if (!result.exact) {
        errors.push(
          issue('DOSE_NOT_MAKEABLE', path, `${doseMg} mg cannot be made from the tablet strengths listed for this drug.`, {
            drug: index,
            doseMg,
          }),
        );
      }
    });
  }

  if (startDayOk && steps.daysValid && afterOk) {
    return lastCalendarDay(drug);
  }
  return null;
}

/** Name: 1 to 60 characters after trimming, no duplicate of an earlier drug (any letter case). */
function checkName(name, index, names, errors) {
  const path = `drugs[${index}].name`;
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    errors.push(issue('DRUG_NAME_INVALID', path, `Drug name must be 1 to ${MAX_NAME_LENGTH} characters.`));
    return;
  }
  const key = trimmed.toLowerCase();
  if (names.includes(key)) {
    errors.push(issue('DRUG_NAME_DUPLICATE', path, 'Two drugs cannot have the same name.'));
    return;
  }
  names.push(key);
}

/** Returns true when times is a non-empty list of allowed times with no repeats. */
function checkTimes(times, path, errors) {
  const ok =
    Array.isArray(times) &&
    times.length > 0 &&
    times.every((time) => TIMES.includes(time)) &&
    new Set(times).size === times.length;
  if (!ok) {
    errors.push(issue('TIMES_INVALID', path, `Choose one or more times: ${TIMES.join(', ')}.`));
  }
  return ok;
}

/** Returns true when every strength is structurally valid. */
function checkStrengths(strengths, path, errors) {
  if (!Array.isArray(strengths) || strengths.length < 1 || strengths.length > MAX_STRENGTHS) {
    errors.push(issue('STRENGTHS_INVALID', path, `Enter between 1 and ${MAX_STRENGTHS} tablet strengths.`));
    return false;
  }
  let valid = true;
  const seenMg = [];
  strengths.forEach((strength, k) => {
    const sp = `${path}[${k}]`;
    if (!isPlainObject(strength)) {
      errors.push(issue('STRENGTHS_INVALID', sp, 'Each tablet strength must be an object.'));
      valid = false;
      return;
    }
    checkUnknownFields(strength, STRENGTH_FIELDS, sp, errors);
    if (!isValidStrengthMg(strength.mg)) {
      errors.push(issue('STRENGTHS_INVALID', `${sp}.mg`, 'Tablet strength must be above 0 and at most 10000 mg, with up to 3 decimals.'));
      valid = false;
    } else if (seenMg.includes(strength.mg)) {
      errors.push(issue('DUPLICATE_STRENGTH', `${sp}.mg`, 'Two tablet strengths cannot have the same mg.'));
    } else {
      seenMg.push(strength.mg);
    }
    if (typeof strength.splittable !== 'boolean') {
      errors.push(issue('STRENGTHS_INVALID', `${sp}.splittable`, 'Say yes or no: can this tablet be cut in half?'));
      valid = false;
    }
  });
  return valid;
}

/**
 * Checks alreadyTaking's partner field, currentDoses.
 * It is required when the patient already takes the drug, and not allowed otherwise.
 * `timesOk` says whether the drug's times are valid, which the key check needs.
 */
function checkCurrentDoses(drug, p, timesOk, errors) {
  const path = `${p}.currentDoses`;
  if (drug.alreadyTaking !== true) {
    if (drug.currentDoses !== undefined) {
      errors.push(issue('CURRENT_DOSES_INVALID', path, 'Current doses are only for a drug the patient already takes.'));
    }
    return;
  }
  if (!isPlainObject(drug.currentDoses)) {
    errors.push(issue('CURRENT_DOSES_INVALID', path, 'Enter the dose taken before Day 1 for each time.'));
    return;
  }
  let valid = true;
  for (const key of Object.keys(drug.currentDoses)) {
    const value = drug.currentDoses[key];
    const keyOk = !timesOk || drug.times.includes(key);
    if (!keyOk) {
      errors.push(issue('CURRENT_DOSES_INVALID', `${path}.${key}`, `"${key}" is not one of this drug's times.`));
      valid = false;
    } else if (!isValidDose(value)) {
      errors.push(issue('CURRENT_DOSES_INVALID', `${path}.${key}`, doseMessage()));
      valid = false;
    }
  }
  if (valid && timesOk && !Object.values(drug.currentDoses).some((mg) => mg > 0)) {
    errors.push(issue('CURRENT_DOSES_INVALID', path, 'The current doses must add up to more than 0 mg.'));
  }
}

/**
 * Checks the steps list.
 * `times` is the drug's list of times, or null when the times are not valid
 * (then the time keys of each step's doses are not checked).
 * Returns what the caller needs to know about the steps.
 */
function checkSteps(steps, p, times, errors) {
  const path = `${p}.steps`;
  const result = { valid: false, daysValid: false, anyDose: false };
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > MAX_STEPS) {
    errors.push(issue('STEPS_INVALID', path, `Enter between 1 and ${MAX_STEPS} steps.`));
    return result;
  }

  let valid = true;
  let daysValid = true;
  let anyDose = false;
  steps.forEach((step, j) => {
    const sp = `${path}[${j}]`;
    if (!isPlainObject(step)) {
      errors.push(issue('STEPS_INVALID', sp, `Step ${j + 1} must be an object.`));
      valid = false;
      daysValid = false;
      return;
    }
    checkUnknownFields(step, STEP_FIELDS, sp, errors);
    if (!isIntegerInRange(step.days, 1, MAX_STEP_DAYS)) {
      errors.push(issue('STEPS_INVALID', `${sp}.days`, `Days must be a whole number from 1 to ${MAX_STEP_DAYS}.`));
      valid = false;
      daysValid = false;
    }
    if (!isPlainObject(step.doses)) {
      errors.push(issue('STEPS_INVALID', `${sp}.doses`, 'Enter a dose for each time of this step.'));
      valid = false;
      return;
    }
    for (const key of Object.keys(step.doses)) {
      const value = step.doses[key];
      const keyOk = times === null || times.includes(key);
      if (!keyOk) {
        errors.push(issue('STEPS_INVALID', `${sp}.doses.${key}`, `"${key}" is not one of this drug's times.`));
        valid = false;
      } else if (!isValidDose(value)) {
        errors.push(issue('STEPS_INVALID', `${sp}.doses.${key}`, doseMessage()));
        valid = false;
      } else if (value > 0) {
        anyDose = true;
      }
    }
  });
  return { valid, daysValid, anyDose };
}

/**
 * Calls visit(doseMg, path) once for each distinct dose above 0 that this drug uses.
 * The order is: current doses first, then steps in order, times in the drug's order.
 * The path is where the dose first appears. Only call this for drugs whose times are valid.
 */
function forEachDose(drug, index, visit) {
  const base = `drugs[${index}]`;
  const sources = [];
  if (drug.alreadyTaking === true && isPlainObject(drug.currentDoses)) {
    sources.push([drug.currentDoses, `${base}.currentDoses`]);
  }
  if (Array.isArray(drug.steps)) {
    drug.steps.forEach((step, j) => {
      if (isPlainObject(step) && isPlainObject(step.doses)) {
        sources.push([step.doses, `${base}.steps[${j}].doses`]);
      }
    });
  }

  const seen = new Set();
  for (const [doses, sourcePath] of sources) {
    for (const time of drug.times) {
      const value = doses[time];
      if (!isValidDose(value) || value === 0 || seen.has(value)) continue;
      seen.add(value);
      visit(value, `${sourcePath}.${time}`);
    }
  }
}

/** MANY_PIECES warnings for one drug: doses that need more than WARN_PIECES pieces. */
function pieceWarnings(drug, index) {
  const found = [];
  forEachDose(drug, index, (doseMg, path) => {
    const { exact, pieces } = solveTablets(doseMg, drug.strengths);
    if (exact && pieces > WARN_PIECES) {
      found.push(
        issue('MANY_PIECES', path, `${doseMg} mg needs ${pieces} tablet pieces. Check that this is intended.`, {
          drug: index,
          doseMg,
          pieces,
        }),
      );
    }
  });
  return found;
}

/**
 * NO_MEDICATION_DAYS warnings: runs of days with no drug taken, where dosing
 * happens both before the run and after it. A current dose counts as dosing before Day 1.
 */
function gapWarnings(drugs, totalDays) {
  const takenOn = [false];
  let lastTakenDay = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const taken = drugs.some((drug) => Object.values(dosesOnDay(drug, day)).some((mg) => mg > 0));
    takenOn[day] = taken;
    if (taken) lastTakenDay = day;
  }

  const found = [];
  let dosedBefore = drugs.some((drug) => drug.alreadyTaking === true);
  let day = 1;
  while (day <= totalDays) {
    if (takenOn[day]) {
      dosedBefore = true;
      day += 1;
      continue;
    }
    const fromDay = day;
    while (day <= totalDays && !takenOn[day]) day += 1;
    const toDay = day - 1;
    if (dosedBefore && toDay < lastTakenDay) {
      found.push(issue('NO_MEDICATION_DAYS', '', `No medication from Day ${fromDay} to Day ${toDay}.`, { fromDay, toDay }));
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Makes an issue object with the fields every issue has, plus any extra ones. */
function issue(code, path, message, extra = {}) {
  return { code, path, message, ...extra };
}

/** True for a plain object (not an array, Date, or null). */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** True for a whole number from min to max, inclusive. */
function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** A dose: 0 or more, at most MAX_MG, with at most 3 decimals. */
function isValidDose(value) {
  return toThousandths(value) !== null && value >= 0 && value <= MAX_MG;
}

/** The message for a dose that is not valid. */
function doseMessage() {
  return `A dose must be a number from 0 to ${MAX_MG} mg, with up to 3 decimals.`;
}

/** A tablet strength: above 0, at most MAX_MG, with at most 3 decimals. */
function isValidStrengthMg(value) {
  return toThousandths(value) !== null && value > 0 && value <= MAX_MG;
}

/** Reports every field that is not in allowedFields. p is the path of the object ('' for the plan). */
function checkUnknownFields(obj, allowedFields, p, errors) {
  for (const key of Object.keys(obj)) {
    if (!allowedFields.includes(key)) {
      const path = p === '' ? key : `${p}.${key}`;
      errors.push(issue('UNKNOWN_FIELD', path, `"${key}" is not a field this tool accepts. Remove it.`));
    }
  }
}
