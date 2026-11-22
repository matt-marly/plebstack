import { isHeld, people, sats, tally } from '../demo/world';
import { formatWhen, listNames } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal, whoIsIn } from '../ui/journey';
import { Avatar, ShareInvite, StateChip } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { TakeBack } from '../ui/TakeBack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

const counts = ['', 'One more pleb', 'Two more plebs', 'Three more plebs'];

// P4: bring the last pleb in, or leave.
export function Waiting({ world, record, journey }: ScreenProps) {
  const { campaign } = record;
  const maintainer = people[record.creatorId].short;
  const each = sats(campaign.contributionSat);
  const missing = campaign.backerCount - tally(record).held;
  const others = whoIsIn(record, world.viewerId).filter(name => name !== 'you');

  return (
    <Frame record={record} rail={journey.rail} title="Waiting for the others"
      actions={(
        <>
          <ShareInvite campaignId={campaign.id} title={campaign.title} />
          <TakeBack record={record} viewerId={world.viewerId} />
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
    </Frame>
  );
}
