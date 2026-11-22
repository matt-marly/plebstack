import { useState } from 'react';
import { isHeld, people, sats, tally } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { useSession } from '../session';
import { formatWhen, listNames } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal, whoIsIn } from '../ui/journey';
import { Avatar, Note, ShareInvite, StateChip, useOnline } from '../ui/parts';
import { Sheet } from '../ui/Sheet';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

const counts = ['', 'One more pleb', 'Two more plebs', 'Three more plebs'];

// P4: bring the last pleb in, or leave.
export function Waiting({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const { campaign } = record;
  const maintainer = people[record.creatorId].short;
  const each = sats(campaign.contributionSat);
  const missing = campaign.backerCount - tally(record).held;
  const names = whoIsIn(record, world.viewerId);
  const others = names.filter(name => name !== 'you');

  async function takeBack() {
    setAsking(true);
    setFailure(undefined);
    try {
      refresh(await liveActions.reclaim(world.viewerId, campaign.id));
    } catch (error) {
      setFailure(failureCopy(error));
      setAsking(false);
    }
  }

  return (
    <Frame record={record} rail={journey.rail} title="Waiting for the others"
      actions={(
        <>
          <ShareInvite campaignId={campaign.id} title={campaign.title} />
          <button type="button" className="button" data-variant="quiet" onClick={() => setConfirming(true)}>Take mine back</button>
        </>
      )}>
      <div className="lead rise">
        <StateChip state="deposited" />
        <h1>{counts[missing]} and you’re at the line.</h1>
        <div className="in">
          {record.slots.map(slot => (isHeld(slot)
            ? <Avatar key={slot.id} name={people[slot.backerId!].short} own={slot.backerId === world.viewerId} />
            : <Avatar key={slot.id} open />))}
          <p>{others.length ? `${listNames(others)} and you are in` : 'You’re the first one in'}</p>
        </div>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} meta={`opened ${formatWhen(record.log[0].at)}`} />
      <Track stop={journey.stop} maintainer={maintainer} amount={each} />
      {failure && !confirming && <Note><p>{failure}</p></Note>}
      <Sheet open={confirming} onClose={() => setConfirming(false)} title={`Take your ${each} back?`}>
        <p className="sheet-text">The mint issues your {each} to your own ecash at this mint. This stack then can’t pay {maintainer}, and the others can take theirs back too.</p>
        {failure && <Note><p>{failure}</p></Note>}
        {!online && <Note><p>You’re offline. Nothing was sent.</p></Note>}
        <div className="sheet-actions">
          <button type="button" className="button" data-variant="primary" aria-disabled={asking || !online || undefined}
            onClick={() => { if (!asking && online) void takeBack(); }}>
            {asking ? 'Asking the mint…' : 'Take mine back'}
          </button>
          <button type="button" className="button" data-variant="quiet" onClick={() => setConfirming(false)}>Keep it stacked</button>
        </div>
      </Sheet>
    </Frame>
  );
}
