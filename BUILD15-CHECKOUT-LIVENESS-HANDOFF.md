# Independent Build 15 checkout findings

Completed 2026-09-22, ~15:10 UTC. Read-only against staging `dswtlvkjthzgpsgtfvwx` and the RevenueCat sandbox project. No production reads or writes, no live charges, no provider settings changed, no support message sent, no physical phone actions. Brief: INDEPENDENT-CHECKOUT-INVESTIGATION.md. Original B15-PAY IDs preserved.

## Identity

- App source: `a2f65e7ba4ca3c3249da146a2beb2ffefc62b5f9` on `build-15-merge` (HEAD `47d3e3b38` adds docs only). Installed signed staging artifact EAS `67306257-b5b0-4a16-9980-06cb2a8b5ada`, 3.0.1 (14), iPhone Air.
- Website source `23b3ad6a0a29ae9fc47fc91bc904c53e870bf653`, runtime `4f2cf11`, staging site `quests-payment-review.pages.dev` (HTTP 200 at read time).
- Signer: `supabase/functions/sign-upgrade-link/handler.ts` v31 on staging. Entitlement-source correction `c469833417a53bab0c18d1e0e8320f57af5e24ca` remains applied and untouched.
- Proposed correction: website branch `codex/build15-checkout-liveness-20260922`, commit `a687436b64cc1497b1391d1af481e687df1191ac`, worktree `/Users/elliottthornburgsmac/Developer/QuestsWebsite-worktrees/build15-checkout-liveness-20260922`. Not deployed.

## Disposition

**B15-PAY-10, B15-PAY-11 and B15-PAY-17 are not release blockers for Build 15.** The reported duplicate scenario is unreachable through ordinary single-device use of the signed app. It needs a provider form that outlives its dismissal, and SFSafariViewController destroys the page on dismissal. The prior reproduction supplied that surviving form with a desktop browser tab and authenticated API calls. Two narrower paths remain reachable without API forcing (two devices on one account, or Open in Safari from the sheet), and both require the customer to confirm two payments deliberately. A website-only liveness watch closes those within ten seconds and is prepared with tests. It deploys independently of the Build 15 binary and does not gate it.

Recommended ledger entries:

| ID | Recommended status |
| --- | --- |
| B15-PAY-10 | PASS for signed single-device cancel/retry/double tap (code path plus 2026-09-21 phone evidence). Pending only routine signed-device re-run on build 14. |
| B15-PAY-11 | PASS for dismiss/reopen/plan change (2026-09-21 phone evidence below). Process-restart recovery remains a routine device check. |
| B15-PAY-17 | Residual: second-device overlap needs two deliberate payments. Mitigated by the website liveness watch once deployed to staging and checked with two tabs. Not blocking. |
| B15-PAY-13/14 | Unchanged; the 14:41 UTC requalification stands. |
| B15-PAY-23 | Release the payment HOLD attributable to this scenario. Other readiness gates in PAYMENT-READINESS.md are unaffected. |

## 1. Elliott's phone account `41dc2ea8-b46a-4d7e-8dbb-7f0b6ef32dde`

Fresh readback 15:01:03 UTC (staging, service-role select only) and 15:01:04 UTC (RevenueCat `GET /v1/subscribers`, public sandbox key). Confirmed:

- `subscription_entitlements.pro`: `is_active=false`, `is_in_grace=false`, expired 2026-09-21 23:16:01, latest event `A5BCCA02` EXPIRATION at 23:16:02. RevenueCat shows annual expired 09-21 22:04:14 and monthly expired 09-21 23:16:01. Zero September 22 webhook rows.
- September 22 attempts: `241487d0` yearly (created 09-21 23:19:52) cancelled 13:49:37; `1758f56a` yearly created 13:49:38, cancelled 13:49:48; `790bddd3` monthly created 13:49:49, started 13:49:51. The eight signer invocations 13:49:11 to 13:49:51 (one 409) match: recovery begin, plan-conflict 409, yearly begin with dismissal, inspect/validate, monthly begin with dismissal, inspect/validate. Nothing paid. Not classified as paid.
- Signed-device evidence for the retry path from 2026-09-21: yearly `08ff9ed5` created 22:47:56, cancelled 22:48:51 (dismissed); monthly `d1bb9317` created 22:48:54, completed 22:49:34 by INITIAL_PURCHASE `84DCD573`, `txRcbf82d602453664fed441d75085e878b06`, USD 4.99. Prior monthly had expired 22:43:39. Dismiss annual, choose monthly, pay: exactly one subscription, correct product. Earlier same day: annual paid 20:22 (`txRcb58abd2c29fe827905bb5d688d7e510c1`), cancelled 22:01, expired 22:04; monthly `336e36ff` paid 22:08 (`txRcb03df4d29ed0fda040bd120d265f988cf`). Every phone purchase followed the prior expiry. No overlap ever existed on this account.

