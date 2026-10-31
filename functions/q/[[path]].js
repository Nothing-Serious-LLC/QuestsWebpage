import {
  QUEST_SHARE_CODE_PATTERN,
  QUEST_SHARE_REVISION_PATTERN,
  normalizeQuestSharePresentation,
  safeTurnstileSiteKey,
} from "./questSharePresentation.js";
import { questSharePage, questUnavailablePage } from "./questPage.js";
import {
  STAGING_QUEST_FIXTURE_TOKEN,
  stagingQuestFixtureForRequest,
  stagingQuestFixtureOgPathForCode,
} from "./stagingQuestFixture.js";
import { appHandoffForHost } from "./appHandoffTargets.js";
import { SHARE_PUBLIC_CACHE_CONTROL, withShareEdgeCache } from "./shareCache.js";
import { questDownloadHandoff } from "./downloadHandoff.js";

const EDGE_TIMEOUT_MS = 4_000;
const REVISION_ZERO_OG_FALLBACK_PATH = "/quest-share-og-fallback.png";

export function isQuestSharingEnabled(env) {
  return String(env?.QUEST_SHARING_ENABLED || "").trim().toLowerCase() === "true";
}

export function isQuestStorySharingEnabled(env) {
  return String(env?.QUEST_STORY_SHARING_ENABLED || "").trim().toLowerCase() === "true";
}

function pathSegments(params) {
  if (Array.isArray(params?.path)) return params.path.map(String).filter(Boolean);
  if (params?.path == null) return [];
  return String(params.path).split("/").filter(Boolean);
}

function normalizeShareCode(value) {
  const candidate = String(value || "").trim();
  return QUEST_SHARE_CODE_PATTERN.test(candidate) ? candidate : null;
}

function appHandoffFromEnv(env, url) {
  return appHandoffForHost(url?.hostname, {
    appScheme: env?.QUEST_SHARE_APP_SCHEME ?? env?.QUEST_SHARE_IOS_SCHEME,
    androidPackage: env?.QUEST_SHARE_ANDROID_PACKAGE,
    appStoreUrl: env?.QUEST_SHARE_IOS_STORE_URL,
    playStoreUrl: env?.QUEST_SHARE_ANDROID_STORE_URL,
    appStoreId: env?.QUEST_SHARE_IOS_STORE_ID,
  });
}

async function legacyQuestPage(context, { transientFailure = false } = {}) {
  const url = new URL(context.request.url);
  url.pathname = "/q/";
  const assetResponse = await context.env.ASSETS.fetch(
    new Request(url.toString(), context.request),
  );

  const response = new Response(assetResponse.body, assetResponse);
  response.headers.set(
    "Cache-Control",
    transientFailure ? "no-store" : "public, max-age=300, s-maxage=600",
  );
  response.headers.set("Vary", "Accept-Encoding");
  return response;
}

