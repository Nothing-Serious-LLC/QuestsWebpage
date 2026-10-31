import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { onRequest } from '../functions/q/[[path]].js';
import { APP_STORE_URL, PLAY_STORE_URL } from '../js/device-platform.mjs';

const origin = 'https://invite.thequestsapp.com';
const invite = `${origin}/q/JWfaB7wu`;
function context(userAgent, { method = 'GET', originOverride = origin, extra = '', env = {}, path = ['JWfaB7wu'] } = {}) {
  return {
    request: new Request(`${originOverride}/q/${path.join('/')}?download=1${extra}`, { method, headers: { 'User-Agent': userAgent } }),
    params: { path }, env: { ...env, ASSETS: { fetch() { return new Response('Legacy page'); } } },
  };
}
for (const ua of ['iPhone Safari', 'iPhone CriOS', 'iPad']) {
  test(`invitation QR redirects ${ua} before page or provider loading`, async () => {
    const r = await onRequest(context(ua));
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('Location'), APP_STORE_URL);
    assert.equal(await r.text(), '');
    assert.match(r.headers.get('Cache-Control'), /no-store/);
    assert.equal(r.headers.get('Vary'), 'User-Agent');
  });
}
for (const ua of ['Android Chrome', 'Android SamsungBrowser']) {
  test(`invitation QR retains the original Quest through ${ua} installation`, async () => {
    const r = await onRequest(context(ua, { extra: '&phone=private&next=https://evil.example&r=9' }));
    assert.equal(r.status, 302);
    const url = new URL(r.headers.get('Location'));
    assert.equal(url.origin + url.pathname, 'https://play.google.com/store/apps/details');
    assert.equal(url.searchParams.get('id'), 'info.nothingserious.quests');
    const referrer = new URLSearchParams(url.searchParams.get('referrer'));
    assert.equal(referrer.get('quests_link_v1'), invite);
    assert.doesNotMatch(url.href, /private|evil|download/);
    assert.equal(await r.text(), '');
  });
}
test('staging keeps the original host and configured Android package', async () => {
  const r = await onRequest(context('Android', { originOverride: 'https://invite-staging.thequestsapp.com', env: {
    QUEST_SHARE_ANDROID_STORE_URL: `${PLAY_STORE_URL}.staging`,
  } }));
  const url = new URL(r.headers.get('Location'));
  assert.equal(url.searchParams.get('id'), 'info.nothingserious.quests.staging');
  assert.equal(new URLSearchParams(url.searchParams.get('referrer')).get('quests_link_v1'), 'https://invite-staging.thequestsapp.com/q/JWfaB7wu');
});
test('desktop-mode iPad redirects from a self-contained minimal fallback', async () => {
  const r = await onRequest(context('Macintosh'));
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.doesNotMatch(html, /<script[^>]+src=|<link|<img|turnstile|phone-claim/);
  let target;
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    navigator: { userAgent: 'Macintosh', maxTouchPoints: 5 },
    location: { replace(url) { target = url; } },
  });
  assert.equal(target, APP_STORE_URL);
  target = undefined;
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    navigator: { userAgent: 'Macintosh', maxTouchPoints: 0 },
    location: { replace(url) { target = url; } },
  });
  assert.equal(target, undefined);
  assert.match(html, /View invitation/);
});
test('handoff supports HEAD, rejects writes, and validates the invitation path', async () => {
  for (const ua of ['iPhone', 'Desktop']) {
    const r = await onRequest(context(ua, { method: 'HEAD' }));
    assert.equal(await r.text(), '');
  }
  assert.equal((await onRequest(context('iPhone', { method: 'POST' }))).status, 405);
  const invalid = await onRequest(context('iPhone', { path: ['invalid0'] }));
  assert.equal(invalid.headers.get('Location'), null);
  assert.equal(await invalid.text(), 'Legacy page');
});
