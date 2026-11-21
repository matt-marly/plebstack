import { Link } from 'react-router-dom';
import { stateCopy } from '../domain/states';
import {
  groupComplete, people, rowSentence, slotStatus, statusOf, type CampaignRecord, type Slot, type SlotStatus,
} from '../demo/world';
import { paths } from '../routes';
import { Icon } from './Icon';
import { GoalLine, campaignGoal } from './GoalLine';
import { Amount, tone } from './parts';

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
  if (state === 'paid') return `Paid to ${maintainer.name} in one batch. Confirmed by the mint.`;
  if (state === 'paying out') return 'Sent to the mint as one batch. Not paid until the mint confirms.';
  if (groupComplete(record)) return `At the line. One batch to ${maintainer.short} once all three sign.`;
  if (state === 'unmet') return 'Still at the mint. No payout this time.';
  return 'Paid in one batch, or not at all.';
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
  const unfilled = status === 'open' && statusOf(record) !== 'collecting';
  return (
    <li className="row" data-status={status} {...tone(status)}>
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
    </li>
  );
}

// The goal line is the one drawn device in the product: three deposits under one payout line.
export function ContributionGroup({ record, viewerId }: { record: CampaignRecord; viewerId: string }) {
  return (
    <div className="group" data-complete={groupComplete(record) || undefined}>
      <div className="group-layout">
        <div className="group-total">
          <GoalLine {...campaignGoal(record, viewerId)} />
          <p className="group-caption">{totalCaption(record)}</p>
        </div>
        <ol className="group-rows" role="list">
          {record.slots.map(slot => <Row key={slot.id} record={record} slot={slot} viewerId={viewerId} />)}
        </ol>
      </div>
    </div>
  );
}
