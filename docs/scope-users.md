# People and scope

## Creator

Receives voluntary support for openly available work. Supplies and independently confirms a beneficiary public key; keeps its private key in their own signer. Can inspect the campaign, receive creator-locked proofs, recover persisted payout outputs, and spend with their key. Cannot take deposited quotes before backer authorization, change an already signed destination, reclaim a backer's quote, or guarantee delivery through the protocol. Losing the creator key can strand creator-locked proofs even if NUT-09 restores signatures.

## Backer

Funds one fixed BOLT11 deposit, owns its quote-specific signing key, checks the complete creator output package, and explicitly releases their own authorization. Can refuse approval, stop new local signing, or independently attempt own-quote reclaim without the organizer. Cannot reclaim someone else's quote or revoke a released signature. Once released, reclaim and payout can race; only a mint-confirmed result resolves ownership. The mint sees quotes in the batch, so do not promise anonymity from it.

## Organizer

Writes campaign details, fixes the three slots and amount, coordinates public quote identifiers, output construction data, and signatures, and submits a complete authorized batch. May also be a creator or backer, but their signing role remains separately owned. Never receives backer or creator private keys; cannot authorize on anyone's behalf, redirect signed outputs, enforce a protocol deadline, or block an owner's direct reclaim. Holds neither the deposits nor a refund treasury. Can stop collecting new approvals locally, with released signatures explicitly still live.

## Concrete scenarios

1. **OSS maintenance:** Three users each offer 700 sats toward a developer's public bug fix. The organizer links the issue and confirmed developer key. Each user funds their own quote; all three review the full 2,100-sat output set. Creator payout happens after authorization. A paid label means funds issued, not that the bug was fixed.
2. **Open podcast episode:** Three listeners voluntarily support an episode available to everyone, without a paywall or promised exclusivity. One listener does not deposit; the other two can independently mint their own deposits back. This patronage framing is the potential Value4Value fit.
3. **Organizer disappears:** A backer has a paid, unissued quote and their local key and recovery material. They open their deposit/reclaim route and submit directly to the mint. Organizer availability is not required; mint availability is.
4. **Change of mind after approval:** A backer presses “Take mine back” after releasing a signature. If the batch settles first, their route says paid to creator. If their mint issuance settles first, it says reclaimed, the stale batch fails, and the other owners retain control of their deposits. No countdown reverses authorization.
5. **Interrupted creator receipt:** The batch request times out. The creator resumes the saved operation and restores its exact output signatures. Until those outputs are matched and verified, everyone sees an unresolved payout rather than an invented success.

The MVP serves a small known group using separate local browser profiles and a fake-sat mint. Discovery, social profiles, account recovery, public reputation, recurring commitments, flexible funding, and production custody are outside this cut. Campaign IDs and backer routes are identifiers, never credentials; route access alone grants no signing authority.
