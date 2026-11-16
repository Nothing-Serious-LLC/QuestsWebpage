import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';
import { devicePlatform, downloadTarget, APP_STORE_URL, PLAY_STORE_URL, DOWNLOAD_PAGE_URL } from '../js/device-platform.mjs';
import { qrSvg } from '../js/qr-svg.mjs';
import { questSharePage, questUnavailablePage } from '../functions/q/questPage.js';

for (const [userAgent, touches, platform, url] of [
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, 'ios', APP_STORE_URL],
  ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, 'ios', APP_STORE_URL],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, 'ios', APP_STORE_URL],
  ['Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5, 'android', PLAY_STORE_URL],
  ['Mozilla/5.0 (Linux; Android 14; Tablet)', 5, 'android', PLAY_STORE_URL],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, 'desktop', '/share'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 10, 'desktop', '/share'],
  ['Mozilla/5.0 (X11; Linux x86_64)', 0, 'desktop', '/share'],
  ['', 0, 'desktop', '/share'],
]) {
  test(`download routing: ${platform} / ${userAgent || 'unknown'}`, () => {
    const nav = { userAgent, maxTouchPoints: touches };
    assert.equal(devicePlatform(nav), platform);
    assert.equal(downloadTarget(nav), url);
  });
}

test('download QR is served locally and resolves through the device-neutral page', async () => {
  const svg = await readFile(new URL('../assets/img/download-qr.svg', import.meta.url), 'utf8');
  assert.equal(svg, qrSvg(DOWNLOAD_PAGE_URL));
  const html = await readFile(new URL('../share.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /api\.qrserver\.com/);
  assert.match(html, /data-download-page/);
  assert.match(html, /href="https:\/\/play.google.com\/store\/apps\/details/);
  assert.match(html, /href="https:\/\/apps.apple.com/);
});

test('all generic site Download controls have a device-neutral no-JavaScript fallback', async () => {
  const root = new URL('../', import.meta.url);
  for (const folder of ['', 'blog/']) {
    for (const file of await readdir(new URL(folder, root))) {
      if (!file.endsWith('.html')) continue;
      const html = await readFile(new URL(folder + file, root), 'utf8');
      const links = html.match(/<a\b[^>]*\bdata-store-link\b[^>]*>/g) || [];
      for (const link of links) assert.match(link, /href="\/share"/, folder + file);
      if (links.length) assert.match(html, /type="module" src="\/js\/device-download.mjs"/, folder + file);
    }
  }
});

test('phone-claim invitations start with a hidden Quest QR without a redundant invitation link', async () => {
  const presentation = JSON.parse(await readFile(new URL('fixtures/quest-share-community.json', import.meta.url)));
  for (const origin of ['https://invite.thequestsapp.com', 'https://invite-staging.thequestsapp.com']) {
    const html = await questSharePage({ origin, shareCode: 'JWfaB7wu', presentation }).text();
    assert.ok(html.includes(qrSvg(`${origin}/q/JWfaB7wu?download=1`)));
    assert.match(html, /id="desktop-handoff" tabindex="-1" hidden/);
    assert.doesNotMatch(html, /class="invitation-link"/);
    assert.match(html, /Continue on your phone/);
    assert.match(html, /data-device="desktop"/);
  }
  const ended = await questSharePage({ origin:'https://invite.thequestsapp.com',shareCode:'JWfaB7wu',presentation:{...presentation,availability:'ended',status:'COMPLETED'} }).text();
  assert.doesNotMatch(ended, /id="desktop-handoff"/);
  assert.doesNotMatch(ended, /id="phone-claim-form"/);
});


test('browser download module keeps desktop local and directs phones to the matching store', async () => {
  const source = (await readFile(new URL('../js/device-download.mjs', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
  for (const [userAgent, expected, platform] of [
    ['Mozilla/5.0 (Windows NT 10.0)', undefined, 'desktop'],
    ['Mozilla/5.0 (iPhone)', APP_STORE_URL, 'ios'],
    ['Mozilla/5.0 (Linux; Android 15)', PLAY_STORE_URL, 'android'],
  ]) {
    const generic = { dataset: {}, removeAttribute() {} };
    const bound = { dataset: { iosStore:'https://example.com/ios-build', androidStore:'https://example.com/android-build' }, removeAttribute() {} };
    const qr = { hidden: true };
    let destination;
    const context = vm.createContext({
      navigator:{userAgent}, devicePlatform, downloadTarget,
      window:{location:{replace(url) { destination=url; }}},
      document:{
        documentElement:{dataset:{}}, body:{hasAttribute:()=>true},
        querySelectorAll(selector) { return selector === '[data-store-link]' ? [generic,bound] : [qr]; },
        querySelector(selector) { return selector === '[data-legacy-invite-qr]' ? null : {}; },
      },
    });
    await new vm.Script(`(async () => {${source}})()`).runInContext(context);
    assert.equal(destination, expected);
    assert.equal(qr.hidden, platform !== 'desktop');
    assert.equal(generic.href, expected || '/share');
    assert.equal(bound.href, platform === 'desktop' ? '/share' : `https://example.com/${platform === 'ios' ? 'ios' : 'android'}-build`);
  }
});

test('ended and unavailable download controls retain environment-specific stores with desktop fallback', async () => {
  const presentation = JSON.parse(await readFile(new URL('fixtures/quest-share-community.json', import.meta.url)));
  const appHandoff = {appStoreUrl:'https://example.com/ios-build',playStoreUrl:'https://example.com/android-build'};
  const responses = [
    questUnavailablePage({appHandoff}),
    questSharePage({origin:'https://invite.thequestsapp.com',shareCode:'JWfaB7wu',presentation:{...presentation,availability:'ended',status:'COMPLETED'},appHandoff}),
  ];
  for (const response of responses) {
    const html = await response.text();
    assert.match(html, /href="\/share" data-store-link/);
    assert.match(html, /data-ios-store="https:\/\/example.com\/ios-build"/);
    assert.match(html, /data-android-store="https:\/\/example.com\/android-build"/);
    assert.match(html, /type="module" src="\/js\/device-download.mjs"/);
  }
});


test('app-only invitations retain the desktop QR when phone claims are unavailable', async () => {
  const presentation = JSON.parse(await readFile(new URL('fixtures/quest-share-community.json', import.meta.url)));
  const html = await questSharePage({origin:'https://invite.thequestsapp.com',shareCode:'JWfaB7wu',presentation,interactionMode:'app-only'}).text();
  assert.ok(html.includes(qrSvg('https://invite.thequestsapp.com/q/JWfaB7wu')));
  assert.match(html, /id="app-only-open"/);
  assert.doesNotMatch(html, /id="phone-claim-form"/);
});
