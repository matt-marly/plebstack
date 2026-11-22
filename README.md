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

On first load Ngozi makes her key in her own storage and opens the demo stack, “Fix DST drift in pocket-ical recurring events”. After the splash and three intro screens you are a pleb on that stack:

1. **Join**: meet Ngozi, see the stack, Chip in 21 sats. A key is made for you and this stack, and the mint returns a NUT-20 locked quote.
2. **Pay**: the real invoice as a QR, Open in wallet and Copy invoice. The page asks the mint until it reports the quote paid.
3. **Stacked**: your slab drops into the stack.
4. **Waiting**: who's in, Share invite, and Take mine back (a real reclaim at the mint).

Past Waiting a plain status screen shows where things stand; signing, paying out and the maintainer's side come next.

One browser plays everyone. “Playing as” in each screen switches between Tobi, Maren and Ishaan, and can open a fresh stack. Each person, and the coordinator, has their own namespace in local storage, so one person's code never reads another's key. Campaigns, quotes and results sit in a shared public namespace standing in for a relay. Reloading rebuilds everything from storage; clearing storage loses the keys. “What's really happening” on every journey screen gives the real terms (NUT-20, NUT-11, NUT-29).

## Screens

| Route | Screen |
| --- | --- |
| `/` | Splash |
| `/intro/:page` | Three intro screens |
| `/s/:campaignId` | Sends the viewer to their current step |
| `/s/:campaignId/join` · `pay` · `stacked` · `waiting` · `status` | The pleb journey |

Routes live in `src/routes.ts`; which screen a viewer may see is decided by `src/ui/journey.ts`. Phone stills from the live run are in `docs/screens-live/`.

## Where things are

- `src/domain/` — the seven money states, their words and the allowed transitions.
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
node scripts/live-e2e.mjs       # three plebs through the journey in headless Chromium; writes .evidence/live-e2e-<time>/
node scripts/live-e2e.mjs --shots   # also retakes the stills in docs/screens-live/
```

## Not in this pass

Real integration will use only `https://testnut.cashudevkit.org`, a test mint that credits fake sats. The spike used 21-sat deposits with cashu-ts pinned to 4.13.1. A released signature cannot be taken back, and a reclaim can race the payout. Nothing here claims production backup safety or that the creator delivers the work.

Start review at `docs/brief.md`, then the PRD, people, design system, flows and moodboard.
