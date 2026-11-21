import assert from 'node:assert/strict';
import test from 'node:test';
import { OutputData, schnorrSignDigest } from '@cashu/cashu-ts';
import { bytesToHex } from '@noble/hashes/utils.js';
import { TEST_MINT, type Authorization, type BlindedOutput, type LockedQuote, type Settlement } from '../../src/domain/models';
import { ProtocolError, createProtocolClient, type CampaignTerms, type ProtocolClient } from '../../src/protocol/client';
import { keysetById } from '../../src/protocol/mint';
import { secretKeyFor } from '../../src/protocol/keys';
import { mintQuoteDigest } from '../../src/protocol/signer';
import { createRecordStore, memoryStorage, type StorageLike } from '../../src/protocol/storage';
import { checker, evidence, type Checks } from './evidence';

const live = process.env.PLEB_LIVE === '1';
const CHECK_COUNT = 23;
const started = new Date().toISOString();
const { dir, save, recording, call, contains } = evidence('live-reclaim', started);

interface Backer {
  role: string;
  storage: StorageLike;
  client: ProtocolClient;
  pubkey: string;
  quote: LockedQuote;
}

function wire(data: OutputData[]): BlindedOutput[] {
  return data.map(output => ({ ...output.blindedMessage, amount: Number(output.blindedMessage.amount.toBigInt()) }));
}

const total = (settlement: Settlement) => settlement.kind === 'confirmed' ? settlement.proofs.reduce((sum, proof) => sum + proof.amount, 0) : 0;

