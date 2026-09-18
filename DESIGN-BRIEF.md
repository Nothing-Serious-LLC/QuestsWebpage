# Quests Website V2: Design Brief

The site is the app's V2 identity brought to the web, with the economy of buzz.xyz (few sections, huge type, tiny copy) and the conversion mechanics of sweatco.in (rating, one stat, repeated store CTAs). One page job: get a visitor to download the app. Light mode only; light IS the brand. The old dark-navy site's look is dead, none of it survives.

## Design tokens (from the app, these are law)

Colors:
- `--cream: #FDFBF6` page base
- `--wash: #F3F1E7` deeper cream for alternate sections and gradients to #FFFFFF
- `--card: #FEFEFD` card surface, border 1px #FFFFFF
- `--ink: #191919` text and primary buttons (pressed #101010)
- `--ink-2: #696969` secondary text
- `--purple: #A961CC` signature accent (deep #9354B3, mid #C796DF, pale #F1E2F8)
- Category colors (accents only, each with pale pair): mindfulness #A961CC/#F1E2F8, recharge #889FE9/#ECF0FE, creativity #F0925B/#FFE4D6, growth #DBB66B/#F5E9CF, social #A1B717/#EEF2D5
- Blurred blob palette (ambient bg): #FFF5F1, #FFB18F, #D5AFE8, #889FE9, #F1E2F8

Type (Google Fonts CDN, preconnect, display=swap):
- Display: Instrument Serif 400 + Italic. Hero clamp(3.5rem, 9vw, 7.5rem), line-height 0.95, letter-spacing -0.02em. Section heads clamp(2rem, 4.5vw, 3.25rem). Italic is the expressive accent word within a headline, used once per headline at most.
- Body/UI: Manrope 400/500/600/700. Body 1.0625rem/1.6 color ink-2 for paragraphs. Eyebrow labels: Manrope 600, 0.8125rem, letter-spacing 0.08em, uppercase, category color.

Shape and depth:
- Radii: buttons/pills 999px, cards 24px, feature cards 32px, hero card 40px
- Shadows: soft `0 4px 15px rgba(0,0,0,0.05)`, stronger hover `0 8px 30px rgba(0,0,0,0.08)`. Never harsh.
- Frosted glass (sticky nav): rgba(255,255,255,0.6) + backdrop-blur 20px, hairline bottom border rgba(0,0,0,0.04)
- Spacing scale: 4/8/12/16/20/24/32/40/64/96/128. Sections breathe: 96 to 128px vertical padding desktop, 64 mobile.

Buttons: pill, ink fill, white Manrope 700 label, 16px, padding 14px 28px; hover lifts 1px with shadow; ghost variant 1.5px ink border. Store badges: official Apple/Google SVG badges (download-on-the-app-store.svg exists in repo; source a matching Google Play badge SVG).

## Signature element: the live quest card

A real, working quest check-in card in the hero. This is the one bold move; everything else stays quiet.

- Looks like the app's hero card: 354px max width, radius 40px, card surface, 1px white border, soft shadow. Inside: category medallion (54px circle, 2px category-color border, category icon SVG), quest name in Instrument Serif (e.g. "Morning Run"), meta row in Manrope (streak flame + "Day 12", overlapping avatar dots +3), bottom hint pill "Hold to check in".
- Interaction: press-and-hold (pointer events, works for touch and mouse). A fill layer in the category pale color rises from the bottom over 1.2s (scaleY, transform-origin bottom). On completion: quick spring, medallion does a coin-flip (rotateY 360deg), hint pill becomes "Checked in today ✓" in category color, 8 to 12 tiny confetti dots (#FFD400 #FF3333 #48FF48 #3BCCFF) burst once. Release early: fill drains back. After 2.5s it politely resets so the next visitor can try.
- `prefers-reduced-motion`: no fill animation, tap toggles the checked state instantly, no confetti.
- Implemented as vanilla JS + CSS in `js/quest-card.js` and inside `css/site.css`. No libraries.

## Homepage architecture (index.html)

1. Nav: wordmark SVG left (recolor #191919), one ink pill "Download" right, frosted, sticky.
2. Hero, full viewport: left column headline "Better, *together.*" (together in serif italic, purple), one subhead sentence, both store badges. Right column: the live quest card, slightly rotated (-3deg), settling to 0 on load. Behind everything: 3 large blurred blobs (blob palette, 40 to 60% opacity, blur 80px+) drifting extremely slowly, plus 4 or 5 small floating category medallions scattered at low opacity. Mobile: stack, card below CTAs, blobs calmer.
3. How it works, three steps (numbered, it is a real sequence): Pick a quest with friends / Check in every day / Earn streaks, Cards, and real rewards. Each step is a 32px-radius card with a category-colored medallion, serif step title, one Manrope sentence. Steps use mindfulness purple, recharge sky, growth gold in that order.
4. Science strip on wash background: giant serif "76%" with the accountability line and citation in small Manrope. One stat on the whole site, this is it.
5. Proof row: 4.9 stars App Store rating, quiet trust line. If curated V2 screenshots exist, a simple side-scrolling row of 2 or 3 device frames; if none pass curation, omit the section entirely. Old dark V1 screenshots are banned.
6. Final CTA on cream: serif headline ("Your friends are waiting."), both store badges again.
7. Footer: wordmark, Instagram/TikTok/X links, Contact, Blog, Privacy, Terms, copyright Nothing Serious LLC. Quiet, small Manrope.

## Other pages

Same nav and footer shell, same tokens. Serif page titles, Manrope prose at 65ch measure, cards where content groups. Pages: privacy, terms, contact, blog, 404, success, get-card, share. The /q invite page gets the V2 skin with its JS logic byte-for-byte preserved. 404 gets one playful serif line ("This quest doesn't exist yet.") and a Download CTA.

## Motion rules

One orchestrated load sequence on the homepage (headline rises 20px + fades 500ms, card settles from -3deg, staggered 100ms). Scroll reveals: single fade-up 400ms, once, threshold 0.2, via IntersectionObserver. Blob drift 60s+ loops. Nothing else moves. All motion gated behind `prefers-reduced-motion: no-preference`.

## Copy rules (apply to every word on every page)

- Tone: motivational, playful, friendly. Contractions everywhere. Plain verbs, sentence case (headlines may capitalize first word only). Specific beats clever.
- Never call it a habit tracker. The category is "healthy challenges" / "habits with friends".
- Absolute formatting rules: no em dashes or en dashes anywhere, ever (hyphens inside compound words are fine). No antithetical or negation framing ("not X, but Y", "X, not Y"); state things affirmatively.
- One stat max sitewide: the 76% accountability stat.
- Buttons say what happens: "Download on the App Store", "Start your first Quest".

## Deck addendum (Quests Sponsorship Deck, added mid-brief by Elliott)

The sponsorship deck defines the brand's pattern language and a second wordmark. Fold these in:

- Giant caps wordmark: `assets/img/wordmark-caps-ink.png` (2241x593, chunky all-caps QUESTS with the swooping Q) and `wordmark-caps-white.png`. Signature use: a full-width wordmark band directly above the footer, ink on cream, spanning the container edge to edge, revealed with the standard fade-up. This is the site's Buzz-style giant-type moment. The small `quests-wordmark.svg` stays in the nav.
- Pattern fields: the deck decorates with gradient geometric pattern tiles, one family per category color. Recreate as inline SVG or CSS (never embed the multi-MB PNGs): lavender gradient dot grid (mindfulness), periwinkle diagonal capsule weave (recharge), acid-lime quarter-circle pinwheel (social), peach rounded-cluster (creativity), gold pixel-step (growth). Reference swatches live in `design-refs/` (local reference only, never link from pages, never deploy).
- Pattern usage: quiet. Low-opacity (6 to 12%) field behind the science strip, and a thin pattern header band on each How-it-works card in its category color. Nowhere else.
- Deck accent palette, decor only, never for text: `#ECFA7A` acid lime, `#FF7F47` orange, `#4D73EF` blue, `#EBD8F5` pale lavender.
- Mobile animation matters most: Elliott specifically loves how clean Buzz feels on mobile. The load sequence, scroll reveals, and hold-to-check-in card must feel native-app smooth at 375px. Animate transform and opacity only.

## Quality floor

Semantic HTML5, one shared `css/site.css`, no frameworks, no build step. Responsive 320px and up, no horizontal scroll. Visible :focus-visible rings (2px purple offset 2px). Alt text on every image. Lazy-load below-fold images. Meta description, OG tags, twitter card, canonical, and JSON-LD on every page. Lighthouse-minded: fonts preconnected, images sized, CSS under 40KB.
