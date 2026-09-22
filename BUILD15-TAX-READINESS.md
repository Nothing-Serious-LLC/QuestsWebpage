# Build 15 RevenueCat Billing tax readiness

Archive note, September 22: preserve this dated research and configuration record. Earlier pending setup statements are superseded by the later device-evidence section and `BUILD15-FINAL-MERGE-PACKAGE.md`. Release requires fresh provider readback and the remaining positive-tax acceptance; this document records no new September 22 provider changes.

Updated September 21, 2026. Owner: Elliott. Decision: retain RevenueCat Billing with cards and Apple Pay for Build 15; preserve already-enabled Google Pay. Defer Stripe Billing, Link and Cash App Pay to the [migration assessment](STRIPE-BILLING-ASSESSMENT.md).

## Current status

Provider tax settings have been saved. Production checkout acceptance remains open. Website and backend deployment gates in [BUILD15-PAYMENTS.md](BUILD15-PAYMENTS.md) and the app's `handoff/build15-payments-20260921/ACCEPTANCE.md` still apply. This document supplies tax evidence and priorities without advancing their acceptance rows.

### Browser configuration evidence

Provider configuration below used Elliott's signed-in Chrome. Subsequent authorized environment preparation used the Supabase and Wrangler CLIs for reviewed-code deployments, with Chrome for account and database readbacks. No payment, refund, filing, transfer, subscription migration or database migration was executed in this workstream.

| Configuration | Result on September 21 | Evidence and limits |
|---|---|---|
| New York Certificate of Authority | Received, confirmed by Elliott | Certificate does not list effective/start date or filing frequency; verify account obligations in NY Tax Online Services or filed application |
| Stripe live NY registration | Added, collection starts immediately | `taxreg_1UICHsIc0E6TglSdNsrFn7pY`; Stripe displays September 21, 2026, 18:50 UTC and no end date; registration-added success shown |
| Live tax registration ID | Omitted using Stripe's supported existing-registration flow | Elliott confirmed the certificate; the private state tax ID was not entered into Stripe. Complete private administrative records separately |
| Stripe test NY registration | Already present, preserved | `taxreg_1U86bkIc0E6TglSd6qA0Wshe`; start August 24, 2026, 22:44 UTC and no end date |
| RevenueCat automatic tax | Enabled and saved | Quests Web Billing `app20b28546eb`, project `22287094`; success toast after save |
| RevenueCat tax provider | Stripe | Connected Nothing Serious LLC account `acct_1Rsp23Ic0E6TglSd` |
| RevenueCat product tax code | `txcd_10103000`, SaaS personal use | Selector identifies `10103001` as SaaS business use. Earlier notes incorrectly labelled that code personal use |
| RevenueCat address collection | Only when required, selected and saved on Elliott's instruction | Applies to ordinary checkout; provider UI explicitly excludes express checkout/wallets from this control |
| Stripe live merchant tax origin | Corrected to New York and saved | Elliott confirmed New York operations, then explicitly authorized the private DTF-17 address for Stripe Tax in live and test modes. Live settings readback shows United States (New York). Full street address remains outside this document |
| Stripe test merchant tax origin | Corrected to New York and saved | Chrome access recovered on Elliott's requested recheck. Completed the approved ZIP, saved the existing form and verified United States (New York) on the settings page. Both modes now use the authorized operating address |
| Staging payment domain | Added and enabled in Stripe test mode; Apple Pay enabled verified | `quests-payment-review.pages.dev`, `pmd_1UICN1Ic0E6TglSdoAxjjxb7`, September 21 at 14:55 Eastern; row remains visible under Stripe's Apple Pay enabled filter. Physical wallet rendering remains pending |
| Stripe default product code | General - Electronically Supplied Services | NY registration wizard previews 0% for that default. RevenueCat documentation says its own selected code controls RC Billing; no claim of actual charged tax follows from the wizard preview |
| Stripe tax setup status | Locations still show Needs attention / no configured integration | Integrations page has Dashboard automatic tax already on. RC settings are saved separately. Actual provider tax calculation and transaction evidence must resolve this status |
| Filing/remittance | Unconfigured in this workstream | No paid filing plan selected, no filing frequency guessed, no return filed |

