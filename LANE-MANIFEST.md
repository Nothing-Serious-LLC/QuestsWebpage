# Lane manifest: RevenueCat checkout website package
branch: release/payment-checkout-20260824
tip: e57f9e2a7efc0b8edc865f0ff222e4563cea54f5
worktree: /Users/elliottthornburgsmac/Developer/QuestsWebsite-worktrees/payment-checkout-release-20260824

## Ships tonight

- `e57f9e2`: Approved signed RevenueCat checkout, monthly and yearly product copy, dark Pro styling, app return flow, success preview route, Quests wordmark, and approved local category assets.
- Files: `functions/subscribe.js`, `subscribe-app.js`, `pro/success.html`, `assets/img/app-icon-sunset.png`, `assets/img/quests-wordmark-ink.svg`, five category SVGs, and `HANDOFF-CHECKOUT-DESIGN.md`.

## Does NOT ship

- Cloudflare Pages project `quests-payment-review` remains the review deployment.
- Shared `v2-redesign` marketing changes remain in their owner lane.
- Pages projects `quests-invite` and `quests-invite-staging` receive zero deployments from this lane.

## Backend payloads

NONE. This branch contains a Cloudflare Pages function and static checkout assets. It contains zero Supabase migrations, Edge Functions, `app_settings`, or seed changes.

## Overlaps

- `functions/subscribe.js`: preserve per-environment signed-link verification, rendered RevenueCat DOM selectors, monthly and yearly naming, and approved dark checkout composition during marketing integration.
- `subscribe-app.js` and `pro/success.html`: preserve app-scheme return, success preview access, dark Pro styling, and caller-safe app navigation parameters.
- Brand assets: preserve the wordmark and local clean category SVG sources. The decorative checkout icons stay removed.

## Gates run

- Node syntax checks: `functions/subscribe.js` and `subscribe-app.js` green.
- Checkout contracts: monthly, yearly, hybrid production-scheme return, and invalid-link fallback green.
- Source hash comparison: all files match the approved checkout handoff payload.
- Mobile simulator and desktop review: checkout, interstitial, and success state accepted by Elliott.
- Git diff check: green.

## Open items

- Merge with the marketing lane and promote the approved package to production hosting after Elliott's launch authorization.
- Mint and configure the production signed-link secret during production cutover.
- Run staging and production-device E2E tomorrow after George applies the staging backend package.
