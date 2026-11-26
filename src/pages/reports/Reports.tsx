import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BRS } from '../../data/catalogue';
import { PEOPLE } from '../../data/nav';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import { Head } from '../money/ui';
import { DEFS, MODS, PERIODS, salesIn, type Opts, type Period } from './engine';
import ReportDoc from './ReportDoc';
import CrmReports from '../crm/Reports';
import CustomReport from './CustomReport';

const TABS: [string, string][] = [['live', 'Generate a report'], ['overview', 'Snapshot'], ['system', 'Reference reports'], ['builder', 'Custom report'], ['crm', 'CRM']];

export default function Reports() {
  const { tab } = useParams();
  const nav = useNavigate();
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const by = role === 'developer' ? 'MNest UnifiedPOS Support' : `${PEOPLE[role].name} (${PEOPLE[role].level})`;
  // Support opens reports from the side menu by branch: /reports/br-all, /reports/br-osu … (sales figures only, never cost or profit).
  const DEV = role === 'developer';
  const devBr = tab?.startsWith('br-') ? tab.slice(3) : '';
  const T0 = tab && TABS.some((t) => t[0] === tab) ? tab : 'live';
  const [o, setO] = useState<Opts>({ period: '30d', br: devBr || (SU ? viewBranch : DEV ? 'all' : session?.branch ?? 'osu') });
  useEffect(() => { if (devBr) setO((x) => ({ ...x, br: devBr })); }, [devBr]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('daily');
  const [mod, setMod] = useState(MODS[0]);
  const [gen, setGen] = useState(false);
  const [ask, setAsk] = useState('');
  const [groupBy, setGroupBy] = useState<'branch' | 'channel' | 'staff' | 'method'>('branch');
  const avail = DEFS.filter((d) => SU || !d.admin);
  const def = avail.find((d) => d.id === sel) ?? avail[0];
  const brOpts: [string, string][] = SU || DEV ? [['all', 'All branches'], ...BRS.map((b) => [b.id, b.name] as [string, string])] : [[o.br, BRS.find((b) => b.id === o.br)?.name ?? o.br]];
  const L = salesIn(o);
  const tot = L.reduce((a, s) => a + s.total, 0);
  const grp = (k: (s: (typeof L)[number]) => string) => Object.entries(L.reduce<Record<string, [number, number]>>((a, s) => { const x = k(s); a[x] = a[x] || [0, 0]; a[x][0] += s.total; a[x][1]++; return a; }, {})).sort((a, b) => b[1][0] - a[1][0]);
  const Controls = () => (
    <div className="flex gap-4 flex-wrap items-center">
      <span className="text-xs font-semibold">Period</span><Pills small opts={PERIODS} value={o.period} onChange={(v: Period) => setO({ ...o, period: v, from: undefined, to: undefined })} />
      <span className="text-xs font-semibold">Branch</span><Pills small opts={brOpts} value={o.br} onChange={(v) => setO({ ...o, br: v })} />
    </div>
  );

  return (
    <>
      <Head title="Reports" sub="Every channel from one database: no reconciliation between shop and website" />
      <div role="tablist" className="flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={T0 === k} onClick={() => nav(k === 'live' ? '/reports' : `/reports/${k}`)} className={cx('text-sm px-3.5 py-2 rounded-full whitespace-nowrap', T0 === k ? 'bg-black text-white font-semibold' : 'text-sub hover:bg-canvas')}>{l}</button>)}
      </div>

      {T0 === 'live' && (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr] items-start">
          <Card title="Pick a report" sub={`${avail.length} reports · built from your own data`}>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Search reports<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. VAT, stock, credit" className="field py-2 font-normal" /></label>
            {MODS.map((m) => { const rs = avail.filter((d) => d.mod === m && (!q || (d.name + d.desc + d.mod).toLowerCase().includes(q.toLowerCase()))); return rs.length ? <div key={m} className="flex flex-col gap-1"><span className="text-xs font-semibold text-muted uppercase">{m}</span>{rs.map((d) => <button key={d.id} onClick={() => setSel(d.id)} aria-pressed={def.id === d.id} className={cx('text-left p-2.5 rounded-xl text-sm', def.id === d.id ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}><b>{d.name}</b><br /><span className="text-xs text-muted">{d.desc}</span></button>)}</div> : null; })}
            {!avail.some((d) => !q || (d.name + d.desc + d.mod).toLowerCase().includes(q.toLowerCase())) && <span className="text-sm text-muted">No report matches that. Clear the search to see all of them.</span>}
          </Card>
          <div className="flex flex-col gap-4 min-w-0"><Card title={def.name} sub={def.desc}><Controls /></Card><ReportDoc r={def.run(o)} by={by} /></div>
        </div>
      )}

      {T0 === 'overview' && (
        <>
          <Controls />
          <Card title="Ask a question about your sales">
            <div className="flex gap-2"><input aria-label="Ask a question" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask anything, e.g. best seller last month in Kumasi?" className="field py-2.5" /></div>
            {ask.trim().length > 3 && (() => { const top = grp((s) => s.lines[0].name)[0]; const br = grp((s) => s.br)[0]; return <span className="text-sm p-3 rounded-2xl bg-brand-50">Best seller in {PERIODS.find((p) => p[0] === o.period)?.[1].toLowerCase()} was <b>{top?.[0]}</b> ({ghs(top?.[1][0] ?? 0)}). The busiest branch was <b>{BRS.find((b) => b.id === br?.[0])?.name}</b> with {ghs(br?.[1][0] ?? 0)} from {br?.[1][1]} sales.</span>; })()}
          </Card>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">{[['Total sold', ghs(tot)], ['Sales', String(L.length)], ['Average sale', ghs(L.length ? tot / L.length : 0)], ...(SU ? [['Gross profit', ghs(tot * 0.2)]] : [])].map(([l, v]) => <div key={l} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><strong className="text-[24px] font-medium tracking-tightest">{v}</strong></div>)}</div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Sales by channel">{grp((s) => (s.ch === 'web' ? 'Website' : 'Till')).map(([k, [v]]) => <div key={k} className="flex flex-col gap-1"><div className="flex justify-between text-sm"><span>{k}</span><b>{ghs(v)} · {((v / tot) * 100).toFixed(0)}%</b></div><div className="h-2 rounded-full bg-canvas"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / tot) * 100}%` }} /></div></div>)}</Card>
            <Card title="Takings by payment method"><T head={['Method', 'Taken', 'Settled / counted']} rows={grp((s) => (s.method === 'CREDIT' ? 'Credit' : s.method)).map(([k, [v]]) => [k, ghs(v), k === 'Credit' ? 'Owed' : '✓'])} /></Card>
            <Card title="Top products">{Object.entries(L.flatMap((x) => x.lines).reduce<Record<string, [number, number]>>((a, l) => { const c = a[l.name] || [0, 0]; a[l.name] = [c[0] + l.qty * l.each, c[1] + l.qty]; return a; }, {})).sort((a, b) => b[1][0] - a[1][0]).slice(0, 6).map(([n, [v, q]], k) => <div key={n} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span>{k + 1}. {n} <span className="text-xs text-muted">· {q} sold</span></span><b>{ghs(v)}</b></div>)}</Card>
            <Card title="Website & customers">{(() => { const web = L.filter((x) => x.ch === 'web'); const named = L.filter((x) => x.cust !== 'Walk-in'); const per = named.reduce<Record<string, number>>((a, x) => { a[x.cust] = (a[x.cust] || 0) + 1; return a; }, {}); const repeat = Object.values(per).filter((n) => n > 1).length; return [['Website orders', `${web.length} · ${ghs(web.reduce((a, x) => a + x.total, 0))}`], ['Share of sales online', `${L.length ? ((web.length / L.length) * 100).toFixed(1) : 0}%`], ['Named customers', String(Object.keys(per).length)], ['Came back more than once', String(repeat)], ['Walk-in sales', String(L.length - named.length)]].map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span>{k}</span><b>{v}</b></div>); })()}</Card>
          </div>
          <Card title="Build your own report" sub="Pick what to group by">
            <Pills small opts={[['branch', 'Branch'], ['channel', 'Channel'], ['staff', 'Staff'], ['method', 'Payment method']]} value={groupBy} onChange={setGroupBy} />
            <T head={[groupBy[0].toUpperCase() + groupBy.slice(1), 'Sales', 'Orders']} rows={grp((s) => (groupBy === 'branch' ? BRS.find((b) => b.id === s.br)!.name : groupBy === 'channel' ? s.ch : groupBy === 'staff' ? s.staff : s.method)).map(([k, [v, n]]) => [k, ghs(v), String(n)])} />
          </Card>
        </>
      )}

      {T0 === 'crm' && <CrmReports />}
      {T0 === 'system' && (
        <div className="grid gap-6 xl:grid-cols-[260px_1fr] items-start">
          <Card title="Modules">{MODS.map((m) => <button key={m} onClick={() => { setMod(m); setGen(false); }} aria-pressed={mod === m} className={cx('flex justify-between text-sm p-2 rounded-xl', mod === m ? 'bg-black text-white' : 'hover:bg-canvas')}><span>{m}</span><span>{DEFS.filter((d) => d.mod === m).length}</span></button>)}</Card>
          <div className="flex flex-col gap-4 min-w-0">
            <Card title={`${mod} reports`}>{DEFS.filter((d) => d.mod === mod).map((d) => <button key={d.id} onClick={() => { setSel(d.id); setGen(false); }} aria-pressed={sel === d.id} className={cx('text-left p-3 rounded-2xl border', sel === d.id ? 'border-brand bg-brand-50' : 'border-line')}><b className="text-sm">{d.name}</b>{d.admin && <span className="pill bg-black text-white ml-2">Admin only</span>}<br /><span className="text-xs text-muted">{d.desc} · needs {d.perm}</span></button>)}</Card>
            {DEFS.find((d) => d.id === sel && d.mod === mod) && (() => { const d = DEFS.find((x) => x.id === sel)!; const locked = !!d.admin && !SU; return <Card title={d.name}><Controls />{locked && <span className="text-sm text-danger">This report shows cost or profit · Admin only</span>}<button disabled={locked} onClick={() => setGen(true)} className="btn-primary w-fit">Generate report</button>{gen && !locked && <ReportDoc r={d.run(o)} by={by} />}</Card>; })()}
          </div>
        </div>
      )}

      {/* Custom report: search anything + date picker (CustomReport.tsx). */}
      {T0 === 'builder' && <CustomReport avail={avail} o={o} setO={setO} brOpts={brOpts} SU={SU} by={by} />}
    </>
  );
}
