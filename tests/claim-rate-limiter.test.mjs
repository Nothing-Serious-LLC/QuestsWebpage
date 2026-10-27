import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAIM_RATE_LIMITS,
  CLAIM_RATE_WINDOW_SECONDS,
  checkWithDurableObject,
  checkWithKv,
  claimRateDimensions,
  getIpBlock,
  selectClaimLimiter,
  windowFor,
} from "../functions/api/link-claims/claimRateLimiter.js";
import { onRequestPost as startPhoneClaim } from "../functions/api/link-claims/start.js";

const SUPABASE_URL = "https://project.supabase.co";
const NOW = Date.parse("2026-11-01T18:00:05.000Z");

function memoryKv({ failWrite = () => false, failRead = () => false } = {}) {
  const store = new Map();
  const log = { reads: 0, writes: 0, failedWrites: 0, failedReads: 0, ttls: [] };
  return {
    store,
    log,
    async get(key) {
      log.reads += 1;
      if (failRead(key, log)) {
        log.failedReads += 1;
        throw new Error("KV GET failed: 500 Internal Server Error");
      }
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, options) {
      log.writes += 1;
      if (failWrite(key, log)) {
        log.failedWrites += 1;
        throw new Error("KV PUT failed: 429 Too Many Requests");
      }
      log.ttls.push(options && options.expirationTtl);
      store.set(key, value);
    },
  };
}

function memoryDurableObjects({ fail = () => false } = {}) {
  const counters = new Map();
  const log = { hits: 0 };
  return {
    counters,
    log,
    idFromName: (name) => name,
    get(id) {
      return {
        async fetch(_url, init) {
          log.hits += 1;
          if (fail(id)) throw new Error("Durable Object unreachable");
          const body = JSON.parse(init.body);
          const count = (counters.get(id) || 0) + 1;
          counters.set(id, count);
          const window = windowFor(body.now, body.windowSeconds);
          return Response.json({
            count,
            limited: count > body.limit,
            retryAfter: window.retryAfter,
          });
        },
      };
    },
  };
}

async function withSuppressedWarnings(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const result = await run();
    return { result, warnings };
  } finally {
    console.warn = original;
  }
}

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function dimensionsFor({ ip = "198.51.100.7", phone = "+12025550100", code = "AbCd2345" } = {}) {
  return claimRateDimensions({ clientIp: ip, phoneHash: `hash-of-${phone}`, shareCode: code });
}

test("thresholds are the approved November values with a 10 minute window", () => {
  assert.equal(CLAIM_RATE_WINDOW_SECONDS, 600);
  assert.equal(CLAIM_RATE_LIMITS.ip.limit, 100);
  assert.equal(CLAIM_RATE_LIMITS.phone.limit, 5);
  assert.equal(CLAIM_RATE_LIMITS.codeBlock.limit, 1000);
});

test("dimension keys scope one IP, one phone and one code per network block", () => {
  const [ip, phone, codeBlock] = dimensionsFor({ ip: "198.51.100.7" });
  assert.equal(ip.key, "ip:198.51.100.7");
  assert.equal(phone.key, "phone:hash-of-+12025550100");
  assert.equal(codeBlock.key, "code:AbCd2345:block:198.51.100");
  assert.equal(getIpBlock("2001:db8:85a3:8d3:1319:8a2e:370:7348"), "2001:db8:85a3:8d3");
  assert.equal(getIpBlock(null), "unknown");
  assert.equal(claimRateDimensions({ clientIp: null, phoneHash: "h", shareCode: "AbCd2345" })[0].key, "ip:unknown");
});

test("windows are fixed and Retry-After counts down to the window end", () => {
  const window = windowFor(NOW);
  assert.equal(window.start % 600, 0);
  assert.equal(window.end - window.start, 600);
  assert.equal(window.retryAfter, 595);
  assert.equal(windowFor(window.end * 1000 - 1).retryAfter, 1);
});

test("KV: one IP admits 100 claims in a window and the 101st is limited without a write", async () => {
  const kv = memoryKv();
  for (let i = 0; i < 100; i += 1) {
    const verdict = await checkWithKv(kv, dimensionsFor({ phone: `+1202555${String(i).padStart(4, "0")}` }), { now: NOW });
    assert.equal(verdict.limited, false, `claim ${i + 1} should pass`);
  }
  const writesBefore = kv.log.writes;
  const verdict = await checkWithKv(kv, dimensionsFor({ phone: "+12025559999" }), { now: NOW });
  assert.equal(verdict.limited, true);
  assert.equal(verdict.dimension, "ip");
  assert.equal(verdict.retryAfter, 595);
  assert.equal(kv.log.writes, writesBefore);
  assert.equal(kv.log.reads, 101 * 3);
  assert.ok(kv.log.ttls.every((ttl) => ttl === 660));
});

