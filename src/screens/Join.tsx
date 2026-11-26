import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { maintainerOf, people, fellShort, sats, statusOf, tally, type CampaignRecord } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { paths } from '../routes';
import { homePath, storageWorks, usePlayAs, useSession } from '../session';
import { formatWhen } from '../ui/format';
import { Frame } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { campaignGoal, closeLine } from '../ui/journey';
import { NewStack, Note, Quiet, useOnline } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Who } from '../ui/Who';
import type { ScreenProps } from './StackRoute';
import { whyUnmet } from './Unmet';

// Why someone who never chipped in can't now, from the record. Their own sats never left their wallet.
export function whyClosed(record: CampaignRecord, viewerId: string): string {
  const { held } = tally(record);
  const moved = record.slots.some(slot => slot.deposit);
  const total = sats(record.campaign.contributionSat * record.campaign.backerCount);
  const maintainer = maintainerOf(record).short;
  const state = statusOf(record);
  const yours = 'You didn’t chip in, so none of your sats moved.';
  if (state === 'paid') return `${maintainer} got ${total}, confirmed by the mint. ${yours}`;
  if (!fellShort(record)) return `All three spots are taken. ${yours}`;
  const why = record.close === 'closed' ? `This stack closed on ${formatWhen(record.closesAt!)} with ${held} of 3 in.` : whyUnmet(record, viewerId);
  return `${why} ${moved ? yours : 'No sats moved.'}`;
}

// P1: meet the maintainer, see the stack, chip in.
export function Join({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const playAs = usePlayAs();
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
  const open = kind === 'join';
  const headline = unmet ? 'This stack didn’t fill.'
    : !open ? 'This stack is full.' : `Back ${maintainer.short} with ${each}`;
  const text = !open ? whyClosed(record, world.viewerId)
    : `${organizer} invited 3 people. If all 3 sign, ${maintainer.short} gets ${total}.`;
  const { held } = tally(record);

  return (
    <Frame record={record} rail={journey.rail} here={journey.here} title={open ? `Back ${maintainer.short}` : headline}
      actions={open ? (
        <>
          <button type="button" className="button" data-variant="primary" aria-disabled={asking || !!blocked || undefined}
            onClick={() => { if (!asking && !blocked) void chipIn(); }}>
            {asking ? 'Asking the mint…' : `Chip in ${each}`}
          </button>
          <p className="fine">Only you hold the key to your {each}.</p>
        </>
      ) : (
        <>
          <NewStack variant="primary" />
          <button type="button" className="button" data-variant="secondary" onClick={() => navigate(paths.intro(1))}>See how it works</button>
          <Quiet onClick={() => playAs(record.creatorId, homePath(record.creatorId, campaign.id))}>Play as {organizer} to see this stack</Quiet>
        </>
      )}>
      <div className="lead rise">
        {open && <p className="invite-eyebrow">{organizer} invited you</p>}
        <h1>{headline}</h1>
        <p>{text}</p>
      </div>
      {open && (
        <ul className="facts-strip" role="list">
          <li><span className="fact-value">{each}</span><span className="fact-label">your part</span></li>
          <li><span className="fact-value">{held} of {campaign.backerCount}</span><span className="fact-label">people in</span></li>
          <li><span className="fact-value">{total}</span><span className="fact-label">to {maintainer.short}</span></li>
        </ul>
      )}
      <Stack goal={goal} meta={closeLine(record)} />
      {open && (
        <p className="safety"><Icon name="undo" /><span><strong>Worst case:</strong> it doesn’t fill and you take your {each} back.</span></p>
      )}
      <Who name={maintainer.name} title={campaign.title} keyBy={record.keyBy} pubkey={campaign.beneficiaryPubkey} organizer={organizer} />
      {kind === 'join' && (blocked || failure) && <Note><p>{blocked ?? failure}</p></Note>}
    </Frame>
  );
}
