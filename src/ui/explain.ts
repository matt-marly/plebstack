import {
  DEPOSIT_SAT, isHeld, maintainerOf, people, sats, slotOf, slotStatus, statusOf, tally, type CampaignRecord, type ViewerStep,
} from '../demo/world';
import { TEST_MINT } from '../domain/models';
import type { ToneState } from '../domain/states';
import { formatWhen, listNames } from './format';
import { signedCount, type MaintainerStage, type OrganizerStage, type Screen } from './journey';

// Everything the "What's really happening" sheet says, from the record as it is now. A sentence in here
// only claims what the state already makes true: nothing is at the mint before the mint says so, and
// nothing is paid before the mint confirms the batch.

export type Role = 'organizer' | 'pleb' | 'maintainer';

export interface Fact {
  icon: string;
  text: string;
  term: string;
}

export interface Said {
  lead: string;
  text: string;
}

export interface NextStep {
  text: string;
  term?: string;
}

export interface MapSlab {
  // 0 the left node, 1 the mint, 2 the maintainer; halves are on their way between.
  at: number;
  tone: 'open' | 'ink' | 'own' | 'signed' | 'lit' | 'outline';
  name?: string;
  own?: boolean;
}

export interface MapNode {
  name: string;
  note: string;
}

export interface SatsMapProps {
  head: string;
  meta?: string;
  nodes: [MapNode, MapNode, MapNode];
  slabs: MapSlab[];
  // Lime only once the mint confirmed the payout and it still waits, locked to her key.
  paid: boolean;
}

export interface ReallyContext {
  role: Role;
  status: { state: ToneState; phrase?: string };
  now: Said & { term: string; map?: SatsMapProps };
  next: { steps: NextStep[]; current?: number; aside?: Said & { icon: 'undo' | 'info' } };
  story: Fact[];
}

export type Seen =
  | { role: 'organizer'; at: OrganizerStage; record?: CampaignRecord; maintainer: string; keyBy?: 'maintainer' | 'pasted' }
  | { role: 'pleb'; at: Screen; step: ViewerStep; record: CampaignRecord; viewerId: string }
  | {
    role: 'maintainer'; at: MaintainerStage; record?: CampaignRecord; organizer: string; keyBy?: 'maintainer' | 'pasted';
    spend?: { grossSat: number; receivedSat?: number };
  };

const T_QUOTE = `NUT-20 locked mint quote · ${new URL(TEST_MINT).host.split('.')[0]}`;
const T_SIG = 'NUT-20 signature over the batch';
const T_BATCH = 'NUT-29 batch mint · NUT-11 P2PK';
const T_WAIT = 'NUT-29 batch mint · waiting for the mint';
const T_BACK = 'NUT-20 signed, minted to your own outputs';
const T_SWAP = 'NUT-03 swap, signed with your key';
const leaving = {
  lead: 'A pleb is taking theirs back.', text: 'If every signature is already out, the payout may still get there first. The mint decides.',
  term: 'NUT-20 signed, minted to their own outputs',
};
const NEW_STACK: NextStep = { text: 'Nothing more to do here. Start a new stack whenever you like.' };

const counted = ['', 'One more pleb chips', 'Two more plebs chip', 'Three plebs chip'];
const chipStep = (missing: number, each: string): NextStep =>
  ({ text: `${counted[missing]} in ${each}${missing > 1 ? ' each' : ''}.`, term: T_QUOTE });

interface Terms {
  each: string;
  total: string;
  eachSat: number;
  held: number;
  heldSat: number;
  signed: number;
  closes?: string;
}

function termsOf(record?: CampaignRecord): Terms {
  const eachSat = record?.campaign.contributionSat ?? DEPOSIT_SAT;
  const count = record?.campaign.backerCount ?? 3;
  const held = record ? tally(record).held : 0;
  return {
    each: sats(eachSat), total: sats(eachSat * count), eachSat, held, heldSat: held * eachSat,
    signed: record ? signedCount(record) : 0, closes: record?.closesAt && record.close !== 'lifted' ? formatWhen(record.closesAt) : undefined,
  };
}

