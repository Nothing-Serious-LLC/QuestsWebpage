// /subscribe-app.js  — Quests Pro DIRECT web checkout (client module)
//
// Loaded by the /subscribe page (functions/subscribe.js). The Function has
// ALREADY verified the signed upgrade link server-side and injected the
// VERIFIED config (uid + publishable rcb_ key + chosen product id + env +
// return scheme) into a non-executable <script type="application/json"
// id="rc-config"> block. This module reads that config and drives the
// RevenueCat Web SDK purchase() flow.
//
// FULL-SCREEN (htmlTarget) APPROACH — what's actually in use:
//   We pass htmlTarget: #rc-checkout to purchase(), so RC mounts the Stripe
//   checkout form INLINE into our own full-viewport container instead of its
//   default centered modal window. Combined with a solid-WHITE body
//   (.checkout-open) and hiding the navy .page, the result reads as one
//   continuous full-screen checkout, not a card floating on a blue page. There
//   is still NO RevenueCat package-selection/intro step, because we hand the
//   SDK the single package the user already chose in the app.
//
//   The page's CSS deliberately does NOT zero margin/padding on * (only
//   box-sizing), so it does not cascade into and collapse RC's mounted form.
//
// FALLBACK (RC default modal, NOT in use): if Stripe Elements ever collapse to
//   0-height inside htmlTarget again, OMIT htmlTarget from purchase() and set
//   the body white before calling it — RC then renders its own self-contained
//   modal overlay at the document root, immune to our page's layout/CSS.
//
// Pinned SDK version (publishable key in the page is safe by design):
//   @revenuecat/purchases-js@1.42.1
//
// Entitlement is granted SERVER-SIDE: a Web SDK purchase fires the existing
// RevenueCat webhook (INITIAL_PURCHASE, store=RC_BILLING, app_user_id = uid),
// which writes subscription_entitlements -> Realtime -> isPro. This page only
// drives the UI; on success it deep-links back into the app. The app must NOT
// trust the redirect for entitlement — it waits for the Realtime push.
import { Purchases } from "https://esm.sh/@revenuecat/purchases-js@1.42.1";

const cfgEl = document.getElementById("rc-config");
const mount = document.getElementById("rc-checkout");
const loadingEl = document.getElementById("loading");
const loadingWhiteEl = document.getElementById("loading-white");
const pageEl = document.querySelector(".page");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const statusEl = document.getElementById("status");
const noticeEl = document.getElementById("notice");
const noticeTitle = document.getElementById("notice-title");
const noticeText = document.getElementById("notice-text");
const successMark = document.getElementById("success-mark");
const primaryBtn = document.getElementById("primary-btn");
const secondaryBtn = document.getElementById("secondary-btn");

const NAVY = "#04102a";
const WHITE = "#ffffff";

// Switch the page to the full-screen WHITE checkout surface: solid-white body,
// hide the navy .page, flip iOS browser-chrome theme-color to white. Called as
// soon as the SDK is configured (before offerings load) so there's no navy
// flash, and stays in effect through purchase().
function enterCheckoutChrome() {
  document.body.classList.add("checkout-open");
  if (pageEl) pageEl.hidden = true;
  if (themeColorMeta) themeColorMeta.setAttribute("content", WHITE);
}

// Restore the navy page chrome so the success/error notice renders on brand.
function exitCheckoutChrome() {
  document.body.classList.remove("checkout-open");
  if (loadingWhiteEl) loadingWhiteEl.classList.remove("is-open");
  if (mount) mount.classList.remove("is-open");
  if (pageEl) pageEl.hidden = false;
  if (themeColorMeta) themeColorMeta.setAttribute("content", NAVY);
}

function readConfig() {
  try {
    return cfgEl ? JSON.parse(cfgEl.textContent) : null;
  } catch (_e) {
    return null;
  }
}

const cfg = readConfig();

// Diagnostic logger: writes to the on-page #debug box (via subscribe-boot.js)
// AND the console, so the failing step is visible on-device during sandbox tests.
function dbg(msg) {
  try {
    if (typeof window !== "undefined" && window.__rcDebug) window.__rcDebug(msg);
  } catch (_e) {
    /* no-op */
  }
  console.log("[subscribe] " + msg);
}

// Reject after `ms` so a hung network call (e.g. getOfferings) surfaces as a
// visible error instead of an endless "Loading…" spinner.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function (_resolve, reject) {
      setTimeout(function () {
        reject(new Error((label || "operation") + " timed out after " + ms + "ms"));
      }, ms);
    }),
  ]);
}

