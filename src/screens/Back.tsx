import { useEffect, useState } from 'react';
import { maintainerOf, pendingOperation, sats, slotOf } from '../demo/world';
import { liveActions } from '../live/actions';
import { useSession } from '../session';
import { failureOf, inBackground, isRunning, keys } from '../ui/background';
import { formatClock } from '../ui/format';
import { Frame } from '../ui/Frame';
import { CopyButton, NewStack, Note, Pending, Status } from '../ui/parts';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// P10: taking back, then back to you. The ecash comes from this pleb's own saved request.
export function Back({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const [ecash, setEcash] = useState<string>();
  const [checkedAt, setCheckedAt] = useState<Date>();
  const { campaign } = record;
  const viewerId = world.viewerId;
  const slot = slotOf(record, viewerId)!;
  const each = sats(campaign.contributionSat);
  const maintainer = maintainerOf(record).short;
  const back = journey.step.kind === 'reclaimed';
  const op = pendingOperation(record, 'reclaim', slot.id);
  const key = keys.reclaim(campaign.id, viewerId);
  const inFlight = isRunning(key);
  // The batch was on its way, or turned down, when this take-back landed.
  const first = back && record.operations.some(other => other.kind === 'payout');

  useEffect(() => {
    if (!back) return;
    let live = true;
    liveActions.ecash(viewerId, campaign.id).then(text => { if (live) setEcash(text); }).catch(() => {});
    return () => { live = false; };
  }, [back, viewerId, campaign.id]);

  function checkAgain() {
    if (!op) return;
    setCheckedAt(new Date());
    inBackground(key, () => liveActions.checkReclaim(viewerId, campaign.id, op.id), refresh);
  }

  if (!back) {
    return (
      <Frame record={record} rail={journey.rail} here={journey.here} title="Taking it back"
        actions={(
          <>
            <Pending />
            {!inFlight && op && <button type="button" className="button" data-variant="secondary" onClick={checkAgain}>Check again</button>}
          </>
        )}>
        <div className="lead rise">
          <Status state="reclaiming" />
          <h1>Taking it back.</h1>
          <p>Asking the mint for your own {each}. If you signed, the payout may still get there first.</p>
        </div>
        <Track stop={journey.stop} maintainer={maintainer} amount={each} />
        <p className="mono small muted" aria-live="polite">
          {checkedAt ? `Last checked ${formatClock(checkedAt)}` : op ? `Asked ${formatClock(op.savedAt)}` : ''}
        </p>
        {!inFlight && op && <Note><p>{failureOf(key) ?? 'Still waiting for the mint. The request is saved. Check again asks the mint about the same request.'}</p></Note>}
      </Frame>
    );
  }

  return (
    <Frame record={record} rail={journey.rail} here={journey.here} title="Back to you"
      actions={(
        <>
          {ecash ? <CopyButton text={ecash} label="Copy ecash" variant="primary" /> : <Pending label="Getting your ecash…" />}
          <NewStack />
        </>
      )}>
      <div className="lead rise">
        <Status state="reclaimed" />
        <h1 className={first ? undefined : 'display'}>{first ? 'Your take-back got there first.' : 'Back to you.'}</h1>
        <p>
          {first ? `The payout can’t go now. The others’ ${each} are still at the mint, theirs to take back. ` : ''}
          Your {each} are now ecash saved in this browser. Paste it into any Cashu wallet.
        </p>
      </div>
      <Track stop={journey.stop} maintainer={maintainer} amount={each} />
      {ecash && <p className="ecash mono">{ecash.slice(0, 64)}…</p>}
    </Frame>
  );
}
