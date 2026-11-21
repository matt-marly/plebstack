import assert from 'node:assert/strict';
import test from 'node:test';
import { createRandomSecretKey, getPubKeyFromPrivKey } from '@cashu/cashu-ts';
import { bytesToHex } from '@noble/hashes/utils.js';
import { TEST_MINT } from '../src/domain/models';
import { ProtocolError, createProtocolClient } from '../src/protocol/client';
import { listDeposits } from '../src/protocol/deposits';
import { isValidPubkey } from '../src/protocol/keys';
import { createRecordStore, memoryStorage } from '../src/protocol/storage';

const QUOTE_ID = '01a1d22d-7261-7257-b127-0a87a8f6c7e2';

function quoteBody(pubkey: string | null, change: Record<string, unknown> = {}) {
  return {
    quote: QUOTE_ID, request: 'lnbc210n1p40v52y', amount: 21, unit: 'sat', method: 'bolt11',
    amount_paid: 0, amount_issued: 0, state: 'UNPAID', expiry: 1794528156, pubkey, ...change,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(answer: (url: string, init: RequestInit | undefined, call: number) => Response | Promise<Response>) {
  const storage = memoryStorage();
  const calls: { url: string; body?: unknown }[] = [];
  const client = createProtocolClient({
    storage,
    fetch: async (url, init) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return answer(url, init, calls.length);
    },
    sleep: async (_ms, signal) => { if (signal?.aborted) throw signal.reason; },
  });
  const records = () => listDeposits(createRecordStore(storage));
  return { storage, client, calls, records };
}

test('key and pending record are saved before the quote request is sent', async () => {
  let seenAtFetch: ReturnType<typeof listDeposits> = [];
  let keySaved = false;
  const { storage, client, records } = setup(url => {
    seenAtFetch = listDeposits(createRecordStore(storage));
    keySaved = createRecordStore(storage).read(`key:${pubkey}`) !== undefined;
    assert.equal(url, `${TEST_MINT}/v1/mint/quote/bolt11`);
    return json(quoteBody(pubkey));
  });
  const pubkey = client.enrollKey('backer:ishaan');
  const quote = await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });

  assert.ok(keySaved);
  assert.equal(seenAtFetch.length, 1);
  assert.equal(seenAtFetch[0].status, 'requested');
  assert.equal(seenAtFetch[0].ownerPubkey, pubkey);
  assert.equal(seenAtFetch[0].amountSat, 21);
  assert.equal(seenAtFetch[0].quote, undefined);

  const [saved] = records();
  assert.equal(saved.status, 'quoted');
  assert.deepEqual(saved.quote, { id: QUOTE_ID, request: 'lnbc210n1p40v52y', state: 'UNPAID', expiry: 1794528156, amountPaid: 0, amountIssued: 0 });
  assert.deepEqual(quote, { id: QUOTE_ID, mint: TEST_MINT, ownerPubkey: pubkey, amountSat: 21, invoice: 'lnbc210n1p40v52y', mintState: 'UNPAID' });
});

test('the request sends exactly the amount, unit and owner pubkey', async () => {
  const { client, calls } = setup(() => json(quoteBody(pubkey)));
  const pubkey = client.enrollKey('backer:tobi');
  await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  assert.deepEqual(calls[0].body, { amount: 21, unit: 'sat', pubkey });
});

test('the quote is saved before createQuote resolves, and a failed save hides the invoice', async () => {
  const { storage, client, records } = setup(() => {
    storage.failWrites = true;
    return json(quoteBody(pubkey));
  });
  const pubkey = client.enrollKey('backer:maren');
  await assert.rejects(client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey }),
    (error: ProtocolError) => error.kind === 'storage');
  assert.equal(records()[0].status, 'requested');
});

test('a quote not locked to our pubkey is rejected and never recorded as deposited', async () => {
  const other = bytesToHex(getPubKeyFromPrivKey(createRandomSecretKey()));
  for (const echoed of [other, null]) {
    const { client, records } = setup(() => json(quoteBody(echoed, { state: 'PAID', amount_paid: 21 })));
    const pubkey = client.enrollKey('backer:ishaan');
    await assert.rejects(client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey }),
      (error: ProtocolError) => error.kind === 'not-locked');
    const [record] = records();
    assert.equal(record.status, 'failed');
    assert.equal(record.quote, undefined);
    assert.equal(client.findDeposit(QUOTE_ID), undefined);
  }
});

