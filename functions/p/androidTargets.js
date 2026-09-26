import { isStagingShareHost } from '../q/appHandoffTargets.js';

const APP_STORE_URL = 'https://apps.apple.com/app/id6745767553';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=info.nothingserious.quests';

/** Render Android actions directly, including browsers with JavaScript disabled. */
export function profileAndroidTargets(request, shareCode, revision) {
  if (!/Android/i.test(request.headers.get('User-Agent') || '')) {
    return { storeUrl: APP_STORE_URL };
  }
  const staging = isStagingShareHost(new URL(request.url).hostname);
  const packageName = staging ? 'info.nothingserious.quests.staging' : 'info.nothingserious.quests';
  const scheme = staging ? 'quests-staging' : 'info.nothingserious.quests';
  // Staging installs are distributed by the test lane; the public download is Play.
  const targets = { storeUrl: PLAY_STORE_URL };
  if (shareCode) {
    targets.openUrl = `intent://p/${shareCode}?r=${revision}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
  }
  return targets;
}
