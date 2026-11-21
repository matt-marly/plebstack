# All Together

Three backers each deposit 21 sats. The creator is paid all 63 in one payment once all three approve, or not at all, and keeps 62 after a 1-sat fee. Until then every backer can take their own deposit back.

This is a clickable prototype of that flow. It runs on stub data in the browser: no quote is created, nothing is signed, and no request reaches a mint. The protocol boundary in `src/protocol/` still throws, on purpose.

## Run it

Use Node 22.12 or later.

```sh
npm install
npm run dev
```

Open the address Vite prints (usually `http://localhost:5173`). The demo campaign funds a fix in an open-source calendar library; two of its three deposits are already in. The strip at the top has a “Viewing as” menu, which stands in for the four separate browsers: three backers, and the maintainer who is both creator and organizer. Switch person to see the same campaign from each seat. Reloading starts the story again; only the light or dark choice is remembered.

Light and dark follow the system setting, and the button in the header overrides it.

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
- `src/protocol/README.md` — the signing helper and what real integration has to preserve.

## Checks

```sh
npm test
npm run build
```

To retake the stills, keep `npm run dev` running and, in another terminal:

```sh
npx playwright install chromium   # first time only
npm run screenshots
```

## Not in this pass

Real integration will use only `https://testnut.cashudevkit.org`, a test mint that credits fake sats. The spike used 21-sat deposits with cashu-ts pinned to 4.13.1. A released approval cannot be revoked, and a reclaim can race the payout; the prototype shows both. Nothing here claims production backup safety or that the creator delivers the work.

Start review at `docs/brief.md`, then the PRD, people, design system, flows and moodboard.
