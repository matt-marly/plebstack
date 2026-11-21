import {
  createBlindSignature, createDLEQProof, createNewMintKeys, pointFromHex, schnorrVerifyDigest,
} from '@cashu/cashu-ts';
import { bytesToHex } from '@noble/hashes/utils.js';
import { TEST_MINT, type Authorization, type BlindedOutput, type RecoveryOperation } from '../src/domain/models';
import { createProtocolClient, type CampaignTerms } from '../src/protocol/client';
import type { FetchLike } from '../src/protocol/mint';
import { mintQuoteDigest } from '../src/protocol/signer';
import { memoryStorage } from '../src/protocol/storage';

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Handler = (raw: string) => Response | Promise<Response>;

// Verifies NUT-20 signatures, blind-signs with DLEQ and remembers each signature for NUT-09 restore, as testnut does.
export function mockMint() {
  const pair = createNewMintKeys(6);
  const keysetId = pair.keysetId;
  const keys = Object.fromEntries(Object.entries(pair.pubKeys).map(([amount, key]) => [amount, bytesToHex(key)]));
  const quotes = new Map<string, { pubkey: string; amount: number; state: 'UNPAID' | 'PAID' | 'ISSUED' }>();
  const calls: { role: string; method: string; path: string; body?: string }[] = [];

  const quoteBody = (id: string) => {
    const quote = quotes.get(id)!;
    return {
      quote: id, request: 'lnbc210n1p', amount: quote.amount, unit: 'sat', state: quote.state, expiry: null, pubkey: quote.pubkey,
      amount_paid: quote.state === 'UNPAID' ? 0 : quote.amount, amount_issued: quote.state === 'ISSUED' ? quote.amount : 0,
    };
  };

  const signed = new Map<string, { output: BlindedOutput; signature: ReturnType<typeof blindSign> }>();

  function issue(ids: string[], outputs: BlindedOutput[], signatures: (string | null | undefined)[]): Response {
    if (ids.some(id => quotes.get(id)?.state === 'ISSUED')) return json({ code: 20002, detail: 'Quote already issued' }, 400);
    if (ids.some(id => quotes.get(id)?.state !== 'PAID')) return json({ code: 20001, detail: 'Quote not paid' }, 400);
    const valid = ids.every((id, i) => typeof signatures[i] === 'string'
      && schnorrVerifyDigest(signatures[i] as string, mintQuoteDigest(id, outputs), quotes.get(id)!.pubkey));
    if (!valid) return json({ code: 20008, detail: 'Signature missing or invalid' }, 400);
    for (const id of ids) quotes.get(id)!.state = 'ISSUED';
    return json({ signatures: outputs.map(output => blindSign(output)) });
  }

  function honest(raw: string): Response {
    const { quotes: ids, outputs, signatures } = JSON.parse(raw) as { quotes: string[]; outputs: BlindedOutput[]; signatures: (string | null)[] };
    return issue(ids, outputs, signatures);
  }

  function honestSingle(raw: string): Response {
    const { quote, outputs, signature } = JSON.parse(raw) as { quote: string; outputs: BlindedOutput[]; signature?: string };
    return issue([quote], outputs, [signature]);
  }

  function blindSign(output: BlindedOutput) {
    const B_ = pointFromHex(output.B_);
    const key = pair.privKeys[String(output.amount)];
    const dleq = createDLEQProof(B_, key);
    const signature = {
      amount: output.amount, id: keysetId, C_: createBlindSignature(B_, key, keysetId).C_.toHex(true),
      dleq: { e: bytesToHex(dleq.e), s: bytesToHex(dleq.s) },
    };
    signed.set(output.B_, { output, signature });
    return signature;
  }

  function restore(raw: string): Response {
    const found = (JSON.parse(raw) as { outputs: BlindedOutput[] }).outputs.flatMap(output => signed.get(output.B_) ?? []);
    return json({ outputs: found.map(entry => entry.output), signatures: found.map(entry => entry.signature) });
  }

  const mint = {
    keysetId, keys, quotes, calls, batch: honest as Handler, single: honestSingle as Handler, honest, honestSingle, blindSign,
    fetchFor(role: string): FetchLike {
      return async (url, init) => {
        const path = url.slice(TEST_MINT.length);
        const body = init?.body === undefined ? undefined : String(init.body);
        calls.push({ role, method: init?.method ?? 'GET', path, body });
        if (path === '/v1/keysets') return json({ keysets: [{ id: keysetId, unit: 'sat', active: true, input_fee_ppk: 100 }] });
        if (path === `/v1/keys/${keysetId}`) return json({ keysets: [{ id: keysetId, unit: 'sat', active: true, keys }] });
        if (path === '/v1/mint/quote/bolt11') {
          const { amount, pubkey } = JSON.parse(body!) as { amount: number; pubkey: string };
          const id = crypto.randomUUID();
          quotes.set(id, { pubkey, amount, state: 'UNPAID' });
          const answer = quoteBody(id);
          quotes.get(id)!.state = 'PAID';
          return json(answer);
        }
        if (path.startsWith('/v1/mint/quote/bolt11/')) return json(quoteBody(decodeURIComponent(path.split('/').pop()!)));
        if (path === '/v1/mint/bolt11/batch') return mint.batch(body!);
        if (path === '/v1/mint/bolt11') return mint.single(body!);
        if (path === '/v1/restore') return restore(body!);
        return json({ code: 0, detail: 'not found' }, 404);
      };
    },
    batchCalls: () => calls.filter(call => call.path === '/v1/mint/bolt11/batch'),
    mintCalls: () => calls.filter(call => call.path === '/v1/mint/bolt11'),
  };
  return mint;
}

const sleep = async () => {};

export async function funded() {
  const mint = mockMint();
  const maintainer = createProtocolClient({ storage: memoryStorage(), fetch: mint.fetchFor('maintainer'), sleep });
  const maintainerPubkey = maintainer.enrollMaintainer('ngozi');
  const campaign: CampaignTerms = { id: 'campaign-1', mint: TEST_MINT, beneficiaryPubkey: maintainerPubkey, backerCount: 3, contributionSat: 21 };

  const backers = [];
  for (const role of ['backer-1', 'backer-2', 'backer-3']) {
    const storage = memoryStorage();
    const client = createProtocolClient({ storage, fetch: mint.fetchFor(role), sleep });
    const pubkey = client.enrollKey(role);
    const created = await client.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: pubkey });
    const quote = await client.waitForDeposit(created.id);
    backers.push({ role, storage, client, pubkey, quote, signer: client.signerFor(pubkey) });
  }

  const coordinatorStorage = memoryStorage();
  const operationWrites: string[] = [];
  const setItem = coordinatorStorage.setItem.bind(coordinatorStorage);
  coordinatorStorage.setItem = (key, value) => {
    setItem(key, value);
    if (key.startsWith('plebstack:operation:')) operationWrites.push((JSON.parse(value).value as RecoveryOperation).status);
  };
  const coordinator = createProtocolClient({ storage: coordinatorStorage, fetch: mint.fetchFor('coordinator'), sleep });
  const plan = await coordinator.preparePayout(campaign, backers.map(backer => backer.quote));
  return { mint, maintainer, maintainerPubkey, campaign, backers, coordinatorStorage, coordinator, operationWrites, plan };
}

export type Funded = Awaited<ReturnType<typeof funded>>;

export async function approveAll({ campaign, backers, plan }: Funded): Promise<Authorization[]> {
  const authorizations = [];
  for (const backer of backers) authorizations.push(await backer.client.authorizeBatch(campaign, plan, backer.quote, backer.signer));
  return authorizations;
}

