import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveTablets } from '../src/tablets.js';
import { MAX_PIECES } from '../src/constants.js';

const scored = (mg) => ({ mg, splittable: true });
const plain = (mg) => ({ mg, splittable: false });

test('a zero dose needs no tablets', () => {
  assert.deepEqual(solveTablets(0, [plain(50)]), { exact: true, pieces: 0, items: [] });
});

test('uses the fewest pieces', () => {
  // 100 mg: one 100 mg tablet (1 piece) beats two 50 mg tablets (2 pieces).
  assert.deepEqual(solveTablets(100, [plain(50), plain(100)]), {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 100, whole: 1, halves: 0 }],
  });
});

test('fewest pieces wins even when that skips the largest strength', () => {
  // 50 mg: 25 + 25 (2 pieces) beats 30 + 10 + 10 (3 pieces).
  assert.deepEqual(solveTablets(50, [plain(30), plain(25), plain(10)]), {
    exact: true,
    pieces: 2,
    items: [{ strengthMg: 25, whole: 2, halves: 0 }],
  });
});

test('fewer pieces beats avoiding a split', () => {
  // 30 mg: 20 + half of a 20 (2 pieces, one split) beats 20 + 5 + 5 (3 pieces).
  // A prescriber who does not want splitting marks the tablet as not splittable.
  assert.deepEqual(solveTablets(30, [scored(20), plain(5)]), {
    exact: true,
    pieces: 2,
    items: [{ strengthMg: 20, whole: 1, halves: 1 }],
  });
});

test('prefers whole tablets over splitting when the piece count ties', () => {
  // 75 mg: 50 + 25 (2 pieces, no split) beats 50 + half of a 50 (2 pieces, one split).
  assert.deepEqual(solveTablets(75, [scored(50), plain(25)]), {
    exact: true,
    pieces: 2,
    items: [
      { strengthMg: 50, whole: 1, halves: 0 },
      { strengthMg: 25, whole: 1, halves: 0 },
    ],
  });
  // 25 mg: one 25 mg tablet beats half of a 50 mg tablet.
  assert.deepEqual(solveTablets(25, [scored(50), plain(25)]), {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 25, whole: 1, halves: 0 }],
  });
});

test('splits a scored tablet when that is the way to make the dose', () => {
  assert.deepEqual(solveTablets(5, [scored(10)]), {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 10, whole: 0, halves: 1 }],
  });
  // 15 mg: one whole + one half (2 pieces) beats three halves (3 pieces).
  assert.deepEqual(solveTablets(15, [scored(10)]), {
    exact: true,
    pieces: 2,
    items: [{ strengthMg: 10, whole: 1, halves: 1 }],
  });
  assert.deepEqual(solveTablets(62.5, [scored(25)]), {
    exact: true,
    pieces: 3,
    items: [{ strengthMg: 25, whole: 2, halves: 1 }],
  });
});

test('never splits a tablet that is not marked splittable', () => {
  assert.deepEqual(solveTablets(30, [plain(20)]), { exact: false, pieces: 0, items: [] });
  assert.deepEqual(solveTablets(5, [plain(10)]), { exact: false, pieces: 0, items: [] });
});

test('breaks remaining ties by using larger strengths', () => {
  // 40 mg: 30 + 10 and 20 + 20 are both 2 whole tablets. The larger strength wins.
  assert.deepEqual(solveTablets(40, [plain(10), plain(20), plain(30)]), {
    exact: true,
    pieces: 2,
    items: [
      { strengthMg: 30, whole: 1, halves: 0 },
      { strengthMg: 10, whole: 1, halves: 0 },
    ],
  });
});

test('handles small decimal strengths exactly', () => {
  assert.deepEqual(solveTablets(0.25, [scored(0.5), scored(1)]), {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 0.5, whole: 0, halves: 1 }],
  });
  assert.deepEqual(solveTablets(1, [scored(0.5), scored(1)]), {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 1, whole: 1, halves: 0 }],
  });
  // In floating point 0.1 + 0.1 + 0.1 is not exactly 0.3. The solver must still find it.
  assert.deepEqual(solveTablets(0.3, [plain(0.1)]), {
    exact: true,
    pieces: 3,
    items: [{ strengthMg: 0.1, whole: 3, halves: 0 }],
  });
  assert.deepEqual(solveTablets(12.5, [scored(25), plain(12.5)]), {
    exact: true,
    pieces: 1,
    items: [{ strengthMg: 12.5, whole: 1, halves: 0 }],
  });
  // 2.01 * 1000 is not exactly 2010 in floating point, so convert with rounding.
  assert.deepEqual(solveTablets(2.01, [plain(0.67)]), {
    exact: true,
    pieces: 3,
    items: [{ strengthMg: 0.67, whole: 3, halves: 0 }],
  });
});

test(`gives up above ${MAX_PIECES} pieces`, () => {
  assert.equal(MAX_PIECES, 12);
  assert.deepEqual(solveTablets(120, [plain(10)]), {
    exact: true,
    pieces: 12,
    items: [{ strengthMg: 10, whole: 12, halves: 0 }],
  });
  assert.deepEqual(solveTablets(130, [plain(10)]), { exact: false, pieces: 0, items: [] });
});

test('the order the strengths are listed in does not matter', () => {
  const a = solveTablets(175, [plain(25), plain(50), plain(100)]);
  const b = solveTablets(175, [plain(100), plain(25), plain(50)]);
  assert.deepEqual(a, b);
  assert.deepEqual(a, {
    exact: true,
    pieces: 3,
    items: [
      { strengthMg: 100, whole: 1, halves: 0 },
      { strengthMg: 50, whole: 1, halves: 0 },
      { strengthMg: 25, whole: 1, halves: 0 },
    ],
  });
});

test('rejects impossible dose or strength values', () => {
  assert.throws(() => solveTablets(-5, [plain(10)]), RangeError);
  assert.throws(() => solveTablets(Number.NaN, [plain(10)]), RangeError);
  assert.throws(() => solveTablets(1.2345, [plain(10)]), RangeError);
  assert.throws(() => solveTablets(10, [plain(0)]), RangeError);
  assert.throws(() => solveTablets(10, [plain(2.0001)]), RangeError);
});

test('does not change the strengths array it is given', () => {
  const strengths = [plain(25), scored(50)];
  const before = structuredClone(strengths);
  solveTablets(75, strengths);
  assert.deepEqual(strengths, before);
});
