// Presentation adapter for the price-mismatch state in purchases-js 1.42.1.
// The SDK owns tax, payment confirmation, and retry. Recheck its DOM on upgrades.
export function createPriceNoticeEnhancer(mount) {
  let visibleNotice = null;
  return function updatePriceNotice() {
    const notice = mount.querySelector('.rc-checkout-price-update-info-container');
    if (!notice || notice.classList.contains('fully-hidden')) {
      visibleNotice = null;
      return;
    }

    const title = notice.querySelector('.rcb-info-title .rcb-typography');
    const message = notice.querySelector('.rcb-info-message .rcb-typography');
    // Preserve SDK-owned elements and localized/trial copy. Only replace the
    // exact English, non-trial message verified in our pinned SDK.
    const original = 'The total price was updated with tax based on your billing address. Please review and try again. Your card will only be charged once.';
    if (message?.textContent.trim() === original) {
      replaceText(message, "Sales tax was recalculated using your payment method's billing address. Review the updated total, then select your payment method again to confirm.");
      if (title?.textContent.trim() === 'Price update') {
        replaceText(title, 'Review your updated total');
      }
    }
    notice.setAttribute('role', 'alert');
    notice.setAttribute('aria-atomic', 'true');
    notice.setAttribute('tabindex', '-1');
    if (visibleNotice !== notice) {
      visibleNotice = notice;
      // Reveal once per mismatch. Later SDK renders must allow normal scrolling.
      notice.scrollIntoView({ block: 'start', behavior: 'instant' });
      notice.focus({ preventScroll: true });
    }
  };
}

function replaceText(element, text) {
  const node = Array.from(element.childNodes).find(
    child => child.nodeType === 3 && child.nodeValue.trim()
  );
  if (node) node.nodeValue = text;
}
