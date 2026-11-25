import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
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

// Not real money, on every screen. It reports, so it never looks like a control.
export function TestMint() {
  return <span className="env">Test mint · fake sats</span>;
}

export interface BackTo {
  to: string;
  label: string;
}

const roles: Record<string, [string, string]> = { [ORGANIZER]: ['the', 'organizer'], [MAINTAINER]: ['the', 'maintainer'] };

// Where am I, who am I, and what's next. A paragraph, not a heading: the screen's one h1 says what happened.
export function StepHeader({ rail, here, back, lighting }: { rail: Rail; here: Here; back?: BackTo; lighting?: boolean }) {
  const { viewer } = useSession();
  const [article, role] = roles[viewer.id] ?? ['a', 'pleb'];
  return (
    <div className="step-head">
      <div className="step-top">
        <p className="step-name">
          {back && <Link className="back" to={back.to} aria-label={`Back to ${back.label}`}><Icon name="back" /></Link>}
          {here.name}
        </p>
        <p className="step-count">Step {rail.at + 1} of 4</p>
      </div>
      <GoalRail {...rail} lighting={lighting} />
      <p className="step-next">
        You’re {article} <strong>{role}</strong>. {here.end ? <strong>{here.next}</strong> : <>Next: <strong>{here.next}</strong></>}
      </p>
    </div>
  );
}

function plebContext(world: World, record: CampaignRecord): ReallyContext {
  const { step, screen } = journeyOf(world, record);
  return reallyContext({ role: 'pleb', at: screen, step, record, viewerId: world.viewerId });
}

// Every screen: the brand bar, the two honest helpers, the step header, one job, the action pinned at the bottom.
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
        <div className="top-bar">
          <Brand />
          <TestMint />
        </div>
        <div className="helpers">
          <PlayingAs record={record} />
          <Really context={really ?? plebContext(world, record!)} />
        </div>
        <StepHeader rail={rail} here={here} back={back} lighting={moment} />
      </header>
      <main ref={main} className="body" id="main">{children}</main>
      <footer className="actions">{actions}</footer>
    </div>
  );
}
