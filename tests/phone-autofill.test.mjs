import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { questPhoneClaimScript } from '../functions/q/phoneClaimScript.js';

function formHarness() {
  const elements = new Map();
  const requests = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', selectionStart: 0, listeners: {}, hidden: false,
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute() {}, focus() {},
      setSelectionRange(start) { this.selectionStart = start; },
    });
    return elements.get(id);
  }
  const context = {
    document: { getElementById: element },
    window: { location: {}, addEventListener() {} }, navigator: { userAgent: 'desktop' },
    turnstile: { render(_element, options) { options.callback('test-token'); return 1; }, reset() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, status: 200, json: async () => ({ status: 'PENDING' }), headers: { get() {} } };
    },
  };
  vm.runInNewContext(questPhoneClaimScript({
    shareCode: 'AbCd2345', turnstileSiteKey: 'test-key',
    appHandoff: { appScheme: 'quests-staging', androidPackage: 'test', appStoreUrl: 'https://example.com', playStoreUrl: 'https://example.com' },
  }), context);
  const input = element('phone-input');
  return {
    input, requests, element,
    enter(value) { input.value = value; input.selectionStart = value.length; input.listeners.input(); },
    async submit() {
      element('phone-claim-form').listeners.submit({ preventDefault() {} });
      await new Promise(resolve => setImmediate(resolve));
    },
  };
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
