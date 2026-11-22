# Plebstack: brand, copy and reskin brief

21 November 2026 · Owner: Iyanu, product design · Status: for my approval. Nothing in `src/` changes until the decisions in section 11 are signed off.

Plebstack is the new name for All Together. The product does not change. This brief replaces the Plebstack brand book and build brief v1.0 and the v0.2 identity PDF. The look stays. The words change wherever they claimed something we did not build or did not prove. Where the brand book and this brief disagree, this brief wins.

The name is cleared.

## What the product does

Exactly three backers fund one payout to one maintainer, at one mint.

1. Each backer makes a key for their quote, in their own browser, and creates a NUT-20 locked BOLT11 quote at the mint. The deposit sits at the mint, locked to that key.
2. The organizer coordinates public data and signatures. The organizer never holds a private key.
3. When all three deposits are paid and unissued, each backer checks the same complete output set on their own page and signs their own quote. All three signatures are required. A missing or invalid signature is rejected by the mint and consumes no deposits.
4. One NUT-29 batch issues NUT-11 P2PK proofs locked to the maintainer's key. The secrets have empty tags, which means the default SIG_INPUTS, not an explicit SIG_ALL tag.
5. Paid shows only after the app has unblinded and verified the mint's batch response and emitted `mint-confirmed`.
6. If the goal is missed, each owner can reclaim their own unissued quote by minting it into their own outputs (NUT-04/20). The owner chooses to do this. It is not a Lightning refund, and nothing releases it on a timer.
7. A released signature cannot be taken back. A reclaim can still race the payout. Whichever the mint issues first wins.

What was tested, and where:

- Kill test, 13 November 2026, checks 1–5 passed. Mint `https://testnut.cashudevkit.org`, cdk-mintd/0.18.0, cashu-ts 4.13.1, fake sats, quotes credited by the mint without any payment. 21 sats per backer, 63-sat payout, 62 sats after the maintainer's 1-sat swap fee. `/workspace/all-together-spike/KILL-TEST-REPORT.md`.
- Lightning melt spike, 21 November 2026. `/workspace/all-together-spike/LIGHTNING-SPIKE.md`. Summary in section 8.
- Not tested: real Lightning funding, a real Lightning payout, any mainnet mint, simultaneous race contention.

---

## 1. Pitch

### One breath

> **Stay humble, stack together.**
> Three plebs each put 21 sats at one Cashu mint, locked to their own key. When all three are in, each pleb checks the same 63-sat payout and signs. The mint issues it in one batch, locked to the maintainer's key. Miss the goal and each pleb mints their own 21 sats back. The organizer never holds a key.

The tagline stays. It is true: three separate stacks pay one maintainer together.

Short line for headers and cards:

> Crowdfunding on Cashu ecash. The organizer never holds your key.

"Self-custodial crowdfunding" goes. A Cashu deposit sits at the mint, and the mint holds it. What we can say is narrower: the deposit is locked to the backer's key, the key stays in the backer's browser, and nobody else can sign for it.

### Mechanic to brand

| Mechanic | Brand expression |
|---|---|
| Three separate quotes at one mint | Three separate **slabs**, never merged |
| Each quote locked to its owner's key | Slabs sit offset, placed by different hands |
| The goal: 63 sats from three backers | The **goal line**: dashed while open, solid ink when all three are in |
| One batch, confirmed by the mint | The pile **lights up** in lime, bottom to top, once |
| Proof | The receipt names the mint, the quote IDs, the keyset and the confirmed time |

### Name

- **pleb**: what bitcoiners call themselves. Regular people, not whales or funds.
- **stack**: the oldest verb in bitcoin.
- **Plebstack**: funding from the people who use the code, for the people who write it.

Lowercase in the wordmark: **plebstack**. In running text: **Plebstack**.

### Audience and position

Bitcoin and Cashu people who keep their own keys, and the maintainers they fund. The first judges are Cashu builders. They know the NUTs better than our copy does, so the copy names the NUTs it uses and claims nothing past them.

We are not a fintech, a token, a vault, a pool, or anything chrome. We are also not a Lightning payout service. The payout is ecash at the mint, locked to the maintainer.

---

## 2. Voice

Sound like a pleb who ships. Dry, exact, short. Sats first. Real numbers. No adjective the mint can't confirm.

### The culture says, we say

| The culture says | We say |
|---|---|
| Stay humble, stack sats. | Stay humble, stack together. |
| Not your keys, not your coins. | The organizer never holds your key. Your sats wait at the mint until you sign or take them back. |
| Don't trust, verify. | Check the outputs before you sign. Then check the mint's confirmation. |
| Cypherpunks write code. | Plebs fund the people who write it. |
| Tick tock, next block. | Times here are clock times. The mint's confirmation is what counts. |

The tick-tock reply is now plain fact. We show clock times, and Paid comes from the mint, not from a block or a deadline.

### Rules

- Sats first, with the unit: "21 sats", never "21".
- Name the mint. Name the maintainer.
- Say "at the mint" for where deposits are. Never "in your wallet" or "in your keys".
- Say "sign" for releasing an authorization. Say "take back" or "reclaim" for the owner's own mint. Never "refund", never "revoke", never "cancel" for a released signature.
- Say "paid" only after `mint-confirmed`.
- Times are wall-clock with a zone: "21 Nov, 18:12 WAT". UTC beside it on receipts.

**Never say:** to the moon, WAGMI, tokens, altcoin, yield, vault, pool, trustless, self-custodial, non-custodial, refund (for a reclaim), revoke, preimage (as proof of payment), block height, "funded!" or "paid" before the mint confirms. No rocket, no laser eyes, no emoji.

---

## 3. Microcopy library

Demo values from `src/demo/world.ts`: campaign "Fix daylight-saving drift in recurring events", maintainer Ngozi Eze, backers Tobi, Maren and Ishaan, 21 sats each, 63 sats total, mint `testnut.cashudevkit.org`. Braces mark values the app fills in.

### Seven states

The plain state word stays exactly as in `src/domain/states.ts`. The pleb phrase sits under it. The sentence replaces the current one.

| State | Pleb phrase | Sentence |
|---|---|---|
| Deposited | Stacked | 21 sats at the mint, locked to your key. Not paid to Ngozi. |
| Ready | At the line | All three deposits are in. Each pleb checks the outputs and signs. |
| Approved | Signed | You signed. You can't take it back. A reclaim can still race the payout. |
| Paying out | Sending | Sent to the mint as one batch. Not paid until the mint confirms. |
| Paid | Stacked. Paid. | Paid to Ngozi Eze. Confirmed by the mint. |
| Reclaiming | Unstacking | Asking the mint for your own 21 sats. If you signed, the payout may still win. |
| Reclaimed | Back to you | 21 sats minted to your own outputs. Confirmed by the mint. Not a Lightning refund. |

"Awaiting deposit" is a quote setup status, outside the seven. Sentence: "Pay this invoice to stack 21 sats. Not stacked until the mint reports it paid."

