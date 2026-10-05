import test from 'node:test';
import assert from 'node:assert/strict';
import { makeScorecard } from '../scripts/seo-scorecard.mjs';

const snapshot = () => ({ property: 'sc-domain:thequestsapp.com', dataState: 'final',
  period: { start: '2026-09-01', end: '2026-09-28' },
  filters: { searchType: 'web', country: 'all', device: 'all', page: 'all', query: 'all', searchAppearance: 'all', aggregation: 'property' },
  totals: { clicks: 5, impressions: 50, averagePosition: 10 },
  queries: [{ query: 'quests app', clicks: 4, impressions: 20, averagePosition: 7 }] });
const later = () => ({ ...snapshot(), period: { start: '2026-09-29', end: '2026-10-26' } });

test('unreported target queries stay unknown and baseline claims no improvement', () => {
  const report = makeScorecard(snapshot());
  assert.equal(report.status, 'baseline_only');
  assert.equal(report.queries.find(r => r.query === 'quest app').baseline.clicks, null);
  assert.equal(report.queries[0].change, null);
});
test('same-query changes use percentage points and preserve position direction', () => {
  const current = later();
  current.queries[0] = { query: 'quests app', clicks: 5, impressions: 20, averagePosition: 3 };
  assert.deepEqual(makeScorecard(snapshot(), current).queries[0].change,
    { clicks: 1, impressions: 0, ctrPercent: 5, averagePosition: -4 });
});
test('missing later query remains unknown, including its delta', () => {
  const current = later(); current.queries = [];
  assert.equal(makeScorecard(snapshot(), current).queries[0].change.clicks, null);
});
test('mismatched population, dates, and partial data are rejected', () => {
  for (const mutate of [
    s => { s.filters.country = 'usa'; }, s => { s.period.end = '2026-10-27'; },
    s => { s.period = snapshot().period; }, s => { s.dataState = 'partial'; },
    s => { s.period.start = '2026-02-30'; }, s => { delete s.filters.device; },
  ]) { const current = later(); mutate(current); assert.throws(() => makeScorecard(snapshot(), current)); }
});
test('invalid metrics and duplicated queries are rejected', () => {
  for (const mutate of [s => { s.totals.clicks = -1; }, s => { s.totals.clicks = 100; },
    s => { s.queries.push({ ...s.queries[0] }); }, s => { s.totals.averagePosition = null; }]) {
    const invalid = snapshot(); mutate(invalid); assert.throws(() => makeScorecard(invalid));
  }
});
