# Quest Sharing Website

Status: source complete, local validation complete, hosted activation pending

This document covers the Cloudflare Pages portion of Quest Sharing. The Quests
application repository owns database publication, the `quest-share-web` Edge
Function, PNG rendering, native routing, onboarding, and release governance.

## Routes

| Route | Enhanced behavior |
|---|---|
| `/q/{code}` | Server-rendered Quest invitation with first-response metadata |
| `/q/{code}/og.png` | Secure proxy for the 1200 x 630 compact Quest artifact |
| `/q/{code}/story.png` | Dark secure proxy for the 1080 x 1920 Story artifact |
| `/api/link-claims/start` | Existing Turnstile-protected phone claim endpoint |

The canonical Quest code remains a case-sensitive eight-character value from
the existing Quest alphabet. The optional `?r={revision}` parameter pins a
positive publication revision.

## Dark gates and bindings

The current static Quest invitation remains the fallback until the enhanced
route is explicitly enabled.

| Binding | Purpose | Initial value |
|---|---|---|
| `QUEST_SHARING_ENABLED` | Enables enhanced HTML and Open Graph resolution | `false` |
| `QUEST_STORY_SHARING_ENABLED` | Enables the public Story image proxy | `false` |
| `QUEST_SHARE_SUPABASE_URL` | Project URL containing `quest-share-web` | Staging project URL |
| `QUEST_SHARE_WEB_SECRET` | Shared secret sent as `x-quest-share-secret` | Separate staging secret |
| `TURNSTILE_SITE_KEY` | Public widget key used by the phone claim form | Current invite-domain key |

Profile Sharing keeps its independent `PROFILE_SHARE_*` bindings. The legacy
Quest page and phone endpoint keep their current `SUPABASE_*`, Turnstile, and KV
bindings.

## Edge contract

Cloudflare sends `POST` requests to `quest-share-web` with the
`x-quest-share-secret` header.

Metadata request:

```json
{
  "action": "metadata",
  "shareCode": "AbCd2345",
  "revision": 3
}
```

Image request:

```json
{
  "action": "image",
  "artifact": "og",
  "shareCode": "AbCd2345",
  "revision": 3
}
```

`artifact` is `og` or `story`. The revision field is omitted when the current
revision should resolve.

The metadata response uses `presentationVersion: 1` and includes sanitized
Quest identity, host identity, accepted participant count, timing, cadence,
status, availability, privacy, category, and approved media. Joinable
presentations carry `availability: "joinable"`. Completed presentations carry
`availability: "ended"` and render without phone controls.

Canceled, expired, deleted, disabled, malformed, and reset-code states resolve
to a generic unavailable page. Malformed successful metadata also resolves to
that generic page.

## Privacy and media

The HTML mapper accepts remote media only from the configured Supabase project:

- Host avatars from the public `avatars` bucket
- Standard artwork from the public `standard-quest-backgrounds` bucket

Every other URL resolves to an empty media slot. The page receives aggregate
accepted participant count and zero participant identities. Check-ins,
progress, activity, phone values, internal identifiers, and membership details
remain inside authenticated application systems.

Schema v1 emits `coverImageUrl: null` for Community user covers. Private cover
delivery remains gated on a durable backend persistence, approval, and serving
contract. The website establishes zero public user-cover bucket paths.

Open Graph and Story responses use `Cache-Control: no-store`. This lets
cancellation, expiry, disable, and reset enforcement reach the image route
immediately. The backend reuses immutable stored objects to keep rendering
efficient.

## Page behavior

The enhanced page reuses the Profile Sharing Foundation background assets and
wordmark. Its central Quest card follows the `AppQuestHeroCard` information
hierarchy:

- Quest medallion, title, short description, and approved cover
- Visibility, duration, and humanized category pills
- Full-width cadence rule
- Host identity and accepted participant count
- Active, upcoming, and completed supporting state

Joinable pages preserve the current phone claim endpoint. A successful claim
opens the platform store so the pending claim can be consumed after sign-in.
The installed-app action keeps the share code through the Android intent or the
iOS Quest custom scheme, with a timed store fallback.

## Failure behavior

| Condition | Result |
|---|---|
| Enhanced gate disabled | Exact legacy static Quest page |
| Metadata upstream unavailable | Legacy static Quest page |
| Metadata returns unavailable | Generic no-store 404 page |
| Metadata schema is malformed | Generic no-store 404 page |
| Open Graph upstream unavailable | Plain no-store 503 response |
| Story gate disabled | Private no-store 404 response |
| Story unpublished or unavailable | Private no-store 404 response |

An image URL always returns an image or a plain error response. HTML fallback
stays on page routes.

## Local validation

Run:

```bash
npm test
```

The local suite covers:

- Exact legacy fallback and query preservation
- First-response Open Graph metadata and canonical revision URLs
- Strict presentation schema and case-preserving Quest codes
- HTML escaping and same-project media allowlists
- Private, Community, upcoming, active, and completed card states
- Phone claim and installed-app handoff source contracts
- Open Graph and Story proxy requests, status codes, content types, and caching
- Independent Story gating
- Profile routes, association files, Pages routing, and phone endpoint presence

Actual PNG rendering and pixel fixtures live in
`supabase/functions/quest-share-artifact` in the Quests application repository.
This repository has one responsive HTML renderer and two secure image proxies.

## Hosted gates

Hosted staging still requires:

1. Configure staging-only bindings and keep both gates false.
2. Verify the current production `/q/*`, `/p/*`, AASA, assetlinks, and phone
   claim baselines.
3. Deploy a branch preview and verify valid, ended, canceled, expired, and
   malformed codes.
4. Verify first-response metadata with crawler-style requests.
5. Verify the phone claim flow with a real staging Quest and a fresh install.
6. Verify physical Messages rendering for the 1200 x 630 artifact.
7. Complete Story renderer capacity and physical Instagram acceptance.
8. Activate HTML and Open Graph separately from Story through reviewed gates.

Cloudflare publication, Supabase changes, production mutation, branch push, and
gate activation remain outside this source lane.
