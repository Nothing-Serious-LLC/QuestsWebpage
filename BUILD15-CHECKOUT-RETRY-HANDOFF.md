# Build 15: Subscribe, dismiss, reopen

Status: website recovery changes implemented and locally tested. App and backend changes below are pending. Full abandonment recovery still needs staging device proof.

## Agreed scope

Elliott's decision on September 21, 2026: keep the current embedded RevenueCat Web Billing checkout, Apple Pay/card, selected plan, tax calculation, and entitlement pipeline. Keep the app's Subscribe button available after closing the website. Upgrade to Pro only after server entitlement confirmation. This decision supersedes the managed Web Purchase Link experiment in `BUILD15-APPLE-PAY-INVESTIGATION.md`.

The app owns browser presentation and access refresh. The website owns checkout and purchase recovery messaging. A return URL can trigger a refresh; server entitlement remains the authority for Pro access.

## Verified cause

`subscribe-app.js` calls `validate_web` immediately before `purchases.purchase()` mounts the form. The backend changes `purchase_attempts.state` from `reserved` to `started` at that point. Closing the containing Safari sheet with X can leave that state untouched. The app sets `webPending` and replaces Subscribe with Check purchase status. Backend `status` releases only `reserved` attempts; repeated `validate_web` refuses a `started` attempt.

Observed staging example: attempt `241487d0-70b0-487b-838e-1a09fb72d8ef` became started at 2026-09-21 23:19:54.701 UTC after an immediate-dismissal test. A started row establishes that the form was opened. It does not establish payment submission. Absence of a webhook cannot settle a potentially chargeable provider operation.

## Ownership and checkout authority

Website lane:

```text
/Users/elliottthornburgsmac/Developer/QuestsWebsite-worktrees/build15-payment-routing-20260921
codex/build15-payment-routing-20260921
GitHub remote: github, Nothing-Serious-LLC/QuestsWebpage
Starting HEAD for this change: eebbddda35df
```

App/backend reference lane, inspected read-only for this handoff:

```text
/Users/elliottthornburgsmac/Developer/Quests-worktrees/build15-payment-e2e-20260921
codex/build15-payment-e2e-20260921
HEAD: b8acfb5d9912dfc1043730eecc0265ea2bfe789c
Earlier recovery implementation: 70e023ca19a675294e02420f3b5f6d3383894cf5
```

The app agent must establish its current branch and integration authority before editing. Preserve other agents' changes and runtime leases. The app reference lane contains payment work that needs deliberate integration with the current Build 15 branch.

## Website changes prepared

- Verified `purchase_pending` and `already_subscribed` page-entry responses render an appropriate recovery notice. Previously they rendered the generic invalid-link page.
- Uncertain payment outcomes offer Check again on the website. This calls `inspect_web`, with one request in flight. It neither mounts another SDK checkout nor reports cancellation.
- An `already_subscribed` response offers Return to Quests. An eligibility allow leaves the uncertainty visible because `inspect_web` currently provides no provider-operation resume decision.
- Remove the instruction to use the app's Check purchase status action and the unsupported blanket claim that cancellation means no charge occurred.
- Keep the existing Pro-themed success screen, 150 ms automatic return, manual return, signed identity, environment binding, provider gate and tax behavior.

Files: `subscribe-app.js`, `functions/subscribe.js`, `functions/subscribe/check.js`, `tests/checkout-recovery.test.mjs`, `tests/payment-routing.test.mjs`.

Compatibility: the backend already supports `inspect_web`. The website proxy now exposes that existing signed action. Existing version 2 claims and response shapes are unchanged. These changes can be staged independently. They do not release the existing started-attempt lock.

## App implementation

1. In `src/screens/UpgradeProScreen.tsx`, keep Subscribe as the web CTA until server-confirmed Pro. Use a short Opening checkout state only while obtaining/presenting the link. Suppress concurrent presentation taps.
2. In the browser close/dismiss/error `finally` path, clear the presentation flags and restore interaction. Closing X should leave Subscribe immediately usable. Refresh entitlement in the background with bounded, serialized requests.
3. Remove the status-only `webPending` CTA branch for web checkout. Avoid running the current mutating `status` cleanup as a prerequisite to every reopen. Audit `heldRail`, plan-selection disabling, polling and `checkPurchaseEligibility` so another guard does not preserve the same lock under a different name.
4. Keep the server-confirmed active subscription behavior and existing native purchase guards. A web pending operation should route to website recovery through a signed link once the backend supports that contract.
5. In `src/components/UpgradeProLink.tsx`, preserve the bounded link request and single browser presentation. A link or network error returns control to Subscribe with concise feedback.
6. Preserve the existing awaited browser dismissal in `src/services/deepLinkService.ts`. On success return, refresh entitlement and display final Pro access only after confirmation. A delayed webhook must not invite a second charge. Ignore stale async results after unmount, sign-out or account switch.

No new signup email or billing address field is part of this app change. No tax or payment-method settings change is required.

## Backend integration contract and remaining decision

Owner: app/backend agent. Relevant files: `supabase/functions/sign-upgrade-link/handler.ts`, `policy.ts`, `handler_test.ts`, and the purchase-attempt schema if needed.

Required externally visible behavior:

| Situation | App | Website/backend |
| --- | --- | --- |
| First Subscribe | Open signed checkout | Validate identity, storefront, routing, plan and provider state |
| X before or after form render | Restore Subscribe immediately | Reopen a payable form when supported provider evidence establishes safety |
| Existing web attempt with uncertain outcome | Open its recovery link | Show recovery without creating another chargeable operation |
| Provider processing or delayed webhook | Refresh access in background | Reconcile the existing operation and prevent a second payment |
| Server-confirmed Pro | Show Pro access | Offer return to app |
| Network failure | Restore Subscribe with feedback | Preserve uncertainty and permit bounded status checks |

