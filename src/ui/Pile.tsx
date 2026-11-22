import type { CampaignRecord } from '../demo/world';
import { campaignGoal, slabOffset, type GoalSlab } from './journey';
import { Slab, type Tone } from './Slab';
import type { Look } from './story';

// One slab on the stage, in stage pixels. Pockets and travelling slabs draw the same shape smaller.
export const SLAB = { w: 340, h: 54, dx: 64, dy: 36 } as const;
const RISE = 74;
const X0 = 112;
const TOP = 104;
const BASE = TOP + SLAB.dy + RISE * 2;
const WIDTH = 584;
const HEIGHT = BASE + SLAB.h + 40;
// The goal line runs just above a full stack, end to end, with a tick at each end.
const LINE = TOP - 14;
const ENDS = [6, WIDTH - 6];
const line = `M${ENDS[0]} ${LINE}H${ENDS[1]}`;
const ticks = ENDS.map(x => `M${x} ${LINE - 10}V${LINE + 10}`).join('');

export const slabBox = `0 0 ${SLAB.w + SLAB.dx} ${SLAB.h + SLAB.dy}`;

// The slab alone, filling its own box: for pockets and for the slab that travels.
export function LoneSlab({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <svg className={className} viewBox={slabBox} aria-hidden="true" focusable="false">
      <Slab x={0} y={SLAB.dy} width={SLAB.w} height={SLAB.h} depth={[SLAB.dx, SLAB.dy]} tone={tone} />
    </svg>
  );
}

interface Placed extends GoalSlab {
  who?: string;
}

function placed(record: CampaignRecord | undefined): Placed[] {
  if (!record) return [0, 1, 2].map(() => ({ kind: 'open' }));
  const { slabs } = campaignGoal(record);
  return record.slots.map((slot, index) => ({ ...slabs[index], who: slot.backerId }));
}

// The shared stack under its goal line, big. A slab still travelling in is held back; it keeps its place so
// the travelling one has somewhere to land. Lime is a second layer, only once paid, filled bottom to top.
export function Pile({ record, look, away, moment }: {
  record?: CampaignRecord; look: Look; away: ReadonlySet<string>; moment?: boolean;
}) {
  const slabs = placed(record);
  const solid = look.phase === 'at-line' || look.phase === 'sending' || look.phase === 'paid';
  const draw = (lit: boolean) => slabs.map((slab, index) => {
    const x = X0 + slabOffset(slab.key, index) * 1.5;
    const y = BASE - RISE * index;
    const tone: Tone = slab.kind === 'open' ? 'open' : slab.kind === 'reclaimed' ? 'outline' : lit ? 'lit' : 'ink';
    if (lit && tone !== 'lit') return null;
    const hidden = slab.who !== undefined && away.has(slab.who);
    return (
      <g key={index} className="pile-slab" style={hidden ? { opacity: 0 } : undefined}>
        <g data-slab={lit ? undefined : slab.who} data-index={index}>
          <Slab x={x} y={y} width={SLAB.w} height={SLAB.h} depth={[SLAB.dx, SLAB.dy]} tone={tone} />
        </g>
        {!lit && slab.name && !hidden && (
          <text x={X0 - 22} y={y + SLAB.h / 2 + 7} textAnchor="end" className="pile-name">{slab.name}</text>
        )}
      </g>
    );
  });

  const goal = (className: string) => (
    <g className={className}>
      <path d={line} strokeWidth="3" strokeDasharray={solid ? undefined : '12 9'} />
      <path d={ticks} strokeWidth="3" strokeLinecap="round" />
    </g>
  );

  return (
    <div className="pile" data-phase={look.phase} data-paid={look.lit || undefined} data-moment={moment || undefined}>
      <div className="pile-goal mono" style={{ bottom: `${((HEIGHT - LINE + 12) / HEIGHT) * 100}%` }}>
        <p>{look.label}</p>
        {look.note && <p className="pile-note">{look.note}</p>}
      </div>
      <svg className="pile-base" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
        <ellipse cx={X0 + 36 + (SLAB.w + SLAB.dx) / 2} cy={BASE + SLAB.h + 16} rx={250} ry={18} fill="rgba(0,0,0,.6)" />
        <g className="pile-stack">{draw(false)}</g>
        {goal('pile-line')}
      </svg>
      {look.lit && (
        <svg className="pile-lit" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
          <g className="pile-stack">{draw(true)}</g>
          {goal('pile-line')}
        </svg>
      )}
    </div>
  );
}
