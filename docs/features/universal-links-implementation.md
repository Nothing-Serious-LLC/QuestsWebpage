
---
title: "Universal Links Implementation"
category: feature
status: in-progress
last_updated: 2026-02-09
description: >
  Complete implementation spec for iOS Universal Links enabling shareable quest
  invite links. Covers domain setup, AASA hosting, database migrations, new
  screens/components, deep link service updates, and web fallback.
tags:
  - navigation
  - invitations
  - sharing
  - deep-links
  - expo
related_code:
  - src/services/deepLinkService.ts
  - src/services/questShareService.ts
  - src/screens/quests/QuestSharePreviewScreen.tsx
  - src/components/quest/ShareQuestModal.tsx
  - src/screens/quests/QuestDetailScreen.tsx
  - src/screens/quests/UpcomingQuestDetailScreen.tsx
  - src/screens/quest-creation/QuestCreationInviteScreen.tsx
  - src/constants/appLinks.ts
  - app.config.js
supabase_tables:
  - quests
  - quest_participants
  - quest_activity_tracking
supabase_functions:
  - get_quest_preview
  - join_quest_via_share_link
  - generate_quest_share_code
  - generate_share_code
last_verified: 2026-02-09
verified_by: ai-agent
---

# Universal Links for Quest Sharing

Shareable links that let anyone preview a quest and join it directly from a URL. Links are accessible from quest detail screens and upcoming quest detail screens.

**Link format:** `https://invite.thequestsapp.com/q/K7mP2xRw`

---

## Table of Contents

