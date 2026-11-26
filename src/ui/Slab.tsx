import type { CSSProperties } from 'react';

export type Tone = 'ink' | 'own' | 'ready' | 'signed' | 'sending' | 'back' | 'lit' | 'open' | 'outline';
type Solid = Exclude<Tone, 'open' | 'outline'>;

// Top, front and side faces, one set per money state from the tokens. Lime only for a slab the mint has paid out.
const faces: Record<Solid, [string, string, string]> = {
  ink: ['#f8f8f6', '#f4f4f1', '#979795'],
  own: ['#ceced3', 'var(--color-state-deposited)', '#707075'],
  ready: ['#86e9db', 'var(--color-state-ready)', '#1b7f73'],
  signed: ['#b6c6ff', 'var(--color-state-approved)', '#59689e'],
  sending: ['#ffcf7a', 'var(--color-state-paying-out)', '#94631a'],
  back: ['#dcc7ff', 'var(--color-state-reclaiming)', '#765e9b'],
  lit: ['#dbf67c', 'var(--color-signal)', '#7c9521'],
};

export interface SlabProps {
  x: number;
  y: number;
  width: number;
  height?: number;
  depth?: [number, number];
  tone: Tone;
  outlined?: boolean;
  className?: string;
  style?: CSSProperties;
}

// One deposit as a 2.5D slab: front face at (x, y), the top and side receding up and right.
export function Slab({ x, y, width: w, height: h = 22, depth: [dx, dy] = [30, 16], tone, outlined, className, style }: SlabProps) {
  const front = `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
  const top = `${x},${y} ${x + dx},${y - dy} ${x + w + dx},${y - dy} ${x + w},${y}`;
  const side = `${x + w},${y} ${x + w + dx},${y - dy} ${x + w + dx},${y - dy + h} ${x + w},${y + h}`;
  if (tone === 'open' || tone === 'outline') {
    const open = tone === 'open';
    const line = { fill: 'none', stroke: open ? 'var(--color-dash)' : 'var(--color-faint)', strokeWidth: 1.3,
      strokeDasharray: open ? '4 4' : undefined };
    return (
      <g className={className} style={style} data-tone={tone}>
        <polygon points={front} style={{ ...line, fill: open ? 'rgba(255,255,255,.02)' : 'none' }} />
        <polygon points={top} style={line} />
        <polygon points={side} style={{ ...line, stroke: open ? 'var(--color-dash-dim)' : line.stroke }} />
      </g>
    );
  }
  const [topFill, frontFill, sideFill] = faces[tone];
  return (
    <g className={className} style={style} data-tone={tone}>
      <polygon points={side} style={{ fill: sideFill }} />
      <polygon points={front} style={{ fill: frontFill }} />
      <polygon points={top} style={{ fill: topFill }} />
      <path d={`M${x} ${y}H${x + w}`} stroke="rgba(255,255,255,.55)" strokeWidth="1" />
      {outlined && (
        <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      )}
    </g>
  );
}
