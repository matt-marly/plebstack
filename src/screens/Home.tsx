import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findCampaign, maintainerOf, sats, slotOf, statusOf, tally } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { TopBar, useHeadingFocus, useTitle } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { PLEBS, campaignGoal, closeLine, type Goal } from '../ui/journey';
import { Stack } from '../ui/Stack';
import { Sheet } from '../ui/Sheet';

// No stack yet: the goal line with three open places, the picture of what you're about to start.
const emptyGoal: Goal = { phase: 'collecting', label: 'goal · 0 of 63 sats', text: '', slabs: [{ kind: 'open' }, { kind: 'open' }, { kind: 'open' }] };

// Pull a stack id out of whatever was pasted: a full invite link, a path, or the id itself.
export function stackIdFrom(text: string): string | undefined {
  const trimmed = text.trim();
  const match = trimmed.match(/\/s\/([^/?#\s]+)/) ?? trimmed.match(/^([a-z0-9-]+)$/i);
  return match?.[1];
}

export function Home() {
  const { world, stackId, viewer } = useSession();
  const playAs = usePlayAs();
  const navigate = useNavigate();
  const arrived = useLocation().state as { join?: boolean } | null;
  const [joining, setJoining] = useState(Boolean(arrived?.join));
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState('');
  const main = useRef<HTMLElement>(null);
  useTitle('Home');
  useHeadingFocus(main, 'home');

  const record = findCampaign(world, stackId);
  const draft = stackId && !record ? liveActions.draft(stackId) : undefined;

  const start = () => playAs(ORGANIZER, paths.start());
  const open = () => navigate(homePath(viewer.id, stackId));

  // Join as the first pleb not in yet, so a pasted link always lands on someone who can chip in.
  function join(event: FormEvent) {
    event.preventDefault();
    const id = stackIdFrom(link);
    const target = id ? findCampaign(world, id) : undefined;
    if (!target) {
      if (!id) {
        setProblem('That doesn’t look like an invite link. Check it and try again.');
        return;
      }
      // Not on this device yet: open it, and it arrives from the relays.
      setJoining(false);
      navigate(paths.stack(id));
      return;
    }
    const pleb = PLEBS.find(person => !slotOf(target, person)) ?? PLEBS[0];
    setJoining(false);
    playAs(pleb, homePath(pleb, target.campaign.id));
  }

  const invite = (
    <button type="button" className="button" data-variant="quiet" onClick={() => { setProblem(''); setJoining(true); }}>
      Have an invite link?
    </button>
  );
  const { heldSat = 0, targetSat = 63, held = 0 } = record ? tally(record) : {};
  const maintainer = record ? maintainerOf(record).short : draft?.maintainerName.split(' ')[0];

  return (
    <div className="screen home">
      <header className="top">
        <TopBar record={record} />
      </header>
      <main ref={main} className="home-body" id="main">
        <div className="home-hero" key={record?.campaign.id ?? draft?.id ?? 'empty'}>
          <Stack goal={record ? campaignGoal(record, viewer.id) : emptyGoal} meta={record ? closeLine(record) : undefined} landing />
        </div>
        {record ? (
          <div className="home-words">
            <p className="home-eyebrow">Backing {maintainer}</p>
            <h1 className="home-title">{statusOf(record) === 'paid' ? `${maintainer} got ${sats(targetSat)}` : `${held} of ${record.campaign.backerCount} in`}</h1>
            <p className="home-sub">{statusOf(record) === 'paid'
              ? 'Confirmed by the mint.'
              : `${heldSat} of ${sats(targetSat)} at the mint. ${maintainer} is paid only if everyone signs.`}</p>
          </div>
        ) : draft ? (
          <div className="home-words">
            <p className="home-eyebrow">Backing {maintainer}</p>
            <h1 className="home-title">Setting up</h1>
            <p className="home-sub">{viewer.id === ORGANIZER || viewer.id === MAINTAINER ? 'A couple of steps before anyone can chip in.' : 'Not open yet.'}</p>
          </div>
        ) : (
          <div className="home-words">
            <h1 className="home-title">Back a builder, together.</h1>
            <p className="home-sub">Three people, 21 sats each. All in, or everyone takes theirs back.</p>
          </div>
        )}
      </main>
      <footer className="actions home-actions">
        {record || draft ? (
          <button type="button" className="button" data-variant="primary" onClick={open}>
            {draft ? 'Finish setting up' : 'Open the stack'}<Icon name="chevron" />
          </button>
        ) : (
          <button type="button" className="button" data-variant="primary" onClick={start}>Start a stack</button>
        )}
        {invite}
      </footer>
      <Sheet open={joining} onClose={() => setJoining(false)} title="Join a stack">
        <p className="sheet-text">Scan the organizer’s QR code with your camera, or paste their invite link.</p>
        <form className="join-form" onSubmit={join}>
          <div className="field">
            <label htmlFor="join-link">Invite link</label>
            <input id="join-link" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={link} placeholder="https://…/s/…"
              onChange={event => { setLink(event.target.value); setProblem(''); }}
              aria-invalid={problem ? true : undefined} aria-describedby={problem ? 'join-problem' : undefined} />
            {problem && <p id="join-problem" className="field-note" data-error role="alert">{problem}</p>}
          </div>
          <button type="submit" className="button" data-variant="primary">Join</button>
        </form>
      </Sheet>
    </div>
  );
}
