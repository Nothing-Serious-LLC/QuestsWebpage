import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// A mounted provider form has no SDK expiry. The liveness watch re-reads the
// attempt while purchase() is pending and removes the form once the
// coordinator no longer holds it, or after ten idle minutes without a submit.
const source = readFileSync(new URL('../subscribe-app.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/\nrun\(\);\s*$/, '');

function harness({ inspect = async () => ({ ok: false, reason: 'purchase_pending' }) } = {}) {
  const element = () => ({ hidden: true, disabled: false, textContent: '', replaced: 0,
    classList: { add() {}, remove() {} }, setAttribute() {},
    replaceChildren() { this.replaced++; }, querySelector: () => null });
  const listeners = {};
  const mount = Object.assign(element(), {
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener(type) { delete listeners[type]; },
  });
  const ids = Object.fromEntries(['loading', 'loading-white', 'notice', 'notice-title',
    'notice-text', 'primary-btn', 'secondary-btn'].map(id => [id, element()]));
  ids['rc-checkout'] = mount;
  ids['rc-config'] = { textContent: JSON.stringify({ uid: 'test-user', apiKey: 'public-test-key',
    productId: 'monthly', plan: 'monthly', env: 'staging', scheme: 'quests-staging',
    claims: { attempt: 'test-attempt' }, sig: 'test-signature', entryRefusal: null }) };
  const actions = [], counts = { purchase: 0 };
  const timers = new Map(); let nextTimer = 1;
  let settlePurchase = null;
  const window = { location: { href: '', reload: () => { throw Error('Unexpected reload'); } } };
  const context = { document: { body: element(), getElementById: id => ids[id] || null,
    querySelector: () => element() }, window, console: { log() {} },
    setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class { observe() {} },
    createPriceNoticeEnhancer: () => () => {},
    ErrorCode: { UserCancelledError: 'cancelled', ProductAlreadyPurchasedError: 'already' },
    Purchases: { configure: () => ({
      getOfferings: async () => ({ current: { availablePackages: [
        { webBillingProduct: { identifier: 'monthly' } }] } }),
      purchase: () => { counts.purchase++; return new Promise((resolve, reject) => {
        settlePurchase = { resolve, reject }; }); } }) },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body); actions.push(body.action + (body.outcome ? ':' + body.outcome : ''));
      const result = body.action === 'inspect_web' ? await inspect()
        : body.action === 'validate_web' ? { ok: true } : { ok: true };
      return { ok: result.ok, json: async () => ({ reason: result.reason }) };
    } };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const run = async () => { runInNewContext(source + '\nrun();', context);
    for (let i = 0; i < 12; i++) await flush(); };
  // Fire pending timers with exactly this delay; the harness never advances a
  // real clock, so callers name the timer class they mean. The page's own
  // request timeouts (15s and 20s races) are never cleared by design and are
  // ignored here.
  const fire = async (ms) => {
    for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); await t.fn(); }
    for (let i = 0; i < 12; i++) await flush();
  };
  const watchTimers = () => [...timers.values()].map(t => t.ms).filter(ms => ms === 10000 || ms === 600000).sort((a, b) => a - b);
  return { run, ids, mount, counts, actions, window, timers, fire, listeners, watchTimers,
    purchase: () => settlePurchase };
}

test('form is watched only after the attempt is claimed and polls through inspect_web', async () => {
  const h = harness(); await h.run();
  assert.equal(h.counts.purchase, 1);
  assert.deepEqual(h.actions, ['validate_web']);
  assert.deepEqual(h.watchTimers(), [10000, 600000]);
  await h.fire(10000);
  assert.deepEqual(h.actions, ['validate_web', 'inspect_web']);
  // Still ours: the form stays mounted and the poll is re-armed.
  assert.equal(h.mount.replaced, 0);
  assert.deepEqual(h.watchTimers(), [10000, 600000]);
});

