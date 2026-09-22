# Build 15 payment workstream: final merge-agent package

Verified September 22, 2026. Disposition: source package available for reconciliation. Public web-checkout release remains on HOLD pending the provider recovery decision and device qualification.

## Source authority

| Repository | Branch | Reviewed source |
| --- | --- | --- |
| Quests-Improve-Together-App/Quests | `codex/build15-payment-routing-20260921` | `21ebdf19d6777ce16b0b44f5c3ade3a56545b713`, implementation `5029d2724` |
| Nothing-Serious-LLC/QuestsWebpage | `codex/build15-payment-routing-20260921` | Website runtime `4f2cf11`, deployment documentation `333a7f9`, followed by this final package |
| Quests-Improve-Together-App/Quests | `codex/build15-payment-e2e-20260921` | `b8acfb5d9`, historical physical-device and environment receipts |

App PR 122 and website PR 12 remain the existing integration references. Fetch the named branches and inspect current PR heads before selecting changes. The app agent's source combines the approved paywall revisions and retry work. Preserve that scope distinction during reconciliation.

The payment-routing app branch was based on `c40518cf6` before its two final commits. Latest remote main observed here was `aa0ecc854806e92cdffb95c4a822f17a96263951`. Refresh main again at integration. The payment E2E lane contains overlapping browser-return and staging-profile changes; the final routing candidate carries those prerequisites. Avoid applying its older status-only CTA implementation over the latest app source.

An unused review worktree, `Quests-worktrees/build15-checkout-retry-review-20260921`, remains clean at `c40518cf6`. It contains no additional implementation and has no runtime lease. Use the payment-routing branch above as the app candidate.

App source, candidate instructions and text test receipts are committed. The originating app worktree still has untracked `candidate/`, `paywall-review/` and `routing-evidence/` archive directories. Preserve those local visual artifacts; this verification package does not claim that their images are on GitHub. The candidate manifest was rechecked September 22: it now names `21ebdf19d`, implementation `5029d2724`, and all listed source hashes match the worktree. The committed source remains the integration authority.

## Critical change since the previous handoff

The earlier handoff described same-attempt retries that kept every started attempt locked. The latest committed app/backend source introduces `dismissed_attempt` instead:

1. The app records an attempt after Safari returns CANCEL or DISMISS.
2. A later explicit Subscribe tap sends that attempt ID to authenticated `begin`.
3. When RevenueCat lists no outstanding subscription, the backend can retire that exact reserved or started row and create another attempt for the selected plan.
4. Existing started attempts without this signal still enter website recovery.

This changes the safety properties described in the previous handoff. Review `supabase/functions/sign-upgrade-link/handler.ts` around the `dismissed_attempt` transition and `src/components/UpgradeProLink.tsx`. The candidate itself records the unresolved initial-payment/3DS window.

Revoking an old signed capability prevents future inspect/validate calls with that URL. It does not cancel an already-mounted provider checkout or an initial payment already in flight. An empty RevenueCat subscription list cannot establish provider cancellation or idempotency. The website's local recovery checks cannot close that gap after the backend authorizes a new payable attempt.

Release requirement: establish documented provider support and sandbox evidence for safe replacement/resumption, or retain the started-attempt lock and explicitly defer full rendered-form retry. Do not describe the current deliberate-retry implementation as fully protected against duplicate charges. The package remains suitable for source review and controlled qualification with this issue explicit.

## Website compatibility review

Runtime remains the existing embedded RevenueCat Web SDK checkout with version-2 signed claims. Success-return routes, Pro theme, wallet/card configuration and tax behavior are unchanged by this package.

| Case | Source behavior verified | Limit |
| --- | --- | --- |
| Reserved attempt, same plan | `inspect_web` allows entry; `validate_web` atomically claims once before SDK purchase | Real browser interruption timing needs device proof |
| Started attempt, no replacement signal | `inspect_web` returns `purchase_pending`; website renders recovery before SDK configuration/purchase | This deliberately cannot reopen a payable form |
| Started attempt with `dismissed_attempt` | Backend may retire and replace it; new reserved capability can reach a new checkout | Provider duplicate-charge window remains unresolved |
| Delayed entitlement | Website Check again calls `inspect_web`; allow alone never starts another purchase; `already_subscribed` offers app return | Real webhook timing and provider state require sandbox proof |
| Offline recovery | Website preserves uncertainty and allows another local check; app restores interaction and performs bounded background refresh | Offline initial page load can fail before website code runs |
| Selected plan | App checks signed plan; backend signs requested plan on qualified replacement, otherwise reports explicit plan conflict; website maps only signed monthly/yearly IDs | Real provider price/period and cross-tab plan switching need device proof |
| Success return | Automatic and manual paths preserve the originating staging/production scheme through the server return route | Exact signed Build 15 must verify dismissal, navigation and visible entitlement |

