# Web Team — Phase 3 Continue-Work Checklist

**Date:** 2026-02-10
**Branch:** `feat/invite-web-handoff-phase3`
**Scope:** invite subdomain only — do NOT touch `index.html` or main site files

---

## Setup

```bash
# 1) pull latest + branch
git checkout main
git pull
git checkout -b feat/invite-web-handoff-phase3

# 2) run local Cloudflare Pages runtime
npx wrangler pages dev . --port 8788

# 3) set/update required project secrets (Cloudflare Pages)
npx wrangler pages secret put SUPABASE_URL --project-name <pages_project>
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name <pages_project>
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name <pages_project>

# 4) verify invite-surface-only scope (no main homepage edits)
git diff --name-only origin/main...HEAD
# Allowed: q/*, functions/api/link-claims/*, functions/q/*, _routes.json, _headers, 404.html, docs/*

# 5) deploy preview/prod when ready
npx wrangler pages deploy . --project-name <pages_project>
```

---

## MUST FIX before deploy (HIGH)

### H1. Commit all untracked files
```bash
git add _routes.json functions/api/ docs/
git commit -m "Add API endpoint, routing config, and implementation docs"
```
Without `_routes.json`, Functions run on ALL routes and break AASA serving.

### H2. Replace placeholder credentials in `q/index.html`
- **Line ~1379**: `SUPABASE_URL` — replace `'https://YOUR_PROJECT.supabase.co'`
- **Line ~1380**: `SUPABASE_ANON_KEY` — replace `'YOUR_ANON_KEY'`
- **Line ~1782**: Turnstile `sitekey` — replace `'0x4AAAAAAA_PLACEHOLDER_SITE_KEY'`

### H3. Fix fail-open rate limiting → fail CLOSED
**File:** `functions/api/link-claims/start.js` lines 160-215

Current code skips all rate limits when KV is unavailable. Change the `else` block:
```js
// BEFORE (fail-open — unsafe)
} else {
  console.warn("RATE_LIMIT KV binding not available — skipping rate limiting");
}

// AFTER (fail-closed)
} else {
  console.error("RATE_LIMIT KV binding not available — rejecting request");
  return jsonResponse(503, { error: "service_unavailable" });
}
```

### H4. Fix CORS conflict — remove static CORS from `_headers`
The `_headers` file sets a single-origin CORS for `/api/*` that overwrites the middleware's dynamic multi-origin CORS. Remove lines 15-19 from `_headers`:
```
# DELETE these lines from _headers:
/api/*
  Access-Control-Allow-Origin: https://invite.thequestsapp.com
  Access-Control-Allow-Methods: POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type
  Access-Control-Max-Age: 86400
```
The middleware at `functions/api/link-claims/_middleware.js` already handles CORS correctly with a dynamic origin allowlist.

### H5. Add missing security headers to `_headers`
Add to the `/*` block:
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```
Add a new block for `/q/*` with CSP:
```
/q/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; img-src 'self' https://*.supabase.co data:; frame-ancestors 'none'
```

### H6. Fix share code regex in `start.js`
**Line 16** — the current regex accepts `l` but `generate_share_code` excludes it:
```js
// BEFORE
const SHARE_CODE_RE = /^[A-HJ-NP-Za-hj-np-z2-9]{8}$/;

// AFTER (excludes l to match generate_share_code charset)
const SHARE_CODE_RE = /^[A-HJ-NP-Za-hj-kmnp-z2-9]{8}$/;
```

### H7. Create and bind RATE_LIMIT KV namespace
```bash
npx wrangler kv namespace create RATE_LIMIT
# Then add binding to wrangler.toml or Cloudflare Pages dashboard
```

---

## SHOULD FIX before broad rollout (MEDIUM)

### M1. Validate `icon_color` before CSS injection
**File:** `q/index.html` ~line 1496
```js
// BEFORE
if (data.icon_color) {
  iconEl.style.background = ...

// AFTER
if (data.icon_color && /^#[0-9a-fA-F]{6}$/.test(data.icon_color)) {
  iconEl.style.background = ...
```

### M2. Validate `creator_avatar` URL
**File:** `q/index.html` ~line 1514
```js
// BEFORE
if (data.creator_avatar) {

// AFTER
if (data.creator_avatar && data.creator_avatar.startsWith('https://')) {
```

### M3. Validate Turnstile hostname server-side
**File:** `start.js` after line 154
```js
if (!turnstileResult.success) {
  return jsonResponse(403, { error: "turnstile_failed" });
}
// ADD: hostname validation
if (turnstileResult.hostname !== 'invite.thequestsapp.com') {
  return jsonResponse(403, { error: "turnstile_failed" });
}
```

### M4. Map `already_claimed` to idempotent response
**File:** `start.js` ~line 250
```js
if (result.error === "quest_not_found" || result.error === "quest_unavailable") {
  return jsonResponse(404, { error: "quest_not_found" });
}
// ADD:
if (result.error === "already_claimed") {
  return jsonResponse(200, {
    claimId: result.claim_id,
    maskedPhone: result.masked_phone,
    status: "ALREADY_CLAIMED",
    expiresAt: result.expires_at,
  });
}
```

### M5. Update copyright year
**File:** `q/index.html` ~line 1297
```
&copy; 2025 → &copy; 2026
```

### M6. Use consistent share code extraction across all scripts
The data-fetch script uses strict regex `/^\/q\/([A-Za-z0-9]{8})$/` but bootstrap and phone-capture use loose path splitting. Align all three to use the strict regex.

---

## Backend coordination — BLOCKING

Before the phone submit endpoint can work end-to-end, the backend team must create:

1. **`pending_link_claims` table** (per spec section 3.1)
2. **`start_link_claim` Supabase RPC** — called by `POST /api/link-claims/start`
   - Input: `(p_share_code text, p_phone text, p_phone_last4 text)`
   - Output: `{ claim_id, masked_phone, status, expires_at }` or `{ error: "quest_not_found" | "quest_unavailable" | "already_claimed" }`

**Decision needed before endpoint finalization:**
Either the backend `start_link_claim` accepts raw `{ shareCode, phone }` and handles hashing/encryption internally (recommended), OR the web endpoint must compute and send `phone_hash` + `phone_encrypted` exactly as backend expects. Current implementation sends raw phone — backend should handle crypto.

---

## Scope guard

Allowed files in this PR:
- `q/*`
- `functions/api/link-claims/*`
- `functions/q/*`
- `_routes.json`
- `_headers`
- `404.html`
- `docs/*`

**NOT allowed** (require separate review):
- `index.html` (main website)
- `styles.css` (main website)
- `.well-known/*` (already correct)
- Any file outside invite scope

---

## Acceptance criteria

- [ ] `npx wrangler pages dev . --port 8788` serves `/q/test1234` with quest preview UI
- [ ] Phone submit returns structured response (once backend RPC exists)
- [ ] Rate limiting returns 429 with correct `Retry-After` header
- [ ] Rate limiting returns 503 when KV is unavailable (fail-closed)
- [ ] "I already have the app" attempts universal link, falls back to App Store after 1.5s
- [ ] Error states render correctly (invalid code, expired quest, timeout)
- [ ] `git diff --name-only origin/main...HEAD` shows only invite-scope files
- [ ] No placeholder credentials remain in committed code
- [ ] AASA still validates at `https://app-site-association.cdn-apple.com/a/v1/invite.thequestsapp.com`
