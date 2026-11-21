# Protocol boundary

Real now, against `https://testnut.cashudevkit.org` with cashu-ts 4.13.1:

- `keys.ts`: owner-local keys (`createRandomSecretKey`, compressed 33-byte pubkey). The private key is stored only in this browser under `plebstack:key:<pubkey>`. Backers and the maintainer enroll the same way; only the pubkey leaves, for example as `Campaign.beneficiaryPubkey`. `isValidPubkey` checks the 02/03 prefix and that the point is on the curve.
- `storage.ts`: versioned records over any `getItem`/`setItem`/`removeItem` store. A failed write throws `StorageError`.
- `client.ts`: `createQuote` saves a pending deposit record (mint, amount, owner pubkey, time) after checking the key is saved, then sends the NUT-20 locked quote request, rejects any answer that does not echo our pubkey, and saves the quote before returning it. A failed save means no request is sent. `checkDeposit` and `waitForDeposit` poll with bounded backoff, are abortable, save every state change, and succeed only on `PAID` with `amount_paid` equal to the amount and `amount_issued` 0. `ISSUED` before we issued anything is an error. `abandonUnanswered` marks requests whose answer was never seen.
- `signer.ts`: browser port of `scripts/quote-signature.mjs`. `mintQuoteDigest` is the NUT-20 v1 transcript cashu-ts 4.13.1 uses internally: sha256 over the raw tag `Cashu_MintQuoteSig_v1`, then 4-byte big-endian length frames for the quote id, and per output the minimal big-endian amount and `B_`. Signed with `schnorrSignDigest`. Never the public `signMintQuote`, which signs the legacy transcript. NUT-29 uses the same transcript per quote. The signer refuses quotes its key does not own and, after `stopNewApprovals`, any new signature for that quote. The stop is saved locally (`stop:<quote>`); it does not revoke a signature already released.
- `batch.ts`: payout outputs, `OutputData.createP2PKData({ pubkey, blindKeys: false }, total, keyset)`: P2PK to the maintainer, no refund or locktime tags. `verifyPackage` recomputes every `B_` as `hash_to_curve(secret) + r·G` and checks order, sum, lock pubkey, empty tags, keyset, campaign, mint and that the backer's quote is listed under its own key. Each failure is a `PackageError` with a `check`. `authorizationProblem` checks quote order, byte-identical outputs and each schnorr signature against the quote owner's key. `payoutProofs` unblinds with `OutputData.toProof` (which verifies DLEQ when present), re-checks with `hasValidDleq`, and checks count, amounts, keyset, the lock and the total.
- `client.ts`, payout:
  - `preparePayout` (coordinator): checks each quote is PAID in full, unissued and locked to the backer's pubkey, fetches the active sat keyset and builds the `BatchPlan`. The plan holds secrets and blinding factors, never a signing key, and is saved under `plan:<campaign>`.
  - `authorizeBatch` (backer): checks this browser owns the paid deposit, fetches the active keyset itself, runs `verifyPackage`, signs, and saves `release:<quote>` (quote, signature, outputs digest, time) before returning. If that save fails, the signature is not returned. A second call with the same outputs returns the saved signature; different outputs are refused.
  - `payout`: refuses bad approvals before any network call. It saves the operation as `prepared` (exact body string, ordered outputs, keyset), then `dispatched`, and only then posts `/v1/mint/bolt11/batch`. A failed save sends nothing.
    - 200: confirmed only after the proofs verify, all quotes read ISSUED and the proofs are saved.
    - Cashu 4xx: `rejected`.
    - Network error, timeout, 5xx, or a 200 that does not verify: `pending`, left `unresolved` with the response kept. There is no retry with new outputs.
  - `signLockedProofs` (maintainer): signs payout proofs with the key in this browser, with NUT-11 witnesses as JSON strings.
- `recovery.ts`: `RecoveryStore` over the same storage. `listUnresolved` excludes confirmed and rejected operations.

Still throws: `reclaim`, `recover` (NUT-09 restore of unresolved operations).

Live tests (`PLEB_LIVE=1 npm run test:live`, evidence in `.evidence/`):

- `tests/live/deposit.test.ts`: an unsigned mint and one signed by another backer are rejected, the quote stays paid and unissued, and the owner's signature mints 21 sats.
- `tests/live/payout.test.ts`: three separate backer clients approve one package. `payout` refuses two approvals locally. The mint rejects a batch whose third signature is missing or invalid, and the quotes stay PAID. The full batch then confirms 63 sats of maintainer-locked proofs and all three quotes read ISSUED. Finally the maintainer swaps them, receiving 63 minus the input fee.

Source reviewed: `/workspace/all-together-spike/scripts/` and `KILL-TEST-REPORT.md`. Checks 1–5 passed on testnut.cashudevkit.org; real funding, persistent key backup and simultaneous contention were not established by the spike.
