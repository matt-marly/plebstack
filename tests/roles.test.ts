import assert from 'node:assert/strict';
import test from 'node:test';
import { findCampaign, maintainerOf, statusOf, viewerStep } from '../src/demo/world';
import { ProtocolError, createProtocolClient } from '../src/protocol/client';
import { createRecordStore, memoryStorage, type StorageLike } from '../src/protocol/storage';
import { createLiveActions } from '../src/live/actions';
import { createActors, namespaces } from '../src/live/actors';
import { mockMint } from './mock-mint';
import { WORK, openStack } from './stack';

const BACKERS = ['tobi', 'maren', 'ishaan'];
const future = '2099-01-01T12:00:00.000Z';

function setup() {
  const mint = mockMint();
  const storage = memoryStorage();
  const actions = createLiveActions(createActors({ storage, fetch: mint.fetchFor('browser') }));
  return { mint, storage, actions };
}

const keysOf = (storage: StorageLike) => Array.from({ length: storage.length }, (_, i) => storage.key(i)!);
const inSpace = (storage: StorageLike, space: string) => keysOf(storage).filter(key => key.startsWith(`plebstack:${space}/`));
const secretsOf = (storage: StorageLike, person: string) => {
  const store = createRecordStore(storage, namespaces.person(person));
  return store.keys('key:').map(key => store.read<{ secretKey: string }>(key)!.secretKey);
};

test('Ada names the work and gets a claim link; nobody can join before Ngozi confirms her key', async () => {
  const { storage, actions } = setup();
  assert.throws(() => actions.startStack('ada', { ...WORK, publicWorkUrl: '' }), /public link/);
  const id = actions.startStack('ada', WORK);
  assert.equal(id, 'ngozi-daylight-saving-drift');
  assert.equal(actions.draft(id)!.key, undefined);
  assert.throws(() => actions.createCampaign('ada', id, { closesAt: future, contributionSat: 21 }), /hasn’t confirmed a payout key/);
  assert.equal(actions.world('tobi').campaigns.length, 0);
  await assert.rejects(actions.join('tobi', id), /No campaign/);
  assert.throws(() => actions.claimKey('ada', id), /for someone else/);
  assert.deepEqual(inSpace(storage, namespaces.person('ada')), []);
});

test('Ngozi’s key is made in her own storage; Ada’s and the coordinator’s hold no key at all', async () => {
  const { storage, actions } = setup();
  const id = actions.startStack('ada', WORK);
  const pubkey = actions.claimKey('ngozi', id);
  assert.deepEqual(actions.draft(id)!.key && { ...actions.draft(id)!.key, at: '' }, { pubkey, at: '', by: 'maintainer' });
  assert.equal(actions.claimKey('ngozi', id), pubkey, 'a second claim reuses her key');
  actions.createCampaign('ada', id, { closesAt: future, contributionSat: 21 });
  for (const person of BACKERS) {
    const quote = await actions.join(person, id);
    await actions.waitForDeposit(person, id, quote.id, {});
  }
  for (const person of BACKERS) await actions.sign(person, id);
  await actions.payout('tobi', id);

  const ngozi = secretsOf(storage, 'ngozi');
  assert.equal(ngozi.length, 1);
  assert.equal(secretsOf(storage, 'ada').length, 0);
  for (const space of [namespaces.person('ada'), namespaces.coordinator, namespaces.board]) {
    assert.ok(!inSpace(storage, space).some(key => /\/(key|owner):/.test(key)), space);
    const raw = inSpace(storage, space).map(key => storage.getItem(key)).join('\n');
    assert.ok(!ngozi.some(secret => raw.includes(secret)), space);
  }
  for (const person of BACKERS) {
    const raw = inSpace(storage, namespaces.person(person)).map(key => storage.getItem(key)).join('\n');
    assert.ok(!ngozi.some(secret => raw.includes(secret)), person);
  }
  const record = findCampaign(actions.world('ada'), id)!;
  assert.deepEqual([record.creatorId, record.maintainerId, record.keyBy, maintainerOf(record).short], ['ada', 'ngozi', 'maintainer', 'Ngozi']);
  assert.equal(record.campaign.beneficiaryPubkey, pubkey);
});

test('the organizer and the maintainer can’t chip in, and only the organizer stops collecting', async () => {
  const { actions } = setup();
  const id = openStack(actions);
  await assert.rejects(actions.join('ada', id), /no open slot/);
  await assert.rejects(actions.join('ngozi', id), /no open slot/);
  assert.throws(() => actions.stopCollecting('ngozi', id), /Only the organizer/);
  const world = actions.world('ada');
  assert.equal(viewerStep(world, findCampaign(world, id)!).kind, 'organize');
  actions.stopCollecting('ada', id);
  assert.equal(statusOf(findCampaign(actions.world('tobi'), id)!), 'unmet');
});

test('a pasted key must be a point on the curve, and is marked as not confirmed by Ngozi’s device', () => {
  const { actions } = setup();
  const id = actions.startStack('ada', WORK);
  const refused = (error: unknown) => error instanceof ProtocolError && error.kind === 'invalid-key';
  assert.throws(() => actions.pasteKey('ada', id, '04' + 'a'.repeat(64)), refused);
  assert.throws(() => actions.pasteKey('ada', id, '02' + 'f'.repeat(64)), refused, 'x past the field size is not on the curve');
  assert.throws(() => actions.pasteKey('ada', id, '02' + 'a'.repeat(60)), refused);
  assert.throws(() => actions.pasteKey('ngozi', id, '02' + 'a'.repeat(64)), /Only the organizer/);
  const given = createProtocolClient({ storage: memoryStorage() }).enrollMaintainer('elsewhere');
  assert.equal(actions.pasteKey('ada', id, ` ${given.toUpperCase()} `), given);
  assert.equal(actions.draft(id)!.key!.by, 'pasted');
  actions.createCampaign('ada', id, { closesAt: future, contributionSat: 21 });
  assert.equal(findCampaign(actions.world('tobi'), id)!.keyBy, 'pasted');
});

test('once the stack is open its payout key can’t change', () => {
  const { actions } = setup();
  const id = openStack(actions);
  assert.equal(actions.claimKey('ngozi', id), actions.draft(id)!.key!.pubkey);
  assert.throws(() => actions.pasteKey('ada', id, actions.draft(id)!.key!.pubkey), /can’t change/);
});
