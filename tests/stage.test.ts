import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findCampaign } from '../src/demo/world';
import { createLiveActions, type LiveActions } from '../src/live/actions';
import { createActors } from '../src/live/actors';
import { memoryStorage } from '../src/protocol/storage';
import { setTimeZone } from '../src/ui/format';
import { Pile } from '../src/ui/Pile';
import {
  captionOf, lookOf, snapOf, stageEvents, storyOf, type Caption, type StageEvent, type StageKind, type StageSnap,
} from '../src/ui/story';
import { mockMint } from './mock-mint';
import { WORK, openStack } from './stack';

const banned = /preimage|block height|locktime|refund|revok|\btokens?\b|self-custod(ial|y)|non-custodial/i;
const PLEBS = ['tobi', 'maren', 'ishaan'];

setTimeZone('UTC');

// A stage watching one stack: every look at the board is diffed against the last one, as the screen does.
function watch(actions: LiveActions, id: string) {
  const record = () => findCampaign(actions.world('ada'), id);
  const snap = (): StageSnap => snapOf(actions.draft(id), record(), actions.wallet('ngozi', id));
  let last = snap();
  const told: Caption[] = [];
  return {
    record,
    told,
    look(): StageEvent[] {
      const next = snap();
      const events = stageEvents(last, next);
      told.push(...events.map(event => captionOf(event, next)));
      last = next;
      return events;
    },
    snap,
  };
}

function setup() {
  const mint = mockMint();
  const actions = createLiveActions(createActors({ storage: memoryStorage(), fetch: mint.fetchFor('browser') }));
  return { mint, actions };
}

const kinds = (events: StageEvent[]) => events.map(event => `${event.kind}${event.who ? `:${event.who}` : ''}`);
const pile = (record: ReturnType<ReturnType<typeof watch>['record']>, paidTold = true) =>
  renderToStaticMarkup(createElement(Pile, { record, look: lookOf(record, { paidTold }), away: new Set<string>() }));

test('the stage tells each change on the board once, in the order it happened, in plain words with the real term', async () => {
  const { actions } = setup();
  const id = actions.startStack('ada', WORK);
  const stage = watch(actions, id);
  actions.claimKey('ngozi', id);
  assert.deepEqual(kinds(stage.look()), ['key']);
  actions.createCampaign('ada', id, { closesAt: new Date(Date.now() + 48 * 3600_000).toISOString(), contributionSat: 21 });
  assert.deepEqual(kinds(stage.look()), ['opened']);

  for (const [index, person] of PLEBS.entries()) {
    const quote = await actions.join(person, id);
    assert.deepEqual(kinds(stage.look()), [`joined:${person}`], 'chipping in is not landing');
    await actions.waitForDeposit(person, id, quote.id, {});
    const [landed] = stage.look();
    assert.equal(landed.kind, 'landed');
    const caption = captionOf(landed, stage.snap());
    if (index < 2) {
      assert.equal(caption.text, `${person[0].toUpperCase()}${person.slice(1)}’s 21 sats land. ${index + 1} of 3 in.`);
      assert.equal(caption.term, 'NUT-20 locked quote at testnut.cashudevkit.org');
    } else {
      assert.equal(caption.text, 'Ishaan’s 21 sats land. All three are in.');
      assert.equal(caption.term, '3 locked quotes at testnut.cashudevkit.org');
    }
    assert.equal(stage.look().length, 0, 'looking again tells nothing new');
  }

  await actions.sign('tobi', id);
  const [signed] = stage.look();
  assert.deepEqual(captionOf(signed, stage.snap()), { ...signed, text: 'Tobi signs the group card. 1 of 3 signed.', term: 'NUT-20 signature over the batch' });
  await actions.sign('maren', id);
  await actions.sign('ishaan', id);
  assert.deepEqual(kinds(stage.look()), ['signed:maren', 'signed:ishaan']);

  const sending = actions.payout('ishaan', id);
  assert.deepEqual(kinds(stage.look()), ['sent']);
  await sending;
  const [paid] = stage.look();
  assert.equal(paid.kind, 'paid');
  assert.deepEqual(captionOf(paid, stage.snap()), {
    ...paid, text: 'The mint pays Ngozi in one batch. Paid only when the mint says so.', term: 'NUT-29 batch mint, locked to Ngozi’s key (NUT-11)',
  });

  actions.receive('ngozi', id);
  assert.deepEqual(kinds(stage.look()), ['received']);
  await actions.spend('ngozi', id);
  const [spent] = stage.look();
  assert.deepEqual(captionOf(spent, stage.snap()), { ...spent, text: 'Ngozi spends it. 1 sat swap fee, 62 sats received.', term: 'NUT-03 swap' });

  // Opening the stage late rebuilds the same story from the board, oldest first.
  const story = storyOf(stage.snap());
  assert.deepEqual(kinds(story), ['drafted', ...kinds(stage.told)]);
  assert.deepEqual(story.map(event => event.at), [...story.map(event => event.at)].sort());
});

