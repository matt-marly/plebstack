import { useRef, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { people } from '../demo/world';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, usePlayAs, useSession } from '../session';
import { PLEBS, type Goal } from '../ui/journey';
import { Brand, TestMint, useHeadingFocus, useTitle } from '../ui/Frame';
import { Quiet } from '../ui/parts';
import { Stack } from '../ui/Stack';

const maintainer = people[MAINTAINER].short;

// One picture across all three pages: the same stack, filling, full, and handed back. Never lime: nothing is paid.
const goals: Goal[] = [
  { phase: 'collecting', label: 'goal · 21 of 63 sats', text: '',
    slabs: [{ kind: 'filled', name: 'You', own: true }, { kind: 'open' }, { kind: 'open' }] },
  { phase: 'at-line', label: 'at the line · 63 of 63 sats', text: '',
    slabs: PLEBS.map(pleb => ({ kind: 'filled', name: people[pleb].short })) },
  { phase: 'unmet', label: 'didn’t fill · each takes theirs back', text: '',
    slabs: [{ kind: 'reclaimed', name: 'You', own: true }, { kind: 'filled', name: people[PLEBS[1]].short }, { kind: 'open' }] },
];

const pages: { title: string; text: string }[] = [
  { title: 'Chip in together.',
    text: 'Three people put in 21 sats each for someone who builds the tools you use. Your sats wait at the mint, locked to your key. Nobody else holds your key.' },
  { title: 'Everyone signs. One payout.',
    text: `When all three sign, ${maintainer} gets 63 sats in one go, and only once the mint confirms.` },
  { title: 'Not filled? You get yours back.',
    text: 'Worst case, you take your own 21 sats back. Nobody else can move them.' },
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
      <header className="top">
        <div className="top-bar"><Brand /><TestMint /></div>
      </header>
      <main ref={main} className="intro-body">
        <div className="intro-art" aria-hidden="true" key={`art-${page}`}><Stack goal={goals[page - 1]} landing /></div>
        <div className="lead rise" key={`words-${page}`}>
          <h1 className="display">{current.title}</h1>
          <p>{current.text}</p>
        </div>
      </main>
      <footer className="actions intro-actions">
        <p className="dots">
          <span className="visually-hidden">Page {page} of {pages.length}</span>
          {pages.map((_, index) => <span key={index} aria-hidden="true" data-on={index === page - 1 || undefined} />)}
        </p>
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
