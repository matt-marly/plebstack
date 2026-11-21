# Protocol boundary

Real now, against `https://testnut.cashudevkit.org` with cashu-ts 4.13.1:

- `keys.ts`: owner-local keys (`createRandomSecretKey`, compressed 33-byte pubkey). The private key is stored only in this browser under `plebstack:key:<pubkey>`. Backers and the maintainer enroll the same way; only the pubkey leaves, for example as `Campaign.beneficiaryPubkey`. `isValidPubkey` checks the 02/03 prefix and that the point is on the curve.
- `storage.ts`: versioned records over any `getItem`/`setItem`/`removeItem` store. A failed write throws `StorageError`.
- `client.ts`: `createQuote` saves a pending deposit record (mint, amount, owner pubkey, time) after checking the key is saved, then sends the NUT-20 locked quote request, rejects any answer that does not echo our pubkey, and saves the quote before returning it. A failed save means no request is sent. `checkDeposit` and `waitForDeposit` poll with bounded backoff, are abortable, save every state change, and succeed only on `PAID` with `amount_paid` equal to the amount and `amount_issued` 0. `ISSUED` before we issued anything is an error. `abandonUnanswered` marks requests whose answer was never seen.
- `signer.ts`: browser port of `scripts/quote-signature.mjs`. `mintQuoteDigest` is the NUT-20 v1 transcript cashu-ts 4.13.1 uses internally: sha256 over the raw tag `Cashu_MintQuoteSig_v1`, then 4-byte big-endian length frames for the quote id, and per output the minimal big-endian amount and `B_`. Signed with `schnorrSignDigest`. Never the public `signMintQuote`, which signs the legacy transcript. The signer refuses quotes its key does not own. `stopNewApprovals` is a local flag only.
- `recovery.ts`: `RecoveryStore` over the same storage. Nothing calls it yet.

Still throws: `authorizeBatch`, `payout`, `reclaim`, `recover`.

`tests/live/deposit.test.ts` proves the lock on the real mint: an unsigned mint and one signed by another backer are rejected, the quote stays paid and unissued, and the owner's browser-signer signature mints 21 sats.

For the payout and reclaim still to come: await `saveBeforeDispatch` before network calls. Save the exact request, ordered output construction data and keyset. NUT-09 restores matching signatures; it does not recover lost signing keys. Only matching, verified creator or owner outputs resolve a quote marked ISSUED. Save proofs before reporting a confirmed result. A timeout stays unresolved and must reuse the original outputs. Port the spike's independent output reconstruction and creator-lock checks; a recipient label alone is insufficient. Adapt the spike's NUT-11 witness serializer: witnesses are JSON strings on the wire.

Source reviewed: `/workspace/all-together-spike/scripts/` and `KILL-TEST-REPORT.md`. Checks 1–5 passed on testnut.cashudevkit.org; real funding, persistent key backup and simultaneous contention were not established by the spike.