test('a take-back is told as it goes and when it lands, and the stack stays dashed', async () => {
  const { actions } = setup();
  const id = openStack(actions);
  const stage = watch(actions, id);
  for (const person of ['tobi', 'maren']) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  stage.look();
  await actions.reclaim('maren', id);
  const events = stage.look();
  assert.deepEqual(kinds(events), ['taking:maren', 'back:maren']);
  assert.equal(captionOf(events[1], stage.snap()).text, 'Maren takes their 21 sats back. Nothing owed, nothing lost.');
  const look = lookOf(stage.record());
  assert.equal(look.phase, 'unmet');
  assert.equal(look.lit, false);
  assert.match(pile(stage.record()), /stroke-dasharray/);
});

test('when the take-back lands first, the batch is turned down and nothing is paid', async () => {
  const { actions } = setup();
  const id = openStack(actions);
  const stage = watch(actions, id);
  for (const person of PLEBS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  for (const person of PLEBS) await actions.sign(person, id);
  stage.look();
  await actions.reclaim('tobi', id);
  await actions.payout('maren', id).catch(() => {});
  const told = kinds(stage.look());
  assert.ok(told.includes('back:tobi') && told.includes('sent') && told.includes('rejected'), told.join());
  assert.ok(!told.includes('paid'));
  assert.equal(lookOf(stage.record()).lit, false);
});

test('no lime anywhere on the stage until the mint confirms, and then only once the stage has said so', async () => {
  const { actions } = setup();
  const id = actions.startStack('ada', WORK);
  const stage = watch(actions, id);
  const unlit = (where: string) => {
    const record = stage.record();
    assert.equal(lookOf(record).lit, false, where);
    const html = pile(record);
    assert.doesNotMatch(html, /--color-signal|data-paid/, where);
  };
  unlit('draft');
  actions.claimKey('ngozi', id);
  actions.createCampaign('ada', id, { closesAt: new Date(Date.now() + 48 * 3600_000).toISOString(), contributionSat: 21 });
  unlit('open');
  for (const person of PLEBS) {
    const quote = await actions.join(person, id);
    unlit(`${person} invoice`);
    await actions.waitForDeposit(person, id, quote.id, {});
    unlit(`${person} in`);
  }
  for (const person of PLEBS) {
    await actions.sign(person, id);
    unlit(`${person} signed`);
  }
  const sending = actions.payout('ishaan', id);
  unlit('sending');
  assert.equal(lookOf(stage.record()).phase, 'sending');
  await sending;

  const paid = stage.record()!;
  assert.deepEqual(lookOf(paid, { paidTold: false }), lookOf(stage.record(), { paidTold: false }));
  assert.equal(lookOf(paid, { paidTold: false }).lit, false, 'confirmed but not yet told: still Sending');
  assert.doesNotMatch(pile(paid, false), /--color-signal|data-paid/);
  assert.equal(lookOf(paid).lit, true);
  assert.equal(lookOf(paid).label, 'goal reached · 63 sats paid');
  assert.match(pile(paid), /--color-signal/);
  assert.match(pile(paid), /data-paid/);
});

test('a slab still travelling in is not counted yet', async () => {
  const { actions } = setup();
  const id = openStack(actions);
  const quote = await actions.join('tobi', id);
  await actions.waitForDeposit('tobi', id, quote.id, {});
  const record = findCampaign(actions.world('ada'), id);
  assert.equal(lookOf(record).label, 'goal · 21 of 63 sats');
  assert.equal(lookOf(record, { travelling: 1 }).label, 'goal · 0 of 63 sats');
});

test('every caption the stage can say avoids the never-say words', async () => {
  const { actions } = setup();
  const id = openStack(actions);
  const stage = watch(actions, id);
  for (const person of PLEBS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  for (const person of PLEBS) await actions.sign(person, id);
  await actions.payout('tobi', id);
  stage.look();
  const snap = stage.snap();
  const every: StageKind[] = [
    'drafted', 'key', 'opened', 'joined', 'landed', 'signed', 'taking', 'back', 'lost', 'stopped', 'closed', 'sent', 'rejected', 'paid',
    'received', 'spending', 'spent', 'swap-rejected',
  ];
  const texts = every.flatMap(kind => {
    const caption = captionOf({ kind, at: snap.paidAt!, who: 'maren' }, { ...snap, feeSat: 1, receivedSat: 62 });
    return [caption.text, caption.term];
  });
  texts.push(...stage.told.flatMap(caption => [caption.text, caption.term]));
  texts.push(...['draft', 'pasted'].flatMap(kind => {
    const caption = captionOf({ kind: 'key', at: snap.paidAt! }, { ...snap, keyBy: kind === 'pasted' ? 'pasted' : 'maintainer' });
    return [caption.text, caption.term];
  }));
  for (const text of texts) {
    assert.doesNotMatch(text, banned, text);
    assert.ok(text.length > 0);
  }
  assert.ok(!texts.some(text => /undefined|NaN/.test(text)), texts.find(text => /undefined|NaN/.test(text)));
});
