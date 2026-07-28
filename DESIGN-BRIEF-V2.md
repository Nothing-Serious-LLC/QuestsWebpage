# Quests Website: V2 total redesign brief ("The Quest World")

The first redesign read cheap and empty: washed-out cream, thin sections, an invented card, no real product anywhere, decoration instead of substance. Everything visual gets rebuilt. This brief supersedes DESIGN-BRIEF.md wherever they conflict. Copy from COPY.md stays unless noted. All old copy rules still apply (no em/en dashes, no antithetical negation framing, tone rules).

## The two moods (both straight from the live app)

**World mood** (hero, final CTA band, q invite page, page headers): the app's quest-world scene, built from the app's REAL artwork. Base wash gradient `#E5CCF1` with `#C796DF` mid stop (the app's journey gradient), deepening toward `#A961CC`/`#9354B3` in zones that sit behind text; over it, one or two of the real roadmap tiles from `assets/img/roadmap/` (804x1510 art with the baked `#F1E2F8` winding path, dot grids, waves, scallops), positioned large and cropped like the app screenshot at `assets/img/app-screen-roadmap.png` (view it), plus a fine grain overlay (SVG feTurbulence data URI at 3-5% opacity). Text on world mood: white `#FFFFFF` for the display headline over deepened zones (large-text contrast 3:1 minimum, add a soft radial deepening scrim behind text areas), ink `#292929` only where the wash stays pale. Optimize tiles to display size, under 300KB each.
**Utility mood** (content sections, subpages): marketplace screen language. Background `#F3F1E7`. Cards are pure white `#FFFFFF`, radius 24-28, borderless, shadow `0 1px 2px rgba(25,25,25,.04), 0 8px 24px rgba(25,25,25,.06)`. Serif section titles in ink, left-aligned in containers, generous but DENSE: every section holds a real object (card, chip, device frame, stat), never an empty color band.

Fonts stay Instrument Serif (display) + Manrope. Type scale up across the board: hero clamp(3.5rem, 8.4vw, 7rem) white serif; section heads clamp(2.25rem, 4.5vw, 3.5rem).

## The card (zero improvisation)

Replicate the app's quest cards EXACTLY per CARD-SPEC.md (extracted from app source; if a value is missing there, read the source file cited rather than guessing). Two variants used on the site:
1. **Hero check-in card**: the app's home quest card with the hold-to-check-in interaction (fill rise, medallion coin-flip, hint pill swap, confetti, polite reset; reduced-motion tap-toggle). Exact layout, spacing, type sizes, colors from spec.
2. **Roadmap-style card** (used in the app section or 404): centered circled lotus medallion top-center, centered serif quest name, centered Manrope meta lines, exactly like the live "Daily Meditation / Day 30 of 30 / 29 check-ins" card.
Existing js/quest-card.js state machine logic may be reused; markup and CSS must be rebuilt to spec.

## Homepage

1. **Nav**: transparent over the hero (white wordmark SVG recolor, white outline Download pill); on scroll past hero, frosted cream with ink wordmark and ink pill (class swap via IntersectionObserver). Mobile identical.
2. **Hero, full viewport, world mood**: winding path + milestone medallion in scene behind. Left: eyebrow chip (white pill, "The home of the healthy challenge"), giant white serif "Better, *together.*" (italic word in pale lavender `#EBD8F5`), one white subline, store badges (white-bordered variants for purple), "Free to download" microline. Right: the hero check-in card at exact app size, floating with a soft ground shadow, subtle settle-in on load. Mobile: stacked, card fully above the fold.
3. **Challenge marquee** (bridges world to cream via curved seam): one slow auto-scrolling row of white pill chips with category-tinted dots: 75 Hard, Sober October, Dry January, C25K, Cold Plunge, 10,000 Steps, 30 Days of Yoga, No-Sugar Month, Read Daily, Meditation Streak. Pauses on hover, respects reduced motion (static wrap). Communicates 100+ challenges with real density.
4. **How it works**, utility mood, 3 white cards: each card contains a real mini-object rendered in HTML/CSS (01 Pick: three tiny challenge chips; 02 Check in: a miniature quest card mid-fill; 03 Earn: streak flame chip + points pill + tiny Quest Card back). Serif titles, one sentence each, category ink accents. Numbered 01/02/03.
5. **Inside the app**: two REAL device frames (CSS iPhone frames with notch) showing assets/img/app-screen-roadmap.png and app-screen-marketplace.png at crisp scale, each with a serif feature title + two short Manrope bullets beside it (roadmap journeys and daily check-ins; points, streaks, and the rewards marketplace). Alternating left/right on desktop, stacked on mobile. Lazy-loaded.
6. **Science**, utility mood: white card on cream containing giant serif 76% + tight copy + source line; faint lavender dot-grid pattern inside the card edge only.
7. **Proof strip**: 4.9 gold stars + "4.9 stars on the App Store" + three stat chips (100+ curated challenges / Free to download / iOS and Android). No invented testimonials, ever.
8. **Final CTA, world mood band**: "Your friends are waiting." white serif, subline, badges. Curved top seam.
9. **Wordmark band + footer**, utility mood: keep giant caps wordmark (ink on cream); footer becomes denser: brand column (small wordmark, one line, social links) + Product column (Download, Blog, Contact) + Legal column (Privacy, Terms) + the copyright row.

## Subpages (all of them)

Shared shell: nav + a compact world-mood page header band (white serif page title + one-line subtitle on the purple scene, ~240px tall, grain + one wave motif) + cream utility body + wordmark band + footer. Apply to blog (white post cards, category color chip, hover lift), contact (cards as now but on the new shell), privacy/terms (white content card, TOC card), 404 (world-mood full-bleed with roadmap-style card saying the quest doesn't exist), success/get-card/share/pro-success (compact centered white cards on cream, preserved scripts untouched per PROJECT-FACTS). q/index.html: full world mood (it is the invite moment); scripts byte-protected as always.

## Craft floor (what makes it feel expensive)

- Grain overlay on every world-mood surface; layered two-part shadows everywhere a card floats.
- One easing everywhere: cubic-bezier(.2,.8,.2,1); micro-interactions 150-300ms; reveals fade+rise 12px once.
- Curved section seams between world and cream (border-radius on a full-width seam div, like the app's card-over-scene layering), never straight color joins.
- Store badges: official black badges on cream; white-outline variants on purple.
- No blobs, no floating glyphs, no decorative pattern bands on step cards, no emoji anywhere.
- Cream text on purple must hit 4.5:1 (use #FFFFFF/#FDFBF6 on the deeper gradient stops for text zones); focus-visible rings pale lavender on purple, purple on cream; all touch targets 44px+; body text 16px+ on mobile; no horizontal scroll at 320px.
- Performance: single site.css (rebuild; delete unused v1 rules; budget 55KB), screenshots as sized PNGs with width/height attributes, lazy below fold, fonts preconnected, LCP target under 2s on 4G.

## Review loop

The design lead screenshots at 1280 and 375 after every build round and files exact fixes; expect 2-3 rounds minimum before sign-off. The bar: put this next to sweatco.in and wizz.xyz and it holds.
