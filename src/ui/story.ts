import { latestOperation, maintainerOf, people, sats, tally, type CampaignRecord } from '../demo/world';
import type { Wallet } from '../live/actions';
import type { BoardDraft } from '../live/board';
import { formatWhen, shortKey } from './format';
import { campaignGoal, PLEBS, signedCount, type GoalPhase, type Stop } from './journey';

// What the stage tells, as times read from the board, the mint's answers and Ngozi's own phone.
// Every field is a time the thing happened, so two snapshots diff into the events between them.
export interface PlebSnap {
  id: string;
  name: string;
  joinedAt?: string;
  inAt?: string;
  signedAt?: string;
  takingAt?: string;
  backAt?: string;
  lostAt?: string;
}

export interface StageSnap {
  organizer: string;
  maintainer: string;
  each: number;
  total: number;
  mintHost: string;
  key?: string;
  closesAt?: string;
  draftAt?: string;
  keyAt?: string;
  keyBy?: 'maintainer' | 'pasted';
  openedAt?: string;
  plebs: PlebSnap[];
  stoppedAt?: string;
  closedAt?: string;
  sentAt?: string;
  paidAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  spendingAt?: string;
  spentAt?: string;
  swapRejectedAt?: string;
  feeSat?: number;
  receivedSat?: number;
}

type Whole = 'drafted' | 'key' | 'opened' | 'stopped' | 'closed' | 'sent' | 'rejected' | 'paid' | 'received' | 'spending' | 'spent' | 'swap-rejected';
type Each = 'joined' | 'landed' | 'signed' | 'taking' | 'back' | 'lost';
export type StageKind = Whole | Each;

export interface StageEvent {
  kind: StageKind;
  at: string;
  who?: string;
}

export interface Caption extends StageEvent {
  text: string;
  term: string;
}

const wholeFields: [Whole, keyof StageSnap][] = [
  ['drafted', 'draftAt'], ['key', 'keyAt'], ['opened', 'openedAt'], ['stopped', 'stoppedAt'], ['closed', 'closedAt'],
  ['sent', 'sentAt'], ['rejected', 'rejectedAt'], ['paid', 'paidAt'], ['received', 'receivedAt'], ['spending', 'spendingAt'],
  ['spent', 'spentAt'], ['swap-rejected', 'swapRejectedAt'],
];
const eachFields: [Each, keyof PlebSnap][] = [
  ['joined', 'joinedAt'], ['landed', 'inAt'], ['signed', 'signedAt'], ['taking', 'takingAt'], ['back', 'backAt'], ['lost', 'lostAt'],
];
// Two things saved in the same instant are told in the order they happen.
const order: StageKind[] = [
  'drafted', 'key', 'opened', 'joined', 'landed', 'signed', 'taking', 'back', 'lost', 'stopped', 'closed', 'sent', 'rejected', 'paid',
  'received', 'spending', 'spent', 'swap-rejected',
];

export function snapOf(draft: BoardDraft | undefined, record: CampaignRecord | undefined, wallet: Wallet = {}): StageSnap {
  const maintainer = record ? maintainerOf(record)
    : maintainerOf({ maintainerId: draft?.maintainerId ?? 'ngozi', maintainerName: draft?.maintainerName });
  const each = record?.campaign.contributionSat ?? 0;
  const payout = record && latestOperation(record, 'payout');
  const spend = wallet.spend;
  const plebs = PLEBS.map((id): PlebSnap => {
    const slot = record?.slots.find(other => other.backerId === id);
    const reclaim = record && slot ? latestOperation(record, 'reclaim', slot.id) : undefined;
    return {
      id, name: people[id].short, joinedAt: slot?.joinedAt, inAt: slot?.inAt,
      // A signature stops counting once a quote in its batch is gone.
      signedAt: slot?.deposit?.authorizationReleased ? slot.signedAt : undefined,
      takingAt: reclaim?.savedAt,
      backAt: reclaim?.status === 'confirmed' ? reclaim.settledAt : undefined,
      lostAt: reclaim?.status === 'rejected' ? reclaim.settledAt : undefined,
    };
  });
  return {
    organizer: people[record?.creatorId ?? draft?.organizerId ?? 'ada'].short,
    maintainer: maintainer.short,
    each,
    total: each * (record?.campaign.backerCount ?? 3),
    mintHost: record ? new URL(record.campaign.mint).host : '',
    key: record?.campaign.beneficiaryPubkey ?? draft?.key?.pubkey,
    closesAt: record?.closesAt,
    draftAt: draft?.createdAt,
    keyAt: draft?.key?.at,
    keyBy: record?.keyBy ?? draft?.key?.by,
    openedAt: record?.log[0]?.at,
    plebs,
    stoppedAt: record?.stoppedAt,
    closedAt: record?.close === 'closed' && !record.stoppedAt ? record.closesAt : undefined,
    sentAt: payout?.savedAt,
    paidAt: payout?.status === 'confirmed' ? payout.settledAt : undefined,
    rejectedAt: payout?.status === 'rejected' ? payout.settledAt : undefined,
    receivedAt: wallet.received?.at,
    spendingAt: spend?.savedAt,
    spentAt: spend?.status === 'confirmed' ? spend.savedAt : undefined,
    swapRejectedAt: spend?.status === 'rejected' ? spend.savedAt : undefined,
    ...(spend?.receivedSat !== undefined ? { feeSat: spend.grossSat - spend.receivedSat, receivedSat: spend.receivedSat } : {}),
  };
}