test("KV: one phone admits 5 claims and the next window starts fresh", async () => {
  const kv = memoryKv();
  for (let i = 0; i < 5; i += 1) {
    const verdict = await checkWithKv(kv, dimensionsFor({ ip: `203.0.113.${i + 1}` }), { now: NOW });
    assert.equal(verdict.limited, false);
  }
  const limited = await checkWithKv(kv, dimensionsFor({ ip: "203.0.113.50" }), { now: NOW });
  assert.equal(limited.limited, true);
  assert.equal(limited.dimension, "phone");

  const nextWindow = await checkWithKv(kv, dimensionsFor({ ip: "203.0.113.50" }), {
    now: NOW + CLAIM_RATE_WINDOW_SECONDS * 1000,
  });
  assert.equal(nextWindow.limited, false);
});

test("KV: one code from one /24 admits 1,000 claims across distinct IPs and phones", async () => {
  const kv = memoryKv();
  for (let i = 0; i < 1000; i += 1) {
    const verdict = await checkWithKv(kv, dimensionsFor({
      ip: `198.51.100.${i % 250}`,
      phone: `+1202${String(i).padStart(7, "0")}`,
    }), { now: NOW });
    assert.equal(verdict.limited, false, `claim ${i + 1} should pass`);
  }
  const verdict = await checkWithKv(kv, dimensionsFor({ ip: "198.51.100.251", phone: "+12029999999" }), { now: NOW });
  assert.equal(verdict.limited, true);
  assert.equal(verdict.dimension, "codeBlock");
});

test("KV: a same-key write collision is logged and the claim proceeds", async () => {
  const kv = memoryKv({ failWrite: (key) => key.startsWith("code:") });
  const { result, warnings } = await withSuppressedWarnings(() =>
    checkWithKv(kv, dimensionsFor(), { now: NOW }),
  );
  assert.equal(result.limited, false);
  assert.equal(kv.log.failedWrites, 1);
  assert.equal(kv.log.writes, 3);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "claim limiter KV write skipped");
  assert.equal(warnings[0][1].dimension, "codeBlock");
  assert.match(warnings[0][1].reason, /429 Too Many Requests/);
});

test("KV: a read failure is logged, counted as zero and the claim proceeds", async () => {
  const kv = memoryKv({ failRead: (key) => key.startsWith("ip:") });
  const { result, warnings } = await withSuppressedWarnings(() =>
    checkWithKv(kv, dimensionsFor(), { now: NOW }),
  );
  assert.equal(result.limited, false);
  assert.deepEqual(result.degraded, ["ip"]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "claim limiter KV read failed, allowing request");
});

test("KV: writes leave the response path through waitUntil when it is provided", async () => {
  const kv = memoryKv();
  const background = [];
  const verdict = await checkWithKv(kv, dimensionsFor(), {
    now: NOW,
    waitUntil: (promise) => background.push(promise),
  });
  assert.equal(verdict.limited, false);
  assert.equal(background.length, 1);
  await Promise.all(background);
  assert.equal(kv.store.size, 3);
  for (const value of kv.store.values()) {
    assert.deepEqual(JSON.parse(value), { count: 1 });
  }
});

test("Durable Object: counters are exact and the limiter fails open when an object is unreachable", async () => {
  const namespace = memoryDurableObjects();
  for (let i = 0; i < 5; i += 1) {
    const verdict = await checkWithDurableObject(namespace, dimensionsFor({ ip: `203.0.113.${i + 1}` }), { now: NOW });
    assert.equal(verdict.limited, false);
  }
  const limited = await checkWithDurableObject(namespace, dimensionsFor({ ip: "203.0.113.60" }), { now: NOW });
  assert.equal(limited.limited, true);
  assert.equal(limited.dimension, "phone");
  assert.equal(limited.retryAfter, 595);

  const flaky = memoryDurableObjects({ fail: (id) => id.startsWith("ip:") });
  const { result, warnings } = await withSuppressedWarnings(() =>
    checkWithDurableObject(flaky, dimensionsFor(), { now: NOW }),
  );
  assert.equal(result.limited, false);
  assert.deepEqual(result.degraded, ["ip"]);
  assert.equal(warnings[0][0], "claim limiter Durable Object unavailable, allowing request");
});

