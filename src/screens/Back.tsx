import { Link, useNavigate } from 'react-router-dom';
import { confirmDeposit, people, requestQuote, sats, slotOf, slotStatus, statusOf } from '../demo/world';
import { paths } from '../routes';
import { CopyButton, Fact, Facts, KeyText, Note, PageHead, Section, StateBlock, focusHeading, useTitle } from '../ui/parts';
import { Missing, useRecord } from './shared';

export function Back() {
  const { viewer, apply, record } = useRecord();
  const navigate = useNavigate();
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
        <p>Your deposit of {each} is in this campaign. Each backer makes one.</p>
        <p className="link-alone"><Link to={paths.deposit(campaign.id, slot.id)}>Go to your deposit</Link></p>
      </PageHead>
    );
  }

  if (awaiting && slot.quote) {
    const quote = slot.quote;
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Pay the invoice">
          <p>Paying this invoice puts {each} at the mint under your key. It doesn’t pay {creator.short}.</p>
        </PageHead>

        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon="awaiting" word="Awaiting deposit" sentence="The mint hasn’t seen a payment for this invoice yet." />
            <div className="actions">
              <button type="button" className="button" data-variant="primary" onClick={() => {
                apply((world, at) => confirmDeposit(world, campaign.id, slot.id, at));
                navigate(paths.deposit(campaign.id, slot.id));
              }}>
                Check for deposit
              </button>
            </div>
          </div>
        </Section>

        <Section label="Invoice">
          <div className="panel stack">
            <p className="panel-title">Lightning invoice for {each}</p>
            <p className="invoice">{quote.invoice}</p>
            <CopyButton text={quote.invoice} label="Copy invoice" />
          </div>
          <p className="muted small after-panel">
            This test mint credits its own invoices, so there’s nothing to pay. Check for the deposit when you’re ready.
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
        <p>The payout comes to you, so you can’t also back it. Share the campaign with the three people who will.</p>
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

  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title={`Join with ${each}`}>
        <p>You’ll get a Lightning invoice from the mint. Paying it is a deposit, not a payment to {creator.short}.</p>
      </PageHead>

      <Section label="Before you deposit">
        <div className="stack" data-gap="large">
          <ul className="plain-list" role="list">
            <li>Your {each} wait at the mint until all three backers approve one payout.</li>
            <li>They’re locked to a key made in this browser. The organizer never holds it.</li>
            <li>Until the payout happens you can take them back, as ecash at this mint. That isn’t a Lightning refund.</li>
          </ul>
          <Note>
            <p>Keys stay in this browser and nothing backs them up. Clear its storage before the payout and the deposit can’t be recovered.</p>
          </Note>
          <div className="actions">
            <button type="button" className="button" data-variant="primary" onClick={() => {
              apply((world, at) => requestQuote(world, campaign.id, at));
              focusHeading();
            }}>
              Create deposit invoice
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
