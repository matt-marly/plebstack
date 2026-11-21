import assert from 'node:assert/strict';
import test from 'node:test';
import { TEST_MINT, type RecoveryOperation } from '../src/domain/models';
import { messages } from '../src/protocol/batch';
import { ProtocolError } from '../src/protocol/client';
import type { StorageLike } from '../src/protocol/storage';
import { approveAll, funded, json } from './mock-mint';

function operationWrites(storage: StorageLike): string[] {
  const writes: string[] = [];
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    setItem(key, value);
    if (key.startsWith('plebstack:operation:')) writes.push((JSON.parse(value).value as RecoveryOperation).status);
  };
  return writes;
}

test('only the owner can reclaim: anyone else is refused before any request', async () => {
  const { backers, coordinator, maintainer, mint } = await funded();
  const before = mint.calls.length;
  for (const client of [backers[1].client, coordinator, maintainer]) {
    await assert.rejects(client.reclaim(backers[0].quote.id, 'op-foreign'), (error: ProtocolError) => error.kind === 'not-owner');
    assert.equal(await client.recovery.get('op-foreign'), undefined);
  }
  assert.equal(mint.calls.length, before);
  assert.equal(mint.quotes.get(backers[0].quote.id)?.state, 'PAID');
});

test('the reclaim is saved as prepared, then dispatched, with the stop recorded, before it is sent', async () => {
  const { backers, mint } = await funded();
  const [backer] = backers;
  const writes = operationWrites(backer.storage);
  let seen: RecoveryOperation | undefined;
  let writesAtSend: string[] = [];
  let stoppedAtSend = false;
  mint.single = async raw => {
    seen = await backer.client.recovery.get('op-r');
    writesAtSend = [...writes];
    stoppedAtSend = backer.client.signerFor(backer.pubkey).approvalsStopped(backer.quote.id);
    return mint.honestSingle(raw);
  };
  const settlement = await backer.client.reclaim(backer.quote.id, 'op-r');
  assert.equal(settlement.kind, 'confirmed');
  assert.deepEqual(writesAtSend, ['prepared', 'dispatched']);
  assert.ok(stoppedAtSend);
  assert.equal(seen!.status, 'dispatched');
  assert.equal(seen!.kind, 'reclaim');
  assert.equal(seen!.mint, TEST_MINT);
  assert.equal(seen!.keysetId, mint.keysetId);
  assert.deepEqual(seen!.quoteIds, [backer.quote.id]);
  assert.ok(seen!.createdAt <= seen!.dispatchedAt!);
  const body = JSON.parse(seen!.requestBody);
  assert.equal(body.quote, backer.quote.id);
  assert.deepEqual(body.outputs, messages(seen!.outputs));
  assert.equal(seen!.outputs.reduce((sum, output) => sum + output.message.amount, 0), 21);
  assert.ok(seen!.outputs.every(output => output.message.id === mint.keysetId && !output.secretHex.startsWith('5b')));
});

test('a failed save before the reclaim sends nothing', async () => {
  const { backers, mint } = await funded();
  const [backer] = backers;
  backer.storage.failWrites = true;
  await assert.rejects(backer.client.reclaim(backer.quote.id, 'op-r'),
    (error: ProtocolError) => error.kind === 'storage' && /Nothing was sent/.test(error.message));
  backer.storage.failWrites = false;
  assert.equal(mint.mintCalls().length, 0);
  assert.equal(await backer.client.recovery.get('op-r'), undefined);
  assert.equal(mint.quotes.get(backer.quote.id)?.state, 'PAID');
});

test('a 200 is confirmed only after the proofs verify and are saved, and the deposit reads reclaimed', async () => {
  const { backers, mint } = await funded();
  const [backer] = backers;
  const writes = operationWrites(backer.storage);
  const settlement = await backer.client.reclaim(backer.quote.id, 'op-r');
  assert.equal(settlement.kind, 'confirmed');
  if (settlement.kind !== 'confirmed') return;
  assert.equal(settlement.destination, 'owner');
  assert.equal(settlement.proofs.reduce((sum, proof) => sum + proof.amount, 0), 21);
  assert.ok(settlement.proofs.every(proof => proof.dleq && proof.id === mint.keysetId));
  assert.deepEqual(writes, ['prepared', 'dispatched', 'confirmed']);
  const operation = (await backer.client.recovery.get('op-r'))!;
  assert.equal(operation.status, 'confirmed');
  assert.deepEqual(operation.proofs, settlement.proofs);
  assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'reclaimed');
  assert.equal(mint.quotes.get(backer.quote.id)?.state, 'ISSUED');
  await assert.rejects(backer.client.reclaim(backer.quote.id, 'op-again'), (error: ProtocolError) => error.kind === 'not-paid');
});

