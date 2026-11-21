# Motion and brand plan

21 November 2026 · Owner: Iyanu, product design · Status: plan only. Nothing here is built. It needs my sign-off before any of it goes into `src/`.

This extends the design system. It does not replace it. The product stays a calm paper record: colour only for state, pending in ink, success hue only after the mint confirms. One new thing is added on purpose: a mark, and one short paper-and-ink moment when the mint confirms a payout. Everything else is restraint.

Files referred to below live in `docs/brand/`. Each SVG has a PNG beside it with the same name.

---

## 1. Brand concept

The name stays **All Together**. I tried a subtitle, "one payment", and kept it out of the interface. The header shouldn't carry the pitch. The home page sentence already does that job: "Three backers pay one maintainer together, or not at all." That sentence goes on the title card and the social image, not into the header.

I drew three directions. All three use the 24px icon family's rules: a single ink, round caps, round joins, one stroke weight.

### Direction 1: Drawn together (recommended)

- **Symbol.** On a 32 grid with a 2 stroke: a straight line from (4,16) to (28,16), plus two curves. One runs from (4,8) and one from (4,24). Each curve's control points are (10.5, y) and (12.5, 16), and each ends at (19,16), tangent to the middle line. The three leads start level on the left. The outer two bend in and become the middle line without a visible joint, and one line leaves on the right. There is no spine, no corner and no dot. Files: `mark.svg`, `mark-dark.svg`, `lockup.svg`, `lockup-dark.svg`.
- **Many into one.** Three strokes become one stroke. You can't tell where the join happens, which is the point of one indivisible issuance: after the batch, there are no longer three payments.
- **Bracket and receipt.** It is the bracket pulled tight. The product bracket has right angles, a vertical spine and a total beside it. It is a diagram of a group that can be open or closed. The mark has curves, no spine and no total. It is a sign for the idea, not a state. The mark never changes between dashed and solid, so it can't be read as group status.
- **Where it lives.** Header lockup, favicon, the confirmation stamp on the payout and reclaim receipts, the demo title card, the social image. It never appears in a contribution row, a state sentence or the seven-state icon set.
- **Why it might fail.** It can read as a merge icon from a code host, as a sideways fork, or, less often, as a bird's foot or a psi. A typical merge icon has two inputs and a node. This one has three inputs and no node, which helps, but the silhouette is still in that family. At 16px the join closes into a small wedge. In the header next to "Campaigns" it could look like a back or forward control.
- **Verdict.** It says the idea in one gesture, survives 16px, and stays clear of the bracket.

### Direction 2: Bottom line (alternate A)

- **Symbol.** Three short item rules, right-aligned: (13,7)–(27,7), (13,12)–(27,12) and (13,17)–(27,17). Under them sits an accountant's double total rule, (5,23)–(27,23) and (5,27)–(27,27). Files: `alt-a-mark.svg`, `alt-a-lockup.svg`.
- **Many into one.** Items above, a settled total below. This is how a ledger has said "sum" for a long time.
- **Bracket and receipt.** It comes straight from the payout receipt's dotted item rules and solid total rule. It does not touch the bracket.
- **Where it would live.** Header, favicon, receipt.
- **Why it fails.** In a header it looks like a menu or a text-alignment button, and people will tap it. Dotted item rules, the honest version, disappear below 24px. The solid version loses the receipt reference.
- **Verdict.** Right metaphor, wrong silhouette.

### Direction 3: Stub (alternate B)

- **Symbol.** A receipt stub from (7,5) to (25,27) with half-round notches of radius 2.5 cut into both sides at y 19. A dotted perforation runs between the notches, with one total rule at y 11 above it. Files: `alt-b-mark.svg`, `alt-b-lockup.svg`.
- **Many into one.** Only weakly. Three dots sit on the perforation, and a single total rule sits above them. At working sizes the dots read as a perforation or an ellipsis ("more"), not as three backers.
- **Bracket and receipt.** It is the receipt idea at its plainest. It does not touch the bracket.
- **Where it would live.** Header, favicon, payout receipt corner.
- **Why it fails.** It reads as an event ticket or a coupon. That implies admission or a purchase, and this is voluntary support for open work. The three-ness disappears just when the mark has to work as a favicon.
- **Verdict.** Accurate about paper, silent about the product.

### Recommendation

**Drawn together.** It is the only one of the three that shows many becoming one. It holds at 16px in one ink, and it is clearly not a second copy of the row bracket (see `mark-sizes.png`, which puts the mark at 16, 24, 32, 48 and 120px beside the product bracket in both themes). Bottom line lost because it looks like a menu button. Stub lost because it looks like a ticket and leaves the "together" part to the name.

