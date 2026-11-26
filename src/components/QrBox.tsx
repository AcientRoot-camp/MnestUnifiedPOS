// A real, scannable QR code (lib/qr.ts) drawn as a grid of squares. Used by the HR time clock (gate poster, badges,
// ID cards) and on till receipts (the sale number, so a return can be found by scanning).
import { useMemo } from 'react';
import { qrMake } from '../lib/qr';
import { cx } from '../lib/format';

/**
 * A real, scannable QR code drawn as a CSS grid of black and white squares (prototype look: 230 × 230 px white box,
 * 12 px padding, 1 px #ebebeb border, 16 px radius). When printed (.hr-print) the box grows to 6 cm with a quiet zone
 * of 4 modules, as scanners need. Inputs: the text to encode; px (screen size) or size (a print size such as "12cm");
 * label (for screen readers).
 */
export function QrBox({ text, px = 230, size, label, className }: { text: string; px?: number; size?: string; label: string; className?: string }) {
  const q = useMemo(() => qrMake(text), [text]);
  if (!q) return <div className="text-sm text-danger">This code is too long to show as a QR code.</div>;
  // size (e.g. "12cm" for a printed poster): the box is that size with a white quiet zone of exactly 4 modules round
  // the code (padding = 4 × box ÷ (modules + 8)). Otherwise px on screen.
  const box = size ? { width: size, height: size, padding: `calc(${size} * 4 / ${q.size + 8})` } : { width: px, height: px, padding: Math.max(8, Math.round(px * 0.052)) };
  return (
    <div role="img" aria-label={label} className={cx(size ? 'bg-white flex-none' : 'hr-qr bg-white border border-[#ebebeb] rounded-2xl flex-none', className)} style={{ ...box, ['--n' as string]: q.size } as React.CSSProperties}>
      <div className="grid w-full h-full" style={{ gridTemplateColumns: `repeat(${q.size}, minmax(0, 1fr))` }}>
        {q.rows.flatMap((r, y) => r.map((c, x) => <span key={y * q.size + x} style={{ background: c ? '#000000' : '#ffffff' }} />))}
      </div>
    </div>
  );
}
