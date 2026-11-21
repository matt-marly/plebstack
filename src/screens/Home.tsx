import { Link } from 'react-router-dom';
import { useStore } from '../demo/store';
import { MAIN_CAMPAIGN, headline, progressLine, roleLine, sats, tally } from '../demo/world';
import { confirmedStates, stateCopy } from '../domain/states';
import type { MoneyState } from '../domain/models';
import { paths } from '../routes';
import { Icon } from '../ui/Icon';
import { PageHead, Section, useTitle } from '../ui/parts';

const steps = [
  {
    title: 'Deposit',
    text: 'You pay a 21-sat invoice. The mint holds the sats, locked to a key that never leaves your browser. The organizer can’t move them, and the creator hasn’t been paid.',
  },
  {
    title: 'Approve',
    text: 'Once all three deposits are in, each backer checks the same payout (amount, creator key, mint) and signs it. A released signature can’t be taken back.',
  },
  {
    title: 'Pay out',
    text: 'The third signature sends one batch to the mint. It issues all 63 sats to the creator’s key at once, or nothing.',
  },
  {
    title: 'Or take yours back',
    text: 'Until the mint pays out, you can claim your own deposit as ecash in your own wallet. If you already approved, the payout may get there first.',
  },
];

const limits = [
  'Taking a deposit back is not a Lightning refund. You get ecash at the same mint.',
  'Deposits sit at the mint. If the mint fails, they’re lost.',
  'Nothing enforces a deadline. A campaign is unmet when its organizer stops collecting or a backer takes a deposit back.',
  'Nobody checks that the work gets done. The public link is all a campaign claims.',
  'This prototype uses fake sats on a test mint and keeps no backup of keys.',
];

const words = Object.entries(stateCopy) as [MoneyState, (typeof stateCopy)[MoneyState]][];

export function Home() {
  useTitle('Campaigns');
  const { world } = useStore();

  return (
    <>
      <PageHead title="Three backers pay one maintainer together, or not at all.">
        <p>
          Each backer puts 21 sats at a mint, locked to their own key. The maintainer is paid in one 63-sat payment,
          and only after all three approve it. Until then, any backer can take their own deposit back.
        </p>
        <div className="actions head-actions">
          <Link className="button" data-variant="primary" to={paths.campaign(MAIN_CAMPAIGN)}>Open the example campaign</Link>
          <Link className="button" to={paths.create()}>Start a campaign</Link>
        </div>
      </PageHead>

      <Section label="Campaigns">
        <ul className="index" role="list">
          {world.campaigns.map(record => {
            const head = headline(record);
            const { heldSat, targetSat } = tally(record);
            const confirmed = confirmedStates.includes(head.state as MoneyState);
            return (
              <li key={record.campaign.id}>
                <p className="index-title"><Link to={paths.campaign(record.campaign.id)}>{record.campaign.title}</Link></p>
                <p className="index-sum">{head.state === 'paid' ? sats(targetSat) : `${heldSat} of ${sats(targetSat)}`}</p>
                <p className="index-state" data-confirmed={confirmed || undefined}>
                  <Icon name={head.icon} size={18} />
                  <strong>{head.word}</strong>
                  <span>{progressLine(record)}</span>
                </p>
                <p className="index-role">{roleLine(world, record)}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section label="Who holds what">
        <ol className="steps" role="list">
          {steps.map(step => (
            <li key={step.title}>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section label="Seven words">
        <div className="stack">
          <p>Money here is always in one of seven states, each with one word and one sentence. Only the two the mint has confirmed are shown in green.</p>
          <ul className="words" role="list">
            {words.map(([state, copy]) => (
              <li key={state} data-confirmed={confirmedStates.includes(state) || undefined}>
                <Icon name={copy.icon} size={22} />
                <strong>{copy.word}</strong>
                <span className="words-sentence">{copy.sentence}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section label="Not promised">
        <ul className="plain-list" role="list">
          {limits.map(limit => <li key={limit}>{limit}</li>)}
        </ul>
      </Section>
    </>
  );
}
