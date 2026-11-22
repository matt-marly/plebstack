import { Navigate, useParams } from 'react-router-dom';
import { findCampaign, statusOf } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths, type MaintainStep } from '../routes';
import { homePath, useSession } from '../session';
import { Follow } from './Follow';
import { NotFound } from './NotFound';
import { Receive } from './Receive';
import { Spent } from './Spent';

// The maintainer's screens follow the money: following the stack, the payout in, then spent.
export function Maintain() {
  const { campaignId = '', step } = useParams();
  const { world } = useSession();
  const draft = liveActions.draft(campaignId);
  if (!draft) return <NotFound />;
  const viewerId = world.viewerId;
  if (viewerId !== draft.maintainerId) return <Navigate to={homePath(viewerId, campaignId)} replace />;
  const record = findCampaign(world, campaignId);
  if (!liveActions.claimOf(viewerId, campaignId) && record?.keyBy !== 'pasted') return <Navigate to={paths.claim(campaignId)} replace />;
  const paid = record !== undefined && statusOf(record) === 'paid';
  const spend = liveActions.wallet(viewerId, campaignId).spend;
  const current: MaintainStep = spend ? 'spend' : paid ? 'receive' : 'follow';
  if (step !== current) return <Navigate to={paths.maintain(campaignId, current)} replace />;
  switch (current) {
    case 'follow': return <Follow draft={draft} record={record} viewerId={viewerId} />;
    case 'receive': return <Receive record={record!} viewerId={viewerId} />;
    case 'spend': return <Spent record={record!} viewerId={viewerId} />;
  }
}
