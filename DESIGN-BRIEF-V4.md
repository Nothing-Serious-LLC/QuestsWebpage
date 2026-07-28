# V4: "The Journey" (founder direction 2026-07-28, supersedes V3's full-bleed worlds)

Founder's words: use our category icons (loved assets), let our actual roadmaps frame the mobile experience like the quest detail screen (proceeding through the journey, content getting surfaced), move away from the purple background, use our light/dark mode with category highlights.

## Base: the app's two modes, category color as highlight only

- LIGHT (default): page base `--sand #F3F1E7`, cards white/`#FDFBF6`, ink text. Exactly the marketplace mood sitewide.
- DARK: honor `prefers-color-scheme: dark` plus an `html[data-theme="dark"|"light"]` override hook (no visible toggle yet). App dark tokens: page `#0E0E12`, surfaces `#1C1C1E`, cards `#212121` with 1px `#191919` border, text `#FDFBF6`, secondary `#AAA9A2`, accent silver `#AEAEB2` (purple is light-mode-only per app docs). Category colors appear in dark mode as highlight fills at reduced strength (base color at 20-30% alpha behind icons/chips) so glyphs stay the color moment. Grain overlay persists in both modes. The dark roadmap tiles (`assets/img/roadmap/path-block02a-*-dark.webp`) and dark journey canvases exist for dark-mode art swaps.
- NO full-bleed category-colored backgrounds anywhere. The world wash/scrim system and rotating hero backgrounds are retired. Delete their CSS rather than shadowing it.
- Category highlights live in: the interactive quest card, category icon glyphs (the loved assets: use generously: chips, medallions, milestones, gallery, bullets), pale pattern bands inside cards, the five-worlds gallery art, small accent text.

## The structural idea: the page is a quest roadmap

The app's quest-detail journey (winding path, milestone medallions, content surfacing as you progress) becomes the page's skeleton in both modes.

1. **The path**: one continuous winding SVG path draws down the whole page connecting hero to final CTA. Light mode stroke `#E7E1D2` (deepened sand, reads like the app's pale path recolored for cream) ~22px round caps; dark mode `#2A2A2E`. Scroll-linked draw: stroke-dashoffset advances with scroll progress (rAF + passive scroll listener; reduced motion renders the full path statically). Desktop: the path weaves left-right between section columns; mobile: a journey rail inset ~24-28px from the left edge, exactly like quest detail, with content cards surfacing to its right as the user proceeds.
2. **Milestones**: at each section boundary a 52px medallion sits ON the path: cream face (`#FEFEFD`), 3px cream ring per CARD-SPEC milestone spec, category accent ring color, and the category's REAL blob glyph inside (mindfulness may use the lotus). Section order rotates the five categories: 01 how-it-works mindfulness, 02 inside-the-app recharge, 03 five-worlds creativity, 04 science growth, 05 proof social; the final CTA milestone is the gold "quest complete" moment (use the productivity-gold badge or a gold medallion with a serif check). When a section reveals, its milestone pops (scale 1 to 1.08 to 1, 300ms, spring): content "surfacing" along the journey.
3. **Section eyebrows** become milestone labels: "Milestone 01" style eyebrow in the section's category ink + the section title. This replaces generic eyebrows and makes the sequence real.

## Homepage restructure

- **Nav**: frosted cream (light) / frosted `#1C1C1E` (dark) from the start; ink/cream wordmark per mode; links + Download pill as built.
- **Hero** (cream/dark base, no scene wash): giant serif ink (light) / cream (dark) "Better, *together.*" (italic keeps purple in light mode, silver in dark), subline, badges (official black badges in light; in dark use the white-outline plate variant), microline. The interactive quest card sits center-right with the path starting directly beneath it, curling downward to milestone 01: the card is Day 12 ON the journey. Under the CTAs: a quiet row of the five category glyphs at 28px with the microcopy "Five ways to grow." (the loved icons, front and center). Keep the daily example-quest rotation for the CARD ONLY (data-world now themes just the card + its glyph + name; base never changes).
- **Marquee**: keep, chips with real glyphs + accent hexes (already built).
- **How it works / Inside the app / Five worlds gallery / Science / Proof**: content as built, recolored to base modes, each anchored to its milestone. The five-worlds gallery keeps the light tile art cards in both modes (it IS the category highlight moment; in dark mode use the dark tile variants).
- **Inside the app**: add a third visual if cheap: a tall crop of a journey canvas (`assets/img/journey/*-light.png`, dark variants in dark mode) in a device frame or rounded panel, since the founder wants the real roadmaps present. Optimize crops; never ship the 21MB originals (resize to display, target under 350KB each, delete unused canvases from the repo before commit).
- **Final CTA**: cream/dark, serif "Your friends are waiting.", badges, the gold complete-milestone above it, then the giant wordmark band (ink on cream / white caps PNG on dark) and footer.

## Subpages

Headers lose the purple band: serif ink title on base with a small category milestone medallion + a short path stub motif per page (blog creativity, contact social, privacy/terms recharge, utility pages growth, 404 mindfulness). 404 keeps its roadmap-style card on the base with a path stub that visibly ends (the joke writes itself: the path just stops). q invite: cream base; the roadmap art appears as a rounded framed panel behind/above the exact quest-detail card (postcard treatment), scripts byte-protected as always; fix the "You're invited to a quest!" copy leak on 404 (that line belongs to q only).

## Craft floor

Everything from V2/V3 briefs still applies (easing, reveal system, hover states, focus, touch targets, no dashes, one h1, budgets). site.css may grow to 70KB; prune the dead world CSS to pay for the journey system. The ?static=1 hook must pin: light mode, mindfulness card, full path drawn. ?world= still themes the card for QA. Dark mode QA: capture with --force-dark-mode off but emulate via [data-theme="dark"] (add support) so headless screenshots are deterministic.
