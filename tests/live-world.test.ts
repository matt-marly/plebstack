import assert from 'node:assert/strict';
import test from 'node:test';
import { findCampaign, slotOf, slotStatus, statusOf, type World } from '../src/demo/world';
import { ProtocolError } from '../src/protocol/client';
import { createRecordStore, memoryStorage } from '../src/protocol/storage';
import { createLiveActions } from '../src/live/actions';
import { createActors, namespaces } from '../src/live/actors';
import { mockMint } from './mock-mint';
import { openStack } from './stack';

const BACKERS = ['ishaan', 'tobi', 'maren'];

async function setup({ sign = true } = {}) {
  const mint = mockMint();
  const storage = memoryStorage();
  const actors = createActors({ storage, fetch: mint.fetchFor('browser') });
  const actions = createLiveActions(actors);
  const id = openStack(actions);
  const beneficiaryPubkey = actions.draft(id)!.key!.pubkey;
  for (const person of BACKERS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  if (sign) for (const person of BACKERS) await actions.sign(person, id);
  return { mint, storage, actors, actions, id, beneficiaryPubkey };
}

const record = (world: World, id: string) => findCampaign(world, id)!;
const states = (world: World, id: string) => record(world, id).slots.map(slotStatus);

test('each person keeps their own records; the coordinator and the board never hold a key', async () => {
  const { mint, storage, actors, actions, id } = await setup();
  await actions.payout('ngozi', id);

  const all = Array.from({ length: storage.length }, (_, i) => storage.key(i)!);
  const spaces = [...[...BACKERS, 'ngozi'].map(namespaces.person), namespaces.coordinator, namespaces.board];
  for (const key of all) assert.ok(spaces.some(space => key.startsWith(`plebstack:${space}/`)), key);

  const secrets = new Map<string, string[]>();
  for (const person of [...BACKERS, 'ngozi']) {
    const store = createRecordStore(storage, namespaces.person(person));
    secrets.set(person, store.keys('key:').map(key => store.read<{ secretKey: string }>(key)!.secretKey));
    assert.equal(secrets.get(person)!.length, 1, person);
  }
  const raw = (space: string) => all.filter(key => key.startsWith(`plebstack:${space}/`)).map(key => storage.getItem(key)).join('\n');
  const everySecret = [...secrets.values()].flat();
  for (const space of [namespaces.coordinator, namespaces.board]) {
    assert.ok(!all.some(key => key.startsWith(`plebstack:${space}/key:`) || key.startsWith(`plebstack:${space}/owner:`)), space);
    assert.ok(everySecret.every(secret => !raw(space).includes(secret)), space);
  }
  for (const person of [...BACKERS, 'ngozi']) {
    const others = everySecret.filter(secret => !secrets.get(person)!.includes(secret));
    assert.ok(others.every(secret => !raw(namespaces.person(person)).includes(secret)), person);
  }

  const ishaan = slotOf(record(actions.world('tobi'), id), 'ishaan')!.quote!;
  const before = mint.calls.length;
  assert.throws(() => actors.person('tobi').signerFor(ishaan.ownerPubkey), (error: ProtocolError) => error.kind === 'invalid-key');
  await assert.rejects(actors.person('tobi').reclaim(ishaan.id, 'op-foreign'), (error: ProtocolError) => error.kind === 'not-owner');
  assert.equal(mint.calls.filter((call, i) => i >= before && call.path === '/v1/mint/bolt11').length, 0);
});

test('each backer reviews the package on their own device before signing', async () => {
  const { mint, actions, id, beneficiaryPubkey } = await setup({ sign: false });
  const review = await actions.review('tobi', id);
  assert.equal(review.totalSat, 63);
  assert.equal(review.keysetId, mint.keysetId);
  assert.equal(review.lockedTo, beneficiaryPubkey);
  assert.equal(review.amounts.reduce((sum, amount) => sum + amount, 0), 63);
  assert.deepEqual(review.quoteStates, ['PAID', 'PAID', 'PAID']);
  assert.equal(statusOf(record(actions.world('tobi'), id)), 'ready');
});

test('three signatures and one batch read Paid only after the mint confirms, and survive a reload', async () => {
  const { mint, storage, actions, id } = await setup();
  assert.equal(statusOf(record(actions.world('ishaan'), id)), 'approved');

  const sending = actions.payout('ngozi', id);
  assert.equal(statusOf(record(actions.world('ngozi'), id)), 'paying out');
  assert.match(await sending, /^Stacked\. Paid\. 63 sats from 3 plebs/);

  const world = actions.world('ngozi');
  assert.equal(statusOf(record(world, id)), 'paid');
  const batch = record(world, id).operations.find(op => op.kind === 'payout')!;
  assert.equal(batch.status, 'confirmed');
  assert.equal(batch.keysetId, mint.keysetId);
  assert.ok(batch.settledAt);

  const reloaded = createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  assert.deepEqual(reloaded.world('ngozi'), world);
});

test('a pending payout stays Paying out across a reload, and Check again settles the same request', async () => {
  const { mint, storage, actions, id } = await setup();
  mint.batch = () => Promise.reject(new TypeError('fetch failed'));
  assert.match(await actions.payout('ngozi', id), /Still waiting for the mint/);

  const reloaded = createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  const batch = record(reloaded.world('ngozi'), id).operations[0];
  assert.equal(batch.status, 'unresolved');
  assert.equal(statusOf(record(reloaded.world('ngozi'), id)), 'paying out');

  mint.batch = mint.honest;
  assert.match(await reloaded.checkPayout('ngozi', id, batch.id), /^Stacked\. Paid\./);
  assert.equal(statusOf(record(reloaded.world('ngozi'), id)), 'paid');
  const bodies = mint.batchCalls().map(call => call.body);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});

test('race, payout first: the late reclaim is rejected and the backer sees the payout won', async () => {
  const { actions, id } = await setup();
  await actions.payout('ngozi', id);
  assert.equal(await actions.reclaim('ishaan', id), 'The payout got there first. Your 21 sats went to Ngozi. Your reclaim was rejected.');
  const world = actions.world('ishaan');
  assert.deepEqual(states(world, id), ['paid', 'paid', 'paid']);
  assert.equal(record(world, id).operations.find(op => op.kind === 'reclaim')?.status, 'rejected');
});

test('race, reclaim first: the stale batch is rejected and the other two go back to Deposited, never Paid', async () => {
  const { mint, actions, id } = await setup();
  assert.equal(await actions.reclaim('ishaan', id), 'Back to you. 21 sats minted to your own outputs.');
  let world = actions.world('tobi');
  assert.deepEqual(states(world, id), ['reclaimed', 'deposited', 'deposited']);
  assert.equal(statusOf(record(world, id)), 'unmet');
  assert.ok(record(world, id).slots.slice(1).every(slot => !slot.deposit!.authorizationReleased));

  assert.equal(await actions.payout('ngozi', id), 'The payout was rejected. Nothing was paid to Ngozi.');
  world = actions.world('tobi');
  assert.equal(record(world, id).operations.find(op => op.kind === 'payout')?.status, 'rejected');
  assert.deepEqual(states(world, id), ['reclaimed', 'deposited', 'deposited']);
  assert.deepEqual(record(world, id).slots.map(slot => slot.quote!.mintState), ['ISSUED', 'PAID', 'PAID']);
  assert.equal(mint.batchCalls().length, 1);

  for (const person of ['tobi', 'maren']) assert.match(await actions.reclaim(person, id), /^Back to you/);
  assert.deepEqual(states(actions.world('tobi'), id), ['reclaimed', 'reclaimed', 'reclaimed']);
});

test('a payout pending while a reclaim wins settles as rejected on Check again', async () => {
  const { mint, actions, id } = await setup();
  mint.batch = () => Promise.reject(new TypeError('fetch failed'));
  await actions.payout('ngozi', id);
  assert.equal(statusOf(record(actions.world('tobi'), id)), 'paying out');
  assert.equal(await actions.reclaim('tobi', id), 'Your reclaim got there first. 21 sats minted to your own outputs.');
  const batch = record(actions.world('tobi'), id).operations.find(op => op.kind === 'payout')!;
  assert.deepEqual(states(actions.world('tobi'), id), ['deposited', 'reclaimed', 'deposited']);

  assert.match(await actions.checkPayout('ngozi', id, batch.id), /^The payout was rejected/);
  assert.equal(record(actions.world('tobi'), id).operations.find(op => op.kind === 'payout')?.status, 'rejected');
  assert.equal(mint.batchCalls().length, 1);
});
