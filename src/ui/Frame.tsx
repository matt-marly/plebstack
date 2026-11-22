import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { people, sats, type CampaignRecord } from '../demo/world';
import { paths } from '../routes';
import { GoalRail } from './GoalRail';
import type { Rail } from './journey';
import { Mark, Wordmark } from './Mark';
import { PlayingAs } from './PlayingAs';
import { Really } from './Really';

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

// Every journey screen: header, the rail, the two honest helpers, one job, the action pinned at the bottom.
export function Frame({ record, rail, title, children, actions, moment }: {
  record: CampaignRecord; rail: Rail; title: string; children: ReactNode; actions?: ReactNode; moment?: boolean;
}) {
  const navigate = useNavigate();
  const { campaign } = record;
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
          <Really maintainer={people[record.creatorId].short} each={sats(campaign.contributionSat)}
            total={sats(campaign.contributionSat * campaign.backerCount)} />
          <PlayingAs record={record} onFresh={id => navigate(paths.stack(id))} />
        </div>
      </header>
      <main className="body" id="main">{children}</main>
      {actions && <footer className="actions">{actions}</footer>}
    </div>
  );
}
