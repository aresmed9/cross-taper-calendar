// The plan form. This is the only file that touches the page; the engine in src/ has no DOM code.
// It builds the form, reads it into a plan object, and shows what validatePlan reports.

import { validatePlan } from './src/validate.js';
import { TIMES } from './src/constants.js';

const TIME_LABELS = { morning: 'Morning', midday: 'Midday', evening: 'Evening', bedtime: 'Bedtime' };
const MAX_DRUG_FORMS = 2;

// The example from SPEC.md section 3. It is copied here on purpose: the page never imports test files.
const EXAMPLE_PLAN = {
  version: 1,
  startDate: '2026-11-02',
  drugs: [
    {
      name: 'Drug A',
      times: ['morning'],
      strengths: [
        { mg: 50, splittable: true },
        { mg: 25, splittable: false },
      ],
      alreadyTaking: true,
      currentDoses: { morning: 100 },
      startDay: 1,
      steps: [
        { days: 7, doses: { morning: 75 } },
        { days: 7, doses: { morning: 50 } },
        { days: 7, doses: { morning: 25 } },
      ],
      afterLastStep: 'stop',
    },
    {
      name: 'Drug B',
      times: ['morning'],
      strengths: [{ mg: 10, splittable: true }],
      alreadyTaking: false,
      startDay: 8,
      steps: [
        { days: 7, doses: { morning: 5 } },
        { days: 7, doses: { morning: 10 } },
        { days: 7, doses: { morning: 20 } },
      ],
      afterLastStep: 'continue',
    },
  ],
};

const startInput = document.querySelector('#start-date');
const drugsBox = document.querySelector('#drugs');
const addDrugButton = document.querySelector('#add-drug');
const loadExampleButton = document.querySelector('#load-example');
const form = document.querySelector('#plan-form');
const messages = document.querySelector('#messages');

let nextId = 0;

/** A unique id, so each label can point at its input. */
function uid() {
  nextId += 1;
  return `field-${nextId}`;
}

/**
 * Makes an element. Plain props are set on the element (value, checked, hidden, ...),
 * except "class" and "text", which set className and textContent.
 */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node[key] = value;
  }
  node.append(...children);
  return node;
}

/** A wrapper div with a label and its control. */
function labelled(text, control, className) {
  const id = uid();
  control.id = id;
  return el('div', { class: `field ${className}` }, el('label', { htmlFor: id, text }), control);
}

function button(text, onClick, className = 'secondary') {
  const node = el('button', { type: 'button', text, class: className });
  node.addEventListener('click', onClick);
  return node;
}

/** Empty box -> '' (so the validator reports it), otherwise the number typed. */
function numberOrBlank(text) {
  return text.trim() === '' ? '' : Number(text);
}

// ---------------------------------------------------------------------------
// Building the form
// ---------------------------------------------------------------------------

