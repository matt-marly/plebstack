import assert from 'node:assert/strict';
import test from 'node:test';
import { findCampaign, slotOf, statusAt, statusOf, viewerStep, type World } from '../src/demo/world';
import { closeAfter, closeState } from '../src/domain/close';
import { createLiveActions } from '../src/live/actions';
import { createActors } from '../src/live/actors';
import { memoryStorage } from '../src/protocol/storage';
import { whyUnmet } from '../src/screens/Unmet';
import { journeyOf, closeLine } from '../src/ui/journey';
import { mockMint } from './mock-mint';
import { openStack } from './stack';

const OPENED = new Date('2026-11-24T16:40:00Z');
const CLOSES = '2026-11-26T17:00:00.000Z';
const HOUR = 3_600_000;

function setup() {
  const mint = mockMint();
  let clock = OPENED;
  const actions = createLiveActions(createActors({ storage: memoryStorage(), fetch: mint.fetchFor('browser') }), () => clock);
  const id = openStack(actions, { closesAt: CLOSES });
  const at = (iso: string | Date) => { clock = new Date(iso); };
  async function chipIn(person: string) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  return { mint, actions, id, at, chipIn };
}

const record = (world: World, id: string) => findCampaign(world, id)!;

test('the close rule: open before, closed after with fewer than three in, lifted once all three are in', () => {
  const close = Date.parse(CLOSES);
  assert.equal(closeState(CLOSES, false, new Date(close - 1)), 'open');
  assert.equal(closeState(CLOSES, false, new Date(close)), 'closed');
  assert.equal(closeState(CLOSES, true, new Date(close + 30 * 24 * HOUR)), 'lifted');
  assert.equal(closeState(undefined, false, new Date(close)), 'open');
  assert.equal(closeAfter(48, OPENED), '2026-11-26T17:00:00.000Z');
  assert.equal(closeAfter(24, new Date('2026-11-24T17:00:00Z')), '2026-11-25T17:00:00.000Z');
});

test('before the close a pleb joins as normal, and can take theirs back whenever they like', async () => {
  const { actions, id, at, chipIn } = setup();
  await chipIn('tobi');
  at(new Date(Date.parse(CLOSES) - 60_000));
  assert.equal(statusOf(record(actions.world('tobi'), id)), 'collecting');
  assert.equal(record(actions.world('tobi'), id).close, 'open');
  await chipIn('maren');
  assert.match(await actions.reclaim('maren', id), /^Back to you/);
  assert.equal(slotOf(record(actions.world('maren'), id), 'maren')!.deposit!.state, 'reclaimed');
});

test('at the close with 2 of 3 in, collecting stops, nobody new can join, and each pleb takes theirs back', async () => {
  const { actions, id, at, chipIn } = setup();
  await chipIn('tobi');
  await chipIn('maren');
  at(CLOSES);
  const world = actions.world('tobi');
  const closed = record(world, id);
  assert.equal(closed.close, 'closed');
  assert.equal(statusOf(closed), 'unmet');
  assert.equal(viewerStep(world, closed).kind, 'take-back');
  assert.equal(journeyOf(world, closed).screen, 'unmet');
  assert.match(whyUnmet(closed, 'tobi'), /^The stack closed at 26 Nov, \d\d:00 .+ with 2 of 3 in\.$/);
  await assert.rejects(actions.join('ishaan', id), /no open slot/);
  assert.match(await actions.reclaim('tobi', id), /^Back to you/);
  // The close moved nothing by itself: Maren's deposit sits at the mint until she takes it back.
  assert.equal(slotOf(record(actions.world('maren'), id), 'maren')!.deposit!.state, 'deposited');
});

test('after the close with 3 of 3 in, the stack stays at the line, signs and pays', async () => {
  const { actions, id, at, chipIn } = setup();
  for (const person of ['tobi', 'maren', 'ishaan']) await chipIn(person);
  at(new Date(Date.parse(CLOSES) + 6 * HOUR));
  assert.equal(record(actions.world('tobi'), id).close, 'lifted');
  assert.equal(statusOf(record(actions.world('tobi'), id)), 'ready');
  assert.equal(journeyOf(actions.world('tobi'), record(actions.world('tobi'), id)).screen, 'sign');
  for (const person of ['tobi', 'maren', 'ishaan']) await actions.sign(person, id);
  assert.equal(statusOf(record(actions.world('tobi'), id)), 'approved');
  assert.match(await actions.payout('ishaan', id), /^Stacked\. Paid\./);
  assert.equal(statusOf(record(actions.world('tobi'), id)), 'paid');
  assert.equal(closeLine(record(actions.world('tobi'), id)), 'all in · the close no longer applies');
});

test('statusAt is the same rule as a pure function of the record and the time', async () => {
  const { actions, id, chipIn } = setup();
  await chipIn('tobi');
  const open = record(actions.world('tobi'), id);
  assert.equal(statusAt(open, OPENED), 'collecting');
  assert.equal(statusAt(open, new Date(CLOSES)), 'unmet');
});

test('the close shows in the viewer’s own zone, from the time saved with the campaign', () => {
  const { actions, id } = setup();
  const open = record(actions.world('tobi'), id);
  assert.equal(open.closesAt, CLOSES);
  assert.equal(closeLine(open, 'Africa/Lagos'), 'closes 26 Nov, 18:00 WAT');
  assert.equal(closeLine(open, 'UTC'), 'closes 26 Nov, 17:00 UTC');
  assert.equal(closeLine(open, 'America/New_York'), 'closes 26 Nov, 12:00 EST');
});
