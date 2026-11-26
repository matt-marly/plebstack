import { useSyncExternalStore, type ReactNode } from 'react';

const ROOMY = '(min-width: 960px) and (min-height: 760px)';

function subscribe(change: () => void) {
  const query = matchMedia(ROOMY);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}

export function useRoomy(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(ROOMY).matches, () => false);
}

// A web app on every size: the column centres itself on a wide window, with nothing drawn around it.
export function Desk({ children }: { children: ReactNode }) {
  return <div className="desk">{children}</div>;
}
