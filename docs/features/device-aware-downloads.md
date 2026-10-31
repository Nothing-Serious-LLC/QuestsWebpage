# Device-aware downloads and Quest invitations

October 31, 2026. Elliott requested and authorized completing the invitation release. The existing Musella URL remains https://invite.thequestsapp.com/q/JWfaB7wu.

Desktop invitation visitors enter a phone number below the original animated Quest card. Only a successful verified claim crossfades the card into Continue on your phone. The local preview simulates success without saving a signup. Short windows scroll the handoff into view. Mobile visitors retain the success checkmark, Opening Quests message, 1600 ms store transition and installed-app control.

The invitation QR uses the same associated share path with `?download=1`. The operating system can deliver this URL directly to an installed app. The existing native handler parses the share code from the path independently of the query. Requests reaching the website receive an immediate empty HTTP 302 to the matching store. Android carries the original invitation in the existing Play install-referrer format. New iOS users sign in with the phone number entered on desktop to recover the pending claim. A desktop-mode iPad uses a tiny standalone fallback with head-time touch detection. No phone number or claim credential enters the QR.

Generic website Download controls send phones to their platform store and desktop visitors to the plain `/share` page. Generic download QRs continue to use `/api/download`. The homepage also shows a desktop QR. Existing associated-domain files, claim API, authentication, moderation and campaign content remain unchanged.

## Review evidence

- 232 website tests pass, including claim failure behavior, mobile success, Android referrer, environment-specific handoffs, empty server redirects, iPad fallback, invalid paths and rejected write methods.
- SEO validation passes for 50 indexable static pages.
- Desktop browser review confirms a single centered card and QR, below-card form, retained animation and no horizontal overflow.
- Normal Musella host read at 2026-10-31T14:29:33.548Z confirms joins unpaused, instant joining, no cap, approved UPCOMING status, original share code and 28 approved published Journey messages at version 1. Elliott reopened joining; this session made zero campaign writes.
- Physical iPhone and Android installation, sign-in and actual join remain a separate end-to-end device check. Source and browser checks do not establish that outcome. A browser that has disabled app links can still route an installed user through the store; the original invitation and existing Open in Quests control remain available.

Evidence directory: `/Users/elliottthornburgsmac/Developer/Quests-artifacts/web-device-download-20261031`.

Local preview: `QUEST_PREVIEW_SNAPSHOT=/absolute/path/to/musella-public-snapshot.json node scripts/preview-device-download.mjs`.
