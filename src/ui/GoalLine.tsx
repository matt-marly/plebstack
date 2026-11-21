import { useLayoutEffect, useRef, useState } from 'react';
import { groupComplete, isHeld, pendingOperation, sats, statusOf, tally, type CampaignRecord } from '../demo/world';

export interface GoalSlab {
  kind: 'filled' | 'open' | 'reclaimed';
  // The quote's public key, which fixes where the slab sits.
  key?: string;
  own?: boolean;
}

export type GoalPhase = 'collecting' | 'at-line' | 'sending' | 'paid' | 'unmet';

export interface Goal {
  slabs: GoalSlab[];
  phase: GoalPhase;
  label: string;
  text: string;
}

const STEP = 4;
const STEPS = 12;
const fallback = [3, 0, 6];

// The same quote lands in the same spot on every screen and in every browser.
export function slabOffset(key: string | undefined, index: number): number {
  if (!key) return fallback[index % fallback.length] * STEP;
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % (STEPS + 1)) * STEP;
}

export function campaignGoal(record: CampaignRecord, viewerId?: string): Goal {
  const state = statusOf(record);
  const { held, heldSat, targetSat } = tally(record);
  const complete = groupComplete(record);
  const slabs = record.slots.map((slot): GoalSlab => ({
    kind: slot.deposit?.state === 'reclaimed' ? 'reclaimed' : isHeld(slot) ? 'filled' : 'open',
    key: slot.quote?.ownerPubkey,
    own: viewerId !== undefined && slot.backerId === viewerId,
  }));
  if (state === 'paid') {
    return { slabs, phase: 'paid', label: `goal reached · ${sats(targetSat)} paid`,
      text: `Goal reached. ${sats(targetSat)} paid, confirmed by the mint.` };
  }
  const text = `${held} of 3 deposits in, ${heldSat} of ${sats(targetSat)}.`;
  if (complete) {
    const sending = state === 'paying out' || pendingOperation(record, 'payout') !== undefined;
    return { slabs, phase: sending ? 'sending' : 'at-line', label: `at the line · ${heldSat} of ${sats(targetSat)}`, text };
  }
  return { slabs, phase: state === 'unmet' ? 'unmet' : 'collecting', label: `goal · ${heldSat} of ${sats(targetSat)}`,
    text: state === 'unmet' ? `${text} No payout this time.` : text };
}

// Three equal slabs under one line. Dashed while collecting, solid ink at the line, signal only once paid.
export function GoalLine({ slabs, phase, label, text }: Goal) {
  const paid = phase === 'paid';
  const seen = useRef(paid);
  const [moment, setMoment] = useState(false);

  // The fill plays only when Paid arrives while this is on screen, never on a load of a paid campaign.
  useLayoutEffect(() => {
    if (paid && !seen.current) setMoment(true);
    seen.current = paid;
  }, [paid]);

  const pile = (lit?: boolean) => (
    <div className="goal-pile" data-lit={lit || undefined}>
      {slabs.map((slab, index) => (
        <span key={index} className="goal-slab" data-kind={slab.kind} data-own={slab.own || undefined}
          style={{ marginInlineStart: slabOffset(slab.key, index) }} />
      ))}
    </div>
  );

  return (
    <div className="goal" data-phase={phase} data-moment={moment || undefined}>
      <div aria-hidden="true">
        <p className="goal-label">{label}</p>
        <div className="goal-line" />
        <div className="goal-piles">{pile()}{paid && pile(true)}</div>
      </div>
      {text && <p className="visually-hidden">{text}</p>}
    </div>
  );
}
