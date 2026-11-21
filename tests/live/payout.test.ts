import assert from 'node:assert/strict';
import test from 'node:test';
import { Amount, OutputData, hashToCurve, type MintKeys } from '@cashu/cashu-ts';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { TEST_MINT, type Authorization, type BlindedOutput, type LockedQuote, type RecoveryOperation } from '../../src/domain/models';
import { inputFee, messages } from '../../src/protocol/batch';
import { ProtocolError, createProtocolClient, type CampaignTerms } from '../../src/protocol/client';
import { secretKeyFor } from '../../src/protocol/keys';
import { createRecordStore, memoryStorage, type StorageLike } from '../../src/protocol/storage';
import { checker, evidence, type Checks } from './evidence';

const live = process.env.PLEB_LIVE === '1';
const CHECK_COUNT = 23;
const started = new Date().toISOString();
const { dir, save, recording, call, contains } = evidence('live-payout', started);

function keys(storage: StorageLike) {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)!);
}

function wire(data: OutputData[]): BlindedOutput[] {
  return data.map(output => ({ ...output.blindedMessage, amount: Number(output.blindedMessage.amount.toBigInt()) }));
}

test('three backers approve one batch at testnut that pays 63 sats to the maintainer', { skip: !live && 'set PLEB_LIVE=1 to run against testnut' }, async () => {
  const checks: Checks = {};
  const check = checker(checks);
  const secrets: string[] = [];
  let fee: number | undefined;
  let net: number | undefined;

  try {
    const maintainerStorage = memoryStorage();
    const maintainer = createProtocolClient({ storage: maintainerStorage, fetch: recording('maintainer') });
    const maintainerPubkey = maintainer.enrollMaintainer('maintainer');
    secrets.push(bytesToHex(secretKeyFor(createRecordStore(maintainerStorage), maintainerPubkey)!));
    const campaign: CampaignTerms = {
      id: `live-${started}`, mint: TEST_MINT, beneficiaryPubkey: maintainerPubkey, backerCount: 3, contributionSat: 21,
    };

    const backers = ['backer-1', 'backer-2', 'backer-3'].map(role => {
      const storage = memoryStorage();
      const client = createProtocolClient({ storage, fetch: recording(role) });
      const pubkey = client.enrollKey(role);
      secrets.push(bytesToHex(secretKeyFor(createRecordStore(storage), pubkey)!));
      return { role, storage, client, pubkey };
    });
    save('identities', [
      { role: 'maintainer', pubkey: maintainerPubkey },
      ...backers.map(({ role, pubkey }) => ({ role, pubkey })),
      { role: 'coordinator', pubkey: null, keyStorage: 'none' },
    ]);

    const quotes: LockedQuote[] = [];
    for (const backer of backers) {
      const created = await backer.client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: backer.pubkey });
      quotes.push(await backer.client.waitForDeposit(created.id, { timeoutMs: 120_000 }));
    }
    assert.ok(check('1: three locked deposits PAID and unissued', quotes.every(quote => quote.mintState === 'PAID'),
      quotes.map(quote => quote.id).join(', ')));

    // The coordinator's storage and network calls share one timeline, so save-before-send is visible in order.
    const timeline: { at: string; event: string }[] = [];
    const coordinatorStorage = memoryStorage();
    const setItem = coordinatorStorage.setItem.bind(coordinatorStorage);
    coordinatorStorage.setItem = (key, value) => {
      setItem(key, value);
      if (key.startsWith('plebstack:operation:')) {
        timeline.push({ at: new Date().toISOString(), event: `saved ${(JSON.parse(value).value as RecoveryOperation).status}` });
      }
    };
    const coordinator = createProtocolClient({
      storage: coordinatorStorage,
      fetch: recording('coordinator', path => timeline.push({ at: new Date().toISOString(), event: `sent ${path}` })),
    });

    const plan = await coordinator.preparePayout(campaign, quotes);
    save('package', plan);
    const amounts = plan.outputs.map(output => output.message.amount);
    assert.ok(check('2: package is 63 sats on the active sat keyset', plan.totalSat === 63 && amounts.reduce((a, b) => a + b, 0) === 63,
      `keyset ${plan.keyset.id}, outputs ${amounts.join('+')}`));

    const authorizations: Authorization[] = [];
    for (const [i, backer] of backers.entries()) {
      const authorization = await backer.client.authorizeBatch(campaign, plan, quotes[i], backer.client.signerFor(backer.pubkey));
      authorizations.push(authorization);
      const release = backer.client.findRelease(quotes[i].id);
      save(`${backer.role}-release`, release);
      assert.ok(check(`3: ${backer.role} verified the package and saved its release`, release?.signature === authorization.signature,
        release?.releasedAt));
    }

    const stored = keys(coordinatorStorage);
    const raw = stored.map(key => coordinatorStorage.getItem(key)!).join('\n');
    assert.ok(check('4: coordinator storage holds no key records and no private key',
      stored.every(key => !key.startsWith('plebstack:key:') && !key.startsWith('plebstack:owner:')) && !secrets.some(secret => raw.includes(secret)),
      stored.join(', ')));

    const sentBefore = timeline.filter(entry => entry.event === 'sent /v1/mint/bolt11/batch').length;
    let refused = '';
    try {
      await coordinator.payout(plan, authorizations.slice(0, 2), 'live-payout-two');
    } catch (error) {
      if (error instanceof ProtocolError && error.kind === 'authorization') refused = error.message;
      else throw error;
    }
    const sentAfter = timeline.filter(entry => entry.event === 'sent /v1/mint/bolt11/batch').length;
    assert.ok(check('5: payout() refuses two approvals without contacting the mint',
      refused !== '' && sentAfter === sentBefore && (await coordinator.recovery.get('live-payout-two')) === undefined, refused));

    const body = { quotes: plan.quoteIds, outputs: messages(plan.outputs) };
    const missing = await call('coordinator', '/v1/mint/bolt11/batch', {
      ...body, signatures: [authorizations[0].signature, authorizations[1].signature, null],
    });
    assert.ok(check('6: mint rejects the batch with the third signature missing',
      missing.status >= 400 && missing.status < 500 && typeof missing.body.code === 'number', `HTTP ${missing.status} ${JSON.stringify(missing.body)}`));
    const invalid = await call('coordinator', '/v1/mint/bolt11/batch', {
      ...body, signatures: [authorizations[0].signature, authorizations[1].signature, '00'.repeat(64)],
    });
    assert.ok(check('7: mint rejects the batch with the third signature invalid',
      invalid.status >= 400 && invalid.status < 500 && typeof invalid.body.code === 'number', `HTTP ${invalid.status} ${JSON.stringify(invalid.body)}`));

    const untouched = [];
    for (const quote of quotes) untouched.push((await call('coordinator', `/v1/mint/quote/bolt11/${quote.id}`)).body);
    assert.ok(check('8: all three quotes still PAID and unissued after both rejections',
      untouched.every(quote => quote.state === 'PAID' && quote.amount_issued === 0), untouched.map(quote => quote.state).join(', ')));

    const settlement = await coordinator.payout(plan, authorizations, 'live-payout');
    save('settlement', settlement);
    assert.equal(settlement.kind, 'confirmed', JSON.stringify(settlement));
    if (settlement.kind !== 'confirmed') return;
    const total = settlement.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    assert.ok(check('9: payout() confirmed 63 sats to the creator', settlement.destination === 'creator' && total === 63,
      `${total} sats in ${settlement.proofs.length} proofs`));
    assert.ok(check('10: every proof is a P2PK lock to the maintainer with no tags and a DLEQ proof',
      settlement.proofs.every(proof => {
        const [kind, secret] = JSON.parse(proof.secret);
        return kind === 'P2PK' && secret.data === maintainerPubkey && secret.tags.length === 0 && proof.dleq !== undefined;
      })));

    const issued = [];
    for (const quote of quotes) issued.push((await call('coordinator', `/v1/mint/quote/bolt11/${quote.id}`)).body);
    assert.ok(check('11: all three quotes ISSUED', issued.every(quote => quote.state === 'ISSUED' && quote.amount_issued === 21),
      issued.map(quote => `${quote.state}/${quote.amount_issued}`).join(', ')));

    const operation = (await coordinator.recovery.get('live-payout'))!;
    save('coordinator-operation', operation);
    save('coordinator-timeline', timeline);
    const order = ['saved prepared', 'saved dispatched', 'sent /v1/mint/bolt11/batch', 'saved confirmed']
      .map(event => timeline.findIndex(entry => entry.event === event));
    assert.ok(check('12: operation saved prepared, then dispatched, before the batch was sent',
      order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1])) && operation.createdAt <= operation.dispatchedAt!,
      `createdAt ${operation.createdAt}, dispatchedAt ${operation.dispatchedAt}, settledAt ${operation.settledAt}`));
    assert.ok(check('13: operation confirmed with the proofs saved',
      operation.status === 'confirmed' && JSON.stringify(operation.proofs) === JSON.stringify(settlement.proofs)));
    assert.ok(check('14: saved request body is the exact batch body sent',
      JSON.parse(operation.requestBody).signatures.length === 3 && operation.requestBody === JSON.stringify({
        ...body, signatures: authorizations.map(authorization => authorization.signature),
      })));

    const keysets = (await call('maintainer', '/v1/keysets')).body.keysets as { id: string; input_fee_ppk?: number }[];
    const feePpk = keysets.find(keyset => keyset.id === plan.keyset.id)?.input_fee_ppk ?? 0;
    const keyset = ((await call('maintainer', `/v1/keys/${plan.keyset.id}`)).body.keysets as MintKeys[])[0];
    fee = inputFee(settlement.proofs.length, feePpk);

    const unsignedOutputs = wire(OutputData.createRandomData(63 - fee, keyset));
    const unsigned = await call('coordinator', '/v1/swap', { inputs: settlement.proofs, outputs: unsignedOutputs });
    assert.ok(check('15: spending the payout proofs without the maintainer key is rejected',
      unsigned.status >= 400 && unsigned.status < 500, `HTTP ${unsigned.status} ${JSON.stringify(unsigned.body)}`));

    const inputs = maintainer.signLockedProofs(maintainerPubkey, settlement.proofs);
    assert.ok(check('16: witnesses are JSON strings', inputs.every(input => typeof input.witness === 'string')));
    const data = OutputData.createRandomData(63 - fee, keyset);
    const swap = await call('maintainer', '/v1/swap', { inputs, outputs: wire(data) });
    assert.ok(check('17: maintainer swap accepted', swap.status === 200, `HTTP ${swap.status}`));
    const signatures = swap.body.signatures as { amount: number; id: string; C_: string; dleq?: { e: string; s: string } }[];
    const received = data.map((output, i) => output.toProof({ ...signatures[i], amount: Amount.from(signatures[i].amount) }, keyset));
    net = received.reduce((sum, proof) => sum + proof.amount.toNumber(), 0);
    save('maintainer-swap-summary', { inputs: inputs.length, feePpk, fee, gross: 63, net, amounts: received.map(proof => proof.amount.toNumber()) });
    assert.ok(check('18: maintainer receives 63 minus the input fee', net === 63 - fee, `fee ${fee} sat (${feePpk} ppk x ${inputs.length} inputs), net ${net}`));

    const Ys = settlement.proofs.map(proof => hashToCurve(utf8ToBytes(proof.secret)).toHex(true));
    const states = (await call('maintainer', '/v1/checkstate', { Ys })).body.states as { state: string }[];
    assert.ok(check('19: all payout proofs SPENT', states.length === Ys.length && states.every(entry => entry.state === 'SPENT'),
      states.map(entry => entry.state).join(', ')));

    assert.ok(check('20: backers still hold their own releases; the coordinator holds none',
      backers.every((backer, i) => backer.client.findRelease(quotes[i].id) !== undefined)
      && keys(coordinatorStorage).every(key => !key.startsWith('plebstack:release:'))));
  } finally {
    const leaked = contains(secrets);
    check('21: no private key written to evidence', leaked.length === 0, leaked.join(', ') || `${secrets.length} keys searched`);
    const pass = Object.keys(checks).length === CHECK_COUNT && Object.values(checks).every(entry => entry.pass);
    save('summary', { mint: TEST_MINT, started, finished: new Date().toISOString(), pass, fee, net, checks });
    console.log(`evidence: ${dir}`);
    if (leaked.length) throw new Error(`Private key found in ${leaked.join(', ')}`);
  }
});
