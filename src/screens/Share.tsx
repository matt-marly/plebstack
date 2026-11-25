import { useNavigate } from 'react-router-dom';
import { maintainerOf, sats, type CampaignRecord } from '../demo/world';
import { paths } from '../routes';
import { Frame } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { organizerJourney } from '../ui/journey';
import { CopyButton, ShareInvite } from '../ui/parts';
import { Qr } from '../ui/Qr';
import { organizerFacts } from '../ui/Really';

// O4: get the invite out. The organizer can share and stop collecting, never move anyone's sats.
export function Share({ record }: { record: CampaignRecord }) {
  const navigate = useNavigate();
  const { campaign } = record;
  const maintainer = maintainerOf(record).short;
  const url = `${location.origin}${paths.stack(campaign.id)}`;
  return (
    <Frame record={record} {...organizerJourney('share', maintainer)} title="Your stack is open"
      facts={organizerFacts(maintainer, sats(campaign.contributionSat))}
      actions={(
        <>
          <ShareInvite campaignId={campaign.id} title={`Back ${maintainer}: ${campaign.title}`} />
          <button type="button" className="button" data-variant="secondary" onClick={() => navigate(paths.organize(campaign.id, 'watch'))}>
            Watch it fill<Icon name="chevron" />
          </button>
        </>
      )}>
      <div className="lead rise">
        <h1>Your stack is open.</h1>
        <p>You organize this stack. You can share it and stop collecting, but you can’t move anyone’s sats.</p>
      </div>
      <div className="link-card share-card">
        <Qr text={url} label={`QR code of the invite link for backing ${maintainer}`} />
        <p className="mono link-text">{url.replace(/^https?:\/\//, '')}</p>
        <CopyButton text={url} label="Copy link" />
      </div>
    </Frame>
  );
}
