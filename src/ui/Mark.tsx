type Slab = [x: number, y: number, width: number, height: number];

const drawings: Record<'large' | 'small', { grid: number; radius: number; slabs: Slab[] }> = {
  large: { grid: 48, radius: 1.5, slabs: [[15, 9, 20, 6], [10, 17.5, 24, 6], [13, 26, 27, 6], [8, 34.5, 29, 6]] },
  // Thicker slabs and wider gaps, for anything drawn under 32px.
  small: { grid: 16, radius: 0.6, slabs: [[5, 2, 7, 2.5], [3, 5.5, 8.5, 2.5], [4.5, 9, 9, 2.5], [2.5, 12.5, 10, 2.5]] },
};

export function Mark({ size = 'small', className }: { size?: 'large' | 'small'; className?: string }) {
  const { grid, radius, slabs } = drawings[size];
  return (
    <svg className={className} viewBox={`0 0 ${grid} ${grid}`} fill="currentColor" aria-hidden="true" focusable="false">
      {slabs.map(([x, y, width, height]) => <rect key={y} x={x} y={y} width={width} height={height} rx={radius} />)}
    </svg>
  );
}
