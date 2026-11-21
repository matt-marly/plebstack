import type {
  Authorization, BatchPlan, BlindedOutput, Campaign, IssuedProof, LockedQuote, MintUrl,
  OutputConstruction, RecoveryOperation, Settlement,
} from '../domain/models';
import { findRelease, saveRelease, storedStops, type ReleaseRecord } from './approvals';
import {
  PackageError, authorizationProblem, messages, outputsDigest, payoutOutputs, payoutProofs, planTerms,
  signLockedProof, verifyPackage,
} from './batch';
import { findDeposit, listDeposits, saveDeposit, type DepositRecord, type SavedQuote } from './deposits';
import { enrollMaintainer, ensureKey, hasKey, isValidPubkey, secretKeyFor } from './keys';
import {
  MintError, activeSatKeyset, cashuRejection, mintRequest, mintSend, parseQuote, type FetchLike, type MintQuoteResponse,
} from './mint';
import { createRecoveryStore } from './recovery';
import { createQuoteSigner } from './signer';
import { StorageError, createRecordStore, type StorageLike } from './storage';

// A signer owns its private key; the coordinator receives signatures and public material only.
export interface QuoteSigner {
  readonly pubkey: string;
  signQuote(quoteId: string, outputs: BlindedOutput[]): Promise<string>;
  stopNewApprovals(quoteId: string): Promise<void>;
  approvalsStopped(quoteId: string): boolean;
}

export interface RecoveryStore {
  saveBeforeDispatch(operation: RecoveryOperation): Promise<void>;
  get(operationId: string): Promise<RecoveryOperation | undefined>;
  listUnresolved(): Promise<RecoveryOperation[]>;
  saveResult(operation: RecoveryOperation): Promise<void>;
}

export interface WaitOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  intervalMs?: number;
  maxIntervalMs?: number;
  onCheck?: (check: DepositCheck, at: Date) => void;
}

export interface DepositCheck {
  quote: LockedQuote;
  // PAID, amount_paid equal to the amount, nothing issued yet.
  paid: boolean;
}

export type CampaignTerms = Pick<Campaign, 'id' | 'mint' | 'beneficiaryPubkey' | 'backerCount' | 'contributionSat'>;

export interface ProtocolClient {
  enrollKey(owner: string): string;
  enrollMaintainer(owner: string): string;
  signerFor(pubkey: string): QuoteSigner;
  readonly recovery: RecoveryStore;
  createQuote(request: { mint: MintUrl; amountSat: number; ownerPubkey: string }, signal?: AbortSignal): Promise<LockedQuote>;
  checkDeposit(quoteId: string, signal?: AbortSignal): Promise<DepositCheck>;
  waitForDeposit(quoteId: string, options?: WaitOptions): Promise<LockedQuote>;
  findDeposit(quoteId: string): DepositRecord | undefined;
  abandonUnanswered(): number;
  preparePayout(campaign: CampaignTerms, quotes: LockedQuote[]): Promise<BatchPlan>;
  authorizeBatch(campaign: CampaignTerms, plan: BatchPlan, quote: LockedQuote, signer: QuoteSigner): Promise<Authorization>;
  findRelease(quoteId: string): ReleaseRecord | undefined;
  payout(plan: BatchPlan, authorizations: Authorization[], operationId: string): Promise<Settlement>;
  signLockedProofs(pubkey: string, proofs: IssuedProof[]): IssuedProof[];
  reclaim(quote: LockedQuote, outputs: OutputConstruction[], signer: QuoteSigner, operation: RecoveryOperation): Promise<Settlement>;
  recover(operation: RecoveryOperation): Promise<Settlement>;
}

export type ProtocolFailure =
  | 'storage' | 'invalid-key' | 'unknown-quote' | 'mint' | 'not-locked' | 'issued-early' | 'not-paid' | 'timeout' | 'aborted'
  | 'authorization';