### Main moments

| Moment | Copy |
|---|---|
| Home headline | Three plebs pay one maintainer together, or not at all. |
| Home sub | Each deposit waits at the mint, locked to its owner's key. The organizer never holds one. |
| Create: fixed terms | Three plebs. 21 sats each. One mint. One maintainer key. |
| Maintainer key check | Ngozi confirms this key on their own device before anyone deposits. |
| Invoice shown | Pay this invoice to stack 21 sats. Not stacked until the mint reports it paid. |
| Copy invoice | Copy invoice · Copied |
| Deposit confirmed | Stacked. 21 sats at the mint, locked to your key. |
| Collecting | 2 of 3 stacked · 42 of 63 sats. |
| Goal line label, collecting | goal · 42 of 63 sats |
| Goal line label, ready | at the line · 63 of 63 sats |
| Goal line label, paid | goal reached · 63 sats paid |
| Signature count | Signed {n} of 3. All three have to sign. |
| Review before signing | You're signing your 21 sats into one 63-sat payment, locked to Ngozi Eze's key. Check the outputs. A signature can't be taken back. |
| Output check passed | Outputs checked on this device: 63 sats, keyset {keyset}, locked to Ngozi's key, no refund path. |
| Output check failed | These outputs don't match the campaign. Don't sign. {reason} |
| Sign dialog | Release your signature for the 63-sat payout? · Release signature · Not yet |
| You signed | Signed. You can't take this back. A reclaim can still race the payout. |
| Signature rejected by the mint | The mint rejected a signature. No deposit was used. Everyone's 21 sats are still at the mint. |
| Paying out | Sending · waiting for the mint. |
| Last checked | Last checked {time}. |
| Mint slow | Still waiting for the mint. The request is saved. Nothing is paid until the mint confirms. |
| Check again | Check again (asks the mint about the same saved request) |
| **Paid** | **Stacked. Paid.** 63 sats from 3 plebs to Ngozi Eze. Confirmed by the mint at {time}. |
| Maintainer spend | Ngozi spent it. Swap fee at the mint, 1 sat. Received, 62 sats. |
| Goal missed | No payout this time. Take your 21 sats back as ecash at this mint. |
| Take mine back | Take mine back |
| Reclaim confirm, not signed | Mint your 21 sats into your own outputs at this mint? This is not a Lightning refund. |
| Reclaim warning, signed | You already signed. If the payout reaches the mint first, your 21 sats go to Ngozi. |
| Reclaiming | Unstacking. Waiting for the mint. |
| Reclaimed | Back to you. 21 sats minted to your own outputs, saved in this browser. |
| Copy ecash | Copy ecash · Copied |
| Race: payout won | The payout got there first. Your 21 sats went to Ngozi. Your reclaim was rejected. |
| Race: reclaim won (you) | Your reclaim got there first. The payout was rejected. |
| Race: reclaim won (others) | Maren took theirs back first. The payout was rejected. Your 21 sats are still at the mint. |
| Stopped signing | You stopped signing on this device. A signature you already released still counts. |
| Stopped collecting | Collecting stopped. Signatures already released still count. |
| Someone else's deposit | This is Maren's deposit. Only Maren can sign it or take it back. |
| Recovery | The request is saved on this device. Check again asks the mint about the same request. |
| Recovery, unresolved | The mint says this quote is issued, but we haven't matched the outputs. Not marked paid or reclaimed. |
| Storage failed | Couldn't save the request on this device. Nothing was sent to the mint. |
| Share card | We stacked 63 sats for Ngozi Eze. Three plebs, one batch, confirmed by the mint. Test mint, fake sats. |

### Live-region sentences

Each fires once, in the frame the state changes. Unchanged polling is not announced.

- Deposited: "Stacked. 21 sats at the mint, locked to your key."
- Approved: "Signed. You can't take it back."
- Paying out: "Sent to the mint. Waiting for the mint to confirm."
- Paid: "Stacked. Paid. 63 sats from 3 plebs to Ngozi Eze. Confirmed by the mint at {time}."
- Reclaimed: "Back to you. 21 sats minted to your own outputs."
- Batch rejected: "The payout was rejected. Your 21 sats are still at the mint."

---

## 4. Visual system

The look from the brand book stays: night ground, signal lime for one meaning, the slab mark, the goal line, seven shaped states, slabs with weight.

### Colour

I keep the existing `--color-*` names in `src/styles/tokens.css` and change the values, so components don't churn.

| Token | Night (default) | Paper |
|---|---|---|
| `--color-canvas` | `#0B0B0C` | `#F4F4F1` |
| `--color-surface` | `#161618` | `#FFFFFF` |
| `--color-ink` | `#F4F4F1` | `#0B0B0C` |
| `--color-muted` | `#A1A1AA` (7.7:1) | `#55555C` (6.7:1) |
| `--color-rule` | `#2A2A2E` | `#DCDCD6` |
| `--color-border` | to measure, needs 3:1 | to measure, needs 3:1 |
| `--color-signal` | `#C8F135` (15.1:1) | `#4A6B00` (5.6:1) |
| `--color-on-signal` | `#0B0B0C` | `#FFFFFF` |
| `--color-error` | `#F0908A` | `#A12622` |

Ratios are the brand book's, against the ground. I re-measure every text pair against the surface too before sign-off.

**Lime rule.** Signal lime (`#C8F135`, paper `#4A6B00`) appears only for the Paid state and the reached goal line. "Reached" means the mint confirmed the payout. Not Ready, not Approved, not Reclaimed, not buttons, not focus rings, not the header mark. `--color-success` becomes an alias of `--color-signal`. Reclaimed moves to its own grey.

State colours. Each is always paired with a shape and a label.

| State | Night | Paper |
|---|---|---|
| Deposited | `#B4B4BC` | `#52525B` |
| Ready | `#2DD4BF` | `#0F766E` |
| Approved | `#8FA8FF` | `#2944C2` |
| Paying out | `#F5A524` | `#8A5A00` |
| Paid | `#C8F135` | `#4A6B00` |
| Reclaiming | `#C4A1FF` | `#7E3FB8` |
| Reclaimed | `#85858E` | `#66666E` |

The theme follows the system until the header theme button is used. The choice stays in `localStorage`, as now.

### Mark

Four slabs on a 48-unit grid. Construction is unchanged from the brand book:

| Slab | x | y | width | height | radius |
|---|---|---|---|---|---|
| 1 (top) | 15 | 9 | 20 | 6 | 1.5 |
| 2 | 10 | 17.5 | 24 | 6 | 1.5 |
| 3 | 13 | 26 | 27 | 6 | 1.5 |
| 4 | 8 | 34.5 | 29 | 6 | 1.5 |

Below 32px, use the small drawing on the 16-unit grid (thicker slabs, wider gaps), as in the brand book.

**The mark is a symbol, not a headcount.** Four slabs say "separate stacks, one pile". The product has three backers. Every drawing of an actual campaign, the goal line, shows three slabs. The mark never appears where a count is being shown.

