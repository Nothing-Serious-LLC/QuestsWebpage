#!/usr/bin/env node
// Load test for POST /api/link-claims/start from one IP.
//
//   node scripts/claim-load-test.mjs --url http://127.0.0.1:8788/api/link-claims/start \
//     --total 120 --concurrency 1 --ip 203.0.113.42 --code AbCd2345
//
// Every request uses a distinct phone number so only the per-IP and per-code
// limits can engage. Needs the Turnstile test secret on the server
// (1x0000000000000000000000000000000AA) because the token sent is the dummy
// token. Prints a JSON summary: status histogram, latency percentiles, the
// first 429 position and its Retry-After.

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
}

const url = option("url", "http://127.0.0.1:8788/api/link-claims/start");
const total = Number(option("total", 120));
const concurrency = Number(option("concurrency", 1));
const ip = option("ip", "203.0.113.42");
const code = option("code", "AbCd2345");
const phonePrefix = option("phone-prefix", "+1202555");

const statuses = {};
const latencies = [];
let firstLimited = null;
let transportErrors = 0;

async function one(index) {
  const phone = `${phonePrefix}${String(index).padStart(4, "0")}`;
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
        Origin: "https://invite.thequestsapp.com",
      },
      body: JSON.stringify({
        shareCode: code,
        phone,
        turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
      }),
    });
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    statuses[response.status] = (statuses[response.status] || 0) + 1;
    const body = await response.text();
    if (response.status === 429 && firstLimited === null) {
      firstLimited = {
        index,
        retryAfter: response.headers.get("Retry-After"),
        body,
      };
    }
    if (response.status >= 500) {
      console.error(`request ${index}: ${response.status} ${body}`);
    }
  } catch (error) {
    transportErrors += 1;
    console.error(`request ${index}: transport error ${error.message}`);
  }
}

let next = 0;
async function worker() {
  while (next < total) {
    const index = next;
    next += 1;
    await one(index);
  }
}

const startedAll = performance.now();
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
const wall = performance.now() - startedAll;

latencies.sort((a, b) => a - b);
const pct = (p) => latencies.length ? Math.round(latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]) : null;

console.log(JSON.stringify({
  url,
  total,
  concurrency,
  ip,
  code,
  statuses,
  transportErrors,
  firstLimited,
  latencyMs: { p50: pct(0.5), p95: pct(0.95), max: pct(1) },
  wallMs: Math.round(wall),
}, null, 2));
