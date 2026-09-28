const PACKAGE_FOR_ORIGIN = new Map([
  ['https://invite.thequestsapp.com', 'info.nothingserious.quests'],
  ['https://invite-staging.thequestsapp.com', 'info.nothingserious.quests.staging'],
]);

/** Attach public share context only to a matching Android Play installation. */
export function androidInstallStoreUrl(storeUrl, shareUrl) {
  try {
    const share = new URL(shareUrl);
    const store = new URL(storeUrl);
    if (!/^https:\/\/(invite\.thequestsapp\.com|invite-staging\.thequestsapp\.com)\/(q\/[A-HJ-NP-Za-hj-kmnp-z2-9]{8}|p\/[0-9a-f]{32})(\?r=[1-9][0-9]{0,9})?$/.test(shareUrl)) return storeUrl;
    if (
      store.origin !== 'https://play.google.com' || store.pathname !== '/store/apps/details' ||
      store.username || store.password || store.port || store.hash ||
      store.searchParams.getAll('id').length !== 1 ||
      store.searchParams.get('id') !== PACKAGE_FOR_ORIGIN.get(share.origin) ||
      store.searchParams.getAll('referrer').length > 1
    ) return storeUrl;
    const referrer = new URLSearchParams(store.searchParams.get('referrer') || '');
    referrer.set('quests_link_v1', shareUrl);
    const payload = referrer.toString();
    // Preserve the prior install destination when an existing campaign payload
    // leaves insufficient room for Google's referrer transport.
    if (payload.length > 512) return storeUrl;
    store.searchParams.set('referrer', payload);
    return store.toString();
  } catch {
    return storeUrl;
  }
}
