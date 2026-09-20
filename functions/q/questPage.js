import {
  ICON_CREATIVITY,
  ICON_GROWTH,
  ICON_MINDFULNESS,
  ICON_RECHARGE,
  ICON_SOCIAL,
  WORDMARK,
} from "../p/pageAssets.js";
import {
  QUEST_ICON_CANONICAL_ALIASES,
  QUEST_ICON_SVG_TEMPLATES,
} from "./questIconSvgTemplates.js";
import { QUEST_ICON_PATHS } from "./questIconPaths.js";
import { questPhoneClaimScript } from "./phoneClaimScript.js";

const SURFACE = "#f3f1e7";
const TITLE_INK = "#191919";
const BODY_INK = "#4f4f4f";
const QUEST_OG_WIDTH = 640;
const QUEST_OG_HEIGHT = 800;
const CATEGORY_VISUALS = Object.freeze({
  recharge_move: Object.freeze({ background: "#ECF0FE", ink: "#889FE9" }),
  social_lifestyle: Object.freeze({ background: "#DFF2E2", ink: "#57A56C" }),
  mindfulness: Object.freeze({ background: "#F1E2F8", ink: "#A961CC" }),
  creativity: Object.freeze({ background: "#FFE4D6", ink: "#F0925B" }),
  productivity: Object.freeze({ background: "#F5E9CF", ink: "#DBB66B" }),
});
const DEFAULT_CATEGORY_VISUAL = CATEGORY_VISUALS.mindfulness;
const DEFAULT_APP_HANDOFF = Object.freeze({
  appScheme: "info.nothingserious.quests",
  androidPackage: "info.nothingserious.quests",
  appStoreUrl: "https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553",
  playStoreUrl: "https://play.google.com/store/apps/details?id=info.nothingserious.quests",
  appStoreId: "6745767553",
});
const QUEST_PAGE_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
  "font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
  "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com; " +
  "img-src 'self' https://*.supabase.co data:; " +
  "frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; " +
  "form-action 'self' https://apps.apple.com https://play.google.com; " +
  "base-uri 'self'; object-src 'none'";

const ICON_FIELD = [
  { svg: ICON_GROWTH, size: "clamp(58px, 8vw, 118px)", top: "4%", left: "5%", rotate: "-10deg" },
  { svg: ICON_CREATIVITY, size: "clamp(44px, 6vw, 92px)", top: "8%", right: "7%", rotate: "12deg" },
  { svg: ICON_MINDFULNESS, size: "clamp(48px, 7vw, 106px)", top: "36%", right: "2%", rotate: "9deg" },
  { svg: ICON_SOCIAL, size: "clamp(40px, 5.5vw, 86px)", top: "48%", left: "2%", rotate: "7deg" },
  { svg: ICON_RECHARGE, size: "clamp(48px, 6.5vw, 102px)", bottom: "11%", left: "6%", rotate: "10deg" },
  { svg: ICON_SOCIAL, size: "clamp(64px, 9vw, 138px)", bottom: "-3%", left: "39%", rotate: "-6deg" },
  { svg: ICON_GROWTH, size: "clamp(40px, 5vw, 78px)", bottom: "16%", right: "8%", rotate: "-8deg" },
  { svg: ICON_CREATIVITY, size: "clamp(36px, 4.5vw, 70px)", top: "23%", left: "17%", rotate: "4deg" },
];

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function iconFieldMarkup() {
  return ICON_FIELD.map((icon) => {
    const position = ["top", "bottom", "left", "right"]
      .filter((edge) => icon[edge] !== undefined)
      .map((edge) => `${edge}:${icon[edge]};`)
      .join("");
    return `<span class="field-icon" aria-hidden="true" style="${position}width:${icon.size};height:${icon.size};transform:rotate(${icon.rotate});">${icon.svg}</span>`;
  }).join("\n    ");
}

function displayInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("") || "Q";
}

function avatarMarkup(presentation) {
  if (presentation.hostAvatarUrl) {
    return `<img class="host-avatar" src="${escapeHtml(presentation.hostAvatarUrl)}" alt="" />`;
  }
  return `<span class="host-avatar host-initials" aria-hidden="true">${escapeHtml(displayInitials(presentation.hostDisplayName))}</span>`;
}

