import { useEffect, useState } from 'react';
import { maintainerOf, sats, slotOf } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { useSession } from '../session';
import { formatClock } from '../ui/format';
import { Frame } from '../ui/Frame';
import { CopyButton, Note } from '../ui/parts';
import { Qr } from '../ui/Qr';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// P2: get the sats to the mint. The page keeps asking the mint until it reports the quote paid.
export function Pay({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const [checkedAt, setCheckedAt] = useState<Date>();
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const { campaign } = record;
  const quote = slotOf(record, world.viewerId)!.quote!;
  const each = sats(campaign.contributionSat);
  const personId = world.viewerId;

  useEffect(() => {
    const controller = new AbortController();
    setFailure(undefined);
    liveActions.waitForDeposit(personId, campaign.id, quote.id, {
      signal: controller.signal, onCheck: (_check, at) => setCheckedAt(at),
    }).then(notice => {
      if (!controller.signal.aborted) refresh(notice);
    }).catch(error => {
      if (!controller.signal.aborted) setFailure(failureCopy(error));
    });
    return () => controller.abort();
  }, [quote.id, attempt, campaign.id, personId, refresh]);

  return (
    <Frame record={record} rail={journey.rail} title="Pay the invoice"
      actions={(
        <>
          <a className="button" data-variant="primary" href={`lightning:${quote.invoice}`}>Open in wallet</a>
          <CopyButton text={quote.invoice} label="Copy invoice" />
        </>
      )}>
      <div className="lead rise">
        <h1>Pay {each} to stack.</h1>
        <p>Pay from any Lightning wallet. You’re stacked when the mint says it’s paid.</p>
      </div>
      <div className="invoice">
        <Qr text={`lightning:${quote.invoice}`} label={`QR code of the Lightning invoice for ${each}`} />
        <p className="mono small" aria-live="polite">{checkedAt ? `Last checked ${formatClock(checkedAt)}` : 'Asking the mint'}</p>
        <p className="small muted">Test mint: it marks its own invoices paid. Fake sats.</p>
      </div>
      {failure && (
        <Note>
          <p>{failure}</p>
          <button type="button" className="button" data-variant="quiet" onClick={() => setAttempt(count => count + 1)}>Check again</button>
        </Note>
      )}
      <Track stop={journey.stop} maintainer={maintainerOf(record).short} amount={each} />
    </Frame>
  );
}
