// Printed barcodes for product and shelf-edge labels (productscan.md §2.5): real EAN-13 / EAN-8 bars (a UPC-A prints
// as EAN-13) drawn as SVG, with the product name, price and the number under the bars.
import { eanBits } from '../lib/barcode';

/** EAN bars as SVG. Guard bars run longer, as on a printed pack. Custom codes that are not EAN show the number only. */
export function BarcodeSvg({ code, height = 46, className = '' }: { code: string; height?: number; className?: string }) {
  const e = eanBits(code);
  if (!e) return <span className={`font-mono text-xs ${className}`}>{code}</span>;
  const n = e.bits.length; const guards = n === 95 ? [0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94] : [0, 1, 2, 31, 32, 33, 34, 35, 64, 65, 66];
  return (
    <svg viewBox={`0 0 ${n + 18} ${height + 12}`} className={className} role="img" aria-label={`Barcode ${e.text}`} preserveAspectRatio="none">
      <rect width={n + 18} height={height + 12} fill="#fff" />
      {[...e.bits].map((b, i) => (b === '1' ? <rect key={i} x={i + 9} y={0} width={1} height={guards.includes(i) ? height + 5 : height} fill="#000" /> : null))}
      <text x={(n + 18) / 2} y={height + 11} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.5">{e.text}</text>
    </svg>
  );
}

export type LabelItem = { name: string; price: string; code: string };
/**
 * A sheet of labels (each about 50 × 30 mm: name, price, bars and number). Inputs: the label, how many, and print:
 * true for the copy that prints (it carries .print-doc and only shows when printing), false for an on-screen preview.
 */
export function LabelSheet({ item, count, print = false }: { item: LabelItem; count: number; print?: boolean }) {
  return (
    <div className={`${print ? 'print-doc hidden print:grid' : 'grid'} gap-[2mm] bg-white p-[4mm]`} style={{ gridTemplateColumns: 'repeat(auto-fill, 50mm)' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-[50mm] h-[30mm] border border-dashed border-[#bbb] rounded-[1.5mm] px-[2mm] py-[1.5mm] flex flex-col items-center justify-between overflow-hidden" style={{ breakInside: 'avoid' }}>
          <span className="w-full flex justify-between gap-1 text-[7.5pt] leading-tight"><b className="truncate">{item.name}</b><b className="flex-none">{item.price}</b></span>
          <BarcodeSvg code={item.code} className="w-[44mm] h-[19mm]" />
        </div>
      ))}
    </div>
  );
}
