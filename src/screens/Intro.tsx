import { useRef, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { findCampaign, people, statusOf } from '../demo/world';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { Cast } from '../ui/Cast';
import { PLEBS, type Goal } from '../ui/journey';
import { Brand, TestMint, useHeadingFocus, useTitle } from '../ui/Frame';
import { Quiet } from '../ui/parts';
import { Stack } from '../ui/Stack';
import { Track } from '../ui/Track';

const maintainer = people[MAINTAINER].short;

// The goal the moment all three are in: solid ink at the line, never lime, since nothing is paid yet.
const full: Goal = {
  phase: 'at-line', label: 'at the line · 63 of 63 sats', text: '',
  slabs: PLEBS.map(pleb => ({ kind: 'filled', name: people[pleb].short })),
};

const pages: { title: string; text: string; art: ReactNode; more?: ReactNode }[] = [
  { title: 'Chip in 21 sats. It waits at the mint, locked to your key.',
    text: 'Three plebs back one maintainer. Your 21 sats wait at a Cashu mint, locked to a key made in this browser. Nobody else holds your key.',
    art: <Track stop="at-mint" from="wallet" maintainer={maintainer} amount="21 sats" /> },
  { title: 'When all three sign, one payment goes to the maintainer.',
    text: `Each pleb checks the payout and signs. The last signature sends 63 sats to ${maintainer} in one batch, locked to her key. It’s paid only when the mint confirms.`,
    art: <><Stack goal={full} /><p className="intro-caption mono">signed 3 of 3 · one batch to {maintainer}</p></> },
  { title: 'If it doesn’t fill, everyone takes their own back.',
    text: 'No payout and no penalty. Each pleb asks the mint for their own 21 sats. The organizer can’t move anyone’s sats.',
    art: <Track stop="to-you" from="at-mint" maintainer={maintainer} amount="21 sats" />,
    more: <><Cast /><p className="intro-note">One browser plays everyone. Switch with Playing as.</p></> },
];

export function Intro() {
  const { world, stackId, viewer, finishIntro } = useSession();
  const navigate = useNavigate();
  const playAs = usePlayAs();
  const page = Number(useParams().page);
  const current = pages[page - 1];
  useTitle(current?.title ?? 'How it works');
  const main = useRef<HTMLElement>(null);
  useHeadingFocus(main, page);
  if (!current) return <Navigate to={paths.splash()} replace />;

  const last = page === pages.length;
  // An invite only makes sense if there is a stack still collecting in this browser.
  const invite = stackId && findCampaign(world, stackId);
  const joinable = invite && statusOf(invite) === 'collecting' ? invite : undefined;
  const start = () => {
    finishIntro();
    playAs(ORGANIZER, paths.start());
  };
  const join = () => {
    finishIntro();
    const pleb = (PLEBS as readonly string[]).includes(viewer.id) ? viewer.id : PLEBS[0];
    playAs(pleb, homePath(pleb, joinable!.campaign.id));
  };
  return (
    <div className="screen intro">
      <header className="top-bar">
        <Brand />
        <TestMint />
      </header>
      <main ref={main} className="body" key={page}>
        <div className="intro-art" aria-hidden="true">{current.art}</div>
        <div className="lead rise">
          <h1>{current.title}</h1>
          <p>{current.text}</p>
        </div>
        {current.more}
        <p className="dots">
          <span className="visually-hidden">Page {page} of {pages.length}</span>
          {pages.map((_, index) => <span key={index} aria-hidden="true" data-on={index === page - 1 || undefined} />)}
        </p>
      </main>
      <footer className="actions">
        <button type="button" className="button" data-variant="primary"
          onClick={() => (last ? start() : navigate(paths.intro(page + 1)))}>
          {last ? 'Start a stack' : 'Next'}
        </button>
        {!last && <Quiet onClick={start}>Skip the intro</Quiet>}
        {last && joinable && <button type="button" className="button" data-variant="secondary" onClick={join}>I have an invite link</button>}
      </footer>
    </div>
  );
}
