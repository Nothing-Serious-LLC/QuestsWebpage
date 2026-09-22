# Build 15: Subscribe, dismiss, reopen

Updated September 22, 2026. Final app candidate: `21ebdf19d6777ce16b0b44f5c3ade3a56545b713`; implementation: `5029d2724`. Source is prepared for staging integration. Provider and signed-device acceptance remain open. See [the final merge package](BUILD15-FINAL-MERGE-PACKAGE.md) for the release disposition and merge-agent prompt.

## Verified scope and authority

The existing embedded RevenueCat Web Billing checkout, Apple Pay/card, selected plan, tax behavior, Pro theme and success-return transport remain. This retry path requires no additional website UI change or schema migration. The earlier payment-routing migration remains a deployment prerequisite.

App source and all four handoff documents were reviewed directly in:

```text
/Users/elliottthornburgsmac/Developer/Quests-worktrees/build15-payment-routing-20260921
codex/build15-payment-routing-20260921
handoff/build15-payments-20260921/WEBSITE-VERIFY-HANDOFF.md
handoff/build15-payments-20260921/MERGE-HANDOFF.md
handoff/build15-payments-20260921/CHECKOUT-RETRY-CANDIDATE.md
handoff/build15-payments-20260921/OPEN-ITEMS.md
```

GitHub remote `origin` was rechecked September 22 and points to `21ebdf19d6777ce16b0b44f5c3ade3a56545b713`. The implementation was checked in `UpgradeProLink.tsx`, `UpgradeProScreen.tsx`, `purchaseRoutingRepository.ts`, and `sign-upgrade-link/handler.ts`. The prior same-attempt-only handoff is superseded by the behavior below.

Website worktree: `/Users/elliottthornburgsmac/Developer/QuestsWebsite-worktrees/build15-payment-routing-20260921`, branch `codex/build15-payment-routing-20260921`, authoritative remote `github`. Earlier documentation and financial research were preserved in `87c5604`; this reconciliation changes documentation only.

## Final source behavior

1. Dismissing the Safari checkout immediately restores Subscribe and plan selection. Entitlement refresh runs in the background with bounded, serialized reads. The app continues to grant Pro from authoritative server entitlement.
2. `UpgradeProLink` records the exact signed attempt only when `openBrowserAsync` returns CANCEL or DISMISS. The marker is held in memory and keyed by account and environment. Signing timeout or presentation error does not invent a dismissal.
3. The next explicit Subscribe tap passes that identifier as `dismissed_attempt` on the authenticated app-to-backend `begin` request. There is no automatic payment or backend retirement at the moment of dismissal.
4. The backend checks account, entitlement, fresh RevenueCat subscriptions, routing, storefront and scheme. If the provider shows no outstanding subscription, it can retire that account's exact matching open web attempt, including a started attempt.
5. The backend creates or reuses the unique next open attempt and signs the selected plan. A plan change is permitted after the exact dismissal. Concurrent insertion conflicts reread the winning row; `validate_web` permits one reserved-to-started transition.
6. Old links are rejected by attempt-state inspection/validation. Entitlement, provider-pending, native-purchase, account, environment and concurrent-initiation guards remain. When a concurrent attempt has a different plan, the explicit plan conflict prevents silently substituting it.
7. Without a usable dismissal marker, a started attempt continues into website recovery. A process restart loses the in-memory marker and can initially leave that recovery path in place. Provider read failures preserve the attempt and return feedback.

Ordinary same-session form dismissal therefore has a deliberate replacement path in the final source. Its usable-form behavior on the paired signed app still needs physical-device evidence.

## Unchanged website contract

`/subscribe?version=2&uid=&attempt=&exp=&plan=&env=&appscheme=&storefront=&sig=` remains the signed URL. `dismissed_attempt` belongs to the authenticated app-to-signer request and is not a new signed URL claim or website action.

| Action | Website behavior |
| --- | --- |
| `inspect_web` at page entry | Reserved attempt may render checkout; `purchase_pending` renders recovery; `already_subscribed` offers Return to Quests; unavailable or invalid capabilities fail closed |
| `validate_web` before SDK purchase | Recheck the capability and attempt; one reserved-to-started winner can mount the form |
| `inspect_web` from Check again | Check eligibility/entitlement without starting another SDK purchase; an allow alone does not resolve uncertainty or initiate payment |
| `finish_web`, outcome cancelled | Report an explicit SDK cancellation through the existing bounded endpoint |
| Success return | Existing Pro-themed screen, automatic/manual `/subscribe/return` transport and originating app scheme remain |

The website has no browser-close beacon or unload transition. A fresh link from the final backend uses the same contract and selected-product mapping. The return redirect prompts app refresh and grants no entitlement by itself.

## Provider safety limit

