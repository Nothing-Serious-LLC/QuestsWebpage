// Durable invitation links (2026-10-31): the share code is the identity of an
// invitation. The canonical URL carries no query, any ?r= renders the current
// revision, a recorded successor answers 301 to its canonical URL, and only a
// revoked or removed code shows "Quest unavailable".
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onRequest, questShareAliasTarget } from "../functions/q/[[path]].js";
import {
  SHARE_CACHE_STATUS_HEADER,
  SHARE_PUBLIC_CACHE_CONTROL,
  isShareEdgeCacheable,
} from "../functions/q/shareCache.js";

const ORIGIN = "https://invite.thequestsapp.com";
const SUPABASE_URL = "https://project.supabase.co";
const LIVE = "fvMz9mhk";
const RETIRED = "hf9vuqGB";
const PRESENTATION = JSON.parse(
  await readFile(new URL("fixtures/quest-share-upcoming.json", import.meta.url), "utf8"),
); // revision 3
const FALLBACK_PNG = await readFile(new URL("../quest-share-og-fallback.png", import.meta.url));

function context({ code = LIVE, file = null, search = "", method = "GET", background } = {}) {
  const path = file ? [code, file] : [code];
  return {
    request: new Request(`${ORIGIN}/q/${path.join("/")}${search}`, { method }),
    params: { path },
    ...(background ? { waitUntil: (promise) => background.push(promise) } : {}),
    env: {
      QUEST_SHARING_ENABLED: "true",
      QUEST_STORY_SHARING_ENABLED: "true",
      QUEST_SHARE_SUPABASE_URL: SUPABASE_URL,
      QUEST_SHARE_WEB_SECRET: "web-secret",
      TURNSTILE_SITE_KEY: "0x4AAAAAACaMy8ev_fZjSv2s",
      ASSETS: {
        async fetch(request) {
          if (new URL(request.url).pathname === "/quest-share-og-fallback.png") {
            return new Response(FALLBACK_PNG, {
              status: 200,
              headers: { "Content-Type": "image/png", "Content-Length": String(FALLBACK_PNG.length) },
            });
          }
          return new Response("<!doctype html><title>Legacy</title>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        },
      },
    },
  };
}

// Backend stand-in following the quest-share-web contract agreed with lane
// durable-server: revision in the request is never needed; an alias answers
// 200 {"resolution":"alias","shareCode":TARGET}; dead codes answer 404.
function backend(routes) {
  const calls = [];
  const handler = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const route = routes[body.shareCode];
    if (!route) return Response.json({ code: "unavailable" }, { status: 404 });
    if (route.alias) return Response.json({ resolution: "alias", shareCode: route.alias });
    if (body.action === "image") {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": "4" },
      });
    }
    return Response.json({ ...route.presentation, resolution: "direct", shareCode: body.shareCode });
  };
  return { handler, calls };
}

async function withBackend(routes, run, { cache = null } = {}) {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const { handler, calls } = backend(routes);
  globalThis.fetch = handler;
  globalThis.caches = cache ? { default: cache } : undefined;
  try {
    return { result: await run(), calls };
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
}

function memoryCache() {
  const entries = new Map();
  return {
    entries,
    async match(request) {
      const entry = entries.get(request.url);
      return entry
        ? new Response(entry.body, { status: entry.status, headers: entry.headers })
        : undefined;
    },
    async put(request, response) {
      entries.set(request.url, {
        status: response.status,
        headers: new Headers(response.headers),
        body: response.body ? new Uint8Array(await response.arrayBuffer()) : null,
      });
    },
    async delete(request) {
      return entries.delete(request.url);
    },
  };
}

const LIVE_ROUTES = { [LIVE]: { presentation: PRESENTATION } };

function assertCanonicalCurrentPage(html) {
  const canonical = `${ORIGIN}/q/${LIVE}`;
  assert.match(html, /Morning Momentum/);
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}" />`), "canonical link");
  assert.ok(html.includes(`<meta property="og:url" content="${canonical}" />`), "og:url");
  assert.ok(html.includes(`app-argument=${canonical}"`), "iOS app-argument");
  // The preview image keeps the CURRENT revision as a cache key.
  assert.ok(html.includes(`content="${canonical}/og.png?r=3"`), "og:image cache key");
  assert.doesNotMatch(html, /\/q\/fvMz9mhk\?r=/);
  // Web join and app handoff carry the canonical code: the phone claim and
  // the app scheme use the bare code, and the Android install referrer
  // (deferred continuation) carries the canonical URL with no revision.
  assert.match(html, /var shareCode = "fvMz9mhk"/);
  const playStoreUrl = new URL(JSON.parse(html.match(/var PLAY_STORE_URL = (".*?");/)[1]));
  const referrer = new URLSearchParams(playStoreUrl.searchParams.get("referrer"));
  assert.equal(referrer.get("quests_link_v1"), canonical);
}

