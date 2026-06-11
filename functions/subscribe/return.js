// /subscribe/return — the server-side hop that makes ZERO-TAP return-to-app work.
//
// WHY THIS EXISTS: after a successful purchase, the checkout page wants to send
// the user straight back into the Quests app. iOS treats JS-initiated
// navigations to custom schemes (and universal links) as "untrusted" and blocks
// them inside Safari / SFSafariViewController. A SERVER-side 302 to the scheme,
// however, is honored — the routing decision happens before any page renders.
// So subscribe-app.js navigates here (a same-origin https hop, always allowed),
// and this Function bounces straight into the app.
//
// SECURITY: nothing sensitive happens here — the deep link only navigates; the
// entitlement is granted server-side by the RevenueCat webhook. Both params are
// strictly allowlisted so this cannot be used as an open redirector.
const KNOWN_SCHEMES = ["info.nothingserious.quests", "quests-staging"];
const KNOWN_TARGETS = ["pro-upgrade-success", "home"];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const scheme = (url.searchParams.get("scheme") || "").trim().toLowerCase();
  const to = (url.searchParams.get("to") || "").trim().toLowerCase();

  if (!KNOWN_SCHEMES.includes(scheme) || !KNOWN_TARGETS.includes(to)) {
    return new Response("Bad request", { status: 400 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${scheme}://${to}`,
      "Cache-Control": "no-store",
    },
  });
}
