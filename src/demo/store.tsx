import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { liveActions } from '../live/actions';
import { beats, findBeat } from './beats';
import { DEFAULT_VIEWER, initialWorld, people, type Person, type World } from './world';

type Change = (world: World, at: string) => World;

interface Store {
  world: World;
  viewer: Person;
  // Applies a change through the stub world and returns the result, so a screen can
  // decide where to go next from the state it actually got.
  apply: (change: Change) => World;
  demo: boolean;
  // Live mode: every campaign is real at the test mint, and the world is rebuilt from what this browser saved.
  live: boolean;
  // Live mode: rebuild the world from storage after a real action, announcing the notice.
  refresh: (notice?: string) => World;
  beatId: string | undefined;
  showBeat: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const beatParam = params.get('beat');

  // Once opened with ?demo=1 or ?live=1 the mode stays for the visit, even as links drop the query.
  const [demo, setDemo] = useState(() => params.get('demo') === '1');
  const [live, setLive] = useState(() => params.get('live') === '1');
  const [beatId, setBeatId] = useState(() => (live ? undefined : findBeat(beatParam)?.id));
  const [world, setWorld] = useState(() => (live ? liveActions.world(DEFAULT_VIEWER) : findBeat(beatParam)?.world() ?? initialWorld()));
  const latest = useRef(world);

  const load = useCallback((next: World, id: string | undefined) => {
    latest.current = next;
    setWorld(next);
    setBeatId(id);
  }, []);

  useEffect(() => {
    if (params.get('demo') === '1') setDemo(true);
    if (params.get('live') === '1' && !live) {
      setLive(true);
      load(liveActions.world(latest.current.viewerId), undefined);
      return;
    }
    const beat = findBeat(beatParam);
    if (!live && beat && beat.id !== beatId) load(beat.world(), beat.id);
    // Only a change of address loads a beat; later clicks are free to move the world on.
  }, [beatParam, params]);

  const apply = useCallback((change: Change) => {
    const next = change(latest.current, new Date().toISOString());
    latest.current = next;
    setWorld(next);
    return next;
  }, []);

  const refresh = useCallback((notice = '') => {
    const next = liveActions.world(latest.current.viewerId, notice);
    latest.current = next;
    setWorld(next);
    return next;
  }, []);

  const showBeat = useCallback((id: string) => {
    const beat = findBeat(id) ?? beats[0];
    load(beat.world(), beat.id);
    navigate(`${beat.path}?demo=1&beat=${beat.id}`);
  }, [load, navigate]);

  useEffect(() => {
    if (live) liveActions.abandonUnanswered();
  }, [live]);

  const store = useMemo<Store>(() => ({ world, viewer: people[world.viewerId], apply, demo, live, refresh, beatId, showBeat }),
    [world, apply, demo, live, refresh, beatId, showBeat]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore needs a WorldProvider above it.');
  return store;
}
