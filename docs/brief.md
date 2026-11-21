# All Together

Product foundation · 13 November 2026 · Owner: Iyanu, product design

## Problem

A small group wants to fund public work together. Sending separate tips pays the creator before the group has agreed on a complete amount; asking an organizer to collect the money gives that person control of everyone's deposits. Backers need a clear boundary between depositing, authorizing, and actually paying the creator.

## Idea

Three backers fund separate BOLT11 quotes at one mint, each locked under NUT-20 to its owner's key. When the target is met, each independently verifies and signs the same complete output set. One NUT-29 batch issues NUT-11 P2PK proofs locked to the creator. The organizer coordinates public data and signatures, never private keys. An unmet campaign lets each backer mint only their own deposit into their own outputs under NUT-04/20; this is not a Lightning refund.

The watchable sentence: **several people cause one indivisible payment, and no campaign operator held the keys.** Deposits already sit at the mint. The promise is no creator payout before authorization, not money staying in the backer's wallet.

## Fifteen seconds

| Time | Visible beat |
| --- | --- |
| 0–3s | Three independent browser sessions; an openly available episode shows “2 of 3 deposited · 1,400 / 2,100 sats.” Say “Deposited at mint; not paid to creator.” |
| 3–7s | The last backer chooses “Join with 700.” With invoice funding/setup prepared outside this excerpt, all three review the same 2,100-sat creator destination and explicitly approve. The last approval triggers submission. |
| 7–11s | One mint-confirmed batch changes all three contributions to paid. The independent creator client receives 2,100 sats in creator-locked proofs and can spend them; disclose any subsequent spend fee. Never time the confirmation animation ahead of the mint. |
| 11–15s | Cut clearly to “Unmet campaign.” One backer chooses “Take mine back”; show reclaimed only after the mint confirms their own issuance. This is a different campaign, not a rollback. |

The product illustration uses 700 / 2,100 sats. The successful spike used **21-sat deposits**, a 63-sat payout, and a 62-sat creator spend after a one-sat swap fee. Its test mint automatically credited fake invoices; no real Lightning funding was tested. Keep an uncut setup and funding recording available. Network timing may require a clearly labeled edited excerpt.

## Bounded novelty

The research found wallet batch minting, recipient splits, tipping, and bill reimbursement, but no equivalent creator campaign with independently owned quote authorizations in its inspected results. That is a bounded search, not a claim to be first. The contribution is a specific collective payment experience using NUT-20/29; crowdfunding and collective patronage are established ideas. The subsequent spike passed checks 1–5 on testnut.cashudevkit.org with cashu-ts 4.13.1.

NUT-29 is not a general crowdfunding contract. Released signatures cannot be revoked; reclaim can race payout. No guaranteed deadline enforcement, mint anonymity, creator fulfillment, or production recovery is implied. Golden Nut, Best Design Nut, and Nuttiest are the primary entry targets; Value4Value fits voluntary patronage of openly available work. Deadline: 27 November 2026 23:59 UTC / 28 November 00:59 WAT.

Basis: Candidate 1 in `/workspace/nutnovember-ideas-report.md`; `/workspace/all-together-spike/KILL-TEST-REPORT.md` and `README.md`.
