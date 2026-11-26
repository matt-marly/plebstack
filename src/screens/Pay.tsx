import { useEffect, useState } from 'react';
import { maintainerOf, sats, slotOf } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { useSession } from '../session';
import { formatClock } from '../ui/format';
import { Frame } from '../ui/Frame';
import { CopyButton, Note, Status } from '../ui/parts';
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
    <Frame record={record} rail={journey.rail} here={journey.here} title="Pay the invoice"
      actions={(
        <>
          <a className="button" data-variant="primary" href={`lightning:${quote.invoice}`}>Open in wallet</a>
          <CopyButton text={quote.invoice} label="Copy invoice" />
        </>
      )}>
      <div className="lead rise">
        <Status state="awaiting" phrase="Waiting for your payment" plain live />
        <h1>Pay {each} to stack.</h1>
        <p>Use any Lightning wallet. You’re stacked the moment the mint sees it paid.</p>
      </div>
      <section className="invoice-card" aria-label="The invoice">
        <div className="invoice-head">
          <span className="invite-tag">Lightning invoice</span>
          <p className="invoice-amount">{each}</p>
          <p className="invoice-to">to the mint, locked to your key</p>
        </div>
        <div className="invite-qr"><Qr text={`lightning:${quote.invoice}`} label={`QR code of the Lightning invoice for ${each}`} /></div>
        <p className="invoice-check" aria-live="polite">
          <span className="wait-dot" aria-hidden="true" />
          {checkedAt ? `Checked at ${formatClock(checkedAt)}` : 'Asking the mint'}
        </p>
        <p className="invoice-test">Test mint: it marks its own invoices paid. Fake sats.</p>
      </section>
      {failure && (
        <Note>
          <p>{failure}</p>
          <button type="button" className="button" data-variant="secondary" onClick={() => setAttempt(count => count + 1)}>Check again</button>
        </Note>
      )}
      <Track stop={journey.stop} maintainer={maintainerOf(record).short} amount={each} />
    </Frame>
  );
}
