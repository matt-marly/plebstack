import { TEST_MINT, type Campaign, type CampaignState, type Deposit, type DepositState, type LockedQuote, type MoneyState } from '../domain/models';
import { campaignState, stateCopy, transitionDeposit, type DepositEvent, type StateTerms } from '../domain/states';
import { formatWhen, listNames } from '../ui/format';

// Stub world for the clickable prototype. Nothing in here talks to a mint:
// every "mint result" is a scripted answer applied through the domain transitions,
// so the screens can only show states the real state machine allows.

export interface Person {
  id: string;
  name: string;
  short: string;
  pubkey: string;
}

export const people: Record<string, Person> = {
  ngozi: { id: 'ngozi', name: 'Ngozi Eze', short: 'Ngozi', pubkey: '02c41f7ab36e09d5582f6a1be7c0934d8e15fa2260b7c98d3e4a5f1067bd29e8a3' },
  tobi: { id: 'tobi', name: 'Tobi Adewale', short: 'Tobi', pubkey: '03917be20c5d4f8a61e37d09ab52c6f4018e7d3b95ac20f16e48d7b03c5a9e1f47' },
  maren: { id: 'maren', name: 'Maren Solheim', short: 'Maren', pubkey: '02e85a03d7c61b94f20a8e5d37c9b1460fd28e7a5c3916b04d8fe2a17c6b950d32' },
  ishaan: { id: 'ishaan', name: 'Ishaan Rao', short: 'Ishaan', pubkey: '037d20e9b4a6185cf3d07e2a9b54c1680ef3a7d5192c8b46e0f7a3d15c9e82b604' },
};

export const DEFAULT_VIEWER = 'ishaan';
export const SWAP_FEE_SAT = 1;
export const DEPOSIT_SAT = 21;

export interface Slot {
  id: string;
  backerId?: string;
  quote?: LockedQuote;
  deposit?: Deposit;
}

// "Awaiting deposit" is quote setup, not one of the seven money states.
export type SlotStatus = 'open' | 'awaiting' | DepositState;

export interface SavedOperation {
  id: string;
  kind: 'payout' | 'reclaim';
  slotIds: string[];
  savedBy: string;
  amountSat: number;
  savedAt: string;
  status: 'dispatched' | 'unresolved' | 'confirmed' | 'rejected';
  settledAt?: string;
}

export interface LogEntry {
  at: string;
  text: string;
}

export interface CampaignRecord {
  campaign: Campaign;
  creatorId: string;
  project?: string;
  workLabel?: string;
  slots: Slot[];
  outputsVerified: boolean;
  operations: SavedOperation[];
  log: LogEntry[];
  // What the stub mint reports when a payout batch and a reclaim contest the same quote.
  mintFavours: 'creator' | 'owner';
  stoppedAt?: string;
  spend?: { at: string; feeSat: number; receivedSat: number };
}

export interface World {
  viewerId: string;
  campaigns: CampaignRecord[];
  // Latest state change as one sentence, for the live region.
  notice: string;
}

export interface CampaignDraft {
  title: string;
  publicWorkUrl: string;
  contributionSat: number;
  beneficiaryPubkey: string;
}

// ---------------------------------------------------------------- reading

export function findCampaign(world: World, campaignId: string | undefined): CampaignRecord | undefined {
  return world.campaigns.find(record => record.campaign.id === campaignId);
}

export function findSlot(record: CampaignRecord, slotId: string | undefined): Slot | undefined {
  return record.slots.find(slot => slot.id === slotId);
}

export function slotOf(record: CampaignRecord, personId: string): Slot | undefined {
  return record.slots.find(slot => slot.backerId === personId);
}

export function depositsOf(record: CampaignRecord): Deposit[] {
  return record.slots.flatMap(slot => (slot.deposit ? [slot.deposit] : []));
}

export function statusOf(record: CampaignRecord): CampaignState {
  return campaignState(record.campaign, depositsOf(record), record.outputsVerified);
}

export function slotStatus(slot: Slot): SlotStatus {
  if (slot.deposit) return slot.deposit.state;
  return slot.quote ? 'awaiting' : 'open';
}

// A deposit counts toward the group while it has not been taken back.
export function isHeld(slot: Slot): boolean {
  return slot.deposit !== undefined && slot.deposit.state !== 'reclaimed';
}

