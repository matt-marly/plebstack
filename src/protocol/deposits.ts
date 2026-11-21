import type { MintUrl } from '../domain/models';
import type { QuoteState } from './mint';
import type { RecordStore } from './storage';

export interface SavedQuote {
  id: string;
  request: string;
  state: QuoteState;
  expiry: number | null;
  amountPaid: number;
  amountIssued: number;
}

// requested: saved, request maybe sent, no answer seen. abandoned: the page closed before an answer.
export type DepositStatus = 'requested' | 'quoted' | 'paid' | 'abandoned' | 'failed';

export interface DepositRecord {
  id: string;
  mint: MintUrl;
  amountSat: number;
  ownerPubkey: string;
  createdAt: string;
  updatedAt: string;
  status: DepositStatus;
  quote?: SavedQuote;
  error?: string;
}

const PREFIX = 'deposit:';

export function saveDeposit(store: RecordStore, record: DepositRecord): void {
  store.write(PREFIX + record.id, record);
}

export function listDeposits(store: RecordStore): DepositRecord[] {
  return store.keys(PREFIX).flatMap(key => store.read<DepositRecord>(key) ?? []);
}

export function findDeposit(store: RecordStore, quoteId: string): DepositRecord | undefined {
  return listDeposits(store).find(record => record.quote?.id === quoteId);
}
