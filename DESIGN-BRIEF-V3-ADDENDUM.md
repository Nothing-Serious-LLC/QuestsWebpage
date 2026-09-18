# V3 addendum: the five worlds (supersedes conflicting V2 lines)

Founder direction 2026-07-28: purple is ONE of the themes, never the identity. The app has five category worlds and a deep asset library (roadmaps per category, category icons, patterns, highlight items, icon packs). Use them. The bar goes up: "getting better" is failing; every section must survive a side-by-side with wizz.xyz and sweatco.in.

## Honest critique of the current build (fix all of these)

1. Monochrome purple everywhere: hero, marquee dots, science, CTA all lean purple. It flattens a five-color brand into one.
2. Nav is threadbare: wordmark plus one pill. Add three quiet anchor links (How it works, Inside the app, Blog) desktop-only, Manrope 600 white/ink per mood. Credibility mass.
3. Hero card floats in space. Ground it in the scene: the milestone medallion overlap is a start; consider a faint path segment threading under the card.
4. Marquee chips are plain dots. Each chip gets its real category icon (16px, category ink).
5. Step-card object zones are floating on white. Give each a pale category band (radius 16, --cat-pale at 60%) containing the object.
6. Only two app screens shown. The five category journey worlds are the app's richest visual asset and appear nowhere.
7. CTA band repeats the hero's purple world. Two identical worlds per page view reads as one-note.
8. Footer is acceptable; lift it with the marketplace white-card treatment on the columns block if cheap.
9. Verify favicon/app icon + og image are wired on every page.
10. Micro-craft: chips and cards need hover states (lift + shadow, 150-220ms); selection color; consistent focus rings; no dead cursor areas.

## The five-worlds system

Categories (tokens already in site.css): mindfulness (purple), recharge (periwinkle), creativity (orange), growth/productivity (gold), social (lime). Roadmap tile sets exist per category in the app repo; ASSET-CATALOG.md lists exact paths once written. Copy the best light tiles per category into assets/img/roadmap/ as optimized web JPEGs (same pipeline as the current mindfulness tiles).

1. **Hero world rotation**: on load, js/site.js sets `data-world="<category>"` on <html>, chosen by day-of-year modulo 5 (stable per day, varied across visits; client Date is fine). The hero scene swaps tile images (CSS `html[data-world="recharge"] .world__tile { background-image: ... }`), the wash gradient swaps to the category family, the hero quest card swaps its category class, quest name, and icon to a matching example quest (mindfulness "Morning Meditation" / recharge "Cold Plunge" / creativity "Daily Sketch" / growth "Read 20 Pages" / social "Sunday Run Club"), and the eyebrow chip dot matches. Wash color families: keep text zones deepened per the scrim contrast rules; each family needs its own scrim base tone (derive from the tile art, verify 4.5:1 body / 3:1 display).
2. **CTA band world**: always a DIFFERENT category than the hero (rotation offset +2). Same swap mechanism, `data-world-cta`.
3. **Five worlds gallery** (new section between Inside-the-app and Science): eyebrow "Pick your path", serif head "Five worlds to grow in." Five tall cards (roughly 200x300 desktop, horizontal scroll-snap row on mobile): each card is its category roadmap art (cover, radius 24) with a bottom gradient scrim carrying the category icon in a 40px cream medallion + category name in white serif 24px + one-line Manrope description. Hover: lift + art scales 1.03. Descriptions: Mindfulness "Breathe, journal, unplug."; Recharge "Sleep, cold plunges, recovery."; Creativity "Sketch, write, make things."; Growth "Read, learn, level up."; Social "Show up with your people."
4. **Marquee chips**: category icon per chip in its ink color; chip dot removed.
5. **Steps**: object zones on pale category bands; real category icons in medallions (swap the hand-drawn moon/sprout for the app's own icons per ASSET-CATALOG when available).
6. **404**: creativity orange world. **q invite**: keeps quest-category theming from its data when available, defaults mindfulness.
7. **Subpage headers**: assign worlds: blog creativity, contact social, privacy recharge, terms recharge, success/get-card/share/pro growth. One tile, compact band, per-page CSS override only (no JS rotation on subpages).
8. **Highlight items and icon packs** (per ASSET-CATALOG once written): use highlight/icon-pack art as small accents in the Inside-the-app bullets and the proof strip stat chips ONLY where they read crisply at 20-24px. No emoji, ever.

## Craft floor additions

- Preloading: hero tile preload must follow the rotation (inject <link rel="preload"> from js after choosing, or accept first-paint fetch; measure and choose).
- All five tile JPEGs stay under 300KB each; gallery cards can share the hero tiles.
- The five-worlds gallery must not ship 5 huge images to mobile at full width: serve the same optimized files, cards are small, fine; add loading="lazy" and explicit dimensions.
- Type scale, spacing rhythm, and easing stay exactly as built; this addendum changes color breadth and content density, never the system.
