import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { findCampaign, maintainerOf, sats, slotOf, statusOf, tally, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { TopBar, useHeadingFocus, useTitle } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { PLEBS } from '../ui/journey';
import { Sheet } from '../ui/Sheet';

const stateWord: Record<string, string> = {
  collecting: 'Collecting', ready: 'Ready to sign', approved: 'Signed', 'paying-out': 'Sending', paid: 'Paid',
  unmet: 'No payout', reclaiming: 'Taking back', reclaimed: 'Taken back',
};

// The stack this browser is on, as one card: who it backs, how full it is, where it stands.
function StackCard({ record, onOpen }: { record: CampaignRecord; onOpen: () => void }) {
  const { heldSat, targetSat, held } = tally(record);
  const state = statusOf(record);
  const maintainer = maintainerOf(record);
  return (
    <button type="button" className="home-card" onClick={onOpen} data-paid={state === 'paid' || undefined}>
      <span className="home-card-top">
        <span className="home-card-for">Backing <strong>{maintainer.short}</strong></span>
        <span className="home-card-state">{stateWord[state] ?? state}</span>
      </span>
      <span className="home-amount"><span className="mono">{heldSat}</span><span className="home-unit"> / {sats(targetSat)}</span></span>
      <span className="home-bar" aria-hidden="true"><span style={{ width: `${(heldSat / targetSat) * 100}%` }} /></span>
      <span className="home-card-foot">
        <span>{held} of {record.campaign.backerCount} plebs in</span>
        <span className="home-open">Open<Icon name="chevron" /></span>
      </span>
    </button>
  );
}

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
      setProblem('That link doesn’t match a stack. Check it and try again.');
      return;
    }
    const pleb = PLEBS.find(person => !slotOf(target, person)) ?? PLEBS[0];
    setJoining(false);
    playAs(pleb, homePath(pleb, target.campaign.id));
  }

  return (
    <div className="screen home">
      <header className="top">
        <TopBar record={record} />
      </header>
      <main ref={main} className="body" id="main">
        <h1 className="home-title">{record || draft ? 'Your stack' : 'Back a builder, together.'}</h1>
        {record && <StackCard record={record} onOpen={open} />}
        {draft && (
          <button type="button" className="home-card" onClick={open}>
            <span className="home-card-top">
              <span className="home-card-for">Backing <strong>{draft.maintainerName.split(' ')[0]}</strong></span>
              <span className="home-card-state">Setting up</span>
            </span>
            <span className="home-card-foot"><span>{viewer.id === ORGANIZER || viewer.id === MAINTAINER ? 'Finish setting it up' : 'Not open yet'}</span>
              <span className="home-open">Open<Icon name="chevron" /></span></span>
          </button>
        )}
        <nav className="home-actions" aria-label="Actions">
          <button type="button" className="home-action" data-variant="primary" onClick={start}>
            <span className="home-action-icon" aria-hidden="true"><Icon name="nib" /></span>Start a stack
          </button>
          <button type="button" className="home-action" onClick={() => { setProblem(''); setJoining(true); }}>
            <span className="home-action-icon" aria-hidden="true"><Icon name="pleb" /></span>Join a stack
          </button>
          <Link className="home-action" to={paths.stage(stackId)}>
            <span className="home-action-icon" aria-hidden="true"><Icon name="ring" /></span>Watch live
          </Link>
        </nav>
        <Link className="home-how" to={paths.intro(1)}>How it works<Icon name="chevron" /></Link>
      </main>
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
