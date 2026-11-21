import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Amount, OutputData, schnorrSignDigest, type MintKeys } from '@cashu/cashu-ts';
import { TEST_MINT, type BlindedOutput } from '../../src/domain/models';
import { createProtocolClient, type ProtocolClient } from '../../src/protocol/client';
import { secretKeyFor } from '../../src/protocol/keys';
import type { FetchLike } from '../../src/protocol/mint';
import { mintQuoteDigest } from '../../src/protocol/signer';
import { createRecordStore, memoryStorage } from '../../src/protocol/storage';

const live = process.env.PLEB_LIVE === '1';
const CHECK_COUNT = 11;
const started = new Date().toISOString();
const evidence = join(import.meta.dirname, '../../.evidence', `live-deposit-${started.replace(/[:.]/g, '-')}`);
let sequence = 0;

function save(name: string, value: unknown) {
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}

// Every mint call is written out as sent and as answered. Requests carry pubkeys and signatures, never keys.
function recording(role: string): FetchLike {
  return async (url, init) => {
    const sentAt = new Date().toISOString();
    const response = await fetch(url, init);
    const raw = await response.text();
    let body: unknown = raw;
    try { body = JSON.parse(raw); } catch { /* keep raw */ }
    const label = new URL(url).pathname.replace(/^\/v1\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
    save(`${String(++sequence).padStart(3, '0')}-${role}-${label}`, {
      role, sentAt, receivedAt: new Date().toISOString(),
      request: { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined },
      response: { status: response.status, raw, body },
    });
    return new Response(raw, { status: response.status });
  };
}

async function call(role: string, path: string, body?: unknown) {
  const response = await recording(role)(TEST_MINT + path, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

function wire(data: OutputData[]): BlindedOutput[] {
  return data.map(output => ({ ...output.blindedMessage, amount: Number(output.blindedMessage.amount.toBigInt()) }));
}

test('three locked deposits at testnut, and only the owner can mint one', { skip: !live && 'set PLEB_LIVE=1 to run against testnut' }, async () => {
  const checks: Record<string, { pass: boolean; detail?: string }> = {};
  const check = (name: string, pass: boolean, detail?: string) => {
    checks[name] = { pass, ...(detail ? { detail } : {}) };
    return pass;
  };

  try {
    const backers = ['backer-1', 'backer-2', 'backer-3'].map(role => {
      const storage = memoryStorage();
      const client: ProtocolClient = createProtocolClient({ storage, fetch: recording(role) });
      const pubkey = client.enrollKey(role);
      return { role, storage, client, pubkey };
    });
    assert.equal(new Set(backers.map(backer => backer.pubkey)).size, 3);
    save('identities', backers.map(({ role, pubkey }) => ({ role, pubkey, keyStorage: 'in-memory storage of this test only' })));

    const quotes = [];
    for (const backer of backers) {
      const quote = await backer.client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: backer.pubkey });
      assert.ok(check(`${backer.role} quote echoes own pubkey`, quote.ownerPubkey === backer.pubkey, quote.id));
      quotes.push(quote);
    }

    for (const [i, backer] of backers.entries()) {
      const paid = await backer.client.waitForDeposit(quotes[i].id, { timeoutMs: 120_000 });
      const record = backer.client.findDeposit(quotes[i].id)!;
      assert.ok(check(`${backer.role} PAID and unissued`,
        paid.mintState === 'PAID' && record.status === 'paid' && record.quote?.amountPaid === 21 && record.quote.amountIssued === 0,
        `${record.quote?.state} paid ${record.quote?.amountPaid} issued ${record.quote?.amountIssued}`));
    }

    const keysets = (await call('coordinator', '/v1/keysets')).body.keysets as { id: string; unit: string; active: boolean }[];
    const active = keysets.find(keyset => keyset.active && keyset.unit === 'sat');
    assert.ok(active, 'No active sat keyset');
    const keyset = ((await call('coordinator', `/v1/keys/${active.id}`)).body.keysets as MintKeys[])[0];

    const [one, two] = backers;
    const target = quotes[0].id;

    const unsignedOutputs = wire(OutputData.createRandomData(21, keyset));
    const unsigned = await call(one.role, '/v1/mint/bolt11', { quote: target, outputs: unsignedOutputs });
    assert.ok(check('a: unsigned mint rejected', unsigned.status >= 400, JSON.stringify(unsigned.body)));

    const foreignOutputs = wire(OutputData.createRandomData(21, keyset));
    const twoKey = secretKeyFor(createRecordStore(two.storage), two.pubkey)!;
    const foreign = await call(two.role, '/v1/mint/bolt11', {
      quote: target, outputs: foreignOutputs, signature: schnorrSignDigest(mintQuoteDigest(target, foreignOutputs), twoKey),
    });
    assert.ok(check('b: mint signed by another backer rejected', foreign.status >= 400, JSON.stringify(foreign.body)));

    const between = await one.client.checkDeposit(target);
    assert.ok(check('c: still PAID and unissued after both attempts', between.paid, between.quote.mintState));

    const data = OutputData.createRandomData(21, keyset);
    const outputs = wire(data);
    const signature = await one.client.signerFor(one.pubkey).signQuote(target, outputs);
    const minted = await call(one.role, '/v1/mint/bolt11', { quote: target, outputs, signature });
    const signatures = (minted.body.signatures ?? []) as { amount: number; id: string; C_: string }[];
    const proofs = minted.status === 200
      ? data.map((output, i) => output.toProof({ ...signatures[i], amount: Amount.from(signatures[i].amount) }, keyset))
      : [];
    const total = proofs.reduce((sum, proof) => sum + proof.amount.toNumber(), 0);
    save('backer-1-reclaim-proofs-summary', { quote: target, count: proofs.length, amounts: proofs.map(proof => proof.amount.toNumber()), total });
    assert.ok(check('d: owner mint signed by the browser signer issues 21 sats', minted.status === 200 && total === 21,
      `HTTP ${minted.status}, ${total} sats in ${proofs.length} proofs`));

    const after = await call('coordinator', `/v1/mint/quote/bolt11/${target}`);
    assert.ok(check('d: quote reads ISSUED afterwards', after.body.state === 'ISSUED' && after.body.amount_issued === 21,
      `${after.body.state} issued ${after.body.amount_issued}`));
  } finally {
    const pass = Object.keys(checks).length === CHECK_COUNT && Object.values(checks).every(entry => entry.pass);
    save('summary', { mint: TEST_MINT, started, finished: new Date().toISOString(), pass, checks });
  }
});
