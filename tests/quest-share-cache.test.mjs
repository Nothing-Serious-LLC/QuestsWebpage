import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onRequest } from "../functions/q/[[path]].js";
import {
  SHARE_CACHE_STATUS_HEADER,
  SHARE_EDGE_TTL_SECONDS,
  SHARE_PUBLIC_CACHE_CONTROL,
  SHARE_STALE_SECONDS,
  isShareEdgeCacheable,
  withShareEdgeCache,
} from "../functions/q/shareCache.js";

const ROOT = new URL("../", import.meta.url);
const SUPABASE_URL = "https://project.supabase.co";
const FALLBACK_PNG = await readFile(new URL("quest-share-og-fallback.png", ROOT));

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"));
}

// In-memory stand-in for caches.default: stores bytes and headers per URL.
function memoryCache({ failPut = false } = {}) {
  const entries = new Map();
  const log = { matches: 0, puts: 0, deletes: 0 };
  return {
    entries,
    log,
    async delete(request) {
      log.deletes += 1;
      return entries.delete(request.url);
    },
    async match(request) {
      log.matches += 1;
      const entry = entries.get(request.url);
      if (!entry) return undefined;
      return new Response(entry.body, { status: entry.status, headers: entry.headers });
    },
    async put(request, response) {
      log.puts += 1;
      if (failPut) throw new Error("cache put rejected");
      entries.set(request.url, {
        status: response.status,
        headers: new Headers(response.headers),
        body: new Uint8Array(await response.arrayBuffer()),
      });
    },
  };
}

