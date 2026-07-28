# Asset catalog (staged for the five-worlds build, 2026-07-28)

Everything below is already copied into this repo unless marked "app repo only". Source of truth: /Users/elliottthornburgsmac/Documents/Quests.

## Roadmap tiles (five categories confirmed: mindfulness purple, recharge periwinkle, creativity peach, productivity gold = the growth theme, social lime)
- `assets/img/roadmap/path-block02a-{category}-light.webp` and `02b-...-light.webp`: the most scenic blocks (winding path + category landscape: peaks/ripples, pillow stacks, blossoms, gold staircases, sun domes). 19-340KB, web-ready.
- `assets/img/roadmap/path-block02a-{category}-theme.webp`: neutral sand/cream backdrop with category color only on accents. Use when rotating categories on one layout without jarring background shifts.
- Legacy mindfulness JPEGs from round 1 remain (`*-mindfulness-light-web.jpg`); prefer the webp set going forward.
- App repo only: `assets/uiNext/roadmap/*.png` (804x1510 masters), `assets/redesign/journey-canvases/{category}-light.png` (402x3496 full scroll canvases, future parallax section).

## Category icons (the REAL ones)
- `assets/img/icon-{creativity,growth,mindfulness,recharge,social}.svg`: 32x32 gradient blob glyphs with grain. These ARE the app's medallion icons, rendered at 54px in production medallions. Use them as-is inside medallion circles; do NOT replace with line icons. The lotus line icon (`quest-category-lotus.svg`) is mindfulness-only and stays correct for the hero quest card.
- Chip accent hexes (from src/screens/start/questCategoryAccents.ts): creativity #FFE4D6/#F0925B, mindfulness #F1E2F8/#A961CC, recharge #ECF0FE/#889FE9, productivity #F5E9CF/#DBB66B, social #DFF2E2/#57A56C. Note social here is green, distinct from the tokens lime; use these for chips, keep CARD-SPEC values for card floods.

## Patterns (tileable)
- `assets/img/patterns/tile-{category}-*.png`: 1062x1062 bespoke geometric weaves per category (gold staircase mosaic, lime scallop weave, etc.). Downscale/compress before shipping (target under 250KB, they tile so display size can be 400-530px). Use as low-opacity section backgrounds or card-top bands.

## Badges, flame, misc
- `assets/img/badges/{category}-gold.png` (115x115 3D gem badges; recharge only has `recharge-empty.png`, no earned tiers exist yet, do not present recharge as complete).
- `assets/img/streak-flame.svg` 48x48 gradient flame.
- `assets/img/five-glyphs.png`: 1245x984 render of all five glyphs + serif "Start your first Quest" on cream. Ready-made brand statement image.
- `assets/img/quests-coin.png`, celebration glow art in app repo (`assets/redesign/spark/celebration/`).
- Empty-state renders (cream, on-brand): app repo `assets/figma-import/screens/` and `/components/`.

## "Highlights"
No highlight-named assets exist in the repo; the closest matches are the badge gems and category medallions above (flagged to the founder).
