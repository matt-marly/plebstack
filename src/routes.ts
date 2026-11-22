import { generatePath } from 'react-router-dom';
import type { Screen } from './ui/journey';

export const routes = {
  splash: '/',
  intro: '/intro/:page',
  start: '/new',
  organize: '/o/:campaignId',
  organizeStep: '/o/:campaignId/:step',
  claim: '/claim/:campaignId',
  maintain: '/m/:campaignId',
  maintainStep: '/m/:campaignId/:step',
  stack: '/s/:campaignId',
  screen: '/s/:campaignId/:screen',
  stage: '/s/:campaignId/stage',
  newestStage: '/stage',
} as const;

export type OrganizeStep = 'key' | 'terms' | 'share' | 'watch';
export type MaintainStep = 'follow' | 'receive' | 'spend';

export const paths = {
  splash: () => routes.splash,
  intro: (page: number) => generatePath(routes.intro, { page: String(page) }),
  start: () => routes.start,
  organize: (campaignId: string, step?: OrganizeStep) =>
    step ? generatePath(routes.organizeStep, { campaignId, step }) : generatePath(routes.organize, { campaignId }),
  claim: (campaignId: string) => generatePath(routes.claim, { campaignId }),
  maintain: (campaignId: string, step?: MaintainStep) =>
    step ? generatePath(routes.maintainStep, { campaignId, step }) : generatePath(routes.maintain, { campaignId }),
  stack: (campaignId: string) => generatePath(routes.stack, { campaignId }),
  screen: (campaignId: string, screen: Screen) => generatePath(routes.screen, { campaignId, screen }),
  stage: (campaignId?: string) => (campaignId ? generatePath(routes.stage, { campaignId }) : routes.newestStage),
};
