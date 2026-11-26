// A real, scannable QR code (lib/qr.ts) drawn as an SVG. Used by the HR time clock (gate poster, badges,
// ID cards) and on till receipts (the sale number, so a return can be found by scanning).
import { useMemo } from 'react';
import { qrMake } from '../lib/qr';
import { cx } from '../lib/format';

/**
 * A real, scannable QR code (prototype look on screen: 230 × 230 px white box, 1 px #ebebeb border, 16 px radius).
 * When printed (.hr-print) the box grows to 6 cm with a quiet zone of 4 modules, as scanners need.
 * Inputs: the text to encode; px (screen size) or size (a print size such as "12cm"); label (for screen readers).
 *
 * Why SVG and not coloured squares: browsers leave out background colours when printing unless "Background graphics"
 * is ticked (it is off by default), so a QR made of coloured boxes printed as an empty square. SVG shapes are content,
 * not background, so the black modules always print. All dark modules are one path, drawn with crispEdges so the
 * edges stay sharp at any size and a scanner sees clean squares with no hairline gaps between modules.
 */
export function QrBox({ text, px = 230, size, label, className }: { text: string; px?: number; size?: string; label: string; className?: string }) {
  const q = useMemo(() => qrMake(text), [text]);
  // One SVG path for every dark module: each row's runs of dark modules become one rectangle ("M x y h w v 1 h -w z").
  const d = useMemo(() => {
    if (!q) return '';
    let out = '';
    q.rows.forEach((r, y) => {
      for (let x = 0; x < q.size; x++) {
        if (!r[x]) continue;
        let w = 1; while (x + w < q.size && r[x + w]) w++;
        out += `M${x} ${y}h${w}v1h-${w}z`; x += w - 1;
      }
    });
    return out;
  }, [q]);
  if (!q) return <div className="text-sm text-danger">This code is too long to show as a QR code.</div>;
  // size (e.g. "12cm" for a printed poster): the box is that size with a white quiet zone of exactly 4 modules round
  // the code (padding = 4 × box ÷ (modules + 8)). Otherwise px on screen.
  const box = size ? { width: size, height: size, padding: `calc(${size} * 4 / ${q.size + 8})` } : { width: px, height: px, padding: Math.max(8, Math.round(px * 0.052)) };
  return (
    <div role="img" aria-label={label} className={cx(size ? 'bg-white flex-none' : 'hr-qr bg-white border border-[#ebebeb] rounded-2xl flex-none', className)} style={{ ...box, boxSizing: 'border-box', ['--n' as string]: q.size } as React.CSSProperties}>
      <svg viewBox={`0 0 ${q.size} ${q.size}`} width="100%" height="100%" shapeRendering="crispEdges" aria-hidden style={{ display: 'block' }}>
        <rect width={q.size} height={q.size} fill="#ffffff" />
        <path d={d} fill="#000000" />
      </svg>
    </div>
  );
}
