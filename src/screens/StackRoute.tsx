import { Navigate, useParams } from 'react-router-dom';
import { findCampaign, isHeld, slotOf, type CampaignRecord, type World } from '../demo/world';
import { paths } from '../routes';
import { useSession } from '../session';
import { journeyOf, type Journey, type Screen } from '../ui/journey';
import { Back } from './Back';
import { Join } from './Join';
import { NotFound } from './NotFound';
import { Paid } from './Paid';
import { Pay } from './Pay';
import { Race } from './Race';
import { Sending } from './Sending';
import { Sign } from './Sign';
import { Signed } from './Signed';
import { Stacked } from './Stacked';
import { Unmet } from './Unmet';
import { Waiting } from './Waiting';

export interface ScreenProps {
  world: World;
  record: CampaignRecord;
  journey: Journey;
}

const screens: Record<Screen, (props: ScreenProps) => React.ReactNode> = {
  join: Join, pay: Pay, stacked: Stacked, waiting: Waiting, sign: Sign, signed: Signed, sending: Sending, paid: Paid, race: Race,
  unmet: Unmet, back: Back,
};

// Stacked is the first win, so it stays open after the deposit lands until the pleb moves on. After a lost
// race the receipt is one tap away.
function allowed(screen: Screen, journey: Journey, record: CampaignRecord, viewerId: string): boolean {
  if (screen === journey.screen) return true;
  if (screen === 'paid' && journey.screen === 'race') return true;
  const own = slotOf(record, viewerId);
  return screen === 'stacked' && own !== undefined && isHeld(own) && journey.step.kind !== 'paid';
}

// Every screen of a stack is one address; the viewer's step decides which one they may see, so actions
// only refresh the world and this moves the pleb on.
export function StackRoute() {
  const { campaignId = '', screen } = useParams();
  const { world } = useSession();
  const record = findCampaign(world, campaignId);
  if (!record) return <NotFound />;
  const journey = journeyOf(world, record);
  const wanted = screen as Screen | undefined;
  if (!wanted || !(wanted in screens) || !allowed(wanted, journey, record, world.viewerId)) {
    // Leaving Pay means the mint reported the deposit paid: that is the moment the slab lands.
    const landed = wanted === 'pay' && allowed('stacked', journey, record, world.viewerId);
    // Leaving Sending or Signed for Paid means the mint's confirmation just arrived with the screen open.
    const lit = journey.screen === 'paid' && (wanted === 'sending' || wanted === 'signed');
    return <Navigate to={paths.screen(campaignId, landed ? 'stacked' : journey.screen)} state={{ landed, lit }} replace />;
  }
  const Component = screens[wanted];
  return <Component key={`${world.viewerId}/${wanted}`} world={world} record={record} journey={journey} />;
}