To reduce the merge-icon reading, the mark always appears with the wordmark in the header, never alone as a control. It also has no arrowhead and no node dot. If testers still name it as a merge or a control, the fallback is in the risks: text wordmark in the header, mark reserved for the favicon, the stamp and the title card.

### Rejected along the way

- **Mascot, nut or squirrel.** A cute character for a product about consent to move money. The nut also belongs to the event and to Cashu, not to us.
- **Piggy bank, jar, passed hat.** Each one is a pot somebody holds. Our claim is that nobody holds the pot.
- **Handshake.** It implies an agreement the protocol enforces. A signature binds outputs, not campaign terms.
- **Lightning bolt.** Every bitcoin product uses it, and a reclaim here is not a Lightning refund.
- **Three people icons.** Implies accounts and a social graph we don't have. It's also the generic "team" icon.
- **Puzzle pieces.** Implies the pieces were made to fit. They weren't; they're three independent deposits.
- **Interlocking rings or chain links.** Reads as custody or a lock.
- **Bundled sticks.** "Stronger together" is a cliché, and the bound bundle has a political history I won't borrow.
- **Coin stack.** Implies a growing balance, and invites an animated counter.
- **Check mark.** It is already the Paid icon, and as a brand mark it would claim success everywhere.
- **Padlock or shield.** The trust-signal trap from the art direction notes.
- **Heart.** A donation-app cliché. This is patronage, not charity.
- **Chrome, gradients, glow.** That is the competition's look. Calm is our difference.
- **Three arcs closing into a ring.** At small sizes it reads as a loading spinner, which is the wrong signal on a page that waits for a mint.

---

## 2. Branded elements system

### Signature bracket

The product bracket keeps its rules from `design-system.md` and `app.css`:

| Group condition | Leads | Spine | Exit to total |
| --- | --- | --- | --- |
| Any slot open or awaiting | Dotted, border colour | Dashed, border colour | Dashed |
| A deposit is held (deposited and later) | That row's lead turns solid ink | That row's spine segment turns solid ink | Dashed until all three are held |
| All three held (ready, approved, paying out, paid) | Solid ink | Solid ink | Solid ink |
| Unmet | Held rows solid, open row dotted | Stays dashed where open | Dashed |
| Reclaimed row | Lead removed | Its segment goes back to dashed | Dashed |

- **A new deposit joining.** Only after the mint reports the quote PAID and unissued. The row's solid lead draws from the row toward the spine, then that row's spine segment draws. See motion 3c.
- **Paid.** The bracket does not change colour. Success hue stays on the row icons and row words only. The bracket is structure, not status. The total caption changes to "paid to the creator in one payment".
- **Unmet or reclaim.** A reclaimed row's lead retracts into the row, and the exit to the total goes back to dashed. The total figure changes to "42 of 63 sats" without animating the number.
- **Keeping the mark distinct.** The mark never appears inside or beside the contribution group. The bracket never appears in the header, favicon, stamp or title card. The mark has curves and no spine; the bracket has right angles and a spine. The mark never has dashed or dotted strokes.

### Receipt and perforation

The payout receipt already has dotted item rules, a solid total rule and a mono foot on a white panel. I add one thing: **a perforation between the total and the mono foot.** It splits the panel into the receipt and a stub, and the stub is the part you keep.

- **Geometry.** A 1.5px dotted line in border colour (dash 0, gap 4, round caps), inset by the panel padding. At each end, a half-round notch 6px in radius cut into the panel edge. The notch is a canvas-coloured circle sitting over a 1px rule-colour border arc, done in CSS with two pseudo-elements, not an image. In dark, the notch uses the dark canvas and the dotted line uses the dark border.
- **What sits in the stub.** Request ID, creator key (short form) and mint URL, in mono, as now. Once the mint confirms, the stamp sits there too.
- **Where it appears.** Only on panels recording a confirmed issuance: the payout receipt once paid, and the reclaim receipt once reclaimed.
- **Where it never appears.** The approval review panel (nothing has been issued; a stub there would look like proof of payment). The invoice panel. The batch facts while paying out. Recovery operations. Forms, dialogs, toasts and page edges. No zig-zag torn edges anywhere. The canvas is not paper texture.

### Typography voice

UI type stays as it is: system stack, the existing scale, no webfont. The rule "no custom display face" stands.