test("binding selection prefers the Durable Object, then KV, then nothing", () => {
  const durable = memoryDurableObjects();
  const kv = memoryKv();
  assert.equal(selectClaimLimiter({ CLAIM_LIMITER: durable, RATE_LIMIT: kv }).backend, "durable-object");
  assert.equal(selectClaimLimiter({ RATE_LIMIT: kv }).backend, "kv");
  assert.equal(selectClaimLimiter({}), null);
  assert.equal(selectClaimLimiter(undefined), null);
});

function claimContext({ env = {}, ip = "203.0.113.42", phone = "+12025550123", waitUntil } = {}) {
  return {
    request: new Request("https://invite.thequestsapp.com/api/link-claims/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
      },
      body: JSON.stringify({
        shareCode: "AbCd2345",
        phone,
        turnstileToken: "verified-token",
      }),
    }),
    waitUntil,
    env: {
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      SUPABASE_URL,
      cloudflare_key: "server-secret",
      ...env,
    },
  };
}

function backendFetch() {
  let call = 0;
  return async () => {
    call += 1;
    if (call % 2 === 1) {
      return Response.json({ success: true, hostname: "invite.thequestsapp.com" });
    }
    return Response.json({
      claim_id: "claim-1",
      masked_phone: "***0123",
      status: "PENDING",
      expires_at: "2026-11-04T18:00:00.000Z",
    });
  };
}

test("claim endpoint: a KV write collision still returns the claim, never a 500", async () => {
  const kv = memoryKv({ failWrite: () => true });
  const { result: response, warnings } = await withSuppressedWarnings(() =>
    withFetch(backendFetch(), () => startPhoneClaim(claimContext({ env: { RATE_LIMIT: kv } }))),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    _v: "rl-600-v3",
    claimId: "claim-1",
    maskedPhone: "***0123",
    status: "PENDING",
    expiresAt: "2026-11-04T18:00:00.000Z",
  });
  assert.equal(kv.log.failedWrites, 3);
  assert.equal(warnings.length, 3);
});

test("claim endpoint: the limited response carries Retry-After and writes nothing", async () => {
  const kv = memoryKv();
  const window = windowFor(Date.now());
  kv.store.set(`ip:203.0.113.42:${window.start}`, JSON.stringify({ count: 100 }));
  const response = await withFetch(backendFetch(), () =>
    startPhoneClaim(claimContext({ env: { RATE_LIMIT: kv } })),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const retryAfter = Number(response.headers.get("Retry-After"));
  assert.ok(retryAfter >= 1 && retryAfter <= 600);
  const body = await response.json();
  assert.equal(body.error, "rate_limited");
  assert.equal(body.retryAfter, retryAfter);
  assert.equal(kv.log.writes, 0);
});

test("claim endpoint: counter writes ride waitUntil on the Pages context", async () => {
  const kv = memoryKv();
  const background = [];
  const response = await withFetch(backendFetch(), () =>
    startPhoneClaim(claimContext({
      env: { RATE_LIMIT: kv },
      waitUntil: (promise) => background.push(promise),
    })),
  );
  assert.equal(response.status, 200);
  assert.equal(background.length, 1);
  await Promise.all(background);
  assert.equal(kv.store.size, 3);
});

test("claim endpoint: the Durable Object binding is used when present", async () => {
  const durable = memoryDurableObjects();
  const kv = memoryKv();
  const response = await withFetch(backendFetch(), () =>
    startPhoneClaim(claimContext({ env: { CLAIM_LIMITER: durable, RATE_LIMIT: kv } })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Claim-Limiter"), "durable-object");
  assert.equal(durable.log.hits, 3);
  assert.equal(kv.log.reads, 0);
  assert.equal(kv.log.writes, 0);
});

test("claim endpoint: the KV backend names itself on the response", async () => {
  const kv = memoryKv();
  const response = await withFetch(backendFetch(), () =>
    startPhoneClaim(claimContext({ env: { RATE_LIMIT: kv } })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Claim-Limiter"), "kv");
});

test("claim endpoint: a missing limiter binding is a 503, not a silent allow", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const response = await withFetch(backendFetch(), () =>
      startPhoneClaim(claimContext()),
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { _v: "rl-600-v3", error: "service_unavailable" });
  } finally {
    console.error = original;
  }
});
