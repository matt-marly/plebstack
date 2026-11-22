import {
  groupComplete, isHeld, pendingOperation, people, sats, slotOf, statusOf, tally, viewerStep,
  type CampaignRecord, type ViewerStep, type World,
} from '../demo/world';
import { formatWhen } from './format';

export const PLEBS = ['tobi', 'maren', 'ishaan'] as const;

export type Screen =
  | 'join' | 'pay' | 'stacked' | 'waiting' | 'sign' | 'signed' | 'sending' | 'paid' | 'race' | 'unmet' | 'back';

// Join · Stack · Sign · Paid. The rail is lime only once the mint confirmed the payout.
export interface Rail {
  at: 0 | 1 | 2 | 3;
  paid: boolean;
  // Organizer and maintainer have their own four steps.
  steps?: readonly string[];
}

export type Stop = 'wallet' | 'to-mint' | 'at-mint' | 'signed' | 'to-maintainer' | 'with-maintainer' | 'to-you' | 'back';

export interface Journey {
  step: ViewerStep;
  screen: Screen;
  rail: Rail;
  stop: Stop;
}

const railAt: Record<ViewerStep['kind'], Rail['at']> = {
  organize: 0, watch: 0, join: 0, fund: 1, wait: 1, 'take-back': 1, approve: 2, stopped: 2, approved: 2,
  'payout-pending': 3, paid: 3, reclaiming: 1, reclaimed: 1,
};

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
  return {
    step, screen: screenOf(step, record, world.viewerId),
    rail: { at: railAt[step.kind], paid: statusOf(record) === 'paid' },
    stop: !own ? 'wallet' : stopAt[step.kind] ?? 'at-mint',
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