test("canonical URL: og:url, canonical link and app-argument carry no query", async () => {
  const { result, calls } = await withBackend(LIVE_ROUTES, () => onRequest(context()));
  assert.equal(result.status, 200);
  assertCanonicalCurrentPage(await result.text());
  assert.deepEqual(calls, [{ action: "metadata", shareCode: LIVE }]);
});

for (const search of ["?r=1", "?r=2", "?r=3", "?r=99", "?r=4294967296"]) {
  test(`${search} on a live code renders the current revision under the canonical URL`, async () => {
    const { result, calls } = await withBackend(LIVE_ROUTES, () => onRequest(context({ search })));
    assert.equal(result.status, 200);
    assertCanonicalCurrentPage(await result.text());
    assert.deepEqual(calls, [{ action: "metadata", shareCode: LIVE }]);
  });
}

for (const search of ["?r=", "?r=0", "?r=-1", "?r=abc", "?r=1e3", "?r=1&r=2", "?r=%00", "?utm_source=qr&r=x"]) {
  test(`malformed ${JSON.stringify(search)} never 404s a live code`, async () => {
    const { result } = await withBackend(LIVE_ROUTES, () => onRequest(context({ search })));
    assert.equal(result.status, 200);
    assertCanonicalCurrentPage(await result.text());
  });
}