export function tally(record: CampaignRecord) {
  const held = record.slots.filter(isHeld).length;
  const approvals = record.slots.filter(slot => slot.deposit?.authorizationReleased).length;
  return {
    held,
    approvals,
    heldSat: held * record.campaign.contributionSat,
    targetSat: record.campaign.backerCount * record.campaign.contributionSat,
  };
}

export function groupComplete(record: CampaignRecord): boolean {
  return record.slots.every(isHeld);
}

export function pendingOperation(record: CampaignRecord, kind: SavedOperation['kind'], slotId?: string): SavedOperation | undefined {
  return record.operations.find(op => op.kind === kind && isPending(op) && (!slotId || op.slotIds.includes(slotId)));
}

export function latestOperation(record: CampaignRecord, kind: SavedOperation['kind'], slotId?: string): SavedOperation | undefined {
  return [...record.operations].reverse().find(op => op.kind === kind && (!slotId || op.slotIds.includes(slotId)));
}

export function isPending(operation: SavedOperation): boolean {
  return operation.status === 'dispatched' || operation.status === 'unresolved';
}

export function canApprove(record: CampaignRecord, slot: Slot): boolean {
  return record.outputsVerified
    && slot.deposit?.state === 'deposited'
    && !slot.deposit.newApprovalsStopped
    && record.slots.every(other => other.deposit?.quote.mintState === 'PAID');
}

export function termsOf(record: CampaignRecord): StateTerms {
  return { maintainer: people[record.creatorId], amountSat: record.campaign.contributionSat };
}

export function stateSentence(record: CampaignRecord, state: MoneyState): string {
  return stateCopy[state].sentence(termsOf(record));
}

export interface Headline {
  state: CampaignState;
  word: string;
  phrase?: string;
  icon: string;
  sentence: string;
}

export function headline(record: CampaignRecord): Headline {
  const state = statusOf(record);
  const maintainer = people[record.creatorId].short;
  const each = sats(record.campaign.contributionSat);
  if (state === 'collecting') {
    return tally(record).held > 0
      ? { state, word: 'Collecting', icon: stateCopy.deposited.icon,
        sentence: `Each deposit waits at the mint, locked to its owner’s key. Nothing is paid to ${maintainer} yet.` }
      : { state, word: 'Collecting', icon: 'slot-open', sentence: `Nothing stacked yet. Nothing is paid to ${maintainer}.` };
  }
  if (state === 'unmet') {
    return {
      state, word: 'Unmet', icon: 'bracket-open',
      sentence: record.campaign.collectionStopped
        ? `Collecting stopped. No payout. Each pleb can take their own ${each} back.`
        : `A deposit was taken back, so there’s no payout. Each pleb can take their own ${each} back.`,
    };
  }
  const copy = stateCopy[state];
  if (state === 'approved') return { state, word: copy.word, phrase: copy.phrase, icon: copy.icon, sentence: 'Signed 3 of 3.' };
  if (state === 'reclaiming') {
    const names = record.slots.filter(slot => slotStatus(slot) === 'reclaiming').map(slot => people[slot.backerId!].short);
    return { state, word: copy.word, phrase: copy.phrase, icon: copy.icon,
      sentence: `${listNames(names)} asked the mint for their own ${each}. If a signature was released, the payout may still win.` };
  }
  return { state, word: copy.word, phrase: copy.phrase, icon: copy.icon, sentence: copy.sentence(termsOf(record)) };
}

// What the person looking at a campaign can do next. Screens render from this
// instead of working it out themselves, so the offer always matches the state machine.
export type ViewerStep =
  | { kind: 'organize' }
  | { kind: 'watch' }
  | { kind: 'join' }
  | { kind: 'fund'; slot: Slot }
  | { kind: 'wait'; slot: Slot; missing: number }
  | { kind: 'approve'; slot: Slot }
  | { kind: 'stopped'; slot: Slot }
  | { kind: 'approved'; slot: Slot; waitingOn: string[] }
  | { kind: 'payout-pending'; slot?: Slot }
  | { kind: 'paid'; slot?: Slot }
  | { kind: 'take-back'; slot: Slot }
  | { kind: 'reclaiming'; slot: Slot }
  | { kind: 'reclaimed'; slot: Slot };

