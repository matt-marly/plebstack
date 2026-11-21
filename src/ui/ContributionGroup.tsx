import { Link } from 'react-router-dom';
import { confirmedStates, stateCopy } from '../domain/states';
import {
  groupComplete, isHeld, people, rowSentence, slotStatus, statusOf, tally, type CampaignRecord, type Slot, type SlotStatus,
} from '../demo/world';
import { paths } from '../routes';
import { Icon } from './Icon';
import { Amount } from './parts';

function rowWord(status: SlotStatus): string {
  if (status === 'open') return 'Open';
  if (status === 'awaiting') return 'Awaiting deposit';
  return stateCopy[status].word;
}

function rowIcon(status: SlotStatus): string {
  if (status === 'open') return 'slot-open';
  if (status === 'awaiting') return 'awaiting';
  return stateCopy[status].icon;
}

function totalCaption(record: CampaignRecord): string {
  const state = statusOf(record);
  const maintainer = people[record.creatorId];
  if (state === 'paid') return `paid to ${maintainer.name} in one batch. Confirmed by the mint.`;
  if (state === 'paying out') return 'sent to the mint as one batch. Not paid until the mint confirms.';
  if (groupComplete(record)) return `at the line. One batch to ${maintainer.short} once all three sign.`;
  if (state === 'unmet') return 'still at the mint. No payout this time.';
  return 'stacked. Paid in one batch, or not at all.';
}

// A sentence that opens with its state word has the word set in bold rather than said twice.
function RowState({ word, sentence }: { word: string; sentence: string }) {
  const opens = sentence.startsWith(word);
  return (
    <p className="row-state">
      <span className="row-word" data-apart={opens ? undefined : true}>{word}</span>
      {opens ? sentence.slice(word.length) : sentence}
    </p>
  );
}

function Row({ record, slot, viewerId }: { record: CampaignRecord; slot: Slot; viewerId: string }) {
  const status = slotStatus(slot);
  const own = slot.backerId === viewerId;
  const confirmed = status !== 'open' && status !== 'awaiting' && confirmedStates.includes(status);
  const unfilled = status === 'open' && statusOf(record) !== 'collecting';
  return (
    <li className="row" data-status={status} data-held={isHeld(slot) || undefined} data-confirmed={confirmed || undefined}>
      <span className="row-icon"><Icon name={rowIcon(status)} size={22} /></span>
      <div className="row-main">
        <p className="row-who">
          {slot.backerId ? people[slot.backerId].name : unfilled ? 'Unfilled slot' : 'Open slot'}
          {own && <span className="you">you</span>}
        </p>
        {unfilled
          ? <RowState word="Unfilled" sentence="Unfilled. Collection stopped before a third deposit." />
          : <RowState word={rowWord(status)} sentence={rowSentence(record, status, own)} />}
        {own && slot.quote && (
          <p className="row-link"><Link to={paths.deposit(record.campaign.id, slot.id)}>Your deposit</Link></p>
        )}
      </div>
      <p className="row-amount"><Amount value={record.campaign.contributionSat} size="row" /></p>
      <span className="row-lead" aria-hidden="true" />
    </li>
  );
}

// The bracket is the one drawn device in the product: three leads into one spine, one total.
// It closes only when all three deposits are at the mint.
export function ContributionGroup({ record, viewerId }: { record: CampaignRecord; viewerId: string }) {
  const { held, heldSat, targetSat } = tally(record);
  const complete = groupComplete(record);
  return (
    <div className="group" data-complete={complete || undefined}>
      <div className="group-layout">
        <ol className="group-rows" role="list">
          {record.slots.map(slot => <Row key={slot.id} record={record} slot={slot} viewerId={viewerId} />)}
        </ol>
        <div className="group-total">
          <p className="group-sum">
            {complete ? <Amount value={targetSat} /> : <Amount value={heldSat} of={targetSat} />}
          </p>
          <p className="group-caption">{totalCaption(record)}</p>
          <p className="visually-hidden">
            {complete
              ? `All three deposits are in, ${heldSat} of ${targetSat} sats.`
              : `${held} of 3 deposits in, ${heldSat} of ${targetSat} sats.`}
          </p>
        </div>
      </div>
    </div>
  );
}
