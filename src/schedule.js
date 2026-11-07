// Turns a valid plan into the day-by-day calendar.
// Spec: SPEC.md sections 4, 5, 6, and 9. Tests: tests/schedule.test.js.
// Milestone 1: replace "Not implemented yet" with real code until the tests pass.

import { PlanValidationError } from './validate.js';

export { PlanValidationError };

/**
 * Validates the plan, then builds the calendar described in SPEC.md section 9.
 *
 * @param {object} plan
 * @returns {object} the schedule
 * @throws {PlanValidationError} when validatePlan reports errors
 */
export function buildSchedule(plan) {
  throw new Error('Not implemented yet: buildSchedule (SPEC.md section 9)');
}
