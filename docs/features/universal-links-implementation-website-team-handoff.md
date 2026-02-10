
---
title: "Universal Links Web Handoff - Quests Team Implementation"
category: features
status: in-progress
last_updated: 2026-02-09
last_verified: 2026-02-09
related_code:
  - src/services/deepLinkService.ts
  - src/services/questShareService.ts
  - src/screens/quests/QuestSharePreviewScreen.tsx
  - src/screens/start/NotificationsPermissionScreen.tsx
  - src/services/questInviteService.ts
  - app.config.js
supabase_tables:
  - quests
  - quest_participants
  - pending_phone_invitations
  - pending_link_claims
supabase_functions:
  - generate_quest_share_code
  - get_quest_preview
  - join_quest_via_share_link
  - consume_pending_link_claim_for_user
tags:
  - universal-links
  - web-handoff
  - onboarding
  - supabase
  - implementation
---

# Quests Team Handoff

This document is the implementation contract for the Quests app/backend team (mobile + Supabase). It pairs with:

- `docs/features/universal-links-implementation-website-team-handoff.md`

Goal: a non-app user can open a quest link, submit their phone number on web, install the app, and be automatically joined to the intended quest after first authentication.

Referral rewards are explicitly out of scope.

---

## Agent Team Execution Instructions (Read First)

Project context:
- This workstream implements web-to-app quest handoff for non-app users using phone capture on web and auto-join after app auth.
- Core objective is reliable iOS-first universal-link behavior with secure claim consumption and no referral logic.

Execution protocol for AI agent teams:
1. Use **agent teams running Opus 4.6** for implementation tasks.
2. Every team must start in **Plan Mode** first.
3. No coding begins until the **main coordinating agent** reviews and approves the plan.
4. After approval, implementation can proceed in parallel workstreams (DB, mobile orchestration, onboarding UI refresh).
5. Any scope changes or security-impacting deviations must be re-approved by the main coordinating agent before merge.

---

## 1) Team Ownership

Quests team owns:
- Mobile deep link handling and post-auth claim consumption.
- Supabase schema/migrations/RPC for pending web claims.
- Security and idempotency on claim consumption and quest join.
- App routing/toasts after successful claim.

Website team owns:
- `/q/*` web UX and phone capture flow.
- Cloudflare Pages/Functions integration.
- Calling claim start endpoint and install handoff UX.

---

## 2) Current State Snapshot

Already available and should be reused:
- Quest share links: `/q/{shareCode}`.
- `questShareService` with `get_quest_preview`, `join_quest_via_share_link`, `generate_quest_share_code`.
- Deep link parsing in `deepLinkService`.
- Onboarding completion path already processes pending phone invitations.

Known cleanup needed before/while implementing:
- `src/services/authService.ts` currently selects `profiles.phone_number`; table uses `phone`.
- Avoid duplicating invitation processing logic in multiple places; centralize post-auth claim resolution.

Confirmed from independent verification:
- `pending_link_claims` does not exist yet.
- `consume_pending_link_claim_for_user` does not exist yet.
- `start_link_claim` does not exist yet.
- `profiles.phone` exists; `profiles.phone_number` does not.
- Existing SMS invite flows use plaintext `pending_phone_invitations.phone_number` with active RLS policies and helper functions.

Compatibility decision (locked):
- New security model (hashed lookup + encrypted raw) applies to `pending_link_claims` only.
- `pending_phone_invitations` remains unchanged in this workstream to avoid breaking current SMS invite surface area.
- If a future migration hardens `pending_phone_invitations`, run dual-read/dual-write transition plan in a separate release (not coupled to this feature).

---

## 3) Required Backend Changes (Supabase)

## 3.1 New table: `pending_link_claims`

Create a dedicated table for web handoff claims (do not overload `pending_phone_invitations`).

Recommended columns:
- `id uuid primary key default gen_random_uuid()`
- `phone_hash text not null` (SHA-256 of normalized E.164 + server-side pepper)
- `phone_encrypted text not null` (encrypted normalized E.164)
- `phone_last4 text` (optional UX/debug)
- `quest_id uuid not null references public.quests(id) on delete cascade`
- `share_code text not null`
- `status text not null default 'PENDING'`
- `captured_at timestamptz not null default now()`
- `claimed_by_user_id uuid`
- `claimed_at timestamptz`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:
- Partial unique active claim per phone/quest:
  - `(phone_hash, quest_id)` where `status = 'PENDING'`.
