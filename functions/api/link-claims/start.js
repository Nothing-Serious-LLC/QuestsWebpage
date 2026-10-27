// POST /api/link-claims/start
//
// Handles phone claim submissions for web-to-app quest handoff.
//
// Required env bindings:
//   TURNSTILE_SECRET_KEY  - Cloudflare Turnstile server secret
//   SUPABASE_URL          - Supabase project URL
//   cloudflare_key        - Supabase server secret key (never expose to client)
//   RATE_LIMIT            - Workers KV namespace for the claim limiter
//                           (approximate counters; required unless CLAIM_LIMITER is bound)
// Optional env bindings:
//   CLAIM_LIMITER         - Durable Object namespace from workers/claim-limiter
//                           (exact counters; preferred when present)
//   TURNSTILE_ALLOWED_HOSTS - comma separated hostnames Turnstile may report
//
// Backend dependency:
//   Supabase RPC `start_link_claim(p_share_code, p_phone, p_phone_last4)` must exist.
//   Expected return: { claim_id, masked_phone, status, expires_at }
//   Or error:        { error: "quest_not_found" | "quest_not_joinable" | "already_claimed" }

import {
  claimRateDimensions,
  hashForRateLimit,
  selectClaimLimiter,
} from "./claimRateLimiter.js";

const SHARE_CODE_RE = /^[A-HJ-NP-Za-hj-kmnp-z2-9]{8}$/;
const E164_RE = /^\+\d{10,15}$/;
const MAX_REQUEST_BODY_BYTES = 8 * 1024;
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;
const TURNSTILE_TIMEOUT_MS = 5000;
const DEFAULT_TURNSTILE_HOSTS = [
  "invite.thequestsapp.com",
  "thequestsapp.com",
  "www.thequestsapp.com",
];

// Response marker so a deploy can be confirmed from a curl. v3 = claim limiter
// rewrite (fail open, 100 per IP, 1,000 per code per block, 2026-10-27).
const RESPONSE_VERSION = "rl-600-v3";

// --- Helpers ---

