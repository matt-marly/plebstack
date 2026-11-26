import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { people, type Person, type World } from './demo/world';
import { liveActions } from './live/actions';
import { sync } from './live/sync';
import { PLEBS } from './ui/journey';
import { paths } from './routes';

const VIEWER_KEY = 'viewer';
const INTRO_KEY = 'intro-seen';
export const ORGANIZER = 'ada';
export const MAINTAINER = 'ngozi';
// Longest wait setTimeout takes; a later close is checked again when this one fires.
const MAX_WAIT = 2 ** 31 - 1;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; the choice then lasts for this page only.
  }
}

// A key that can't be saved can't be used again, so money actions check this first.
export function storageWorks(): boolean {
  try {
    localStorage.setItem('plebstack:probe', '1');
    localStorage.removeItem('plebstack:probe');
    return true;
  } catch {
    return false;
  }
}

function newestStack(): string | undefined {
  try {
    return liveActions.drafts().at(-1)?.id;
  } catch {
    return undefined;
  }
}

// Each person has one place to be on a stack: the organizer's, the maintainer's, or a pleb's.
export function homePath(personId: string, stackId: string | undefined): string {
  const draft = stackId ? liveActions.draft(stackId) : undefined;
  if (!draft) return personId === ORGANIZER ? paths.start() : paths.home();
  if (personId === draft.organizerId) return paths.organize(draft.id);
  if (personId === draft.maintainerId) return paths.maintain(draft.id);
  return paths.stack(draft.id);
}

// The stack id in an address like /s/:id, /o/:id, /m/:id or /claim/:id.
export function stackIdIn(pathname: string): string | undefined {
  return pathname.match(/^\/(?:s|o|m|claim)\/([^/]+)/)?.[1];
}

export type Presence = 'here' | 'searching' | 'missing';

// Is this stack on this device yet, or still on its way from the relays?
export function presenceOf(id: string): Presence {
  const here = Boolean(liveActions.draft(id));
  const seated = !sync || sync.seats(id).some(seat => seat.device === sync!.device);
  // A device new to this stack waits for the relays' first full answer, so it knows which seats are taken.
  if (sync?.status(id) === 'searching' && !(here && seated)) return 'searching';
  return here ? 'here' : 'missing';
}

// The person this device plays on a stack. A device that opens someone else's link takes its own seat:
// the maintainer's from a claim link, or the first free pleb's from an invite.
// Returns a person only when this call took a new seat; a device that already sits at this stack keeps whoever
// it is playing, so the one-device demo can still switch person freely.
export function seatFor(id: string, wants: 'pleb' | 'maintainer'): string | undefined {
  if (!sync) return undefined;
  const seats = sync.seats(id);
  if (seats.some(seat => seat.device === sync!.device)) return undefined;
  const draft = liveActions.draft(id);
  if (!draft) return undefined;
  if (wants === 'maintainer') {
    sync.claimSeat(id, draft.maintainerId);
    return draft.maintainerId;
  }
  const record = liveActions.world(ORGANIZER).campaigns.find(item => item.campaign.id === id);
  const taken = new Set([...seats.map(seat => seat.personId), ...(record?.slots.flatMap(slot => slot.backerId ?? []) ?? [])]);
  const free = PLEBS.find(pleb => !taken.has(pleb));
  if (free) sync.claimSeat(id, free);
  return free;
}

interface Session {
  world: World;
  viewer: Person;
  // The stack this browser is playing; the newest one on the board.
  stackId: string | undefined;
  notice: string;
  introSeen: boolean;
  refresh: (notice?: string) => World;
  announce: (notice: string) => void;
  viewAs: (personId: string) => void;
  finishIntro: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stackId, setStackId] = useState(newestStack);
  const [viewerId, setViewerId] = useState(() => {
    const saved = read(VIEWER_KEY);
    return saved && people[saved] ? saved : ORGANIZER;
  });
  const [world, setWorld] = useState(() => liveActions.world(viewerId));
  const [introSeen, setIntroSeen] = useState(() => read(INTRO_KEY) === '1');
  const viewer = useRef(viewerId);

  const refresh = useCallback((notice = '') => {
    const next = liveActions.world(viewer.current, notice);
    setWorld(next);
    setStackId(newestStack());
    return next;
  }, []);

  const announce = useCallback((notice: string) => setWorld(current => ({ ...current, notice })), []);

  const viewAs = useCallback((personId: string) => {
    viewer.current = personId;
    setViewerId(personId);
    write(VIEWER_KEY, personId);
    refresh(`Playing as ${people[personId].short}.`);
  }, [refresh]);

  const finishIntro = useCallback(() => {
    setIntroSeen(true);
    write(INTRO_KEY, '1');
  }, []);

  // Another device on the same stack wrote to the board: show it.
  useEffect(() => sync?.subscribe(() => refresh()), [refresh]);

  // Whatever stack the address names, listen for it on the relays.
  const { pathname } = useLocation();
  useEffect(() => sync?.watch(stackIdIn(pathname)), [pathname]);

  useEffect(() => {
    // A request sent before a reload that never got an answer is marked, so Check again can find it.
    liveActions.abandonUnanswered();
    // Another tab playing someone else writes to the same board.
    const onStorage = () => refresh();
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, [refresh]);

  // The close is a clock time, so the screens change when it passes even if nobody taps anything.
  useEffect(() => {
    const now = Date.now();
    const next = world.campaigns.filter(record => record.close === 'open' && record.closesAt)
      .map(record => Date.parse(record.closesAt!) - now).filter(wait => wait > 0).sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(() => refresh(), Math.min(next + 50, MAX_WAIT));
    return () => clearTimeout(timer);
  }, [world, refresh]);

  const session = useMemo<Session>(() => ({
    world, viewer: people[viewerId], stackId, notice: world.notice, introSeen, refresh, announce, viewAs, finishIntro,
  }), [world, viewerId, stackId, introSeen, refresh, announce, viewAs, finishIntro]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider above it.');
  return session;
}

// Switch who is playing and go to their screen in one step, so the old screen never redirects the new person.
export function usePlayAs() {
  const { viewAs } = useSession();
  const navigate = useNavigate();
  return useCallback((personId: string, path: string, replace = false) => startTransition(() => {
    viewAs(personId);
    navigate(path, { replace });
  }), [viewAs, navigate]);
}

// On a stack's own link: wait for it to arrive from the relays, then take this device's seat if it has none.
export function useSeat(id: string, wants: 'pleb' | 'maintainer'): Presence | 'seating' {
  const { world, viewAs } = useSession();
  const presence = presenceOf(id);
  const seated = !sync || sync.seats(id).some(seat => seat.device === sync!.device);
  useEffect(() => {
    if (presence !== 'here') return;
    const person = seatFor(id, wants);
    if (person && person !== world.viewerId) viewAs(person);
  }, [id, wants, presence, world.viewerId, viewAs]);
  return presence === 'here' && !seated ? 'seating' : presence;
}