- In the app, the mark and wordmark are single-colour `currentColor` ink, inline SVG.
- On launch assets outside the running app (title card, social preview, app icon), the top slab may be lime. Decision 4.
- Never rotate the stack, merge or overlap slabs, add a ₿, or turn slabs into coins. No gradients, shine, chrome or glow. Clear space is one slab height. Minimum 16px, small drawing.

### Wordmark

Instrument Sans SemiBold (600), outlined, lowercase, one line, −2.8% tracking. The t's crossbar is a rounded slab from the mark (340 × 99 units, radius 24). Always the supplied outlines. Horizontal lockup: mark at 0.92× type size, gap 0.30×, mark centred on the x-height. Stacked lockup for square formats. Never caps, never stacked words, never a tagline inside the lockup.

### Type

- **Brand assets** (SVG and PNG exports only): Instrument Sans for headlines and body, JetBrains Mono for data.
- **App**: the system font stack, as now. `ui-monospace` for sats, quote IDs, keyset, keys, mint URL and times. Tabular numerals, right-aligned amounts. No webfont is added.
- Headlines: sentence case, one or two lines.

### Goal line, the signature device

Every campaign is drawn as a pile of three slabs under a goal line. It replaces the three-line bracket from `design-system.md`. We ship one quirk, not two.

- Three slabs, one per deposit. All three are 21 sats, so all three are the same width.
- Offset is set by a hash of the quote's public key. Each slab gets a stable spot.
- Slab height 12–14px, gap 4–6px, radius 3px.
- An open slot is a dashed slab outline.
- Your slab has a 1.5px outline at a 2px offset, so you can find yourself.
- The line: dashed `2px` muted while collecting. Solid ink when all three are in (Ready). Solid `--color-signal` only after `mint-confirmed` for the payout.
- Mono label, 11px: `goal · 42 of 63 sats` → `at the line · 63 of 63 sats` → `goal reached · 63 sats paid`.
- Unmet: the line stays dashed. A reclaimed slot becomes an empty outline.
- The pile has an accessible text equivalent: "2 of 3 deposits in, 42 of 63 sats." The drawing itself is `aria-hidden`.

### State chips and glyphs

Every glyph is built from slabs and the goal line. Each has its own shape, so colour is never the only signal. Every state reads in greyscale.

| State | Glyph | Replaces in `Icon.tsx` |
|---|---|---|
| Deposited | One slab under a dashed line | tray-down |
| Ready | Three slabs touching a solid line | three-line-bracket |
| Approved | Pen nib on the slab | pen-nib (redrawn) |
| Paying out | The whole pile nudged right, two motion dashes | clock |
| Paid | The full pile, lit | circle-check |
| Reclaiming | One slab dropping from a dashed slot | counterclockwise-arrow |
| Reclaimed | Empty slab outline on a shelf line | tray-left |

Chips: glyph, plain word, pleb phrase under it. 44px targets where a chip is interactive. Glyphs are `aria-hidden`. The sentence carries the meaning.

### Icons

24px grid, 1.75px stroke, round caps. Money is a filled slab. Everything else is line. No padlocks, chains, coins, hexagons or vaults. Keys are drawn as a key in a hand.

The set of 16: Pleb, Maintainer, Stack sats, Reclaim, Sign (nib), Goal, Mint, Your key, Ecash, Clock, Lightning, Quote, Share, Scan, Copy ecash, Settings.

Lightning is used only on the deposit invoice, and on the optional melt step if it ships (section 8). Never on payout, Paid or reclaim.

### Motion

Slabs have weight. They drop, settle and stack. No bounce, spin or glow.

| Token | Value |
|---|---|
| `--ease-settle` | `cubic-bezier(.3, .8, .2, 1)` |
| `--ease-out` | `cubic-bezier(.2, .7, .2, 1)` |
| `--dur-fast` | 120ms |
| `--dur-base` | 200–240ms |
| `--dur-reveal` | 280ms |

- Words first. The state word, sentence and live region change in the frame the data changes. Drawing follows. No state or focus waits on `animationend`.
- Waiting is a "Last checked {time}" line that updates as text. No spinner, no progress bar, no ticking clock hand.
- CSS transitions and keyframes only. No motion package.
- Reduce Motion: end states at once, or a 150ms opacity fade. No transforms.

---

## 5. The paid moment

The screen people screenshot. It records a mint fact, so it cannot start before the fact.

### Trigger

The sequence starts only when all of these hold:

1. The NUT-29 batch response arrived for the saved operation.
2. The adapter unblinded the signatures, checked the mint's DLEQ proofs, checked that every proof is P2PK-locked to the maintainer's key and that they sum to 63 sats, and saved the proofs.
3. The adapter emitted `mint-confirmed` with destination `creator` for all three deposits, and the store committed Paid.
4. This is the session in which that confirmation arrived.

It never starts from: an HTTP 200 on its own, a quote reading ISSUED on its own, a melt result of any kind, a timer, a button, or a page load. After a reload, or a payout recovered later with NUT-09 restore, the page shows Paid and the static receipt. No sequence.

### Sequence

Total: under one second.

| t | Beat | Spec |
|---|---|---|
| hold | **Sending** | The pile sits 8px toward the maintainer label, as one block. Status `sending · waiting for the mint` in amber. "Last checked {time}" updates as text. Lasts as long as the mint takes. No lime. |
| 0ms | **Words** | Status flips to `paid · confirmed by the mint {time}`. Word **Paid**, sentence "Paid to Ngozi Eze. Confirmed by the mint." The live region announces in this frame. |
| 0–200ms | **Settle** | Gaps close 6px → 2px with `--ease-settle`. The pile slides home. |
| 160–280ms | **Line** | The goal line, already solid ink, turns lime. Label becomes `goal reached · 63 sats paid`. |
| 240–480ms | **Light up** | One lime fill across the pile, bottom to top (`clip-path`, 240ms). The three slabs light as one batch. |
| 480–760ms | **Headline** | "Stacked. Paid." rises 8px and fades in over 280ms. |
| 760–940ms | **Proof** | The receipt lines and **Share the stack** fade in over 180ms. |

Lime appears only after the 0ms beat. The words are on screen before any colour changes.

On the campaign page, a compact version plays: words, line, light-up. No headline rise. If the reader opens the payout page in the same session, the full sequence plays once there. A `sessionStorage` flag per operation stops it repeating. After a reload, everything is static.

### Receipt

The proof line is the mint's confirmation: mint URL, quote IDs, keyset id, confirmed time.

```
PAID · CONFIRMED BY THE MINT

Stacked. Paid.
goal reached · 63 sats paid

63 sats · 3 plebs              to {maintainer}
Mint        {mint URL}
Quotes      {quote 1}  ({backer 1})
            {quote 2}  ({backer 2})
            {quote 3}  ({backer 3})
Keyset      {keyset id}
Locked to   {maintainer key, short; full on demand}
Confirmed   {date}, {time} UTC · {local time}

[ Share the stack ]
```