function jsonResponse(status, body, extraHeaders) {
  return new Response(JSON.stringify({ _v: RESPONSE_VERSION, ...body }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// Names the limiter backend on every response that passed the limiter, so a
// deploy can be checked from a curl (kv until the Durable Object is bound).
function withLimiterHeader(response, limiter) {
  response.headers.set("X-Claim-Limiter", limiter.backend);
  return response;
}

function normalizePhone(raw) {
  if (typeof raw !== "string") return null;

  // Strip everything except digits and a leading +
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 0) return null;

  let normalized;
  if (hasPlus) {
    normalized = "+" + digits;
  } else if (digits.length === 10) {
    // 10-digit US number without country code
    normalized = "+1" + digits;
  } else {
    normalized = "+" + digits;
  }

  if (!E164_RE.test(normalized)) return null;
  return normalized;
}

function getPhoneLast4(normalized) {
  return normalized.slice(-4);
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BODY_BYTES
  ) {
    throw new Error("request_too_large");
  }

  if (!request.body) throw new Error("invalid_json");
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function getTurnstileAllowedHosts(env) {
  const raw = env && env.TURNSTILE_ALLOWED_HOSTS;
  if (!raw) return DEFAULT_TURNSTILE_HOSTS;
  return raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function getEnvValue(env, keys) {
  if (!env) return undefined;
  for (const key of keys) {
    if (env[key]) return env[key];
  }
  const envKeys = Object.keys(env);
  for (const key of keys) {
    for (const envKey of envKeys) {
      if (envKey.trim() === key) {
        console.warn(
          `Env binding name has whitespace: "${envKey}" (expected "${key}")`
        );
        return env[envKey];
      }
    }
  }
  return undefined;
}

function getTurnstileSecret(env) {
  return getEnvValue(env, [
    "TURNSTILE_SECRET_KEY",
    "CF_TURNSTILE_SECRET_KEY",
    "TURNSTILE_SECRET",
  ]);
}

function getSupabaseKey(env) {
  return getEnvValue(env, ["cloudflare_key", "CLOUDFLARE_KEY"]);
}

// --- Handler ---

export async function onRequestPost(context) {
  try {
    const turnstileSecret = getTurnstileSecret(context.env);
    if (!turnstileSecret) {
      console.error(
        "Turnstile secret is missing (TURNSTILE_SECRET_KEY | TURNSTILE_SECRET | CF_TURNSTILE_SECRET_KEY)"
      );
      return jsonResponse(500, { error: "misconfigured" });
    }

    const supabaseUrl = getEnvValue(context.env, ["SUPABASE_URL"]);
    const supabaseKey = getSupabaseKey(context.env);
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase env bindings are missing");
      return jsonResponse(500, { error: "misconfigured" });
    }

    // Step 1: Parse JSON body
    let body;
    try {
      body = await readJsonBody(context.request);
    } catch (error) {
      if (error instanceof Error && error.message === "request_too_large") {
        return jsonResponse(413, { error: "invalid_request" });
      }
      return jsonResponse(400, { error: "invalid_json" });
    }

    const { shareCode, phone, turnstileToken } = body;

    // Step 2: Validate required fields
    if (!shareCode || !phone || !turnstileToken) {
      return jsonResponse(400, { error: "missing_fields" });
    }

    // Step 3: Validate shareCode format
    if (typeof shareCode !== "string" || !SHARE_CODE_RE.test(shareCode)) {
      return jsonResponse(400, { error: "invalid_share_code" });
    }

    // Step 4: Normalize and validate phone
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return jsonResponse(400, { error: "invalid_phone" });
    }
    const phoneLast4 = getPhoneLast4(normalizedPhone);

    // Step 5: Validate turnstileToken is a non-empty string
    if (
      typeof turnstileToken !== "string" ||
      turnstileToken.length === 0 ||
      turnstileToken.length > MAX_TURNSTILE_TOKEN_LENGTH
    ) {
      return jsonResponse(400, { error: "missing_fields" });
    }

    // Step 6: Verify Turnstile token
    const clientIP = context.request.headers.get("CF-Connecting-IP");

    const turnstileBody = new URLSearchParams();
    turnstileBody.append("secret", turnstileSecret);
    turnstileBody.append("response", turnstileToken);
    if (clientIP) {
      turnstileBody.append("remoteip", clientIP);
    }

    const turnstileController = new AbortController();
    const turnstileTimeout = setTimeout(
      () => turnstileController.abort(),
      TURNSTILE_TIMEOUT_MS
    );
    let turnstileResp;
    let turnstileResult;
    try {
      turnstileResp = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: turnstileBody,
          signal: turnstileController.signal,
        }
      );
      if (!turnstileResp.ok) {
        console.error("Turnstile verification upstream failed:", turnstileResp.status);
        return jsonResponse(503, { error: "service_unavailable" });
      }
      turnstileResult = await turnstileResp.json();
    } catch (error) {
      console.error("Turnstile verification request failed:", error);
      return jsonResponse(503, { error: "service_unavailable" });
    } finally {
      clearTimeout(turnstileTimeout);
    }

    if (!turnstileResult.success) {
      return jsonResponse(403, { error: "turnstile_failed" });
    }

    // Validate Turnstile hostname to prevent cross-site token reuse
    const allowedHosts = getTurnstileAllowedHosts(context.env);
    const verifiedHostname = typeof turnstileResult.hostname === "string"
      ? turnstileResult.hostname.trim().toLowerCase()
      : "";
    if (!verifiedHostname || !allowedHosts.includes(verifiedHostname)) {
      console.error("Turnstile hostname mismatch:", {
        hostname: verifiedHostname || "missing",
        allowedHosts,
      });
      return jsonResponse(403, { error: "turnstile_failed" });
    }

    // Step 7: Rate limiting. Turnstile has passed; the counters bound what a
    // verified client can do in a window. A missing binding is a deploy
    // misconfiguration and stays a 503. A counter that fails at runtime never
    // blocks the person (claimRateLimiter.js logs and allows the request).
    const limiter = selectClaimLimiter(context.env);
    if (!limiter) {
      console.error(
        "No claim limiter binding (CLAIM_LIMITER Durable Object or RATE_LIMIT KV), rejecting request"
      );
      return jsonResponse(503, { error: "service_unavailable" });
    }

    const phoneHash = await hashForRateLimit(normalizedPhone);
    const verdict = await limiter.check(
      claimRateDimensions({ clientIp: clientIP, phoneHash, shareCode }),
      {
        waitUntil: typeof context.waitUntil === "function"
          ? (promise) => context.waitUntil(promise)
          : undefined,
      }
    );
    if (verdict.limited) {
      return withLimiterHeader(
        jsonResponse(
          429,
          { error: "rate_limited", retryAfter: verdict.retryAfter },
          { "Retry-After": String(verdict.retryAfter) }
        ),
        limiter
      );
    }

    // Step 8: Call Supabase RPC start_link_claim
    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/start_link_claim`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          p_share_code: shareCode,
          p_phone: normalizedPhone,
          p_phone_last4: phoneLast4,
        }),
      }
    );

    if (!rpcResponse.ok) {
      const rpcText = await rpcResponse.text();
      console.error(
        "Supabase RPC error:",
        rpcResponse.status,
        rpcText
      );
      return withLimiterHeader(jsonResponse(500, { error: "internal_error" }), limiter);
    }

    const result = await rpcResponse.json();

    // Step 9: Map Supabase result to API response
    if (result.error) {
      if (result.error === "quest_not_found") {
        return withLimiterHeader(jsonResponse(404, { error: "quest_not_found" }), limiter);
      }
      if (
        result.error === "quest_unavailable" ||
        result.error === "quest_not_joinable"
      ) {
        return withLimiterHeader(jsonResponse(409, { error: "quest_unavailable" }), limiter);
      }
      if (result.error === "already_claimed") {
        return withLimiterHeader(jsonResponse(200, {
          claimId: result.claim_id,
          maskedPhone: result.masked_phone,
          status: "ALREADY_CLAIMED",
          expiresAt: result.expires_at,
        }), limiter);
      }
      console.error("Supabase RPC returned error:", result.error);
      return withLimiterHeader(jsonResponse(500, { error: "internal_error" }), limiter);
    }

    return withLimiterHeader(jsonResponse(200, {
      claimId: result.claim_id,
      maskedPhone: result.masked_phone,
      status: result.status || "PENDING",
      expiresAt: result.expires_at,
    }), limiter);
  } catch (err) {
    console.error("Unhandled error in /api/link-claims/start:", err);
    return jsonResponse(500, { error: "internal_error" });
  }
}
