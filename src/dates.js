// Calendar-date helpers. Spec: SPEC.md section 10. Tests: tests/dates.test.js.
// Do all date math in UTC so daylight saving time can never shift a date.

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Splits a YYYY-MM-DD string into numbers, or returns null if it is not a real date.
 * The round-trip through Date.UTC catches impossible dates such as 2026-02-30.
 * @param {unknown} value
 * @returns {{ year: number, month: number, day: number } | null}
 */
function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * True only for a string in YYYY-MM-DD form that names a real calendar date.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidISODate(value) {
  return parseISODate(value) !== null;
}

/**
 * The date n days after isoDate. n may be negative.
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} n whole number of days
 * @returns {string} YYYY-MM-DD
 * @throws {RangeError} for an invalid date or a non-integer n
 */
export function addDays(isoDate, n) {
  const parts = parseISODate(isoDate);
  if (parts === null) {
    throw new RangeError(`Not a valid date: ${String(isoDate)}`);
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`Number of days must be a whole number: ${String(n)}`);
  }
  const start = Date.UTC(parts.year, parts.month - 1, parts.day);
  const result = new Date(start + n * MS_PER_DAY);
  const year = String(result.getUTCFullYear()).padStart(4, '0');
  const month = String(result.getUTCMonth() + 1).padStart(2, '0');
  const day = String(result.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Day of the week: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
 * @param {string} isoDate YYYY-MM-DD
 * @returns {number}
 * @throws {RangeError} for an invalid date
 */
export function weekdayIndex(isoDate) {
  const parts = parseISODate(isoDate);
  if (parts === null) {
    throw new RangeError(`Not a valid date: ${String(isoDate)}`);
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}
