// Checks a plan before anything is built from it.
// Spec: SPEC.md sections 3, 4, 7, and 8. Tests: tests/validate.test.js.
// Milestone 1: replace "Not implemented yet" with real code until the tests pass.

/**
 * @typedef {{ code: string, path: string, message: string, [extra: string]: unknown }} Issue
 */

/** Thrown by buildSchedule when a plan has errors. Already complete. */
export class PlanValidationError extends Error {
  /** @param {Issue[]} errors */
  constructor(errors) {
    super(`The plan has ${errors.length} error(s): ${errors.map((e) => e.code).join(', ')}`);
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

/**
 * Checks a plan. Never throws and never changes the plan.
 * Warnings are only computed when there are no errors.
 *
 * @param {unknown} plan
 * @returns {{ errors: Issue[], warnings: Issue[] }}
 */
export function validatePlan(plan) {
  throw new Error('Not implemented yet: validatePlan (SPEC.md section 8)');
}
