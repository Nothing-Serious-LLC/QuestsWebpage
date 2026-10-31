import { devicePlatform, downloadTarget } from './device-platform.mjs';

const platform = devicePlatform(navigator);
document.documentElement.dataset.device = platform;

document.querySelectorAll('[data-store-link]').forEach(link => {
  link.href = downloadTarget(navigator, {
    appStoreUrl: link.dataset.iosStore,
    playStoreUrl: link.dataset.androidStore,
  });
  link.removeAttribute('target');
});
document.querySelectorAll('[data-desktop-download]').forEach(panel => {
  panel.hidden = platform !== 'desktop';
});

// Older QR codes and direct /share visits use this client-side fallback.
// New QR codes choose the store in the server response, before loading HTML.
// Ordinary site visits and invitation previews never redirect on page load.
if (document.body.hasAttribute('data-download-page') && platform !== 'desktop') {
  document.querySelector('[data-download-heading]').textContent = platform === 'android' ? 'Get Quests for Android' : 'Get Quests for iPhone and iPad';
  document.querySelector('[data-download-description]').textContent = platform === 'android' ? 'Opening Google Play. You can also use the button below.' : 'Opening the App Store. You can also use the button below.';
  window.location.replace(downloadTarget(navigator));
}

// The legacy invitation fallback receives its share code in the URL.
// Generate locally so the invitation is never sent to a QR image service.
const legacyQr = document.querySelector('[data-legacy-invite-qr]');
if (legacyQr && platform === 'desktop') {
  const match = window.location.pathname.match(/^\/q\/([A-HJ-NP-Za-hj-kmnp-z2-9]{8})$/);
  if (match) {
    const { qrSvg } = await import('./qr-svg.mjs');
    const url = new URL(`/q/${match[1]}`, window.location.origin).href;
    legacyQr.innerHTML = qrSvg(url + '?download=1');
    const link = document.querySelector('[data-legacy-invite-link]');
    link.href = url;
    link.textContent = url.replace(/^https?:\/\//, '');
  }
}
