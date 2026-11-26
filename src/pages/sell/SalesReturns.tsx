import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Toast } from '../../components/ui';
import { CAT, SALES, type Sale } from '../../data/sell';
import { PEOPLE } from '../../data/nav';
import { usePersist, nowTxt, readKey, writeKey } from '../../lib/persist';
import type { TillSale } from '../pos/model';
import { FLOAT } from '../../data/finance';
import { useSession } from '../../lib/session';
import { returnSaleStock } from '../../lib/stock';
import { cx, ghs } from '../../lib/format';
import { Card, Pills } from '../finance/shared';
import { companyBiz, downloadPdf, saleDoc } from '../../lib/docPdfs';
import { bizInfo } from '../pos/Docs';
import { companyLogo } from '../../lib/brand';
import { BRANCHES } from '../../data/nav';

type Tab = 'sales' | 'returns' | 'shifts';
type Ret = { no: string; ref: string; status: 'Completed' | 'Waiting for Supervisor'; amount: number; item: string; refund: string; at: string };
const REASONS: [string, string, 'ok' | 'dmg' | ''][] = [['', 'Choose a reason…', ''], ['changed', 'Customer changed mind · undamaged', 'ok'], ['wrong', 'Wrong item or size · undamaged', 'ok'], ['unopened', 'Unopened, not needed (all undamaged)', 'ok'], ['damaged', 'Damaged', 'dmg'], ['notworking', 'Not working / faulty', 'dmg'], ['expired', 'Expired or spoilt', 'dmg']];
const SUPS: Record<string, string[]> = { 'TCL Electronics Ghana': ['TCL'], 'Nasco Electronics': ['Nasco'], 'Samsung Electronics West Africa': ['Samsung'], 'LG Electronics Ghana': ['LG'], 'Hisense Ghana': ['Hisense'], 'Midea Ghana': ['Midea'], 'Bruhm Ghana': ['Bruhm'], 'Binatone Ghana': ['Binatone'], 'MultiChoice Ghana': ['DStv', 'GOtv'], 'Sony Ghana': ['Sony'] };
const supFor = (n: string) => Object.keys(SUPS).find((s) => SUPS[s].some((k) => n.includes(k))) ?? '';
const NOTES = [200, 100, 50, 20, 10, 5, 2, 1];
const BRN: Record<string, string> = { osu: 'Osu', legon: 'East Legon', adum: 'Adum' };

