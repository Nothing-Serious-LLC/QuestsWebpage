export const APP_STORE_URL = 'https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=info.nothingserious.quests';
export const DOWNLOAD_PAGE_URL = 'https://invite.thequestsapp.com/api/download';

// Device identity keeps an iPad in desktop browsing mode on the iOS path.
// Screen width alone would misclassify tablets and narrow desktop windows.
export function devicePlatform(nav = {}) {
  const ua = String(nav.userAgent || '').toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua) || (/mac/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

export function downloadTarget(nav, { appStoreUrl = APP_STORE_URL, playStoreUrl = PLAY_STORE_URL, desktopUrl = '/share' } = {}) {
  const platform = devicePlatform(nav);
  return platform === 'ios' ? appStoreUrl : platform === 'android' ? playStoreUrl : desktopUrl;
}
