# Quest card ground-truth spec (extracted from app source 2026-07-28)

The LIVE app (the "Home Rework" build the founder screenshots) renders the **uiNext system (System B)**. The website replicates System B exactly. Values quoted verbatim from `src/uiNext/tokens.ts`, `src/uiNext/home/QuestCardNext.tsx`, `src/uiNext/questdetail/journey/CheckInHeroCard.tsx`, `src/uiNext/questdetail/journey/MilestoneMarker.tsx`, `RoadmapPath.tsx`. (A legacy System A with radius 40 exists in `src/components/ui/`; ignore it for the website.)

## Home quest card (the hero check-in card)

- Outer: width 346-354px, **radius 24**, background `#FDFBF6`, border 1px `#FFFFFF`, overflow hidden. Shadow: `#000` at 12%, offset (4,4), blur 15. No squircle corner smoothing on this system.
- Padding: top 24, bottom 32, horizontal 40. Inner column centered, gap 20.
- Structure top to bottom, all centered:
  1. Category medallion: 54x54 circle, bg `#FEFEFD`, border 2px `#F2E8F8`, icon 24x24 (lotus line icon, currentColor purple).
  2. Name block (gap 8): quest name Instrument Serif 400, **32px/32px**, `#292929`; duration line Manrope 14/20 `#696969` (e.g. "Day 12 of 30").
  3. Actions block (gap 20): avatar group (24px circles, 1px white border, -4px overlap; overflow chip bg `#FDFBF6` text `#A961CC` 12/16) + caption Manrope 12/16 `#292929` in the pattern "+N checked-in today" (group) or "N day streak" (solo).
  4. Check-in pill: height 40, min-width 185, radius 999, padding-x 16, NO background at rest (ghost on card surface), label **"Tap & Hold to check in"** Manrope bold 14/20 `#292929`.
- Hold mechanics: press engages after a 400ms tap-disambiguation delay; a bottom-up fill sheet (`scaleY`, transform-origin bottom) rises over **1800ms linear** in the category pale color, with a 250ms opacity fade-in; release within the final 150ms still completes; early release rewinds the fill over 180ms.
- Completion: the WHOLE card floods the category pale color (mindfulness: bg `#F1E2F8`, border `#F2E8F8`), the fill sheet dissolves over 260ms, the pill flips to bg `#FDFBF6` with label in `#A961CC`, the medallion lifts 12px (250ms), coin-flips on Y (400ms), drops back (250ms), card pops to scale 1.04 and springs back. Caption may switch to "Checked in today".
- Category pale pairs (bg/border): mindfulness `#F1E2F8`/`#F2E8F8`, recharge `#ECF0FE`/`#DCE5FB`, creativity `#FFE4D6`/`#FFD9C4`, growth `#F5E9CF`/`#EFDFBD`, social `#EEF2D5`/`#E5EBBE`.

## Quest-detail hero card (the "Daily Meditation" card in the founder's screenshot)

Width 354, radius 24, bg `#FDFBF6`, border 1px `#FFFFFF`, padding 32 top / 40 sides / 32 bottom, gap 20, shadow `#000` 12% (4,4) blur 15. Centered: lotus medallion 54x54 (bg `#FEFEFD`, border 2px `#F2E8F8`) → name Instrument Serif 32/32 `#292929` → "Day N of M" Manrope 14/20 `#696969` → status row (24px overlapping avatars + Manrope 12/16 `#292929`, "N day streak" or "+N checked-in today"). Check-in button 40px tall, radius 999, hold fill `#F1E2F8`, 900ms on this surface.

## Roadmap scene (hero background)

- The scene is REAL ART: PNG tiles copied to `assets/img/roadmap/path-block{00,01,02a,02b,03}-mindfulness-light.png` (804x1510, ratio 1.879), designed to stack flush vertically, full-bleed. Baked path stroke `#F1E2F8`.
- Wash behind/around tiles: `#E5CCF1` with `#C796DF` as mid-gradient stop.
- Milestone medallions (overlay style, if recreated): 52px circle, fill `#A961CC` (current state `#9354B3`), 3px stroke `#FDFBF6`, day number Instrument Serif white 22/30 (current 28/36).
- Optimize tiles for web (resize to display size, target under 300KB each); use one or two tiles max per surface.

## Chips ("1 quest unchecked" style)

Height 32, padding 12x/6y, radius 999, Manrope 14/20, gap 4; fill `rgba(255,255,255,0.6)`, border 1px `#FDFBF6`, label `#292929`; shadow white 50% offset (0,4) blur 30.
