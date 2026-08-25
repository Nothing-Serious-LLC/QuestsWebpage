# Handoff: Quests Web Checkout Approved, Production Port Pending (2026-08-24 night)

The Quests Pro web purchase journey is visually approved. Preserve the approved fallback, loaders, checkout header, and completion page unless Elliott gives new feedback. The next work is source packaging, production-domain deployment, and real TestFlight verification. Read this whole file before touching anything.

## Clean source package

- Branch: `release/payment-checkout-20260824`
- Base: GitHub `origin/main` at `611447c`
- Worktree: `/Users/elliottthornburgsmac/Developer/QuestsWebsite-worktrees/payment-checkout-release-20260824`
- Package contents: the four approved checkout-owned files, the six required brand assets, this handoff, and the lane manifest
- Source provenance: all four checkout-owned SHA-256 values match the approved review deployment checkpoint listed below
- Shared design lane: `~/Documents/QuestsWebsite` remains unchanged and retains the marketing lane's working tree
- Deployment state: the package remains undeployed to production. Production Cloudflare Pages and GitHub Pages promotion require Elliott's explicit launch authorization

## Final checkpoint

- Approved review deployment: `44fc6092-2768-4744-911b-087cdd45c54c` at `https://quests-payment-review.pages.dev`.
- Approved checkout-owned paths and SHA-256 values:
  - `functions/subscribe.js`: `b39ba9645b56b27f92e026af2bb63adc1b9723aaf8f555f195e283fed2da2b5b`
  - `subscribe-app.js`: `83638091f07f88f891c3e6335bcd103447054326918a6e125f60d228ff49ce06`
  - `pro/success.html`: `328e4fb72a37f0652d40ffdb3d32f480d640f4ab254b024f8043f2956fdc9b9a`
  - `assets/img/app-icon-sunset.png`: `18dc8835b178d88e026eb351bf480f796494cfd7ec0b5c76caa4cc7373eba819`
- Required tracked assets from `v2-redesign`, also absent from production `main`:
  - `assets/img/quests-wordmark-ink.svg`: `e4721c41156206e2aed4641d18c5a992296ee548106cd8936b75ed5bb1be5814`
  - `assets/img/icon-mindfulness.svg`: `49433f993681172dc6f477cd342db149058ba894d69dcc163daa125609acc0e6`
  - `assets/img/icon-recharge.svg`: `d34a5ca5fdb0be3d14d0e5d5fb1cb99932a934552466bff50444ec381564e02b`
  - `assets/img/icon-creativity.svg`: `34502aea4744ce45623a74ef0149510f080025919ef331d861707b281593d5be`
  - `assets/img/icon-growth.svg`: `2cc3fea4b0339bbd4e93f619073a31ad65fa56cd8ea49f44359e7adc6989695c`
  - `assets/img/icon-social.svg`: `99ab8395d321e01ed7dcb8ff1ad8a1d6de41b6f00cf4f8eab2d501fcde7119bf`
- Production domain state: `invite.thequestsapp.com` still runs the earlier Cloudflare deployment and a fresh staging-signed link reaches its invalid-link fallback. `thequestsapp.com/pro/success` still runs the June GitHub Pages version. The production repos and projects stayed untouched during design review.
- Production port: move the four checkout-owned files plus the six required assets into a clean production-deploy branch, review the ten-file diff with the marketing lane, deploy `quests-invite`, then deploy the apex GitHub Pages success page. Keep `quests-invite-staging` outside this rail.
- Simulator review lease: owner `codex-rc-checkout-review`, UDID `50245DD3-35C4-4452-8681-5E98D360191A`, port `8899`. Safari contains tabs for fallback, monthly, yearly, and completion review.
- Repeatable test state: review user `872c8905-8b24-4226-9d25-05b13b5a6a26` is inactive again. Its Web Billing sandbox subscription expires after five minutes. Confirm the staging entitlement is inactive before minting another signed checkout link. Open `/pro/success?env=staging` directly for completion-page review.

