import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

// Uppercase fits the alphanumeric mode, so a BOLT11 invoice makes a smaller, easier-to-scan code.
export function qrModules(text: string): boolean[][] {
  const upper = text.toUpperCase();
  const code = qrcode(0, 'M');
  code.addData(upper, /^[0-9A-Z $%*+\-./:]*$/.test(upper) ? 'Alphanumeric' : 'Byte');
  code.make();
  const count = code.getModuleCount();
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => code.isDark(row, col)));
}

export function Qr({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const modules = qrModules(text);
    let d = '';
    modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return { size: modules.length + 8, path: d };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#f4f4f1" />
      <path d={path} fill="#0b0b0c" />
    </svg>
  );
}