export default function SalesReturns() {
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  const me = PEOPLE[role].name;
  const { tab: tabP } = useParams();
  const [tab, setTab] = useState<Tab>((tabP as never) || 'sales');
  const [chan, setChan] = useState<'all' | 'till' | 'web'>('all');
  const [filter, setFilter] = useState('all');
  const [sq, setSq] = useState('');
  const [sN, setSN] = useState(12);
  const [voided, setVoided] = usePersist<Record<string, boolean>>('ecompos.voided2', {});
  const [cur, setCur] = useState('');
  const [askVoid, setAskVoid] = useState(false);
  const [rets, setRets] = usePersist<Ret[]>('ecompos.returns2', [
    { no: 'R-0112', ref: 'Sale #34390822', status: 'Completed', amount: 520, item: 'Nasco 18" Wall Fan · Not working / faulty', refund: 'Refund to MoMo', at: '17 Nov 2026' },
    { no: 'R-0111', ref: 'Sale #34390701', status: 'Completed', amount: 0, item: 'Binatone 16" Standing Fan · Wrong item or size', refund: 'Exchange · even swap', at: '16 Nov 2026' },
  ]);
  const [toast, setToast] = useState('');
  const [viewAs, setViewAs] = useState<'manager' | 'staff'>(role === 'staff' ? 'staff' : 'manager');
  const brs = role === 'superuser' ? (viewBranch === 'all' ? null : viewBranch) : session?.branch ?? 'osu';

  const [till] = usePersist<TillSale[]>('ecompos.sales2', []);
  const whyOf = useMemo(() => Object.fromEntries(till.filter((t) => t.adminWhy).map((t) => [t.no, t.adminWhy as string])), [till]);
  const all = useMemo(() => [...till.map((t): Sale => ({ no: t.no, ts: t.ts, day: new Date(t.ts).toISOString().slice(0, 10), br: t.br, staff: t.staff, cust: t.cust?.name || t.biz?.name || 'Walk-in', phone: t.cust?.phone || '', method: t.method, lines: t.lines.map((l) => ({ name: l.name, qty: l.qty, each: l.price })), total: t.total, ch: 'till', status: t.status === 'voided' ? 'voided' : 'completed', cost: t.lines.reduce((a, l) => a + l.cost * l.qty, 0) })), ...SALES.slice(0, 600)].filter((s) => !brs || s.br === brs).map((s) => (voided[s.no] ? { ...s, status: 'voided' as const } : s)), [brs, voided, till]);
  const staffView = role === 'staff' || viewAs === 'staff';
  const list = all.filter((s) => (!staffView || s.staff === (role === 'staff' ? me : PEOPLE.staff.name)) && (chan === 'all' || s.ch === chan) && (filter === 'all' || s.status === filter) && (!sq.trim() || (s.no + s.cust + s.lines.map((l) => l.name).join(' ')).toLowerCase().includes(sq.toLowerCase())));
  const curD = all.find((s) => s.no === cur) ?? list[0];

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Sales & returns</h1><p className="m-0 text-sm text-muted">{staffView ? 'Your sales only · Sales staff see their own sales' : `All tills, staff and online orders · every sale, held basket and return · ${brs ? BRN[brs] + ' branch' : 'all branches'}`}</p></div>
        <span className="flex items-center gap-2 text-xs text-muted">Viewing as {role === 'staff' ? <b className="text-black">{me} · Sales staff</b> : <Pills small opts={[['manager', PEOPLE[role].level === 'Admin' ? 'Manager' : PEOPLE[role].level], ['staff', 'Sales staff']]} value={viewAs} onChange={(v) => setViewAs(v as 'manager' | 'staff')} />}</span>
      </header>
      <Pills opts={[['sales', 'Sales'], ['returns', 'Returns'], ['shifts', 'Shifts & cash-up']]} value={tab} onChange={setTab} />

      {tab === 'sales' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px] items-start">
          <section className="card p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center gap-2 flex-wrap"><h2 className="m-0 text-lg font-semibold">Sales & online orders · {list.length}</h2><Pills small opts={[['all', 'All'], ['till', 'Till sales'], ['web', 'Online orders']]} value={chan} onChange={setChan} /></div>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">Search sales<input value={sq} onChange={(e) => setSq(e.target.value)} placeholder="Search by customer name, item, receipt, sale, invoice or order number" className="field font-normal py-2.5" /></label>
            <Pills small opts={['all', 'open', 'held', 'completed', 'cancelled', 'voided'].map((f) => [f, f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)] as [string, string])} value={filter} onChange={setFilter} />
            {list.slice(0, sN).map((s) => (
              <button key={s.no} onClick={() => { setCur(s.no); setAskVoid(false); }} aria-pressed={curD?.no === s.no} className={cx('text-left p-3 rounded-2xl border flex flex-col gap-1', curD?.no === s.no ? 'border-black' : 'border-line hover:bg-canvas')}>
                <span className="flex justify-between gap-2"><span className="text-xs text-muted">{s.ch === 'web' ? 'Online order' : 'Till sale'} · <b className="text-black">RCP-{s.no}</b></span><b>{ghs(s.total)}</b></span>
                <span className="flex justify-between gap-2 text-sm"><span>{s.cust} <span className="text-xs text-muted">· {new Date(s.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {s.staff}</span></span><StatusPill s={s.status} /></span>
                <span className="text-xs text-muted truncate">{s.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</span>
              </button>
            ))}
            {list.length > sN && <button onClick={() => setSN(sN + 12)} className="btn-ghost w-fit">Show {Math.min(12, list.length - sN)} more</button>}
            {!list.length && <span className="text-sm text-muted">No sale matches that search or filter.</span>}
          </section>
          {curD && (
            <section className="card p-5 sm:p-6 flex flex-col gap-3 xl:sticky xl:top-6">
              <span className="text-xs text-muted">{curD.ch === 'web' ? 'Online order' : 'Till sale'}</span>
              <h2 className="m-0 text-[22px] font-semibold">RCP-{curD.no}</h2>
              {[['Customer', curD.cust + (curD.phone ? ` · ${curD.phone}` : '')], ['When', new Date(curD.ts).toLocaleString('en-GB')], ['Branch · sold by', `${BRN[curD.br]} · ${curD.staff}`], ['Paid by', curD.method === 'CREDIT' ? 'Credit' : curD.method], ['Status', curD.status[0].toUpperCase() + curD.status.slice(1)]].map(([k, v]) => <div key={k} className="flex justify-between text-sm gap-3"><span className="text-muted">{k}</span><b className="text-right">{v}</b></div>)}
              <div className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-1">{curD.lines.map((l) => <div key={l.name} className="flex justify-between gap-2"><span>{l.name}</span><span className="text-muted">{l.qty} × {ghs(l.each)}</span><b>{ghs(l.qty * l.each)}</b></div>)}<div className="flex justify-between font-semibold border-t border-line pt-1"><span>Total</span><span>{ghs(curD.total)}</span></div></div>
              {whyOf[curD.no] && <div className="text-sm px-3 py-2 rounded-xl bg-amber-50"><b>Sold by Admin (exceptional)</b> · {whyOf[curD.no]}</div>}
              {role === 'superuser' && <div className="flex justify-between text-sm px-3 py-2 rounded-xl bg-brand-50"><span>Profit on this sale · Admin only</span><b>{ghs(curD.total - curD.cost)}</b></div>}
              <div className="flex gap-2 flex-wrap">
                {curD.status === 'completed' && <button onClick={() => setTab('returns')} className="btn-primary">Return or exchange items</button>}
                {/* PDF copies of this sale (lib/docPdfs.ts), plus the printer reprint. */}
                <button onClick={() => { void downloadPdf(saleDoc(curD, companyBiz(bizInfo(), companyLogo()), 'receipt', BRANCHES.find((b) => b.id === curD.br)?.short ?? curD.br), `receipt-${curD.no}`); }} className="btn-ghost">⬇ Receipt PDF</button>
                <button onClick={() => { void downloadPdf(saleDoc(curD, companyBiz(bizInfo(), companyLogo()), 'invoice', BRANCHES.find((b) => b.id === curD.br)?.short ?? curD.br), `invoice-${curD.no}`); }} className="btn-ghost">⬇ Invoice PDF</button>
                <button onClick={() => window.print()} className="btn-ghost">Print</button>
                {curD.status === 'held' && <Link to="/sell" className="btn-dark">Resume at till</Link>}
                {role !== 'staff' && curD.status !== 'voided' && <button onClick={() => setAskVoid(true)} className="btn border border-danger text-danger">Void sale</button>}
              </div>
              {askVoid && <div className="p-3 rounded-2xl bg-red-50 flex flex-col gap-2 text-sm"><span>Void RCP-{curD.no}? Stock goes back and the sale stays in the record as Voided. This is logged in the audit trail.</span><div className="flex gap-2"><button onClick={() => setAskVoid(false)} className="btn-ghost min-h-9 text-xs">Keep sale</button><button onClick={() => { /* voided: a till sale's stock goes back on the shelf (once); history sales took no live stock */ returnSaleStock(curD.no); setVoided((v) => ({ ...v, [curD.no]: true })); setAskVoid(false); setToast(`RCP-${curD.no} voided`); }} className="btn bg-danger text-white min-h-9 text-xs">Void sale</button></div></div>}
            </section>
          )}
        </div>
      )}

      {tab === 'returns' && <Returns all={all} seed={curD} rets={rets} onDone={(r) => { setRets((x) => [r, ...x]); setToast(`${r.no} saved`); }} role={role} />}
      {tab === 'shifts' && <Shift onClose={(m) => setToast(m)} />}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}

