# Build 15 signed checkout: website package

September 22 closeout: [final merge package](BUILD15-FINAL-MERGE-PACKAGE.md) owns the latest retry-candidate review and release disposition. The dated receipts below describe earlier deployments. Final app candidate `21ebdf19d` (implementation `5029d2724`) is verified in source and on GitHub. Its handoff has no paired retry-backend deployment or signed-device acceptance receipt. Provider replacement safety during initial payment remains unresolved. [The reconciled retry contract](BUILD15-CHECKOUT-RETRY-HANDOFF.md) records the final behavior and staging checklist.

Status 2026-09-21: reviewed website source is deployed to staging. Paired staging functions and the production sandbox-web exclusion are deployed. The annual Apple Pay staging purchase and production web-sandbox exclusion are verified. Positive New York tax, remaining failure cases, and final Build 15 acceptance remain pending. Production checkout activation and real charges or refunds retain their own gates. The Build 15 Ledger owner keeps app integration and release authority.

Pairs with Quests app branch `codex/build15-payment-routing-20260921` (PR 122) and its `handoff/build15-payments-20260921` acceptance ledger.

Separate investigation: [Stripe Billing migration assessment](STRIPE-BILLING-ASSESSMENT.md) covers Link and Cash App Pay, account-verified fees and tax gaps, client/database impact, and the proposed staging/production qualification matrix. The migration remains unimplemented and has its own acceptance gates.

Launch priority approved by Elliott: retain RevenueCat Billing, cards and Apple Pay; complete actual sales-tax collection and Build 15 acceptance. [Tax readiness and address collection](BUILD15-TAX-READINESS.md) records the saved provider changes, pending proof, and finance handoff. Future payment-method expansion is deferred.

## What this package contains

| Area | Files | Source authority |
|---|---|---|
| Signed checkout contract | `functions/subscribe.js`, `functions/subscribe/policy.js`, `functions/subscribe/check.js`, `subscribe-app.js`, `_routes.json` | Prepared commit `7b8d859`, completed here |
| Approved checkout visuals | `functions/subscribe.js`, `subscribe-app.js`, `pro/success.html` | Commit `e57f9e2`. All four SHA-256 values in `HANDOFF-CHECKOUT-DESIGN.md` match that commit |
| Tests | `tests/payment-routing.test.mjs` | This package |

Visual integration notes:

- The six category and wordmark SVGs named in the design handoff are already on `main` with matching hashes.
- `assets/img/app-icon-sunset.png` stays at marketing's `main` version. It is the same artwork recompressed (19.9 KB against 36.6 KB) and 22 marketing pages reference it.
- `pro/success.html` is the approved graphite page plus marketing's three sitewide favicon links from `749355d`. Marketing made no other change to that file.
- No other marketing file is touched.

## Contract

Request: `/subscribe?version=2&uid=&attempt=&exp=&plan=&env=&appscheme=&storefront=&sig=`. Every parameter except `sig` is a signed claim, forwarded to the backend byte for byte. The website holds no signing secret.

| Gate | Where | Backend action | Closed result |
|---|---|---|---|
| Page entry | `GET /subscribe`, server side | `inspect_web` | Pending/already-subscribed recovery notice for verified capabilities; generic fallback for invalid/unavailable links |
| Immediately before provider call | `POST /subscribe/check`, before `purchases.purchase()` | `validate_web`, atomic reserved-to-started claim | Recovery or refusal notice; no additional SDK purchase |
| Website status check | Check again through `POST /subscribe/check` | `inspect_web` | Preserve uncertainty; confirmed entitlement offers app return |
| Explicit SDK cancellation | `POST /subscribe/check` | `finish_web`, outcome cancelled | Backend cancellation handling; other browser-reported outcomes rejected |

The paired backend owns signature, expiry, entitlement, provider subscription state, storefront and routing checks. The website fails closed on transport errors and refusals. Version-2 URL claims and website inspect/validate/finish contracts remain unchanged by the final app retry candidate.

Final dismissal/retry behavior:

- Browser CANCEL or DISMISS immediately restores Subscribe and plan interaction. Entitlement refresh runs in the background. The app remembers the exact attempt in memory, scoped to account and environment.
- On the next explicit Subscribe tap, the authenticated app-to-signer request includes `dismissed_attempt`. After fresh entitlement/provider and routing checks, the backend may retire that exact open web attempt and create or reuse the next unique reserved attempt for the selected plan. This signal is outside the website URL contract.
- Old links fail state inspection/validation. Existing entitlement, known provider-pending, native-purchase and concurrent-initiation guards remain. A different concurrent plan yields an explicit conflict.
- Without an observed dismissal marker, existing started attempts still open recovery. A process restart loses the marker. Provider read failures preserve uncertainty.
- Website Check again performs inspection only. It never creates another SDK operation. Pre-claim failures can offer Try again; ambiguous post-claim outcomes show recovery. The website has no `pagehide`, `beforeunload` or beacon cancellation path.
- All returns use `/subscribe/return`. Success targets `pro-upgrade-success`; other exits target `home`. The app awaits browser dismissal and refreshes entitlement. The redirect itself grants no Pro access.

Coordinator retirement does not cancel an already mounted provider operation or establish provider idempotency. Closing during initial payment/3DS before RevenueCat exposes a subscription remains an unresolved duplicate-charge window. Ordinary dismissal is addressed by the final source's deliberate retry path; safe provider behavior still needs sandbox and signed-device qualification. No website UI change is required for this retry path.

## Deployment bindings

| Pages project | Domain | `PAYMENT_BACKEND_ENVIRONMENT` | Backend | Web Billing key |
|---|---|---|---|---|
| `quests-payment-review` | `quests-payment-review.pages.dev` | `staging` | `dswtlvkjthzgpsgtfvwx` | Sandbox (`rcb_sb_`) |
| `quests-invite` | `invite.thequestsapp.com` | `production` | `bltogjnxwvybhyfaivtw` | Live |
| `quests-invite-staging` | `invite-staging.thequestsapp.com` | none | none | Marketing's project. Outside this package. Unbound, so checkout stays closed there |

Set it as a plain text variable on the Production environment of each project. The binding, never the URL, selects the backend, the publishable key and the Stripe mode. The signed `env` claim must equal it. A missing, unknown or mismatched value serves the fallback page without a backend call. Preview deployments of `quests-invite` carry no binding and stay closed.

`RC_UPGRADE_SIGNING_SECRET` and `RC_UPGRADE_SIGNING_SECRET_STAGING` on `quests-invite`, and the staging secret on `quests-payment-review`, are unused by this source. Remove them after production acceptance, as a separate approved change.

## Coordinated deployment order

Keep production web activation behind its existing release gate. Staging web was enabled for the earlier authorized phone qualification; preserve environment-specific settings and verify them before further tests.

| Step | Action | Owner | State |
|---|---|---|---|
| 1 | Staging migration `20260921162033_payment_routing_configuration` | Ledger owner | Applied |
| 2 | Deploy the paired staging backend from the integrated candidate | Ledger owner | Historical signer v30/webhook v31 from c40518cf6 were deployed September 21. Deployment proof for retry candidate 21ebdf19d remains to be supplied by the testing agent |
| 3 | Deploy production `revenuecat-webhook` with the sandbox-web exclusion, or approve equivalent provider isolation | Ledger owner | Deployed September 21, webhook v22, from app c40518cf6. Downloaded source matches. Later Apple Pay evidence confirms a sandbox web event was ignored in production. Reverify isolation and retain native sandbox regression before candidate tests |
| 4 | Pair `quests-payment-review` with staging and deploy the reviewed website runtime | Website | Deployment listing reverified September 22: ec74f3e0-020f-4b23-9f33-e1d6a51f36a7, source 4f2cf11. Earlier 18a3107 deployment is historical. This documentation pass deploys nothing |
| 5 | Staging acceptance: signed monthly and annual links from the paired signer, gates, cancellation, returns, then sandbox lifecycle once step 3 is verified | Website with Ledger owner | Pending |
| 6 | Production migration, then production signer and webhook | Ledger owner | Pending separate approval |
| 7 | Set `PAYMENT_BACKEND_ENVIRONMENT=production` on `quests-invite`, then merge PR 12. `quests-invite` builds from GitHub `main`, so the merge is the production deployment. The apex `thequestsapp.com/pro/success` page ships from the same merge through GitHub Pages | Website | Pending separate approval |
| 8 | Production-backed signed candidate, flag activation, bounded live charge and refund | Release owner | Each separately authorized |

Order matters in two places. Backend before website in each environment: the v2 website against a v1 signer fails closed, which is safe but unusable. Website before the new binary: Build 15 sends v2 links that the current production website rejects.

Merging PR 12 ends v1 link support on `invite.thequestsapp.com`. No shipped production build opens web checkout (both steering flags are false in Build 14), so no user path breaks.

