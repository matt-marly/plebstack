import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../demo/store';
import { people, sats, statusOf, stopCollecting, tally, viewerStep, type CampaignRecord } from '../demo/world';
import { paths } from '../routes';
import { listNames, plural } from './format';
import { Note } from './parts';

function ButtonLink({ to, primary, children }: { to: string; primary?: boolean; children: ReactNode }) {
  return <Link className="button" data-variant={primary ? 'primary' : undefined} to={to}>{children}</Link>;
}

// What the person looking can do now. One filled button at most; taking a deposit back
// stays available, as a quieter button, for as long as the state machine allows it.
export function NextStep({ record }: { record: CampaignRecord }) {
  const { world, apply } = useStore();
  const step = viewerStep(world, record);
  const id = record.campaign.id;
  const each = sats(record.campaign.contributionSat);
  const creator = people[record.creatorId];
  const takeBack = (slotId: string, primary = false) => (
    <ButtonLink to={paths.reclaim(id, slotId)} primary={primary}>Take mine back</ButtonLink>
  );

  switch (step.kind) {
    case 'organize': {
      const collecting = statusOf(record) === 'collecting';
      return (
        <div className="stack">
          <p>
            {collecting
              ? 'You organize this campaign. You can share it and stop collecting, but you can’t move anyone’s deposit.'
              : 'You organize this campaign. Its backers decide what happens to their own deposits.'}
          </p>
          {collecting && (
            <div className="actions">
              <button type="button" className="button" onClick={() => apply((current, at) => stopCollecting(current, id, at))}>
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
          <p>{plural(record.slots.length - tally(record).held, 'slot is', 'slots are')} open. Your deposit would wait at the mint until all three backers approve.</p>
          <div className="actions"><ButtonLink to={paths.back(id)} primary>Join with {each}</ButtonLink></div>
        </div>
      );
    case 'fund':
      return (
        <div className="stack">
          <p>Your invoice is waiting. Nothing is at the mint for you yet.</p>
          <div className="actions"><ButtonLink to={paths.back(id)} primary>Continue your deposit</ButtonLink></div>
        </div>
      );
    case 'wait':
      return (
        <div className="stack">
          <p>Your deposit of {each} is at the mint. Nobody can approve until {plural(step.missing, 'more deposit arrives', 'more deposits arrive')}.</p>
          <div className="actions">{takeBack(step.slot.id)}</div>
        </div>
      );
    case 'approve':
      return (
        <div className="stack">
          <p>All three deposits are in. Check the payout before you sign it.</p>
          <div className="actions">
            <ButtonLink to={paths.approve(id, step.slot.id)} primary>Review and approve</ButtonLink>
            {takeBack(step.slot.id)}
          </div>
        </div>
      );
    case 'stopped':
      return (
        <div className="stack">
          <p>You stopped approval on this device. No signature was released, and your deposit of {each} is still at the mint.</p>
          <div className="actions">{takeBack(step.slot.id, true)}</div>
        </div>
      );
    case 'approved':
      return (
        <div className="stack">
          <Note title="You approved, and that can’t be taken back.">
            <p>You can still take your deposit back until the mint pays out.</p>
          </Note>
          {step.waitingOn.length > 0 && <p>Waiting for {listNames(step.waitingOn)} to approve.</p>}
          <div className="actions">{takeBack(step.slot.id)}</div>
        </div>
      );
    case 'payout-pending':
      return (
        <div className="stack">
          <p>One batch of {sats(tally(record).targetSat)} is with the mint. Nothing counts as paid until the mint confirms it.</p>
          <div className="actions">
            <ButtonLink to={paths.payout(id)} primary>View payout</ButtonLink>
            {step.slot && takeBack(step.slot.id)}
          </div>
        </div>
      );
    case 'paid':
      return (
        <div className="stack">
          <p>
            {step.slot
              ? `Your deposit of ${each} was paid to ${creator.name} as part of one payment.`
              : `All three deposits were issued to ${world.viewerId === creator.id ? 'your' : `${creator.short}’s`} key in one payment.`}
          </p>
          <div className="actions"><ButtonLink to={paths.payout(id)} primary>View receipt</ButtonLink></div>
        </div>
      );
    case 'take-back':
      return (
        <div className="stack">
          <p>This campaign can’t pay out. Your deposit of {each} is still at the mint, locked to your key.</p>
          <div className="actions">{takeBack(step.slot.id, true)}</div>
        </div>
      );
    case 'reclaiming':
      return (
        <div className="stack">
          <p>Your reclaim is with the mint. It isn’t reclaimed until the mint confirms it.</p>
          <div className="actions"><ButtonLink to={paths.reclaim(id, step.slot.id)} primary>Check on your reclaim</ButtonLink></div>
        </div>
      );
    case 'reclaimed':
      return (
        <div className="stack">
          <p>Your deposit of {each} is back in your own wallet.</p>
          <div className="actions"><ButtonLink to={paths.reclaim(id, step.slot.id)}>View reclaim receipt</ButtonLink></div>
        </div>
      );
  }
}
