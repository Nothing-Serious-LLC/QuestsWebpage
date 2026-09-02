/**
 * Which installed clients an "Open in Quests" control can hand a share to.
 *
 * The production invite host serves one client, so its custom-scheme handoff
 * is the environment-configured scheme alone. The staging invite host is
 * shared by two clients that both claim `applinks:invite-staging.thequestsapp.com`:
 *
 *   - the TestFlight (hybrid) client and the App Store client register the
 *     production scheme `info.nothingserious.quests` (production bundle id)
 *   - the pure staging client registers `quests-staging`
 *     (bundle id `info.nothingserious.quests.staging`)
 *
 * A page on the staging host therefore never assumes one client. The https
 * share link itself stays the first offer (iOS routes it to whichever
 * installed app claims the host), and the custom-scheme handoff tries the
 * production scheme first, then the staging scheme, before the store.
 *
 * Android keeps the environment-configured scheme and package pair because
 * an Android intent names exactly one package.
 */
export const PRODUCTION_APP_SCHEME = "info.nothingserious.quests";
export const STAGING_APP_SCHEME = "quests-staging";

const STAGING_SHARE_HOSTS = new Set([
  "invite-staging.thequestsapp.com",
  "quests-invite-staging.pages.dev",
]);
const STAGING_PAGES_SUFFIX = ".quests-invite-staging.pages.dev";

export function isStagingShareHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  return STAGING_SHARE_HOSTS.has(host) || host.endsWith(STAGING_PAGES_SUFFIX);
}

/**
 * Ordered custom schemes for iOS on this host. The first entry is the primary
 * handoff; the rest are timed fallbacks. Production hosts return exactly the
 * configured scheme so their pages render byte-for-byte as before.
 */
export function appSchemesForHost(hostname, configuredScheme) {
  const configured = String(configuredScheme || "").trim();
  if (!isStagingShareHost(hostname)) {
    return configured ? [configured] : [];
  }
  const ordered = [PRODUCTION_APP_SCHEME, STAGING_APP_SCHEME];
  if (configured && !ordered.includes(configured)) ordered.push(configured);
  return ordered;
}

/**
 * Widen an environment-derived handoff for the request host. On the staging
 * host the iOS primary becomes the production scheme with the staging scheme
 * as the alternate; Android keeps the configured pair.
 */
export function appHandoffForHost(hostname, handoff = {}) {
  const configuredScheme = handoff.appScheme;
  const [appScheme, ...alternateAppSchemes] = appSchemesForHost(
    hostname,
    configuredScheme,
  );
  if (!appScheme) return { ...handoff };
  return {
    ...handoff,
    appScheme,
    alternateAppSchemes,
    androidScheme: configuredScheme || appScheme,
  };
}
