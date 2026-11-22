import { Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { Backing } from './screens/Backing';
import { Claim } from './screens/Claim';
import { Intro } from './screens/Intro';
import { Maintain } from './screens/Maintain';
import { NotFound } from './screens/NotFound';
import { Organize } from './screens/Organize';
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
          <Route path={routes.start} element={<Backing />} />
          <Route path={routes.organize} element={<Organize />} />
          <Route path={routes.organizeStep} element={<Organize />} />
          <Route path={routes.claim} element={<Claim />} />
          <Route path={routes.maintain} element={<Maintain />} />
          <Route path={routes.maintainStep} element={<Maintain />} />
          <Route path={routes.stack} element={<StackRoute />} />
          <Route path={routes.screen} element={<StackRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Announcer />
      </div>
    </SessionProvider>
  );
}