/** Builds one drug's part of the form, filled in from data (blank fields if data is empty). */
function buildDrug(data = {}) {
  const drug = {
    name: '',
    times: [],
    strengths: [{ mg: '', splittable: false }],
    alreadyTaking: false,
    currentDoses: {},
    startDay: '',
    steps: [{ days: '', doses: {} }],
    afterLastStep: '',
    ...data,
  };

  const block = el('fieldset', { class: 'drug' });

  // Name
  const nameInput = el('input', { type: 'text', value: drug.name });

  // Administration times
  const timeBoxes = TIMES.map((time) =>
    el('input', { type: 'checkbox', value: time, checked: drug.times.includes(time) }),
  );
  const timeGroup = el(
    'fieldset',
    { class: 'field f-times' },
    el('legend', { text: 'Administration times' }),
    ...TIMES.map((time, i) => el('label', { class: 'inline' }, timeBoxes[i], ` ${TIME_LABELS[time]}`)),
  );

  // Tablet strengths
  const strengthRows = el('div', { class: 'rows' });
  drug.strengths.forEach((strength) => strengthRows.append(strengthRow(strength)));
  const strengthGroup = el(
    'fieldset',
    { class: 'field f-strengths' },
    el('legend', { text: 'Tablet strengths' }),
    strengthRows,
    button('Add strength', () => strengthRows.append(strengthRow({ mg: '', splittable: false }))),
  );

  // Already taking, and the dose taken before Day 1
  const takingBox = el('input', { type: 'checkbox', checked: drug.alreadyTaking === true });
  const takingField = el('div', { class: 'field f-already' }, el('label', {}, takingBox, ' Patient already takes this drug'));
  const currentSection = el('fieldset', { class: 'field f-current' }, el('legend', { text: 'Dose taken before Day 1' }));
  for (const time of TIMES) {
    const input = el('input', { type: 'number', step: 'any', value: drug.currentDoses[time] ?? '' });
    const wrapper = labelled(`${TIME_LABELS[time]} (mg)`, input, 'f-current-dose');
    wrapper.dataset.time = time;
    currentSection.append(wrapper);
  }

  // Start day
  const startDayField = labelled(
    'Start day (the day the first step begins)',
    el('input', { type: 'number', step: '1', min: '1', value: drug.startDay }),
    'f-startday',
  );

  // Steps
  const stepRows = el('div', { class: 'rows' });
  drug.steps.forEach((step) => stepRows.append(stepRow(step)));
  const stepGroup = el(
    'fieldset',
    { class: 'field f-steps' },
    el('legend', { text: 'Steps' }),
    stepRows,
    button('Add step', () => {
      stepRows.append(stepRow({ days: '', doses: {} }));
      refreshTimes(block);
    }),
  );

  // After the last step
  const afterName = uid();
  const afterGroup = el(
    'fieldset',
    { class: 'field f-after' },
    el('legend', { text: 'After the last step' }),
    ...[
      ['stop', 'Stop: the drug ends the day after the last step'],
      ['continue', 'Continue: keep taking the last step’s dose'],
    ].map(([value, text]) =>
      el(
        'label',
        { class: 'inline' },
        el('input', { type: 'radio', name: afterName, value, checked: drug.afterLastStep === value }),
        ` ${text}`,
      ),
    ),
  );

  block.append(
    el('legend', { class: 'drug-title' }),
    labelled('Drug name', nameInput, 'f-name'),
    timeGroup,
    strengthGroup,
    takingField,
    currentSection,
    startDayField,
    stepGroup,
    afterGroup,
    el('div', { class: 'drug-actions' }, button('Remove drug', () => {
      block.remove();
      updateDrugTitles();
    })),
  );

  timeBoxes.forEach((box) => box.addEventListener('change', () => refreshTimes(block)));
  takingBox.addEventListener('change', () => refreshTaking(block));
  refreshTimes(block);
  refreshTaking(block);
  return block;
}

/** One tablet strength row: mg, "can be cut in half", and Remove. */
function strengthRow(strength) {
  const row = el('div', { class: 'row strength-row' });
  const mgInput = el('input', { type: 'number', step: 'any', value: strength.mg });
  const cutBox = el('input', { type: 'checkbox', checked: strength.splittable === true });
  row.append(
    labelled('Strength (mg)', mgInput, 'f-mg'),
    el('div', { class: 'field f-splittable' }, el('label', {}, cutBox, ' Can be cut in half')),
    button('Remove', () => row.remove()),
  );
  return row;
}

/** One step row: days, a dose box for each time (only the checked times are shown), and Remove. */
function stepRow(step) {
  const row = el('div', { class: 'row step-row' });
  row.append(labelled('Days', el('input', { type: 'number', step: '1', min: '1', value: step.days }), 'f-days'));
  for (const time of TIMES) {
    const input = el('input', { type: 'number', step: 'any', value: step.doses[time] ?? '' });
    const wrapper = labelled(`${TIME_LABELS[time]} dose (mg)`, input, 'f-dose');
    wrapper.dataset.time = time;
    row.append(wrapper);
  }
  row.append(button('Remove', () => row.remove()));
  return row;
}

/** Shows the dose boxes only for the times that are ticked. */
function refreshTimes(block) {
  const checked = [...block.querySelectorAll('.f-times input')].filter((box) => box.checked).map((box) => box.value);
  for (const node of block.querySelectorAll('[data-time]')) {
    node.hidden = !checked.includes(node.dataset.time);
  }
}

/** Shows the "dose taken before Day 1" section only when the patient already takes the drug. */
function refreshTaking(block) {
  block.querySelector('.f-current').hidden = !block.querySelector('.f-already input').checked;
}

