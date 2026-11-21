import { useState } from 'react';
import { Link } from 'react-router-dom';
import { checkMint, latestOperation, pendingOperation, people, requestReclaim, sats, stateSentence, statusOf, tally } from '../demo/world';
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
        <PageHead back={back} eyebrow={campaign.title} title="Take mine back">
          <p>Back to you. {each} minted to your own outputs, saved in this browser.</p>
        </PageHead>
        <Section label="Status">
          <StateBlock icon={copy.icon} word={copy.word} phrase={copy.phrase} sentence={stateSentence(record, 'reclaimed')} confirmed>
            {request?.settledAt && <p className="state-meta">Confirmed by the mint {formatWhen(request.settledAt)}.</p>}
          </StateBlock>
        </Section>
        <Section label="Receipt">
          <div className="panel">
            <p className="receipt-row" data-kind="total" data-first>
              <span>Minted to your own outputs</span>
              <span>{each}</span>
            </p>
            <p className="receipt-foot">
              Mint {campaign.mint}<br />
              Quote {slot.quote!.id}<br />
              Key {shortKey(slot.quote!.ownerPubkey)}<br />
              {request && <>Request {request.id}<br /></>}
              Test mint, fake sats.
            </p>
          </div>
        </Section>
        <Section label="The campaign">
          <div className="stack">
            {batch?.status === 'rejected' && (
              <p>Your reclaim got there first. The payout was rejected. Nothing was paid to {creator.short}.</p>
            )}
            <p>
              No payout without your deposit. The other deposits are still at the mint; their owners can take them back
              the same way.
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
            <StateBlock icon={copy.icon} word={copy.word} phrase={copy.phrase} sentence={stateSentence(record, 'paid')} confirmed />
            {request?.status === 'rejected' ? (
              <Note title="Your reclaim was rejected.">
                <p>
                  The payout got there first. Your {each} went to {creator.short} as part of the {totalSat}-sat payment,
                  under the signature you released.
                </p>
              </Note>
            ) : (
              <p>These {each} were paid to {creator.name}. There’s nothing left to take back.</p>
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
          <p>Unstacking. Waiting for the mint. Not reclaimed until the mint confirms.</p>
        </PageHead>
        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={copy.icon} word={copy.word} phrase={copy.phrase} sentence={stateSentence(record, 'reclaiming')}>
              {request && <p className="state-meta">Sent {formatWhen(request.savedAt)}. No answer yet.</p>}
            </StateBlock>
            {batchInFlight && (
              <Note title="The payout batch is with the mint too.">
                <p>
                  You signed, so the batch is still valid. The mint issues your {each} once: to you, or
                  to {creator.short}. Whichever it issues first wins.
                </p>
              </Note>
            )}
            <div className="actions">
              <button type="button" className="button" data-variant="primary" onClick={() => {
                apply((world, at) => checkMint(world, campaign.id, at));
                focusHeading();
              }}>
                Check again
              </button>
            </div>
            <p className="small">
              The request was saved before it was sent. Check again asks the mint about the same request, here or
              from <Link to={paths.recovery()}>Recovery</Link>.
            </p>
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title="Take mine back">
        <p>
          {statusOf(record) === 'unmet'
            ? `No payout this time. Take your ${each} back as ecash at this mint.`
            : `Mint your ${each} back into your own outputs instead of waiting for the payout.`}
        </p>
      </PageHead>

      <Section label="What happens">
        <div className="stack" data-gap="large">
          <Facts>
            <Fact label="You get">{each}, as ecash at this mint.</Fact>
            <Fact label="Goes to">
              <p>Your own outputs, saved in this browser</p>
              <KeyText value={slot.quote!.ownerPubkey} label="key" />
            </Fact>
            <Fact label="The campaign">
              No payout without your deposit. The other plebs keep theirs and can take them back too.
            </Fact>
            <Fact label="Mint"><span className="mono">{campaign.mint}</span></Fact>
          </Facts>
          {deposit.authorizationReleased && (
            <Note title="You already signed.">
              <p>
                If the payout reaches the mint first, your {each} go to {creator.short} and this reclaim is rejected.
                A signature can’t be taken back.
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

      <ConfirmDialog open={confirming} title={`Mint your ${each} into your own outputs at this mint?`} confirmLabel="Take mine back"
        onConfirm={() => {
          setConfirming(false);
          apply((world, at) => requestReclaim(world, campaign.id, slot.id, at));
          focusHeading();
        }}
        onCancel={() => setConfirming(false)}>
        <p>
          You get {each} as ecash at this mint, saved in this browser
          {' '}(<span className="mono">{shortKey(slot.quote!.ownerPubkey)}</span>). No payout for this campaign
          afterwards.
        </p>
        {deposit.authorizationReleased && (
          <p>You already signed. If the payout reaches the mint first, your {each} go to {creator.short}.</p>
        )}
      </ConfirmDialog>
    </>
  );
}
