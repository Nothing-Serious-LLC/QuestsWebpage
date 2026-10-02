import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/p/[[path]].js';

// Share speed follow-up (Elliott, 2026-10-02): every profile page view asked
// Supabase for the revision's details (0.6 to 1.3 s on staging, 2.6 s cold),
// so the share sheet's preview waited on it again for each repeat share. A
// revision's details are fixed, so repeats come from the edge cache.
const code = 'fedcba9876543210fedcba9876543210';
const env = { PROFILE_SHARE_SUPABASE_URL: 'https://test.supabase.co', PROFILE_SHARE_WEB_SECRET: 'test' };
const details = {
  displayName: 'Elliott 303',
  pointsTotal: 11,
  currentStreak: 1,
  imageWidth: 640,
  imageHeight: 800,
  revision: 3,
  avatarUrl: null,
  ringImageDataUrl: null,
  ringImageUrl: null,
  ringColors: [],
};

function fakeCache() {
  const entries = new Map();
  return {
    entries,
    async match(request) {
      const hit = entries.get(request.url);
      return hit ? hit.clone() : undefined;
    },
    async put(request, response) {
      entries.set(request.url, response.clone());
    },
  };
}

async function withCache(t, run) {
  const cache = fakeCache();
  const previous = globalThis.caches;
  globalThis.caches = { default: cache };
  t.after(() => {
    globalThis.caches = previous;
  });
  return run(cache);
}

function pageRequest(query, userAgent = 'iPhone') {
  return {
    request: new Request(`https://invite-staging.thequestsapp.com/p/${code}${query}`, {
      headers: { 'User-Agent': userAgent },
    }),
    params: { path: [code] },
    env,
  };
}

function upstreamDetails(t, body = details, status = 200) {
  return t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

test("a revision's page details come from the edge cache after the first view", async (t) => {
  await withCache(t, async (cache) => {
    const upstream = upstreamDetails(t);

    const first = await onRequest(pageRequest('?r=3'));
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('X-Quests-Page-Cache'), 'MISS');
    const firstHtml = await first.text();
    assert.ok(firstHtml.includes("Elliott 303's Quests profile"));
    assert.equal(cache.entries.size, 1);

    const second = await onRequest(pageRequest('?r=3'));
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('X-Quests-Page-Cache'), 'HIT');
    assert.equal(second.headers.get('Cache-Control'), 'no-store');
    assert.equal(await second.text(), firstHtml);
    assert.equal(upstream.mock.callCount(), 1);
  });
});

test('cached details still answer each platform with its own app links', async (t) => {
  await withCache(t, async () => {
    const upstream = upstreamDetails(t);

    const iphone = await onRequest(pageRequest('?r=3', 'iPhone'));
    assert.ok(!(await iphone.text()).includes('intent://'));

    const android = await onRequest(pageRequest('?r=3', 'Android'));
    assert.equal(android.headers.get('X-Quests-Page-Cache'), 'HIT');
    assert.equal(android.headers.get('Vary'), 'User-Agent');
    assert.ok((await android.text()).includes(`intent://p/${code}?r=3#Intent;scheme=quests-staging;`));
    assert.equal(upstream.mock.callCount(), 1);
  });
});

test('a page without a revision always asks Supabase', async (t) => {
  await withCache(t, async (cache) => {
    const upstream = upstreamDetails(t);
    const first = await onRequest(pageRequest(''));
    const second = await onRequest(pageRequest(''));
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.headers.get('X-Quests-Page-Cache'), null);
    assert.equal(cache.entries.size, 0);
    assert.equal(upstream.mock.callCount(), 2);
  });
});

test('an unavailable or malformed profile is never cached', async (t) => {
  await withCache(t, async (cache) => {
    const missing = upstreamDetails(t, { code: 'unavailable' }, 404);
    const gone = await onRequest(pageRequest('?r=3'));
    assert.equal(gone.status, 404);
    assert.equal(cache.entries.size, 0);
    missing.mock.restore();

    upstreamDetails(t, { ...details, displayName: '  ' });
    const nameless = await onRequest(pageRequest('?r=3'));
    assert.equal(nameless.status, 404);
    assert.equal(cache.entries.size, 0);
  });
});