test('a retired attempt removes the mounted form before it can submit', async () => {
  const answers = [{ ok: false, reason: 'purchase_pending' }, { ok: false, reason: 'attempt_unavailable' }];
  const h = harness({ inspect: async () => answers.shift() }); await h.run();
  await h.fire(10000); await h.fire(10000);
  assert.equal(h.mount.replaced, 1);
  assert.equal(h.ids['notice-title'].textContent, 'Reopen checkout');
  assert.deepEqual(h.watchTimers(), [], 'poll and deadline are cleared');
  assert.deepEqual(h.listeners, {});
  // No release is sent: the coordinator already owns that row's terminal state.
  assert.deepEqual(h.actions, ['validate_web', 'inspect_web', 'inspect_web']);
  // A late SDK rejection from the detached form changes nothing on screen.
  h.purchase().reject(Object.assign(Error('detached'), { errorCode: 'cancelled' }));
  await h.fire(0);
  assert.equal(h.ids['notice-title'].textContent, 'Reopen checkout');
  assert.equal(h.actions.includes('finish_web:cancelled'), false);
  assert.equal(h.window.location.href, '');
});

test('Pro arriving from elsewhere closes the form with the already-subscribed notice', async () => {
  const h = harness({ inspect: async () => ({ ok: false, reason: 'already_subscribed' }) }); await h.run();
  await h.fire(10000);
  assert.equal(h.ids['notice-title'].textContent, 'You already have Quests Pro');
  assert.equal(h.mount.replaced, 1);
  assert.equal(h.window.location.href, '');
});

test('an offline poll keeps the form and keeps polling', async () => {
  const h = harness({ inspect: async () => { throw Error('offline'); } }); await h.run();
  await h.fire(10000);
  assert.equal(h.mount.replaced, 0);
  assert.deepEqual(h.watchTimers(), [10000, 600000]);
});

test('ten idle minutes without a submit releases the attempt and removes the form', async () => {
  const h = harness(); await h.run();
  await h.fire(600000);
  assert.deepEqual(h.actions, ['validate_web', 'finish_web:cancelled']);
  assert.equal(h.ids['notice-title'].textContent, 'Checkout timed out');
  assert.equal(h.mount.replaced, 1);
  assert.deepEqual(h.watchTimers(), []);
  assert.equal(h.window.location.href, '');
});

test('a submitted form is never removed by the watch and success still returns to the app', async () => {
  const h = harness({ inspect: async () => ({ ok: false, reason: 'attempt_unavailable' }) }); await h.run();
  h.listeners.submit({});
  assert.deepEqual(h.watchTimers(), [], 'watch stands down once payment is submitted');
  assert.deepEqual(h.listeners, {});
  await h.fire(600000);
  assert.equal(h.mount.replaced, 0);
  assert.deepEqual(h.actions, ['validate_web']);
  h.purchase().resolve({});
  await h.fire(0);
  assert.equal(h.ids['notice-title'].textContent, "You're Quests Pro!");
});

test('a Pay button click counts as a submit', async () => {
  const h = harness(); await h.run();
  h.listeners.click({ target: { closest: sel => (sel === 'button[type="submit"]' ? {} : null) } });
  assert.deepEqual(h.watchTimers(), []);
});

test('provider already-purchased rejection shows the subscribed notice and leaves the attempt pending', async () => {
  const h = harness(); await h.run();
  h.purchase().reject(Object.assign(Error('dup'), { errorCode: 'already' }));
  await h.fire(0);
  assert.equal(h.ids['notice-title'].textContent, 'You already have Quests Pro');
  assert.deepEqual(h.actions, ['validate_web']);
  assert.deepEqual(h.watchTimers(), []);
});

test('explicit SDK cancellation still releases exactly once and stops the watch', async () => {
  const h = harness(); await h.run();
  h.purchase().reject(Object.assign(Error('closed'), { errorCode: 'cancelled' }));
  await h.fire(0);
  assert.deepEqual(h.actions, ['validate_web', 'finish_web:cancelled']);
  assert.equal(h.ids['notice-title'].textContent, 'Checkout closed');
  assert.deepEqual(h.watchTimers(), []);
});
