// Works out how to make one dose from the listed tablet strengths.
// Spec: SPEC.md section 7. Tests: tests/tablets.test.js.
// Milestone 1: replace "Not implemented yet" with real code until the tests pass.

/**
 * @typedef {{ mg: number, splittable: boolean }} Strength
 * @typedef {{ strengthMg: number, whole: number, halves: number }} TabletItem
 * @typedef {{ exact: boolean, pieces: number, items: TabletItem[] }} TabletResult
 */

/**
 * Finds the best way to make doseMg from whole tablets and, for splittable
 * strengths, half tablets: fewest pieces, then fewest halves, then more of the
 * larger strengths. At most MAX_PIECES pieces (see constants.js).
 *
 * @param {number} doseMg dose for one time of day, in mg (at most 3 decimals)
 * @param {Strength[]} strengths available tablet strengths (not changed)
 * @returns {TabletResult}
 * @throws {RangeError} for an invalid dose or strength
 */
export function solveTablets(doseMg, strengths) {
  throw new Error('Not implemented yet: solveTablets (SPEC.md section 7)');
}
