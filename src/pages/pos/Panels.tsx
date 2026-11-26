// Sell Now panels (sell.md §2.8–2.10): park, parked sales, return/exchange, online orders, pickups, riders,
// my sales, close shift (Z-report) and the till lock.
import { useState, type ReactNode } from 'react';
import { ACCOUNTS, BRANCHES } from '../../data/nav';
import { COLLECTIONS, RIDERS, SALES, WEB_ORDERS, type Collection, type Rider, type WebOrder } from '../../data/sell';
import { FLOAT } from '../../data/finance';
import { readKey, usePersist, writeKey } from '../../lib/persist';
import { creds, mfaOk, secLog } from '../../lib/sec';
import { useSession } from '../../lib/session';
import { useCompanyLogo } from '../../lib/brand';
import { cx, ghs } from '../../lib/format';
import { moveStock, nowTxt, type Parked, type Ret, type RetLine, type TillSale } from './model';
import { noteReturned } from '../../lib/stock';
import { bizInfo } from './Docs';
import BarcodeCamera from '../../components/BarcodeCamera';
import NoticeModal from '../../components/Notice';
import { PORTAL_BASE } from '../../lib/site';

const TEAL = '#0b5c5c';
const RED = '#c62828';
const SHADOW = 'rgba(69,36,219,0.34) 0 4px 24px 0';
const mono = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", fontSize: 11.5, lineHeight: 1.35 };
const brName = (b: string) => BRANCHES.find((x) => x.id === b)?.short ?? b;
const chip = (on: boolean) => cx('h-9 px-3.5 rounded-full border text-[13px]', on ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]');
const hhmm = (ts: number) => new Date(ts).toTimeString().slice(0, 5);
const ageOf = (ts: number) => { const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

export function Close({ onClose, label = 'Close' }: { onClose: () => void; label?: string }) {
  return <button onClick={onClose} aria-label={label} className="w-9 h-9 rounded-full text-white text-lg flex items-center justify-center flex-none" style={{ background: RED }}>×</button>;
}
export function Sheet({ title, sub, onClose, children, wide, width }: { title: string; sub?: string; onClose: () => void; children: ReactNode; wide?: boolean; width?: number }) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-h-[94vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col gap-3" style={{ maxWidth: width ?? (wide ? 760 : 520) }}>
        <div className="flex justify-between gap-3 no-print"><div><h2 className="m-0 text-xl font-semibold">{title}</h2>{sub && <span className="text-sm text-[#5f5c5a]">{sub}</span>}</div><Close onClose={onClose} /></div>
        {children}
      </section>
    </div>
  );
}
function Slip({ children }: { children: ReactNode }) {
  return <article className="print-doc mx-auto bg-white border-2 border-dashed border-[#9a9794] p-4 flex flex-col gap-0.5 w-[302px] max-w-full" style={mono}>{children}</article>;
}
function SlipHead({ title }: { title: string }) {
  const logo = useCompanyLogo(); const B = bizInfo();
  return <div className="text-center flex flex-col items-center gap-0.5 pb-1"><img src={logo} alt="" style={{ width: 44, height: 44, filter: 'grayscale(1)' }} className="object-contain" /><span>{B.name} · Osu</span><strong style={{ fontSize: 13 }}>{title}</strong></div>;
}

