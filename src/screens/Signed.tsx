import { people, sats } from '../demo/world';
import { liveActions } from '../live/actions';
import { useSession } from '../session';
import { failureOf, inBackground, isRunning, keys } from '../ui/background';
import { listNames } from '../ui/format';
import { Frame } from '../ui/Frame';
import { GroupCard } from '../ui/GroupCard';
import { readyToSend, signedCount } from '../ui/journey';
import { Note, ShareButton, StateChip } from '../ui/parts';
import { TakeBack } from '../ui/TakeBack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

const counted = ['None', 'One', 'Two', 'Three'];

// P6: signed, waiting for the others. Taking it back is still possible, and can race the payout.
export function Signed({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const { campaign } = record;
  const maintainer = people[record.creatorId].short;
  const each = sats(campaign.contributionSat);
  const waitingOn = journey.step.kind === 'approved' ? journey.step.waitingOn : [];
  const names = listNames(waitingOn);
  const many = waitingOn.length > 1;
  const key = keys.payout(campaign.id);
  const failure = failureOf(key);
  // All three signed but the batch never left, say after a failed send: anyone who signed can send it.
  const unsent = readyToSend(record);
  const send = () => inBackground(key, () => liveActions.payout(world.viewerId, campaign.id), refresh);

  return (
    <Frame record={record} rail={journey.rail} title={unsent ? 'All three signed' : 'Signed'}
      actions={unsent ? (
        <button type="button" className="button" data-variant="primary" aria-disabled={isRunning(key) || undefined}
          onClick={() => { if (!isRunning(key)) send(); }}>
          Send to the mint
        </button>
      ) : (
        <>
          <ShareButton label="Share a nudge" done="Nudge copied" title="Plebstack" url={`${location.origin}/s/${campaign.id}`}
            text={`${names} still ${many ? 'have' : 'has'} to sign the group card for ${maintainer}.`}
            notice="Nudge copied. To sign as the next pleb in this browser, switch who you’re playing as." />
          <TakeBack record={record} viewerId={world.viewerId} signed />
        </>
      )}>
      <div className="lead rise">
        <StateChip state="approved" />
        <h1>{unsent ? 'All three signed.' : `Signed. Waiting for ${names}.`}</h1>
        <p>{unsent
          ? 'The last step sends the batch to the mint. Nothing is paid until the mint confirms.'
          : `${counted[signedCount(record)]} of three ${signedCount(record) === 1 ? 'has' : 'have'} signed. When ${names} ${many ? 'sign, the last' : 'signs, that last'} signature sends the payout to the mint.`}</p>
      </div>
      {failure && unsent && <Note><p>{failure}</p></Note>}
      <GroupCard record={record} viewerId={world.viewerId} />
      <Track stop={journey.stop} maintainer={maintainer} amount={each} />
    </Frame>
  );
}
