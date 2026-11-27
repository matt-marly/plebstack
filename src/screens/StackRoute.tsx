import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { findCampaign, isHeld, slotOf, type CampaignRecord, type World } from '../demo/world';
import { paths } from '../routes';
import { homePath, useSeat, useSession } from '../session';
import { journeyOf, plebHere, type Journey, type Screen } from '../ui/journey';
import { Back } from './Back';
import { Join } from './Join';
import { Arriving, Full, NotFound, NotOpenYet } from './NotFound';
import { liveActions } from '../live/actions';
import { Paid } from './Paid';
import { Pay } from './Pay';
import { Race } from './Race';
import { Sending } from './Sending';
import { Sign } from './Sign';
import { Signed } from './Signed';
import { Stacked } from './Stacked';
import { Unmet } from './Unmet';
import { Waiting } from './Waiting';

export interface Arrival {
  // The mint just reported the deposit paid: the slab lands.
  landed?: boolean;
  // The mint's confirmation just arrived with the screen open: the paid moment plays.
  lit?: boolean;
}

export interface ScreenProps {
  world: World;
  record: CampaignRecord;
  journey: Journey;
  arrival?: Arrival;
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
  const navigate = useNavigate();
  const arrived = useLocation().state as Arrival | null;
  const presence = useSeat(campaignId, 'pleb');
  const record = findCampaign(world, campaignId);
  const journey = record && journeyOf(world, record);
  const wanted = screen as Screen | undefined;
  // When the step moves on, the next screen shows at once and the address follows it, so there is never a frame
  // with no screen (and no headline to hold focus) in between.
  const own = record && journey && world.viewerId !== record.creatorId && world.viewerId !== record.maintainerId;
  const moved = own && (!wanted || !(wanted in screens) || !allowed(wanted, journey, record, world.viewerId));
  // Leaving Pay means the mint reported the deposit paid: that is the moment the slab lands.
  const landed = Boolean(moved && wanted === 'pay' && allowed('stacked', journey!, record!, world.viewerId));
  // Leaving Sending or Signed for Paid means the mint's confirmation just arrived with the screen open.
  const lit = Boolean(moved && journey!.screen === 'paid' && (wanted === 'sending' || wanted === 'signed'));
  const target: Screen | undefined = moved ? (landed ? 'stacked' : journey!.screen) : wanted;
  useEffect(() => {
    if (moved && target) navigate(paths.screen(campaignId, target), { replace: true, state: { landed, lit } });
  }, [moved, target, campaignId, landed, lit, navigate]);

  if (presence === 'searching' || presence === 'seating') return <Arriving seating={presence === 'seating'} />;
  if (presence === 'full') return <Full />;
  if (!record || !journey) {
    const draft = liveActions.draft(campaignId);
    return draft ? <NotOpenYet organizerId={draft.organizerId} /> : <NotFound />;
  }
  // The organizer and the maintainer have their own screens of the same stack.
  if (!own) return <Navigate to={homePath(world.viewerId, campaignId)} replace />;
  const shownScreen = target!;
  const Component = screens[shownScreen];
  // Stacked can stay open after the step moved on; its header still names the screen that shows.
  const shown = shownScreen === journey.screen ? journey : { ...journey, here: plebHere(shownScreen, journey.step, record) };
  const arrival = moved ? { landed, lit } : arrived ?? undefined;
  return <Component key={`${world.viewerId}/${shownScreen}`} world={world} record={record} journey={shown} arrival={arrival} />;
}
