# Plebstack

Crowdfunding on Cashu ecash. Three plebs each deposit 21 sats at one mint, locked to their own key. The maintainer is paid all 63 in one payment once all three sign, or not at all, and keeps 62 after a 1-sat fee. Until then every backer can take their own deposit back. The organizer never holds a key.

This is a mobile-first web app of that flow, formerly called All Together. It always runs against the test mint `https://testnut.cashudevkit.org`, which marks its own invoices paid, so the sats are fake. `src/protocol/README.md` says exactly what is real. (`?live=1` from earlier links still works; it no longer changes anything.)

## Run it

Use Node 22.12 or later.

```sh
npm install
npm run dev
```

Open the address Vite prints (usually `http://localhost:5173`) in a phone-sized window. On a desktop the app is a phone column centred on the night ground. It can be installed to a home screen (`public/manifest.webmanifest`, icons in `public/icons/`, rendered from the slab mark by `node scripts/icons.mjs`).

After the splash and three intro screens, **Start a stack** makes you Ada, the organizer:

1. **Who** (O1): name the maintainer, the work and a public link. Paid means the maintainer received ecash, not that the work was done.
2. **Key** (O2): Ada gets a claim link. Ngozi opens it on her side (here: “Playing as Ngozi”), and **Confirm my key** (M1) makes her key in her own storage and puts only the public half on the board. Ada then sees “Key confirmed” with the short key. Ada can paste a pubkey instead; it must be a valid point and is marked as not confirmed by Ngozi’s device everywhere it shows. Nothing can be joined until there is a key.
3. **Terms** (O3): three plebs, 21 sats, this mint, Ngozi’s key, and a close time (24 hours, 48 hours, 1 week or a custom time, rounded to the hour, shown in your zone).
4. **Share** (O4) and **Watch** (O5): the invite link and QR, who is in and who signed, and **Stop collecting**.

Then each pleb (Tobi, Maren, Ishaan) joins, pays the real locked invoice, checks the payout and signs; the last signature sends one batch, and Paid shows once the mint confirms. Ngozi follows the stack (M2), receives the payout locked to her key in her own storage (M3), and **Spend** (M4) swaps it at the mint with her key: 63 sats in, the mint’s swap fee out, the rest as ecash she can copy into any Cashu wallet.

The close is an app rule. Before it, collecting goes on and anyone can take theirs back. At it, with fewer than three in, collecting stops and each pleb sees No payout with **Take mine back**. Once all three are in it no longer applies. It never moves sats.

One browser plays everyone. “Playing as” in each screen switches between Ada, Ngozi and the three plebs, and can start a new stack. Each person, and the coordinator, has their own namespace in local storage, so one person's code never reads another's key; Ada has none. Drafts, campaigns, quotes and results sit in a shared public namespace standing in for a relay. Reloading rebuilds everything from storage; clearing storage loses the keys. “What's really happening” on every screen gives the real terms (NUT-20, NUT-11, NUT-29, NUT-03).

## Screens

| Route | Screen |
| --- | --- |
| `/` | Splash |
| `/intro/:page` | Three intro screens |
| `/new` | O1, who are you backing |
| `/o/:campaignId/key` · `terms` · `share` · `watch` | The organizer's steps |
| `/claim/:campaignId` | M1, the maintainer's claim link |
| `/m/:campaignId/follow` · `receive` · `spend` | The maintainer's steps |
| `/s/:campaignId` | Sends a pleb to their current step |
| `/s/:campaignId/join` · `pay` · `stacked` · `waiting` · `sign` · `signed` · `sending` · `paid` · `race` · `unmet` · `back` | The pleb journey |
| `/s/:campaignId/stage` · `/stage` | The stage, for a big screen; `/stage` follows the newest stack |

Routes live in `src/routes.ts`; which screen a pleb may see is decided by `src/ui/journey.ts`, and each person only ever sees their own screens of a stack. Phone stills from the live run are in `docs/screens-live/`.

## Stage

The stage is the watchable view for a meetup screen or a demo video, at 16:9: the shared stack big on the goal line, each pleb's phone showing their own current screen, Ngozi's phone and her payout, and a caption bar that tells each real change in a plain sentence with the real term in mono. It never needs a click. Open it in one window (**Open the stage in a new window** under Playing as, or from O5), play the people in another, and it follows the board through the browser's storage event. A slab travels into the stack when the mint confirms that deposit, not on a tap; the pile lights up in lime only after the mint confirms the payout and the caption has said so. With Reduce Motion, nothing travels and the captions carry the story.

## Where things are

- `src/domain/` — the seven money states, their words and the allowed transitions, and the close rule.
- `src/demo/world.ts` — the campaign record and viewer-step logic the live view is built on, plus a stub world the domain tests use.
- `src/live/` — one namespaced client per person, the shared public board, and the campaign view rebuilt from it.
- `src/session.tsx` — who is playing, the current stack, and the world rebuilt after each action.
- `src/screens/`, `src/ui/` — screens and shared parts (rail, stack, track, sheets). Plain CSS in `src/styles/`, night only.
- `src/protocol/README.md` — what is real at the mint and what each call guarantees.

## Checks

```sh
npm test
npm run build
PLEB_LIVE=1 npm run test:live   # against testnut.cashudevkit.org; writes .evidence/live-{deposit,payout,reclaim}-<time>/
node scripts/live-e2e.mjs       # Ada, Ngozi and three plebs through every journey in headless Chromium, with names, headings,
                                # contrast, targets and focus checked on each screen; writes .evidence/live-e2e-<time>/
node scripts/live-e2e.mjs --shots   # also retakes the stills in docs/screens-live/
node scripts/stage-demo.mjs --video # the stage at 1920x1080 beside a second window playing everyone; records .evidence/stage-<time>/stage.webm
node scripts/stage-demo.mjs --shots # retakes docs/screens-live/stage-*.png
```

## Not in this pass

Real integration will use only `https://testnut.cashudevkit.org`, a test mint that credits fake sats. The spike used 21-sat deposits with cashu-ts pinned to 4.13.1. A released signature cannot be taken back, and a reclaim can race the payout. Nothing here claims production backup safety or that the creator delivers the work.

Start review at `docs/brief.md`, then the PRD, people, design system, flows and moodboard.
