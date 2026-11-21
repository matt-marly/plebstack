import { Link } from 'react-router-dom';
import {
  SWAP_FEE_SAT, checkMint, headline, isPending, latestOperation, people, progressLine, recordSpend, sats, slotStatus, tally,
} from '../demo/world';
import { confirmedStates, signalStates, stateCopy } from '../domain/states';
import type { MoneyState } from '../domain/models';
import { paths } from '../routes';
import { formatWhen, shortKey } from '../ui/format';
import { Fact, Facts, KeyText, Note, PageHead, Section, StateBlock, focusHeading, useTitle } from '../ui/parts';
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
            <StateBlock icon={head.icon} word={head.word} sentence={head.sentence}
              confirmed={confirmedStates.includes(head.state as MoneyState)}
              signal={signalStates.includes(head.state as MoneyState)}>
              <p className="state-meta">{progressLine(record)}</p>
            </StateBlock>
            {batch ? (
              <Note title="The payout batch was rejected.">
                <p>
                  One of its deposits was reclaimed first, so the mint refused the whole batch. Nothing was paid
                  to {creator.short}. The remaining deposits are still at the mint, and their owners can take them back.
                </p>
              </Note>
            ) : (
              <p>
                Nothing has been sent to the mint. The payout goes out as one batch of {sats(totalSat)} when all three
                backers have approved.
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
          <p>One batch of {sats(totalSat)} to {creator.name}. It’s paid only when the mint confirms it.</p>
        </PageHead>

        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={copy.icon} word={copy.word} sentence={copy.sentence}>
              <p className="state-meta">
                Sent {formatWhen(batch.savedAt)}.{' '}
                {batch.status === 'unresolved' ? 'The request timed out, so the result is unknown.' : 'No result yet.'}
              </p>
            </StateBlock>
            {reclaimer && (
              <Note title={`${people[reclaimer.backerId!].name} has asked for their deposit back.`}>
                <p>Their approval was already released, so either request can still win. Whichever the mint confirms first stands.</p>
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
              The request was saved before it was sent. If this page is closed, it can be checked again
              from <Link to={paths.recovery()}>Recovery</Link>.
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
  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title="Payout">
        <p>All three deposits were issued to {creator.name} in one payment.</p>
      </PageHead>

      <Section label="Status">
        <StateBlock icon={copy.icon} word={copy.word} sentence={copy.sentence} confirmed signal>
          <p className="state-meta">Confirmed {formatWhen(batch.settledAt ?? batch.savedAt)}.</p>
        </StateBlock>
      </Section>

      <Section label="Receipt">
        <div className="panel">
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
            Request {batch.id}<br />
            Key {shortKey(campaign.beneficiaryPubkey)}<br />
            {campaign.mint}
          </p>
        </div>
      </Section>

      <Section label="Spending it">
        {record.spend ? (
          <p>
            {isCreator ? 'You' : creator.short} swapped the payout into {isCreator ? 'your' : 'their'} own wallet
            on {formatWhen(record.spend.at)}. The mint kept a {SWAP_FEE_SAT}-sat fee.
          </p>
        ) : isCreator ? (
          <div className="stack">
            <p>
              The {sats(totalSat)} are locked to your key. Swapping them into your wallet costs {sats(SWAP_FEE_SAT)} at
              this mint, so you’ll receive {sats(receivedSat)}.
            </p>
            <div className="actions">
              <button type="button" className="button" data-variant="primary"
                onClick={() => apply((world, at) => recordSpend(world, campaign.id, at))}>
                Swap into my wallet
              </button>
            </div>
          </div>
        ) : (
          <p>
            The {sats(totalSat)} are locked to {creator.short}’s key. When {creator.short} swaps them into a wallet, the
            mint keeps {sats(SWAP_FEE_SAT)}.
          </p>
        )}
      </Section>
    </>
  );
}
