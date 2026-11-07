// Works out how to make one dose from the listed tablet strengths.
// Spec: SPEC.md section 7. Tests: tests/tablets.test.js.

import { MAX_PIECES } from './constants.js';
import { toThousandths } from './mg.js';

/**
 * @typedef {{ mg: number, splittable: boolean }} Strength
 * @typedef {{ strengthMg: number, whole: number, halves: number }} TabletItem
 * @typedef {{ exact: boolean, pieces: number, items: TabletItem[] }} TabletResult
 */

// Doses and strengths are converted to whole "units" so the search never
// compares floating-point numbers. One mg is 1000 thousandths. Each thousandth
// is multiplied by 4, so a half tablet (which is half of a strength) is still a
// whole number of units. A whole tablet is 4 units per thousandth, a half is 2.
const THOUSANDTHS_TO_UNITS = 4;
const HALF_SCALE = 2;

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
  const doseTh = toThousandths(doseMg);
  if (doseTh === null || doseTh < 0) {
    throw new RangeError(`Dose must be 0 or more, with at most 3 decimals: ${String(doseMg)}`);
  }
  if (doseTh === 0) {
    return { exact: true, pieces: 0, items: [] };
  }

  // Largest strength first. This is the order used for tie-breaking.
  const sorted = strengths
    .map((s) => {
      const th = toThousandths(s.mg);
      if (th === null || th <= 0) {
        throw new RangeError(`Tablet strength must be above 0, with at most 3 decimals: ${String(s.mg)}`);
      }
      return { mg: s.mg, th, splittable: s.splittable === true };
    })
    .sort((a, b) => b.th - a.th);

  // Each "piece type" is one whole tablet or one half tablet of a strength.
  const types = [];
  sorted.forEach((s, strengthIndex) => {
    types.push({ strengthIndex, halves: 0, value: s.th * THOUSANDTHS_TO_UNITS });
    if (s.splittable) {
      types.push({ strengthIndex, halves: 1, value: s.th * HALF_SCALE });
    }
  });
  // Biggest pieces first, so the search can skip pieces that are too big.
  types.sort((a, b) => b.value - a.value);

  const target = doseTh * THOUSANDTHS_TO_UNITS;
  const counts = new Array(types.length).fill(0);
  let best = null;

  /**
   * Keeps the better of two candidate combinations (see SPEC.md section 7).
   * Returns true if the candidate should replace the current best.
   */
  function isBetter(candidate, current) {
    if (current === null) return true;
    if (candidate.pieces !== current.pieces) return candidate.pieces < current.pieces;
    if (candidate.halves !== current.halves) return candidate.halves < current.halves;
    // Compare the largest strengths first. A half counts as half a tablet,
    // so the counts are doubled to keep everything whole.
    for (let i = 0; i < sorted.length; i += 1) {
      if (candidate.doubled[i] !== current.doubled[i]) {
        return candidate.doubled[i] > current.doubled[i];
      }
    }
    return false;
  }

  /** Tries every combination of pieces that adds up to the target. */
  function search(typeFrom, remaining, piecesUsed) {
    if (remaining === 0) {
      const candidate = summarise();
      if (isBetter(candidate, best)) best = candidate;
      return;
    }
    if (piecesUsed === MAX_PIECES) return;
    for (let t = typeFrom; t < types.length; t += 1) {
      const type = types[t];
      if (type.value > remaining) continue;
      counts[t] += 1;
      search(t, remaining - type.value, piecesUsed + 1);
      counts[t] -= 1;
    }
  }

  /** Describes the combination currently in counts[]. */
  function summarise() {
    let pieces = 0;
    let halves = 0;
    const doubled = new Array(sorted.length).fill(0);
    types.forEach((type, t) => {
      const n = counts[t];
      if (n === 0) return;
      pieces += n;
      halves += type.halves * n;
      doubled[type.strengthIndex] += n * (type.halves ? 1 : 2);
    });
    return { pieces, halves, doubled, counts: counts.slice() };
  }

  search(0, target, 0);

  if (best === null) {
    return { exact: false, pieces: 0, items: [] };
  }

  const items = [];
  sorted.forEach((s, strengthIndex) => {
    const whole = types.findIndex((t) => t.strengthIndex === strengthIndex && t.halves === 0);
    const half = types.findIndex((t) => t.strengthIndex === strengthIndex && t.halves === 1);
    const wholeCount = whole === -1 ? 0 : best.counts[whole];
    const halfCount = half === -1 ? 0 : best.counts[half];
    if (wholeCount > 0 || halfCount > 0) {
      items.push({ strengthMg: s.mg, whole: wholeCount, halves: halfCount });
    }
  });

  return { exact: true, pieces: best.pieces, items };
}