The same layout, filled from the kill-test batch on 13 November, so the layout can be judged against real values:

```
Mint        https://testnut.cashudevkit.org
Quotes      01a1d22d-7261-7257-b127-0a87a8f6c7e2
            01a1d22d-7801-72d0-866d-2d93fd8e85f9
            01a1d22d-7bde-7211-b341-69d57fdf1b61
Keyset      00163d7a87ffcd92
Locked to   037663ce…bab2df260d
Confirmed   12 Nov 2026, 23:52:43 UTC · 13 Nov, 00:52:43 WAT
```

Rules:

- Each quote ID and the key expand to full form and have a copy control.
- **Confirmed** is this device's clock at the moment the adapter verified the mint's response and committed `mint-confirmed`. The mint does not sign a time. The receipt does not pretend it does.
- No preimage. No block height. No Lightning wording.
- When the maintainer spends, two lines are added with a plain fade: "Swap fee at the mint, 1 sat" and "Received by {maintainer}, 62 sats".
- On a test mint, the receipt foot says "Test mint, fake sats."

### Failure paths

- **Timeout or unknown result.** Stay on Sending. "Still waiting for the mint. The request is saved." **Check again** asks about the same saved operation and restores its exact outputs. Never a new request with new outputs. Never lime.
- **Batch rejected** (a reclaim won). Approved deposits return to Deposited, in ink. "Maren took theirs back first. The payout was rejected. Your 21 sats are still at the mint." No red, no shake.
- **Missing or invalid signature.** The mint rejects it and consumes nothing (kill test check 3). Say which signature was rejected. Deposits stay Deposited.
- **Partial or mismatched result.** Nothing celebratory. Show the mint's state as it is and link to `/recovery`.

### Accessibility

- **Reduce Motion:** the final frame at once, or a 150ms opacity fade. Same live-region sentence. No lime before confirmation in either case.
- **Screen reader:** "Stacked. Paid. 63 sats from 3 plebs to Ngozi Eze. Confirmed by the mint at {time}." Focus does not move.
- **Sound and haptics:** optional, off by default, and always off under Reduce Motion. If turned on: three short ticks as the fill passes each slab (triangle wave, 420 / 475 / 530 Hz, 60ms decay). Nothing in the product needs sound to be understood. Decision 6.

### Reference CSS

```css
@keyframes settle { from { gap: 6px } to { gap: 2px } }
@keyframes fill   { from { clip-path: inset(100% 0 0 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes rise   { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes fade   { from { opacity: 0 } to { opacity: 1 } }
.paid .pile  { animation: settle 200ms var(--ease-settle) both; }
.paid .lit   { background: var(--color-signal); animation: fill 240ms 240ms var(--ease-out) both; }
.paid .line  { transition: border-color 120ms 160ms var(--ease-out); }
.paid .head  { animation: rise 280ms 480ms var(--ease-out) both; }
.paid .proof { animation: fade 180ms 760ms var(--ease-out) both; }
@media (prefers-reduced-motion: reduce) {
  .paid * { animation: none !important; transition: none !important; }
}
```

`.paid` is set only by the store's Paid state in the confirming session. It is never set by a button.

---

## 6. Changelog against the brand book

Every brand-book claim I changed or struck. "BB" is the v1.0 brand book and build brief. "PDF" is the v0.2 identity document (11 pages).

