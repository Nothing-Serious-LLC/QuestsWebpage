import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, planText, dateLabel } from '../js/challenge-planner.mjs';
const example = { days: '7', action: 'Read for ten minutes', cue: 'After breakfast', checkin: 'In our Quest', support: 'Encouragement', fallback: 'Try two minutes', celebration: 'Compare notes' };

test('optional dates keep the checklist useful before a group agrees a start', () => {
  const plan = buildPlan(example);
  assert.equal(plan.checklist.length, 7);
  assert.deepEqual(plan.checklist[6], { day: 7, date: null });
  assert.match(planText(plan), /\[ \] Day 7\n/);
});
test('calendar dates remain consecutive across daylight saving and leap day', () => {
  const fall = buildPlan({ ...example, days: '14', start: '2026-10-30' });
  assert.equal(fall.checklist.at(-1).date, '2026-11-12');
  const leap = buildPlan({ ...example, start: '2028-02-27' });
  assert.deepEqual(leap.checklist.slice(0, 4).map(x => x.date), ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  assert.equal(dateLabel('2028-02-29'), 'Feb 29, 2028');
});
test('invalid dates, unsupported lengths, and empty agreements are rejected', () => {
  for (const start of ['2026-02-29', '2026-13-01', '2026-04-31', '9999-12-31', 'tomorrow']) assert.throws(() => buildPlan({ ...example, start }));
  for (const days of ['0', '1', '365', 'NaN']) assert.throws(() => buildPlan({ ...example, days }));
  assert.throws(() => buildPlan({ ...example, action: ' \n ' }));
});
test('exports preserve all agreement fields and thirty days without embedding HTML', () => {
  const plan = buildPlan({ ...example, days: 30, action: '<img src=x onerror=alert(1)>', start: '2026-12-15' });
  assert.equal(plan.checklist.at(-1).date, '2027-01-13');
  assert.equal(plan.fields[0].value, '<img src=x onerror=alert(1)>');
  assert.equal((planText(plan).match(/\[ \] Day /g) || []).length, 30);
  assert.match(planText(plan), /Support: Encouragement/);
  assert.match(planText(plan), /Difficult-day plan: Try two minutes/);
  assert.match(planText(plan), /Review and celebrate: Compare notes/);
});