function pillMarkup(presentation) {
  const pills = [];
  if (presentation.privacyLevel === "PRIVATE") pills.push("Private");
  if (presentation.privacyLevel === "PUBLIC") pills.push("Public");
  if (presentation.privacyLevel === "COMMUNITY") pills.push("Community");
  if (presentation.duration) pills.push(presentation.duration);
  const categoryLabels = {
    recharge_move: "Healthy",
    social_lifestyle: "Social",
    mindfulness: "Mindful",
    creativity: "Creative",
    productivity: "Productive",
  };
  if (presentation.category && categoryLabels[presentation.category]) {
    pills.push(categoryLabels[presentation.category]);
  }
  return pills.slice(0, 3)
    .map((pill) => `<span class="quest-pill">${escapeHtml(pill)}</span>`)
    .join("");
}

function checkInRuleMarkup(presentation) {
  if (!presentation.cadenceLabel) return "";
  const cadence = presentation.cadenceLabel.trim();
  let rule;
  switch (cadence.toLowerCase()) {
    case "weekly":
    case "every week":
      rule = "Check in every week";
      break;
    case "monthly":
    case "every month":
      rule = "Check in every month";
      break;
    case "daily":
    case "every day":
      rule = "Check in every day";
      break;
    default:
      rule = /^check in\b/i.test(cadence)
        ? cadence
        : `Check in ${cadence.toLowerCase()}`;
      break;
  }
  return `<div class="check-in-rule"><span class="mdi mdi-calendar-check-outline" aria-hidden="true"></span><span>${escapeHtml(rule)}</span></div>`;
}

function participantLabel(count) {
  if (count === 0) return "is hosting this Quest";
  if (count === 1) return "& 1 Quester";
  return `& ${count.toLocaleString("en-US")} Questers`;
}

function questIconMarkup(presentation) {
  const canonicalKey = presentation.icon
    ? QUEST_ICON_CANONICAL_ALIASES[presentation.icon] ??
      (QUEST_ICON_SVG_TEMPLATES[presentation.icon] ? presentation.icon : null)
    : null;
  const template = canonicalKey
    ? QUEST_ICON_SVG_TEMPLATES[canonicalKey] ?? null
    : null;
  if (template) {
    return `<span class="quest-icon-svg" aria-hidden="true">${template}</span>`;
  }
  const legacyPath = presentation.icon
    ? QUEST_ICON_PATHS[presentation.icon] ?? null
    : null;
  if (legacyPath) {
    return `<span class="quest-icon-svg" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${legacyPath}" fill="currentColor" /></svg></span>`;
  }
  return `<span class="quest-icon-svg quest-icon-fallback" aria-hidden="true"><svg viewBox="0 0 29 25" fill="none"><path d="M27.8637 16.6699C28.2771 17.2106 28.5 17.7857 28.5 18.3822C28.5 21.5452 22.232 24.1094 14.5 24.1094C6.76801 24.1094 0.5 21.5452 0.5 18.3822C0.5 17.7857 0.722856 17.2106 1.13633 16.6699" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.5001 10.9733C21.5001 6.5236 17.9126 2.78451 15.8741 1.01902C15.0751 0.326993 13.925 0.326993 13.126 1.01902C11.0874 2.78451 7.5 6.5236 7.5 10.9733C7.5 15.0927 10.634 17.7467 14.5 17.7467C18.366 17.7467 21.5001 15.0927 21.5001 10.9733Z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.92532 4.45411C7.67222 3.74008 5.31777 3.69398 3.76286 3.77677C2.68876 3.83399 1.8608 4.66196 1.80364 5.73606C1.66871 8.26968 1.87593 12.9262 4.75786 15.8081C6.79173 17.8419 9.41565 18.2071 11.658 17.2225C9.20856 16.2568 7.50067 14.0143 7.50067 10.9735C7.50067 8.51155 8.59887 6.26716 9.92532 4.45411Z" stroke="currentColor" stroke-linejoin="round"/><path d="M19.0745 4.45411C20.4009 6.26716 21.4991 8.51155 21.4991 10.9733C21.4991 14.0143 19.7912 16.2568 17.3418 17.2225C19.5842 18.2071 22.2081 17.8419 24.2419 15.8081C27.1239 12.9262 27.3311 8.26968 27.1962 5.73612C27.139 4.66196 26.311 3.83399 25.2369 3.77677C23.682 3.69398 21.3276 3.74008 19.0745 4.45411Z" stroke="currentColor" stroke-linejoin="round"/></svg></span>`;
}