const ifNotFull = (t: Terms, who: string): Said & { icon: 'undo' } => ({
  icon: 'undo', lead: t.closes ? `Not full by ${t.closes}?` : 'Not full by the close?', text: `Nobody is paid, and ${who}.`,
});

// ---------------------------------------------------------------- the map

// One slab per slot, where its sats really are. Paid sits with the maintainer only once the mint confirmed.
export function mapOf(record: CampaignRecord, viewerId: string, role: Role, { spent = false } = {}): SatsMapProps {
  const t = termsOf(record);
  const her = maintainerOf(record).short;
  const paid = statusOf(record) === 'paid' && record.operations.some(op => op.kind === 'payout' && op.status === 'confirmed');
  const open = record.slots.filter(slot => slotStatus(slot) === 'open').length;
  let named = false;
  const slabs = record.slots.map((slot): MapSlab => {
    const own = slot.backerId === viewerId;
    const name = slot.backerId ? (own ? 'You' : people[slot.backerId].short) : undefined;
    const tone = own ? 'own' : 'ink';
    switch (slotStatus(slot)) {
      // Open spots are nobody's, so the pile carries one label for all of them.
      case 'open': {
        const name = named ? undefined : open === 1 ? 'open spot' : `${open} open spots`;
        named = true;
        return { at: 0, tone: 'open', name };
      }
      case 'awaiting': return { at: 0.5, tone: 'open', name, own };
      case 'deposited': return { at: 1, tone, name, own };
      case 'approved': return { at: 1, tone: 'signed', name, own };
      case 'paying out': return { at: 1.5, tone, name, own };
      case 'paid': return { at: 2, tone: paid && !spent ? 'lit' : tone, name, own };
      case 'reclaiming': return { at: 0.5, tone, name, own };
      case 'reclaimed': return { at: 0, tone: 'outline', name, own };
    }
  });
  const out = record.slots.filter(slot => !isHeld(slot) && slotStatus(slot) !== 'reclaimed').length;
  const atMint = slabs.some(slab => slab.at === 1);
  const pleb = role === 'pleb';
  const mine = pleb ? slotOf(record, viewerId) : undefined;
  const left: MapNode = pleb
    ? { name: 'You', note: mine?.deposit?.state === 'reclaimed' ? 'your ecash' : 'your wallet' }
    : { name: 'Plebs', note: out ? `${out} not in yet` : 'all in' };
  const right: MapNode = role === 'maintainer'
    ? { name: 'You', note: spent ? 'your ecash' : paid ? 'locked to your key' : `gets ${t.total} or none` }
    : { name: her, note: paid ? 'locked to her key' : `gets ${t.total} or none` };
  const head = paid ? `goal reached · ${t.total} paid` : `goal · ${t.heldSat} of ${t.total}`;
  return {
    head, meta: paid ? undefined : t.closes && `closes ${t.closes}`,
    nodes: [left, { name: 'Mint', note: atMint ? 'each locked to its pleb' : 'testnut' }, right],
    slabs, paid: paid && !spent,
  };
}

// ---------------------------------------------------------------- the whole story

const testMint = (what: string): Fact => ({
  icon: 'info', text: `This is a test mint. It marks its own invoices paid, so ${what} are fake sats.`, term: 'testnut.cashudevkit.org',
});

type PlebWhere = 'wallet' | 'invoice' | 'mint' | 'returning' | 'back' | 'paid';

