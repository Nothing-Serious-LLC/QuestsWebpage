// Private Search Console snapshots belong outside the static website checkout.
// Usage: node scripts/seo-scorecard.mjs baseline.json [later.json] > /private/path/report.json
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const targetQueries = ['quests app', 'quests', 'quest app'];
const filterKeys = ['searchType', 'country', 'device', 'page', 'query', 'searchAppearance', 'aggregation'];
const day = 86400000;

export function validateSnapshot(snapshot) {
  if (snapshot.property !== 'sc-domain:thequestsapp.com') throw new Error('Unexpected Search Console property');
  for (const key of filterKeys) {
    if (typeof snapshot.filters?.[key] !== 'string') throw new Error(`Explicit filter required: ${key}`);
  }
  for (const key of ['start', 'end']) {
    const value = snapshot.period?.[key];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`Invalid period ${key}`);
  }
  if (snapshot.period.end < snapshot.period.start) throw new Error('Reversed date range');
  if (snapshot.dataState !== 'final') throw new Error('Use complete Search Console data');
  if (!Array.isArray(snapshot.queries)) throw new Error('Query rows required');
  const seen = new Set();
  for (const row of [snapshot.totals, ...snapshot.queries]) {
    if (!row) throw new Error('Totals required');
    if (row !== snapshot.totals) {
      if (typeof row.query !== 'string' || seen.has(row.query)) throw new Error('Missing or duplicate exact query');
      seen.add(row.query);
    }
    for (const key of ['clicks', 'impressions']) {
      if (!Number.isInteger(row[key]) || row[key] < 0) throw new Error(`Invalid ${key}`);
    }
    if (row.clicks > row.impressions) throw new Error('Clicks exceed impressions');
    if (row.impressions > 0 && (!Number.isFinite(row.averagePosition) || row.averagePosition < 1)) throw new Error('Position required for observed impressions');
    if (row.impressions === 0 && row.averagePosition != null) throw new Error('Zero impressions require null position');
  }
  return snapshot;
}

function metrics(row) {
  if (!row) return { status: 'unreported', clicks: null, impressions: null, ctrPercent: null, averagePosition: null };
  return { status: 'reported', clicks: row.clicks, impressions: row.impressions,
    ctrPercent: row.impressions ? 100 * row.clicks / row.impressions : null,
    averagePosition: row.averagePosition ?? null };
}
function delta(before, after) {
  return Object.fromEntries(['clicks', 'impressions', 'ctrPercent', 'averagePosition'].map(key =>
    [key, before[key] == null || after[key] == null ? null : after[key] - before[key]]));
}

export function makeScorecard(baseline, current) {
  validateSnapshot(baseline);
  if (current) {
    validateSnapshot(current);
    if (filterKeys.some(key => baseline.filters[key] !== current.filters[key])) throw new Error('Filter mismatch: compare the same population');
    const length = s => (Date.parse(s.period.end) - Date.parse(s.period.start)) / day + 1;
    if (length(baseline) !== length(current)) throw new Error('Compare equal-length periods');
    if (current.period.start <= baseline.period.end) throw new Error('Comparison periods must be chronological and non-overlapping');
  }
  return {
    property: baseline.property, filters: baseline.filters, baselinePeriod: baseline.period,
    comparisonPeriod: current?.period ?? null,
    status: current ? 'observed_comparison' : 'baseline_only',
    interpretation: 'Negative position change means a better average position. Missing query rows remain unknown. These observations cannot establish causation; use release dates, query mix, and sample size when interpreting changes.',
    totals: { baseline: metrics(baseline.totals), current: current ? metrics(current.totals) : null,
      change: current ? delta(metrics(baseline.totals), metrics(current.totals)) : null },
    queries: targetQueries.map(query => {
      const before = metrics(baseline.queries.find(row => row.query === query));
      const after = current ? metrics(current.queries.find(row => row.query === query)) : null;
      return { query, baseline: before, current: after, change: after ? delta(before, after) : null,
        sampleNote: Math.min(before.impressions ?? 0, after?.impressions ?? before.impressions ?? 0) < 100 ? 'Small sample: interpret direction cautiously.' : null };
    }),
    conversionMeasurement: 'Unavailable: the current website privacy policy specifies no website analytics.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [before, after, ...extra] = process.argv.slice(2);
    if (!before || extra.length) throw new Error('Usage: node scripts/seo-scorecard.mjs baseline.json [later.json]');
    console.log(JSON.stringify(makeScorecard(JSON.parse(readFileSync(before, 'utf8')), after ? JSON.parse(readFileSync(after, 'utf8')) : undefined), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
