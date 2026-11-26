import { people } from '../demo/world';
import { createProtocolClient, type ProtocolClient } from '../protocol/client';
import type { FetchLike } from '../protocol/mint';
import { createRecordStore, type RecordStore, type StorageLike } from '../protocol/storage';
import { createBoard, type Board } from './board';

// The coordinator relays public material and submits the batch. It has no way to make or hold a key.
// Neither does the organizer: their screens only ever write to the public board.
export type Coordinator = Pick<ProtocolClient, 'preparePayout' | 'payout' | 'recover' | 'checkQuotes'>;

export interface Actors {
  person(personId: string): ProtocolClient;
  // A person's own app records, in the same namespace as their keys.
  notes(personId: string): RecordStore;
  coordinator: Coordinator;
  board: Board;
}

export const namespaces = {
  person: (personId: string) => `person:${personId}`,
  coordinator: 'coordinator',
  board: 'public',
};

// One browser plays everyone, so each person gets their own namespace over the same storage
// and one person's code path never reads another's key.
export function createActors({ storage, fetch, wrapBoard = board => board }: {
  storage: StorageLike | (() => StorageLike); fetch?: FetchLike; wrapBoard?: (board: Board) => Board;
}): Actors {
  const clients = new Map<string, ProtocolClient>();
  const known = (personId: string) => {
    if (!people[personId]) throw new Error(`Unknown person ${personId}.`);
    return namespaces.person(personId);
  };
  const coordinator: Coordinator = createProtocolClient({ storage, fetch, namespace: namespaces.coordinator });
  return {
    person(personId) {
      let client = clients.get(personId);
      if (!client) clients.set(personId, client = createProtocolClient({ storage, fetch, namespace: known(personId) }));
      return client;
    },
    notes: personId => createRecordStore(storage, known(personId)),
    coordinator,
    board: wrapBoard(createBoard(createRecordStore(storage, namespaces.board))),
  };
}
