import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/api/download.js';
import { APP_STORE_URL, PLAY_STORE_URL, DOWNLOAD_PAGE_URL } from '../js/device-platform.mjs';

for (const [device, userAgent, destination] of [
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', APP_STORE_URL],
  ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0 Mobile/15E148 Safari/604.1', APP_STORE_URL],
  ['iPad', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', APP_STORE_URL],
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0 Mobile Safari/537.36', PLAY_STORE_URL],
  ['Samsung Internet', 'Mozilla/5.0 (Linux; Android 14; SM-S928B) SamsungBrowser/26.0 Chrome/122.0', PLAY_STORE_URL],
  ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'https://thequestsapp.com/share?v=3'],
  ['iPad desktop mode fallback', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'https://thequestsapp.com/share?v=3'],
  ['unknown device', '', 'https://thequestsapp.com/share?v=3'],
]) {
  test(`QR server redirect: ${device}`, async () => {
    const response = onRequest({ request: new Request(DOWNLOAD_PAGE_URL, { headers: { 'User-Agent': userAgent } }) });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), destination);
    assert.equal(await response.text(), '');
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.equal(response.headers.get('Vary'), 'User-Agent');
  });
}

test('HEAD supports link checks and query parameters cannot change destinations or forward data', async () => {
  const response = onRequest({ request: new Request(DOWNLOAD_PAGE_URL + '?url=https://example.com&phone=private&referrer=private', {
    method: 'HEAD', headers: { 'User-Agent': 'iPhone' },
  }) });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), APP_STORE_URL);
  assert.equal(await response.text(), '');
});

test('download endpoint rejects writes', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = onRequest({ request: new Request(DOWNLOAD_PAGE_URL, { method }) });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal(response.headers.get('Location'), null);
  }
});

test('download endpoint is covered by the existing Cloudflare function routes', async () => {
  const routes = JSON.parse(await readFile(new URL('../_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/api/*'));
  assert.ok(!routes.exclude.some(path => path.startsWith('/api')));
});
