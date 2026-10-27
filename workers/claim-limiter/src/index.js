// quests-claim-limiter: exact fixed-window counters for the website claim
// endpoint, one Durable Object per dimension key (an IP, a phone hash, a share
// code plus network block). Bound into the quests-invite Pages project as
// CLAIM_LIMITER; functions/api/link-claims/claimRateLimiter.js is the caller.
//
// Request:  POST /hit  { limit, windowSeconds, now? }
// Response: { count, limited, retryAfter, windowStart }
//
// A Pages project cannot define a Durable Object itself, so this class lives
// in its own Worker (see wrangler.jsonc beside this file).

const STATE_KEY = "window";

export class ClaimLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    const limit = Number(body && body.limit);
    const windowSeconds = Number(body && body.windowSeconds);
    if (!Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowSeconds) || windowSeconds < 1) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const nowMs = Number.isFinite(Number(body.now)) ? Number(body.now) : Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);
    const windowStart = nowSeconds - (nowSeconds % windowSeconds);
    const windowEnd = windowStart + windowSeconds;

    const stored = await this.state.storage.get(STATE_KEY);
    const count =
      stored && stored.windowStart === windowStart && Number.isFinite(stored.count)
        ? stored.count + 1
        : 1;

    await this.state.storage.put(STATE_KEY, { windowStart, count });
    if (count === 1) {
      // Clear this object's storage once the window is over so idle keys
      // (one per IP, phone and code block ever seen) cost nothing to keep.
      await this.state.storage.setAlarm((windowEnd + 60) * 1000);
    }

    return Response.json({
      count,
      limited: count > limit,
      retryAfter: Math.max(windowEnd - nowSeconds, 1),
      windowStart,
    });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}

export default {
  async fetch() {
    return new Response("quests-claim-limiter", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
