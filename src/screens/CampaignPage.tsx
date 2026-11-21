import { headline, people, progressLine, sats } from '../demo/world';
import { confirmedStates } from '../domain/states';
import type { MoneyState } from '../domain/models';
import { paths } from '../routes';
import { ContributionGroup } from '../ui/ContributionGroup';
import { NextStep } from '../ui/NextStep';
import { Fact, Facts, KeyText, PageHead, RecordList, Section, StateBlock, useTitle } from '../ui/parts';
import { Missing, useRecord } from './shared';

export function CampaignPage() {
  const { viewer, record } = useRecord();
  useTitle(record?.campaign.title ?? 'Not found');
  if (!record) return <Missing what="campaign" />;

  const { campaign } = record;
  const creator = people[record.creatorId];
  const head = headline(record);
  const total = campaign.contributionSat * campaign.backerCount;

  return (
    <>
      <PageHead
        back={{ to: paths.home(), label: 'Campaigns' }}
        eyebrow={record.project ? `For ${creator.name}, maintainer of ${record.project}` : `For ${creator.name}`}
        title={campaign.title}
      >
        <p>
          Three backers deposit {sats(campaign.contributionSat)} each. {creator.short} is paid {sats(total)} in one
          payment once all three approve, or not at all.
        </p>
      </PageHead>

      <Section label="Status">
        <div className="stack" data-gap="large">
          <StateBlock icon={head.icon} word={head.word} sentence={head.sentence}
            confirmed={confirmedStates.includes(head.state as MoneyState)}>
            <p className="state-meta">{progressLine(record)}</p>
          </StateBlock>
          <NextStep record={record} />
        </div>
      </Section>

      <Section label="Contributions">
        <ContributionGroup record={record} viewerId={viewer.id} />
      </Section>

      <Section label="Terms">
        <Facts>
          <Fact label="Public work">
            <span className="link-alone"><a href={campaign.publicWorkUrl} rel="noreferrer">{record.workLabel ?? 'Open the link'}</a></span>
            <span className="muted small wrap-anywhere"> {campaign.publicWorkUrl.replace(/^https?:\/\//, '')}</span>
          </Fact>
          <Fact label="Pays to">
            <p>{creator.name}{creator.id === viewer.id && <span className="muted"> (you)</span>}</p>
            <KeyText value={campaign.beneficiaryPubkey} label="key" />
          </Fact>
          <Fact label="Mint">
            <span className="mono">{campaign.mint}</span>
            <p className="muted small">A test mint. It holds every deposit until payout or reclaim.</p>
          </Fact>
          <Fact label="Rule">
            Three deposits of {sats(campaign.contributionSat)}, each locked to its backer. One payment of {sats(total)},
            or none.
          </Fact>
        </Facts>
      </Section>

      <Section label="Record">
        <RecordList entries={record.log} />
      </Section>
    </>
  );
}