function StatusPill({ s }: { s: Sale['status'] }) {
  return <span className={cx('pill', s === 'completed' ? 'bg-green-100 text-green-800' : s === 'voided' || s === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{s[0].toUpperCase() + s.slice(1)}</span>;
}

type RL = { name: string; each: number; max: number; on: boolean; qty: number; reason: string; sup: string; note: string };
function Returns({ all, seed, rets, onDone, role }: { all: Sale[]; seed?: Sale; rets: Ret[]; onDone: (r: Ret) => void; role: string }) {
  const [mode, setMode] = useState<'receipt' | 'noreceipt'>('receipt');
  const [q, setQ] = useState('');
  const [nq, setNq] = useState('');
  const [date, setDate] = useState('');
  const [doc, setDoc] = useState<Sale | null>(seed && seed.status === 'completed' ? seed : null);
  const [lines, setLines] = useState<RL[]>(() => (seed ? seed.lines.map((l) => ({ name: l.name, each: l.each, max: l.qty, on: false, qty: 1, reason: '', sup: supFor(l.name), note: '' })) : []));
  const [kind, setKind] = useState<'refund' | 'exchange'>('refund');
  const [refTo, setRefTo] = useState('Original payment');
  const [xq, setXq] = useState('');
  const [xs, setXs] = useState<{ name: string; price: number; qty: number }[]>([]);
  const [xTop, setXTop] = useState('Cash');
  const [xGive, setXGive] = useState('Store credit');

  const [svOk, setSvOk] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Ret | null>(null);
  const hits = mode === 'receipt' ? (q.trim().length >= 2 ? all.filter((s) => s.status === 'completed' && (s.no + s.cust).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []) : (nq.trim().length >= 2 ? all.filter((s) => s.status === 'completed' && s.cust.toLowerCase().includes(nq.toLowerCase()) && (!date || s.day === date)).slice(0, 6) : []);
  const pick = (s: Sale) => { setDoc(s); setLines(s.lines.map((l) => ({ name: l.name, each: l.each, max: l.qty, on: false, qty: 1, reason: '', sup: supFor(l.name), note: '' }))); setErr(''); };
  const sel = lines.filter((l) => l.on);
  const selQty = sel.reduce((a, l) => a + l.qty, 0);
  const back = sel.reduce((a, l) => a + l.qty * l.each, 0);
  const newT = xs.reduce((a, x) => a + x.qty * x.price, 0);
  const diff = newT - back;
  const needSv = mode === 'noreceipt' || role === 'staff';
  const upL = (i: number, p: Partial<RL>) => setLines((L) => L.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const save = () => {
    if (!doc) return setErr('Find the purchase first.');
    if (!sel.length) return setErr('Tick at least one item.');
    if (selQty > 3) return setErr('Only 3 items or fewer can be returned at a time.');
    if (sel.some((l) => !l.reason)) return setErr('Choose a reason for every item.');
    if (sel.some((l) => REASONS.find((r) => r[0] === l.reason)?.[2] === 'dmg' && !l.note.trim())) return setErr('Add a note for the supplier claim on damaged items.');
    if (kind === 'exchange' && !xs.length) return setErr('Add the new items for the exchange.');
    if (needSv && !svOk) return setErr('A Supervisor must confirm this return.');
    const r: Ret = { no: 'R-0' + (113 + rets.length), ref: `Sale #${doc.no}`, status: 'Completed', amount: kind === 'refund' ? back : Math.abs(diff), item: sel.map((l) => `${l.qty > 1 ? l.qty + ' × ' : ''}${l.name} · ${REASONS.find((x) => x[0] === l.reason)?.[1]}`).join('; '), refund: kind === 'refund' ? `Refund to ${refTo}` : diff > 0 ? `Exchange · customer topped up ${ghs(diff)} by ${xTop}` : diff < 0 ? `Exchange · balance ${ghs(-diff)} given as ${xGive}` : 'Exchange · even swap', at: nowTxt() };
    onDone(r); setDone(r);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px] items-start">
      <Card title="New return or exchange" sub="Up to 3 items per return">
        {done ? (
          <div className="p-4 rounded-2xl bg-[#f3fbf4] border border-ok flex flex-col gap-2"><strong className="text-ok">✓ {done.no} saved · {done.refund}</strong><span className="text-sm">{done.item}</span><span className="text-xs text-muted">Undamaged items went back to stock. Damaged items were written off to the supplier as a claim in Damages & suppliers.</span><button onClick={() => { setDone(null); setDoc(null); setLines([]); setXs([]); setSvOk(false); setQ(''); }} className="btn-primary w-fit">Start another return</button></div>
        ) : (
          <>
            <span className="text-[13px] font-bold text-brand uppercase tracking-wide">1 · Find the purchase</span>
            <Pills small opts={[['receipt', 'Has a receipt or number'], ['noreceipt', 'No receipt']]} value={mode} onChange={setMode} />
            {mode === 'receipt' ? <label className="flex flex-col gap-1 text-[13px] font-semibold">Customer name, receipt, sale, invoice or online order number<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Ama Owusu, 472295, #0003, INV-OSU-1190, WEB 3" className="field font-normal py-2.5" /></label> : (
              <div className="flex gap-3 flex-wrap items-end"><label className="flex flex-col gap-1 text-[13px] font-semibold flex-1">Customer name<input value={nq} onChange={(e) => setNq(e.target.value)} placeholder="Name the customer gives" className="field font-normal py-2.5" /></label><label className="flex flex-col gap-1 text-[13px] font-semibold">Date of purchase<input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="px-3 py-2.5 rounded-full border border-line font-normal" /></label><span className="text-xs text-muted w-full">No receipt: search by the name and the day it was bought. A Supervisor must approve.</span></div>
            )}
            {!doc && hits.map((h) => <button key={h.no} onClick={() => pick(h)} className="text-left p-3 rounded-2xl border border-line hover:bg-canvas text-sm flex justify-between gap-2"><span><b>RCP-{h.no}</b> · {h.cust} · {new Date(h.ts).toLocaleDateString('en-GB')}<br /><span className="text-xs text-muted">{h.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</span></span><b>{ghs(h.total)}</b></button>)}
            {!doc && (q.trim().length >= 2 || nq.trim().length >= 2) && !hits.length && <span className="text-sm text-muted">No purchase found. Check the spelling, the number or the date.</span>}
            {doc && (
              <>
                <div className="flex justify-between items-center p-3 rounded-2xl bg-canvas text-sm gap-2"><span><b>RCP-{doc.no}</b> · {doc.cust}<br /><span className="text-xs text-muted">{new Date(doc.ts).toLocaleDateString('en-GB')} · paid by {doc.method}</span></span><button onClick={() => setDoc(null)} className="text-xs underline">Change</button></div>
                <span className="text-[13px] font-bold text-brand uppercase tracking-wide">2 · Tick the items coming back · {selQty} of 3</span>
                {lines.map((l, i) => {
                  const dmg = REASONS.find((r) => r[0] === l.reason)?.[2] === 'dmg';
                  return (
                    <div key={l.name} className={cx('p-3 rounded-2xl border flex flex-col gap-2', l.on ? 'border-brand' : 'border-line')}>
                      <div className="flex items-center gap-2 flex-wrap"><input type="checkbox" aria-label={`Return ${l.name}`} checked={l.on} onChange={() => upL(i, { on: !l.on })} className="w-4 h-4 accent-[#0b5c5c]" /><span className="flex-1 text-sm"><b>{l.name}</b><br /><span className="text-xs text-muted">{ghs(l.each)} each · bought {l.max}</span></span>{l.on && <><button aria-label="One less" onClick={() => upL(i, { qty: Math.max(1, l.qty - 1) })} className="w-7 h-7 rounded-full border border-line">−</button><b className="w-5 text-center">{l.qty}</b><button aria-label="One more" onClick={() => upL(i, { qty: Math.min(l.max, l.qty + 1) })} className="w-7 h-7 rounded-full border border-line">+</button></>}<b className="w-24 text-right text-sm">{ghs(l.qty * l.each)}</b></div>
                      {l.on && <label className="flex flex-col gap-1 text-xs font-semibold">Reason for return (required)<select value={l.reason} onChange={(e) => upL(i, { reason: e.target.value })} className="px-3 py-2 rounded-full border border-line font-normal text-sm">{REASONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>}
                      {l.on && dmg && <div className="grid sm:grid-cols-2 gap-2"><label className="flex flex-col gap-1 text-xs font-semibold">Write off to supplier<select value={l.sup} onChange={(e) => upL(i, { sup: e.target.value })} className="px-3 py-2 rounded-full border border-line font-normal text-sm"><option value="">Our loss (no supplier)</option>{Object.keys(SUPS).map((s) => <option key={s}>{s}</option>)}</select></label><label className="flex flex-col gap-1 text-xs font-semibold">Note for the supplier claim (required)<input value={l.note} onChange={(e) => upL(i, { note: e.target.value })} placeholder="What is wrong, batch or serial number, how it was found" className="px-3 py-2 rounded-full border border-line font-normal text-sm" /></label></div>}
                      {l.on && l.reason && <span className="text-xs text-muted">{dmg ? `Goes to Damages · claimed from ${l.sup || 'nobody (our loss)'}` : 'Goes back on the shelf for resale'}</span>}
                    </div>
                  );
                })}
                {selQty > 3 && <span className="text-sm text-danger">Only 3 items or fewer can be returned at a time. Remove {selQty - 3} to continue.</span>}
                <span className="text-[13px] font-bold text-brand uppercase tracking-wide">3 · Refund or exchange</span>
                <Pills small opts={[['refund', 'Refund'], ['exchange', 'Exchange']]} value={kind} onChange={setKind} />
                {kind === 'refund' ? <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Refund to</span><Pills small opts={[['Original payment', 'Original payment'], ['Cash', 'Cash'], ['MoMo', 'MoMo'], ['Store credit', 'Store credit']]} value={refTo} onChange={setRefTo} /></div> : (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold">New items for the customer<input value={xq} onChange={(e) => setXq(e.target.value)} placeholder="Type to search products" className="px-4 py-2 rounded-full border border-line font-normal text-sm" /></label>
                    {xq.trim() && CAT.filter((c) => c[0].toLowerCase().includes(xq.toLowerCase())).slice(0, 5).map((c) => <button key={c[0]} onClick={() => { setXs((L) => (L.some((x) => x.name === c[0]) ? L.map((x) => (x.name === c[0] ? { ...x, qty: x.qty + 1 } : x)) : [...L, { name: c[0], price: c[1], qty: 1 }])); setXq(''); }} className="flex justify-between text-sm px-3 py-2 rounded-xl hover:bg-canvas"><span>{c[0]}</span><span>{ghs(c[1])} · Add</span></button>)}
                    {xs.map((x) => <div key={x.name} className="flex items-center gap-2 text-sm"><span className="flex-1">{x.name}</span><button aria-label="One less" onClick={() => setXs((L) => L.map((y) => (y.name === x.name ? { ...y, qty: y.qty - 1 } : y)).filter((y) => y.qty > 0))} className="w-7 h-7 rounded-full border border-line">−</button><b>{x.qty}</b><button aria-label="One more" onClick={() => setXs((L) => L.map((y) => (y.name === x.name ? { ...y, qty: y.qty + 1 } : y)))} className="w-7 h-7 rounded-full border border-line">+</button><b className="w-24 text-right">{ghs(x.qty * x.price)}</b></div>)}
                  </div>
                )}
                {kind === 'exchange' && xs.length > 0 && (diff > 0 ? <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Customer tops up by</span><Pills small opts={[['Cash', 'Cash'], ['Mobile Money', 'Mobile Money'], ['Card', 'Card']]} value={xTop} onChange={setXTop} /></div> : diff < 0 ? <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Give the customer the balance as</span><Pills small opts={[['Store credit', 'Store credit'], ['Cash', 'Cash'], ['Mobile Money', 'Mobile Money']]} value={xGive} onChange={setXGive} /></div> : null)}
                <div className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-1">{[['Coming back', ghs(back)], ...(kind === 'exchange' ? [['New items', ghs(newT)], [diff >= 0 ? 'Customer tops up' : 'Balance to the customer', ghs(Math.abs(diff))]] : [['Refund', ghs(back)]])].map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><b>{v}</b></div>)}</div>
                {needSv && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={svOk} onChange={() => setSvOk(!svOk)} className="w-4 h-4 accent-[#0b5c5c]" />Supervisor has checked the items and approves this return</label>}
                {err && <span role="alert" className="text-sm text-danger">{err}</span>}
                <button onClick={save} className="btn-primary">{kind === 'refund' ? `Complete return · refund ${ghs(back)}` : 'Complete exchange'}</button>
              </>
            )}
          </>
        )}
      </Card>
      <Card title="Returns & exchanges">
        {rets.map((r) => <div key={r.no} className="p-3 rounded-2xl border border-line flex flex-col gap-1 text-sm"><div className="flex justify-between gap-2"><span><b>{r.no}</b> <span className="text-xs text-muted">{r.ref} · {r.at}</span></span><span className={cx('pill', r.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{r.status}</span></div><span>{r.item}</span><span className="flex justify-between text-xs text-muted"><span>{r.refund}</span><b className="text-black">{ghs(r.amount)}</b></span></div>)}
      </Card>
    </div>
  );
}

function Shift({ onClose }: { onClose: (m: string) => void }) {
  const [n, setN] = useState<Record<number, number>>({});
  const [closed, setClosed] = useState(false);
  const counted = NOTES.reduce((a, d) => a + d * (n[d] || 0), 0);
  const { session } = useSession();
  const me = PEOPLE[session?.role ?? 'staff'].name;
  const br = session?.branch && session.branch !== 'all' ? session.branch : 'osu';
  const today = readKey<TillSale[]>('ecompos.sales2', []).filter((t) => t.staff === me && new Date(t.ts).toDateString() === new Date().toDateString() && t.status === 'completed');
  const cashSales = today.reduce((a, t) => a + (t.parts.find((p) => p.m === 'Cash')?.amt || 0) - t.change, 0);
  const refunds = readKey<{ by: string; to: string; value: number; ts: number }[]>('ecompos.tillReturns', []).filter((r) => r.by === me && r.to === 'Refund (cash)' && new Date(r.ts).toDateString() === new Date().toDateString()).reduce((a, r) => a + r.value, 0);
  const expected = FLOAT + cashSales - refunds;
  const diff = counted - expected;
  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card title={`Close shift · Till 1 · ${me}`} sub={`Opened 07:58 with a float of ${ghs(FLOAT)}`}>
        {NOTES.map((d) => <div key={d} className="flex items-center gap-3 text-sm"><span className="w-20 font-semibold">GHS {d}</span><button aria-label={`One less GHS ${d}`} onClick={() => setN({ ...n, [d]: Math.max(0, (n[d] || 0) - 1) })} className="w-8 h-8 rounded-full border border-line">−</button><b className="w-8 text-center">{n[d] || 0}</b><button aria-label={`One more GHS ${d}`} onClick={() => setN({ ...n, [d]: (n[d] || 0) + 1 })} className="w-8 h-8 rounded-full border border-line">+</button><span className="ml-auto text-muted">{ghs(d * (n[d] || 0))}</span></div>)}
      </Card>
      <Card title="Cash-up">
        {[['Float', ghs(FLOAT)], ['Cash sales', ghs(cashSales)], ['Cash refunds', '− ' + ghs(refunds)], ['Expected', ghs(expected)], ['Counted', ghs(counted)]].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><b>{v}</b></div>)}
        <div className={cx('flex justify-between font-semibold text-base border-t border-line pt-2', diff === 0 ? 'text-ok' : diff < 0 ? 'text-danger' : 'text-[#b26a00]')}><span>{diff === 0 ? 'Exact' : diff < 0 ? 'Short' : 'Over'}</span><span>{diff ? (diff > 0 ? '+ ' : '− ') + ghs(Math.abs(diff)) : ghs(0)}</span></div>
        <button disabled={closed || counted === 0} onClick={() => { setClosed(true); if (diff < -20) writeKey('ecompos.issues2', [{ id: 'IS-' + Date.now().toString().slice(-4), kind: 'Till shortage', br, text: `${me} · Till 1 cash-up ${ghs(-diff)} short`, by: me, at: nowTxt(), read: false }, ...readKey<unknown[]>('ecompos.issues2', [])]); onClose(diff < -20 ? `Shift closed · Z-report printed · till shortage issue raised for ${ghs(-diff)}` : 'Shift closed · Z-report printed'); window.print(); }} className="btn-primary">{closed ? 'Shift closed' : 'Close shift & print Z-report'}</button>
        <span className="text-xs text-muted">A shortage over GHS 20.00 raises a till shortage issue automatically.</span>
      </Card>
    </div>
  );
}
