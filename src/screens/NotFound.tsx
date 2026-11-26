import { useNavigate } from 'react-router-dom';
import { paths } from '../routes';
import { ORGANIZER, usePlayAs } from '../session';
import { TopBar, useTitle } from '../ui/Frame';

// While a stack is still on its way from the relays, a calm wait instead of an error.
export function Arriving() {
  useTitle('Opening the stack');
  return (
    <div className="screen">
      <header className="top"><TopBar /></header>
      <main className="body" id="main" aria-busy="true">
        <div className="lead">
          <h1>Opening the stack…</h1>
          <p>Fetching it from the relays.</p>
        </div>
      </main>
    </div>
  );
}

export function NotFound() {
  const playAs = usePlayAs();
  const navigate = useNavigate();
  useTitle('Not found');
  return (
    <div className="screen">
      <header className="top"><TopBar /></header>
      <main className="body" id="main">
        <div className="lead">
          <h1>We couldn’t find this stack.</h1>
          <p>Check the link with whoever sent it. A stack only opens once its organizer’s device has shared it.</p>
        </div>
      </main>
      <footer className="actions">
        <button type="button" className="button" data-variant="primary" onClick={() => playAs(ORGANIZER, paths.start())}>
          Start a stack
        </button>
        <button type="button" className="button" data-variant="secondary" onClick={() => navigate(paths.intro(1))}>See how it works</button>
      </footer>
    </div>
  );
}
