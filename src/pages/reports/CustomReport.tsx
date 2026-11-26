// Custom report tab (Reports → Custom report): search for anything to report on, pick a period with
// the date picker, choose the branch, and the report sheet builds next to it.
import { useMemo, useState } from 'react';
import { cx } from '../../lib/format';
import { Card, Pills } from '../finance/shared';
import ReportDoc from './ReportDoc';
import { DEFS, FOCUS_LABEL, KEYWORDS, focusOptions, focusReport, type Def, type Focus, type FocusKind, type Opts } from './engine';

/** What the report is about: one of the ready-made reports, or one specific thing (product, customer …). */
type Pick = { t: 'def'; id: string } | { t: 'focus'; f: Focus };

/** Local calendar date as the date picker's "YYYY-MM-DD" value (toISOString would give the UTC date). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAY = 864e5;

/** Quick periods for the date picker, each as [key, label, from, to], worked out from today's date. */
function presets(): [string, string, string, string][] {
  const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const ago = (d: number) => iso(new Date(t.getTime() - d * DAY));
  return [
    ['today', 'Today', iso(t), iso(t)],
    ['yday', 'Yesterday', ago(1), ago(1)],
    ['7d', 'Last 7 days', ago(6), iso(t)],
    ['30d', 'Last 30 days', ago(29), iso(t)],
    ['month', 'This month', iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)],
    ['lmonth', 'Last month', iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))],
    ['year', 'This year', iso(new Date(t.getFullYear(), 0, 1)), iso(t)],
  ];
}

/** Lower-case search words; every word must appear for a result to match. */
const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const FOCUS_ORDER: FocusKind[] = ['product', 'category', 'customer', 'staff', 'method'];
const PER_GROUP = 5;

/**
 * Inputs: avail → reports this user may run (Admin-only ones already removed); o / setO → shared branch choice;
 *         brOpts → branches this user may pick (a branch user gets only their own); SU → signed in as Admin;
 *         by → name printed as "Prepared by".
 * Output: the search + date + branch panel and the live report sheet.
 */