test("every r variant of a page shares one edge cache entry under the canonical path", async () => {
  const cache = memoryCache();
  const background = [];
  const { result, calls } = await withBackend(LIVE_ROUTES, async () => {
    const first = await onRequest(context({ search: "?r=1", background }));
    await Promise.all(background);
    const second = await onRequest(context({ search: "?r=99", background }));
    const third = await onRequest(context({ background }));
    return { first, second, third };
  }, { cache });
  assert.equal(result.first.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(result.second.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.equal(result.third.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.equal(calls.length, 1);
  assert.deepEqual([...cache.entries.keys()], [`${ORIGIN}/q/${LIVE}`]);
});

test("og.png with a pruned or unknown revision serves current art, never 404", async () => {
  for (const search of ["?r=1", "?r=99", "?r=garbage", ""]) {
    const { result, calls } = await withBackend(
      LIVE_ROUTES,
      () => onRequest(context({ file: "og.png", search })),
    );
    assert.equal(result.status, 200, search);
    assert.equal(result.headers.get("Content-Type"), "image/png");
    assert.deepEqual(calls, [{ action: "image", artifact: "og", shareCode: LIVE }]);
  }
});

test("alias: a retired code answers 301 to the successor's canonical URL with no query", async () => {
  const routes = { ...LIVE_ROUTES, [RETIRED]: { alias: LIVE } };
  for (const search of ["", "?r=1", "?r=99", "?r=bad"]) {
    const { result, calls } = await withBackend(
      routes,
      () => onRequest(context({ code: RETIRED, search })),
    );
    assert.equal(result.status, 301, search);
    assert.equal(result.headers.get("Location"), `${ORIGIN}/q/${LIVE}`);
    assert.equal(result.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);
    assert.equal(result.headers.get("X-Robots-Tag"), "noindex, nofollow");
    assert.equal(await result.text(), "");
    // One lookup for the alias, one to prove the target renders.
    assert.deepEqual(calls, [
      { action: "metadata", shareCode: RETIRED },
      { action: "metadata", shareCode: LIVE },
    ]);
  }
});

test("alias: preview images redirect to the successor's image", async () => {
  const routes = { ...LIVE_ROUTES, [RETIRED]: { alias: LIVE } };
  for (const file of ["og.png", "story.png"]) {
    const { result } = await withBackend(
      routes,
      () => onRequest(context({ code: RETIRED, file, search: "?r=1" })),
    );
    assert.equal(result.status, 301, file);
    assert.equal(result.headers.get("Location"), `${ORIGIN}/q/${LIVE}/${file}`);
  }
});

test("alias redirects are edge cached so printed codes do not hit the backend per scan", async () => {
  const cache = memoryCache();
  const background = [];
  const routes = { ...LIVE_ROUTES, [RETIRED]: { alias: LIVE } };
  const { result, calls } = await withBackend(routes, async () => {
    const first = await onRequest(context({ code: RETIRED, background }));
    await Promise.all(background);
    const second = await onRequest(context({ code: RETIRED, search: "?r=2", background }));
    return { first, second };
  }, { cache });
  assert.equal(result.second.status, 301);
  assert.equal(result.second.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.equal(result.second.headers.get("Location"), `${ORIGIN}/q/${LIVE}`);
  assert.equal(calls.length, 2);
});

test("alias to a dead target, a chain or itself shows Quest unavailable", async () => {
  const cases = [
    { [RETIRED]: { alias: LIVE } }, // target link revoked or removed
    { [RETIRED]: { alias: LIVE }, [LIVE]: { alias: "Zz23Zz23" }, Zz23Zz23: { presentation: PRESENTATION } },
    { [RETIRED]: { alias: RETIRED } },
    { [RETIRED]: { alias: "not-a-code" } },
  ];
  for (const routes of cases) {
    const { result } = await withBackend(routes, () => onRequest(context({ code: RETIRED })));
    assert.equal(result.status, 404);
    assert.match(await result.text(), /This Quest link is unavailable or has expired\./);
  }
});

test("revoked or moderation-removed code still shows Quest unavailable for any r", async () => {
  for (const search of ["", "?r=1", "?r=99", "?r=bad"]) {
    const { result } = await withBackend({}, () => onRequest(context({ code: RETIRED, search })));
    assert.equal(result.status, 404, search);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
    const html = await result.text();
    assert.match(html, /This Quest link is unavailable or has expired\./);
    assert.doesNotMatch(html, /Morning Momentum|phone-claim-form/);
  }
});

test("alias parsing accepts only the agreed body and a different valid code", () => {
  assert.equal(questShareAliasTarget({ resolution: "alias", shareCode: LIVE }, RETIRED), LIVE);
  assert.equal(questShareAliasTarget({ resolution: "alias", shareCode: LIVE }, LIVE), null);
  assert.equal(questShareAliasTarget({ resolution: "direct", shareCode: LIVE }, RETIRED), null);
  assert.equal(questShareAliasTarget({ resolution: "alias", shareCode: "../evil" }, RETIRED), null);
  assert.equal(questShareAliasTarget(null, RETIRED), null);
});

test("only 301s with a Location join 200s as edge-storable", () => {
  const redirect = new Response(null, {
    status: 301,
    headers: { Location: `${ORIGIN}/q/${LIVE}`, "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL },
  });
  const bare = new Response(null, { status: 301, headers: { "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL } });
  const found = new Response(null, {
    status: 302,
    headers: { Location: "/", "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL },
  });
  assert.equal(isShareEdgeCacheable(redirect), true);
  assert.equal(isShareEdgeCacheable(bare), false);
  assert.equal(isShareEdgeCacheable(found), false);
});

test("the og cache key follows currentRevision when the server echoes a requested revision", async () => {
  const routes = { [LIVE]: { presentation: { ...PRESENTATION, revision: 2, currentRevision: 3 } } };
  const { result } = await withBackend(routes, () => onRequest(context({ search: "?r=2" })));
  assert.equal(result.status, 200);
  assertCanonicalCurrentPage(await result.text());
});
