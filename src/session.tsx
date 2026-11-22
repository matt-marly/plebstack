import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { people, type Person, type World } from './demo/world';
import { liveActions } from './live/actions';
import { PLEBS } from './ui/journey';

const VIEWER_KEY = 'viewer';
const INTRO_KEY = 'intro-seen';

export const SEED = {
  title: 'Fix DST drift in pocket-ical recurring events',
  publicWorkUrl: 'https://git.example.org/ngozi/pocket-ical/issues/412',
  contributionSat: 21,
};

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

// Ngozi makes her key in her own namespace, then opens the stack the plebs join.
export function openStack(): string {
  const beneficiaryPubkey = liveActions.maintainerKey('ngozi');
  return liveActions.createCampaign('ngozi', { ...SEED, beneficiaryPubkey });
}

function currentStack(): string | undefined {
  const campaigns = liveActions.world('ngozi').campaigns;
  if (campaigns.length > 0) return campaigns[campaigns.length - 1].campaign.id;
  try {
    return openStack();
  } catch {
    return undefined;
  }
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
  freshStack: () => string;
  finishIntro: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stackId, setStackId] = useState(currentStack);
  const [viewerId, setViewerId] = useState(() => {
    const saved = read(VIEWER_KEY);
    return saved && (PLEBS as readonly string[]).includes(saved) ? saved : PLEBS[0];
  });
  const [world, setWorld] = useState(() => liveActions.world(viewerId));
  const [introSeen, setIntroSeen] = useState(() => read(INTRO_KEY) === '1');
  const viewer = useRef(viewerId);

  const refresh = useCallback((notice = '') => {
    const next = liveActions.world(viewer.current, notice);
    setWorld(next);
    return next;
  }, []);

  const announce = useCallback((notice: string) => setWorld(current => ({ ...current, notice })), []);

  const viewAs = useCallback((personId: string) => {
    viewer.current = personId;
    setViewerId(personId);
    write(VIEWER_KEY, personId);
    refresh(`Playing as ${people[personId].short}.`);
  }, [refresh]);

  const freshStack = useCallback(() => {
    const id = openStack();
    setStackId(id);
    refresh('A fresh stack is open. Nobody is in yet.');
    return id;
  }, [refresh]);

  const finishIntro = useCallback(() => {
    setIntroSeen(true);
    write(INTRO_KEY, '1');
  }, []);

  useEffect(() => {
    // A request sent before a reload that never got an answer is marked, so Check again can find it.
    liveActions.abandonUnanswered();
    // Another tab playing someone else writes to the same board.
    const onStorage = () => refresh();
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, [refresh]);

  const session = useMemo<Session>(() => ({
    world, viewer: people[viewerId], stackId, notice: world.notice, introSeen, refresh, announce, viewAs, freshStack, finishIntro,
  }), [world, viewerId, stackId, introSeen, refresh, announce, viewAs, freshStack, finishIntro]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider above it.');
  return session;
}
