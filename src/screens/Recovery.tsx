import { Link } from 'react-router-dom';
import { useStore } from '../demo/store';
import { checkMint, isPending, people, sats, stateSentence, type CampaignRecord, type SavedOperation, type World } from '../demo/world';
import { stateCopy } from '../domain/states';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { formatWhen } from '../ui/format';
import { Icon } from '../ui/Icon';
import { PageHead, Section, useTitle } from '../ui/parts';
import { Failure, useAction } from './shared';

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

function outcome(record: CampaignRecord, operation: SavedOperation): { icon?: string; text: string } {
  if (operation.status === 'confirmed') {
    const state = operation.kind === 'payout' ? 'paid' : 'reclaimed';
    return { icon: stateCopy[state].icon, text: stateSentence(record, state) };
  }
  return {
    text: operation.kind === 'payout'
      ? 'Rejected by the mint. A deposit was taken back first. Nothing was paid.'
      : 'Rejected by the mint. The payout got there first.',
  };
}

export function Recovery() {
  useTitle('Recovery');
  const { world, apply, live, refresh } = useStore();
  const action = useAction();
  const entries = entriesFor(world);

  // Live, a reclaim's outputs are only in its owner's storage, so only the owner can ask about it.
  const canCheck = (operation: SavedOperation) => !live || operation.kind === 'payout' || operation.savedBy === world.viewerId;
  function checkAgain(record: CampaignRecord, operation: SavedOperation) {
    if (!live) {
      apply((current, at) => checkMint(current, record.campaign.id, at));
      return;
    }
    void action.run(async () => {
      refresh(await (operation.kind === 'payout'
        ? liveActions.checkPayout(world.viewerId, record.campaign.id, operation.id)
        : liveActions.checkReclaim(world.viewerId, record.campaign.id, operation.id)));
    });
  }
  const waiting = entries.filter(entry => isPending(entry.operation));
  const settled = entries.filter(entry => !isPending(entry.operation));

  return (
    <>
      <PageHead title="Recovery">
        <p>
          The request is saved on this device before it’s sent. Check again asks the mint about the same request, so
          a dropped connection never decides where the sats went.
        </p>
      </PageHead>

      <Section label="Waiting on the mint">
        {action.failure && <Failure title="Nothing changed." text={action.failure} />}
        {waiting.length === 0 ? (
          <p>Nothing is waiting on the mint.</p>
        ) : (
          <ul className="operations" role="list">
            {waiting.map(({ record, operation, mine }) => {
              const state = operation.kind === 'payout' ? 'paying out' : 'reclaiming';
              return (
                <li key={operation.id} className="operation">
                  <h3>{name(operation)}</h3>
                  <p className="small link-alone">
                    <Link to={paths.campaign(record.campaign.id)}>{record.campaign.title}</Link>
                  </p>
                  <p className="operation-state"><Icon name={stateCopy[state].icon} size={18} /><span>{stateSentence(record, state)}</span></p>
                  <p className="small muted">
                    Sent {formatWhen(operation.savedAt)}.{' '}
                    {operation.status === 'unresolved'
                      ? 'Still waiting for the mint. Nothing is paid until the mint confirms. '
                      : 'No answer yet. '}
                    {mine ? 'Saved on this device.' : `Saved on ${people[operation.savedBy].short}’s device.${canCheck(operation) ? ' You can still ask the mint.' : ''}`}
                  </p>
                  <p className="small muted mono">{operation.id}</p>
                  {canCheck(operation) && (
                    <div className="actions">
                      <button type="button" className="button" data-variant={waiting.length === 1 ? 'primary' : undefined}
                        aria-disabled={action.busy || undefined} onClick={() => checkAgain(record, operation)}>
                        Check again
                      </button>
                    </div>
                  )}
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
              const result = outcome(record, operation);
              return (
                <li key={operation.id} className="operation" data-confirmed={result.icon ? true : undefined}
                  data-signal={(result.icon && operation.kind === 'payout') || undefined}>
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
          <li>Keys and saved requests live only on the device that made them. Clear its storage and a deposit that hasn’t been paid out can’t be recovered.</li>
          <li>A timed-out request is never assumed to have failed. It stays open until the mint has been asked.</li>
          <li>If the mint says a quote is issued but the outputs don’t match, it isn’t marked paid or reclaimed.</li>
          <li>
            {live
              ? 'After a reload, campaigns are rebuilt from this browser’s storage. Nothing is backed up anywhere else.'
              : 'This prototype makes no backup and doesn’t survive a reload.'}
          </li>
        </ul>
      </Section>
    </>
  );
}