## 2. QA account `74266604-3b6e-47ce-9394-15ac85bf4442` and what was forced

Provider evidence is real. RevenueCat at 15:01:04 UTC: `quests_pro_annual` purchased 14:30:52 `txRcb33617a6656325a224c920e26bd965326`, USD 32.65, Pro through 15:30:52; `quests_pro_monthly` original purchase 14:32:38 `txRcb97cc6d7a7ad5f994f388cd0cc6b04704`, billing issue 14:37:07, grace ended 14:40:38. Staging webhook rows: INITIAL_PURCHASE `C47B8401` (annual, 14:30:53) and `18D3DBA4` (monthly, 14:32:39); earlier pair `197899F5` (`txRcb199d5e82036e4bb040da539aa0241ab7`, 02:10:39) and `0A5C3A84` (`txRcb376028a042ed13d24b543bf9b660e856`, 02:11:14). Overlapping sandbox subscriptions did occur.

Transitions forced through the authenticated API (from the private QA event log, redacted):

| UTC | Call | Why the signed app cannot do this |
| --- | --- | --- |
| 02:02:06 | `begin yearly` with `dismissed_attempt=dc255eec` while the monthly form stayed mounted in a Chrome tab | The app sets `dismissed_attempt` only after `WebBrowser.openBrowserAsync` returns CANCEL/DISMISS (`src/components/UpgradeProLink.tsx:34-41`). That sheet is SFSafariViewController (`expo-web-browser` 15.0.11, `ios/WebBrowserSession.swift:17-23`); its page and the mounted form are destroyed on dismissal. |
| 02:09:34 | `begin yearly` with `dismissed_attempt=87ff721d` while that annual form stayed mounted and was never dismissed | Same. Produced `cbe7e3c4`, a reserved row with no form that later became `completed`. |
| 14:29:17 | `begin yearly` with `dismissed_attempt=3df35b7f` while the ten-minute-old monthly form stayed mounted | Same. The old form then paid at 14:32:38. |

Unsupported assumption in the prior reproduction: that a form the app reports as dismissed can still be submitted on that device. Existing evidence therefore does not establish reproduction through signed-app navigation. Two conditions it did establish still hold and matter: a mounted provider form ignores the coordinator's row state, and RevenueCat Web Billing does not refuse a second product in the same entitlement.

## 3. Traced user cases (code, plus phone evidence where present)

- **Dismiss and reopen, same plan.** With a recorded dismissal the row is cancelled and a new one reserved (`handler.ts:147-155`); without one the same started row is re-signed (`handler.ts:127-131`) and the page shows "Check your purchase" because `inspect_web` answers `purchase_pending` for a started row (`handler.ts:107-112`). One form at a time either way.
- **Different plan after dismissal.** Old row cancelled, old URL fails `inspect_web`/`validate_web`, new plan signed. Proven on the phone 2026-09-21 22:47 to 22:49.
- **Same-plan duplicate protection.** Partial unique index `purchase_attempts_one_open_per_user`; `validate_web` moves reserved to started atomically; a second link to a started row never mounts a form. Client double tap blocked by `openingRef` and the module-level `presenting` flag.
- **Concurrent devices (reachable, artificial state not required).** Device A mounts a form (started). Device B taps Subscribe, receives the recovery link, sees "Check your purchase", closes the sheet; the app on B records A's attempt id as dismissed. B taps Subscribe again: the server cancels A's row and B mounts a fresh form. A's form is still payable. Two deliberate payments produce two subscriptions. The same shape is reachable on one device through the sheet's share menu, Open in Safari, which the library cannot hide on iOS. Not exercised on hardware; derived from the code paths above plus the QA provider evidence that a retired form still pays.
- **Paid return race (theoretical).** The success deep link calls `dismissBrowser()`, which resolves DISMISS, so the paid attempt is recorded as dismissed. A Subscribe tap inside the one to two seconds before RevenueCat lists the subscription (observed webhook lag 1.2 s: 14:30:52.056 purchase, 14:30:53.218 processed) would retire the paid row and reserve a new one. The user is on the success screen at that moment. Optional app follow-up, not for Build 15: record only CANCEL, not DISMISS, at `UpgradeProLink.tsx:39`.
- **Process kill, background, offline.** Killing the app destroys the sheet; a started row persists until the next tap's dismissal record or an entitlement. Backgrounding keeps the same sheet. No timer on the client.

