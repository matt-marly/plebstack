import { maintainerOf, people, sats, type CampaignRecord, type Slot } from '../demo/world';
import { Icon } from './Icon';
import { signedCount } from './journey';
import { Avatar } from './parts';

function mark(slot: Slot, own: boolean): { label: string; tone: 'signed' | 'turn' | 'later' } {
  const deposit = slot.deposit;
  if (deposit?.authorizationReleased) return { label: 'Signed', tone: 'signed' };
  if (deposit?.state === 'reclaiming') return { label: 'Taking back', tone: 'later' };
  if (own && deposit?.newApprovalsStopped) return { label: 'Stopped', tone: 'later' };
  return own ? { label: 'Your turn', tone: 'turn' } : { label: 'Not yet', tone: 'later' };
}

// One payout, three signatures: the card everyone signs, and who has.
export function GroupCard({ record, viewerId }: { record: CampaignRecord; viewerId: string }) {
  const maintainer = maintainerOf(record);
  const { contributionSat, backerCount } = record.campaign;
  const signed = signedCount(record);
  return (
    <section className="card group rise" aria-label="Group card">
      <div className="card-head">
        <span>Group card</span>
        <span className="mono">{signed} of 3 signed</span>
      </div>
      <div className="group-to">
        <Avatar name={maintainer.short} size="large" />
        <div>
          <p className="group-total">{sats(contributionSat * backerCount)}</p>
          <p className="group-sub">to {maintainer.name} · only she can spend it</p>
        </div>
      </div>
      <div className="group-bars" aria-hidden="true">
        {record.slots.map((slot, index) => <span key={slot.id} data-on={index < signed || undefined} />)}
      </div>
      <ul className="group-rows" role="list">
        {record.slots.map(slot => {
          const own = slot.backerId === viewerId;
          const { label, tone } = mark(slot, own);
          return (
            <li key={slot.id}>
              <span className="person-tag" data-size="small" data-own={own || undefined}>
                <Avatar name={slot.backerId ? people[slot.backerId].short : undefined} own={own} open={!slot.backerId} />
                <span className="person-tag-name">{own ? 'You' : people[slot.backerId!]?.short}</span>
              </span>
              {/* It reports, so no frame: a dot for signed or your turn, a dashed ring for not yet. */}
              <span className="status group-mark" data-tone={tone}>
                {tone === 'later' ? <Icon name="ring" /> : <span className="status-dot" aria-hidden="true" />}
                {tone === 'later' ? label : <strong>{label}</strong>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
