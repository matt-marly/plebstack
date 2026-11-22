import { failureCopy } from '../live/actions';

const running = new Set<string>();
const failures = new Map<string, string>();

export const keys = {
  payout: (campaignId: string) => `payout:${campaignId}`,
  reclaim: (campaignId: string, personId: string) => `reclaim:${campaignId}:${personId}`,
};

export const isRunning = (key: string) => running.has(key);
export const failureOf = (key: string) => failures.get(key);

// A request to the mint outlives the screen that sent it: the board moves the pleb on at once, and the
// mint's answer refreshes whichever screen is open when it arrives.
export function inBackground(key: string, work: () => Promise<string>, refresh: (notice?: string) => unknown) {
  if (running.has(key)) return;
  running.add(key);
  failures.delete(key);
  const done = work();
  refresh();
  done.then(notice => {
    running.delete(key);
    refresh(notice);
  }, error => {
    running.delete(key);
    failures.set(key, failureCopy(error));
    refresh(failures.get(key));
  });
}
