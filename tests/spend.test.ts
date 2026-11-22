import assert from 'node:assert/strict';
import test from 'node:test';
import { getDecodedToken } from '@cashu/cashu-ts';
import type { RecoveryOperation } from '../src/domain/models';
import { p2pkData } from '../src/protocol/batch';
import { createRecordStore, memoryStorage } from '../src/protocol/storage';
import { createLiveActions } from '../src/live/actions';
import { createActors, namespaces } from '../src/live/actors';
import { mockMint } from './mock-mint';
import { openStack } from './stack';

const BACKERS = ['tobi', 'maren', 'ishaan'];

async function paid() {
  const mint = mockMint();
  const storage = memoryStorage();
  const timeline: string[] = [];
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    setItem(key, value);
    if (key.startsWith(`plebstack:${namespaces.person('ngozi')}/operation:`)) timeline.push(`saved ${JSON.parse(value).value.status}`);
    if (key.startsWith(`plebstack:${namespaces.person('ngozi')}/spend:`)) timeline.push(`noted ${JSON.parse(value).value.status}`);
  };
  const fetch = mint.fetchFor('browser');
  const actors = createActors({
    storage, fetch: (url, init) => { if (url.endsWith('/v1/swap')) timeline.push('sent swap'); return fetch(url, init); },
  });
  const actions = createLiveActions(actors);
  const id = openStack(actions);
  for (const person of BACKERS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  for (const person of BACKERS) await actions.sign(person, id);
  await actions.payout('ishaan', id);
  const reload = () => createLiveActions(createActors({ storage, fetch }));
  const secret = createRecordStore(storage, namespaces.person('ngozi'));
  const secretKey = secret.read<{ secretKey: string }>(secret.keys('key:')[0])!.secretKey;
  return { mint, storage, actors, actions, id, timeline, reload, secretKey };
}

test('the coordinator hands the confirmed payout on, locked to Ngozi, and only her side saves it', async () => {
  const { storage, actions, id } = await paid();
  const pubkey = actions.draft(id)!.key!.pubkey;
  assert.throws(() => actions.receive('tobi', id), /someone else/);
  const received = actions.receive('ngozi', id)!;
  assert.equal(received.proofs.reduce((sum, proof) => sum + proof.amount, 0), 63);
  assert.ok(received.proofs.every(proof => p2pkData(proof.secret) === pubkey));
  assert.deepEqual(actions.wallet('ngozi', id).received, received);
  assert.ok(storage.getItem(`plebstack:${namespaces.person('ngozi')}/received:${id}`));
  assert.equal(actions.receive('ngozi', id)!.at, received.at, 'receiving twice keeps the first record');
});

test('Spend swaps at the mint with her key, saved before it goes: 63 in, 1-sat fee, 62 back, as a real token', async () => {
  const { mint, actions, id, timeline, secretKey } = await paid();
  actions.receive('ngozi', id);
  assert.equal(await actions.spend('ngozi', id), 'Swap fee at the mint, 1 sat. Received, 62 sats.');
  assert.deepEqual(timeline, ['noted sent', 'saved prepared', 'saved dispatched', 'sent swap', 'saved confirmed', 'noted confirmed']);
  assert.equal(mint.swapCalls().length, 1);
  const spend = actions.wallet('ngozi', id).spend!;
  assert.deepEqual([spend.status, spend.grossSat, spend.receivedSat], ['confirmed', 63, 62]);

  const token = (await actions.spentEcash('ngozi', id))!;
  assert.match(token, /^cashuB/);
  assert.ok(!token.includes(secretKey));
  const decoded = getDecodedToken(token, [mint.keysetId]);
  assert.equal(decoded.proofs.reduce((sum, proof) => sum + proof.amount.toNumber(), 0), 62);
  assert.ok(decoded.proofs.every(proof => p2pkData(proof.secret) === undefined && !proof.witness));
  assert.ok(!JSON.stringify(decoded).includes(secretKey));

  assert.match(await actions.spend('ngozi', id), /Received, 62 sats/);
  assert.equal(mint.swapCalls().length, 1, 'a second tap asks about the same swap, it doesn’t make another');
});

test('a swap the mint signed but never answered is found on Check again from the same saved outputs', async () => {
  const { mint, actions, id, reload } = await paid();
  actions.receive('ngozi', id);
  mint.swap = raw => { mint.honestSwap(raw); return Promise.reject(new TypeError('fetch failed')); };
  assert.match(await actions.spend('ngozi', id), /^Still waiting for the mint/);
  assert.equal(actions.wallet('ngozi', id).spend!.status, 'pending');

  const reloaded = reload();
  assert.equal(await reloaded.checkSpend('ngozi', id), 'Swap fee at the mint, 1 sat. Received, 62 sats.');
  assert.equal(mint.swapCalls().length, 1);
  const restore = mint.calls.filter(call => call.path === '/v1/restore').at(-1)!;
  const sent = JSON.parse(mint.swapCalls()[0].body!) as { outputs: unknown };
  assert.equal(JSON.stringify((JSON.parse(restore.body!) as { outputs: unknown }).outputs), JSON.stringify(sent.outputs));
});

test('a swap that never reached the mint is sent again with the identical saved body, never with new outputs', async () => {
  const { mint, storage, actions, id } = await paid();
  actions.receive('ngozi', id);
  mint.swap = () => Promise.reject(new TypeError('fetch failed'));
  assert.match(await actions.spend('ngozi', id), /^Still waiting for the mint/);
  mint.swap = mint.honestSwap;
  assert.match(await actions.checkSpend('ngozi', id), /Received, 62 sats/);
  const [first, second] = mint.swapCalls().map(call => call.body);
  assert.equal(mint.swapCalls().length, 2);
  assert.equal(second, first);
  const store = createRecordStore(storage, namespaces.person('ngozi'));
  const op = store.read<RecoveryOperation>(`operation:${actions.wallet('ngozi', id).spend!.operationId}`)!;
  assert.deepEqual([op.kind, op.status, op.requestBody === first], ['swap', 'confirmed', true]);
  assert.equal(op.proofs!.reduce((sum, proof) => sum + proof.amount, 0), 62);
});

test('a pasted key has no key in this browser, so there is nothing for Ngozi to receive or spend here', async () => {
  const mint = mockMint();
  const actions = createLiveActions(createActors({ storage: memoryStorage(), fetch: mint.fetchFor('browser') }));
  const other = createLiveActions(createActors({ storage: memoryStorage() }));
  const given = other.claimKey('ngozi', other.startStack('ada', { maintainerName: 'Ngozi Eze', title: 'x', publicWorkUrl: 'https://e.org/1' }));
  const id = actions.startStack('ada', { maintainerName: 'Ngozi Eze', title: 'Pasted', publicWorkUrl: 'https://e.org/2' });
  actions.pasteKey('ada', id, given);
  actions.createCampaign('ada', id, { closesAt: '2099-01-01T00:00:00Z', contributionSat: 21 });
  for (const person of BACKERS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  for (const person of BACKERS) await actions.sign(person, id);
  await actions.payout('tobi', id);
  assert.equal(actions.receive('ngozi', id), undefined);
  await assert.rejects(actions.spend('ngozi', id), /no payout saved/);
  assert.equal(mint.swapCalls().length, 0);
});
