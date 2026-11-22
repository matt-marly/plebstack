import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { maintainerOf, sats } from '../demo/world';
import { DEFAULT_CLOSE_HOURS, closeAfter, closePresets } from '../domain/close';
import { TEST_MINT } from '../domain/models';
import { failureCopy, liveActions } from '../live/actions';
import type { BoardDraft } from '../live/board';
import { paths } from '../routes';
import { useSession } from '../session';
import { formatWhen, shortKey } from '../ui/format';
import { Frame } from '../ui/Frame';
import { organizerSteps } from '../ui/GoalRail';
import { Note } from '../ui/parts';
import { organizerFacts } from '../ui/Really';

const EACH = 21;

// The datetime-local value for an instant, in the viewer's own zone.
function localInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// O3: the rules, fixed once the stack opens. The close is a real clock time in the viewer's zone.
export function Terms({ draft }: { draft: BoardDraft }) {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [hours, setHours] = useState<number | 'custom'>(DEFAULT_CLOSE_HOURS);
  const [custom, setCustom] = useState(() => localInput(closeAfter(DEFAULT_CLOSE_HOURS, new Date())));
  const [failure, setFailure] = useState<string>();
  const customId = useId();
  const maintainer = maintainerOf(draft);
  const key = draft.key!;
  const closesAt = hours === 'custom' ? (custom ? new Date(custom).toISOString() : '') : closeAfter(hours, new Date());
  const future = closesAt !== '' && Date.parse(closesAt) > Date.now();

  function create() {
    setFailure(undefined);
    try {
      // A preset counts from the tap, so a page left open doesn't open a stack that closes in the past.
      const at = hours === 'custom' ? closesAt : closeAfter(hours, new Date());
      const id = liveActions.createCampaign(draft.organizerId, draft.id, { closesAt: at, contributionSat: EACH });
      refresh(`Your stack is open. It closes ${formatWhen(at)}.`);
      navigate(paths.organize(id, 'share'));
    } catch (error) {
      setFailure(failureCopy(error));
    }
  }

  return (
    <Frame rail={{ at: 2, paid: false, steps: organizerSteps }} title="Set the terms" facts={organizerFacts(maintainer.short, sats(EACH))}
      actions={(
        <button type="button" className="button" data-variant="primary" aria-disabled={!future || undefined}
          onClick={() => { if (future) create(); }}>
          Create stack
        </button>
      )}>
      <div className="lead rise">
        <h1>Set the terms.</h1>
        <p>These lock as soon as you create the stack.</p>
      </div>
      <dl className="rows">
        <div><dt>Plebs</dt><dd className="mono">3</dd></div>
        <div><dt>Each chips in</dt><dd className="mono">{sats(EACH)}</dd></div>
        <div><dt>Goal</dt><dd className="mono">{sats(EACH * 3)}</dd></div>
        <div><dt>Mint</dt><dd className="mono">{TEST_MINT.replace('https://', '')}</dd></div>
        <div>
          <dt>Locked to</dt>
          <dd className="mono">{maintainer.short} · {shortKey(key.pubkey, 4, 4)}{key.by === 'pasted' ? ' · pasted' : ''}</dd>
        </div>
      </dl>
      <fieldset className="close-pick">
        <legend>Stop collecting after</legend>
        <div className="choices">
          {closePresets.map(preset => (
            <button key={preset.hours} type="button" className="choice" aria-pressed={hours === preset.hours}
              onClick={() => setHours(preset.hours)}>
              {preset.label}
            </button>
          ))}
          <button type="button" className="choice" aria-pressed={hours === 'custom'} onClick={() => setHours('custom')}>Custom</button>
        </div>
        {hours === 'custom' && (
          <div className="field">
            <label htmlFor={customId}>Close at, your time</label>
            <input id={customId} type="datetime-local" value={custom} min={localInput(new Date().toISOString())}
              onChange={event => setCustom(event.target.value)} />
          </div>
        )}
        <p className="field-note" aria-live="polite">
          {future ? `Closes ${formatWhen(closesAt)}. The close never moves anyone’s sats.` : 'Pick a time in the future.'}
        </p>
      </fieldset>
      {failure && <Note><p>{failure}</p></Note>}
    </Frame>
  );
}