export function plebFacts(her: string, each: string, total: string, where: PlebWhere = 'mint'): Fact[] {
  const said = {
    wallet: `When you chip in, your sats wait at the mint, locked to your key. Only your key can say where they go.`,
    invoice: `Once the mint says your invoice is paid, your sats wait there, locked to your key. Only your key can say where they go.`,
    mint: 'Your sats are at the mint, locked to your key. Only your key can say where they go.',
    returning: 'You asked the mint for your own sats back, to outputs only your key could ask for.',
    back: 'Your sats came back to you from the mint, as ecash in this browser.',
    paid: `Your sats went to ${her} in one batch, locked to her key.`,
  }[where];
  return [
    { icon: 'mint', text: said, term: 'NUT-20 locked mint quote' },
    where === 'wallet'
      ? { icon: 'key', text: 'Chipping in makes a key in this browser. Only the public half leaves.', term: 'secp256k1 key · this browser' }
      : { icon: 'key', text: 'You made a key in this browser. Only the public half leaves.', term: 'secp256k1 key · this browser' },
    { icon: 'pleb', text: 'The organizer never holds your sats or your key.', term: 'terms saved in this browser' },
    { icon: 'nib', text: 'Signing is a signature over this exact batch. It sends nothing by itself.', term: 'NUT-20 signature over the batch' },
    { icon: 'maintainer', text: `The payout goes out locked to ${her}’s key. Only that key can spend it.`, term: 'NUT-11 P2PK' },
    { icon: 'swap', text: `All three deposits go in one batch: ${total} to ${her}, or none of it. Paid shows only once the mint confirms.`, term: 'NUT-29 batch mint' },
    testMint(`your ${each}`),
  ];
}

export function organizerFacts(her: string, each: string): Fact[] {
  return [
    { icon: 'pleb', text: 'You never hold anyone’s sats or any key. What you set goes on the public board.', term: 'no key in the organizer’s storage' },
    { icon: 'key', text: `The payout can only be locked to the key ${her} confirms on her own device, or one you paste.`, term: 'compressed secp256k1 public key' },
    { icon: 'mint', text: 'When a pleb chips in, their sats wait at the mint, locked to their own key.', term: 'NUT-20 locked mint quote' },
    { icon: 'swap', text: `The last signature sends one batch to the mint, locked to ${her}’s key. Paid shows only once the mint confirms.`,
      term: 'NUT-29 batch mint · NUT-11 P2PK' },
    { icon: 'info', text: 'The close is a rule in this app. It stops collecting; it never moves anyone’s sats.', term: 'app rule, not a lock at the mint' },
    testMint(`the ${each}`),
  ];
}

export interface MaintainerFacts {
  total: string;
  org: string;
  // Her key was made in this browser, rather than pasted or not made yet.
  keyHere: boolean;
  pasted: boolean;
  paid: boolean;
}

export function maintainerFacts({ total, org, keyHere, pasted, paid }: MaintainerFacts): Fact[] {
  const whose = pasted ? 'that key' : 'your key';
  return [
    keyHere
      ? { icon: 'key', text: 'Your key was made in this browser. Only its public half was shared.', term: 'secp256k1 key · this browser' }
      : pasted
        ? { icon: 'key', text: `${org} pasted the payout key. It wasn’t made in this browser.`, term: 'compressed secp256k1 public key · pasted' }
        : { icon: 'key', text: 'Confirming makes your key in this browser. Only its public half is shared.', term: 'secp256k1 key · this browser' },
    { icon: 'maintainer', text: pasted ? `The payout is locked to the key ${org} pasted. Only that key can spend it.`
      : 'The payout is locked to your key. Only your key can spend it.', term: 'NUT-11 P2PK' },
    paid
      ? { icon: 'swap', text: `The locked ecash reached you over the shared board. That’s safe: it only works with ${whose}.`, term: 'P2PK-locked proofs' }
      : { icon: 'swap', text: `Once it’s paid, the locked ecash reaches you over the shared board. That’s safe: it only works with ${whose}.`, term: 'P2PK-locked proofs' },
    paid
      ? { icon: 'nib', text: `All three plebs paid ${total} in one batch, or none of it would have come.`, term: 'NUT-29 batch mint' }
      : { icon: 'nib', text: `All three plebs’ deposits go in one batch: ${total} for you, or none of it.`, term: 'NUT-29 batch mint' },
    { icon: 'mint', text: 'Spending swaps the payout at the mint for ecash only you hold. The mint keeps its swap fee.', term: 'NUT-03 swap, signed with your key' },
    testMint(`the ${total}`),
  ];
}