- Index on `phone_hash`.
- Index on `expires_at`.
- Trigger for `updated_at`.
- Enable RLS on `pending_link_claims`.
- Add deny-by-default policies for `authenticated`/`anon` direct table access.
- Only allow access through SECURITY DEFINER functions.

## 3.2 RPC/function: `consume_pending_link_claim_for_user`

Purpose:
- Called after user auth to consume one valid claim for that user phone.
- Atomically:
  1) resolve matching claim,
  2) mark as claimed,
  3) join quest (reuse `join_quest_via_share_link`),
  4) return navigation payload.

Input:
- `(p_user_id uuid)` and resolve by authenticated user's phone.

Output:
- `success boolean`
- `action text` (`joined`, `already_joined`, `accepted_existing`, `none_found`, `expired`, `error`)
- `quest_id uuid`
- `quest_name text`
- `quest_status text`
- `error text`

Security:
- `SECURITY DEFINER` + `auth.uid()` must match `p_user_id`.
- Search path pinned.
- Strict status transitions: only `PENDING -> CLAIMED`.
- Idempotent on retries.
- Must re-check quest status at consume time (`ACTIVE`/`UPCOMING` only).
- Must respect `privacy_level` for share eligibility and preview behavior.
- Derive comparison key by hashing authenticated profile phone with same normalization + pepper algorithm.

Preview privacy policy (locked):
- Show inviter name only.
- Show basic quest metadata only.
- Do not expose any participant identities in preview payloads.
- For private quests, apply the same minimal preview model when accessed via invite link.

Multiple-claim behavior (explicit):
- Consume **up to 3 eligible pending claims** for that phone ordered by `created_at ASC`.
- For each claim, attempt join via `join_quest_via_share_link`.
- Return per-claim results so app can show clear outcome.
- If product chooses single-claim behavior later, update both team handoffs simultaneously.

## 3.3 TTL and cleanup

- Add scheduled cleanup (pg_cron or Edge scheduled) to mark stale `PENDING` as `EXPIRED`.
- Use fixed expiration window: **72 hours (3 days)**.
- Add hard-delete retention job for expired PII records.
- Locked defaults:
  - `web_claim_ttl_hours = 72`
  - `web_claim_pii_retention_days = 3`
- Store both values in `app_settings` so ops can tune without code changes.

## 3.4 Documentation log requirement

When applying DB migrations, update:
- `docs/deployment/database-changes-log.md`

---

## 4) Required Mobile Changes

## 4.1 Deep link and pending state handling

File: `src/services/deepLinkService.ts`
- Keep current `/q/{shareCode}` behavior.
- Keep pending-share storage for unauthenticated opens.
- Do not add referral logic in this phase.

## 4.2 Onboarding phone UX redesign task (new)

Assign a UI-focused agent to redesign:
- `src/screens/start/PhoneNumberScreen.tsx`
- `src/screens/start/VerifyPhoneScreen.tsx`

Requirements:
- Match the visual quality and simplicity of the newer onboarding screens.
- Keep Quests theme/colors/typography.
- Reduce visual clutter and improve hierarchy.
- Preserve existing validation and auth behavior.

## 4.3 Post-auth claim consumption (single orchestrator)

Create/standardize one orchestrator (example: `src/services/postAuthLinkClaimService.ts`) and call it from onboarding completion/auth bootstrap path.

Flow:
1. Determine authenticated user and normalized phone from profile.
2. Attempt `consume_pending_link_claim_for_user`.
3. On success, navigate:
   - `ACTIVE` -> `QuestDetail`
   - `UPCOMING` -> `UpcomingQuestDetail`
4. Show success toast.
5. If none found, no-op.

Important:
- This should run once per auth event (guard against loops).
- Must not block core onboarding if claim resolution fails.
- Handle phone mismatch gracefully (web phone != authenticated phone): no auto-join, show neutral message.
- Handle network-failure-after-success safely: if server consumed and joined but response was lost, retry should return deterministic "already joined/consumed" outcome.

Phone capture UX requirement in app:
- When a user reaches the app phone entry flow and submits a number that has a pending link claim, show a clear confirmation toast/banner such as:
  - "Got it. We'll connect this number to your quest after sign in."
  - or "You're in line to join this quest once your account is verified."

## 4.4 Phone field correctness fix

File: `src/services/authService.ts`
- Replace `phone_number` access with `phone` for profile lookup compatibility.

