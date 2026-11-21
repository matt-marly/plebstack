import { Link } from 'react-router-dom';
import {
  SWAP_FEE_SAT, checkMint, headline, isPending, latestOperation, people, progressLine, recordSpend, sats, slotStatus,
  stateSentence, tally,
} from '../demo/world';
import { confirmedStates, signalStates, stateCopy } from '../domain/states';
import type { MoneyState } from '../domain/models';
import { paths } from '../routes';
import { formatWhen, shortKey } from '../ui/format';
import { CopyButton, Fact, Facts, KeyText, Note, PageHead, Section, StateBlock, focusHeading, useTitle } from '../ui/parts';
import { Missing, useRecord } from './shared';

export function Payout() {
  const { viewer, apply, record } = useRecord();
  useTitle(record ? 'Payout' : 'Not found');
  if (!record) return <Missing what="campaign" />;

  const { campaign } = record;
  const creator = people[record.creatorId];
  const isCreator = viewer.id === creator.id;
  const totalSat = tally(record).targetSat;
  const batch = latestOperation(record, 'payout');
  const back = { to: paths.campaign(campaign.id), label: 'Campaign' };
  const reclaimer = record.slots.find(slot => slotStatus(slot) === 'reclaiming');

  if (!batch || batch.status === 'rejected') {
    const head = headline(record);
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Payout" />
        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={head.icon} word={head.word} phrase={head.phrase} sentence={head.sentence}
              confirmed={confirmedStates.includes(head.state as MoneyState)}
              signal={signalStates.includes(head.state as MoneyState)}>
              <p className="state-meta">{progressLine(record)}</p>
            </StateBlock>
            {batch ? (
              <Note title="The payout was rejected.">
                <p>
                  A deposit was taken back first, so the mint rejected the whole batch. Nothing was paid
                  to {creator.short}. The other deposits are still at the mint, and their owners can take them back.
                </p>
              </Note>
            ) : (
              <p>
                Nothing has been sent to the mint. The payout goes as one {sats(totalSat)} batch once all three plebs
                sign.
              </p>
            )}
          </div>
        </Section>
      </>
    );
  }

  if (isPending(batch)) {
    const copy = stateCopy['paying out'];
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Payout">
          <p>One batch of {sats(totalSat)} to {creator.name}. Not paid until the mint confirms.</p>
        </PageHead>

        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={copy.icon} word={copy.word} phrase={copy.phrase} sentence={stateSentence(record, 'paying out')}>
              <p className="state-meta">
                Sending · waiting for the mint. Sent {formatWhen(batch.savedAt)}.{' '}
                {batch.status === 'unresolved'
                  ? 'Still waiting for the mint. The request is saved. Nothing is paid until the mint confirms.'
                  : 'No answer yet.'}
              </p>
            </StateBlock>
            {reclaimer && (
              <Note title={`${people[reclaimer.backerId!].short} is taking their ${sats(campaign.contributionSat)} back.`}>
                <p>Their signature was already released, so a reclaim can race the payout. Whichever the mint issues first wins.</p>
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
              The request was saved before it was sent. Check again asks the mint about the same request. If this page
              is closed, use <Link to={paths.recovery()}>Recovery</Link>.
            </p>
          </div>
        </Section>

        <Section label="Batch">
          <Facts>
            <Fact label="Deposits">
              {record.slots.map(slot => (
                <p key={slot.id}>{people[slot.backerId!].name}, {sats(campaign.contributionSat)}</p>
              ))}
            </Fact>
            <Fact label="Pays to">
              <p>{creator.name}{isCreator && <span className="muted"> (you)</span>}</p>
              <KeyText value={campaign.beneficiaryPubkey} label="key" />
            </Fact>
            <Fact label="Mint"><span className="mono">{campaign.mint}</span></Fact>
            <Fact label="Request"><span className="mono">{batch.id}</span></Fact>
          </Facts>
        </Section>
      </>
    );
  }

  const copy = stateCopy.paid;
  const receivedSat = totalSat - SWAP_FEE_SAT;
  const confirmedAt = formatWhen(batch.settledAt ?? batch.savedAt);
  const share = `We stacked ${sats(totalSat)} for ${creator.name}. Three plebs, one batch, confirmed by the mint. Test mint, fake sats.`;
  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title="Payout">
        <p>Stacked. Paid. {sats(totalSat)} from 3 plebs to {creator.name}. Confirmed by the mint at {confirmedAt}.</p>
      </PageHead>

      <Section label="Status">
        <StateBlock icon={copy.icon} word={copy.word} phrase={copy.phrase} sentence={stateSentence(record, 'paid')} confirmed signal>
          <p className="state-meta">paid · confirmed by the mint {confirmedAt}</p>
        </StateBlock>
      </Section>

      <Section label="Receipt">
        <div className="panel">
          <p className="panel-title">Paid · confirmed by the mint</p>
          {record.slots.map(slot => (
            <p className="receipt-row" key={slot.id}>
              <span>{people[slot.backerId!].name}{slot.backerId === viewer.id && <span className="muted"> (you)</span>}</span>
              <span>{sats(campaign.contributionSat)}</span>
            </p>
          ))}
          <p className="receipt-row" data-kind="subtotal">
            <span>Issued to {isCreator ? 'your' : `${creator.short}’s`} key</span>
            <span>{sats(totalSat)}</span>
          </p>
          <p className="receipt-row">
            <span>{record.spend ? 'Swap fee at the mint' : 'Swap fee when spent'}</span>
            <span>−{sats(SWAP_FEE_SAT)}</span>
          </p>
          <p className="receipt-row" data-kind="total">
            <span>{record.spend ? `Received by ${creator.name}` : `${creator.name} will receive`}</span>
            <span>{sats(receivedSat)}</span>
          </p>
          <p className="receipt-foot">
            Mint {campaign.mint}<br />
            {record.slots.map(slot => <span key={slot.id}>Quote {slot.quote!.id} ({people[slot.backerId!].short})<br /></span>)}
            Locked to {shortKey(campaign.beneficiaryPubkey)}<br />
            Confirmed {confirmedAt}<br />
            Request {batch.id}<br />
            Test mint, fake sats.
          </p>
        </div>
        <div className="actions after-panel"><CopyButton text={share} label="Share the stack" /></div>
      </Section>

      <Section label="Spending it">
        {record.spend ? (
          <p>
            {isCreator ? 'You' : creator.short} spent it on {formatWhen(record.spend.at)}. Swap fee at the mint,
            {' '}{sats(SWAP_FEE_SAT)}. Received, {sats(receivedSat)}.
          </p>
        ) : isCreator ? (
          <div className="stack">
            <p>
              The {sats(totalSat)} are ecash at the mint, locked to your key. Spending them costs a {sats(SWAP_FEE_SAT)}
              {' '}swap fee at this mint, so you’ll receive {sats(receivedSat)}.
            </p>
            <div className="actions">
              <button type="button" className="button" data-variant="primary"
                onClick={() => apply((world, at) => recordSpend(world, campaign.id, at))}>
                Spend it
              </button>
            </div>
          </div>
        ) : (
          <p>
            The {sats(totalSat)} are locked to {creator.short}’s key. When {creator.short} spends them, the mint keeps
            a {sats(SWAP_FEE_SAT)} swap fee.
          </p>
        )}
      </Section>
    </>
  );
}
