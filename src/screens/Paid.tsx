import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { maintainerOf, people, sats, type CampaignRecord } from '../demo/world';
import { stateCopy } from '../domain/states';
import { formatWhen, listNames, shortKey } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal } from '../ui/journey';
import { Avatar, ShareButton, StateChip } from '../ui/parts';
import { Stack } from '../ui/Stack';
import type { ScreenProps } from './StackRoute';

const PLAYED = 'plebstack:paid-moment:';

function seen(id: string): boolean {
  try {
    return sessionStorage.getItem(PLAYED + id) === '1';
  } catch {
    return true;
  }
}

// The moment plays only when the mint's confirmation arrives with this screen open, once per payout per session.
function usePaidMoment(payoutId: string | undefined): boolean {
  const arrived = (useLocation().state as { lit?: boolean } | null)?.lit === true;
  const [play] = useState(() => arrived && payoutId !== undefined && !seen(payoutId));
  useEffect(() => {
    if (!payoutId) return;
    try {
      sessionStorage.setItem(PLAYED + payoutId, '1');
    } catch { /* then it plays at most once on this page */ }
  }, [payoutId]);
  return play;
}

export function confirmedPayout(record: CampaignRecord) {
  return record.operations.find(op => op.kind === 'payout' && op.status === 'confirmed');
}

// P8: the screen people screenshot. Only reachable once the mint confirmed the batch.
export function Paid({ world, record, journey }: ScreenProps) {
  const payout = confirmedPayout(record);
  const playing = usePaidMoment(payout?.id);
  const { campaign } = record;
  const maintainer = maintainerOf(record);
  const total = sats(campaign.contributionSat * campaign.backerCount);
  const backers = record.slots.map(slot => ({ slot, own: slot.backerId === world.viewerId, name: people[slot.backerId!].short }));
  const confirmedAt = payout?.settledAt ?? new Date().toISOString();
  const url = `${location.origin}/s/${campaign.id}`;
  const proof: [string, string][] = [
    ['Mint', campaign.mint],
    ...backers.map(({ slot, own, name }): [string, string] => [own ? 'Your quote' : `${name}’s quote`, slot.quote?.id ?? '']),
    ...(payout?.keysetId ? [['Keyset', payout.keysetId] as [string, string]] : []),
    ['Locked to', `${maintainer.short}’s key · ${shortKey(campaign.beneficiaryPubkey)}${record.keyBy === 'pasted' ? ' · pasted, not confirmed by her' : ''}`],
    ['Confirmed', `${formatWhen(confirmedAt)} · ${formatWhen(confirmedAt, 'UTC')}`],
    ['Mint kind', 'Test mint, fake sats'],
  ];

  return (
    <Frame record={record} rail={journey.rail} title="Stacked. Paid." moment={playing}
      actions={(
        <>
          <ShareButton label="Share the stack" done="Copied" title="Plebstack" url={url}
            text={`We stacked ${total} for ${maintainer.name}. Three plebs, one batch, confirmed by the mint. Test mint, fake sats.`} />
          <p className="fine mono">Test mint, fake sats</p>
        </>
      )}>
      <div className="lead paid-words">
        <StateChip state="paid" phrase="Confirmed by the mint" />
        <h1 className="display">{stateCopy.paid.phrase}</h1>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} lighting={playing} />
      <section className="card receipt" aria-label="Receipt">
        <div className="receipt-to">
          <Avatar name={maintainer.short} size="large" />
          <div>
            <p className="receipt-title">{maintainer.short} got {total}</p>
            <p className="group-sub">Organized by {people[record.creatorId].short}</p>
          </div>
        </div>
        <div className="receipt-from">
          <span className="in">{backers.map(({ slot, own, name }) => <Avatar key={slot.id} name={name} own={own} />)}</span>
          <p>{listNames(backers.map(({ own, name }) => (own ? 'you' : name)))} · {sats(campaign.contributionSat)} each</p>
        </div>
        <p className="receipt-when">Confirmed by the mint · {formatWhen(confirmedAt)}</p>
        {record.closesAt && (
          <p className="receipt-when">All three were in before {formatWhen(record.closesAt)}, so the close no longer applied.</p>
        )}
      </section>
      <details className="disclosure">
        <summary>
          <span>Proof details</span>
          <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <dl className="proof">
          {proof.map(([term, value]) => <div key={term}><dt>{term}</dt><dd className="mono">{value}</dd></div>)}
        </dl>
      </details>
    </Frame>
  );
}
