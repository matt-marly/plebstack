import { Link } from 'react-router-dom';
import { people, rowSentence, sats, slotStatus } from '../demo/world';
import { stateCopy } from '../domain/states';
import type { LockedQuote } from '../domain/models';
import { paths } from '../routes';
import { NextStep } from '../ui/NextStep';
import { Amount, Fact, Facts, KeyText, PageHead, Section, StateBlock, useTitle } from '../ui/parts';
import { Missing, NotYours, useRecord } from './shared';

const mintReports: Record<LockedQuote['mintState'], string> = {
  UNPAID: 'Unpaid. Not stacked until the mint reports it paid.',
  PAID: 'Paid and unissued. The sats are at the mint and have gone to nobody.',
  ISSUED: 'Issued. The state above says to whom.',
};

export function DepositDetail() {
  const { viewer, record, slot } = useRecord();
  const own = slot?.backerId === viewer.id;
  const owner = slot?.backerId ? people[slot.backerId] : undefined;
  const title = own || !owner ? 'Your deposit' : `${owner.name}’s deposit`;
  useTitle(record && slot?.quote ? title : 'Not found');
  if (!record) return <Missing what="campaign" />;
  if (!slot?.quote || !owner) return <Missing what="deposit" />;

  const { campaign } = record;
  const status = slotStatus(slot);
  const deposit = slot.deposit;
  const state = status === 'awaiting' || status === 'open'
    ? { tone: 'awaiting' as const, icon: 'awaiting', word: 'Awaiting deposit', phrase: undefined }
    : { tone: status, icon: stateCopy[status].icon, word: stateCopy[status].word, phrase: stateCopy[status].phrase };

  let approval = 'Not released.';
  if (deposit?.authorizationReleased) approval = 'Released. It can’t be taken back.';
  else if (deposit?.newApprovalsStopped) approval = 'Signing stopped on this device. No signature was released.';

  return (
    <>
      <PageHead back={{ to: paths.campaign(campaign.id), label: 'Campaign' }} eyebrow={campaign.title} title={title}>
        <p><Amount value={slot.quote.amountSat} /></p>
      </PageHead>

      <Section label="Status">
        <div className="stack" data-gap="large">
          <StateBlock state={state.tone} icon={state.icon} word={state.word} phrase={state.phrase}
            sentence={rowSentence(record, status, own)} />
          {own ? <NextStep record={record} /> : <NotYours slot={slot} />}
        </div>
      </Section>

      <Section label="Deposit">
        <Facts>
          <Fact label="Held at">
            <span className="mono">{slot.quote.mint}</span>
          </Fact>
          <Fact label="Mint reports">{mintReports[slot.quote.mintState]}</Fact>
          <Fact label="Locked to">
            <p>{own ? 'Your key, made in this browser' : `${owner.short}’s key`}</p>
            <KeyText value={slot.quote.ownerPubkey} label="key" />
          </Fact>
          <Fact label="Signature">{approval}</Fact>
          <Fact label="Quote ID"><span className="mono">{slot.quote.id}</span></Fact>
          <Fact label="Pays out as">
            One batch of {sats(campaign.contributionSat * campaign.backerCount)} to {people[record.creatorId].name}, with two other deposits.
          </Fact>
        </Facts>
      </Section>

      {own && (
        <Section label="If it’s interrupted">
          <p>
            Each request is saved on this device before it’s sent to the mint. If a payout or reclaim is cut off,
            open <Link to={paths.recovery()}>Recovery</Link>. Check again asks the mint about the same request.
          </p>
        </Section>
      )}
    </>
  );
}
