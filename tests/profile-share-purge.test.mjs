import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/p/[[path]].js';

// Share link revocation (Elliott, 2026-10-02): a revision's card and page
// details are cached at the edge for five minutes, so a link its owner turns
// off, replaces or invalidates kept answering until the copies expired.
// Supabase now posts /p/{code}/purge and the copies stop answering at once.
const code = 'abcdefabcdefabcdefabcdefabcdef12';
const secret = 'test-secret-0123456789abcdef0123456789';
const host = 'https://invite-staging.thequestsapp.com';
const zoneId = '0123456789abcdef0123456789abcdef';
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9, 9]);
const details = {
  displayName: 'Elliott 303',
  pointsTotal: 75,
  currentStreak: 8,
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
    async delete(request) {
      return entries.delete(request.url);
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

/** Supabase answers like profile-share-web; Cloudflare's purge API is recorded. */
function fakeNetwork(t, { purgeOk = true } = {}) {
  const state = { active: true, purgeCalls: [], upstreamCalls: 0 };
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://api.cloudflare.com/')) {
      state.purgeCalls.push({ url, init, files: JSON.parse(init.body).files });
      return new Response(JSON.stringify({ success: purgeOk }), { status: purgeOk ? 200 : 403 });
    }
    state.upstreamCalls += 1;
    if (!state.active) {
      return new Response(JSON.stringify({ code: 'unavailable' }), { status: 404 });
    }
    const { action } = JSON.parse(init.body);
    return action === 'image'
      ? new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } })
      : new Response(JSON.stringify(details), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return state;
}

function envWith(extra = {}) {
  return {
    PROFILE_SHARE_SUPABASE_URL: 'https://test.supabase.co',
    PROFILE_SHARE_WEB_SECRET: secret,
    ...extra,
  };
}

function page(env, query = '?r=3') {
  return onRequest({
    request: new Request(`${host}/p/${code}${query}`, { headers: { 'User-Agent': 'iPhone' } }),
    params: { path: [code] },
    env,
  });
}

function card(env, query = '?r=3') {
  return onRequest({
    request: new Request(`${host}/p/${code}/og.png${query}`),
    params: { path: [code, 'og.png'] },
    env,
  });
}

function purge(env, body, { supplied = secret, shareCode = code } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (supplied !== null) {
    headers['x-profile-share-secret'] = supplied;
  }
  return onRequest({
    request: new Request(`${host}/p/${shareCode}/purge`, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    params: { path: [shareCode, 'purge'] },
    env,
  });
}

test('a revoked link stops answering from the cache once Supabase purges it', async (t) => {
  await withCache(t, async () => {
    const network = fakeNetwork(t);
    const env = envWith();

    assert.equal((await page(env)).headers.get('X-Quests-Page-Cache'), 'MISS');
    assert.equal((await card(env)).headers.get('X-Quests-Card-Cache'), 'MISS');

    network.active = false;
    const stale = await page(env);
    assert.equal(stale.status, 200, 'until the purge, the cached page keeps answering');
    assert.equal(stale.headers.get('X-Quests-Page-Cache'), 'HIT');

    const purged = await purge(env, { throughRevision: 3 });
    assert.equal(purged.status, 202);
    assert.deepEqual(await purged.json(), { purged: 'local', urls: 6, localDeleted: 2 });

    assert.equal((await page(env)).status, 404);
    assert.equal((await card(env)).status, 404);
  });
});

test('a configured purge reaches every Cloudflare location through the zone API', async (t) => {
  await withCache(t, async () => {
    const network = fakeNetwork(t);
    const env = envWith({ PROFILE_SHARE_CACHE_PURGE_TOKEN: 'cf-token', PROFILE_SHARE_CACHE_ZONE_ID: zoneId });

    const response = await purge(env, { throughRevision: 3 });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { purged: 'global', urls: 6, localDeleted: 0 });
    assert.equal(network.purgeCalls.length, 1);
    const [call] = network.purgeCalls;
    assert.equal(call.url, `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`);
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.headers.Authorization, 'Bearer cf-token');
    assert.deepEqual(call.files, [
      `${host}/p/${code}/og.png?r=3`,
      `${host}/p/${code}/details.json?r=3`,
      `${host}/p/${code}/og.png?r=2`,
      `${host}/p/${code}/details.json?r=2`,
      `${host}/p/${code}/og.png?r=1`,
      `${host}/p/${code}/details.json?r=1`,
    ]);
  });
});