function coverMarkup(presentation) {
  if (!presentation.coverImageUrl) return "";
  return `<div class="quest-cover"><img src="${escapeHtml(presentation.coverImageUrl)}" alt="" /></div>`;
}

function safeHttpsUrl(value, fallback) {
  try {
    const parsed = new URL(String(value || ""));
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

const APP_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]{0,63}$/;

export function normalizeQuestAppHandoff(value = {}) {
  const appScheme = APP_SCHEME_PATTERN.test(String(value.appScheme || ""))
    ? String(value.appScheme)
    : DEFAULT_APP_HANDOFF.appScheme;
  // Extra iOS schemes tried after the primary one (staging host only; see
  // appHandoffTargets.js). Deduplicated and validated like the primary.
  const alternateAppSchemes = Array.isArray(value.alternateAppSchemes)
    ? Array.from(new Set(
      value.alternateAppSchemes
        .map((scheme) => String(scheme || ""))
        .filter((scheme) => APP_SCHEME_PATTERN.test(scheme) && scheme !== appScheme),
    ))
    : [];
  const androidScheme = APP_SCHEME_PATTERN.test(String(value.androidScheme || ""))
    ? String(value.androidScheme)
    : appScheme;
  const androidPackage = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(
    String(value.androidPackage || ""),
  )
    ? String(value.androidPackage)
    : DEFAULT_APP_HANDOFF.androidPackage;
  const appStoreId = /^\d{6,20}$/.test(String(value.appStoreId || ""))
    ? String(value.appStoreId)
    : DEFAULT_APP_HANDOFF.appStoreId;

  return {
    appScheme,
    alternateAppSchemes,
    androidScheme,
    androidPackage,
    appStoreId,
    appStoreUrl: safeHttpsUrl(value.appStoreUrl, DEFAULT_APP_HANDOFF.appStoreUrl),
    playStoreUrl: safeHttpsUrl(value.playStoreUrl, DEFAULT_APP_HANDOFF.playStoreUrl),
  };
}

function response(markup, status, requestMethod = "GET") {
  return new Response(requestMethod === "HEAD" ? null : markup, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": QUEST_PAGE_CSP,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function questUnavailablePage({ requestMethod = "GET", appHandoff } = {}) {
  const handoff = normalizeQuestAppHandoff(appHandoff);
  return response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Quest unavailable | Quests</title>
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="${SURFACE}" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; overflow: hidden;
        background: ${SURFACE}; color: ${TITLE_INK}; font-family: "Manrope", -apple-system, "Segoe UI", sans-serif; }
      .field-icon { position: fixed; opacity: .42; pointer-events: none; }
      .field-icon svg { width: 100%; height: 100%; }
      main { position: relative; text-align: center; padding: 34px; max-width: 520px; }
      .wordmark { display: block; width: 116px; margin: 0 auto 34px; }
      .wordmark svg { display: block; width: 100%; height: auto; }
      h1 { font-size: clamp(28px, 7vw, 40px); line-height: 1.12; letter-spacing: -.5px; margin-bottom: 14px; }
      p { color: ${BODY_INK}; font-size: 17px; line-height: 1.55; margin-bottom: 30px; }
      .cta { display: inline-flex; min-height: 54px; align-items: center; justify-content: center; padding: 0 30px;
        border-radius: 999px; background: ${TITLE_INK}; color: white; font-size: 16px; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    ${iconFieldMarkup()}
    <main>
      <span class="wordmark">${WORDMARK}</span>
      <h1>This Quest link is unavailable or has expired.</h1>
      <a class="cta" href="${escapeHtml(handoff.appStoreUrl)}">Get Quests</a>
    </main>
  </body>
</html>`, 404, requestMethod);
}

export function questSharePage({
  origin,
  shareCode,
  presentation,
  turnstileSiteKey,
  appHandoff,
  interactionMode = "phone",
  previewQuery = "",
  requestMethod = "GET",
}) {
  const handoff = normalizeQuestAppHandoff(appHandoff);
  const revision = presentation.revision;
  const revisionQuery = previewQuery
    ? `?${previewQuery}`
    : revision > 0
      ? `?r=${revision}`
      : "";
  const canonicalUrl = `${origin}/q/${shareCode}${revisionQuery}`;
  // The https share link is the first "open" offer: iOS routes it to whichever
  // installed client claims this host, so it never assumes one scheme.
  const universalLink = `${origin}/q/${shareCode}`;
  const alternateAppMarkup = handoff.alternateAppSchemes
    .map((scheme) =>
      `<p class="alternate-app">Using the staging build? <a href="${escapeHtml(`${scheme}://q/${shareCode}`)}">Open it here</a></p>`)
    .join("");
  const imageUrl = `${origin}/q/${shareCode}/og.png${revisionQuery}`;
  const pageTitle = presentation.availability === "ended"
    ? `${presentation.title} has ended | Quests`
    : `Join ${presentation.title} on Quests`;
  const pageDescription = `Hosted by ${presentation.hostDisplayName}`;
  const safeTitle = escapeHtml(presentation.title);
  const safeHost = escapeHtml(presentation.hostDisplayName);
  const safeDescription = escapeHtml(pageDescription);
  const categoryVisual = presentation.category
    ? CATEGORY_VISUALS[presentation.category] ?? DEFAULT_CATEGORY_VISUAL
    : DEFAULT_CATEGORY_VISUAL;
  const accent = presentation.iconColor ?? categoryVisual.ink;
  const categoryBackground = categoryVisual.background;
  const socialProof = escapeHtml(participantLabel(presentation.participantCount));
  const isEnded = presentation.availability === "ended";
  const shareHeadline = isEnded ? "This Quest has ended" : "You’ve been invited to a Quest";
  const pageHeadline = isEnded ? "This Quest has ended" : "You’ve been invited!";
  const usesPhoneClaim =
    !isEnded &&
    (interactionMode === "phone" || interactionMode === "phone-demo");
  const phoneScript = usesPhoneClaim
    ? questPhoneClaimScript({
      shareCode,
      turnstileSiteKey,
      appHandoff: handoff,
      demoMode: interactionMode === "phone-demo",
    })
    : "";
  const turnstileScript = !isEnded && interactionMode === "phone"
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  const actionPanel = isEnded
    ? `<section class="join-panel ended-panel" aria-label="This Quest has ended">
        <div class="ended-mark" aria-hidden="true">&#10003;</div>
        <a class="store-button" href="${escapeHtml(handoff.appStoreUrl)}">Get Quests</a>
      </section>`
    : !usesPhoneClaim
      ? `<section class="join-panel" aria-label="Join this Quest">
        <a class="store-button" href="${escapeHtml(`${handoff.appScheme}://q/${shareCode}`)}">Open Quests</a>
        ${alternateAppMarkup}
      </section>`
      : `<section class="join-panel" aria-label="Join this Quest">
        <form id="phone-claim-form" novalidate>
          <div class="phone-row">
            <label class="visually-hidden" for="phone-input">Phone number</label>
            <div class="phone-number-field">
              <span class="phone-country-prefix" aria-hidden="true">+1</span>
              <input id="phone-input" class="phone-input" type="tel" inputmode="tel" autocomplete="tel"
                placeholder="(555) 000-0000" aria-describedby="phone-error phone-privacy" />
            </div>
            <button id="join-quest-button" class="join-button" type="submit" disabled>
              <span id="join-quest-label">Join Quest</span>
            </button>
          </div>
          <p id="phone-error" class="phone-error" role="alert" aria-live="polite" hidden></p>
          <p id="phone-privacy" class="privacy">By continuing, you agree to the <a href="https://thequestsapp.com/privacy.html">Privacy Policy</a> and
            <a href="https://thequestsapp.com/terms.html">Terms of Service</a>.</p>
          <div id="turnstile-container"></div>
        </form>
        <div id="claim-success" class="success" role="status" aria-live="polite" tabindex="-1" hidden>
          <div class="success-mark" aria-hidden="true">&#10003;</div>
          <h2>Opening Quests<span class="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></h2>
        </div>
      </section>`;
  // With alternate schemes in play the control is the universal link itself,
  // so a long-press (or a tap with scripting off) hands the https URL to the
  // OS; the click handler then walks the scheme chain. Hosts without
  // alternates keep the original button markup.
  const openAppSlot = !isEnded && usesPhoneClaim
    ? handoff.alternateAppSchemes.length > 0
      ? `<a id="open-app-link" class="open-app" href="${escapeHtml(universalLink)}">Open in Quests</a>
      ${alternateAppMarkup}`
      : `<button id="open-app-link" class="open-app" type="button">Open in Quests</button>`
    : "";

  return response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="${SURFACE}" />
    ${interactionMode === "staging-app-only" || interactionMode === "phone-demo" ? "" : `<meta name="apple-itunes-app" content="app-id=${handoff.appStoreId}, app-argument=${escapeHtml(canonicalUrl)}" />`}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${shareHeadline}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Quests" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${QUEST_OG_WIDTH}" />
    <meta property="og:image:height" content="${QUEST_OG_HEIGHT}" />
    <meta property="og:image:alt" content="Invitation to ${safeTitle}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${shareHeadline}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css" rel="stylesheet"
      integrity="sha384-HphS8cQyN+eYiJ5PMbzShG6qZdRtvHPVLPkYb8JwMkmNgaIxrFVDhQe3jIbq3EZ2" crossorigin="anonymous" />
    ${turnstileScript}
    <style>
      :root { --accent: ${accent}; --category-bg: ${categoryBackground}; --surface: ${SURFACE}; --title: ${TITLE_INK}; --body: ${BODY_INK};
        --ease-out: cubic-bezier(0.33, 1, 0.68, 1); --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);
        --pull-drop: calc(50vh - 190px); --pull-drop: calc(50dvh - 190px); --content-rise: 22px; }
      @keyframes fade-soft { from { opacity: 0; } to { opacity: 1; } }
      @keyframes pull-up {
        0% { transform: translateY(var(--pull-drop)); animation-timing-function: linear; }
        55% { transform: translateY(var(--pull-drop)); animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); }
        100% { transform: translateY(0); }
      }
      .reveal { margin-top: auto; margin-bottom: auto; animation: pull-up 2.5s linear 0.15s both; }
      @keyframes rise-in {
        from { opacity: 0; transform: translateY(var(--content-rise)); }
        to { opacity: 1; transform: translateY(0); }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { min-height: 100%; }
      body { min-height: 100vh; min-height: 100dvh; background: var(--surface); color: var(--title);
        font-family: "Manrope", -apple-system, "Segoe UI", sans-serif; overflow-x: hidden; }
      button, input { font: inherit; }
      .field-icon { position: fixed; opacity: .42; pointer-events: none; z-index: 0; }
      .field-icon svg { display: block; width: 100%; height: 100%; }
      .page { position: relative; z-index: 1; display: flex; flex-direction: column;
        min-height: 100vh; min-height: 100dvh;
        width: min(calc(100% - 32px), 420px); margin: 0 auto; padding:
        max(24px, env(safe-area-inset-top)) 0 max(28px, env(safe-area-inset-bottom)); }
      .wordmark { display: block; width: 112px; margin: 0 auto 30px; }
      .wordmark svg { display: block; width: 100%; height: auto; }
      .intro { text-align: center; margin: 0 auto 32px;
        animation: fade-soft 0.55s var(--ease-out) 0.2s both,
          intro-out 0.5s var(--ease-out) 2.15s both; }
      @keyframes intro-out { from { opacity: 1; } to { opacity: 0; } }
      .intro h1 { font-family: "Instrument Serif", Georgia, serif; font-size: clamp(34px, 9vw, 40px); line-height: 1.08;
        font-weight: 400; letter-spacing: .2px; }
      .quest-card { position: relative; overflow: hidden; border: 1px solid #ffffff; border-radius: 40px;
        background: var(--category-bg); box-shadow: 4px 4px 30px rgba(0,0,0,.12); text-align: center;
        animation: fade-soft 0.6s var(--ease-out) 1.7s both; }
      .quest-cover { width: 100%; height: 184px; overflow: hidden; }
      .quest-cover img { width: 100%; height: 100%; display: block; object-fit: cover; }
      .quest-content { display: flex; flex-direction: column; align-items: center; padding: 32px 24px; }
      .quest-cover + .quest-content { padding-top: 0; }
      .medallion { width: 58px; height: 58px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%;
        background: #ffffff; border: 2px solid var(--accent); color: var(--accent); font-size: 30px; overflow: hidden; }
      .quest-cover + .quest-content .medallion { margin-top: -29px; }
      .quest-icon-svg { display: grid; width: 31px; height: 31px; place-items: center; }
      .quest-icon-svg svg { display: block; width: 100%; height: 100%; }
      .quest-icon-fallback { color: #A961CC; }
      .quest-title { margin-top: 20px; max-width: 314px; font-family: "Instrument Serif", Georgia, serif;
        font-size: 32px; line-height: 40px; font-weight: 400; letter-spacing: .8px; overflow-wrap: anywhere; }
      .quest-description { margin-top: 12px; max-width: 314px; color: #696969; font-size: 17px; line-height: 24px; font-weight: 400; }
      .pills { display: flex; width: min(100%, 314px); justify-content: center; gap: 5px; margin-top: 24px; }
      .quest-pill { display: inline-flex; min-width: 0; min-height: 44px; align-items: center; justify-content: center; padding: 10px 16px;
        border: 1px solid #e4e2dd; border-radius: 200px; background: #fdfbf6; color: #292929; font-size: 14px;
        line-height: 20px; font-weight: 500; white-space: nowrap; box-shadow: 0 4px 30px rgba(255,255,255,.5); }
      .quest-pill:not(:last-child) { flex: 1 1 0; }
      .check-in-rule { display: flex; width: min(100%, 314px); min-height: 44px; align-items: center; justify-content: center;
        gap: 8px; margin-top: 16px; padding: 10px 24px; border: 1px solid #e4e2dd; border-radius: 32px;
        background: #fdfbf6; color: #292929; font-size: 14px; line-height: 20px; font-weight: 500;
        box-shadow: 0 4px 30px rgba(255,255,255,.5); }
      .check-in-rule .mdi { color: #292929; font-size: 18px; }
      .host { display: flex; min-width: 0; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; }
      .host-avatar { width: 24px; height: 24px; flex: 0 0 auto; border: 1px solid #ffffff; border-radius: 50%; object-fit: cover; }
      .host-initials { display: grid; place-items: center; background: #fdfbf6; color: var(--accent); font-size: 9px; font-weight: 700; }
      .host-name { min-width: 0; color: #292929; font-size: 14px; line-height: 20px; font-weight: 700; overflow-wrap: anywhere; }
      .host-meta { color: #696969; font-size: 14px; line-height: 20px; white-space: nowrap; }
      .join-panel { width: 100%; margin-top: 18px; padding: 0 4px; text-align: center;
        animation: fade-soft 0.6s var(--ease-out) 1.85s both; }
      .phone-row { display: flex; flex-direction: column; gap: 10px; }
      .phone-number-field { display: flex; align-items: center; min-height: 54px; border: 1px solid #e4e2dd; border-radius: 999px;
        background: #ffffff; padding: 0 22px;
        box-shadow: 0 4px 30px rgba(255,255,255,.5); }
      .phone-country-prefix { color: var(--title); font-size: 17px; flex-shrink: 0; }
      .phone-input { width: 100%; min-width: 0; min-height: 52px; border: 0; border-radius: 999px;
        background: transparent; color: var(--title); padding: 0 12px; font-size: 17px; text-align: center; outline: none; }
      .phone-input::placeholder { color: #9b9b95; }
      .phone-number-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
      .phone-input[aria-invalid="true"] { border-color: #b74040; }
      .join-button { width: 100%; min-height: 54px; border: 0; border-radius: 999px; background: var(--title); color: #ffffff;
        padding: 0 22px; font-size: 16px; font-weight: 700; cursor: pointer; }
      .join-button:disabled { cursor: default; opacity: .42; }
      .phone-error { margin-top: 9px; color: #a82f2f; font-size: 14px; line-height: 1.4; }
      .privacy { margin-top: 12px; color: #72726d; font-size: 11px; line-height: 1.5; }
      .privacy a { color: inherit; }
      #turnstile-container { min-height: 1px; }
      .success { padding: 13px 4px 3px; text-align: center; }
      .success-mark { width: 48px; height: 48px; display: grid; place-items: center; margin: 0 auto 10px; border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 14%, #ffffff); color: var(--accent); font-size: 25px; font-weight: 700; }
      .success h2 { font-size: 21px; }
      .dots span { display: inline-block; animation: dot-pulse 1.2s infinite; }
      .dots span:nth-child(2) { animation-delay: 0.2s; }
      .dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes dot-pulse { 0%, 60%, 100% { opacity: .2; } 30% { opacity: 1; } }
      .success p { margin-top: 5px; color: var(--body); font-size: 15px; }
      .open-app { display: block; margin: 26px auto 0; border: 0; background: transparent; color: #5e5e5a;
        font-size: 14px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
        width: fit-content; }
      .alternate-app { margin: 12px auto 0; text-align: center; color: #777771; font-size: 13px; }
      .alternate-app a { color: #5e5e5a; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
      .ended-panel { text-align: center; }
      .ended-mark { width: 50px; height: 50px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 14%, #ffffff); color: var(--accent); font-size: 24px; font-weight: 700; }
      .store-button { display: inline-flex; width: 100%; min-height: 54px; align-items: center; justify-content: center;
        padding: 0 22px; border-radius: 999px; background: var(--title); color: #ffffff; font-size: 16px;
        font-weight: 700; text-decoration: none; }
      footer { padding-top: 22px; text-align: center; color: #777771; font-size: 11px; }
      footer a { color: inherit; }
      .visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important;
        margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important; border: 0 !important; }
      [hidden] { display: none !important; }
      @media (max-width: 460px) {
        .page { width: min(calc(100% - 28px), 420px); }
        .field-icon { opacity: .25; }
      }
      @media (min-width: 700px) {
        .page { min-height: 100dvh; }
        .intro { margin-bottom: 40px; }
        .open-app { margin-top: auto; padding-top: 26px; }
        .join-panel + footer, .ended-panel ~ footer { margin-top: auto; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important;
          animation-duration: .01ms !important; animation-delay: 0s !important; }
      }
    </style>
  </head>
  <body>
    ${iconFieldMarkup()}
    <main class="page">
      <span class="wordmark">${WORDMARK}</span>
      <div class="reveal">
      <header class="intro">
        <h1>${pageHeadline}</h1>
      </header>

      <article class="quest-card" aria-label="${safeTitle}">
        ${coverMarkup(presentation)}
        <div class="quest-content">
          <div class="medallion">${questIconMarkup(presentation)}</div>
          <h2 class="quest-title">${safeTitle}</h2>
          ${presentation.shortDescription ? `<p class="quest-description">${escapeHtml(presentation.shortDescription)}</p>` : ""}
          <div class="pills">${pillMarkup(presentation)}</div>
          ${checkInRuleMarkup(presentation)}
          <div class="host">
            ${avatarMarkup(presentation)}
            <p class="host-name">${safeHost}</p>
            <p class="host-meta">${socialProof}</p>
          </div>
        </div>
      </article>

      ${actionPanel}
      </div>

      ${openAppSlot}

      <footer>
        <a href="https://thequestsapp.com/privacy.html">Privacy</a> &middot;
        <a href="https://thequestsapp.com/terms.html">Terms</a> &middot;
        &copy; 2026 Nothing Serious LLC
      </footer>
    </main>
    ${phoneScript ? `<script>${phoneScript}</script>` : ""}
  </body>
</html>`, 200, requestMethod);
}
