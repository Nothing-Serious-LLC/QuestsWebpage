import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet, onRequest as subscribeRequest } from '../functions/subscribe.js';
import { onRequestPost, onRequest as checkRequest } from '../functions/subscribe/check.js';
import { askBackend, checkCheckout, checkoutClaims, deploymentEnvironment, sanitizeClaims } from '../functions/subscribe/policy.js';

const STAGING = 'https://dswtlvkjthzgpsgtfvwx.supabase.co/functions/v1/sign-upgrade-link';
const PRODUCTION = 'https://bltogjnxwvybhyfaivtw.supabase.co/functions/v1/sign-upgrade-link';
const claims = { version: 2, uid: '00000000-0000-4000-8000-000000000001', attempt: '00000000-0000-4000-8000-000000000002', exp: Math.floor(Date.now() / 1000) + 120, plan: 'monthly', env: 'staging', appscheme: 'quests-staging', storefront: 'USA' };
const prodClaims = { ...claims, env: 'production', appscheme: 'info.nothingserious.quests' };
const sig = 'a'.repeat(64);
const env = { PAYMENT_BACKEND_ENVIRONMENT: 'staging' };
const prodEnv = { PAYMENT_BACKEND_ENVIRONMENT: 'production' };
const pageRequest = (c = claims, s = sig) => new Request('https://checkout.example/subscribe?' + new URLSearchParams({ ...c, sig: s }));
const checkCall = (body, e = env) => onRequestPost({ env: e, request: new Request('https://checkout.example/subscribe/check', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) });
const isFallback = (html) => html.includes('Open the app to upgrade') && !html.includes('id="rc-config"');
const configOf = (html) => JSON.parse(html.match(/id="rc-config">(.*?)<\/script>/s)[1]);
const allow = () => new Response('{"allowed":true}');
const refuse = (status, error) => new Response(JSON.stringify({ error }), { status });

// --- deployment binding ------------------------------------------------------

test('binding accepts only the two paired environments', () => {
  assert.equal(deploymentEnvironment({ PAYMENT_BACKEND_ENVIRONMENT: 'staging' }), 'staging');
  assert.equal(deploymentEnvironment({ PAYMENT_BACKEND_ENVIRONMENT: 'production' }), 'production');
  for (const value of [undefined, '', 'Staging', 'preview', 'constructor', '__proto__', 'toString']) {
    assert.equal(deploymentEnvironment({ PAYMENT_BACKEND_ENVIRONMENT: value }), null, String(value));
  }
  assert.equal(deploymentEnvironment(undefined), null);
});

test('missing deployment binding or tampered billing environment cannot reach a backend', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return allow(); });
  assert.equal(await checkCheckout({}, claims, sig, 'inspect_web'), false);
  assert.equal(await checkCheckout(env, { ...claims, env: 'production' }, sig, 'inspect_web'), false);
  assert.equal(await checkCheckout(prodEnv, claims, sig, 'inspect_web'), false);
  assert.equal(calls, 0);
});

test('unbound deployment serves the fallback page for a valid link', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return allow(); });
  for (const e of [{}, { PAYMENT_BACKEND_ENVIRONMENT: 'preview' }]) {
    assert.ok(isFallback(await (await onRequestGet({ request: pageRequest(), env: e })).text()));
  }
  assert.equal(calls, 0);
});

test('a production deployment never serves the sandbox route, whatever the URL says', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return allow(); });
  const html = await (await onRequestGet({ request: pageRequest(claims), env: prodEnv })).text();
  assert.ok(isFallback(html));
  assert.equal(html.includes('rcb_sb_'), false);
  assert.equal(calls, 0);
});

test('the binding, never the URL, selects the backend and the publishable key', async t => {
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url) => { seen.push(url); return allow(); });
  const staging = configOf(await (await onRequestGet({ request: pageRequest(), env })).text());
  const production = configOf(await (await onRequestGet({ request: pageRequest(prodClaims), env: prodEnv })).text());
  assert.deepEqual(seen, [STAGING, PRODUCTION]);
  assert.ok(staging.apiKey.startsWith('rcb_sb_'));
  assert.equal(staging.env, 'staging');
  assert.ok(production.apiKey.startsWith('rcb_') && !production.apiKey.startsWith('rcb_sb_'));
  assert.equal(production.env, 'production');
  assert.equal(production.scheme, 'info.nothingserious.quests');
});

// --- page entry --------------------------------------------------------------

