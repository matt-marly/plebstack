import assert from 'node:assert/strict';
import test from 'node:test';
import { findCampaign, isPending, slotOf, slotStatus, statusOf, type World } from '../src/demo/world';
import { NOT_SAVED, ProtocolError } from '../src/protocol/client';
import { memoryStorage, type StorageLike } from '../src/protocol/storage';
import { createLiveActions, failureCopy } from '../src/live/actions';
import { createActors, namespaces } from '../src/live/actors';
import { mockMint } from './mock-mint';

const BACKERS = ['ishaan', 'tobi', 'maren'];

async function setup({ storage = memoryStorage(), sign = true }: { storage?: StorageLike & { failWrites: boolean }; sign?: boolean } = {}) {
  const mint = mockMint();
  const actions = createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  const id = actions.createCampaign('ngozi', {
    title: 'Fix DST drift in pocket-ical recurring events', publicWorkUrl: 'https://codeberg.org/ngozi/pocket-ical/issues/412',
    contributionSat: 21, beneficiaryPubkey: actions.maintainerKey('ngozi'),
  });
  for (const person of BACKERS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  if (sign) for (const person of BACKERS) await actions.sign(person, id);
  // A reload: new actors and actions over the same storage, nothing carried over in memory.
  const reload = () => createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  return { mint, storage, actions, id, reload };
}

const record = (world: World, id: string) => findCampaign(world, id)!;
const waiting = (world: World, id: string) => record(world, id).operations.filter(isPending);
const never = () => new Promise<Response>(() => {});
const outputsOf = (body: string | undefined) => JSON.stringify((JSON.parse(body!) as { outputs: unknown }).outputs);

test('a payout the mint issued but never answered is still waiting after a reload, and Check again confirms it from restore', async () => {
  const { mint, id, actions, reload } = await setup();
  mint.batch = raw => { mint.honest(raw); return Promise.reject(new TypeError('fetch failed')); };
  assert.match(await actions.payout('ngozi', id), /Still waiting for the mint/);

  const reloaded = reload();
  const [batch] = waiting(reloaded.world('ngozi'), id);
  assert.equal(batch.kind, 'payout');
  assert.equal(statusOf(record(reloaded.world('tobi'), id)), 'paying out');

  assert.match(await reloaded.checkPayout('ngozi', id, batch.id), /^Stacked\. Paid\. 63 sats from 3 plebs/);
  assert.equal(mint.batchCalls().length, 1);
  const restore = mint.calls.filter(call => call.path === '/v1/restore');
  assert.equal(restore.length, 1);
  assert.equal(outputsOf(restore[0].body), outputsOf(mint.batchCalls()[0].body));
  assert.equal(statusOf(record(reload().world('ishaan'), id)), 'paid');
  assert.deepEqual(waiting(reload().world('ngozi'), id), []);
});

test('a payout cut off by a reload is sent again with the identical saved body when every quote is still unissued', async () => {
  const { mint, id, actions, reload } = await setup();
  mint.batch = never;
  void actions.payout('ngozi', id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mint.batchCalls().length, 1);

  const reloaded = reload();
  const [batch] = waiting(reloaded.world('maren'), id);
  assert.equal(batch.status, 'dispatched');

  mint.batch = mint.honest;
  assert.match(await reloaded.checkPayout('maren', id, batch.id), /^Stacked\. Paid\./);
  const [first, second] = mint.batchCalls().map(call => call.body);
  assert.equal(mint.batchCalls().length, 2);
  assert.equal(second, first);
  assert.deepEqual([...mint.quotes.values()].map(quote => quote.state), ['ISSUED', 'ISSUED', 'ISSUED']);
});

test('a reclaim the mint issued but never answered is confirmed from restore after a reload', async () => {
  const { mint, id, actions, reload } = await setup({ sign: false });
  mint.single = raw => { mint.honestSingle(raw); return Promise.reject(new TypeError('fetch failed')); };
  assert.match(await actions.reclaim('tobi', id), /Still waiting for the mint/);

  const reloaded = reload();
  const [request] = waiting(reloaded.world('tobi'), id);
  assert.equal(request.kind, 'reclaim');
  assert.equal(slotStatus(slotOf(record(reloaded.world('tobi'), id), 'tobi')!), 'reclaiming');

  assert.equal(await reloaded.checkReclaim('tobi', id, request.id), 'Back to you. 21 sats minted to your own outputs.');
  assert.equal(mint.mintCalls().length, 1);
  assert.equal(slotStatus(slotOf(record(reload().world('tobi'), id), 'tobi')!), 'reclaimed');
});

test('a reclaim cut off by a reload is sent again with the identical saved body', async () => {
  const { mint, id, actions, reload } = await setup({ sign: false });
  mint.single = never;
  void actions.reclaim('maren', id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mint.mintCalls().length, 1);

  const reloaded = reload();
  const [request] = waiting(reloaded.world('maren'), id);
  mint.single = mint.honestSingle;
  assert.match(await reloaded.checkReclaim('maren', id, request.id), /^Back to you/);
  const [first, second] = mint.mintCalls().map(call => call.body);
  assert.equal(second, first);
});

test('a deposit still unpaid at the mint shows as awaiting after a reload, and waiting resumes on the same quote', async () => {
  const mint = mockMint();
  const storage = memoryStorage();
  const actions = createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  const id = actions.createCampaign('ngozi', {
    title: 'Fix DST drift in pocket-ical recurring events', publicWorkUrl: 'https://codeberg.org/ngozi/pocket-ical/issues/412',
    contributionSat: 21, beneficiaryPubkey: actions.maintainerKey('ngozi'),
  });
  const quote = await actions.join('ishaan', id);
  mint.quotes.get(quote.id)!.state = 'UNPAID';

  const reloaded = createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  assert.equal(slotStatus(slotOf(record(reloaded.world('ishaan'), id), 'ishaan')!), 'awaiting');
  let checks = 0;
  const notice = await reloaded.waitForDeposit('ishaan', id, quote.id, {
    intervalMs: 1, onCheck: () => { if (++checks === 2) mint.quotes.get(quote.id)!.state = 'PAID'; },
  });
  assert.equal(notice, 'Stacked. 21 sats at the mint, locked to your key.');
  assert.equal(slotStatus(slotOf(record(reloaded.world('ishaan'), id), 'ishaan')!), 'deposited');
  assert.equal(mint.calls.filter(call => call.path === '/v1/mint/quote/bolt11').length, 1);
});

test('when this device refuses every write, nothing goes to the mint and the person is told so', async () => {
  const { mint, storage, id, actions } = await setup();
  const fresh = actions.createCampaign('ngozi', {
    title: 'Add Nostr login to a self-hosted invoice app', publicWorkUrl: 'https://codeberg.org/ngozi/ledgerline/issues/57',
    contributionSat: 21, beneficiaryPubkey: actions.maintainerKey('ngozi'),
  });
  storage.failWrites = true;
  const before = mint.calls.length;
  const refused = (error: unknown) => error instanceof ProtocolError && error.kind === 'storage' && failureCopy(error) === NOT_SAVED;

  await assert.rejects(actions.join('ishaan', fresh), refused);
  await assert.rejects(actions.payout('ngozi', id), refused);
  await assert.rejects(actions.reclaim('tobi', id), refused);
  await assert.rejects(actions.stopSigning('maren', id), refused);
  assert.throws(() => actions.stopCollecting('ngozi', fresh), refused);
  assert.throws(() => actions.createCampaign('ngozi', {
    title: 'Another', publicWorkUrl: 'https://codeberg.org/ngozi/ledgerline/issues/58', contributionSat: 21,
    beneficiaryPubkey: actions.maintainerKey('ngozi'),
  }), refused);
  assert.equal(mint.calls.length, before);

  storage.failWrites = false;
  const world = actions.world('ngozi');
  assert.equal(statusOf(record(world, id)), 'approved');
  assert.deepEqual(record(world, id).operations, []);
  assert.equal(slotOf(record(world, fresh), 'ishaan'), undefined);
});

test('a request whose dispatched mark can’t be saved is never sent and doesn’t block the next try', async () => {
  const storage = memoryStorage();
  const setItem = storage.setItem.bind(storage);
  let refuseDispatched = false;
  storage.setItem = (key, value) => {
    if (refuseDispatched && key.includes('/operation:') && value.includes('"status":"dispatched"')) {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    }
    setItem(key, value);
  };
  const { mint, id, actions } = await setup({ storage, sign: false });
  refuseDispatched = true;
  await assert.rejects(actions.reclaim('ishaan', id), (error: ProtocolError) => error.kind === 'storage' && error.message === NOT_SAVED);
  assert.equal(mint.mintCalls().length, 0);
  assert.deepEqual(record(actions.world('ishaan'), id).operations, []);
  assert.ok(!Array.from({ length: storage.length }, (_, i) => storage.key(i)!)
    .some(key => key.startsWith(`plebstack:${namespaces.person('ishaan')}/operation:`)));

  refuseDispatched = false;
  assert.match(await actions.reclaim('ishaan', id), /^Back to you/);
});
