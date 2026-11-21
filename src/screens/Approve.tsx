import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  canApprove, findCampaign, people, releaseApproval, sats, stateSentence, statusOf, stopApproval, tally,
} from '../demo/world';
import { confirmedStates, signalStates, stateCopy } from '../domain/states';
import { paths } from '../routes';
import { listNames, shortKey } from '../ui/format';
import { Icon } from '../ui/Icon';
import { NextStep } from '../ui/NextStep';
import { ConfirmDialog, Fact, Facts, Note, PageHead, Section, StateBlock, focusHeading, useTitle } from '../ui/parts';
import { Missing, NotYours, useRecord } from './shared';

export function Approve() {
  const { viewer, apply, record, slot } = useRecord();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const found = record !== undefined && slot?.deposit !== undefined;
  useTitle(found ? 'Sign the payout' : 'Not found');
  if (!record) return <Missing what="campaign" />;
  if (!slot?.deposit || !slot.backerId) return <Missing what="deposit" />;

  const { campaign } = record;
  const deposit = slot.deposit;
  const creator = people[record.creatorId];
  const own = slot.backerId === viewer.id;
  const each = sats(campaign.contributionSat);
  const totalSat = tally(record).targetSat;
  const total = sats(totalSat);
  const back = { to: paths.campaign(campaign.id), label: 'Campaign' };
  const others = record.slots.filter(other => other.id !== slot.id && other.backerId).map(other => people[other.backerId!].short);

  if (!own) {
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Sign the payout" />
        <Section label="Status"><NotYours slot={slot} /></Section>
      </>
    );
  }

  // Anything other than a deposit that is ready to sign: say where it stands and what's left to do.
  if (!canApprove(record, slot)) {
    const copy = stateCopy[deposit.state];
    return (
      <>
        <PageHead back={back} eyebrow={campaign.title} title="Sign the payout">
          {deposit.state === 'deposited' && !deposit.newApprovalsStopped && (
            <p>Signing opens when all three deposits are at the mint. {tally(record).held} of 3 are in.</p>
          )}
        </PageHead>
        <Section label="Status">
          <div className="stack" data-gap="large">
            <StateBlock icon={copy.icon} word={copy.word} phrase={copy.phrase} sentence={stateSentence(record, deposit.state)}
              confirmed={confirmedStates.includes(deposit.state)}
              signal={signalStates.includes(deposit.state)} />
            <NextStep record={record} />
          </div>
        </Section>
      </>
    );
  }

  function release() {
    setConfirming(false);
    const next = apply((world, at) => releaseApproval(world, campaign.id, deposit.id, at));
    const after = findCampaign(next, campaign.id);
    if (after && statusOf(after) === 'paying out') navigate(paths.payout(campaign.id));
    else focusHeading();
  }

  return (
    <>
      <PageHead back={back} eyebrow={campaign.title} title="Sign the payout">
        <p>
          You’re signing your {each} into one {totalSat}-sat payment, locked to {creator.name}’s key. Check the outputs.
          A signature can’t be taken back.
        </p>
      </PageHead>

      <Section label="The payout">
        <div className="panel">
          <p className="panel-title">One batch, three deposits</p>
          {record.slots.map(other => (
            <p className="receipt-row" key={other.id}>
              <span>{people[other.backerId!].name}{other.id === slot.id && <span className="muted"> (you)</span>}</span>
              <span>{each}</span>
            </p>
          ))}
          <p className="receipt-row" data-kind="total">
            <span>To {creator.name}</span>
            <span>{total}</span>
          </p>
          <div className="panel-facts">
            <Facts>
              <Fact label={`${creator.short}’s key`}><span className="mono">{campaign.beneficiaryPubkey}</span></Fact>
              <Fact label="Mint"><span className="mono">{campaign.mint}</span></Fact>
            </Facts>
          </div>
        </div>
      </Section>

      <Section label="Checked on this device">
        <div className="stack">
          <p>Outputs checked on this device: {total}, locked to {creator.short}’s key, no other way to spend them.</p>
          <ul className="checks" role="list">
            <li><Icon name="check" size={18} /><span>All three quotes are paid at the mint and issued to nobody.</span></li>
            <li><Icon name="check" size={18} /><span>Every output is locked to {creator.short}’s key shown above, and to nothing else.</span></li>
            <li><Icon name="check" size={18} /><span>The outputs add up to {total}.</span></li>
            <li><Icon name="check" size={18} /><span>{listNames(others)} are asked to sign this same set of outputs.</span></li>
          </ul>
          <p className="muted small">Recomputed in this browser. The organizer supplies public data only, never a key.</p>
        </div>
      </Section>

      <Section label="Your signature">
        <div className="stack" data-gap="large">
          <Note title="A released signature can’t be taken back.">
            <p>
              After signing you can still take your {each} back until the mint issues the payout, but the payout may get
              there first. Stopping now releases nothing.
            </p>
          </Note>
          <div className="actions">
            <button type="button" className="button" data-variant="primary" onClick={() => setConfirming(true)}>
              Release signature…
            </button>
            <button type="button" className="button" onClick={() => {
              apply((world, at) => stopApproval(world, campaign.id, deposit.id, at));
              focusHeading();
            }}>
              Stop signing
            </button>
          </div>
          <p className="small link-alone"><Link to={paths.reclaim(campaign.id, slot.id)}>Take mine back instead</Link></p>
        </div>
      </Section>

      <ConfirmDialog open={confirming} title={`Release your signature for the ${totalSat}-sat payout?`} confirmLabel="Release signature"
        onConfirm={release} onCancel={() => setConfirming(false)}>
        <p>
          Your {each} become part of one {totalSat}-sat payment, locked to {creator.name}’s key
          {' '}(<span className="mono">{shortKey(campaign.beneficiaryPubkey)}</span>).
        </p>
        <p>You can’t take this back. A reclaim can still race the payout.</p>
      </ConfirmDialog>
    </>
  );
}
