# Build 15 Apple Pay checkout investigation

Updated September 21, 2026. Staging acceptance remains in progress.

## Observed purchase

Elliott confirmed Apple Pay appeared in the installed Quests [Staging] checkout.
He reported a tax-related price-update notice after authorizing the wallet,
confusing retry behavior, and eventual Pro access. The phone was disconnected
before a captured reproduction. Historical device-log collection required Mac
administrator authentication and was unavailable; no phone console trace was
captured for the original attempt.

Read-only Chrome inspection established:

- One annual web purchase attempt was created at 20:21:30 UTC and completed at
  20:22:22 UTC. This run exercised the annual plan.
- Stripe test PaymentIntent `pi_3UIDjDIc0E6TglSd2Yqs9buu` succeeded at 20:22:20 UTC
  for USD 29.99, using Apple Pay. Its timeline contains creation and successful
  confirmation. The latest all-payments list contains one September 21 payment;
  no second payment or decline appears for this run.
- Stripe tax transaction `tax_1UIDinIc0E6TglSdDQrrUoNa` used the wallet billing
  location in New Mexico, SaaS personal-use code `txcd_10103000`, tax-exclusive
  pricing, and the configured New York head office. Tax was USD 0.00. The
  detailed state/county/city reason is `Not collecting`. This is a registration
  configuration result and supplies no independent assessment of tax obligations.
- RevenueCat INITIAL_PURCHASE `41e3db8b-8cf4-416e-9ceb-e7006dbe483b` identifies
  app `app20b28546eb`, store `RC_BILLING`, environment `SANDBOX`, entitlement
  `pro`, and the matching purchase-attempt metadata. Annual sandbox renewal is
  accelerated to one hour. The customer dashboard showed active Pro.
- Read-only staging SQL confirmed `pro`, `is_active=true`, expiry at
  21:22:21.208 UTC, and update at 20:22:22.27799 UTC.
- The production webhook returned HTTP 200 with
  `{"success":true,"ignored":true,"reason":"web_sandbox_requires_staging"}`.
  This closes actual provider proof for this web-sandbox exclusion path.
- Stripe displays a simulated processing fee of USD 1.17 and net USD 28.82.
  Live economics and any separate RevenueCat/Tax charges remain separate checks.

No live charge, refund, cancellation, entitlement grant, or database mutation was
performed during this investigation. Full billing addresses remain in provider
records and are excluded from this document.

## Why the notice appears

The pinned `@revenuecat/purchases-js@1.42.1` source contains the exact reported
message under `price_update.base_message`. On wallet submission the SDK extracts
billing details, refreshes tax, and compares the new total with the displayed
total. A mismatch stops that pass before `checkoutComplete` and Stripe payment
confirmation, updates the total, and shows the notice. A fresh user confirmation
can then continue within the same checkout attempt.

The observed final New Mexico billing location and SDK behavior explain the
reported price-update interruption. The initial displayed amount/location and
any additional client-side failure remain unrecorded. A later successful payment
does not reconstruct every intermediate on-device screen.

## Presentation fix

The existing SDK notice now appears above payment fields, receives focus and an
accessible alert role, and scrolls into view once per visible mismatch. It stays
in document flow, preserving access to wallet and card controls. Its English
non-trial copy explains the billing-address tax recalculation and asks the user
to review and confirm again. Localized and free-trial terms remain intact.

The adapter preserves SDK text nodes and payment state. RevenueCat continues to
own pricing, tax, payment confirmation, and retry. No automatic second purchase,
new attempt, page reload, or backend unlock is introduced. Class observation is
required because the SDK toggles `fully-hidden` on an existing notice element.
Reverify these selectors when changing the pinned SDK.

## Verification

- 77 website tests pass, including hidden notice, first display, rerenders,
  subsequent mismatch, unmount, localization, and trial-copy cases.
