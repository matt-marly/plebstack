import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OutputData, createRandomSecretKey, getPubKeyFromPrivKey, schnorrSignDigest, schnorrVerifyDigest,
} from '@cashu/cashu-ts';
import { bytesToHex } from '@noble/hashes/utils.js';
import { TEST_MINT, type Authorization, type BatchPlan, type RecoveryOperation } from '../src/domain/models';
import { PackageError, construction, inputFee, messages } from '../src/protocol/batch';
import { ProtocolError, createProtocolClient, type ProtocolClient } from '../src/protocol/client';
import { mintQuoteDigest } from '../src/protocol/signer';
import { approveAll, funded, json } from './mock-mint';

async function savedOperation(client: ProtocolClient, id: string) {
  return (await client.recovery.get(id))!;
}

test('the coordinator builds a 63 sat package locked to the maintainer and holds no keys', async () => {
  const { plan, mint, maintainerPubkey, coordinatorStorage } = await funded();
  assert.equal(plan.totalSat, 63);
  assert.equal(plan.keyset.id, mint.keysetId);
  assert.equal(plan.keyset.inputFeePpk, 100);
  assert.deepEqual(plan.outputs.map(output => output.message.amount), [32, 16, 8, 4, 2, 1]);
  for (const output of plan.outputs) {
    const [kind, body] = JSON.parse(Buffer.from(output.secretHex, 'hex').toString('utf8'));
    assert.equal(kind, 'P2PK');
    assert.equal(body.data, maintainerPubkey);
    assert.deepEqual(body.tags, []);
    assert.equal(output.message.id, mint.keysetId);
  }
  const stored = Array.from({ length: coordinatorStorage.length }, (_, i) => coordinatorStorage.key(i)!);
  assert.ok(stored.every(key => !key.startsWith('plebstack:key:') && !key.startsWith('plebstack:owner:')));
});

test('a backer refuses each tampered package with a specific reason and releases nothing', async () => {
  const setup = await funded();
  const { plan, campaign, backers, mint } = setup;
  const [backer] = backers;
  const stranger = bytesToHex(getPubKeyFromPrivKey(createRandomSecretKey()));
  const otherKeyset = { ...plan.keyset, id: '00' + 'ab'.repeat(7) };

  const tamper: [string, (draft: BatchPlan) => void][] = [
    ['blinded-message', draft => { draft.outputs[2].message.B_ = draft.outputs[3].message.B_; }],
    ['blinded-message', draft => { draft.outputs[0].blindingFactorHex = draft.outputs[1].blindingFactorHex; }],
    ['amount', draft => { draft.outputs[0].message.amount = 64; }],
    ['amount', draft => { draft.outputs.pop(); }],
    ['lock', draft => {
      draft.outputs = OutputData.createP2PKData({ pubkey: stranger, blindKeys: false }, 63, plan.keyset).map(construction);
    }],
    ['lock', draft => { draft.beneficiaryPubkey = stranger; }],
    ['tags', draft => {
      draft.outputs = OutputData.createP2PKData({ pubkey: campaign.beneficiaryPubkey, blindKeys: false, locktime: 1, refundKeys: [stranger] }, 63, plan.keyset)
        .map(construction);
    }],
    ['keyset', draft => { draft.outputs[0].message.id = otherKeyset.id; }],
    ['keyset', draft => { draft.keyset = otherKeyset; }],
    ['foreign-quote', draft => { draft.quoteIds[0] = crypto.randomUUID(); }],
    ['foreign-quote', draft => { draft.ownerPubkeys[0] = stranger; }],
  ];

  for (const [check, change] of tamper) {
    const draft = structuredClone(plan);
    change(draft);
    await assert.rejects(backer.client.authorizeBatch(campaign, draft, backer.quote, backer.signer),
      (error: PackageError) => error instanceof PackageError && error.check === check, check);
    assert.equal(backer.client.findRelease(backer.quote.id), undefined);
  }

  const other = backers[1];
  await assert.rejects(backer.client.authorizeBatch(campaign, plan, other.quote, backer.signer),
    (error: PackageError) => error.check === 'not-owner');
  await assert.rejects(other.client.authorizeBatch(campaign, plan, backer.quote, other.signer),
    (error: PackageError) => error.check === 'not-owner');
  assert.equal(mint.batchCalls().length, 0);
});

