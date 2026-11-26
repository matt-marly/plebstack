import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event } from 'nostr-tools/pure';
import type { Board, BoardCampaign, BoardDraft, BoardEvent, PayoutKey } from './board';

// The shared board, carried between devices over Nostr relays. Each device keeps its own copy in local storage
// and publishes every write as one event tagged with the stack's id; other devices merge what they hear.
// Only public material goes out: the same drafts, terms, quotes, signatures and results the board already holds.
// Keys never leave the device that made them.

export const SYNC_KIND = 4919;
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const DEVICE_KEY = 'plebstack-device';
const SEEN_KEY = 'plebstack-sync-seen';
const RELAYS_KEY = 'plebstack-relays';
const SEATS = 'plebstack-seats:';

export type SyncOp =
  | { op: 'draft'; draft: BoardDraft }
  | { op: 'key'; id: string; key: PayoutKey }
  | { op: 'open'; entry: BoardCampaign }
  | { op: 'event'; campaignId: string; event: BoardEvent }
  | { op: 'seat'; id: string; personId: string };

export type StackStatus = 'searching' | 'ready';

export interface Seat {
  personId: string;
  device: string;
  at: number;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function unhex(text: string): Uint8Array {
  return Uint8Array.from(text.match(/../g) ?? [], pair => parseInt(pair, 16));
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage refused: this device still works, it just hears things again after a reload.
  }
}

// Relays come from ?relays=wss://a,wss://b (remembered), then the build's VITE_RELAYS, then the defaults.
export function relayList(): string[] {
  const fromUrl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('relays') : null;
  if (fromUrl) write(RELAYS_KEY, fromUrl.split(',').filter(Boolean));
  const saved = read<string[]>(RELAYS_KEY, []);
  if (saved.length) return saved;
  const built = (import.meta.env?.VITE_RELAYS as string | undefined)?.split(',').filter(Boolean);
  return built?.length ? built : DEFAULT_RELAYS;
}

export function createSync() {
  let secret = read<string>(DEVICE_KEY, '');
  if (!secret) write(DEVICE_KEY, secret = hex(generateSecretKey()));
  const device = getPublicKey(unhex(secret));
  const relays = relayList();
  const pool = new SimplePool();
  const seen = new Set(read<string[]>(SEEN_KEY, []));
  const status = new Map<string, StackStatus>();
  const listeners = new Set<() => void>();
  const pending: { op: SyncOp; createdAt: number; author: string }[] = [];
  let inner: Board | undefined;

  const changed = () => listeners.forEach(listener => listener());
  const remember = (id: string) => {
    seen.add(id);
    write(SEEN_KEY, [...seen].slice(-2000));
  };

  function seats(id: string): Seat[] {
    return read<Seat[]>(SEATS + id, []);
  }

  function addSeat(id: string, seat: Seat) {
    const current = seats(id);
    if (current.some(known => known.device === seat.device && known.personId === seat.personId)) return;
    write(SEATS + id, [...current, seat].sort((a, b) => a.at - b.at));
  }

  // One op, applied once. Returns false when it has to wait for something it builds on.
  function apply(op: SyncOp, createdAt: number, author: string): boolean {
    const board = inner!;
    switch (op.op) {
      case 'draft':
        if (!board.draft(op.draft.id) && !board.get(op.draft.id)) board.createDraft(op.draft);
        return true;
      case 'key':
        if (!board.draft(op.id)) return false;
        if (!board.get(op.id)) board.setKey(op.id, op.key);
        return true;
      case 'open':
        if (!board.get(op.entry.campaign.id)) board.create({ ...op.entry, events: [] });
        for (const event of op.entry.events) board.merge(op.entry.campaign.id, event);
        return true;
      case 'event':
        if (!board.get(op.campaignId)) return false;
        board.merge(op.campaignId, op.event);
        return true;
      case 'seat':
        addSeat(op.id, { personId: op.personId, device: author, at: createdAt });
        return true;
    }
  }

  function receive(event: Event) {
    if (seen.has(event.id) || event.kind !== SYNC_KIND || !verifyEvent(event)) return;
    let op: SyncOp;
    try {
      op = JSON.parse(event.content) as SyncOp;
    } catch {
      return;
    }
    remember(event.id);
    try {
      if (!apply(op, event.created_at, event.pubkey)) pending.push({ op, createdAt: event.created_at, author: event.pubkey });
      // Something new may unblock what was waiting.
      for (let progress = true; progress;) {
        progress = false;
        for (const [index, waiting] of pending.entries()) {
          if (apply(waiting.op, waiting.createdAt, waiting.author)) {
            pending.splice(index, 1);
            progress = true;
            break;
          }
        }
      }
    } catch {
      // A malformed or conflicting op from someone else never breaks this device's board.
    }
    changed();
  }

  function publish(id: string, op: SyncOp) {
    const event = finalizeEvent({
      kind: SYNC_KIND, created_at: Math.floor(Date.now() / 1000), tags: [['s', id], ['t', 'plebstack']], content: JSON.stringify(op),
    }, unhex(secret));
    remember(event.id);
    watch(id);
    for (const sent of pool.publish(relays, event)) sent.catch(() => undefined);
  }

  function watch(id: string | undefined) {
    if (!id || status.has(id)) return;
    status.set(id, 'searching');
    pool.subscribeMany(relays, { kinds: [SYNC_KIND], '#s': [id] }, {
      onevent: receive,
      oneose: () => {
        status.set(id, 'ready');
        changed();
      },
    });
    // A slow or unreachable relay never leaves a screen searching for ever.
    setTimeout(() => {
      if (status.get(id) === 'searching') {
        status.set(id, 'ready');
        changed();
      }
    }, 8000);
  }

  return {
    device,
    relays,
    watch,
    status: (id: string) => status.get(id),
    seats,
    claimSeat(id: string, personId: string) {
      addSeat(id, { personId, device, at: Math.floor(Date.now() / 1000) });
      publish(id, { op: 'seat', id, personId });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // Every write to the board on this device also goes to the relays.
    wrap(board: Board): Board {
      inner = board;
      for (const draft of board.drafts()) watch(draft.id);
      return {
        ...board,
        create(entry) {
          board.create(entry);
          publish(entry.campaign.id, { op: 'open', entry });
        },
        append(campaignId, event) {
          board.append(campaignId, event);
          publish(campaignId, { op: 'event', campaignId, event });
        },
        createDraft(draft) {
          board.createDraft(draft);
          publish(draft.id, { op: 'draft', draft });
          // The device that starts a stack is its organizer's.
          addSeat(draft.id, { personId: draft.organizerId, device, at: Math.floor(Date.now() / 1000) });
          publish(draft.id, { op: 'seat', id: draft.id, personId: draft.organizerId });
        },
        setKey(id, key) {
          board.setKey(id, key);
          publish(id, { op: 'key', id, key });
        },
      };
    },
  };
}

export type Sync = ReturnType<typeof createSync>;

// One per page, and only in a browser: tests and scripts use the board without any network.
export const sync: Sync | undefined = typeof window !== 'undefined' && typeof WebSocket !== 'undefined' ? createSync() : undefined;