function context({
  path = ["AbCd2345"],
  method = "GET",
  search = "",
  storyEnabled = false,
  background = [],
} = {}) {
  return {
    request: new Request(`https://invite.thequestsapp.com/q/${path.join("/")}${search}`, { method }),
    params: { path },
    waitUntil: (promise) => background.push(promise),
    env: {
      QUEST_SHARING_ENABLED: "true",
      QUEST_STORY_SHARING_ENABLED: storyEnabled ? "true" : "false",
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

async function withEdge(handler, run) {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    return handler(url, init, calls);
  };
  try {
    const result = await run();
    return { result, calls: () => calls };
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
}

function installCache(cache) {
  globalThis.caches = { default: cache };
}

const JOINABLE = "quest-share-upcoming.json";
const ENDED = "quest-share-ended.json";

test("the public policy is one minute at the edge, zero in the browser, with a short stale window", () => {
  assert.equal(SHARE_EDGE_TTL_SECONDS, 60);
  assert.equal(SHARE_STALE_SECONDS, 300);
  assert.equal(SHARE_PUBLIC_CACHE_CONTROL, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
});

test("joinable share page: MISS renders once, HIT serves the stored copy without an Edge call", async () => {
  const presentation = await fixture(JOINABLE);
  const cache = memoryCache();
  const background = [];
  const { result, calls } = await withEdge(
    async () => Response.json(presentation, { status: 200 }),
    async () => {
      installCache(cache);
      const first = await onRequest(context({ background }));
      await Promise.all(background);
      const second = await onRequest(context({ background }));
      return { first, second };
    },
  );

  assert.equal(result.first.status, 200);
  assert.equal(result.first.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);
  assert.equal(result.first.headers.get("Vary"), "Accept-Encoding");
  assert.equal(result.first.headers.has("Set-Cookie"), false);
  assert.equal(result.first.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(result.first.headers.get("X-Robots-Tag"), "noindex, nofollow");

  assert.equal(result.second.status, 200);
  assert.equal(result.second.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.equal(result.second.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);
  assert.equal(result.second.headers.get("Age"), "0");
  assert.equal(result.second.headers.has("X-Quest-Cached-At"), false);
  assert.equal(calls(), 1);

  const [firstHtml, secondHtml] = [await result.first.text(), await result.second.text()];
  assert.match(firstHtml, /Morning Momentum/);
  assert.equal(secondHtml, firstHtml);
  assert.equal(cache.entries.size, 1);
  assert.ok(cache.entries.has("https://invite.thequestsapp.com/q/AbCd2345"));
});

test("HEAD is answered from the GET entry with the same headers and no body", async () => {
  const presentation = await fixture(JOINABLE);
  const cache = memoryCache();
  const background = [];
  const { result, calls } = await withEdge(
    async () => Response.json(presentation, { status: 200 }),
    async () => {
      installCache(cache);
      const head = await onRequest(context({ method: "HEAD", background }));
      await Promise.all(background);
      const get = await onRequest(context({ background }));
      return { head, get };
    },
  );
  assert.equal(result.head.status, 200);
  assert.equal(await result.head.text(), "");
  assert.equal(result.head.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(result.get.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.match(await result.get.text(), /Morning Momentum/);
  assert.equal(calls(), 1);
});

test("ended Quest page stays no-store and is never stored", async () => {
  const presentation = await fixture(ENDED);
  const cache = memoryCache();
  const { result, calls } = await withEdge(
    async () => Response.json(presentation, { status: 200 }),
    async () => {
      installCache(cache);
      const first = await onRequest(context());
      const second = await onRequest(context());
      return { first, second };
    },
  );
  assert.equal(result.first.status, 200);
  assert.equal(result.first.headers.get("Cache-Control"), "no-store");
  assert.equal(result.first.headers.has("Vary"), false);
  assert.equal(result.first.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(result.second.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(cache.log.puts, 0);
  assert.equal(calls(), 2);
});

test("unavailable (404) and transient failure (legacy) responses stay no-store and uncached", async () => {
  const cache = memoryCache();
  const { result } = await withEdge(
    async (_url, _init, call) =>
      call === 1
        ? Response.json({ code: "not_found" }, { status: 404 })
        : Response.json({ code: "upstream_failed" }, { status: 502 }),
    async () => {
      installCache(cache);
      const unavailable = await onRequest(context());
      const legacy = await onRequest(context());
      return { unavailable, legacy };
    },
  );
  assert.equal(result.unavailable.status, 404);
  assert.equal(result.unavailable.headers.get("Cache-Control"), "no-store");
  assert.equal(result.legacy.status, 200);
  assert.equal(result.legacy.headers.get("Cache-Control"), "no-store");
  assert.equal(cache.log.puts, 0);
});

test("preview image: r is a cache key only, every value gets current art, an unpublished link gets the fallback", async () => {
  const cache = memoryCache();
  const background = [];
  const png = new Uint8Array([137, 80, 78, 71]);
  const bodies = [];
  let published = true;
  const { result, calls } = await withEdge(
    async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return published
        ? new Response(png, { status: 200, headers: { "Content-Type": "image/png", "Content-Length": "4" } })
        : Response.json({ code: "unavailable" }, { status: 404 });
    },
    async () => {
      installCache(cache);
      const r9Miss = await onRequest(context({ path: ["AbCd2345", "og.png"], search: "?r=9", background }));
      await Promise.all(background);
      const r9Hit = await onRequest(context({ path: ["AbCd2345", "og.png"], search: "?r=9", background }));
      const r4 = await onRequest(context({ path: ["AbCd2345", "og.png"], search: "?r=4", background }));
      await Promise.all(background);
      published = false;
      const fallback = await onRequest(context({ path: ["AbCd2345", "og.png"], background }));
      await Promise.all(background);
      const garbage = await onRequest(context({ path: ["AbCd2345", "og.png"], search: "?r=zz", background }));
      return { r9Miss, r9Hit, r4, fallback, garbage };
    },
  );

  assert.equal(result.r9Miss.status, 200);
  assert.equal(result.r9Miss.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);
  assert.equal(result.r9Miss.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(result.r9Hit.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.deepEqual(new Uint8Array(await result.r9Hit.arrayBuffer()), png);

  // An older or pruned revision on the image URL still answers with the
  // current artwork under its own cache key.
  assert.equal(result.r4.status, 200);
  assert.deepEqual(new Uint8Array(await result.r4.arrayBuffer()), png);

  assert.equal(result.fallback.status, 200);
  assert.equal(result.fallback.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);
  assert.equal(result.fallback.headers.get("Content-Length"), String(FALLBACK_PNG.length));
  // A malformed r collapses onto the bare image key instead of 404ing.
  assert.equal(result.garbage.status, 200);
  assert.equal(result.garbage.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");

  assert.ok(bodies.every((body) => !("revision" in body)));
  assert.equal(calls(), 3);
  assert.deepEqual([...cache.entries.keys()].sort(), [
    "https://invite.thequestsapp.com/q/AbCd2345/og.png",
    "https://invite.thequestsapp.com/q/AbCd2345/og.png?r=4",
    "https://invite.thequestsapp.com/q/AbCd2345/og.png?r=9",
  ]);
});

test("stale copy is served once past the TTL while a refresh runs in the background", async () => {
  const cache = memoryCache();
  let clock = Date.parse("2026-11-01T18:00:00.000Z");
  let version = 0;
  const background = [];
  const produce = async () => {
    version += 1;
    return new Response(`page v${version}`, {
      status: 200,
      headers: { "Content-Type": "text/html", "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL },
    });
  };
  const run = (method = "GET") => withShareEdgeCache({
    request: new Request("https://invite.thequestsapp.com/q/AbCd2345", { method }),
    produce,
    cache,
    now: () => clock,
    waitUntil: (promise) => background.push(promise),
  });

  const miss = await run();
  await Promise.all(background.splice(0));
  assert.equal(miss.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(await miss.text(), "page v1");

  clock += 30_000;
  const hit = await run();
  assert.equal(hit.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.equal(hit.headers.get("Age"), "30");
  assert.equal(await hit.text(), "page v1");

  clock += 60_000;
  const stale = await run();
  assert.equal(stale.headers.get(SHARE_CACHE_STATUS_HEADER), "STALE");
  assert.equal(stale.headers.get("Age"), "90");
  assert.equal(await stale.text(), "page v1");
  assert.equal(background.length, 1);
  await Promise.all(background.splice(0));
  assert.equal(version, 2);

  const fresh = await run("HEAD");
  assert.equal(fresh.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");
  assert.equal(await fresh.text(), "");
  assert.equal(fresh.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);

  clock += (SHARE_EDGE_TTL_SECONDS + SHARE_STALE_SECONDS + 1) * 1000;
  const expired = await run();
  assert.equal(expired.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(await expired.text(), "page v3");
});

test("a refresh that turns unjoinable drops the stored copy so the next request sees the live page", async () => {
  const cache = memoryCache();
  let clock = Date.parse("2026-11-01T18:00:00.000Z");
  let joinable = true;
  const background = [];
  const produce = async () => (joinable
    ? new Response("joinable page", {
      status: 200,
      headers: { "Content-Type": "text/html", "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL },
    })
    : new Response("unavailable page", {
      status: 404,
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    }));
  const run = () => withShareEdgeCache({
    request: new Request("https://invite.thequestsapp.com/q/AbCd2345"),
    produce,
    cache,
    now: () => clock,
    waitUntil: (promise) => background.push(promise),
  });

  await run();
  await Promise.all(background.splice(0));

  // The host cancels the Quest 30 s after the page was stored.
  clock += 30_000;
  joinable = false;
  const hit = await run();
  assert.equal(hit.headers.get(SHARE_CACHE_STATUS_HEADER), "HIT");

  // Past the TTL the stored copy is served once while the refresh runs.
  clock += 35_000;
  const stale = await run();
  assert.equal(stale.headers.get(SHARE_CACHE_STATUS_HEADER), "STALE");
  await Promise.all(background.splice(0));
  assert.equal(cache.entries.size, 0);

  // The next request goes to the origin and gets the unavailable page.
  clock += 1_000;
  const live = await run();
  assert.equal(live.status, 404);
  assert.equal(live.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
  assert.equal(await live.text(), "unavailable page");
});

test("a rejected cache store is logged and the live response is still served", async () => {
  const cache = memoryCache({ failPut: true });
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const response = await withShareEdgeCache({
      request: new Request("https://invite.thequestsapp.com/q/AbCd2345"),
      produce: async () => new Response("live", {
        status: 200,
        headers: { "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL },
      }),
      cache,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "live");
    assert.equal(response.headers.get(SHARE_CACHE_STATUS_HEADER), "MISS");
    assert.equal(warnings[0][0], "share edge cache store skipped");
  } finally {
    console.warn = original;
  }
});

test("without a cache binding the route bypasses and still serves the live page", async () => {
  const presentation = await fixture(JOINABLE);
  const { result } = await withEdge(
    async () => Response.json(presentation, { status: 200 }),
    async () => {
      globalThis.caches = undefined;
      return onRequest(context());
    },
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get(SHARE_CACHE_STATUS_HEADER), "BYPASS");
  assert.equal(result.headers.get("Cache-Control"), SHARE_PUBLIC_CACHE_CONTROL);
});

test("only 200 responses carrying the public policy and no cookie are storable", () => {
  const ok = new Response("x", { status: 200, headers: { "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL } });
  const cookie = new Response("x", { status: 200, headers: { "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL, "Set-Cookie": "a=b" } });
  const noStore = new Response("x", { status: 200, headers: { "Cache-Control": "no-store" } });
  const notFound = new Response("x", { status: 404, headers: { "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL } });
  assert.equal(isShareEdgeCacheable(ok), true);
  assert.equal(isShareEdgeCacheable(cookie), false);
  assert.equal(isShareEdgeCacheable(noStore), false);
  assert.equal(isShareEdgeCacheable(notFound), false);
});