- Cloudflare Pages Worker compilation passes. `git diff --check` passes.
- Local presentation fixture in Chrome at 390x844 and 320x568: notice is fully
  visible from y=16, focused, with no horizontal overflow. Confirmation hides
  the notice; another mismatch reveals it again. These are synthetic UI cases.
- Harness health was checked. All available iOS simulators had other owners'
  leases; the four configured pool devices were missing. Those lanes and their
  state were preserved. No new iOS simulator evidence was obtained in this pass.

Run the local, payment-free fixture with:

```sh
node scripts/preview-checkout-notice.mjs
```

Open `http://127.0.0.1:8996`. Fixture amounts are illustrative. Its server binds
only to localhost, never starts a provider checkout, and is excluded from Pages
assets with other scripts.

## Remaining acceptance

1. Physical iPhone: reproduce wallet location mismatch, verify the new notice,
   confirm the displayed final total, complete once, and return to the same app
   account. Capture console evidence during the reproduction if available.
2. Positive New York tax: use a valid New York billing location in an authorized
   sandbox checkout and match displayed tax to Stripe calculation and receipt.
   The New Mexico purchase proves automatic location handling and zero-tax
   behavior. The initial estimate in this run is unverified.
3. Monthly plan, cancellation, card decline, delayed webhook, repeated taps,
   refund/revocation, and safe reconciliation of an abandoned started attempt.
4. Final Build 15 artifact acceptance, native Apple sandbox regression,
   production signer/migration/routing gates, then Elliott's live purchase with
   the selected plan and final total visible. Production checkout stays gated.

## Staging deployment

Website commit `2257da0` was pushed to `github/codex/build15-payment-routing-20260921`
and deployed from a clean archive to the staging project `quests-payment-review`.
Deployment URL: https://217dabad.quests-payment-review.pages.dev. The artifact
retains `PAYMENT_BACKEND_ENVIRONMENT=staging` and excludes documentation, scripts,
tests, and private finance drafts. Chrome verified the stable host serves the
expected closed state for an unsigned checkout URL. A fresh signed phone checkout
is required for acceptance of the deployed notice inside RevenueCat.

Operational deployment note: an initial archive command ran from the previous
artifact directory and failed; the following deployment nevertheless published
`5d09d528-c024-47e4-ab5f-d43200584df9` with zero static assets. It was immediately
superseded by the verified clean-archive deployment
`217dabad-4435-4ce1-b132-0b5384b003d2`. Use `217dabad` or the prior known-good
`356e89f8` for rollback decisions; `5d09d528` is unusable. The stable-host notice
module SHA-256 matches source exactly:
`241f9d2a59caecb582ad3d58f4d108e09e87a86063f3e034fcad0a3445bbc83e`.
No production project was targeted.

## September 21 follow-up: preventing repeat authorization

Elliott requires checkout to complete with one wallet authorization when billing
location changes tax. The staged notice improvement is a presentation mitigation;
it does not meet this requirement by itself. Web production activation remains
blocked on a supported solution and physical-device acceptance of this case.

Online primary-source research:

- RevenueCat [tax documentation](https://www.revenuecat.com/docs/web/web-billing/tax)
  confirms that wallets supply the billing address used for customer tax location.
- RevenueCat [checkout documentation](https://www.revenuecat.com/docs/web/web-billing/checkout)
  explicitly excludes express checkout and wallets from both full-address
  collection settings. Changing Only when required to Always cannot be relied
  upon to fix the wallet total mismatch.
- Latest published Web SDK at research time is 1.63.1, released September 17.
  The [tagged payment-entry source](https://github.com/RevenueCat/purchases-js/blob/1.63.1/src/ui/pages/payment-entry-page.svelte#L624-L742)
  still recalculates wallet taxes during submit, compares against the previous
  total, and throws TaxCustomerDetailsMissMatchError before completeCheckout and
  confirmElements. Both the npm package and tagged source were inspected.
  Upgrading our 1.42.1 pin alone supplies no evidence that repeat authorization
  disappears. No SDK upgrade was deployed during this research.
- The [July 15 RevenueCat release note](https://www.revenuecat.com/changelog)
  places full billing-address support in 1.47.0 and says wallet behavior remains
  unchanged. Our 1.42.1 pin predates that feature. Saved dashboard settings must
  be distinguished from SDK support, particularly for full-address-required
  regions. Current launch scope remains the US.
- Stripe [Express Checkout documentation](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment?payment-ui=elements)
  provides address-change events and total updates for shipping-address flows.
  This shows that updating a wallet sheet before confirmation is possible in
  supported integrations. It does not establish a compatible billing-only hook
  in RevenueCat's public purchase API. Adding a fictitious shipping requirement
  to a digital subscription would require product and provider review.

Recommendation: first establish a supported RevenueCat solution that obtains the
required tax location and finalizes the amount before wallet authorization.
Request provider guidance with the reproducer below. If RevenueCat cannot
support that experience promptly, preserve the existing native Apple purchase
route for launch while qualifying Stripe Checkout/Billing as a separate payment
workstream. Stripe migration is a broader catalog, subscription, webhook,
reconciliation, tax and refund change. Treat it as a separately tested release.
Do not hide the mismatch, remove the amount guard, silently submit a higher
amount, disable tax, substitute the merchant address, or hardcode an illustrative
rate as a workaround.

Provider question draft, prepared locally and not sent:

> RevenueCat Billing with Stripe Tax and Apple Pay, purchases-js 1.42.1, requires
> another wallet confirmation when the wallet billing address changes tax from
> the initial estimate. The first pass enters the price-update mismatch state;
> the next confirmation succeeds. Source in 1.63.1 still contains this guard.
> Which supported API/configuration finalizes billing-address tax before the
> first Apple Pay authorization? Address collection documentation excludes
> wallets. Is there an upstream fix or recommended flow that preserves correct
> tax and one authorization, including when the selected wallet card changes?

### Physical-device sequence

1. Reconnect the unlocked iPhone for diagnostics. Use Quests [Staging] first.
   Verify installed artifact, signed-in account, staging host, sandbox provider
   mode, and current entitlement/renewal state. The previous successful sandbox
   subscription can block another purchase, so prepare an eligible test account
   or a provider-confirmed sandbox reset before opening a new checkout. Preserve
   the previous payment and attempt records.
2. Capture the checkout initial subtotal/tax/total and selected plan. Open Apple
   Pay and capture its displayed total and selected billing location before
   authorization. Establish whether a mismatch is present with ordinary usage.
   Reproduce the reported path with diagnostics. A successful second attempt
   closes payment recovery only; one-authorization acceptance stays open.
3. Once a supported correction is staged, test same-location and different-tax
   billing locations, including New York and the previously observed New Mexico
   case. Use legitimate wallet billing details; sandbox card fields may use
   documented test data. Include changing the selected wallet card/location
   before confirmation. Run monthly and annual plans with independently eligible
   test states. Pass requires the final tax-inclusive wallet amount to be the
   amount charged, one authorization, one successful payment, and no tax-change
   retry. Test a positive New York tax calculation and its receipt.
4. Match each successful run to Stripe payment/tax/receipt, RevenueCat event,
   staging webhook, completed attempt and Pro entitlement. Verify return to the
   same app account and retained access after relaunch. Exercise cancellation,
   decline, repeated tap, interrupted network, delayed webhook and refund/
   revocation separately. A pending provider outcome must not offer another
   purchase until reconciled.
5. Repeat on the final Build 15 candidate. Then, after production deployment and
   activation gates pass, Elliott makes the agreed live purchase with the exact
   plan and final amount visible. Reconcile the live payment, tax, receipt,
   entitlement and account return. Do not use the successful staging purchase
   as production sign-off.

USB is for diagnostics; the existing installed staging app and Safari run
without the cable. Safari Web Inspector/device logging access must be verified
before promising console capture. A recording of the UI and provider timestamps
remains useful if console access is unavailable.

## September 21 monthly reproduction and checkout alternatives

Elliott's screenshots at 18:07 and 18:08 local time establish the exact change:
monthly subtotal USD 4.99, New York tax 8.875% (USD 0.44), total USD 5.43,
followed by total USD 4.99 and the updated confirmation notice above Apple Pay.
The physical-device notice placement is now verified. The interruption remains
reproducible. The screenshots do not capture the amount inside the Apple Pay
sheet or establish where the initial New York location came from.

RevenueCat's sandbox customer history records a new Pro Monthly purchase for
USD 4.99 at 22:08 UTC, event `14019c6d-424b-4f7e-9b6f-f150e9f8114c`. Elliott
reports completion and return to the app. Chrome's control connection then
timed out repeatedly, so this pass does not add a Stripe payment-detail,
webhook-response, or database reconciliation for that monthly event. Those
checks remain pending. Earlier annual purchase and refund evidence remains
separate.

### What the provider documentation and source establish

- Apple releases the requested full billing address after wallet authorization.
  Its APIs can update payment-sheet totals at supported selection events, but
  that does not make the full billing address available beforehand.
  [Apple billing contact documentation](https://developer.apple.com/documentation/applepayontheweb/applepaypaymentrequest/requiredbillingcontactfields).
- Stripe documents a two-step integration: collect wallet/payment details,
  create a ConfirmationToken, calculate tax and display a review, then confirm
  payment. This is the relevant technical foundation for Elliott's proposed
  final confirmation screen. The exact subscription and Apple Pay experience,
  including increases and decreases in tax, still needs device qualification.
  [Stripe two-step confirmation](https://docs.stripe.com/payments/build-a-two-step-confirmation).
- Our current RevenueCat `purchase()` owns the payment lifecycle. Its public
  purchase parameters have no callback to insert that intermediate review or
  supply an externally collected ConfirmationToken. The standard checkout in
  SDK 1.63.1 still compares the old total with the recalculated total and raises
  the mismatch before completing checkout.
  [RevenueCat standard checkout source](https://github.com/RevenueCat/purchases-js/blob/1.63.1/src/ui/pages/payment-entry-page.svelte#L624-L742).
- RevenueCat also offers Express Purchase, exposed as a public experimental
  `presentExpressPurchaseButton` API starting in 1.45.0. Its distinct flow
  recalculates wallet tax and confirms without the standard mismatch guard.
  However, the 1.63.1 pricing helper explicitly constructs the wallet display
  with the pretax amount and describes tax as visible on the invoice. This is
  a material disclosure tradeoff and does not satisfy our final-total gate.
  We have not enabled it or claimed its physical-device behavior is verified.
  [Express checkout documentation](https://www.revenuecat.com/docs/web/paywalls#adding-apple-pay-or-google-pay-buttons-to-a-revenuecat-billing-paywall-with-the-express-checkout-component),
  [Express pricing source](https://github.com/RevenueCat/purchases-js/blob/1.63.1/src/ui/express-purchase-button/stripe-helpers.ts),
  [Express payment source](https://github.com/RevenueCat/purchases-js/blob/1.63.1/src/ui/express-purchase-button/express-purchase-button.svelte).
- Stripe Express Checkout can update shipping-related totals from address
  selection events. That is useful for physical-goods checkouts. A digital
  subscription should use accurate tax-location evidence and appropriate
  collection fields; introducing a fictitious shipping requirement is outside
  this plan. Wallet billing details arrive through its confirmation event.
  [Stripe Express Checkout](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment?payment-ui=elements).
- RevenueCat defines US and Canadian prices as tax-exclusive. Absorbing tax in
  a fixed advertised total therefore is not an available documented toggle in
  this billing engine. It would also change unit economics. Address collection
  set to Always excludes wallets and does not remove this mismatch.
  [RevenueCat tax](https://www.revenuecat.com/docs/web/web-billing/tax),
  [RevenueCat address collection](https://www.revenuecat.com/docs/web/web-billing/checkout).

### Airline and travel comparison

Emirates describes entering passenger and payment details and displaying fees
and taxes during booking. Its public help does not explain a Stripe or
RevenueCat wallet-tax implementation. Stripe's Hertz case study confirms an
Apple Pay integration using Stripe APIs; it does not document this specific
address-mismatch resolution. Stripe's Alaska Airlines case study covers
in-person Terminal payments. These examples establish available experiences,
but supply no evidence of a hidden setting in our current RevenueCat flow.

[Emirates booking and tax FAQ](https://www.emirates.com/english/help/faq-topics/booking-with-emirates/),
[Stripe and Hertz](https://stripe.com/customers/hertz),
[Stripe and Alaska Airlines](https://stripe.com/customers/alaska-airlines).

### Recommendation and revised acceptance

Prioritize a supported RevenueCat flow that preserves wallet details while
presenting the corrected final total for explicit confirmation. Ask whether
Express Purchase can display final tax before commitment, or whether standard
checkout can expose a two-step confirmation using its existing token. The
provider question remains a local draft; no support message has been sent.

If neither is supported, qualify Stripe Billing through RevenueCat as a
separate staging implementation, evaluating hosted Checkout first and a custom
two-step Elements flow only if needed. Preserve user identity, server pricing,
tax, renewal terms, durable attempts, idempotency, webhooks, refunds and app
return. A custom PaymentIntent alone does not implement recurring billing.

Elliott accepts an intentional review step after selecting Apple Pay. Acceptance
therefore allows one wallet collection/authorization followed by a clear final
order confirmation, provided the accurate tax-inclusive amount and recurring
terms are disclosed before committing the purchase. Both tax increases and
decreases must pass. There must be no error-style retry or repeated wallet
authorization caused solely by an ordinary billing-location change. Issuer
authentication and actual payment failures remain separate cases.

## Inline Pro return correction

The standalone `pro/success.html` had the approved graphite design. The active
`showSuccess()` inside `subscribe-app.js` separately rendered a cream surface
and purple check mark. The correction applies the same Pro graphite gradient,
cream type, serif heading and cream action button to the inline state, removes
the check mark, and retains the 150 ms automatic return.

The manual fallback now uses the same `/subscribe/return` destination and
server-verified app scheme as the automatic return. Previously it navigated to
the production apex universal link even during staging. Executable tests cover
both app schemes, both return actions, the server 302, and rejection of unknown
destinations. The redirect grants no entitlement; the app remains responsible
for confirming access from provider-backed state.

Validation: 80 website tests pass and the Pages Worker compiles. Local visual
fixture `scripts/preview-checkout-success.mjs` executes the actual success
renderer with provider calls and automatic navigation disabled. After recovering
Chrome control, desktop visual inspection confirmed the graphite background,
cream text, serif heading and cream return button. Physical-device validation
of the brief success state and app return remains open.

Staging deployment: source commit `cabb48ce31e88bdc5eb5eebdf068fd3de063d1c0`,
immutable URL https://02ba5e26.quests-payment-review.pages.dev, stable URL
https://quests-payment-review.pages.dev. Wrangler reported successful upload
and deployment from a clean committed artifact with staging backend bindings.
Chrome loaded the stable site's `subscribe-app.js?v=15-pro-return` and displayed
the new shared `successReturnUrl` implementation. The deployed module's full
hash was not independently compared. No production checkout activation or
payment SDK change was included.

## September 21 tax-obligation clarification

Elliott requested a further obligation review and chose to retain the current
checkout implementation for now. This research changes no tax registrations,
provider settings, application code, or production activation state.

### Why the New Mexico test collected zero

The inspected annual sandbox transaction used New Mexico wallet billing data,
product code `txcd_10103000`, and the reason `not_collecting`. Stripe documents
this reason for an absent active registration or the explicit nontaxable product
code. The observed product code excludes that second explanation. The evidence
therefore supports a registration configuration explanation for that test.
It does not establish that Quests has no legal New Mexico obligation. The later
monthly screenshots show the same tax drop; their separate Stripe transaction
reconciliation remains pending.

[Stripe zero-tax reasons](https://docs.stripe.com/tax/zero-tax).

### Collection scope

- Federal: the US has no general national sales tax or VAT. Federal income,
  estimated, self-employment and employment taxes are separate business/owner
  obligations, depending on entity treatment and activity. They are handled
  through accounting and filings rather than a general federal checkout tax.
  [US Commerce tax guide](https://www.trade.gov/sites/default/files/2025-03/2025%20SelectUSA%20Investor%20Guide.pdf),
  [IRS business taxes](https://www.irs.gov/businesses/business-taxes).
- New York: Quests' New York operations and taxable software sales support the
  registration and collection obligation. Elliott confirms receipt of the
  Certificate of Authority. Tax sourcing concerns the customer's applicable use
  location; citizenship is irrelevant. New York treats remotely accessed
  prewritten software as taxable and sources it to where the purchaser uses or
  directs its use. A wallet billing address is checkout evidence and can be
  outdated. A current New York use location paired with an old New Mexico card
  address requires sourcing review. The screenshot's 8.875% is a particular
  local rate, rather than a rate to apply to all US customers.
  [NY software bulletin](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm),
  [NY registration guidance](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/do_i_need_to_register_for_sales_tax.htm).
- Other states: determine physical/business presence, each state's economic
  thresholds, product taxability, and sourcing rules. Register and activate
  collection where required. Selling nationwide alone does not establish a
  blanket all-state collection rule. New Mexico's remote-seller threshold is
  at least USD 100,000 of taxable gross receipts in the previous calendar year
  for a seller without physical presence. Its presence rules also require
  review. No complete company-wide sales or operating-footprint audit was
  performed in this research pass.
  [New Mexico nexus rules](https://www.tax.newmexico.gov/businesses/determining-nexus/).

### Operational follow-through

Keep the New York collection setup, verify its live purchase and assigned
filing calendar, and review other-state triggers monthly and whenever work
locations change. Reconcile sales across channels and apply each state's rules
for marketplace sales. Stripe monitors live Stripe-processed/imported sales;
its dashboard supplies evidence with coverage limits. It is insufficient by
itself to certify that every state obligation has been considered.

The wiki's August runbook already calls for New York collection and monthly
other-state monitoring. Its certificate-pending status and tax-code label are
stale relative to this payment workstream. This pass preserves those files and
records the discrepancy here. On September 21, Elliott confirmed that operations
are entirely in New York, with no regular workers, offices, equipment or other
business operations outside New York. This closes the initial owner-reported
operating-footprint question. New York remains the established physical-presence
obligation. Other-state economic thresholds, product-specific rules and sales
across channels remain subject to review. Reassess when the footprint changes.

[Stripe monitoring coverage and limitations](https://docs.stripe.com/tax/monitoring).

### Additional wallet research finding

Apple's `ApplePayPaymentMethod.billingContact` documentation describes redacted
billing information before authorization for tasks such as calculating tax.
This refines the earlier observation about the full address arriving after
authorization. A provider-supported implementation may be able to refresh the
wallet total using that earlier information. Stripe's reviewed public Express
Checkout event types expose shipping-address changes and post-authorization
confirmation, with no corresponding billing-contact selection event. RevenueCat
1.63.1's wrapper registers ready, confirm, loaderror, click and cancel handlers.
Provider support and device qualification remain necessary before relying on
this approach; no workaround was implemented.

[Apple redacted billing contact](https://developer.apple.com/documentation/applepayontheweb/applepaypaymentmethod/billingcontact),
[Stripe Express Checkout public event types](https://github.com/stripe/stripe-js/blob/master/types/stripe-js/elements/express-checkout.d.ts),
[RevenueCat wallet wrapper](https://github.com/RevenueCat/purchases-js/blob/1.63.1/src/ui/molecules/stripe-express-checkout-element.svelte).
