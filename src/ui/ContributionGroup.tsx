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
  if (state === 'paid') return 'paid to the creator in one payment';
  if (state === 'paying out') return 'sent to the mint as one payment';
  if (groupComplete(record)) return 'one payment to the creator, once all three approve';
  if (state === 'unmet') return 'still at the mint. This group can’t pay out.';
  return 'deposited. Paid as one payment, or not at all.';
}

// Every sentence opens with its state word, so the word is set in bold rather than said twice.
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
          : <RowState word={rowWord(status)} sentence={rowSentence(status, own)} />}
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
              ? 'All three deposits are joined into one payment.'
              : `${held} of 3 deposits are in; the group is not complete.`}
          </p>
        </div>
      </div>
    </div>
  );
}
