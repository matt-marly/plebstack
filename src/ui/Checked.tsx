import { people, sats, type CampaignRecord } from '../demo/world';
import type { LiveReview } from '../live/actions';
import { shortKey } from './format';
import { Icon } from './Icon';

export interface CheckResult {
  text: string;
  detail: string;
}

// Each line is something this browser worked out from the package itself, not something it was told.
export function checkResults(record: CampaignRecord, review: LiveReview, ownQuoteId: string): CheckResult[] {
  const { campaign } = record;
  const maintainer = people[record.creatorId].short;
  return [
    { text: `${sats(review.totalSat)} in total`, detail: review.amounts.join(' + ') },
    { text: `Every output locked to ${maintainer}’s key`, detail: `NUT-11 P2PK · ${shortKey(review.lockedTo)}` },
    { text: 'No extra spending conditions', detail: 'one key, nothing else' },
    { text: 'The mint’s active keyset', detail: `keyset ${review.keysetId}` },
    { text: 'Your own deposit is in this batch', detail: `quote ${shortKey(ownQuoteId, 8, 4)}` },
    { text: 'All three deposits paid and waiting at the mint', detail: `${campaign.mint.replace('https://', '')} · ${review.quoteStates.join(' · ')}` },
  ];
}

export function Checked({ results, failure }: { results?: CheckResult[]; failure?: string }) {
  const summary = failure ? 'Your phone found a problem' : results ? 'What your phone checked' : 'Checking the payout on this phone…';
  return (
    <details className="disclosure rise" open={failure ? true : undefined}>
      <summary>
        <span>{summary}</span>
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      {failure ? <p className="disclosure-text">{failure}</p> : results ? (
        <ul className="checks" role="list">
          {results.map(result => (
            <li key={result.text}>
              <span className="check-box"><Icon name="check" /></span>
              <p>{result.text}<span className="mono">{result.detail}</span></p>
            </li>
          ))}
        </ul>
      ) : <p className="disclosure-text">Asking the mint and re-deriving every output.</p>}
    </details>
  );
}
