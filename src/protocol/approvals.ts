import type { RecordStore } from './storage';

// A released signature can be submitted by whoever holds it; this record is the backer's own copy.
export interface ReleaseRecord {
  quoteId: string;
  campaignId: string;
  signature: string;
  outputsDigest: string;
  releasedAt: string;
}

export function saveRelease(store: RecordStore, record: ReleaseRecord): void {
  store.write(`release:${record.quoteId}`, record);
}

export function findRelease(store: RecordStore, quoteId: string): ReleaseRecord | undefined {
  return store.read<ReleaseRecord>(`release:${quoteId}`);
}

export function storedStops(store: RecordStore, now: () => Date) {
  return {
    has: (quoteId: string) => store.read(`stop:${quoteId}`) !== undefined,
    add: (quoteId: string) => store.write(`stop:${quoteId}`, { quoteId, stoppedAt: now().toISOString() }),
  };
}
