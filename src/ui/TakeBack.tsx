import { useState } from 'react';
import { maintainerOf, sats, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { useSession } from '../session';
import { failureOf, inBackground, isRunning, keys } from './background';
import { Note, useOnline } from './parts';
import { Sheet } from './Sheet';

// The owner's own mint of their own deposit. Nobody approves it; once signed, it can race the payout.
export function TakeBack({ record, viewerId, signed, variant = 'quiet' }: {
  record: CampaignRecord; viewerId: string; signed?: boolean; variant?: 'primary' | 'quiet';
}) {
  const { refresh } = useSession();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const { campaign } = record;
  const key = keys.reclaim(campaign.id, viewerId);
  const failure = failureOf(key);
  const each = sats(campaign.contributionSat);
  const maintainer = maintainerOf(record).short;
  const asking = isRunning(key);

  function takeBack() {
    setOpen(false);
    inBackground(key, () => liveActions.reclaim(viewerId, campaign.id), refresh);
  }

  return (
    <>
      <button type="button" className="button" data-variant={variant} onClick={() => setOpen(true)}>Take mine back</button>
      {failure && !open && <Note><p>{failure}</p></Note>}
      <Sheet open={open} onClose={() => setOpen(false)} title={`Take your ${each} back?`}>
        <p className="sheet-text">
          {signed
            ? `You already signed. If the payout reaches the mint first, your ${each} go to ${maintainer}. If your take-back gets there first, the payout can’t go.`
            : `The mint issues your ${each} to your own ecash at this mint. This stack then can’t pay ${maintainer}, and the others can take theirs back too.`}
        </p>
        {!online && <Note><p>You’re offline. Nothing was sent.</p></Note>}
        <div className="sheet-actions">
          <button type="button" className="button" data-variant="primary" aria-disabled={asking || !online || undefined}
            onClick={() => { if (!asking && online) takeBack(); }}>
            Take mine back
          </button>
          <button type="button" className="button" data-variant="quiet" onClick={() => setOpen(false)}>Keep it stacked</button>
        </div>
      </Sheet>
    </>
  );
}
