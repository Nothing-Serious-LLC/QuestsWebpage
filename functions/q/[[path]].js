import {
  QUEST_SHARE_CODE_PATTERN,
  QUEST_SHARE_REVISION_PATTERN,
  normalizeQuestSharePresentation,
  safeTurnstileSiteKey,
} from "./questSharePresentation.js";
import { questSharePage, questUnavailablePage } from "./questPage.js";

const EDGE_TIMEOUT_MS = 4_000;

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

function appHandoffFromEnv(env) {
  return {
    appScheme: env?.QUEST_SHARE_APP_SCHEME ?? env?.QUEST_SHARE_IOS_SCHEME,
    androidPackage: env?.QUEST_SHARE_ANDROID_PACKAGE,
    appStoreUrl: env?.QUEST_SHARE_IOS_STORE_URL,
    playStoreUrl: env?.QUEST_SHARE_ANDROID_STORE_URL,
    appStoreId: env?.QUEST_SHARE_IOS_STORE_ID,
  };
}

async function legacyQuestPage(context) {
  const url = new URL(context.request.url);
  url.pathname = "/q/";
  const assetResponse = await context.env.ASSETS.fetch(
    new Request(url.toString(), context.request),
  );

  const response = new Response(assetResponse.body, assetResponse);
  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=600");
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

async function questArtifactResponse({
  context,
  shareCode,
  revision,
  artifact,
}) {
  const body = {
    action: "image",
    artifact,
    shareCode,
  };
  if (revision) body.revision = Number(revision);

  const { status, response } = await callQuestShareWeb(context.env, body);
  if (status === 404) return imageNotFound(context.request.method);
  if (status !== 200 || !response) {
    return artifact === "story"
      ? imageNotFound(context.request.method)
      : imageServiceUnavailable(context.request.method);
  }

  const contentType = String(response.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "image/png") {
    return artifact === "story"
      ? imageNotFound(context.request.method)
      : imageServiceUnavailable(context.request.method);
  }

  const headers = new Headers({
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const contentLength = response.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(context.request.method === "HEAD" ? null : response.body, {
    status: 200,
    headers,
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  if (!isQuestSharingEnabled(context.env)) {
    return legacyQuestPage(context);
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
  const revisionParam = url.searchParams.get("r");
  const revision = revisionParam && QUEST_SHARE_REVISION_PATTERN.test(revisionParam)
    ? revisionParam
    : null;
  if (revisionParam && !revision) {
    return artifact
      ? imageNotFound(context.request.method)
      : questUnavailablePage({
        requestMethod: context.request.method,
        appHandoff: appHandoffFromEnv(context.env),
      });
  }

  if (artifact) {
    if (artifact === "story" && !isQuestStorySharingEnabled(context.env)) {
      return imageNotFound(context.request.method);
    }
    return questArtifactResponse({
      context,
      shareCode,
      revision,
      artifact,
    });
  }

  const body = { action: "metadata", shareCode };
  if (revision) body.revision = Number(revision);
  const { status, response } = await callQuestShareWeb(context.env, body);
  if (status === 404) {
    return questUnavailablePage({
      requestMethod: context.request.method,
      appHandoff: appHandoffFromEnv(context.env),
    });
  }
  if (status !== 200 || !response) return legacyQuestPage(context);

  let rawPresentation;
  try {
    rawPresentation = await response.json();
  } catch {
    return questUnavailablePage({
      requestMethod: context.request.method,
      appHandoff: appHandoffFromEnv(context.env),
    });
  }

  const presentation = normalizeQuestSharePresentation(rawPresentation, {
    supabaseUrl: context.env.QUEST_SHARE_SUPABASE_URL,
  });
  if (
    !presentation ||
    (revision !== null && presentation.revision !== Number(revision))
  ) {
    return questUnavailablePage({
      requestMethod: context.request.method,
      appHandoff: appHandoffFromEnv(context.env),
    });
  }

  return questSharePage({
    origin: url.origin,
    shareCode,
    presentation,
    turnstileSiteKey: safeTurnstileSiteKey(context.env.TURNSTILE_SITE_KEY),
    appHandoff: appHandoffFromEnv(context.env),
    requestMethod: context.request.method,
  });
}