export async function callQuestShareWeb(env, body) {
  const supabaseUrl = String(env?.QUEST_SHARE_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const secret = String(env?.QUEST_SHARE_WEB_SECRET || "").trim();
  if (!supabaseUrl || !secret) return { status: 503, response: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/quest-share-web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-quest-share-secret": secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { status: response.status, response };
  } catch {
    return { status: 503, response: null };
  } finally {
    clearTimeout(timeout);
  }
}

function imageNotFound(requestMethod) {
  return new Response(requestMethod === "HEAD" ? null : "Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function imageServiceUnavailable(requestMethod) {
  return new Response(requestMethod === "HEAD" ? null : "Service unavailable", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Code succession (durable links): quest-share-web answers a retired code that
// has a recorded successor with 200 {"resolution":"alias","shareCode":TARGET}
// for both actions. The web follows exactly one hop: it answers 301 to the
// target's canonical URL (no query) and never redirects a code to itself.
export function questShareAliasTarget(body, requestedCode) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.resolution !== "alias") return null;
  const target = normalizeShareCode(body.shareCode);
  return target && target !== requestedCode ? target : null;
}

async function readAliasTarget(response, requestedCode) {
  const contentType = String(response?.headers?.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") return null;
  try {
    return questShareAliasTarget(await response.clone().json(), requestedCode);
  } catch {
    return null;
  }
}

function aliasRedirect(location, requestMethod) {
  return new Response(null, {
    status: 301,
    headers: {
      Location: location,
      "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

// The branded fallback is cacheable when the backend said the link has no
// artwork (a stable revision-zero state) and stays no-store when it stands in
// for an upstream failure, so a recovered backend is seen on the next request.
async function revisionZeroOgFallback(context, { requestMethod, cacheControl }) {
  if (!context.env?.ASSETS?.fetch) {
    return imageServiceUnavailable(requestMethod);
  }

  const url = new URL(context.request.url);
  url.pathname = REVISION_ZERO_OG_FALLBACK_PATH;
  url.search = "";

  let assetResponse;
  try {
    assetResponse = await context.env.ASSETS.fetch(new Request(url.toString()));
  } catch {
    return imageServiceUnavailable(requestMethod);
  }

  const contentType = String(assetResponse.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!assetResponse.ok || contentType !== "image/png") {
    return imageServiceUnavailable(requestMethod);
  }

  const headers = new Headers({
    "Content-Type": "image/png",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
  const contentLength = assetResponse.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(
    requestMethod === "HEAD" ? null : assetResponse.body,
    { status: 200, headers },
  );
}

async function stagingFixtureOg(context, shareCode) {
  const fixtureOgPath = stagingQuestFixtureOgPathForCode(shareCode);
  if (!context.env?.ASSETS?.fetch || !fixtureOgPath) {
    return imageServiceUnavailable(context.request.method);
  }
  const url = new URL(context.request.url);
  url.pathname = fixtureOgPath;
  url.search = "";
  let assetResponse;
  try {
    assetResponse = await context.env.ASSETS.fetch(
      new Request(url.toString()),
    );
  } catch {
    return imageServiceUnavailable(context.request.method);
  }
  const contentType = String(assetResponse.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!assetResponse.ok || contentType !== "image/png") {
    return imageServiceUnavailable(context.request.method);
  }
  const headers = new Headers({
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
  const contentLength = assetResponse.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }
  return new Response(
    context.request.method === "HEAD" ? null : assetResponse.body,
    {
      status: 200,
      headers,
    },
  );
}

// Preview images always resolve the link's CURRENT artwork. A ?r= on the
// image URL is only a cache key for unfurlers, so an old, pruned or unknown
// revision never 404s and never serves stale art for a live code.
async function questArtifactResponse({
  context,
  url,
  shareCode,
  artifact,
  requestMethod,
}) {
  const body = {
    action: "image",
    artifact,
    shareCode,
  };

  const { status, response } = await callQuestShareWeb(context.env, body);
  if (status === 200 && response) {
    const aliasTarget = await readAliasTarget(response, shareCode);
    if (aliasTarget) {
      const file = artifact === "story" ? "story.png" : "og.png";
      return aliasRedirect(`${url.origin}/q/${aliasTarget}/${file}`, requestMethod);
    }
  }
  const canUseRevisionZeroFallback = artifact === "og";
  if (status === 404) {
    return canUseRevisionZeroFallback
      ? revisionZeroOgFallback(context, {
        requestMethod,
        cacheControl: SHARE_PUBLIC_CACHE_CONTROL,
      })
      : imageNotFound(requestMethod);
  }
  if (status !== 200 || !response) {
    if (canUseRevisionZeroFallback) {
      return revisionZeroOgFallback(context, { requestMethod, cacheControl: "no-store" });
    }
    return artifact === "story"
      ? imageNotFound(requestMethod)
      : imageServiceUnavailable(requestMethod);
  }

  const contentType = String(response.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "image/png") {
    if (canUseRevisionZeroFallback) {
      return revisionZeroOgFallback(context, { requestMethod, cacheControl: "no-store" });
    }
    return artifact === "story"
      ? imageNotFound(requestMethod)
      : imageServiceUnavailable(requestMethod);
  }

  const headers = new Headers({
    "Content-Type": "image/png",
    "Cache-Control": SHARE_PUBLIC_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
  const contentLength = response.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(requestMethod === "HEAD" ? null : response.body, {
    status: 200,
    headers,
  });
}

async function fetchPresentation(context, shareCode) {
  const { status, response } = await callQuestShareWeb(context.env, {
    action: "metadata",
    shareCode,
  });
  if (status !== 200 || !response) return { status, raw: null };
  try {
    return { status, raw: await response.json() };
  } catch {
    return { status, raw: null };
  }
}

// An alias redirects only to a target that renders a real presentation, so a
// misrecorded alias (a chain, a loop, a dead target) shows "Quest unavailable"
// instead of bouncing the visitor between codes.
async function aliasTargetIsLive(context, targetCode) {
  const { status, raw } = await fetchPresentation(context, targetCode);
  if (status !== 200 || !raw || raw.resolution === "alias") return false;
  return normalizeQuestSharePresentation(raw, {
    supabaseUrl: context.env.QUEST_SHARE_SUPABASE_URL,
  }) !== null;
}

// The page always renders the link's CURRENT revision. Any ?r= (current,
// older, pruned, unknown or malformed) is ignored for lookup: identity is the
// share code, so old revision-pinned URLs keep working and show fresh content.
async function liveQuestSharePage(context, { url, shareCode, requestMethod }) {
  const { status, response } = await callQuestShareWeb(context.env, {
    action: "metadata",
    shareCode,
  });
  if (status === 404) {
    return questUnavailablePage({
      requestMethod,
      appHandoff: appHandoffFromEnv(context.env, url),
    });
  }
  if (status !== 200 || !response) {
    return legacyQuestPage(context, { transientFailure: true });
  }

  let rawPresentation;
  try {
    rawPresentation = await response.json();
  } catch {
    return questUnavailablePage({
      requestMethod,
      appHandoff: appHandoffFromEnv(context.env, url),
    });
  }

  const aliasTarget = questShareAliasTarget(rawPresentation, shareCode);
  if (aliasTarget) {
    return await aliasTargetIsLive(context, aliasTarget)
      ? aliasRedirect(`${url.origin}/q/${aliasTarget}`, requestMethod)
      : questUnavailablePage({
        requestMethod,
        appHandoff: appHandoffFromEnv(context.env, url),
      });
  }

  const presentation = normalizeQuestSharePresentation(rawPresentation, {
    supabaseUrl: context.env.QUEST_SHARE_SUPABASE_URL,
  });
  if (!presentation) {
    return questUnavailablePage({
      requestMethod,
      appHandoff: appHandoffFromEnv(context.env, url),
    });
  }

  const turnstileSiteKey = safeTurnstileSiteKey(context.env.TURNSTILE_SITE_KEY);
  if (!turnstileSiteKey) {
    console.error(
      "TURNSTILE_SITE_KEY missing or malformed; rendering app-only join panel",
    );
  }

  return questSharePage({
    origin: url.origin,
    shareCode,
    presentation,
    turnstileSiteKey,
    appHandoff: appHandoffFromEnv(context.env, url),
    interactionMode: turnstileSiteKey ? "phone" : "app-only",
    requestMethod,
    cacheControl: presentation.availability === "joinable"
      ? SHARE_PUBLIC_CACHE_CONTROL
      : "no-store",
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const segments = pathSegments(context.params);
  if (segments.length < 1 || segments.length > 2) {
    return legacyQuestPage(context);
  }

  const shareCode = normalizeShareCode(segments[0]);
  if (!shareCode) return legacyQuestPage(context);

  const artifact = segments.length === 2
    ? segments[1] === "og.png"
      ? "og"
      : segments[1] === "story.png"
        ? "story"
        : null
    : null;
  if (segments.length === 2 && !artifact) return legacyQuestPage(context);

  const url = new URL(context.request.url);
  if (!artifact && url.searchParams.get("download") === "1") {
    return questDownloadHandoff({
      request: context.request,
      shareCode,
      appHandoff: appHandoffFromEnv(context.env, url),
    });
  }
  const stagingFixture = stagingQuestFixtureForRequest({
    url,
    shareCode,
  });
  if (stagingFixture) {
    if (artifact === "og") {
      return stagingFixtureOg(context, shareCode);
    }
    if (artifact === "story") {
      return imageNotFound(context.request.method);
    }
    return questSharePage({
      origin: url.origin,
      shareCode,
      presentation: stagingFixture,
      appHandoff: {
        appScheme: "quests-staging",
        androidPackage: "info.nothingserious.quests.staging",
      },
      interactionMode: "phone-demo",
      previewQuery: `preview=${STAGING_QUEST_FIXTURE_TOKEN}`,
      requestMethod: context.request.method,
    });
  }

  if (!isQuestSharingEnabled(context.env)) {
    return legacyQuestPage(context);
  }

  // r is a cache hint only. A well-formed value keeps its own stored image
  // (cache busting for unfurlers); anything else collapses onto the bare
  // path. Pages always store under the bare canonical path.
  const revisionParam = url.searchParams.get("r");
  const cacheRevision = revisionParam && QUEST_SHARE_REVISION_PATTERN.test(revisionParam)
    ? revisionParam
    : null;
  const canonicalPath = `${url.origin}${url.pathname}`;

  const waitUntil = typeof context.waitUntil === "function"
    ? (promise) => context.waitUntil(promise)
    : undefined;

  if (artifact) {
    if (artifact === "story" && !isQuestStorySharingEnabled(context.env)) {
      return imageNotFound(context.request.method);
    }
    return withShareEdgeCache({
      request: context.request,
      cacheKeyUrl: cacheRevision ? `${canonicalPath}?r=${cacheRevision}` : canonicalPath,
      waitUntil,
      produce: (requestMethod) => questArtifactResponse({
        context,
        url,
        shareCode,
        artifact,
        requestMethod,
      }),
    });
  }

  return withShareEdgeCache({
    request: context.request,
    cacheKeyUrl: canonicalPath,
    waitUntil,
    produce: (requestMethod) => liveQuestSharePage(context, {
      url,
      shareCode,
      requestMethod,
    }),
  });
}
