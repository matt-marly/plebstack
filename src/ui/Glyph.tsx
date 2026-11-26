import { Slab } from './Slab';

export type GlyphName = 'start' | 'join' | 'watch' | 'how';

// Brand glyphs: the same 2.5D slabs the stack is drawn with, small. Never lime: nothing here is paid.
// Each has a moving part (data-part="move") that CSS can animate on hover and on arrival.
export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  const depth: [number, number] = [9, 5];
  return (
    <svg className={`glyph ${className ?? ''}`} data-glyph={name} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {name === 'start' && (
        <>
          {/* A new stack: the goal line, two places still open, and the first slab down. */}
          <path className="glyph-line" d="M9 13H55" />
          <path className="glyph-line" d="M9 9V17M55 9V17" />
          <Slab x={12} y={25} width={30} height={7} depth={depth} tone="open" />
          <Slab x={14} y={36} width={30} height={7} depth={depth} tone="open" />
          <g data-part="move"><Slab x={10} y={47} width={30} height={7} depth={depth} tone="ink" /></g>
        </>
      )}
      {name === 'join' && (
        <>
          {/* Two slabs in, yours on its way down onto them. */}
          <Slab x={12} y={47} width={30} height={7} depth={depth} tone="own" />
          <Slab x={15} y={36} width={30} height={7} depth={depth} tone="own" />
          <g data-part="move"><Slab x={11} y={18} width={30} height={7} depth={depth} tone="ink" /></g>
          <path className="glyph-arrow" d="M26 6V12M23 9.5L26 12.5L29 9.5" data-part="move" />
        </>
      )}
      {name === 'watch' && (
        <>
          {/* A full stack at the line, and a live dot. */}
          <path className="glyph-line" d="M7 14H49M7 10V18M49 10V18" />
          <Slab x={12} y={47} width={28} height={7} depth={depth} tone="ink" />
          <Slab x={15} y={36} width={28} height={7} depth={depth} tone="ink" />
          <Slab x={10} y={25} width={28} height={7} depth={depth} tone="ink" />
          <circle className="glyph-live" cx="56" cy="11" r="3.5" data-part="move" />
        </>
      )}
      {name === 'how' && (
        <>
          {/* One slab, and the line it is headed for: how it works. */}
          <path className="glyph-line" d="M10 16H54M10 12V20M54 12V20" />
          <g data-part="move"><Slab x={14} y={38} width={34} height={8} depth={depth} tone="outline" /></g>
          <path className="glyph-arrow" d="M31 32V24M28 27L31 24L34 27" />
        </>
      )}
    </svg>
  );
}
