import { devicePlatform } from '../../js/device-platform.mjs';
import { androidInstallStoreUrl } from '../androidInstallReferrer.js';
import { normalizeQuestAppHandoff } from './questPage.js';

// The QR uses the associated /q/ path so installed apps receive the Quest.
// Only requests that reach the web server need a store fallback.
export function questDownloadHandoff({ request, shareCode, appHandoff }) {
  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/q/${shareCode}`;
  const handoff = normalizeQuestAppHandoff(appHandoff);
  const ios = handoff.appStoreUrl;
  const android = androidInstallStoreUrl(handoff.playStoreUrl, inviteUrl);
  const platform = devicePlatform({ userAgent: request.headers.get('User-Agent') });
  const headers = {
    'Cache-Control': 'private, no-store',
    Vary: 'User-Agent',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  };
  if (platform !== 'desktop') {
    return new Response(null, { status: 302, headers: {
      ...headers, Location: platform === 'ios' ? ios : android,
    } });
  }
  const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const html = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // iPads can use a desktop user agent. Resolve their touch capability in the
  // head, without waiting for assets, fonts, app data or another request.
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Quests</title>
<script>var p=(${devicePlatform.toString()})(navigator);if(p!=="desktop")location.replace(p==="ios"?${json(ios)}:${json(android)});</script>
<style>body{margin:0;padding:32px;font:16px/1.5 system-ui,sans-serif;color:#222;background:#fff}main{max-width:320px;margin:16vh auto}a{color:inherit}p{margin:12px 0}</style></head>
<body><main><p>Continue in Quests.</p><p><a href="${html(ios)}">App Store</a> · <a href="${html(android)}">Google Play</a></p><p><a href="${html(inviteUrl)}">View invitation</a></p></main></body></html>`;
  return new Response(request.method === 'HEAD' ? null : body, { headers: {
    ...headers, 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  } });
}
