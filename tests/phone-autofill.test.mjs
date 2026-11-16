import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { questPhoneClaimScript } from '../functions/q/phoneClaimScript.js';

function formHarness({ userAgent = 'iPhone', maxTouchPoints = 1, responseStatus = 200, responseBody, hasToken = true, demoMode = false, fetchFails = false } = {}) {
  const elements = new Map();
  const requests = [];
  const timers = [];
  const timerDelays = [];
  let challenges = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', selectionStart: 0, listeners: {}, hidden: id === 'desktop-handoff' || id === 'claim-success',
      addEventListener(name, fn) { this.listeners[name] = fn; },
      style: {}, classes: new Set(),
      classList: {add(name) { element(id).classes.add(name); }},
      getBoundingClientRect() { return {height:160}; },
      attributes: {}, setAttribute(name, value) { this.attributes[name] = String(value); }, focus() {},
      setSelectionRange(start) { this.selectionStart = start; },
    });
    return elements.get(id);
  }
  const context = {
    document: { getElementById: element },
    window: { location: {}, addEventListener() {} }, navigator: { userAgent, maxTouchPoints },
    turnstile: { render(_element, options) { challenges += 1; if (hasToken) options.callback('test-token'); return 1; }, reset() {} },
    setTimeout(fn, delay) { timers.push(fn); timerDelays.push(delay); }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (fetchFails) throw new TypeError('network down');
      const body = responseBody ?? (responseStatus === 200 ? { status: 'PENDING' } : { error: 'quest_unavailable' });
      return { ok: responseStatus === 200, status: responseStatus, json: async () => body, headers: { get() {} } };
    },
  };
  vm.runInNewContext(questPhoneClaimScript({
    shareCode: 'AbCd2345', turnstileSiteKey: 'test-key', demoMode,
    appHandoff: { appScheme: 'quests-staging', androidPackage: 'test', appStoreUrl: 'https://example.com/ios', playStoreUrl: 'https://example.com/android' },
  }), context);
  const input = element('phone-input');
  return {
    input, requests, element, timers, timerDelays, context, challenges: () => challenges,
    enter(value) { input.value = value; input.selectionStart = value.length; input.listeners.input(); },
    async submit() {
      element('phone-claim-form').listeners.submit({ preventDefault() {} });
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test('desktop shows its QR only after a valid successful phone claim', async () => {
  const h = formHarness({userAgent:'Desktop',maxTouchPoints:0});
  assert.equal(h.element('phone-claim-form').hidden, false);
  assert.equal(h.element('desktop-handoff').hidden, true);
  assert.equal(h.element('open-app-link').hidden, true);
  h.enter('20255501');
  await h.submit();
  assert.equal(h.requests.length, 0);
  assert.equal(h.element('desktop-handoff').hidden, true);
  h.enter('2025550142');
  await h.submit();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.phone, '+12025550142');
  assert.equal(h.element('phone-claim-form').hidden, true);
  assert.equal(h.element('desktop-handoff').hidden, false);
  assert.equal(h.element('claim-success').hidden, true);
  assert.equal(h.element('quest-stage').classes.has('is-complete'), true);
  assert.equal(h.element('quest-card-front').inert, true);
  assert.equal(h.element('quest-join-panel').style.minHeight, '160px');
  assert.equal(h.timers.length, 0);
  assert.equal(h.context.window.location.href, undefined);
});

for (const options of [{responseStatus:403},{responseStatus:429},{hasToken:false}]) {
  test(`desktop keeps QR hidden when the claim cannot succeed: ${JSON.stringify(options)}`, async () => {
    const h = formHarness({userAgent:'Desktop',...options});
    h.enter('2025550142');
    await h.submit();
    assert.equal(h.element('desktop-handoff').hidden, true);
    assert.equal(h.element('phone-claim-form').hidden, false);
    assert.equal(h.element('phone-error').hidden, false);
    assert.equal(h.element('quest-stage').classes.has('is-complete'), false);
    assert.equal(h.context.window.location.href, undefined);
  });
}

test('a Join error about the number outlines the field in red', async () => {
  const h = formHarness({ responseStatus: 400, responseBody: { error: 'invalid_phone' } });
  h.enter('2025550142');
  assert.equal(h.input.attributes['aria-invalid'], 'false');
  await h.submit();
  assert.equal(h.requests.length, 1);
  assert.equal(h.element('phone-error').textContent, 'Enter a valid phone number.');
  assert.equal(h.element('phone-error').hidden, false);
  assert.equal(h.input.attributes['aria-invalid'], 'true');
  h.enter('(202) 555-014');
  assert.equal(h.input.attributes['aria-invalid'], 'false');
  assert.equal(h.element('phone-error').hidden, true);
});

test('typing an incomplete number leaves the field unmarked until Join', async () => {
  const h = formHarness();
  for (const value of ['2', '202555', '202555014']) {
    h.enter(value);
    assert.equal(h.input.attributes['aria-invalid'], 'false');
  }
  await h.submit();
  assert.equal(h.requests.length, 0);
  assert.equal(h.element('phone-error').textContent, 'Enter a valid 10-digit phone number.');
  assert.equal(h.input.attributes['aria-invalid'], 'true');
});

for (const [name, options, message] of [
  ['a rate limit', { responseStatus: 429, responseBody: { error: 'rate_limited', retryAfter: 300 } }, 'Too many attempts. Try again in 5 minutes.'],
  ['a failed verification', { responseStatus: 403, responseBody: { error: 'turnstile_failed' } }, 'Verification failed. Try again.'],
  ['an unavailable Quest', { responseStatus: 409, responseBody: { error: 'quest_unavailable' } }, 'This Quest is unavailable.'],
  ['a missing Quest', { responseStatus: 404, responseBody: { error: 'quest_not_found' } }, 'This Quest is unavailable.'],
  ['a service outage', { responseStatus: 503, responseBody: { error: 'service_unavailable' } }, 'Joining is temporarily unavailable. Try again.'],
  ['a server error', { responseStatus: 500, responseBody: { error: 'internal_error' } }, 'Something went wrong. Try again.'],
  ['a network failure', { fetchFails: true }, 'Something went wrong. Try again.'],
  ['a verification still loading', { hasToken: false }, 'Verification is getting ready. Try again in a moment.'],
]) {
  test(`${name} shows its message and leaves the number unmarked`, async () => {
    const h = formHarness(options);
    h.enter('2025550142');
    await h.submit();
    assert.equal(h.element('phone-error').textContent, message);
    assert.equal(h.element('phone-error').hidden, false);
    assert.equal(h.input.attributes['aria-invalid'], 'false');
  });
}

test('local desktop demo previews the QR without a signup request or store redirect', async () => {
  const h = formHarness({userAgent:'Desktop',demoMode:true});
  h.enter('2025550142');
  await h.submit();
  assert.equal(h.element('desktop-handoff').hidden, false);
  assert.equal(h.requests.length, 0);
  assert.equal(h.challenges(), 0);
  assert.equal(h.timers.length, 0);
});

for (const [userAgent, maxTouchPoints, destination] of [['iPhone', 1, 'ios'], ['Android', 1, 'android'], ['Macintosh', 5, 'ios']]) {
  test(`successful ${userAgent} claim keeps the correct store handoff`, async () => {
    const h = formHarness({ userAgent, maxTouchPoints });
    h.enter('4155552671');
    await h.submit();
    assert.equal(h.requests.length, 1);
    assert.equal(h.element('phone-claim-form').hidden, true);
    assert.equal(h.element('claim-success').hidden, false);
    assert.equal(h.element('desktop-handoff').hidden, true);
    assert.equal(h.element('quest-stage').classes.has('is-complete'), false);
    assert.equal(h.context.window.location.href, undefined);
    assert.deepEqual(h.timerDelays, [1600]);
    h.timers.forEach(fn => fn());
    assert.equal(h.context.window.location.href, `https://example.com/${destination}`);
  });
}

for (const text of ['4155552671', '14155552671', '+14155552671', '+1 (415) 555-2671', '(415) 555-2671']) {
  test(`autofill ${text} displays local digits and sends one country code`, async () => {
    const h = formHarness();
    h.enter(text);
    assert.equal(h.input.value, '(415) 555-2671');
    assert.equal(h.element('join-quest-button').disabled, false);
    await h.submit();
    assert.deepEqual(h.requests, [{ url: '/api/link-claims/start', body: {
      shareCode: 'AbCd2345', phone: '+14155552671', turnstileToken: 'test-token',
    } }]);
  });
}

test('replacement autofill and backspace keep the intended digits', () => {
  const h = formHarness();
  h.enter('+1 (415) 555-2671');
  h.enter('14155552671');
  assert.equal(h.input.value, '(415) 555-2671');
  for (let remaining = 9; remaining >= 0; remaining -= 1) {
    h.enter(h.input.value.slice(0, -1));
    assert.equal(h.input.value.replace(/\D/g, '').length, remaining);
  }
  assert.equal(h.input.value, '');
});

test('incomplete input is retained and extra digits cannot submit or disappear', async () => {
  const h = formHarness();
  for (const value of ['1', '1415', '+114155552671', '24155552671', '415555267199']) {
    h.enter(value);
    assert.equal(h.input.value.replace(/\D/g, ''), value.replace(/\D/g, ''));
    assert.equal(h.element('join-quest-button').disabled, true);
    await h.submit();
  }
  assert.equal(h.requests.length, 0);
});

test('legacy fallback uses the same complete-number normalization', async () => {
  const html = await readFile(new URL('../q/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function stripNonDigits(');
  const end = html.indexOf('/*', html.indexOf('function normalizeToE164(', start));
  const context = vm.createContext({});
  vm.runInContext(html.slice(start, end), context);
  for (const input of ['4155552671', '14155552671', '+1 (415) 555-2671']) {
    assert.equal(context.formatPhoneDisplay(input), '(415) 555-2671');
    assert.equal(context.normalizeToE164(input), '+14155552671');
  }
  assert.equal(context.getInputDigits('1'), '1');
  assert.equal(context.normalizeToE164('+114155552671'), null);
  assert.equal(context.getInputDigits('415555267199'), '415555267199');
  assert.match(html, /class="phone-country-prefix" aria-hidden="true">\+1<\/span>/);
});