test('a long link history goes out in calls of 100 files, newest first, capped at 500 revisions', async (t) => {
  await withCache(t, async () => {
    const network = fakeNetwork(t);
    const env = envWith({ PROFILE_SHARE_CACHE_PURGE_TOKEN: 'cf-token', PROFILE_SHARE_CACHE_ZONE_ID: zoneId });

    assert.equal((await purge(env, { throughRevision: 120 })).status, 200);
    assert.deepEqual(network.purgeCalls.map((call) => call.files.length), [100, 100, 40]);

    network.purgeCalls.length = 0;
    const long = await purge(env, { throughRevision: 800 });
    assert.equal((await long.json()).urls, 1000);
    assert.equal(network.purgeCalls.length, 10);
    assert.equal(network.purgeCalls[0].files[0], `${host}/p/${code}/og.png?r=800`);
    assert.equal(network.purgeCalls[9].files.at(-1), `${host}/p/${code}/details.json?r=301`);
  });
});

test('a failed global purge reports it after clearing this location', async (t) => {
  await withCache(t, async () => {
    const network = fakeNetwork(t, { purgeOk: false });
    const env = envWith({ PROFILE_SHARE_CACHE_PURGE_TOKEN: 'cf-token', PROFILE_SHARE_CACHE_ZONE_ID: zoneId });
    t.mock.method(console, 'error', () => undefined);

    await card(env);
    const response = await purge(env, { throughRevision: 3 });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { purged: 'local', urls: 6, localDeleted: 1 });
    assert.equal(network.purgeCalls.length, 1);
  });
});

test('purges need the shared secret', async (t) => {
  await withCache(t, async (cache) => {
    const network = fakeNetwork(t);
    await card(envWith());
    const cachedBefore = cache.entries.size;

    assert.equal((await purge(envWith(), { throughRevision: 3 }, { supplied: null })).status, 401);
    assert.equal((await purge(envWith(), { throughRevision: 3 }, { supplied: 'wrong' })).status, 401);
    assert.equal((await purge(envWith({ PROFILE_SHARE_WEB_SECRET: '' }), { throughRevision: 3 }, { supplied: '' })).status, 401);
    assert.equal(cache.entries.size, cachedBefore);
    assert.equal(network.purgeCalls.length, 0);
  });
});

test('malformed purges are refused', async (t) => {
  await withCache(t, async () => {
    fakeNetwork(t);
    const env = envWith();
    assert.equal((await purge(env, { throughRevision: 3 }, { shareCode: 'not-a-code' })).status, 400);
    assert.equal((await purge(env, 'not json')).status, 400);
    assert.equal((await purge(env, { throughRevision: 0 })).status, 400);
    assert.equal((await purge(env, { throughRevision: 'three' })).status, 400);
    assert.equal((await purge(env, {})).status, 400);
  });
});

test('cached copies carry the link tags and visitors never see them', async (t) => {
  await withCache(t, async (cache) => {
    fakeNetwork(t);
    const env = envWith();
    await card(env);
    await page(env);
    const tags = `profile-share,profile-share-${code}`;
    assert.equal(cache.entries.get(`${host}/p/${code}/og.png?r=3`).headers.get('Cache-Tag'), tags);
    assert.equal(cache.entries.get(`${host}/p/${code}/details.json?r=3`).headers.get('Cache-Tag'), tags);

    const hit = await card(env);
    assert.equal(hit.headers.get('X-Quests-Card-Cache'), 'HIT');
    assert.equal(hit.headers.get('Cache-Tag'), null);
  });
});