// ---------------------------------------------------------------- per role

export function reallyContext(seen: Seen): ReallyContext {
  switch (seen.role) {
    case 'organizer': return organizer(seen);
    case 'pleb': return pleb(seen);
    case 'maintainer': return maintainer(seen);
  }
}

function organizer({ at, record, maintainer: her, keyBy }: Extract<Seen, { role: 'organizer' }>): ReallyContext {
  const t = termsOf(record);
  const story = organizerFacts(her, t.each);
  const base = { role: 'organizer' as const, story };
  const confirms: NextStep = { text: `${her} confirms her payout key on her own phone.`, term: 'secp256k1 public key · her phone' };
  const opens: NextStep = { text: 'You set the terms and open the stack.' };
  if (!record) {
    const pasted = at === 'pasted' || keyBy === 'pasted';
    const steps = at === 'who' ? [{ text: 'Name who you’re backing and the work.' }, confirms, opens]
      : at === 'key' ? [confirms, opens, { text: `Three plebs chip in ${t.each} each. ${her} is paid only if all three sign.` }]
        : [opens, chipStep(3, t.each), { text: `All three sign, and one batch pays ${her}, locked to her key.`, term: T_BATCH }];
    return {
      ...base, status: { state: 'open' },
      now: { lead: 'Nothing is at the mint yet.', text: pasted
        ? `The key you pasted wasn’t confirmed on ${her}’s phone. You never hold a key or anyone’s sats.`
        : 'You set the terms. You never hold a key or anyone’s sats.', term: 'no key in the organizer’s storage' },
      next: { steps, current: 0, aside: at === 'who' || at === 'key' ? undefined : ifNotFull(t, 'each pleb takes their own back') },
    };
  }
  const state = statusOf(record);
  const map = mapOf(record, '', 'organizer');
  const sign: NextStep = { text: 'All three check the payout and sign.', term: T_SIG };
  const send: NextStep = { text: `The last signature sends one batch: ${t.total} to ${her}, locked to her key. Paid shows only once the mint confirms.`, term: T_BATCH };
  switch (state) {
    case 'paid': {
      const payout = record.operations.find(op => op.kind === 'payout' && op.status === 'confirmed');
      return {
        ...base, status: { state: 'paid', phrase: 'Confirmed by the mint' },
        now: { lead: `${her} got ${t.total}, locked to her key.`, text: `Confirmed by the mint${payout?.settledAt ? ` at ${formatWhen(payout.settledAt)}` : ''}.`, term: T_BATCH, map },
        next: { steps: [{ text: `${her} spends it: her key signs a swap at the mint.`, term: 'NUT-03 swap' }, NEW_STACK] },
      };
    }
    case 'paying out': return {
      ...base, status: { state: 'paying out', phrase: 'Waiting for the mint' },
      now: { lead: 'The batch is with the mint.', text: 'Nothing is paid until the mint confirms.', term: T_WAIT, map },
      next: { steps: [{ text: `The mint confirms: ${t.total} to ${her}, locked to her key.`, term: T_BATCH }], current: 0 },
    };
    case 'unmet': case 'reclaimed': return {
      ...base, status: { state: 'unmet' },
      now: { lead: 'No payout this time.', text: stillAtMint(record, t), term: 'app rule, not a lock at the mint', map },
      next: stillHeld(record) ? {
        steps: [{ text: `Each pleb takes their own ${t.each} back. Nobody needs to approve it.`, term: 'NUT-20 signed, minted to each pleb’s own outputs' },
          NEW_STACK],
        current: 0,
      } : { steps: [NEW_STACK] },
    };
    case 'reclaiming': return {
      ...base, status: { state: 'reclaiming' },
      now: { ...leaving, map },
      next: { steps: [{ text: 'The mint answers the take-back.' }], current: 0 },
    };
    default:
      if (t.held < 3) {
        return {
          ...base, status: { state: 'collecting', phrase: `${t.held} of 3 in` },
          now: t.held
            ? { lead: `${t.heldSat} of ${t.total} are at the mint,`, text: `each ${t.eachSat} locked to the pleb who paid it. You hold none of it.`, term: T_QUOTE, map }
            : { lead: 'The stack is open.', text: 'Nothing is at the mint yet. You never hold anyone’s sats.', term: T_QUOTE, map },
          next: { steps: [chipStep(3 - t.held, t.each), sign, send], current: 0, aside: ifNotFull(t, `each pleb takes their own ${t.each} back`) },
        };
      }
      return {
        ...base, status: { state: t.signed === 3 ? 'approved' : 'ready', phrase: `Signed ${t.signed} of 3` },
        now: { lead: `All ${t.total} are at the mint,`, text: `each locked to its pleb. Signed ${t.signed} of 3. A signature sends nothing by itself.`, term: T_SIG, map },
        next: { steps: [sign, send], current: 0,
          aside: { icon: 'undo', lead: 'Someone takes theirs back before the last signature?', text: 'Nobody is paid, and each pleb takes their own back.' } },
      };
  }
}

