import type { CSSProperties } from 'react';
import { Slab } from './Slab';
import { slabOffset, type Goal } from './journey';

const BASE = 114;
const RISE = 30;
// The goal line just above a full pile, with a tick at each end.
const LINE = 28;
const line = `M4 ${LINE}H346`;
const ticks = `M4 ${LINE - 6}V${LINE + 6}M346 ${LINE - 6}V${LINE + 6}`;

// Three slabs under the goal line, bottom up in join order. Dashed while collecting,
// solid ink at the line, lime only once the mint confirmed the payout.
export function Stack({ goal, meta, landing, lighting }: { goal: Goal; meta?: string; landing?: boolean; lighting?: boolean }) {
  const paid = goal.phase === 'paid';
  const solid = paid || goal.phase === 'at-line' || goal.phase === 'sending';
  return (
    <figure className="stack" data-phase={goal.phase} data-paid={paid || undefined} data-lighting={lighting || undefined}>
      <div className="stack-labels" aria-hidden="true">
        <span>{goal.label}</span>
        {meta && <span>{meta}</span>}
      </div>
      <svg className="stack-drawing" viewBox="0 0 350 150" aria-hidden="true" focusable="false">
        <g className="stack-line" style={{ stroke: paid ? 'var(--color-signal)' : solid ? 'var(--color-ink)' : 'var(--color-dash)' }}
          fill="none" strokeWidth="2">
          <path d={line} strokeDasharray={solid ? undefined : '6 5'} />
          <path d={ticks} strokeLinecap="round" />
        </g>
        <ellipse cx="207" cy="142" rx="122" ry="11" fill="rgba(0,0,0,.55)" />
        {goal.phase === 'sending' && (
          <g className="stack-dashes" stroke="var(--color-state-paying-out)" strokeWidth="2.5" strokeLinecap="round">
            <path d={`M6 ${BASE - RISE + 11}H24`} />
            <path d={`M12 ${BASE - RISE * 2 + 11}H30`} />
          </g>
        )}
        <g className="stack-pile">
          {goal.slabs.map((slab, index) => {
            const x = 88 + slabOffset(slab.key, index) * 0.75;
            const y = BASE - RISE * index;
            // Colour is the state: locked at the mint, ready at the line, on its way, paid.
            const tone = slab.kind !== 'filled' ? (slab.kind === 'open' ? 'open' : 'outline')
              : paid ? 'lit' : goal.phase === 'sending' ? 'sending' : goal.phase === 'at-line' ? 'ready' : slab.own ? 'own' : 'ink';
            return (
              <g key={index} className="stack-slab" style={{ '--i': index } as CSSProperties}>
                <Slab x={x} y={y} width={170} tone={tone} outlined={slab.own && slab.kind === 'filled'}
                  className={landing && slab.own ? 'slab-drop' : undefined} />
                {slab.name && (
                  <text x={x - 12} y={y + 15} textAnchor="end" className="stack-name" data-own={slab.own || undefined}>
                    {slab.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption className="visually-hidden">{goal.text}</figcaption>
    </figure>
  );
}
