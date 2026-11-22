import { useState } from 'react';
import { people, sats, statusOf } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { storageWorks, useSession } from '../session';
import { formatWhen } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal } from '../ui/journey';
import { Note, useOnline } from '../ui/parts';
import { Stack } from '../ui/Stack';
import type { ScreenProps } from './StackRoute';

// P1: meet the maintainer, see the stack, chip in.
export function Join({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const online = useOnline();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [canSave] = useState(storageWorks);
  const { campaign } = record;
  const maintainer = people[record.creatorId];
  const each = sats(campaign.contributionSat);
  const total = sats(campaign.contributionSat * campaign.backerCount);
  const goal = campaignGoal(record, world.viewerId);
  const kind = journey.step.kind;
  const unmet = statusOf(record) === 'unmet';

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
  const headline = kind === 'organize' ? 'You’re the maintainer.'
    : unmet ? 'This stack didn’t fill.'
      : kind === 'watch' ? 'This stack is full.' : `${maintainer.short} is looking for 3 plebs.`;
  const text = kind === 'organize' ? 'The payout is locked to your key, so you can’t also chip in.'
    : unmet ? `There’s no payout this time. Each pleb takes their own ${each} back.`
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
      <div className="who">
        <span className="avatar" data-size="large" aria-hidden="true">{maintainer.short[0]}</span>
        <div>
          <p className="who-name">{maintainer.name} <span className="badge">Key confirmed</span></p>
          <p className="who-work">{campaign.title}</p>
        </div>
      </div>
      <div className="lead rise">
        <h1>{headline}</h1>
        <p>{text}</p>
      </div>
      <Stack goal={goal} meta={`opened ${formatWhen(record.log[0]?.at ?? new Date().toISOString())}`} />
      {kind === 'join' && (blocked || failure) && <Note><p>{blocked ?? failure}</p></Note>}
    </Frame>
  );
}
