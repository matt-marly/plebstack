# Plebstack

Crowdfunding on Cashu ecash. Three plebs each deposit 21 sats at one mint, locked to their own key. The maintainer is paid all 63 in one payment once all three sign, or not at all, and keeps 62 after a 1-sat fee. Until then every backer can take their own deposit back. The organizer never holds a key.

This is a clickable prototype of that flow, formerly called All Together. By default it runs on stub data in the browser. With `?live=1` the whole flow runs against the test mint; `src/protocol/README.md` says exactly what is real.

## Run it

Use Node 22.12 or later.

```sh
npm install
npm run dev
```

Open the address Vite prints (usually `http://localhost:5173`). The demo campaign funds a fix in an open-source calendar library; two of its three deposits are already in. The strip at the top has a “Viewing as” menu, which stands in for the four separate browsers: three backers, and the maintainer who is both creator and organizer. Switch person to see the same campaign from each seat. Reloading starts the story again; only the light or dark choice is remembered.

The night theme is the default. Paper is used when the system asks for light, and the button in the header overrides both.

### Live mode

Add `?live=1` to run everything against `https://testnut.cashudevkit.org`. Live mode starts with no campaigns and keeps the mode until the page is reloaded without it.

1. As Ngozi, start a campaign. The maintainer key is made in Ngozi's storage; only the pubkey goes into the campaign.
2. As each backer, join. The quote is locked to a key made for that backer and campaign; the page waits until the mint reports it paid.
3. As each backer, Check and sign. The page fetches the package, the keyset and all three quote states itself and shows what it checked before a signature can be released. Stop signing records a local stop.
4. The third signature hands the batch to the coordinator, which sends it. The page reads Paying out until the mint answers, and Paid only after the proofs verify and are saved. A rejected batch puts still-paid deposits back to Deposited. No answer leaves Check again, which asks about the same saved request.
5. Take mine back is a real reclaim. If you signed, the payout may win: a reclaim after the payout is rejected and says so; a reclaim before it puts the other deposits back to Deposited.

The “Viewing as” menu stands in for separate browsers, but each person, and the coordinator, has their own namespace in local storage, so one person's code never reads another's key. Campaigns, quotes, the package, released signatures and results sit in a shared public namespace standing in for a relay. Reloading with `?live=1` rebuilds every campaign from storage. Clearing storage loses the keys. Spending the payout is not wired in live mode.

## Demo control

Add `?demo=1` to any address to open the recording bar.

- Left and right arrow keys step through the beats; `H` hides the bar for a clean take.
- “All beats” jumps straight to one. The first ten are the fifteen-second story: two of three deposited, join, ready, review, approved, paying out, paid, then the unmet campaign and its reclaim.
- The rest cover the race between a released approval and a reclaim (both endings), a stopped approval and a timed-out payout.

Each beat is the starting state with the earlier steps applied, so clicking through by hand and jumping with the bar end in the same place. `?beat=<id>` without `demo=1` loads a beat without showing the bar, which is how the screenshots are taken.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Campaigns, and what the rule is |
| `/campaigns/new` | Create a campaign |
| `/campaigns/:campaignId` | Campaign: status, three contributions, terms, record |
| `/campaigns/:campaignId/back` | Join: confirm, then the deposit invoice |
| `/campaigns/:campaignId/deposits/:depositId` | One deposit |
| `/campaigns/:campaignId/deposits/:depositId/approve` | Review and release a signature |
| `/campaigns/:campaignId/deposits/:depositId/reclaim` | Take a deposit back, including the race with payout |
| `/campaigns/:campaignId/payout` | Paying out, then the receipt |
| `/recovery` | Requests waiting on the mint, and settled ones |

Routes live in `src/routes.ts` and match `docs/ia-userflows.md`. Stills of every screen are in `docs/screens/`.

## Where things are

- `src/domain/` — the seven money states, their words and the allowed transitions.
- `src/demo/world.ts` — the stub mint and campaigns as plain functions. A deposit only becomes paid or reclaimed when the stub mint is asked and answers; no button sets it directly.
- `src/demo/beats.ts` — the recording script.
- `src/screens/`, `src/ui/` — pages and shared parts. Styles are plain CSS in `src/styles/`, built on the tokens in `docs/design-system.md`.
- `src/live/` — live mode: one namespaced client per person, the shared public board, and the campaign view rebuilt from it.
- `src/protocol/README.md` — what is real at the mint and what each call guarantees.

## Checks

```sh
npm test
npm run build
PLEB_LIVE=1 npm run test:live   # against testnut.cashudevkit.org; writes .evidence/live-{deposit,payout,reclaim}-<time>/
node scripts/live-e2e.mjs       # the live UI in headless Chromium against testnut; writes .evidence/live-e2e-<time>/
```

To retake the stills, keep `npm run dev` running and, in another terminal:

```sh
npx playwright install chromium   # first time only
npm run screenshots
```

## Not in this pass

Real integration will use only `https://testnut.cashudevkit.org`, a test mint that credits fake sats. The spike used 21-sat deposits with cashu-ts pinned to 4.13.1. A released approval cannot be revoked, and a reclaim can race the payout; the prototype shows both. Nothing here claims production backup safety or that the creator delivers the work.

Start review at `docs/brief.md`, then the PRD, people, design system, flows and moodboard.