export default function CustomReport({ avail, o, setO, brOpts, SU, by }: { avail: Def[]; o: Opts; setO: (o: Opts) => void; brOpts: [string, string][]; SU: boolean; by: string }) {
  const P = presets();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Pick>({ t: 'def', id: avail.some((d) => d.id === 'byproduct') ? 'byproduct' : avail[0].id });
  const [from, setFrom] = useState(P[3][2]);
  const [to, setTo] = useState(P[3][3]);

  // Searchable things depend on the branch: a branch user only sees their own branch's staff and customers.
  const things = useMemo(() => focusOptions(o.br), [o.br]);
  const w = words(q);
  const defHits = avail.filter((d) => { const hay = `${d.name} ${d.desc} ${d.mod} ${KEYWORDS[d.id] ?? ''}`.toLowerCase(); return w.every((x) => hay.includes(x)); });
  // A word may match the kind as well as the name: "customer kofi" finds the customer Kofi, "staff" lists staff.
  // Best matches first: exact name, then names starting with the search, then a word starting with it, then the rest
  // with ties going to the shorter, closer name (so "momo" puts "MTN MoMo" ahead of "Cash + MoMo").
  const ql = q.trim().toLowerCase();
  const rank = (v: string) => { const s = v.toLowerCase(); return s === ql ? 0 : s.startsWith(ql) ? 1 : s.split(/[^a-z0-9]+/).some((x) => x.startsWith(ql)) ? 2 : 3; };
  const focusHits = w.length ? things.filter((f) => { const hay = `${f.value} ${FOCUS_LABEL[f.kind]}`.toLowerCase(); return w.every((x) => hay.includes(x)); }).sort((x, y) => rank(x.value) - rank(y.value) || x.value.length - y.value.length) : [];
  // Reports that match but this user may not run (cost/profit reports are Admin only): named so they know why.
  const lockedHits = w.length ? DEFS.filter((d) => !avail.includes(d) && w.every((x) => `${d.name} ${d.desc} ${d.mod} ${KEYWORDS[d.id] ?? ''}`.toLowerCase().includes(x))) : [];
  const first: Pick | null = defHits[0] ? { t: 'def', id: defHits[0].id } : focusHits[0] ? { t: 'focus', f: focusHits[0] } : null;

  const choose = (p: Pick) => { setPick(p); setQ(''); };
  const def = pick.t === 'def' ? avail.find((d) => d.id === pick.id) ?? avail[0] : null;
  const pickTitle = def ? def.name : pick.t === 'focus' ? pick.f.value : '';
  const pickSub = def ? `${def.mod} report · ${def.desc}` : pick.t === 'focus' ? `${FOCUS_LABEL[pick.f.kind]} · sales for this ${FOCUS_LABEL[pick.f.kind].toLowerCase()} over the dates below` : '';

  // Dates: the pickers stop From going past To, but keep the report sensible even if a date is typed in.
  const [a, b] = from <= to ? [from, to] : [to, from];
  const days = Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY) + 1;
  const activePreset = P.find((x) => x[2] === a && x[3] === b)?.[0];
  const opts: Opts = { ...o, from: a, to: b };
  const report = def ? def.run(opts) : pick.t === 'focus' ? focusReport(pick.f, opts) : avail[0].run(opts);

  /** One clickable search result. */
  const Row = ({ p, title, sub }: { p: Pick; title: string; sub: string }) => (
    <button onClick={() => choose(p)} className="text-left px-3 py-2 rounded-xl hover:bg-canvas focus-visible:bg-canvas flex flex-col">
      <b className="text-sm">{title}</b><span className="text-xs text-muted">{sub}</span>
    </button>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr] items-start">
      <Card title="Custom report" sub="Search for anything, pick the dates · the report builds on the right">
        {/* 1 · Subject: search reports and specific things from the records. */}
        <label htmlFor="cr-q" className="text-[13px] font-semibold">1 · What do you want a report on?</label>
        <div className="relative">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="cr-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && first) choose(first); if (e.key === 'Escape') setQ(''); }}
            placeholder="e.g. TV, VAT, Kofi, MoMo, money owed" autoComplete="off" aria-describedby="cr-hint" className="field py-2.5 pl-10" />
        </div>
        <span id="cr-hint" className="text-xs text-muted">Search a report, product, category, customer, staff member or payment method. Press Enter to pick the top match.</span>

        {/* Current subject. */}
        <div className="p-3 rounded-2xl bg-brand-50 flex flex-col gap-0.5" aria-live="polite">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">Reporting on</span>
          <b className="text-sm">{pickTitle}</b>
          <span className="text-xs text-muted">{pickSub}</span>
        </div>

        {/* Results (or suggestions while the box is empty). */}
        <div role="region" aria-label="Search results" className="flex flex-col gap-2 max-h-[340px] overflow-y-auto -mx-1 px-1">
          {!w.length && <>
            <span className="text-xs font-semibold text-muted uppercase">Popular reports</span>
            {avail.slice(0, 6).map((d) => <Row key={d.id} p={{ t: 'def', id: d.id }} title={d.name} sub={`${d.mod} · ${d.desc}`} />)}
          </>}
          {w.length > 0 && defHits.length > 0 && <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted uppercase px-1 pb-1">Reports</span>
            {defHits.slice(0, 8).map((d) => <Row key={d.id} p={{ t: 'def', id: d.id }} title={d.name} sub={`${d.mod} · ${d.desc}`} />)}
          </div>}
          {w.length > 0 && FOCUS_ORDER.map((k) => { const hs = focusHits.filter((f) => f.kind === k); return hs.length ? (
            <div key={k} className="flex flex-col">
              <span className="text-xs font-semibold text-muted uppercase px-1 pb-1">{FOCUS_LABEL[k]}{hs.length > 1 && k !== 'method' ? 's' : ''}</span>
              {hs.slice(0, PER_GROUP).map((f) => <Row key={k + f.value} p={{ t: 'focus', f }} title={f.value} sub={`Report on this ${FOCUS_LABEL[k].toLowerCase()}`} />)}
              {hs.length > PER_GROUP && <span className="text-xs text-muted px-3 py-1">+{hs.length - PER_GROUP} more · keep typing to narrow it down</span>}
            </div>) : null; })}
          {lockedHits.length > 0 && <span className="text-xs text-muted px-1">🔒 {lockedHits.map((d) => d.name).join(', ')} {lockedHits.length === 1 ? 'is' : 'are'} for the Admin only.</span>}
          {w.length > 0 && !defHits.length && !focusHits.length && !lockedHits.length && <span className="text-sm text-muted px-1">Nothing matches “{q}”. Try a shorter word, a product or a customer’s first name.</span>}
        </div>

        {/* 2 · Period: quick choices plus From / To date pickers for any period. */}
        <span className="text-[13px] font-semibold">2 · Which dates?</span>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Quick periods">
          {P.map(([k, l, f, t]) => <button key={k} onClick={() => { setFrom(f); setTo(t); }} aria-pressed={activePreset === k} className={cx('text-xs px-3 py-1.5 rounded-full border', activePreset === k ? 'bg-black text-white border-black font-semibold' : 'border-line hover:bg-canvas')}>{l}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold flex flex-col gap-1">From<input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal" /></label>
          <label className="text-xs font-semibold flex flex-col gap-1">To<input type="date" value={to} min={from} max={P[0][3]} onChange={(e) => e.target.value && setTo(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal" /></label>
        </div>
        <span className="text-xs text-muted">{activePreset ? P.find((x) => x[0] === activePreset)![1] : 'Custom period'} · {days} day{days === 1 ? '' : 's'}</span>

        {/* 3 · Branch: Admin can pick any branch; a branch user is locked to their own. */}
        <span className="text-[13px] font-semibold">3 · Which branch?</span>
        <Pills small opts={brOpts} value={o.br} onChange={(v) => setO({ ...o, br: v })} />
        {!SU && <span className="text-xs text-muted">🔒 You can report on your own branch only.</span>}
      </Card>
      <ReportDoc r={report} by={by} />
    </div>
  );
}
