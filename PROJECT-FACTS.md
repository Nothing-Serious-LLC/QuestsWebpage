# Project facts (read before touching anything)

## Workspace
- Working copy: `/Users/elliottthornburgsmac/Documents/QuestsWebsite`, branch `v2-redesign`. Origin points at a local clone only. Never push, never commit unless the lead asks.
- The live site: apex `thequestsapp.com` deploys from GitHub Pages, `invite.thequestsapp.com` from Cloudflare Pages (same repo). Nothing we do here can touch production until Elliott merges and pushes later.

## Hosting, DNS, search (verified 2026-09-17)
- DNS at GoDaddy (ns59/ns60.domaincontrol.com). Apex A records -> GitHub Pages (185.199.108-111.153). `www` CNAME -> `nothing-serious-llc.github.io`. `invite` CNAME -> `quests-invite.pages.dev`. `invite-staging` -> `quests-invite-staging.pages.dev`. `pay` -> GoDaddy paylinks.
- GitHub Pages serves the apex: `_headers`, `_redirects`, `_routes.json` and `functions/` are ignored there. They apply only on Cloudflare Pages (`invite.`). GitHub Pages resolves extensionless URLs (`/blog` -> `blog.html`) natively; `/blog/` is covered by `blog/index.html`.
- App share links: the app builds `https://invite.thequestsapp.com/p/CODE` and `/q/CODE`. Both are served by `functions/p` and `functions/q` on Cloudflare; AASA on `invite.` and apex list `/q/*`, `/p/*`, `/quest*`, `/pro/*`. Checkout return lands on apex `/pro/success`.
- Google Search Console: Domain property `thequestsapp.com`, verified via DNS TXT (`google-site-verification=dK2naEC926fy_-zqcfunAeh2vUB_asITNK-LPLmjrK8`, keep this record). Sitemap `https://thequestsapp.com/sitemap.xml` submitted. Account: nothingserious.team@gmail.com.
- Fonts are self-hosted (`css/fonts.css`, `assets/fonts/woff2/`). Only `success.html`, `pro/success.html`, `q/index.html` and the Cloudflare functions still load Google Fonts; their CSP in `_headers` allows it.

## Files you must NOT modify (production infrastructure)
- `functions/` (all of it: q renderer, subscribe checkout, link-claims API)
- `.well-known/` (AASA + assetlinks, universal links break if these change)
- `_headers`, `_redirects`, `_routes.json`, `CNAME`, `robots.txt`
- `QuestCard.pass/`, `QuestCard.pkpass`, `fix-and-rebuild-pass.py`, all `*.sh` scripts
- `subscribe-app.js`, `subscribe-boot.js`
- Inside `q/index.html`: every `<script>` block, the Supabase URL/key, the link-claims fetch logic, and all meta/AASA-related tags must survive byte-for-byte. Only markup structure and styling around them may change.

## Exact URLs (use verbatim)
- App Store: `https://apps.apple.com/us/app/quests-social-habit-tracking/id6745767553`
- Google Play: `https://play.google.com/store/apps/details?id=info.nothingserious.quests`
- Instagram `https://instagram.com/quests.app`, TikTok `https://tiktok.com/@quests.app`, YouTube `https://www.youtube.com/@questsapp`. No X account is linked.
- Canonical site: `https://thequestsapp.com/`
- Copyright: Nothing Serious LLC

## Product truths (for copy)
- iOS live, 4.9 stars on the App Store. Android listing exists; show both store badges.
- Quests are time-bound social challenges (75 Hard, Sober October, Dry January, C25K) done with friends: daily check-in, streaks, Sparks, leaderboards, Points, rewards marketplace, collectible quest Cards, category badges. 100+ curated challenges plus custom and community ones.
- Locked anchors: "Quests: Habits with Friends" (title), "the home of the healthy challenge", "Strava made running social. We're doing it for the rest of habits.", "You're better at building habits when you do it with people you care about."
- The one stat: 76% goal achievement with weekly friend accountability vs 35% going it alone (Dominican University of California study). Verbal framing "more than doubles your odds" refers to this same study and may accompany the number.
- Deck language worth reusing: "Habits are hard to build", "Your friends' habits are contagious", "grow better together", "beautiful, humanist, and effective".
- Never call it a habit tracker. Category words: healthy challenges, habits with friends.
- Tone: motivational, playful, friendly; contractions; specific over clever.
- Hard formatting rules for ALL copy: no em dashes or en dashes ever; no "not X, but Y" / antithetical negation framing; state things affirmatively.

## Assets already staged
- `assets/fonts/` Manrope + Instrument Serif TTFs plus `woff2/` subsets that pages load via `css/fonts.css`
- `assets/img/` wordmark SVG (nav), caps wordmark PNGs (footer band), category icon SVGs, lotus SVG, coin PNG
- `assets/lottie/` animated logo JSONs (optional, only if used tastefully and inline, no external players)
- `design-refs/` pattern swatches, reference only, never linked from pages
- Store badge: `download-on-the-app-store.svg` in repo root; create a visually matched Google Play badge SVG.

## Old site pages to replace (keep filenames)
`index.html`, `blog.html`, `contact.html`, `privacy.html`, `terms.html`, `404.html`, `success.html`, `get-card.html`, `share.html`, `q/index.html` (reskin only). Legal text content in privacy/terms must be preserved word-for-word, only restyled. Contact page email/links preserved.

Stylesheets today: the homepage is `css/tokens.css` + `css/landing.css` + `js/landing.js`. Every other page (blog, articles, contact, legal, share, card, 404) is `css/tokens.css` + `css/page.css` + `js/page.js`, which carry the same nav, backdrop glyphs and footer as the homepage. `css/site.css`, `js/site.js` and `css/page-*.css` are the previous system and no page references them.