test('owners reclaim their own deposits at testnut, strangers cannot, and both race orders settle honestly', { skip: !live && 'set PLEB_LIVE=1 to run against testnut' }, async () => {
  const checks: Checks = {};
  const check = checker(checks);
  const secrets: string[] = [];
  const identities: unknown[] = [];
  const sent = new Map<string, number>();

  async function backers(group: string, count: number): Promise<Backer[]> {
    const made: Backer[] = [];
    for (let i = 1; i <= count; i += 1) {
      const role = `${group}-backer-${i}`;
      const storage = memoryStorage();
      const client = createProtocolClient({ storage, fetch: recording(role, () => sent.set(role, (sent.get(role) ?? 0) + 1)) });
      const pubkey = client.enrollKey(role);
      secrets.push(bytesToHex(secretKeyFor(createRecordStore(storage), pubkey)!));
      identities.push({ role, pubkey });
      const created = await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
      made.push({ role, storage, client, pubkey, quote: await client.waitForDeposit(created.id, { timeoutMs: 120_000 }) });
    }
    return made;
  }

  function maintainerAndCoordinator(group: string) {
    const maintainerStorage = memoryStorage();
    const maintainer = createProtocolClient({ storage: maintainerStorage, fetch: recording(`${group}-maintainer`) });
    const beneficiaryPubkey = maintainer.enrollMaintainer(group);
    secrets.push(bytesToHex(secretKeyFor(createRecordStore(maintainerStorage), beneficiaryPubkey)!));
    identities.push({ role: `${group}-maintainer`, pubkey: beneficiaryPubkey }, { role: `${group}-coordinator`, pubkey: null, keyStorage: 'none' });
    const coordinator = createProtocolClient({ storage: memoryStorage(), fetch: recording(`${group}-coordinator`) });
    const campaign: CampaignTerms = { id: `${group}-${started}`, mint: TEST_MINT, beneficiaryPubkey, backerCount: 3, contributionSat: 21 };
    return { coordinator, campaign };
  }

  async function signAll(campaign: CampaignTerms, plan: Awaited<ReturnType<ProtocolClient['preparePayout']>>, group: Backer[]) {
    const authorizations: Authorization[] = [];
    for (const backer of group) {
      authorizations.push(await backer.client.authorizeBatch(campaign, plan, backer.quote, backer.client.signerFor(backer.pubkey)));
    }
    return authorizations;
  }

  async function states(role: string, quotes: LockedQuote[]) {
    const found = [];
    for (const quote of quotes) found.push((await call(role, `/v1/mint/quote/bolt11/${quote.id}`)).body.state as string);
    return found;
  }

  try {
    // Unmet campaign: two deposits, no payout.
    const unmet = await backers('unmet', 2);
    const [owner, stranger] = unmet;

    let refused = '';
    const before = sent.get(stranger.role);
    try {
      await stranger.client.reclaim(owner.quote.id, 'unmet-foreign-local');
    } catch (error) {
      if (error instanceof ProtocolError && error.kind === 'not-owner') refused = error.message;
      else throw error;
    }
    assert.ok(check('1: reclaim() refuses another backer’s quote before any request',
      refused !== '' && sent.get(stranger.role) === before && (await stranger.client.recovery.get('unmet-foreign-local')) === undefined,
      refused));

    const keysets = (await call('observer', '/v1/keysets')).body.keysets as { id: string; unit: string; active: boolean }[];
    const keyset = await keysetById(fetch, TEST_MINT, keysets.find(entry => entry.active && entry.unit === 'sat')!.id);
    const foreignOutputs = wire(OutputData.createRandomData(21, keyset));
    const strangerKey = secretKeyFor(createRecordStore(stranger.storage), stranger.pubkey)!;
    const foreign = await call(stranger.role, '/v1/mint/bolt11', {
      quote: owner.quote.id, outputs: foreignOutputs, signature: schnorrSignDigest(mintQuoteDigest(owner.quote.id, foreignOutputs), strangerKey),
    });
    assert.ok(check('2: the mint rejects a reclaim of that quote signed with another backer’s key',
      foreign.status >= 400 && foreign.status < 500 && typeof foreign.body.code === 'number', `HTTP ${foreign.status} ${JSON.stringify(foreign.body)}`));
    assert.ok(check('3: both quotes still PAID after the foreign attempt',
      (await states('observer', unmet.map(backer => backer.quote))).every(state => state === 'PAID')));

    const own = await owner.client.reclaim(owner.quote.id, 'unmet-own-reclaim');
    save('unmet-own-reclaim-settlement', own);
    assert.ok(check('4: the owner’s reclaim confirms 21 sats to their own outputs',
      own.kind === 'confirmed' && own.destination === 'owner' && total(own) === 21 && own.proofs.every(proof => proof.dleq),
      `${own.kind}, ${total(own)} sats`));
    const ownOperation = (await owner.client.recovery.get('unmet-own-reclaim'))!;
    save('unmet-own-reclaim-operation', ownOperation);
    assert.ok(check('5: operation saved and confirmed with the proofs; the deposit reads reclaimed',
      ownOperation.status === 'confirmed' && ownOperation.proofs?.length === (own.kind === 'confirmed' ? own.proofs.length : -1)
      && owner.client.findDeposit(owner.quote.id)?.status === 'reclaimed'
      && ownOperation.createdAt <= ownOperation.dispatchedAt! && ownOperation.dispatchedAt! <= ownOperation.settledAt!,
      `created ${ownOperation.createdAt}, dispatched ${ownOperation.dispatchedAt}, settled ${ownOperation.settledAt}`));
    const afterOwn = await states('observer', unmet.map(backer => backer.quote));
    assert.ok(check('6: owner’s quote ISSUED, the other still PAID', afterOwn.join() === 'ISSUED,PAID', afterOwn.join(', ')));
    const second = await stranger.client.reclaim(stranger.quote.id, 'unmet-other-reclaim');
    assert.ok(check('7: the other backer later reclaims their own', second.kind === 'confirmed' && total(second) === 21));

    // Race a: payout first.
    const a = await backers('race-a', 3);
    const raceA = maintainerAndCoordinator('race-a');
    const planA = await raceA.coordinator.preparePayout(raceA.campaign, a.map(backer => backer.quote));
    const authA = await signAll(raceA.campaign, planA, a);
    assert.ok(check('8: race a, three signatures released', authA.length === 3));
    await a[0].client.signerFor(a[0].pubkey).stopNewApprovals(a[0].quote.id);
    const payoutA = await raceA.coordinator.payout(planA, authA, 'race-a-payout');
    save('race-a-payout-settlement', { kind: payoutA.kind, total: total(payoutA) });
    assert.ok(check('9: race a, the payout confirms 63 sats despite the later local stop',
      payoutA.kind === 'confirmed' && payoutA.destination === 'creator' && total(payoutA) === 63));
    const lateA = await a[0].client.reclaim(a[0].quote.id, 'race-a-late-reclaim');
    save('race-a-late-reclaim-settlement', lateA);
    assert.ok(check('10: race a, the late reclaim is rejected by the mint',
      lateA.kind === 'rejected' && /^\d+: /.test(lateA.reason), lateA.kind === 'rejected' ? lateA.reason : lateA.kind));
    const recordA = a[0].client.findDeposit(a[0].quote.id)!;
    assert.ok(check('11: race a, the backer’s record says issued, never reclaimed',
      recordA.status === 'issued' && recordA.quote?.state === 'ISSUED', recordA.status));
    assert.ok(check('12: race a, the reclaim operation is rejected and nothing is unresolved',
      (await a[0].client.recovery.get('race-a-late-reclaim'))?.status === 'rejected' && (await a[0].client.recovery.listUnresolved()).length === 0));
    const statesA = await states('observer', a.map(backer => backer.quote));
    assert.ok(check('13: race a, all three quotes ISSUED', statesA.every(state => state === 'ISSUED'), statesA.join(', ')));

    // Race b: reclaim first.
    const b = await backers('race-b', 3);
    const raceB = maintainerAndCoordinator('race-b');
    const planB = await raceB.coordinator.preparePayout(raceB.campaign, b.map(backer => backer.quote));
    save('race-b-package', planB);
    const authB = await signAll(raceB.campaign, planB, b);
    assert.ok(check('14: race b, three signatures released', authB.length === 3 && b.every(backer => backer.client.findRelease(backer.quote.id))));
    const firstB = await b[0].client.reclaim(b[0].quote.id, 'race-b-reclaim-first');
    save('race-b-reclaim-first-settlement', firstB);
    assert.ok(check('15: race b, the signed backer’s reclaim confirms 21 sats', firstB.kind === 'confirmed' && total(firstB) === 21));
    const midB = await raceB.coordinator.checkQuotes(TEST_MINT, planB.quoteIds);
    assert.ok(check('16: race b, ISSUED / PAID / PAID before the batch', midB.join() === 'ISSUED,PAID,PAID', midB.join(', ')));
    const stale = await raceB.coordinator.payout(planB, authB, 'race-b-stale-payout');
    save('race-b-stale-payout-settlement', stale);
    assert.ok(check('17: race b, the stale batch is rejected by the mint',
      stale.kind === 'rejected' && /^\d+: /.test(stale.reason), stale.kind === 'rejected' ? stale.reason : stale.kind));
    assert.ok(check('18: race b, the payout operation is saved as rejected',
      (await raceB.coordinator.recovery.get('race-b-stale-payout'))?.status === 'rejected'));
    const afterStale = await raceB.coordinator.checkQuotes(TEST_MINT, planB.quoteIds);
    assert.ok(check('19: race b, the other two quotes still PAID and unissued after the stale batch',
      afterStale.join() === 'ISSUED,PAID,PAID' && b.slice(1).every(backer => backer.client.findDeposit(backer.quote.id)?.status === 'paid'),
      afterStale.join(', ')));
    for (const backer of b.slice(1)) {
      const settlement = await backer.client.reclaim(backer.quote.id, `${backer.role}-own-reclaim`);
      assert.ok(check(`20: race b, ${backer.role} reclaims their own 21 sats`, settlement.kind === 'confirmed' && total(settlement) === 21));
    }
    const finalB = await raceB.coordinator.checkQuotes(TEST_MINT, planB.quoteIds);
    assert.ok(check('21: race b, all three quotes ISSUED, each to its owner', finalB.every(state => state === 'ISSUED'), finalB.join(', ')));
  } finally {
    save('identities', identities);
    const leaked = contains(secrets);
    check('22: no private key written to evidence', leaked.length === 0, leaked.join(', ') || `${secrets.length} keys searched`);
    const pass = Object.keys(checks).length === CHECK_COUNT && Object.values(checks).every(entry => entry.pass);
    save('summary', { mint: TEST_MINT, started, finished: new Date().toISOString(), pass, checks });
    console.log(`evidence: ${dir}`);
    if (leaked.length) throw new Error(`Private key found in ${leaked.join(', ')}`);
  }
});
