import type { Authorization, BatchPlan, Campaign, IssuedProof, LockedQuote } from '../domain/models';
import type { QuoteState } from '../protocol/mint';
import type { RecordStore } from '../protocol/storage';

// Stands in for a relay or server that everyone reads. Public material only: drafts, terms, quotes, the
// package, released signatures and results. Never a key. The only proofs here are the payout's, which
// are locked to the maintainer's key and so spend for nobody else.
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
  }
  | { type: 'delivered'; at: string; operationId: string; proofs: IssuedProof[] };

// Where the payout key came from. Only 'maintainer' means it was made and confirmed on the maintainer's own device.
export interface PayoutKey {
  pubkey: string;
  at: string;
  by: 'maintainer' | 'pasted';
}

// What the organizer has said before the stack opens: who, what, where, and once claimed, the key.
export interface BoardDraft {
  id: string;
  organizerId: string;
  maintainerId: string;
  maintainerName: string;
  title: string;
  publicWorkUrl: string;
  createdAt: string;
  key?: PayoutKey;
}

export interface BoardCampaign {
  campaign: Campaign;
  // The organizer.
  creatorId: string;
  maintainerId: string;
  maintainerName: string;
  key: PayoutKey;
  closesAt: string;
  createdAt: string;
  events: BoardEvent[];
}

export interface Board {
  list(): BoardCampaign[];
  get(campaignId: string): BoardCampaign | undefined;
  create(entry: BoardCampaign): void;
  append(campaignId: string, event: BoardEvent): void;
  drafts(): BoardDraft[];
  draft(id: string): BoardDraft | undefined;
  createDraft(draft: BoardDraft): void;
  setKey(id: string, key: PayoutKey): void;
}

const PREFIX = 'campaign:';
const DRAFT = 'draft:';

export function createBoard(store: RecordStore): Board {
  const get = (campaignId: string) => store.read<BoardCampaign>(PREFIX + campaignId);
  const draft = (id: string) => store.read<BoardDraft>(DRAFT + id);
  const newestLast = <T extends { createdAt: string }>(items: T[]) => items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    get,
    list: () => newestLast(store.keys(PREFIX).flatMap(key => store.read<BoardCampaign>(key) ?? [])),
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
    draft,
    drafts: () => newestLast(store.keys(DRAFT).flatMap(key => store.read<BoardDraft>(key) ?? [])),
    createDraft(entry) {
      if (draft(entry.id) || get(entry.id)) throw new Error(`Stack ${entry.id} already exists.`);
      store.write(DRAFT + entry.id, entry);
    },
    // The terms lock when the stack opens, so the key can't change after that.
    setKey(id, key) {
      const entry = draft(id);
      if (!entry) throw new Error(`No stack ${id}.`);
      if (get(id)) throw new Error('This stack is open. Its payout key can’t change.');
      store.write(DRAFT + id, { ...entry, key });
    },
  };
}
