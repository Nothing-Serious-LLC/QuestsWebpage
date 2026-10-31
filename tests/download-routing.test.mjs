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
    const source = (await readFile(new URL('../js/device-download.mjs', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
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
    assert.equal(qr.hidden, Boolean(expected));
    assert.equal(link.href, expected || '/share');
  });
}

test('published download page loads the router and its QR avoids the previous cached page', async () => {
  const html = await readFile(new URL('../share.html', import.meta.url), 'utf8');
  assert.match(html, /<body data-download-page>/);
  assert.match(html, /type="module" src="\/js\/device-download.mjs"/);
  assert.doesNotMatch(html, /api\.qrserver\.com/);
  assert.equal(DOWNLOAD_PAGE_URL, 'https://thequestsapp.com/share?v=2');
  assert.equal(await readFile(new URL('../assets/img/download-qr.svg', import.meta.url), 'utf8'), qrSvg(DOWNLOAD_PAGE_URL));
  assert.ok(html.includes(APP_STORE_URL));
  assert.ok(html.includes(PLAY_STORE_URL));
});
