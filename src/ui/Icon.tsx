// 24px grid, 1.75 stroke, round caps. Money is a slab, so there is no coin or padlock here.
const paths: Record<string, string> = {
  pleb: 'M12 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6',
  maintainer: 'M12 3.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6M6.5 15.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8M5 19.5h14',
  mint: 'M4 9L12 4L20 9M6 11V18M10 11V18M14 11V18M18 11V18M3.5 20.5H20.5',
  key: 'M8 9a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7M11.5 12.5H20M17 12.5V15.5M20 12.5V15',
  nib: 'M12 3L18 9L15.5 17H8.5L6 9ZM12 3V11M10.5 12.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M8.5 20H15.5',
  info: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17M12 11V16.5M12 7.75V8',
  check: 'M5 12.5L10 17L19 7.5',
  swap: 'M7 7H18L15 4M17 17H6L9 20',
};

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className ?? 'icon'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
