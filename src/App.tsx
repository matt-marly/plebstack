import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { WorldProvider } from './demo/store';
import { routes } from './routes';
import { NotFound } from './screens/shared';
import { Layout } from './ui/Layout';

const Approve = lazy(() => import('./screens/Approve').then(module => ({ default: module.Approve })));
const Back = lazy(() => import('./screens/Back').then(module => ({ default: module.Back })));
const CampaignPage = lazy(() => import('./screens/CampaignPage').then(module => ({ default: module.CampaignPage })));
const CreateCampaign = lazy(() => import('./screens/CreateCampaign').then(module => ({ default: module.CreateCampaign })));
const DepositDetail = lazy(() => import('./screens/DepositDetail').then(module => ({ default: module.DepositDetail })));
const Home = lazy(() => import('./screens/Home').then(module => ({ default: module.Home })));
const Payout = lazy(() => import('./screens/Payout').then(module => ({ default: module.Payout })));
const Reclaim = lazy(() => import('./screens/Reclaim').then(module => ({ default: module.Reclaim })));
const Recovery = lazy(() => import('./screens/Recovery').then(module => ({ default: module.Recovery })));

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