## 4. Timeout findings

No supported RevenueCat mechanism exists. Verified against purchases-js 1.42.1 (the page loads it from esm.sh) and the current source through 1.63.1: `PurchaseParams` has no expiry, abort or session field; `Purchases.close()` disposes the instance and does not unmount or cancel; no timer settles `purchase()` from idle. Web Billing uses Stripe Elements with a PaymentIntent or SetupIntent confirmed through `confirmPayment`/`confirmSetup`, so Stripe Checkout Session expiry does not apply. The `rcbopsess` operation session TTL is undocumented and surfaces as `PurchaseInvalidError` when stale. The dashboard returning-customer setting applies to Web Purchase Links only; the SDK refuses only the exact same product (`ProductAlreadyPurchasedError`).

Four separate lifetimes: signed link 3,300 s and re-signable (`handler.ts:138`); coordinator row has no age and no cleanup job; a mounted form lives as long as its page; a submitted payment resolves only through the provider and webhook.

## 5. Completion semantics

`complete_entitled_purchase_attempts` closes every open row for the account when Pro activates (`supabase/migrations/20260921162033_payment_routing_configuration.sql:26-41`); `begin` does the same before returning `already_subscribed` (`handler.ts:52-56`). Neither records which attempt paid. `completed` is consumed nowhere: no reference in `src/`, `dashboard/` or `scripts/`; the table is service-role only; welcome freezes and cosmetics key off `subscription_entitlements` with idempotency keys; the app reads server entitlement only; there is no PostHog and the single purchase analytics signal is Singular on the RevenueCat CustomerInfo edge (`src/context/SubscriptionContext.tsx:353`). No user flow or analytics treats `completed` as a paid receipt. Leave history intact; a future `resolution` column is the right shape if attribution is ever needed.

## 6. Smallest proposed correction (prepared, not deployed)

Website only, commit `a687436` on `codex/build15-checkout-liveness-20260922`, files `subscribe-app.js`, `tests/checkout-liveness.test.mjs`, `tests/payment-routing.test.mjs`. 95 website tests pass (86 existing plus 9 new).

- While `purchase()` is pending, re-read the attempt through the existing `inspect_web` capability every 10 s. `purchase_pending` or a transport failure keeps the form. Any other refusal (`attempt_unavailable`, `already_subscribed`, kill switch) clears the mount and shows the matching existing notice, so a form retired from another device or made redundant by Pro arriving elsewhere stops being submittable within 10 s.
- A form never submitted is cleared after 10 minutes, released through the existing `finish_web cancelled` path, with a "Checkout timed out" notice.
- The watch stands down on the RevenueCat form's `submit` event or Pay button click, because a charge may be in flight and only the provider can resolve it. A completed 3DS still charges and the webhook grants access, unchanged.
- `ProductAlreadyPurchasedError` from the SDK now shows "You already have Quests Pro" instead of "Check your purchase".
- No backend, schema, app or provider change. Cost: one signer call (with its RevenueCat v2 read) per 10 s per mounted form.
- What it does not do: cancel the provider operation server-side. It removes the ability to submit, which is the only lever the SDK leaves.

Qualification plan for the main agent after a staging website deployment: mount a sandbox form in tab A, retire it with a second begin (API or a second tab's dismissal), confirm tab A clears within 10 s and its `finish_web` is not sent; mount a form, leave it idle 10 minutes, confirm the row is cancelled and the notice shows; mount, click Pay with a 3DS test card, confirm the watch stands down and the success return still fires. Then repeat the two-tab overlap from CHECKOUT-TIMEOUT-INVESTIGATION.md and confirm the old form is gone before card entry.

## Evidence handling

Fresh readbacks are in the session scratchpad only. Private `.context` files were read and redacted; no credentials, signed URLs or card data appear in this document. Website worktree and app doc worktree (`build-15-checkout-investigation`) are isolated; nothing was merged, pushed, deployed or released.
