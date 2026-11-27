import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
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

const BEAT_MS = 2600;
const HOLD_MS = 3800;
const START_MS = 500;

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
  const [paused, setPaused] = useState(false);
  // The words settle first; the first slab waits for them.
  const [started, setStarted] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setStarted(true), START_MS);
    return () => clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (reduced) {
      setAt(beats.length - 1);
      return;
    }
    if (!started || paused) return;
    const last = at === beats.length - 1;
    if (last && !loop) return;
    const timer = setTimeout(() => setAt(last ? 0 : at + 1), last ? HOLD_MS : BEAT_MS);
    return () => clearTimeout(timer);
  }, [at, beats.length, loop, reduced, started, paused]);

  // A new scene starts from its first beat.
  useEffect(() => setAt(reduced ? beats.length - 1 : 0), [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const beat = beats[Math.min(at, beats.length - 1)];
  const shown = started ? beat : { ...beat, slabs: ['none', 'none', 'none'] as Beat['slabs'] };
  const sending = shown.slabs[0] === 'sending';
  const full = shown.slabs.every(state => state !== 'none' && state !== 'back');
  return (
    <figure className="story" data-scene={scene}>
      <svg className="story-drawing" viewBox="0 0 360 200" aria-hidden="true" focusable="false">
        {/* The goal line runs to the person it pays: Ngozi sits at its end. */}
        <text x="20" y="58" className="story-label">GOAL · 63 SATS</text>
        <g className="story-line" data-solid={shown.line === 'solid' || undefined} data-full={full || undefined}>
          <path d="M20 72H290" strokeDasharray={shown.line === 'solid' ? undefined : '6 5'} />
          <path d="M20 65V79" />
        </g>
        <g className="story-payee" data-active={sending || undefined}>
          <circle cx="312" cy="72" r="20" />
          <text x="312" y="78" textAnchor="middle" className="story-initial">{maintainer[0]}</text>
          <text x="312" y="108" textAnchor="middle" className="story-name">{maintainer}</text>
        </g>
        {sending && <path className="story-flow" d="M236 100C262 98 280 92 292 84" />}
        <ellipse cx="146" cy="186" rx="112" ry="8" fill="rgba(0,0,0,.55)" />
        {[0, 1, 2].map(index => {
          const state = shown.slabs[index];
          const x = 64 + [0, 10, -4][index];
          const y = 154 - 34 * index;
          return (
            <g key={index}>
              <Slab x={x} y={y} width={150} height={20} depth={[26, 14]} tone="open" />
              <g key={state === 'none' ? 'empty' : 'in'} className="story-slab" data-state={state} style={{ '--x': `${x + 75}px`, '--y': `${y + 10}px`, '--dx': `${312 - x - 75}px`, '--dy': `${72 - y - 10}px` } as CSSProperties}>
                {state !== 'none' && <Slab x={x} y={y} width={150} height={20} depth={[26, 14]} tone={tone[state]} />}
              </g>
              <text x="52" y={y + 15} textAnchor="end" className="story-who" data-in={state !== 'none' || undefined}>{NAMES[index]}</text>
            </g>
          );
        })}
      </svg>
      <div className="story-foot">
        <figcaption className="story-caption">
          <span className="story-text" key={started ? at : 'wait'} aria-hidden="true">{started ? beat.caption : '\u00a0'}</span>
          <span className="visually-hidden">{beats.map(item => item.caption).join(' ')}</span>
        </figcaption>
        {!reduced && (
          <button type="button" className="story-pause" onClick={() => setPaused(value => !value)}
            aria-label={paused ? 'Play the animation' : 'Pause the animation'}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
        )}
      </div>
    </figure>
  );
}
