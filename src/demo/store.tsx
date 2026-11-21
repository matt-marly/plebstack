import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { beats, findBeat } from './beats';
import { abandonUnanswered } from './live';
import { initialWorld, people, type Person, type World } from './world';

type Change = (world: World, at: string) => World;

interface Store {
  world: World;
  viewer: Person;
  // Applies a change through the stub world and returns the result, so a screen can
  // decide where to go next from the state it actually got.
  apply: (change: Change) => World;
  demo: boolean;
  // Live mode: the join screen creates a real locked quote at the test mint for the viewing backer.
  live: boolean;
  beatId: string | undefined;
  showBeat: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const beatParam = params.get('beat');

  const [beatId, setBeatId] = useState(() => findBeat(beatParam)?.id);
  const [world, setWorld] = useState(() => findBeat(beatParam)?.world() ?? initialWorld());
  // Once opened with ?demo=1 the control stays for the visit, even as links drop the query.
  const [demo, setDemo] = useState(() => params.get('demo') === '1');
  const [live, setLive] = useState(() => params.get('live') === '1');
  const latest = useRef(world);

  const load = useCallback((next: World, id: string | undefined) => {
    latest.current = next;
    setWorld(next);
    setBeatId(id);
  }, []);

  useEffect(() => {
    if (params.get('demo') === '1') setDemo(true);
    if (params.get('live') === '1') setLive(true);
    const beat = findBeat(beatParam);
    if (beat && beat.id !== beatId) load(beat.world(), beat.id);
    // Only a change of address loads a beat; later clicks are free to move the world on.
  }, [beatParam, params]);

  const apply = useCallback((change: Change) => {
    const next = change(latest.current, new Date().toISOString());
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
    if (live) abandonUnanswered();
  }, [live]);

  const store = useMemo<Store>(() => ({ world, viewer: people[world.viewerId], apply, demo, live, beatId, showBeat }),
    [world, apply, demo, live, beatId, showBeat]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore needs a WorldProvider above it.');
  return store;
}
