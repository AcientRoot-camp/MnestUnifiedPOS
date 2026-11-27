import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { BranchPills } from '../components/ui';
import { BRANCHES, PEOPLE } from '../data/nav';
import { PRODUCTS0, type Product } from '../data/catalogue';
import { COLLECTIONS, SALES, WEB_ORDERS, type Collection, type WebOrder } from '../data/sell';
import { readKey, usePersist } from '../lib/persist';
import { useSession } from '../lib/session';
import { cx, ghs, ghs0, timeNow, todayLong } from '../lib/format';
import NoticeModal from '../components/Notice';

type KpiId = 'sales' | 'credit' | 'hp' | 'exp' | 'disc' | 'grand' | 'cost' | 'profit' | 'await' | 'orders' | 'collected' | 'returns';
const KPI0: KpiId[] = ['sales', 'credit', 'hp', 'exp', 'disc', 'grand', 'cost', 'profit', 'await', 'orders', 'collected', 'returns'];
const KPI_GO: Partial<Record<KpiId, [string, string]>> = { orders: ['/orders', 'See the orders ›'], collected: ['/collect', 'Open Collect orders ›'], returns: ['/sales', 'Open Sales & returns ›'] };
const KPI_NAME: Record<KpiId, string> = { sales: 'Sales today', credit: 'Credit sales today', hp: 'Hire purchase today', exp: 'Expenses today', disc: 'Discount today', grand: 'Grand sales today', cost: 'Product cost', profit: 'Profit', orders: 'Orders today', collected: 'Collected today', returns: 'Returns today', await: 'Awaiting pickup or delivery' };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type Day = { day: string; sales: number; credit: number; hp: number; exp: number; disc: number; grand: number; cost: number; profit: number; n: number };

/** Day totals from the till and website sales, expenses and hire purchase deposits. */
function dayTotals(day: string, br: string): Day {
  const L = SALES.filter((s) => s.day === day && (br === 'all' || s.br === br) && s.status !== 'voided' && s.status !== 'cancelled');
  const credit = L.filter((s) => s.method === 'CREDIT').reduce((a, s) => a + s.total, 0);
  const sales = L.filter((s) => s.method !== 'CREDIT').reduce((a, s) => a + s.total, 0);
  const cost = L.reduce((a, s) => a + s.cost, 0);
  const seed = day.split('-').reduce((a, x) => a + Number(x), 0) * (br === 'osu' ? 3 : br === 'legon' ? 5 : br === 'adum' ? 7 : 1);
  const hp = (seed % 3 === 0 ? 1440 : 0) * (br === 'all' ? 1 : 0.45);
  const exps = readKey<{ date: string; br: string; amount: number; status: string }[]>('ecompos.expenses2', []).filter((e) => String(e.date).startsWith(day) && (br === 'all' || e.br === br) && e.status !== 'rejected').reduce((a, e) => a + e.amount, 0);
  const exp = exps || Math.round((180 + (seed % 9) * 70) * (br === 'all' ? 3 : 1));
  const disc = Math.round(sales * 0.017 * 100) / 100;
  const grand = sales + credit + hp;
  return { day, sales, credit, hp, exp, disc, grand, cost, profit: sales + credit - cost - exp, n: L.length };
}

