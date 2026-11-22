// The close is an app rule, not a lock at the mint. It changes what the app asks people to do and never
// moves sats: before it, collecting goes on; at it, with fewer than three in, collecting stops and each
// pleb takes their own back. Once all three are in it no longer applies. A mint quote's expiry is about
// paying the invoice, so it is never used as this deadline.
export type CloseState = 'open' | 'closed' | 'lifted';

export function closeState(closesAt: string | undefined, allIn: boolean, now: Date): CloseState {
  if (allIn) return 'lifted';
  if (!closesAt || now.getTime() < Date.parse(closesAt)) return 'open';
  return 'closed';
}

const HOUR = 3_600_000;

export const closePresets = [
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
  { label: '1 week', hours: 168 },
] as const;

export const DEFAULT_CLOSE_HOURS = 48;

// A preset counts from now and rounds up to the next whole hour, so the close reads as a clean clock time.
export function closeAfter(hours: number, now: Date): string {
  return new Date(Math.ceil((now.getTime() + hours * HOUR) / HOUR) * HOUR).toISOString();
}
