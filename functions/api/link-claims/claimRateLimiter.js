// Rate limiting for POST /api/link-claims/start.
//
// Turnstile runs before this module and stays the primary bot control. The
// counters here bound how much a verified client can do in one window, and a
// counter failure never turns a person's claim into an error: every backend
// failure is logged and the request proceeds (fail open).
//
// Two backends, chosen from the bindings present on the Pages project:
//
//   1. CLAIM_LIMITER  Durable Object namespace exported by
//      workers/claim-limiter. One object per dimension key, exact counts,
//      no write collisions. Preferred when bound.
//   2. RATE_LIMIT     Workers KV namespace. Approximate counts: KV accepts
//      one write a second per key and a read can be up to 60 seconds stale in
//      another location, so a rush undercounts. Reads for every dimension run
//      in parallel before any write, a limited request writes nothing, and a
//      same-key write collision (KV PUT failed: 429) is logged and skipped.
//
// Pages Functions cannot take Cloudflare's Rate Limiting binding (Workers
// only), which is why the Durable Object is the exact option.

export const CLAIM_RATE_WINDOW_SECONDS = 600;

// Why these numbers (SC-30, 2026-10-27). The claim sends no SMS; the costs it
// guards are one Supabase RPC per claim and pending_link_claims row churn.
// The earlier 10 per IP and 30 per code per block locked out venues and
// carrier networks: a room on one Wi-Fi egress admitted 10 people in
// 10 minutes and a carrier NAT block admitted 30 per link.
export const CLAIM_RATE_LIMITS = Object.freeze({
  // One exact IP. Offices, campuses and venue Wi-Fi leave one egress address,
  // and 25,000 people tapping one link within minutes puts dozens of them
  // behind the same IP. 100 per 10 minutes admits a full room and still caps a
  // scripted client at 10 a minute.
  ip: Object.freeze({ limit: 100, prefix: "ip" }),
  // One phone number across every link. A person fixing a typo or claiming two
  // Quests fits inside 5; a script cycling one number does not.
  phone: Object.freeze({ limit: 5, prefix: "phone" }),
  // One share code from one network block (IPv4 /24, IPv6 /64). A carrier's
  // NAT puts a city behind a handful of blocks, so a host launching from a
  // stadium or a campaign landing on one carrier needs room for a thousand
  // claims per block in 10 minutes.
  codeBlock: Object.freeze({ limit: 1000, prefix: "code" }),
});

const KV_EXPIRATION_GRACE_SECONDS = 60;

export function getIpBlock(ip) {
  if (!ip) return "unknown";
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":");
  }
  return ip.split(".").slice(0, 3).join(".");
}

export async function hashForRateLimit(value) {
  const bytes = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function claimRateDimensions({ clientIp, phoneHash, shareCode }) {
  const ip = clientIp || "unknown";
  return [
    {
      name: "ip",
      key: `${CLAIM_RATE_LIMITS.ip.prefix}:${ip}`,
      limit: CLAIM_RATE_LIMITS.ip.limit,
    },
    {
      name: "phone",
      key: `${CLAIM_RATE_LIMITS.phone.prefix}:${phoneHash}`,
      limit: CLAIM_RATE_LIMITS.phone.limit,
    },
    {
      name: "codeBlock",
      key: `${CLAIM_RATE_LIMITS.codeBlock.prefix}:${shareCode}:block:${getIpBlock(ip)}`,
      limit: CLAIM_RATE_LIMITS.codeBlock.limit,
    },
  ];
}

export function windowFor(nowMs, windowSeconds = CLAIM_RATE_WINDOW_SECONDS) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const start = nowSeconds - (nowSeconds % windowSeconds);
  const end = start + windowSeconds;
  return { start, end, retryAfter: Math.max(end - nowSeconds, 1) };
}

function reasonOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function runInBackground(promise, waitUntil) {
  if (typeof waitUntil === "function") {
    waitUntil(promise);
    return Promise.resolve();
  }
  return promise;
}

export function selectClaimLimiter(env) {
  const durable = env && env.CLAIM_LIMITER;
  if (durable && typeof durable.idFromName === "function" && typeof durable.get === "function") {
    return {
      backend: "durable-object",
      check: (dimensions, options) => checkWithDurableObject(durable, dimensions, options),
    };
  }
  const kv = env && env.RATE_LIMIT;
  if (kv && typeof kv.get === "function" && typeof kv.put === "function") {
    return {
      backend: "kv",
      check: (dimensions, options) => checkWithKv(kv, dimensions, options),
    };
  }
  return null;
}

// KV: read every dimension in parallel, decide, then write only when allowed.
export async function checkWithKv(kv, dimensions, { now = Date.now(), waitUntil } = {}) {
  const window = windowFor(now);
  const degraded = [];

  const entries = await Promise.all(
    dimensions.map(async (dimension) => {
      const key = `${dimension.key}:${window.start}`;
      let count = 0;
      try {
        const raw = await kv.get(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Number.isFinite(parsed.count) && parsed.count > 0) count = parsed.count;
        }
      } catch (error) {
        degraded.push(dimension.name);
        console.warn("claim limiter KV read failed, allowing request", {
          dimension: dimension.name,
          reason: reasonOf(error),
        });
      }
      return { dimension, key, count };
    }),
  );

  const over = entries.find(({ dimension, count }) => count >= dimension.limit);
  if (over) {
    return {
      limited: true,
      dimension: over.dimension.name,
      retryAfter: window.retryAfter,
      degraded,
    };
  }

  const writes = Promise.all(
    entries.map(({ dimension, key, count }) =>
      Promise.resolve()
        .then(() =>
          kv.put(key, JSON.stringify({ count: count + 1 }), {
            expirationTtl: CLAIM_RATE_WINDOW_SECONDS + KV_EXPIRATION_GRACE_SECONDS,
          }),
        )
        .catch((error) => {
          console.warn("claim limiter KV write skipped", {
            dimension: dimension.name,
            reason: reasonOf(error),
          });
        }),
    ),
  );
  await runInBackground(writes, waitUntil);

  return { limited: false, degraded };
}

// Durable Object: one atomic increment per dimension, in parallel.
export async function checkWithDurableObject(
  namespace,
  dimensions,
  { now = Date.now() } = {},
) {
  const degraded = [];
  const results = await Promise.all(
    dimensions.map(async (dimension) => {
      try {
        const stub = namespace.get(namespace.idFromName(dimension.key));
        const response = await stub.fetch("https://claim-limiter/hit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: dimension.limit,
            windowSeconds: CLAIM_RATE_WINDOW_SECONDS,
            now,
          }),
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = await response.json();
        return {
          dimension,
          limited: body.limited === true,
          retryAfter: Number.isFinite(Number(body.retryAfter))
            ? Math.max(Number(body.retryAfter), 1)
            : windowFor(now).retryAfter,
        };
      } catch (error) {
        degraded.push(dimension.name);
        console.warn("claim limiter Durable Object unavailable, allowing request", {
          dimension: dimension.name,
          reason: reasonOf(error),
        });
        return { dimension, limited: false };
      }
    }),
  );

  const over = results.find((result) => result.limited);
  if (over) {
    return {
      limited: true,
      dimension: over.dimension.name,
      retryAfter: over.retryAfter,
      degraded,
    };
  }
  return { limited: false, degraded };
}
