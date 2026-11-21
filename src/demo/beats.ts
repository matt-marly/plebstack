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
const RACE = 'Signed, then reclaim';
const EDGES = 'Interruptions';

export const beats: Beat[] = [
  {
    id: 'two-of-three', group: FIFTEEN, title: '2 of 3 stacked',
    line: '0–3s. Two plebs have stacked 21 sats each at the mint. Nothing is paid to Ngozi.',
    path: paths.campaign(MAIN_CAMPAIGN), world: initialWorld,
  },
  {
    id: 'joining', group: FIFTEEN, title: 'Join with 21 sats',
    line: '3–7s. Ishaan joins. The invoice is for a quote locked to a key made in their own browser.',
    path: paths.back(MAIN_CAMPAIGN), world: joining,
  },
  {
    id: 'ready', group: FIFTEEN, title: 'Ready',
    line: 'At the line: 63 of 63 sats at the mint. Nobody has signed yet.',
    path: paths.campaign(MAIN_CAMPAIGN), world: ready,
  },
  {
    id: 'reviewing', group: FIFTEEN, title: 'Check the outputs',
    line: 'Each pleb checks the same 63-sat outputs, locked to Ngozi’s key, before signing.',
    path: paths.approve(MAIN_CAMPAIGN, 'backer-3'), world: reviewing,
  },
  {
    id: 'approved', group: FIFTEEN, title: 'Approved',
    line: 'Signed. It can’t be taken back, and a reclaim can still race the payout.',
    path: paths.campaign(MAIN_CAMPAIGN), world: approved,
  },
  {
    id: 'paying-out', group: FIFTEEN, title: 'Paying out',
    line: '7–11s. The third signature sends one batch. Not paid until the mint confirms.',
    path: paths.payout(MAIN_CAMPAIGN), world: payingOut,
  },
  {
    id: 'paid', group: FIFTEEN, title: 'Paid',
    line: 'The mint confirms: 63 sats issued to Ngozi’s key. Ngozi spends it: 1-sat swap fee, 62 sats received.',
    path: paths.payout(MAIN_CAMPAIGN), world: paid,
  },
  {
    id: 'unmet', group: FIFTEEN, title: 'Unmet campaign',
    line: '11–15s. A different campaign. Collecting stopped before a third pleb stacked.',
    path: paths.campaign(UNMET_CAMPAIGN), world: initialWorld,
  },
  {
    id: 'reclaiming', group: FIFTEEN, title: 'Take mine back',
    line: 'Ishaan mints their own 21 sats back. Not reclaimed until the mint says so.',
    path: paths.reclaim(UNMET_CAMPAIGN, 'backer-2'), world: reclaiming,
  },
  {
    id: 'reclaimed', group: FIFTEEN, title: 'Reclaimed',
    line: 'The mint confirms the reclaim. Tobi’s 21 sats stay at the mint, locked to Tobi’s key.',
    path: paths.reclaim(UNMET_CAMPAIGN, 'backer-2'), world: reclaimed,
  },
  {
    id: 'race-open', group: RACE, title: 'Batch unresolved',
    line: 'All three signed and the batch was sent, but the mint hasn’t answered.',
    path: paths.deposit(RACE_CAMPAIGN, 'backer-3'), world: initialWorld,
  },
  {
    id: 'race-reclaiming', group: RACE, title: 'Reclaim races payout',
    line: 'Ishaan already signed and asks for their 21 sats back. Either request can win.',
    path: paths.reclaim(RACE_CAMPAIGN, 'backer-3'), world: raceReclaiming,
  },
  {
    id: 'race-payout-wins', group: RACE, title: 'Payout wins',
    line: 'The payout got there first. Ishaan’s 21 sats went to Ngozi; the reclaim was rejected.',
    path: paths.reclaim(RACE_CAMPAIGN, 'backer-3'), world: () => checkMint(raceReclaiming(), RACE_CAMPAIGN, at('14:13'), 'creator'),
  },
  {
    id: 'race-reclaim-wins', group: RACE, title: 'Reclaim wins',
    line: 'The reclaim got there first. The payout was rejected; the other two deposits stay at the mint.',
    path: paths.reclaim(RACE_CAMPAIGN, 'backer-3'), world: () => checkMint(raceReclaiming(), RACE_CAMPAIGN, at('14:13'), 'owner'),
  },
  {
    id: 'stopped', group: EDGES, title: 'Signing stopped',
    line: 'Stopping blocks a new signature on this device. A signature already released still counts.',
    path: paths.approve(MAIN_CAMPAIGN, 'backer-3'), world: () => stopApproval(ready(), MAIN_CAMPAIGN, 'backer-3', at('14:04')),
  },
  {
    id: 'timed-out', group: EDGES, title: 'Timed-out payout',
    line: 'The payout was saved before it was sent, so Check again asks the mint about the same request.',
    path: paths.recovery(), world: () => setViewer(initialWorld(), 'ngozi'),
  },
];

export function findBeat(id: string | null | undefined): Beat | undefined {
  return beats.find(beat => beat.id === id);
}