- **Wordmark.** "All Together" is drawn, not set. It is a monoline outline built from the same parts as the icons, so it ships as under 1 KB of inline SVG with no font request. Stroke 2.75 on a 34-unit-high box. Cap height 21, x-height 14, bowls are true circles of radius 7, single-storey g, and every terminal is round. In the header it renders with a 12px cap height and `stroke="currentColor"`, so it follows the theme and forced-colours mode. The link keeps the text "All Together" in a visually hidden span; the SVG is `aria-hidden`.
- **Campaign titles.** Stay at `--text-title`, weight 650, −0.015em. They are the human sentence on each page; the brand doesn't compete with them.
- **Amounts.** Tabular numerals, always followed by the unit: "21 sats", "1 sat". The figure never moves or counts. When a total changes, the old string is replaced.
- **Mono.** For quote IDs, request IDs, keys, mint URL, timestamps in the record, and the stamp's second and third lines. Mono means "copied from the mint or the key", never decoration.
- **State words.** Weight 650 at `--text-heading` in the status block, 600 in rows. A sentence always follows the word. Success hue appears only on the word and the icon, never on the sentence or the amount.

### Icons for the seven states

Kept. All seven stay as drawn in `src/ui/Icon.tsx`: tray-down, three-line-bracket, pen-nib, clock, circle-check, counterclockwise-arrow, tray-left. They stay decorative and `aria-hidden`; the sentence carries the meaning. I'd make one small stroke change:

- **Pen nib.** Shorten the slit from `M12 3v8.5` to `M12 5v6.5`, so it doesn't run into the tip's round join at 16px on the home index. Same outline, same breather hole.

The Ready icon (three-line-bracket) stays. It is a state icon at 20–22px in the status column, not a logo, and the mark looks nothing like it.

### Stamp

I think a stamp earns its place, on one condition: it is a printed record of a mint fact, not a seal of approval.

- **When.** Only when the payout or reclaim operation is in a confirmed state. That means the adapter has matched and verified the saved outputs and stored the proofs. Never on approval, readiness, submission or a timeout.
- **What it says.** Three lines, each a fact:
  - Paid: "Paid to Ngozi Eze, 63 sats" / "Mint confirmed 13 Nov 14:07 UTC" / "op-541d70ed"
  - Reclaimed: "Reclaimed by Maren, 21 sats" / "Mint confirmed 13 Nov 14:11 UTC" / "op-9b2e4c11"
- **Look.** A straight rectangle with a 4px radius and a 1.5px success-ink border. The mark sits on the left at 40px with a 1.6 stroke, then a dotted divider, then the three lines. The first line is in the body face at weight 650. The second and third are in mono. There's no fill, no rotation, no worn texture, no stars, no serrated edge, and none of the words "verified", "official" or "approved". It sits flat in the stub like a teller's validation print.
- **Sizes.** 372 × 96 CSS px on desktop, at the inline end of the stub. On narrow screens it is full width in the stub and wraps naturally, with a minimum width of 280px. The mark stays at 40px.
- **Light and dark.** `#17643c` on white, and `#7fcf9f` on `#20221f`. Both are well above 4.5:1. Files: `stamp.svg`, `stamp-dark.svg`, `stamp-reclaimed.svg`.
- **Accessibility.** It is real HTML text, not an image. The stub is a `<p>` group. The live region has already announced the state sentence, so the stamp is not announced again.
- **Colour.** The stamp uses the success token because it only exists after confirmation. That is state colour, not brand colour. In the header, favicon and title card the mark is always ink (or `currentColor`). It turns to success ink only inside this confirmed stamp.
- **No sound.** The stamp is silent. There is no audio anywhere in the product.
- **These SVGs are composition references.** `stamp.svg` and its companions are drawn with the demo names and times so the layout can be judged. The running app does not ship those files as images. It renders the same layout as HTML, filled with the real payee, amount, timestamp and request ID.
- **Why it isn't a celebration.** It contains no exclamation, no animation loop and no colour beyond the existing success token. It is a rectangle, not a circular official seal, on purpose: a notary mark would overclaim. The press-in motion is the ritual; the text is the record. It exists so a backer can screenshot one block that names the payee, the amount, the time and the request ID.

### Favicon and social image

- **Favicon.** `favicon.svg` uses the mark on a 32 grid with a 3 stroke and slightly wider leads at (3.5, 6.5) and (3.5, 25.5). An embedded `prefers-color-scheme` rule switches the stroke to `#ecebe6` on dark browser chrome. No background tile. Also export 32 and 180 PNGs for platforms that ignore SVG.
- **Social image.** `og-image.svg` is 1200 × 630 on the light canvas. The lockup is top left. The sentence "Three backers pay one maintainer together, or not at all." is set in the system face at weight 650. Under it is a 2px ink rule, the same rule as the header. The foot line is in mono and muted: "Cashu · NUT-20 locked quotes · NUT-29 batch mint · NUT-11 P2PK · test mint, fake sats". No screenshots of any product, ours included, because a screenshot of a paid state on a share card is a claim.

