import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceNoticeEnhancer } from '../subscribe-notices.js';

const original = 'The total price was updated with tax based on your billing address. Please review and try again. Your card will only be charged once.';
function harness(messageText = original) {
  const text = value => ({ childNodes: [{ nodeType: 3, nodeValue: value }], get textContent() { return this.childNodes[0].nodeValue; } });
  const title = text('Price update'), message = text(messageText);
  let hidden = true, mounted = true, scrolls = 0, focuses = 0;
  const attrs = {};
  const notice = {
    classList: { contains: () => hidden },
    querySelector: selector => selector.includes('title') ? title : message,
    setAttribute: (key, value) => { attrs[key] = value; },
    scrollIntoView: () => { scrolls++; },
    focus: () => { focuses++; },
  };
  const update = createPriceNoticeEnhancer({ querySelector: () => mounted ? notice : null });
  return { update, title, message, attrs, get scrolls() { return scrolls; }, get focuses() { return focuses; }, show() { hidden = false; update(); }, hide() { hidden = true; update(); }, unmount() { mounted = false; update(); } };
}
test('a hidden tax notice leaves checkout focus and scrolling alone', () => {
  const h = harness(); h.update(); assert.equal(h.scrolls, 0); assert.equal(h.focuses, 0);
});
test('tax mismatch is revealed once and provides confirmation instructions', () => {
  const h = harness(); h.show(); h.update(); h.update();
  assert.equal(h.scrolls, 1); assert.equal(h.focuses, 1);
  assert.equal(h.title.textContent, 'Review your updated total');
  assert.match(h.message.textContent, /billing address/);
  assert.match(h.message.textContent, /select your payment method again to confirm/);
  assert.doesNotMatch(h.message.textContent, /charged once|charged twice/);
  assert.equal(h.attrs.role, 'alert'); assert.equal(h.attrs['aria-atomic'], 'true');
});
test('a later mismatch can reveal again after processing hides the notice', () => {
  const h = harness(); h.show(); h.hide(); h.show(); assert.equal(h.scrolls, 2);
  h.unmount(); assert.equal(h.scrolls, 2);
});
test('localized and trial terms survive the presentation adapter', () => {
  for (const copy of ['Votre prix a changé.', 'The subscription price was updated to include tax based on your billing address. Free trial still applies. Review and try again.']) {
    const h = harness(copy); h.show(); assert.equal(h.message.textContent, copy); assert.equal(h.scrolls, 1);
  }
});
