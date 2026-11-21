import { generatePath } from 'react-router-dom';

export const routes = {
  home: '/',
  create: '/campaigns/new',
  campaign: '/campaigns/:campaignId',
  back: '/campaigns/:campaignId/back',
  deposit: '/campaigns/:campaignId/deposits/:depositId',
  approve: '/campaigns/:campaignId/deposits/:depositId/approve',
  reclaim: '/campaigns/:campaignId/deposits/:depositId/reclaim',
  payout: '/campaigns/:campaignId/payout',
  recovery: '/recovery',
} as const;

export const paths = {
  home: () => routes.home,
  create: () => routes.create,
  campaign: (campaignId: string) => generatePath(routes.campaign, { campaignId }),
  back: (campaignId: string) => generatePath(routes.back, { campaignId }),
  deposit: (campaignId: string, depositId: string) => generatePath(routes.deposit, { campaignId, depositId }),
  approve: (campaignId: string, depositId: string) => generatePath(routes.approve, { campaignId, depositId }),
  reclaim: (campaignId: string, depositId: string) => generatePath(routes.reclaim, { campaignId, depositId }),
  payout: (campaignId: string) => generatePath(routes.payout, { campaignId }),
  recovery: () => routes.recovery,
};