### Demo title card

`title-card.svg`, 1920 × 1080, light canvas.

- **Composition.** The lockup sits at 2.6× on the page's left column (x 240). Below it, two lines of the sentence at 72px, weight 650. Then a 2px ink rule across the column and the mono foot line. Nothing moves except a fade.
- **The one sentence.** "Three backers pay one maintainer together, or not at all."
- **Timing.** Hold for 2.5 s. Fade from canvas over the first 300 ms. At 2.5 s, cut hard to the 0–3 s beat in `brief.md` ("2 of 3 deposited · 42 / 63 sats" in the 21-sat recording). Both frames share the `#faf9f6` canvas and the header's ink rule sits at the same height, so the cut reads as a page turning, not a scene change.
- **Fifteen seconds.** The card sits before the fifteen seconds and isn't counted in them. If a submission form enforces exactly 15 s, the card becomes the video's poster frame instead, and the beats stay as written.
- **Light only.** The card and the social image are on the light canvas. The recorded demo starts in light, and both frames share `#faf9f6`, so a dark card would break that cut. A dark version is not in this pass.

---

## 3. Motion plan

Three rules sit above every item below.

1. **Words first, ink after.** The state word, icon and sentence change as soon as the data changes. The live region announces at that same moment. Drawings and the stamp follow. Nothing waits for an animation to finish: no focus, button or state change hangs on `animationend`.
2. **Confirmation motion needs a confirmed state.** The payout sequence starts from a `useConfirmedMoment(operationId)` hook. It returns true only when the operation's deposits are in `confirmedStates` from `src/domain/states.ts`, only after a `mint-confirmed` event from the adapter, and only in the same session as that confirmation. A button press, a timer, an HTTP 200, `ISSUED` alone, or a later reload cannot start it.
3. **One payment moves as one block.** The three deposits are issued in one batch, so their rows change together. No stagger, because a stagger would suggest three payments landing one after another.

Tokens to add to `tokens.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--motion-press` | 90ms down, 180ms back | Button press |
| `--motion-settle` | 180ms | Cross-fades: state word, icon, captions |
| `--motion-draw` | 320ms | Drawing a rule or lead |
| `--ease-out` | `cubic-bezier(.2, 0, 0, 1)` | Arrivals, fades |
| `--ease-draw` | `cubic-bezier(.45, 0, .2, 1)` | A pen moving at an even pace |
| Spring "press" | `{ type: "spring", stiffness: 700, damping: 55, mass: 1 }` | Stamp, and the approve button's return. Damping ratio about 1.04, so no overshoot. |
| Spring "settle" | `{ type: "spring", stiffness: 400, damping: 40, mass: 1 }` | A row settling by 3px. Damping ratio 1.0. |

### a) The payout moment

**Before.** The payout page shows "Paying out; checking the mint result." with "Sent 13 Nov, 14:06 UTC. No result yet." and the Batch facts. The clock icon is static, and there is no spinner, no progress bar and no pulsing. The only thing that updates is the text "Last checked 14:06:52 UTC". It updates in place without being announced.

**Trigger.** The adapter unblinds and verifies the creator-locked proofs, persists them, then emits `mint-confirmed` for all three deposits. The store commits the paid state. Only then can the sequence run. Total run time is 1.4 s.

| Time | What changes | What it should feel like |
| --- | --- | --- |
| 0 ms | The clock cross-fades to circle-check over 180 ms with `--ease-out`. "Paying out" becomes **Paid**, and the sentence becomes "Paid to the creator; confirmed by the mint." The icon and word take the success hue in the same frame. The meta line becomes "Confirmed 13 Nov, 14:07 UTC." The live region announces "Paid to the creator; confirmed by the mint." The "Check mint result" button is removed, and focus is not moved. | The fact is stated first, plainly. |
| 120–340 ms | The Batch facts section is replaced in place by the Receipt panel. The panel fades in with opacity 0→1 and y 6px→0 over 220 ms, `--ease-out`. All three item rows and "Issued to Ngozi's key 63 sats" are present from the first frame. Nothing is typed in or staggered. | A slip has been placed on the desk. |
| 340–660 ms | The solid total rule above "Issued to Ngozi's key" draws from the inline start, using `scaleX` 0→1 over 320 ms with `--ease-draw`. The origin flips in RTL. The amount figure does not move. | Someone ruled off the sum. |
| 660–820 ms | The perforation and stub appear: opacity 0→1 over 160 ms. The mono foot is already inside. | The keepable part is marked. |
| 820–1020 ms | The stamp is pressed: opacity 0→1 and scale 1.03→1 with the "press" spring (about 200 ms to settle). No rotation and no blur. | Pressed once, firmly. |
| 1020–1400 ms | Inside the stamp, the mark draws. The middle line goes first, then the two curves join it together, using `stroke-dashoffset` over 380 ms with `--ease-draw`. The stamp text is already there. | Three become one, once. |
| after | Nothing loops. The page is static. When the creator's spend is recorded later, the "Swap fee at the mint, −1 sat" row and the "Received by Ngozi Eze, 62 sats" total are inserted with a plain 180 ms fade. The stamp does not replay. | |

