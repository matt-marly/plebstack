import { Route, Routes } from 'react-router-dom';
import { WorldProvider } from './demo/store';
import { routes } from './routes';
import { Approve } from './screens/Approve';
import { Back } from './screens/Back';
import { CampaignPage } from './screens/CampaignPage';
import { CreateCampaign } from './screens/CreateCampaign';
import { DepositDetail } from './screens/DepositDetail';
import { Home } from './screens/Home';
import { Payout } from './screens/Payout';
import { Reclaim } from './screens/Reclaim';
import { Recovery } from './screens/Recovery';
import { NotFound } from './screens/shared';
import { Layout } from './ui/Layout';

export function App() {
  return (
    <WorldProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path={routes.home} element={<Home />} />
          <Route path={routes.create} element={<CreateCampaign />} />
          <Route path={routes.campaign} element={<CampaignPage />} />
          <Route path={routes.back} element={<Back />} />
          <Route path={routes.deposit} element={<DepositDetail />} />
          <Route path={routes.approve} element={<Approve />} />
          <Route path={routes.reclaim} element={<Reclaim />} />
          <Route path={routes.payout} element={<Payout />} />
          <Route path={routes.recovery} element={<Recovery />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </WorldProvider>
  );
}
