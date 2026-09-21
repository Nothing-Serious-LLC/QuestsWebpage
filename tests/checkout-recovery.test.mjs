import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../subscribe-app.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/\nrun\(\);\s*$/, '');

function harness({ entryRefusal = null, inspect = async () => ({ ok: true, reason: null }) } = {}) {
  const element = () => ({ hidden: true, disabled: false, textContent: '',
    classList: { add() {}, remove() {} }, setAttribute() {}, replaceChildren() {},
    querySelector: () => null });
  const ids = Object.fromEntries(['rc-checkout', 'loading', 'loading-white', 'notice',
    'notice-title', 'notice-text', 'primary-btn', 'secondary-btn'].map(id => [id, element()]));
  ids['rc-config'] = { textContent: JSON.stringify({ uid: 'test-user', apiKey: 'public-test-key',
    productId: 'monthly', plan: 'monthly', env: 'staging', scheme: 'quests-staging',
    claims: { attempt: 'test-attempt' }, sig: 'test-signature', entryRefusal }) };
  const actions = [], counts = { configure: 0, purchase: 0 };
  const window = { location: { href: '', reload: () => { throw Error('Unexpected reload'); } } };
  const context = { document: { body: element(), getElementById: id => ids[id] || null,
    querySelector: () => element() }, window, console: { log() {} },
    setTimeout() {}, MutationObserver: class { observe() {} },
    createPriceNoticeEnhancer: () => () => {}, ErrorCode: { UserCancelledError: 'cancelled' },
    Purchases: { configure: () => {
      counts.configure++;
      return { getOfferings: async () => ({ current: { availablePackages: [
        { webBillingProduct: { identifier: 'monthly' } }] } }),
        purchase: async () => { counts.purchase++; throw Error('Connection lost after confirmation'); } };
    } },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body); actions.push(body.action);
      const result = body.action === 'validate_web' ? { ok: true } : await inspect();
      return { ok: result.ok, json: async () => ({ reason: result.reason }) };
    } };
  const run = () => runInNewContext(source + '\nrun();', context);
  return { run, ids, counts, actions, window };
}

for (const reason of ['already_subscribed', 'purchase_pending']) {
  test(`entry refusal ${reason} never initializes a payment operation`, async () => {
    const h = harness({ entryRefusal: reason }); await h.run();
    assert.deepEqual(h.counts, { configure: 0, purchase: 0 });
    assert.deepEqual(h.actions, []);
    assert.equal(h.ids['primary-btn'].textContent,
      reason === 'already_subscribed' ? 'Return to Quests' : 'Check again');
    assert.equal(h.window.location.href, '');
  });
}

test('ambiguous payment recovery checks status without starting another purchase', async () => {
  let settle;
  const h = harness({ inspect: () => new Promise(resolve => { settle = resolve; }) });
  await h.run();
  assert.equal(h.ids['primary-btn'].textContent, 'Check again');
  const first = h.ids['primary-btn'].onclick();
  await h.ids['primary-btn'].onclick();
  assert.equal(h.ids['primary-btn'].disabled, true);
  assert.deepEqual(h.actions, ['validate_web', 'inspect_web']);
  settle({ ok: true }); await first;
  assert.equal(h.counts.purchase, 1);
  assert.equal(h.ids['primary-btn'].disabled, false);
  assert.equal(h.ids['primary-btn'].textContent, 'Check again');
  assert.equal(h.window.location.href, '');
});

test('confirmed entitlement offers an app return without granting access in the browser', async () => {
  const h = harness({ inspect: async () => ({ ok: false, reason: 'already_subscribed' }) });
  await h.run(); await h.ids['primary-btn'].onclick();
  assert.equal(h.ids['notice-title'].textContent, 'You already have Quests Pro');
  assert.equal(h.window.location.href, '');
  h.ids['primary-btn'].onclick();
  assert.equal(h.window.location.href, '/subscribe/return?scheme=quests-staging&to=home');
  assert.equal(h.counts.purchase, 1);
});

test('an offline status check can be retried locally and never reports payment success', async () => {
  const h = harness({ inspect: async () => { throw Error('offline'); } });
  await h.run(); await h.ids['primary-btn'].onclick();
  assert.match(h.ids['notice-text'].textContent, /couldn't check your purchase/);
  assert.equal(h.ids['primary-btn'].disabled, false);
  assert.equal(h.ids['primary-btn'].textContent, 'Check again');
  assert.equal(h.ids['secondary-btn'].hidden, false);
  assert.equal(h.counts.purchase, 1);
  assert.equal(h.window.location.href, '');
});