## 4.5 Test coverage

Add tests/manual checks for:
- Pending share link + login path.
- Expired pending claim path.
- Already joined path.
- Duplicate consume call idempotency.
- Phone screen toast appears when pending claim exists for submitted number.
- Redesigned phone/verify screens still pass auth flow and edge-case validation.

---

## 5) API Contract to Coordinate With Website Team

The website team needs these backend contracts available before full end-to-end test:

1. `start_link_claim` endpoint/function
2. `consume_pending_link_claim_for_user` endpoint/function

If Quests team owns these APIs, publish exact request/response schemas in a shared short spec before frontend implementation starts.

Ownership decision:
- Quests team owns DB functions and data integrity.
- Website team owns Cloudflare HTTP wrapper endpoint (`POST /api/link-claims/start`) that invokes Quests-owned function with server credentials.
- Both teams must agree on canonical JSON schema before implementation.

Hash/encryption implementation rule:
- Use `pgcrypto` primitives in DB functions for deterministic hash and reversible encrypted storage.
- Keep pepper/keys outside source code (Vault/secret manager).

---

## 6) Outstanding Decisions (Must Be Finalized)

| Decision | Options | Recommendation | Owner |
|---|---|---|---|
| Claim consume key | Token-based vs phone-only | **Phone-only** | Product + Quests |
| Phone storage mode | Plain E.164 vs hash+encrypted raw | **Hash lookup + encrypted raw (locked)** | Product + Security |
| Preview gating | Open preview vs full gated | Open preview, gate on Join action | Product |
| Platform scope | iOS-only vs iOS+Android | iOS-first, Android later | Product |
| Legacy web links | Keep `/quest?questId` | **Do not support for this launch** | Product + Web |
| Phone-submit anti-abuse thresholds | Strict vs moderate | Moderate start, tighten from telemetry | Product + Web + Security |
| Claim TTL | configurable range | **72 hours (locked)** | Product + Quests |
| PII retention | configurable range | **3 days (locked)** | Product + Security |
| Multi-claim consume | single vs multiple | **Up to 3 oldest-first (locked)** | Product + Quests |
| Preview privacy behavior | broad vs minimal | **Inviter name + basic quest info only (locked)** | Product + Quests |

Concrete anti-abuse starter thresholds:
- Max 5 phone submits per IP per hour.
- Max 3 phone submits per phone per 24h.
- Max 20 submits per share code per 24h from same IP block.
- Challenge with Turnstile on repeat attempts.

---

## 7) Delivery Phases and Exit Criteria

Phase 1 - DB + RPC ready
- Migration merged.
- Consume RPC integrated and tested.

Phase 2 - Mobile orchestration
- Post-auth claim service wired.
- Navigation and toasts verified.

Phase 3 - E2E with website
- New user from `/q/{code}` web flow joins quest after first app auth.
- Error paths gracefully handled.

Phase 4 - Hardening
- Cleanup jobs active.
- Analytics events in place.

---

## 8) Definition of Done (Quests Team)

- No referral code/reward logic added.
- New claim table + migration applied and documented.
- Claim consume RPC is idempotent and auth-guarded.
- App auto-resolves pending web claim after auth.
- Phone and verify onboarding screens are redesigned to match current onboarding quality.
- Phone submission screen shows clear "we captured your number for quest join" feedback when applicable.
- Existing SMS invitation flow remains unaffected.
- All high-priority manual tests pass.

---

## 9) Website Team Implementation Progress (2026-02-10)

### Status: First pass complete, pending security fixes and backend dependencies

### Main website confirmation

**The main website (`index.html` at `thequestsapp.com`) was NOT modified.** `git diff HEAD -- index.html` returns empty. All changes are scoped to the invite subdomain paths (`/q/*`, `/api/*`) and infrastructure files.

### Files implemented

**Modified (4 files):**

| File | Changes |
|------|---------|
| `q/index.html` | Complete redesign from simple download page to Partiful-inspired quest invite preview (1189 → ~1975 lines). Includes: dark navy theme CSS, shimmer loading skeleton, quest preview rendering, phone capture with Turnstile, install handoff UX, error states, responsive breakpoints. |
| `_headers` | Added global security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) and `/api/*` CORS. |
| `functions/q/[[path]].js` | Hardened existing route handler with method guard (405 for non-GET/HEAD), cache headers (`max-age=300, s-maxage=600`), and `Vary: Accept-Encoding`. |
| `404.html` | Upgraded invite fallback with richer messaging, "Download Quests and Join" CTA, and "I already have the app" universal link handler. |