**On the campaign page instead.** If the confirmation arrives while you are on the campaign page, the compact version plays. All three row icons cross-fade to circle-check together over 180 ms, and their words go to success hue. The total caption cross-fades from "sent to the mint as one payment" to "paid to the creator in one payment". The status block changes as in the 0 ms beat, and "View payout" becomes "View receipt". Nothing is drawn, because the bracket is already solid. If you then open the payout page in the same session, the full sequence plays once there. If you only open it later, after a reload, you get the static receipt.

**If you have navigated away.** Nothing is queued in the background. If you are elsewhere in the app when confirmation arrives, one Sonner toast appears (see e). The full sequence plays the first time you open the payout page in that same session. A `sessionStorage` flag (`seen:<operationId>`) stops it repeating if you leave the page and come back. If the tab was closed, or you first see the paid state after a reload or on a later day, the receipt is already complete and static: perforation, stub and stamp in place, with no sequence. A delayed ritual would feel as if the confirmation had just happened.

**Reduce Motion.** Everything happens at 0 ms: state, receipt, rule, perforation, stamp with the mark fully drawn. The live-region sentence is the same. No cross-fade, because the change is already announced and visible.

### b) Releasing the signature

The consequence: a released signature can't be revoked. The press should feel deliberate, not playful.

1. **"Release signature…" on the approve page.** Primary button. Press: scale .98 and background to 86% ink over 90 ms, then a return over 180 ms. It opens the confirmation. Nothing is signed yet.
2. **Confirmation.** On desktop, the existing native `<dialog>`. Under 30rem, the same dialog styled as a bottom sheet (see f).
   - Title: "Release your signature?"
   - Body: "Your 21 sats can be paid to Ngozi Eze as part of one 63-sat payment. You can't take this signature back. You can still try to take your deposit back, but the payout may get there first."
   - Buttons: **Release signature** (primary) and **Not yet**. "Not yet" is first in the DOM and gets initial focus, so Enter on open does not release a signature.
3. **The press.** Pointer down on **Release signature**: scale .97 over 90 ms, with the fill held at full ink. On click, the label changes to the pen-nib icon plus "Releasing…", and the button is disabled. Escape and the backdrop are ignored while the request is in flight, so the outcome is never ambiguous. Nothing animates while it waits. No hold-to-confirm: that is hard on keyboards and switch access, and the dialog is already the second step.
4. **Approved.** Only after the signature has been handed to the coordinator and the hand-off is stored. The dialog closes with opacity 1→0 and y 0→4px over 140 ms. Focus moves to the Status heading. The status block cross-fades to the pen nib in ink, **Approved**, "Approved; reclaim can still race payout." It is not green and has no check. The live region announces that sentence.
5. **The signature line.** Under the "Your signature" section, a 1px rule-colour line 12rem long, like the line on a cheque. After approval, a 1.5px ink stroke 40px long draws along its start, using `scaleX` over 320 ms with `--ease-draw`. Then "Released 13 Nov, 14:05 UTC" appears beside it in mono, muted. It is a straight stroke, not a fake handwritten signature.
6. **Failure.** If the request is known not to have left the browser, the dialog stays open with "Your signature wasn't sent. Nothing was released." If the result is unknown, it says "The signature may have reached the organizer. Treat it as released." The page then shows Approved, because that is the safe assumption.

**Reduce Motion.** No scale on press. The dialog opens and closes instantly. The signature stroke and "Released…" appear at once. The live region is the same.

### c) A deposit landing in the bracket

**Trigger.** The mint reports the quote PAID and unissued, matching amount and mint. Polling alone never triggers this.

