import { useMemo, useState } from 'react';
import { Card, Pills, T } from '../finance/shared';
import { PEOPLE } from '../../data/nav';
import { SALES, STAFF, type Sale } from '../../data/sell';
import { usePersist } from '../../lib/persist';
import type { TillSale } from '../pos/model';
import { iso } from '../../data/finance';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';

type Per = 'day' | 'week' | 'month' | 'year' | 'custom';
const DAY = 86400000;
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const LEVEL: Record<string, string> = { 'Akua Kyei': 'Sales staff', 'Ama Darko': 'Manager', 'Kwame Asante': 'Supervisor', 'Efua Sarpong': 'Manager', 'Yaw Boateng': 'Sales staff', 'Kofi Antwi': 'Supervisor', 'Efua Mensah': 'Sales staff', 'Ebenezer Mensah': 'Admin' };

function range(per: Per, off: number, from: string, to: string): [Date, Date, string] {
  const now = new Date();
  if (per === 'custom') { const a = new Date(from), b = new Date(to); return [sod(a), new Date(sod(b).getTime() + DAY), `${a.toLocaleDateString('en-GB')} – ${b.toLocaleDateString('en-GB')}`]; }
  if (per === 'day') { const a = new Date(sod(now).getTime() + off * DAY); return [a, new Date(a.getTime() + DAY), off === 0 ? 'Today' : off === -1 ? 'Yesterday' : a.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })]; }
  if (per === 'week') { const m = sod(now); m.setDate(m.getDate() - ((m.getDay() + 6) % 7) + off * 7); const e = new Date(m.getTime() + 7 * DAY); return [m, e, off === 0 ? 'This week' : `Week of ${m.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`]; }
  if (per === 'month') { const a = new Date(now.getFullYear(), now.getMonth() + off, 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1), a.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })]; }
  const a = new Date(now.getFullYear() + off, 0, 1); return [a, new Date(a.getFullYear() + 1, 0, 1), String(a.getFullYear())];
}

