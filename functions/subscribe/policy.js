// Build 15 checkout policy shared by GET /subscribe and POST /subscribe/check.
//
// Each Pages deployment is paired with exactly one backend through the
// PAYMENT_BACKEND_ENVIRONMENT binding. The backend owns signature validation,
// purchase-state checks, storefront eligibility and the payments.routing kill
// switch. This module forwards signed claims unchanged and fails closed.
const BACKENDS = {
  staging: "https://dswtlvkjthzgpsgtfvwx.supabase.co",
  production: "https://bltogjnxwvybhyfaivtw.supabase.co",
};
const WEB_ACTIONS = ["inspect_web", "validate_web", "finish_web"];
const CLAIM_KEYS = ["version", "uid", "exp", "attempt", "plan", "env", "appscheme", "storefront"];
// Backend refusals the browser may tell apart. Anything else reads as closed.
const REASONS = [
  "web_checkout_disabled",
  "storefront_ineligible",
  "already_subscribed",
  "purchase_pending",
  "attempt_unavailable",
  "invalid_checkout",
];
const BACKEND_TIMEOUT_MS = 12000;

/** The deployment's billing environment, or null when the binding is absent or unknown. */
export function deploymentEnvironment(env) {
  const value = env && env.PAYMENT_BACKEND_ENVIRONMENT;
  return Object.prototype.hasOwnProperty.call(BACKENDS, value) ? value : null;
}

/** Signed claims exactly as the app sent them. Numbers stay numbers for the signature message. */
export function checkoutClaims(params) {
  return {
    version: Number(params.get("version")),
    uid: params.get("uid"),
    exp: Number(params.get("exp")),
    attempt: params.get("attempt"),
    plan: params.get("plan"),
    env: params.get("env"),
    appscheme: params.get("appscheme"),
    storefront: params.get("storefront"),
  };
}

/** Rebuild claims from an untrusted JSON body, keeping only the signed keys. */
export function sanitizeClaims(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const claims = {};
  for (const key of CLAIM_KEYS) {
    const v = value[key];
    if (key === "version" || key === "exp") {
      if (!Number.isInteger(v)) return null;
    } else if (typeof v !== "string" || v.length > 64) {
      return null;
    }
    claims[key] = v;
  }
  return claims;
}

/**
 * Ask the paired backend about one checkout action.
 * Resolves { allowed, reason }. Every failure path, including a missing
 * binding, an environment mismatch, a timeout and a network error, is closed.
 */
export async function askBackend(env, claims, sig, action, outcome) {
  const closed = (reason) => ({ allowed: false, reason });
  const backendEnv = deploymentEnvironment(env);
  if (!backendEnv) return closed("deployment_unbound");
  if (!WEB_ACTIONS.includes(action)) return closed("invalid_action");
  if (!claims || claims.env !== backendEnv) return closed("environment_mismatch");
  if (claims.version !== 2) return closed("unsupported_version");
  if (typeof sig !== "string" || !/^[0-9a-f]{64}$/.test(sig)) return closed("invalid_checkout");
  try {
    const body = { action, claims, sig };
    if (outcome !== undefined) body.outcome = outcome;
    const response = await fetch(`${BACKENDS[backendEnv]}/functions/v1/sign-upgrade-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    if (response.ok) return { allowed: true, reason: null };
    let reason = "checkout_unavailable";
    try {
      const data = await response.json();
      if (data && REASONS.includes(data.error)) reason = data.error;
    } catch { /* opaque refusal */ }
    return closed(reason);
  } catch {
    return closed("checkout_unavailable");
  }
}

export async function checkCheckout(env, claims, sig, action, outcome) {
  return (await askBackend(env, claims, sig, action, outcome)).allowed;
}
