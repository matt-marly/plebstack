import {
  fellShort, groupComplete, isHeld, maintainerOf, pendingOperation, people, sats, slotOf, statusOf, tally, viewerStep,
  type CampaignRecord, type ViewerStep, type World,
} from '../demo/world';
import { formatWhen, listNames } from './format';
import { maintainerSteps, organizerSteps } from './GoalRail';

export const PLEBS = ['tobi', 'maren', 'ishaan'] as const;

export type Screen =
  | 'join' | 'pay' | 'stacked' | 'waiting' | 'sign' | 'signed' | 'sending' | 'paid' | 'race' | 'unmet' | 'back';

// Join · Stack · Sign · Paid. The rail is lime only once the mint confirmed the payout.
export interface Rail {
  at: 0 | 1 | 2 | 3;
  paid: boolean;
  // Organizer and maintainer have their own four steps.
  steps?: readonly string[];
  // Every step behind, like the organizer's setup once the stack is open.
  done?: boolean;
  // The step at `at` waits on the mint, so it stays ahead: Sending is not Paid.
  pending?: boolean;
  // Taking it back ends on Back, not Paid.
  branch?: 'back';
}

// The step header: where you are, and what happens next. `end` means there is no next.
export interface Here {
  name: string;
  next: string;
  end?: boolean;
}

export type Stop = 'wallet' | 'to-mint' | 'at-mint' | 'signed' | 'to-maintainer' | 'with-maintainer' | 'to-you' | 'back';

export interface Journey {
  step: ViewerStep;
  screen: Screen;
  rail: Rail;
  stop: Stop;
  here: Here;
}

const railAt: Record<ViewerStep['kind'], Rail['at']> = {
  organize: 0, watch: 0, join: 0, fund: 1, wait: 1, 'take-back': 3, approve: 2, stopped: 2, approved: 2,
  'payout-pending': 3, paid: 3, reclaiming: 3, reclaimed: 3,
};

function railOf(step: ViewerStep, record: CampaignRecord, own: boolean): Rail {
  // Someone who never chipped in stays at Join, whatever the stack did without them.
  if (!own) return { at: 0, paid: false };
  const rail: Rail = { at: railAt[step.kind], paid: statusOf(record) === 'paid' };
  if (step.kind === 'payout-pending') rail.pending = true;
  if (step.kind === 'take-back' || step.kind === 'reclaiming' || step.kind === 'reclaimed') rail.branch = 'back';
  if (step.kind === 'reclaimed') rail.done = true;
  return rail;
}

const plural = (count: number, one: string, many: string) => `${count} more ${count === 1 ? one : many}`;

// The pleb's step header for the screen they are on, counts and names from the record.
export function plebHere(screen: Screen, step: ViewerStep, record: CampaignRecord): Here {
  const each = sats(record.campaign.contributionSat);
  const maintainer = maintainerOf(record).short;
  const total = sats(record.campaign.contributionSat * record.campaign.backerCount);
  const missing = record.campaign.backerCount - tally(record).held;
  switch (screen) {
    case 'join':
      if (step.kind === 'join') return { name: 'Join the stack', next: `chip in ${each}.` };
      return { name: fellShort(record) ? 'This stack closed' : 'This stack is full', next: 'start a new stack.' };
    case 'pay': return { name: 'Pay to stack', next: 'pay the invoice.' };
    case 'stacked': case 'waiting':
      return { name: 'Stacked', next: missing > 0 ? `${plural(missing, 'pleb chips', 'plebs chip')} in.` : 'check the payout and sign.' };
    case 'sign':
      return step.kind === 'stopped' ? { name: 'Signing stopped', next: `take your ${each} back.` }
        : { name: 'Sign the group card', next: 'check the payout and sign.' };
    case 'signed': {
      const waitingOn = step.kind === 'approved' ? step.waitingOn : [];
      return waitingOn.length ? { name: 'Signed', next: `${listNames(waitingOn)} ${waitingOn.length > 1 ? 'sign' : 'signs'}.` }
        : { name: 'All three signed', next: 'send it to the mint.' };
    }
    case 'sending': return { name: 'Sending · not paid yet', next: 'the mint confirms.' };
    case 'paid': return { name: 'Paid', next: `Done. ${maintainer} got ${total}.`, end: true };
    case 'race': return { name: 'Paid', next: `Done. ${maintainer} got ${total}, yours included.`, end: true };
    case 'unmet': return { name: 'Take yours back', next: 'take yours back.' };
    case 'back':
      return step.kind === 'reclaimed' ? { name: 'Back to you', next: `Done. Your ${each} are back with you.`, end: true }
        : { name: 'Taking it back', next: `the mint sends your ${each} back.` };
  }
}

export type OrganizerStage = 'who' | 'key' | 'confirmed' | 'pasted' | 'terms' | 'share' | 'watch';