test('a storage failure aborts before any network call', async () => {
  const { storage, client, calls } = setup(() => json(quoteBody(null)));
  storage.failWrites = true;
  await assert.rejects(async () => client.enrollKey('backer:ishaan'), (error: ProtocolError) => error.kind === 'storage');

  storage.failWrites = false;
  const pubkey = client.enrollKey('backer:ishaan');
  storage.failWrites = true;
  await assert.rejects(client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey }),
    (error: ProtocolError) => error.kind === 'storage' && /Nothing was sent/.test(error.message));
  assert.equal(calls.length, 0);
});

test('a pubkey whose key is not in this browser is refused before any network call', async () => {
  const { client, calls } = setup(() => json(quoteBody(null)));
  const stranger = bytesToHex(getPubKeyFromPrivKey(createRandomSecretKey()));
  await assert.rejects(client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: stranger }),
    (error: ProtocolError) => error.kind === 'invalid-key');
  assert.equal(calls.length, 0);
});

test('polling reaches PAID with nothing issued and saves each change', async () => {
  const states = [
    quoteBody(null, { state: 'UNPAID' }),
    quoteBody(null, { state: 'UNPAID' }),
    quoteBody(null, { state: 'PAID', amount_paid: 21 }),
  ];
  const { client, records } = setup((url, _init, call) => {
    if (call === 1) return json(quoteBody(pubkey));
    assert.equal(url, `${TEST_MINT}/v1/mint/quote/bolt11/${QUOTE_ID}`);
    return json({ ...states[call - 2], pubkey });
  });
  const pubkey = client.enrollKey('backer:ishaan');
  await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  const quote = await client.waitForDeposit(QUOTE_ID);
  assert.equal(quote.mintState, 'PAID');
  const [record] = records();
  assert.equal(record.status, 'paid');
  assert.equal(record.quote?.amountPaid, 21);
  assert.equal(record.quote?.amountIssued, 0);
});

test('a mint outage while polling is retried, not reported as a failure', async () => {
  const { client } = setup((_url, _init, call) => {
    if (call === 1) return json(quoteBody(pubkey));
    if (call === 2) return json({ detail: 'busy' }, 503);
    return json(quoteBody(pubkey, { state: 'PAID', amount_paid: 21 }));
  });
  const pubkey = client.enrollKey('backer:ishaan');
  await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  assert.equal((await client.waitForDeposit(QUOTE_ID)).mintState, 'PAID');
});

test('ISSUED before we issued anything is an error, not a deposit', async () => {
  for (const change of [{ state: 'ISSUED', amount_paid: 21, amount_issued: 21 }, { state: 'PAID', amount_paid: 21, amount_issued: 21 }]) {
    const { client, records } = setup((_url, _init, call) => json(call === 1 ? quoteBody(pubkey) : quoteBody(pubkey, change)));
    const pubkey = client.enrollKey('backer:ishaan');
    await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
    await assert.rejects(client.waitForDeposit(QUOTE_ID), (error: ProtocolError) => error.kind === 'issued-early');
    assert.equal(records()[0].status, 'failed');
  }
});

test('PAID with a different amount paid keeps waiting until the deadline', async () => {
  let clock = 0;
  const storage = memoryStorage();
  let pubkey = '';
  const client = createProtocolClient({
    storage,
    now: () => new Date(clock),
    sleep: async ms => { clock += ms; },
    fetch: async (_url, init) => json(init?.method === 'POST' ? quoteBody(pubkey) : quoteBody(pubkey, { state: 'PAID', amount_paid: 20 })),
  });
  pubkey = client.enrollKey('backer:ishaan');
  await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  await assert.rejects(client.waitForDeposit(QUOTE_ID, { timeoutMs: 30_000 }), (error: ProtocolError) => error.kind === 'timeout');
  assert.ok(clock <= 30_000);
});