function drugBlocks() {
  return [...drugsBox.children];
}

/** Numbers the drugs "Drug 1", "Drug 2", and limits how many can be added. */
function updateDrugTitles() {
  const blocks = drugBlocks();
  blocks.forEach((block, i) => {
    block.querySelector('.drug-title').textContent = `Drug ${i + 1}`;
  });
  addDrugButton.disabled = blocks.length >= MAX_DRUG_FORMS;
}

/** Replaces the whole form with the given plan (or a blank form). */
function loadPlan(plan) {
  messages.replaceChildren();
  startInput.value = plan.startDate;
  drugsBox.replaceChildren(...plan.drugs.map((drug) => buildDrug(drug)));
  updateDrugTitles();
}

// ---------------------------------------------------------------------------
// Reading the form into a plan
// ---------------------------------------------------------------------------

/**
 * Reads the form into a plan object (SPEC section 3). Also returns `places`:
 * a map from each plan path (such as "drugs[0].steps[1].days") to the page element
 * that holds that field, so errors can be shown next to it.
 */
function readPlan() {
  const places = new Map();
  places.set('startDate', startInput.closest('.field'));
  places.set('drugs', drugsBox);
  const drugs = drugBlocks().map((block, i) => readDrug(block, i, places));
  return { plan: { version: 1, startDate: startInput.value, drugs }, places };
}

function readDrug(block, i, places) {
  const base = `drugs[${i}]`;
  const put = (suffix, node) => places.set(`${base}.${suffix}`, node);
  places.set(base, block);

  const nameField = block.querySelector('.f-name');
  put('name', nameField);

  const times = [...block.querySelectorAll('.f-times input')].filter((box) => box.checked).map((box) => box.value);
  put('times', block.querySelector('.f-times'));

  const strengths = [...block.querySelectorAll('.strength-row')].map((row, k) => {
    const place = `${base}.strengths[${k}]`;
    places.set(place, row);
    places.set(`${place}.mg`, row.querySelector('.f-mg'));
    places.set(`${place}.splittable`, row.querySelector('.f-splittable'));
    return {
      mg: numberOrBlank(row.querySelector('.f-mg input').value),
      splittable: row.querySelector('.f-splittable input').checked,
    };
  });
  put('strengths', block.querySelector('.f-strengths'));

  const alreadyTaking = block.querySelector('.f-already input').checked;
  put('alreadyTaking', block.querySelector('.f-already'));

  const drug = {
    name: nameField.querySelector('input').value,
    times,
    strengths,
    alreadyTaking,
  };

  // Only a drug already being taken has current doses. Leaving the field out otherwise is correct.
  if (alreadyTaking) {
    const section = block.querySelector('.f-current');
    put('currentDoses', section);
    drug.currentDoses = readDoses(section, `${base}.currentDoses`, places);
  }

  put('startDay', block.querySelector('.f-startday'));
  drug.startDay = numberOrBlank(block.querySelector('.f-startday input').value);

  const steps = [...block.querySelectorAll('.step-row')].map((row, j) => {
    const place = `${base}.steps[${j}]`;
    places.set(place, row);
    places.set(`${place}.days`, row.querySelector('.f-days'));
    return {
      days: numberOrBlank(row.querySelector('.f-days input').value),
      doses: readDoses(row, `${place}.doses`, places),
    };
  });
  put('steps', block.querySelector('.f-steps'));
  drug.steps = steps;

  const checkedAfter = block.querySelector('.f-after input:checked');
  put('afterLastStep', block.querySelector('.f-after'));
  drug.afterLastStep = checkedAfter ? checkedAfter.value : '';

  return drug;
}

/** Reads the dose boxes that are showing. Hidden boxes (times not ticked) are left out. */
function readDoses(container, basePath, places) {
  const doses = {};
  for (const wrapper of container.querySelectorAll('[data-time]')) {
    if (wrapper.hidden) continue;
    const time = wrapper.dataset.time;
    places.set(`${basePath}.${time}`, wrapper);
    doses[time] = numberOrBlank(wrapper.querySelector('input').value);
  }
  return doses;
}

// ---------------------------------------------------------------------------
// Checking the plan and showing the results
// ---------------------------------------------------------------------------

