import { Outlet, Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { Backing } from './screens/Backing';
import { Claim } from './screens/Claim';
import { Intro } from './screens/Intro';
import { Maintain } from './screens/Maintain';
import { NotFound } from './screens/NotFound';
import { Organize } from './screens/Organize';
import { Splash } from './screens/Splash';
import { Stage } from './screens/Stage';
import { StackRoute } from './screens/StackRoute';
import { SessionProvider, useSession } from './session';
import { Desk } from './ui/Desk';

function Announcer() {
  const { notice } = useSession();
  return <p className="visually-hidden" role="status" aria-live="polite">{notice}</p>;
}

// Every screen but the stage sits in one phone column, framed as a phone on a desktop.
function Phone() {
  return (
    <Desk>
      <div className="shell">
        <Outlet />
        <Announcer />
      </div>
    </Desk>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path={routes.stage} element={<Stage />} />
        <Route path={routes.newestStage} element={<Stage />} />
        <Route element={<Phone />}>
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
        </Route>
      </Routes>
    </SessionProvider>
  );
}