// Resolve the app return deep links from the server-injected scheme. We handle
// the return-to-app bounce IN THIS PAGE (not via success.html) so the flow never
// depends on another page's CSP. deepLinkService handles both paths:
//   success -> pro-upgrade-success (routes back to the dev sandbox screen)
//   cancel  -> home
const scheme = (cfg && cfg.scheme) || "info.nothingserious.quests";
const successDeepLink = scheme + "://pro-upgrade-success"; // legacy custom-scheme return (still used by /pro/success.html fallback)
const homeDeepLink = scheme + "://home";
// Universal-Link return target (see showSuccess). env is the server-validated
// backend name; the landing page uses it only to surface a staging escape hatch.
const successUniversalLink =
  "https://thequestsapp.com/pro/success?env=" +
  encodeURIComponent((cfg && cfg.env) || "production");

function hideLoading() {
  if (loadingEl) loadingEl.hidden = true;
}

// Render the canceled/error state: a retry primary + a "Return to Quests"
// secondary that routes the app Home.
function showError(title, text) {
  hideLoading();
  // Restore the navy page so the error notice renders on brand (also clears the
  // white body + white loader + checkout surface and resets theme-color).
  exitCheckoutChrome();
  if (mount) mount.replaceChildren();
  if (successMark) successMark.hidden = true;
  if (noticeTitle) noticeTitle.textContent = title;
  if (noticeText) noticeText.textContent = text;
  if (primaryBtn) {
    primaryBtn.textContent = "Try again";
    primaryBtn.onclick = function () {
      window.location.reload();
    };
  }
  if (secondaryBtn) {
    secondaryBtn.hidden = false;
    secondaryBtn.textContent = "Return to Quests";
    secondaryBtn.setAttribute("href", homeDeepLink);
  }
  if (noticeEl) noticeEl.classList.add("is-visible");
}

// Render the success state. Entitlement is already granted SERVER-SIDE by the RC
// webhook; this screen is UX only.
//
// RETURN-TO-APP = UNIVERSAL LINK. The "Return to Quests" button navigates (on a
// user tap) to https://thequestsapp.com/pro/success?env=… — the APEX domain, not
// invite.* — because iOS suppresses Universal Links that target the domain the
// page is already on, and checkout runs on invite.thequestsapp.com. On a build
// whose associated domains include applinks:thequestsapp.com (TestFlight 13+),
// iOS opens the app directly and deepLinkService routes /pro/success. Anywhere
// else (older build, dev-client, no app) Safari loads /pro/success.html, which
// offers a tap-to-open custom-scheme button + store fallback.
function showSuccess() {
  hideLoading();
  // Restore the navy page so the success notice renders on brand (also clears
  // the white body + white loader + checkout surface and resets theme-color).
  exitCheckoutChrome();
  if (mount) mount.replaceChildren();
  if (successMark) successMark.hidden = false;
  if (noticeTitle) noticeTitle.textContent = "You're Quests Pro!";
  if (noticeText) {
    noticeText.textContent =
      "Your Pro features are unlocked. Return to the Quests app to continue.";
  }
  if (primaryBtn) {
    primaryBtn.textContent = "Return to Quests";
    primaryBtn.onclick = function () {
      window.location.href = successUniversalLink;
    };
  }
  if (secondaryBtn) secondaryBtn.hidden = true;
  if (noticeEl) noticeEl.classList.add("is-visible");
}

// Quests-branded checkout appearance (RevenueCat BrandingAppearance shape,
// applied to the RC checkout + Stripe Elements via brandingAppearanceOverride).
// All 9 fields are required and colors MUST be hex/rgb (Stripe rejects rgba).
// NOTE: color_page_bg also drives Stripe's input background, so it stays light
// for legible card fields (RC's appearance schema has no text-color control and
// defaults to white). The brand expression is the blue buttons/accent; we use
// rectangle (squared) shapes to read as a flush full-page form rather than a
// rounded modal card. A fully dark form isn't safely supported by this schema.
const BRAND_APPEARANCE = {
  color_buttons_primary: "#3366cc", // Quests primary blue (Pay button)
  color_accent: "#3366cc", // links / focus / selected states
  color_error: "#e5484d",
  color_form_bg: "#ffffff",
  color_page_bg: "#ffffff",
  color_product_info_bg: "#eef2fb", // light blue tint for the plan summary
  font: "",
  shapes: "rectangle", // squared corners -> flush full-page form, not a card
  show_product_description: false, // plan already chosen in-app; tighter form
};

// Find the package whose Web Billing product matches the chosen product id.
// Scans the current offering first, then every other offering, so it does not
// depend on which offering happens to be marked "current" in the dashboard.
function findPackage(offerings, productId) {
  const pools = [];
  if (offerings && offerings.current) pools.push(offerings.current);
  const all = (offerings && offerings.all) || {};
  for (const key of Object.keys(all)) pools.push(all[key]);
  for (const offering of pools) {
    const pkgs = (offering && offering.availablePackages) || [];
    for (const pkg of pkgs) {
      const id =
        (pkg.webBillingProduct && pkg.webBillingProduct.identifier) ||
        (pkg.rcBillingProduct && pkg.rcBillingProduct.identifier);
      if (id === productId) return pkg;
    }
  }
  return null;
}

