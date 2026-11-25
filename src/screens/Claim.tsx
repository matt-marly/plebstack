import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { maintainerOf, people } from '../demo/world';
import { TEST_MINT } from '../domain/models';
import { failureCopy, liveActions } from '../live/actions';
import { paths } from '../routes';
import { homePath, storageWorks, useSession } from '../session';
import { reallyContext } from '../ui/explain';
import { Frame } from '../ui/Frame';
import { maintainerJourney } from '../ui/journey';
import { Icon } from '../ui/Icon';
import { Note } from '../ui/parts';
import { Steps } from '../ui/Really';
import { fixing } from '../ui/Who';
import { NotFound } from './NotFound';

// M1: the maintainer makes her key on her own side and only its public half goes to the organizer.
export function Claim() {
  const { campaignId = '' } = useParams();
  const { world, refresh } = useSession();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string>();
  const [canSave] = useState(storageWorks);
  const draft = liveActions.draft(campaignId);
  if (!draft) return <NotFound />;
  if (world.viewerId !== draft.maintainerId) return <Navigate to={homePath(world.viewerId, campaignId)} replace />;
  if (liveActions.claimOf(world.viewerId, campaignId)) return <Navigate to={paths.maintain(campaignId)} replace />;
  const organizer = people[draft.organizerId].short;
  const opened = world.campaigns.some(record => record.campaign.id === campaignId);
  const really = reallyContext({ role: 'maintainer', at: opened ? 'claim-pasted' : 'claim', organizer });

  function confirm() {
    try {
      liveActions.claimKey(world.viewerId, campaignId);
      refresh(`Key confirmed. The payout will be locked to it.`);
      navigate(paths.maintain(campaignId));
    } catch (error) {
      setFailure(failureCopy(error));
    }
  }

  return (
    <Frame {...maintainerJourney(opened ? 'claim-pasted' : 'claim', organizer)} title="Confirm your key" really={really}
      actions={opened ? (
        <button type="button" className="button" data-variant="primary" onClick={() => navigate(paths.maintain(campaignId))}>
          Follow the stack<Icon name="chevron" />
        </button>
      ) : (
        <button type="button" className="button" data-variant="primary" aria-disabled={!canSave || undefined}
          onClick={() => { if (canSave) confirm(); }}>
          Confirm my key
        </button>
      )}>
      <div className="lead rise">
        <h1>{organizer} is starting a stack for you.</h1>
        <p>{opened
          ? `${organizer} already opened it with a key she pasted. If that key isn’t yours, tell her before anyone chips in.`
          : 'Confirm to make your key in this browser. Only its public half is shared, so only you can spend what lands.'}</p>
      </div>
      <div className="link-card">
        <p className="card-title">{fixing(draft.title)}</p>
        <p className="small muted">3 plebs · 21 sats each · {TEST_MINT.replace('https://', '')}</p>
        <p className="small muted">For {maintainerOf(draft).name} · a link to the work: {draft.publicWorkUrl.replace(/^https?:\/\//, '')}</p>
      </div>
      <div className="part">
        <h2>What happens next</h2>
        <Steps {...really.next} />
      </div>
      {!canSave && <Note><p>This browser can’t save anything, so it couldn’t keep your key. Nothing was shared.</p></Note>}
      {failure && <Note><p>{failure}</p></Note>}
    </Frame>
  );
}