| Old | New | Reason |
|---|---|---|
| BB, PDF title: "Brand book and build brief · v1.0" / "v0.2" | This brief, 21 November 2026, owned by product design. | One current source. |
| BB header, PDF cover: "Self-custodial crowdfunding on Cashu ecash." | "Crowdfunding on Cashu ecash. The organizer never holds your key." | The mint holds the deposits. Self-custodial overclaims. |
| BB header, PDF cover: "Every stack stays in its owner's keys until the goal is hit, and then one payout goes out." | Struck. Replaced by the one-breath pitch in section 1. | The deposit is at the mint, locked to the owner's key. It is not in the owner's keys. |
| BB header: two hosted links, design canvas and playable prototype | Struck. No replacement link. | Not part of the project record. |
| BB §0: "Plebstack lets them stack together without handing anything to a middleman." | "Plebstack lets them stack together without handing a key to an organizer." | The mint is a middleman. The true claim is about the organizer and keys. |
| BB §0: "Each backer's sats are a slab of their own, locked to their own keys and sitting next to everyone else's." | "Each backer's 21 sats are a slab of their own: a separate quote at the mint, locked to that backer's key." | Says where the sats are. One key per quote. |
| PDF 01: "Each pleb's sats are locked to their own keys … never poured into a custodian's pile." | "Each pleb's 21 sats wait at the mint, locked to their own key. The organizer never holds them." | The mint is custodial. The organizer is who never holds the deposits. |
| BB §0, PDF 01: "When the pile reaches the goal line, enough plebs sign and one Lightning payment goes out." | "When all three deposits are in, each pleb checks the same 63-sat outputs and signs. One batch at the mint issues ecash locked to the maintainer's key." | All three must sign. The payout is NUT-29 issuance of P2PK ecash, not a Lightning payment. |
| BB §0, PDF 01: "If the goal is missed, the locktime passes and every pleb takes back their own slab." / "after the locktime" | "If the goal is missed, each pleb can mint their own 21 sats back into their own outputs at the mint." | No locktime is used. Reclaim is chosen by the owner, signed by the owner, confirmed by the mint. Not timed, not a Lightning refund. |
| BB §0 table: "Each backer holds their keys → Slabs placed off-line, by different hands" | "Each quote locked to its owner's key → Slabs sit offset, placed by different hands" | The key locks the quote. The sats are at the mint. |
| BB §0 table: "The goal → dashed until it's reached" | "The goal → dashed while open, solid ink when all three are in, lime when the mint confirms the payout" | Ready is not success. Lime means paid. |
| BB §0 table: "Proof → The receipt shows the preimage and block height" | "Proof → The receipt names the mint, the quote IDs, the keyset and the confirmed time" | The test mint returns no preimage (null in the SDK, "" on poll). Nothing in the product has a block height. |
| BB §1: "A web search found no product named Plebstack … Run a trademark and domain check before launch." | "The name is cleared." | The check is done. |
| BB §1 What we're not: "A fintech, a token, a vault …" | Adds "a pool" and "a Lightning payout service". | The payout is ecash at the mint. |
| PDF 01 attribute chips: "Grassroots · Self-custodial · Verifiable · Dry humour" | "Grassroots · Your keys · Verifiable · Dry humour" | Same reason as the cover line. |
| BB §2, PDF 01: "Not your keys, not your coins. → Your stack never leaves your keys." | "The organizer never holds your key. Your sats wait at the mint until you sign or take them back." | False as written. The sats are at the mint. |
| BB §2, PDF 01: "Don't trust, verify. → Paid means a preimage. Check it yourself." | "Check the outputs before you sign. Then check the mint's confirmation." | No preimage comes back. What a backer can verify is the output set, and then the mint's issuance. |
| BB §2, PDF 01: "Tick tock, next block. → Every time is a block height." | "Times here are clock times. The mint's confirmation is what counts." | No block heights in the product. The mint's confirmation is the only clock that decides Paid. |
| BB §2 microcopy, Deposit confirmed: "Stacked. 2,000 sats, locked to your keys." | "Stacked. 21 sats at the mint, locked to your key." | Tested amount is 21. The sats are at the mint. |
| BB §2 microcopy, Goal reached: "At the line. Waiting for signatures (6 of 9)." | "All three deposits are in. Each pleb checks the outputs and signs." Count: "Signed {n} of 3. All three have to sign." | Exactly three backers. No threshold. |
| BB §2 microcopy, You signed: "Signed. 3 more plebs to go." | "Signed. You can't take this back. A reclaim can still race the payout." | Three backers. The signature is final and the race is real. |
| BB §2 microcopy, Paying out: "Sending · waiting for mint" | "Sending · waiting for the mint." | Kept. Sending means the batch request went to the mint, nothing else. |
| BB §2 microcopy, Mint slow: "Still waiting for the mint. Your sats haven't moved." | "Still waiting for the mint. The request is saved. Nothing is paid until the mint confirms." | With an unknown result the batch may have issued. We can't say the sats haven't moved. |
| BB §2 microcopy, Paid: "Stacked. Paid. 21,000 sats from 9 plebs." | "Stacked. Paid. 63 sats from 3 plebs to Ngozi Eze. Confirmed by the mint at {time}." | Tested amount and count. Names payee and confirmation. |
| BB §2 microcopy, Goal missed: "No payout this time. Reclaim after block 975,100." | "No payout this time. Take your 21 sats back as ecash at this mint." | No block height, no locktime, no waiting period. |
| BB §2 microcopy, Reclaimed: "Back in your keys. Nothing owed, nothing lost." | "Back to you. 21 sats minted to your own outputs, saved in this browser." | Reclaimed sats are ecash at the same mint, not "in your keys". "Nothing lost" ignores what the backer paid to fund the invoice. |
| BB §2 microcopy, Share card: "We stacked 21,000 sats for @maintainer." | "We stacked 63 sats for Ngozi Eze. Three plebs, one batch, confirmed by the mint. Test mint, fake sats." | Tested amounts. A share card is a public claim, so it says where it happened. |
| BB §2 microcopy | Adds the full library in section 3: invoice, signature rejected, race outcomes, stop signing, recovery, storage failure. | The brand book had no copy for the honest race or recovery paths. |
| BB §2 never-say: "to the moon, WAGMI, tokens, yield, vault, pool …" | Adds altcoin, trustless, self-custodial, non-custodial, refund (for a reclaim), revoke, preimage as proof, block height, "paid" before the mint confirms. No emoji. | Each is false here or off voice. |
| BB §3 heading: "The mark: four stacks, four hands, one pile" | "The mark: separate stacks, one pile" | Four slabs are a symbol. The product has three backers. |
| BB §3: "Four slabs, each one pleb's stack." | "Four slabs, a drawing of separate stacks. Not a count of backers. The goal line shows the real three." | Stops the mark reading as "four backers". |
| BB §3: "The gaps stay open because every stack is still locked to its owner's keys." | "The gaps stay open because each deposit is its own quote until one batch issues the payout." | True, and doesn't claim keys hold sats. |
| BB §3: "The top slab carries the accent: it's the stack that reaches the goal." | In the app the mark is single-colour ink. A lime top slab only on launch assets, if approved (decision 4). | One meaning for lime inside the product. |
| BB §4: "In full colour that slab is lime." (wordmark t) | Same on launch assets only. In-app wordmark is single-colour ink. | Same as above. |
| BB §5: "Lime appears only on the mark's top slab, the reached goal line and the Paid state." | "Lime appears only for Paid and the reached goal line. Reached means the mint confirmed the payout." | Ready must not take the success colour. |
| BB §5, §13: `--bg`, `--surface`, `--ink`, `--muted`, `--hairline`, `--signal` | Same values under the existing `--color-*` names. Adds `--color-border`, `--color-on-signal`, `--color-error`. | Components keep their token names. The app needs border and error colours. |
| BB §13: light theme by `prefers-color-scheme` only | Same, plus the existing header theme button and its `localStorage` choice. | The app already has a theme control. |
| BB §6: "Data: Sats, pubkeys, preimages, block heights" | "Data: sats, keys, quote IDs, keyset, mint URL, times" | We show none of the struck items. |
| PDF 04: "JetBrains Mono · Sats, keys, block heights" | "JetBrains Mono · Sats, keys, quote IDs, times" | Same. |
| BB §7: "Slab width is set by the amount (scaled to the largest contribution)." | "All three deposits are 21 sats, so all three slabs are the same width." | Fixed per-backer amount. |
| BB §7: "Slab offset is set by a hash of the backer's pubkey" | "…a hash of the quote's public key" | The product uses a key per quote. |
| BB §7: "Goal line … becomes solid --signal when reached." | "Dashed muted while collecting. Solid ink when all three are in. Solid signal after mint-confirmed payout." | Readiness is not success. |
| BB §7: "goal · 21,000 sats → goal reached · 21,000 sats" | "goal · 42 of 63 sats → at the line · 63 of 63 sats → goal reached · 63 sats paid" | Tested amounts. "Reached" is only said once paid. |
| PDF 04: "Relay rewrite · for @maintainer · 4 plebs / 9 plebs · 12,600 sats · 60% · 21,000 sats · block 974,210" | "Fix daylight-saving drift in recurring events · for Ngozi Eze · 2 of 3 plebs · 42 of 63 sats" | Demo campaign, three backers, no block height, no handle, no percentage. |
| BB §7 vs PDF 06: your-slab outline "1.5px" vs "1px" | "1.5px outline, 2px offset" | The two sources disagreed. |
| BB §8, PDF 05, Deposited: "Your slab lands under the goal line, locked to your keys." | "21 sats at the mint, locked to your key. Not paid to Ngozi." | Says where the sats are. |
| BB §8, PDF 05, Ready: "The pile reached the goal. Waiting for signatures." | "All three deposits are in. Each pleb checks the outputs and signs." | All three required. Ready also needs a verified output package. |
| BB §8, PDF 05, Approved: "The pen nib appears on each pleb's slab as they sign." | Same glyph. Sentence: "You signed. You can't take it back. A reclaim can still race the payout." | Adds the race. |
| BB §8, PDF 05, Paying out: "Top slab sliding out, with motion dashes" / "The top slab slides out over Lightning. Not paid until the mint replies." | "The whole pile nudged toward the maintainer, with motion dashes. Sent to the mint as one batch. Not paid until the mint confirms." | One batch for all three, not one slab, and not over Lightning. |
| BB §8, PDF 05, Paid: "The whole stack, the mark itself. Preimage in hand." | "The full pile, lit. Paid to Ngozi Eze. Confirmed by the mint." | No preimage. |
| PDF 05, Reclaiming: "Locktime passed. Your slab drops back toward you." | "Asking the mint for your own 21 sats. If you signed, the payout may still win." | No locktime. Owner chose it. The race is real. |
| BB §8, PDF 05, Reclaimed: "Back in your keys" / "An empty slot on the shelf. Nothing owed, nothing lost." | "Back to you" / "21 sats minted to your own outputs. Confirmed by the mint. Not a Lightning refund." | Same as the Reclaimed microcopy row. |
| PDF 05: "Times are block heights ('reclaimable after block 975,100'), with the wall-clock time on long-press." | "Times are wall-clock with a zone: '21 Nov, 18:12 WAT', UTC beside it on receipts." | No block heights, and reclaim has no "after" time. |
| PDF 05: "Colour only confirms. Lime is used for Paid and nothing else." | Kept, plus the reached goal line, which is lit only when paid. | Consistent with the lime rule. |
| BB §10: "It fires only after the mint returns a paid melt response with a preimage." | "It fires only after the NUT-29 batch response is unblinded, verified and saved, and `mint-confirmed` is emitted for all three deposits." | Paid is issuance to the maintainer's key. A melt is not Paid. There is no preimage. |
| PDF 06: "Under a second, and only after the mint confirms the Lightning payment." | "Under a second, and only after the mint confirms the batch." | Not a Lightning payment. |
| PDF 06: "Gate. Trigger only on the mint's paid melt response with a preimage." | "Gate. Only on `mint-confirmed` in the confirming session. Never on an HTTP 200, a quote reading ISSUED, a melt result, a timer, a button or a reload." | Same, plus what the gate refuses. |
| BB §10 hold: "Top slab sits translateX(28%) toward the maintainer." | "The whole pile sits 8px toward the maintainer label, as one block." | One batch moves as one block. |
| BB §10 0ms, PDF 06: "Status flips to `paid · block 974,210`" / "MINT CONFIRMED · BLOCK 974,210" / "PAID · BLOCK 974,210" | "`paid · confirmed by the mint {time}`" | No block height. |
| BB §10 line: "Goal line turns --signal" at 200–320ms | 160–280ms, from solid ink. | It was already solid at Ready. |
| BB §10 light up: "Each slab fills ink → lime over 120ms, bottom to top, i×40ms. Each one plays a tick … haptic per slab, capped at 6, then .success." | "One lime fill across the three slabs, bottom to top, 240ms. Ticks and haptics optional, off by default, off under Reduce Motion." | One batch lights as one. Same look. Sound is never required. |
| BB §10 proof: "`21,000 sats · 9 plebs`, `preimage 9f2c…a41e`, then Share the stack and Replay" | "`63 sats · 3 plebs`, mint URL, quote IDs, keyset, confirmed time, then Share the stack" | No preimage. Replay struck: a replay looks like a new confirmation. |
| BB §10: "The screenshot shows a lime stack, a block height, a preimage, and the viewer's own outlined slab" | "The screenshot shows a lit pile, the mint, the quote IDs, the confirmed time, and the viewer's own outlined slab" | Same. |
| PDF 06: "Every pleb who chipped in sees their own slab light up." | "Each pleb who has the page open when the mint confirms sees it light up. After a reload the receipt is static." | It plays once, in the session the confirmation arrives. |
| PDF 06: "The headline and the preimage appear … a lime stack, a block height and proof." | "The headline and the mint's confirmation appear." | Same. |
| BB §10 failure: "Show 'Still waiting for the mint.' with a Retry button." | "'Still waiting for the mint. The request is saved.' Button **Check again** asks about the same saved request." | A retry must never send new outputs. |
| BB §10 a11y: "Reduce Motion: … One tick and the success haptic still fire." | "Final frame at once or a 150ms fade. No sound, no haptics under Reduce Motion." | Sound is optional, never under Reduce Motion. |
| BB §10, PDF 06: "VoiceOver: 'Stacked. Paid. 21,000 sats from 9 plebs. Preimage available.'" | "'Stacked. Paid. 63 sats from 3 plebs to Ngozi Eze. Confirmed by the mint at {time}.'" | Amounts, count, no preimage. |
| BB §10: "Sound follows the ringer switch, with a setting to turn it off." / PDF 06 toggle "Sound on" | "Sound off by default. A setting can turn it on. Always off under Reduce Motion." | The web has no ringer switch. Sound must not be required. |
| PDF 06 receipt: "PAID · BLOCK 974,210 … preimage 9f2c4e…71a41e" | Receipt in section 5: mint, quotes, keyset, locked-to key, confirmed time. | No block height, no preimage. |
| BB §11 icon: "Block height" | "Clock" | No block heights. |
| BB §11 icon: "Locktime" | "Quote" | No locktime is used. NUT-11 locktime, if ever used, is a unix timestamp. |
| BB §11 icon: "Copy token" | "Copy ecash" | "Tokens" is on our own never-say list. |
| BB §11 icon: "Lightning" | Kept, used only on the deposit invoice and a labelled optional melt step. | Payout and reclaim are not Lightning. |
| BB §11 icon: "Your keys" / "Ecash note" | "Your key" / "Ecash" | One key per quote. Shorter name. |
| BB §12, PDF title card slab tags: "Your stack, your keys · One payout · No custodian" | "Your key, your call · One batch · Organizer holds no keys" | "No custodian" is false. The mint holds the deposits. |
| BB §12, PDF title card paid card: "paid · block 974,210 · 21,000 sats · 9 plebs · @maintainer" | "paid · confirmed by the mint · 63 sats · 3 plebs · Ngozi Eze" | Same as the Paid rows. |
| BB §12 social preview: "paid stack card" | Paid card with foot line "testnut.cashudevkit.org · test mint, fake sats". | A paid screen on a share card is a claim. |
| BB §14 Sat 21: "Lock the name (trademark and domain check)." | "Trademark: cleared. This brief written and approved." | Done today. |
| BB §14 Mon 23: "Block-height timestamps." | Struck. Clock times with a zone. | No block heights. |
| BB §14 Tue 24: "Paid moment, wired to the mint's melt response. Ticks, haptics …" | "Tuesday: owner reclaim and both race outcomes. Paid moment on Wednesday, gated on `mint-confirmed`." | Melt is not Paid. Protocol comes first. |
| BB §14: Sat–Thu plan covers identity only | Replaced by the plan in section 9, protocol first. | Protocol wiring is the biggest remaining work. |
| BB §14 Thu 26: "Demo. Open on the paid moment." | "Demo opens on '2 of 3 stacked', as in `brief.md`, and reaches Paid through real calls to the test mint." | Opening on Paid without the deposits is the claim without the evidence. |
| BB §14 definition of done | Adds: no preimage, block height, locktime or "refund" anywhere; Paid only from `mint-confirmed`; every demo amount is 21 / 63 / 62. | Lock the corrections in. |

