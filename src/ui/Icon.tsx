import type { ReactNode } from 'react';

// Drawn on a 24 grid with a 1.5 stroke. The seven state names match docs/design-system.md.
const shapes: Record<string, ReactNode> = {
  'tray-down': <path d="M12 4v10.5M8 10.5l4 4 4-4M4.5 15v4.5h15V15" />,
  'three-line-bracket': <path d="M4 6h9M4 12h9M4 18h9M16 5h3.5v14H16" />,
  'pen-nib': <><path d="M12 3l5 10-2.5 6h-5L7 13l5-10zM12 3v8.5M9.5 21.5h5" /><circle cx="12" cy="13" r="1.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.25" /><path d="M12 7.5V12l3 2" /></>,
  'circle-check': <><circle cx="12" cy="12" r="8.25" /><path d="M8.25 12.25l2.6 2.6 4.9-5.35" /></>,
  'counterclockwise-arrow': <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9" />,
  'tray-left': <path d="M20 12H9.5M13.5 8l-4 4 4 4M9 4.5H4.5v15H9" />,

  // Outside the seven: an unfilled slot, a quote waiting for its deposit, a group that cannot close.
  'slot-open': <circle cx="12" cy="12" r="8.25" strokeDasharray="2.6 3.2" />,
  awaiting: <><circle cx="12" cy="12" r="8.25" strokeDasharray="2.6 3.2" /><path d="M12 8v7.5M9.25 12.75L12 15.5l2.75-2.75" /></>,
  'bracket-open': <path d="M4 6h9M4 12h9M4 18h5M16 5h3.5v4.5M19.5 14.5V19H16" />,

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
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {shapes[name]}
    </svg>
  );
}
