import type { Authorization, BatchPlan, Campaign, LockedQuote } from '../domain/models';
import type { QuoteState } from '../protocol/mint';
import type { RecordStore } from '../protocol/storage';

// Stands in for a relay or server that everyone reads. Public material only: terms, quotes, the
// package, released signatures and results. Never a key or a proof.
export type BoardEvent =
  | { type: 'joined'; at: string; personId: string; quote: LockedQuote }
  | { type: 'deposited'; at: string; personId: string; quote: LockedQuote }
  | { type: 'package'; at: string; plan: BatchPlan }
  | { type: 'released'; at: string; personId: string; authorization: Authorization }
  | { type: 'stopped'; at: string; personId: string }
  | { type: 'collection-stopped'; at: string }
  | { type: 'sent'; at: string; kind: 'payout' | 'reclaim'; operationId: string; personId: string; keysetId?: string }
  | {
    type: 'settled'; at: string; operationId: string; status: 'confirmed' | 'rejected' | 'unresolved' | 'not-sent';
    reason?: string; quoteStates?: Record<string, QuoteState>;
  };

export interface BoardCampaign {
  campaign: Campaign;
  creatorId: string;
  createdAt: string;
  events: BoardEvent[];
}

export interface Board {
  list(): BoardCampaign[];
  get(campaignId: string): BoardCampaign | undefined;
  create(entry: BoardCampaign): void;
  append(campaignId: string, event: BoardEvent): void;
}

const PREFIX = 'campaign:';

export function createBoard(store: RecordStore): Board {
  const get = (campaignId: string) => store.read<BoardCampaign>(PREFIX + campaignId);
  return {
    get,
    list: () => store.keys(PREFIX).flatMap(key => store.read<BoardCampaign>(key) ?? [])
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    create(entry) {
      if (get(entry.campaign.id)) throw new Error(`Campaign ${entry.campaign.id} already exists.`);
      store.write(PREFIX + entry.campaign.id, entry);
    },
    // Read fresh on every write, so another tab's events are never overwritten.
    append(campaignId, event) {
      const entry = get(campaignId);
      if (!entry) throw new Error(`No campaign ${campaignId}.`);
      store.write(PREFIX + campaignId, { ...entry, events: [...entry.events, event] });
    },
  };
}
