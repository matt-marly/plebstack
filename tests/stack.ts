import { closeAfter } from '../src/domain/close';
import type { LiveActions } from '../src/live/actions';

export const WORK = { maintainerName: 'Ngozi Eze', title: 'Daylight-saving drift', publicWorkUrl: 'https://codeberg.org/ngozi/pocket-ical/pulls/412' };

// Ada names the work, Ngozi confirms her key on her own side, Ada sets the terms.
export function openStack(actions: LiveActions, { title = WORK.title, closesAt = closeAfter(48, new Date()) } = {}): string {
  const id = actions.startStack('ada', { ...WORK, title });
  actions.claimKey('ngozi', id);
  return actions.createCampaign('ada', id, { closesAt, contributionSat: 21 });
}
