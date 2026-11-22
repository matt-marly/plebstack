import { useState } from 'react';
import { headline, pendingOperation, people, sats, slotOf } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import { useSession } from '../session';
import { formatWhen } from '../ui/format';
import { Frame } from '../ui/Frame';
import { campaignGoal } from '../ui/journey';
import { Note, StateChip } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';
import type { ScreenProps } from './StackRoute';

// Where the pleb stands once past Waiting: the state in words, the stack, and the one safe action that applies.
export function Status({ world, record, journey }: ScreenProps) {
  const { refresh } = useSession();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const { campaign } = record;
  const slot = slotOf(record, world.viewerId);
  const state = slot?.deposit?.state;
  const top = headline(record);
  const each = sats(campaign.contributionSat);
  const kind = journey.step.kind;
  const pending = slot && pendingOperation(record, 'reclaim', slot.id);

  async function act(run: () => Promise<string>) {
    setAsking(true);
    setFailure(undefined);
    try {
      refresh(await run());
    } catch (error) {
      setFailure(failureCopy(error));
    } finally {
      setAsking(false);
    }
  }

  const action = kind === 'take-back' ? { label: 'Take mine back', run: () => liveActions.reclaim(world.viewerId, campaign.id) }
    : pending ? { label: 'Check again', run: () => liveActions.checkReclaim(world.viewerId, campaign.id, pending.id) } : undefined;

  return (
    <Frame record={record} rail={journey.rail} title={top.word}
      actions={action && (
        <button type="button" className="button" data-variant="primary" aria-disabled={asking || undefined}
          onClick={() => { if (!asking) void act(action.run); }}>
          {asking ? 'Asking the mint…' : action.label}
        </button>
      )}>
      <div className="lead rise">
        {state && state !== 'deposited' ? <StateChip state={state} /> : top.state !== 'collecting' && top.state !== 'unmet'
          ? <StateChip state={top.state} /> : null}
        <h1>{(top.phrase ?? top.word).replace(/\.$/, '')}.</h1>
        <p>{top.sentence}</p>
      </div>
      <Stack goal={campaignGoal(record, world.viewerId)} meta={`opened ${formatWhen(record.log[0].at)}`} />
      {slot && <Track stop={journey.stop} maintainer={people[record.creatorId].short} amount={each} />}
      {failure && <Note><p>{failure}</p></Note>}
    </Frame>
  );
}