This is source review plus separate local test suites using mocked provider/database/browser behavior. No cross-service staging purchase, backend deployment or new phone test was performed during this final review.

## Fresh validation

- Website: `npm test`, 86 passing.
- App: five retry/link/background-refresh/deep-link-return suites, 26 passing.
- Backend: `deno test --no-config --no-lock supabase/functions/sign-upgrade-link/handler_test.ts supabase/functions/sign-upgrade-link/policy_test.ts`, 25 passing.
- Receipts are in `handoff/build15-final-verification-20260922/` in this website branch.
- App owner separately records 101 tests across nine suites, export, lint and baseline TypeScript findings in its committed `handoff/build15-payments-20260921/` receipts. Those broader results were not rerun here.
- Full repository clean, simulator payment proof and physical-device acceptance are separate from these results.

## Deployment and operational state

Website staging runtime: `4f2cf11`, Cloudflare deployment `ec74f3e0-020f-4b23-9f33-e1d6a51f36a7`, stable host `quests-payment-review.pages.dev`. Cloudflare deployment listing was rechecked September 22 and still identifies this deployment as latest in the staging project's Production slot. Previous Chrome readback confirmed the new recovery code and invalid-link fallback. Downloaded binding was staging. This final documentation package does not change that runtime.

The reviewed app handoff supplies no deployment receipt or signed-device acceptance for the latest retry revision; the main testing agent must reconcile any subsequent deployment/build activity. Prior installed staging software carried 3.0.1 build 14 metadata and earlier source. It cannot qualify this final retry candidate.

Website PR 12 merges deploy production through GitHub main. Preserve its paired-backend deployment gate. Native purchase routing also uses the coordinator, so web-off alone does not establish compatibility with an old production signer.

The bounded retry delta contains no new schema migration. The earlier payment-routing migration `20260921162033_payment_routing_configuration.sql` and production coordinator prerequisites still require ledger reconciliation. Preserve the production sandbox-web exclusion and native sandbox behavior.

Historical provider settings and finance research are now included as `BUILD15-TAX-READINESS.md` and `STRIPE-BILLING-ASSESSMENT.md`. Their dated setup sections include superseded pending states; use later device receipts and fresh provider checks for release decisions. Keep the full private business address, tax identifier, account phone and signed checkout URLs out of this public checkout artifact.

## Outstanding before public web-checkout release

1. Resolve and qualify the provider replacement/resumption safety issue above.
2. Deploy the reviewed backend to staging and install a signed app containing the exact integrated source. Test immediate X, rendered-form X, Wallet cancel, 3DS interruption, repeated/concurrent taps, plan change, offline/reconnect and delayed webhook.
3. Complete a deliberate isolated sandbox purchase and verify one payment/subscription, correct account/plan, authoritative Pro, automatic/manual return, persistence, management and reward fulfillment exactly once.
4. Verify a positive New York tax transaction with a valid billing address and matching receipt/tax record. Existing New Mexico zero-tax evidence and the earlier displayed New York estimate do not satisfy that positive-tax case.
5. Reconcile production migration/signer/website/routing and live wallet-domain/tax configuration, then qualify the actual Build 15 artifact and the separately coordinated live purchase.
6. App-owned catalog, restore, Streak Freeze fulfillment, reviewer instructions/screenshots and remaining device-route cases stay in `OPEN-ITEMS.md`. Tax filing frequency/effective date, filing ownership and finance reconciliation retain their operational owners.

A decision to ship other Build 15 features while deferring web checkout must be explicit and must qualify the retained native path with its coordinator dependencies. Source integration, deployment, payment acceptance and public release are separate states.

## Prompt for the main merge agent

Reconcile the Build 15 payment package described in this file. Fetch app branch `codex/build15-payment-routing-20260921` at `21ebdf19d6777ce16b0b44f5c3ade3a56545b713` and website branch of the same name from `Nothing-Serious-LLC/QuestsWebpage`. Read the app's `MERGE-HANDOFF.md`, `CHECKOUT-RETRY-CANDIDATE.md`, and `OPEN-ITEMS.md` alongside this final verification. Preserve approved paywalls, the existing RevenueCat checkout, tax behavior and Pro success-return transport. The latest backend now replaces dismissed started attempts; its provider duplicate-charge window remains unresolved. Keep public web-checkout release on HOLD until documented provider support and sandbox/device evidence close it, or explicitly retain the earlier lock and defer full retry. Reconcile overlapping E2E-lane prerequisites, rerun affected checks after integration, and record the exact candidate SHA. Website PR 12 is a production deployment. Coordinate backend/schema, signed-build and production gates separately. Do not infer release acceptance from passing local tests or from restoring the Subscribe button.