---

## 7. Mapping the existing product to Plebstack

The first clickable mockup, on stub data, had 35 layouts once its light, dark and phone variants were merged. This is a reskin and a copy pass. No new screens.

The plain state words in `src/domain/states.ts` stay, so tests that look for them keep working. The pleb phrase and new sentence sit under them. The `stateCopy.icon` names change to the slab glyphs.

### States

| State | Word (kept) | Pleb phrase | Old sentence | New sentence | Colour |
|---|---|---|---|---|---|
| deposited | Deposited | Stacked | Deposited at mint; not paid to creator. | 21 sats at the mint, locked to your key. Not paid to Ngozi. | grey |
| ready | Ready | At the line | Ready for each backer to approve. | All three deposits are in. Each pleb checks the outputs and signs. | teal |
| approved | Approved | Signed | Approved; reclaim can still race payout. | You signed. You can't take it back. A reclaim can still race the payout. | blue |
| paying out | Paying out | Sending | Paying out; checking the mint result. | Sent to the mint as one batch. Not paid until the mint confirms. | amber |
| paid | Paid | Stacked. Paid. | Paid to the creator; confirmed by the mint. | Paid to Ngozi Eze. Confirmed by the mint. | lime |
| reclaiming | Reclaiming | Unstacking | Reclaiming; payout may still win if approval was released. | Asking the mint for your own 21 sats. If you signed, the payout may still win. | violet |
| reclaimed | Reclaimed | Back to you | Reclaimed to your outputs; confirmed by the mint. | 21 sats minted to your own outputs. Confirmed by the mint. Not a Lightning refund. | grey, not lime |