/* ---------- Park ---------- */
const PARK_WHY = ['Fetching more cash', 'Adding more items', 'Price check', 'Serving another customer'];
export function ParkDialog({ defName, onPark, onClose }: { defName: string; onPark: (name: string, reason: string, note: string) => void; onClose: () => void }) {
  const [name, setName] = useState(defName); const [why, setWhy] = useState(''); const [note, setNote] = useState('');
  return (
    <Sheet title="Park this sale?" sub="Anyone signed in at this branch can resume it. Its items stay held (taken off the till and the online store) until the sale is resumed and paid, or deleted." onClose={onClose}>
      <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Customer name (so anyone can find it)<input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-full border border-[#d9d9d9] px-4 text-sm font-normal text-black" /></label>
      <div className="flex gap-1.5 flex-wrap">{PARK_WHY.map((w) => <button key={w} aria-pressed={why === w} onClick={() => setWhy(w)} className={chip(why === w)}>{w}</button>)}</div>
      <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Back in 10 minutes with MoMo" className="h-11 rounded-full border border-[#d9d9d9] px-4 text-sm font-normal text-black" /></label>
      <div className="flex gap-2"><button onClick={onClose} className="h-11 px-5 rounded-full border border-[#d9d9d9] text-sm">Cancel</button><button onClick={() => onPark(name.trim(), why, note.trim())} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>Park sale</button></div>
    </Sheet>
  );
}

/* ---------- Parked sales ---------- */
export function ParkedPanel({ br, me, role, onResume, onClose }: { br: string; me: string; role: string; onResume: (p: Parked) => void; onClose: () => void }) {
  const [L, setL] = usePersist<Parked[]>('ecompos.parked2', []);
  const [tab, setTab] = useState<'all' | 'mine' | 'old'>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(''); const [noteTxt, setNoteTxt] = useState('');
  const [slip, setSlip] = useState<Parked | null>(null);
  const tot = (p: Parked) => p.lines.reduce((a, l) => a + l.qty * l.price, 0) - p.disc;
  const here = L.filter((p) => p.br === br);
  const shown = here.filter((p) => (tab === 'all' || (tab === 'mine' ? p.by === me : Date.now() - p.ts > 3600_000)) && (!q || `${p.cust?.name} ${p.by} ${p.lines.map((l) => l.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const canDel = (p: Parked) => p.by === me || role === 'manager' || role === 'superuser';
  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Parked sales" onClick={(e) => e.stopPropagation()} className="w-full max-h-[94vh] overflow-y-auto p-5 sm:p-6 flex flex-col gap-3" style={{ maxWidth: 760, background: '#f2f4f5', borderRadius: 28 }}>
        <div className="flex justify-between gap-3"><div><h2 className="m-0 text-xl font-semibold">Parked sales · {brName(br)}</h2><span className="text-sm text-[#5f5c5a]">Sales put on hold at this branch. Anyone signed in here can resume one. Their items stay held, so nobody else can sell them, until the sale is resumed and paid, or deleted.</span></div><Close onClose={onClose} /></div>
        <div className="flex gap-2 flex-wrap items-center">
          <div role="tablist" className="flex gap-1 p-1 rounded-full bg-white">{([['all', `All · ${here.length}`], ['mine', 'Parked by me'], ['old', 'Over 1 hour']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-8 px-3.5 rounded-full text-[13px]', tab === k ? 'bg-black text-white font-semibold' : '')}>{l}</button>)}</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by customer, staff or item" aria-label="Find by customer, staff or item" className="flex-1 min-w-[200px] h-10 rounded-full border border-[#d9d9d9] bg-white px-4 text-sm" />
        </div>
        {!shown.length && <div className="rounded-[20px] bg-white p-6 text-center text-sm text-[#5f5c5a]">No parked sales{q ? ' match your search' : ' at this branch'}.</div>}
        {shown.map((p) => { const age = Date.now() - p.ts; return (
          <article key={p.id} className="bg-white rounded-[20px] p-4 flex flex-col gap-2.5">
            <div className="flex justify-between gap-3 items-start"><span className="flex flex-col"><b className="text-base">{p.cust?.name || 'Walk-in customer'}</b><span className="text-xs text-[#5f5c5a]">{p.id} · parked by {p.by} · {hhmm(p.ts)}</span></span><span className="flex items-center gap-2"><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: age > 3600_000 ? '#fbeaea' : age > 900_000 ? '#fff4e5' : '#e7f4e8', color: age > 3600_000 ? '#7d1a1a' : age > 900_000 ? '#8a4b00' : '#1f7a2a' }}>{ageOf(p.ts)} ago</span><b className="text-[17px]">{ghs(tot(p))}</b></span></div>
            <div className="rounded-2xl p-3 flex flex-col gap-0.5 text-sm" style={{ background: '#f6f7f8' }}>{p.lines.map((l) => <span key={l.pid + (l.unit || '')} className="flex justify-between"><span>{l.qty} × {l.name}{l.unit && l.unit !== 'single' ? ` · ${l.unit}` : ''}</span><span>{ghs(l.qty * l.price)}</span></span>)}</div>
            {edit === p.id ? <div className="flex gap-2"><input value={noteTxt} onChange={(e) => setNoteTxt(e.target.value)} aria-label="Note" className="flex-1 h-10 rounded-full border border-[#d9d9d9] px-4 text-sm" /><button onClick={() => { setL(L.map((x) => (x.id === p.id ? { ...x, note: noteTxt } : x))); setEdit(''); }} className="h-10 px-4 rounded-full bg-black text-white text-sm">Save</button></div> : p.note && <span className="text-sm italic text-[#3d3a38]">“{p.note}”</span>}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setL(L.filter((x) => x.id !== p.id)); onResume(p); }} className="h-10 px-4 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>Resume sale</button>
              <button onClick={() => { setEdit(p.id); setNoteTxt(p.note); }} className="h-10 px-4 rounded-full border border-[#d9d9d9] bg-white text-sm">Edit note</button>
              <button onClick={() => setSlip(p)} className="h-10 px-4 rounded-full border border-[#d9d9d9] bg-white text-sm">Hold slip</button>
              {canDel(p) && <button onClick={() => { setL(L.filter((x) => x.id !== p.id)); secLog('Parked sale deleted', `${me} deleted parked sale ${p.id} (${ghs(tot(p))})`, 'low', me); }} className="h-10 px-4 rounded-full bg-white text-sm" style={{ border: `1px solid ${RED}`, color: RED }}>Delete</button>}
            </div>
            {slip?.id === p.id && <div className="flex flex-col gap-2 items-center"><Slip><SlipHead title={`SALE ON HOLD · ${p.id}`} /><span>Customer: {p.cust?.name || 'Walk-in customer'}</span><span>When: {new Date(p.ts).toLocaleString('en-GB')}</span><span>By: {p.by}</span><span aria-hidden>- - - - - - - - - - - - - - -</span>{p.lines.map((l) => <span key={l.pid + (l.unit || '')} className="flex justify-between"><span>{l.qty} × {l.name}</span><span>{(l.qty * l.price).toFixed(2)}</span></span>)}<span className="flex justify-between font-bold pt-1"><span>To pay</span><span>{ghs(tot(p))}</span></span><span className="pt-1 text-center">Show this slip at the till to finish the sale. Not a receipt.</span></Slip><button onClick={() => window.print()} className="h-10 px-5 rounded-full bg-black text-white text-sm font-semibold no-print">Print slip</button></div>}
          </article>
        ); })}
      </section>
    </div>
  );
}

/* ---------- Return / exchange ---------- */
type Found = { no: string; title: string; sub: string; ts: number; method: string; cust: string; lines: { pid: string; name: string; qty: number; each: number }[] };
const RET_WHY = ['Changed mind', 'Wrong item or size', 'Damaged', 'Not working', 'Expired'];
export function ReturnPanel({ br, staff, onCredit, onClose }: { br: string; staff: string; onCredit: (amt: number, ref: string) => void; onClose: () => void }) {
  const [R, setR] = usePersist<Ret[]>('ecompos.tillReturns', []);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [rcam, setRcam] = useState(false); // camera reading the QR printed on the receipt
  const [pick, setPick] = useState<Record<string, { qty: number; bad: number }>>({});
  const [why, setWhy] = useState('');
  const [cond, setCond] = useState<'good' | 'damaged' | ''>('');
  const [mode, setMode] = useState<'refund' | 'exchange'>('refund');
  const [to, setTo] = useState('orig');
  const [err, setErr] = useState('');
  const [slip, setSlip] = useState<Ret | null>(null);
  /** Find a receipt / sale / invoice / online order. Input: a scanned value, else what is typed in the box. */
  const find = (scanned?: string) => {
    const raw = (scanned ?? q).trim(); const k = raw.replace(/^#/, '').replace(/^INV-[A-Z]+-/i, ''); setErr(''); setPick({});
    const till = readKey<TillSale[]>('ecompos.sales2', []).find((s) => s.no === k || s.code === k || s.inv?.toUpperCase() === raw.toUpperCase() || s.no.endsWith(k) && k.length >= 4);
    if (till) return setFound({ no: till.code || till.no, title: `Receipt ${till.code || till.no}`, sub: `Sale #${till.no} · ${brName(till.br)} · ${till.staff}`, ts: till.ts, method: till.method.split(' · ')[0], cust: till.cust?.name || 'Walk-in customer', lines: till.lines.map((l, i) => ({ pid: l.pid + i, name: l.name + (l.unit && l.unit !== 'single' ? ` (${l.unit})` : ''), qty: l.qty, each: Math.round(l.price * (till.sub ? Math.max(0, till.sub - till.disc) / till.sub : 1) * 100) / 100 })) });
    const old = SALES.find((s) => s.no === k || s.no.endsWith(k) && k.length >= 4);
    if (old) return setFound({ no: old.no, title: `Sale #${old.no}`, sub: `${brName(old.br)} · ${old.staff}`, ts: old.ts, method: old.method, cust: old.cust || 'Walk-in customer', lines: old.lines.map((l, i) => ({ pid: old.no + i, name: l.name, qty: l.qty, each: l.each })) });
    const w = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS).find((o) => o.id === k);
    if (w) return setFound({ no: w.id, title: `Online order #${w.id}`, sub: `${w.ch} · ${brName(w.brId)} · ${w.placed}`, ts: Date.now() - 2 * 864e5, method: w.pay.split(' · ')[0], cust: w.who, lines: w.items.map(([qq, n, p], i) => ({ pid: w.id + i, name: n, qty: qq, each: p })) });
    setFound(null); setErr('No receipt, sale, invoice or online order has that number. Check it with the customer.');
  };
  const chosen: RetLine[] = found ? found.lines.flatMap((l) => { const p = pick[l.pid]; if (!p?.qty) return []; const out: RetLine[] = []; const bad = cond === 'damaged' ? p.qty : cond === 'good' ? 0 : p.bad; if (p.qty - bad > 0) out.push({ pid: l.pid, name: l.name, qty: p.qty - bad, each: l.each, cond: 'good' }); if (bad > 0) out.push({ pid: l.pid + 'd', name: l.name, qty: bad, each: l.each, cond: 'damaged' }); return out; }) : [];
  const value = chosen.reduce((a, l) => a + l.qty * l.each, 0);
  const nItems = chosen.reduce((a, l) => a + l.qty, 0);
  const days = found ? Math.floor((Date.now() - found.ts) / 864e5) : 0;
  const refundTo = mode === 'exchange' ? 'Exchange credit' : to === 'orig' ? `Original · ${found?.method}` : to;
  const warn = !nItems ? 'Tick the items coming back.' : nItems > 3 ? 'A till return covers up to 3 items. Use Sales & returns for more.' : !why ? 'Choose the reason.' : days > 7 ? `Bought ${days} days ago · over the 7-day return period. A Manager must agree.` : '';
  const done = () => {
    if (!found || !nItems || nItems > 3 || !why) return setErr(warn);
    const r: Ret = { id: 'RT-' + Date.now().toString().slice(-5), ts: Date.now(), sale: found.no, br, by: staff, lines: chosen, reason: why, value, to: refundTo };
    setR([r, ...R]);
    const SR = readKey<{ no: string; ref: string; status: string; amount: number; item: string; refund: string; at: string }[]>('ecompos.returns2', []);
    writeKey('ecompos.returns2', [{ no: r.id, ref: found.title, status: 'Completed', amount: value, item: chosen.map((l) => `${l.qty} × ${l.name} (${l.cond})`).join(', ') + ` · ${why}`, refund: refundTo, at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }, ...SR]);
    moveStock(chosen.filter((l) => l.cond === 'good').map((l) => ({ name: l.name.replace(/ \(.*\)$/, ''), qty: l.qty })), br, -1);
    // Every returned unit (good or damaged) is now off this sale, so a later void of the same sale cannot return it twice.
    noteReturned(found.no, chosen.map((l) => ({ name: l.name.replace(/ \(.*\)$/, ''), qty: l.qty })));
    // Serial-tracked items coming back: release their serial numbers so the units can be sold again.
    const sold = readKey<Record<string, { name?: string; sale: string }>>('ecompos.serialsSold', {});
    chosen.forEach((l) => { let n = l.qty; Object.keys(sold).forEach((sn) => { if (n > 0 && sold[sn].sale === found.no && sold[sn].name === l.name.replace(/ \(.*\)$/, '')) { delete sold[sn]; n--; } }); });
    writeKey('ecompos.serialsSold', sold);
    secLog('Return', `${staff} returned ${nItems} item(s) from ${found.title} · ${ghs(value)} · ${refundTo}`, 'low', staff);
    if (mode === 'exchange') onCredit(value, r.id);
    setSlip(r);
  };
  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Return or exchange" onClick={(e) => e.stopPropagation()} className="w-full max-w-[600px] max-h-[94vh] overflow-y-auto p-5 flex flex-col gap-3" style={{ background: '#f2f4f5', borderRadius: 18, border: '1.5px solid #000' }}>
        <div className="flex justify-between items-center"><h2 className="m-0 text-xl font-semibold">Return or exchange</h2><Close onClose={onClose} /></div>
        {!slip ? <>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Type or scan a receipt number, sale number, invoice number or online order number.
            <span className="flex gap-2"><button type="button" onClick={() => setRcam(!rcam)} aria-label="Scan the receipt QR with the camera" className="w-11 h-11 rounded-full text-white flex items-center justify-center flex-none" style={{ background: '#0b5c5c' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M14 8v8M17 8v8" /></svg></button><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} placeholder="e.g. 1180, 482611, INV-OSU-1180, #34452610" className="flex-1 h-11 rounded-full border border-[#d9d9d9] bg-white px-4 text-sm font-normal text-black" /><button onClick={() => find()} className="h-11 px-5 rounded-full bg-black text-white text-sm font-semibold">Find</button></span>
          </label>
          {rcam && <BarcodeCamera onRead={(v) => { setRcam(false); setQ(v.trim()); find(v); }} height={160} caption="Hold the receipt QR inside the frame" />}
          {err && <span role="alert" className="text-sm" style={{ color: RED }}>{err}</span>}
          {found && <>
            <div className="bg-white rounded-[18px] p-4 flex flex-col gap-2">
              <div className="flex justify-between gap-2 items-start"><span className="flex flex-col"><b>{found.title}</b><span className="text-xs text-[#5f5c5a]">{found.sub}</span></span><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: days <= 7 ? '#e7f4e8' : days <= 30 ? '#fff4e5' : '#fbeaea', color: days <= 7 ? '#1f7a2a' : days <= 30 ? '#8a4b00' : '#7d1a1a' }}>{days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`}</span></div>
              <dl className="m-0 grid grid-cols-3 gap-2 text-xs">{[['Customer', found.cust], ['Paid by', found.method], ['Bought', new Date(found.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })]].map(([k, v]) => <div key={k} className="rounded-xl bg-[#f6f7f8] p-2"><dt className="text-[#5f5c5a]">{k}</dt><dd className="m-0 font-semibold">{v}</dd></div>)}</dl>
            </div>
            <span className="text-[13px] font-semibold text-[#3d3a38]">Tick the items coming back</span>
            {found.lines.map((l) => { const p = pick[l.pid]; const on = !!p?.qty; return (
              <div key={l.pid} className={cx('bg-white rounded-2xl p-3 flex flex-col gap-2', on && 'ring-2 ring-black')}>
                <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={on} onChange={() => setPick({ ...pick, [l.pid]: on ? { qty: 0, bad: 0 } : { qty: 1, bad: 0 } })} className="w-6 h-6 accent-black" /><span className="flex-1 flex flex-col"><b className="font-medium">{l.name}</b><span className="text-xs text-[#5f5c5a]">Bought {l.qty} × {ghs(l.each)} paid</span></span></label>
                {on && <div className="flex flex-wrap gap-3 items-center text-sm pl-9">
                  {cond === '' && <span className="flex items-center gap-1.5"><span className="text-xs text-[#5f5c5a]">Damaged</span><button onClick={() => setPick({ ...pick, [l.pid]: { ...p, bad: Math.max(0, p.bad - 1) } })} aria-label="One less damaged" className="w-8 h-8 rounded-full border border-[#d9d9d9]">−</button><b>{p.bad}</b><button onClick={() => setPick({ ...pick, [l.pid]: { ...p, bad: Math.min(p.qty, p.bad + 1) } })} aria-label="One more damaged" className="w-8 h-8 rounded-full border border-[#d9d9d9]">+</button><span className="text-xs text-[#5f5c5a]">{p.bad ? `${p.bad} damaged · ${p.qty - p.bad} good` : 'All good'}</span></span>}
                  <span className="flex items-center gap-1.5"><span className="text-xs text-[#5f5c5a]">Qty</span><button onClick={() => setPick({ ...pick, [l.pid]: { qty: Math.max(1, p.qty - 1), bad: Math.min(p.bad, Math.max(1, p.qty - 1)) } })} aria-label="One less" className="w-8 h-8 rounded-full border border-[#d9d9d9]">−</button><b>{p.qty}</b><button onClick={() => setPick({ ...pick, [l.pid]: { ...p, qty: Math.min(l.qty, p.qty + 1) } })} aria-label="One more" className="w-8 h-8 rounded-full border border-[#d9d9d9]">+</button></span>
                  <b className="ml-auto">{ghs(p.qty * l.each)}</b>
                </div>}
              </div>
            ); })}
            <span className="text-[13px] font-semibold text-[#3d3a38]">Reason</span>
            <div className="flex gap-1.5 flex-wrap">{RET_WHY.map((w) => <button key={w} aria-pressed={why === w} onClick={() => setWhy(w)} className={chip(why === w)}>{w}</button>)}</div>
            <span className="text-[13px] font-semibold text-[#3d3a38]">Item condition</span>
            <div className="flex gap-1.5 flex-wrap">{([['good', 'All good · back to stock'], ['damaged', 'All damaged · write off']] as const).map(([k, l]) => <button key={k} aria-pressed={cond === k} onClick={() => setCond(cond === k ? '' : k)} className={chip(cond === k)}>{l}</button>)}</div>
            <div role="tablist" className="flex gap-1 p-1 rounded-full bg-white w-fit">{(['refund', 'exchange'] as const).map((k) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cx('h-9 px-5 rounded-full text-sm', mode === k ? 'bg-black text-white font-semibold' : '')}>{k === 'refund' ? 'Refund' : 'Exchange'}</button>)}</div>
            {mode === 'refund' ? <div className="flex gap-1.5 flex-wrap"><span className="text-xs text-[#5f5c5a] w-full">Refund to</span>{([['orig', `Original · ${found.method}`], ['Cash', 'Cash'], ['MoMo', 'MoMo'], ['Store credit', 'Store credit']] as const).map(([k, l]) => <button key={k} aria-pressed={to === k} onClick={() => setTo(k)} className={chip(to === k)}>{l}</button>)}</div>
              : <span className="text-sm text-[#3d3a38]">The return value becomes a credit on this sale. Add the replacement items to the cart; any amount left over is issued as store credit.</span>}
            <div className="bg-black text-white rounded-[18px] p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center"><span>{mode === 'refund' ? 'Refund to customer' : 'Exchange credit'}</span><b className="text-xl">{ghs(value)}</b></div>
              {warn && <span className="text-xs" style={{ color: '#f2b705' }}>{warn}</span>}
              <button onClick={done} disabled={!!warn && !warn.startsWith('Bought')} className="h-11 rounded-full text-white text-sm font-semibold disabled:opacity-40" style={{ background: TEAL, boxShadow: SHADOW }}>{mode === 'refund' ? `Refund ${ghs(value)} · ${refundTo}` : `Use ${ghs(value)} as exchange credit`}</button>
            </div>
          </>}
          {R.filter((r) => r.br === br).length > 0 && <div className="bg-white rounded-[18px] p-4 flex flex-col gap-1.5"><b className="text-sm">Recent returns at this till</b>{R.filter((r) => r.br === br).slice(0, 5).map((r) => <span key={r.id} className="text-xs flex justify-between gap-2"><span>{r.id} · against {r.sale} · {r.by} · {hhmm(r.ts)}</span><span>{ghs(r.value)} · {r.to}</span></span>)}</div>}
        </> : <div className="flex flex-col items-center gap-2">
          <Slip><SlipHead title="RETURN SLIP" /><span>{slip.id} · {new Date(slip.ts).toLocaleString('en-GB')}</span><span>Against {slip.sale}</span><span aria-hidden>- - - - - - - - - - - - - - -</span>{slip.lines.map((l) => <span key={l.pid} className="flex justify-between"><span>{l.qty} × {l.name}</span><span>{(l.qty * l.each).toFixed(2)}</span></span>)}<span className="flex justify-between font-bold pt-1"><span>Amount</span><span>{ghs(slip.value)}</span></span><span>Refunded: {slip.to}</span><span>Reason: {slip.reason} · {slip.lines.some((l) => l.cond === 'damaged') ? (slip.lines.every((l) => l.cond === 'damaged') ? 'damaged · written off' : 'part damaged') : 'good · back to stock'}</span><span>Processed by {slip.by}</span></Slip>
          <div className="flex gap-2 no-print"><button onClick={() => window.print()} className="h-10 px-5 rounded-full bg-black text-white text-sm font-semibold">Print return slip</button><button onClick={onClose} className="h-10 px-5 rounded-full border border-[#d9d9d9] bg-white text-sm">Done</button></div>
        </div>}
      </section>
    </div>
  );
}

/* ---------- Online orders ---------- */
const D_STEPS = ['Being confirmed', 'Preparing order', 'Packed', 'Ready / in transit', 'Out for delivery', 'Delivered'];
export function OnlinePanel({ br, me, onClose }: { br: string; me: string; onClose: () => void }) {
  const [L, setL] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [open, setOpen] = useState('');
  const [proofOk, setProofOk] = useState<Record<string, boolean>>({});
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [slip, setSlip] = useState<{ o: WebOrder; kind: 'pack' | 'rcpt' } | null>(null);
  const mine = L.filter((o) => o.brId === br && o.status === 'Active');
  const names = (o: WebOrder) => (o.type === 'D' ? D_STEPS : ['Being confirmed', 'Preparing order', 'Packed', 'Ready to collect', 'Collected']);
  const max = (o: WebOrder) => names(o).length - 1;
  const step = (o: WebOrder, s: number, extra: Partial<WebOrder> = {}) => setL((x) => x.map((y) => (y.id === o.id ? { ...y, ...extra, stage: s, status: s === max(o) ? 'Delivered' : 'Active', track: [...y.track, { label: names(o)[s], at: nowTxt(), by: me }] } : y)));
  const tot = (o: WebOrder) => o.items.reduce((a, [q, , p]) => a + q * p, 0) + o.fee;
  return (
    <Sheet title="Online orders" sub="Prepare and update each order. The customer sees every change with your name." onClose={onClose} wide>
      {!mine.length && <span className="text-sm text-[#5f5c5a]">No open online orders for this branch.</span>}
      {mine.map((o) => <div key={o.id} className="rounded-[20px] border border-[#ebebeb] p-4 flex flex-col gap-2">
        <div className="flex justify-between gap-2 flex-wrap items-center"><span className="text-sm"><b>#{o.id}</b> · {o.who} · {o.type === 'D' ? 'Delivery' : 'Pickup'}<br /><span className="text-xs text-[#5f5c5a]">{o.pay} · {names(o)[o.stage]} · {ghs(tot(o))}</span></span><button onClick={() => setOpen(open === o.id ? '' : o.id)} className="h-9 px-4 rounded-full border border-[#d9d9d9] text-[13px]">{open === o.id ? 'Close' : 'Open'}</button></div>
        {open === o.id && <div className="flex flex-col gap-2">
          {o.items.map(([q, n, p], i) => <span key={i} className="text-xs">{q} × {n} · {ghs(q * p)}</span>)}
          <span className="text-xs text-[#5f5c5a]">Update the status</span>
          <div className="flex gap-1 flex-wrap">{names(o).map((n, i) => <button key={n} disabled={i <= o.stage || (o.type === 'D' && i === max(o)) || (o.type !== 'D' && i === max(o))} onClick={() => step(o, i)} className={cx('text-[12px] h-8 px-3 rounded-full border', i <= o.stage ? 'text-white border-transparent' : 'border-[#d9d9d9] disabled:opacity-40')} style={i <= o.stage ? { background: '#1f7a2a' } : undefined}>{i <= o.stage ? '✓ ' : ''}{n}</button>)}</div>
          {o.type === 'D' && o.stage >= 4 && <div className="rounded-2xl bg-[#f2f4f5] p-3 flex flex-col gap-1.5 text-xs"><b className="text-sm">Delivery proof check</b>{o.proof ? <img src={o.proof} alt="Delivery photo" className="w-full max-h-40 object-cover rounded-xl" /> : <span className="text-[#5f5c5a]">📷 Waiting for the rider’s photo.</span>}<label className="flex flex-col gap-1">Received by<input value={recv[o.id] ?? o.received ?? ''} onChange={(e) => setRecv({ ...recv, [o.id]: e.target.value })} placeholder={o.who} className="h-9 rounded-full border border-[#d9d9d9] bg-white px-3 text-sm" /></label><label className="flex items-center gap-2"><input type="checkbox" checked={!!proofOk[o.id]} onChange={() => setProofOk({ ...proofOk, [o.id]: !proofOk[o.id] })} className="accent-black" />I have checked the photo and who received it</label><button disabled={!proofOk[o.id]} onClick={() => step(o, max(o), { received: recv[o.id] || o.received || o.who })} className="h-9 px-4 rounded-full text-white text-[13px] font-semibold w-fit disabled:opacity-40" style={{ background: TEAL }}>Confirm delivery</button></div>}
          <div className="flex gap-2 flex-wrap"><button onClick={() => setSlip({ o, kind: 'pack' })} className="h-9 px-4 rounded-full border border-[#d9d9d9] text-[13px]">Print packing slip</button><button onClick={() => setSlip({ o, kind: 'rcpt' })} className="h-9 px-4 rounded-full border border-[#d9d9d9] text-[13px]">Print receipt</button>{o.type !== 'D' && o.stage >= 3 && <span className="text-xs text-[#5f5c5a] self-center">Hand over in Online pickups with the customer’s code.</span>}{o.type === 'D' && o.stage >= 2 && o.stage < 4 && <button onClick={() => step(o, 4)} className="h-9 px-4 rounded-full bg-black text-white text-[13px]">Hand over to rider</button>}</div>
          {slip?.o.id === o.id && <div className="flex flex-col items-center gap-2"><Slip><SlipHead title={slip.kind === 'pack' ? 'PACKING SLIP' : 'SALES RECEIPT'} /><span>#{o.id} · {o.who} · {o.phone}</span><span>{o.where}</span>{o.items.map(([q, n, p], i) => <span key={i} className="flex justify-between"><span>{slip.kind === 'pack' ? '☐ ' : ''}{q} × {n}</span>{slip.kind === 'rcpt' && <span>{(q * p).toFixed(2)}</span>}</span>)}{slip.kind === 'rcpt' && <span className="flex justify-between font-bold"><span>Total</span><span>{ghs(tot(o))}</span></span>}<span>{slip.kind === 'pack' ? 'Packed' : 'Printed'} by {me} · {nowTxt()}</span></Slip><button onClick={() => window.print()} className="h-9 px-4 rounded-full bg-black text-white text-[13px] no-print">Print</button></div>}
        </div>}
      </div>)}
    </Sheet>
  );
}

/* ---------- Online pickups ---------- */
export function PickupPanel({ br, me, onClose }: { br: string; me: string; onClose: () => void }) {
  const [col, setCol] = usePersist<Collection[]>('ecompos.collect2', COLLECTIONS);
  const [code, setCode] = useState('');
  const [hit, setHit] = useState<Collection | null>(null);
  const [how, setHow] = useState('Cash');
  const [hp, setHp] = useState(false);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const short = (BRANCHES.find((b) => b.id === br)?.short || '').toLowerCase();
  const waiting = col.filter((x) => x.branch.toLowerCase().startsWith(short) && ['ready', 'prep', 'waiting'].includes(x.status));
  const match = () => { const c = waiting.find((x) => x.code === code); if (!c) { setHit(null); return setErr('That code does not match a waiting order at this branch. Ask the customer to check their SMS.'); } setErr(''); setHit(c); setCode(''); };
  const hand = () => { if (!hit) return; if (hit.pay === 'hp' && !hp) return setErr('Check their Ghana Card and sign the hire purchase agreement before handing over.'); setCol(col.map((x) => (x.no === hit.no ? { ...x, status: 'collected', paid: true, note: `Handed over by ${me} · ${nowTxt()}${hit.paid ? '' : ` · paid ${how}`}` } : x))); const wo = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS); writeKey('ecompos.webOrders2', wo.map((o) => (o.id === hit.no ? { ...o, stage: 4, status: 'Delivered', track: [...o.track, { label: 'Collected', at: nowTxt(), by: me }] } : o))); setOk(`#${hit.no} handed over to ${hit.name}${hit.paid ? '' : ` · ${ghs(hit.total)} taken by ${how}`}`); setHit(null); setHp(false); };
  return (
    <Sheet title="Online pickups" sub="Type the 6-digit code from the customer’s SMS. Codes are never shown here." onClose={onClose}>
      <div className="flex gap-2"><input type="password" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && match()} placeholder="6-digit code" className="flex-1 h-12 rounded-full border border-[#d9d9d9] px-4 tracking-[0.4em]" aria-label="Collection code" /><button onClick={match} className="h-12 px-5 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>Verify code</button></div>
      {err && <span role="alert" className="text-sm" style={{ color: RED }}>{err}</span>}
      <NoticeModal msg={ok} onClose={() => setOk('')} />
      {hit && <div className="rounded-[20px] border-2 border-black p-4 flex flex-col gap-2 text-sm">
        <b>#{hit.no} · {hit.name} · {hit.phone}</b>{hit.items.map((i) => <span key={i.name} className="text-xs">{i.qty} × {i.name} · {ghs(i.total)}</span>)}
        <b>{hit.paid ? `Paid online · ${ghs(hit.total)} · hand over` : `Take payment at the counter · ${ghs(hit.total)}`}</b>
        {!hit.paid && <div className="flex gap-1.5">{['Cash', 'MoMo', 'GhPay'].map((m) => <button key={m} aria-pressed={how === m} onClick={() => setHow(m)} className={chip(how === m)}>{m}</button>)}</div>}
        {hit.pay === 'hp' && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={hp} onChange={() => setHp(!hp)} className="mt-0.5 accent-black" />I checked their Ghana Card and we signed the hire purchase agreement</label>}
        <button onClick={hand} className="h-11 px-5 rounded-full text-white text-sm font-semibold w-fit" style={{ background: '#1f7a2a' }}>{hit.paid ? 'Hand over' : `Take ${ghs(hit.total)} & hand over`}</button>
      </div>}
      <div className="flex flex-col gap-1.5 border-t border-[#ebebeb] pt-3"><b className="text-sm">Waiting to be collected ({waiting.length})</b>{waiting.map((c) => <span key={c.no} className="text-xs flex justify-between gap-2"><span>#{c.no} · {c.name} · {c.items.length} item{c.items.length === 1 ? '' : 's'}</span><span>{c.paid ? 'Paid online' : `To pay ${ghs(c.total)}`} · {c.status === 'ready' ? 'Ready' : 'Preparing'}</span></span>)}</div>
    </Sheet>
  );
}

/* ---------- Riders ---------- */
export function RidersPanel({ br, me, sale, onClose }: { br: string; me: string; sale: TillSale | null; onClose: () => void }) {
  const [riders, setRiders] = usePersist<Rider[]>('ecompos.riders2', RIDERS);
  const [wo, setWo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [msg, setMsg] = useState('');
  const mine = riders.filter((r) => r.br === br);
  const waiting = wo.filter((o) => o.brId === br && o.type === 'D' && o.status === 'Active' && !o.rider);
  const recent = readKey<TillSale[]>('ecompos.sales2', []).filter((s) => s.br === br && new Date(s.ts).toDateString() === new Date().toDateString() && s.status === 'completed' && !wo.some((o) => o.id === s.no)).slice(0, 5);
  const jobs = (r: Rider) => wo.filter((o) => o.rider === r.id && o.status === 'Active');
  const assign = (r: Rider, id: string) => {
    let L = wo;
    if (!L.some((o) => o.id === id)) { const s = recent.find((x) => x.no === id) || (sale?.no === id ? sale : null); if (!s) return; L = [{ id: s.no, ch: 'Till', who: s.cust?.name || 'Walk-in customer', phone: s.cust?.phone || '', items: s.lines.map((l) => [l.qty, l.name, l.price]), fee: s.fee, pay: s.method + ' · paid', type: 'D', brId: br, where: [s.cust?.addr, s.cust?.landmark].filter(Boolean).join(' · ') || 'Address to confirm', landmark: s.cust?.landmark, gps: s.cust?.gps, placed: nowTxt(), stage: 2, status: 'Active', track: [{ label: 'Till sale · delivery booked', at: nowTxt(), by: me }], trackId: s.no }, ...L]; }
    setWo(L.map((x) => (x.id === id ? { ...x, rider: r.id, stage: Math.max(x.stage, 3), track: [...x.track, { label: `Given to ${r.name}`, at: nowTxt(), by: me }] } : x)));
    setRiders(riders.map((x) => (x.id === r.id ? { ...x, state: 'On a delivery' } : x)));
    setMsg(`#${id} scheduled with ${r.name} · alert sent to the rider app`);
  };
  const options = [...(sale && !wo.some((o) => o.id === sale.no && o.rider) ? [{ id: sale.no, label: `This sale #${sale.no} · ${sale.cust?.name || 'Walk-in'}` }] : []), ...waiting.filter((o) => o.id !== sale?.no).map((o) => ({ id: o.id, label: `Online #${o.id} · ${o.who} · ${o.where}` })), ...recent.filter((s) => s.no !== sale?.no).map((s) => ({ id: s.no, label: `Till sale #${s.no} · ${s.cust?.name || 'Walk-in'} · ${ghs(s.total)}` }))];
  return (
    <Sheet title="Riders" sub={`${mine.length} riders at this branch · ${waiting.length} deliveries waiting`} onClose={onClose} wide>
      {sale && <div className="rounded-2xl p-3 text-sm" style={{ background: '#e7f4e8', color: '#1f7a2a' }}>🏠 #{sale.no} · {sale.cust?.name} · {[sale.cust?.addr, sale.cust?.landmark, sale.cust?.gps].filter(Boolean).join(' · ')} · {sale.cust?.phone}. Pick a rider below; the details are filled in.</div>}
      <NoticeModal msg={msg} onClose={() => setMsg('')} />
      <div className="grid gap-3 md:grid-cols-2">{mine.map((r) => <div key={r.id} className="rounded-[20px] border border-[#ebebeb] p-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-9 h-9 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">{r.name.split(' ').map((w) => w[0]).join('')}</span><b>{r.name}</b></span><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: r.state === 'Free' ? '#e7f4e8' : r.state === 'Off duty' ? '#f2f4f5' : '#fff4e5', color: r.state === 'Free' ? '#1f7a2a' : r.state === 'Off duty' ? '#5f5c5a' : '#8a4b00' }}>{r.state}</span></div>
        <span className="text-xs text-[#5f5c5a]">{r.note}</span>
        {jobs(r).map((o) => <div key={o.id} className="flex justify-between items-center text-xs bg-[#f2f4f5] rounded-xl p-2"><span>#{o.id} · {o.where}</span><button onClick={() => { setWo(wo.map((x) => (x.id === o.id ? { ...x, rider: undefined } : x))); setMsg(`#${o.id} unassigned from ${r.name}`); }} className="underline">Unassign</button></div>)}
        {options.length > 0 && r.state !== 'Off duty' && <select value="" onChange={(e) => e.target.value && assign(r, e.target.value)} className="h-10 rounded-full border border-[#d9d9d9] px-3 text-[13px]" aria-label={`Schedule a delivery for ${r.name}`}><option value="">Schedule a delivery…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>}
        <button onClick={() => { setRiders(riders.map((x) => (x.id === r.id ? { ...x, state: x.state === 'Off duty' ? 'Free' : 'Off duty' } : x))); setMsg(`${r.name} ${r.state === 'Off duty' ? 'is back on duty' : 'is off duty'}`); }} className="h-9 px-4 rounded-full border border-[#d9d9d9] text-[13px] w-fit">{r.state === 'Off duty' ? 'Back on duty' : 'Mark off duty'}</button>
      </div>)}</div>
    </Sheet>
  );
}

/* ---------- My sales (this sign-in) ---------- */
export function MySalesPanel({ name, sales, onClose }: { name: string; sales: TillSale[]; onClose: () => void }) {
  return (
    <Sheet title="My sales" sub={`Sales by ${name} today · ${ghs(sales.reduce((a, s) => a + s.total, 0))}`} onClose={onClose}>
      {!sales.length && <span className="text-sm text-[#5f5c5a]">No sales on this sign-in yet today.</span>}
      <div className="flex flex-col divide-y divide-[#ebebeb]">{sales.map((s) => <div key={s.no} className="py-2.5 flex items-center gap-3 text-sm"><span className="flex-1 flex flex-col"><b className="font-medium">Sale #{s.no}{s.kind === 'credit' ? ' · credit' : ''}</b><span className="text-xs text-[#5f5c5a]">{hhmm(s.ts)} · {s.lines.reduce((a, l) => a + l.qty, 0)} items · {s.method.split(' · ')[0]}</span></span><b>{ghs(s.total)}</b></div>)}</div>
      <a href={`${PORTAL_BASE}/mysales`} className="text-sm underline w-fit">Open My sales for any day →</a>
    </Sheet>
  );
}

/* ---------- Close shift · Z-report ---------- */
export function ClosePanel({ br, me, username, onClosed, onClose }: { br: string; me: string; username: string; onClosed: () => void; onClose: () => void }) {
  const S = readKey<TillSale[]>('ecompos.sales2', []).filter((s) => s.username === username && s.br === br && new Date(s.ts).toDateString() === new Date().toDateString() && s.status === 'completed' && !s.training);
  const R = readKey<Ret[]>('ecompos.tillReturns', []).filter((r) => r.by === me && /Cash/.test(r.to) && new Date(r.ts).toDateString() === new Date().toDateString());
  const cash = S.reduce((a, s) => a + s.parts.filter((p) => p.m === 'Cash' || p.m === 'Paid now').reduce((x, p) => x + p.amt, 0) - s.change, 0);
  const refunds = R.reduce((a, r) => a + r.value, 0);
  const expected = FLOAT + cash - refunds;
  const [counted, setCounted] = useState(''); const [why, setWhy] = useState(''); const [z, setZ] = useState(false);
  const diff = (parseFloat(counted) || 0) - expected;
  const B = bizInfo();
  const close = () => {
    if (counted === '' || (Math.abs(diff) > 0.009 && why.trim().length < 3)) return;
    if (diff < -20) { const I = readKey<{ id: string; kind: string; br: string; text: string; by: string; at: string; read: boolean }[]>('ecompos.issues2', []); writeKey('ecompos.issues2', [{ id: 'IS-' + Date.now().toString().slice(-4), kind: 'Till shortage', br, text: `${me} · Till 1 cash-up ${ghs(-diff)} short · ${why}`, by: me, at: nowTxt(), read: false }, ...I]); }
    writeKey('ecompos.finCashups', [{ br, by: me, at: Date.now(), float: FLOAT, cash, refunds, expected, counted: parseFloat(counted), diff, why }, ...readKey<unknown[]>('ecompos.finCashups', [])]);
    secLog('Shift closed', `${me} closed Till 1 · expected ${ghs(expected)} · counted ${ghs(parseFloat(counted))}`, diff < -20 ? 'medium' : 'low', username);
    setZ(true);
  };
  const rows: [string, string][] = [['Sales', `${S.length} · ${ghs(S.reduce((a, s) => a + s.total, 0))}`], ...['Cash', 'Mobile Money', 'GhPay', 'Paid now'].map((m) => [m === 'Paid now' ? 'Credit · paid now' : m, ghs(S.reduce((a, s) => a + (s.parts.filter((p) => p.m === m).reduce((x, p) => x + p.amt, 0)), 0))] as [string, string]), ['Credit sales owed', ghs(S.reduce((a, s) => a + (s.balance || 0), 0))], ['Change given', ghs(S.reduce((a, s) => a + s.change, 0))], ['Cash refunds', ghs(refunds)], ['Opening float', ghs(FLOAT)], ['Expected in drawer', ghs(expected)]];
  return (
    <Sheet title="Close shift · Z-report" sub={`${brName(br)} · Till 1 · ${me}`} onClose={onClose}>
      <Slip><SlipHead title={`Z-REPORT · ${B.name.toUpperCase()} ${brName(br).toUpperCase()} TILL 1`} /><span>{new Date().toLocaleString('en-GB')} · {me}</span><span aria-hidden>- - - - - - - - - - - - - - -</span>{rows.map(([k, v]) => <span key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></span>)}{counted !== '' && <><span className="flex justify-between font-bold"><span>Counted</span><span>{ghs(parseFloat(counted) || 0)}</span></span><span className="flex justify-between"><span>Variance</span><span>{ghs(diff)}</span></span></>}</Slip>
      {!z ? <>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Cash counted in the drawer (GHS)<input inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ''))} className="h-12 rounded-full border border-[#d9d9d9] px-4 text-[17px] font-semibold text-black" /></label>
        {counted !== '' && <span className="text-sm font-semibold" style={{ color: Math.abs(diff) < 0.01 ? '#1f7a2a' : diff < 0 ? RED : '#b26a00' }}>{Math.abs(diff) < 0.01 ? '✓ The drawer matches' : diff < 0 ? `${ghs(-diff)} short${diff < -20 ? ' · a till shortage issue is raised automatically' : ''}` : `${ghs(diff)} over`}</span>}
        {counted !== '' && Math.abs(diff) > 0.009 && <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Why is it different?<input value={why} onChange={(e) => setWhy(e.target.value)} className="h-11 rounded-full border border-[#d9d9d9] px-4 text-sm font-normal text-black" /></label>}
        <button onClick={close} disabled={counted === '' || (Math.abs(diff) > 0.009 && why.trim().length < 3)} className="h-12 rounded-full text-white text-sm font-semibold disabled:opacity-40" style={{ background: TEAL }}>Close shift & print Z-report</button>
      </> : <div className="flex gap-2 no-print"><button onClick={() => window.print()} className="h-11 px-5 rounded-full bg-black text-white text-sm font-semibold">Print Z-report</button><button onClick={onClosed} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>Close shift & log out</button></div>}
    </Sheet>
  );
}

/* ---------- Till lock / switch user ---------- */
export function LockScreen({ me, username, till, pinOnly, onUnlock, onClose, onLogout }: { me: string; username: string; till: string; pinOnly: boolean; onUnlock: () => void; onClose: () => void; onLogout: () => void }) {
  const { session } = useSession();
  const [by, setBy] = useState<'pin' | 'pw'>('pin');
  const [pin, setPin] = useState(''); const [err, setErr] = useState(''); const [up, setUp] = useState({ u: '', p: '' });
  const first = me.split(' ')[0];
  const ini = me.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const press = (k: string) => {
    if (k === 'C') return setPin(''); if (k === '⌫') return setPin((x) => x.slice(0, -1));
    const n = (pin + k).slice(0, 4); if (n.length < 4) return setPin(n); setPin('');
    const acc = ACCOUNTS.find((a) => a.username === username);
    if (!session || !mfaOk(session.name)) { secLog('Till PIN refused', `${session?.name} · no two-step sign-in on this device in the last 12 hours`, 'medium', username); setErr('Sign in again with your password and passcode.'); return onLogout(); }
    if (creds()[username]?.pinOff) return setErr('Till PIN sign-in is turned off for you. Use your username and password.');
    if (!acc || n !== (creds()[username]?.passcode || acc.passcode).slice(-4)) { secLog('Failed till PIN', `Wrong till PIN · ${me}`, 'medium', username); return setErr('Wrong PIN. Try again.'); }
    setErr(''); onUnlock();
  };
  return (
    <div className="fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="lk-h" className="w-full max-w-sm bg-white rounded-[28px] p-6 flex flex-col items-center gap-3 text-center">
        <span className="w-14 h-14 rounded-full bg-black text-white text-lg font-bold flex items-center justify-center">{ini}</span>
        <h2 id="lk-h" className="m-0 text-xl font-semibold">{pinOnly ? `Switch user · ${first}` : 'This till is locked'}</h2>
        {!pinOnly && <div role="tablist" className="flex gap-1 p-1 rounded-full bg-[#f2f4f5]">{([['pin', 'PIN'], ['pw', 'Username & password']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={by === k} onClick={() => { setBy(k); setErr(''); }} className={cx('h-8 px-3.5 rounded-full text-[13px]', by === k ? 'bg-black text-white font-semibold' : '')}>{l}</button>)}</div>}
        {err && <span role="alert" className="text-sm" style={{ color: RED }}>{err}</span>}
        {by === 'pw' && !pinOnly ? <form onSubmit={(e) => { e.preventDefault(); const a = ACCOUNTS.find((x) => x.username === up.u.trim().toLowerCase()); if (!a || (creds()[a.username]?.pw || a.password) !== up.p) { secLog('Failed till unlock', `Wrong username or password at ${till}`, 'medium', up.u); return setErr('That username and password don’t match.'); } if (a.username !== username) return setErr(`This till is signed in to ${me}. To change person, log out and sign in.`); setErr(''); onUnlock(); }} className="w-full flex flex-col gap-2"><input value={up.u} onChange={(e) => setUp({ ...up, u: e.target.value })} placeholder="Username" autoComplete="username" className="h-12 rounded-full border border-[#d9d9d9] px-4" /><input type="password" value={up.p} onChange={(e) => setUp({ ...up, p: e.target.value })} placeholder="Password" autoComplete="current-password" className="h-12 rounded-full border border-[#d9d9d9] px-4" /><button className="h-12 rounded-full text-white font-semibold" style={{ background: TEAL }}>Unlock</button></form>
          : <><p className="m-0 text-sm text-[#5f5c5a]">Enter your 4-digit till PIN, {first}.</p>
            <div className="flex gap-3" aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>{[0, 1, 2, 3].map((i) => <span key={i} className={cx('w-4 h-4 rounded-full border-2 border-black', i < pin.length && 'bg-black')} />)}</div>
            <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v.length === 4) { setPin(v.slice(0, 3)); press(v[3]); } else setPin(v); }} aria-label="Till PIN" className="sm:hidden h-12 w-full rounded-full border border-[#d9d9d9] text-center tracking-[0.5em]" />
            <div className="hidden sm:grid grid-cols-[repeat(3,58px)] gap-2">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => <button key={k} aria-label={k === '⌫' ? 'Delete' : k === 'C' ? 'Clear' : k} onClick={() => press(k)} className="h-[58px] rounded-[18px] border border-[#ebebeb] text-xl font-semibold hover:bg-[#f2f4f5]">{k}</button>)}</div></>}
        <button onClick={onLogout} className="text-sm underline text-[#5f5c5a]">Not {first}? Log out so someone else can sign in</button>
        {!pinOnly && <button onClick={onClose} className="h-9 px-4 rounded-full border border-[#d9d9d9] text-[13px]">Close shift</button>}
      </div>
    </div>
  );
}
