import { useState } from 'react';
import { maintainerOf, people, fellShort, sats, statusOf } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { storageWorks, useSession } from '../session';
import { Frame } from '../ui/Frame';
import { campaignGoal, closeLine } from '../ui/journey';
import { Note, useOnline } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Who } from '../ui/Who';
import type { ScreenProps } from './StackRoute';

// P1: meet the maintainer, see the stack, chip in.
export function Join({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const online = useOnline();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [canSave] = useState(storageWorks);
  const { campaign } = record;
  const maintainer = maintainerOf(record);
  const organizer = people[record.creatorId].short;
  const each = sats(campaign.contributionSat);
  const total = sats(campaign.contributionSat * campaign.backerCount);
  const goal = campaignGoal(record, world.viewerId);
  const kind = journey.step.kind;
  const unmet = statusOf(record) === 'unmet' || (kind === 'watch' && fellShort(record));

  async function chipIn() {
    setAsking(true);
    setFailure(undefined);
    try {
      await liveActions.join(world.viewerId, campaign.id);
      refresh(`Pay this invoice to stack ${each}. Not stacked until the mint reports it paid.`);
    } catch (error) {
      setFailure(failureCopy(error));
      setAsking(false);
    }
  }

  const blocked = !canSave ? 'This browser can’t save anything, so it couldn’t keep your key. Nothing was sent to the mint.'
    : !online ? 'You’re offline. Nothing was sent.' : undefined;
  const headline = unmet ? 'This stack didn’t fill.'
    : kind === 'watch' ? 'This stack is full.' : `${organizer} is getting 3 plebs to back ${maintainer.short}.`;
  const text = unmet ? `There’s no payout this time. Each pleb takes their own ${each} back.`
      : kind === 'watch' ? `Three plebs are in. ${maintainer.short} gets ${total} once all three sign and the mint confirms.`
        : `Chip in ${each}. If all three of you sign, ${maintainer.short} gets ${total}. If not, everyone takes their own back.`;

  return (
    <Frame record={record} rail={journey.rail} title={kind === 'join' ? `Back ${maintainer.short}` : headline}
      actions={kind === 'join' && (
        <>
          <button type="button" className="button" data-variant="primary" aria-disabled={asking || !!blocked || undefined}
            onClick={() => { if (!asking && !blocked) void chipIn(); }}>
            {asking ? 'Asking the mint…' : `Chip in ${each}`}
          </button>
          <p className="fine">Nobody holds your keys but you. Not us, not the organizer.</p>
        </>
      )}>
      <Who name={maintainer.name} title={campaign.title} keyBy={record.keyBy} organizer={organizer} />
      <div className="lead rise">
        <h1>{headline}</h1>
        <p>{text}</p>
      </div>
      <Stack goal={goal} meta={closeLine(record)} />
      {kind === 'join' && (blocked || failure) && <Note><p>{blocked ?? failure}</p></Note>}
    </Frame>
  );
}
