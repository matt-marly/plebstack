import { useState } from 'react';
import { maintainerOf, pendingOperation, sats } from '../demo/world';
import { liveActions } from '../live/actions';
import { useSession } from '../session';
import { failureOf, inBackground, isRunning, keys } from '../ui/background';
import { formatClock } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal } from '../ui/journey';
import { Note, Pending, Status } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// P7: the batch is with the mint. Never Paid here: that waits for the mint's answer.
export function Sending({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const [checkedAt, setCheckedAt] = useState<Date>();
  const { campaign } = record;
  const op = pendingOperation(record, 'payout');
  const key = keys.payout(campaign.id);
  const inFlight = isRunning(key);
  const failure = failureOf(key);

  function checkAgain() {
    if (!op) return;
    setCheckedAt(new Date());
    inBackground(key, () => liveActions.checkPayout(world.viewerId, campaign.id, op.id), refresh);
  }

  return (
    <Frame record={record} rail={journey.rail} here={journey.here} title="Sending"
      actions={(
        <>
          <Pending />
          {!inFlight && op && <button type="button" className="button" data-variant="secondary" onClick={checkAgain}>Check again</button>}
        </>
      )}>
      <div className="lead rise">
        <Status state="paying out" phrase="Sending · not paid yet" plain live />
        <h1>All three signed. Sending.</h1>
        <p>The payout is with the mint as one batch. Nothing is paid until the mint confirms.</p>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} />
      <Track stop={journey.stop} maintainer={maintainerOf(record).short} amount={sats(campaign.contributionSat)} />
      <p className="mono small muted" aria-live="polite">
        {checkedAt ? `Last checked ${formatClock(checkedAt)}` : op ? `Sent ${formatClock(op.savedAt)}` : ''}
      </p>
      {!inFlight && op && (
        <Note>
          <p>{failure ?? 'Still waiting for the mint. The request is saved. Nothing is paid until the mint confirms.'}</p>
        </Note>
      )}
    </Frame>
  );
}
