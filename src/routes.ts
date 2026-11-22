import { generatePath } from 'react-router-dom';
import type { Screen } from './ui/journey';

export const routes = {
  splash: '/',
  intro: '/intro/:page',
  stack: '/s/:campaignId',
  screen: '/s/:campaignId/:screen',
} as const;

export const paths = {
  splash: () => routes.splash,
  intro: (page: number) => generatePath(routes.intro, { page: String(page) }),
  stack: (campaignId: string) => generatePath(routes.stack, { campaignId }),
  screen: (campaignId: string, screen: Screen) => generatePath(routes.screen, { campaignId, screen }),
};
