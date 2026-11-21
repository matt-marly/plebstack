# Protocol boundary

`client.ts` reserves calls for the proven spike flow. Every implementation currently throws; the browser makes no mint requests. `QuoteSigner` stays in the owner's client. Campaign and coordinator models contain no private keys. `RecoveryStore` is a contract, not implemented storage.

The exact proven helper is copied unchanged to `scripts/quote-signature.mjs`. It is Node-only (`node:crypto` and Buffer), intentionally outside the browser import graph. It signs the amended domain-separated, length-framed transcript with cashu-ts 4.13.1's public `schnorrSignDigest`. Do not replace it with that version's public legacy `signMintQuote`.

When integrating the browser signer, adapt the byte/hash primitives from this helper, preserving its transcript. Verify the result against the copied helper and spike vectors before connecting it to authorization. Then port the spike's independent output reconstruction and creator-lock checks; a recipient label alone is insufficient. Keep signature release distinct from local approval stopping.

Payout and reclaim must await `saveBeforeDispatch` before network calls. Save the exact request, ordered output construction data and keyset. NUT-09 restores matching signatures; it does not recover lost signing keys. Only matching, verified creator or owner outputs resolve a quote marked ISSUED. Save proofs before reporting a confirmed result. A timeout stays unresolved and must reuse the original outputs. Adapt the spike's NUT-11 witness serializer: witnesses are JSON strings on the wire.

Source reviewed: `/workspace/all-together-spike/scripts/` and `KILL-TEST-REPORT.md`. Checks 1–5 passed on testnut.cashudevkit.org; real funding, persistent key backup and simultaneous contention were not established by the spike.