The Stripe collection start above is the activation timestamp in Stripe. The government registration's effective date and first filing obligation remain to be verified. Adding the existing registration in Stripe did not apply for a new government registration.

Account evidence: [live NY registration](https://dashboard.stripe.com/acct_1Rsp23Ic0E6TglSd/tax/locations/us-ny_taxreg_1UICHsIc0E6TglSdNsrFn7pY), [test NY registration](https://dashboard.stripe.com/acct_1Rsp23Ic0E6TglSd/test/tax/locations/us-ny_taxreg_1U86bkIc0E6TglSd6qA0Wshe), [RevenueCat Billing settings](https://app.revenuecat.com/projects/22287094/web/app20b28546eb?activeTab=payment-provider), [Stripe Tax settings](https://dashboard.stripe.com/acct_1Rsp23Ic0E6TglSd/settings/tax).

## What customers provide

Quests can keep address fields out of its profile and onboarding. The payment provider owns the checkout address fields and billing record. No native address form or Quests address-schema change is required for this configuration.

1. Card checkout collects billing location. Only when required is the primary default. RevenueCat requests billing details needed for tax calculation. Browser autocomplete may reduce typing; exact rendered fields remain to be checked on the deployed checkout.
2. IP location prefills RevenueCat's country field. The entered billing location determines tax. VPN location, storefront and email must not substitute for billing location.
3. Apple Pay and Google Pay use the selected wallet payment method's billing address. Wallet users can need to add or correct that address. The ordinary checkout's address setting does not control wallet address collection.
4. The provider calculates applicable tax and shows the breakdown and total before confirmation. Receipt/email/portal amounts must agree with the financial record.
5. Renewal and address-change tests must establish that the provider retains and uses the correct billing location. A saved address can become outdated after a move.

Only when required is now saved in the shared RevenueCat Billing configuration. Customers may still need to enter location details for tax. Browser autocomplete and wallet billing details may reduce typing; actual fields and accuracy remain device-test assertions. [RevenueCat checkout address options](https://www.revenuecat.com/docs/web/web-billing/checkout#address-collection), rechecked September 21.

[RevenueCat location and wallet documentation](https://www.revenuecat.com/docs/web/web-billing/tax), [Stripe customer location accuracy](https://docs.stripe.com/tax/customer-locations), read September 21. Stripe recommends full US addresses, supports country plus ZIP, and uses the geographic center of a ZIP when full-address resolution is unavailable. An unmatched full address can also fall back to ZIP. IP-only location is insufficient for our US local-tax accuracy target.

Retain provider billing addresses in the payment system. Avoid copying full addresses into Quests profiles, analytics, application logs or public test evidence. Use isolated QA identities and keep receipts and location details in private evidence.

## Price and tax presentation

Retain $4.99 monthly and $29.99 annual, with actual applicable sales tax added in the US. Processing costs remain within the advertised subscription price. No separate customer processing surcharge is introduced.

For a taxable NYC example at 8.875%, expected rounded tax is $0.44 monthly or $2.66 annual, producing $5.43 or $32.65 totals. These are illustrative test expectations. The actual provider calculation must use the customer's location and current rules. A hardcoded rate or visual-only tax line is outside the approved approach.

## Required tax acceptance, all execution pending

These supplement existing B15-PAY IDs. Each result needs candidate/deployment IDs, environment, QA identity, provider mode, plan, expected/actual tax, receipt/tax transaction references, app entitlement result and reviewer. Redact addresses and payment information in shared evidence.

| Existing cases | Tax/location test | Pass evidence |
|---|---|---|
| B15-PAY-01, 02, 22 | Monthly and annual NYC billing address | Selected plan preserved, tax $0.44/$2.66 where 8.875% applies, total $5.43/$32.65, period/renewal disclosure visible |
| B15-PAY-01, 02, 22 | Another NY local jurisdiction | Expected authority rate established independently, provider tax uses that jurisdiction |
| B15-PAY-08 | Apple Pay eligible physical device | Registered domain, wallet address used, tax/total reviewed before confirmation, receipt and entitlement agree |
| B15-PAY-08 | Ordinary card and browser autocomplete | Only required fields requested; entered/corrected location drives accurate tax |
| B15-PAY-09, 10 | Missing/invalid address; country/state/ZIP conflict | Recoverable validation; no silent exemption or duplicate purchase |
| B15-PAY-14 | IP-country mismatch and checkout contact email independent of phone-authenticated Quests identity | Billing location drives tax; signed UUID owns Pro |
| B15-PAY-22 | Zero-tax customer location | Supported reason captured, such as no applicable registration or product exemption; zero alone is insufficient evidence |
| B15-PAY-18 | Renewal and customer move | Current billing location, provider tax record, renewed entitlement and receipt agree |
| B15-PAY-19 | Full and partial refund | Customer tax reverses correctly, retained fees separated, entitlement policy verified |
| B15-PAY-13, 14 | Finance reconciliation | Subscription subtotal, tax liability, fees and net reconcile to provider records; duplicate events do not duplicate accounting |
| B15-PAY-23 | Bounded live candidate | Exact production build/deploy/account and charge budget approved; live tax receipt, webhook, Pro and authorized refund verified |

Wallet rendering and authorization require an eligible physical device. Simulator tests cover routing, return handling and entitlement behavior; physical-wallet acceptance remains its own row.

## Ordered remaining work

1. Merchant origin is corrected and verified as New York in live and test modes. Retain the actual NY filing calendar as an open finance item until state records establish it.
2. Provider domain registration is complete. Verify actual wallet rendering on the staging checkout and retain the already-verified live `invite.thequestsapp.com` registration.
3. Production sandbox-web exclusion is deployed as webhook v22. Complete an authenticated provider-event rejection check and native sandbox regression before any RevenueCat sandbox purchase.
4. Staging signer v30, webhook v31 and the approved website are deployed with the staging binding. Verify the authenticated v2 signed checkout contract before payment.
5. Execute the staging tax matrix alongside B15-PAY-01 through 22, including abandoned checkout recovery. A pending attempt must remain protected until provider state establishes a safe recovery action.
6. Integrate the approved Build 15 candidate, complete the scoped production migration/function/website sequence, and verify production configuration. The app lane's active UI approval hold remains owned by its release workstream.
7. Run production-connected simulator routing checks and an authorized physical-device live payment/refund pilot with exact identity and budget.
8. Reconcile customer sales tax separately from revenue and fees; inspect the actual Stripe Tax fee meter. Complete QuickBooks mapping, payout/bank evidence and filing ownership before describing finance as fully automated.

Release readiness remains open while these deployment, lifecycle, address, tax and financial evidence rows are pending. The future Stripe Billing migration adds its own qualification matrix after Build 15 acceptance.

## Lower-friction qualification and device sequence

Elliott approved Only when required as the primary default on September 21. Selected and saved in Chrome, with the radio checked and Save changes disabled on readback. Automatic tax remains enabled with personal-use SaaS code `txcd_10103000`. This is the shared RevenueCat Billing configuration. Wallet address handling is independent.

Qualify the saved default with actual card and wallet forms, checking required fields, address correction, tax jurisdiction and totals. Include NYC and another NY jurisdiction, invalid/missing ZIP, country/state disagreement, IP mismatch and a changed wallet address. Investigate any location or validation failure before production acceptance. No native binary change is required for this provider setting.

| Test surface | What it can establish | Prerequisite or limit |
|---|---|---|
| Expo Go on a physical phone or simulator | Paywall layout, selected plan, loading/error/pending presentations, fixture navigation | Existing payment preview intercepts purchase actions; no actual payment proof |
| Safari on a physical iPhone, deployed staging checkout | Actual provider address fields, autofill, tax/total, eligible Apple Pay presentation and sandbox payment, receipt/webhook/database evidence | Reviewed signer and website deployed, isolated QA identity, sandbox-web isolation verified first. A browser-only run leaves app launch/return acceptance open |
| Expo development build on a physical iPhone | Real native RevenueCat module, StoreKit storefront, app-to-browser handoff, registered app return, foreground refresh and visible Pro | Must contain current native dependencies and the correct staging URL scheme/environment. Reuse a compatible build after inspection or build a new one |
| Exact signed release candidate / TestFlight | Production routing, production domain, release-mode return behavior, entitlement persistence and native fallback/restore | Candidate must contain the reviewed payment code. Build number alone is insufficient. Web checkout on the production binding uses live money and needs a bounded authorized pilot |

Source checked September 21: `purchasesService.ts` returns no storefront when the native purchase SDK is unavailable; `purchaseRoutingRepository.ts` requires eligible storefront/provider state; `UpgradeProLink.tsx` requests the configured app scheme and opens the browser sheet. Expo Go therefore cannot establish the unmodified app's complete payment route. [Expo native purchase testing guidance](https://docs.expo.dev/guides/in-app-purchases/).

The positive end-to-end chain is: signed-in QA user selects plan, server creates the signed attempt, provider displays address/tax/total, payment completes, RevenueCat grants the same UUID's Pro entitlement, webhook updates the matching backend, app returns and visibly unlocks Pro, restart preserves access, and receipt/tax/fees reconcile. A redirect alone passes no entitlement assertion.

Run declines, authentication challenge, explicit cancel, browser close/relaunch, duplicate taps/tabs, delayed/repeated webhook, cancellation/renewal and refund cases alongside that chain. Abandoned started-attempt recovery remains a release blocker until the provider outcome supports a safe recovery. Keep the existing B15-PAY acceptance IDs and record evidence by environment and exact candidate.

## Device test preparation checkpoint

Elliott confirmed a working card in Apple Wallet and Safari access. The designated production account uses phone authentication; do not require or infer an account email. Its authenticated UUID was resolved through the production phone search for subsequent entitlement assertions. Keep the phone number in private operational evidence. Elliott confirmed TestFlight Build 14 is installed. Build 15 is still in preparation. Build 14 lacks the new payment routing; Safari can qualify browser checkout first, while full app handoff and return require a compatible development build or the final payment-enabled candidate.

RevenueCat documents sandbox wallets on registered Stripe test-mode domains using real Wallet cards without actual charges. Sandbox mode alone does not explain a missing Apple Pay button. Check the actual checkout URL, HTTPS, domain registration, browser context and wallet eligibility. [RevenueCat payment methods](https://www.revenuecat.com/docs/web/web-billing/payment-methods), read September 21.

The initial Chrome audit found staging signer v29, staging webhook v30 and production webhook v21. Authorized preparation subsequently deployed staging signer v30 and webhook v31, plus production webhook v22, from app commit `c40518cf6`. Downloaded compiled source matches reviewed source after stripping TypeScript and formatting. Production signer and database remain unchanged. Staging migration `20260921162033` was verified present through a read-only Chrome query, with web disabled and zero purchase attempts.

Staging website `18a3107` is deployed as `356e89f8-03e2-4d9a-bb41-7f79b811a116` on `quests-payment-review`, with its staging binding read back. The stable registered domain serves the expected invalid-link fallback in Chrome. Local validation passed 73 website tests, 19 backend tests and both backend entrypoint type checks. See BUILD15-PAYMENTS for limits and receipts.

The designated production phone account was found. Its database Pro row is inactive, outside grace, and expired September 17. Fresh RevenueCat subscription state is still required before purchase. No entitlement was edited. Keep the private UUID in operational evidence rather than this shared document.

Outstanding before device checkout: authenticated staging QA identity and v2 link, provider-read permission proof, authenticated production rejection of sandbox-web events, native sandbox regression, and staging routing activation for qualification. Wallet and tax acceptance remain unexecuted. Abandoned started-attempt recovery remains a release blocker. Production migration, signer, paired website, app integration and exact signed candidate remain later gates.

The standard EAS staging profile sets `EXPO_PUBLIC_DISABLE_NATIVE_PURCHASES=true`, which leaves the native storefront unavailable for this payment route. The current generic development profile also requires environment qualification. Prepare a dedicated compatible test runtime without changing the other agent's preview or weakening the release environment guards. Elliott has been asked to connect the unlocked iPhone for device inspection; no development build, EAS dispatch or installation has occurred in this lane.

## September 21 device tax evidence

The annual Apple Pay sandbox purchase completed for USD 29.99. Stripe used the
wallet billing location in New Mexico and the configured New York merchant
origin, with SaaS personal-use code `txcd_10103000`. State, county and city tax
rows all report `Not collecting`, producing USD 0.00 tax. Positive New York
collection needs a separate valid New York billing-address test. The initial
displayed estimate is unrecorded. See [the investigation](BUILD15-APPLE-PAY-INVESTIGATION.md)
for source behavior, payment proof and the staged notice improvement.
