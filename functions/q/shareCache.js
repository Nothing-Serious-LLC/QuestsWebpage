// Edge cache for joinable Quest share responses (SC-34).
//
// A Pages Function response is never cached by Cloudflare on its own, and the
// Cache API ignores stale-while-revalidate, so this module stores joinable
// 200 responses in the data center's cache (caches.default) and serves them
// for SHARE_EDGE_TTL_SECONDS. After that it serves the stored copy once more
// while a refresh runs in the background, for up to SHARE_STALE_SECONDS. The
// browser still sees the plain Cache-Control below and revalidates every load
// (max-age=0); only shared caches hold the page, and only for a minute, so a
// cancelled or ended Quest leaves the page within that minute. The join RPC
// enforces Quest state on every claim regardless of what the page showed.
//
// Responses are stored only when the producer marked them with
// SHARE_PUBLIC_CACHE_CONTROL: joinable share pages and 200 preview images.
// Error pages, ended Quests, the staging fixture and anything carrying
// no-store are never stored. No response on these routes sets a cookie.

export const SHARE_EDGE_TTL_SECONDS = 60;
export const SHARE_STALE_SECONDS = 300;
export const SHARE_PUBLIC_CACHE_CONTROL =
  `public, max-age=0, s-maxage=${SHARE_EDGE_TTL_SECONDS}, ` +
  `stale-while-revalidate=${SHARE_STALE_SECONDS}`;
export const SHARE_CACHE_STATUS_HEADER = "X-Quest-Cache";

const CACHED_AT_HEADER = "X-Quest-Cached-At";
const STORED_CACHE_CONTROL =
  `public, max-age=${SHARE_EDGE_TTL_SECONDS + SHARE_STALE_SECONDS}`;

export function isShareEdgeCacheable(response) {
  if (!response || response.status !== 200) return false;
  if (response.headers.has("Set-Cookie")) return false;
  return response.headers.get("Cache-Control") === SHARE_PUBLIC_CACHE_CONTROL;
}

function defaultCache() {
  try {
    return globalThis.caches && globalThis.caches.default
      ? globalThis.caches.default
      : null;
  } catch {
    return null;
  }
}

function reasonOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function withStatus(response, method, status, ageSeconds) {
  const headers = new Headers(response.headers);
  headers.set(SHARE_CACHE_STATUS_HEADER, status);
  if (ageSeconds != null) headers.set("Age", String(ageSeconds));
  return new Response(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function fromStore(stored, method, status, ageSeconds) {
  const headers = new Headers(stored.headers);
  headers.delete(CACHED_AT_HEADER);
  headers.set("Cache-Control", SHARE_PUBLIC_CACHE_CONTROL);
  headers.set(SHARE_CACHE_STATUS_HEADER, status);
  headers.set("Age", String(ageSeconds));
  return new Response(method === "HEAD" ? null : stored.body, {
    status: stored.status,
    statusText: stored.statusText,
    headers,
  });
}

async function store(cache, key, response, cachedAtMs) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", STORED_CACHE_CONTROL);
  headers.set(CACHED_AT_HEADER, String(cachedAtMs));
  headers.delete(SHARE_CACHE_STATUS_HEADER);
  headers.delete("Age");
  await cache.put(
    key,
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

async function produceAndStore({ cache, key, produce, now }) {
  const response = await produce("GET");
  if (isShareEdgeCacheable(response)) {
    try {
      await store(cache, key, response.clone(), now());
    } catch (error) {
      console.warn("share edge cache store skipped", { reason: reasonOf(error) });
    }
  }
  return response;
}

function schedule(promise, waitUntil) {
  if (typeof waitUntil === "function") {
    waitUntil(promise);
    return Promise.resolve();
  }
  return promise;
}

// produce(method) renders the live response for the given method. The cache
// layer always renders "GET" for the stored copy and strips the body for HEAD.
export async function withShareEdgeCache({
  request,
  produce,
  waitUntil,
  cache = defaultCache(),
  now = Date.now,
}) {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return produce(method);
  }
  if (!cache) {
    return withStatus(await produce("GET"), method, "BYPASS", null);
  }

  const key = new Request(request.url, { method: "GET" });

  let stored = null;
  try {
    stored = await cache.match(key);
  } catch (error) {
    console.warn("share edge cache match failed", { reason: reasonOf(error) });
  }

  if (stored) {
    const cachedAt = Number(stored.headers.get(CACHED_AT_HEADER));
    const ageSeconds = Number.isFinite(cachedAt)
      ? Math.max(0, Math.floor((now() - cachedAt) / 1000))
      : Number.POSITIVE_INFINITY;

    if (ageSeconds <= SHARE_EDGE_TTL_SECONDS) {
      return fromStore(stored, method, "HIT", ageSeconds);
    }
    if (ageSeconds <= SHARE_EDGE_TTL_SECONDS + SHARE_STALE_SECONDS) {
      const refresh = produceAndStore({ cache, key, produce, now }).catch((error) => {
        console.warn("share edge cache refresh failed", { reason: reasonOf(error) });
      });
      await schedule(refresh, waitUntil);
      return fromStore(stored, method, "STALE", ageSeconds);
    }
  }

  const response = await produce("GET");
  if (isShareEdgeCacheable(response)) {
    const save = store(cache, key, response.clone(), now()).catch((error) => {
      console.warn("share edge cache store skipped", { reason: reasonOf(error) });
    });
    await schedule(save, waitUntil);
  }
  return withStatus(response, method, "MISS", null);
}
