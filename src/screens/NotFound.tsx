import { useNavigate } from 'react-router-dom';
import { paths } from '../routes';
import { ORGANIZER, usePlayAs } from '../session';
import { Cast } from '../ui/Cast';
import { Brand, TestMint, useTitle } from '../ui/Frame';

export function NotFound() {
  const playAs = usePlayAs();
  const navigate = useNavigate();
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
          <p>One browser plays everyone in this demo, and every stack lives in the browser that started it. A link from another browser won’t open here.</p>
        </div>
        <Cast />
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
