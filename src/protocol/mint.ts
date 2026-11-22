import type { PublicKeyset } from '../domain/models';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type QuoteState = 'UNPAID' | 'PAID' | 'ISSUED';

// Field names as cdk-mintd 0.18.0 returns them.
export interface MintQuoteResponse {
  quote: string;
  request: string;
  amount: number;
  unit: string;
  state: QuoteState;
  expiry: number | null;
  pubkey: string | null;
  amount_paid: number;
  amount_issued: number;
}

export class MintError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MintError';
  }

  // No answer, or the mint failed on its side: worth asking again.
  get transient(): boolean {
    return this.status === undefined || this.status >= 500;
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

export function mintRequest(fetch: FetchLike, url: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  return mintSend(fetch, url, body === undefined ? undefined : JSON.stringify(body), signal);
}

// Sends a body exactly as given, so a saved request string is byte-for-byte what the mint received.
export async function mintSend(fetch: FetchLike, url: string, body?: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new MintError('Couldn’t reach the mint.', undefined, undefined, { cause: error });
  }
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep the raw text for the error */ }
  if (!response.ok) throw new MintError(`The mint answered HTTP ${response.status}.`, response.status, parsed);
  return parsed;
}

// A 4xx with a Cashu error body means the mint looked at the request and refused it.
export function cashuRejection(error: unknown): string | undefined {
  if (!(error instanceof MintError) || error.status === undefined || error.status < 400 || error.status >= 500) return undefined;
  const body = error.body as { code?: unknown; detail?: unknown } | undefined;
  if (typeof body !== 'object' || body === null || typeof body.code !== 'number') return undefined;
  return `${body.code}: ${typeof body.detail === 'string' ? body.detail : 'no detail'}`;
}

export async function activeSatKeyset(fetch: FetchLike, mint: string, signal?: AbortSignal): Promise<PublicKeyset> {
  const list = await mintRequest(fetch, `${mint}/v1/keysets`, undefined, signal) as { keysets?: unknown };
  const entries = Array.isArray(list?.keysets) ? list.keysets as Record<string, unknown>[] : [];
  const active = entries.find(entry => entry.active === true && entry.unit === 'sat' && typeof entry.id === 'string');
  if (!active) throw new MintError('The mint lists no active sat keyset.', 200, list);
  const fee = active.input_fee_ppk ?? 0;
  if (typeof fee !== 'number' || !Number.isSafeInteger(fee) || fee < 0) throw new MintError('The mint sent an invalid input fee.', 200, list);
  return keysetById(fetch, mint, active.id as string, fee, signal);
}

// Each keyset's input fee in parts per thousand, as the mint lists them.
export async function keysetFees(fetch: FetchLike, mint: string, signal?: AbortSignal): Promise<Map<string, number>> {
  const list = await mintRequest(fetch, `${mint}/v1/keysets`, undefined, signal) as { keysets?: unknown };
  const entries = Array.isArray(list?.keysets) ? list.keysets as Record<string, unknown>[] : [];
  const fees = new Map<string, number>();
  for (const entry of entries) {
    const fee = entry.input_fee_ppk ?? 0;
    if (typeof entry.id !== 'string' || typeof fee !== 'number' || !Number.isSafeInteger(fee) || fee < 0) continue;
    fees.set(entry.id, fee);
  }
  return fees;
}

export async function keysetById(fetch: FetchLike, mint: string, id: string, inputFeePpk = 0, signal?: AbortSignal): Promise<PublicKeyset> {
  const answer = await mintRequest(fetch, `${mint}/v1/keys/${encodeURIComponent(id)}`, undefined, signal) as { keysets?: unknown };
  const found = (Array.isArray(answer?.keysets) ? answer.keysets as Record<string, unknown>[] : []).find(entry => entry.id === id);
  const keys = found?.keys as Record<string, unknown> | undefined;
  if (!keys || typeof keys !== 'object' || !Object.values(keys).every(key => typeof key === 'string')) {
    throw new MintError('The mint sent keys in a shape this app doesn’t understand.', 200, answer);
  }
  return { id, unit: 'sat', inputFeePpk, keys: keys as Record<string, string> };
}

export function parseQuote(body: unknown): MintQuoteResponse {
  const value = body as Record<string, unknown>;
  const ok = typeof value === 'object' && value !== null
    && typeof value.quote === 'string' && typeof value.request === 'string'
    && typeof value.amount === 'number' && typeof value.unit === 'string'
    && (value.state === 'UNPAID' || value.state === 'PAID' || value.state === 'ISSUED')
    && (typeof value.expiry === 'number' || value.expiry === null || value.expiry === undefined)
    && (typeof value.pubkey === 'string' || value.pubkey === null || value.pubkey === undefined)
    && typeof value.amount_paid === 'number' && typeof value.amount_issued === 'number';
  if (!ok) throw new MintError('The mint sent a quote in a shape this app doesn’t understand.', 200, body);
  return {
    quote: value.quote as string, request: value.request as string, amount: value.amount as number,
    unit: value.unit as string, state: value.state as QuoteState, expiry: (value.expiry as number | undefined) ?? null,
    pubkey: (value.pubkey as string | undefined) ?? null, amount_paid: value.amount_paid as number,
    amount_issued: value.amount_issued as number,
  };
}