test('a released signature is saved before it is returned', async () => {
  const { plan, campaign, backers } = await funded();
  const [backer] = backers;

  backer.storage.failWrites = true;
  await assert.rejects(backer.client.authorizeBatch(campaign, plan, backer.quote, backer.signer),
    (error: ProtocolError) => error.kind === 'storage');
  backer.storage.failWrites = false;
  assert.equal(backer.client.findRelease(backer.quote.id), undefined);

  const authorization = await backer.client.authorizeBatch(campaign, plan, backer.quote, backer.signer);
  const reloaded = createProtocolClient({ storage: backer.storage });
  const record = reloaded.findRelease(backer.quote.id)!;
  assert.equal(record.signature, authorization.signature);
  assert.equal(record.campaignId, campaign.id);
  assert.match(record.outputsDigest, /^[0-9a-f]{64}$/);
  assert.deepEqual(authorization.outputs, messages(plan.outputs));
  assert.ok(schnorrVerifyDigest(authorization.signature, mintQuoteDigest(backer.quote.id, authorization.outputs), backer.pubkey));

  const again = await backer.client.authorizeBatch(campaign, plan, backer.quote, backer.signer);
  assert.equal(again.signature, authorization.signature);
});

test('a local stop refuses new signatures but the released one still settles', async () => {
  const setup = await funded();
  const { plan, campaign, backers, coordinator } = setup;
  const authorizations = await approveAll(setup);
  const [backer] = backers;

  await backer.signer.stopNewApprovals(backer.quote.id);
  const fresh = backer.client.signerFor(backer.pubkey);
  assert.ok(fresh.approvalsStopped(backer.quote.id));
  await assert.rejects(fresh.signQuote(backer.quote.id, authorizations[0].outputs), /stopped/);
  await assert.rejects(backer.client.authorizeBatch(campaign, plan, backer.quote, fresh),
    (error: PackageError) => error.check === 'stopped');

  const settlement = await coordinator.payout(plan, authorizations, 'op-stop');
  assert.equal(settlement.kind, 'confirmed');
});

test('payout refuses missing, reordered, mismatched or invalid approvals without contacting the mint', async () => {
  const setup = await funded();
  const { plan, coordinator, mint, backers } = setup;
  const authorizations = await approveAll(setup);
  const strangerKey = createRandomSecretKey();
  const outputs = authorizations[0].outputs;
  const other = { ...outputs[0], B_: outputs[1].B_ };
  const before = mint.calls.length;

  const cases: [string, Authorization[]][] = [
    ['two approvals', authorizations.slice(0, 2)],
    ['reordered', [authorizations[1], authorizations[0], authorizations[2]]],
    ['zero signature', [authorizations[0], authorizations[1], { ...authorizations[2], signature: '00'.repeat(64) }]],
    ['wrong key', [authorizations[0], authorizations[1], {
      ...authorizations[2], signature: schnorrSignDigest(mintQuoteDigest(backers[2].quote.id, outputs), strangerKey),
    }]],
    ['different outputs', [authorizations[0], authorizations[1], { ...authorizations[2], outputs: [other, ...outputs.slice(1)] }]],
    ['missing signature', [authorizations[0], authorizations[1], { ...authorizations[2], signature: null as unknown as string }]],
  ];
  for (const [name, list] of cases) {
    await assert.rejects(coordinator.payout(plan, list, `op-${name}`), (error: ProtocolError) => error.kind === 'authorization', name);
    assert.equal(await coordinator.recovery.get(`op-${name}`), undefined, name);
  }
  const tampered = structuredClone(plan);
  tampered.outputs[0].message.B_ = tampered.outputs[1].message.B_;
  await assert.rejects(coordinator.payout(tampered, authorizations, 'op-tampered'), (error: ProtocolError) => error.kind === 'authorization');
  assert.equal(mint.calls.length, before);
});

