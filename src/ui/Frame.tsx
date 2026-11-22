import { useEffect, type ReactNode } from 'react';
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

export function Brand() {
  return (
    <span className="brand">
      <Mark className="brand-mark" />
      <Wordmark className="brand-word" />
    </span>
  );
}

export function TestMint() {
  return <span className="pill"><span className="pill-dot" aria-hidden="true" />Test mint</span>;
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
  return (
    <div className="screen" data-moment={moment || undefined}>
      <header className="top">
        <div className="top-bar">
          <Brand />
          <TestMint />
        </div>
        <GoalRail {...rail} lighting={moment} />
        <div className="helpers">
          <Really facts={facts ?? (record ? plebFacts(record) : [])} />
          <PlayingAs record={record} />
        </div>
      </header>
      <main className="body" id="main">{children}</main>
      {actions && <footer className="actions">{actions}</footer>}
    </div>
  );
}
