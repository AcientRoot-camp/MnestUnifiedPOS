// Report sheet shown on the Reports tab: toolbar plus a printable, letterheaded report document.
import { useState } from 'react';
import { COMPANY } from '../../data/hirePurchase';
import { cx } from '../../lib/format';
import { Pills } from '../finance/shared';
import { download } from '../money/ui';
import { toCsv, type Report } from './engine';
import CompanyLogo from '../../components/CompanyLogo';

/**
 * A printable report sheet with its toolbar (paper, orientation, export, share, print).
 * Inputs: r → the report (title, scope, KPIs, optional chart, table); by → who generated it;
 *         extra → optional extra toolbar controls.
 * Output: the toolbar plus an A4/Letter-styled sheet that prints on its own (.print-doc).
 */
export default function ReportDoc({ r, by, extra }: { r: Report; by: string; extra?: React.ReactNode }) {
  const [paper, setPaper] = useState<'a4' | 'letter'>('a4');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const max = Math.max(1, ...(r.chart?.bars.map((b) => b.v) ?? [1]));
  // Report scopes are built as "<period> · <branch>" (engine.ts scopeTxt); split them into labelled fields,
  // falling back to a single "Scope" field for any report whose scope is worded differently.
  const sc = r.scope.split(' · ');
  const scopeMeta: [string, string][] = sc.length === 2 ? [['Period', sc[0]], ['Branch', sc[1]]] : [['Scope', r.scope]];
  const meta: [string, string][] = [
    ...scopeMeta,
    ['Generated', new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
    ['Prepared by', by],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="no-print flex gap-3 flex-wrap items-center">
        <span className="text-xs font-semibold">Paper</span><Pills small opts={[['a4', 'A4'], ['letter', 'Letter']]} value={paper} onChange={setPaper} />
        <span className="text-xs font-semibold">Orientation</span><Pills small opts={[['portrait', '▯ Portrait'], ['landscape', '▭ Landscape']]} value={orient} onChange={setOrient} />
        <span className="flex-1" />
        <button onClick={() => download(`${r.title.toLowerCase().replace(/\W+/g, '-')}.csv`, toCsv(r))} className="btn-ghost min-h-9 text-xs">Download CSV</button>
        <button onClick={() => download(`${r.title.toLowerCase().replace(/\W+/g, '-')}.xls`, toCsv(r))} className="btn-ghost min-h-9 text-xs">Excel</button>
        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${r.title} · Ebenezer Unique Ventures\n${r.kpis.map((k) => `${k.label}: ${k.value}`).join('\n')}\nFull report attached as PDF.`)}`, '_blank', 'noopener')} className="btn-ghost min-h-9 text-xs">Send on WhatsApp</button>
        <a href={`mailto:?subject=${encodeURIComponent(r.title + ' · Ebenezer Unique Ventures')}&body=${encodeURIComponent(r.kpis.map((k) => `${k.label}: ${k.value}`).join('\n') + '\n\nThe full report is attached as a PDF.')}`} className="btn-ghost min-h-9 text-xs">Send by email</a>
        <button onClick={() => window.print()} className="btn-primary min-h-9 text-xs">Print / save as PDF</button>
        {extra}
      </div>
      <style>{`@media print{@page{size:${paper === 'a4' ? 'A4' : 'letter'} ${orient};margin:12mm}}`}</style>
      <article className={cx('print-doc bg-white rounded-2xl shadow-card p-5 sm:p-8 text-[12px] mx-auto w-full', orient === 'landscape' ? 'max-w-[1100px]' : 'max-w-[820px]')}>
        {/* Sheet header: letterhead (logo + company details) on the left, report title on the right,
            then a labelled details strip, then the brand rule that separates the header from the body. */}
        <header className="mb-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <CompanyLogo className="w-[72px] h-[72px] flex-none" alt={`${COMPANY.name} logo`} />
              <div className="flex flex-col gap-0.5 min-w-0 text-[11px] leading-snug text-sub">
                <strong className="text-[17px] leading-tight text-black mb-0.5">{COMPANY.name}</strong>
                <span>{COMPANY.addr}</span>
                <span>Tel: {COMPANY.tel}</span>
                <span>{COMPANY.email} · {COMPANY.web}</span>
              </div>
            </div>
            {/* Right-aligned beside the letterhead; on narrow screens it drops below and aligns left instead. */}
            <div className="flex flex-col gap-1 sm:items-end sm:text-right sm:ml-auto">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{r.kicker ?? 'Report'}</span>
              <h2 className="m-0 text-[22px] leading-tight font-bold text-brand">{r.title}</h2>
            </div>
          </div>
          {/* Details strip: 1px gaps over a line-coloured background draw even cell borders at any column count. */}
          <dl className="m-0 mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden">
            {meta.map(([k, v]) => (
              <div key={k} className="bg-white px-3 py-2 flex flex-col gap-0.5 min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{k}</dt>
                <dd className="m-0 text-[12px] font-semibold text-black break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <div aria-hidden className="h-[3px] mt-5 rounded-full bg-brand" />
        </header>
        {r.text && <p className="m-0 mb-3 text-sm">{r.text}</p>}
        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(4, r.kpis.length)}, minmax(0,1fr))` }}>{r.kpis.map((k) => <div key={k.label} className="p-3 rounded-xl bg-canvas"><span className="text-[11px] text-muted">{k.label}</span><br /><b className="text-base">{k.value}</b>{k.sub && <><br /><span className="text-[11px] text-muted">{k.sub}</span></>}</div>)}</div>
        {r.chart && <div className="mb-4"><b className="text-xs">{r.chart.title}</b><div className="flex items-end gap-1 h-32 mt-2 overflow-x-auto">{r.chart.bars.map((b, i) => <div key={i} className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full gap-1" title={`${b.lb}: ${b.v.toFixed(2)}`}><div className="w-full bg-brand rounded-t" style={{ height: `${(b.v / max) * 100}%`, minHeight: b.v ? 2 : 0 }} /><span className="text-[9px] text-muted">{b.lb}</span></div>)}</div></div>}
        {/* On phones a wide table scrolls sideways on its own instead of stretching the whole sheet (and header) off-screen. */}
        <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="bg-brand text-white">{r.table.cols.map((c) => <th key={c} className="text-left p-1.5 font-semibold">{c}</th>)}</tr></thead><tbody>{r.table.rows.map((row, i) => <tr key={i} className={i % 2 ? 'bg-canvas/60' : ''}>{row.map((c, j) => <td key={j} className="p-1.5 border-b border-line">{c}</td>)}</tr>)}</tbody></table></div>
        {!r.table.rows.length && <p className="text-center text-muted py-6">Nothing in this period.</p>}
        <div className="flex justify-between text-[10px] text-muted mt-6"><span>{COMPANY.name} · {r.title} · {r.scope}</span><span>Page 1 of 1</span></div>
      </article>
    </div>
  );
}
