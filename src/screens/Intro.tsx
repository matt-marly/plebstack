import { useRef, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { people } from '../demo/world';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, usePlayAs, useSession } from '../session';
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

const pages: { title: string; text: string; art: ReactNode }[] = [
  { title: 'Back the people who build your tools.',
    text: 'Three plebs chip in 21 sats each. Your sats wait at the mint, locked to your key. Nobody else holds your key.',
    art: <Track stop="at-mint" from="wallet" maintainer={maintainer} amount="21 sats" /> },
  { title: 'All three sign. One payout.',
    text: `${maintainer} gets 63 sats in one batch, locked to her key, and only once the mint confirms.`,
    art: <><Stack goal={full} /><p className="intro-caption mono">signed 3 of 3 · one batch to {maintainer}</p></> },
  { title: 'Not filled? Everyone takes theirs back.',
    text: 'No payout, no penalty. Only you can move your sats.',
    art: <Track stop="to-you" from="at-mint" maintainer={maintainer} amount="21 sats" /> },
];

export function Intro() {
  const { finishIntro } = useSession();
  const navigate = useNavigate();
  const playAs = usePlayAs();
  const page = Number(useParams().page);
  const current = pages[page - 1];
  useTitle(current?.title ?? 'How it works');
  const main = useRef<HTMLElement>(null);
  useHeadingFocus(main, page);
  if (!current) return <Navigate to={paths.splash()} replace />;

  const last = page === pages.length;
  const start = () => {
    finishIntro();
    playAs(ORGANIZER, paths.start());
  };
  const home = (join = false) => {
    finishIntro();
    navigate(paths.home(), { state: { join } });
  };
  return (
    <div className="screen intro">
      <header className="top-bar">
        <Brand />
        <TestMint />
      </header>
      <main ref={main} className="body" key={page}>
        <div className="lead rise">
          <h1 className="display">{current.title}</h1>
          <p>{current.text}</p>
        </div>
        <div className="intro-art" aria-hidden="true">{current.art}</div>
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
        {!last && <Quiet onClick={() => home()}>Skip the intro</Quiet>}
        {last && <button type="button" className="button" data-variant="secondary" onClick={() => home(true)}>I have an invite link</button>}
      </footer>
    </div>
  );
}