test('confirmed is never reported when the reclaim proofs cannot be saved', async () => {
  const { backers, mint } = await funded();
  const [backer] = backers;
  mint.single = raw => {
    const response = mint.honestSingle(raw);
    backer.storage.failWrites = true;
    return response;
  };
  const settlement = await backer.client.reclaim(backer.quote.id, 'op-r');
  backer.storage.failWrites = false;
  assert.equal(settlement.kind, 'pending');
  const operation = (await backer.client.recovery.get('op-r'))!;
  assert.equal(operation.status, 'dispatched');
  assert.equal(operation.proofs, undefined);
  assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'paid');
});

test('a 200 with a bad DLEQ or the wrong total stays unresolved', async () => {
  const bad: [string, (signatures: Record<string, unknown>[]) => unknown][] = [
    ['bad dleq', signatures => signatures.map((signature, i) => i === 0 ? { ...signature, dleq: { ...signature.dleq as object, s: '11'.repeat(32) } } : signature)],
    ['missing signature', signatures => signatures.slice(1)],
  ];
  for (const [name, change] of bad) {
    const { backers, mint } = await funded();
    const [backer] = backers;
    mint.single = async raw => {
      const body = await mint.honestSingle(raw).json() as { signatures: Record<string, unknown>[] };
      return json({ signatures: change(body.signatures) });
    };
    const settlement = await backer.client.reclaim(backer.quote.id, 'op-r');
    assert.equal(settlement.kind, 'pending', name);
    const operation = (await backer.client.recovery.get('op-r'))!;
    assert.equal(operation.status, 'unresolved', name);
    assert.equal(operation.proofs, undefined, name);
    assert.notEqual(backer.client.findDeposit(backer.quote.id)?.status, 'reclaimed', name);
  }
});

test('a Cashu 4xx is rejected with the mint’s reason', async () => {
  const { backers, mint } = await funded();
  const [backer] = backers;
  mint.single = () => json({ code: 20008, detail: 'Signature missing or invalid' }, 400);
  const settlement = await backer.client.reclaim(backer.quote.id, 'op-r');
  assert.deepEqual(settlement, { kind: 'rejected', operationId: 'op-r', reason: '20008: Signature missing or invalid' });
  assert.equal((await backer.client.recovery.get('op-r'))?.status, 'rejected');
  assert.deepEqual(await backer.client.recovery.listUnresolved(), []);
  assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'paid');
});

test('a network error or 5xx leaves the reclaim pending, never retried with new outputs', async () => {
  const answers: [string, () => Response | Promise<Response>][] = [
    ['network', () => Promise.reject(new TypeError('fetch failed'))],
    ['503', () => json({ detail: 'unavailable' }, 503)],
  ];
  for (const [name, answer] of answers) {
    const { backers, mint } = await funded();
    const [backer] = backers;
    mint.single = answer;
    const settlement = await backer.client.reclaim(backer.quote.id, 'op-r');
    assert.deepEqual(settlement, { kind: 'pending', operationId: 'op-r' }, name);
    const saved = (await backer.client.recovery.get('op-r'))!;
    assert.equal(saved.status, 'unresolved', name);
    assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'paid', name);

    await assert.rejects(backer.client.reclaim(backer.quote.id, 'op-new'), (error: ProtocolError) => error.kind === 'pending', name);
    assert.equal(mint.mintCalls().length, 1, name);

    // Check again: the mint signed nothing and the quote is still unissued, so the same saved request goes again.
    mint.single = mint.honestSingle;
    const again = await backer.client.recover('op-r');
    assert.equal(again.kind, 'confirmed', name);
    assert.deepEqual(mint.mintCalls().map(call => call.body), [saved.requestBody, saved.requestBody], name);
    assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'reclaimed', name);
  }
});

