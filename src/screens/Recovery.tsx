import { Link } from 'react-router-dom';
import { useStore } from '../demo/store';
import { checkMint, isPending, people, sats, type CampaignRecord, type SavedOperation, type World } from '../demo/world';
import { stateCopy } from '../domain/states';
import { paths } from '../routes';
import { formatWhen } from '../ui/format';
import { Icon } from '../ui/Icon';
import { PageHead, Section, useTitle } from '../ui/parts';

interface Entry {
  record: CampaignRecord;
  operation: SavedOperation;
  // Saved by this person's browser, or by someone else's while one of their deposits is in it.
  mine: boolean;
}

function entriesFor(world: World): Entry[] {
  return world.campaigns.flatMap(record => record.operations
    .filter(operation => operation.savedBy === world.viewerId
      || record.slots.some(slot => slot.backerId === world.viewerId && operation.slotIds.includes(slot.id)))
    .map(operation => ({ record, operation, mine: operation.savedBy === world.viewerId })))
    .sort((a, b) => b.operation.savedAt.localeCompare(a.operation.savedAt));
}

function name(operation: SavedOperation): string {
  return `${operation.kind === 'payout' ? 'Payout' : 'Reclaim'} of ${sats(operation.amountSat)}`;
}

function outcome(operation: SavedOperation): { icon?: string; text: string } {
  if (operation.status === 'confirmed') {
    const copy = operation.kind === 'payout' ? stateCopy.paid : stateCopy.reclaimed;
    return { icon: copy.icon, text: copy.sentence };
  }
  return {
    text: operation.kind === 'payout'
      ? 'Rejected by the mint; a deposit was reclaimed first. Nothing was paid.'
      : 'Rejected by the mint; the payout settled first.',
  };
}

export function Recovery() {
  useTitle('Recovery');
  const { world, apply } = useStore();
  const entries = entriesFor(world);
  const waiting = entries.filter(entry => isPending(entry.operation));
  const settled = entries.filter(entry => !isPending(entry.operation));

  return (
    <>
      <PageHead title="Recovery">
        <p>
          Every payout and reclaim is saved before it’s sent, so a dropped connection never decides where the money
          went. Ask the mint, and the saved request shows which outcome is real.
        </p>
      </PageHead>

      <Section label="Waiting on the mint">
        {waiting.length === 0 ? (
          <p>Nothing is waiting on the mint.</p>
        ) : (
          <ul className="operations" role="list">
            {waiting.map(({ record, operation, mine }) => {
              const copy = operation.kind === 'payout' ? stateCopy['paying out'] : stateCopy.reclaiming;
              return (
                <li key={operation.id} className="operation">
                  <h3>{name(operation)}</h3>
                  <p className="small link-alone">
                    <Link to={paths.campaign(record.campaign.id)}>{record.campaign.title}</Link>
                  </p>
                  <p className="operation-state"><Icon name={copy.icon} size={18} /><span>{copy.sentence}</span></p>
                  <p className="small muted">
                    Sent {formatWhen(operation.savedAt)}.{' '}
                    {operation.status === 'unresolved' ? 'The request timed out, so the result is unknown. ' : 'No result yet. '}
                    {mine ? 'Saved in this browser.' : `Saved in ${people[operation.savedBy].short}’s browser; you can still ask the mint.`}
                  </p>
                  <p className="small muted mono">{operation.id}</p>
                  <div className="actions">
                    <button type="button" className="button" data-variant={waiting.length === 1 ? 'primary' : undefined}
                      onClick={() => apply((current, at) => checkMint(current, record.campaign.id, at))}>
                      Check mint result
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section label="Settled">
        {settled.length === 0 ? (
          <p>No request has settled yet.</p>
        ) : (
          <ul className="operations" role="list">
            {settled.map(({ record, operation }) => {
              const result = outcome(operation);
              return (
                <li key={operation.id} className="operation" data-confirmed={result.icon ? true : undefined}>
                  <h3>{name(operation)}</h3>
                  <p className="small link-alone">
                    <Link to={paths.campaign(record.campaign.id)}>{record.campaign.title}</Link>
                  </p>
                  <p className="operation-state">
                    {result.icon && <Icon name={result.icon} size={18} />}
                    <span>{result.text}</span>
                  </p>
                  <p className="small muted">
                    {operation.settledAt && `Settled ${formatWhen(operation.settledAt)}. `}
                    <span className="mono">{operation.id}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section label="Not covered">
        <ul className="plain-list" role="list">
          <li>Keys and saved requests live only in the browser that made them. Clear its storage and an unpaid deposit can’t be recovered.</li>
          <li>A timed-out request is never assumed to have failed. It stays open until the mint has been asked.</li>
          <li>This prototype makes no backup and doesn’t survive a reload.</li>
        </ul>
      </Section>
    </>
  );
}
