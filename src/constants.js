// Fixed values from SPEC.md. These are part of the spec, not logic,
// so they are filled in from the start.

export const PLAN_VERSION = 1;

/** Allowed administration times, in their usual order through the day. */
export const TIMES = Object.freeze(['morning', 'midday', 'evening', 'bedtime']);

export const MAX_DRUGS = 2;
export const MAX_NAME_LENGTH = 60;
export const MAX_STRENGTHS = 6;
export const MAX_STEPS = 52;
export const MAX_STEP_DAYS = 365;
export const MAX_START_DAY = 365;
export const MAX_CALENDAR_DAYS = 180;

/** Largest dose or tablet strength accepted, in mg. */
export const MAX_MG = 10000;

/** A dose that needs more pieces than this cannot be made (solveTablets gives up). */
export const MAX_PIECES = 12;

/** A dose that needs more pieces than this gets a MANY_PIECES warning. */
export const WARN_PIECES = 4;

export const STATUSES = Object.freeze([
  'not-started',
  'start',
  'same',
  'increase',
  'decrease',
  'adjust',
  'stop',
  'stopped',
  'restart',
]);

/** Statuses that make a day a change day. */
export const CHANGE_STATUSES = Object.freeze([
  'start',
  'increase',
  'decrease',
  'adjust',
  'stop',
  'restart',
]);