export function viewerStep(world: World, record: CampaignRecord): ViewerStep {
  const state = statusOf(record);
  const slot = slotOf(record, world.viewerId);
  if (!slot) {
    if (state === 'paying out' || (state === 'reclaiming' && pendingOperation(record, 'payout'))) return { kind: 'payout-pending' };
    if (state === 'paid') return { kind: 'paid' };
    if (world.viewerId === record.creatorId) return { kind: 'organize' };
    return state === 'collecting' && record.slots.some(other => !other.backerId) ? { kind: 'join' } : { kind: 'watch' };
  }
  switch (slotStatus(slot)) {
    case 'awaiting': return { kind: 'fund', slot };
    case 'reclaimed': return { kind: 'reclaimed', slot };
    case 'reclaiming': return { kind: 'reclaiming', slot };
    case 'paid': return { kind: 'paid', slot };
    case 'paying out': return { kind: 'payout-pending', slot };
    case 'approved': return {
      kind: 'approved', slot,
      waitingOn: record.slots.filter(other => !other.deposit?.authorizationReleased && other.backerId)
        .map(other => people[other.backerId!].short),
    };
    default:
      if (state === 'unmet') return { kind: 'take-back', slot };
      if (slot.deposit?.newApprovalsStopped) return { kind: 'stopped', slot };
      if (canApprove(record, slot)) return { kind: 'approve', slot };
      return { kind: 'wait', slot, missing: record.slots.length - tally(record).held };
  }
}

// One line of counts for lists and summaries.
export function progressLine(record: CampaignRecord): string {
  const { held, approvals, heldSat, targetSat } = tally(record);
  const state = statusOf(record);
  if (state === 'paid') return `goal reached · ${sats(targetSat)} paid`;
  const parts = [`${held} of 3 stacked`, `${heldSat} of ${sats(targetSat)}`];
  if (approvals > 0 || state === 'ready') parts.push(`signed ${approvals} of 3`);
  if (record.campaign.collectionStopped) parts.push('collecting stopped');
  return parts.join(' · ');
}

export function roleLine(world: World, record: CampaignRecord): string {
  const slot = slotOf(record, world.viewerId);
  if (slot) {
    const status = slotStatus(slot);
    return status === 'awaiting'
      ? 'Your invoice is waiting. Not stacked until the mint reports it paid.'
      : `Your ${sats(record.campaign.contributionSat)}: ${stateCopy[status as DepositState].word.toLowerCase()}.`;
  }
  return world.viewerId === record.creatorId ? 'You’re the maintainer. The payout is locked to your key.' : 'You have no deposit here.';
}

// Row sentences are the documented ones; someone else's row speaks of them, not you.
export function rowSentence(record: CampaignRecord, status: SlotStatus, own: boolean): string {
  const each = sats(record.campaign.contributionSat);
  const maintainer = people[record.creatorId].short;
  if (status === 'open') return 'Open. No deposit yet.';
  if (status === 'awaiting') {
    return own ? `Pay this invoice to stack ${each}. Not stacked until the mint reports it paid.`
      : 'Invoice made. Not stacked until the mint reports it paid.';
  }
  if (own) return stateSentence(record, status);
  switch (status) {
    case 'deposited': return `${each} at the mint, locked to their key. Not paid to ${maintainer}.`;
    case 'approved': return 'Signed. It can’t be taken back. A reclaim can still race the payout.';
    case 'reclaiming': return `Asking the mint for their own ${each}. If they signed, the payout may still win.`;
    case 'reclaimed': return `${each} minted to their own outputs. Confirmed by the mint.`;
    default: return stateSentence(record, status);
  }
}

// ---------------------------------------------------------------- stub material

const HEX = '0123456789abcdef';
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function stream(seed: string, alphabet: string, length: number): string {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    hash = Math.imul(hash ^ (hash >>> 13), 1540483477) + i;
    out += alphabet[(hash >>> 0) % alphabet.length];
  }
  return out;
}

function stubQuote(campaign: Campaign, slotId: string, owner: Person): LockedQuote {
  const seed = `${campaign.id}/${slotId}`;
  const id = [8, 4, 4, 4, 12].map((size, part) => stream(`${seed}/${part}`, HEX, size)).join('-');
  return {
    id,
    mint: campaign.mint,
    ownerPubkey: owner.pubkey,
    amountSat: campaign.contributionSat,
    invoice: `lnbcrt${campaign.contributionSat * 10}n1p${stream(seed, BECH32, 196)}`,
    mintState: 'UNPAID',
  };
}

function operationId(record: CampaignRecord, kind: string): string {
  return `op-${stream(`${record.campaign.id}/${kind}/${record.operations.length}`, HEX, 8)}`;
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'campaign';
}

