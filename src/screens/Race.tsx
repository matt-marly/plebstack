import { useNavigate } from 'react-router-dom';
import { maintainerOf, sats } from '../demo/world';
import { paths } from '../routes';
import { Frame } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { campaignGoal } from '../ui/journey';
import { NewStack, Status } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// P10r: the take-back and the payout raced, and the mint issued the payout first.
export function Race({ world, record, journey }: ScreenProps) {
  const navigate = useNavigate();
  const { campaign } = record;
  const maintainer = maintainerOf(record).short;
  const each = sats(campaign.contributionSat);
  return (
    <Frame record={record} rail={journey.rail} here={journey.here} title="The payout got there first"
      actions={(
        <>
          <button type="button" className="button" data-variant="primary"
            onClick={() => navigate(paths.screen(campaign.id, 'paid'))}>
            See the receipt<Icon name="chevron" />
          </button>
          <NewStack />
        </>
      )}>
      <div className="lead rise">
        <Status state="paid" phrase="The payout got there first" />
        <h1>The payout got there first.</h1>
        <p>Your {each} went to {maintainer}, which is what you signed for. The mint turned down your take-back.</p>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} />
      <Track stop={journey.stop} maintainer={maintainer} amount={each} />
    </Frame>
  );
}