test('allowed checkout passes signed claims to the browser without losing plan or identity', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, STAGING);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { action: 'inspect_web', claims, sig });
    return allow();
  });
  const response = await onRequestGet({ request: pageRequest(), env });
  const config = configOf(await response.text());
  assert.deepEqual(config.claims, claims);
  assert.equal(config.uid, claims.uid);
  assert.equal(config.productId, 'quests_pro_monthly');
  assert.equal(config.plan, 'monthly');
  assert.equal(config.scheme, 'quests-staging');
  assert.equal(config.sig, sig);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});

test('plan maps to the verified Web Billing products', async t => {
  t.mock.method(globalThis, 'fetch', async () => allow());
  const yearly = configOf(await (await onRequestGet({ request: pageRequest({ ...claims, plan: 'yearly' }), env })).text());
  assert.equal(yearly.productId, 'quests_pro_annual');
  assert.equal(yearly.plan, 'yearly');
  assert.ok(isFallback(await (await onRequestGet({ request: pageRequest({ ...claims, plan: 'lifetime' }), env })).text()));
});

test('malformed, legacy and unsigned links reach the fallback page without a backend call', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return allow(); });
  const legacy = new Request('https://checkout.example/subscribe?' + new URLSearchParams({ uid: claims.uid, exp: String(claims.exp), sig, plan: 'monthly', env: 'staging' }));
  const cases = [
    new Request('https://checkout.example/subscribe'),
    legacy,
    pageRequest({ ...claims, version: 1 }),
    pageRequest({ ...claims, uid: 'not-a-uuid' }),
    pageRequest({ ...claims, attempt: 'not-a-uuid' }),
    pageRequest({ ...claims, appscheme: 'evil-scheme' }),
    pageRequest(claims, 'short'),
    pageRequest(claims, 'A'.repeat(64)),
  ];
  for (const request of cases) {
    assert.ok(isFallback(await (await onRequestGet({ request, env })).text()), request.url);
  }
  assert.equal(calls, 0);
});

test('expired or tampered links are decided by the backend and close the page', async t => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => { bodies.push(JSON.parse(options.body)); return refuse(401, 'invalid_checkout'); });
  const expired = { ...claims, exp: Math.floor(Date.now() / 1000) - 60 };
  const swappedPlan = { ...claims, plan: 'yearly' };
  const swappedUser = { ...claims, uid: '00000000-0000-4000-8000-0000000000ff' };
  for (const c of [expired, swappedPlan, swappedUser]) {
    assert.ok(isFallback(await (await onRequestGet({ request: pageRequest(c), env })).text()));
  }
  // The website forwards exactly what it received, so the backend sees the tampering.
  assert.deepEqual(bodies.map(b => b.claims), [expired, swappedPlan, swappedUser]);
});

test('stale signed page is closed when the live kill switch is off or unavailable', async t => {
  for (const response of [() => refuse(403, 'web_checkout_disabled'), () => refuse(503, 'checkout_unavailable'), () => { throw new Error('offline'); }]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response());
    assert.ok(isFallback(await (await onRequestGet({ request: pageRequest(), env })).text()));
    mock.mock.restore();
  }
});

test('existing subscriber and pending purchase close page entry', async t => {
  for (const error of ['already_subscribed', 'purchase_pending']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => refuse(409, error));
    assert.ok(isFallback(await (await onRequestGet({ request: pageRequest(), env })).text()));
    mock.mock.restore();
  }
});

test('subscribe accepts GET and HEAD only', async () => {
  const response = await subscribeRequest({ request: new Request('https://checkout.example/subscribe', { method: 'POST' }), env });
  assert.equal(response.status, 405);
});

// --- initiation gate ---------------------------------------------------------

test('initiation claims the attempt through the paired backend', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, STAGING);
    assert.deepEqual(JSON.parse(options.body), { action: 'validate_web', claims, sig });
    return allow();
  });
  const response = await checkCall({ action: 'validate_web', claims, sig });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { allowed: true, reason: null });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('kill switch flipped after page load stops initiation', async t => {
  t.mock.method(globalThis, 'fetch', async () => refuse(403, 'web_checkout_disabled'));
  const response = await checkCall({ action: 'validate_web', claims, sig });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { allowed: false, reason: 'web_checkout_disabled' });
});

test('initiation rechecks the backend and preserves a duplicate/pending rejection', async t => {
  let first = true;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).action, 'validate_web');
    if (first) { first = false; return allow(); }
    return refuse(409, 'purchase_pending');
  });
  assert.equal((await checkCall({ action: 'validate_web', claims, sig })).status, 200);
  const duplicate = await checkCall({ action: 'validate_web', claims, sig });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).reason, 'purchase_pending');
});

