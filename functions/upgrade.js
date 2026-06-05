// GET /upgrade  — WEB REPO (QuestsWebpage, Cloudflare Pages Function)
//
// Quests Pro web checkout entry point (Path A = RevenueCat Web Billing, the
// user is Merchant of Record, Stripe is the processor).
//
// The Quests app deep-links here with the signed-in user's Supabase id:
//   https://thequestsapp.com/upgrade?uid=<SUPABASE_USER_ID>&exp=<exp>&sig=<sig>&package_id=<pkg>&env=staging
//
// We assemble the RevenueCat Web Purchase Link SERVER-SIDE and 302-redirect to it.
// The link base depends on ?env:
//   prod    : https://pay.rev.cat/<RC_WEB_LINK_TOKEN>/<uid>?package_id=<pkg>&skip_purchase_success=true
//   staging : https://pay.rev.cat/sandbox/<RC_WEB_LINK_TOKEN_STAGING>/<uid>?package_id=<pkg>&skip_purchase_success=true
// NOTE the LITERAL '/sandbox/' path segment in the staging base — it is part of
// the URL path, not a token, so we do NOT encode it. Only <uid> is percent-encoded.
//
// app_user_id on EVERY platform (StoreKit / Play / Web) === Supabase auth.users.id,
// so passing <uid> straight through keeps the entitlement attached to the same
// account the RevenueCat webhook (PR2) writes to subscription_entitlements.
//
// Required env bindings (Cloudflare Pages -> Settings -> Environment variables):
//   RC_WEB_LINK_TOKEN          - RevenueCat Web Purchase Link token (PRODUCTION). NEVER commit.
//   RC_WEB_LINK_TOKEN_STAGING  - (optional) staging token, used when ?env=staging is present.
//   RC_UPGRADE_SIGNING_SECRET  - REQUIRED while REQUIRE_SIGNED_UPGRADE is true (the default).
//                                Shared HMAC secret used to verify signed upgrade links. NEVER
//                                commit. This is the SAME secret the Supabase 'sign-upgrade-link'
//                                edge function (PR3-app) uses to MINT the signature — the app
//                                holds the authenticated session, mints the sig server-side via
//                                that function, and this Function verifies it. With the flag on,
//                                an unset secret means NO link can verify and every request falls
//                                back to the styled page (fail-closed). NEVER ships in the RN bundle.
//
// If uid is missing/malformed OR the token env var is unset, we serve a styled
// fallback page instead of redirecting to a broken pay link.
//
// ---------------------------------------------------------------------------
// uid TRUST / GRIEFING RISK (read before broad distribution)
// ---------------------------------------------------------------------------
// The plain `?uid=` path is UNAUTHENTICATED: the uid is an attacker-controllable
// query param and a UUID-format check is a sanity guard, NOT authentication.
// Supabase user UUIDs are not secret (they can surface via shared content, etc.),
// so a crafted link /upgrade?uid=<VICTIM_UUID> would start a real checkout that
// attributes the resulting entitlement to an arbitrary account. The blast radius
// is a griefing/refund vector (the buyer pays, the victim gets Pro) — NOT account
// takeover, and app_user_id mapping stays server-authoritative via the webhook.
//
// MITIGATION (NOW THE DEFAULT — REQUIRE_SIGNED_UPGRADE defaults to true):
//   The app mints a short-lived SIGNED upgrade link:
//     https://thequestsapp.com/upgrade?uid=<uid>&exp=<unix_seconds>&sig=<hex_hmac>
//   where sig = HMAC-SHA256(`${uid}.${exp}`, RC_UPGRADE_SIGNING_SECRET).
//   The app CANNOT hold the HMAC secret (it would ship in the RN bundle), so the
//   signature is produced SERVER-SIDE by the Supabase 'sign-upgrade-link' edge
//   function (verify_jwt=true): the app calls it with its authenticated session,
//   the function derives uid from the JWT, computes the sig with the server-only
//   RC_UPGRADE_SIGNING_SECRET, and returns {uid,exp,sig}. Only a signed-in user
//   can obtain a sig for THEIR OWN uid, so signed links cannot be forged for an
//   arbitrary uid. This file verifies sig (constant-time) using the same
//   constant-time-compare discipline as the PR1/PR2 webhook. With the flag on
//   (default), the plain ?uid= path is rejected to the fallback; set the flag
//   false only to temporarily restore the legacy verified-if-present behavior.
//
//   IMPORTANT: web steering is a SEPARATE gate. Even with signed links live, the
//   app keeps IS_WEB_STEERING_ENABLED_* false (no "Manage on the web" row) until:
//   signed links live (this Function + the secret + the signing edge function)
//   AND consumer-law/tax compliance gate passed AND per storefront/region gating
//   wired. Signing is necessary but NOT sufficient to turn steering on.