function checkPlan() {
  clearMessages();
  const { plan, places } = readPlan();
  const { errors, warnings } = validatePlan(plan);
  for (const issue of errors) showNextTo(issue, places, 'error');
  for (const issue of warnings) showNextTo(issue, places, 'warning');
  showSummary(errors, warnings);
}

function clearMessages() {
  for (const node of form.querySelectorAll('.field-message')) node.remove();
  for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
  messages.replaceChildren();
}

/** Puts the message under the field its path points to. Returns nothing if no field matches. */
function showNextTo(issue, places, kind) {
  const place = findPlace(issue.path, places);
  if (place === undefined) return; // It still appears in the summary at the top.
  place.append(el('p', { class: `field-message ${kind}`, text: issue.message }));
  if (kind === 'error') {
    const control = place.querySelector('input, select');
    if (control) control.setAttribute('aria-invalid', 'true');
  }
}

/**
 * Finds the element for a path. If the path itself has no element, tries its parent,
 * so "drugs[0].steps[0].doses.bedtime" falls back to the step row.
 */
function findPlace(path, places) {
  let current = path;
  while (current !== '') {
    if (places.has(current)) return places.get(current);
    const next = parentPath(current);
    if (next === current) break;
    current = next;
  }
  return undefined;
}

/** "drugs[0].steps[1].days" -> "drugs[0].steps[1]". Removes the last ".name" or "[n]". */
function parentPath(path) {
  return path.replace(/(\.[^.[\]]+|\[\d+\])$/, '');
}

const FIELD_NAMES = {
  startDate: 'start date',
  drugs: 'drug',
  name: 'name',
  times: 'times',
  strengths: 'strengths',
  mg: 'mg',
  splittable: 'can be cut in half',
  alreadyTaking: 'already taking',
  currentDoses: 'dose before Day 1',
  startDay: 'start day',
  steps: 'steps',
  days: 'days',
  doses: 'doses',
  afterLastStep: 'after last step',
};

/** "drugs[0].steps[1].doses.midday" -> "Drug 1, steps 2, doses, Midday". For the summary list. */
function describePath(path) {
  const parts = [];
  for (const segment of path.split('.')) {
    const match = /^([A-Za-z]+)(?:\[(\d+)\])?$/.exec(segment);
    if (!match) continue;
    const [, word, index] = match;
    if (index !== undefined) {
      const number = Number(index) + 1;
      parts.push(word === 'drugs' ? `Drug ${number}` : `${FIELD_NAMES[word] ?? word} ${number}`);
    } else if (TIME_LABELS[word]) {
      parts.push(TIME_LABELS[word]);
    } else {
      parts.push(FIELD_NAMES[word] ?? word);
    }
  }
  return parts.join(', ');
}

/** The text for one line of the summary: where the problem is, then what it is. */
function summaryLine(issue) {
  return issue.path === '' ? issue.message : `${describePath(issue.path)}: ${issue.message}`;
}

/** Lists every error and warning at the top of the page. */
function showSummary(errors, warnings) {
  if (errors.length === 0 && warnings.length === 0) {
    messages.append(el('p', { class: 'summary ok', text: 'No problems found in this plan.' }));
    return;
  }
  if (errors.length > 0) {
    messages.append(
      el('h2', { text: `${errors.length} problem${errors.length === 1 ? '' : 's'} to fix` }),
      el('ul', { class: 'issues errors' }, ...errors.map((issue) => el('li', { text: summaryLine(issue) }))),
    );
  }
  if (warnings.length > 0) {
    messages.append(
      el('h2', { text: 'Warnings' }),
      el('ul', { class: 'issues warnings' }, ...warnings.map((issue) => el('li', { text: summaryLine(issue) }))),
    );
  }
}

// ---------------------------------------------------------------------------
// Wiring it up
// ---------------------------------------------------------------------------

addDrugButton.addEventListener('click', () => {
  drugsBox.append(buildDrug());
  updateDrugTitles();
});

loadExampleButton.addEventListener('click', () => loadPlan(EXAMPLE_PLAN));

form.addEventListener('submit', (event) => {
  event.preventDefault(); // The form never submits anywhere. Nothing leaves the page.
  checkPlan();
});

loadPlan({ startDate: '', drugs: [{}] });
