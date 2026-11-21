import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../demo/store';
import { confirmDeposit, people, requestQuote, sats, slotOf, slotStatus, statusOf } from '../demo/world';
import type { LockedQuote } from '../domain/models';
import { failureCopy, liveActions } from '../live/actions';
import { paths } from '../routes';
import { formatClock } from '../ui/format';
import { CopyButton, Fact, Facts, KeyText, Note, PageHead, Section, StateBlock, focusHeading, useTitle } from '../ui/parts';
import { Failure, Missing, useRecord } from './shared';

// Asks the test mint until it reports the quote paid and unissued, then records the deposit.
function LiveStatus({ campaignId, slotId, ownerId, quote }: { campaignId: string; slotId: string; ownerId: string; quote: LockedQuote }) {
  const { refresh } = useStore();
  const navigate = useNavigate();
  const [checkedAt, setCheckedAt] = useState<Date>();
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailure(undefined);
    liveActions.waitForDeposit(ownerId, campaignId, quote.id, {
      signal: controller.signal, onCheck: (_check, at) => setCheckedAt(at),
    }).then(notice => {
      refresh(notice);
      navigate(paths.deposit(campaignId, slotId));
    }).catch(error => {
      if (!controller.signal.aborted) setFailure(failureCopy(error));
    });
    return () => controller.abort();
  }, [quote.id, attempt, campaignId, slotId, ownerId, refresh, navigate]);

  return (
    <div className="stack" data-gap="large">
      <StateBlock state="awaiting" icon="awaiting" word="Awaiting deposit" sentence="Not stacked until the mint reports it paid.">
        <p className="state-meta">
          {checkedAt ? `Last checked ${formatClock(checkedAt)}.` : 'Asking the mint.'}
        </p>
      </StateBlock>
      {failure && (
        <>
          <Failure title="Nothing stacked" text={failure} />
          <div className="actions">
            <button type="button" className="button" onClick={() => setAttempt(count => count + 1)}>Check again</button>
          </div>
        </>
      )}
    </div>
  );
}

export function Back() {
  const { viewer, apply, record } = useRecord();
  const { live, refresh } = useStore();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const slot = record && slotOf(record, viewer.id);
  const awaiting = slot !== undefined && slotStatus(slot) === 'awaiting';
  const each = record ? sats(record.campaign.contributionSat) : '';
  useTitle(!record ? 'Not found' : awaiting ? 'Pay the invoice' : `Join with ${each}`);
  if (!record) return <Missing what="campaign" />;

  const { campaign } = record;
  const creator = people[record.creatorId];
  const back = { to: paths.campaign(campaign.id), label: 'Campaign' };

  if (slot?.deposit) {
    return (
      <PageHead back={back} eyebrow={campaign.title} title="You’ve already joined">
        <p>You stacked {each} in this campaign. Each pleb stacks once.</p>
        <p className="link-alone"><Link to={paths.deposit(campaign.id, slot.id)}>Go to your deposit</Link></p>
      </PageHead>
    );
  }

  if (awaiting && slot.quote) {
    const quote = slot.quote;
    const real = live;
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Pay the invoice">
          <p>Pay this invoice to stack {each}. Not stacked until the mint reports it paid. It doesn’t pay {creator.short}.</p>
        </PageHead>

        <Section label="Status">
          {real ? <LiveStatus campaignId={campaign.id} slotId={slot.id} ownerId={viewer.id} quote={quote} /> : (
            <div className="stack" data-gap="large">
              <StateBlock state="awaiting" icon="awaiting" word="Awaiting deposit" sentence="Not stacked until the mint reports it paid." />
              <div className="actions">
                <button type="button" className="button" data-variant="primary" onClick={() => {
                  apply((world, at) => confirmDeposit(world, campaign.id, slot.id, at));
                  navigate(paths.deposit(campaign.id, slot.id));
                }}>
                  Check for deposit
                </button>
              </div>
            </div>
          )}
        </Section>

        <Section label="Invoice">
          <div className="panel stack">
            <p className="panel-title">Lightning invoice for {each}</p>
            <p className="invoice">{quote.invoice}</p>
            <CopyButton text={quote.invoice} label="Copy invoice" />
          </div>
          <p className="muted small after-panel">
            {real
              ? 'This test mint credits its own invoices within seconds, so there’s nothing to pay. This page keeps asking the mint until it reports the invoice paid.'
              : 'This test mint credits its own invoices, so there’s nothing to pay. Check for the deposit when you’re ready.'}
          </p>
        </Section>

        <Section label="Quote">
          <Facts>
            <Fact label="Quote ID"><span className="mono">{quote.id}</span></Fact>
            <Fact label="Locked to">
              <p>Your key, made in this browser</p>
              <KeyText value={quote.ownerPubkey} label="key" />
            </Fact>
            <Fact label="Mint"><span className="mono">{quote.mint}</span></Fact>
          </Facts>
        </Section>
      </>
    );
  }

  if (viewer.id === record.creatorId) {
    return (
      <PageHead back={back} eyebrow={campaign.title} title="This is your campaign">
        <p>The payout is locked to your key, so you can’t also back it. Share the campaign with the three plebs who will.</p>
      </PageHead>
    );
  }

  if (statusOf(record) !== 'collecting' || !record.slots.some(other => !other.backerId)) {
    return (
      <PageHead back={back} eyebrow={campaign.title} title="Not taking deposits">
        <p>This campaign has no open slot, so there’s nothing to pay.</p>
      </PageHead>
    );
  }

  async function join() {
    if (!record) return;
    if (!live) {
      apply((world, at) => requestQuote(world, campaign.id, at));
      focusHeading();
      return;
    }
    const backerId = viewer.id;
    setAsking(true);
    setFailure(undefined);
    try {
      await liveActions.join(backerId, campaign.id);
      refresh(`Pay this invoice to stack ${each}. Not stacked until the mint reports it paid.`);
      focusHeading();
    } catch (error) {
      setFailure(failureCopy(error));
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title={`Join with ${each}`}>
        <p>You’ll get a Lightning invoice from the mint. Paying it stacks {each} at the mint. It doesn’t pay {creator.short}.</p>
      </PageHead>

      <Section label="Before you deposit">
        <div className="stack" data-gap="large">
          <ul className="plain-list" role="list">
            <li>Your {each} wait at the mint, locked to a key made in this browser.</li>
            <li>Nobody holds your keys but you. Not us, not the organizer.</li>
            <li>Nothing is paid to {creator.short} until all three plebs sign one payout.</li>
            <li>Until the payout is issued you can take them back, as ecash at this mint.</li>
          </ul>
          <Note>
            <p>Your key stays in this browser and nothing backs it up. Clear its storage before the payout and the deposit can’t be recovered.</p>
          </Note>
          {failure && <Failure title="Nothing stacked" text={failure} />}
          <div className="actions">
            <button type="button" className="button" data-variant="primary" aria-disabled={asking || undefined}
              onClick={() => { if (!asking) void join(); }}>
              {asking ? 'Asking the mint…' : 'Create deposit invoice'}
            </button>
          </div>
        </div>
      </Section>

      <Section label="Deposit">
        <Facts>
          <Fact label="Amount">{each}</Fact>
          <Fact label="Held at">
            <span className="mono">{campaign.mint}</span>
            <p className="muted small">A test mint with fake sats.</p>
          </Fact>
          <Fact label="Campaign">{campaign.title}</Fact>
        </Facts>
      </Section>
    </>
  );
}
