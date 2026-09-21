import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { onRequestGet } from '../functions/subscribe/return.js';

// Execute the actual success handler with browser navigation captured.
const source = readFileSync(new URL('../subscribe-app.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/\nrun\(\);\s*$/, '');
for (const scheme of ['quests-staging', 'info.nothingserious.quests']) {
  test(`automatic and manual success return preserve ${scheme}`, async () => {
    const element = () => ({ hidden: true, textContent: '', classList: { add() {}, remove() {} }, setAttribute() {} });
    const ids = Object.fromEntries(['loading','loading-white','notice','notice-title','notice-text','primary-btn','secondary-btn'].map(id => [id,element()]));
    ids['rc-config'] = { textContent: JSON.stringify({ scheme }) };
    const window = { location: { href: '' } };
    const timers = [];
    const document = { body: element(), getElementById: id => ids[id] || null, querySelector: () => element() };
    runInNewContext(source + '\nshowSuccess();', { document, window, setTimeout: (fn,ms) => timers.push({fn,ms}) });
    const expected = '/subscribe/return?scheme=' + encodeURIComponent(scheme) + '&to=pro-upgrade-success';
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 150);
    timers[0].fn();
    assert.equal(window.location.href, expected);
    window.location.href = '';
    ids['primary-btn'].onclick();
    assert.equal(window.location.href, expected);
    const response = await onRequestGet({ request: new Request('https://checkout.example' + expected) });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), scheme + '://pro-upgrade-success');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });
}
test('return redirect rejects destinations outside the app allowlist', async () => {
  for (const query of ['scheme=https&to=pro-upgrade-success','scheme=quests-staging&to=other','scheme=quests-staging%3A%2F%2Fevil&to=home']) {
    const response = await onRequestGet({request: new Request('https://checkout.example/subscribe/return?' + query)});
    assert.equal(response.status,400);
    assert.equal(response.headers.get('Location'),null);
  }
});
