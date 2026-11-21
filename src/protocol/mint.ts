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

export async function mintRequest(fetch: FetchLike, url: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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
