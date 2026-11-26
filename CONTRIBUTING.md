# Contributing to Plebstack

Three plebs lock 21 sats each at a Cashu mint; when all three sign, one batch pays a maintainer 63 sats locked to her key, otherwise everyone takes their own deposit back. The organizer never holds a key or a sat. Runs only against the test mint `https://testnut.cashudevkit.org` (fake sats, real protocol calls). `README.md` has the plain-language story; `src/protocol/README.md` documents every mint call.

## Architecture

React 19 + React Router 7 + Vite 7, TypeScript strict, `@cashu/cashu-ts` 4.13.1, `nostr-tools` 2.26.0. No backend: each device keeps its state in browser storage, and the public board is shared between devices over Nostr relays.

- `src/protocol/`: the mint calls (NUT-20 locked quotes, NUT-29 batch mint, NUT-11 P2PK, NUT-03 swap, NUT-09 restore, NUT-07 state), keys, per-person storage, batch signing, recovery.
- `src/live/`: one client per person, the public board, its Nostr sync (`sync.ts`: every board write is a kind-4919 event tagged `s` with the stack id; devices merge what they hear and take seats), and the view rebuilt from it.
- `src/domain/`: money states and the close rule.
- `src/screens/`, `src/ui/`: the phone app and the `/stage` big-screen view. `src/demo/` holds the demo world.
- `src/styles/`: `tokens.css`, `app.css`, `stage.css`. Plain CSS.
- `tests/`: unit tests on a mock mint (`tests/mock-mint.ts`); `tests/live/`: tests against testnut.
- `scripts/`: Playwright + axe browser runs (`live-e2e.mjs`, `stage-demo.mjs`, `multi-device.mjs`), a local Nostr relay (`relay.mjs`), icon/png helpers.

Protocol rules that must not be broken: save before sending anything to the mint; only call it Paid once the mint confirmed and the proofs are saved; never retry a pending request with new outputs; private keys never reach the board, the relays, the coordinator, page text or screenshots.

Product shape: one person per device by default. Home has a headline, your stack card and three actions (Start, Join, Watch live); everything else sits behind a sheet. Demo mode (tap your initial, top right) lets one device play everyone.

## Development workflow

Node 22.12+ (CI uses 22).

```sh
npm ci          # exact versions from package-lock.json
npm run dev     # Vite, usually http://localhost:5173; /stage is the big-screen view
```

Dependencies are pinned to exact versions; keep it that way. Commit on a feature branch and open a PR; CI must pass.

## Design system

Night only, plain CSS, tokens in `src/styles/tokens.css`. Use the tokens; do not hardcode colours, spacing or type sizes.

- Layout: one centred column (430px on a phone, 520px from 720px wide); no phone frame. Buttons stick to the bottom on a phone and follow the content on a laptop.
- Colours: canvas `#0b0b0c`, ink `#f4f4f1`, signal lime `#c8f135`. Lime means Paid and nothing else (tests check no lime before Paid, and the focus ring is never lime). Each money state has its own colour (`--color-state-*`).
- Spacing: only `--space-1..6` (4–32px). Type: `--text-micro..name` (11–17px). Radii and `--target-size: 44px` for tap targets.
- Motion: respect Reduce Motion; with it on, nothing moves and captions carry the story.
- Accessibility: WCAG 2.2 AA, text contrast 4.5:1 and meaningful lines 3:1 (measured in `tests/contrast.test.ts`), every control named, headings in order, visible focus, usable by keyboard alone, reflow at 320px and 200% zoom.
- Copy: plain words ("take it back", "swap"); `tests/copy.test.ts` guards wording.

## Testing requirements

Run before every PR:

```sh
npm test                          # unit tests (143), no network
npm run build                     # tsc -b + vite build
```

Run when touching `src/protocol/`, `src/live/`, screens or styles (needs network to testnut and Chromium: `npx playwright install chromium`):

```sh
PLEB_LIVE=1 npm run test:live     # deposit, payout, reclaim against testnut
node scripts/live-e2e.mjs         # all journeys A–G in headless Chromium, with axe; writes .evidence/
npm run test:devices              # five browser contexts, one stack, over a local relay
```

`live-e2e` and `test:devices` start their own dev server and local relay (`npm run relay` runs one on its own) and take a few minutes. Every check must pass; do not skip or loosen a test to get green. Use `--shots` only when you intend to retake the stills in `docs/screens-live/`. `.evidence/` is gitignored.

## CI

`.github/workflows/ci.yml`: on every pull request, `npm ci`, `npm test`, `npm run build`. The live mint and browser checks run only on manual dispatch (they depend on a public test mint and a browser), so run them locally for UI or protocol changes.

## Deployment

Hosted on Vercel at https://plebstack-matts-projects-7a791133.vercel.app (the `/stage` route works too). `vercel.json` only rewrites every path to `/index.html` so client-side routes resolve; the build is `npm run build` and the output is `dist/`. There is no `.vercel` link or deploy script in the repo, so deployments come from the Vercel project itself; confirm the Git integration there before assuming a push deploys. After a deploy, check `/` and `/stage` return 200.