// The same snapshot with nothing yet happened: diffing from it tells the whole story so far.
export function blankOf(snap: StageSnap): StageSnap {
  const { organizer, maintainer, each, total, mintHost, key, closesAt, keyBy } = snap;
  return {
    organizer, maintainer, each, total, mintHost, key, closesAt, keyBy,
    plebs: snap.plebs.map(({ id, name }) => ({ id, name })),
  };
}

const changed = (before: unknown, after: unknown): after is string => typeof after === 'string' && after !== before;

// Everything that happened between two snapshots, in the order it happened.
export function stageEvents(prev: StageSnap, next: StageSnap): StageEvent[] {
  const found: StageEvent[] = [];
  for (const [kind, field] of wholeFields) {
    if (changed(prev[field], next[field])) found.push({ kind, at: next[field] as string });
  }
  for (const pleb of next.plebs) {
    const before = prev.plebs.find(other => other.id === pleb.id);
    for (const [kind, field] of eachFields) {
      if (changed(before?.[field], pleb[field])) found.push({ kind, at: pleb[field] as string, who: pleb.id });
    }
  }
  // A swap that went and came back between two looks is told once, by its answer.
  const answered = found.some(event => event.kind === 'spent' || event.kind === 'swap-rejected');
  return found.filter(event => !(answered && event.kind === 'spending'))
    .sort((a, b) => a.at.localeCompare(b.at) || order.indexOf(a.kind) - order.indexOf(b.kind));
}

export function storyOf(snap: StageSnap): StageEvent[] {
  return stageEvents(blankOf(snap), snap);
}

const counted = (snap: StageSnap, at: string, field: 'inAt' | 'signedAt') => snap.plebs
  .filter(pleb => pleb[field] && pleb[field]! <= at && !(pleb.backAt && pleb.backAt <= at)).length;

