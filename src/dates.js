// Calendar-date helpers. Spec: SPEC.md section 10. Tests: tests/dates.test.js.
// Milestone 1: replace each "Not implemented yet" with real code until the tests pass.
// Do all date math in UTC so daylight saving time can never shift a date.

/**
 * True only for a string in YYYY-MM-DD form that names a real calendar date.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidISODate(value) {
  throw new Error('Not implemented yet: isValidISODate (SPEC.md section 10)');
}

/**
 * The date n days after isoDate. n may be negative.
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} n whole number of days
 * @returns {string} YYYY-MM-DD
 * @throws {RangeError} for an invalid date or a non-integer n
 */
export function addDays(isoDate, n) {
  throw new Error('Not implemented yet: addDays (SPEC.md section 10)');
}

/**
 * Day of the week: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
 * @param {string} isoDate YYYY-MM-DD
 * @returns {number}
 * @throws {RangeError} for an invalid date
 */
export function weekdayIndex(isoDate) {
  throw new Error('Not implemented yet: weekdayIndex (SPEC.md section 10)');
}
