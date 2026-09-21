import { checkoutClaims, checkCheckout, deploymentEnvironment } from './subscribe/policy.js';

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
//   This Function does the server-trusted half: it has the paired backend
//   verify the signed capability (so the uid cannot be forged), then server-
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
// REQUEST SHAPE (Build 15, the app builds this; see src/components/UpgradeProLink.tsx):
//   /subscribe?version=2&uid=&attempt=&exp=&plan=&env=&appscheme=&storefront=&sig=
//   Every parameter except sig is a signed claim. The paired Supabase
//   sign-upgrade-link function owns signature validation, expiry, purchase
//   state, storefront eligibility and the live payments.routing kill switch.
//   This Function forwards the claims unchanged and renders checkout only on
//   an explicit allow. Version 1 and unsigned links reach the fallback page.
//
// Required deployment binding (Cloudflare Pages -> Settings -> Variables):
//   PAYMENT_BACKEND_ENVIRONMENT = staging     on quests-payment-review
//   PAYMENT_BACKEND_ENVIRONMENT = production  on quests-invite
//   The binding selects the backend, the publishable Web Billing key and the
//   Stripe mode. The signed env claim must equal it. A missing, unknown or
//   mismatched value serves the fallback page, so a URL can never select the
//   sandbox route on a production deployment. This Function holds no signing
//   secret.
//
// The rcb_ PUBLIC API keys below are PUBLISHABLE (RevenueCat Web Billing public
// keys are designed to ship in client bundles, exactly like Stripe publishable
// keys). They are safe to commit and to expose in the page. The trust boundary
// stays the webhook secret + the backend's signed-capability verification.

// Canonical UUID contract — MUST match functions/upgrade.js, the RevenueCat
// webhook, the sign-upgrade-link edge function, and UpgradeProLink.tsx.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
const KNOWN_SCHEMES = ["info.nothingserious.quests", "quests-staging"];
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

// --- pages -------------------------------------------------------------------

// CSS port of the app's CategoryFadeLoader (src/components/loaders/
// CategoryFadeLoader.tsx): ONE brand glyph at a time fading through the
// canonical category ladder (questCategoryOrder.ts: mindfulness, recharge,
// creativity, growth, social), 320ms in / 360ms hold / 260ms out per glyph.
// The SVG masks preserve the exact onboarding silhouettes while letting Safari
// show the same clean gradients as the native renderer. Reduced motion holds
// the first glyph still, exactly like the app.
const CAT_LOADER_KEYS = [
  'mindfulness',
  'recharge',
  'creativity',
  'growth',
  'social',
];

const CAT_LOADER_HTML =
  '<div class="cat-loader" role="img" aria-label="Loading">' +
  CAT_LOADER_KEYS
    .map(
      (category) =>
        `<span class="cat-loader__icon cat-loader__icon--${category}" aria-hidden="true"></span>`
    )
    .join('') +
  '</div>';

