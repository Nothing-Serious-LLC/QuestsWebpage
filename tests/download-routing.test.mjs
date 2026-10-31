import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { devicePlatform, downloadTarget, DOWNLOAD_PAGE_URL, APP_STORE_URL, PLAY_STORE_URL } from '../js/device-platform.mjs';
import { qrSvg } from '../js/qr-svg.mjs';

for (const [name, userAgent, touches, expected] of [
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1', 5, APP_STORE_URL],
  ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0 Mobile Safari/604.1', 5, APP_STORE_URL],
  ['iPad desktop mode', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, APP_STORE_URL],
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0 Mobile Safari/537.36', 5, PLAY_STORE_URL],
  ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, undefined],
]) {
  test(`download page routes ${name} after a QR scan`, async () => {
    const html = await readFile(new URL('../share.html', import.meta.url), 'utf8');
    const source = html.match(/<script id="download-redirect">([\s\S]*?)<\/script>/)[1];
    const link = { dataset: {}, removeAttribute() {} };
    const qr = { hidden: false };
    let destination;
    const context = vm.createContext({
      navigator: { userAgent, maxTouchPoints: touches }, devicePlatform, downloadTarget, DOWNLOAD_PAGE_URL,
      window: { location: { replace(url) { destination = url; } } },
      document: {
        documentElement: { dataset: {} }, body: { hasAttribute: () => true },
        querySelectorAll(selector) { return selector === '[data-store-link]' ? [link] : [qr]; },
        querySelector(selector) { return selector === '[data-legacy-invite-qr]' ? null : {}; },
      },
    });
    await new vm.Script(`(async () => {${source}})()`).runInContext(context);
    assert.equal(destination, expected);
    assert.equal(context.document.documentElement.dataset.device, expected === APP_STORE_URL ? 'ios' : expected === PLAY_STORE_URL ? 'android' : 'desktop');
  });
}

test('published download page retains fallback routing and its QR uses the server redirect', async () => {
  const html = await readFile(new URL('../share.html', import.meta.url), 'utf8');
  assert.match(html, /<body data-download-page>/);
  assert.match(html, /<script id="download-redirect">/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="(?:stylesheet|preload)"/);
  assert.ok(html.indexOf('<script id="download-redirect">') < html.indexOf('<style>'));
  assert.doesNotMatch(html, /api\.qrserver\.com/);
  assert.equal(DOWNLOAD_PAGE_URL, 'https://invite.thequestsapp.com/api/download');
  assert.match(html, /download-qr\.svg\?v=3/);
  assert.equal(await readFile(new URL('../assets/img/download-qr.svg', import.meta.url), 'utf8'), qrSvg(DOWNLOAD_PAGE_URL));
  assert.ok(html.includes(APP_STORE_URL));
  assert.ok(html.includes(PLAY_STORE_URL));
});
