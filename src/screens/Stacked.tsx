import { useLocation, useNavigate } from 'react-router-dom';
import { groupComplete, maintainerOf, sats } from '../demo/world';
import { paths } from '../routes';
import { Frame } from '../ui/Frame';
import { campaignGoal, closeLine } from '../ui/journey';
import { Quiet, ShareInvite, Status } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// P3: the first win. The slab drops in only when arriving from the mint's answer, never on a reload.
export function Stacked({ world, record, journey }: ScreenProps) {
  const navigate = useNavigate();
  const landed = (useLocation().state as { landed?: boolean } | null)?.landed === true;
  const { campaign } = record;
  const maintainer = maintainerOf(record).short;
  const each = sats(campaign.contributionSat);
  const full = groupComplete(record);
  const next = () => navigate(paths.stack(campaign.id));

  return (
    <Frame record={record} rail={journey.rail} here={journey.here} title="Stacked"
      actions={full ? <button type="button" className="button" data-variant="primary" onClick={next}>Continue</button> : (
        <>
          <ShareInvite campaignId={campaign.id} title={campaign.title} />
          <Quiet onClick={next}>See who’s in</Quiet>
        </>
      )}>
      <div className="lead rise">
        <Status state="deposited" phrase="Locked at the mint" plain />
        <h1 className="display">Stacked.</h1>
        <p>Your {each} are at the mint, locked to your key. {maintainer} gets nothing unless all three sign.</p>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} meta={closeLine(record)} landing={landed} />
      <Track stop="at-mint" from={landed ? 'to-mint' : undefined} maintainer={maintainer} amount={each} />
    </Frame>
  );
}