// Canonical UUID contract — MUST match the RevenueCat webhook (PR1 index.ts) and
// the app (UpgradeProLink.tsx). Loose v4 form (version/variant nibbles are full
// [0-9a-f]); Supabase auth ids are v4 UUIDs so this is the shared, repo-wide regex.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowlist of RevenueCat package ids accepted on the web checkout link. ANY
// other value (or a missing param) falls back to the styled page rather than
// redirecting to a pay link with an unknown/forged package selector.
//   monthly = pkge6c33690320
//   annual  = pkged77e4fad21
const ALLOWED_PACKAGE_IDS = new Set(["pkge6c33690320", "pkged77e4fad21"]);

// REQUIRE_SIGNED_UPGRADE: when true (the default), a valid signed link is
// MANDATORY — the plain ?uid= path is rejected to the fallback and a fresh
// &exp=/&sig= pair that verifies against RC_UPGRADE_SIGNING_SECRET is required.
// When false, the legacy verified-if-present behavior applies (plain links pass,
// a present &sig= is still verified). Default true because the app side now
// fetches signed links from the 'sign-upgrade-link' edge function (PR3-app), so
// every real upgrade tap arrives signed; only forged/replayed plain links are
// rejected. Prereqs to keep this true in production: RC_UPGRADE_SIGNING_SECRET
// set in Cloudflare env AND the matching app build (which always signs) shipped.
//
// NOTE: web steering itself stays OFF (the app's IS_WEB_STEERING_ENABLED_* flags
// default false) until ALL of: signed links live (this flag + the secret + the
// signing edge function) + consumer-law/tax compliance gate passed + per
// storefront/region gating wired. This flag governs HOW a link is trusted, not
// WHETHER the steering row is shown.
const REQUIRE_SIGNED_UPGRADE = true;

// Max age (seconds) for a signed link's `exp` to be considered fresh, as a guard
// against a leaked-but-old signed link being replayed. Generous to tolerate clock
// skew and a user sitting on the steering screen before tapping.
const SIGNED_LINK_MAX_AGE_S = 60 * 60; // 1 hour

const APP_STORE_URL =
  "https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=info.nothingserious.quests";

// Content-Security-Policy applied to the FUNCTION's OWN responses (the fallback
// HTML + the 302 redirect + the 405). This is the "suspenders": the static-asset
// `_headers` file (see _headers.snippet.md) is the "belt" that covers the same
// path, but a Pages Function response is generated by code, so we set the same
// hardening headers HERE too so they are present even on responses `_headers`
// might not decorate identically. We do a full 302 redirect to pay.rev.cat (NOT
// an iframe), so no frame-src/frame-ancestors allowance for pay.rev.cat is
// needed; the page forbids framing entirely. This CSP matches the `/upgrade`
// block in _headers.snippet.md exactly.
const UPGRADE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' data:; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'";

// Centralized security headers set on EVERY Function response (fallback HTML,
// the 302 redirect, and the 405). Mirrors the static `_headers` belt so the
// hardening is present whether a response comes from a static asset or from this
// Function. Referrer-Policy is the strict `no-referrer` here so a redirect to the
// external pay.rev.cat link never leaks the uid-bearing /upgrade URL as a Referer.
function noStoreHeaders(extra) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": UPGRADE_CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