function History({ k, br, onClose }: { k: KpiId; br: string; onClose: () => void }) {
  const [per, setPer] = useState<'today' | 'yest' | 'week' | 'month' | 'day' | 'range'>('week');
  const today = new Date();
  const [d1, setD1] = useState(iso(new Date(Date.now() - 6 * 864e5)));
  const [d2, setD2] = useState(iso(today));
  const days = useMemo(() => {
    const out: string[] = [];
    const add = (from: Date, to: Date) => { for (const d = new Date(to); d >= from; d.setDate(d.getDate() - 1)) out.push(iso(d)); };
    if (per === 'today') out.push(iso(today));
    else if (per === 'yest') out.push(iso(new Date(Date.now() - 864e5)));
    else if (per === 'week') add(new Date(Date.now() - 6 * 864e5), today);
    else if (per === 'month') add(new Date(today.getFullYear(), today.getMonth(), 1), today);
    else if (per === 'day') out.push(d1);
    else add(new Date(d1 + 'T00:00'), new Date(d2 + 'T00:00'));
    return out.slice(0, 400);
  }, [per, d1, d2]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = days.map((d) => dayTotals(d, br));
  const val = (r: Day) => (k === 'await' ? 0 : (r[k as keyof Day] as number));
  const total = rows.reduce((a, r) => a + val(r), 0);
  const csv = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([['Date,' + KPI_NAME[k], ...rows.map((r) => `${r.day},${val(r).toFixed(2)}`)].join('\n')], { type: 'text/csv' })); a.download = `${KPI_NAME[k].toLowerCase().replace(/\W+/g, '-')}-${br}.csv`; a.click(); };
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={`${KPI_NAME[k]} history`} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 flex flex-col gap-3">
        <div className="flex justify-between gap-3"><div><h2 className="m-0 text-xl font-semibold">{KPI_NAME[k]} · history</h2><span className="text-sm text-muted">{br === 'all' ? 'All branches' : BRANCHES.find((b) => b.id === br)?.name}</span></div><button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button></div>
        <div className="flex gap-1.5 flex-wrap">{([['today', 'Today'], ['yest', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['day', 'Pick a day'], ['range', 'Pick dates']] as const).map(([v, l]) => <button key={v} aria-pressed={per === v} onClick={() => setPer(v)} className={cx('text-xs px-3 py-1.5 rounded-full border', per === v ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}</div>
        {per === 'day' && <input type="date" value={d1} max={iso(today)} onChange={(e) => setD1(e.target.value)} className="field py-2 w-fit" aria-label="Day" />}
        {per === 'range' && <div className="flex gap-2 items-center"><input type="date" value={d1} max={d2} onChange={(e) => setD1(e.target.value)} className="field py-2" aria-label="From" /><span>–</span><input type="date" value={d2} max={iso(today)} onChange={(e) => setD2(e.target.value)} className="field py-2" aria-label="To" /></div>}
        <div className="rounded-2xl bg-canvas p-4 flex justify-between"><span className="text-sm text-muted">{rows.length} day{rows.length === 1 ? '' : 's'}</span><strong>{ghs(total)}</strong></div>
        <div className="flex flex-col divide-y divide-line">{rows.map((r) => <div key={r.day} className="flex justify-between py-2 text-sm"><span>{new Date(r.day + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<span className="text-xs text-muted"> · {r.n} sales</span></span><b>{ghs(val(r))}</b></div>)}</div>
        <button onClick={csv} className="btn-ghost w-fit">Download CSV</button>
      </section>
    </div>
  );
}

type Ev = { id: string; ts: number; kind: string; br: string; text: string; decide?: boolean; flag?: boolean; done?: boolean };
const KINDS: [string, string][] = [['all', 'Everything'], ['sale', 'Sales & orders'], ['money', 'Money in & banking'], ['exp', 'Expenses'], ['ret', 'Returns & damage'], ['stock', 'Stock'], ['staff', 'Staff & messages'], ['alert', 'Alerts'], ['decide', 'Needs a decision'], ['flag', 'Flagged']];
const FEED_POOL: Omit<Ev, 'id' | 'ts'>[] = [
  { kind: 'sale', br: 'osu', text: 'Akua Kyei sold 1 × TCL 43" 4K UHD Google TV · GHS 4,999.00 · MoMo' },
  { kind: 'sale', br: 'legon', text: 'Website order 34412290 paid · GHS 412.00 · Paystack' },
  { kind: 'money', br: 'adum', text: 'Cash-up closed · GHS 4,180.00 counted · GHS 0.00 short' },
  { kind: 'exp', br: 'legon', text: 'Generator fuel · GHS 640.00 · waiting for approval', decide: true },
  { kind: 'ret', br: 'osu', text: 'Return on #34391022 · 1 × Nasco 18" Wall Fan · damaged' },
  { kind: 'stock', br: 'adum', text: 'Low stock · Nasco 18" Wall Fan · 1 left' },
  { kind: 'staff', br: 'osu', text: 'Kwame Asante signed in at the gate · 07:58' },
  { kind: 'alert', br: 'osu', text: 'Till 2 drawer opened without a sale' },
  { kind: 'sale', br: 'adum', text: 'Hire purchase deposit · Bruhm 300L Chest Freezer · GHS 1,375.00' },
  { kind: 'money', br: 'osu', text: 'Deposit DEP-0217 recorded · GHS 6,200.00 · GCB Bank', decide: true },
  { kind: 'ret', br: 'legon', text: 'Discount request · 15% off Hisense 43" Smart TV', decide: true },
];

/* Premium live feed: deep teal header with gold accents, branch pulse, timeline with kind icons. */
const KIND_LOOK: Record<string, { c: string; bg: string; d: string; l: string }> = {
  sale: { c: '#1f7a2a', bg: '#e7f4e8', l: 'Sale', d: 'M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z' },
  money: { c: '#0b5c5c', bg: '#e3f1f1', l: 'Money', d: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 10v4M18 10v4' },
  exp: { c: '#8a4b1f', bg: '#f6e3d4', l: 'Expense', d: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Zm3 5h4m-4 4h4' },
  ret: { c: '#6a3fa0', bg: '#efe7f8', l: 'Return', d: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3' },
  stock: { c: '#0b4f8a', bg: '#e3f2fd', l: 'Stock', d: 'M21 8 12 3 3 8v8l9 5 9-5V8Zm-18 0 9 5 9-5m-9 5v8' },
  staff: { c: '#3d3a38', bg: '#eef0f1', l: 'Staff', d: 'M16 20v-1a4 4 0 0 0-8 0v1M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' },
  alert: { c: '#c62828', bg: '#fbeaea', l: 'Alert', d: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
};
const BR_TONE: Record<string, string> = { osu: '#7fd1c7', legon: '#9fb8ff', adum: '#f2c879' };
const GOLD = '#d4af5a';

function LiveFeed({ onHide }: { onHide: () => void }) {
  const [evs, setEvs] = usePersist<Ev[]>('ecompos.liveFeed', FEED_POOL.slice(0, 6).map((e, i) => ({ ...e, id: 'f' + i, ts: Date.now() - (6 - i) * 4 * 6e4 })));
  const [paused, setPaused] = useState(false);
  const [f, setF] = useState('all');
  const [note, setNote] = useState<{ id: string; t: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [fresh, setFresh] = useState('');
  const [bsel, setBsel] = useState('all');
  useEffect(() => { if (paused) return; const t = window.setInterval(() => { const pool = bsel === 'all' ? FEED_POOL : FEED_POOL.filter((x) => x.br === bsel); const e = pool[Math.floor(Math.random() * pool.length)] || FEED_POOL[0]; const id = 'f' + Date.now(); setFresh(id); setEvs((L) => [{ ...e, id, ts: Date.now() }, ...L].slice(0, 60)); }, 15000); return () => window.clearInterval(t); }, [paused, setEvs, bsel]);
  useEffect(() => { const t = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const up = (id: string, p: Partial<Ev>) => setEvs((L) => L.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const evB = evs.filter((e) => bsel === 'all' || e.br === bsel);
  const shown = evB.filter((e) => f === 'all' || (f === 'decide' ? e.decide && !e.done : f === 'flag' ? e.flag : e.kind === f));
  const brN = (b: string) => BRANCHES.find((x) => x.id === b)?.short ?? b;
  const today = evB.filter((e) => new Date(e.ts).toDateString() === new Date().toDateString());
  const pending = evB.filter((e) => e.decide && !e.done).length;
  const flagged = evB.filter((e) => e.flag).length;
  const salesToday = today.filter((e) => e.kind === 'sale').reduce((a, e) => a + (Number((e.text.match(/GHS ([\d,]+\.\d{2})/) || [])[1]?.replace(/,/g, '')) || 0), 0);
  const last = evB[0]?.ts ?? tick;
  const ago = Math.max(0, Math.round((tick - last) / 1000));
  const agoTxt = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)} min ago`;
  const hour = evs.filter((e) => tick - e.ts < 36e5);
  const count = (k: string) => (k === 'all' ? evB.length : k === 'decide' ? pending : k === 'flag' ? flagged : evB.filter((e) => e.kind === k).length);
  return (
    <section className="rounded-[28px] overflow-hidden bg-white flex flex-col" style={{ boxShadow: '0 1px 2px rgba(6,48,47,.08), 0 18px 40px -18px rgba(6,48,47,.35)' }} aria-labelledby="live-h">
      <div className="relative px-5 sm:px-6 pt-5 pb-4 text-white flex flex-col gap-4" style={{ background: 'radial-gradient(120% 140% at 100% 0%, #13706b 0%, #0b4f4d 38%, #062a29 100%)' }}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <span aria-hidden className="absolute -right-16 -top-16 w-56 h-56 rounded-full opacity-[.08]" style={{ background: GOLD }} />
        <div className="relative flex justify-between items-start gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex w-3 h-3 flex-none" aria-hidden>
              {!paused && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#5ee0a0', opacity: 0.6 }} />}
              <span className="relative w-3 h-3 rounded-full" style={{ background: paused ? '#8aa3a2' : '#5ee0a0', boxShadow: paused ? 'none' : '0 0 12px #5ee0a0' }} />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[.22em]" style={{ color: GOLD }}>{paused ? 'Paused' : 'Live'} · head office</span>
              <h2 id="live-h" className="m-0 text-xl font-semibold tracking-tight leading-tight">Live from {bsel === 'all' ? 'all branches' : brN(bsel)}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 tabular-nums" aria-live="off">Last event {agoTxt}</span>
            <button onClick={() => setPaused(!paused)} aria-pressed={paused} className="min-h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{paused ? <path d="M7 4v16l13-8z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}</svg>{paused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={onHide} aria-label="Hide Live from all branches" title="Hide" className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 bg-white/10 hover:bg-white/20"><Eye on /></button>
          </div>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Events today', String(today.length), `${hour.length} in the last hour`],
            ['Sales logged', ghs0(salesToday), 'From the feed today'],
            ['Needs a decision', String(pending), pending ? 'Waiting on you' : 'All clear'],
            ['Flagged', String(flagged), 'For follow-up'],
          ].map(([l, v, n], i) => (
            <button key={l} onClick={() => setF(i === 2 ? 'decide' : i === 3 ? 'flag' : i === 1 ? 'sale' : 'all')} className="text-left rounded-2xl px-3.5 py-3 border border-white/10 bg-white/[.06] hover:bg-white/[.12] transition-colors min-w-0">
              <span className="block text-[11px] text-white/60">{l}</span>
              <strong className="block text-xl font-semibold tabular-nums tracking-tight" style={i === 2 && pending ? { color: GOLD } : undefined}>{v}</strong>
              <span className="block text-[11px] text-white/50 truncate">{n}</span>
            </button>
          ))}
        </div>
        <div className="relative flex gap-2 flex-wrap">
          {BRANCHES.map((b) => { const n = evs.filter((e) => tick - e.ts < 36e5 && e.br === b.id).length; return (
            <button key={b.id} onClick={() => setBsel(bsel === b.id ? 'all' : b.id)} aria-pressed={bsel === b.id} className={cx('inline-flex items-center gap-2 text-xs rounded-full pl-2 pr-3 py-1 border transition-colors', bsel === b.id ? 'bg-white text-[#062a29] border-white' : 'bg-black/20 border-white/10 hover:bg-white/10')}>
              <span className="w-2 h-2 rounded-full" style={{ background: BR_TONE[b.id] || '#fff' }} aria-hidden />{b.short}<b className="tabular-nums">{n}</b><span className={bsel === b.id ? 'text-[#062a29]/60' : 'text-white/50'}>/hr</span>
            </button>
          ); })}
        </div>
      </div>
      <div className="px-5 sm:px-6 py-3 flex gap-2 flex-wrap items-center border-b border-line">
        <label className="relative"><span className="sr-only">Branch</span><select value={bsel} onChange={(e) => setBsel(e.target.value)} aria-label="Branch" className="h-10 rounded-full border border-line bg-white pl-4 pr-9 text-sm font-medium appearance-none cursor-pointer hover:border-[#0b5c5c] focus:border-[#0b5c5c] outline-none"><option value="all">All branches</option>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.short}</option>)}</select><svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m6 9 6 6 6-6" /></svg></label>
        <label className="relative flex-1 min-w-[200px]"><span className="sr-only">Show</span><select value={f} onChange={(e) => setF(e.target.value)} aria-label="Show" className="h-10 rounded-full border border-line bg-white pl-4 pr-9 text-sm font-medium appearance-none cursor-pointer hover:border-[#0b5c5c] focus:border-[#0b5c5c] outline-none w-full">{KINDS.map(([k, l]) => <option key={k} value={k}>{l} · {count(k)}</option>)}</select><svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m6 9 6 6 6-6" /></svg></label>
        {(f !== 'all' || bsel !== 'all') && <button onClick={() => { setF('all'); setBsel('all'); }} className="h-10 px-3.5 rounded-full text-xs font-semibold text-[#0b5c5c] hover:bg-[#eef6f6]">Clear</button>}
      </div>
      <NoticeModal msg={msg} onClose={() => setMsg('')} />
      <ol className="relative m-0 list-none px-5 sm:px-6 py-3 max-h-[460px] overflow-y-auto flex flex-col">
        <span aria-hidden className="absolute left-[39px] sm:left-[43px] top-5 bottom-5 w-px bg-line" />
        {shown.map((e) => { const K = KIND_LOOK[e.kind] || KIND_LOOK.staff; const urgent = e.decide && !e.done; return (
          <li key={e.id} className={cx('group relative flex gap-3 py-2.5', e.done && 'opacity-50', e.id === fresh && 'live-in')}>
            <span className="relative z-[1] w-9 h-9 rounded-full flex-none flex items-center justify-center ring-4 ring-white" style={{ background: K.bg, color: K.c }} title={K.l}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={K.d} /></svg>
            </span>
            <div className={cx('flex-1 min-w-0 rounded-2xl px-3.5 py-2.5 border transition-colors', urgent ? 'border-[#e8d29a] bg-[#fffbf0]' : e.flag ? 'border-[#f0c9c9] bg-[#fff8f8]' : 'border-transparent group-hover:border-line group-hover:bg-[#fafbfb]')}>
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-semibold uppercase tracking-wider" style={{ color: K.c }}>{K.l}</span>
                <span className="text-muted">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-[#3d3a38]"><span className="w-1.5 h-1.5 rounded-full" style={{ background: { osu: '#0b8a7e', legon: '#4a6cd4', adum: '#c08a1e' }[e.br] || '#999' }} aria-hidden />{brN(e.br)}</span>
                <span className="ml-auto text-muted tabular-nums">{new Date(e.ts).toTimeString().slice(0, 5)}</span>
              </div>
              <p className="m-0 mt-1 text-sm leading-snug text-[#1c1b1a]">{e.flag && <span className="text-[#c62828]" aria-label="Flagged">⚑ </span>}{e.text}</p>
              {(urgent || e.done) && <span className="mt-1.5 inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full" style={urgent ? { background: '#f7ecd0', color: '#7a5a10' } : { background: '#e7f4e8', color: '#1f7a2a' }}>{urgent ? 'Needs a decision' : 'Done'}</span>}
              <div className="flex gap-1.5 flex-wrap mt-2 md:mt-0 md:max-h-0 md:opacity-0 md:overflow-hidden md:group-hover:max-h-12 md:group-hover:opacity-100 md:group-hover:mt-2 md:group-focus-within:max-h-12 md:group-focus-within:opacity-100 md:group-focus-within:mt-2 transition-all">
                {[[e.flag ? 'Unflag' : 'Flag for follow-up', () => up(e.id, { flag: !e.flag })], ['Note to branch', () => setNote({ id: e.id, t: '' })], [e.done ? 'Reopen' : 'Mark done', () => up(e.id, { done: !e.done })]].map(([l, fn]) => <button key={l as string} onClick={fn as () => void} className="h-8 px-3 rounded-full text-xs font-medium border border-line bg-white hover:border-[#0b5c5c] hover:text-[#0b5c5c]">{l as string}</button>)}
              </div>
              {note?.id === e.id && <div className="flex gap-2 mt-2"><input autoFocus value={note.t} onChange={(x) => setNote({ ...note, t: x.target.value })} placeholder={`Note to the ${brN(e.br)} branch`} aria-label={`Note to the ${brN(e.br)} branch`} className="field py-1.5 text-sm flex-1" /><button onClick={() => { if (!note.t.trim()) return; setMsg(`Note sent to the ${brN(e.br)} branch`); setNote(null); }} className="btn-primary min-h-9 text-xs">Send</button></div>}
            </div>
          </li>
        ); })}
        {!shown.length && <li className="text-sm text-muted py-8 text-center">Nothing in this view.</li>}
      </ol>
    </section>
  );
}

const Eye = ({ on }: { on: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {on ? <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4M6.6 6.6A13 13 0 0 0 2 12c1 2.5 5 7 10 7a10 10 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></> : <><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>
);

/** Premium finance summary: takings hero, per-branch share bars with cash-up and banking status. */
function FinanceCard({ day, T, onHide }: { day: string; T: Day; onHide: () => void }) {
  const rows = BRANCHES.map((b) => { const d = dayTotals(day, b.id); return { b, v: d.sales + d.credit, cash: d.sales, credit: d.credit, closed: b.id !== 'adum', banked: b.id === 'osu' }; });
  const total = T.sales + T.credit;
  const unbanked = rows.filter((r) => !r.banked).reduce((a, r) => a + r.cash, 0);
  const banked = Math.max(0, total - unbanked);
  const pctB = total ? Math.round((banked / total) * 100) : 0;
  const TONE: Record<string, string> = { osu: '#0b8a7e', legon: '#4a6cd4', adum: '#c08a1e' };
  return (
    <section className="rounded-[28px] overflow-hidden bg-white flex flex-col" style={{ boxShadow: '0 1px 2px rgba(6,48,47,.08), 0 18px 40px -18px rgba(6,48,47,.35)' }} aria-labelledby="fin-h">
      <div className="relative px-5 sm:px-6 pt-5 pb-5 text-white flex flex-col gap-4" style={{ background: 'radial-gradient(120% 140% at 0% 0%, #1a1a1a 0%, #101414 45%, #062a29 100%)' }}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <span aria-hidden className="absolute -left-20 -bottom-24 w-64 h-64 rounded-full opacity-[.07]" style={{ background: GOLD }} />
        <div className="relative flex justify-between items-start gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[.22em]" style={{ color: GOLD }}>Finance · today</span>
            <h2 id="fin-h" className="m-0 text-xl font-semibold tracking-tight leading-tight">Finance across all branches</h2>
          </div>
          <button onClick={onHide} aria-label="Hide Finance across all branches" title="Hide" className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 bg-white/10 hover:bg-white/20"><Eye on /></button>
        </div>
        <div className="relative flex items-end justify-between gap-3 flex-wrap">
          <div><span className="block text-[11px] text-white/60">Takings today</span><strong className="block text-[34px] leading-none font-semibold tracking-tight tabular-nums">{ghs0(total)}</strong></div>
          <div className="text-right"><span className="block text-[11px] text-white/60">Banked</span><strong className="block text-lg font-semibold tabular-nums" style={{ color: '#5ee0a0' }}>{pctB}%</strong></div>
        </div>
        <div className="relative h-2 rounded-full bg-white/10 overflow-hidden flex" role="img" aria-label={`Share of takings by branch`}>
          {rows.map((r) => <span key={r.b.id} className="h-full" style={{ width: `${total ? (r.v / total) * 100 : 0}%`, background: TONE[r.b.id] }} />)}
        </div>
        <div className="relative grid grid-cols-2 gap-2">
          <div className="rounded-2xl px-3.5 py-3 border border-white/10 bg-white/[.06]"><span className="block text-[11px] text-white/60">Not yet banked</span><strong className="block text-lg font-semibold tabular-nums" style={unbanked ? { color: GOLD } : undefined}>{ghs0(unbanked)}</strong></div>
          <div className="rounded-2xl px-3.5 py-3 border border-white/10 bg-white/[.06]"><span className="block text-[11px] text-white/60">Waiting for your check</span><strong className="block text-lg font-semibold">2 deposits</strong></div>
        </div>
      </div>
      <ul className="m-0 list-none px-5 sm:px-6 py-3 flex flex-col">
        {rows.map((r) => (
          <li key={r.b.id} className="py-3 border-b border-line last:border-0 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-none" style={{ background: TONE[r.b.id] }} aria-hidden>{r.b.short.slice(0, 2).toUpperCase()}</span>
              <span className="flex-1 min-w-0"><b className="text-sm">{r.b.short}</b><span className="block text-[11px] text-muted">{ghs0(r.cash)} cash & MoMo · {ghs0(r.credit)} credit</span></span>
              <b className="text-base tabular-nums">{ghs0(r.v)}</b>
            </div>
            <div className="flex items-center gap-2 pl-12">
              <span className="flex-1 h-1.5 rounded-full bg-[#f2f4f5] overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${total ? (r.v / total) * 100 : 0}%`, background: TONE[r.b.id] }} /></span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={r.closed ? { background: '#e7f4e8', color: '#1f7a2a' } : { background: '#fff8e1', color: '#b26a00' }}>{r.closed ? 'Cash-up closed' : 'Cash-up open'}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={r.banked ? { background: '#e3f1f1', color: '#0b5c5c' } : { background: '#f7ecd0', color: '#7a5a10' }}>{r.banked ? 'Banked' : 'Not banked'}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="px-5 sm:px-6 pb-5"><Link to="/finance" className="w-full min-h-11 rounded-full text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90" style={{ background: 'linear-gradient(90deg, #062a29, #0b5c5c)' }}>Open Finance <span aria-hidden>→</span></Link></div>
    </section>
  );
}

export default function Dashboard() {
  const { session, viewBranch, setViewBranch } = useSession();
  const nav = useNavigate();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role];
  const br = SU ? viewBranch : session?.branch || 'osu';
  const [now, setNow] = useState(timeNow());
  useEffect(() => { const t = setInterval(() => setNow(timeNow()), 30_000); return () => clearInterval(t); }, []);
  const [order, setOrder] = usePersist<KpiId[]>(`ecompos.kpiOrder.${me.name}`, KPI0);
  const [drag, setDrag] = useState<KpiId | null>(null);
  const [arrange, setArrange] = useState(false);
  const [hist, setHist] = useState<KpiId | null>(null);
  const [awaitOpen, setAwaitOpen] = useState(false);
  const [openOrder, setOpenOrder] = useState('');
  const [wo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [col] = usePersist<Collection[]>('ecompos.collect2', COLLECTIONS);
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [rets] = usePersist<{ no: string; status: string; amount: number; at: string }[]>('ecompos.returns2', []);
  const [show, setShow] = usePersist<{ live: boolean; fin: boolean }>(`ecompos.dashShow.${me.name}`, { live: true, fin: true });
  const [attention, setAttention] = useState([
    { id: 1, br: 'osu', kind: 'Approve discount', text: 'Till 2 · Osu · 15% off Hisense 43" Smart TV (GHS 547.50)', icon: 'approvals', to: '/approvals', btn: 'Review' },
    { id: 2, br: 'legon', kind: 'Approve expense', text: 'East Legon · Generator fuel · GHS 640.00', icon: 'expenses', to: '/expenses/inbox', btn: 'Review' },
    { id: 3, br: 'osu', kind: 'Refund requested', text: 'Order 34435404 · GHS 26.00 to Mobile Money', icon: 'fin:refunds', to: '/finance/refunds', btn: 'Review' },
    { id: 4, br: 'adum', kind: 'Confirm money reached the bank', text: 'Adum · GHS 6,200.00 to GCB Bank', icon: 'fin:deposits', to: '/finance/deposits', btn: 'Review' },
  ]);
  // Least privilege: only items for the branch being viewed (the Admin on All branches sees every branch).
  const attn = attention.filter((a) => br === 'all' || a.br === br);
  const T = dayTotals(iso(new Date()), br);
  const Y = dayTotals(iso(new Date(Date.now() - 864e5)), br);
  const waiting = wo.filter((o) => o.status === 'Active' && (br === 'all' || o.brId === br));
  const isToday = (t?: string) => !!t && (/^today/i.test(t) || t.includes(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })));
  const brShort = br === 'all' ? '' : BRANCHES.find((b) => b.id === br)?.short ?? '';
  const ordersToday = wo.filter((o) => isToday(o.placed) && (br === 'all' || o.brId === br));
  const collectedToday = [...col.filter((c) => c.status === 'collected' && isToday(c.placedAt) && (!brShort || c.branch.startsWith(brShort))).map((c) => c.total), ...wo.filter((o) => o.status === 'Delivered' && isToday(o.placed) && (br === 'all' || o.brId === br)).map((o) => o.items.reduce((a, [q, , p]) => a + q * p, 0))];
  const returnsToday = rets.filter((r) => isToday(r.at));
  const pct = (a: number, b: number) => (b ? `${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))}% vs yesterday` : '');
  const kpis: Record<KpiId, [string, string, 'up' | 'down' | undefined]> = {
    sales: [ghs0(T.sales), pct(T.sales, Y.sales), T.sales >= Y.sales ? 'up' : 'down'],
    credit: [ghs0(T.credit), `${SALES.filter((s) => s.day === T.day && s.method === 'CREDIT').length} credit sales`, undefined],
    hp: [ghs0(T.hp), T.hp ? '1 new agreement' : 'No new agreements', undefined],
    exp: [ghs0(T.exp), 'Approved and waiting', undefined],
    disc: [ghs0(T.disc), T.sales ? `${((T.disc / T.sales) * 100).toFixed(1)}% of sales` : '', undefined],
    grand: [ghs0(T.grand), 'Cash, MoMo, card, credit, HP', undefined],
    cost: [ghs0(T.cost), 'From cost prices · Admin only', undefined],
    profit: [ghs0(T.profit), pct(T.profit, Y.profit), T.profit >= Y.profit ? 'up' : 'down'],
    orders: [String(ordersToday.length), `${ordersToday.filter((o) => o.ch === 'Website').length} website · ${ordersToday.filter((o) => o.ch !== 'Website').length} phone & WhatsApp`, undefined],
    collected: [String(collectedToday.length), collectedToday.length ? `${ghs0(collectedToday.reduce((a, n) => a + n, 0))} handed over` : 'Nothing collected yet', collectedToday.length ? 'up' : undefined],
    returns: [String(returnsToday.length), returnsToday.length ? `${ghs0(returnsToday.reduce((a, r) => a + r.amount, 0))} refunded or exchanged` : 'No returns today', returnsToday.length ? 'down' : undefined],
    await: [String(waiting.length), `${waiting.filter((o) => o.type === 'D').length} delivery · ${waiting.filter((o) => o.type !== 'D').length} pickup`, undefined],
  };
  const ids = order.filter((k) => KPI0.includes(k)).concat(KPI0.filter((k) => !order.includes(k))).filter((k) => SU || (k !== 'cost' && k !== 'profit'));
  const move = (k: KpiId, d: number) => { const a = [...ids]; const i = a.indexOf(k); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setOrder(a); };
  const hours = Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => [h, SALES.filter((s) => s.day === T.day && (br === 'all' || s.br === br) && new Date(s.ts).getHours() === h).reduce((a, s) => a + s.total, 0)] as const);
  const max = Math.max(1, ...hours.map((h) => h[1]));
  const todays = SALES.filter((s) => s.day === T.day && (br === 'all' || s.br === br));
  const ch = { pos: todays.filter((s) => s.ch === 'till').reduce((a, s) => a + s.total, 0), web: todays.filter((s) => s.ch === 'web').reduce((a, s) => a + s.total, 0), phone: wo.filter((o) => o.ch === 'Phone').reduce((a, o) => a + o.items.reduce((x, [q, , p]) => x + q * p, 0), 0) };
  const chT = ch.pos + ch.web + ch.phone || 1;
  const pay = (m: RegExp) => todays.filter((s) => m.test(s.method)).reduce((a, s) => a + s.total, 0);
  const low = P.filter((p) => (br === 'all' ? p.stock.osu + p.stock.legon + p.stock.adum : p.stock[br as 'osu']) <= p.reorder).slice(0, 6);
  const branchOpts = [{ id: 'all', label: 'All branches' }, ...BRANCHES.map((b) => ({ id: b.id, label: `${b.short}, ${b.city}` }))].filter((b) => SU || b.id === session?.branch);
  const latest = [...wo].slice(0, 6);
  const brName = br === 'all' ? 'All branches' : BRANCHES.find((b) => b.id === br)?.short;
  const stageTxt = (o: WebOrder) => (o.type === 'D' ? ['Being confirmed', 'Preparing order', 'Packing', 'In transit', 'Out for delivery', 'Delivered'] : ['Being confirmed', 'Preparing order', 'Packing', 'Ready to collect', 'Collected'])[o.stage];
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {me.name.split(' ')[0]}</h1><p className="m-0 text-sm text-muted">{todayLong()} | {now} | Today at {brName} | Prices in GHS</p></header>
      {/* One row: branch pills on the left, card controls (live feed, finance, rearrange) on the right. */}
      <div className="flex justify-between items-center gap-3 flex-wrap"><BranchPills value={br} onChange={setViewBranch} options={branchOpts} /><div className="flex gap-2 flex-wrap">{arrange && <button onClick={() => setOrder(KPI0)} className="btn-ghost min-h-9 text-xs">Reset order</button>}{SU && br === 'all' && <><button onClick={() => setShow({ ...show, live: !show.live })} aria-pressed={show.live} className="btn-ghost min-h-9 text-xs inline-flex items-center gap-1.5"><Eye on={show.live} />{show.live ? 'Hide' : 'Show'} live feed</button><button onClick={() => setShow({ ...show, fin: !show.fin })} aria-pressed={show.fin} className="btn-ghost min-h-9 text-xs inline-flex items-center gap-1.5"><Eye on={show.fin} />{show.fin ? 'Hide' : 'Show'} finance</button></>}<button onClick={() => setArrange(!arrange)} aria-pressed={arrange} className="btn-ghost min-h-9 text-xs">{arrange ? 'Done' : 'Rearrange cards'}</button></div></div>
      {arrange && <span className="text-sm text-muted -mt-3">Drag a card, or use ← → to move it. Your order is saved for you.</span>}
      <section aria-label="Key figures" className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
        {ids.map((k) => { const [v, n, tone] = kpis[k]; return (
          <div key={k} draggable={arrange} onDragStart={() => setDrag(k)} onDragOver={(e) => { e.preventDefault(); }} onDrop={() => { if (!drag || drag === k) return; const a = ids.filter((x) => x !== drag); a.splice(a.indexOf(k), 0, drag); setOrder(a); setDrag(null); }}
            className={cx('card p-5 flex flex-col gap-1 text-left relative transition-all duration-200 outline-none', arrange ? 'ring-2 ring-dashed ring-brand/40 cursor-move' : 'cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-brand hover:shadow-[0_14px_30px_-14px_rgba(11,92,92,.45)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:-translate-y-0.5 active:translate-y-0 active:ring-brand active:bg-[#f3faf9]', drag === k && 'opacity-50')}
            onClick={() => { if (arrange) return; if (k === 'await') setAwaitOpen(true); else if (KPI_GO[k]) nav(KPI_GO[k]![0]); else setHist(k); }} role="button" tabIndex={0} aria-label={`${KPI_NAME[k]}: ${v}`} onKeyDown={(e) => { if (arrange || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); if (k === 'await') setAwaitOpen(true); else if (KPI_GO[k]) nav(KPI_GO[k]![0]); else setHist(k); }}>
            <span className="text-[13px] text-muted flex justify-between gap-2">{KPI_NAME[k]}{arrange && <span className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); move(k, -1); }} aria-label={`Move ${KPI_NAME[k]} left`} className="w-6 h-6 rounded-full bg-canvas">←</button><button onClick={(e) => { e.stopPropagation(); move(k, 1); }} aria-label={`Move ${KPI_NAME[k]} right`} className="w-6 h-6 rounded-full bg-canvas">→</button></span>}</span>
            <strong className="text-[26px] font-medium tracking-tightest">{v}</strong>
            <span className={cx('text-xs', tone === 'up' ? 'text-ok' : tone === 'down' ? 'text-danger' : 'text-muted')}>{n}</span>
            {k === 'await' ? <span className="text-xs font-semibold text-brand mt-1">See the orders ›</span> : KPI_GO[k] ? <span className="text-xs font-semibold text-brand mt-1">{KPI_GO[k]![1]}</span> : <span className="text-xs font-semibold text-brand w-fit mt-1">View history ›</span>}
          </div>
        ); })}
      </section>

      {SU && br === 'all' && (show.live || show.fin) && <div className={cx('grid gap-6 items-start', show.live && show.fin && 'xl:grid-cols-[1.4fr_1fr]')}>{show.live && <LiveFeed onHide={() => setShow({ ...show, live: false })} />}{show.fin && <FinanceCard day={T.day} T={T} onHide={() => setShow({ ...show, fin: false })} />}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 flex flex-col gap-3"><div className="flex justify-between"><h2 className="m-0 text-lg font-semibold">Sales by hour</h2><Link to="/reports" className="text-sm font-semibold text-brand">Full report →</Link></div>
          <div className="flex items-end gap-1.5 h-48" role="img" aria-label="Sales by hour, 8:00 to 20:00">{hours.map(([h, v]) => <div key={h} className="flex-1 flex flex-col items-center gap-1 h-full justify-end"><div className="w-full rounded-lg" style={{ height: `${Math.max(2, (v / max) * 85)}%`, background: v === max ? '#22c55e' : '#0b5c5c' }} title={ghs(v)} /><span className="text-[10px] text-muted">{h}</span></div>)}</div>
          <div className="flex gap-3 flex-wrap text-xs">{[['In-store POS', ch.pos, '#0b5c5c'], ['Website', ch.web, '#22c55e'], ['Phone', ch.phone, '#f2b705']].map(([l, v, c]) => <span key={l as string} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: c as string }} />{l as string} · {Math.round(((v as number) / chT) * 100)}%</span>)}</div>
        </section>
        <section className="card p-5 flex flex-col gap-2"><div className="flex justify-between"><h2 className="m-0 text-lg font-semibold">Needs attention</h2><span className="pill bg-red-100 text-red-800">{attn.length} open</span></div>
          {!attn.length && <p className="text-sm text-muted m-0">All caught up.</p>}
          {attn.map((a) => <div key={a.id} className="flex gap-3 items-start p-3 rounded-2xl bg-canvas"><span className="w-9 h-9 rounded-xl bg-white text-brand flex items-center justify-center flex-none"><Icon name={a.icon} /></span><span className="flex-1 flex flex-col min-w-0"><span className="text-sm font-semibold">{a.kind}</span><span className="text-[13px] text-muted">{a.text}</span></span><button onClick={() => { setAttention((l) => l.filter((x) => x.id !== a.id)); nav(a.to); }} className="text-xs font-semibold px-3 py-2 rounded-full bg-ok text-white">{a.btn}</button></div>)}
        </section>
      </div>

      {/* Latest orders, every channel. Sized in rem so it scales with the reader's text size, and never wider than its
          space. It looks at its own width (CSS container query, index.css .lo), not the screen's, because on tablets it
          can sit in a narrow column: under 34rem one compact card per order; from 34rem a table that fits the width;
          from 46rem the Payment column too. */}
      <section aria-labelledby="lo-h" className="lo card p-[1rem] sm:p-[1.25rem] flex flex-col gap-[0.5rem] min-w-0">
        <div className="flex justify-between items-baseline gap-[0.5rem] flex-wrap"><h2 id="lo-h" className="m-0 text-[1.0625rem] sm:text-[1.125rem] font-semibold">Latest orders, every channel</h2><Link to="/orders" className="text-[0.875rem] font-semibold text-brand whitespace-nowrap">All orders →</Link></div>
        <ul className="lo-cards m-0 p-0 list-none flex-col gap-[0.5rem]">
          {latest.map((o) => (
            <li key={o.id} className="rounded-[1rem] bg-canvas px-[0.875rem] py-[0.625rem] flex flex-col gap-[0.125rem] min-w-0">
              <div className="flex justify-between gap-[0.5rem] text-[0.875rem]"><b className="font-semibold truncate">#{o.id}</b><b className="font-semibold whitespace-nowrap">{ghs(o.items.reduce((a, [q, , pr]) => a + q * pr, 0) + o.fee)}</b></div>
              <span className="text-[0.8125rem] text-muted truncate">{o.who} · {o.ch}</span>
              <div className="flex justify-between gap-[0.5rem] text-[0.75rem]"><span className="truncate">{o.pay}</span><span className="font-semibold whitespace-nowrap text-brand">{o.status === 'Active' ? stageTxt(o) : o.status}</span></div>
            </li>
          ))}
        </ul>
        <table className="lo-table w-full table-fixed text-[0.8125rem] border-collapse">
          <thead><tr className="text-left text-[0.75rem] text-muted border-b border-line">
            <th className="w-[6.5rem] py-[0.5rem] pr-[0.75rem] font-semibold">Order</th>
            <th className="w-[5.5rem] py-[0.5rem] pr-[0.75rem] font-semibold">Channel</th>
            <th className="py-[0.5rem] pr-[0.75rem] font-semibold">Customer</th>
            <th className="lo-pay w-[8rem] py-[0.5rem] pr-[0.75rem] font-semibold">Payment</th>
            <th className="w-[6.75rem] py-[0.5rem] pr-[0.75rem] font-semibold text-right">Total</th>
            <th className="w-[7.5rem] py-[0.5rem] font-semibold">Status</th>
          </tr></thead>
          <tbody>{latest.map((o) => <tr key={o.id} className="border-b border-line align-top">
            <td className="py-[0.5rem] pr-[0.75rem] font-semibold break-words">{o.id}</td>
            <td className="py-[0.5rem] pr-[0.75rem] break-words">{o.ch}</td>
            <td className="py-[0.5rem] pr-[0.75rem] break-words">{o.who}</td>
            <td className="lo-pay py-[0.5rem] pr-[0.75rem] break-words">{o.pay}</td>
            <td className="py-[0.5rem] pr-[0.75rem] text-right whitespace-nowrap">{ghs(o.items.reduce((a, [q, , pr]) => a + q * pr, 0) + o.fee)}</td>
            <td className="py-[0.5rem] break-words">{o.status === 'Active' ? stageTxt(o) : o.status}</td>
          </tr>)}</tbody>
        </table>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-5 flex flex-col gap-1.5"><h2 className="m-0 text-lg font-semibold">End-of-day report</h2>
          {[['Cash', pay(/^Cash$/)], ['MoMo', pay(/MoMo|Telecel/)], ['Card', pay(/Card/)], ['Credit', T.credit], ['Cash variance', -0]].map(([l, v]) => <div key={l as string} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span className="text-muted">{l as string}</span><b className={l === 'Cash variance' ? 'text-ok' : ''}>{ghs(v as number)}</b></div>)}
          <Link to="/sales/shifts" className="text-sm font-semibold text-brand">Shifts & cash-up →</Link>
        </section>
        <section className="card p-5 flex flex-col gap-2"><div className="flex justify-between"><h2 className="m-0 text-lg font-semibold">Low stock</h2><Link to="/inventory" className="text-sm font-semibold text-brand">Inventory →</Link></div>
          {low.map((p) => <div key={p.id} className="flex justify-between items-center text-sm"><span>{p.name}</span><span className="pill bg-red-100 text-red-800">{br === 'all' ? p.stock.osu + p.stock.legon + p.stock.adum : p.stock[br as 'osu']} left</span></div>)}
          {!low.length && <span className="text-sm text-muted">Nothing is low.</span>}
          <Link to="/inventory/po" className="btn-ghost min-h-9 text-xs w-fit">Create purchase order</Link>
        </section>
        <section className="card p-5 flex flex-col gap-2"><h2 className="m-0 text-lg font-semibold">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">{([['products', 'Add a product', '/products'], ['marketing', 'Send WhatsApp offer', '/marketing'], ['payroll', 'Run payroll', '/payroll'], ['shop', 'View online shop', '/shop'], ['reports', 'Open reports', '/reports'], ['bike', 'Rider app', '/rider']] as const).map(([i, l, to]) => <Link key={l} to={to} className="flex flex-col gap-2 p-3 rounded-2xl bg-canvas hover:bg-brand-50 text-sm font-medium"><Icon name={i} className="text-brand" />{l}</Link>)}</div>
        </section>
      </div>

      {hist && <History k={hist} br={br} onClose={() => setHist(null)} />}
      {awaitOpen && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setAwaitOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Awaiting pickup or delivery" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 flex flex-col gap-3">
            <div className="flex justify-between gap-3"><div><h2 className="m-0 text-xl font-semibold">Awaiting pickup or delivery</h2><span className="text-sm text-muted">{waiting.length} orders · {brName}</span></div><button onClick={() => setAwaitOpen(false)} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button></div>
            {!waiting.length && <span className="text-sm text-muted">Nothing waiting. Every order has been collected or delivered.</span>}
            {waiting.map((o) => { const c = col.find((x) => x.no === o.id); const max2 = o.type === 'D' ? 5 : 4; return (
              <div key={o.id} className="rounded-2xl border border-line p-3 flex flex-col gap-2">
                <div className="flex justify-between gap-2 items-center"><span className="text-sm"><b>{o.id}</b> · {o.who}<br /><span className="text-xs text-muted">{o.type === 'D' ? 'Delivery' : 'Pickup'} · {BRANCHES.find((b) => b.id === o.brId)?.short} · {stageTxt(o)}</span></span><button onClick={() => setOpenOrder(openOrder === o.id ? '' : o.id)} aria-expanded={openOrder === o.id} className="btn-ghost min-h-8 text-xs">{openOrder === o.id ? 'Hide' : 'View order'}</button></div>
                {openOrder === o.id && <div className="flex flex-col gap-1.5 text-sm">
                  <span>{o.phone} · placed {o.placed}</span>
                  {o.items.map(([q, n, p], i) => <span key={i} className="text-xs">{q} × {n} · {ghs(q * p)}</span>)}
                  <b>Total {ghs(o.items.reduce((a, [q, , p]) => a + q * p, 0) + o.fee)}</b>
                  <div className="flex gap-1">{Array.from({ length: max2 + 1 }).map((_, i) => <span key={i} className={cx('flex-1 h-1.5 rounded-full', i <= o.stage ? 'bg-ok' : 'bg-line')} />)}</div>
                  {c && <span className="text-xs text-muted">Collection: {c.status}</span>}
                  <button onClick={() => nav(`/orders?open=${o.id}`)} className="btn-primary min-h-9 text-xs w-fit">Open in Orders · next step</button>
                </div>}
              </div>
            ); })}
          </section>
        </div>
      )}
    </>
  );
}
