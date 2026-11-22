import { useLocation, useNavigate } from 'react-router-dom';
import { groupComplete, maintainerOf, sats } from '../demo/world';
import { paths } from '../routes';
import { Frame } from '../ui/Frame';
import { campaignGoal, closeLine } from '../ui/journey';
import { ShareInvite, StateChip } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// P3: the first win. The slab drops in only when arriving from the mint's answer, never on a reload.
export function Stacked({ world, record }: ScreenProps) {
  const navigate = useNavigate();
  const landed = (useLocation().state as { landed?: boolean } | null)?.landed === true;
  const { campaign } = record;
  const maintainer = maintainerOf(record).short;
  const each = sats(campaign.contributionSat);
  const full = groupComplete(record);
  const next = () => navigate(paths.stack(campaign.id));

  return (
    <Frame record={record} rail={{ at: 1, paid: false }} title="Stacked"
      actions={full ? <button type="button" className="button" data-variant="primary" onClick={next}>Continue</button> : (
        <>
          <ShareInvite campaignId={campaign.id} title={campaign.title} />
          <button type="button" className="button" data-variant="quiet" onClick={next}>See who’s in</button>
        </>
      )}>
      <div className="lead rise">
        <StateChip state="deposited" />
        <h1 className="display">Stacked.</h1>
        <p>Your {each} are waiting at the mint, locked to your key. {maintainer} gets nothing unless all three sign.</p>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} meta={closeLine(record)} landing={landed} />
      <Track stop="at-mint" from={landed ? 'to-mint' : undefined} maintainer={maintainer} amount={each} />
    </Frame>
  );
}
