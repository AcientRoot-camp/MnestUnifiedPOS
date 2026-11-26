// Displays a product description written in the shared format (lib/describe.ts): opening paragraphs, Highlights as
// a ticked list, Specifications as a two-column table and other headed sections as text. Used by the online store
// product page, quick view and the POS (Products editor preview, Sell Now product info), so the same text looks the
// same everywhere.
import { parseDescription, type DescSection } from '../lib/describe';

/** One section's body: ticked bullets, a specification table and/or paragraphs. */
export function SectionBody({ s, dense = false }: { s: DescSection; dense?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {s.paras.map((t, i) => <p key={i} className={dense ? 'm-0 text-[13px] leading-6 text-sub' : 'm-0 text-[15px] leading-7 text-sub'}>{t}</p>)}
      {s.bullets.length > 0 && <ul className="m-0 p-0 list-none flex flex-col gap-1.5">{s.bullets.map((b) => <li key={b} className={dense ? 'flex gap-2 text-[13px] leading-5' : 'flex gap-2.5 text-[15px] leading-6'}><span aria-hidden className="mt-[3px] w-4 h-4 flex-none rounded-full bg-black text-white text-[10px] flex items-center justify-center">✓</span><span>{b}</span></li>)}</ul>}
      {s.specs.length > 0 && <table className={dense ? 'w-full text-[13px]' : 'w-full text-sm'}><tbody>{s.specs.map(([k, v]) => <tr key={k} className="border-b border-line last:border-0"><th scope="row" className="py-2 pr-4 text-left font-medium text-muted align-top w-[40%]">{k}</th><td className="py-2 font-medium">{v}</td></tr>)}</tbody></table>}
    </div>
  );
}

/**
 * The whole description, laid out flat (POS preview, Sell Now product info, quick view).
 * Inputs: the text, dense (smaller type), max sections to show. Empty text shows nothing.
 */
export default function ProductDesc({ text, dense = false, max = 99 }: { text: string; dense?: boolean; max?: number }) {
  const d = parseDescription(text);
  if (!d.intro.length && !d.sections.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {d.intro.map((t, i) => <p key={i} className={dense ? 'm-0 text-[13px] leading-6 text-sub' : 'm-0 text-[15px] leading-7 text-sub'}>{t}</p>)}
      {d.sections.slice(0, max).map((s) => <section key={s.title} className="flex flex-col gap-2"><h3 className={dense ? 'm-0 text-[11px] font-bold tracking-[0.12em] uppercase text-muted' : 'm-0 text-base font-semibold'}>{s.title}</h3><SectionBody s={s} dense={dense} /></section>)}
    </div>
  );
}
