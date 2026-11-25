import { useEffect, useState } from 'react';
import { maintainerOf, sats, slotOf } from '../demo/world';
import { failureCopy, liveActions, type LiveReview } from '../live/actions';
import { useSession } from '../session';
import { inBackground, keys } from '../ui/background';
import { Checked, checkResults } from '../ui/Checked';
import { Frame } from '../ui/Frame';
import { GroupCard } from '../ui/GroupCard';
import { Icon } from '../ui/Icon';
import { readyToSend } from '../ui/journey';
import { Note, Status, useOnline } from '../ui/parts';
import { Sheet } from '../ui/Sheet';
import { TakeBack } from '../ui/TakeBack';
import type { ScreenProps } from './StackRoute';

// P5: check the payout on this phone, then sign the group card. P5s is the confirm sheet.
export function Sign({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const online = useOnline();
  const [review, setReview] = useState<LiveReview>();
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signFailure, setSignFailure] = useState<string>();
  const { campaign } = record;
  const viewerId = world.viewerId;
  const maintainer = maintainerOf(record);
  const total = sats(campaign.contributionSat * campaign.backerCount);
  const quote = slotOf(record, viewerId)!.quote!;
  const stopped = journey.step.kind === 'stopped';

  useEffect(() => {
    if (stopped) return;
    let live = true;
    setFailure(undefined);
    liveActions.review(viewerId, campaign.id)
      .then(result => { if (live) setReview(result); })
      .catch(error => { if (live) setFailure(failureCopy(error)); });
    return () => { live = false; };
  }, [viewerId, campaign.id, attempt, stopped]);

  async function sign() {
    setSigning(true);
    setSignFailure(undefined);
    try {
      const { notice } = await liveActions.sign(viewerId, campaign.id);
      const signed = liveActions.world(viewerId);
      const now = signed.campaigns.find(other => other.campaign.id === campaign.id)!;
      // The last signature is what sends the batch to the mint.
      if (readyToSend(now)) inBackground(keys.payout(campaign.id), () => liveActions.payout(viewerId, campaign.id), refresh);
      else refresh(notice);
    } catch (error) {
      setSignFailure(failureCopy(error));
      setSigning(false);
    }
  }

  async function stopSigning() {
    setConfirming(false);
    try {
      refresh(await liveActions.stopSigning(viewerId, campaign.id));
    } catch (error) {
      setSignFailure(failureCopy(error));
    }
  }

  if (stopped) {
    return (
      <Frame record={record} rail={journey.rail} title="You stopped signing"
        actions={<TakeBack record={record} viewerId={viewerId} variant="primary" />}>
        <div className="lead rise">
          <Status state="ready" />
          <h1>You stopped signing on this device.</h1>
          <p>A signature you already released still counts. Your {sats(campaign.contributionSat)} are still at the mint, locked to you, and you can take them back.</p>
        </div>
        <GroupCard record={record} viewerId={viewerId} />
      </Frame>
    );
  }

  const ready = review !== undefined && !failure;
  return (
    <Frame record={record} rail={journey.rail} title="Sign the group card"
      actions={(
        <>
          <button type="button" className="button" data-variant="primary" aria-disabled={!ready || undefined}
            onClick={() => { if (ready) setConfirming(true); }}>
            Sign for the {campaign.contributionSat * campaign.backerCount}-sat payout
          </button>
          <p className="fine">Once you sign, you can’t unsign.</p>
        </>
      )}>
      <div className="lead rise">
        <Status state="ready" />
        <h1>Everyone’s in. Sign the group card.</h1>
        <p>You’re agreeing to one thing: {total} go to {maintainer.short}, but only if all three of you sign.</p>
      </div>
      <GroupCard record={record} viewerId={viewerId} />
      <Checked results={review && checkResults(record, review, quote.id)} failure={failure} />
      {failure && (
        <Note>
          <p>Nothing was signed.</p>
          <button type="button" className="button" data-variant="secondary" onClick={() => setAttempt(count => count + 1)}>Check again</button>
        </Note>
      )}
      {signFailure && !confirming && <Note><p>{signFailure}</p></Note>}
      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Sign the group card?">
        <ul className="ticks" role="list">
          <li><span className="check-box"><Icon name="check" /></span>{total} in total, from the three of you</li>
          <li><span className="check-box"><Icon name="check" /></span>Goes only to {maintainer.short}’s key</li>
          <li><span className="check-box"><Icon name="check" /></span>Same payout everyone else sees</li>
        </ul>
        <p className="sheet-text">
          Your signature only works for this exact payout, and it sends nothing by itself. You can’t unsign. If someone takes theirs back first, nothing moves.
          <span className="mono term">NUT-20 signature over this exact batch</span>
        </p>
        {signFailure && <Note><p>{signFailure}</p></Note>}
        {!online && <Note><p>You’re offline. Nothing was sent.</p></Note>}
        <div className="sheet-actions">
          <button type="button" className="button" data-variant="primary" aria-disabled={signing || !online || undefined}
            onClick={() => { if (!signing && online) void sign(); }}>
            {signing ? 'Signing…' : 'Sign'}
          </button>
          <button type="button" className="button" data-variant="secondary" onClick={() => setConfirming(false)}>Not yet</button>
        </div>
        <button type="button" className="button" data-variant="secondary" onClick={() => void stopSigning()}>
          Stop signing on this device
        </button>
      </Sheet>
    </Frame>
  );
}
