import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../demo/store';
import { pendingOperation, people, sats, statusOf, stopCollecting, tally, viewerStep, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { Failure, useAction } from '../screens/shared';
import { listNames, plural } from './format';
import { Note } from './parts';

function ButtonLink({ to, primary, children }: { to: string; primary?: boolean; children: ReactNode }) {
  return <Link className="button" data-variant={primary ? 'primary' : undefined} to={to}>{children}</Link>;
}

// What the person looking can do now. One filled button at most; taking a deposit back
// stays available, as a quieter button, for as long as the state machine allows it.
export function NextStep({ record }: { record: CampaignRecord }) {
  const { world, apply, live, refresh } = useStore();
  const action = useAction();
  const step = viewerStep(world, record);
  const id = record.campaign.id;
  const each = sats(record.campaign.contributionSat);
  const maintainer = people[record.creatorId];
  const takeBack = (slotId: string, primary = false) => (
    <ButtonLink to={paths.reclaim(id, slotId)} primary={primary}>Take mine back</ButtonLink>
  );
  const failed = action.failure && <Failure title="Nothing changed." text={action.failure} />;
  // Live, a request still waiting on the mint can be asked about from here: the same saved request, never a new one.
  const checkAgain = (kind: 'payout' | 'reclaim', slotId?: string) => {
    const operation = live ? pendingOperation(record, kind, slotId) : undefined;
    if (!operation) return null;
    return (
      <button type="button" className="button" data-variant="primary" aria-disabled={action.busy || undefined}
        onClick={() => void action.run(async () => {
          refresh(await (kind === 'payout'
            ? liveActions.checkPayout(world.viewerId, id, operation.id)
            : liveActions.checkReclaim(world.viewerId, id, operation.id)));
        })}>
        {action.busy ? 'Asking the mint…' : 'Check again'}
      </button>
    );
  };

  switch (step.kind) {
    case 'organize': {
      const collecting = statusOf(record) === 'collecting';
      const stop = () => (live
        ? void action.run(async () => { refresh(liveActions.stopCollecting(world.viewerId, id)); })
        : apply((current, at) => stopCollecting(current, id, at)));
      return (
        <div className="stack">
          <p>
            {collecting
              ? 'You organize this campaign. You can share it and stop collecting, but you can’t move anyone’s sats.'
              : 'You organize this campaign. Each pleb decides what happens to their own deposit.'}
          </p>
          {statusOf(record) === 'approved' && (
            <div className="actions"><ButtonLink to={paths.payout(id)} primary>View payout</ButtonLink></div>
          )}
          {failed}
          {collecting && (
            <div className="actions">
              <button type="button" className="button" onClick={stop}>
                Stop collecting
              </button>
            </div>
          )}
        </div>
      );
    }
    case 'watch':
      return <p>You have no deposit in this campaign, and it isn’t taking new ones.</p>;
    case 'join':
      return (
        <div className="stack">
          <p>
            {plural(record.slots.length - tally(record).held, 'slot is', 'slots are')} open. Your {each} would wait at the
            mint, locked to your key, until all three plebs sign.
          </p>
          <div className="actions"><ButtonLink to={paths.back(id)} primary>Join with {each}</ButtonLink></div>
        </div>
      );
    case 'fund':
      return (
        <div className="stack">
          <p>Your invoice is waiting. Not stacked until the mint reports it paid.</p>
          <div className="actions"><ButtonLink to={paths.back(id)} primary>Continue your deposit</ButtonLink></div>
        </div>
      );
    case 'wait':
      return (
        <div className="stack">
          <p>
            Stacked. Your {each} are at the mint, locked to your key. Nobody can sign until
            {' '}{plural(step.missing, 'more pleb stacks', 'more plebs stack')}.
          </p>
          <div className="actions">{takeBack(step.slot.id)}</div>
        </div>
      );
    case 'approve':
      return (
        <div className="stack">
          <p>All three deposits are in. Check the outputs before you sign.</p>
          <div className="actions">
            <ButtonLink to={paths.approve(id, step.slot.id)} primary>Check and sign</ButtonLink>
            {takeBack(step.slot.id)}
          </div>
        </div>
      );
    case 'stopped':
      return (
        <div className="stack">
          <p>You stopped signing on this device. No signature was released, and your {each} are still at the mint.</p>
          <div className="actions">{takeBack(step.slot.id, true)}</div>
        </div>
      );
    case 'approved':
      return (
        <div className="stack">
          <Note title="Signed. You can’t take this back.">
            <p>A reclaim can still race the payout. Whichever the mint issues first wins.</p>
          </Note>
          {step.waitingOn.length > 0 && <p>Signed {tally(record).approvals} of 3. All three have to sign. Waiting for {listNames(step.waitingOn)}.</p>}
          <div className="actions">{takeBack(step.slot.id)}</div>
        </div>
      );
    case 'payout-pending': {
      const check = checkAgain('payout');
      return (
        <div className="stack">
          <p>Sending · waiting for the mint. One batch of {sats(tally(record).targetSat)}. Nothing is paid until the mint confirms.</p>
          {failed}
          <div className="actions">
            {check}
            <ButtonLink to={paths.payout(id)} primary={!check}>View payout</ButtonLink>
            {step.slot && takeBack(step.slot.id)}
          </div>
        </div>
      );
    }
    case 'paid':
      return (
        <div className="stack">
          <p>
            {step.slot
              ? `Your ${each} went to ${maintainer.name} in one batch. Confirmed by the mint.`
              : `${sats(tally(record).targetSat)} from 3 plebs, issued to ${world.viewerId === maintainer.id ? 'your' : `${maintainer.short}’s`} key in one batch. Confirmed by the mint.`}
          </p>
          <div className="actions"><ButtonLink to={paths.payout(id)} primary>View receipt</ButtonLink></div>
        </div>
      );
    case 'take-back':
      return (
        <div className="stack">
          <p>No payout this time. Take your {each} back as ecash at this mint.</p>
          <div className="actions">{takeBack(step.slot.id, true)}</div>
        </div>
      );
    case 'reclaiming': {
      const check = checkAgain('reclaim', step.slot.id);
      return (
        <div className="stack">
          <p>Unstacking. Waiting for the mint. Not reclaimed until the mint confirms.</p>
          {failed}
          <div className="actions">
            {check}
            <ButtonLink to={paths.reclaim(id, step.slot.id)} primary={!check}>{check ? 'View reclaim' : 'Check on your reclaim'}</ButtonLink>
          </div>
        </div>
      );
    }
    case 'reclaimed':
      return (
        <div className="stack">
          <p>Back to you. {each} minted to your own outputs, saved in this browser.</p>
          <div className="actions"><ButtonLink to={paths.reclaim(id, step.slot.id)}>View reclaim receipt</ButtonLink></div>
        </div>
      );
  }
}