// Constant-time comparison of two hex strings. Returns false on any length
// mismatch without early-exit timing leaks (same discipline as the webhook's
// signature check).
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bytesToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// Compute HMAC-SHA256(`${uid}.${exp}`, secret) as lowercase hex using WebCrypto
// (available in the Cloudflare Pages Functions runtime).
async function computeSig(uid, exp, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${uid}.${exp}`)
  );
  return bytesToHex(mac);
}

// Returns true if the signed-link params (uid/exp/sig) verify against the secret
// AND are within the freshness window. Any missing input or malformed exp -> false.
async function verifySignedLink(uid, exp, sig, secret) {
  if (!secret || !exp || !sig) return false;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false; // 32-byte HMAC-SHA256, hex
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || !Number.isInteger(expNum)) return false;
  const nowS = Math.floor(Date.now() / 1000);
  // Reject expired links and links too far in the future / too old to be fresh.
  if (expNum < nowS) return false;
  if (expNum - nowS > SIGNED_LINK_MAX_AGE_S) return false;
  const expected = await computeSig(uid, exp, secret);
  return timingSafeEqualHex(expected.toLowerCase(), sig.toLowerCase());
}

function fallbackHtml() {
  // Self-contained, house-styled page. Linked stylesheet (/styles.css) provides
  // the brand tokens/classes; this inline <style> only adds page-local layout.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quests Pro – Quests</title>
  <meta name="description" content="Manage your Quests Pro membership." />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="theme-color" content="#0d1f3a" />
  <link rel="icon" href="/icon.png" type="image/png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    .upgrade-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 120px 24px 80px; }
    .upgrade-container { max-width: 600px; width: 100%; margin: 0 auto; }
    .upgrade-card { background: var(--surface-strong); border: 1px solid var(--border-strong); border-radius: 28px; padding: 48px; box-shadow: var(--shadow-md); text-align: center; }
    .upgrade-title { font-size: clamp(2.25rem, 5vw, 3.25rem); font-weight: 800; color: var(--white); margin: 0 0 16px; letter-spacing: -0.02em; }
    .upgrade-subtitle { font-size: 17px; color: var(--text-muted); line-height: 1.6; margin: 0 0 32px; }
    .upgrade-actions { display: flex; flex-direction: column; gap: 16px; }
    @media (max-width: 768px) { .upgrade-card { padding: 32px 24px; } }
  </style>
</head>
<body>
  <div class="page__background"></div>
  <div class="page__wrapper">
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="/" aria-label="Quests home">
          <span class="brand__glyph" aria-hidden="true"></span>
          <span class="brand__name">Quests</span>
        </a>
        <a class="download-chip" href="/#cta">Download the app</a>
      </div>
    </header>

    <main class="upgrade-page">
      <div class="upgrade-container">
        <div class="upgrade-card">
          <h1 class="upgrade-title">Quests Pro</h1>
          <p class="upgrade-subtitle">Open the Quests app and head to Settings to manage your Quests Pro membership. If you arrived here from the app, please reopen it and try again.</p>
          <div class="upgrade-actions">
            <a href="${APP_STORE_URL}" class="button button--primary" style="width: 100%;">
              <i class="mdi mdi-apple button__icon" aria-hidden="true"></i>
              <span>Get Quests on the App Store</span>
            </a>
            <a href="${PLAY_STORE_URL}" class="button button--ghost" style="width: 100%;">
              <i class="mdi mdi-google-play button__icon" aria-hidden="true"></i>
              <span>Get Quests on Google Play</span>
            </a>
          </div>
        </div>
      </div>
    </main>

    <footer class="site-footer">
      <div class="site-footer__content">
        <div class="site-footer__links">
          <a href="/contact.html">Contact</a>
          <a href="/blog.html">Blog</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
        </div>
        <p class="site-footer__meta">© 2025 Nothing Serious LLC</p>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

function fallbackResponse() {
  return new Response(fallbackHtml(), {
    status: 200,
    headers: noStoreHeaders({ "Content-Type": "text/html; charset=utf-8" }),
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const uid = (url.searchParams.get("uid") || "").trim().toLowerCase();
  const exp = (url.searchParams.get("exp") || "").trim();
  const sig = (url.searchParams.get("sig") || "").trim();
  const packageId = (url.searchParams.get("package_id") || "").trim();
  const isStaging = url.searchParams.get("env") === "staging";

  const token = isStaging
    ? context.env.RC_WEB_LINK_TOKEN_STAGING || context.env.RC_WEB_LINK_TOKEN
    : context.env.RC_WEB_LINK_TOKEN;

  const signingSecret = context.env.RC_UPGRADE_SIGNING_SECRET;

  // Base sanity: a real token must be configured and uid must be a well-formed UUID.
  if (!token || !UUID_RE.test(uid)) {
    return fallbackResponse();
  }

  // package_id allowlist. A missing or unknown package id falls back to the
  // styled page rather than redirecting to pay.rev.cat with a bad selector.
  if (!ALLOWED_PACKAGE_IDS.has(packageId)) {
    return fallbackResponse();
  }

  // uid-trust gate. v1 (REQUIRE_SIGNED_UPGRADE=false): accept the plain ?uid= link;
  // if a &sig= is present we still verify it (verified-if-present) so a malformed
  // signature never silently passes. Hardened mode (true): a valid signed link is
  // mandatory.
  const hasSignature = sig.length > 0;
  if (REQUIRE_SIGNED_UPGRADE || hasSignature) {
    const signedOk = await verifySignedLink(uid, exp, sig, signingSecret);
    if (!signedOk) {
      return fallbackResponse();
    }
  }

  // Build the RevenueCat Web Purchase Link base by environment. The staging base
  // carries a LITERAL '/sandbox/' path segment (NOT a token, NOT encoded). Only
  // the uid is percent-encoded; the token is interpolated as a raw path segment
  // exactly as the env var supplies it.
  const base = isStaging
    ? `https://pay.rev.cat/sandbox/${token}/`
    : `https://pay.rev.cat/${token}/`;
  const target =
    base +
    encodeURIComponent(uid) +
    `?package_id=${encodeURIComponent(packageId)}&skip_purchase_success=true`;

  return new Response(null, {
    status: 302,
    headers: noStoreHeaders({ Location: target }),
  });
}

// Reject non-GET methods cleanly; route everything else through onRequestGet.
export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: noStoreHeaders({ Allow: "GET, HEAD" }),
    });
  }
  return onRequestGet(context);
}