// One plain sentence, then the real term.
export function captionOf(event: StageEvent, snap: StageSnap): Caption {
  const who = event.who ? people[event.who].short : '';
  const { organizer: org, maintainer: her, mintHost: host } = snap;
  const each = sats(snap.each);
  const words = ((): [string, string] => {
    switch (event.kind) {
      case 'drafted': return [`${org} starts a stack for ${her}.`, 'no sats and no keys yet'];
      case 'key': return snap.keyBy === 'pasted'
        ? [`${org} pastes a payout key for ${her}.`, `${shortKey(snap.key ?? '')} · not confirmed on ${her}’s phone`]
        : [`${her} confirms her payout key on her own phone.`, `secp256k1 public key ${shortKey(snap.key ?? '')} · the private half stays on her phone`];
      case 'opened': return [`${org} opens the stack: three plebs, ${each} each.`,
        snap.closesAt ? `terms locked · closes ${formatWhen(snap.closesAt)}` : 'terms locked'];
      case 'joined': return [`${who} chips in. The mint makes an invoice locked to ${who}’s key.`, 'NUT-20 locked mint quote'];
      case 'landed': {
        const held = counted(snap, event.at, 'inAt');
        return held === 3
          ? [`${who}’s ${each} land. All three are in.`, `3 locked quotes at ${host}`]
          : [`${who}’s ${each} land. ${held} of 3 in.`, `NUT-20 locked quote at ${host}`];
      }
      case 'signed': return [`${who} signs the group card. ${counted(snap, event.at, 'signedAt')} of 3 signed.`, 'NUT-20 signature over the batch'];
      case 'taking': return [`${who} asks the mint for their own ${each} back.`, `NUT-20 signed, minted to ${who}’s own outputs`];
      case 'back': return [`${who} takes their ${each} back. Nothing owed, nothing lost.`, 'NUT-04 + NUT-20, own outputs'];
      case 'lost': return [`${who}’s take-back is turned down. The payout got there first.`, 'quote already issued in the batch'];
      case 'stopped': return [`${org} stops collecting. No payout this time.`, 'nobody’s sats moved · each pleb takes their own back'];
      case 'closed': return [`The stack closed with ${counted(snap, event.at, 'inAt')} of 3 in. No payout this time.`,
        `closed ${formatWhen(event.at)} · nobody’s sats moved`];
      case 'sent': return ['All three signed. One batch goes to the mint.', 'NUT-29 batch mint · waiting for the mint'];
      case 'rejected': return ['The mint turned the batch down. Nothing was paid.', 'NUT-29 batch rejected'];
      case 'paid': return [`The mint pays ${her} in one batch. Paid only when the mint says so.`,
        `NUT-29 batch mint, locked to ${her}’s key (NUT-11)`];
      case 'received': return [`${her}’s phone checks the payout and saves it: ${sats(snap.total)}, locked to her key.`,
        'NUT-11 P2PK, every proof locked to her key'];
      case 'spending': return [`${her} swaps it at the mint.`, 'NUT-03 swap · waiting for the mint'];
      case 'spent': return [`${her} spends it. ${sats(snap.feeSat ?? 0)} swap fee, ${sats(snap.receivedSat ?? 0)} received.`, 'NUT-03 swap'];
      case 'swap-rejected': return [`The mint turned down ${her}’s swap. Her ${sats(snap.total)} are still locked to her key.`, 'NUT-03 swap rejected'];
    }
  })();
  return { ...event, text: words[0], term: words[1] };
}

export interface Look {
  phase: GoalPhase | 'draft';
  label: string;
  note?: string;
  // Lime: the goal line and the pile, only once the mint confirmed the payout.
  lit: boolean;
}

// The stack as the stage shows it. A slab still travelling in isn't counted yet, and the stack only reads
// Paid once the stage has told the mint's answer, so the words always come before the lime.
export function lookOf(record: CampaignRecord | undefined, { travelling = 0, paidTold = true } = {}): Look {
  if (!record) return { phase: 'draft', label: 'goal · not open yet', lit: false };
  const goal = campaignGoal(record);
  const { heldSat, targetSat } = tally(record);
  const signed = signedCount(record);
  if (travelling > 0 && (goal.phase === 'collecting' || goal.phase === 'at-line')) {
    return { phase: 'collecting', label: `goal · ${heldSat - travelling * record.campaign.contributionSat} of ${sats(targetSat)}`, lit: false };
  }
  const sending: Look = { phase: 'sending', label: 'sending · waiting for the mint', note: 'signed 3 of 3 · one batch', lit: false };
  switch (goal.phase) {
    case 'paid': return paidTold ? { phase: 'paid', label: goal.label, lit: true } : sending;
    case 'sending': return sending;
    case 'at-line': return { phase: 'at-line', label: goal.label, note: `signed ${signed} of 3`, lit: false };
    case 'unmet': return { phase: 'unmet', label: `${goal.label} · no payout`, lit: false };
    default: return { phase: goal.phase, label: goal.label, lit: false };
  }
}

// Where a pleb's sats are, said about them rather than to them.
export function pocketLabel(stop: Stop, who: string, maintainer: string): string {
  switch (stop) {
    case 'wallet': return `in ${who}’s wallet`;
    case 'to-mint': return 'on the way to the mint';
    case 'at-mint': return `at the mint, locked to ${who}`;
    case 'signed': return `at the mint, signed for ${maintainer}`;
    case 'to-maintainer': return `on the way to ${maintainer}`;
    case 'with-maintainer': return `with ${maintainer}, locked to her key`;
    case 'to-you': return `on the way back to ${who}`;
    case 'back': return `back with ${who}`;
  }
}
