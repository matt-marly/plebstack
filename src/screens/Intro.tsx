import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { findCampaign, statusOf } from '../demo/world';
import { paths } from '../routes';
import { ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { PLEBS } from '../ui/journey';
import { Brand, useTitle } from '../ui/Frame';
import { Slab } from '../ui/Slab';

function ChipIn() {
  return (
    <svg className="art" viewBox="0 0 340 200" aria-hidden="true" focusable="false">
      <polygon points="30,172 290,172 330,150 70,150" fill="#16161a" stroke="#3a3a40" strokeWidth="1.5" />
      <Slab x={70} y={108} width={170} height={36} depth={[28, 16]} tone="ink" outlined className="art-drop" />
      <rect x="276" y="62" width="46" height="46" rx="13" fill="#16161a" stroke="#3a3a40" strokeWidth="1.5" />
      <svg x="287" y="73" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4f4f1" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 9a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7M11.5 12.5H20M17 12.5V15.5M20 12.5V15" />
      </svg>
      <text x="299" y="128" textAnchor="middle" className="art-label">your key</text>
      <text x="44" y="194" className="art-label">the mint</text>
    </svg>
  );
}

function Nib({ x, y }: { x: number; y: number }) {
  return (
    <svg x={x} y={y} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0b0b0c" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L18 9L15.5 17H8.5L6 9ZM12 3V11" />
    </svg>
  );
}

function Signs() {
  const slabs = [[100, 160], [124, 114], [92, 68]];
  return (
    <svg className="art" viewBox="0 0 340 210" aria-hidden="true" focusable="false">
      <text x="84" y="18" className="art-label mono">3 of 3 signed</text>
      <polygon points="66,48 290,48 322,30 98,30" fill="rgba(244,244,241,.05)" stroke="#f4f4f1" strokeWidth="1.5" />
      {slabs.map(([x, y], index) => (
        <g key={y}>
          <Slab x={x} y={y} width={170} height={36} depth={[30, 16]} tone="signed" className="art-drop"
            style={{ animationDelay: `${index * 90}ms` }} />
          <Nib x={x + 134} y={y + 8} />
        </g>
      ))}
    </svg>
  );
}

// Before any payout there is no lime: the filled pile is ink.
function OnePayout() {
  const pile = (x: number, tone: 'ink' | 'outline') => [[x + 10, 146], [x + 22, 108], [x, 70]].map(([sx, sy]) => (
    <Slab key={sy} x={sx} y={sy} width={104} height={26} depth={[26, 14]} tone={tone} />
  ));
  return (
    <svg className="art" viewBox="0 0 340 220" aria-hidden="true" focusable="false">
      {pile(10, 'ink')}
      <line x1="170" y1="40" x2="170" y2="214" stroke="#2a2a2e" strokeWidth="1" />
      {pile(184, 'outline')}
      <text x="12" y="196" className="art-label" data-strong>Everyone signed</text>
      <text x="12" y="214" className="art-label">one payout</text>
      <text x="186" y="196" className="art-label" data-strong>Didn’t fill</text>
      <text x="186" y="214" className="art-label">each takes theirs back</text>
    </svg>
  );
}

const pages = [
  { art: ChipIn, title: 'Chip in. Only you can move your sats.',
    text: 'Your sats wait at a Cashu mint, locked to a key made in this browser. Nobody else holds your key.' },
  { art: Signs, title: 'Everyone signs, or nothing moves.',
    text: 'Like a group card: the payout only counts when every pleb has signed it.' },
  { art: OnePayout, title: 'One payout, or everyone gets theirs back.',
    text: 'If it fills, the maintainer is paid in one go. If not, each pleb takes back their own.' },
];

export function Intro() {
  const { world, stackId, viewer, finishIntro } = useSession();
  const navigate = useNavigate();
  const playAs = usePlayAs();
  const page = Number(useParams().page);
  const current = pages[page - 1];
  useTitle(current?.title ?? 'How it works');
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
  const Art = current.art;
  return (
    <div className="screen intro">
      <header className="top-bar">
        <Brand />
        <span className="mono muted small" aria-label={`Page ${page} of ${pages.length}`}>{page} / {pages.length}</span>
      </header>
      <main className="body intro-body" key={page}>
        <Art />
        <div className="lead rise">
          <h1>{current.title}</h1>
          <p>{current.text}</p>
        </div>
        <div className="dots" aria-hidden="true">
          {pages.map((_, index) => <span key={index} data-on={index === page - 1 || undefined} />)}
        </div>
      </main>
      <footer className="actions">
        <button type="button" className="button" data-variant="primary"
          onClick={() => (last ? start() : navigate(paths.intro(page + 1)))}>
          {last ? 'Start a stack' : 'Next'}
        </button>
        {!last && <button type="button" className="button" data-variant="quiet" onClick={() => navigate(paths.intro(pages.length))}>Skip</button>}
        {last && joinable && <button type="button" className="button" data-variant="quiet" onClick={join}>I have an invite link</button>}
      </footer>
    </div>
  );
}
