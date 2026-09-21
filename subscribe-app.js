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
//   (.checkout-open) and hiding the cream .page, the result reads as one
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
import { Purchases, ErrorCode } from "https://esm.sh/@revenuecat/purchases-js@1.42.1";
import { createPriceNoticeEnhancer } from "./subscribe-notices.js";

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

// RevenueCat renders the verified product title inline after purchase() starts.
// Keep its real text node aligned with the concise checkout hierarchy so the
// visual label and accessible label stay identical across SDK rerenders.
function applyProductHeading() {
  if (!mount) return;
  const cadence = cfg && cfg.plan === "yearly" ? "Yearly" : "Monthly";
  const productHeading = "Pro Subscription (" + cadence + ")";
  const heading = mount.querySelector(
    ".rcb-product-title > .rcb-typography"
  );
  const titleTextNode = heading
    ? Array.from(heading.childNodes).find(
        (node) =>
          node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0
      )
    : null;
  if (titleTextNode && titleTextNode.nodeValue !== productHeading) {
    titleTextNode.nodeValue = productHeading;
  }
}

const CATEGORY_LOADER_KEYS = [
  "mindfulness",
  "recharge",
  "creativity",
  "growth",
  "social",
];

function createCategoryLoader() {
  const loader = document.createElement("span");
  loader.className = "cat-loader";
  loader.setAttribute("aria-hidden", "true");

  CATEGORY_LOADER_KEYS.forEach((category) => {
    const icon = document.createElement("span");
    icon.className =
      "cat-loader__icon cat-loader__icon--" + category;
    loader.appendChild(icon);
  });

  return loader;
}

// RevenueCat creates its payment loader after the form mounts. Replace the
// rotating SDK glyph with the same opacity-only category fade used by the app.
function applyRevenueCatLoader() {
  if (!mount) return;
  const loaderHost = mount.querySelector(
    ".rc-loading .rcb-modal-loader > .rcb-ui-asset-icon"
  );
  if (!loaderHost || loaderHost.classList.contains("quests-category-loader")) {
    return;
  }
  loaderHost.classList.add("quests-category-loader");
  loaderHost.appendChild(createCategoryLoader());
}

if (mount) {
  const updatePriceNotice = createPriceNoticeEnhancer(mount);
  const checkoutObserver = new MutationObserver(() => {
    applyProductHeading();
    applyRevenueCatLoader();
    updatePriceNotice();
  });
  checkoutObserver.observe(mount, {
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class"],
    subtree: true,
  });
}

// V2 brand page background (sand/cream, matches css/site.css --page and the
// theme-color meta the server emits). Restored when checkout chrome exits.
const CREAM = "#F3F1E7";
const GRAPHITE = "#191919";
const WHITE = "#ffffff";

// Hide the page and match iOS browser chrome to the graphite offerings loader.
function enterCheckoutChrome() {
  document.body.classList.add("checkout-open");
  if (pageEl) pageEl.hidden = true;
  if (themeColorMeta) themeColorMeta.setAttribute("content", GRAPHITE);
}