test('check again finds a reclaim whose answer was lost and confirms it without sending again', async () => {
  const { backers, mint } = await funded();
  const [backer] = backers;
  mint.single = async raw => {
    mint.honestSingle(raw);
    throw new TypeError('connection reset');
  };
  assert.equal((await backer.client.reclaim(backer.quote.id, 'op-r')).kind, 'pending');
  const settlement = await backer.client.recover('op-r');
  assert.equal(settlement.kind, 'confirmed');
  if (settlement.kind !== 'confirmed') return;
  assert.equal(settlement.destination, 'owner');
  assert.equal(settlement.proofs.reduce((sum, proof) => sum + proof.amount, 0), 21);
  assert.equal(mint.mintCalls().length, 1);
  assert.equal((await backer.client.recovery.get('op-r'))?.status, 'confirmed');
});

test('race, payout first: the late reclaim is rejected and the deposit reads issued, not reclaimed', async () => {
  const setup = await funded();
  const { backers, coordinator, mint, plan } = setup;
  const authorizations = await approveAll(setup);
  const [backer] = backers;
  await backer.signer.stopNewApprovals(backer.quote.id);

  const payout = await coordinator.payout(plan, authorizations, 'op-payout');
  assert.equal(payout.kind, 'confirmed');
  const reclaim = await backer.client.reclaim(backer.quote.id, 'op-r');
  assert.deepEqual(reclaim, { kind: 'rejected', operationId: 'op-r', reason: '20002: Quote already issued' });
  const record = backer.client.findDeposit(backer.quote.id)!;
  assert.equal(record.status, 'issued');
  assert.equal(record.quote?.state, 'ISSUED');
  assert.equal((await backer.client.recovery.get('op-r'))?.status, 'rejected');
  assert.equal(mint.mintCalls().length, 1);
});

test('race, reclaim first: the stale batch is rejected, the other two stay paid, and their owners reclaim them', async () => {
  const setup = await funded();
  const { backers, coordinator, mint, plan } = setup;
  const authorizations = await approveAll(setup);
  const [first, ...others] = backers;

  assert.equal((await first.client.reclaim(first.quote.id, 'op-r1')).kind, 'confirmed');
  const payout = await coordinator.payout(plan, authorizations, 'op-payout');
  assert.deepEqual(payout, { kind: 'rejected', operationId: 'op-payout', reason: '20002: Quote already issued' });
  assert.equal((await coordinator.recovery.get('op-payout'))?.status, 'rejected');
  assert.deepEqual(await coordinator.checkQuotes(TEST_MINT, plan.quoteIds), ['ISSUED', 'PAID', 'PAID']);
  for (const backer of others) assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'paid');

  for (const [i, backer] of others.entries()) {
    const settlement = await backer.client.reclaim(backer.quote.id, `op-r${i + 2}`);
    assert.equal(settlement.kind, 'confirmed');
  }
  assert.deepEqual(await coordinator.checkQuotes(TEST_MINT, plan.quoteIds), ['ISSUED', 'ISSUED', 'ISSUED']);
  assert.equal(mint.batchCalls().length, 1);
});

test('check again on a payout: found by restore when it landed, rejected when a reclaim won meanwhile', async () => {
  const landed = await funded();
  landed.mint.batch = async raw => {
    landed.mint.honest(raw);
    throw new TypeError('connection reset');
  };
  assert.equal((await landed.coordinator.payout(landed.plan, await approveAll(landed), 'op-payout')).kind, 'pending');
  const found = await landed.coordinator.recover('op-payout');
  assert.equal(found.kind, 'confirmed');
  if (found.kind === 'confirmed') assert.equal(found.destination, 'creator');
  assert.equal(landed.mint.batchCalls().length, 1);

  const lost = await funded();
  lost.mint.batch = () => Promise.reject(new TypeError('fetch failed'));
  assert.equal((await lost.coordinator.payout(lost.plan, await approveAll(lost), 'op-payout')).kind, 'pending');
  assert.equal((await lost.backers[0].client.reclaim(lost.backers[0].quote.id, 'op-r')).kind, 'confirmed');
  const rejected = await lost.coordinator.recover('op-payout');
  assert.equal(rejected.kind, 'rejected');
  assert.equal((await lost.coordinator.recovery.get('op-payout'))?.status, 'rejected');
  assert.equal(lost.mint.batchCalls().length, 1);
});
