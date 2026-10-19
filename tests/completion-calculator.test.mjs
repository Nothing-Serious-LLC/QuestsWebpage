import test from 'node:test';
import assert from 'node:assert/strict';
import { completionSummary, describeCompletion } from '../blog/resources/completion-calculator.mjs';

test('missing records retain an explicit completion range and coverage', () => {
  assert.deepEqual(completionSummary(5, 3, 1), {
    planned: 5, completed: 3, missed: 1, unknown: 1,
    confirmedPercent: 60, possiblePercent: 80, coveragePercent: 80,
  });
  assert.match(describeCompletion(completionSummary(5, 3, 1)), /60% to 80%/);
});
test('zero due opportunities have no rate', () => {
  const result = completionSummary(0, 0, 0);
  assert.equal(result.confirmedPercent, null);
  assert.equal(result.possiblePercent, null);
  assert.equal(result.coveragePercent, null);
  assert.match(describeCompletion(result), /no completion rate/);
});
test('fully unknown records stay unresolved', () => {
  const result = completionSummary(7, 0, 0);
  assert.equal(result.unknown, 7);
  assert.equal(result.coveragePercent, 0);
  assert.equal(result.possiblePercent, 100);
  assert.match(describeCompletion(result), /0% to 100%/);
});
test('known complete and missed rounds have exact endpoints', () => {
  assert.equal(completionSummary(3, 3, 0).confirmedPercent, 100);
  assert.equal(completionSummary(3, 0, 3).possiblePercent, 0);
  assert.match(describeCompletion(completionSummary(3, 3, 0)), /All records are known/);
});
test('pooled group examples use scheduled opportunities as the denominator', () => {
  assert.equal(completionSummary(8, 7, 1).confirmedPercent, 87.5);
  assert.equal((completionSummary(5, 4, 1).confirmedPercent + completionSummary(3, 3, 0).confirmedPercent) / 2, 90);
});
test('inconsistent totals, fractions, negative and non-finite counts are rejected', () => {
  for (const values of [[5,4,2], [0,1,0], [5,-1,0], [5,1.5,0], [NaN,0,0], [Infinity,0,0], [100001,0,0], ['5',3,1]]) {
    assert.throws(() => completionSummary(...values));
  }
});
