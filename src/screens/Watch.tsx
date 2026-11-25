import { useState } from 'react';
import { maintainerOf, people, sats, statusOf, tally, type CampaignRecord, type Slot } from '../demo/world';
import { stateCopy } from '../domain/states';
import { failureCopy, liveActions } from '../live/actions';
import { paths } from '../routes';
import { useSession } from '../session';
import { formatTime, formatWhen } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal, closeLine, organizerJourney, signedCount } from '../ui/journey';
import { Icon } from '../ui/Icon';
import { NewStack, Note, ShareButton, ShareInvite, Status } from '../ui/parts';
import { organizerFacts } from '../ui/Really';
import { Sheet } from '../ui/Sheet';
import { Stack } from '../ui/Stack';
import { Who } from '../ui/Who';
import { confirmedPayout } from './Paid';
import { whyUnmet } from './Unmet';

const counts = ['Nobody’s in yet.', '1 of 3 in.', '2 of 3 in.', 'All three in.'];

function standing(slot: Slot): string {
  const state = slot.deposit?.state;
  if (!state) return 'invoice open';
  if (state === 'reclaimed') return 'took theirs back';
  if (state === 'reclaiming') return 'taking theirs back';
  if (state === 'paid') return 'paid';
  return slot.deposit?.authorizationReleased && slot.signedAt ? `signed · ${formatTime(slot.signedAt)}` : `in · ${formatTime(slot.inAt ?? '')}`;
}

// O5: watch it fill. Signatures send the payout by themselves; the organizer only shares and can stop collecting.
export function Watch({ record }: { record: CampaignRecord }) {
  const { world, refresh } = useSession();
  const [stopping, setStopping] = useState(false);
  const [failure, setFailure] = useState<string>();
  const { campaign } = record;
  const maintainer = maintainerOf(record);
  const each = sats(campaign.contributionSat);
  const total = sats(campaign.contributionSat * campaign.backerCount);
  const state = statusOf(record);
  const { held } = tally(record);
  const signed = signedCount(record);
  const payout = confirmedPayout(record);
  const url = `${location.origin}/s/${campaign.id}`;

  function stop() {
    setStopping(false);
    try {
      refresh(liveActions.stopCollecting(world.viewerId, campaign.id));
    } catch (error) {
      setFailure(failureCopy(error));
    }
  }

  const words: { chip?: Parameters<typeof Status>[0]; title: string; text: string } = state === 'paid'
    ? { chip: { state: 'paid', phrase: 'Confirmed by the mint' }, title: stateCopy.paid.phrase,
      text: `${maintainer.short} got ${total}, locked to her key. Confirmed by the mint at ${formatWhen(payout?.settledAt ?? new Date().toISOString())}.` }
    : state === 'paying out'
      ? { chip: { state: 'paying out' }, title: 'All three signed. Sending.', text: 'The payout is with the mint as one batch. Nothing is paid until the mint confirms.' }
      : state === 'unmet' || state === 'reclaimed'
        ? { chip: { state: 'unmet' }, title: 'No payout this time.', text: `${whyUnmet(record, world.viewerId)} Each pleb takes their own ${each} back. You can’t move them.` }
        : state === 'reclaiming'
          ? { chip: { state: 'reclaiming' }, title: 'Someone is taking theirs back.', text: 'If every signature is already out, the payout may still get there first. The mint decides.' }
          : held === 3
            ? { chip: { state: signed === 3 ? 'approved' : 'ready', phrase: `Signed ${signed} of 3` }, title: counts[3],
              text: 'Each pleb checks the payout and signs. The last signature sends it to the mint by itself.' }
            : { title: counts[held], text: `When all three sign, the last signature sends the payout to the mint. You never send it, and you never hold anyone’s ${each}.` };

  const collecting = state === 'collecting' && held < 3;
  const over = state === 'unmet' || state === 'reclaimed';
  return (
    <Frame record={record} {...organizerJourney('watch', maintainer.short, record)} back={{ to: paths.organize(campaign.id, 'share'), label: 'Share' }}
      title={words.title} facts={organizerFacts(maintainer.short, each)}
      actions={state === 'paid' ? (
        <>
          <ShareButton label="Share the stack" done="Copied" title="Plebstack" url={url}
            text={`We stacked ${total} for ${maintainer.name}. Three plebs, one batch, confirmed by the mint. Test mint, fake sats.`} />
          <NewStack />
        </>
      ) : over ? <NewStack variant="primary" /> : (
        <>
          <ShareInvite campaignId={campaign.id} title={`Back ${maintainer.short}: ${campaign.title}`} />
          {collecting && <button type="button" className="button" data-variant="secondary" onClick={() => setStopping(true)}>Stop collecting</button>}
        </>
      )}>
      <div className="lead rise">
        {words.chip && <Status {...words.chip} />}
        <h1>{words.title}</h1>
        <p>{words.text}</p>
      </div>
      <Stack goal={campaignGoal(record)} meta={state === 'paid' ? undefined : closeLine(record)} />
      <Who name={maintainer.name} title={campaign.title} keyBy={record.keyBy} pubkey={campaign.beneficiaryPubkey} />
      <dl className="rows">
        {record.slots.filter(slot => slot.backerId).map(slot => (
          <div key={slot.id}><dt>{people[slot.backerId!].name}</dt><dd className="mono">{standing(slot)}</dd></div>
        ))}
      </dl>
      {failure && <Note><p>{failure}</p></Note>}
      <a className="button" data-variant="quiet" href={paths.stage(campaign.id)} target="_blank" rel="noopener">
        Open the stage for a big screen<Icon name="chevron" />
      </a>
      <Sheet open={stopping} onClose={() => setStopping(false)} title="Stop collecting?">
        <p className="sheet-text">
          Nobody new can join, and there’s no payout. Everyone who’s in takes their own {each} back. Signatures already released still count.
        </p>
        <div className="sheet-actions">
          <button type="button" className="button" data-variant="primary" onClick={stop}>Stop collecting</button>
          <button type="button" className="button" data-variant="secondary" onClick={() => setStopping(false)}>Keep collecting</button>
        </div>
      </Sheet>
    </Frame>
  );
}
