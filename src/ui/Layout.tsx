import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DemoPanel } from '../demo/DemoPanel';
import { useStore } from '../demo/store';
import { people, setViewer } from '../demo/world';
import { TEST_MINT } from '../domain/models';
import { paths } from '../routes';
import { Icon } from './Icon';

const sessions = [
  { id: 'ishaan', role: 'backer' },
  { id: 'tobi', role: 'backer' },
  { id: 'maren', role: 'backer' },
  { id: 'ngozi', role: 'creator and organizer' },
];

function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light');
  const next = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private browsing can refuse storage; the choice then lasts for this page only.
    }
    setTheme(next);
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} theme`}>
      <Icon name="theme" />
    </button>
  );
}

export function Layout() {
  const { world, viewer, apply, demo } = useStore();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);

  // A new page starts at the top with focus on the content, as a full page load would.
  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="shell" data-demo={demo || undefined}>
      <a className="skip" href="#main">Skip to content</a>

      <div className="strip">
        <div className="wrap">
          <p className="strip-note">Prototype with stub data. Nothing here moves money.</p>
          <label className="viewing">
            Viewing as
            <select value={viewer.id} onChange={event => apply(current => setViewer(current, event.target.value))}>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>{people[session.id].name}, {session.role}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <header className="masthead">
        <div className="wrap">
          <Link className="wordmark" to={paths.home()}>All Together</Link>
          <nav className="masthead-nav" aria-label="Main">
            <NavLink to={paths.home()} end>Campaigns</NavLink>
            <NavLink to={paths.recovery()}>Recovery</NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main" className="page" tabIndex={-1} ref={main}>
        <div className="wrap"><Outlet /></div>
      </main>

      <footer className="site-foot">
        <div className="wrap">
          <p>Test mint <span className="mono">{TEST_MINT}</span>. Fake sats only.</p>
          <p>Deposits sit at the mint. A released approval can’t be revoked, and a reclaim can race the payout.</p>
        </div>
      </footer>

      <p role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">{world.notice}</p>
      {demo && <DemoPanel />}
    </div>
  );
}
