// Turns mg amounts into whole numbers, so the engine never compares floating-point mg.
// Used by tablets.js and validate.js. Spec: SPEC.md section 2, rule 5.

/**
 * Converts an mg value with at most 3 decimals into whole thousandths of a mg
 * (for example 0.25 mg becomes 250). Returns null for anything else: not a number,
 * not finite, or more than 3 decimals.
 * @param {unknown} mg
 * @returns {number | null}
 */
export function toThousandths(mg) {
  if (typeof mg !== 'number' || !Number.isFinite(mg)) return null;
  const scaled = mg * 1000;
  const rounded = Math.round(scaled);
  // A tiny tolerance absorbs floating-point noise such as 0.3 * 1000 = 300.00000000000006.
  if (Math.abs(scaled - rounded) > 1e-6) return null;
  return rounded;
}
