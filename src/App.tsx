import { Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { Intro } from './screens/Intro';
import { NotFound } from './screens/NotFound';
import { Splash } from './screens/Splash';
import { StackRoute } from './screens/StackRoute';
import { SessionProvider, useSession } from './session';

function Announcer() {
  const { notice } = useSession();
  return <p className="visually-hidden" role="status" aria-live="polite">{notice}</p>;
}

export function App() {
  return (
    <SessionProvider>
      <div className="shell">
        <Routes>
          <Route path={routes.splash} element={<Splash />} />
          <Route path={routes.intro} element={<Intro />} />
          <Route path={routes.stack} element={<StackRoute />} />
          <Route path={routes.screen} element={<StackRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Announcer />
      </div>
    </SessionProvider>
  );
}
