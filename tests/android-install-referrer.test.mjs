import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { androidInstallStoreUrl } from '../functions/androidInstallReferrer.js';
import { profileAndroidTargets } from '../functions/p/androidTargets.js';
import { questSharePage } from '../functions/q/questPage.js';
import { normalizeQuestSharePresentation } from '../functions/q/questSharePresentation.js';

const origin = 'https://invite.thequestsapp.com';
const staging = 'https://invite-staging.thequestsapp.com';
const play = 'https://play.google.com/store/apps/details?id=info.nothingserious.quests';
const apple = 'https://apps.apple.com/app/id6745767553';
const questApple = 'https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553';
const profile = '0123456789abcdef0123456789abcdef';
function payload(url) {
  return new URLSearchParams(new URL(url).searchParams.get('referrer')).get('quests_link_v1');
}
for (const share of [`${origin}/q/mXdY7ea7`, `${origin}/p/${profile}?r=2`]) {
  test(`Play URL carries the exact share through nested URL encoding: ${share}`, () => {
    const url = androidInstallStoreUrl(play, share);
    assert.equal(new URL(url).searchParams.get('id'), 'info.nothingserious.quests');
    assert.equal(payload(url), share);
  });
}
test('preserves existing campaign attribution and store-listing parameters', () => {
  const input = `${play}&listing=referral&referrer=${encodeURIComponent('utm_source=friend&utm_campaign=fall')}`;
  const url = new URL(androidInstallStoreUrl(input, `${origin}/q/mXdY7ea7`));
  const referrer = new URLSearchParams(url.searchParams.get('referrer'));
  assert.equal(url.searchParams.get('listing'), 'referral');
  assert.equal(referrer.get('utm_source'), 'friend');
  assert.equal(referrer.get('utm_campaign'), 'fall');
  assert.equal(referrer.get('quests_link_v1'), `${origin}/q/mXdY7ea7`);
});
test('keeps staging context out of a production install, and supports matching staging installs', () => {
  assert.equal(androidInstallStoreUrl(play, `${staging}/q/mXdY7ea7`), play);
  assert.equal(payload(androidInstallStoreUrl(`${play}.staging`, `${staging}/q/mXdY7ea7`)), `${staging}/q/mXdY7ea7`);
});
for (const share of [
  `${origin}/q/invalid0`, `${origin}/p/invalid`, `${origin}/q/mXdY7ea7/extra`,
  `${origin}/q/../q/mXdY7ea7`, `${origin}/q%2FmXdY7ea7`, `${origin}/q/mXdY7ea7#x`,
  `${origin}/p/${profile}?r=1&r=2`, `${origin}/q/mXdY7ea7?next=evil`,
  'https://evil.example/q/mXdY7ea7', 'https://user@invite.thequestsapp.com/q/mXdY7ea7',
  'http://invite.thequestsapp.com/q/mXdY7ea7',
]) {
  test(`does not synthesize recovery for untrusted share ${share}`, () => {
    assert.equal(androidInstallStoreUrl(play, share), play);
  });
}
test('retains unsupported stores and oversized campaign payloads unchanged', () => {
  for (const store of [apple, `${play}&id=other`, `${play}&referrer=a&referrer=b`, `${play}&referrer=${'x'.repeat(512)}`]) {
    assert.equal(androidInstallStoreUrl(store, `${origin}/q/mXdY7ea7`), store);
  }
});
test('profile Android Open fallback and Get Quests use the same referrer, while iOS stays unchanged', () => {
  const url = `${origin}/p/${profile}?r=2`;
  const android = profileAndroidTargets(new Request(url, { headers: { 'User-Agent': 'Android' } }), profile, 2);
  assert.equal(payload(android.storeUrl), url);
  const fallback = android.openUrl.match(/S.browser_fallback_url=(.*);end$/)[1];
  assert.equal(decodeURIComponent(fallback), android.storeUrl);
  assert.deepEqual(profileAndroidTargets(new Request(url, { headers: { 'User-Agent': 'iPhone' } }), profile, 2), { storeUrl: apple });
});

async function generatedQuestScript() {
  const raw = JSON.parse(await readFile(new URL('./fixtures/quest-share-upcoming.json', import.meta.url), 'utf8'));
  const presentation = normalizeQuestSharePresentation(raw, { supabaseUrl: 'https://project.supabase.co' });
  const html = await (questSharePage({ origin, shareCode: 'mXdY7ea7', presentation, interactionMode: 'phone-demo' })).text();
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('var shareCode ='));
}
function clickOpen(script, platform) {
  const elements = new Map();
  const timers = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, setAttribute() {} });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: element, addEventListener() {}, visibilityState: 'visible' },
    window: { location: {}, addEventListener() {} }, navigator: { userAgent: platform },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    setInterval() {}, clearInterval() {},
  };
  vm.runInNewContext(script, context);
  element('open-app-link').listeners.click({ preventDefault() {} });
  return { context, timers };
}
test('the rendered Quest Android button delivers the referrer in its actual browser intent', async () => {
  const { context } = clickOpen(await generatedQuestScript(), 'Android');
  const intent = context.window.location.href;
  assert.ok(intent.startsWith('intent://q/mXdY7ea7#Intent;scheme=info.nothingserious.quests;package=info.nothingserious.quests;'));
  assert.equal(payload(decodeURIComponent(intent.match(/S.browser_fallback_url=(.*);end$/)[1])), `${origin}/q/mXdY7ea7`);
});
test('the rendered Quest iOS and desktop buttons retain their scheme/store behavior', async () => {
  const script = await generatedQuestScript();
  const ios = clickOpen(script, 'iPhone');
  assert.equal(ios.context.window.location.href, 'info.nothingserious.quests://q/mXdY7ea7');
  ios.timers.shift()();
  assert.equal(ios.context.window.location.href, questApple);
  assert.equal(clickOpen(script, 'Desktop').context.window.location.href, questApple);
});