// Restore the cream page chrome so the success/error notice renders on brand.
function exitCheckoutChrome() {
  document.body.classList.remove("checkout-open");
  if (loadingWhiteEl) loadingWhiteEl.classList.remove("is-open");
  if (mount) mount.classList.remove("is-open");
  if (pageEl) pageEl.hidden = false;
  if (themeColorMeta) themeColorMeta.setAttribute("content", CREAM);
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
// Return without a purchase result. The server-side 302 is the transport iOS
// honors inside SFSafariViewController. The app dismisses the sheet and checks
// purchase state itself before it offers any billing route again.
const returnToAppUrl =
  "/subscribe/return?scheme=" + encodeURIComponent(scheme) + "&to=home";
// Universal-Link return target (see showSuccess). env is the server-validated
// backend name; the landing page uses it only to surface a staging escape hatch.
const successUniversalLink =
  "https://thequestsapp.com/pro/success?env=" +
  encodeURIComponent((cfg && cfg.env) || "production");

function hideLoading() {
  if (loadingEl) loadingEl.hidden = true;
}

// Render the closed or error state.
//   retry: true   only before the attempt was claimed (validate_web). The
//                 reserved attempt is intact, so reloading the link is safe.
//   retry: false  everywhere else. A claimed attempt stays pending on the
//                 backend until explicit cancellation or entitlement, and a
//                 cancelled attempt cannot be reopened from this link, so the
//                 only action is returning to the app to check status.
function showError(title, text, options) {
  const retry = !!(options && options.retry);
  hideLoading();
  // Restore the cream page so the notice renders on brand (also clears the
  // checkout surface and resets theme-color).
  exitCheckoutChrome();
  if (mount) mount.replaceChildren();
  if (successMark) successMark.hidden = true;
  if (noticeTitle) noticeTitle.textContent = title;
  if (noticeText) noticeText.textContent = text;
  if (primaryBtn) {
    if (retry) {
      primaryBtn.textContent = "Try again";
      primaryBtn.onclick = function () {
        window.location.reload();
      };
    } else {
      primaryBtn.textContent = "Return to Quests";
      primaryBtn.onclick = function () {
        window.location.href = returnToAppUrl;
      };
    }
  }
  if (secondaryBtn) {
    secondaryBtn.hidden = !retry;
    secondaryBtn.textContent = "Return to Quests";
    secondaryBtn.setAttribute("href", returnToAppUrl);
  }
  if (noticeEl) noticeEl.classList.add("is-visible");
}

// POST /subscribe/check. Resolves { ok, reason }. A transport failure reads as
// closed, the same as a refusal.
async function checkoutGate(action, outcome) {
  try {
    const body = { action: action, claims: cfg.claims, sig: cfg.sig };
    if (outcome) body.outcome = outcome;
    const res = await withTimeout(
      fetch("/subscribe/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      15000,
      action
    );
    let reason = null;
    try {
      reason = (await res.json()).reason || null;
    } catch (_e) {
      /* opaque body */
    }
    return { ok: res.ok, reason: reason };
  } catch (_e) {
    return { ok: false, reason: "checkout_unavailable" };
  }
}

const PENDING_TEXT =
  "Return to Quests to check your purchase status before trying again";

function showGateRefusal(reason) {
  if (reason === "web_checkout_disabled" || reason === "storefront_ineligible") {
    showError("Checkout is paused", "Return to Quests to see your upgrade options");
  } else if (reason === "already_subscribed") {
    showError("You already have Quests Pro", "Return to Quests to continue");
  } else if (reason === "purchase_pending" || reason === "attempt_unavailable") {
    showError("Purchase in progress", PENDING_TEXT);
  } else {
    showError("Checkout unavailable", PENDING_TEXT);
  }
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
  // Restore the cream page so the success notice renders on brand (also clears
  // the white body + white loader + checkout surface and resets theme-color).
  exitCheckoutChrome();
  if (mount) mount.replaceChildren();
  if (successMark) successMark.hidden = false;
  if (noticeTitle) noticeTitle.textContent = "You're Quests Pro!";
  if (noticeText) {
    noticeText.textContent =
      "Payment received, return to Quests while we confirm your Pro access";
  }
  if (primaryBtn) {
    primaryBtn.textContent = "Return to Quests";
    primaryBtn.onclick = function () {
      window.location.href = successUniversalLink;
    };
  }
  if (secondaryBtn) secondaryBtn.hidden = true;
  if (noticeEl) noticeEl.classList.add("is-visible");

  // ZERO-TAP AUTO-RETURN: hop to /subscribe/return (same-origin https — always
  // allowed for JS), whose SERVER-side 302 to the app scheme iOS honors even
  // inside SFSafariViewController (JS-initiated scheme/universal-link redirects
  // are "untrusted" and blocked; server redirects are not). The app receives
  // the scheme open, dismisses the in-app browser sheet, and shows the
  // ProUpgradeSuccess screen. If the hop is ever blocked, the success notice
  // above (button -> Universal Link) is already visible as the fallback.
  setTimeout(function () {
    try {
      window.location.href =
        "/subscribe/return?scheme=" +
        encodeURIComponent(scheme) +
        "&to=pro-upgrade-success";
    } catch (e) {
      /* blocked — fallback button is already visible */
    }
  }, 150);
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
  if (!cfg || !cfg.uid || !cfg.apiKey || !cfg.productId || !cfg.claims || !cfg.sig) {
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
    // cream spinner flash right before the white checkout opens: hide the cream
    // loader/.page and show the WHITE loader. enterCheckoutChrome() also flips
    // the body white + theme-color white. showError/showSuccess undo all of it.
    if (loadingEl) loadingEl.hidden = true;
    enterCheckoutChrome();
    if (loadingWhiteEl) loadingWhiteEl.classList.add("is-open");
  } catch (e) {
    dbg("FAIL configure: " + errStr(e));
    showError(
      "Something went wrong",
      "We couldn't start checkout. Please reopen Quests and try again.",
      { retry: true }
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
      "Please check your connection and try again.",
      { retry: true }
    );
    return;
  }

  if (!pkg) {
    showError(
      "Plan unavailable",
      "That plan isn't available right now. Please try again later.",
      { retry: true }
    );
    return;
  }

  // Final gate, immediately before the provider call. The backend rereads the
  // kill switch, entitlement and provider state, then atomically moves this
  // attempt from reserved to started. A stale page, a second tab or a repeat
  // tap loses that race and never reaches RevenueCat. The loader stays up
  // while this runs.
  dbg("claiming checkout attempt…");
  const gate = await checkoutGate("validate_web");
  if (!gate.ok) {
    dbg("gate refused: " + gate.reason);
    showGateRefusal(gate.reason);
    return;
  }

  // Hand the SINGLE chosen package to the SDK. We pass htmlTarget so purchase()
  // mounts the checkout INLINE into our full-viewport #rc-checkout container
  // (not RC's default centered modal window). There is no package-selection or
  // intro step. skipSuccessPage:true returns control to us on completion.
  try {
    dbg("opening checkout (purchase)…");
    if (loadingWhiteEl) loadingWhiteEl.classList.remove("is-open");
    if (mount) mount.classList.add("is-open");
    if (themeColorMeta) themeColorMeta.setAttribute("content", WHITE);
    await purchases.purchase({
      rcPackage: pkg,
      htmlTarget: mount,
      brandingAppearanceOverride: BRAND_APPEARANCE,
      skipSuccessPage: true,
      metadata: {
        supabase_uid: cfg.uid,
        source: "web_subscribe",
        attempt: cfg.claims.attempt,
      },
    });
    // The provider accepted payment. Entitlement arrives through the webhook;
    // the app confirms it after the return.
    dbg("purchase resolved OK");
    showSuccess();
  } catch (e) {
    // Only an explicit SDK cancellation releases the attempt. Every other
    // rejection is ambiguous (the charge may have gone through), so the
    // attempt stays pending for provider and entitlement reconciliation.
    dbg("purchase ended: " + errStr(e));
    if (e && e.errorCode === ErrorCode.UserCancelledError) {
      const released = await checkoutGate("finish_web", "cancelled");
      if (released.ok) {
        showError(
          "Checkout closed",
          "No charge was made, return to Quests to choose how to upgrade"
        );
        return;
      }
    }
    showError("Checkout closed", PENDING_TEXT);
  }
}

run();
