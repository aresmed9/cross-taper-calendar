import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidISODate, addDays, weekdayIndex } from '../src/dates.js';

test('isValidISODate accepts real calendar dates written as YYYY-MM-DD', () => {
  assert.equal(isValidISODate('2026-11-02'), true);
  assert.equal(isValidISODate('2028-02-29'), true); // 2028 is a leap year
  assert.equal(isValidISODate('2000-02-29'), true); // divisible by 400, so a leap year
  assert.equal(isValidISODate('2026-12-31'), true);
});

test('isValidISODate rejects impossible dates and every other format', () => {
  const bad = [
    '2026-02-29', // 2026 is not a leap year
    '1900-02-29', // divisible by 100 but not 400, so not a leap year
    '2026-02-30',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-11-00',
    '2026-1-5',
    '26-11-02',
    '2026/11/02',
    '11/02/2026',
    '2026-11-02T00:00',
    ' 2026-11-02',
    '',
    null,
    undefined,
    20261102,
    new Date(Date.UTC(2026, 10, 2)),
  ];
  for (const value of bad) {
    assert.equal(isValidISODate(value), false, `expected ${String(value)} to be invalid`);
  }
});

test('addDays moves across month, year, and leap-day boundaries', () => {
  assert.equal(addDays('2026-11-02', 0), '2026-11-02');
  assert.equal(addDays('2026-11-02', 27), '2026-11-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-12-28', 25), '2027-01-22');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('addDays is not thrown off by daylight saving time', () => {
  // US clocks fall back on 2026-11-01 and spring forward on 2027-03-14.
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(addDays('2027-03-13', 1), '2027-03-14');
  assert.equal(addDays('2027-03-14', 1), '2027-03-15');
  assert.equal(addDays('2027-03-01', 30), '2027-03-31');
});

test('addDays rejects an invalid date or a non-integer number of days', () => {
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
  assert.throws(() => addDays('next week', 1), RangeError);
  assert.throws(() => addDays('2026-11-02', 1.5), RangeError);
  assert.throws(() => addDays('2026-11-02', Number.NaN), RangeError);
  assert.throws(() => addDays('2026-11-02', '1'), RangeError);
});

test('weekdayIndex counts 0 for Sunday through 6 for Saturday', () => {
  assert.equal(weekdayIndex('2026-11-01'), 0); // Sunday
  assert.equal(weekdayIndex('2026-11-02'), 1); // Monday
  assert.equal(weekdayIndex('2027-03-09'), 2); // Tuesday
  assert.equal(weekdayIndex('2028-02-29'), 2); // Tuesday
  assert.equal(weekdayIndex('2027-02-25'), 4); // Thursday
  assert.equal(weekdayIndex('2027-03-12'), 5); // Friday
  assert.equal(weekdayIndex('2027-01-02'), 6); // Saturday
});

test('weekdayIndex rejects an invalid date', () => {
  assert.throws(() => weekdayIndex('2026-02-30'), RangeError);
  assert.throws(() => weekdayIndex(undefined), RangeError);
});
