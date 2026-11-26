import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import type { CampaignRecord, World } from '../demo/world';
import { MAINTAINER, ORGANIZER, useSession } from '../session';
import { GoalRail } from './GoalRail';
import { Icon } from './Icon';
import { reallyContext, type ReallyContext } from './explain';
import { journeyOf, type Here, type Rail } from './journey';
import { Mark, Wordmark } from './Mark';
import { PlayingAs } from './PlayingAs';
import { Really } from './Really';
import { Sheet } from './Sheet';
import { paths } from '../routes';
import { TEST_MINT } from '../domain/models';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Plebstack`;
  }, [title]);
}

// A new step moves focus to its headline, so a screen reader hears the change whether a tap or the mint caused it.
export function useHeadingFocus(main: RefObject<HTMLElement | null>, step: unknown) {
  useEffect(() => {
    const heading = main.current?.querySelector<HTMLElement>('h1');
    if (!heading || document.querySelector('[role="dialog"]')) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [step]);
}

export function Brand() {
  return (
    <span className="brand">
      <Mark className="brand-mark" />
      <Wordmark className="brand-word" />
    </span>
  );
}

// Not real money, on every screen. A quiet pill; tap it for the mint and what "test" means.
export function TestMint() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="env" aria-label="Test mint: fake sats, about this mint" onClick={() => setOpen(true)}>
        <Icon name="flask" />Test mint
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Testnet">
        <p className="sheet-text">Every deposit, payout and take-back is a real Cashu request to a public test mint. The test mint pays its own invoices, so the sats are fake and nothing here is real money.</p>
        <dl className="facts-list">
          <div><dt>Mint</dt><dd className="mono">{TEST_MINT.replace('https://', '')}</dd></div>
          <div><dt>Unit</dt><dd>sats (fake)</dd></div>
          <div><dt>Protocol</dt><dd className="mono">NUT-20 · NUT-29 · NUT-11 · NUT-03</dd></div>
        </dl>
      </Sheet>
    </>
  );
}

// The bar on every screen: the brand on the left, the network and who you are on the right.
export function TopBar({ record }: { record?: CampaignRecord }) {
  return (
    <div className="top-bar">
      <Brand />
      <div className="top-tools">
        <TestMint />
        <PlayingAs record={record} />
      </div>
    </div>
  );
}

export interface BackTo {
  to: string;
  label: string;
}

const roles: Record<string, [string, string]> = { [ORGANIZER]: ['the', 'organizer'], [MAINTAINER]: ['the', 'maintainer'] };

// Where am I and how far along: the step's name, a slim rail, and the info button for the rest.
export function StepHeader({ rail, here, back, lighting, really }: {
  rail: Rail; here: Here; back?: BackTo; lighting?: boolean; really: ReallyContext;
}) {
  const { viewer } = useSession();
  const [article, role] = roles[viewer.id] ?? ['a', 'pleb'];
  return (
    <div className="step-head">
      <div className="step-top">
        <p className="step-name">
          {back && <Link className="back" to={back.to} aria-label={`Back to ${back.label}`}><Icon name="back" /></Link>}
          {here.name}
          <span className="step-count">{rail.at + 1}/4</span>
        </p>
        <Really context={really} />
      </div>
      <GoalRail {...rail} lighting={lighting} slim />
      <p className="step-next visually-hidden">
        You’re {article} {role}. {here.end ? here.next : <>Next: {here.next}</>}
      </p>
    </div>
  );
}

function plebContext(world: World, record: CampaignRecord): ReallyContext {
  const { step, screen } = journeyOf(world, record);
  return reallyContext({ role: 'pleb', at: screen, step, record, viewerId: world.viewerId });
}

// Every screen: the top bar, the step header, one job, the action pinned at the bottom.
// The organizer's and the maintainer's screens say where they are; a pleb's is read from their own step.
export function Frame({ record, rail, here, back, title, children, actions, moment, really }: {
  record?: CampaignRecord; rail: Rail; here: Here; back?: BackTo; title: string; children: ReactNode; actions?: ReactNode;
  moment?: boolean; really?: ReallyContext;
}) {
  const { world } = useSession();
  useTitle(title);
  const main = useRef<HTMLElement>(null);
  useHeadingFocus(main, title);
  return (
    <div className="screen" data-moment={moment || undefined}>
      <header className="top">
        <TopBar record={record} />
        <StepHeader rail={rail} here={here} back={back ?? { to: paths.home(), label: 'home' }} lighting={moment}
          really={really ?? plebContext(world, record!)} />
      </header>
      <main ref={main} className="body" id="main">{children}</main>
      <footer className="actions">{actions}</footer>
    </div>
  );
}