test('the payout is saved as prepared, then dispatched, before the batch is sent', async () => {
  const setup = await funded();
  const { plan, coordinator, mint, operationWrites } = setup;
  const authorizations = await approveAll(setup);
  let seen: RecoveryOperation | undefined;
  let writesAtSend: string[] = [];
  mint.batch = async raw => {
    seen = await coordinator.recovery.get('op-1');
    writesAtSend = [...operationWrites];
    assert.equal(seen?.requestBody, raw);
    return mint.honest(raw);
  };
  const settlement = await coordinator.payout(plan, authorizations, 'op-1');
  assert.equal(settlement.kind, 'confirmed');
  assert.deepEqual(writesAtSend, ['prepared', 'dispatched']);
  assert.equal(seen!.status, 'dispatched');
  assert.equal(seen!.kind, 'payout');
  assert.equal(seen!.version, 1);
  assert.equal(seen!.mint, TEST_MINT);
  assert.equal(seen!.keysetId, plan.keyset.id);
  assert.deepEqual(seen!.quoteIds, plan.quoteIds);
  assert.deepEqual(seen!.outputs, plan.outputs);
  assert.ok(seen!.createdAt <= seen!.dispatchedAt!);
  assert.deepEqual(JSON.parse(seen!.requestBody), {
    quotes: plan.quoteIds, outputs: messages(plan.outputs), signatures: authorizations.map(authorization => authorization.signature),
  });
});

test('a failed save before dispatch sends nothing', async () => {
  const setup = await funded();
  const { plan, coordinator, coordinatorStorage, mint } = setup;
  const authorizations = await approveAll(setup);
  coordinatorStorage.failWrites = true;
  await assert.rejects(coordinator.payout(plan, authorizations, 'op-1'),
    (error: ProtocolError) => error.kind === 'storage' && /Nothing was sent/.test(error.message));
  assert.equal(mint.batchCalls().length, 0);
});

test('a 200 is confirmed only after the proofs verify, the quotes read ISSUED and the proofs are saved', async () => {
  const setup = await funded();
  const { plan, coordinator, mint, maintainerPubkey, operationWrites } = setup;
  const authorizations = await approveAll(setup);
  const settlement = await coordinator.payout(plan, authorizations, 'op-1');
  assert.equal(settlement.kind, 'confirmed');
  if (settlement.kind !== 'confirmed') return;
  assert.equal(settlement.destination, 'creator');
  assert.equal(settlement.proofs.reduce((sum, proof) => sum + proof.amount, 0), 63);
  for (const proof of settlement.proofs) {
    assert.equal(JSON.parse(proof.secret)[1].data, maintainerPubkey);
    assert.ok(proof.dleq);
  }
  const operation = await savedOperation(coordinator, 'op-1');
  assert.equal(operation.status, 'confirmed');
  assert.deepEqual(operation.proofs, settlement.proofs);
  assert.deepEqual(operationWrites, ['prepared', 'dispatched', 'confirmed']);
  assert.ok([...mint.quotes.values()].every(quote => quote.state === 'ISSUED'));
  assert.deepEqual(await coordinator.recovery.listUnresolved(), []);
});

test('confirmed is never reported when the proofs cannot be saved', async () => {
  const setup = await funded();
  const { plan, coordinator, coordinatorStorage, mint } = setup;
  const authorizations = await approveAll(setup);
  mint.batch = raw => {
    const response = mint.honest(raw);
    coordinatorStorage.failWrites = true;
    return response;
  };
  const settlement = await coordinator.payout(plan, authorizations, 'op-1');
  assert.equal(settlement.kind, 'pending');
  coordinatorStorage.failWrites = false;
  const operation = await savedOperation(coordinator, 'op-1');
  assert.equal(operation.status, 'dispatched');
  assert.equal(operation.proofs, undefined);
});

test('a 200 whose signatures do not verify stays unresolved', async () => {
  const bad: [string, (signatures: Record<string, unknown>[]) => unknown][] = [
    ['wrong count', signatures => signatures.slice(1)],
    ['bad dleq', signatures => signatures.map((signature, i) => i === 0 ? { ...signature, dleq: { ...signature.dleq as object, s: '11'.repeat(32) } } : signature)],
    ['wrong amount', signatures => signatures.map((signature, i) => i === 0 ? { ...signature, amount: 64 } : signature)],
    ['wrong C_', signatures => signatures.map((signature, i) => i === 0 ? { ...signature, C_: signatures[1].C_ } : signature)],
  ];
  for (const [name, change] of bad) {
    const setup = await funded();
    const { plan, coordinator, mint } = setup;
    const authorizations = await approveAll(setup);
    mint.batch = async raw => {
      const body = await mint.honest(raw).json() as { signatures: Record<string, unknown>[] };
      return json({ signatures: change(body.signatures) });
    };
    const settlement = await coordinator.payout(plan, authorizations, 'op-1');
    assert.equal(settlement.kind, 'pending', name);
    const operation = await savedOperation(coordinator, 'op-1');
    assert.equal(operation.status, 'unresolved', name);
    assert.ok(operation.response, name);
    assert.equal(operation.proofs, undefined, name);
  }
});

