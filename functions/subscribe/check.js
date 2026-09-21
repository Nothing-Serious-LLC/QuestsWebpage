// POST /subscribe/check
//
// Browser-side gate for the checkout page. Two actions reach the backend:
//   validate_web  claims the reserved attempt immediately before the
//                 RevenueCat purchase call. The backend rereads the kill
//                 switch, entitlement and provider state in the same request.
//   finish_web    reports an explicit SDK cancellation, the only browser event
//                 that releases an attempt.
// Page entry (inspect_web) runs server side in functions/subscribe.js.
import { askBackend, sanitizeClaims } from "./policy.js";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};
const MAX_BODY = 4096;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function onRequestPost({ request, env }) {
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return reply(413, { allowed: false, reason: "invalid_request" });
    body = JSON.parse(text);
  } catch {
    return reply(400, { allowed: false, reason: "invalid_request" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply(400, { allowed: false, reason: "invalid_request" });
  }
  const { action } = body;
  if (action !== "validate_web" && action !== "finish_web") {
    return reply(400, { allowed: false, reason: "invalid_action" });
  }
  // Cancellation is the only outcome a browser may report.
  if (action === "finish_web" && body.outcome !== "cancelled") {
    return reply(400, { allowed: false, reason: "invalid_request" });
  }
  const claims = sanitizeClaims(body.claims);
  if (!claims) return reply(400, { allowed: false, reason: "invalid_request" });

  const outcome = action === "finish_web" ? "cancelled" : undefined;
  const result = await askBackend(env, claims, body.sig, action, outcome);
  if (result.allowed) return reply(200, result);
  return reply(result.reason === "checkout_unavailable" ? 503 : 409, result);
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { ...HEADERS, Allow: "POST" } });
  }
  return onRequestPost(context);
}