test('polling stops when aborted', async () => {
  const controller = new AbortController();
  const { client } = setup((_url, _init, call) => {
    if (call === 3) controller.abort();
    return json(quoteBody(pubkey));
  });
  const pubkey = client.enrollKey('backer:ishaan');
  await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  await assert.rejects(client.waitForDeposit(QUOTE_ID, { signal: controller.signal }), (error: ProtocolError) => error.kind === 'aborted');

  let ownerKey = '';
  const sleeping = createProtocolClient({ storage: memoryStorage(), fetch: async () => json(quoteBody(ownerKey)) });
  ownerKey = sleeping.enrollKey('backer:ishaan');
  await sleeping.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: ownerKey });
  const during = new AbortController();
  const started = Date.now();
  setTimeout(() => during.abort(), 20);
  await assert.rejects(sleeping.waitForDeposit(QUOTE_ID, { signal: during.signal, intervalMs: 60_000 }),
    (error: ProtocolError) => error.kind === 'aborted');
  assert.ok(Date.now() - started < 1_000);
});

test('a request left unanswered by a closed page is marked abandoned on the next load', async () => {
  const storage = memoryStorage();
  const first = createProtocolClient({ storage, fetch: () => new Promise(() => {}) });
  const pubkey = first.enrollKey('backer:ishaan');
  void first.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  await new Promise(resolve => setTimeout(resolve, 0));

  const next = createProtocolClient({ storage });
  assert.equal(next.abandonUnanswered(), 1);
  assert.equal(listDeposits(createRecordStore(storage))[0].status, 'abandoned');
  assert.equal(next.abandonUnanswered(), 0);
});

test('keys are compressed secp256k1 points and stay in local storage only', () => {
  const storage = memoryStorage();
  const client = createProtocolClient({ storage });
  const pubkey = client.enrollKey('backer:ishaan');
  assert.match(pubkey, /^0[23][0-9a-f]{64}$/);
  assert.ok(isValidPubkey(pubkey));
  assert.equal(client.enrollKey('backer:ishaan'), pubkey);
  assert.notEqual(client.enrollKey('backer:tobi'), pubkey);

  const maintainer = client.enrollMaintainer('ngozi');
  assert.ok(isValidPubkey(maintainer));
  assert.notEqual(maintainer, pubkey);

  const raw = storage.getItem(`plebstack:key:${pubkey}`)!;
  assert.equal(JSON.parse(raw).version, 1);
});

test('pubkey validation needs a 02 or 03 prefix and a point on the curve', () => {
  const valid = bytesToHex(getPubKeyFromPrivKey(createRandomSecretKey()));
  assert.ok(isValidPubkey(valid));
  assert.ok(!isValidPubkey('04' + valid.slice(2)));
  assert.ok(!isValidPubkey(valid.slice(0, 64)));
  assert.ok(!isValidPubkey(valid.toUpperCase()));
  assert.ok(!isValidPubkey('02' + 'f'.repeat(64)));
  assert.ok(!isValidPubkey('03' + '0'.repeat(64)));
});

test('a signer refuses a quote it does not own', async () => {
  const { client } = setup(() => json(quoteBody(pubkey)));
  const pubkey = client.enrollKey('backer:ishaan');
  await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
  const signer = client.signerFor(pubkey);
  const output = { amount: 1, id: '00163d7a87ffcd92', B_: pubkey };
  assert.match(await signer.signQuote(QUOTE_ID, [output]), /^[0-9a-f]{128}$/);
  await assert.rejects(signer.signQuote('someone-elses-quote', [output]), /does not own/);

  const other = client.signerFor(client.enrollKey('backer:tobi'));
  await assert.rejects(other.signQuote(QUOTE_ID, [output]), /does not own/);

  await signer.stopNewApprovals(QUOTE_ID);
  assert.ok(signer.approvalsStopped(QUOTE_ID));
});

test('operations are saved before dispatch and cannot be resolved without it', async () => {
  const client = createProtocolClient({ storage: memoryStorage() });
  const operation = {
    version: 1 as const, id: 'op-1', kind: 'reclaim' as const, mint: TEST_MINT, quoteIds: [QUOTE_ID], outputs: [],
    keysetId: '00163d7a87ffcd92', requestBody: '{}', createdAt: '2026-11-22T10:00:00Z', status: 'prepared' as const,
  };
  await assert.rejects(client.recovery.saveResult({ ...operation, status: 'confirmed' }), /never saved/);
  await client.recovery.saveBeforeDispatch(operation);
  await assert.rejects(client.recovery.saveBeforeDispatch(operation), /already saved/);
  assert.deepEqual(await client.recovery.listUnresolved(), [operation]);
  await client.recovery.saveResult({ ...operation, status: 'confirmed' });
  assert.deepEqual(await client.recovery.listUnresolved(), []);
});