| Time | Change |
| --- | --- |
| 0 ms | The row word "Awaiting deposit" becomes **Deposited**, and the sentence becomes "Deposited at mint; not paid to creator." The dashed-circle icon cross-fades to tray-down over 180 ms. The amount figure's colour moves from muted to ink over 180 ms, and its weight switches from 400 to 600 at 90 ms. Weight is not tweened. The live region announces "Ishaan deposited 21 sats at the mint." |
| 0–220 ms | The row's text block settles from y 3px to 0 with the "settle" spring. No scale, no bounce. |
| 120–360 ms | The row's lead draws solid ink over the dotted one, from the row toward the spine. It is a separate span with `scaleX` 0→1 over 240 ms with `--ease-draw`. The dotted layer stays beneath it. |
| 360–520 ms | That row's spine segment draws solid, from its lead toward the next segment, `scaleY` over 160 ms. |
| Third deposit only, 520–720 ms | The exit to the total draws solid over 200 ms. The total string changes from "42 of 63 sats" to "63 sats" with a 160 ms cross-fade, not a count. The caption becomes "one payment to the creator, once all three approve". |
| Third deposit only, 0 ms | The campaign status changes to Ready in the same frame as the row (words first). The live region announces "All three deposits are in. Ready for each backer to approve." That is one combined announcement, not two. |

**Reduce Motion.** Solid lines, the new total and new words appear in one frame. The announcement is the same.

### d) Other state transitions

- **Deposited → ready.** Covered by the third deposit in c. The status icon cross-fades from tray-down to three-line-bracket over 180 ms. No success hue.
- **Approved → paying out.** When the last signature submits the batch, every approved row's nib cross-fades to the clock together over 180 ms. The total caption becomes "sent to the mint as one payment", and the status block changes. Nothing is drawn: there's no fake progress and no moving clock hand. Reduce Motion: instant.
- **Paying out → paid.** Sequence a.
- **Reclaiming → reclaimed** (own reclaim confirmed). The counterclockwise arrow cross-fades to tray-left, and the word and icon take the success hue (180 ms). The live region announces "Reclaimed to your outputs; confirmed by the mint." On the reclaim page, a receipt panel with the perforation and the reclaimed stamp appears, following the payout sequence's beats from 120 ms to 1020 ms. The mark is drawn in its final state, not animated, because a reclaim is not a group result. On the campaign page, that row's lead retracts toward the row (`scaleX` 1→0 over 240 ms), its spine segment returns to dashed, and the exit to the total returns to dashed (200 ms).
- **Race resolved: payout won** (you were reclaiming). On the reclaim page, the arrow cross-fades to circle-check with success hue. The sentence is "Paid to the creator; confirmed by the mint. Your reclaim was rejected." There is no stamp on the reclaim page, because the stamp belongs to the payout receipt, and the page links to it.
- **Race resolved: reclaim won.** Your row goes to reclaimed as above. For the other backers, `batch-rejected` returns each approved or paying-out deposit to deposited: the nib or clock cross-fades to tray-down in ink over 180 ms. No red, no shake. The approve page's signature stroke turns muted and gets the line "This signature can't be used. The payout it signed was rejected." One page-level sentence is added to the status block: "Maren took their deposit back first. The payout was rejected. Your deposit is still at the mint." Nobody's bracket closes again until a new deposit arrives.
- **Reduce Motion** for all of these: instant change, same sentence, same live-region announcement.

### e) Toasts (Sonner)

**Rule.** A toast appears only when the event happens on a page you are not looking at. If you are on the page that shows the event, the page sentence and the live region carry it, and no toast appears. This stops double announcements, because Sonner has its own live region.

| Event | Copy | Duration | Action |
| --- | --- | --- | --- |
| Your deposit confirmed | "Your 21 sats are at the mint. Not paid to the creator yet." | 6 s | "Open deposit" |
| Payout confirmed | "Paid. The mint confirmed 63 sats to Ngozi Eze." | 8 s | "View receipt" |
| Your reclaim confirmed | "Reclaimed. Your 21 sats are back in your outputs at this mint." | 8 s | "View" |
| Race: payout won your reclaim | "The payout got there first. Your 21 sats were paid to Ngozi Eze." | Until dismissed | "View receipt" |
| Batch rejected | "Payout rejected. A backer took their deposit back first. Yours is still at the mint." | Until dismissed | "Open campaign" |
| Mint unreachable on a saved request | "Couldn't reach the mint. The request is saved and will be checked again." | Until dismissed | "Open recovery" |

**Never a toast.** Polling and "checking" results, Ready, Approved (the approver is on the page), signature hand-off, validation errors (inline at the field), copy feedback (the existing inline status), stop approval, theme changes.

**Style.** `unstyled` with token classes: surface background, a 1px `--color-border` border, `--radius-panel` corners, no shadow. Body text in ink, and the state icon only for paid and reclaimed (in success hue). Error toasts carry no icon and use error ink only on the first word. Position: bottom-end on wide screens, bottom-centre under 30rem. Two visible at most. The `dir` follows the document. Enter: opacity plus y 8px over 180 ms. Exit: opacity over 140 ms. Under Reduce Motion, toasts appear and disappear without movement. The global CSS kill-switch already covers Sonner's CSS transitions, but I'll verify that, not assume it.

