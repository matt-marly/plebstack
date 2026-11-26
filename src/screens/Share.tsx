import { useNavigate } from 'react-router-dom';
import { maintainerOf, type CampaignRecord } from '../demo/world';
import { paths } from '../routes';
import { reallyContext } from '../ui/explain';
import { Frame } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { organizerJourney } from '../ui/journey';
import { CopyButton, ShareInvite } from '../ui/parts';
import { Qr } from '../ui/Qr';
import { sats } from '../demo/world';
import { formatWhen } from '../ui/format';
import { fixing } from '../ui/Who';

// O4: get the invite out. The organizer can share and stop collecting, never move anyone's sats.
export function Share({ record }: { record: CampaignRecord }) {
  const navigate = useNavigate();
  const { campaign } = record;
  const maintainer = maintainerOf(record).short;
  const url = `${location.origin}${paths.stack(campaign.id)}`;
  return (
    <Frame record={record} {...organizerJourney('share', maintainer)} title="Your stack is open"
      really={reallyContext({ role: 'organizer', at: 'share', record, maintainer })}
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
        <p>Send the invite to 3 people. You can stop collecting, but you can’t move anyone’s sats.</p>
      </div>
      <section className="invite-card" aria-label="The invite">
        <div className="invite-head">
          <span className="invite-tag">Invite</span>
          <p className="invite-title">Back {maintainer}</p>
          <p className="invite-work">{fixing(campaign.title)}</p>
          <p className="invite-terms">{sats(campaign.contributionSat)} each · 3 people{record.closesAt ? ` · closes ${formatWhen(record.closesAt)}` : ''}</p>
        </div>
        <div className="invite-qr"><Qr text={url} label={`QR code of the invite link for backing ${maintainer}`} /></div>
        <p className="invite-scan">Scan with a phone camera to join</p>
        <div className="invite-link">
          <p className="mono link-text">{url.replace(/^https?:\/\//, '')}</p>
          <CopyButton text={url} label="Copy link" />
        </div>
      </section>
    </Frame>
  );
}
