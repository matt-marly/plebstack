import { useState } from 'react';
import { Link } from 'react-router-dom';
import { checkMint, latestOperation, pendingOperation, people, requestReclaim, sats, tally } from '../demo/world';
import { stateCopy } from '../domain/states';
import { paths } from '../routes';
import { formatWhen, shortKey } from '../ui/format';
import { ConfirmDialog, Fact, Facts, KeyText, Note, PageHead, Section, StateBlock, focusHeading, useTitle } from '../ui/parts';
import { Missing, NotYours, useRecord } from './shared';

export function Reclaim() {
  const { viewer, apply, record, slot } = useRecord();
  const [confirming, setConfirming] = useState(false);
  const found = record !== undefined && slot?.deposit !== undefined;
  useTitle(found ? 'Take mine back' : 'Not found');
  if (!record) return <Missing what="campaign" />;
  if (!slot?.deposit || !slot.backerId) return <Missing what="deposit" />;

  const { campaign } = record;
  const deposit = slot.deposit;
  const creator = people[record.creatorId];
  const each = sats(campaign.contributionSat);
  const totalSat = tally(record).targetSat;
  const back = { to: paths.deposit(campaign.id, slot.id), label: 'Your deposit' };
  const request = latestOperation(record, 'reclaim', slot.id);
  const batchInFlight = pendingOperation(record, 'payout') !== undefined;

  if (slot.backerId !== viewer.id) {
    return (
      <>
        <PageHead back={{ to: paths.campaign(campaign.id), label: 'Campaign' }} eyebrow={campaign.title} title="Take mine back" />
        <Section label="Status"><NotYours slot={slot} /></Section>
      </>
    );
  }

  if (deposit.state === 'reclaimed') {
    const copy = stateCopy.reclaimed;
    const batch = latestOperation(record, 'payout');
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Take mine back" />
        <Section label="Status">
          <StateBlock icon={copy.icon} word={copy.word} sentence={copy.sentence} confirmed>
            {request?.settledAt && <p className="state-meta">Confirmed {formatWhen(request.settledAt)}.</p>}
          </StateBlock>
        </Section>
        <Section label="Receipt">
          <div className="panel">
            <p className="receipt-row" data-kind="total" data-first>
              <span>Issued to your own outputs</span>
              <span>{each}</span>
            </p>
            <p className="receipt-foot">
              {request && <>Request {request.id}<br /></>}
              Key {shortKey(slot.quote!.ownerPubkey)}<br />
              {campaign.mint}
            </p>
          </div>
        </Section>
        <Section label="The campaign">
          <div className="stack">
            {batch?.status === 'rejected' && (
              <p>The payout batch was rejected because your reclaim settled first. Nothing was paid to {creator.short}.</p>
            )}
            <p>
              The campaign can’t pay out without your deposit. The other deposits are still at the mint; their owners
              can take them back the same way.
            </p>
            <p className="link-alone"><Link to={paths.campaign(campaign.id)}>Back to the campaign</Link></p>
          </div>
        </Section>
      </>
    );
  }

  if (deposit.state === 'paid') {
    const copy = stateCopy.paid;
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Take mine back" />
        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={copy.icon} word={copy.word} sentence={copy.sentence} confirmed />
            {request?.status === 'rejected' ? (
              <Note title="Your reclaim was rejected.">
                <p>
                  The payout reached the mint first. Your deposit of {each} was paid to {creator.name} as part of
                  the {totalSat}-sat payment, under the signature you released.
                </p>
              </Note>
            ) : (
              <p>This deposit was paid to {creator.name}. There’s nothing left to take back.</p>
            )}
            <div className="actions">
              <Link className="button" to={paths.payout(campaign.id)}>View payout receipt</Link>
            </div>
          </div>
        </Section>
      </>
    );
  }

  if (deposit.state === 'reclaiming') {
    const copy = stateCopy.reclaiming;
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Take mine back">
          <p>You’ve asked the mint for your {each}. They aren’t reclaimed until the mint confirms it.</p>
        </PageHead>
        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={copy.icon} word={copy.word} sentence={copy.sentence}>
              {request && <p className="state-meta">Sent {formatWhen(request.savedAt)}. No result yet.</p>}
            </StateBlock>
            {batchInFlight && (
              <Note title="The payout batch is with the mint too.">
                <p>
                  You released a signature, so the batch is still valid. The mint will issue your deposit once: to you,
                  or to {creator.short}.
                </p>
              </Note>
            )}
            <div className="actions">
              <button type="button" className="button" data-variant="primary" onClick={() => {
                apply((world, at) => checkMint(world, campaign.id, at));
                focusHeading();
              }}>
                Check mint result
              </button>
            </div>
            <p className="small">
              The request was saved before it was sent. It can be checked again from <Link to={paths.recovery()}>Recovery</Link>.
            </p>
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title="Take mine back">
        <p>Ask the mint to issue your {each} to you instead of waiting for the payout.</p>
      </PageHead>

      <Section label="What happens">
        <div className="stack" data-gap="large">
          <Facts>
            <Fact label="You get">{each}, as ecash at this mint. It isn’t a Lightning refund.</Fact>
            <Fact label="Goes to">
              <p>Your own outputs, in this browser</p>
              <KeyText value={slot.quote!.ownerPubkey} label="key" />
            </Fact>
            <Fact label="The campaign">
              Can’t pay out without your deposit. The other backers keep theirs and can take them back too.
            </Fact>
            <Fact label="Mint"><span className="mono">{campaign.mint}</span></Fact>
          </Facts>
          {deposit.authorizationReleased && (
            <Note title="You already approved, and that can’t be taken back.">
              <p>
                Your signature stays valid, so the payout may still reach the mint first. If it does, your {each} go
                to {creator.name} and this reclaim is rejected.
              </p>
            </Note>
          )}
          <div className="actions">
            <button type="button" className="button" data-variant="primary" onClick={() => setConfirming(true)}>
              Take mine back…
            </button>
          </div>
        </div>
      </Section>

      <ConfirmDialog open={confirming} title={`Take your ${each} back`} confirmLabel={`Take ${each} back`}
        onConfirm={() => {
          setConfirming(false);
          apply((world, at) => requestReclaim(world, campaign.id, slot.id, at));
          focusHeading();
        }}
        onCancel={() => setConfirming(false)}>
        <p>
          The mint will issue {each} to your own outputs in this browser
          {' '}(<span className="mono">{shortKey(slot.quote!.ownerPubkey)}</span>). The campaign can’t pay out with
          your deposit afterwards.
        </p>
        {deposit.authorizationReleased && (
          <p>
            You’ve already released a signature. If the payout reaches the mint first, your {each} are paid
            to {creator.name} instead.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
