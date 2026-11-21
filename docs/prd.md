# Product requirements

13 November 2026 · Foundations for review; working protocol integration follows screen review.

## Goals

Make three people's independent deposits become one creator-controlled issuance with explicit authorization. Make deposit ownership, reclaim, and uncertain settlement understandable. Demonstrate one successful campaign, one unmet campaign, both race outcomes, and reload recovery without fabricated balances. Target a working MVP by **19 November**, six days from today; reserve 20–26 November for independent use, design, failures, and the recording. Submission deadline is 27 November 23:59 UTC (28 November 00:59 WAT).

## MVP boundaries

Exactly three backers, one beneficiary, one fixed per-backer amount, one mint: `https://testnut.cashudevkit.org` for local fake-sat tests. Start with 21 / 63 sats as proven; 700 / 2,100 is an optional presentation preset, not evidence from the spike. BOLT11 quote funding, explicit signing, NUT-29 payout, independent reclaim, and persistent output recovery are required. The public test mint auto-credits fake invoices; this is not proof of real Lightning wallet interoperability.

Non-goals: cross-mint aggregation, flexible tiers, overfunding, partial payout, recurring support, RSS splits, native ports, automatic deadlines, production deployment, production key-backup claims, creator-delivery enforcement, or a general wallet. No fleshed-out screens in this foundation task. The scaffold must never claim to have moved money.

## Features and acceptance criteria

| Feature | Acceptance criteria for the working MVP |
| --- | --- |
| Campaign creation | Organizer fixes title, public-work link, three slots, amount, mint, and beneficiary public key. Creator confirms the key through an independent enrollment step before funding. Share route contains no private key. No organizer key custody. |
| Owned deposit | Backer creates a quote-specific key locally and submits a NUT-20 locked BOLT11 quote. Check returned pubkey. Display invoice and “Awaiting deposit” until mint reports PAID and unissued; then show deposited. Only three matching owned quotes count toward target. |
| Readiness | Three paid/unissued quotes and a complete validated output package make the campaign ready. Deposit readiness is an app condition, not a mint-enforced campaign contract. Missing/unpaid/reclaimed quote blocks submission. |
| Explicit approval | Show contribution, total, mint, full beneficiary identity on demand, and irreversible release warning. Independently reconstruct blinded outputs from saved secrets/blinding factors; check order, sum, keyset, P2PK creator lock and no refund tags. Only then sign owned quote with the copied amended transcript. No silent approval. |
| Payout | Collect three signatures over the identical ordered output set. Submit one NUT-29 request; unblind and verify proofs and amount. Missing/invalid signatures must not consume deposits. Mark paid only with verified mint response or recovered matching issuance, not HTTP dispatch. Creator alone can spend; demonstrate the spend with its fee separately. |
| Reclaim and cancel race | Before release, “Stop approval” prevents new local signatures. After release say “Approved; reclaim can still race payout.” Offer “Take mine back” with that warning, never “Revoke.” Owner mints only their quote into own outputs; show reclaiming while unresolved. Reclaimed requires verified mint issuance to those outputs. If batch wins, show paid to creator. If reclaim wins, invalidate the stale batch; other deposits remain reclaimable. Countdown never changes authorization validity. |
| Persistent output recovery | Before any mint/reclaim request, durably save exact ordered outputs, secrets, blinding factors, keyset, quote IDs, request and operation ID. Keep sensitive material in the owner's store; creator retains payout recovery material, backer retains reclaim material. Abort on storage failure. Reload after dispatch and recover exact signatures with NUT-09; do not create replacement outputs or infer destination from ISSUED alone. Retain proofs before marking complete. Missing key remains a separate loss: restore cannot recreate it. |
| Failure and retry | Timeout stays pending with “Checking mint result”; retry uses the exact persisted operation. Reconcile mint response, output restore, and quote states before another request. Quote ISSUED without matched outputs stays unresolved. Reclaimed slot requires a new quote and fresh review of any changed output package. Never reuse stale approval as new consent. |
| Access and comprehension | Keyboard flow, visible focus, 44px targets, 200% text and 320px reflow, AA contrast, Reduce Motion, sentence announcements. A tester can explain where deposits sit and why approved is not final. |

## Delivery cut

- 13 November: these six documents, typed routes, state transitions, copied helper, buildable shell.
- 14–15 November: owner-local quote keys, creator enrollment, fixed campaign coordination and funding status.
- 16 November: output verification, explicit signing, one creator-locked payout, spend receipt.
- 17 November: owner reclaim and both settlement orderings; no race UX deferral.
- 18 November: persist-before-dispatch operations, restore after reload, storage failure and unknown-result handling.
- 19 November: run three isolated backer browser profiles plus creator; record successful payout, unmet reclaim, both races and crash/retry evidence. Cut optional presets before cutting recovery or race handling.

## Risks and release gates

The spike proved atomic issuance, own-deposit reclaim, and sequential race orderings; simultaneous contention remains untested. Reproduce against the pinned SDK and mint capabilities before integration, and stop on compatibility drift. cashu-ts 4.13.1's public quote helper signs legacy bytes; keep the proven adapter and compare its browser adaptation against it before use. P2PK witnesses must be JSON strings on the wire (the spike's initial object witness failed).

A malicious mint, compromised signer UI, incorrect creator enrollment, lost local keys, cleared browser storage, coordinator outage, and XSS remain risks. Independent reclaim must not depend on organizer availability. Browser profiles on one host are a demo boundary, not hardware security. Persistent operation recovery is required but is not a production backup system. Browser key storage needs further review before real funds. Mint outages leave unresolved states; they do not entitle the UI to invent success.

## Honest claims

Say: “No creator payout before authorization; deposits are at the mint.” Say: “One batch issues creator-locked ecash after all required signatures validate.” Say: “Each owner can attempt to reclaim their own unissued deposit.”

Do not promise all-or-nothing crowdfunding policy, donor anonymity against the mint, signature expiry, automatic deadline enforcement, guaranteed creator delivery, or revoked approval. A signature binds its quote and ordered outputs, not the entire contributor list or campaign terms. Stop-collecting is local coordination policy. A confirmed payout cannot be undone by canceling the campaign.

Foundation status: protocol methods deliberately throw an unavailable error; no mint calls or key persistence are implemented here. The state and recovery interfaces define the next implementation boundary.
