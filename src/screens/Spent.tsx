import { useEffect, useState } from 'react';
import { sats, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { useSession } from '../session';
import { failureOf, inBackground, isRunning, keys } from '../ui/background';
import { formatClock } from '../ui/format';
import { Frame } from '../ui/Frame';
import { maintainerSteps } from '../ui/GoalRail';
import { CopyButton, Note, Pending, Status } from '../ui/parts';
import { PayoutTrack } from '../ui/Track';
import { maintainerFacts } from '../ui/Really';

// M4: after the swap. The ecash is hers alone now; until the mint answers, Check again asks about the same swap.
export function Spent({ record, viewerId }: { record: CampaignRecord; viewerId: string }) {
  const { refresh } = useSession();
  const [ecash, setEcash] = useState<string>();
  const [checkedAt, setCheckedAt] = useState<Date>();
  const { campaign } = record;
  const spend = liveActions.wallet(viewerId, campaign.id).spend!;
  const key = keys.spend(campaign.id);
  const done = spend.status === 'confirmed';
  const fee = done ? spend.grossSat - spend.receivedSat! : 0;
  const facts = maintainerFacts(sats(spend.grossSat));

  useEffect(() => {
    if (!done) return;
    let live = true;
    liveActions.spentEcash(viewerId, campaign.id).then(text => { if (live) setEcash(text); }).catch(() => {});
    return () => { live = false; };
  }, [done, viewerId, campaign.id]);

  function check() {
    setCheckedAt(new Date());
    inBackground(key, () => liveActions.checkSpend(viewerId, campaign.id), refresh);
  }

  function again() {
    inBackground(key, () => liveActions.spend(viewerId, campaign.id), refresh);
  }

  if (!done) {
    const rejected = spend.status === 'rejected';
    return (
      <Frame record={record} rail={{ at: 3, paid: false, steps: maintainerSteps }} title="Swapping at the mint" facts={facts}
        actions={rejected && !isRunning(key)
          ? <button type="button" className="button" data-variant="primary" onClick={again}>Try the swap again</button>
          : (
            <>
              <Pending />
              {!isRunning(key) && <button type="button" className="button" data-variant="secondary" onClick={check}>Check again</button>}
            </>
          )}>
        <div className="lead rise">
          <Status state="reclaiming" phrase={rejected ? 'Turned down' : 'Waiting for the mint'} />
          <h1>{rejected ? 'The mint turned down the swap.' : 'Swapping at the mint.'}</h1>
          <p>{rejected
            ? `Nothing was swapped. Your ${sats(spend.grossSat)} are still locked to your key.`
            : 'Your swap is saved in this browser. Nothing is yours to copy until the mint answers.'}</p>
        </div>
        <p className="mono small muted" aria-live="polite">
          {checkedAt ? `Last checked ${formatClock(checkedAt)}` : `Sent ${formatClock(spend.savedAt)}`}
        </p>
        {!isRunning(key) && (
          <Note><p>{failureOf(key) ?? spend.reason ?? 'Still waiting for the mint. Check again asks about the same swap, never a new one.'}</p></Note>
        )}
      </Frame>
    );
  }

  return (
    <Frame record={record} rail={{ at: 3, paid: false, steps: maintainerSteps }} title={`Yours. ${sats(spend.receivedSat!)}`} facts={facts}
      actions={ecash ? <CopyButton text={ecash} label="Copy ecash" variant="primary" /> : <Pending label="Getting your ecash…" />}>
      <div className="lead rise">
        <h1 className="display">Yours. {sats(spend.receivedSat!)}.</h1>
        <p>Swap fee at the mint, {sats(fee)}. Received, {sats(spend.receivedSat!)}. Copy it into any Cashu wallet.</p>
      </div>
      <dl className="rows">
        <div><dt>From the payout</dt><dd className="mono">{sats(spend.grossSat)}</dd></div>
        <div><dt>Swap fee at the mint</dt><dd className="mono">{sats(fee)}</dd></div>
        <div><dt>Received</dt><dd className="mono">{sats(spend.receivedSat!)}</dd></div>
      </dl>
      <PayoutTrack title={`Where your ${sats(spend.receivedSat!)} are`} stop="spent" label="ecash only you hold" />
      {ecash && <p className="ecash mono">{ecash.slice(0, 64)}…</p>}
    </Frame>
  );
}
