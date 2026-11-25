import { useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { paths } from '../routes';
import { Brand } from './Frame';
import { Icon } from './Icon';
import { Qr } from './Qr';

// Only a window with room for the whole phone gets the frame; phones and small windows keep the bare column.
const ROOMY = '(min-width: 960px) and (min-height: 760px)';

function subscribe(change: () => void) {
  const query = matchMedia(ROOMY);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}

export function useRoomy(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(ROOMY).matches, () => false);
}

// On a desktop the app sits in a phone, with a quiet note beside it on how to open it on a real one.
// The wrappers stay on a phone too (as display: contents), so crossing the size never remounts the screen.
export function Desk({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const roomy = useRoomy();
  const url = `${location.origin}${pathname}${search}`;
  return (
    <div className="desk" data-framed={roomy || undefined}>
      {roomy && (
        <aside className="desk-side" aria-label="About this page">
          <Brand />
          <p className="desk-lead">A phone app on the web. Open it on your phone:</p>
          <Qr text={url} label={`QR code for ${url}`} />
          <Link className="button" data-variant="quiet" to={paths.stage()}>Open the stage<Icon name="chevron" /></Link>
          <p className="desk-note">It runs on testnut, a test mint: the sats are fake, so nothing here is real money.</p>
        </aside>
      )}
      <div className="device">
        <div className="device-glass" data-sheet-host={roomy || undefined}>{children}</div>
      </div>
    </div>
  );
}
