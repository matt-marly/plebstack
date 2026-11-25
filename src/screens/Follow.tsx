import { people, sats, statusOf, tally, type CampaignRecord } from '../demo/world';
import type { BoardDraft } from '../live/board';
import { formatWhen, shortKey } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal, closeLine, maintainerJourney } from '../ui/journey';
import { NewStack, Pending, ShareButton, Status } from '../ui/parts';
import { maintainerFacts } from '../ui/Really';
import { Stack } from '../ui/Stack';
import { PayoutTrack } from '../ui/Track';
import { whyUnmet } from './Unmet';

// M2: a stack for her. Nothing to do; the payout will be locked to her key if all three sign.
export function Follow({ draft, record, viewerId }: { draft: BoardDraft; record?: CampaignRecord; viewerId: string }) {
  const organizer = people[draft.organizerId].short;
  const facts = maintainerFacts(sats(63));
  if (!record) {
    return (
      <Frame {...maintainerJourney('follow', organizer)} title="Key confirmed" facts={facts} actions={<Pending label={`Waiting for ${organizer} to open the stack…`} />}>
        <div className="lead rise">
          <h1>Your key is confirmed.</h1>
          <p>{organizer} is setting the terms next. The payout will be locked to your key. Nothing to do yet.</p>
        </div>
        {draft.key && (
          <dl className="rows">
            <div><dt>Your payout key</dt><dd className="mono">{shortKey(draft.key.pubkey, 4, 4)}</dd></div>
            <div><dt>Confirmed</dt><dd className="mono">{formatWhen(draft.key.at)}</dd></div>
          </dl>
        )}
      </Frame>
    );
  }

  const { campaign } = record;
  const state = statusOf(record);
  const { held, heldSat, targetSat } = tally(record);
  const total = sats(targetSat);
  const unmet = state === 'unmet' || state === 'reclaimed';
  const sending = state === 'paying out';
  const pasted = record.keyBy === 'pasted';
  const chip = unmet ? { state: 'unmet' as const } : sending ? { state: 'paying out' as const }
    : { state: 'collecting' as const, phrase: held === 3 ? 'At the line' : `${held} of 3 in` };
  return (
    <Frame record={record} {...maintainerJourney('follow', organizer, record)} title="A stack for you" facts={facts}
      actions={unmet ? <NewStack variant="primary" /> : (
        <ShareButton label="Share the stack" done="Copied" title="Plebstack" url={`${location.origin}/s/${campaign.id}`}
          text={`${organizer} is getting 3 plebs to back me on Plebstack.`} variant="secondary" />
      )}>
      <div className="lead rise">
        <Status {...chip} phrase={chip.phrase ?? (unmet ? 'Didn’t fill' : 'Waiting for the mint')} />
        <h1>{unmet ? 'No payout this time.' : sending ? 'On its way to you.' : 'A stack for you.'}</h1>
        <p>{unmet
          ? `${whyUnmet(record, viewerId)} Each pleb takes their own back. Nothing was paid to you.`
          : sending
            ? 'All three signed and the batch is with the mint. Nothing is yours until the mint confirms.'
            : `${organizer} is organizing it. The payout will be locked to ${pasted ? 'the key she pasted, not one made here' : 'your key'}. Nothing to do yet.`}</p>
      </div>
      <Stack goal={campaignGoal(record)} meta={closeLine(record)} />
      <PayoutTrack title="Where the sats for you are" stop={unmet ? 'none' : sending ? 'to-you' : held ? 'at-mint' : 'none'}
        label={unmet ? 'none coming' : sending ? `${total} on the way to you` : held ? `${heldSat} of ${total} at the mint` : 'nothing stacked yet'} />
    </Frame>
  );
}
