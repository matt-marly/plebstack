# Design system foundation

Quiet and certain. A web application about a shared decision, with ordinary document structure and visible ownership. Borrow the art direction's discipline, not Cashu Wallet's iOS identity. The tokens below live in `src/styles/tokens.css`; the prototype screens are built from them.

## Tokens

| Role | CSS variable / value | Use |
| --- | --- | --- |
| Canvas | `--color-canvas: #faf9f6` | Warm neutral page |
| Surface | `--color-surface: #ffffff` | Form and reading surface |
| Ink | `--color-ink: #20221f` | Text, links, neutral actions and focus |
| Muted ink | `--color-muted: #575c55` | Secondary text, still AA on canvas |
| Border | `--color-border: #777c73` | Visible control boundaries |
| Rule | `--color-rule: #dedbd3` | Hairlines between sections and rows; decorative, never the only boundary of a control |
| On ink | `--color-on-ink: #faf9f6` | Text on an ink-filled primary button |
| Success | `--color-success: #17643c` | Confirmed paid or reclaimed text/icons only |
| Error | `--color-error: #a12622` | Confirmed errors with specific text |
| Font | `--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | System web stack, no custom display face |
| Mono | `--font-mono: ui-monospace, SFMono-Regular, Consolas, monospace` | Quote IDs, mint URL, keys |
| Type | `--text-small: .875rem; --text-body: 1rem; --text-heading: 1.125rem; --text-title: 1.75rem; --text-amount: 2rem` | Body line height 1.6, headings 1.2; amounts use tabular numerals |
| Space | `--space-1..6: .25rem, .5rem, .75rem, 1rem, 1.5rem, 2rem` | Text-led rhythm; no repeated card grid |
| Radius | `--radius-control: 4px; --radius-panel: 6px` | Modest edges, no pill container system |
| Target | `--target-size: 44px` | Minimum interactive hit area |
| Page | `--measure: 40rem; --margin-column: 10rem; --gutter: 1.25rem` (2rem from 40rem wide) | One reading column; section labels sit in a margin column beside it on wide screens and above it on narrow ones |

Colour is reserved for state, never brand. Pending/in-progress is neutral ink; no orange urgency by default. Links are underlined. Focus is a 2px ink outline with 3px offset. Success hue is never attached to approval or readiness. No hero gradients, bento grids, glassmorphism stacks, mascots, confetti, or animated amount counters.

### Dark theme

Same roles, separate values. The theme follows the system setting until the header button is used; the choice is kept in `localStorage`.

| Role | Light | on canvas | Dark | on canvas |
| --- | --- | --- | --- | --- |
| Canvas | `#faf9f6` | | `#171916` | |
| Surface | `#ffffff` | | `#20221f` | |
| Ink | `#20221f` | 15.2:1 | `#ecebe6` | 14.8:1 |
| Muted ink | `#575c55` | 6.5:1 | `#a9ada5` | 7.8:1 |
| Border | `#777c73` | 4.1:1 | `#8a8f86` | 5.4:1 |
| Rule | `#dedbd3` | | `#363933` | |
| On ink | `#faf9f6` | | `#171916` | |
| Success | `#17643c` | 6.8:1 | `#7fcf9f` | 9.5:1 |
| Error | `#a12622` | 7.1:1 | `#f0908a` | 7.6:1 |

Ratios are measured against the canvas; every text colour also clears 4.5:1 on the surface. The recording bar opened with `?demo=1` is deliberately outside these tokens: it is equipment, and looks the same in both themes.

## Vocabulary

The icon names below describe explicit inline SVG symbols, not font-dependent emoji. Icons are decorative to assistive technology; the state sentence carries meaning. “Awaiting deposit” is a quote setup status, outside the seven money states.

| State | Concrete symbol | Sentence / condition |
| --- | --- | --- |
| deposited | Arrow down into tray | “Deposited at mint; not paid to creator.” Mint reports quote PAID and unissued. |
| ready | Three horizontal lines joined by right bracket | “Ready for each backer to approve.” Complete paid group and verified output package; no signatures implied. |
| approved | Pen nib | “Approved; reclaim can still race payout.” Signature released, irrevocable; neutral outline, no success check. |
| paying out | Clock face | “Paying out; checking the mint result.” Submitted or unresolved batch; no fake progress percentage. |
| paid | Check in circle | “Paid to the creator; confirmed by the mint.” Verified creator-locked issuance only. |
| reclaiming | Counterclockwise arrow | “Reclaiming; payout may still win if approval was released.” Attempt or uncertain response; neutral. |
| reclaimed | Arrow left into tray | “Reclaimed to your outputs; confirmed by the mint.” Verified own-output issuance only. |

Campaigns aggregate status; deposits retain their own state. Campaign ready does not relabel each deposit as authorized. An unmet campaign can contain deposited and reclaimed deposits at once; no global reclaimed badge until every deposit resolves. A lost batch returns the campaign to collecting/unmet with a plain explanation, not to paid. Local stop-collecting and deadline annotations are metadata, never signature revocation states.

## Components

Page heading and purpose; amount with explicit sat unit; mint identity and expandable full beneficiary key; contribution row; state sentence; invoice panel with copy feedback; authorization review; independent reclaim action; operation receipt; recovery notice with timestamp and retry; inline field error and confirmation dialog. Confirmation must name amount, destination, and the signature-release consequence. No component can set paid/reclaimed from a button press or elapsed time.

One deliberate quirk: a **three-line bracket** beside the total groups the three contributor rows. The bracket is complete only when all three deposits are ready; each row still has its own word and symbol. It explains many deposits feeding one output set, never decorates a logo. On the campaign page the bracket is dashed while any slot is open and drawn solid once all three are in; an unmet campaign keeps it dashed.

## Accessibility contract

Target WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text and meaningful UI graphics; verify final compositions. Use native controls, labels and landmark headings, skip link, visible keyboard focus, 44px targets, logical reading order and no focus theft during polling. Reflow at 320 CSS px and 200% text; long keys wrap and copy controls have names. Preserve RTL with logical CSS properties. Errors name the field and corrective action.

Announce dynamic state changes as a complete sentence in a polite, atomic live region; do not repeatedly announce unchanged polling results. Critical errors use an alert only when an immediate action is needed. Hide redundant SVGs from screen readers. Respect Reduce Motion: no animation is required; any later transition is brief and disabled under the preference. Test keyboard, screen reader and contrast before claiming conformance; token choices alone are not certification.
