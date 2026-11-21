import { Link } from 'react-router-dom';
import { useStore } from '../demo/store';
import { DEPOSIT_SAT, MAIN_CAMPAIGN, headline, people, progressLine, roleLine, sats, tally } from '../demo/world';
import { confirmedStates, signalStates, stateCopy } from '../domain/states';
import type { MoneyState } from '../domain/models';
import { paths } from '../routes';
import { Icon } from '../ui/Icon';
import { PageHead, Section, useTitle } from '../ui/parts';

const steps = [
  {
    title: 'Stack',
    text: 'You pay a 21-sat invoice. The sats wait at the mint, locked to a key made in your browser. Nobody holds your keys but you. Not us, not the organizer. Nothing is paid to the maintainer yet.',
  },
  {
    title: 'Sign',
    text: 'When all three deposits are in, each pleb checks the same 63-sat outputs (amount, maintainer key, mint) and signs. All three have to sign. A signature can’t be taken back.',
  },
  {
    title: 'Pay out',
    text: 'The third signature sends one batch to the mint. The mint issues all 63 sats as ecash locked to the maintainer’s key, or nothing. Paid only when the mint confirms.',
  },
  {
    title: 'Or take yours back',
    text: 'Until the payout is issued, you can mint your own 21 sats back into your own outputs. If you already signed, the payout may get there first.',
  },
];

const limits = [
  'Taking your sats back gives you ecash at the same mint, not sats over Lightning.',
  'Deposits sit at the mint, locked to each backer’s key. The mint holds them: if it fails, they’re lost.',
  'No deadline. Nothing expires a signature, and nothing releases a reclaim on a timer. A campaign is unmet when its organizer stops collecting or a pleb takes their sats back.',
  'Paid means the maintainer received ecash, not that the work was done. The public link is all a campaign claims.',
  'Test mint, fake sats. Keys live in this browser and nothing backs them up.',
];

const words = Object.entries(stateCopy) as [MoneyState, (typeof stateCopy)[MoneyState]][];
const demoTerms = { maintainer: people.ngozi, amountSat: DEPOSIT_SAT };

export function Home() {
  useTitle('Campaigns');
  const { world } = useStore();

  return (
    <>
      <PageHead eyebrow="Stay humble, stack together." title="Three plebs pay one maintainer together, or not at all.">
        <p>Each deposit waits at the mint, locked to its owner’s key. The organizer never holds one.</p>
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
                <p className="index-state" data-confirmed={confirmed || undefined}
                  data-signal={signalStates.includes(head.state as MoneyState) || undefined}>
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
          <p>
            Sats here are always in one of seven states: a plain word, a pleb phrase, one sentence. Paid and Reclaimed
            show only once the mint confirms them, and only Paid is lit.
          </p>
          <ul className="words" role="list">
            {words.map(([state, copy]) => (
              <li key={state} data-confirmed={confirmedStates.includes(state) || undefined}
                data-signal={signalStates.includes(state) || undefined}>
                <Icon name={copy.icon} size={22} />
                <strong>{copy.word}</strong>
                <span className="words-sentence"><span className="words-phrase">{copy.phrase}</span>{copy.sentence(demoTerms)}</span>
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