function errStr(e) {
  if (!e) return "unknown";
  return (
    (e.name ? e.name + ": " : "") +
    (e.message || String(e)) +
    (e.code ? " (code " + e.code + ")" : "")
  );
}

async function run() {
  dbg(
    "boot env=" +
      (cfg && cfg.env) +
      " product=" +
      (cfg && cfg.productId) +
      " key=" +
      (cfg && cfg.apiKey ? cfg.apiKey.slice(0, 10) + "…" : "none")
  );
  if (!cfg || !cfg.uid || !cfg.apiKey || !cfg.productId) {
    dbg("FAIL: missing/invalid config");
    showError(
      "Something went wrong",
      "This checkout link is invalid or expired. Please reopen Quests and try again."
    );
    return;
  }

  let purchases;
  try {
    dbg("configuring SDK…");
    purchases = Purchases.configure({ apiKey: cfg.apiKey, appUserId: cfg.uid });
    dbg("configured OK");
    // Whiten NOW (before the up-to-20s offerings fetch) so the user never sees a
    // navy spinner flash right before the white checkout opens: hide the navy
    // loader/.page and show the WHITE loader. enterCheckoutChrome() also flips
    // the body white + theme-color white. showError/showSuccess undo all of it.
    if (loadingEl) loadingEl.hidden = true;
    enterCheckoutChrome();
    if (loadingWhiteEl) loadingWhiteEl.classList.add("is-open");
  } catch (e) {
    dbg("FAIL configure: " + errStr(e));
    showError(
      "Something went wrong",
      "We couldn't start checkout. Please reopen Quests and try again."
    );
    return;
  }

  let pkg;
  try {
    // US-only launch; request USD explicitly. Timed so a hang surfaces as an error.
    dbg("loading offerings (USD)…");
    const offerings = await withTimeout(
      purchases.getOfferings({ currency: "USD" }),
      20000,
      "getOfferings"
    );
    const offCount =
      offerings && offerings.all ? Object.keys(offerings.all).length : 0;
    const curCount =
      offerings && offerings.current && offerings.current.availablePackages
        ? offerings.current.availablePackages.length
        : 0;
    dbg(
      "offerings loaded: " + offCount + " offering(s), current=" + curCount + " pkg"
    );
    pkg = findPackage(offerings, cfg.productId);
    dbg(pkg ? "matched package for " + cfg.productId : "NO match for " + cfg.productId);
  } catch (e) {
    dbg("FAIL getOfferings: " + errStr(e));
    showError(
      "Couldn't load plans",
      "Please check your connection and try again."
    );
    return;
  }

  if (!pkg) {
    showError(
      "Plan unavailable",
      "That plan isn't available right now. Please try again later."
    );
    return;
  }

  // Hand the SINGLE chosen package to the SDK. We pass htmlTarget so purchase()
  // mounts the checkout INLINE into our full-viewport #rc-checkout container
  // (not RC's default centered modal window) — there is no package-selection/
  // intro step. skipSuccessPage:true returns control to us on completion.
  try {
    dbg("opening checkout (purchase)…");
    // Go full-screen: swap the WHITE loader for the full-viewport checkout
    // surface, then mount the RC checkout into it (htmlTarget) so it fills the
    // screen instead of rendering as a small centered modal window. The body is
    // already white (enterCheckoutChrome, above). The page's CSS does not zero
    // margin/padding on *, so it doesn't leak into RC's DOM, and the fixed
    // container is sized, so the inline form renders correctly.
    if (loadingWhiteEl) loadingWhiteEl.classList.remove("is-open");
    if (mount) mount.classList.add("is-open");
    await purchases.purchase({
      rcPackage: pkg,
      htmlTarget: mount,
      brandingAppearanceOverride: BRAND_APPEARANCE,
      skipSuccessPage: true,
      metadata: { supabase_uid: cfg.uid, source: "web_subscribe" },
    });
    // Success: bounce back into the app. Entitlement is already being granted
    // server-side via the RC webhook -> subscription_entitlements -> Realtime.
    dbg("purchase resolved OK");
    showSuccess();
  } catch (e) {
    // purchase() rejects on user cancel as well as on real errors. Either way no
    // entitlement was granted; offer retry + a path back into the app.
    dbg("purchase ended: " + errStr(e));
    showError(
      "Checkout closed",
      "No charge was made. You can try again or head back to the app."
    );
  }
}

run();