// Shared <head> brand styling for both the checkout page and the fallback. Kept
// inline + self-contained (this Function generates the response), mirroring the
// V2 cream/purple tokens in css/site.css (sand page, cream card, ink text,
// signature purple) so this page reads as the app's own brand.
function headStyles() {
  return `
    :root {
      color-scheme: light;
      --page: #F3F1E7; --surface: #FDFBF6; --text: #191919; --text-2: #696969;
      --text-soft: rgba(25,25,25,0.45);
      --hairline: rgba(25,25,25,0.07); --edge: rgba(25,25,25,0.14); --veil: rgba(25,25,25,0.05);
      --purple: #A961CC; --purple-deep: #9354B3; --purple-pale: #F1E2F8;
      --sh-card: 0 1px 2px rgba(25,25,25,0.04), 0 8px 24px rgba(25,25,25,0.06);
    }
    /* box-sizing only on the universal selector. We deliberately do NOT zero
       margin/padding on * — RevenueCat mounts its checkout DOM inside this page,
       and a universal margin/padding reset cascades into RC's form and collapses
       its layout (the Stripe iframe ends up 0-height). Scope spacing to our own
       elements instead. */
    *,*::before,*::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    html { -webkit-text-size-adjust: 100%; background: #F3F1E7; }
    body {
      font-family: "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: var(--page);
      min-height: 100vh; min-height: 100dvh; line-height: 1.5;
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    }
    /* Fine grain over the cream, same recipe as the share pages
       (css/site.css --grain). Hidden while the white checkout chrome is up. */
    body::before {
      content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.045; z-index: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    body.checkout-open::before { display: none; }
    /* While the checkout is open (and while offerings load just before it),
       the body goes solid WHITE so RevenueCat's light checkout surface reads as
       one continuous full-screen page — no cream band bleeding around it and no
       flash between loaders. subscribe-app.js toggles .checkout-open on <body>
       (and also flips the <meta name=theme-color> to white so iOS browser chrome
       matches). On success/cancel/error it removes the class to reveal the cream
       notice page again. */
    body.checkout-open { background: #ffffff; }
    .page {
      position: relative; width: 100%; min-height: 100vh; min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      padding: 40px 20px calc(env(safe-area-inset-bottom, 0px) + 40px);
      padding-top: calc(env(safe-area-inset-top, 0px) + 40px);
    }
    .card {
      background: var(--surface); border: 1px solid var(--hairline);
      border-radius: 24px; padding: 32px 28px; box-shadow: var(--sh-card);
      max-width: 480px; width: 100%;
    }
    .fallback-page { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 92px); }
    .fallback-card { text-align: center; }
    .fallback-hero { display: flex; justify-content: center; margin: 0 0 24px; }
    .fallback-hero img { width: 64px; height: 64px; border-radius: 16px; }
    .fallback-card .title {
      font-family: "Instrument Serif", Georgia, serif; font-size: clamp(2rem, 8vw, 2.5rem);
      font-weight: 400; line-height: 1.08; letter-spacing: 0.005em; margin-bottom: 12px;
    }
    .fallback-card .subtitle { max-width: 350px; margin-left: auto; margin-right: auto; }
    .fallback-footer {
      position: fixed; left: 20px; right: 20px;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
      z-index: 2; margin: 0;
    }
    .brand { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 22px; }
    .brand img { width: 34px; height: 34px; border-radius: 9px; }
    .brand span { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.01em; color: var(--text); }
    .title { font-size: clamp(1.4rem, 5vw, 1.8rem); font-weight: 800; letter-spacing: -0.02em; text-align: center; margin: 0 0 6px; }
    .subtitle { font-size: 0.95rem; color: var(--text-2); text-align: center; margin: 0 0 22px; }
    #status { text-align: center; }
    .loader { max-width: 360px; width: 100%; text-align: center; }
    .subtext { font-size: 0.9rem; color: var(--text-2); margin: 18px 0 0; }
    /* Both checkout loading moments use the Pro graphite surface. The first
       loader sits inside .page so it owns the viewport until the SDK is ready. */
    #loading {
      position: fixed; inset: 0; z-index: 850;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; text-align: center;
      padding: env(safe-area-inset-top, 0px) 20px env(safe-area-inset-bottom, 0px);
      color: #FDFBF6;
      background: linear-gradient(to top right, #565656 0%, #191919 100%);
    }
    #loading::before,
    #loading-white::before {
      content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.05;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    #loading > *,
    #loading-white > * { position: relative; z-index: 1; }
    #loading .subtext,
    #loading-white .subtext { color: rgba(253,251,246,0.72); }
    /* The RC checkout mounts here. When open it is a full-viewport surface with
       a WHITE background so RevenueCat's light checkout card blends into one
       continuous full-screen page instead of looking like a window floating on
       the cream loading screen. */
    #rc-checkout { display: none; }
    #rc-checkout.is-open {
      display: block; position: fixed; inset: 0; z-index: 1000;
      overflow-y: auto; background: #ffffff;
      padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
    }
    /* CategoryFadeLoader port: the five glyphs stack in one spot; each is
       visible for its fifth of the 4700ms loop (940ms = 320 in + 360 hold +
       260 out, the app's exact timings). Each onboarding SVG is used as an
       alpha mask. This preserves its shape and removes the browser-rendered
       feTurbulence layer that the native SVG renderer omits. */
    .cat-loader { position: relative; width: 28px; height: 28px; margin: 0 auto; }
    .cat-loader__icon {
      position: absolute; inset: 0; display: block; width: 28px; height: 28px;
      opacity: 0; transform: none;
      -webkit-mask-position: center; mask-position: center;
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
      -webkit-mask-size: contain; mask-size: contain;
      animation: catFade 4700ms infinite;
      will-change: opacity;
    }
    .cat-loader__icon--mindfulness {
      background: linear-gradient(180deg, #D5AFE8 38.46%, #FFB18F 100%);
      -webkit-mask-image: url('/assets/img/icon-mindfulness.svg');
      mask-image: url('/assets/img/icon-mindfulness.svg');
    }
    .cat-loader__icon--recharge {
      background: linear-gradient(180deg, #92A8EC 19.23%, #C796DF 100%);
      -webkit-mask-image: url('/assets/img/icon-recharge.svg');
      mask-image: url('/assets/img/icon-recharge.svg');
    }
    .cat-loader__icon--creativity {
      background: linear-gradient(180deg, #FF8F5E 31.73%, #DBB66B 100%);
      -webkit-mask-image: url('/assets/img/icon-creativity.svg');
      mask-image: url('/assets/img/icon-creativity.svg');
    }
    .cat-loader__icon--growth {
      background: linear-gradient(184deg, #D1AA56 47.6%, #D6E746 100%);
      -webkit-mask-image: url('/assets/img/icon-growth.svg');
      mask-image: url('/assets/img/icon-growth.svg');
    }
    .cat-loader__icon--social {
      background: linear-gradient(180deg, #D6E746 3.36%, #92A8EC 100%);
      -webkit-mask-image: url('/assets/img/icon-social.svg');
      mask-image: url('/assets/img/icon-social.svg');
    }
    .cat-loader__icon:nth-child(2) { animation-delay: 940ms; }
    .cat-loader__icon:nth-child(3) { animation-delay: 1880ms; }
    .cat-loader__icon:nth-child(4) { animation-delay: 2820ms; }
    .cat-loader__icon:nth-child(5) { animation-delay: 3760ms; }
    @keyframes catFade {
      0% { opacity: 0; animation-timing-function: cubic-bezier(0.39, 0.575, 0.565, 1); }
      6.8% { opacity: 1; animation-timing-function: linear; }
      14.5% { opacity: 1; animation-timing-function: cubic-bezier(0.47, 0, 0.745, 0.715); }
      20% { opacity: 0; }
      100% { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cat-loader__icon { animation: none; }
      .cat-loader__icon:first-child { opacity: 1; }
    }
    /* Full-screen loading state shown once the SDK is configured and offerings
       are being fetched, continuing the graphite transition into checkout. */
    #loading-white { display: none; position: fixed; inset: 0; z-index: 900;
      background: linear-gradient(to top right, #565656 0%, #191919 100%);
      align-items: center; justify-content: center;
      flex-direction: column; text-align: center;
      padding: env(safe-area-inset-top, 0px) 20px env(safe-area-inset-bottom, 0px); }
    #loading-white.is-open { display: flex; }
    .notice { text-align: center; display: none; }
    .notice.is-visible { display: block; }
    /* Match pro/success.html for the inline return after payment. */
    body.checkout-success {
      color: #FDFBF6;
      background: #191919 linear-gradient(to top right, #565656 0%, #191919 100%);
    }
    body.checkout-success::before { opacity: 0.05; }
    .checkout-success .page {
      padding: calc(env(safe-area-inset-top, 0px) + 32px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px);
    }
    .checkout-success .notice__title {
      font-family: "Instrument Serif", Georgia, serif; font-weight: 400;
      font-size: clamp(2rem, 9vw, 2.6rem); letter-spacing: 0.005em;
      margin: 22px 0 6px; text-wrap: balance;
    }
    .checkout-success .notice__text {
      margin: 0 0 30px; color: rgba(253,251,246,0.72); font-size: 1rem;
    }
    .checkout-success .btn {
      min-height: 52px; padding: 14px 24px;
      background: #FDFBF6; color: #191919; font-size: 1.05rem;
    }
    .checkout-success .btn:focus-visible {
      outline: 2px solid #FDFBF6; outline-offset: 3px;
    }
    .notice__title { font-size: 1.15rem; font-weight: 700; margin: 8px 0 8px; }
    .notice__text { color: var(--text-2); font-size: 0.95rem; margin: 0 0 20px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; min-height: 44px; padding: 12px 24px; border-radius: 999px;
      border: none; cursor: pointer;
      font-family: inherit; font-size: 1rem; font-weight: 700; letter-spacing: 0.01em;
      color: var(--page); background: var(--text);
      text-decoration: none; margin-bottom: 10px;
      transition: opacity 0.15s ease;
    }
    .btn:hover { opacity: 0.86; }
    .btn:active { opacity: 1; }
    .btn--ghost {
      background: transparent; border: none; color: var(--text);
      box-shadow: inset 0 0 0 1.5px var(--edge);
    }
    .btn--ghost:hover { background: var(--veil); opacity: 1; box-shadow: inset 0 0 0 1.5px var(--text-2); }
    .footer__meta { margin-top: 22px; text-align: center; font-size: 11px; color: var(--text-soft); letter-spacing: 0.08em; }
    [hidden] { display: none !important; }
    /* --- Quests-aligned overrides for the RevenueCat-mounted checkout -------
       RC mounts its DOM inline into #rc-checkout (no iframe except the Stripe
       fields), so scoped overrides on its rcb-* classes restyle the chrome.
       Sanctioned dashboard Appearance can replace most of this; these rules
       make the checkout wear the brand regardless, and !important is required
       to beat the SDK's injected styles. SDK pinned at 1.42.1; re-verify on
       any SDK bump. The Stripe iframes (card fields, wallet buttons) and
       their internals are unreachable by design. */
    #rc-checkout .rcb-ui-root,
    #rc-checkout .rcb-ui-root *:not(iframe) { font-family: "Manrope", system-ui, -apple-system, sans-serif !important; }
    /* Retheme RevenueCat through its OWN variable system: the SDK sets these
       inline (from dashboard branding, still carrying the legacy #3366cc
       blue), and stylesheet !important beats inline for custom properties.
       Buttons, links, focus rings, and the product panel all read these. */
    #rc-checkout .rcb-ui-root,
    #rc-checkout .rcb-ui-layout,
    #rc-checkout .rcb-ui-main,
    #rc-checkout .rcb-ui-container {
      --rc-color-primary: #191919 !important;
      --rc-color-primary-hover: #3a3a3a !important;
      --rc-color-primary-pressed: #000000 !important;
      --rc-color-accent: #A961CC !important;
      --rc-color-focus: #A961CC !important;
      --rc-color-background: #F3F1E7 !important;
      --rc-color-input-background: #FFFFFF !important;
      --rc-color-grey-text-dark: #191919 !important;
      --rc-color-grey-text-light: #696969 !important;
      --rc-shape-input-border-radius: 12px !important;
      --rc-shape-input-button-border-radius: 999px !important;
    }
    /* Product summary wears the app's Pro graphite surface. RevenueCat nests
       cream backgrounds across three verified layout wrappers, so each layer
       becomes transparent and the gradient stays continuous. */
    #rc-checkout .rcb-ui-navbar {
      background: linear-gradient(to top right, #565656 0%, #191919 100%) !important;
      color: #FDFBF6 !important;
    }
    #rc-checkout .rcb-ui-navbar .layout-wrapper-outer,
    #rc-checkout .rcb-ui-navbar .layout-wrapper,
    #rc-checkout .rcb-ui-navbar .layout-content,
    #rc-checkout .rcb-ui-navbar .rcb-header-wrapper,
    #rc-checkout .rcb-ui-navbar .rcb-header,
    #rc-checkout .rcb-ui-navbar .rcb-navbar {
      background: transparent !important; color: #FDFBF6 !important;
    }
    #rc-checkout .rcb-ui-navbar [class*="rcb-typography"] { color: #FDFBF6 !important; }
    #rc-checkout .rcb-ui-navbar .rcb-product-description { color: rgba(253,251,246,0.68) !important; }
    #rc-checkout .rcb-ui-navbar .rcb-close-button .arrow-fill { fill: #FDFBF6 !important; }
    /* Form side stays white so the Stripe fields blend. */
    #rc-checkout .rcb-main-block { background: #ffffff !important; }
    /* Bring the SDK tax confirmation notice above the payment fields.
       Keep it in flow so it cannot cover wallet controls or the updated total. */
    #rc-checkout .rc-checkout-form-container {
      display: flex !important; flex-direction: column !important;
    }
    #rc-checkout .rc-checkout-price-update-info-container {
      order: -1; margin-top: 0 !important; margin-bottom: 20px;
      scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 16px);
      outline: none;
    }
    #rc-checkout .rc-checkout-price-update-info-container.fully-hidden {
      margin-bottom: 0;
    }
    #rc-checkout .rc-checkout-price-update-info-container .rcb-info {
      border: 1px solid #A961CC; background: #F7F0FA !important;
      padding: 16px !important; border-radius: 12px !important;
    }
    #rc-checkout .rc-checkout-price-update-info-container .rcb-info-title {
      font-weight: 700; color: #191919 !important;
    }
    #rc-checkout .rc-checkout-price-update-info-container .rcb-info-message {
      color: #454545 !important; line-height: 1.5;
    }
    /* RevenueCat's payment state keeps its stable wrapper. The SDK spinner is
       hidden and subscribe-app.js inserts the same fade loader used above. */
    #rc-checkout .rc-loading .rcb-modal-loader > .rcb-ui-asset-icon {
      width: 28px !important; height: 28px !important; color: transparent !important;
      animation: none !important; transform: none !important;
    }
    #rc-checkout .rc-loading .rcb-modal-loader > .rcb-ui-asset-icon > svg {
      display: none !important;
    }
    #rc-checkout .rc-loading .rcb-modal-loader > .rcb-ui-asset-icon::before {
      content: ""; display: block; width: 28px; height: 28px;
      background: linear-gradient(180deg, #D5AFE8 38.46%, #FFB18F 100%);
      -webkit-mask: center / contain no-repeat url('/assets/img/icon-mindfulness.svg');
      mask: center / contain no-repeat url('/assets/img/icon-mindfulness.svg');
    }
    #rc-checkout .rc-loading .rcb-modal-loader > .rcb-ui-asset-icon.quests-category-loader::before { display: none; }
    #rc-checkout .rc-loading .rcb-modal-loader > .rcb-ui-asset-icon > .cat-loader { margin: 0; }
    /* Seller row: use the established Quests wordmark as one quiet mark. */
    #rc-checkout .rcb-title {
      display: flex; align-items: center; width: 105px; height: 28px;
    }
    #rc-checkout .rcb-title > * { display: none !important; }
    #rc-checkout .rcb-title::before {
      content: ""; width: 105px; height: 28px; flex: 0 0 105px;
      background: url('/assets/img/quests-wordmark-ink.svg') center / contain no-repeat;
      filter: brightness(0) invert(1);
    }
    /* The product name carries the hierarchy on its own. */
    #rc-checkout .rcb-subscribe-to {
      display: none !important;
    }
    /* Product title in the brand serif (the *:not(iframe) form matches the
       universal Manrope rule's specificity; source order settles it). */
    #rc-checkout .rcb-product-title,
    #rc-checkout .rcb-product-title *:not(iframe) {
      font-family: "Instrument Serif", Georgia, serif !important;
      font-weight: 400 !important; font-size: clamp(28px, 4vw, 40px) !important;
      letter-spacing: 0.005em; color: #FDFBF6 !important;
    }
    /* Total row: hairline separation, app ink. */
    #rc-checkout .rcb-pricing-table {
      border-top: 1px solid rgba(253,251,246,0.16); padding-top: 14px;
    }
    /* Panel texture: quiet grain over the graphite half on wide screens. */
    @media (min-width: 900px) {
      #rc-checkout.is-open::before {
        content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 50%;
        pointer-events: none; opacity: 0.05;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
      }
    }
    /* Pay button: the app's ink pill (RC renders it as button.intent-primary). */
    #rc-checkout button.intent-primary,
    #rc-checkout [data-testid="PayButton"] {
      background: #191919 !important; color: #F3F1E7 !important;
      border-radius: 999px !important; border: none !important;
      font-family: "Manrope", system-ui, sans-serif !important; font-weight: 700 !important;
      letter-spacing: 0.01em;
    }
    #rc-checkout button.intent-primary:hover:not(:disabled) { opacity: 0.88; }
    #rc-checkout button.intent-primary:disabled,
    #rc-checkout [data-testid="PayButton"]:disabled { opacity: 0.35 !important; }
    /* Small print in the app's secondary ink. */
    #rc-checkout .rcb-modal-footer, #rc-checkout .rcb-modal-footer * { color: #696969 !important; }
  `;
}

