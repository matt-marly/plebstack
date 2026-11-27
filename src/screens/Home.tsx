import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findCampaign, maintainerOf, people, sats, slotOf, statusOf, tally } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { TopBar, useHeadingFocus, useTitle } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { PLEBS, campaignGoal, closeLine } from '../ui/journey';
import { StoryStack } from '../ui/StoryStack';
import { Stack } from '../ui/Stack';
import { Sheet } from '../ui/Sheet';
import { Avatar } from '../ui/parts';
import { fixing } from '../ui/Who';

// The money state, said in two words and coloured from the state tokens.
const stateWord: Record<string, string> = {
  collecting: 'Collecting', ready: 'Ready to sign', approved: 'Signed', 'paying-out': 'Sending', paid: 'Paid',
  unmet: 'Didn’t fill', reclaiming: 'Taking back', reclaimed: 'Taken back',
};

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
      Join with a link
    </button>
  );
  const { heldSat = 0, targetSat = 63, held = 0 } = record ? tally(record) : {};
  const maintainer = record ? maintainerOf(record).short : draft?.maintainerName.split(' ')[0];
  const state = record ? statusOf(record) : undefined;
  // The organizer's setup as a flow: each step says who does it and what it means, done ones ticked, the next one lit.
  const who = maintainer ?? 'them';
  // The same four steps from either side: the organizer's "You" is the maintainer's "Ada", and the other way round.
  const herself = viewer.id === MAINTAINER;
  const organizerName = draft ? people[draft.organizerId]?.short ?? 'The organizer' : '';
  const me = (isOrganizerStep: boolean) => (isOrganizerStep === !herself ? 'You' : isOrganizerStep ? organizerName : who);
  const setup = draft ? [
    { label: herself ? `${organizerName} names you and the work` : `Name who you’re backing`, by: me(true), note: `${draft.maintainerName} · ${fixing(draft.title)}`, done: true },
    { label: herself ? 'Confirm your payout key' : `${who} confirms her payout key`, by: me(false),
      note: draft.key ? 'Confirmed on her own phone' : 'Only she can spend what lands', done: Boolean(draft.key) },
    { label: 'Set the amount and deadline', by: me(true), note: '3 people chip in the same amount', done: false },
    { label: 'Share the invite', by: me(true), note: 'A link and a QR code to send', done: false },
  ] : [];
  const nextSetup = setup.findIndex(item => !item.done);
  const doneCount = setup.filter(item => item.done).length;
  const organizing = viewer.id === ORGANIZER || viewer.id === MAINTAINER;

  return (
    <div className="screen home">
      <header className="top">
        <TopBar record={record} />
      </header>
      <main ref={main} className="home-body" id="main">
        {record ? (
          <section className="home-panel" aria-labelledby="home-title">
            <div className="home-panel-top">
              <p className="home-eyebrow">Backing <strong>{maintainer}</strong></p>
              <span className="state-pill" data-state={state} data-paid={state === 'paid' || undefined}>{stateWord[state!] ?? state}</span>
            </div>
            <h1 id="home-title" className="home-title">
              {state === 'paid' ? `${maintainer} got ${sats(targetSat)}` : `${held} of ${record.campaign.backerCount} in`}
            </h1>
            <p className="home-sub">{state === 'paid' ? 'Confirmed by the mint.' : `${heldSat} of ${sats(targetSat)} locked at the mint`}</p>
            <div className="home-hero"><Stack goal={campaignGoal(record, viewer.id)} meta={closeLine(record)} landing /></div>
          </section>
        ) : draft ? (
          <section className="home-panel setup" aria-labelledby="home-title">
            <div className="home-panel-top">
              <p className="setup-role">
                <Avatar name={herself ? who : viewer.short} own />
                <span>You’re <strong>{herself ? who : viewer.short}</strong>{viewer.id === ORGANIZER ? ', the organizer' : herself ? ', the one being backed' : ''}</span>
              </p>
              <span className="state-pill" data-state="setup">Setting up</span>
            </div>
            <h1 id="home-title" className="home-title">{herself ? 'A stack for you' : organizing ? `A stack for ${who}` : 'Not open yet'}</h1>
            <p className="home-sub">{herself
              ? `${organizerName} is gathering 3 people to back you. The payout can only go to your key.`
              : organizing ? `You gather 3 people to back ${who}. You never hold a key or a sat.`
                : 'It opens once the organizer shares it.'}</p>
            {organizing && (
              <>
                <div className="setup-progress" aria-hidden="true">
                  {setup.map((item, index) => <i key={item.label} data-state={item.done ? 'done' : index === nextSetup ? 'now' : 'ahead'} />)}
                </div>
                <p className="visually-hidden">{doneCount} of {setup.length} steps done</p>
                <ol className="flow">
                  {setup.map((item, index) => {
                    const state = item.done ? 'done' : index === nextSetup ? 'now' : 'ahead';
                    return (
                      <li key={item.label} data-state={state}>
                        <span className="flow-node" aria-hidden="true">{item.done ? <Icon name="check" /> : index + 1}</span>
                        <span className="flow-text">
                          <span className="flow-label">{item.label}</span>
                          <span className="flow-note">{item.note}</span>
                        </span>
                        <span className="flow-by" data-you={item.by === 'You' || undefined}>{item.by}</span>
                        <span className="visually-hidden">{state === 'done' ? ', done' : state === 'now' ? ', next' : ', to come'}</span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        ) : (
          <>
            <h1 className="home-title home-title-lead">Back a builder, together.</h1>
            <StoryStack scene="all" />
          </>
        )}
      </main>
      <footer className="actions home-actions">
        {record || draft ? (
          <button type="button" className="button" data-variant="primary" onClick={open}>
            {draft ? (herself ? (draft.key ? 'Open stack' : 'Confirm my key') : organizing ? (draft.key ? 'Next: set the terms' : `Next: get ${who}’s key`) : 'Open stack') : 'Open stack'}<Icon name="chevron" />
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
          <button type="submit" className="button" data-variant="primary">Open invite</button>
        </form>
      </Sheet>
    </div>
  );
}
