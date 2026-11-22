import { useEffect, useState } from 'react';
import { sats, type CampaignRecord } from '../demo/world';
import { failureCopy, liveActions, type Received } from '../live/actions';
import { useSession } from '../session';
import { failureOf, inBackground, isRunning, keys } from '../ui/background';
import { formatWhen } from '../ui/format';
import { Frame } from '../ui/Frame';
import { maintainerSteps } from '../ui/GoalRail';
import { campaignGoal } from '../ui/journey';
import { Note, StateChip, useOnline } from '../ui/parts';
import { maintainerFacts } from '../ui/Really';
import { Stack } from '../ui/Stack';
import { PayoutTrack } from '../ui/Track';
import { confirmedPayout } from './Paid';

// M3: the payout arrived, locked to her key. It is saved on her side before she can spend it.
export function Receive({ record, viewerId }: { record: CampaignRecord; viewerId: string }) {
  const { refresh } = useSession();
  const online = useOnline();
  const [received, setReceived] = useState<Received>();
  const [failure, setFailure] = useState<string>();
  const { campaign } = record;
  const total = sats(campaign.contributionSat * campaign.backerCount);
  const payout = confirmedPayout(record);
  const key = keys.spend(campaign.id);

  useEffect(() => {
    try {
      setReceived(liveActions.receive(viewerId, campaign.id));
    } catch (error) {
      setFailure(failureCopy(error));
    }
  }, [viewerId, campaign.id]);

  function spend() {
    inBackground(key, () => liveActions.spend(viewerId, campaign.id), refresh);
  }

  const ready = received !== undefined && online && !isRunning(key);
  return (
    <Frame record={record} rail={{ at: 2, paid: false, steps: maintainerSteps }} title={`${total} for you`} facts={maintainerFacts(total)}
      actions={received && (
        <button type="button" className="button" data-variant="primary" aria-disabled={!ready || undefined}
          onClick={() => { if (ready) spend(); }}>
          Spend
        </button>
      )}>
      <div className="lead rise">
        <StateChip state="paid" phrase="Confirmed by the mint" />
        <h1 className="display">{total} for you.</h1>
        <p>Three plebs stacked together. Confirmed by the mint at {formatWhen(payout?.settledAt ?? new Date().toISOString())}.</p>
      </div>
      <Stack goal={campaignGoal(record)} />
      <PayoutTrack title={`Where your ${total} are`} stop="locked" label="locked to your key" />
      {!received && !failure && record.keyBy === 'pasted' && (
        <Note><p>This payout is locked to a key Ada pasted. This browser has no key for it, so it can’t be spent here.</p></Note>
      )}
      {!online && <Note><p>You’re offline. Nothing was sent.</p></Note>}
      {(failure ?? failureOf(key)) && <Note><p>{failure ?? failureOf(key)}</p></Note>}
    </Frame>
  );
}
