// GET /subscribe  — WEB REPO (QuestsWebpage, Cloudflare Pages Function)
//
// Quests Pro DIRECT web checkout (Path A = RevenueCat Web Billing; the user is
// Merchant of Record, Stripe is the processor). This is the replacement for the
// old /upgrade redirect to a pay.rev.cat Web Purchase Link.
//
// WHY THIS EXISTS / WHAT CHANGED:
//   pay.rev.cat Web Purchase Links ALWAYS render a fixed 3-step funnel whose
//   first step is a package-selection / "Continue" intro page that CANNOT be
//   removed (RevenueCat docs: web/paywalls is a fixed package-selection ->
//   checkout -> post-purchase funnel; package_id only PRE-SELECTS, it does not
//   skip the step). The product requirement is the opposite: the user already
//   picked the plan IN THE APP, so the web must open DIRECTLY on the Stripe card
//   form with ZERO RevenueCat selection/intro page.
//
//   The only way to do that is the RevenueCat WEB SDK (@revenuecat/purchases-js)
//   purchase() method, which renders ONLY the checkout form on our own domain
//   (it mounts Stripe Elements into an HTML element we provide). There is no
//   selection step because we hand the SDK the single rcPackage the user chose.
//
//   This Function does the server-trusted half: it verifies the signed upgrade
//   link (so the uid cannot be forged — same HMAC contract as the old
//   /upgrade Function and the sign-upgrade-link edge function), then server-
//   renders a page that hands the VERIFIED uid + the publishable rcb_ key +
//   the chosen product id to a small static module (/subscribe-app.js) which
//   runs the SDK purchase() flow client-side.
//
// ENTITLEMENT PIPELINE IS UNCHANGED:
//   A Web SDK purchase fires the SAME RevenueCat webhook event
//   (INITIAL_PURCHASE, store=RC_BILLING) with app_user_id = the uid we pass to
//   Purchases.configure(). The existing revenuecat-webhook Edge Function already
//   reads event.app_user_id and writes subscription_entitlements -> Realtime ->
//   isPro. NOTHING in the webhook or DB changes. The app must NOT flip isPro on
//   the return deep link; it waits for the Realtime push (authoritative).
//
// REQUEST SHAPE (the app builds this; see src/components/UpgradeProLink.tsx):
//   https://invite.thequestsapp.com/subscribe?uid=<uid>&exp=<exp>&sig=<sig>&plan=<monthly|yearly>&env=<staging|production>
//   - uid/exp/sig : the SIGNED triple minted by the sign-upgrade-link edge fn.
//                   sig = HMAC-SHA256(`${uid}.${exp}`, RC_UPGRADE_SIGNING_SECRET).
//   - plan        : which plan the user chose in-app. Maps to a Web Billing
//                   product id (monthly -> quests_pro_monthly,
//                   yearly  -> quests_pro_annual).
//   - env         : 'staging' uses the SANDBOX rcb_ key + the quests-staging
//                   return scheme; 'production' uses the PROD rcb_ key + the
//                   info.nothingserious.quests scheme. Anything else -> fallback.
//
// Required env binding (Cloudflare Pages -> Settings -> Environment variables):
//   RC_UPGRADE_SIGNING_SECRET  - the SAME shared HMAC secret the /upgrade
//                                Function uses and the sign-upgrade-link edge
//                                function signs with. Server-only; NEVER in the
//                                RN bundle, NEVER committed. Unset => every link
//                                fails to verify and we serve the fallback page.
//
// The rcb_ PUBLIC API keys below are PUBLISHABLE (RevenueCat Web Billing public
// keys are designed to ship in client bundles, exactly like Stripe publishable
// keys). They are safe to commit and to expose in the page. The trust boundary
// stays the webhook secret + this Function's signed-link verification.

