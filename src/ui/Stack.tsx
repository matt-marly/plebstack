import type { CSSProperties } from 'react';
import { Slab } from './Slab';
import { slabOffset, type Goal } from './journey';

const BASE = 114;
const RISE = 30;
const plane = '74,38 318,38 348,22 104,22';

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
        <polygon className="stack-plane" points={plane}
          style={{ fill: 'rgba(255,255,255,.015)', stroke: paid ? 'var(--color-signal)' : solid ? 'var(--color-ink)' : 'var(--color-dash)' }}
          strokeWidth="1.6" strokeDasharray={solid ? undefined : '6 5'} />
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
            const tone = slab.kind !== 'filled' ? (slab.kind === 'open' ? 'open' : 'outline')
              : paid ? 'lit' : slab.own ? 'own' : 'ink';
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
