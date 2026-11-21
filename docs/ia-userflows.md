# Information architecture and flows

Stable paths below are implemented by the prototype. Parameters are identifiers, not secrets. History fallback to `index.html` will be needed on any later host; this task does not deploy a host.

| Route | Purpose |
| --- | --- |
| `/` | Explain the control boundary and link to creation / illustrative campaign |
| `/campaigns/new` | Fix public-work details, beneficiary and three equal deposits |
| `/campaigns/:campaignId` | Campaign facts, deposited total and group readiness |
| `/campaigns/:campaignId/back` | Create owner-locked BOLT11 quote and fund deposit |
| `/campaigns/:campaignId/deposits/:depositId` | Owner's deposit status and direct recovery entry |
| `/campaigns/:campaignId/deposits/:depositId/approve` | Verify outputs and explicitly release signature |
| `/campaigns/:campaignId/deposits/:depositId/reclaim` | Owner reclaim, warning, confirmation and race outcome |
| `/campaigns/:campaignId/payout` | Complete batch status and creator receipt |
| `/recovery` | Resume locally persisted operations and inspect unresolved results |
| unmatched path | Page not found with home link |

Sitemap: home → create campaign → campaign → back → deposit → approve or reclaim. Campaign → payout. Global navigation → recovery. All money pages must show mint identity, ownership and current sentence. The prototype uses stub campaigns and a stub mint, and performs no real operations. Adding `?demo=1` to any path opens the recording bar; `?beat=<id>` loads one step of the demo script (`src/demo/beats.ts`).

## Create campaign

```mermaid
flowchart TD
  A[Home /] --> B[Create /campaigns/new]
  B --> C[Fix three slots, amount, mint and public work]
  C --> D[Creator independently confirms beneficiary key]
  D --> E{Details valid?}
  E -->|No| B
  E -->|Yes| F[Save public campaign; no private keys]
  F --> G[Campaign /campaigns/:campaignId]
```

## Back

```mermaid
flowchart TD
  A[Campaign] --> B[Back /campaigns/:campaignId/back]
  B --> C[Owner creates quote-specific key locally]
  C --> D[Create NUT-20 locked BOLT11 quote]
  D --> E[Check echoed owner key; save quote locally]
  E --> F[Show invoice; awaiting deposit]
  F --> G{Mint confirms PAID and unissued?}
  G -->|No or timeout| F
  G -->|Yes| H[Deposit /campaigns/:campaignId/deposits/:depositId]
  H --> I[Deposited at mint; not paid to creator]
```

## Approve

```mermaid
flowchart TD
  A[Three matching paid unissued quotes] --> B[Campaign ready]
  B --> C[Approve /campaigns/:campaignId/deposits/:depositId/approve]
  C --> D[Recompute complete outputs; verify creator lock, amount, order and keyset]
  D --> E{Valid and owner explicitly agrees?}
  E -->|No| F[Keep deposited; no signature release]
  E -->|Yes| G[Sign owned quote over exact output set]
  G --> H[Approved; reclaim can still race payout]
  H --> I[Send signature to coordinator; never send private key]
```

## Payout

```mermaid
flowchart TD
  A[All three signatures over same outputs] --> B[Persist exact payout outputs and request before dispatch]
  B --> C[Payout /campaigns/:campaignId/payout]
  C --> D[Submit one NUT-29 batch; paying out]
  D --> E{Result known?}
  E -->|Timeout| F[Recovery /recovery; restore same outputs]
  F --> E
  E -->|Rejected| G[Reconcile quote states and own-output receipts]
  E -->|Matching issuance| H[Unblind, verify, persist creator-locked proofs]
  H --> I[Paid; mint confirmed]
  I --> J[Creator independently spends; show spend fee]
```

## Unmet and reclaim

```mermaid
flowchart TD
  A[Unmet or collection stopped locally] --> B[Deposit owner chooses Take mine back]
  B --> C[Reclaim /campaigns/:campaignId/deposits/:depositId/reclaim]
  C --> D[Warn if signature already released]
  D --> E[Save own outputs and exact reclaim request before dispatch]
  E --> F[Owner signs NUT-04/20 mint of own quote; reclaiming]
  F --> G{Matching mint issuance?}
  G -->|Yes| H[Verify and save proofs; reclaimed]
  G -->|Unclear| I[Recovery; inspect exact output signatures]
  I --> G
  G -->|Quote already issued| J[Resolve payout versus reclaim; do not infer from ISSUED alone]
```

## Released-signature race

```mermaid
flowchart TD
  A[Approved; signature cannot be revoked] --> B[Local stop blocks new signatures only]
  B --> C[Owner starts reclaim while coordinator can still submit batch]
  C --> D{Which issuance confirms first?}
  D -->|Batch wins| E[Creator output signatures match saved batch]
  E --> F[Paid to creator; later reclaim rejected]
  D -->|Own reclaim wins| G[Own output signatures match saved reclaim]
  G --> H[Reclaimed; stale batch rejected]
  H --> I[Other quotes stay deposited and independently reclaimable]
  D -->|Network result unknown| J[Keep paying out or reclaiming; check mint and restore outputs]
  J --> D
```

The spike tested both orderings sequentially, not simultaneous contention. There is no “cancelled means safe” terminal money state. A countdown or local deadline cannot expire a released signature.
