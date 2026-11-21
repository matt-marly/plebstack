import { OutputData } from '@cashu/cashu-ts';
import type {
  Authorization, BatchPlan, BlindedOutput, Campaign, IssuedProof, LockedQuote, MintUrl, PublicKeyset, RecoveryOperation,
  Settlement,
} from '../domain/models';
import { findRelease, saveRelease, storedStops, type ReleaseRecord } from './approvals';
import {
  PackageError, authorizationProblem, construction, issuedProofs, lockedTo, messages, outputsDigest, payoutOutputs,
  payoutProofs, planTerms, signLockedProof, verifyPackage,
} from './batch';
import { findDeposit, listDeposits, saveDeposit, type DepositRecord, type SavedQuote } from './deposits';
import { enrollMaintainer, ensureKey, hasKey, isValidPubkey, secretKeyFor } from './keys';
import {
  MintError, activeSatKeyset, cashuRejection, keysetById, mintRequest, mintSend, parseQuote, type FetchLike,
  type MintQuoteResponse, type QuoteState,
} from './mint';
import { createRecoveryStore } from './recovery';
import { createQuoteSigner } from './signer';
import { StorageError, createRecordStore, type StorageLike } from './storage';

// A signer owns its private key; the coordinator receives signatures and public material only.
export interface QuoteSigner {
  readonly pubkey: string;
  signQuote(quoteId: string, outputs: BlindedOutput[]): Promise<string>;
  signOwnMint(quoteId: string, outputs: BlindedOutput[]): Promise<string>;
  stopNewApprovals(quoteId: string): Promise<void>;
  approvalsStopped(quoteId: string): boolean;
}

