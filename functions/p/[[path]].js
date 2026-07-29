/**
 * Profile share routes (additive; quest /q/* routes are untouched).
 *
 *   GET /p/{code}           -> server-rendered HTML with Open Graph metadata
 *   GET /p/{code}/og.png    -> 1200x630 PNG proxied from the Supabase
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

const CODE_PATTERN = /^[0-9a-f]{32}$/;
const REVISION_PATTERN = /^[1-9][0-9]{0,9}$/;
const APP_STORE_URL = 'https://apps.apple.com/app/id6745767553';
const APP_STORE_ID = '6745767553';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function unavailablePage() {
  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Profile unavailable - Quests</title>
    <meta name="robots" content="noindex,nofollow" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             background: #faf7f0; color: #1a1a1a; font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; }
      main { text-align: center; padding: 32px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      p { font-size: 16px; margin: 0 0 24px; color: #55524b; }
      a.cta { display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none;
              font-weight: 700; font-size: 16px; padding: 14px 28px; border-radius: 999px; }
    </style>
  </head>
  <body>
    <main>
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

function profilePage({ origin, shareCode, revision, displayName }) {
  const safeName = escapeHtml(displayName);
  const canonicalUrl = `${origin}/p/${shareCode}?r=${revision}`;
  const imageUrl = `${origin}/p/${shareCode}/og.png?r=${revision}`;
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeImage = escapeHtml(imageUrl);
  const title = `${safeName} on Quests`;
  const description = 'Add me on Quests, the social habit tracker.';

  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="#faf7f0" />
    <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />
    <link rel="canonical" href="${safeCanonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Quests" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${safeImage}" />
    <link rel="icon" type="image/png" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             background: #faf7f0; color: #1a1a1a; font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; }
      main { text-align: center; padding: 24px; max-width: 640px; width: 100%; }
      img.artwork { width: 100%; max-width: 560px; height: auto; border-radius: 20px;
                    box-shadow: 0 12px 32px rgba(26, 26, 26, 0.14); }
      .actions { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
      a.cta { display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none;
              font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 999px; }
      a.secondary { color: #55524b; font-size: 15px; text-decoration: underline; }
    </style>
  </head>
  <body>
    <main>
      <img class="artwork" src="${safeImage}" alt="${title}" width="1200" height="630" />
      <div class="actions">
        <a class="cta" href="${APP_STORE_URL}">Get Quests</a>
        <a class="secondary" href="info.nothingserious.quests://p/${shareCode}">Open in the app</a>
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
    displayName,
  });
}
