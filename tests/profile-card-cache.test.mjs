import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/p/[[path]].js';

// Share speed follow-up (Elliott, 2026-10-02): every card fetch went to
// Supabase. A revision's card is fixed, so repeats come from the edge cache.
const code = '0123456789abcdef0123456789abcdef';
const env = { PROFILE_SHARE_SUPABASE_URL: 'https://test.supabase.co', PROFILE_SHARE_WEB_SECRET: 'test' };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

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

function cardRequest(query) {
  const path = `https://invite-staging.thequestsapp.com/p/${code}/og.png${query}`;
  return { request: new Request(path), params: { path: [code, 'og.png'] }, env };
}

test('a revision card comes from the edge cache after the first fetch', async (t) => {
  await withCache(t, async (cache) => {
    const upstream = t.mock.method(globalThis, 'fetch', async () => new Response(png, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    }));

    const first = await onRequest(cardRequest('?r=3'));
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('X-Quests-Card-Cache'), 'MISS');
    assert.equal(first.headers.get('Cache-Control'), 'public, max-age=300');
    assert.deepEqual(new Uint8Array(await first.arrayBuffer()), png);
    assert.equal(cache.entries.size, 1);

    const second = await onRequest(cardRequest('?r=3'));
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('X-Quests-Card-Cache'), 'HIT');
    assert.equal(second.headers.get('Content-Type'), 'image/png');
    assert.deepEqual(new Uint8Array(await second.arrayBuffer()), png);
    assert.equal(upstream.mock.callCount(), 1);
  });
});

test('a card without a revision is never cached', async (t) => {
  await withCache(t, async (cache) => {
    const upstream = t.mock.method(globalThis, 'fetch', async () => new Response(png, { status: 200 }));
    const first = await onRequest(cardRequest(''));
    const second = await onRequest(cardRequest(''));
    assert.equal(first.headers.get('Cache-Control'), 'no-store');
    assert.equal(second.headers.get('Cache-Control'), 'no-store');
    assert.equal(cache.entries.size, 0);
    assert.equal(upstream.mock.callCount(), 2);
  });
});

test('a missing card is never cached', async (t) => {
  await withCache(t, async (cache) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
    const response = await onRequest(cardRequest('?r=3'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(cache.entries.size, 0);
  });
});

test('without an edge cache the card is served uncached, as before', async (t) => {
  const previous = globalThis.caches;
  globalThis.caches = undefined;
  t.after(() => {
    globalThis.caches = previous;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(png, { status: 200 }));
  const response = await onRequest(cardRequest('?r=3'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