test('a Cashu 4xx is rejected and the deposits stay paid', async () => {
  const setup = await funded();
  const { plan, coordinator, mint, backers } = setup;
  const authorizations = await approveAll(setup);
  mint.batch = () => json({ code: 20008, detail: 'Signature missing or invalid' }, 400);
  const settlement = await coordinator.payout(plan, authorizations, 'op-1');
  assert.deepEqual(settlement, { kind: 'rejected', operationId: 'op-1', reason: '20008: Signature missing or invalid' });
  const operation = await savedOperation(coordinator, 'op-1');
  assert.equal(operation.status, 'rejected');
  assert.equal(operation.reason, '20008: Signature missing or invalid');
  assert.deepEqual(await coordinator.recovery.listUnresolved(), []);
  assert.ok([...mint.quotes.values()].every(quote => quote.state === 'PAID'));
  for (const backer of backers) assert.equal(backer.client.findDeposit(backer.quote.id)?.status, 'paid');
});

test('a network error, timeout or 5xx leaves the payout pending and unresolved', async () => {
  const answers: [string, () => Response | Promise<Response>][] = [
    ['network', () => Promise.reject(new TypeError('fetch failed'))],
    ['timeout', () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'))],
    ['502', () => json({ detail: 'bad gateway' }, 502)],
    ['4xx without a Cashu body', () => new Response('<html>rate limited</html>', { status: 429 })],
  ];
  for (const [name, answer] of answers) {
    const setup = await funded();
    const { plan, coordinator, mint } = setup;
    const authorizations = await approveAll(setup);
    mint.batch = answer;
    const settlement = await coordinator.payout(plan, authorizations, 'op-1');
    assert.deepEqual(settlement, { kind: 'pending', operationId: 'op-1' }, name);
    const operation = await savedOperation(coordinator, 'op-1');
    assert.equal(operation.status, 'unresolved', name);
    assert.equal(operation.proofs, undefined, name);
    assert.deepEqual((await coordinator.recovery.listUnresolved()).map(entry => entry.id), ['op-1'], name);
    assert.equal(mint.batchCalls().length, 1, name);
  }
});

test('a batch missing the third signature is refused here and rejected by the mint with nothing consumed', async () => {
  const setup = await funded();
  const { plan, coordinator, mint } = setup;
  const authorizations = await approveAll(setup);
  await assert.rejects(coordinator.payout(plan, authorizations.slice(0, 2), 'op-two'), (error: ProtocolError) => error.kind === 'authorization');
  assert.equal(mint.batchCalls().length, 0);

  const direct = await mint.fetchFor('coordinator')(`${TEST_MINT}/v1/mint/bolt11/batch`, {
    method: 'POST', body: JSON.stringify({
      quotes: plan.quoteIds, outputs: messages(plan.outputs), signatures: [authorizations[0].signature, authorizations[1].signature, null],
    }),
  });
  assert.equal(direct.status, 400);
  assert.equal((await direct.json()).code, 20008);
  assert.ok([...mint.quotes.values()].every(quote => quote.state === 'PAID'));

  assert.equal((await coordinator.payout(plan, authorizations, 'op-three')).kind, 'confirmed');
});

test('the maintainer signs payout proofs with a JSON-string witness', async () => {
  const setup = await funded();
  const { plan, coordinator, maintainer, maintainerPubkey } = setup;
  const settlement = await coordinator.payout(plan, await approveAll(setup), 'op-1');
  assert.equal(settlement.kind, 'confirmed');
  if (settlement.kind !== 'confirmed') return;
  const inputs = maintainer.signLockedProofs(maintainerPubkey, settlement.proofs);
  for (const input of inputs) {
    assert.equal(typeof input.witness, 'string');
    assert.match(JSON.parse(input.witness!).signatures[0], /^[0-9a-f]{128}$/);
  }
  assert.throws(() => coordinator.signLockedProofs(maintainerPubkey, settlement.proofs), (error: ProtocolError) => error.kind === 'invalid-key');
  assert.equal(inputFee(inputs.length, plan.keyset.inputFeePpk), 1);
});