`confirmedStates` in `states.ts` currently lets Reclaimed use the success hue. Under the lime rule, only Paid gets signal. Reclaimed keeps its confirmed meaning but takes its own grey. Decision 3.

Campaign-level states keep their logic in `campaignState`. Collecting: "2 of 3 stacked · 42 of 63 sats." Unmet: "No payout. Each pleb can take their own 21 sats back." Approved at campaign level: "Signed 3 of 3."

### Goal line replaces the bracket

The three-line bracket in `ContributionGroup.tsx` was the one deliberate quirk in `design-system.md`. The goal line takes its job: three separate deposits feeding one payout, open or closed. Dashed bracket becomes dashed line. Solid bracket becomes solid ink line. The goal line is also the hero on `/`. The bracket, the All Together mark, the perforated stub and the stamp from `motion-brand-plan.md` are retired. We ship one quirk.

### Routes and screens

| Route | Mockups | Reskin |
|---|---|---|
| `/` | home-light, home-dark, home-phone-light | Lockup in the header. Headline and sub from section 3. Goal-line pile as the hero, replacing the bracket illustration. |
| `/campaigns/new` | create-light, create-phone-light, create-errors-light | Tokens, copy. Fixed terms line: three plebs, 21 sats, one mint, one maintainer key. |
| `/campaigns/:campaignId` | campaign-collecting-light, -phone-light; campaign-ready-light, -dark, -phone-light; campaign-approved-light, -phone-light; campaign-paying-out-light; campaign-paid-light; campaign-unmet-light, -dark; campaign-after-reclaim-won-light | Goal line replaces the contribution bracket. State chips per row. Signature count. Compact paid change in the confirming session. |
| `/campaigns/:campaignId/back` | back-join-light, back-awaiting-deposit-light, -phone-light | Lightning icon on the invoice only. "Not stacked until the mint reports it paid." |
| `/campaigns/:campaignId/deposits/:depositId` | deposit-deposited-light, deposit-approved-light, deposit-paying-out-light, deposit-someone-elses-light | Your slab outlined. Chips. "Someone else's" says only that owner can sign or reclaim. |
| `…/deposits/:depositId/approve` | approve-review-light, -phone-light; approve-confirm-light, -dark; approve-stopped-light | Review names 21 into 63 and Ngozi's key, plus the output check result. Dialog keeps "Not yet" as the default focus. |
| `…/deposits/:depositId/reclaim` | reclaim-unmet-light; reclaim-confirm-light; reclaim-reclaiming-light; reclaim-reclaimed-light, -dark, -phone-light; reclaim-race-warning-light; reclaim-race-reclaiming-light; reclaim-race-payout-won-light; reclaim-race-reclaim-won-light | "Take mine back" stays. Never "refund" or "revoke". Race copy from section 3. No lime on Reclaimed. |
| `/campaigns/:campaignId/payout` | payout-not-sent-light; payout-paying-out-light, -phone-light; payout-paid-light, -dark, -phone-light | Paid moment and receipt from section 5. Stamp and perforation removed. |
| `/recovery` | recovery-light, -phone-light; recovery-settled-light; recovery-timed-out-light, -dark | Copy only: "The request is saved. Check again asks about the same request." |
| unmatched | not-found-light | Tokens and lockup. |
| `?demo=1` | demo-control-light, -phone-light | Stays outside the tokens. It is recording equipment. |

Screenshots are retaken with the existing screenshot script after the reskin. The new set replaces the old one file for file.

### Effort

Hours for one person.

| Phase | Item | Hours |
|---|---|---|
| A. Reskin, part 1 | Tokens: night default, paper theme, state colours, contrast re-measure | 2 |
| | Mark, small mark, wordmark, lockup, favicon as inline SVG | 1.5 |
| | Copy pass across 35 layouts, `stateCopy`, dialogs, live regions | 3 |
| B. Reskin, part 2 | Goal-line component replacing the bracket (three slabs, offsets, your-slab outline, dashed / ink / lime line) | 4 |
| | Seven slab glyphs and chips, both themes | 3 |
| | Paid moment (CSS), receipt, gate test | 3 |
| C. Finish | Retake screenshots; greyscale, Reduce Motion, 320px and 200% text pass | 2 |
| | Title card, social preview, app icon | 1.5 |
| | **Reskin total** | **20** |

| Protocol item | Hours |
|---|---|
| Owner-local quote keys, NUT-20 locked quote, echoed key check, deposit polling | 6 |
| Output package, independent verification, NUT-20/29 signature (port the spike adapter) | 8 |
| NUT-29 batch, unblind, DLEQ and P2PK checks, save proofs, `mint-confirmed` | 5 |
| Owner reclaim (NUT-04/20) | 4 |
| Race outcomes: payout won, reclaim won, batch rejected | 4 |
| Save before dispatch, NUT-09 restore, timeout and unknown results | 8 |
| Three browser profiles plus maintainer, end to end on the test mint | 4 |
| Recording | 3 |
| **Protocol total** | **42** |

Optional melt step: 6–10 hours (from the spike). Not in the totals.

62 hours across five and a half days is tight for one person. The cut list in section 9 protects the protocol. Reskin phase A is cheap and can go first on any day. Phase B waits until the batch path works.

---

## 8. Lightning