export interface RecoveryStore {
  saveBeforeDispatch(operation: RecoveryOperation): Promise<void>;
  get(operationId: string): Promise<RecoveryOperation | undefined>;
  listUnresolved(): Promise<RecoveryOperation[]>;
  saveResult(operation: RecoveryOperation): Promise<void>;
  discard(operationId: string): Promise<void>;
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

// What a backer's own browser checked before signing, for the review screen.
export interface BatchReview {
  totalSat: number;
  keysetId: string;
  lockedTo: string;
  amounts: number[];
  quoteIds: string[];
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
  reviewBatch(campaign: CampaignTerms, plan: BatchPlan, quote: LockedQuote): Promise<BatchReview>;
  authorizeBatch(campaign: CampaignTerms, plan: BatchPlan, quote: LockedQuote, signer: QuoteSigner): Promise<Authorization>;
  findRelease(quoteId: string): ReleaseRecord | undefined;
  payout(plan: BatchPlan, authorizations: Authorization[], operationId: string): Promise<Settlement>;
  signLockedProofs(pubkey: string, proofs: IssuedProof[]): IssuedProof[];
  checkQuotes(mint: MintUrl, quoteIds: string[], signal?: AbortSignal): Promise<QuoteState[]>;
  reclaim(quoteId: string, operationId: string): Promise<Settlement>;
  recover(operationId: string): Promise<Settlement>;
}

export type ProtocolFailure =
  | 'storage' | 'invalid-key' | 'unknown-quote' | 'mint' | 'not-locked' | 'issued-early' | 'not-paid' | 'timeout' | 'aborted'
  | 'authorization' | 'not-owner' | 'pending' | 'unknown-operation';

export const NOT_SAVED = 'Couldn’t save on this device. Nothing was sent to the mint.';

export class ProtocolError extends Error {
  constructor(readonly kind: ProtocolFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProtocolError';
  }
}

export interface ClientOptions {
  storage: StorageLike | (() => StorageLike);
  namespace?: string;
  fetch?: FetchLike;
  now?: () => Date;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
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

function restoredSignatures(outputs: RecoveryOperation['outputs'], body: unknown): unknown[] {
  const { outputs: found, signatures } = (body ?? {}) as { outputs?: unknown; signatures?: unknown };
  if (!Array.isArray(found) || !Array.isArray(signatures)) return outputs.map(() => undefined);
  const byMessage = new Map(found.map((output, i) => [(output as { B_?: unknown } | null)?.B_, signatures[i] as unknown]));
  return outputs.map(output => byMessage.get(output.message.B_));
}

export function createProtocolClient(options: ClientOptions): ProtocolClient {
  const store = createRecordStore(options.storage, options.namespace);
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

  async function mintQuote(mint: MintUrl, quoteId: string, signal?: AbortSignal): Promise<MintQuoteResponse> {
    const response = parseQuote(await mintRequest(fetch, `${mint}/v1/mint/quote/bolt11/${encodeURIComponent(quoteId)}`, undefined, signal));
    if (response.quote !== quoteId) throw new ProtocolError('not-locked', 'The mint answered about a different quote.');
    return response;
  }

  const recovery = createRecoveryStore(store);

  // One saved operation on its way to a result. A failed save leaves it as it was, which recovery treats as unresolved.
  function tracker(start: RecoveryOperation) {
    let operation = start;
    const settle = async (change: Partial<RecoveryOperation>) => {
      const next = { ...operation, ...change, settledAt: now().toISOString() };
      await recovery.saveResult(next);
      operation = next;
    };
    return {
      get operation() { return operation; },
      settle,
      async pending(change: Partial<RecoveryOperation>): Promise<Settlement> {
        await settle({ status: 'unresolved', ...change }).catch(() => {});
        return { kind: 'pending', operationId: start.id };
      },
      async rejected(reason: string): Promise<Settlement> {
        await settle({ status: 'rejected', reason }).catch(() => {});
        return { kind: 'rejected', operationId: start.id, reason };
      },
    };
  }
  type Run = ReturnType<typeof tracker>;

  interface Handling {
    destination: 'creator' | 'owner';
    proofs(answer: unknown): IssuedProof[];
    // Asked of the mint after the proofs verify, before anything is confirmed.
    issued?(): Promise<void>;
    confirmed?(): void;
    rejected?(): Promise<void>;
  }

  async function dispatching(operation: RecoveryOperation): Promise<Run> {
    try {
      await recovery.saveBeforeDispatch(operation);
    } catch (error) {
      throw new ProtocolError('storage', NOT_SAVED, { cause: error });
    }
    const sent: RecoveryOperation = { ...operation, status: 'dispatched', dispatchedAt: now().toISOString() };
    try {
      await recovery.saveResult(sent);
    } catch (error) {
      // Never sent, so it mustn't linger as a request waiting on the mint.
      await recovery.discard(operation.id).catch(() => {});
      throw new ProtocolError('storage', NOT_SAVED, { cause: error });
    }
    return tracker(sent);
  }

  async function answered(run: Run, handling: Handling, answer: unknown): Promise<Settlement> {
    const response = JSON.stringify(answer);
    let proofs: IssuedProof[];
    try {
      proofs = handling.proofs(answer);
    } catch (error) {
      return run.pending({ reason: (error as Error).message, response });
    }
    try {
      await handling.issued?.();
    } catch (error) {
      return run.pending({ reason: (error as Error).message, response, proofs });
    }
    try {
      await run.settle({ status: 'confirmed', response, proofs });
    } catch {
      return run.pending({ response, proofs });
    }
    handling.confirmed?.();
    return { kind: 'confirmed', operationId: run.operation.id, destination: handling.destination, proofs };
  }

  // Sends the saved body exactly as stored. Nothing here builds new outputs.
  async function send(run: Run, handling: Handling): Promise<Settlement> {
    const { mint, kind, requestBody } = run.operation;
    let answer: unknown;
    try {
      answer = await mintSend(fetch, `${mint}/v1/mint/bolt11${kind === 'payout' ? '/batch' : ''}`, requestBody);
    } catch (error) {
      const reason = cashuRejection(error);
      if (reason === undefined) return run.pending({ reason: (error as Error).message });
      const settlement = await run.rejected(reason);
      await handling.rejected?.().catch(() => {});
      return settlement;
    }
    return answered(run, handling, answer);
  }

  function payoutHandling(plan: Pick<BatchPlan, 'mint' | 'quoteIds' | 'outputs' | 'keyset' | 'beneficiaryPubkey' | 'totalSat'>): Handling {
    return {
      destination: 'creator',
      proofs: answer => payoutProofs(plan, answer),
      async issued() {
        const states = await client.checkQuotes(plan.mint, plan.quoteIds);
        if (states.some(state => state !== 'ISSUED')) throw new Error(`The mint reports ${states.join(', ')} after the payout.`);
      },
    };
  }

  function reclaimHandling(record: DepositRecord, outputs: RecoveryOperation['outputs'], keyset: PublicKeyset): Handling {
    return {
      destination: 'owner',
      proofs(answer) {
        const proofs = issuedProofs(outputs, keyset, answer);
        const total = proofs.reduce((sum, proof) => sum + proof.amount, 0);
        if (total !== record.amountSat) throw new Error(`The proofs add up to ${total} sats, not ${record.amountSat}.`);
        return proofs;
      },
      // The saved operation holds the proofs either way; the deposit record only follows it.
      confirmed() {
        try { persist(record, 'reclaimed'); } catch { /* the operation is the record of the reclaim */ }
      },
      async rejected() {
        const answer = await mintQuote(record.mint, record.quote!.id);
        if (answer.state === 'ISSUED') persist(record, 'issued', { quote: savedQuote(answer) });
      },
    };
  }

  function ownedRecord(quote: LockedQuote, pubkey: string): DepositRecord {
    const record = findDeposit(store, quote.id);
    if (!record || record.status !== 'paid' || record.ownerPubkey !== pubkey || quote.ownerPubkey !== pubkey || !hasKey(store, pubkey)) {
      throw new PackageError('not-owner', 'This browser does not hold the key for that deposit.');
    }
    return record;
  }

  async function checkedPackage(campaign: CampaignTerms, plan: BatchPlan, record: DepositRecord) {
    if (record.mint !== campaign.mint) throw new PackageError('mint', 'This deposit is at a different mint.');
    let keysetId: string;
    try {
      keysetId = (await activeSatKeyset(fetch, campaign.mint)).id;
    } catch (error) {
      throw asProtocolError(error);
    }
    const outputs = verifyPackage(plan, {
      campaignId: campaign.id, mint: campaign.mint, beneficiaryPubkey: campaign.beneficiaryPubkey,
      totalSat: campaign.contributionSat * campaign.backerCount, keysetId, quoteId: record.quote!.id, ownerPubkey: record.ownerPubkey,
    });
    return { outputs, keysetId };
  }

  const client: ProtocolClient = {
    enrollKey(owner) {
      try {
        return ensureKey(store, owner, now());
      } catch (error) {
        throw new ProtocolError('storage', NOT_SAVED, { cause: error });
      }
    },

    enrollMaintainer(owner) {
      try {
        return enrollMaintainer(store, owner, now());
      } catch (error) {
        throw new ProtocolError(error instanceof StorageError ? 'storage' : 'invalid-key',
          error instanceof StorageError ? NOT_SAVED : (error as Error).message, { cause: error });
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
        throw new ProtocolError('storage', NOT_SAVED, { cause: error });
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

    async reviewBatch(campaign, plan, quote) {
      const { outputs, keysetId } = await checkedPackage(campaign, plan, ownedRecord(quote, quote.ownerPubkey));
      return {
        totalSat: plan.totalSat, keysetId, lockedTo: plan.beneficiaryPubkey, amounts: outputs.map(output => output.amount),
        quoteIds: [...plan.quoteIds],
      };
    },

    async authorizeBatch(campaign, plan, quote, signer) {
      const record = ownedRecord(quote, signer.pubkey);
      if (signer.approvalsStopped(quote.id)) throw new PackageError('stopped', 'New approvals for this deposit are stopped on this device.');
      const { outputs } = await checkedPackage(campaign, plan, record);

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
      const run = await dispatching({
        version: 1, id: operationId, kind: 'payout', mint: plan.mint, quoteIds: [...plan.quoteIds], outputs: plan.outputs,
        keysetId: plan.keyset.id, requestBody, createdAt: now().toISOString(), status: 'prepared',
      });
      return send(run, payoutHandling(plan));
    },

    signLockedProofs(pubkey, proofs) {
      const secretKey = secretKeyFor(store, pubkey);
      if (!secretKey) throw new ProtocolError('invalid-key', 'This browser holds no key for that pubkey.');
      return proofs.map(proof => signLockedProof(proof, secretKey));
    },

    async checkQuotes(mint, quoteIds, signal) {
      const states: QuoteState[] = [];
      try {
        for (const id of quoteIds) states.push((await mintQuote(mint, id, signal)).state);
      } catch (error) {
        throw asProtocolError(error, signal);
      }
      return states;
    },

    // Only the owner's browser holds the deposit record and key, so anyone else is refused before any request.
    async reclaim(quoteId, operationId) {
      const record = findDeposit(store, quoteId);
      if (!record?.quote || !hasKey(store, record.ownerPubkey)) {
        throw new ProtocolError('not-owner', 'This browser holds no key for that deposit. Only its owner can take it back.');
      }
      if (record.status !== 'paid') {
        throw new ProtocolError('not-paid', record.status === 'reclaimed' ? 'This deposit was already reclaimed.' : 'This deposit is not paid and unissued.');
      }
      if ((await recovery.listUnresolved()).some(operation => operation.kind === 'reclaim' && operation.quoteIds.includes(quoteId))) {
        throw new ProtocolError('pending', 'A reclaim of this deposit is already waiting on the mint. Check again instead.');
      }
      const signer = client.signerFor(record.ownerPubkey);
      try {
        await signer.stopNewApprovals(quoteId);
      } catch (error) {
        throw new ProtocolError('storage', NOT_SAVED, { cause: error });
      }

      let keyset: PublicKeyset;
      try {
        keyset = await activeSatKeyset(fetch, record.mint);
      } catch (error) {
        throw asProtocolError(error);
      }
      const outputs = OutputData.createRandomData(record.amountSat, keyset).map(construction);
      const signature = await signer.signOwnMint(quoteId, messages(outputs));
      const run = await dispatching({
        version: 1, id: operationId, kind: 'reclaim', mint: record.mint, quoteIds: [quoteId], outputs, keysetId: keyset.id,
        requestBody: JSON.stringify({ quote: quoteId, outputs: messages(outputs), signature }), createdAt: now().toISOString(),
        status: 'prepared',
      });
      return send(run, reclaimHandling(record, outputs, keyset));
    },

    // Check again: ask the mint about the saved outputs (NUT-09), and only if none were signed and every
    // quote is still unissued, send the same saved request again.
    async recover(operationId) {
      const saved = await recovery.get(operationId);
      if (!saved) throw new ProtocolError('unknown-operation', 'This browser has no saved request with that id.');
      if (saved.status === 'confirmed') {
        return { kind: 'confirmed', operationId, destination: saved.kind === 'payout' ? 'creator' : 'owner', proofs: saved.proofs ?? [] };
      }
      if (saved.status === 'rejected') return { kind: 'rejected', operationId, reason: saved.reason ?? 'Rejected by the mint.' };

      const run = tracker(saved);
      const record = saved.kind === 'reclaim' ? findDeposit(store, saved.quoteIds[0]) : undefined;
      const beneficiaryPubkey = lockedTo(saved.outputs);
      if (saved.kind === 'reclaim' ? !record : !beneficiaryPubkey) return run.pending({ reason: 'The saved request is incomplete.' });
      let handling: Handling;
      let restored: unknown;
      try {
        const keyset = await keysetById(fetch, saved.mint, saved.keysetId);
        handling = record ? reclaimHandling(record, saved.outputs, keyset) : payoutHandling({
          mint: saved.mint, quoteIds: saved.quoteIds as BatchPlan['quoteIds'], outputs: saved.outputs, keyset,
          beneficiaryPubkey: beneficiaryPubkey!, totalSat: saved.outputs.reduce((sum, output) => sum + output.message.amount, 0),
        });
        restored = await mintRequest(fetch, `${saved.mint}/v1/restore`, { outputs: messages(saved.outputs) });
      } catch (error) {
        return run.pending({ reason: (error as Error).message });
      }

      const signatures = restoredSignatures(saved.outputs, restored);
      if (signatures.every(signature => signature !== undefined)) return answered(run, handling, { signatures });
      if (signatures.some(signature => signature !== undefined)) return run.pending({ reason: 'The mint signed only some of the saved outputs.' });

      let states: QuoteState[];
      try {
        states = await client.checkQuotes(saved.mint, saved.quoteIds);
      } catch (error) {
        return run.pending({ reason: (error as Error).message });
      }
      if (states.every(state => state === 'PAID')) {
        if (saved.status !== 'prepared') return send(run, handling);
        const sent: RecoveryOperation = { ...saved, status: 'dispatched', dispatchedAt: now().toISOString() };
        try {
          await recovery.saveResult(sent);
        } catch (error) {
          return run.pending({ reason: (error as Error).message });
        }
        return send(tracker(sent), handling);
      }
      const settlement = await run.rejected(`The mint reports ${states.join(', ')} and signed none of this request’s outputs.`);
      await handling.rejected?.().catch(() => {});
      return settlement;
    },
  };
  return client;
}

export const protocol: ProtocolClient = createProtocolClient({ storage: () => globalThis.localStorage });