### f) Pages and confirmations

- **Route change.** Only `<main>`'s content: opacity 0→1 and y 4px→0 over 160 ms with `--ease-out`. No exit animation, because exits delay navigation and steal clicks. No lateral push, no scale, no shared-element morphs. Focus handling stays as it is. Reduce Motion: none.
- **Confirmations under 30rem.** I recommend **not** adding Vaul. The existing native `<dialog>` already traps focus, restores focus and closes on Escape. Under 30rem I would style it as a sheet: anchored to the bottom, full width, top corners at `--radius-panel`, buttons stacked full width with "Not yet" last, and `padding-bottom: max(var(--space-5), env(safe-area-inset-bottom))`. It enters with y 16px→0 and opacity over 200 ms with `--ease-out`. Swipe-to-dismiss isn't needed for a two-button decision, and swiping near a "release signature" button is risky. Vaul would only come back if testing on a phone shows the native dialog fighting the on-screen keyboard. Neither confirmation has a text field, so I don't expect that.
- **Desktop.** The existing centred dialog, with a 120 ms opacity fade. No scale.

### g) Motion grammar

| | Duration | Easing | Allowed | Forbidden |
| --- | --- | --- | --- | --- |
| Press | 90 ms down, 180 ms back | `--ease-out` / "press" spring | Scale .97–.98, ink darkening | Ripples, bounce |
| State cross-fade | 180 ms | `--ease-out` | Icon, word, sentence, caption, amount string swap | Count-up numbers, colour before mint confirmation |
| Draw | 160–380 ms | `--ease-draw` | Leads, spine, total rule, signature stroke, the mark inside the stamp | Drawing anything that implies progress toward a result not yet known |
| Arrive | 180–220 ms | `--ease-out` or "settle" spring | Opacity plus y ≤ 8px | `scale(0)`, lateral pushes, overshoot |
| Stamp | ~200 ms | "press" spring | Once per operation, only in the session where confirmation arrives | Rotation, confetti, sound, glow, replay after a reload |
| Waiting | — | — | A "Last checked" timestamp updating as text | Spinners, loops, pulsing, progress bars, skeleton shimmer, ticking clock hands |
| Reduce Motion | 0 ms, or an opacity fade ≤ 180 ms | — | Instant end state plus the live-region sentence | Any transform, any draw |

Hard limits: no animation longer than 400 ms on its own; no full sequence longer than 1.4 s; nothing plays before the data it depicts is committed; colour is never the only signal (word, icon and sentence always change together).

---

## 4. Build plan

**The date.** Today is Saturday 21 November 2026. Submission closes on 27 November at 23:59 UTC (28 November 00:59 WAT). The PRD's 19 November MVP date has passed, and the protocol adapter still throws "unavailable". Protocol wiring, race honesty and recovery come first. This plan fits into two days, 22 and 23 November, about 17 hours. That leaves 24–26 November for protocol work and failure testing, and 27 November for the recording. If the same person is wiring the protocol, motion gets 22 November and the morning of 23 November only, and the cut list below applies from item 1.

### Files (to change later, not now)

| Path | Change |
| --- | --- |
| `src/styles/tokens.css` | Motion tokens from the table in section 3 |
| `src/styles/app.css` | Bracket draw layers, perforation and stub, stamp, signature line, narrow-screen dialog as a sheet, toast classes |
| `src/ui/Mark.tsx` (new) | `Mark` and `Lockup` as inline SVG with `currentColor` |
| `src/ui/Stamp.tsx` (new) | The stamp, as HTML text with the inline mark |
| `src/ui/motion.ts` (new) | Grammar constants, `prefersReducedMotion()`, `useConfirmedMoment(operationId)`, the session-only play flag |
| `src/ui/toasts.ts` (new) | Event-to-toast mapping and the "not on this page" rule |
| `src/ui/Layout.tsx` | Lockup in the masthead, `<Toaster>` mount |
| `src/ui/ContributionGroup.tsx` | Solid draw layers as spans over the dotted and dashed ones |
| `src/ui/parts.tsx` | Dialog: initial focus on the safe action, in-flight lock, sheet class |
| `src/ui/Icon.tsx` | Pen-nib slit, `M12 3v8.5` → `M12 5v6.5` |
| `src/screens/Payout.tsx` | Receipt replaces Batch on confirmation, perforation, stub, stamp, sequence |
| `src/screens/Reclaim.tsx` | Reclaim receipt and stamp, race outcome sentences |
| `src/screens/Approve.tsx` | Release press, signature line, failure copy |
| `src/screens/CampaignPage.tsx` | Compact paid change, batch-rejected sentence |
| `index.html` | Favicon links, `theme-color` for each scheme, Open Graph tags |
| `public/favicon.svg`, `public/og.png` (new) | Copied from `docs/brand/` |
| `tests/motion-gate.test.ts` (new) | The sequence gate refuses every non-confirmed state and every event except `mint-confirmed`. Batch-rejected never shows a stamp. |
| `scripts/screenshots.mjs` | Add the stamp states and a Reduce Motion pass |
| `docs/design-system.md` | Record the mark, the perforation rule and the motion tokens. Amend "never decorates a logo" to say the mark is a separate drawing. |

