import { useRef, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { people } from '../demo/world';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, usePlayAs, useSession } from '../session';
import { Brand, TestMint, useHeadingFocus, useTitle } from '../ui/Frame';
import { Quiet } from '../ui/parts';
import { StoryStack, type Scene } from '../ui/StoryStack';

const maintainer = people[MAINTAINER].short;

// One animated stack across the three pages, each playing its part of the story: it fills, it pays, or it goes back.
const pages: { title: string; text: string; scene: Scene }[] = [
  { title: 'Chip in together.', scene: 'fill',
    text: 'Three people lock 21 sats each for a builder. Nobody else holds your key.' },
  { title: 'Everyone signs. One payout.', scene: 'pay',
    text: `All three sign, and ${maintainer} gets 63 sats in one payment.` },
  { title: 'Not filled? Take yours back.', scene: 'back',
    text: 'Worst case, you take your 21 sats back. Nobody else can move them.' },
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
        <p className="dots">
          <span className="visually-hidden">Page {page} of {pages.length}</span>
          {pages.map((_, index) => <span key={index} aria-hidden="true" data-on={index === page - 1 || undefined} data-done={index < page - 1 || undefined} />)}
        </p>
      </header>
      <main ref={main} className="intro-body">
        <div className="lead rise" key={`words-${page}`}>
          <h1 className="display">{current.title}</h1>
          <p>{current.text}</p>
        </div>
        <div className="intro-art" key={`art-${page}`}><StoryStack scene={current.scene} maintainer={maintainer} /></div>
      </main>
      <footer className="actions intro-actions">
        <button type="button" className="button" data-variant="primary"
          onClick={() => (last ? start() : navigate(paths.intro(page + 1)))}>
          {last ? 'Start a stack' : 'Next'}
        </button>
        {!last && <Quiet onClick={() => home()}>Skip the intro</Quiet>}
        {last && <button type="button" className="button" data-variant="secondary" onClick={() => home(true)}>Join with a link</button>}
      </footer>
    </div>
  );
}