1. [Domain and Hosting](#domain-and-hosting)
2. [Current Verified Infra State (2026-02-09)](#current-verified-infra-state-2026-02-09)
3. [Partiful-Inspired Web UX Requirement](#partiful-inspired-web-ux-requirement)
4. [Web Handoff Architecture (No Referral)](#web-handoff-architecture-no-referral)
5. [What Already Exists](#what-already-exists)
6. [Link Format](#link-format)
7. [Database Migrations](#database-migrations)
8. [Service Layer](#service-layer)
9. [Deep Link Service Updates](#deep-link-service-updates)
10. [New Screen: QuestSharePreviewScreen](#new-screen-questpreviewscreen)
11. [New Component: ShareQuestModal](#new-component-sharequestmodal)
12. [UI Integration Points](#ui-integration-points)
13. [Config Updates](#config-updates)
14. [Manual Setup Steps](#manual-setup-steps-outside-codebase)
15. [Open Decisions (Product/Legal/Infra)](#open-decisions-productlegalinfra)
16. [Edge Cases](#edge-cases)
17. [Files Summary](#files-summary)
18. [Verification Checklist](#verification-checklist)
19. [Onboarding UX Addendum (Phone Screens)](#onboarding-ux-addendum-phone-screens)

---

## Domain and Hosting

- **Domain:** `invite.thequestsapp.com` (subdomain of owned domain `thequestsapp.com`)
- Must serve HTTPS with no redirects on `/.well-known/` paths
- Hosting: GitHub Pages, Vercel, Netlify, or Cloudflare Pages all work

### Production topology (verified)

- `invite.thequestsapp.com` is currently served from **Cloudflare Pages**.
- Apex `thequestsapp.com` is currently served from **GitHub Pages**.
- This split is valid for now; the quest invite rollout can proceed on `invite.thequestsapp.com` without first moving apex hosting.

### Apple App Site Association (AASA)

Host at `https://invite.thequestsapp.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "details": [
      {
        "appID": "YAJG48SHDF.info.nothingserious.quests",
        "paths": ["/q/*", "/quest*", "/"]
      }
    ]
  }
}
```

- Content-Type: `application/json`
- If using GitHub Pages, add `.nojekyll` at repo root so `/.well-known/` is served
- Optionally also provide `apple-app-site-association.json` as fallback

### Fallback Web Page

Serve a simple HTML page at `invite.thequestsapp.com/q/*` for users who don't have the app installed:
- Shows app icon and name
- "Download Quests" button linking to App Store (ID: `6745767553`)
- Can be a single `index.html` with redirect or a simple branded page

### New Product Direction (2026-02-09)

Fallback is no longer "simple download only." The web surface should now support:
- **Quest preview for non-app users** (mobile + desktop)
- **Phone-captured join intent** (no full account creation on web)
- **App install handoff** so first app auth can complete the join automatically

This keeps the app onboarding flow intact while making shared links usable for people without the app.

---

## Current Verified Infra State (2026-02-09)

### Confirmed

- `invite.thequestsapp.com` is where universal-link + web invite work should ship first.
- Cloudflare Pages route support already exists for `/q/*` (function route + static fallback rules).
- Existing app link format `/q/{shareCode}` is already integrated in mobile and backend.
- App Store CTA currently points to app id `6745767553`.
- No mandatory GitHub Pages change is required to launch quest web fallback on `invite`.

### Security and reliability preflight (recommended before rollout)

1. Confirm branch protection on `main`.
2. Require org/admin 2FA.
3. Audit GitHub app/action access to repo.
4. Verify Cloudflare bot/rate-limit controls for phone submit endpoint.
5. Fix `www.thequestsapp.com` certificate/redirect behavior before marketing traffic expansion.

---

## Partiful-Inspired Web UX Requirement

Use Partiful event-page UX as a structural benchmark for the web invite experience while preserving Quests branding, colors, typography, and tone.

Reference invite page behavior (captured):  
`https://partiful.com/e/qnoMGM1ZXXknlPETL2pc`

Observed patterns to emulate:
- Public event shell visible immediately (title, date/time, hosts, short description, social proof)
- Guest list teaser shown before full access
- "Restricted Access" gate messaging
- Frictionless phone capture before install handoff
- Mobile-first layout that still reads cleanly on desktop

Required Quests adaptation:
- Keep Quests visual identity (dark navy theme and existing brand language)
- Match Partiful information hierarchy and interaction flow, not visual cloning
- Replace "event" semantics with "quest" semantics everywhere
- Preserve current in-app quest detail as source of truth; web is preview + claim handoff only

### Web page layout requirements (desktop + mobile)

1. **Hero block**
   - Quest title
   - Start date/time (localized where possible)
   - Creator/host avatars and names
   - Short quest description

2. **Social proof block**
   - Participant counts (e.g., accepted/invited)
   - Limited participant avatar row and "view more" affordance

3. **Access gate block**
   - Clear "enter phone to continue in app" message
   - Phone input + submit flow (no OTP on web)
   - Brief privacy copy ("used only to connect your invite in app")

4. **Install handoff block**
   - Primary CTA: "Download Quests and Join"
   - Secondary CTA: "I already have the app" (deep link reopen attempt)

### Explicit non-goals for this phase

- No web account creation
- No referral attribution/reward logic
- No duplicate "web quest system" separate from app quest system
- No edits that alter current native onboarding sequence

### UX acceptance criteria

- On mobile Safari and Chrome, `/q/{code}` renders a polished quest invite page without app install
- User can submit phone and see confirmation that the quest will auto-connect in app when they sign in with that number
- "Download Quests and Join" leads to App Store reliably
- If app is already installed, universal link opens app directly and bypasses web gate
- Desktop renders equivalent information hierarchy with responsive spacing and typography

---

## Web Handoff Architecture (No Referral)

This section defines the implementation target for the new web-to-app join path while deferring referral points.

### Scope guard

- Include: quest preview, phone capture, pending join claim, app handoff.
- Exclude: referral attribution, referral rewards, web account creation.

### Data model (new)

Create a dedicated table for web join intent (do not overload `pending_phone_invitations`):

`pending_link_claims`
- `id uuid pk`
- `phone_hash text not null` (SHA-256 of normalized E.164 + server-side pepper)
- `phone_encrypted text not null` (encrypted normalized E.164)
- `phone_last4 text` (optional)
- `quest_id uuid not null`
- `share_code text not null`
- `status text not null default 'PENDING'` (`PENDING`, `CLAIMED`, `EXPIRED`, `CANCELLED`)
- `captured_at timestamptz not null default now()`
- `claimed_by_user_id uuid null`
- `claimed_at timestamptz null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`

Locked retention values:
- Claim TTL: **72 hours (3 days)**.
- PII retention window for expired claims: **72 hours (3 days)**, then hard delete.

Suggested indexes/constraints:
- Partial unique active claim on `(phone_hash, quest_id)` where status = `PENDING`.
- Index on `phone_hash`.
- Index on `expires_at` for cleanup jobs.
- Enable RLS with deny-by-default policies; only SECURITY DEFINER functions may read/write.

### API contracts (web/edge)

1. `POST /api/link-claims/start`
   - Input: `{ shareCode, phone }`
   - Output: `{ claimId, maskedPhone, status, expiresAt }`
   - Side effects: normalize phone, create/update pending claim.
   - Ownership: website/Cloudflare HTTP endpoint wrapping Quests-owned DB function.

2. `POST /api/link-claims/consume` (called by app backend/RPC path after auth)
   - Input: `{ userId, phone }`
   - Output: `{ consumed, questId, shareCode, joinResult }`
   - Side effects: atomically set `CLAIMED`, join quest, prevent duplicate consumption.

3. `POST /api/link-claims/cleanup` (cron/admin)
   - Expires stale records and clears orphan active claims.

### State machine

`PENDING -> CLAIMED`

Alternate terminal states:
- `PENDING -> EXPIRED`
- `PENDING -> CANCELLED`

### Abuse controls

- Phone submit rate limit per phone + IP + fingerprint window.
- Submission cap and cooldown windows.
- CAPTCHA/Turnstile before submit.
- Device/IP telemetry retained for abuse investigations.
- TTL enforcement on unclaimed pending claims.

Concrete starter thresholds:
- Max 5 submit attempts per IP per hour.
- Max 3 submits per phone per 24h.
- Max 20 submits per share code per 24h from same IP block.
- Cooldown progression for repeated violations (for example 5m, 30m, 24h).

### App resolution point

Resolve pending claims in authenticated onboarding completion flow (same general stage where pending phone invitations are already processed), then route user into quest detail.

Claim consumption rule (locked):
- Consume **up to 3 pending claims** per auth cycle.
- Process in `created_at ASC` order (oldest first).
- Return per-claim outcomes to support deterministic UX.

---

## What Already Exists

| What | Where | Status |
|------|-------|--------|
| Deep link service | `src/services/deepLinkService.ts` | Live for `/q/{shareCode}` and legacy query-format links |
| Associated domains config | `app.config.js` | Already includes `applinks:invite.thequestsapp.com` |
| iOS entitlements | `ios/Quests/Quests.entitlements` | Already includes `applinks:invite.thequestsapp.com` |
| Share modal pattern | `src/components/community/ShareAppModal.tsx` | Reuse pattern for new `ShareQuestModal` |
| Share utilities | `src/services/shareService.ts` | Reuse `copyInviteLink()`, `openNativeShare()` |
| Quest invite service | `src/services/questInviteService.ts` | Uses `deepLinkService.generateInviteLink()` for SMS invites |
| Accept invitation RPC | `accept_quest_invitation()` | Existing, handles pre-invited users |
| App links constants | `src/constants/appLinks.ts` | `getDownloadLink()`, `getInviteMessage()` |
| QR code library | `react-native-qrcode-svg` | Already in dependencies |

---

## Link Format

### New Format
```
https://invite.thequestsapp.com/q/<shareCode>
```
Example: `https://invite.thequestsapp.com/q/K7mP2xRw`

Share codes are 8-character alphanumeric strings. Ambiguous characters (0/O, 1/l/I) are excluded.

---

## Database Migrations

### Migration 1: `add_share_code_to_quests`

Adds the `share_code` column and a helper function for generating codes.

```sql
-- Add share_code column
ALTER TABLE public.quests
  ADD COLUMN share_code TEXT UNIQUE;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_quests_share_code
  ON public.quests(share_code)
  WHERE share_code IS NOT NULL;

-- Helper function to generate random alphanumeric share codes
CREATE OR REPLACE FUNCTION public.generate_share_code(length INT DEFAULT 8)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$;
```

Share codes are generated **lazily** — only when a user first shares a quest, not on every quest creation.

### Migration 2: `get_quest_preview`

SECURITY DEFINER function that bypasses RLS to return safe public quest data for non-participants.

Required hardening updates before rollout:
- Respect `quests.privacy_level` so private quests are not exposed via share code preview.
- Combine sequential queries into one JOIN-based query for efficiency under web traffic.
- Privacy display policy (locked):
  - Show inviter name only.
  - Show basic quest metadata only (title/description/timing/icon/status).
  - Do **not** return participant identity data for preview.
  - For private quests, apply the same minimal preview behavior when link access is provided.

```sql
CREATE OR REPLACE FUNCTION public.get_quest_preview(p_share_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_quest RECORD;
  v_participant_count INT;
  v_creator_name TEXT;
  v_creator_avatar TEXT;
BEGIN
  SELECT q.id, q.name, q.description, q.icon, q.icon_color,
         q.start_time, q.end_time, q.duration, q.duration_days,
         q.frequency, q.status, q.created_by,
         q.is_group_quest, q.badge_background_image_url
  INTO v_quest
  FROM public.quests q
  WHERE q.share_code = p_share_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'quest_not_found');
  END IF;

  IF v_quest.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('error', 'quest_unavailable');
  END IF;

  SELECT COUNT(*) INTO v_participant_count
  FROM public.quest_participants
  WHERE quest_id = v_quest.id
    AND status IN ('ACCEPTED', 'INVITED');

  SELECT p.full_name, p.avatar_url
  INTO v_creator_name, v_creator_avatar
  FROM public.profiles p
  WHERE p.id = v_quest.created_by;

  RETURN jsonb_build_object(
    'id', v_quest.id,
    'name', v_quest.name,
    'description', v_quest.description,
    'icon', v_quest.icon,
    'icon_color', v_quest.icon_color,
    'start_time', v_quest.start_time,
    'end_time', v_quest.end_time,
    'duration', v_quest.duration,
    'duration_days', v_quest.duration_days,
    'frequency', v_quest.frequency,
    'status', v_quest.status,
    'is_group_quest', v_quest.is_group_quest,
    'participant_count', v_participant_count,
    'creator_name', v_creator_name,
    'creator_avatar', v_creator_avatar,
    'badge_background_image_url', v_quest.badge_background_image_url
  );
END;
$$;
```

### Migration 3: `join_quest_via_share_link`

SECURITY DEFINER function for joining a quest via share code. Handles all participant states and enforces daily limits.

```sql
CREATE OR REPLACE FUNCTION public.join_quest_via_share_link(
  p_share_code TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_quest_id UUID;
  v_quest_status public.quest_status;
  v_existing_status public.participant_status;
  v_can_join BOOLEAN;
  v_quest_name TEXT;
BEGIN
  -- Look up quest by share code
  SELECT id, status, name INTO v_quest_id, v_quest_status, v_quest_name
  FROM public.quests
  WHERE share_code = p_share_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'quest_not_found');
  END IF;

  -- Only allow joining ACTIVE or UPCOMING quests
  IF v_quest_status NOT IN ('ACTIVE', 'UPCOMING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'quest_not_joinable',
      'message', 'This quest is no longer accepting new participants');
  END IF;

  -- Check if user is already a participant
  SELECT status INTO v_existing_status
  FROM public.quest_participants
  WHERE quest_id = v_quest_id AND user_id = p_user_id;

  IF FOUND THEN
    IF v_existing_status = 'ACCEPTED' THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_joined',
        'quest_id', v_quest_id, 'quest_name', v_quest_name);
    ELSIF v_existing_status = 'INVITED' THEN
      -- Auto-accept the existing invitation
      PERFORM accept_quest_invitation(v_quest_id, p_user_id);
      RETURN jsonb_build_object('success', true, 'action', 'accepted_existing',
        'quest_id', v_quest_id, 'quest_name', v_quest_name);
    ELSIF v_existing_status IN ('DECLINED', 'LEFT') THEN
      -- Re-join
      UPDATE public.quest_participants
      SET status = 'ACCEPTED', joined_at = NOW(), updated_at = NOW()
      WHERE quest_id = v_quest_id AND user_id = p_user_id;

      INSERT INTO public.quest_activity_tracking (user_id, quest_id, activity_type, created_at)
      VALUES (p_user_id, v_quest_id, 'ACCEPT', NOW())
      ON CONFLICT (user_id, quest_id, activity_type) DO NOTHING;

      RETURN jsonb_build_object('success', true, 'action', 'rejoined',
        'quest_id', v_quest_id, 'quest_name', v_quest_name);
    ELSE
      -- REMOVED status — block rejoin
      RETURN jsonb_build_object('success', false, 'error', 'cannot_rejoin',
        'current_status', v_existing_status);
    END IF;
  END IF;

  -- Check daily quest activity limit
  v_can_join := check_daily_quest_activity_limit(p_user_id);
  IF NOT v_can_join THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached',
      'message', 'You can create or join up to 3 quests in a 24-hour period.');
  END IF;

  -- Insert as new participant with ACCEPTED status (direct join via link)
  INSERT INTO public.quest_participants (quest_id, user_id, status, joined_at)
  VALUES (v_quest_id, p_user_id, 'ACCEPTED', NOW());

  -- Track activity
  INSERT INTO public.quest_activity_tracking (user_id, quest_id, activity_type, created_at)
  VALUES (p_user_id, v_quest_id, 'ACCEPT', NOW())
  ON CONFLICT (user_id, quest_id, activity_type) DO NOTHING;

  -- Update is_group_quest flag if needed
  UPDATE public.quests
  SET is_group_quest = true, updated_at = NOW()
  WHERE id = v_quest_id AND is_group_quest = false;

  RETURN jsonb_build_object('success', true, 'action', 'joined',
    'quest_id', v_quest_id, 'quest_name', v_quest_name);
END;
$$;
```

### Migration 4: `generate_quest_share_code`

Generates a share code for a quest. Returns existing code if one already exists.

Required hardening update before rollout:
- Add explicit ownership/permission validation (not just `auth.uid()` match) so users cannot generate share codes for quests they do not control.

```sql
CREATE OR REPLACE FUNCTION public.generate_quest_share_code(p_quest_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_share_code TEXT;
  v_existing_code TEXT;
  v_attempts INT := 0;
BEGIN
  -- Check if share code already exists
  SELECT share_code INTO v_existing_code FROM public.quests WHERE id = p_quest_id;
  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;

  -- Verify quest exists
  IF NOT EXISTS (SELECT 1 FROM public.quests WHERE id = p_quest_id) THEN
    RAISE EXCEPTION 'Quest not found';
  END IF;

  -- Generate unique code with collision retry
  LOOP
    v_share_code := generate_share_code(8);
    v_attempts := v_attempts + 1;

    BEGIN
      UPDATE public.quests
      SET share_code = v_share_code, updated_at = NOW()
      WHERE id = p_quest_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RAISE EXCEPTION 'Failed to generate unique share code after 5 attempts';
      END IF;
    END;
  END LOOP;

  RETURN v_share_code;
END;
$$;
```

---

## Service Layer

### New: `src/services/questShareService.ts`

Dedicated service for share-link operations:

```typescript
questShareService = {
  // Generate or retrieve share code for a quest (calls generate_quest_share_code RPC)
  getShareCode(questId: string): Promise<string>

  // Get quest preview data for non-participants (calls get_quest_preview RPC)
  getQuestPreview(shareCode: string): Promise<QuestPreviewData>

  // Join quest via share code (calls join_quest_via_share_link RPC)
  joinViaShareLink(shareCode: string): Promise<JoinResult>

  // Build full share URL from code
  getShareUrl(shareCode: string): string
  // Returns: "https://invite.thequestsapp.com/q/{code}"

  // Generate code if needed, copy URL to clipboard, show toast
  copyShareLink(questId: string, questName: string): Promise<boolean>

  // Generate code if needed, open native share sheet with message
  openNativeShare(questId: string, questName: string): Promise<boolean>
}
```

---

## Deep Link Service Updates

Changes to `src/services/deepLinkService.ts`:

### 1. Update base URL
```typescript
const BASE_URL = 'https://invite.thequestsapp.com';
```

### 2. Update `handleDeepLink()`
Parse the new `/q/{shareCode}` path format:
- If path matches `/q/XXXXXXXX` → extract share code, call new `handleShareLink()`
- Keep parsing old `?questId=` format for backward compatibility

### 3. New `handleShareLink(shareCode)` method
- If authenticated → navigate to `QuestSharePreview` screen with `shareCode`
- If not authenticated → save share code to AsyncStorage → auth flow → process after login

### 4. Fix `navigateToQuest()`
Confirm it routes to existing screens only:
- Share links -> `QuestSharePreview`
- Direct quest links -> `QuestDetail` where applicable

### 5. Update pending invite storage
`savePendingInvite()` and `checkPendingInvite()` must support `shareCode` field alongside existing `questId`.

### 6. Update `generateInviteLink()`
Use new domain and support share code format:
```typescript
generateShareLink(shareCode: string): string {
  return `${BASE_URL}/q/${shareCode}`;
}
```

---

## New Screen: QuestSharePreviewScreen

**File:** `src/screens/quests/QuestSharePreviewScreen.tsx`

Landing screen when someone opens a shared link. Shows quest details and a join button.

### Navigation params
```typescript
QuestSharePreview: { shareCode: string; fromDeepLink?: boolean }
```

Register in:
- `src/navigation/types/index.ts` — add to `RootStackParamList`
- `src/navigation/AppNavigator.tsx` — add `<Stack.Screen>`

### UI layout (dark navy theme via Theme.ts)
1. Header with back button
2. Quest badge/icon centered (reuse `QuestBadgeCreation` component)
3. Quest name + description card
4. Info rows: duration, frequency, start date
5. Creator row: avatar + name
6. Participant count
7. Status badge (Active / Upcoming / Ended)
8. Bottom action button: "Join Quest" or "View Quest" (if already in)

### Screen states
| State | Display |
|-------|---------|
| Loading | Shimmer/spinner while fetching preview |
| Preview | Full details + "Join Quest" button |
| Already joined | "You're in this quest" + "View Quest" button → QuestDetailScreen |
| Quest ended | Details shown + "This quest has ended" (no join button) |
| Not found | "Quest not found or no longer available" |
| Daily limit | Daily limit modal (reuse pattern from QuestCreationReviewScreen) |
| Joining | Loading state on button while join RPC runs |

---

## New Component: ShareQuestModal

**File:** `src/components/quest/ShareQuestModal.tsx`

Bottom sheet modal modeled after existing `ShareAppModal.tsx`.

### Props
```typescript
interface ShareQuestModalProps {
  visible: boolean;
  onClose: () => void;
  questId: string;
  questName: string;
}
```

### Features
- Swipe-to-dismiss (copy PanResponder pattern from `ShareAppModal.tsx`)
- Spring animation in/out
- QR code encoding the share link (using existing `react-native-qrcode-svg`)
- "Copy Link" button with success state (checkmark + "Copied!")
- "Share" button → native share sheet with message: *"Join my quest '{name}' on Quests! {link}"*
- Loading state while generating share code on first open
- Error handling (toast if code generation fails)

---

## UI Integration Points

### A. Celebration Modal — `QuestCreationReviewScreen.tsx`

**Status: Removed.** The share button was previously integrated into the quest creation celebration overlay but has been removed. The celebration now auto-dismisses after the animation completes (~800ms hold). Share functionality is available from the quest detail screens (see B and C below).

### B. Quest Detail Screen — `QuestDetailScreen.tsx`

- Add a share icon button (e.g., `MaterialCommunityIcons` `share-variant`)
- Location: header area or alongside existing action buttons
- Tapping opens `ShareQuestModal` with the quest's ID and name
- Available for ACTIVE quests

### C. Upcoming Quest Detail Screen — `UpcomingQuestDetailScreen.tsx`

- Add a share icon button (same pattern as Quest Detail)
- Tapping opens `ShareQuestModal`
- Especially useful here — upcoming quests are the prime time to invite others before the quest starts

### D. Creation Invite Screen — `QuestCreationInviteScreen.tsx`

- Add a small informational row/banner near the top or bottom of the friend list
- Text: *"A shareable invite link will be created with your quest"*
- Subtle styling (not a primary action, just informational)
- No interactive link element here (quest doesn't exist in the database yet)

---

## Config Updates

### `app.config.js`
```diff
  ['applinks:quests.app.link', 'applinks:invite.thequestsapp.com']
```

### `src/services/deepLinkService.ts`
Update base URL constant to `https://invite.thequestsapp.com`.

### `src/constants/appLinks.ts`
Update any domain references if present.

### `ios/Quests/Quests.entitlements`
Auto-updated by Expo build from `app.config.js`, but verify after build.

---

## Manual Setup Steps (Outside Codebase)

These steps must be completed manually by the developer:

### 1. DNS/hosting alignment
- Keep `invite.thequestsapp.com` on Cloudflare Pages for this rollout.
- Keep apex `thequestsapp.com` on GitHub Pages unless intentionally migrating.
- If apex is migrated later, explicitly disable/reconfigure GitHub Pages custom-domain settings to avoid split-host confusion.

### 2. Host AASA File
Place the Apple App Site Association file at:
`https://invite.thequestsapp.com/.well-known/apple-app-site-association`

See [Domain and Hosting](#domain-and-hosting) section above for the file contents.

Requirements: HTTPS, `Content-Type: application/json`, no redirects on `/.well-known/` paths.

### 3. Create web invite experience
Serve at `invite.thequestsapp.com/q/*` for users without the app. Implement the Partiful-inspired invite hierarchy described above, including phone submit and install handoff.

### 3a. Cloudflare Pages routing notes (if hosting on Cloudflare Pages)
- The `_redirects` rule `/q/* /q/index.html 200` can be ignored or return 404 due to loop detection and `404.html` precedence.
- Most reliable fix is a Pages Function catch-all that serves `/q/` for any `/q/*` path:

```
functions/q/[[path]].js

export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/q/';
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}
```

- Optional `_routes.json` to scope the Function to only `/q/*` and avoid loops:

```
{
  "version": 1,
  "include": ["/q/*"],
  "exclude": ["/q/index.html"]
}
```

- Keep the AASA file under `/.well-known/` so it is served as a static asset with JSON headers.

### 4. Validate AASA
After hosting, check Apple's CDN cache:
`https://app-site-association.cdn-apple.com/a/v1/invite.thequestsapp.com`

Apple caches this — propagation may take a few hours.

### 5. EAS rebuild policy
After `app.config.js` domain changes, run an EAS build. The new associated domain won't work on existing app installs until they update.

### 6. TLS and redirect hygiene
- Fix `www.thequestsapp.com` TLS/certificate mismatch behavior.
- Ensure deterministic redirect behavior between `www` and apex.
- Keep `invite` origin and cert chain clean, since universal-link trust is sensitive to redirect/cert issues.

---

## Open Decisions (Product/Legal/Infra)

Resolved decisions:
- Use phone-only claim matching (no web OTP flow).
- Use hashed lookup + encrypted raw phone for `pending_link_claims`.
- iOS-first rollout.
- No legacy `/quest?questId=...` support for this launch.
- Cloudflare protection required before launch.
- TLS/redirect issues fixed before launch.
- Claim TTL and PII retention set to 72 hours.
- Consume up to 3 claims oldest-first.
- Rate limits use documented starter thresholds.
- Preview shows inviter name + basic quest info only; no participant identity details.

Remaining decisions:

1. **Phone capture compliance copy**
   - Final legal copy for phone capture consent, retention window, and disclosure language.

Compatibility guardrail:
- Keep existing `pending_phone_invitations` schema/functions/policies unchanged in this phase.
- Apply hashed+encrypted phone model only to new `pending_link_claims`.
- This avoids regressions in current SMS invite processing surface area.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Quest cancelled/deleted | Preview shows "Quest no longer available" |
| Quest completed/finished | Shows details + "This quest has ended", no join button |
| User already ACCEPTED | "You're in this quest" + "View Quest" button |
| User was INVITED | Auto-accepts existing invitation |
| User LEFT or DECLINED | Allows rejoin |
| User was REMOVED | Blocks rejoin with message |
| Daily limit (3/day) | Shows daily limit modal |
| Not logged in | Save share code → auth flow → QuestSharePreview after login |
| App not installed | Web invite preview + phone submit + install handoff |
| Old `?questId=` links | Still work (backward compatible) |
| Share code collision | Retries up to 5 times in `generate_quest_share_code` |
| Pending claim expires before install | App shows graceful fallback and does not auto-join |
| Submit abuse attempt | Rate limit + cooldown + CAPTCHA challenge |
| Duplicate web submit | Idempotent active claim constraint prevents duplicate active records |
| Multiple pending claims for same phone | Consume all eligible pending claims oldest-first and return per-claim outcomes |
| Phone mismatch (web vs app auth) | No auto-join; show neutral guidance and continue onboarding |
| Consume success but response lost | Retry must return deterministic "already joined/already consumed" state |

---

## Files Summary

### Already Implemented (Do Not Rebuild)

| File | Status |
|------|--------|
| `src/services/questShareService.ts` | Implemented |
| `src/screens/quests/QuestSharePreviewScreen.tsx` | Implemented |
| `src/components/quest/ShareQuestModal.tsx` | Implemented |
| `src/navigation/AppNavigator.tsx` | `QuestSharePreview` registered |
| `src/navigation/types/index.ts` | `QuestSharePreview` types registered |
| `app.config.js` | `invite.thequestsapp.com` associated domain present |

### Net-New Work For This Phase

| File | Changes |
|------|---------|
| `supabase/migrations/*` | Add `pending_link_claims`, RLS policies, claim functions, retention policy |
| `src/services/authService.ts` | Fix `phone_number` -> `phone` profile lookup bug |
| `src/services/postAuthLinkClaimService.ts` (or equivalent) | Add web-claim consumption orchestration |
| `src/screens/start/PhoneNumberScreen.tsx` | UI refresh + pending-claim confirmation feedback |
| `src/screens/start/VerifyPhoneScreen.tsx` | UI refresh to align with onboarding quality |
| Cloudflare website routes/functions | Web `/q/*` experience + phone submit endpoint wrapper |

---

## Verification Checklist

- [ ] **Create quest flow:** Create → celebration plays (logo drops & clicks, checkmark pops) → auto-dismisses → goes to Home
- [ ] **Share from active quest detail:** Open quest → tap share → modal works
- [ ] **Share from upcoming quest detail:** Open upcoming quest → tap share → modal works
- [ ] **Deep link (authenticated):** Open `invite.thequestsapp.com/q/CODE` → app opens QuestSharePreviewScreen → shows quest details → tap "Join" → success → navigates to quest
- [ ] **Deep link (not authenticated):** Open link → redirected to auth → after login → lands on QuestSharePreview → can join
- [ ] **Deep link (no app):** Open link in browser → fallback page with App Store link
- [ ] **Already joined:** Open link for quest you're in → shows "View Quest" instead of "Join"
- [ ] **Quest ended:** Open link for completed quest → shows details + "ended" message
- [ ] **Daily limit:** Join 3 quests in a day → 4th attempt shows limit modal
- [ ] **AASA validation:** Apple CDN returns correct AASA file for domain
- [ ] **Web mobile UX parity:** `/q/{code}` renders correctly on iOS Safari and Android Chrome layouts
- [ ] **Web desktop UX parity:** `/q/{code}` preserves hierarchy and readability on desktop
- [ ] **Phone submit flow:** submit → handoff complete without creating web account
- [ ] **Claim auto-join:** first authenticated app launch consumes pending claim and navigates to quest
- [ ] **Abuse controls:** phone submit rate limits and cooldowns trigger as expected
- [ ] **TLS health:** `invite` and `www` cert/redirect checks pass before broad launch

---

## Onboarding UX Addendum (Phone Screens)

As part of this implementation, improve onboarding consistency:

- Assign a UI-focused agent to review and redesign:
  - `src/screens/start/PhoneNumberScreen.tsx`
  - `src/screens/start/VerifyPhoneScreen.tsx`
- Objective: make these screens simpler and visually aligned with the rest of onboarding while preserving behavior.

Additional user feedback requirement:
- After phone submission in app, show a clear confirmation message/toast when a matching pending link claim exists, e.g.:
  - "Got it. We'll connect this number to your quest after sign in."
