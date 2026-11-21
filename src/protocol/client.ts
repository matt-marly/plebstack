import type {
  Authorization, BatchPlan, BlindedOutput, LockedQuote, MintUrl,
  OutputConstruction, RecoveryOperation, Settlement,
} from '../domain/models';
import { findDeposit, listDeposits, saveDeposit, type DepositRecord, type SavedQuote } from './deposits';
import { enrollMaintainer, ensureKey, hasKey, isValidPubkey, secretKeyFor } from './keys';
import { MintError, mintRequest, parseQuote, type FetchLike, type MintQuoteResponse } from './mint';
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
  authorizeBatch(plan: BatchPlan, quote: LockedQuote, signer: QuoteSigner): Promise<Authorization>;
  payout(plan: BatchPlan, authorizations: [Authorization, Authorization, Authorization], operation: RecoveryOperation): Promise<Settlement>;
  reclaim(quote: LockedQuote, outputs: OutputConstruction[], signer: QuoteSigner, operation: RecoveryOperation): Promise<Settlement>;
  recover(operation: RecoveryOperation): Promise<Settlement>;
}

export type ProtocolFailure =
  | 'storage' | 'invalid-key' | 'unknown-quote' | 'mint' | 'not-locked' | 'issued-early' | 'timeout' | 'aborted';

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
      return createQuoteSigner(secretKey, pubkey, quoteId => findDeposit(store, quoteId)?.ownerPubkey === pubkey);
    },

    recovery: createRecoveryStore(store),

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

    authorizeBatch: async () => unavailable(),
    payout: async () => unavailable(),
    reclaim: async () => unavailable(),
    recover: async () => unavailable(),
  };
  return client;
}

export const protocol: ProtocolClient = createProtocolClient({ storage: () => globalThis.localStorage });
