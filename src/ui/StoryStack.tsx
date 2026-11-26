import { useEffect, useState, type CSSProperties } from 'react';
import { Slab, type Tone } from './Slab';

// The stack telling its own story, beat by beat: slabs lock in, the line is reached, everyone signs, one payment
// goes out; or it doesn't fill and each slab goes back to its owner. Colour carries the state, from the tokens:
// grey locked at the mint, teal ready, blue signed, amber sending, purple going back. Never lime: nothing here is
// a real payout. Decorative to a screen reader, which gets the whole story as one list instead.

type SlabState = 'none' | 'in' | 'ready' | 'signed' | 'sending' | 'back';

interface Beat {
  caption: string;
  slabs: [SlabState, SlabState, SlabState];
  line: 'dashed' | 'solid';
}

export type Scene = 'fill' | 'pay' | 'back' | 'all';

const NAMES = ['Tobi', 'Maren', 'Ishaan'] as const;

function scenes(maintainer: string): Record<Exclude<Scene, 'all'>, Beat[]> {
  return {
    fill: [
      { caption: `The goal: 63 sats for ${maintainer}.`, slabs: ['none', 'none', 'none'], line: 'dashed' },
      { caption: 'Tobi locks 21 sats at the mint.', slabs: ['in', 'none', 'none'], line: 'dashed' },
      { caption: 'Maren locks 21.', slabs: ['in', 'in', 'none'], line: 'dashed' },
      { caption: 'Ishaan makes three. Goal reached.', slabs: ['ready', 'ready', 'ready'], line: 'solid' },
    ],
    pay: [
      { caption: 'All three are in.', slabs: ['ready', 'ready', 'ready'], line: 'solid' },
      { caption: 'Tobi signs the payout.', slabs: ['signed', 'ready', 'ready'], line: 'solid' },
      { caption: 'Maren signs.', slabs: ['signed', 'signed', 'ready'], line: 'solid' },
      { caption: 'Ishaan signs. That’s everyone.', slabs: ['signed', 'signed', 'signed'], line: 'solid' },
      { caption: `One payment: 63 sats to ${maintainer}.`, slabs: ['sending', 'sending', 'sending'], line: 'solid' },
    ],
    back: [
      { caption: 'Two of three by the deadline.', slabs: ['in', 'in', 'none'], line: 'dashed' },
      { caption: 'Not filled. Tobi takes back 21 sats.', slabs: ['back', 'in', 'none'], line: 'dashed' },
      { caption: 'Maren does the same. Nobody else can move them.', slabs: ['back', 'back', 'none'], line: 'dashed' },
    ],
  };
}

const tone: Record<Exclude<SlabState, 'none'>, Tone> = { in: 'own', ready: 'ready', signed: 'signed', sending: 'sending', back: 'back' };
const legend: Record<Exclude<SlabState, 'none'>, string> = {
  in: 'locked at the mint', ready: 'ready to sign', signed: 'signed', sending: 'sending', back: 'back to its owner',
};

const BEAT_MS = 1700;
const HOLD_MS = 2800;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

export function StoryStack({ scene, maintainer = 'Ngozi', loop = true }: { scene: Scene; maintainer?: string; loop?: boolean }) {
  const all = scenes(maintainer);
  const beats = scene === 'all' ? [...all.fill, ...all.pay.slice(1)] : all[scene];
  const reduced = useReducedMotion();
  const [at, setAt] = useState(reduced ? beats.length - 1 : 0);

  useEffect(() => {
    if (reduced) {
      setAt(beats.length - 1);
      return;
    }
    const last = at === beats.length - 1;
    if (last && !loop) return;
    const timer = setTimeout(() => setAt(last ? 0 : at + 1), last ? HOLD_MS : BEAT_MS);
    return () => clearTimeout(timer);
  }, [at, beats.length, loop, reduced]);

  // A new scene starts from its first beat.
  useEffect(() => setAt(reduced ? beats.length - 1 : 0), [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const beat = beats[Math.min(at, beats.length - 1)];
  const states = new Set(beat.slabs.filter(state => state !== 'none'));
  return (
    <figure className="story" data-scene={scene}>
      <svg className="story-drawing" viewBox="0 0 360 214" aria-hidden="true" focusable="false">
        {/* The goal line, said in words: where the maintainer gets paid. */}
        <text x="20" y="20" className="story-label">GOAL · 63 SATS</text>
        <g className="story-line" data-solid={beat.line === 'solid' || undefined}>
          <path d="M20 34H272" strokeDasharray={beat.line === 'solid' ? undefined : '6 5'} />
          <path d="M20 27V41M272 27V41" />
        </g>
        <g className="story-payee" data-active={beat.slabs[0] === 'sending' || undefined}>
          <circle cx="314" cy="34" r="18" />
          <text x="314" y="40" textAnchor="middle" className="story-initial">{maintainer[0]}</text>
          <text x="314" y="70" textAnchor="middle" className="story-name">{maintainer}</text>
        </g>
        {beat.slabs[0] === 'sending' && <path className="story-flow" d="M250 92C276 86 296 70 304 56" />}
        <ellipse cx="150" cy="200" rx="118" ry="9" fill="rgba(0,0,0,.55)" />
        {[0, 1, 2].map(index => {
          const state = beat.slabs[index];
          const x = 64 + [0, 12, -6][index];
          const y = 166 - 34 * index;
          return (
            <g key={index}>
              <Slab x={x} y={y} width={150} height={20} depth={[26, 14]} tone="open" />
              <g key={state === 'none' ? 'empty' : 'in'} className="story-slab" data-state={state} style={{ '--x': `${x}px`, '--y': `${y}px` } as CSSProperties}>
                {state !== 'none' && <Slab x={x} y={y} width={150} height={20} depth={[26, 14]} tone={tone[state]} />}
              </g>
              <text x={x - 10} y={y + 15} textAnchor="end" className="story-who">{NAMES[index]}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="story-caption">
        <span className="story-text" key={at} aria-hidden="true">{beat.caption}</span>
        <span className="story-steps" aria-hidden="true">
          {beats.map((_, index) => <i key={index} data-on={index <= at || undefined} />)}
        </span>
        <span className="story-legend" aria-hidden="true">
          {[...states].map(state => <span key={state} data-state={state}>{legend[state]}</span>)}
        </span>
        <span className="visually-hidden">{beats.map(item => item.caption).join(' ')}</span>
      </figcaption>
    </figure>
  );
}