**Created (3 files, untracked — must be committed):**

| File | Purpose |
|------|---------|
| `functions/api/link-claims/_middleware.js` | CORS middleware with origin allowlist (`invite.thequestsapp.com`, `thequestsapp.com`), OPTIONS preflight, security headers. |
| `functions/api/link-claims/start.js` | `POST /api/link-claims/start` endpoint: request validation, Turnstile server-side verification, KV-based rate limiting (5/IP/hr, 3/phone/24h, 20/code+IP-block/24h), Supabase RPC call to `start_link_claim`. |
| `_routes.json` | Cloudflare Pages function routing: includes `/q/*`, `/api/*`; excludes `/q/index.html`, `/.well-known/*`. |

**Verified unchanged:**

| File | Status |
|------|--------|
| `index.html` (main website) | Not modified |
| `.well-known/apple-app-site-association` | Intact, correct `appID` and paths |
| `_redirects` | Existing `/q/* /q/index.html 200` rule unchanged |

### Security review findings (consolidated from 4-agent review team)

#### HIGH — Must fix before deploy

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| H1 | **Fail-open rate limiting**: KV unavailable = no rate limits at all | `start.js:160-215` | Fail closed: return 503 if KV binding is missing |
| H2 | **Placeholder credentials**: Supabase URL, anon key, Turnstile site key are all placeholder strings | `q/index.html:1379-1380,1782` | Replace before deploy |
| H3 | **CORS conflict**: `_headers` sets static single-origin CORS that overwrites middleware's dynamic multi-origin CORS | `_headers:15-19` vs `_middleware.js:1-4` | Remove `/api/*` CORS block from `_headers`; let middleware handle it |
| H4 | **Untracked files**: `_routes.json`, `functions/api/` are not committed — without `_routes.json`, Functions run on ALL routes and could break AASA serving | `_routes.json`, `functions/api/` | Commit all new files |
| H5 | **Missing CSP header**: No Content-Security-Policy on any path | `_headers` | Add CSP: `default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; img-src 'self' https://*.supabase.co data:; frame-ancestors 'none'` |
| H6 | **Missing HSTS header**: No `Strict-Transport-Security` | `_headers` | Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| H7 | **Share code regex mismatch**: Server regex accepts `l` but `generate_share_code` excludes it | `start.js:16` | Fix regex to exclude `l`: `/^[A-HJ-NP-Za-hj-kmnp-z2-9]{8}$/` |