test('network failure and backend outage fail closed at initiation', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal(await checkCheckout(env, claims, sig, 'validate_web'), false);
  const response = await checkCall({ action: 'validate_web', claims, sig });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).allowed, false);
  mock.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => refuse(503, 'provider_unavailable'));
  assert.deepEqual(await askBackend(env, claims, sig, 'validate_web'), { allowed: false, reason: 'checkout_unavailable' });
});

test('environment mismatch at the gate never reaches a backend', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return allow(); });
  assert.equal((await checkCall({ action: 'validate_web', claims, sig }, prodEnv)).status, 409);
  assert.equal((await checkCall({ action: 'validate_web', claims, sig }, {})).status, 409);
  assert.equal(calls, 0);
});

test('only explicit cancellation can be reported, and it releases through the backend', async t => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => { bodies.push(JSON.parse(options.body)); return new Response('{"state":"cancelled"}'); });
  assert.equal((await checkCall({ action: 'finish_web', outcome: 'cancelled', claims, sig })).status, 200);
  for (const outcome of ['completed', 'failed', 'timeout', undefined]) {
    assert.equal((await checkCall({ action: 'finish_web', outcome, claims, sig })).status, 400, String(outcome));
  }
  assert.deepEqual(bodies, [{ action: 'finish_web', claims, sig, outcome: 'cancelled' }]);
});

test('the gate rejects actions and bodies outside its contract without a backend call', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return allow(); });
  const bad = [
    { action: 'inspect_web', claims, sig },
    { action: 'begin', claims, sig },
    { action: 'status', claims, sig },
    { action: 'validate_web', sig },
    { action: 'validate_web', claims: 'x', sig },
    { action: 'validate_web', claims: { ...claims, exp: '123' }, sig },
    { action: 'validate_web', claims: { ...claims, uid: 'u'.repeat(65) }, sig },
    'not json',
    '[]',
    JSON.stringify({ action: 'validate_web', claims, sig, pad: 'x'.repeat(5000) }),
  ];
  for (const body of bad) assert.ok([400, 413].includes((await checkCall(body)).status));
  assert.equal((await checkCall({ action: 'validate_web', claims, sig: 'zz' })).status, 409);
  assert.equal(calls, 0);
  const get = await checkRequest({ env, request: new Request('https://checkout.example/subscribe/check') });
  assert.equal(get.status, 405);
});

test('gate forwards only the signed claim keys', async t => {
  let forwarded;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { forwarded = JSON.parse(options.body); return allow(); });
  await checkCall({ action: 'validate_web', claims: { ...claims, route: 'native', admin: true }, sig });
  assert.deepEqual(forwarded.claims, claims);
  assert.deepEqual(sanitizeClaims(checkoutClaims(new URLSearchParams({ ...claims }))), claims);
});

// --- deployment wiring and browser contract ------------------------------------

test('Pages routes the check endpoint to Functions', () => {
  const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url)));
  for (const path of ['/subscribe', '/subscribe/check', '/subscribe/return']) assert.ok(routes.include.includes(path), path);
});

test('website source holds no signing secret and honors no env URL override', () => {
  const source = readFileSync(new URL('../functions/subscribe.js', import.meta.url), 'utf8') +
    readFileSync(new URL('../functions/subscribe/policy.js', import.meta.url), 'utf8') +
    readFileSync(new URL('../functions/subscribe/check.js', import.meta.url), 'utf8');
  assert.equal(/RC_UPGRADE_SIGNING_SECRET|crypto\.subtle/.test(source.replace(/^\s*\/\/.*$/gm, '')), false);
});

test('browser module gates before purchase and retains pending state on ambiguous failure', () => {
  const source = readFileSync(new URL('../subscribe-app.js', import.meta.url), 'utf8');
  const gate = source.indexOf('checkoutGate("validate_web")');
  const purchase = source.indexOf('purchases.purchase(');
  assert.ok(gate > 0 && purchase > gate, 'validate_web must precede purchases.purchase');
  assert.equal(source.slice(gate, purchase).includes('getOfferings'), false, 'nothing slow between the gate and the provider call');
  // Cancellation is the single release path and is tied to the SDK error code.
  assert.equal(source.split('checkoutGate("finish_web"').length - 1, 1);
  assert.ok(/ErrorCode\.UserCancelledError[\s\S]{0,120}checkoutGate\("finish_web", "cancelled"\)/.test(source));
  // No lifecycle or timer path reports an outcome.
  assert.equal(/pagehide|beforeunload|visibilitychange|sendBeacon/.test(source), false);
  // Retry is offered only before the attempt is claimed.
  assert.equal(source.slice(gate).includes('retry: true'), false);
  // Returns go through the server redirect that the app handles.
  assert.ok(source.includes('"/subscribe/return?scheme="'));
});
