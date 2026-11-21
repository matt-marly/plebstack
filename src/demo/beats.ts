import { paths } from '../routes';
import {
  MAIN_CAMPAIGN, RACE_CAMPAIGN, UNMET_CAMPAIGN, checkMint, confirmDeposit, initialWorld, recordSpend,
  releaseApproval, requestQuote, requestReclaim, setViewer, stopApproval, type World,
} from './world';

// The recording script. Each beat is the starting world with the earlier steps applied,
// so jumping to a beat and clicking through to it by hand end in the same place.

export interface Beat {
  id: string;
  group: string;
  title: string;
  // What the narrator says while this beat is on screen.
  line: string;
  path: string;
  world: () => World;
}

const at = (time: string) => `2026-11-13T${time}:00Z`;

function actingAs(world: World, personId: string, change: (world: World) => World): World {
  return setViewer(change(setViewer(world, personId)), world.viewerId);
}

const joining = () => requestQuote(initialWorld(), MAIN_CAMPAIGN, at('14:02'));
const ready = () => confirmDeposit(joining(), MAIN_CAMPAIGN, 'backer-3', at('14:03'));
const reviewing = () => actingAs(ready(), 'tobi', world => releaseApproval(world, MAIN_CAMPAIGN, 'backer-1', at('14:04')));
const approved = () => releaseApproval(reviewing(), MAIN_CAMPAIGN, 'backer-3', at('14:05'));
const payingOut = () => actingAs(approved(), 'maren', world => releaseApproval(world, MAIN_CAMPAIGN, 'backer-2', at('14:06')));
const paid = () => actingAs(checkMint(payingOut(), MAIN_CAMPAIGN, at('14:07')), 'ngozi',
  world => recordSpend(world, MAIN_CAMPAIGN, at('14:09')));

const reclaiming = () => requestReclaim(initialWorld(), UNMET_CAMPAIGN, 'backer-2', at('14:10'));
const reclaimed = () => checkMint(reclaiming(), UNMET_CAMPAIGN, at('14:11'));

const raceReclaiming = () => requestReclaim(initialWorld(), RACE_CAMPAIGN, 'backer-3', at('14:12'));

const FIFTEEN = 'Fifteen seconds';
const RACE = 'Approved, then reclaim';
const EDGES = 'Interruptions';

export const beats: Beat[] = [
  {
    id: 'two-of-three', group: FIFTEEN, title: '2 of 3 deposited',
    line: '0–3s. Two of three deposits are at the mint. Nothing is paid to the creator.',
    path: paths.campaign(MAIN_CAMPAIGN), world: initialWorld,
  },
  {
    id: 'joining', group: FIFTEEN, title: 'Join with 21',
    line: '3–7s. The last backer joins. Their invoice is locked to their own key.',
    path: paths.back(MAIN_CAMPAIGN), world: joining,
  },
  {
    id: 'ready', group: FIFTEEN, title: 'Ready',
    line: 'All three deposits are in. The bracket closes; nobody has approved yet.',
    path: paths.campaign(MAIN_CAMPAIGN), world: ready,
  },
  {
    id: 'reviewing', group: FIFTEEN, title: 'Review the payout',
    line: 'Each backer checks the same 63-sat destination before signing.',
    path: paths.approve(MAIN_CAMPAIGN, 'backer-3'), world: reviewing,
  },
  {
    id: 'approved', group: FIFTEEN, title: 'Approved',
    line: 'Approved. It can’t be taken back, but the deposit can still be reclaimed until it pays out.',
    path: paths.campaign(MAIN_CAMPAIGN), world: approved,
  },
  {
    id: 'paying-out', group: FIFTEEN, title: 'Paying out',
    line: '7–11s. The last approval sends one batch. No result until the mint answers.',
    path: paths.payout(MAIN_CAMPAIGN), world: payingOut,
  },
  {
    id: 'paid', group: FIFTEEN, title: 'Paid',
    line: 'The mint confirms: 63 sats issued to the creator, 62 received after a 1-sat fee.',
    path: paths.payout(MAIN_CAMPAIGN), world: paid,
  },
  {
    id: 'unmet', group: FIFTEEN, title: 'Unmet campaign',
    line: '11–15s. A different campaign that never filled its third slot.',
    path: paths.campaign(UNMET_CAMPAIGN), world: initialWorld,
  },
  {
    id: 'reclaiming', group: FIFTEEN, title: 'Take mine back',
    line: 'One backer takes their own deposit back. Not reclaimed until the mint says so.',
    path: paths.reclaim(UNMET_CAMPAIGN, 'backer-2'), world: reclaiming,
  },
  {
    id: 'reclaimed', group: FIFTEEN, title: 'Reclaimed',
    line: 'The mint confirms the reclaim. The other deposit stays where it was.',
    path: paths.reclaim(UNMET_CAMPAIGN, 'backer-2'), world: reclaimed,
  },
  {
    id: 'race-open', group: RACE, title: 'Batch unresolved',
    line: 'All three approved and the batch was sent, but the result is unknown.',
    path: paths.deposit(RACE_CAMPAIGN, 'backer-3'), world: initialWorld,
  },
  {
    id: 'race-reclaiming', group: RACE, title: 'Reclaim races payout',
    line: 'A backer who already approved asks for their deposit back. Either request can win.',
    path: paths.reclaim(RACE_CAMPAIGN, 'backer-3'), world: raceReclaiming,
  },
  {
    id: 'race-payout-wins', group: RACE, title: 'Payout wins',
    line: 'The batch settled first. The deposit was paid to the creator; the reclaim was rejected.',
    path: paths.reclaim(RACE_CAMPAIGN, 'backer-3'), world: () => checkMint(raceReclaiming(), RACE_CAMPAIGN, at('14:13'), 'creator'),
  },
  {
    id: 'race-reclaim-wins', group: RACE, title: 'Reclaim wins',
    line: 'The reclaim settled first. The batch can never pay out; the campaign is unmet.',
    path: paths.reclaim(RACE_CAMPAIGN, 'backer-3'), world: () => checkMint(raceReclaiming(), RACE_CAMPAIGN, at('14:13'), 'owner'),
  },
  {
    id: 'stopped', group: EDGES, title: 'Approval stopped',
    line: 'Stopping approval blocks a new signature on this device. It revokes nothing.',
    path: paths.approve(MAIN_CAMPAIGN, 'backer-3'), world: () => stopApproval(ready(), MAIN_CAMPAIGN, 'backer-3', at('14:04')),
  },
  {
    id: 'timed-out', group: EDGES, title: 'Timed-out payout',
    line: 'The organizer’s browser saved the batch before sending it, so it can be checked again.',
    path: paths.recovery(), world: () => setViewer(initialWorld(), 'ngozi'),
  },
];

export function findBeat(id: string | null | undefined): Beat | undefined {
  return beats.find(beat => beat.id === id);
}
