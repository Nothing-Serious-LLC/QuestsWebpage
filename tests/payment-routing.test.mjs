import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/subscribe.js';
import { onRequestPost } from '../functions/subscribe/check.js';
import { checkCheckout } from '../functions/subscribe/policy.js';
const claims = { version: 2, uid: '00000000-0000-4000-8000-000000000001', attempt: '00000000-0000-4000-8000-000000000002', exp: Math.floor(Date.now()/1000)+120, plan: 'monthly', env: 'staging', appscheme: 'quests-staging', storefront: 'USA' };
const sig = 'a'.repeat(64);
const env = { PAYMENT_BACKEND_ENVIRONMENT: 'staging' };
const request = () => new Request('https://checkout.example/subscribe?' + new URLSearchParams({ ...claims, sig }));

test('missing deployment binding or tampered billing environment cannot reach a backend', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}'); });
  assert.equal(await checkCheckout({}, claims, sig, 'inspect_web'), false);
  assert.equal(await checkCheckout(env, {...claims, env: 'production'}, sig, 'inspect_web'), false);
  assert.equal(calls, 0);
});
test('stale signed page is closed when the live kill switch is off or unavailable', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status:403}));
  const response = await onRequestGet({ request: request(), env });
  assert.equal((await response.text()).includes('id="rc-config"'), false);
});
test('allowed checkout passes signed claims to the browser without losing plan or identity', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://dswtlvkjthzgpsgtfvwx.supabase.co/functions/v1/sign-upgrade-link');
    assert.deepEqual(JSON.parse(options.body), {action:'inspect_web',claims,sig});
    return new Response('{"allowed":true}');
  });
  const response = await onRequestGet({ request: request(), env });
  const html = await response.text();
  const config = JSON.parse(html.match(/id="rc-config">(.*?)<\/script>/s)[1]);
  assert.deepEqual(config.claims, claims);
  assert.equal(config.productId, 'quests_pro_monthly');
  assert.equal(config.sig, sig);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
});
test('initiation rechecks the backend and preserves a duplicate/pending rejection', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).action, 'validate_web');
    return new Response('{"error":"purchase_pending"}',{status:409});
  });
  const response = await onRequestPost({ env, request: new Request('https://checkout.example/subscribe/check', {
    method:'POST',body:JSON.stringify({action:'validate_web',claims,sig})}) });
  assert.equal(response.status,409);
});
test('network failure fails closed at initiation', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal(await checkCheckout(env, claims, sig, 'validate_web'), false);
});
