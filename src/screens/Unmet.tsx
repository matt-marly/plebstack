import { maintainerOf, people, sats, tally, type CampaignRecord } from '../demo/world';
import { formatWhen, listNames } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal, closeLine } from '../ui/journey';
import { NewStack, Status } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { TakeBack } from '../ui/TakeBack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// Why there is no payout, from what the mint answered.
export function whyUnmet(record: CampaignRecord, viewerId: string): string {
  const takers = record.slots.filter(slot => slot.deposit?.state === 'reclaimed' && slot.backerId !== viewerId)
    .map(slot => people[slot.backerId!].short);
  const rejected = record.operations.some(op => op.kind === 'payout' && op.status === 'rejected');
  if (takers.length && rejected) return `${listNames(takers)} took theirs back first, so the payout didn’t go.`;
  if (takers.length) return `${listNames(takers)} took theirs back and the stack closed.`;
  if (record.stoppedAt) return `${people[record.creatorId].short} stopped collecting.`;
  if (record.close === 'closed') return `The stack closed at ${formatWhen(record.closesAt!)} with ${tally(record).held} of 3 in.`;
  if (record.campaign.collectionStopped) return `${people[record.creatorId].short} stopped collecting.`;
  return 'The mint turned down the payout. Nobody’s sats moved.';
}

// P9: no payout this time. Each pleb takes their own back; nobody needs to approve it.
export function Unmet({ world, record, journey }: ScreenProps) {
  const { campaign } = record;
  const each = sats(campaign.contributionSat);
  return (
    <Frame record={record} rail={journey.rail} here={journey.here} title="No payout this time"
      actions={(
        <>
          <TakeBack record={record} viewerId={world.viewerId} variant="primary" />
          <NewStack />
        </>
      )}>
      <div className="lead rise">
        <Status state="unmet" phrase="Didn’t fill · yours to take back" plain />
        <h1>No payout this time.</h1>
        <p>{whyUnmet(record, world.viewerId)} That’s fine: your {each} are still at the mint, yours. Take them back. Nobody needs to approve it.</p>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} meta={record.close === 'closed' ? closeLine(record) : 'closed'} />
      <Track stop={journey.stop} maintainer={maintainerOf(record).short} amount={each} />
    </Frame>
  );
}