## Rollback

1. Set `payments.routing` to the emergency object in the app package (`ios_primary: apple`, `web_checkout_enabled: false`). Page entry and initiation both close within one request. Verify with a stale signed link and with `POST /subscribe/check`.
2. Keep webhooks running so in-flight payments settle. Never clear a pending attempt on elapsed time.
3. Website rollback: Cloudflare Pages, roll `quests-invite` back to deployment `12d626a0-2460-4331-939a-b0f99e91d9da` (source `cca024b`), or revert the merge on `main`. The v1 website cannot serve v2 links, so rolling the website back while the flag is on strands web checkout. Flip the flag first.
4. For staging, select the reviewed compatible prior deployment. The immediate prior complete recovery baseline is `02ba5e26-e7e8-482f-9292-264ffcb9e2be`, source `cabb48c`. Exclude the briefly empty `11c45610` deployment. Verify backend/app compatibility before rollback.

## Catalog

Source maps `monthly` to `quests_pro_monthly` and `yearly` to `quests_pro_annual`, and requests USD offerings. The app package verified both read-only in RevenueCat on 2026-09-21: USD 4.99 monthly, USD 29.99 yearly, both attached to `pro`, no trial. This package made no provider request. Exact rendered price, currency, renewal disclosure and wallet availability need the deployed checkout and stay pending. Apple Pay needs each checkout domain registered with Stripe.

## Approvals and payment methods

Elliott approved the website changes and the integrated checkout UI on 2026-09-21 after a local preview of every surface. Subsequent billing research and authorized provider tax changes are recorded in the tax-readiness document. Elliott subsequently authorized test-environment preparation. Deployment receipts are recorded above; app source integration and final release/device gates remain open.

September 21 provider review: RevenueCat's payment method configuration has card, Apple Pay and Google Pay on. Link is off and locked in the current Web Billing configuration. PayPal is not offered. `invite.thequestsapp.com` was verified registered with wallets enabled in test and live modes. Staging-domain status and subsequent tax configuration are tracked in the tax-readiness document. Actual wallet presentation and processing still require eligible-device acceptance.

RevenueCat automatic tax is now enabled with Stripe and personal-use SaaS code `txcd_10103000`. Only when required is selected and saved for ordinary checkout, following Elliott's September 21 instruction. Wallets supply their own billing address; IP prefills the country. The live NY registration was added after Elliott confirmed receipt of the Certificate of Authority. Merchant origin is verified as New York in both modes. Tax rendering, receipts, renewal/refund treatment and financial reconciliation remain acceptance gates.

## Validation

September 22 source verification: 86 website tests pass. Runtime code is unchanged from `333a7f9d` through documentation head `87c5604`. The app retry/return subset passes 26 tests and the backend passes 25. These local suites use mocked dependencies. Deployment identity and signed-device proof remain separate. See the retry handoff and `handoff/build15-final-verification-20260922/` for evidence.

Historical initial package validation:

- `npm test`: 73 pass, 0 fail (50 existing, 23 payment routing).
- `wrangler pages functions build`: compiles.
- Local `wrangler pages dev` with the staging binding: fallback on bare `/subscribe`; `/subscribe/check` routed (405 on GET, 400 on bad body, 409 `environment_mismatch` with no backend call, 503 closed against the live staging v1 signer); `/subscribe/return` answers 302 to `quests-staging://home`.
- CSP in `functions/subscribe.js` equals the `/subscribe` block in `_headers`.

Found and fixed in the prepared patch: `/subscribe/check` was absent from `_routes.json`, so the browser gate would never have reached a Function; the publishable key was chosen from the URL `env` parameter instead of the binding; the failure notice offered Try again after the attempt was claimed; the gate accepted unbounded bodies and unfiltered claim keys.

## Acceptance cases owned by the website

Evidence layers stay separate: W is website behavior, P is provider processing, B is backend entitlement, D is physical device.

The matrix below tracks qualification of the final paired retry candidate. Earlier successful payments and app returns remain in the dated receipts below; they do not establish final-candidate acceptance.