export class ProtocolError extends Error {
  constructor(readonly kind: ProtocolFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProtocolError';
  }
}

export interface ClientOptions {
  storage: StorageLike | (() => StorageLike);
  fetch?: FetchLike;
  now?: () => Date;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function unavailable(): never {
  throw new Error('Protocol integration is not connected in this scaffold.');
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    const stop = () => { clearTimeout(timer); reject(signal!.reason); };
    signal?.addEventListener('abort', stop, { once: true });
  });
}

function lockedQuote(record: DepositRecord): LockedQuote {
  const quote = record.quote!;
  return {
    id: quote.id, mint: record.mint, ownerPubkey: record.ownerPubkey, amountSat: record.amountSat,
    invoice: quote.request, mintState: quote.state,
  };
}

function savedQuote(response: MintQuoteResponse): SavedQuote {
  return {
    id: response.quote, request: response.request, state: response.state, expiry: response.expiry,
    amountPaid: response.amount_paid, amountIssued: response.amount_issued,
  };
}

export function createProtocolClient(options: ClientOptions): ProtocolClient {
  const store = createRecordStore(options.storage);
  const fetch: FetchLike = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? abortableSleep;

  function persist(record: DepositRecord, status: DepositRecord['status'], change: Partial<DepositRecord> = {}): DepositRecord {
    const next = { ...record, ...change, status, updatedAt: now().toISOString() };
    try {
      saveDeposit(store, next);
    } catch (error) {
      throw new ProtocolError('storage', 'Couldn’t save the mint’s answer on this device.', { cause: error });
    }
    return next;
  }

  // Best effort: the failure being reported matters more than a failure to record it.
  function fail(record: DepositRecord, error: ProtocolError): ProtocolError {
    try { persist(record, 'failed', { error: error.message }); } catch { /* the record stays as it was */ }
    return error;
  }

  function asProtocolError(error: unknown, signal?: AbortSignal): ProtocolError {
    if (error instanceof ProtocolError) return error;
    if (signal?.aborted) return new ProtocolError('aborted', 'Stopped before the mint answered.', { cause: error });
    if (error instanceof MintError) return new ProtocolError('mint', error.message, { cause: error });
    return new ProtocolError('mint', 'Something went wrong talking to the mint.', { cause: error });
  }

  function checkEcho(record: DepositRecord, response: MintQuoteResponse) {
    if (response.pubkey !== record.ownerPubkey) {
      throw new ProtocolError('not-locked', 'The mint did not lock this quote to your key.');
    }
    if (response.amount !== record.amountSat || response.unit !== 'sat') {
      throw new ProtocolError('not-locked', 'The mint answered with a different amount.');
    }
    if (response.state === 'ISSUED' || response.amount_issued > 0) {
      throw new ProtocolError('issued-early', 'The mint reports this quote as already issued, but nothing was issued from here.');
    }
  }

  async function mintQuote(mint: MintUrl, quoteId: string): Promise<MintQuoteResponse> {
    const response = parseQuote(await mintRequest(fetch, `${mint}/v1/mint/quote/bolt11/${encodeURIComponent(quoteId)}`));
    if (response.quote !== quoteId) throw new ProtocolError('not-locked', 'The mint answered about a different quote.');
    return response;
  }

  const recovery = createRecoveryStore(store);

  const client: ProtocolClient = {
    enrollKey(owner) {
      try {
        return ensureKey(store, owner, now());
      } catch (error) {
        throw new ProtocolError('storage', 'Couldn’t save a key on this device. Nothing was sent to the mint.', { cause: error });
      }
    },

    enrollMaintainer(owner) {
      try {
        return enrollMaintainer(store, owner, now());
      } catch (error) {
        throw new ProtocolError(error instanceof StorageError ? 'storage' : 'invalid-key',
          error instanceof StorageError ? 'Couldn’t save a key on this device.' : (error as Error).message, { cause: error });
      }
    },

    signerFor(pubkey) {
      const secretKey = secretKeyFor(store, pubkey);
      if (!secretKey) throw new ProtocolError('invalid-key', 'This browser holds no key for that pubkey.');
      return createQuoteSigner(secretKey, pubkey, quoteId => findDeposit(store, quoteId)?.ownerPubkey === pubkey, storedStops(store, now));
    },

    recovery,

    async createQuote({ mint, amountSat, ownerPubkey }, signal) {
      if (!isValidPubkey(ownerPubkey)) throw new ProtocolError('invalid-key', 'That is not a valid compressed public key.');
      if (!Number.isSafeInteger(amountSat) || amountSat <= 0) throw new Error('The amount must be a whole number of sats.');

      let record: DepositRecord;
      try {
        if (!hasKey(store, ownerPubkey)) throw new ProtocolError('invalid-key', 'This browser holds no key for that pubkey.');
        const at = now().toISOString();
        record = { id: crypto.randomUUID(), mint, amountSat, ownerPubkey, createdAt: at, updatedAt: at, status: 'requested' };
        saveDeposit(store, record);
      } catch (error) {
        if (error instanceof ProtocolError) throw error;
        throw new ProtocolError('storage', 'Couldn’t save the request on this device. Nothing was sent to the mint.', { cause: error });
      }

      // If the page closes before the answer, the mint may hold a quote we never saw. Nothing was
      // shown to pay, so nothing is lost; abandonUnanswered marks the record on the next load.
      let response: MintQuoteResponse;
      try {
        response = parseQuote(await mintRequest(fetch, `${mint}/v1/mint/quote/bolt11`,
          { amount: amountSat, unit: 'sat', pubkey: ownerPubkey }, signal));
        checkEcho(record, response);
      } catch (error) {
        throw fail(record, asProtocolError(error, signal));
      }

      record = persist(record, 'quoted', { quote: savedQuote(response) });
      return lockedQuote(record);
    },

    async checkDeposit(quoteId, signal) {
      let record = findDeposit(store, quoteId);
      if (!record?.quote) throw new ProtocolError('unknown-quote', 'This browser has no record of that quote.');
      let response: MintQuoteResponse;
      try {
        response = parseQuote(await mintRequest(fetch, `${record.mint}/v1/mint/quote/bolt11/${encodeURIComponent(quoteId)}`, undefined, signal));
        if (response.quote !== quoteId) throw new ProtocolError('not-locked', 'The mint answered about a different quote.');
        checkEcho(record, response);
      } catch (error) {
        const failure = asProtocolError(error, signal);
        throw failure.kind === 'mint' || failure.kind === 'aborted' ? failure : fail(record, failure);
      }

      const paid = response.state === 'PAID' && response.amount_paid === record.amountSat && response.amount_issued === 0;
      const quote = savedQuote(response);
      const was = record.quote;
      if (paid ? record.status !== 'paid' : quote.state !== was.state || quote.amountPaid !== was.amountPaid) {
        record = persist(record, paid ? 'paid' : record.status, { quote });
      }
      return { quote: lockedQuote(record), paid };
    },

    async waitForDeposit(quoteId, { signal, timeoutMs = 180_000, intervalMs = 1_000, maxIntervalMs = 8_000, onCheck } = {}) {
      const deadline = now().getTime() + timeoutMs;
      let delay = intervalMs;
      for (;;) {
        if (signal?.aborted) throw new ProtocolError('aborted', 'Stopped checking the mint.');
        try {
          const check = await client.checkDeposit(quoteId, signal);
          onCheck?.(check, now());
          if (check.paid) return check.quote;
        } catch (error) {
          const transient = error instanceof ProtocolError && error.kind === 'mint'
            && (!(error.cause instanceof MintError) || error.cause.transient);
          if (!transient) throw error;
        }
        if (now().getTime() + delay > deadline) {
          throw new ProtocolError('timeout', 'The mint hasn’t reported this invoice paid yet.');
        }
        try {
          await sleep(delay, signal);
        } catch (error) {
          throw new ProtocolError('aborted', 'Stopped checking the mint.', { cause: error });
        }
        delay = Math.min(Math.round(delay * 1.6), maxIntervalMs);
      }
    },

    findDeposit: quoteId => findDeposit(store, quoteId),

    abandonUnanswered() {
      const open = listDeposits(store).filter(record => record.status === 'requested');
      for (const record of open) persist(record, 'abandoned');
      return open.length;
    },

    async preparePayout(campaign, quotes) {
      const ids = quotes.map(quote => quote.id);
      if (quotes.length !== campaign.backerCount || new Set(ids).size !== quotes.length) {
        throw new ProtocolError('unknown-quote', `A payout needs ${campaign.backerCount} different deposits.`);
      }
      const saved = store.read<BatchPlan>(`plan:${campaign.id}`);
      if (saved && saved.quoteIds.join() === ids.join()) return saved;

      let keyset;
      try {
        for (const quote of quotes) {
          const answer = await mintQuote(campaign.mint, quote.id);
          if (answer.pubkey !== quote.ownerPubkey) throw new ProtocolError('not-locked', 'A deposit is not locked to the key its backer enrolled.');
          if (answer.state === 'ISSUED' || answer.amount_issued > 0) throw new ProtocolError('issued-early', 'A deposit was already issued.');
          if (answer.state !== 'PAID' || answer.amount_paid !== campaign.contributionSat || answer.amount !== campaign.contributionSat) {
            throw new ProtocolError('not-paid', 'A deposit is not paid in full yet.');
          }
        }
        keyset = await activeSatKeyset(fetch, campaign.mint);
      } catch (error) {
        throw asProtocolError(error);
      }

      const totalSat = campaign.contributionSat * campaign.backerCount;
      const plan: BatchPlan = {
        campaignId: campaign.id, mint: campaign.mint, beneficiaryPubkey: campaign.beneficiaryPubkey,
        quoteIds: ids as BatchPlan['quoteIds'], ownerPubkeys: quotes.map(quote => quote.ownerPubkey) as BatchPlan['ownerPubkeys'],
        keyset, outputs: payoutOutputs(campaign.beneficiaryPubkey, totalSat, keyset), totalSat,
      };
      try {
        store.write(`plan:${campaign.id}`, plan);
      } catch (error) {
        throw new ProtocolError('storage', 'Couldn’t save the payout package on this device.', { cause: error });
      }
      return plan;
    },

    async authorizeBatch(campaign, plan, quote, signer) {
      const record = findDeposit(store, quote.id);
      if (!record || record.status !== 'paid' || record.ownerPubkey !== signer.pubkey || quote.ownerPubkey !== signer.pubkey
        || !hasKey(store, signer.pubkey)) {
        throw new PackageError('not-owner', 'This browser does not hold the key for that deposit.');
      }
      if (signer.approvalsStopped(quote.id)) throw new PackageError('stopped', 'New approvals for this deposit are stopped on this device.');
      if (record.mint !== campaign.mint) throw new PackageError('mint', 'This deposit is at a different mint.');

      let keysetId: string;
      try {
        keysetId = (await activeSatKeyset(fetch, campaign.mint)).id;
      } catch (error) {
        throw asProtocolError(error);
      }
      const outputs = verifyPackage(plan, {
        campaignId: campaign.id, mint: campaign.mint, beneficiaryPubkey: campaign.beneficiaryPubkey,
        totalSat: campaign.contributionSat * campaign.backerCount, keysetId, quoteId: quote.id, ownerPubkey: signer.pubkey,
      });

      const digest = outputsDigest(outputs);
      const released = findRelease(store, quote.id);
      if (released) {
        if (released.outputsDigest !== digest) {
          throw new PackageError('released', 'You already approved a different payout for this deposit.');
        }
        return { quoteId: quote.id, signature: released.signature, outputs };
      }

      const signature = await signer.signQuote(quote.id, outputs);
      try {
        saveRelease(store, { quoteId: quote.id, campaignId: campaign.id, signature, outputsDigest: digest, releasedAt: now().toISOString() });
      } catch (error) {
        throw new ProtocolError('storage', 'Couldn’t record the approval on this device, so it was not handed over.', { cause: error });
      }
      return { quoteId: quote.id, signature, outputs };
    },

    findRelease: quoteId => findRelease(store, quoteId),

    async payout(plan, authorizations, operationId) {
      let problem: string | undefined;
      try {
        verifyPackage(plan, planTerms(plan));
        problem = authorizationProblem(plan, authorizations);
      } catch (error) {
        problem = (error as Error).message;
      }
      if (problem) throw new ProtocolError('authorization', problem);

      const requestBody = JSON.stringify({
        quotes: plan.quoteIds, outputs: messages(plan.outputs), signatures: authorizations.map(authorization => authorization.signature),
      });
      let operation: RecoveryOperation = {
        version: 1, id: operationId, kind: 'payout', mint: plan.mint, quoteIds: [...plan.quoteIds], outputs: plan.outputs,
        keysetId: plan.keyset.id, requestBody, createdAt: now().toISOString(), status: 'prepared',
      };
      try {
        await recovery.saveBeforeDispatch(operation);
        operation = { ...operation, status: 'dispatched', dispatchedAt: now().toISOString() };
        await recovery.saveResult(operation);
      } catch (error) {
        throw new ProtocolError('storage', 'Couldn’t save the payout before sending it. Nothing was sent to the mint.', { cause: error });
      }

      // A failed save here leaves the operation dispatched, which recovery treats as unresolved.
      const settle = async (change: Partial<RecoveryOperation>) => {
        const next = { ...operation, ...change, settledAt: now().toISOString() };
        await recovery.saveResult(next);
        operation = next;
      };
      const pending = async (change: Partial<RecoveryOperation>): Promise<Settlement> => {
        await settle({ status: 'unresolved', ...change }).catch(() => {});
        return { kind: 'pending', operationId };
      };

      let answer: unknown;
      try {
        answer = await mintSend(fetch, `${plan.mint}/v1/mint/bolt11/batch`, requestBody);
      } catch (error) {
        const reason = cashuRejection(error);
        if (reason === undefined) return pending({ reason: (error as Error).message });
        await settle({ status: 'rejected', reason }).catch(() => {});
        return { kind: 'rejected', operationId, reason };
      }

      const response = JSON.stringify(answer);
      let proofs: IssuedProof[];
      try {
        proofs = payoutProofs(plan, answer);
      } catch (error) {
        return pending({ reason: (error as Error).message, response });
      }
      try {
        const states = [];
        for (const id of plan.quoteIds) states.push((await mintQuote(plan.mint, id)).state);
        if (states.some(state => state !== 'ISSUED')) throw new Error(`The mint reports ${states.join(', ')} after the payout.`);
      } catch (error) {
        return pending({ reason: (error as Error).message, response, proofs });
      }
      try {
        await settle({ status: 'confirmed', response, proofs });
      } catch {
        return pending({ response, proofs });
      }
      return { kind: 'confirmed', operationId, destination: 'creator', proofs };
    },

    signLockedProofs(pubkey, proofs) {
      const secretKey = secretKeyFor(store, pubkey);
      if (!secretKey) throw new ProtocolError('invalid-key', 'This browser holds no key for that pubkey.');
      return proofs.map(proof => signLockedProof(proof, secretKey));
    },

    reclaim: async () => unavailable(),
    recover: async () => unavailable(),
  };
  return client;
}

export const protocol: ProtocolClient = createProtocolClient({ storage: () => globalThis.localStorage });