// Ada's four setup steps. Once the stack is open her setup is done; the rest is the plebs'.
export function organizerJourney(stage: OrganizerStage, maintainer: string, record?: CampaignRecord): { rail: Rail; here: Here } {
  const rail = (at: Rail['at'], done?: boolean): Rail => ({ at, paid: false, steps: organizerSteps, ...(done ? { done } : {}) });
  switch (stage) {
    case 'who': return { rail: rail(0), here: { name: 'Who you’re backing', next: 'name the person and the work.' } };
    case 'key': return { rail: rail(1), here: { name: `Get ${maintainer}’s key`, next: `${maintainer} confirms on her phone.` } };
    case 'confirmed': return { rail: rail(1), here: { name: 'Key confirmed', next: 'set the terms.' } };
    case 'pasted': return { rail: rail(1), here: { name: 'Key pasted', next: `check the key with ${maintainer}, then set the terms.` } };
    case 'terms': return { rail: rail(2), here: { name: 'Set the terms', next: 'create the stack.' } };
    case 'share': return { rail: rail(3), here: { name: 'Share the invite', next: 'send the invite, then watch it fill.' } };
    case 'watch': return { rail: rail(3, true), here: { name: 'Watching it fill · setup done', ...watchNext(record!, maintainer) } };
  }
}

function watchNext(record: CampaignRecord, maintainer: string): Omit<Here, 'name'> {
  const state = statusOf(record);
  const missing = record.campaign.backerCount - tally(record).held;
  if (state === 'paid') return { next: `Done. ${maintainer} was paid.`, end: true };
  if (state === 'unmet' || state === 'reclaimed') return { next: 'Done. Each pleb takes their own back.', end: true };
  if (state === 'paying out') return { next: 'the mint confirms.' };
  if (state === 'reclaiming') return { next: 'the mint answers the take-back.' };
  if (missing > 0) return { next: `${plural(missing, 'pleb chips', 'plebs chip')} in. Nothing for you to do.` };
  return { next: `${listNames(unsigned(record))} ${unsigned(record).length > 1 ? 'sign' : 'signs'}. Nothing for you to do.` };
}

const unsigned = (record: CampaignRecord) =>
  record.slots.filter(slot => slot.backerId && !slot.deposit?.authorizationReleased).map(slot => people[slot.backerId!].short);

export type MaintainerStage = 'claim' | 'claim-pasted' | 'follow' | 'receive' | 'swapping' | 'turned-down' | 'spent';

// Ngozi's four steps follow the money: her key, the stack, the payout in, then spent.
export function maintainerJourney(stage: MaintainerStage, organizer: string, record?: CampaignRecord): { rail: Rail; here: Here } {
  const rail = (at: Rail['at'], done?: boolean): Rail => ({ at, paid: false, steps: maintainerSteps, ...(done ? { done } : {}) });
  switch (stage) {
    case 'claim': return { rail: rail(0), here: { name: 'Confirm your key', next: 'confirm your key.' } };
    case 'claim-pasted': return { rail: rail(0), here: { name: 'A stack for you', next: `tell ${organizer} if that key isn’t yours.` } };
    case 'follow': return { rail: rail(1), here: { name: 'Follow the stack', ...followNext(organizer, record) } };
    case 'receive':
      return { rail: rail(2), here: { name: `${sats(record!.campaign.contributionSat * record!.campaign.backerCount)} for you`,
        next: record?.keyBy === 'pasted' ? `whoever holds the key ${organizer} pasted spends it.` : 'spend it into ecash only you hold.' } };
    case 'swapping': return { rail: rail(3), here: { name: 'Swapping', next: 'the mint answers.' } };
    case 'turned-down': return { rail: rail(3), here: { name: 'Swap turned down', next: 'try the swap again.' } };
    case 'spent': return { rail: rail(3, true), here: { name: 'Spent', next: 'Done. Copy your ecash into any Cashu wallet.', end: true } };
  }
}

function followNext(organizer: string, record?: CampaignRecord): Omit<Here, 'name'> {
  if (!record) return { next: `${organizer} sets the terms. Nothing to do yet.` };
  const state = statusOf(record);
  const missing = record.campaign.backerCount - tally(record).held;
  if (state === 'unmet' || state === 'reclaimed') return { next: 'Done. No payout this time.', end: true };
  if (state === 'paying out') return { next: 'the mint confirms.' };
  if (state === 'reclaiming') return { next: 'the mint answers the take-back. Nothing to do.' };
  if (missing > 0) return { next: `${plural(missing, 'pleb chips', 'plebs chip')} in. Nothing to do yet.` };
  return { next: `${listNames(unsigned(record))} ${unsigned(record).length > 1 ? 'sign' : 'signs'}. Nothing to do yet.` };
}

// The viewer asked for their own back, but the batch was issued first.
export function lostRace(record: CampaignRecord, viewerId: string): boolean {
  return record.operations.some(op => op.kind === 'reclaim' && op.savedBy === viewerId && op.status === 'rejected')
    && record.operations.some(op => op.kind === 'payout' && op.status === 'confirmed');
}