The coordinator row's `cancelled` state means the old capability was retired. It does not establish cancellation of a provider operation already mounted or processing. During initial payment or 3DS, RevenueCat may not yet expose a subscription. A later empty subscription read cannot conclusively exclude that in-flight charge.

The current candidate provides no documented provider idempotency or provider-session cancellation guarantee for that window. An old mounted tab can also outlive coordinator retirement. Keep this case explicitly unresolved until documented provider support and sandbox/device evidence establish a tested disposition. Preserving guards around known subscriptions does not prove duplicate-charge prevention before provider visibility.

The earlier research into the pinned Web SDK 1.42.1 found no public pre-confirmation gate or session-resume parameter. Keep the current integration; hosted checkout, Stripe Billing migration, private API interception and an SDK fork remain outside this documentation task.

## Source, deployment and device evidence

| Layer | Evidence | Limit |
| --- | --- | --- |
| App source | Candidate `21ebdf19d`, implementation `5029d2724`, matching GitHub branch verified September 22 | Source identity alone establishes no installed app or backend deployment |
| Website source | Runtime `4f2cf11`; earlier tested documentation head `333a7f9d`; runtime files unchanged through documentation head `87c5604` | Later documentation commits do not change the deployed runtime |
| Website staging deployment | Cloudflare deployment listing rechecked September 22: latest Production-slot deployment of staging project `quests-payment-review` is `ec74f3e0-020f-4b23-9f33-e1d6a51f36a7`, source `4f2cf11` | This is the staging project's slot. Previous binding readback was staging; no fresh checkout or payment was executed in this pass |
| Local website tests | 86 passing, rerun September 22 | Mocked browser/provider/backend behavior |
| Local app tests | 26 focused retry/link/return tests rerun September 22; app owner records 101 tests across nine suites | Broader owner receipt and this verification are separate runs |
| Local backend tests | 25 passing, rerun September 22 with Deno `--no-config --no-lock` | Mocked database/provider behavior |
| Final backend and signed device | Reviewed app handoff provides no deployment/build acceptance receipt for this retry revision | Main Build 15 testing agent must supply exact function version/source, merged SHA and signed build ID |

Receipts: `handoff/build15-final-verification-20260922/`. Earlier successful Apple Pay payments, refunds, returns and tax observations remain historical evidence for their older source/artifacts. They do not close the final retry candidate's acceptance rows.

## Staging verification and evidence handoff

The main Build 15 testing agent owns the integrated source, paired function deployment and signed app. Record each outcome against the existing B15-PAY IDs in the app ledger. Share the deployed website ID, function version/source, app SHA/build ID, environment, timestamps and private provider/attempt references in one readout. Provider identifiers and signed links stay in private evidence.

1. Verify the staging backend, sandbox Web Billing key, registered domain, selected product and exact price/period disclosures. Confirm production sandbox-web isolation before generating payment events.
2. Open checkout, X immediately, then explicitly Subscribe again. Repeat after the form renders. Verify a usable form, fresh attempt where retirement applies, and rejection of the old URL.
3. Change monthly/annual after X. Verify the selected plan, price and period. Test rapid taps, concurrent devices/tabs and a previously mounted old form.
4. Exercise Wallet cancel, interrupted 3DS, offline return/reconnect, delayed provider visibility and a process restart. Known provider-pending/active subscriptions must prevent another initiation. Record the pre-visibility window separately.
5. Complete one deliberate sandbox payment. Verify exactly one intended payment/subscription, authoritative entitlement, reward fulfillment once, Pro-themed success, automatic/manual app return, persistence after restart and management.
6. Verify positive New York tax with a valid billing address and matching receipt/tax record. Preserve the existing New Mexico zero-tax evidence separately.
7. Repeat the required checks on the exact integrated Build 15 artifact. Retain production migration, signer/website, activation, live-payment and store-release gates. Native catalog/restore, Freeze fulfillment and reviewer deliverables remain in the app's OPEN-ITEMS ledger.

This pass coordinates through the shared source/verification package. No separate main testing agent is reachable through this conversation's agent mailbox, and no provider/device case is marked complete on its behalf.

## Merge-agent disposition

Source is ready for reconciliation into the staging candidate. Preserve the final app behavior and unchanged website contract, and keep the provider visibility window explicit. A public-release disposition requires the remaining provider/device evidence or an explicit tested deferral. Website PR 12 merges deploy production and retain their existing gate. Preserve settlement webhooks during rollback and coordinate function/app compatibility.

[RevenueCat lifecycle](https://www.revenuecat.com/docs/web/web-billing/subscription-lifecycle), [pinned purchase parameters](https://github.com/RevenueCat/purchases-js/blob/1.42.1/src/entities/purchase-params.ts).