#### MEDIUM — Should fix before broad rollout

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| M1 | **`icon_color` CSS injection**: Supabase data injected into inline `style.background` without validation | `q/index.html:1496-1498` | Validate against hex pattern `/^#[0-9a-fA-F]{6}$/` |
| M2 | **`creator_avatar` URL unvalidated**: Arbitrary URL loaded as `img.src` | `q/index.html:1516` | Validate starts with `https://` |
| M3 | **Phone formatting is US-only**: Hardcodes `+1`, rejects international numbers | `q/index.html:1666-1688` | Document as intentional limitation or add country selector |
| M4 | **Rate limit key hashing without pepper**: SHA-256 of raw phone for KV keys | `start.js:61-67` | Use HMAC with server secret |
| M5 | **Phone normalization inconsistency**: Client is US-only, server accepts international | `start.js:34-55` vs `q/index.html:1680-1688` | Align both to same validation |
| M6 | **Missing `Permissions-Policy` header** | `_headers` | Add `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| M7 | **Turnstile hostname not validated**: Server doesn't check `turnstileResult.hostname` | `start.js:138-156` | Validate hostname matches `invite.thequestsapp.com` |
| M8 | **`already_claimed` error not mapped**: Returns generic 500 instead of idempotent success | `start.js:250-258` | Map to 200 with `status: "already_claimed"` |
| M9 | **OG meta tags are static**: Crawlers won't see quest-specific titles/descriptions | `q/index.html:12-24` | Consider Cloudflare Worker edge injection for dynamic OG |
| M10 | **Copyright year is 2025** | `q/index.html:1297` | Update to 2026 |

#### LOW — Minor / informational

- No `prefers-reduced-motion` media query for animations
- Duplicate `aria-label="Quest details"` on two sections
- No `<form>` element wrapping phone input
- Skeleton loading lacks status badge placeholder
- `showError` function name shadowed across IIFEs (safe due to separate scopes)
- `__updateQuestMeta` exposed on `window` (safe, low impact)
- Turnstile polling silently stops after 5 seconds with no user feedback
- Redundant ARIA roles on semantic HTML elements
- IP rate limit key uses raw IP instead of hash
- `already_claimed` falls through to 500

### Privacy compliance status

**Currently COMPLIANT but structurally fragile.**

The spec says: "Show inviter name only. Show basic quest metadata only. Do not expose participant identities in preview payloads."

- `get_quest_preview` RPC returns `participant_count`, `creator_name`, `creator_avatar` — no participant identity arrays.
- Web page renders generic emoji placeholder circles for social proof, not actual participant avatars.
- Creator name/avatar display is compliant (creator = inviter for share links).
- **Risk**: The CSS/DOM structure supports real participant avatar images (`.social-avatar img`). If the API ever returns participant identity data, the rendering code could expose it without code changes. Recommend: add defensive code comment or remove the `img` support from social avatar CSS.

### Outstanding tasks — Website team (before deploy)

1. Replace Supabase URL and anon key in `q/index.html` (lines 1379-1380)
2. Replace Turnstile site key in `q/index.html` (line 1782)
3. Fix fail-open rate limiting to fail closed in `start.js`
4. Remove `/api/*` CORS from `_headers` (let middleware handle)
5. Add CSP, HSTS, Permissions-Policy headers
6. Fix share code regex in `start.js`
7. Validate `icon_color` and `creator_avatar` in rendering code
8. Commit all untracked files (`_routes.json`, `functions/api/`, `docs/`)
9. Update copyright year to 2026
10. Map `already_claimed` error to idempotent response

### Outstanding tasks — Backend/Quests team (NOT in this repo)

1. **`pending_link_claims` table** — Does not exist yet. Must be created with schema per section 3.1.
2. **`start_link_claim` Supabase RPC** — Does not exist yet. Called by `POST /api/link-claims/start`. Must accept `(p_share_code, p_phone, p_phone_last4)` and return `{ claim_id, masked_phone, status, expires_at }`.
3. **`consume_pending_link_claim_for_user` Supabase RPC** — Does not exist yet. Called post-auth to consume claims.
4. **TTL cleanup jobs** — pg_cron or Edge scheduled job to expire stale PENDING claims after 72 hours.
5. **`app_settings` values** — `web_claim_ttl_hours = 72`, `web_claim_pii_retention_days = 3`.
6. **`get_quest_preview` hardening** — Add `privacy_level` check; enforce minimal preview for private quests.
7. **Mobile post-auth claim service** — `src/services/postAuthLinkClaimService.ts` orchestrator.
8. **Phone field fix** — `src/services/authService.ts`: replace `phone_number` with `phone`.
9. **Onboarding phone screens redesign** — `PhoneNumberScreen.tsx`, `VerifyPhoneScreen.tsx`.
10. **Test coverage** — All paths per section 4.5.

### Blocked tasks

| Task | Blocked by |
|------|------------|
| End-to-end phone submit test | `start_link_claim` RPC does not exist |
| End-to-end claim consumption test | `consume_pending_link_claim_for_user` RPC does not exist |
| Production deployment | All HIGH findings + backend RPCs |

### Deployment checklist

- [ ] Commit `_routes.json`, `functions/api/`, `docs/`
- [ ] Replace Supabase URL and anon key in `q/index.html`
- [ ] Replace Turnstile site key in `q/index.html`
- [ ] Set Cloudflare Pages env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`
- [ ] Create and bind `RATE_LIMIT` KV namespace
- [ ] Fix fail-open rate limiting in `start.js`
- [ ] Remove `/api/*` CORS from `_headers`
- [ ] Add CSP, HSTS, Permissions-Policy to `_headers`
- [ ] Fix share code regex in `start.js`
- [ ] Confirm `start_link_claim` Supabase RPC exists
- [ ] Confirm `pending_link_claims` table exists
- [ ] Deploy to Cloudflare Pages
- [ ] Verify AASA via `https://app-site-association.cdn-apple.com/a/v1/invite.thequestsapp.com`
- [ ] Test `/q/{code}` on mobile Safari
- [ ] Test phone submit flow end-to-end
- [ ] Test "I already have the app" universal link handoff
- [ ] Test error states (invalid code, expired quest, rate limiting)

