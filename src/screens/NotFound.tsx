import { Link } from 'react-router-dom';
import { paths } from '../routes';
import { useSession } from '../session';
import { Brand, TestMint, useTitle } from '../ui/Frame';

export function NotFound() {
  const { stackId } = useSession();
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
        <Link className="button" data-variant="primary" to={stackId ? paths.stack(stackId) : paths.splash()}>Go to the demo stack</Link>
      </footer>
    </div>
  );
}
