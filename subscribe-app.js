// /subscribe-app.js  — Quests Pro DIRECT web checkout (client module)
//
// Loaded by the /subscribe page (functions/subscribe.js). The Function has
// ALREADY verified the signed upgrade link server-side and injected the
// VERIFIED config (uid + publishable rcb_ key + chosen product id + env +
// return scheme) into a non-executable <script type="application/json"
// id="rc-config"> block. This module reads that config and drives the
// RevenueCat Web SDK purchase() flow, which renders the Stripe card form
// directly into #rc-checkout — with NO RevenueCat package-selection/intro page,
// because we hand the SDK the single package the user already chose in the app.
//
// Pinned SDK version (publishable key in the page is safe by design):
//   @revenuecat/purchases-js@1.42.1
//
// Entitlement is granted SERVER-SIDE: a Web SDK purchase fires the existing
// RevenueCat webhook (INITIAL_PURCHASE, store=RC_BILLING, app_user_id = uid),
// which writes subscription_entitlements -> Realtime -> isPro. This page only
// drives the UI; on success it bounces to /success.html, which deep-links back
// into the app. The app must NOT trust the redirect for entitlement — it waits
// for the Realtime push.
import { Purchases } from "https://esm.sh/@revenuecat/purchases-js@1.42.1";

const cfgEl = document.getElementById("rc-config");
const mount = document.getElementById("rc-checkout");
const loadingEl = document.getElementById("loading");
const statusEl = document.getElementById("status");
const noticeEl = document.getElementById("notice");
const noticeTitle = document.getElementById("notice-title");
const noticeText = document.getElementById("notice-text");
const successMark = document.getElementById("success-mark");
const primaryBtn = document.getElementById("primary-btn");
const secondaryBtn = document.getElementById("secondary-btn");

function readConfig() {
  try {
    return cfgEl ? JSON.parse(cfgEl.textContent) : null;
  } catch (_e) {
    return null;
  }
}

const cfg = readConfig();

// Resolve the app return deep links from the server-injected scheme. We handle
// the return-to-app bounce IN THIS PAGE (not via success.html) so the flow never
// depends on another page's CSP. deepLinkService handles both paths:
//   success -> pro-upgrade-success (routes back to the dev sandbox screen)
//   cancel  -> home
const scheme = (cfg && cfg.scheme) || "info.nothingserious.quests";
const successDeepLink = scheme + "://pro-upgrade-success";
const homeDeepLink = scheme + "://home";

function hideLoading() {
  if (loadingEl) loadingEl.hidden = true;
}

// Render the canceled/error state: a retry primary + a "Return to Quests"
// secondary that routes the app Home.
function showError(title, text) {
  hideLoading();
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

// Render the success state and bounce back into the app. Entitlement is granted
// SERVER-SIDE by the RC webhook; this is UX only. iOS Safari may block the auto
// scheme-open without a gesture, so the primary button re-fires it on tap.
function showSuccess() {
  hideLoading();
  if (mount) mount.replaceChildren();
  if (successMark) successMark.hidden = false;
  if (noticeTitle) noticeTitle.textContent = "You're Quests Pro";
  if (noticeText) {
    noticeText.textContent = "Tap below to return to the Quests app.";
  }
  if (primaryBtn) {
    primaryBtn.textContent = "Return to Quests";
    primaryBtn.onclick = function () {
      window.location.href = successDeepLink;
    };
  }
  if (secondaryBtn) secondaryBtn.hidden = true;
  if (noticeEl) noticeEl.classList.add("is-visible");
  // Best-effort auto-bounce; the button above is the reliable fallback.
  window.location.href = successDeepLink;
}

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

async function run() {
  if (!cfg || !cfg.uid || !cfg.apiKey || !cfg.productId) {
    showError(
      "Something went wrong",
      "This checkout link is invalid or expired. Please reopen Quests and try again."
    );
    return;
  }

  let purchases;
  try {
    purchases = Purchases.configure({ apiKey: cfg.apiKey, appUserId: cfg.uid });
  } catch (e) {
    console.error("[subscribe] configure failed", e);
    showError(
      "Something went wrong",
      "We couldn't start checkout. Please reopen Quests and try again."
    );
    return;
  }

  let pkg;
  try {
    // US-only launch; request USD explicitly.
    const offerings = await purchases.getOfferings({ currency: "USD" });
    pkg = findPackage(offerings, cfg.productId);
  } catch (e) {
    console.error("[subscribe] getOfferings failed", e);
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

  // Hand the SINGLE chosen package to the SDK. purchase() renders ONLY the
  // Stripe card form into #rc-checkout — there is no selection/intro step.
  // skipSuccessPage:true returns control to us immediately on completion.
  try {
    if (statusEl) statusEl.textContent = "";
    await purchases.purchase({
      rcPackage: pkg,
      htmlTarget: mount,
      skipSuccessPage: true,
      metadata: { supabase_uid: cfg.uid, source: "web_subscribe" },
    });
    // Success: bounce back into the app. Entitlement is already being granted
    // server-side via the RC webhook -> subscription_entitlements -> Realtime.
    showSuccess();
  } catch (e) {
    // purchase() rejects on user cancel as well as on real errors. Either way no
    // entitlement was granted; offer retry + a path back into the app.
    console.warn("[subscribe] purchase did not complete", e);
    showError(
      "Checkout closed",
      "No charge was made. You can try again or head back to the app."
    );
  }
}

run();