### Libraries

- **Motion** (`motion`). Used only for the payout sequence, the stamp spring and the dialog states, through `animate()`. Everything else is a CSS transition, so the existing Reduce Motion rule covers it. Approximate cost: 15–18 KB gzip for `animate()` with springs. I'll check that against `vite build` output before and after.
- **Sonner** (`sonner`). Rare toasts with an accessible live region and actions. Approximate cost: 10 KB gzip, checked the same way.
- **Vaul.** Not added. The case is in section 3f.

### Order of work

| # | Task | Hours |
| --- | --- | --- |
| 1 | Tokens, `motion.ts`, the gate test written first | 1.5 |
| 2 | Mark and lockup in the header, favicon, Open Graph tags | 1.5 |
| 3 | Static receipt: perforation, stub, stamp (no motion yet) | 2 |
| 4 | The payout sequence and its compact campaign-page version | 3 |
| 5 | Bracket draw: deposit lands, closes, reclaim retracts, batch-rejected reverses | 2.5 |
| 6 | Release press, dialog lock, signature line, failure copy | 1.5 |
| 7 | Sonner with the "not on this page" rule | 1.5 |
| 8 | Narrow-screen dialog as a sheet; route fade | 1 |
| 9 | Title card and social image export; record a test cut | 0.5 |
| 10 | Reduce Motion pass, screen reader pass (VoiceOver and NVDA), 320px and 200% text, screenshots | 2 |
| | Total | about 17 |

### Risks

- **Confirmation timing.** The worst bug would be the sequence starting on submit or on an HTTP 200. The gate is a pure function with a test. The sequence reads committed store state, never a pending promise.
- **Reduce Motion regressions.** Motion's `animate()` ignores the CSS kill-switch. Every JS animation goes through `motion.ts`, which applies the end state at once when the preference is set. No code waits for `onComplete`, because under reduced motion it may not fire the way the code expects.
- **Double announcements.** Sonner and our live region could both speak. The "not on this page" rule handles this, and step 10 checks it with a screen reader.
- **Mark and bracket collision.** If testers call the mark "the bracket" or click it expecting a menu, I would move it to a stroke-only favicon and title-card use and keep a text wordmark in the header.
- **Bundle size.** Around 25–28 KB gzip added. Acceptable for a hackathon web app. If the build shows much more, Motion goes and the sequence moves to CSS keyframes, which can express everything here except the spring. I'd replace the spring with `--ease-out`.
- **Time against protocol.** The real risk. Motion work stops at the end of 23 November whatever its state.
- **Layout shift.** Swapping Batch for Receipt can jump the page. The two panels are given the same minimum block size during the swap, and focus stays put.

### What to cut if time runs short (in this order)

1. Vaul (already out)
2. Route fade
3. Toasts other than Paid, Reclaimed and errors
4. Reverse draw on batch-rejected (change instantly instead)
5. Signature-line stroke animation (static line and timestamp stay)
6. Deposit-landing draw and settle (the existing instant dotted-to-solid change stays)
7. The mark drawing inside the stamp (the stamp appears drawn)
8. The title-card fade (static card, hard cut)

**Never cut.** The header lockup, the favicon, the static stamp on confirmed receipts, the gate test, the Reduce Motion behaviour, and every live-region sentence. Above all of these: protocol wiring, race honesty and recovery.

### Review checkpoint

Before anything in this plan touches `src/`, `index.html` or `package.json`, I review this document and the files in `docs/brand/` together. I check:

- the mark at 16px in a real browser tab, light and dark
- the stamp copy against the honest-claims list in `prd.md`
- the payout sequence's timing table against the rule that nothing moves before the mint confirms

The decisions I need to make are: keep "Drawn together" or switch to an alternate; accept the stamp as a flat validation print rather than a circular seal; accept skipping Vaul; and accept that the payout sequence plays only in the session where the confirmation arrives.

If I don't approve on 22 November, the brand work shrinks to the header lockup and the favicon, and motion is skipped.
