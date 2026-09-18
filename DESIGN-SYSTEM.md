# Quests web design system

The website uses the app's design system, ported one to one into `css/tokens.css`. The app repo is the source of truth. When a value changes in the app, change it here second. Do not invent new colors, radii, or type sizes on the web; if a need comes up, pick the nearest token.

Verified against the app on 2026-09-17 (app branch `v2/live-review-20260818`, screenshots in `~/Desktop/Quests-Screenshots-2026-09-16`).

## Source map

| Web token group | App source |
|---|---|
| Surfaces, text, actions, accent, borders, misc | `src/uiNext/tokens.ts` (`colors`), `src/ui/theme/onboarding/brand-light.ts` |
| Dark mode | `src/ui/theme/onboarding/brand-dark.ts`, `src/ui/theme/design-system/source/Semantic-Dark.json`, dark derivation method in `src/components/ui/questFeedTokens.ts` |
| Category ramps | `src/components/ui/questFeedTokens.ts` (`LIGHT_RAMPS`), mirrored in `src/uiNext/tokens.ts` (`roadmapAccent`) |
| Category display names | `docs/design-system/quest-category-naming.md` |
| Medallion | `src/components/ui/medallionFigmaConstants.ts` (`MEDALLION_CATEGORY`) |
| Type scale | `src/uiNext/tokens.ts` (`type`), `src/ui/theme/tokens/typography.ts` (`brandDisplay`) |
| Radius, space, motion, opacity | `src/ui/theme/design-system/source/{Radius,Space,Motion,Opacity}.json` |
| Shadows | `src/uiNext/tokens.ts` (`shadows`) |

## Foundations

**Fonts.** Instrument Serif 400 (and italic) for display only. Manrope 400/500/600/700 for everything else. Loaded from Google Fonts with preconnect.

**Light surfaces.** Page `#F3F1E7`. Card `#FDFBF6`. Raised surface `#FEFEFD`. Cards carry a 1px white hairline and the `cardDeep` shadow (`4px 4px 30px rgba(0,0,0,0.05)`).

**Light text.** Display ink `#191919`. Body `#292929`. Secondary `#696969`. Primary button `#191919` with white label, pressed `#101010`.

**Accent.** Purple `#A961CC` in light mode only. Dark mode swaps the accent to Theme silver `#AEAEB2` (approved 2026-07-16). Italic display words ("together.") take the accent.

**Dark surfaces.** Page `#0E0E12`. Card `#1C1C1E`. Raised `#2C2C2E`. Text white, secondary silver. Category ink stays vivid; category tints become 16% alpha washes and 35% alpha rings.

**Categories.** Five families. Display labels are adjectives.

| Label | Family key | Ink | Light fill | Ring (light) |
|---|---|---|---|---|
| Healthy | recharge | `#889FE9` | `#ECF0FE` | `#B0C0F0` |
| Mindful | mindfulness | `#A961CC` | `#F1E2F8` | `#C796DF` |
| Creative | creativity | `#F0925B` | `#FFE4D6` | `#F5B793` |
| Productive | growth | `#DBB66B` | `#F5E9CF` | `#E7CF9D` |
| Social | social | `#A1B717` | `#EEF2D5` | `#C5D26F` |

Glyph SVGs live in `assets/img/icon-*.svg` (filenames keep the family keys).

**Medallion.** 54px face, 2px ring, 24px glyph. The app draws the ring in the family's pale border step; on the web's cream cards that disappears, so the ring uses the medium step and the face takes the light fill. Same family, one step deeper.

**Radius.** 8, 12, 16, 20 (inputs), 24 (cards), 32 (stats cards), 40 (hero cards), 999 (pills).

**Space.** 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 60, 72. Screen gutter 24.

**Type.** Display 56/48/40/32/24 (serif, line height 1.0 to 1.1). Headline 28. Title 16/14 (500). Body 14/20, 12/16. Labels 14 and 12 (500 to 600). Web body sits at 15px for reading comfort, which mirrors the app's plus-one type floor. Nothing renders under 12px.

**Motion.** Durations 100, 200, 300, 400, 600ms. Easings: standard `cubic-bezier(0.4,0,0.2,1)`, decelerate `cubic-bezier(0,0,0.2,1)`, accelerate `cubic-bezier(0.4,0,1,1)`, spring `cubic-bezier(0.34,1.56,0.64,1)`. Reveals use decelerate at 600ms with a 16 to 18px rise. `prefers-reduced-motion` removes all of it.

## Homepage components (`css/landing.css`)

- Intro: the five glyphs hop in on the page color (560ms, 90ms stagger), hold, then the page settles at 1150ms. `?static=1` skips it.
- Nav: frosted wordmark pill and an ink Download pill, with a page-color fade behind.
- Hero: eyebrow, serif H1 ("Grow better / *together.*"), lede, store badges, microline. Children stagger in after the intro.
- Sections are separated by a hairline and use the same eyebrow + serif H2 head.
- Steps: three cards, numbered pill, serif H3, body.
- Categories: five medallion cards (list card on small screens).
- Proof: gold stars, rating, serif quote, two stat cards, source line.
- CTA: sunset app icon, serif H2, badges.
- Footer: wordmark, tagline, flat link row, legal row.

## Rules

- Copy: no em dashes or en dashes, no "not X, but Y" framing, one H1 per page, contractions welcome, never "habit tracker".
- Category labels in noun position take a noun ("Mindful quests").
- Every color in page CSS is a `--q-*` variable. Grep for `#` in `css/landing.css` before committing; the only hits should be in comments.
- Files listed in `PROJECT-FACTS.md` under production infrastructure stay untouched.
