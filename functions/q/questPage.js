import {
  ICON_CREATIVITY,
  ICON_GROWTH,
  ICON_MINDFULNESS,
  ICON_RECHARGE,
  ICON_SOCIAL,
  WORDMARK,
} from "../p/pageAssets.js";
import { questPhoneClaimScript } from "./phoneClaimScript.js";

const SURFACE = "#f3f1e7";
const TITLE_INK = "#191919";
const BODY_INK = "#4f4f4f";
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

function formatStartDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function pillMarkup(presentation) {
  const pills = [];
  if (presentation.privacyLevel === "PRIVATE") pills.push("Private");
  if (presentation.privacyLevel === "PUBLIC") pills.push("Public");
  if (presentation.duration) pills.push(presentation.duration);
  const categoryLabels = {
    recharge_move: "Recharge & Move",
    social_lifestyle: "Social & Lifestyle",
    mindfulness: "Mindfulness",
    creativity: "Creativity",
    productivity: "Productivity",
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
  let rule = cadence;
  if (/^daily$/i.test(cadence)) rule = "Check in daily";
  else if (/^weekly$/i.test(cadence)) rule = "Check in weekly";
  else if (/^every\b/i.test(cadence)) rule = `Check in ${cadence.toLowerCase()}`;
  else if (!/^check in\b/i.test(cadence)) rule = `Check in ${cadence.toLowerCase()}`;
  return `<div class="check-in-rule"><span class="mdi mdi-calendar-check-outline" aria-hidden="true"></span><span>${escapeHtml(rule)}</span></div>`;
}

function participantLabel(count) {
  if (count === 0) return "Be the first to join";
  if (count === 1) return "1 person is doing this Quest";
  return `${count.toLocaleString("en-US")} people are doing this Quest`;
}

function questIconMarkup(presentation) {
  if (!presentation.icon) {
    return `<span class="quest-icon-fallback" aria-hidden="true">Q</span>`;
  }
  return `<span class="mdi mdi-${presentation.icon}" aria-hidden="true"></span>`;
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

export function normalizeQuestAppHandoff(value = {}) {
  const appScheme = /^[A-Za-z][A-Za-z0-9+.-]{0,63}$/.test(String(value.appScheme || ""))
    ? String(value.appScheme)
    : DEFAULT_APP_HANDOFF.appScheme;
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
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" />
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
      <h1>This Quest link is unavailable</h1>
      <p>The Quest may have ended, expired, or been canceled.</p>
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
  requestMethod = "GET",
}) {
  const handoff = normalizeQuestAppHandoff(appHandoff);
  const revision = presentation.revision;
  const revisionQuery = revision > 0 ? `?r=${revision}` : "";
  const canonicalUrl = `${origin}/q/${shareCode}${revisionQuery}`;
  const imageUrl = `${origin}/q/${shareCode}/og.png${revisionQuery}`;
  const pageTitle = presentation.availability === "ended"
    ? `${presentation.title} has ended | Quests`
    : `Join ${presentation.title} on Quests`;
  const pageDescription = presentation.shortDescription ||
    `${presentation.hostDisplayName} invited you to join a Quest.`;
  const safeTitle = escapeHtml(presentation.title);
  const safeHost = escapeHtml(presentation.hostDisplayName);
  const safeDescription = escapeHtml(pageDescription);
  const accent = presentation.iconColor ?? "#765BC4";
  const socialProof = escapeHtml(participantLabel(presentation.participantCount));
  const isEnded = presentation.availability === "ended";
  const statusLabel = isEnded
    ? "Ended Quest"
    : presentation.status === "UPCOMING"
      ? "Upcoming Quest"
      : "Active Quest";
  const startLabel = formatStartDate(presentation.startDate);
  const statusSupportingLabel = presentation.status === "UPCOMING" && startLabel
    ? `${statusLabel} · Starts ${startLabel}`
    : statusLabel;
  const shareHeadline = isEnded ? "This Quest has ended" : "You've been invited to a Quest";
  const phoneScript = isEnded
    ? ""
    : questPhoneClaimScript({ shareCode, turnstileSiteKey, appHandoff: handoff });
  const turnstileScript = isEnded
    ? ""
    : `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
  const actionPanel = isEnded
    ? `<section class="join-panel ended-panel" aria-labelledby="ended-heading">
        <div class="ended-mark" aria-hidden="true">&#10003;</div>
        <h2 id="ended-heading">This Quest is complete</h2>
        <p>Explore Quests to find another challenge or start your own.</p>
        <a class="store-button" href="${escapeHtml(handoff.appStoreUrl)}">Get Quests</a>
      </section>`
    : `<section class="join-panel" aria-labelledby="join-heading">
        <h2 id="join-heading">Join this Quest</h2>
        <p>Enter your phone number and Quests will keep this invitation ready for you.</p>
        <form id="phone-claim-form" novalidate>
          <div class="phone-row">
            <label class="visually-hidden" for="phone-input">Phone number</label>
            <input id="phone-input" class="phone-input" type="tel" inputmode="tel" autocomplete="tel"
              placeholder="+1 (555) 000-0000" aria-describedby="phone-error phone-privacy" />
            <button id="join-quest-button" class="join-button" type="submit" disabled>
              <span id="join-quest-label">Join Quest</span>
            </button>
          </div>
          <p id="phone-error" class="phone-error" role="alert" aria-live="polite" hidden></p>
          <p id="phone-privacy" class="privacy">Your number is securely matched to connect this invitation after sign-in.
            By continuing, you agree to the <a href="https://thequestsapp.com/privacy.html">Privacy Policy</a> and
            <a href="https://thequestsapp.com/terms.html">Terms of Service</a>.</p>
          <div id="turnstile-container"></div>
        </form>
        <div id="claim-success" class="success" role="status" aria-live="polite" tabindex="-1" hidden>
          <div class="success-mark" aria-hidden="true">&#10003;</div>
          <h2>Your invitation is saved</h2>
          <p>Continue in Quests with this phone number to join.</p>
        </div>
        <button id="open-app-link" class="open-app" type="button">I already have the app</button>
      </section>`;

  return response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="${SURFACE}" />
    <meta name="apple-itunes-app" content="app-id=${handoff.appStoreId}, app-argument=${escapeHtml(canonicalUrl)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${shareHeadline}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Quests" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Invitation to ${safeTitle}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${shareHeadline}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" />
    <link href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css" rel="stylesheet" />
    ${turnstileScript}
    <style>
      :root { --accent: ${accent}; --surface: ${SURFACE}; --title: ${TITLE_INK}; --body: ${BODY_INK}; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { min-height: 100%; }
      body { min-height: 100vh; min-height: 100dvh; background: var(--surface); color: var(--title);
        font-family: "Manrope", -apple-system, "Segoe UI", sans-serif; overflow-x: hidden; }
      button, input { font: inherit; }
      .field-icon { position: fixed; opacity: .42; pointer-events: none; z-index: 0; }
      .field-icon svg { display: block; width: 100%; height: 100%; }
      .page { position: relative; z-index: 1; width: min(100%, 660px); margin: 0 auto; padding:
        max(26px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom)); }
      .wordmark { display: block; width: 112px; margin: 0 auto 28px; }
      .wordmark svg { display: block; width: 100%; height: auto; }
      .intro { text-align: center; margin: 0 auto 22px; }
      .eyebrow { color: #62625f; font-size: 15px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; }
      .intro h1 { margin-top: 8px; font-size: clamp(30px, 7vw, 43px); line-height: 1.1; letter-spacing: -.8px; }
      .quest-card { position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,.9); border-radius: 34px;
        background: #ffffff; background: color-mix(in srgb, var(--accent) 16%, #ffffff); box-shadow: 0 24px 68px rgba(85,82,70,.17);
        text-align: center; }
      .quest-cover { width: 100%; height: clamp(170px, 36vw, 220px); overflow: hidden; }
      .quest-cover img { width: 100%; height: 100%; display: block; object-fit: cover; }
      .quest-content { display: flex; flex-direction: column; align-items: center; padding: 30px clamp(22px, 6vw, 42px) 32px; }
      .quest-cover + .quest-content { padding-top: 0; }
      .medallion { width: 86px; height: 86px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%;
        background: #ffffff; border: 3px solid var(--accent); color: var(--accent); font-size: 43px;
        box-shadow: 0 8px 24px rgba(62,57,44,.16); }
      .quest-cover + .quest-content .medallion { margin-top: -43px; }
      .quest-icon-fallback { font-size: 31px; font-weight: 700; }
      .status { margin-top: 17px; font-size: 14px; line-height: 1.4; font-weight: 700; color: #65655f; }
      .quest-title { margin-top: 7px; max-width: 520px; font-size: clamp(29px, 7vw, 42px); line-height: 1.08;
        letter-spacing: -.7px; overflow-wrap: anywhere; }
      .quest-description { margin-top: 13px; max-width: 500px; color: var(--body); font-size: 17px; line-height: 1.52; }
      .pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 9px; margin-top: 22px; }
      .quest-pill { display: inline-flex; min-height: 42px; align-items: center; padding: 9px 15px; border: 1px solid rgba(43,43,43,.08);
        border-radius: 999px; background: rgba(255,255,255,.88); color: #50504d; font-size: 15px; font-weight: 700;
        box-shadow: 0 5px 15px rgba(86,80,61,.08); }
      .check-in-rule { display: flex; width: min(100%, 430px); min-height: 46px; align-items: center; justify-content: center;
        gap: 8px; margin-top: 11px; padding: 10px 16px; border: 1px solid rgba(43,43,43,.08); border-radius: 17px;
        background: rgba(255,255,255,.76); color: #50504d; font-size: 15px; font-weight: 700; }
      .check-in-rule .mdi { color: var(--accent); font-size: 20px; }
      .host { display: flex; align-items: center; gap: 12px; width: min(100%, 430px); margin-top: 25px; padding-top: 22px;
        border-top: 1px solid rgba(49,49,45,.11); text-align: left; }
      .host-avatar { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 50%; object-fit: cover; }
      .host-initials { display: grid; place-items: center; background: var(--accent); color: #ffffff; font-size: 16px; font-weight: 700; }
      .host-copy { min-width: 0; }
      .host-name { font-size: 16px; line-height: 1.35; font-weight: 700; overflow-wrap: anywhere; }
      .host-meta { margin-top: 2px; color: #65655f; font-size: 14px; line-height: 1.4; }
      .join-panel { width: min(100%, 540px); margin: 22px auto 0; padding: 22px; border-radius: 28px;
        background: rgba(255,255,255,.82); box-shadow: 0 15px 42px rgba(85,82,70,.12); backdrop-filter: blur(10px); }
      .join-panel h2 { font-size: 21px; line-height: 1.25; }
      .join-panel > p { margin-top: 6px; color: var(--body); font-size: 15px; line-height: 1.5; }
      .phone-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 17px; }
      .phone-input { width: 100%; min-width: 0; min-height: 54px; border: 1px solid #d7d5cd; border-radius: 17px;
        background: #ffffff; color: var(--title); padding: 0 16px; font-size: 17px; outline: none; }
      .phone-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
      .phone-input[aria-invalid="true"] { border-color: #b74040; }
      .join-button { min-height: 54px; border: 0; border-radius: 17px; background: var(--title); color: #ffffff;
        padding: 0 21px; font-size: 16px; font-weight: 700; cursor: pointer; }
      .join-button:disabled { cursor: default; opacity: .42; }
      .phone-error { margin-top: 9px; color: #a82f2f; font-size: 14px; line-height: 1.4; }
      .privacy { margin-top: 12px; color: #72726d; font-size: 12px; line-height: 1.5; }
      .privacy a { color: inherit; }
      #turnstile-container { min-height: 1px; }
      .success { padding: 13px 4px 3px; text-align: center; }
      .success-mark { width: 48px; height: 48px; display: grid; place-items: center; margin: 0 auto 10px; border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 14%, #ffffff); color: var(--accent); font-size: 25px; font-weight: 700; }
      .success h2 { font-size: 21px; }
      .success p { margin-top: 5px; color: var(--body); font-size: 15px; }
      .open-app { display: block; margin: 16px auto 0; border: 0; background: transparent; color: #5e5e5a;
        font-size: 14px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .ended-panel { text-align: center; }
      .ended-mark { width: 50px; height: 50px; display: grid; place-items: center; margin: 0 auto 12px; border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 14%, #ffffff); color: var(--accent); font-size: 24px; font-weight: 700; }
      .store-button { display: inline-flex; min-height: 52px; align-items: center; justify-content: center; margin-top: 18px;
        padding: 0 27px; border-radius: 17px; background: var(--title); color: #ffffff; font-size: 16px;
        font-weight: 700; text-decoration: none; }
      footer { padding-top: 24px; text-align: center; color: #777771; font-size: 12px; }
      footer a { color: inherit; }
      .visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important;
        margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important; border: 0 !important; }
      [hidden] { display: none !important; }
      @media (max-width: 560px) {
        .page { padding-left: 14px; padding-right: 14px; }
        .field-icon { opacity: .25; }
        .quest-card { border-radius: 28px; }
        .phone-row { grid-template-columns: 1fr; }
        .join-button { width: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
      }
    </style>
  </head>
  <body>
    ${iconFieldMarkup()}
    <main class="page">
      <span class="wordmark">${WORDMARK}</span>
      <header class="intro">
        <p class="eyebrow">Quest invitation</p>
        <h1>${shareHeadline}</h1>
      </header>

      <article class="quest-card" aria-label="${safeTitle}">
        ${coverMarkup(presentation)}
        <div class="quest-content">
          <div class="medallion">${questIconMarkup(presentation)}</div>
          <p class="status">${statusSupportingLabel}</p>
          <h2 class="quest-title">${safeTitle}</h2>
          ${presentation.shortDescription ? `<p class="quest-description">${escapeHtml(presentation.shortDescription)}</p>` : ""}
          <div class="pills">${pillMarkup(presentation)}</div>
          ${checkInRuleMarkup(presentation)}
          <div class="host">
            ${avatarMarkup(presentation)}
            <div class="host-copy">
              <p class="host-name">${safeHost}</p>
              <p class="host-meta">${socialProof}</p>
            </div>
          </div>
        </div>
      </article>

      ${actionPanel}

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