// Canonical UUID contract — MUST match functions/upgrade.js, the RevenueCat
// webhook, the sign-upgrade-link edge function, and UpgradeProLink.tsx.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A signed link is MANDATORY (matches functions/upgrade.js REQUIRE_SIGNED_UPGRADE
// default). The plain ?uid= path is rejected to the fallback page.
const SIGNED_LINK_MAX_AGE_S = 60 * 60; // 1 hour; keep in sync with the signer.

// Plan -> RevenueCat Web Billing product store_identifier. The static module
// resolves the matching package from getOfferings() by this identifier.
const PLAN_TO_PRODUCT = {
  monthly: "quests_pro_monthly",
  yearly: "quests_pro_annual",
};

// env -> { publishable rcb_ key, app return scheme }.
//   staging    -> SANDBOX Web Billing key (Stripe TEST mode) + dev-client scheme.
//   production -> PROD Web Billing key (Stripe LIVE mode) + release scheme.
// Both rcb_ keys are publishable; see header note. The return scheme matches
// success.html so the post-purchase bounce-back deep-links the right build.
const ENV_CONFIG = {
  staging: {
    apiKey: "rcb_sb_UZSACAUZMcEajqDGadDiDsSxG",
    scheme: "quests-staging",
  },
  production: {
    apiKey: "rcb_mjvTEtQckLwAFghjpWRyjArhGwPZ",
    scheme: "info.nothingserious.quests",
  },
};

const APP_STORE_URL =
  "https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=info.nothingserious.quests";

// Content-Security-Policy for /subscribe. This is DELIBERATELY wider than the
// locked-down /upgrade CSP because this page loads the RevenueCat Web SDK (from
// esm.sh) and that SDK mounts Stripe Elements (js.stripe.com + Stripe APIs +
// 3DS frames). It is still scoped to the specific origins the flow needs.
//   - script-src: 'self' (our /subscribe-app.js module) + esm.sh (the pinned RC
//     SDK) + js.stripe.com (Stripe.js). NO 'unsafe-inline' for executable JS —
//     the per-request config is passed via a NON-executable
//     <script type="application/json"> block, which CSP does not gate.
//   - style-src 'unsafe-inline': the RC SDK + Stripe inject inline styles.
//   - connect-src: RevenueCat API + Stripe APIs (+ esm.sh for the module fetch).
//   - frame-src: Stripe (card element + 3DS challenge frames).
// MUST stay identical to the /subscribe block in _headers (the static "belt").
// NOTE on Stripe wildcards: a CSP host wildcard matches exactly ONE label, so
// https://*.stripe.com does NOT cover Stripe's TWO-label card/3DS iframe hosts
// (m.js.stripe.com, b.js.stripe.com). Per Stripe's official CSP guide, BOTH
// https://js.stripe.com AND https://*.js.stripe.com must be in script-src and
// frame-src or the Elements card form renders blank. e.revenue.cat = RC events;
// da08ctfrofx1b.cloudfront.net = RC checkout branding assets (fonts/wordmark);
// *.stripecdn.com = Stripe card-brand icons.
const SUBSCRIBE_CSP =
  "default-src 'self'; " +
  "script-src 'self' https://esm.sh https://js.stripe.com https://*.js.stripe.com; " +
  "style-src 'self' 'unsafe-inline' https://esm.sh https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://da08ctfrofx1b.cloudfront.net https://*.stripe.com data:; " +
  "img-src 'self' data: https://*.stripe.com https://*.stripecdn.com https://da08ctfrofx1b.cloudfront.net; " +
  "connect-src 'self' https://esm.sh https://api.revenuecat.com https://e.revenue.cat https://*.stripe.com https://*.stripe.network; " +
  "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.stripe.network; " +
  "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://*.stripe.com";

function pageHeaders(extra) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": SUBSCRIBE_CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra,
  };
}

// --- signed-link verification (mirrors functions/upgrade.js exactly) ---------

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

