/**
 * Profile share routes (additive; quest /q/* routes are untouched).
 *
 *   GET /p/{code}           -> full-page Foundation Profile experience with
 *                              Open Graph metadata for messaging crawlers
 *   GET /p/{code}/og.png    -> 640x800 PNG proxied from the Supabase
 *                              profile-share-web Edge Function
 *
 * The share code is a 32-character lowercase hex string. The optional ?r=
 * query parameter pins an immutable artwork revision so messaging crawlers
 * can be given a fresh URL after a re-render.
 *
 * Required environment bindings (kept separate from the quest-invite
 * SUPABASE_* bindings so /p/* can target staging while /q/* stays on
 * production):
 *   PROFILE_SHARE_SUPABASE_URL   e.g. https://<project-ref>.supabase.co
 *   PROFILE_SHARE_WEB_SECRET     shared secret for profile-share-web
 */
import {
  STAGING_APP_SCHEME,
  isStagingShareHost,
} from '../q/appHandoffTargets.js';
import {
  ICON_CREATIVITY,
  ICON_GROWTH,
  ICON_MINDFULNESS,
  ICON_POINTS_STAR,
  ICON_RECHARGE,
  ICON_SOCIAL,
  ICON_STREAK_FIRE,
  WORDMARK,
} from './pageAssets.js';

const CODE_PATTERN = /^[0-9a-f]{32}$/;
const REVISION_PATTERN = /^[1-9][0-9]{0,9}$/;
const APP_STORE_URL = 'https://apps.apple.com/app/id6745767553';
const APP_STORE_ID = '6745767553';

// Foundation surface + inks (SHARED_TEMPLATE_LAYOUT / share card constants).
const SURFACE = '#f3f1e7';
const NAME_INK = '#292929';
const TITLE_INK = '#191919';
const CHIP_INK = '#5c5c5c';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join('') || 'Q';
}

