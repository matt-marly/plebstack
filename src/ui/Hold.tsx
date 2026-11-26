import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TopBar, useHeadingFocus, useTitle } from './Frame';
import { Slab } from './Slab';

// Three 2.5D slabs under a goal line, as on every stack. 'stacking' drops them in one by one, over and over,
// for a wait; 'empty' leaves them as dashed outlines, for a stack that isn't there.
function Slabs({ mode }: { mode: 'stacking' | 'empty' }) {
  const rows: [number, number][] = [[14, 86], [22, 62], [10, 38]];
  return (
    <svg className="hold-art" data-mode={mode} viewBox="0 0 140 112" aria-hidden="true" focusable="false">
      <path className="hold-line" d="M6 16H128M6 10V22M128 10V22" />
      {rows.map(([x, y], index) => (
        <g key={y} className="hold-slab" style={{ animationDelay: `${index * 260}ms` }}>
          <Slab x={x} y={y} width={92} height={16} depth={[18, 10]} tone={mode === 'empty' ? 'open' : 'ink'} />
        </g>
      ))}
    </svg>
  );
}

export interface HoldProps {
  title: string;
  text: string;
  mode: 'stacking' | 'empty';
  // A quiet line under the text, such as what the app is doing right now.
  detail?: ReactNode;
  // After this long, the wait explains itself.
  slowAfterMs?: number;
  slow?: string;
  children?: ReactNode;
}

// A screen with nothing to do yet: waiting, empty or full. Centred, the brand's slabs, one sentence, a way on.
export function Hold({ title, text, mode, detail, slowAfterMs, slow, children }: HoldProps) {
  useTitle(title);
  const main = useRef<HTMLElement>(null);
  useHeadingFocus(main, title);
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!slowAfterMs) return;
    const timer = setTimeout(() => setLate(true), slowAfterMs);
    return () => clearTimeout(timer);
  }, [slowAfterMs]);
  return (
    <div className="screen hold">
      <header className="top"><TopBar /></header>
      <main ref={main} className="hold-body" id="main" aria-busy={mode === 'stacking' || undefined}>
        <Slabs mode={mode} />
        <div className="hold-words">
          <h1>{title}</h1>
          <p>{late && slow ? slow : text}</p>
          {detail && <p className="hold-detail">{detail}</p>}
        </div>
        {children && <div className="hold-actions">{children}</div>}
      </main>
    </div>
  );
}