export function sats(amount: number): string {
  return `${amount.toLocaleString('en')} ${amount === 1 ? 'sat' : 'sats'}`;
}

// ---------------------------------------------------------------- changing

function update(world: World, campaignId: string, notice: string, change: (record: CampaignRecord) => CampaignRecord): World {
  if (!findCampaign(world, campaignId)) throw new Error(`No campaign ${campaignId}.`);
  return {
    ...world,
    notice,
    campaigns: world.campaigns.map(record => (record.campaign.id === campaignId ? change(record) : record)),
  };
}

function withSlot(record: CampaignRecord, slot: Slot): CampaignRecord {
  return { ...record, slots: record.slots.map(other => (other.id === slot.id ? slot : other)) };
}

function move(slot: Slot, event: DepositEvent): Slot {
  if (!slot.deposit) throw new Error('This slot has no deposit.');
  return { ...slot, deposit: transitionDeposit(slot.deposit, event) };
}

function logged(record: CampaignRecord, at: string, ...texts: string[]): CampaignRecord {
  return { ...record, log: [...record.log, ...texts.map(text => ({ at, text }))] };
}

function ownSlot(world: World, record: CampaignRecord, slotId: string): Slot {
  const slot = findSlot(record, slotId);
  if (!slot) throw new Error(`No deposit ${slotId}.`);
  if (slot.backerId !== world.viewerId) throw new Error('Only the owner of a deposit can act on it.');
  return slot;
}

export function setViewer(world: World, viewerId: string): World {
  if (!people[viewerId]) throw new Error(`Unknown person ${viewerId}.`);
  return { ...world, viewerId };
}

export function createCampaign(world: World, draft: CampaignDraft, at: string): World {
  const base = slugify(draft.title);
  let id = base;
  for (let n = 2; findCampaign(world, id); n += 1) id = `${base}-${n}`;
  const creator = people[world.viewerId];
  const slotIds = ['backer-1', 'backer-2', 'backer-3'];
  const record: CampaignRecord = {
    campaign: {
      id, title: draft.title.trim(), publicWorkUrl: draft.publicWorkUrl.trim(), mint: TEST_MINT,
      beneficiaryPubkey: draft.beneficiaryPubkey.trim(), backerCount: 3, contributionSat: draft.contributionSat,
      collectionStopped: false, depositIds: slotIds,
    },
    creatorId: creator.id,
    slots: slotIds.map(slotId => ({ id: slotId })),
    outputsVerified: false,
    operations: [],
    mintFavours: 'creator',
    log: [{ at, text: `${creator.short} created the campaign: three plebs, ${sats(draft.contributionSat)} each.` }],
  };
  return { ...world, campaigns: [...world.campaigns, record], notice: 'Campaign created. Nothing stacked yet.' };
}

// A live quote comes from the mint, already locked to a key made in this browser.
export function requestQuote(world: World, campaignId: string, at: string, liveQuote?: LockedQuote): World {
  const backer = people[world.viewerId];
  const each = sats(findCampaign(world, campaignId)?.campaign.contributionSat ?? DEPOSIT_SAT);
  return update(world, campaignId, `Pay this invoice to stack ${each}. Not stacked until the mint reports it paid.`, record => {
    if (statusOf(record) !== 'collecting') throw new Error('This campaign is not collecting deposits.');
    if (slotOf(record, backer.id)) throw new Error('This backer already holds a slot.');
    const open = record.slots.find(slot => !slot.backerId);
    if (!open) throw new Error('All three slots are taken.');
    const slot: Slot = { ...open, backerId: backer.id, quote: liveQuote ?? stubQuote(record.campaign, open.id, backer) };
    return logged(withSlot(record, slot), at, `${backer.short} made a deposit invoice for ${each}.`);
  });
}