const stillHeld = (record: CampaignRecord) => record.slots.filter(slot => ['deposited', 'approved'].includes(slotStatus(slot))).length;

function stillAtMint(record: CampaignRecord, t: Terms): string {
  const left = stillHeld(record);
  if (!left) return 'Nothing is at the mint. Nobody was paid.';
  return `${sats(left * record.campaign.contributionSat)} ${left === 1 ? 'is' : 'are'} still at the mint, each ${t.each} locked to the pleb who paid it. Nobody was paid.`;
}

function pleb({ at, step, record, viewerId }: Extract<Seen, { role: 'pleb' }>): ReallyContext {
  const t = termsOf(record);
  const her = maintainerOf(record).short;
  const { each, total } = t;
  const map = mapOf(record, viewerId, 'pleb');
  const facts = (where: PlebWhere) => plebFacts(her, each, total, where);
  const base = { role: 'pleb' as const };
  const takeBack: NextStep = { text: `Take your own ${each} back. Nobody needs to approve it.`, term: T_BACK };
  const send: NextStep = { text: `The last signature sends ${total} to ${her} in one batch, locked to her key. Paid shows only once the mint confirms.`, term: T_BATCH };
  const mind = (lead: string): Said & { icon: 'undo' } => ({ icon: 'undo', lead, text: `Take your own ${each} back. Nobody needs to approve it.` });
  const atMint = { lead: `Your ${each} are at the mint, locked to your key.`, term: T_QUOTE, map };
  const allIn = { lead: `All ${total} are at the mint.`, text: `Signed ${t.signed} of 3. A signature sends nothing by itself.`, term: T_SIG, map };
  switch (at) {
    case 'join':
      if (step.kind === 'join') {
        return {
          ...base, status: { state: 'collecting', phrase: `${t.held} of 3 in` }, story: facts('wallet'),
          now: { lead: `Your ${each} are still in your wallet.`, text: 'Nothing is locked yet.', term: 'no quote yet', map },
          next: {
            steps: [
              { text: 'Chip in: the mint makes an invoice locked to a key made in this browser.', term: 'NUT-20 locked mint quote' },
              { text: 'Pay it. You’re stacked once the mint says it’s paid.' },
              { text: `When all three are in, everyone signs and one batch pays ${her}.`, term: T_BATCH },
            ], current: 0, aside: ifNotFull(t, 'you take your own back'),
          },
        };
      }
      return {
        ...base, status: { state: statusOf(record) }, story: facts('wallet'),
        now: { lead: 'You didn’t chip in to this stack.', text: `Your ${each} are still in your wallet. None of what’s at the mint is yours.`, term: 'no quote of yours', map },
        next: { steps: [NEW_STACK] },
      };
    case 'pay': return {
      ...base, status: { state: 'awaiting' }, story: facts('invoice'),
      now: { lead: 'Waiting for your invoice.', text: 'You’re stacked only when the mint says it’s paid.', term: T_QUOTE, map },
      next: {
        steps: [{ text: `Pay the invoice. The mint holds your ${each}, locked to your key.`, term: T_QUOTE },
          { text: 'Everyone checks the payout and signs.', term: T_SIG }, send],
        current: 0, aside: { icon: 'undo', lead: 'Changed your mind?', text: 'Leave the invoice unpaid. Nothing moves until you pay it.' },
      },
    };
    case 'stacked': case 'waiting': return {
      ...base, status: { state: 'deposited' }, story: facts('mint'),
      now: { ...atMint, text: `Only your key can say where they go. ${her} has nothing yet.` },
      next: {
        steps: [chipStep(3 - t.held, each),
          { text: 'Everyone checks the payout and signs. Your signature only works for that exact batch and sends nothing by itself.', term: T_SIG }, send],
        current: 0, aside: mind('Changed your mind, or it doesn’t fill?'),
      },
    };
    case 'sign':
      if (step.kind === 'stopped') {
        return {
          ...base, status: { state: 'deposited', phrase: 'Signing stopped' }, story: facts('mint'),
          now: { ...atMint, text: 'You stopped signing, so there will be no payout.' },
          next: { steps: [takeBack], current: 0 },
        };
      }
      return {
        ...base, status: { state: 'ready', phrase: `Signed ${t.signed} of 3` }, story: facts('mint'), now: allIn,
        next: {
          steps: [{ text: 'Check the payout and sign. Your signature only works for that exact batch.', term: T_SIG }, send],
          current: 0, aside: mind('Changed your mind?'),
        },
      };
    case 'signed': {
      const waitingOn = step.kind === 'approved' ? step.waitingOn : [];
      return {
        ...base, status: { state: 'approved', phrase: `Signed ${t.signed} of 3` }, story: facts('mint'), now: allIn,
        next: {
          steps: waitingOn.length ? [{ text: `${listNames(waitingOn)} ${waitingOn.length > 1 ? 'sign' : 'signs'}.`, term: T_SIG }, send]
            : [{ text: 'Send it: the batch goes to the mint.', term: T_WAIT }, { text: `The mint confirms: ${total} to ${her}, locked to her key.`, term: T_BATCH }],
          current: 0,
          aside: { icon: 'undo', lead: 'Someone takes theirs back first?', text: 'Then nobody is paid. If every signature is already out, the payout may still get there first.' },
        },
      };
    }
    case 'sending': return {
      ...base, status: { state: 'paying out', phrase: 'Waiting for the mint' }, story: facts('mint'),
      now: { lead: 'The batch is with the mint.', text: 'Not paid until the mint confirms.', term: T_WAIT, map },
      next: { steps: [{ text: `The mint confirms: ${total} to ${her}, locked to her key.`, term: T_BATCH }], current: 0 },
    };
    case 'paid': case 'race': return {
      ...base, status: { state: 'paid', phrase: 'Confirmed by the mint' }, story: facts('paid'),
      now: { lead: `Your ${each} went to ${her} in one batch,`, text: at === 'race'
        ? 'confirmed by the mint. The payout got there before your take-back.' : 'confirmed by the mint.', term: T_BATCH, map },
      next: { steps: [{ text: `${her} spends it: her key signs a swap at the mint.`, term: 'NUT-03 swap' }, NEW_STACK] },
    };
    case 'unmet': return {
      ...base, status: { state: 'unmet' }, story: facts('mint'),
      now: { lead: 'No payout.', text: `Your ${each} are at the mint, locked to you, yours to take back.`, term: T_QUOTE, map },
      next: { steps: [takeBack, { text: 'They come back as ecash in this browser.' }], current: 0 },
    };
    case 'back':
      if (step.kind === 'reclaimed') {
        return {
          ...base, status: { state: 'reclaimed' }, story: facts('back'),
          now: { lead: `Your ${each} are back with you`, text: 'as ecash in this browser. Confirmed by the mint.', term: 'NUT-04 + NUT-20, own outputs', map },
          next: { steps: [NEW_STACK] },
        };
      }
      return {
        ...base, status: { state: 'reclaiming' }, story: facts('returning'),
        now: { lead: `Your ${each} are on their way back to you.`, text: 'Not back until the mint confirms.', term: T_BACK, map },
        next: { steps: [{ text: `The mint confirms, and your ${each} come back as ecash in this browser.` }], current: 0 },
      };
  }
}

