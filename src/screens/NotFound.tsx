import { paths } from '../routes';
import { ORGANIZER, usePlayAs } from '../session';
import { Brand, TestMint, useTitle } from '../ui/Frame';

export function NotFound() {
  const playAs = usePlayAs();
  useTitle('Not found');
  return (
    <div className="screen">
      <header className="top-bar">
        <Brand />
        <TestMint />
      </header>
      <main className="body" id="main">
        <div className="lead">
          <h1>We couldn’t find this stack.</h1>
          <p>The link may be from another browser. Everything here lives in this one.</p>
        </div>
      </main>
      <footer className="actions">
        <button type="button" className="button" data-variant="primary" onClick={() => playAs(ORGANIZER, paths.start())}>
          Start a stack
        </button>
      </footer>
    </div>
  );
}