// The test mint credits its own invoices, so "checking" an unpaid quote always finds it paid.
// A live check passes the mint's own answer, which must be for this slot's quote and paid.
export function confirmDeposit(world: World, campaignId: string, slotId: string, at: string, paidQuote?: LockedQuote): World {
  const each = sats(findCampaign(world, campaignId)?.campaign.contributionSat ?? DEPOSIT_SAT);
  return update(world, campaignId, `Stacked. ${each} at the mint, locked to your key.`, record => {
    const slot = findSlot(record, slotId);
    if (!slot?.quote || !slot.backerId || slot.deposit) throw new Error('No unpaid quote to check.');
    if (paidQuote && (paidQuote.id !== slot.quote.id || paidQuote.mintState !== 'PAID')) throw new Error('That is not this slot’s paid quote.');
    const quote: LockedQuote = paidQuote ?? { ...slot.quote, mintState: 'PAID' };
    const deposit: Deposit = {
      id: slot.id, campaignId, quote, state: 'deposited', authorizationReleased: false, newApprovalsStopped: false,
    };
    let next = withSlot(record, { ...slot, quote, deposit });
    next = logged(next, at, `${people[slot.backerId].short} stacked ${sats(quote.amountSat)} at the mint.`);
    if (next.slots.every(other => other.deposit?.state === 'deposited')) {
      next = logged({ ...next, outputsVerified: true }, at, 'All three deposits are in. Each pleb checks the outputs and signs.');
    }
    return next;
  });
}

export function stopApproval(world: World, campaignId: string, slotId: string, at: string): World {
  return update(world, campaignId, 'You stopped signing on this device. A signature you already released still counts.', record => {
    const slot = ownSlot(world, record, slotId);
    return logged(withSlot(record, move(slot, { type: 'stop-local-approval' })), at,
      `${people[world.viewerId].short} stopped signing on their device.`);
  });
}

export function releaseApproval(world: World, campaignId: string, slotId: string, at: string): World {
  const before = findCampaign(world, campaignId);
  const next = update(world, campaignId, 'Signed. You can’t take it back.', record => {
    const slot = ownSlot(world, record, slotId);
    if (!canApprove(record, slot)) throw new Error('This deposit cannot be approved right now.');
    let next = withSlot(record, move(slot, { type: 'release-authorization' }));
    next = logged(next, at, `${people[world.viewerId].short} signed.`);
    const everySignature = next.slots.every(other => other.deposit?.authorizationReleased);
    return everySignature && !pendingOperation(next, 'payout') ? submitPayout(next, at) : next;
  });
  const sent = !pendingOperation(before!, 'payout') && pendingOperation(findCampaign(next, campaignId)!, 'payout');
  return sent ? { ...next, notice: 'Signed. Sent to the mint. Waiting for the mint to confirm.' } : next;
}

function submitPayout(record: CampaignRecord, at: string): CampaignRecord {
  const slots = record.slots.map(slot => (slot.deposit?.state === 'approved' ? move(slot, { type: 'submit-payout' }) : slot));
  const operation: SavedOperation = {
    id: operationId(record, 'payout'), kind: 'payout', slotIds: record.slots.map(slot => slot.id),
    savedBy: record.creatorId, amountSat: tally(record).targetSat, savedAt: at, status: 'dispatched',
  };
  return logged({ ...record, slots, operations: [...record.operations, operation] }, at,
    'All three signed. One batch sent to the mint.');
}

export function requestReclaim(world: World, campaignId: string, slotId: string, at: string): World {
  return update(world, campaignId, 'Unstacking. Waiting for the mint.', record => {
    const slot = ownSlot(world, record, slotId);
    const next = withSlot(record, move(slot, { type: 'request-reclaim' }));
    const operation: SavedOperation = {
      id: operationId(record, 'reclaim'), kind: 'reclaim', slotIds: [slot.id], savedBy: world.viewerId,
      amountSat: record.campaign.contributionSat, savedAt: at, status: 'dispatched',
    };
    return logged({ ...next, operations: [...next.operations, operation] }, at,
      `${people[world.viewerId].short} asked the mint for their own ${sats(operation.amountSat)} back.`);
  });
}

export function markTimedOut(world: World, campaignId: string, at: string): World {
  return update(world, campaignId, 'Still waiting for the mint. The request is saved. Nothing is paid until the mint confirms.', record => {
    const operation = pendingOperation(record, 'payout');
    if (!operation) throw new Error('No payout in flight.');
    return logged({
      ...record,
      operations: record.operations.map(op => (op === operation ? { ...op, status: 'unresolved' } : op)),
    }, at, 'No answer from the mint for the payout. The request is saved; the result is unknown until the mint is asked again.');
  });
}