export default function MySales() {
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const ME = PEOPLE[role].name;
  const [who, setWho] = useState('');
  const [per, setPer] = useState<Per>('day');
  const [off, setOff] = useState(0);
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * DAY)));
  const [to, setTo] = useState(iso(new Date()));
  const [histBy, setHistBy] = useState<'' | 'day' | 'week' | 'month' | 'year'>('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(25);
  const WHO = who || ME;
  const mine = WHO === ME;
  const pickable = role === 'superuser' ? [ME, ...STAFF.map((s) => s.name)] : role === 'manager' || role === 'supervisor' ? [ME, ...STAFF.filter((s) => s.br === (session?.branch ?? 'osu') && s.name !== ME && LEVEL[s.name] !== 'Manager').map((s) => s.name)] : [ME];
  const err = per === 'custom' && from > to ? 'The From date must be on or before the To date.' : '';
  const [A, B, rangeTxt] = range(per, off, from, to);
  const span = B.getTime() - A.getTime();
  const [till] = usePersist<TillSale[]>('ecompos.sales2', []);
  // Today's Sell Now sales plus the sales history.
  const mineS = useMemo(() => [...till.filter((t) => t.staff === WHO && t.status === 'completed').map((t): Sale => ({ no: t.no, ts: t.ts, day: new Date(t.ts).toISOString().slice(0, 10), br: t.br, staff: t.staff, cust: t.cust?.name || t.biz?.name || 'Walk-in', phone: t.cust?.phone || '', method: t.method.split(' · ')[0], lines: t.lines.map((l) => ({ name: l.name, qty: l.qty, each: l.price })), total: t.total, ch: 'till', status: 'completed', cost: 0 })), ...SALES.filter((s) => s.staff === WHO && s.status !== 'voided' && s.ch === 'till')].sort((a, b) => b.ts - a.ts), [WHO, till]);
  const L = err ? [] : mineS.filter((s) => s.ts >= A.getTime() && s.ts < B.getTime());
  const PL = mineS.filter((s) => s.ts >= A.getTime() - span && s.ts < A.getTime());
  const TOT = L.reduce((a, s) => a + s.total, 0), PTOT = PL.reduce((a, s) => a + s.total, 0);
  const ITEMS = L.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.qty, 0), 0);
  const pct = (a: number, b: number) => (b ? `${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))}%` : '—');
  const prevName = { day: 'the day before', week: 'last week', month: 'last month', year: 'last year', custom: 'the period before' }[per];
  const days = span / DAY;

  // chart buckets
  const byMonth = per === 'year' || (per === 'custom' && days > 62);
  const bars: { label: string; total: number }[] = [];
  if (per === 'day') for (let h = 7; h <= 21; h++) bars.push({ label: h > 12 ? h - 12 + 'p' : h + (h === 12 ? 'p' : 'a'), total: L.filter((s) => new Date(s.ts).getHours() === h).reduce((a, s) => a + s.total, 0) });
  else if (byMonth) { const c = new Date(A); while (c < B) { const m = c.getMonth(), y = c.getFullYear(); bars.push({ label: c.toLocaleDateString('en-GB', { month: 'short' }), total: L.filter((s) => { const d = new Date(s.ts); return d.getMonth() === m && d.getFullYear() === y; }).reduce((a, s) => a + s.total, 0) }); c.setMonth(c.getMonth() + 1); } }
  else for (let t = A.getTime(); t < B.getTime(); t += DAY) { const k = iso(new Date(t)); bars.push({ label: new Date(t).toLocaleDateString('en-GB', per === 'week' ? { weekday: 'short' } : { day: 'numeric' }), total: L.filter((s) => s.day === k).reduce((a, s) => a + s.total, 0) }); }
  const max = Math.max(1, ...bars.map((b) => b.total));

  const methods = Object.entries(L.reduce<Record<string, { n: number; t: number }>>((a, s) => { const m = s.method === 'CREDIT' ? 'Credit' : s.method; a[m] = a[m] || { n: 0, t: 0 }; a[m].n++; a[m].t += s.total; return a; }, {})).sort((a, b) => b[1].t - a[1].t);
  const top = Object.entries(L.reduce<Record<string, { q: number; t: number }>>((a, s) => { s.lines.forEach((l) => { a[l.name] = a[l.name] || { q: 0, t: 0 }; a[l.name].q += l.qty; a[l.name].t += l.qty * l.each; }); return a; }, {})).sort((a, b) => b[1].q - a[1].q).slice(0, 8);

  const HB = histBy || (per === 'custom' ? 'day' : per);
  const HN = { day: 14, week: 8, month: 12, year: 3 }[HB];
  const hist = Array.from({ length: HN }, (_, i) => {
    const [a, b, label] = range(HB as Per, -i, from, to);
    const S = mineS.filter((s) => s.ts >= a.getTime() && s.ts < b.getTime());
    const [pa, pb] = range(HB as Per, -i - 1, from, to);
    const P = mineS.filter((s) => s.ts >= pa.getTime() && s.ts < pb.getTime()).reduce((x, s) => x + s.total, 0);
    const t = S.reduce((x, s) => x + s.total, 0);
    return { i, label, count: S.length, items: S.reduce((x, s) => x + s.lines.reduce((y, l) => y + l.qty, 0), 0), avg: S.length ? t / S.length : 0, total: t, change: pct(t, P) };
  });
  const LF = L.filter((s) => !q.trim() || (s.no + ' ' + s.cust + ' ' + s.lines.map((l) => l.name).join(' ')).toLowerCase().includes(q.toLowerCase()));

  const csv = () => {
    const rows = [['Sale', 'When', 'Items', 'Customer', 'Paid by', 'Total'], ...LF.map((s) => [s.no, new Date(s.ts).toLocaleString('en-GB'), s.lines.map((l) => `${l.qty} x ${l.name}`).join('; '), s.cust, s.method, s.total.toFixed(2)])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = `my-sales-${iso(new Date())}.csv`; a.click();
  };
  const when = (s: Sale) => new Date(s.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 max-w-2xl"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{mine ? 'My sales' : `${WHO}’s sales`}</h1><p className="m-0 text-sm text-muted">{mine ? 'Everything you sold at the till' : `Everything ${WHO} (${LEVEL[WHO]}) sold at the till`} — by day, week, month, year or any dates you choose. History is kept for every trading day.</p></div>
        <div className="flex gap-2"><button onClick={csv} className="h-11 px-5 rounded-full bg-white border border-black text-sm font-semibold">Download CSV</button><button onClick={() => window.print()} className="h-11 px-5 rounded-full bg-black text-white text-sm font-semibold">Print report</button></div>
      </header>
      {pickable.length > 1 && (
        <div className="card p-4 flex flex-col gap-2">
          <span className="text-[13px] text-muted">{role === 'superuser' ? 'You are looking at your own sales. As Admin you can open anyone’s sales history.' : 'You can also open the sales history of the Supervisors and Sales staff at your branch.'}</span>
          <Pills small opts={pickable.map((n) => [n, `${n === ME ? 'Me · ' : ''}${n} (${LEVEL[n]})`] as [string, string])} value={WHO} onChange={(v) => { setWho(v === ME ? '' : v); setShown(25); }} />
        </div>
      )}
      <div className="flex gap-3 items-center flex-wrap">
        <Pills opts={[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Custom dates']]} value={per} onChange={(v) => { setPer(v); setOff(0); setHistBy(''); setShown(25); }} />
        {per !== 'custom' ? (
          <div className="flex items-center gap-2 bg-white rounded-full shadow-card px-2 py-1">
            <button aria-label="Previous" onClick={() => setOff(off - 1)} className="w-9 h-9 rounded-full hover:bg-canvas text-lg">‹</button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{rangeTxt}</span>
            <button aria-label="Next" disabled={off >= 0} onClick={() => setOff(off + 1)} className="w-9 h-9 rounded-full hover:bg-canvas text-lg disabled:opacity-35">›</button>
            {off < 0 && <button onClick={() => setOff(0)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Back to {per === 'day' ? 'today' : `this ${per}`}</button>}
          </div>
        ) : (
          <div className="flex gap-2 items-end flex-wrap">
            <label className="flex flex-col text-xs font-semibold">From<input type="date" value={from} max={iso(new Date())} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-full border border-line" /></label>
            <label className="flex flex-col text-xs font-semibold">To<input type="date" value={to} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-full border border-line" /></label>
            {([['Last 7 days', 6], ['Last 30 days', 29], ['Last 90 days', 89], ['Last 12 months', 364]] as const).map(([l, n]) => <button key={l} onClick={() => { setFrom(iso(new Date(Date.now() - n * DAY))); setTo(iso(new Date())); }} className="text-xs px-3 py-2 rounded-full border border-line bg-white">{l}</button>)}
          </div>
        )}
      </div>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {[
          { l: 'Total sold', v: ghs(TOT), s: `${pct(TOT, PTOT)} vs ${prevName} (${ghs(PTOT)})`, up: TOT >= PTOT },
          { l: 'Number of sales', v: String(L.length), s: `${pct(L.length, PL.length)} vs ${prevName}`, up: L.length >= PL.length },
          { l: 'Items sold', v: ITEMS.toLocaleString('en-GB'), s: L.length ? `${(ITEMS / L.length).toFixed(1)} items per sale` : 'No sales', up: true },
          { l: 'Average sale', v: ghs(L.length ? TOT / L.length : 0), s: `Biggest ${ghs(Math.max(0, ...L.map((s) => s.total)))}`, up: true },
        ].map((k) => <div key={k.l} className="card p-[22px] flex flex-col gap-2"><span className="text-[13px] text-muted">{k.l}</span><strong className="text-[26px] font-medium tracking-tightest">{k.v}</strong><span className={cx('text-xs', k.up ? 'text-ok' : 'text-danger')}>{k.s}</span></div>)}
      </div>
      <Card title={per === 'day' ? 'Sales by hour' : byMonth ? 'Sales by month' : 'Sales by day'} sub={rangeTxt}>
        <div className="flex items-end gap-1.5 h-48" role="img" aria-label={`Bar chart of sales in ${rangeTxt}`}>
          {bars.map((b, i) => <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full" title={`${b.label}: ${ghs(b.total)}`}>{b.total === max && b.total > 0 && <span className="text-[10px] text-muted whitespace-nowrap">{Math.round(b.total).toLocaleString()}</span>}<div className={cx('w-full rounded-t-md', b.total === max && b.total > 0 ? 'bg-[#22c55e]' : 'bg-brand')} style={{ height: `${(b.total / max) * 85}%`, minHeight: b.total ? 3 : 0 }} /></div>)}
        </div>
        <div className="flex gap-1.5">{bars.map((b, i) => <span key={i} className="flex-1 text-center text-[10px] text-muted truncate">{b.label}</span>)}</div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="How customers paid">
          {!methods.length ? <span className="text-sm text-muted">No sales in this period.</span> : methods.map(([m, v]) => <div key={m} className="flex flex-col gap-1"><div className="flex justify-between text-sm"><span>{m} · {v.n}</span><b>{ghs(v.t)}</b></div><div className="h-2 rounded-full bg-canvas overflow-hidden"><div className="h-full bg-brand" style={{ width: `${(v.t / TOT) * 100}%` }} /></div></div>)}
        </Card>
        <Card title="What I sold most">
          {!top.length ? <span className="text-sm text-muted">No sales in this period.</span> : top.map(([n, v], i) => <div key={n} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span>{i + 1}. {n}</span><span className="text-muted">{v.q} sold · <b className="text-black">{ghs(v.t)}</b></span></div>)}
        </Card>
      </div>
      <Card title="Sales history" sub={`Last ${HN} ${{ day: 'days', week: 'weeks', month: 'months', year: 'years' }[HB]} · tap View to open any of them`} actions={<Pills small opts={[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly']]} value={HB as 'day'} onChange={(v) => setHistBy(v)} />}>
        <T head={[{ day: 'Day', week: 'Week', month: 'Month', year: 'Year' }[HB], 'Sales', 'Items', 'Average sale', 'Total', 'Change', 'Open']} rows={hist.map((h) => [h.label, String(h.count), String(h.items), ghs(h.avg), <b key="t">{ghs(h.total)}</b>, <span key="c" className={h.change.startsWith('▲') ? 'text-ok' : h.change.startsWith('▼') ? 'text-danger' : 'text-muted'}>{h.change}</span>, <button key="v" onClick={() => { setPer(HB as Per); setOff(-h.i); setHistBy(HB as 'day'); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">View</button>])} />
      </Card>
      <Card title="Every sale in this period" sub={`${LF.length} ${LF.length === 1 ? 'sale' : 'sales'} · ${rangeTxt}`}>
        <label className="flex flex-col gap-1 text-[13px] font-semibold max-w-md">Search sale no., customer or item<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 1182, Mensah, fridge" className="field font-normal py-2.5" /></label>
        {!LF.length ? <span className="text-sm text-muted">{q ? `No sale matches “${q}”.` : 'No sales in this period.'}</span> : <T head={['Sale', 'When', 'Items', 'Customer', 'Paid by', 'Total']} rows={LF.slice(0, shown).map((s) => ['#' + s.no, when(s), s.lines.map((l) => `${l.qty} × ${l.name}`).join(', '), s.cust, s.method === 'CREDIT' ? 'Credit' : s.method, <b key="t">{ghs(s.total)}</b>])} />}
        {LF.length > shown && <button onClick={() => setShown(shown + 25)} className="btn-ghost w-fit">Show more · {Math.min(25, LF.length - shown)}</button>}
      </Card>
    </>
  );
}