The full write-up is `/workspace/all-together-spike/LIGHTNING-SPIKE.md`. Treated as fact here:

- A melt to an invoice from the same test mint failed with "Invoice already paid". That mint credits its own invoices.
- After the 63-sat P2PK batch and a swap, a melt to an invoice from `https://testnut.cashu.space` was accepted: state PAID, `payment_preimage` null in the SDK and "" on the polled quote. Evidence: `evidence/lightning-melt-external-2026-11-21T17-12-20-826Z/`.
- Melting the P2PK proofs directly, no swap, also returned PAID with no preimage. Evidence: `evidence/lightning-melt-p2pk-direct-2026-11-21T17-13-34-349Z/`.
- No real Lightning payout was proven. No real sats were spent. A blank preimage is not proof.
- Minibits (`/Bitcoin`), Coinos and Cuba Bitcoin advertise NUT-11, NUT-20, NUT-29 and NUT-5 bolt11. None were sent mint or melt requests. A melt there spends real sats.
- `nofees.testnut.cashu.space` was unreachable (TLS EOF).

What this means for the brand:

- Paid is the mint-confirmed issuance to the maintainer's key. It never means a preimage.
- No Lightning wording on payout, Paid or reclaim.
- A melt step, if it ships, sits under the receipt, after Paid, labelled: "Melted on the test mint to a Lightning invoice. Fake sats. The mint returned no preimage." It never changes Paid, the paid moment or the receipt above it. The Paying out motion never implies a Lightning payment has started.

---

## 9. Plan, Saturday 21 to Thursday 26 November

Submission: **27 November 2026, 23:59 UTC (28 November, 00:59 WAT)**. Today is Saturday evening in Lagos. Protocol comes first each day. The reskin fits around it in this order: tokens, wordmark, state copy, then goal line and paid moment. Friday 27 is buffer and submission only.

| Day | Protocol (first) | Reskin and copy (after) |
|---|---|---|
| **Sat 21, evening** | List the exact SDK calls per route. Plan the browser port of the spike's quote-signature adapter and witness serializer. No `src/` change. | Trademark: cleared. This brief written. Decisions in section 11 approved. |
| **Sun 22** | Owner-local quote keys. NUT-20 locked quote, echoed key check, polling to PAID and unissued. Maintainer key enrollment. | Phase A: tokens (night default, paper theme, state colours). Header lockup, favicon. |
| **Mon 23** | Output package. Independent verification on each backer's page. Signing over the same 63-sat set. NUT-29 batch, unblind, verify, save, `mint-confirmed`. Re-run check 3 in the app: a missing signature is rejected and consumes nothing. | Phase A: state copy and microcopy pass across all 35 layouts and `stateCopy`. |
| **Tue 24** | Owner reclaim. Both race outcomes. Batch rejected returns deposits to Deposited. **Done means:** a real 63-sat batch and a real reclaim on the test mint from three browser profiles. Melt is not part of Tuesday's done. | Phase B: goal-line component replaces the bracket. Seven slab glyphs and chips. |
| **Wed 25** | Save before dispatch. NUT-09 restore after reload. Timeout and unknown results, Check again on the same operation. Storage failure aborts. | Phase B: paid moment gated on `mint-confirmed`, gate test, receipt. Reduce Motion, screen reader, AA re-measure. |
| **Thu 26** | Three isolated profiles plus maintainer on the test mint: successful payout, maintainer spend, unmet reclaim, both races, reload recovery. Record. | Phase C: retake screenshots. Title card, social preview. Melt bonus only if every protocol item is done and recorded by 12:00 WAT. |
| Fri 27 | Buffer. Fix only what the recording exposed. Submit before 23:59 UTC. | None. |

### Cut list, in order

1. Lightning melt bonus
2. Optional sound and haptics
3. App icon and its lime variant
4. Social preview (the title card stays)
5. Paid headline rise and proof fade (words, line and fill stay)
6. Light-up fill animation (lime appears at once, still after confirmation)
7. Pile settle and nudge motion
8. Pubkey-hash offsets (fixed offsets instead)
9. Paper theme polish beyond the token swap

**Never cut:** all three signatures required; save before dispatch; NUT-09 recovery; both race outcomes with honest copy; Paid and Reclaimed only after mint confirmation; the gate test; Reduce Motion; live-region sentences; shape plus label on every state; the copy corrections in section 6.

### Definition of done

- Lime appears only for Paid and the reached goal line.
- Nothing celebratory renders before `mint-confirmed`.
- No preimage, block height, locktime, "refund", "revoke" or "tokens" in the app or the assets.
- Every demo amount is 21, 63 or 62 sats. Three plebs. The maintainer is named.
- The receipt shows mint URL, quote IDs, keyset and confirmed time.
- Every state reads in greyscale.
- Reduce Motion tested in a real browser.
- The mark reads at 16px.
- A tester can say where the deposits sit (at the mint, locked to each backer's key) and why Signed is not Paid.

---

## 10. What this brief does not claim

- Not a real Lightning payout. Not real Lightning funding.
- Not anonymity from the mint. The mint sees the quotes in the batch.
- Not a deadline. Nothing expires a released signature, and nothing releases a reclaim on a timer.
- Not delivery. Paid means the maintainer received ecash, not that the work was done.
- Not a mainnet mint. Any real mint needs a fresh kill test first.

---

## 11. Decisions I still have to approve

Nothing in `src/` changes until these are signed off.

1. **Night as default.** Night when the system has no preference, paper when it asks for light, header button overrides. Recommended.
2. **Goal line replaces the bracket**, as the campaign device and the home hero. The bracket, old mark, stub and stamp are retired. Recommended.
3. **Reclaimed loses the success colour.** Lime is for Paid only. `confirmedStates` stays as the "mint-confirmed" list, and a separate rule picks the signal colour for Paid alone. Recommended.
4. **Lime top slab on launch assets.** Allowed on the title card, social preview and app icon, never in the running app. Or ink everywhere. I lean to allowing it outside the app.
5. **"Reached" means paid.** The goal line goes solid ink at Ready and lime only after `mint-confirmed`. Recommended.
6. **Sound.** Off by default with a setting to turn it on, or no sound at all for 27 November. I lean to none for the deadline. It is second on the cut list.
7. **Single fill vs per-slab stagger** for the light-up. Single fill recommended: one batch lights as one.
8. **Demo amounts.** 21 / 63 / 62 everywhere, and drop the 700 / 2,100 preset from the recording. Recommended.
9. **Plain state words stay** and pleb phrases sit under them, so the existing tests keep passing. Recommended.
10. **Melt bonus gate.** Only if every protocol item is done and recorded by Thursday 26 November, 12:00 WAT, on the test mint only, labelled fake sats. No real-sat melt without a separate yes from me.
11. **Product name in the shell.** Page titles and meta change to Plebstack. Routes stay as they are.
12. **Share card foot line.** "Test mint, fake sats" stays on every share card and paid screenshot while we are on testnut.