function screenOf(step: ViewerStep, record: CampaignRecord, viewerId: string): Screen {
  if (!slotOf(record, viewerId)) return 'join';
  switch (step.kind) {
    case 'fund': return 'pay';
    // Everyone is in but the batch can't go: the mint turned it down.
    case 'wait': return step.missing === 0 ? 'unmet' : 'waiting';
    case 'approve': case 'stopped': return 'sign';
    case 'approved': return 'signed';
    case 'payout-pending': return 'sending';
    case 'paid': return lostRace(record, viewerId) ? 'race' : 'paid';
    case 'take-back': return 'unmet';
    case 'reclaiming': case 'reclaimed': return 'back';
    default: return 'join';
  }
}

const stopAt: Partial<Record<ViewerStep['kind'], Stop>> = {
  fund: 'to-mint', approved: 'signed', 'payout-pending': 'to-maintainer', paid: 'with-maintainer', reclaiming: 'to-you',
  reclaimed: 'back',
};

export function journeyOf(world: World, record: CampaignRecord): Journey {
  const step = viewerStep(world, record);
  const own = slotOf(record, world.viewerId);
  const screen = screenOf(step, record, world.viewerId);
  return {
    step, screen, rail: railOf(step, record, own !== undefined),
    stop: !own ? 'wallet' : stopAt[step.kind] ?? 'at-mint',
    here: plebHere(screen, step, record),
  };
}

export function stopLabel(stop: Stop, maintainer: string): string {
  switch (stop) {
    case 'wallet': return 'in your wallet';
    case 'to-mint': return 'on the way to the mint';
    case 'at-mint': return 'at the mint, locked to you';
    case 'signed': return `at the mint, signed for ${maintainer}`;
    case 'to-maintainer': return `on the way to ${maintainer}`;
    case 'with-maintainer': return `with ${maintainer}, locked to her key`;
    case 'to-you': return 'on the way back to you';
    case 'back': return 'back with you';
  }
}

export interface GoalSlab {
  kind: 'filled' | 'open' | 'reclaimed';
  // The quote's public key, which fixes where the slab sits.
  key?: string;
  // Only a slab that is in carries a name; an open spot is nobody's yet.
  name?: string;
  own?: boolean;
}

export type GoalPhase = 'collecting' | 'at-line' | 'sending' | 'paid' | 'unmet';

export interface Goal {
  slabs: GoalSlab[];
  phase: GoalPhase;
  label: string;
  text: string;
}

const STEP = 4;
const STEPS = 12;
const fallback = [3, 0, 6];

// The same quote lands in the same spot on every screen and in every browser.
export function slabOffset(key: string | undefined, index: number): number {
  if (!key) return fallback[index % fallback.length] * STEP;
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % (STEPS + 1)) * STEP;
}

export function campaignGoal(record: CampaignRecord, viewerId?: string): Goal {
  const state = statusOf(record);
  const { held, heldSat, targetSat } = tally(record);
  const complete = groupComplete(record);
  const slabs = record.slots.map((slot): GoalSlab => {
    const kind = slot.deposit?.state === 'reclaimed' ? 'reclaimed' : isHeld(slot) ? 'filled' : 'open';
    const own = viewerId !== undefined && slot.backerId === viewerId;
    return {
      kind, key: slot.quote?.ownerPubkey, own: own && kind !== 'open',
      ...(kind !== 'open' && slot.backerId ? { name: own ? 'You' : people[slot.backerId].short } : {}),
    };
  });
  if (state === 'paid') {
    return { slabs, phase: 'paid', label: `goal reached · ${sats(targetSat)} paid`,
      text: `Goal reached. ${sats(targetSat)} paid, confirmed by the mint.` };
  }
  const text = `${held} of 3 deposits in, ${heldSat} of ${sats(targetSat)}.`;
  if (complete) {
    const sending = state === 'paying out' || pendingOperation(record, 'payout') !== undefined;
    return { slabs, phase: sending ? 'sending' : 'at-line',
      label: sending ? `at the line · signed ${signedCount(record)} of 3` : `at the line · ${heldSat} of ${sats(targetSat)}`, text };
  }
  return { slabs, phase: state === 'unmet' ? 'unmet' : 'collecting', label: `goal · ${heldSat} of ${sats(targetSat)}`,
    text: state === 'unmet' ? `${text} No payout this time.` : text };
}

// Names of the plebs who are in, the viewer as "you", in join order.
export function whoIsIn(record: CampaignRecord, viewerId: string): string[] {
  return record.slots.filter(isHeld).map(slot => (slot.backerId === viewerId ? 'you' : people[slot.backerId!].short));
}

export function signedCount(record: CampaignRecord): number {
  return record.slots.filter(slot => slot.deposit?.authorizationReleased).length;
}

// Every deposit carries a released signature and no batch is on its way: the last signer sends it.
export function readyToSend(record: CampaignRecord): boolean {
  return signedCount(record) === record.slots.length && !pendingOperation(record, 'payout')
    && !record.operations.some(op => op.kind === 'payout' && op.status === 'confirmed');
}

// The close as the viewer reads it, in their own zone, from the time saved with the campaign.
export function closeLine(record: CampaignRecord, timeZone?: string): string | undefined {
  if (!record.closesAt) return undefined;
  if (record.close === 'lifted') return 'all in · the close no longer applies';
  return `${record.close === 'closed' ? 'closed' : 'closes'} ${formatWhen(record.closesAt, timeZone)}`;
}