| Case | W, local | W, deployed | P | B | D |
|---|---|---|---|---|---|
| Invalid, legacy v1, unsigned link | Pass | Pending | n/a | n/a | Pending |
| Expired or tampered claim (plan, uid, attempt) | Pass, forwarded unchanged and closed on refusal | Pending | n/a | Pending | Pending |
| Environment mismatch, missing binding | Pass | Pending | n/a | n/a | n/a |
| Kill switch off at entry | Pass | Pending | n/a | Pending | Pending |
| Kill switch flipped after page load | Pass | Pending | n/a | Pending | Pending |
| Duplicate initiation, second tab, double tap | Pass | Pending | Pending | Pending | Pending |
| Explicit cancellation releases the attempt | Pass, source contract | Pending | Pending | Pending | Pending |
| Ambiguous failure keeps pending state | Pass, source contract | Pending | Pending | Pending | Pending |
| Observed browser dismissal, then explicit retry | Website contract unchanged; final backend retires exact attempt after fresh checks | Final candidate pending | Provider visibility window open | Final candidate pending | Pending |
| Monthly and annual product, price, currency, renewal text | Mapping pass | Pending | Pending | n/a | Pending |
| Supported wallets | n/a | Pending | Pending | n/a | Pending |
| Return to the originating app flow | 302 pass | Pending | n/a | n/a | Pending |
| Entitlement after payment | n/a | n/a | Pending | Pending | Pending |

## Historical September 21 environment preparation receipt

The new isolated app worktree is `Quests-worktrees/build15-payment-e2e-20260921`, branch `codex/build15-payment-e2e-20260921`, at reviewed commit `c40518cf60f52efc9eb2a28f9dab3a1132b6f26a`. Existing app UI work, Metro and simulator leases were preserved.

The staging website was built from a clean archive of `18a3107316072dcc5c726678995ebbe91eb2aa3b`. The artifact adds a deployment-only Wrangler config with `PAYMENT_BACKEND_ENVIRONMENT=staging` and asset exclusions for documentation, tests and scripts. The untracked tax and finance documents were excluded. The Pages Production slot belongs to the staging project `quests-payment-review`; its billing backend remains staging. No production website merge occurred.

Readback: Cloudflare deployment `356e89f8-03e2-4d9a-bb41-7f79b811a116`; downloaded config shows the staging binding. Chrome on the registered stable host serves the expected unsigned-link fallback. Python HTTP probes received Cloudflare 403/code 1010 before application validation, so those probes supply no website gate result. The staging signer itself returns 401 `invalid_checkout` for an invalid v2 signature.

Fresh local validation: 73 website tests and 19 backend tests pass; both backend entrypoints pass Deno type checks; deployment compiled the Pages Worker successfully. These results leave authenticated checkout, provider permissions, sandbox-event isolation, wallet rendering, tax records and device acceptance open.

### Historical physical-device preparation

The connected iPhone is paired, trusted, and has Developer Mode enabled. Both staging ad hoc profiles include this device. Internal build `77382807-807b-49a0-98b6-e2597ba27fc9` finished at September 21, 20:11:57 UTC. The downloaded app passed signature and embedded staging-configuration checks, then installed and launched successfully. Follow-up inventory confirms both Quests and Quests [Staging] are installed. This QA artifact retains source metadata 3.0.1 build 14 in the separate staging bundle; final Build 15 acceptance remains open.

The profile enables the RevenueCat native SDK and pins the app/database to staging. Existing shared EAS variables and build profiles are unchanged. Resolved configuration and 20 focused build-contract tests pass. Broader app checks have unrelated failures, recorded in the app worktree's `docs/testing/build15-payment-device-test.md` with the complete device acceptance sequence. The phone-authenticated staging account has a distinct UUID from production and an expired Pro record; RevenueCat shows no current sandbox or live entitlements. Elliott confirmed Home after phone sign-in. The reviewed staging routing update then returned exactly one row with `ios_primary=web` and `web_checkout_enabled=true`. Source and restore SQL were pushed to `origin/codex/build15-payment-e2e-20260921` at `16a79651d` before execution. Fresh SDK state, signed checkout, tax, wallet rendering and payment acceptance remain open. Production routing is unchanged.

## September 21 Apple Pay device result and tax notice

See [the Apple Pay investigation](BUILD15-APPLE-PAY-INVESTIGATION.md) for matched
Stripe, RevenueCat, staging entitlement and purchase-attempt proof. The annual
sandbox payment succeeded once for USD 29.99. Wallet billing location resolved to
New Mexico and Stripe returned zero tax with `Not collecting`; positive New York
tax acceptance remains open. The production webhook correctly ignored this web
sandbox event. The clearer, automatically revealed tax-update notice is deployed
to staging from website commit `2257da0`. Existing production activation and
final Build 15 gates remain open.