// Ask the stub mint about everything pending in a campaign. A reclaim with no batch in
// flight always goes to its owner; a contested quote goes to whoever the script favours.
export function checkMint(world: World, campaignId: string, at: string, favour?: 'creator' | 'owner'): World {
  const record = findCampaign(world, campaignId);
  if (!record) throw new Error(`No campaign ${campaignId}.`);
  const payout = pendingOperation(record, 'payout');
  const reclaims = record.operations.filter(op => op.kind === 'reclaim' && isPending(op));
  if (!payout && reclaims.length === 0) return world;
  const winner = !payout ? 'owner' : reclaims.length === 0 ? 'creator' : favour ?? record.mintFavours;
  const settle = (op: SavedOperation, status: SavedOperation['status']): SavedOperation => ({ ...op, status, settledAt: at });

  const maintainer = people[record.creatorId];
  const each = sats(record.campaign.contributionSat);
  const viewerReclaimed = reclaims.some(op => op.savedBy === world.viewerId);

  if (winner === 'creator') {
    const notice = viewerReclaimed
      ? `The payout got there first. Your ${each} went to ${maintainer.short}. Your reclaim was rejected.`
      : `Stacked. Paid. ${sats(tally(record).targetSat)} from 3 plebs to ${maintainer.name}. Confirmed by the mint at ${formatWhen(at)}.`;
    return update(world, campaignId, notice, current => logged({
      ...current,
      slots: current.slots.map(slot => move(slot, { type: 'mint-confirmed', destination: 'creator' })),
      operations: current.operations.map(op => (op === payout ? settle(op, 'confirmed') : reclaims.includes(op) ? settle(op, 'rejected') : op)),
    }, at,
    `The mint confirmed the batch: ${sats(tally(current).targetSat)} issued to ${maintainer.short}’s key.`,
    ...reclaims.map(op => `${people[op.savedBy].short}’s reclaim was rejected. The payout got there first.`)));
  }

  const reclaimers = listNames(reclaims.map(op => people[op.savedBy].short));
  const stillHeld = record.slots.some(slot => slot.backerId === world.viewerId && isHeld(slot)
    && !reclaims.some(op => op.slotIds.includes(slot.id)));
  let notice = `${reclaimers} took theirs back. Confirmed by the mint.`;
  if (viewerReclaimed) notice = payout ? 'Your reclaim got there first. The payout was rejected.' : `Back to you. ${each} minted to your own outputs.`;
  else if (payout) notice = `${reclaimers} took theirs back first. The payout was rejected.${stillHeld ? ` Your ${each} are still at the mint.` : ''}`;

  return update(world, campaignId, notice, current => {
    const reclaimed = new Set(reclaims.flatMap(op => op.slotIds));
    const slots = current.slots.map(slot => {
      if (reclaimed.has(slot.id)) return move(slot, { type: 'mint-confirmed', destination: 'owner' });
      const state = slot.deposit?.state;
      return state === 'approved' || state === 'paying out' ? move(slot, { type: 'batch-rejected' }) : slot;
    });
    const next: CampaignRecord = {
      ...current, slots, outputsVerified: false,
      operations: current.operations.map(op => (reclaims.includes(op) ? settle(op, 'confirmed') : op === payout ? settle(op, 'rejected') : op)),
    };
    return logged(next, at,
      ...reclaims.map(op => `The mint confirmed ${people[op.savedBy].short}’s reclaim: ${sats(op.amountSat)} minted to their own outputs.`),
      ...(payout ? ['The payout batch was rejected. A deposit was taken back first.'] : []));
  });
}

export function recordSpend(world: World, campaignId: string, at: string): World {
  const record = findCampaign(world, campaignId);
  const receivedSat = record ? tally(record).targetSat - SWAP_FEE_SAT : 0;
  const spent = record
    ? `${people[record.creatorId].short} spent it. Swap fee at the mint, ${sats(SWAP_FEE_SAT)}. Received, ${sats(receivedSat)}.` : '';
  return update(world, campaignId, spent, current => {
    if (world.viewerId !== current.creatorId) throw new Error('Only the creator can spend the payout.');
    if (statusOf(current) !== 'paid' || current.spend) throw new Error('There is no unspent payout.');
    return logged({ ...current, spend: { at, feeSat: SWAP_FEE_SAT, receivedSat } }, at, spent);
  });
}

// Stopping collection is a note on the campaign. It moves no money and undoes no signature.
export function stopCollecting(world: World, campaignId: string, at: string): World {
  return update(world, campaignId, 'Collecting stopped. Signatures already released still count.', record => {
    if (world.viewerId !== record.creatorId) throw new Error('Only the organizer can stop collecting.');
    if (statusOf(record) !== 'collecting') throw new Error('This campaign is no longer collecting.');
    return logged({ ...record, campaign: { ...record.campaign, collectionStopped: true }, stoppedAt: at }, at,
      `${people[record.creatorId].short} stopped collecting.`);
  });
}