A narrow first backend change can reissue a signed capability for an existing web attempt, allowing the app to open website recovery instead of returning `purchase_pending` before opening the browser. Reuse the stored account, route, plan and attempt identity. Handle concurrent `begin` insertion conflicts by rereading the authoritative attempt. Preserve guards for native attempts. A selected-plan change must be explicit; silently signing the previous plan would create a price mismatch. Extend the response/UI contract if the existing attempt requires choosing between plans.

That first change permits browser reopening. Completing the abandoned-form fix additionally requires a supported way to establish that the previous provider operation can be resumed, replaced, or safely invalidated. The pinned Web SDK 1.42.1 public `PurchaseParams` reviewed in this workstream exposes no provider-session resume parameter or pre-confirmation callback. Repeated `.purchase()` calls and repeated metadata attempt IDs do not establish provider idempotency.

Before relaxing `validate_web`, establish and test the provider's supported behavior for an unfinished checkout, a payment in flight, two tabs, and different plans. Scope this investigation to the current SDK/integration. Do not introduce hosted checkout, Stripe Billing migration, an SDK fork, or private API interception as part of this handoff. Report an unresolved provider capability with evidence if the current integration cannot satisfy safe resumption.

Avoid automatic release based on browser close, elapsed time alone, an empty entitlement row, or missing webhook. Those signals cannot exclude a payment in flight. Keep signature/expiry/environment checks, live routing controls, and authoritative entitlement checks on every relevant request.

Database impact: the app presentation and website changes require no schema migration. The backend's attempt-reuse change may fit the existing schema. Durable provider-session identity or additional lifecycle states could require a migration, depending on the supported mechanism found. Confirm that design before claiming database work is unnecessary. Keep database inspection read-only during diagnosis; handle migrations through the release workflow.

## Tests and release order

1. Website source tests: `npm test`. Current result: 86 passing, including actual browser-module execution with a mocked SDK, duplicate status clicks, uncertain payment, offline recovery, existing subscriber, and both return schemes. These tests do not prove real provider duplicate protection.
2. App agent updates `webCheckoutDismissal.test.ts` and `webCheckoutRecovery.test.ts`, then reruns `checkoutDeepLinkDismissal.test.ts` and `proCheckoutReturn.test.ts`. Add immediate X, slow opening, double-tap, background refresh and account-switch coverage.
3. Backend agent adds tests for repeated `begin`, stale signed URLs, concurrent devices/tabs, plan changes, provider timeout, payment in flight and delayed webhook. Keep cross-environment and kill-switch tests. A missing subscription event alone must not pass a safe-to-retry assertion.
4. Deploy the backward-compatible website recovery changes to `quests-payment-review`, paired only with staging. Deploy qualified backend changes to staging, then install the updated native staging app. Expo Go can exercise presentation mocks; the real browser, native purchase SDK and return flow need the payment-capable build.
5. On Elliott's same phone/account: open checkout and immediately X, then Subscribe again; repeat after the form renders; cancel Wallet; reopen. Require an interactive app, the selected plan, and a usable checkout without repeated status-button taps. Then test interrupted authentication, offline recovery and slow webhook handling.
6. Complete one deliberate sandbox purchase. Verify one intended provider subscription/payment, authoritative entitlement, Pro-themed web success, automatic return, persisted Pro after app restart, and subscription management. Exercise manual return separately. Record provider and attempt IDs privately with timestamps; avoid logging signed links, card data or credentials.
7. Integrate the qualified changes into Build 15 and repeat the relevant phone tests against that artifact. Production rollout and Elliott's deliberate live purchase remain separately coordinated release steps. Verify the production domain, live billing/tax mode and production return scheme before payment.

Acceptance: reopening the browser alone is insufficient. The ordinary abandoned-form case must reach a usable checkout, and uncertain prior payments must stay reconciled to the same intended purchase. Until both pass, report the app UX and full retry recovery as separate completion states.

Rollback: revert this website change to its preceding staging deployment if needed. Keep backend changes compatible with older signed links and the installed app during rollout. If a coordinated rollback cannot preserve payment safety, use the existing server routing control before reverting the backend. Production remains behind its release gate.

## Research references

- [RevenueCat Web SDK](https://www.revenuecat.com/docs/web/web-billing/web-sdk)
- [RevenueCat subscription lifecycle](https://www.revenuecat.com/docs/web/web-billing/subscription-lifecycle)
- [Pinned SDK purchase parameters](https://github.com/RevenueCat/purchases-js/blob/1.42.1/src/entities/purchase-params.ts)
- [Stripe PaymentIntent lifecycle and reuse](https://docs.stripe.com/payments/payment-intents)
- [Expo WebBrowser lifecycle](https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/)

## Copyable app-agent handoff

Implement the Build 15 Subscribe/dismiss/reopen change using this document. Elliott approved keeping the existing embedded RevenueCat checkout and simplifying the app button. Own the app presentation change and the paired sign-upgrade-link backend work. Keep Subscribe available after X; refresh entitlement in the background; grant Pro only from server confirmation. Preserve the awaited browser-dismissal fix. The website has local recovery checks and preserves its Pro-themed success return. Establish safe existing-attempt recovery before relaxing the server's started lock. Keep hosted checkout and billing migration outside scope. Verify your worktree authority, preserve concurrent work, test locally and on staging, then provide a device-test candidate and exact remaining gaps. Do not claim the retry issue fixed merely because the button reappears.
