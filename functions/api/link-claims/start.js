// POST /api/link-claims/start
//
// Handles phone claim submissions for web-to-app quest handoff.
//
// Required env bindings:
//   TURNSTILE_SECRET_KEY  - Cloudflare Turnstile server secret
//   SUPABASE_URL          - Supabase project URL
//   cloudflare_key            - Supabase server secret key (never expose to client)
//   RATE_LIMIT            - Cloudflare KV namespace binding (required for production)
//
// Backend dependency:
//   Supabase RPC `start_link_claim(p_share_code, p_phone, p_phone_last4)` must exist.
//   Expected return: { claim_id, masked_phone, status, expires_at }
//   Or error:        { error: "quest_not_found" | "quest_unavailable" | "already_claimed" }

const SHARE_CODE_RE = /^[A-HJ-NP-Za-hj-kmnp-z2-9]{8}$/;
const E164_RE = /^\+\d{10,15}$/;
const DEFAULT_TURNSTILE_HOSTS = [
  "invite.thequestsapp.com",
  "thequestsapp.com",
  "www.thequestsapp.com",
];

const RATE_LIMITS = {
  ip: { limit: 5, ttl: 3600, prefix: "ip" },
  phone: { limit: 3, ttl: 86400, prefix: "phone" },
  codeIp: { limit: 20, ttl: 86400, prefix: "code" },
};

// --- Helpers ---

function jsonResponse(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
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

function getTurnstileAllowedHosts(env) {
  const raw = env && env.TURNSTILE_ALLOWED_HOSTS;
  if (!raw) return DEFAULT_TURNSTILE_HOSTS;
  return raw
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function getTurnstileSecret(env) {
  return (
    (env && env.TURNSTILE_SECRET_KEY) ||
    (env && env.TURNSTILE_SECRET) ||
    (env && env.CF_TURNSTILE_SECRET_KEY)
  );
}

function getSupabaseKey(env) {
  return (env && env.cloudflare_key) || (env && env.CLOUDFLARE_KEY);
}

async function hashForRateLimit(value) {
  const bytes = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getIpBlock(ip) {
  if (!ip) return "unknown";
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":");
  }
  return ip.split(".").slice(0, 3).join(".");
}

async function checkAndIncrementRate(kv, key, limit, ttlSeconds) {
  const raw = await kv.get(key);
  const now = Math.floor(Date.now() / 1000);

  if (raw) {
    const data = JSON.parse(raw);
    if (data.count >= limit) {
      const elapsed = now - data.firstSeen;
      const retryAfter = Math.max(ttlSeconds - elapsed, 1);
      return { limited: true, retryAfter };
    }
    data.count += 1;
    const remaining = ttlSeconds - (now - data.firstSeen);
    await kv.put(key, JSON.stringify(data), {
      expirationTtl: Math.max(remaining, 1),
    });
    return { limited: false };
  }

  await kv.put(key, JSON.stringify({ count: 1, firstSeen: now }), {
    expirationTtl: ttlSeconds,
  });
  return { limited: false };
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

    const supabaseUrl = context.env.SUPABASE_URL;
    const supabaseKey = getSupabaseKey(context.env);
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase env bindings are missing");
      return jsonResponse(500, { error: "misconfigured" });
    }

    // Step 1: Parse JSON body
    let body;
    try {
      body = await context.request.json();
    } catch {
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
    if (typeof turnstileToken !== "string" || turnstileToken.length === 0) {
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

    const turnstileResp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: turnstileBody }
    );
    const turnstileResult = await turnstileResp.json();

    if (!turnstileResult.success) {
      return jsonResponse(403, { error: "turnstile_failed" });
    }

    // Validate Turnstile hostname to prevent cross-site token reuse
    const allowedHosts = getTurnstileAllowedHosts(context.env);
    if (
      turnstileResult.hostname &&
      !allowedHosts.includes(turnstileResult.hostname)
    ) {
      console.error("Turnstile hostname mismatch:", {
        hostname: turnstileResult.hostname,
        allowedHosts,
      });
      return jsonResponse(403, { error: "turnstile_failed" });
    }

    // Step 7: Rate limiting (graceful degradation if KV unavailable)
    const kv = context.env.RATE_LIMIT;
    if (kv) {
      const phoneHash = await hashForRateLimit(normalizedPhone);
      const ipBlock = getIpBlock(clientIP);

      // Check IP rate limit
      const ipKey = `${RATE_LIMITS.ip.prefix}:${clientIP}:hourly`;
      const ipCheck = await checkAndIncrementRate(
        kv,
        ipKey,
        RATE_LIMITS.ip.limit,
        RATE_LIMITS.ip.ttl
      );
      if (ipCheck.limited) {
        return jsonResponse(
          429,
          { error: "rate_limited", retryAfter: ipCheck.retryAfter },
          { "Retry-After": String(ipCheck.retryAfter) }
        );
      }

      // Check phone rate limit
      const phoneKey = `${RATE_LIMITS.phone.prefix}:${phoneHash}:daily`;
      const phoneCheck = await checkAndIncrementRate(
        kv,
        phoneKey,
        RATE_LIMITS.phone.limit,
        RATE_LIMITS.phone.ttl
      );
      if (phoneCheck.limited) {
        return jsonResponse(
          429,
          { error: "rate_limited", retryAfter: phoneCheck.retryAfter },
          { "Retry-After": String(phoneCheck.retryAfter) }
        );
      }

      // Check code + IP block rate limit
      const codeIpKey = `${RATE_LIMITS.codeIp.prefix}:${shareCode}:ip:${ipBlock}:daily`;
      const codeIpCheck = await checkAndIncrementRate(
        kv,
        codeIpKey,
        RATE_LIMITS.codeIp.limit,
        RATE_LIMITS.codeIp.ttl
      );
      if (codeIpCheck.limited) {
        return jsonResponse(
          429,
          { error: "rate_limited", retryAfter: codeIpCheck.retryAfter },
          { "Retry-After": String(codeIpCheck.retryAfter) }
        );
      }
    } else {
      console.error(
        "RATE_LIMIT KV binding not available — rejecting request"
      );
      return jsonResponse(503, { error: "service_unavailable" });
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
      console.error(
        "Supabase RPC error:",
        rpcResponse.status,
        await rpcResponse.text()
      );
      return jsonResponse(500, { error: "internal_error" });
    }

    const result = await rpcResponse.json();

    // Step 9: Map Supabase result to API response
    if (result.error) {
      if (
        result.error === "quest_not_found" ||
        result.error === "quest_unavailable"
      ) {
        return jsonResponse(404, { error: "quest_not_found" });
      }
      if (result.error === "already_claimed") {
        return jsonResponse(200, {
          claimId: result.claim_id,
          maskedPhone: result.masked_phone,
          status: "ALREADY_CLAIMED",
          expiresAt: result.expires_at,
        });
      }
      console.error("Supabase RPC returned error:", result.error);
      return jsonResponse(500, { error: "internal_error" });
    }

    return jsonResponse(200, {
      claimId: result.claim_id,
      maskedPhone: result.masked_phone,
      status: result.status || "PENDING",
      expiresAt: result.expires_at,
    });
  } catch (err) {
    console.error("Unhandled error in /api/link-claims/start:", err);
    return jsonResponse(500, { error: "internal_error" });
  }
}
