import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { maintainerOf, sats, type CampaignRecord } from '../demo/world';
import { GoalRail } from './GoalRail';
import type { Rail } from './journey';
import { Mark, Wordmark } from './Mark';
import { PlayingAs } from './PlayingAs';
import { Really, reallyFacts, type Fact } from './Really';

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

export function plebFacts(record: CampaignRecord): Fact[] {
  const { contributionSat, backerCount } = record.campaign;
  return reallyFacts(maintainerOf(record).short, sats(contributionSat), sats(contributionSat * backerCount));
}

// Every screen: header, the rail, the two honest helpers, one job, the action pinned at the bottom.
export function Frame({ record, rail, title, children, actions, moment, facts }: {
  record?: CampaignRecord; rail: Rail; title: string; children: ReactNode; actions?: ReactNode; moment?: boolean; facts?: Fact[];
}) {
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
        <GoalRail {...rail} lighting={moment} />
        <div className="helpers">
          <PlayingAs record={record} />
          <Really facts={facts ?? (record ? plebFacts(record) : [])} />
        </div>
      </header>
      <main ref={main} className="body" id="main">{children}</main>
      {actions && <footer className="actions">{actions}</footer>}
    </div>
  );
}
