import { devicePlatform, APP_STORE_URL, PLAY_STORE_URL } from '../../js/device-platform.mjs';

// A scanned QR reaches the store without downloading a landing page or script.
// An iPad using a desktop user agent needs the landing page's touch detection.
export function onRequest({ request }) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'Vary': 'User-Agent',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  }
  const platform = devicePlatform({ userAgent: request.headers.get('User-Agent') });
  const destination = platform === 'ios' ? APP_STORE_URL
    : platform === 'android' ? PLAY_STORE_URL
    : 'https://thequestsapp.com/share?v=2';

  // Destinations are fixed. Query parameters cannot forward private data or
  // turn this into an arbitrary redirect endpoint.
  return new Response(null, { status: 302, headers: { ...headers, Location: destination } });
}
