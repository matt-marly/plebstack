import type { ReactNode } from 'react';

const slab = (x: number, y: number, width = 13, height = 4.5) => (
  <rect x={x} y={y} width={width} height={height} rx="1" fill="currentColor" stroke="none" />
);
const slot = (x: number, y: number, width = 13, height = 4.5) => (
  <rect x={x} y={y} width={width} height={height} rx="1" strokeDasharray="2.5 2" />
);
const dashed = '2.5 2.25';

// Drawn on a 24 grid with a 1.75 stroke. Money is a filled slab, everything else is line.
// The seven state glyphs are slabs and the goal line, each a different shape so they read in greyscale.
const shapes: Record<string, ReactNode> = {
  'slab-under-line': <><path d="M3 4h18" strokeDasharray={dashed} />{slab(4, 15.5, 16, 5)}</>,
  'pile-at-line': <><path d="M2.5 3.5h19" />{slab(6.5, 5.75)}{slab(3, 11.5)}{slab(8, 17.25)}</>,
  'nib-on-slab': <><path d="M12 14.5L7.5 8.5 9.25 3h5.5l1.75 5.5zM12 14.5V9.5" />{slab(3, 17.5, 18)}</>,
  'pile-sending': <><path d="M2.5 3.5h19M2 9.5h3.5M2 15.25h3.5" />{slab(8.5, 5.75)}{slab(8.5, 11.5)}{slab(8.5, 17.25)}</>,
  'pile-lit': <><path d="M2 3h20" />{slab(3.5, 5.25, 17, 5.25)}{slab(3.5, 11, 17, 5.25)}{slab(3.5, 16.75, 17, 5.25)}</>,
  'slab-dropping': <>{slot(4, 3, 16, 5)}<path d="M9 10.5v2.5M15 10.5v2.5" />{slab(4, 16, 16, 5)}</>,
  'slab-on-shelf': <><path d="M2.5 19.5h19" /><rect x="4" y="10.5" width="16" height="5.5" rx="1" /></>,

  // Outside the seven: an unfilled slot, a quote waiting for its deposit, a goal that can't be met.
  'slot-open': slot(4, 9.5, 16, 5),
  awaiting: <><path d="M12 2.5v8M8.5 7l3.5 3.5L15.5 7" />{slot(4, 15, 16, 5)}</>,
  'line-open': <><path d="M2.5 3.5h19" strokeDasharray={dashed} />{slot(6.5, 6)}{slab(3, 11.5)}{slab(8, 17.25)}</>,

  'arrow-left': <path d="M19 12H5.5M10.5 7l-5 5 5 5" />,
  'arrow-right': <path d="M5 12h13.5M13.5 7l5 5-5 5" />,
  'arrow-out': <path d="M8 16l8-8M9.5 8H16v6.5" />,
  copy: <path d="M9 9V5.5h9.5V15H15M5.5 9H15v9.5H5.5z" />,
  check: <path d="M5.5 12.5l4.25 4.25L18.5 7.5" />,
  theme: <><circle cx="12" cy="12" r="8.25" /><path d="M12 3.75a8.25 8.25 0 0 0 0 16.5z" fill="currentColor" /></>,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {shapes[name]}
    </svg>
  );
}
