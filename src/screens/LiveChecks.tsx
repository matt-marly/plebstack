import { useEffect, useState } from 'react';
import { sats } from '../demo/world';
import { failureCopy, liveActions, type LiveReview } from '../live/actions';
import { listNames } from '../ui/format';
import { Icon } from '../ui/Icon';
import { Failure } from './shared';

interface Props {
  campaignId: string;
  personId: string;
  maintainer: string;
  others: string[];
  onChecked: (passed: boolean) => void;
}

// The backer's own browser fetches the package, the keyset and the quote states, and recomputes
// every output before the signature button is offered.
export function LiveChecks({ campaignId, personId, maintainer, others, onChecked }: Props) {
  const [review, setReview] = useState<LiveReview>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    let current = true;
    setReview(undefined);
    setFailure(undefined);
    liveActions.review(personId, campaignId).then(found => {
      if (!current) return;
      setReview(found);
      onChecked(true);
    }).catch(error => {
      if (!current) return;
      setFailure(failureCopy(error));
      onChecked(false);
    });
    return () => { current = false; };
  }, [personId, campaignId, onChecked]);

  if (failure) return <Failure title="Don’t sign." text={failure} />;
  if (!review) return <p>Checking the outputs on this device. Asking the mint for its keyset and the three quotes.</p>;

  const total = sats(review.totalSat);
  return (
    <div className="stack">
      <p>
        Outputs checked on this device: {total}, keyset <span className="mono">{review.keysetId}</span>, locked
        to {maintainer}’s key, no other way to spend them.
      </p>
      <ul className="checks" role="list">
        <li><Icon name="check" size={18} /><span>The mint reports all three quotes {review.quoteStates.join(', ')}: paid, and issued to nobody.</span></li>
        <li><Icon name="check" size={18} /><span>Every output is locked to {maintainer}’s key shown above, with no other spending condition.</span></li>
        <li><Icon name="check" size={18} /><span>{review.amounts.length} outputs add up to {total}: {review.amounts.join(' + ')}.</span></li>
        <li><Icon name="check" size={18} /><span>Each output is on keyset <span className="mono">{review.keysetId}</span>, the mint’s active sat keyset, fetched by this browser.</span></li>
        <li><Icon name="check" size={18} /><span>Each blinded output was recomputed here from its secret and blinding factor.</span></li>
        <li><Icon name="check" size={18} /><span>{listNames(others)} are asked to sign this same set of outputs.</span></li>
      </ul>
      <p className="muted small">Recomputed in this browser. The organizer supplies public data only, never a key.</p>
    </div>
  );
}