## Standing rules (Elliott, global)
- No em dashes or en dashes anywhere, including code comments and docs. No "not X, but Y" negation framing. Lead with the answer, expert-peer tone.
- Subtext and supporting copy is one sentence with no period.
- One surface at a time; show a screenshot AND a live link each round; multi-item readouts as tables.

## Repos and boundaries
- Website repo: `~/Documents/QuestsWebsite`, branch `v2-redesign`. SHARED with the marketing lane; their uncommitted redesign work is everywhere. NEVER commit, stash, or push here. Touch ONLY: `functions/subscribe.js`, `subscribe-app.js`, `pro/success.html`, `assets/img/app-icon-sunset.png`, this file.
- App repo (brand reference, read-only for this task): `~/Developer/Quests`. Payment workstream state doc: `HANDOFF-PAYMENT-RAIL.md` at its root. Update its "Checkout Design Round 2" section when you finish a session.
- Deploys go ONLY to the Cloudflare Pages review project `quests-payment-review` (wrangler is authenticated). NEVER deploy to `quests-invite` (production) or `quests-invite-staging` (marketing's).

## What is already done and approved
- Interstitial and offerings loader (`#loading` plus `#loading-white`): Pro graphite background with grain and one category glyph at a time appearing and fading in place. The glyphs use the app onboarding masks in canonical mindfulness, recharge, creativity, growth, social order with 320/360/260 ms phases. Reduce Motion holds the first glyph. Approved, preserve it.
- Landing `pro/success.html`: graphite shell, serif `You're Quests Pro!`, automatic deep-link attempt, one `Open Quests` button after 2.4 seconds, and a store link pinned to the viewport bottom. Approved, preserve it.
- Invalid-link fallback: sunset hero icon, serif `Open the app to upgrade`, two store pills, and `Nothing Serious LLC` outside the card at the viewport bottom. Approved, preserve it.
- Checkout header: white Quests wordmark on a graphite panel, quiet grain, cadence-aware `Pro Subscription (Monthly)` or `Pro Subscription (Yearly)`, price, and total row. Decorative category glyphs are removed. Approved, preserve it.

## The checkout page: how styling works (the part still being iterated)
RevenueCat's Web SDK (pinned `@revenuecat/purchases-js@1.42.1`, loaded from esm.sh in `subscribe-app.js`) mounts its checkout INLINE into `#rc-checkout` in our DOM. Two override layers already in `headStyles()`:
1. RC's own CSS variables, set inline by the SDK and overridable because stylesheet `!important` beats inline for custom properties. Already set: `--rc-color-primary` ink `#191919` (+hover/pressed), `--rc-color-accent`/`--rc-color-focus` purple `#A961CC`, `--rc-color-background` cream `#F3F1E7`, `--rc-color-input-background` white, input radii 12px / pill. This reaches deep; even Stripe's spinner renders purple.
2. Class overrides on `rcb-*` elements: seller row (`.rcb-title` + sunset icon via `::before`), eyebrow `.rcb-subscribe-to`, serif product title `.rcb-product-title` (Instrument Serif; the `*:not(iframe)` form is REQUIRED to outrank the universal Manrope rule, source order decides), hairline `.rcb-pricing-table`, Pay button `button.intent-primary` / `[data-testid="PayButton"]`, footer text. Watermark: five category glyphs + grain painted on `#rc-checkout.is-open::before/::after` over the LEFT HALF at `min-width: 900px` (RC reuses the `rcb-header` class on pricing rows, so never attach decor to rcb elements blind).
- To discover real DOM: `chrome --headless=new --virtual-time-budget=15000 --dump-dom <signed-url> > dom.html` then grep classes. Do this before targeting anything new.
- UNREACHABLE by design: Stripe iframe internals (email/card/expiry/CVC/country/ZIP fields, the black wallet bar, the "OR PAY BY CARD" divider) and the "Secure checkout by RevenueCat" line. Do not chase them. Apple Pay hides on this review domain because it is unregistered with Stripe; that is a launch item, ignore it.
- The yellow SANDBOX banner is RC's sandbox-only chrome; ignore it.

## Visual review status

The design round is complete. Begin another visual round only after new Elliott feedback. Keep one change per round, deploy only to `quests-payment-review`, open every shared link on the leased simulator, and provide a screenshot plus a fresh signed link.

## Iteration loop (all proven, copy exactly)
1. Render through the REAL function locally (Node 18+):
```bash
cd <scratch dir> && node --input-type=module - <<'EOF'
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const mod = await import('/Users/elliottthornburgsmac/Documents/QuestsWebsite/functions/subscribe.js?bust1');
const SECRET = 'preview-test-secret';
const uid = '872c8905-8b24-4226-9d25-05b13b5a6a26';
const exp = Math.floor(Date.now() / 1000) + 1800;
const sig = createHmac('sha256', SECRET).update(`${uid}.${exp}`).digest('hex');
const url = 'https://x/subscribe?' + new URLSearchParams({ uid, exp, sig, plan: 'monthly', env: 'staging' });
const res = await mod.onRequestGet({ request: new Request(url), env: { RC_UPGRADE_SIGNING_SECRET_STAGING: SECRET } });
writeFileSync('preview.html', await res.text());
EOF
```
Bump the `?bustN` import suffix every run (Node caches modules).
2. Screenshot: copy preview.html into `~/Documents/QuestsWebsite/`, serve `python3 -m http.server 8799` from there (assets resolve), then
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1200,950 --virtual-time-budget=15000 --screenshot=out.png http://localhost:8799/preview.html` (and 500x950 for mobile; widths under 500 render broken; delete the preview copy after). Add `--host-resolver-rules="MAP esm.sh ~NOTFOUND"` to freeze the interstitial, `--force-prefers-reduced-motion` for at-rest animation frames.
3. Deploy: `cd ~/Documents/QuestsWebsite && npx wrangler pages deploy . --project-name quests-payment-review --branch main --commit-dirty=true` (the `--branch main` flag is REQUIRED; without it the deploy lands as a preview and the apex URL 404s).
4. Mint Elliott a live signed link (valid 55 min, the staging Supabase signer secret sits in `~/.quests/rc-upgrade-signing-secret-staging`):
```bash
UID_T=872c8905-8b24-4226-9d25-05b13b5a6a26
EXP=$(( $(date +%s) + 55*60 ))
SIG=$(printf '%s.%s' "$UID_T" "$EXP" | openssl dgst -sha256 -hmac "$(cat ~/.quests/rc-upgrade-signing-secret-staging)" -hex | awk '{print $NF}')
echo "https://quests-payment-review.pages.dev/subscribe?uid=$UID_T&exp=$EXP&sig=$SIG&plan=monthly&env=staging"
```
Landing: `https://quests-payment-review.pages.dev/pro/success?env=staging`. Fallback: `/subscribe` with no params.

## Context you should know exists (read if needed)
- `~/Developer/Quests/HANDOFF-PAYMENT-RAIL.md`: the whole payment workstream (staging apply runbook blocked on STAGING_DB_URL, freeze rail, E2E recipes, wallet registration gate).
- The uid above is the staging test account; a completed sandbox purchase (Stripe test card 4242...) grants IT Pro on staging via the real webhook. That is fine and useful.
- Brand tokens: `~/Documents/QuestsWebsite/css/site.css` (cream `#F3F1E7`, card `#FDFBF6`, ink `#191919`/`#696969`, purple `#A961CC`, hairline `rgba(25,25,25,0.09)`, grain data URI). Fonts: Manrope + Instrument Serif (both already linked on the checkout page).
- The design is approved. Production packaging and deployment require a clean branch plus marketing-lane review. Keep that as a separate release task with explicit production authorization.