// ---------------------------------------------------------------- starting data

export const MAIN_CAMPAIGN = 'pocket-ical-412';
export const UNMET_CAMPAIGN = 'pocket-ical-388';
export const RACE_CAMPAIGN = 'pocket-ical-401';

function seed(id: string, title: string, issue: number, at: string): CampaignRecord {
  const slotIds = ['backer-1', 'backer-2', 'backer-3'];
  return {
    campaign: {
      id, title, publicWorkUrl: `https://git.example.org/ngozi/pocket-ical/issues/${issue}`, mint: TEST_MINT,
      beneficiaryPubkey: people.ngozi.pubkey, backerCount: 3, contributionSat: DEPOSIT_SAT, collectionStopped: false,
      depositIds: slotIds,
    },
    creatorId: 'ngozi',
    project: 'pocket-ical',
    workLabel: `Issue #${issue}`,
    slots: slotIds.map(slotId => ({ id: slotId })),
    outputsVerified: false,
    operations: [],
    mintFavours: 'creator',
    log: [{ at, text: `Ngozi created the campaign: three plebs, ${sats(DEPOSIT_SAT)} each.` }],
  };
}

function deposit(world: World, campaignId: string, personId: string, requestedAt: string, paidAt: string): World {
  const asked = requestQuote(setViewer(world, personId), campaignId, requestedAt);
  const slot = slotOf(findCampaign(asked, campaignId)!, personId)!;
  return confirmDeposit(asked, campaignId, slot.id, paidAt);
}

export function initialWorld(): World {
  let world: World = {
    viewerId: DEFAULT_VIEWER,
    notice: '',
    campaigns: [
      seed(MAIN_CAMPAIGN, 'Fix daylight-saving drift in recurring events', 412, '2026-11-13T09:12:00Z'),
      seed(UNMET_CAMPAIGN, 'Keyboard navigation for the docs site', 388, '2026-11-06T10:30:00Z'),
      seed(RACE_CAMPAIGN, 'Publish typed bindings', 401, '2026-11-12T16:20:00Z'),
    ],
  };

  world = deposit(world, MAIN_CAMPAIGN, 'tobi', '2026-11-13T09:38:00Z', '2026-11-13T09:40:00Z');
  world = deposit(world, MAIN_CAMPAIGN, 'maren', '2026-11-13T11:04:00Z', '2026-11-13T11:05:00Z');

  world = deposit(world, UNMET_CAMPAIGN, 'tobi', '2026-11-06T12:14:00Z', '2026-11-06T12:15:00Z');
  world = deposit(world, UNMET_CAMPAIGN, 'ishaan', '2026-11-07T08:50:00Z', '2026-11-07T08:51:00Z');
  world = update(world, UNMET_CAMPAIGN, '', record => logged({
    ...record,
    campaign: { ...record.campaign, collectionStopped: true },
    stoppedAt: '2026-11-12T18:30:00Z',
  }, '2026-11-12T18:30:00Z', 'Ngozi stopped collecting. The third slot was never filled.'));

  world = deposit(world, RACE_CAMPAIGN, 'tobi', '2026-11-12T17:01:00Z', '2026-11-12T17:02:00Z');
  world = deposit(world, RACE_CAMPAIGN, 'maren', '2026-11-12T19:44:00Z', '2026-11-12T19:45:00Z');
  world = deposit(world, RACE_CAMPAIGN, 'ishaan', '2026-11-13T08:10:00Z', '2026-11-13T08:11:00Z');
  world = releaseApproval(setViewer(world, 'tobi'), RACE_CAMPAIGN, 'backer-1', '2026-11-13T09:02:00Z');
  world = releaseApproval(setViewer(world, 'maren'), RACE_CAMPAIGN, 'backer-2', '2026-11-13T12:30:00Z');
  world = releaseApproval(setViewer(world, 'ishaan'), RACE_CAMPAIGN, 'backer-3', '2026-11-13T13:48:00Z');
  world = markTimedOut(world, RACE_CAMPAIGN, '2026-11-13T13:49:00Z');

  return { ...setViewer(world, DEFAULT_VIEWER), notice: '' };
}