function checkoutHtml({ uid, productId, apiKey, env, scheme, plan, claims, sig }) {
  // The per-request config is emitted as NON-executable application/json so it
  // is not gated by the script-src CSP. /subscribe-app.js reads + parses it.
  // Escape '<' so the JSON can never terminate the <script> block or be parsed
  // as markup (all values are already allowlisted/UUID-validated; this is
  // defense-in-depth for the embedded application/json data island).
  const config = JSON.stringify({ uid, productId, apiKey, env, scheme, plan, claims, sig }).replace(
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
  <meta name="theme-color" content="#191919" />
  <link rel="icon" type="image/png" href="/assets/img/app-icon-sunset.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${headStyles()}</style>
</head>
<body>
  <div class="page">
    <main class="loader" role="main">
      <!-- Graphite interstitial with the category sequence, shown for the
           brief moment before the SDK configures. -->
      <div id="loading">
        ${CAT_LOADER_HTML}
        <p class="subtext" id="status">Taking you to secure checkout…</p>
      </div>

      <!-- Success / canceled / error state (revealed + populated by
           /subscribe-app.js). Self-contained so we never depend on another
           page's CSP for the return-to-app bounce. The success state uses
           the Pro graphite surface; other notices retain the cream page. -->
      <div class="notice" id="notice">
        <h2 class="notice__title" id="notice-title"></h2>
        <p class="notice__text" id="notice-text"></p>
        <button class="btn" type="button" id="primary-btn"></button>
        <a class="btn btn--ghost" id="secondary-btn" href="#" hidden></a>
      </div>
    </main>
  </div>

  <!-- Graphite loading state shown while offerings load after SDK configure. -->
  <div id="loading-white" aria-hidden="true">
    ${CAT_LOADER_HTML}
    <p class="subtext">Taking you to secure checkout…</p>
  </div>

  <!-- Full-screen surface the RC checkout mounts into (htmlTarget). A DIRECT
       child of <body> (not inside .page/.loader) for cleaner stacking on iOS
       WebKit; it is position:fixed so it escapes normal flow regardless. -->
  <div id="rc-checkout"></div>

  <script type="application/json" id="rc-config">${config}</script>
  <script type="module" src="/subscribe-app.js?v=15-pro-return"></script>
</body>
</html>`;
}

function fallbackHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Quests Pro</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="theme-color" content="#F3F1E7" />
  <link rel="icon" type="image/png" href="/assets/img/app-icon-sunset.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${headStyles()}</style>
</head>
<body>
  <div class="page fallback-page">
    <main class="card fallback-card" role="main">
      <div class="fallback-hero"><img src="/assets/img/app-icon-sunset.png" alt="Quests" /></div>
      <h1 class="title">Open the app to upgrade</h1>
      <p class="subtitle">This checkout link is invalid or expired, reopen Quests and tap Upgrade to Pro again</p>
      <a href="${APP_STORE_URL}" class="btn">Get Quests on the App Store</a>
      <a href="${PLAY_STORE_URL}" class="btn btn--ghost">Get Quests on Google Play</a>
    </main>
  </div>
  <p class="footer__meta fallback-footer">© 2026 Nothing Serious LLC</p>
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
  const claims = checkoutClaims(url.searchParams);
  const sig = (url.searchParams.get("sig") || "").trim();

  // The deployment binding selects the billing environment. URL parameters
  // never do: the signed env claim only has to agree with the binding.
  const backendEnv = deploymentEnvironment(context.env);
  const envCfg = ENV_CONFIG[backendEnv];
  if (!envCfg || claims.env !== backendEnv) return fallbackResponse();

  // Shape checks before any backend call. The backend repeats all of them
  // against the signature; these only keep malformed links off the network.
  if (!UUID_RE.test(claims.uid || "") || !UUID_RE.test(claims.attempt || "")) {
    return fallbackResponse();
  }
  const productId = PLAN_TO_PRODUCT[claims.plan];
  if (!productId) return fallbackResponse();
  if (!KNOWN_SCHEMES.includes(claims.appscheme)) return fallbackResponse();

  // Page-entry gate: signature, expiry, entitlement, provider state, storefront
  // and the live kill switch, all read fresh by the paired backend.
  const allowed = await checkCheckout(context.env, claims, sig, "inspect_web");
  if (!allowed) return fallbackResponse();

  return new Response(
    checkoutHtml({
      uid: claims.uid,
      productId,
      apiKey: envCfg.apiKey,
      env: backendEnv,
      // The signed return scheme of the build that opened checkout.
      scheme: claims.appscheme,
      plan: claims.plan,
      claims,
      sig,
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
