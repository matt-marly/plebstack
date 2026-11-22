import { people, sats, type CampaignRecord, type Slot } from '../demo/world';
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
  const maintainer = people[record.creatorId];
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
              <Avatar name={slot.backerId ? people[slot.backerId].short : undefined} own={own} open={!slot.backerId} />
              <span className="group-name" data-own={own || undefined}>{own ? 'You' : people[slot.backerId!]?.short}</span>
              <span className="group-mark" data-tone={tone}>
                {tone === 'signed' && <Icon name="nib" />}{label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