function htmlResponse(markup, status) {
  return new Response(markup, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/**
 * Brand category icons scattered across the whole viewport, echoing the
 * share artifact's patterns sheet. Positions are viewport-relative so the
 * field expands with the screen.
 */
const ICON_FIELD = [
  { svg: ICON_GROWTH, size: 'clamp(56px, 8vw, 120px)', top: '4%', left: '6%', rotate: '-10deg' },
  { svg: ICON_CREATIVITY, size: 'clamp(44px, 6vw, 96px)', top: '9%', right: '8%', rotate: '12deg' },
  { svg: ICON_MINDFULNESS, size: 'clamp(48px, 7vw, 110px)', top: '38%', right: '3%', rotate: '9deg' },
  { svg: ICON_SOCIAL, size: 'clamp(40px, 5.5vw, 88px)', top: '46%', left: '2%', rotate: '7deg' },
  { svg: ICON_RECHARGE, size: 'clamp(48px, 6.5vw, 104px)', bottom: '12%', left: '7%', rotate: '10deg' },
  { svg: ICON_SOCIAL, size: 'clamp(64px, 9vw, 140px)', bottom: '-3%', left: '38%', rotate: '-6deg' },
  { svg: ICON_GROWTH, size: 'clamp(40px, 5vw, 80px)', bottom: '18%', right: '9%', rotate: '-8deg' },
  { svg: ICON_CREATIVITY, size: 'clamp(36px, 4.5vw, 72px)', top: '22%', left: '18%', rotate: '4deg' },
  { svg: ICON_MINDFULNESS, size: 'clamp(36px, 4.5vw, 72px)', bottom: '30%', right: '20%', rotate: '-5deg' },
  { svg: ICON_RECHARGE, size: 'clamp(32px, 4vw, 64px)', top: '14%', left: '42%', rotate: '8deg' },
];

function iconFieldMarkup() {
  return ICON_FIELD.map((icon) => {
    const position = ['top', 'bottom', 'left', 'right']
      .filter((edge) => icon[edge] !== undefined)
      .map((edge) => `${edge}:${icon[edge]};`)
      .join('');
    return `<span class="field-icon" aria-hidden="true" style="${position}width:${icon.size};height:${icon.size};transform:rotate(${icon.rotate});">${icon.svg}</span>`;
  }).join('\n      ');
}

function avatarMarkup({ avatarUrl, ringImageUrl, ringColors, displayName }) {
  const photo = avatarUrl
    ? `<img class="avatar-photo" src="${escapeHtml(avatarUrl)}" alt="" />`
    : `<span class="avatar-photo avatar-initials">${escapeHtml(displayInitials(displayName))}</span>`;
  let ring = '';
  if (ringImageUrl) {
    ring = `<img class="avatar-ring" src="${escapeHtml(ringImageUrl)}" alt="" />`;
  } else if (Array.isArray(ringColors) && ringColors.length > 0) {
    const stops = ringColors.length > 1
      ? ringColors.join(', ')
      : `${ringColors[0]}, ${ringColors[0]}`;
    ring = `<span class="avatar-ring avatar-ring-vector" style="background:linear-gradient(135deg, ${stops});"></span>`;
  }
  return `<div class="avatar-cluster">${photo}${ring}</div>`;
}

function unavailablePage() {
  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Profile unavailable - Quests</title>
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="${SURFACE}" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
             background: ${SURFACE}; color: ${NAME_INK}; font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif;
             position: relative; overflow: hidden; }
      .field-icon { position: absolute; opacity: 0.5; pointer-events: none; }
      .field-icon svg { width: 100%; height: 100%; }
      main { text-align: center; padding: 32px; position: relative; }
      .wordmark { width: 110px; margin: 0 auto 28px; display: block; }
      .wordmark svg { width: 100%; height: auto; }
      h1 { font-size: 24px; font-weight: 700; color: ${TITLE_INK}; margin-bottom: 10px; }
      p { font-size: 16px; margin-bottom: 28px; color: ${CHIP_INK}; }
      a.cta { display: inline-block; background: ${TITLE_INK}; color: #ffffff; text-decoration: none;
              font-weight: 700; font-size: 16px; padding: 15px 34px; border-radius: 999px; }
    </style>
  </head>
  <body>
    ${iconFieldMarkup()}
    <main>
      <span class="wordmark">${WORDMARK}</span>
      <h1>This Profile link is unavailable</h1>
      <p>The link may have been reset or turned off by its owner.</p>
      <a class="cta" href="${APP_STORE_URL}">Get Quests</a>
    </main>
  </body>
</html>`,
    404,
  );
}

async function callProfileShareWeb(env, action, shareCode, revision) {
  const supabaseUrl = (env.PROFILE_SHARE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const secret = (env.PROFILE_SHARE_WEB_SECRET || '').trim();
  if (!supabaseUrl || !secret) {
    return { status: 503, response: null };
  }
  const body = { action, shareCode };
  if (revision) {
    body.revision = Number(revision);
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/profile-share-web`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-profile-share-secret': secret,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, response };
}

function profilePage({ origin, shareCode, revision, metadata }) {
  // The staging host serves two clients (TestFlight/App Store on the
  // production scheme, the pure staging client on quests-staging), so it
  // offers both; the production host keeps its single link.
  const stagingHost = isStagingShareHost(new URL(origin).hostname);
  const stagingAppLink = stagingHost
    ? `
        <a class="secondary" href="${STAGING_APP_SCHEME}://p/${shareCode}">Using the staging build? Open it here</a>`
    : '';
  const safeName = escapeHtml(String(metadata.displayName || '').trim());
  const canonicalUrl = `${origin}/p/${shareCode}?r=${revision}`;
  const imageUrl = `${origin}/p/${shareCode}/og.png?r=${revision}`;
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeImage = escapeHtml(imageUrl);
  const title = `${safeName}'s Quests profile`;
  const description = 'View their profile and add them on Quests.';
  const points = Number(metadata.pointsTotal || 0).toLocaleString('en-US');
  const streak = Number(metadata.currentStreak || 0).toLocaleString('en-US');
  const imageWidth = Number.isSafeInteger(metadata.imageWidth) &&
      metadata.imageWidth > 0 && metadata.imageWidth <= 4096
    ? metadata.imageWidth
    : 1200;
  const imageHeight = Number.isSafeInteger(metadata.imageHeight) &&
      metadata.imageHeight > 0 && metadata.imageHeight <= 4096
    ? metadata.imageHeight
    : 630;

  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="${SURFACE}" />
    <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />
    <link rel="canonical" href="${safeCanonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Quests" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:width" content="${imageWidth}" />
    <meta property="og:image:height" content="${imageHeight}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${safeImage}" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { min-height: 100vh; min-height: 100dvh; }
      body { background: ${SURFACE}; color: ${NAME_INK};
             font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif;
             display: flex; align-items: center; justify-content: center;
             position: relative; overflow-x: hidden; }
      .field-icon { position: absolute; opacity: 0.5; pointer-events: none; z-index: 0; }
      .field-icon svg { width: 100%; height: 100%; }

      main { position: relative; z-index: 1; display: flex; flex-direction: column;
             align-items: center; text-align: center;
             padding: max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
             min-height: 100vh; min-height: 100dvh; width: 100%;
             justify-content: space-between; }

      .wordmark { width: clamp(96px, 12vw, 130px); display: block; }
      .wordmark svg { width: 100%; height: auto; display: block; }

      .hero { display: flex; flex-direction: column; align-items: center; flex: 1; justify-content: center; }

      .avatar-cluster { position: relative;
                        width: clamp(140px, 34vw, 220px); height: clamp(140px, 34vw, 220px);
                        display: flex; align-items: center; justify-content: center; }
      .avatar-photo { width: 88%; height: 88%; border-radius: 50%; object-fit: cover; display: flex; }
      .avatar-initials { background: #5C45B8; color: #ffffff; font-weight: 700;
                         font-size: clamp(44px, 11vw, 72px); align-items: center; justify-content: center; }
      .avatar-ring { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
      .avatar-ring-vector { border-radius: 50%;
        -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
                mask: radial-gradient(closest-side, transparent calc(100% - 7px), #000 calc(100% - 6px)); }

      h1 { margin-top: clamp(16px, 3vh, 26px); font-size: clamp(30px, 6vw, 44px);
           line-height: 1.15; font-weight: 600; letter-spacing: -0.3px; color: ${NAME_INK};
           max-width: min(88vw, 640px); overflow-wrap: anywhere; }
      .chips { display: flex; gap: 12px; margin-top: clamp(16px, 3vh, 24px); }
      .chip { display: flex; align-items: center; gap: 7px; background: #ffffff;
              border-radius: 999px; padding: 12px 18px;
              box-shadow: 0 5px 19px rgba(220, 220, 218, 0.35);
              font-size: clamp(17px, 2.6vw, 20px); font-weight: 500; color: ${CHIP_INK}; }
      .chip svg { width: clamp(20px, 3vw, 24px); height: clamp(20px, 3vw, 24px); }

      .actions { display: flex; flex-direction: column; gap: 14px; align-items: center;
                 margin-top: clamp(20px, 4vh, 36px); width: 100%; }
      a.cta { display: inline-block; background: ${TITLE_INK}; color: #ffffff; text-decoration: none;
              font-weight: 700; font-size: 17px; padding: 16px 40px; border-radius: 999px; }
      a.secondary { color: ${CHIP_INK}; font-size: 15px; font-weight: 500; text-decoration: underline; }

      @media (min-width: 900px) {
        .chips { gap: 16px; }
      }
    </style>
  </head>
  <body>
    ${iconFieldMarkup()}
    <main>
      <span class="wordmark">${WORDMARK}</span>
      <div class="hero">
        ${avatarMarkup({ ...metadata, displayName: metadata.displayName })}
        <h1>${safeName}</h1>
        <div class="chips">
          <span class="chip">${ICON_POINTS_STAR}<span>${points}</span></span>
          <span class="chip">${ICON_STREAK_FIRE}<span>${streak}</span></span>
        </div>
      </div>
      <div class="actions">
        <a class="cta" href="${APP_STORE_URL}">Get Quests</a>
        <a class="secondary" href="info.nothingserious.quests://p/${shareCode}">Open in the app</a>${stagingAppLink}
      </div>
    </main>
  </body>
</html>`,
    200,
  );
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const segments = Array.isArray(params.path)
    ? params.path
    : params.path
      ? [params.path]
      : [];

  if (segments.length < 1 || segments.length > 2) {
    return unavailablePage();
  }

  const shareCode = String(segments[0] || '').toLowerCase();
  if (!CODE_PATTERN.test(shareCode)) {
    return unavailablePage();
  }

  const wantsImage = segments.length === 2;
  if (wantsImage && segments[1] !== 'og.png') {
    return unavailablePage();
  }

  const url = new URL(request.url);
  const revisionParam = url.searchParams.get('r');
  const revision = revisionParam && REVISION_PATTERN.test(revisionParam)
    ? revisionParam
    : null;
  if (revisionParam && !revision) {
    return unavailablePage();
  }

  if (wantsImage) {
    const { status, response } = await callProfileShareWeb(env, 'image', shareCode, revision);
    if (status !== 200 || !response) {
      return new Response('Not found', {
        status: status === 503 ? 503 : 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const { status, response } = await callProfileShareWeb(env, 'metadata', shareCode, revision);
  if (status !== 200 || !response) {
    if (status === 503) {
      return new Response('Service unavailable', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return unavailablePage();
  }

  let metadata;
  try {
    metadata = await response.json();
  } catch {
    return unavailablePage();
  }
  const displayName = String(metadata.displayName || '').trim();
  const resolvedRevision = String(metadata.revision || '');
  if (!displayName || !REVISION_PATTERN.test(resolvedRevision)) {
    return unavailablePage();
  }

  return profilePage({
    origin: url.origin,
    shareCode,
    revision: resolvedRevision,
    metadata,
  });
}