function maintainer({ at, record, organizer: org, keyBy, spend }: Extract<Seen, { role: 'maintainer' }>): ReallyContext {
  const t = termsOf(record);
  const pasted = (record?.keyBy ?? keyBy) === 'pasted';
  const state = record && statusOf(record);
  const paid = state === 'paid';
  const keyHere = at !== 'claim' && at !== 'claim-pasted' && !pasted;
  const story = maintainerFacts({ total: t.total, org, keyHere, pasted, paid });
  const base = { role: 'maintainer' as const, story };
  const lockTo = pasted ? `the key ${org} pasted` : 'your key';
  const map = record && mapOf(record, '', 'maintainer', { spent: at === 'spent' });
  const pays: NextStep = { text: `If all three sign, one batch pays you ${t.total}, locked to ${lockTo}. Paid shows only once the mint confirms.`, term: T_BATCH };
  switch (at) {
    case 'claim': return {
      ...base, status: { state: 'open' },
      now: { lead: 'Nothing yet.', text: 'Confirm to make your key in this browser. Only its public half is shared.', term: 'secp256k1 key · this browser' },
      next: { steps: [{ text: `Confirm your key. Only its public half goes to ${org}.` }, { text: `${org} sets the terms and opens the stack.` }, pays], current: 0 },
    };
    case 'claim-pasted': return {
      ...base, status: { state: 'open', phrase: 'with a pasted key' },
      now: { lead: `${org} opened it with a key she pasted.`, text: 'No key was made in this browser. If that key isn’t yours, tell her before anyone chips in.',
        term: 'compressed secp256k1 public key · pasted' },
      next: { steps: [{ text: `Tell ${org} if that key isn’t yours.` }, { text: 'Follow the stack as it fills.' }], current: 0 },
    };
    case 'receive': return pasted ? {
      ...base, status: { state: 'paid', phrase: 'Confirmed by the mint' },
      now: { lead: `${t.total} were paid, locked to the key ${org} pasted.`, text: 'This browser has no key for it, so it can’t be spent here.', term: T_BATCH, map },
      next: { steps: [{ text: 'Whoever holds that key can spend it.', term: 'NUT-03 swap' }] },
    } : {
      ...base, status: { state: 'paid', phrase: 'Confirmed by the mint' },
      now: { lead: `${t.total} reached you, locked to your key.`, text: `The mint confirmed the batch${confirmedAt(record)}. Only your key can spend it.`, term: T_BATCH, map },
      next: {
        steps: [{ text: 'Tap Spend. Your key signs a swap at the mint.', term: T_SWAP },
          { text: 'The mint keeps its swap fee. The rest is ecash only you hold.' }, { text: 'Copy it into any Cashu wallet.' }],
        current: 0, aside: { icon: 'info', lead: 'Test mint:', text: 'it marks its own invoices paid, so these are fake sats.' },
      },
    };
    case 'swapping': return {
      ...base, status: { state: 'swapping' },
      now: { lead: 'Your swap is with the mint.', text: `Nothing is yours to copy until it answers. Until then your ${sats(spend?.grossSat ?? 0)} stay locked to your key.`,
        term: 'NUT-03 swap · waiting for the mint', map },
      next: { steps: [{ text: 'The mint answers the swap.' }, { text: 'Copy your ecash into any Cashu wallet.' }], current: 0 },
    };
    case 'turned-down': return {
      ...base, status: { state: 'not swapped' },
      now: { lead: 'The mint turned down the swap.', text: `Nothing was swapped. Your ${sats(spend?.grossSat ?? 0)} are still locked to your key.`, term: 'NUT-03 swap rejected', map },
      next: { steps: [{ text: 'Try the swap again. It asks for the same swap, never a new one.', term: T_SWAP }], current: 0 },
    };
    case 'spent': {
      const got = spend?.receivedSat ?? 0;
      return {
        ...base, status: { state: 'swapped' },
        now: { lead: `${sats(got)} of ecash only you hold.`, text: `The mint kept a ${sats((spend?.grossSat ?? got) - got)} swap fee.`, term: 'NUT-03 swap', map },
        next: { steps: [{ text: 'Copy it into any Cashu wallet.' }], current: 0 },
      };
    }
    case 'follow': break;
  }
  if (!record) {
    return {
      ...base, status: { state: 'open' },
      now: { lead: 'Nothing yet.', text: `${org} is setting the terms. The payout will be locked to ${lockTo}.`, term: 'secp256k1 key · this browser' },
      next: { steps: [{ text: `${org} sets the terms and opens the stack.` }, chipStep(3, t.each), pays], current: 0,
        aside: { icon: 'undo', lead: 'Doesn’t fill?', text: 'Nobody is paid, and each pleb takes their own back.' } },
    };
  }
  switch (state) {
    case 'paying out': return {
      ...base, status: { state: 'paying out', phrase: 'Waiting for the mint' },
      now: { lead: 'The batch is with the mint.', text: 'Nothing is yours until the mint confirms.', term: T_WAIT, map },
      next: { steps: [{ text: `The mint confirms: ${t.total} to you, locked to ${lockTo}.`, term: T_BATCH }], current: 0 },
    };
    case 'unmet': case 'reclaimed': return {
      ...base, status: { state: 'unmet' },
      now: { lead: 'No payout this time.', text: 'Nothing was paid to you. Each pleb takes their own back.', term: 'app rule, not a lock at the mint', map },
      next: { steps: [NEW_STACK] },
    };
    case 'reclaiming': return {
      ...base, status: { state: 'reclaiming' },
      now: { ...leaving, map },
      next: { steps: [{ text: 'The mint answers the take-back.' }], current: 0 },
    };
  }
  const sign: NextStep = { text: 'All three check the payout and sign.', term: T_SIG };
  if (t.held < 3) {
    return {
      ...base, status: { state: 'collecting', phrase: `${t.held} of 3 in` },
      now: t.held
        ? { lead: `${t.heldSat} of ${t.total} are at the mint,`, text: 'each locked to its pleb. None of it is yours yet.', term: T_QUOTE, map }
        : { lead: 'The stack is open.', text: 'Nothing is at the mint yet. None of it is yours yet.', term: T_QUOTE, map },
      next: { steps: [chipStep(3 - t.held, t.each), sign, pays], current: 0, aside: ifNotFull(t, 'each pleb takes their own back') },
    };
  }
  return {
    ...base, status: { state: t.signed === 3 ? 'approved' : 'ready', phrase: `Signed ${t.signed} of 3` },
    now: { lead: `All ${t.total} are at the mint,`, text: `each locked to its pleb. Signed ${t.signed} of 3. None of it is yours yet.`, term: T_SIG, map },
    next: { steps: [sign, pays], current: 0 },
  };
}

function confirmedAt(record?: CampaignRecord): string {
  const payout = record?.operations.find(op => op.kind === 'payout' && op.status === 'confirmed');
  return payout?.settledAt ? ` at ${formatWhen(payout.settledAt)}` : '';
}