async function verifySignedLink(uid, exp, sig, secret) {
  if (!secret || !exp || !sig) return false;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false; // 32-byte HMAC-SHA256, hex
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || !Number.isInteger(expNum)) return false;
  const nowS = Math.floor(Date.now() / 1000);
  if (expNum < nowS) return false;
  if (expNum - nowS > SIGNED_LINK_MAX_AGE_S) return false;
  const expected = await computeSig(uid, exp, secret);
  return timingSafeEqualHex(expected.toLowerCase(), sig.toLowerCase());
}

// --- pages -------------------------------------------------------------------

// Shared <head> brand styling for both the checkout page and the fallback. Kept
// inline + self-contained (this Function generates the response), mirroring the
// dark-navy tokens used by success.html for visual consistency.
function headStyles() {
  return `
    :root {
      color-scheme: dark;
      --blue-900: #04102a; --blue-800: #14213c; --accent: #3366cc;
      --accent-light: #5c85d6; --text-strong: #ffffff; --text-muted: #a7b1d0;
      --text-soft: rgba(167,177,208,0.6); --surface-strong: rgba(32,44,79,0.92);
      --border-strong: rgba(48,61,98,0.95); --shadow-md: 0 24px 60px -30px rgba(6,22,58,0.55);
    }
    /* box-sizing only on the universal selector. We deliberately do NOT zero
       margin/padding on * — RevenueCat mounts its checkout DOM inside this page,
       and a universal margin/padding reset cascades into RC's form and collapses
       its layout (the Stripe iframe ends up 0-height). Scope spacing to our own
       elements instead. */
    *,*::before,*::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    html { -webkit-text-size-adjust: 100%; background: #04102a; }
    body {
      font-family: "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text-strong);
      background: linear-gradient(145deg, var(--blue-900) 0%, var(--blue-800) 60%, #1a3a7d 100%);
      background-attachment: fixed; min-height: 100vh; min-height: 100dvh; line-height: 1.5;
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    }
    /* While the checkout is open (and while offerings load just before it),
       the body goes solid WHITE so RevenueCat's light checkout surface reads as
       one continuous full-screen page — no navy gradient bleeding around it and
       no blue loading flash. subscribe-app.js toggles .checkout-open on <body>
       (and also flips the <meta name=theme-color> to white so iOS browser chrome
       matches). On success/cancel/error it removes the class to reveal the navy
       notice page again. */
    body.checkout-open { background: #ffffff; }
    .page {
      position: relative; width: 100%; min-height: 100vh; min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      padding: 40px 20px calc(env(safe-area-inset-bottom, 0px) + 40px);
      padding-top: calc(env(safe-area-inset-top, 0px) + 40px);
    }
    .card {
      background: var(--surface-strong); border: 1px solid var(--border-strong);
      border-radius: 28px; padding: 32px 28px; box-shadow: var(--shadow-md);
      max-width: 480px; width: 100%;
    }
    .brand { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 22px; }
    .brand img { width: 34px; height: 34px; border-radius: 9px; }
    .brand span { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.01em; }
    .title { font-size: clamp(1.4rem, 5vw, 1.8rem); font-weight: 800; letter-spacing: -0.02em; text-align: center; margin: 0 0 6px; }
    .subtitle { font-size: 0.95rem; color: var(--text-muted); text-align: center; margin: 0 0 22px; }
    #status { text-align: center; }
    .loader { max-width: 360px; width: 100%; text-align: center; }
    .subtext { font-size: 0.9rem; color: var(--text-muted); margin: 18px 0 0; }
    /* The RC checkout mounts here. When open it is a full-viewport surface. The
       background is WHITE (not navy) so RevenueCat's light checkout card blends
       into one continuous full-screen page instead of looking like a window
       floating on the blue loading screen. */
    #rc-checkout { display: none; }
    #rc-checkout.is-open {
      display: block; position: fixed; inset: 0; z-index: 1000;
      overflow-y: auto; background: #ffffff;
      padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
    }
    .spinner {
      width: 30px; height: 30px; margin: 0 auto; border-radius: 50%;
      border: 3px solid rgba(167,177,208,0.25); border-top-color: var(--accent-light);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* WHITE loading state shown once the SDK is configured and offerings are
       being fetched (up to ~20s), so the user never sees the navy spinner flash
       right before the white checkout opens. subscribe-app.js reveals this (and
       hides the navy .page) as soon as Purchases.configure() succeeds. */
    #loading-white { display: none; position: fixed; inset: 0; z-index: 900;
      background: #ffffff; align-items: center; justify-content: center;
      flex-direction: column; text-align: center;
      padding: env(safe-area-inset-top, 0px) 20px env(safe-area-inset-bottom, 0px); }
    #loading-white.is-open { display: flex; }
    #loading-white .spinner {
      border: 3px solid rgba(51,102,204,0.18); border-top-color: var(--accent);
    }
    #loading-white .subtext { color: #5a6480; }
    #loading-white .brand span { color: var(--blue-900); }
    .notice { text-align: center; display: none; }
    .notice.is-visible { display: block; }
    .success-mark {
      width: 64px; height: 64px; margin: 4px auto 14px; border-radius: 50%;
      background: rgba(52,199,89,0.14); color: #34c759; font-size: 34px;
      display: flex; align-items: center; justify-content: center;
    }
    .notice__title { font-size: 1.15rem; font-weight: 700; margin: 8px 0 8px; }
    .notice__text { color: var(--text-muted); font-size: 0.95rem; margin: 0 0 20px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 14px 24px; border-radius: 16px; border: none; cursor: pointer;
      font-family: inherit; font-size: 1rem; font-weight: 600; color: var(--text-strong);
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
      text-decoration: none; margin-bottom: 10px;
    }
    .btn--ghost { background: transparent; border: 1px solid var(--border-strong); color: var(--text-muted); }
    .footer__meta { margin-top: 22px; text-align: center; font-size: 11px; color: var(--text-soft); letter-spacing: 0.08em; }
    [hidden] { display: none !important; }
  `;
}

