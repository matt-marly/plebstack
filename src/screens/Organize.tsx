import { Navigate, useParams } from 'react-router-dom';
import { findCampaign } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths, type OrganizeStep } from '../routes';
import { homePath, useSession } from '../session';
import { NotFound } from './NotFound';
import { PayoutKey } from './PayoutKey';
import { Share } from './Share';
import { Terms } from './Terms';
import { Watch } from './Watch';

// The organizer's screens. Each needs what came before it: a key before terms, an open stack before sharing.
export function Organize() {
  const { campaignId = '', step } = useParams();
  const { world } = useSession();
  const draft = liveActions.draft(campaignId);
  if (!draft) return <NotFound />;
  if (world.viewerId !== draft.organizerId) return <Navigate to={homePath(world.viewerId, campaignId)} replace />;
  const record = findCampaign(world, campaignId);
  const allowed: Record<OrganizeStep, boolean> = { key: true, terms: !!draft.key && !record, share: !!record, watch: !!record };
  const wanted = step as OrganizeStep | undefined;
  if (!wanted || !(wanted in allowed) || !allowed[wanted]) {
    // Terms that just locked lead on to sharing the stack they opened.
    return <Navigate to={paths.organize(campaignId, !record ? 'key' : wanted === 'terms' ? 'share' : 'watch')} replace />;
  }
  switch (wanted) {
    case 'key': return <PayoutKey key={draft.key?.by ?? 'none'} draft={draft} />;
    case 'terms': return <Terms draft={draft} />;
    case 'share': return <Share record={record!} />;
    case 'watch': return <Watch record={record!} />;
  }
}