function checkoutHtml({ uid, productId, apiKey, env, scheme }) {
  // The per-request config is emitted as NON-executable application/json so it
  // is not gated by the script-src CSP. /subscribe-app.js reads + parses it.
  // Escape '<' so the JSON can never terminate the <script> block or be parsed
  // as markup (all values are already allowlisted/UUID-validated; this is
  // defense-in-depth for the embedded application/json data island).
  const config = JSON.stringify({ uid, productId, apiKey, env, scheme }).replace(
    /</g,
    "\\u003c"
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Quests Pro checkout</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="theme-color" content="#04102a" />
  <link rel="icon" type="image/png" href="/icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${headStyles()}</style>
</head>
<body>
  <div class="page">
    <main class="loader" role="main">
      <!-- Minimal NAVY interstitial: logo + spinner + one line, shown only for
           the brief moment before the SDK configures. Once configured,
           subscribe-app.js hides .page and shows the WHITE loader below. -->
      <div id="loading">
        <div class="brand"><span>Quests Pro</span></div>
        <div class="spinner" aria-hidden="true"></div>
        <p class="subtext" id="status">Taking you to secure checkout…</p>
      </div>

      <!-- Success / canceled / error state (revealed + populated by
           /subscribe-app.js). Self-contained so we never depend on another
           page's CSP for the return-to-app bounce. Lives on the navy .page,
           which subscribe-app.js re-reveals on completion. -->
      <div class="notice" id="notice">
        <div class="success-mark" id="success-mark" hidden aria-hidden="true">&#10003;</div>
        <h2 class="notice__title" id="notice-title"></h2>
        <p class="notice__text" id="notice-text"></p>
        <button class="btn" type="button" id="primary-btn"></button>
        <a class="btn btn--ghost" id="secondary-btn" href="#" hidden></a>
      </div>
    </main>
  </div>

  <!-- WHITE loading state, shown while offerings load (after SDK configure,
       before the checkout opens) so there is no navy flash before the white
       checkout. position:fixed; toggled by subscribe-app.js. -->
  <div id="loading-white" aria-hidden="true">
    <div class="brand"><span>Quests Pro</span></div>
    <div class="spinner" aria-hidden="true"></div>
    <p class="subtext">Taking you to secure checkout…</p>
  </div>

  <!-- Full-screen surface the RC checkout mounts into (htmlTarget). A DIRECT
       child of <body> (not inside .page/.loader) for cleaner stacking on iOS
       WebKit; it is position:fixed so it escapes normal flow regardless. -->
  <div id="rc-checkout"></div>

  <script type="application/json" id="rc-config">${config}</script>
  <script type="module" src="/subscribe-app.js?v=9"></script>
</body>
</html>`;
}

function fallbackHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Quests Pro – Quests</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="theme-color" content="#04102a" />
  <link rel="icon" type="image/png" href="/icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${headStyles()}</style>
</head>
<body>
  <div class="page">
    <main class="card" role="main" style="text-align:center;">
      <div class="brand"><img src="/icon.png" alt="" /><span>Quests Pro</span></div>
      <h1 class="title">Open the app to upgrade</h1>
      <p class="subtitle">This checkout link is invalid or has expired. Reopen the Quests app and tap Upgrade to Pro again.</p>
      <a href="${APP_STORE_URL}" class="btn">Get Quests on the App Store</a>
      <a href="${PLAY_STORE_URL}" class="btn btn--ghost">Get Quests on Google Play</a>
      <p class="footer__meta">© 2026 Nothing Serious LLC</p>
    </main>
  </div>
</body>
</html>`;
}

function fallbackResponse() {
  return new Response(fallbackHtml(), {
    status: 200,
    headers: pageHeaders({ "Content-Type": "text/html; charset=utf-8" }),
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const uid = (url.searchParams.get("uid") || "").trim().toLowerCase();
  const exp = (url.searchParams.get("exp") || "").trim();
  const sig = (url.searchParams.get("sig") || "").trim();
  const plan = (url.searchParams.get("plan") || "").trim().toLowerCase();
  const env = (url.searchParams.get("env") || "").trim().toLowerCase();
  const appScheme = (url.searchParams.get("appscheme") || "").trim().toLowerCase();

  const signingSecret = context.env.RC_UPGRADE_SIGNING_SECRET;

  // uid must be a well-formed UUID.
  if (!UUID_RE.test(uid)) return fallbackResponse();

  // plan must map to a known Web Billing product.
  const productId = PLAN_TO_PRODUCT[plan];
  if (!productId) return fallbackResponse();

  // env must be one we recognise (picks the publishable key + return scheme).
  const envCfg = ENV_CONFIG[env];
  if (!envCfg) return fallbackResponse();

  // Signed link is mandatory: verify sig over `${uid}.${exp}` and freshness.
  const signedOk = await verifySignedLink(uid, exp, sig, signingSecret);
  if (!signedOk) return fallbackResponse();

  // The BUILD's registered scheme can differ from the env-derived guess (a
  // prod-scheme TestFlight build checking out against the staging backend).
  // The app passes its own scheme as `appscheme`; honor it when it is one of
  // the two known schemes, else keep the env default. This is what makes the
  // in-app auth session auto-dismiss: the success page must fire the EXACT
  // scheme the session is watching for.
  const KNOWN_SCHEMES = ["info.nothingserious.quests", "quests-staging"];
  const scheme = KNOWN_SCHEMES.includes(appScheme) ? appScheme : envCfg.scheme;

  return new Response(
    checkoutHtml({
      uid,
      productId,
      apiKey: envCfg.apiKey,
      env,
      scheme,
    }),
    {
      status: 200,
      headers: pageHeaders({ "Content-Type": "text/html; charset=utf-8" }),
    }
  );
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: pageHeaders({ Allow: "GET, HEAD" }),
    });
  }
  return onRequestGet(context);
}
