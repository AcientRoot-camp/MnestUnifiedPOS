// Inventory: stock levels, movements, transfers and purchase orders (both received by scanning, with batch / expiry),
// and the blind stock take (large variances go to Approvals before they change the stock).
import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BRS, MOVES0, PRODUCTS0, brName, now, total, type BrId, type Move, type Product } from '../../data/catalogue';
import { LOG0, type StockLine } from '../../data/stockLog';
import { PEOPLE } from '../../data/nav';
import { COMPANY } from '../../data/hirePurchase';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import CompanyLogo from '../../components/CompanyLogo';
import { ReceiveScan, StockInScan, StockTake, type BatchIn, type CountReport, type RecvDoc, type StockInTo } from './ScanStock';
import { BIG_VARIANCE, saveBatches, type CountReq } from '../../lib/stockOps';
import { REQS0 } from '../admin/Approvals';
import { cartonOf, perCarton } from '../../lib/barcode';
import { readKey, writeKey } from '../../lib/persist';

type Tab = 'stock' | 'moves' | 'transfers' | 'po' | 'count';
/** A purchase order: supplier, where it is received, lines in cartons (with the carton size) and how many singles came in. */
type PoLine = { name: string; cartons: number; per: number; got: number; landed?: number };
type PO = { id: string; sup: string; to: string; status: 'open' | 'partial' | 'received'; lines: PoLine[]; at: string; log: string[] };
const POS0: PO[] = [
  { id: 'PO-0312', sup: 'TCL Electronics Ghana', to: 'wh', status: 'partial', at: '3 Nov 2026', log: ['Imported · freight, duty and clearing spread over the units'], lines: [{ name: 'TCL 43" 4K UHD Google TV', cartons: 20, per: 1, got: 20, landed: 4020 }, { name: 'TCL 55" QLED Google TV', cartons: 10, per: 1, got: 10, landed: 7240 }, { name: 'TCL 252L Double-Door Fridge', cartons: 10, per: 1, got: 10, landed: 5210 }, { name: 'TCL 1.5HP Inverter Split Air Conditioner', cartons: 14, per: 1, got: 0 }] },
  { id: 'PO-0313', sup: 'Nasco Electronics', to: 'osu', status: 'open', at: '22 Nov 2026', log: ['Sent to Nasco Electronics'], lines: [{ name: 'Nasco 18" Wall Fan', cartons: 4, per: 6, got: 0 }] },
];
type Ret = { id: string; no: string; who: string; reason: string; br: BrId; lines: { name: string; qty: number; dmg: number }[]; done?: string };
const RETS0: Ret[] = [{ id: 'RR-0021', no: '34410055', who: 'Abena Ofori', reason: 'Wrong item delivered', br: 'osu', lines: [{ name: 'Binatone 16" Standing Fan', qty: 2, dmg: 0 }, { name: 'GOtv Supa+ Decoder', qty: 1, dmg: 1 }] }];
const REASONS = ['Recount', 'Damaged', 'Expired', 'Theft or loss', 'Found stock', 'Supplier return'];

export default function Inventory() {
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role].name;
  const myBr = (session?.branch ?? 'osu') as BrId;
  const [P, setP] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [paper, setPaper] = useState<'A4' | 'Letter'>('A4');
  const [log, setLog] = usePersist<StockLine[]>('ecompos.stockLog2', LOG0);
  const [moves, setMoves] = usePersist<Move[]>('ecompos.moves2', MOVES0);
  const [rets, setRets] = usePersist<Ret[]>('ecompos.invReturns2', RETS0);
  const tabs: [Tab, string][] = [['stock', 'Stock levels'], ['moves', 'Stock movements'], ['transfers', 'Transfers'], ...(role !== 'staff' ? ([['po', 'Purchase orders']] as [Tab, string][]) : []), ...(role !== 'staff' ? ([['count', 'Stock take']] as [Tab, string][]) : [])];
  const { tab: tabP } = useParams();
  const [tab, setTab] = useState<Tab>((tabP as never) || 'stock');
  const [q, setQ] = useState('');
  const [view, setView] = useState('all');
  const [prt, setPrt] = useState<'' | 'count' | 'list' | 'low'>('');
  const [prtBr, setPrtBr] = useState('all');
  const [adj, setAdj] = useState('');
  const [adjR, setAdjR] = useState('Recount');
  const [adjBr, setAdjBr] = useState<BrId>(myBr);
  const [adjQ, setAdjQ] = useState('');
  const [adjErr, setAdjErr] = useState('');
  const [val, setVal] = useState('Average cost');
  const [rcv, setRcv] = useState<Move | null>(null); // transfer being received by scanning
  const [pos, setPos] = usePersist<PO[]>('ecompos.pos2', POS0);
  const [rcvPo, setRcvPo] = useState<PO | null>(null); // purchase order being received by scanning
  const [stockIn, setStockIn] = useState(false); // "Stock in by scanning" window (camera on tablets, scanner on computers)
  const [reord, setReord] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const brs = SU ? (viewBranch === 'all' ? BRS.map((b) => b.id) : [viewBranch as BrId]) : [myBr];
  const [sold2] = usePersist<Record<string, Record<string, number>>>('ecompos.stockMoves', {});
  // What the tills and the online store sold comes off each branch's count.
  const live = useMemo(() => P.filter((p) => p.status === 'live' && p.track !== 'digital').map((p) => ({ ...p, stock: Object.fromEntries(BRS.map((b) => [b.id, Math.max(0, p.stock[b.id] - Number(sold2[p.name]?.[b.id] || 0))])) as Product['stock'] })), [P, sold2]);
  const sold = (p: Product) => p.sold30;
  const matches = (v: string, p: Product) => v === 'all' || (v === 'low' && BRS.some((b) => p.stock[b.id] <= p.reorder)) || (v === 'fast' && sold(p) >= 100) || (v === 'slow' && sold(p) > 0 && sold(p) < 20) || (v === 'none' && sold(p) === 0);
  const inView = (p: Product) => matches(view, p);
  // Search by name or category, or scan / type a barcode (single or carton) to pick a product for an adjustment.
  const rows = live.filter((p) => inView(p) && (!q.trim() || (p.name + p.cat).toLowerCase().includes(q.toLowerCase()) || [p.barcode, cartonOf(p)].includes(q.trim().replace(/\s/g, ''))));
  const value = live.reduce((a, p) => a + total(p) * p.cost, 0);
  const a = P.find((p) => p.id === adj);
  const addLog = (lines: Omit<StockLine, 'ts' | 'at' | 'by'>[]) => setLog((x) => [...lines.map((l, i) => ({ ...l, ts: Date.now() + i, at: now(), by: me })), ...x].slice(0, 500));

  const applyAdj = () => {
    if (!a) return;
    const n = parseInt(adjQ, 10);
    if (!n) return setAdjErr('Type how many to add (+) or take away (−).');
    if (a.stock[adjBr] + n < 0) return setAdjErr(`${brName(adjBr)} only has ${a.stock[adjBr]}.`);
    setP((x) => x.map((p) => (p.id === a.id ? { ...p, stock: { ...p.stock, [adjBr]: p.stock[adjBr] + n } } : p)));
    addLog([{ name: a.name, br: adjBr, qty: n, kind: `Adjustment · ${adjR}`, ref: 'Manual' }]);
    setAdjQ(''); setAdjErr(''); setMsg(`${a.name} at ${brName(adjBr)} ${n > 0 ? '+' : ''}${n} · ${adjR}`);
  };
  /** Post a scanned stock-in: add the counts to the branch (or warehouse) and log each line. */
  const postStockIn = (to: StockInTo, counts: Record<string, number>, ref: string) => {
    setP((x) => x.map((p) => { const n = counts[p.name]; if (!n) return p; return to === 'wh' ? { ...p, wh: p.wh + n } : { ...p, stock: { ...p.stock, [to]: p.stock[to] + n } }; }));
    addLog(Object.entries(counts).map(([name, qty]) => ({ name, br: to, qty, kind: 'Stock in · scanned', ref: ref || 'Scan' })));
    setStockIn(false); setMsg(`Stock in posted · ${Object.values(counts).reduce((a2, n) => a2 + n, 0)} units added at ${brName(to)}`);
  };
  const receiveRet = (r: Ret) => {
    setP((x) => x.map((p) => { const l = r.lines.find((y) => y.name === p.name); return l ? { ...p, stock: { ...p.stock, [r.br]: p.stock[r.br] + l.qty - l.dmg } } : p; }));
    addLog(r.lines.map((l) => ({ name: l.name, br: r.br, qty: l.qty - l.dmg, kind: 'Online return received', ref: r.id })));
    setRets((x) => x.map((y) => (y.id === r.id ? { ...y, done: `${r.lines.reduce((s, l) => s + l.qty - l.dmg, 0)} back in stock · ${r.lines.reduce((s, l) => s + l.dmg, 0)} damaged logged · ${now()}` } : y)));
    setMsg(`${r.id} received and restocked`);
  };
  const receiveMove = (m: Move) => {
    setP((x) => x.map((p) => { const l = m.lines.find((y) => y.name === p.name); if (!l) return p; const s = { ...p.stock }; if (m.to !== 'wh') s[m.to as BrId] += l.qty; return { ...p, stock: s, wh: m.to === 'wh' ? p.wh + l.qty : p.wh }; }));
    setMoves((x) => x.map((y) => (y.id === m.id ? { ...y, status: 'received', log: [...y.log, { t: `Received at ${brName(m.to)} by ${me} · ${now()}` }] } : y)));
    addLog(m.lines.map((l) => ({ name: l.name, br: m.to, qty: l.qty, kind: 'Transfer received', ref: m.id })));
    setMsg(`${m.id} received at ${brName(m.to)}`);
  };
  /**
   * Post a scanned receipt: stock goes up by what was scanned (not what was sent), serial numbers are stored on the
   * product, the transfer becomes Received, and lines that differ get a variance note for the sending branch.
   */
  const receiveScanned = (m: Move, got: Record<string, number>, sns: Record<string, string[]>, bt: Record<string, BatchIn>) => {
    saveBatches(bt, got, m.to, m.id, me);
    setP((x) => x.map((p) => { const n = got[p.name] || 0; if (!n && !sns[p.name]) return p; const s2 = { ...p.stock }; if (m.to !== 'wh') s2[m.to as BrId] += n; return { ...p, stock: s2, wh: m.to === 'wh' ? p.wh + n : p.wh, serials: sns[p.name] ? [...(p.serials || []), ...sns[p.name]] : p.serials }; }));
    const exp = (n: string) => m.lines.filter((l) => l.name === n).reduce((a, l) => a + l.qty, 0);
    const names = [...new Set([...m.lines.map((l) => l.name), ...Object.keys(got)])];
    const diffs = names.map((n) => ({ n, d: (got[n] || 0) - exp(n) })).filter((x) => x.d !== 0);
    const note = diffs.length ? `Variance for ${brName(m.from)}: ${diffs.map((x) => `${x.d > 0 ? '+' : ''}${x.d} ${x.n}`).join(', ')}` : 'Scanned in full · matches the transfer';
    setMoves((x) => x.map((y) => (y.id === m.id ? { ...y, status: 'received', log: [...y.log, { t: `Received by scanning at ${brName(m.to)} by ${me} · ${now()}` }, { t: note }] } : y)));
    addLog(names.filter((n) => got[n]).map((n) => ({ name: n, br: m.to, qty: got[n], kind: 'Transfer received (scanned)', ref: m.id })));
    setRcv(null);
    setMsg(`${m.id} received at ${brName(m.to)} · ${note}`);
  };
  /** On-hand stock at a branch: branch stock minus what the tills and the online store sold. */
  const onHand = (p: Product, br: BrId) => Math.max(0, p.stock[br] - Number(sold2[p.name]?.[br] || 0));
  /** Post a stock take: correct each counted product to what was counted ("Count correction") and save the report. */
  /**
   * Post a stock take: small differences are corrected straight away ("Count correction"); a line whose variance is
   * GHS 200 or more at cost goes to Approvals first (productscan.md §4.3) and changes the stock only when the Admin
   * approves it. The variance report is saved either way.
   */
  const postCount = (r: CountReport) => {
    const big = r.lines.filter((l) => l.diff && Math.abs(l.value) >= BIG_VARIANCE);
    const small = r.lines.filter((l) => l.diff && Math.abs(l.value) < BIG_VARIANCE);
    setP((x) => x.map((p) => { const l = small.find((y) => y.name === p.name); return l ? { ...p, stock: { ...p.stock, [r.br]: p.stock[r.br] + l.diff } } : p; }));
    addLog(small.map((l) => ({ name: l.name, br: r.br, qty: l.diff, kind: 'Adjustment · Count correction', ref: `Stock take ${r.id}` })));
    if (big.length) writeKey('ecompos.discReq2', [...big.map((l, i): CountReq => ({ id: `CV-${r.id.slice(3)}${i}`, kind: 'count_variance', till: `${brName(r.br)} · Stock take ${r.id}`, br: r.br, item: `${l.name} · counted ${l.counted}, system ${l.expected} (${l.diff > 0 ? '+' : ''}${l.diff})`, price: l.expected, asked: Math.abs(l.value), by: r.by, byRole: PEOPLE[role].level, at: now(), status: 'pending', note: `Stock take ${r.id} · ${r.cat}`, cv: { name: l.name, br: r.br, diff: l.diff, report: r.id } })), ...readKey<CountReq[]>('ecompos.discReq2', REQS0)]);
    writeKey('ecompos.countReports', [{ ...r, held: big.map((l) => l.name) }, ...readKey<CountReport[]>('ecompos.countReports', [])].slice(0, 50));
    const v = r.lines.reduce((a, l) => a + l.value, 0);
    setMsg(`Count posted · variance report saved · ${small.length} correction(s) made, ${v < 0 ? '−' : ''}${ghs(Math.abs(v))} at cost${big.length ? ` · ${big.length} large variance(s) of ${ghs(BIG_VARIANCE)} or more sent to Approvals; the stock changes when the Admin approves` : ''}`);
  };
  /** A purchase order as a receiving document: what is still to come, in singles (cartons × carton size). */
  const poDoc = (o: PO): RecvDoc => ({ id: o.id, title: `Receive ${o.id} · ${o.sup} → ${brName(o.to)}`, from: o.sup, lines: o.lines.filter((l) => l.cartons * l.per > l.got).map((l) => ({ name: l.name, qty: l.cartons * l.per - l.got })) });
  /**
   * Post a purchase order received by scanning: stock goes up by what was scanned into the PO's warehouse or branch,
   * serials and batches are stored, each line's received count grows, and the PO becomes Partly received / Received.
   * Barcodes not on the PO still go into stock and are noted.
   */
  const receivePo = (o: PO, got: Record<string, number>, sns: Record<string, string[]>, bt: Record<string, BatchIn>) => {
    setP((x) => x.map((p) => { const n = got[p.name] || 0; if (!n && !sns[p.name]) return p; const s2 = { ...p.stock }; if (o.to !== 'wh') s2[o.to as BrId] += n; return { ...p, stock: s2, wh: o.to === 'wh' ? p.wh + n : p.wh, serials: sns[p.name] ? [...(p.serials || []), ...sns[p.name]] : p.serials }; }));
    saveBatches(bt, got, o.to, o.id, me);
    const extra = Object.keys(got).filter((n) => got[n] && !o.lines.some((l) => l.name === n));
    const lines = o.lines.map((l) => ({ ...l, got: l.got + (got[l.name] || 0) }));
    const done = lines.every((l) => l.got >= l.cartons * l.per);
    const short = lines.filter((l) => l.got < l.cartons * l.per).map((l) => `${l.cartons * l.per - l.got} × ${l.name}`);
    setPos((x) => x.map((y) => (y.id === o.id ? { ...y, lines, status: done ? 'received' : 'partial', log: [...y.log, `Received by scanning into ${brName(o.to)} by ${me} · ${now()}${extra.length ? ` · not on the PO: ${extra.join(', ')}` : ''}`] } : y)));
    addLog(Object.keys(got).filter((n) => got[n]).map((n) => ({ name: n, br: o.to, qty: got[n], kind: 'Purchase order received (scanned)', ref: o.id })));
    setRcvPo(null);
    setMsg(`${o.id} received into ${brName(o.to)} · ${done ? 'complete' : `still to come: ${short.join(', ')}`}`);
  };
  /** Reorder suggestion → an open purchase order for that supplier (a new one is started when none is open). */
  const addToPo = (g: Product) => {
    const per = perCarton(g); const cartons = Math.max(1, Math.ceil(Math.max(g.reorder * 3, 12) / per));
    const open = pos.find((o) => o.sup === g.supplier && o.status === 'open');
    if (open) { setPos((x) => x.map((o) => (o.id === open.id ? { ...o, lines: o.lines.some((l) => l.name === g.name) ? o.lines.map((l) => (l.name === g.name ? { ...l, cartons: l.cartons + cartons } : l)) : [...o.lines, { name: g.name, cartons, per, got: 0 }] } : o))); setReord({ ...reord, [g.id]: true }); return setMsg(`${cartons} carton(s) of ${g.name} added to ${open.id}`); }
    const id = 'PO-0' + (Math.max(313, ...pos.map((o) => parseInt(o.id.slice(3), 10) || 0)) + 1);
    setPos((x) => [{ id, sup: g.supplier, to: myBr, status: 'open', at: now(), log: [`Started by ${me} from a reorder suggestion`], lines: [{ name: g.name, cartons, per, got: 0 }] }, ...x]);
    setReord({ ...reord, [g.id]: true }); setMsg(`${id} started for ${g.supplier} with ${cartons} carton(s) of ${g.name}`);
  };
  const openMoves = moves.filter((m) => m.kind !== 'sup' && (m.status === 'requested' || m.status === 'in_transit') && (brs.includes(m.to as BrId) || brs.includes(m.from as BrId) || m.from === 'wh'));
  const suggest = live.filter((p) => total(p) <= p.reorder * 2 || BRS.some((b) => p.stock[b.id] <= p.reorder)).slice(0, 5);

  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Inventory</h1><p className="m-0 text-sm text-muted">Live stock at every branch{SU ? ` · stock value ${ghs(value)} at cost` : ''}</p></header>
      <Pills opts={tabs} value={tab} onChange={setTab} />
      {msg && <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#e6f4e8] border border-ok text-sm"><span className="flex-1">✓ {msg}</span><button onClick={() => setMsg('')} aria-label="Close">×</button></div>}

      {tab === 'stock' && (
        <>
          <Card title={`Returns to receive · ${rets.filter((r) => !r.done && brs.includes(r.br)).length}`} sub={`${brs.length > 1 ? 'All branches' : brName(brs[0])} · good items go back into stock, damaged items are logged`}>
            {!rets.some((r) => !r.done && brs.includes(r.br)) && <span className="text-sm text-muted">No returns waiting. Online returns requested by customers appear here. Till returns are received at Sell Now → Return / exchange.</span>}
            {rets.filter((r) => !r.done && brs.includes(r.br)).map((r) => (
              <div key={r.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
                <span className="text-sm"><b>{r.id} · Order #{r.no} · {r.who}</b><br /><span className="text-xs text-muted">{brName(r.br)} · Reason: {r.reason}</span></span>
                {r.lines.map((l, i) => <div key={l.name} className="flex items-center gap-2 text-sm flex-wrap"><span className="flex-1">{l.qty} × {l.name}</span><span className="text-xs text-muted">Damaged</span><button aria-label="One less damaged" onClick={() => setRets((x) => x.map((y) => (y.id === r.id ? { ...y, lines: y.lines.map((z, j) => (j === i ? { ...z, dmg: Math.max(0, z.dmg - 1) } : z)) } : y)))} className="w-7 h-7 rounded-full border border-line">−</button><b className="w-5 text-center">{l.dmg}</b><button aria-label="One more damaged" onClick={() => setRets((x) => x.map((y) => (y.id === r.id ? { ...y, lines: y.lines.map((z, j) => (j === i ? { ...z, dmg: Math.min(z.qty, z.dmg + 1) } : z)) } : y)))} className="w-7 h-7 rounded-full border border-line">+</button></div>)}
                <div className="flex justify-between items-center flex-wrap gap-2"><span className="text-xs text-muted">{r.lines.reduce((s, l) => s + l.qty - l.dmg, 0)} back to stock · {r.lines.reduce((s, l) => s + l.dmg, 0)} damaged</span><button onClick={() => receiveRet(r)} className="btn-primary min-h-9 text-xs">Receive return & restock</button></div>
              </div>
            ))}
            {rets.some((r) => r.done) && <div className="text-xs text-muted flex flex-col gap-1"><b>Received recently</b>{rets.filter((r) => r.done).map((r) => <span key={r.id}>✓ {r.id} · {r.done}</span>)}</div>}
          </Card>
          <section className="card p-5 flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap items-end">
              <label className="flex flex-col gap-1 text-[13px] font-semibold flex-1 min-w-[220px]">Search inventory<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inventory by product, category or barcode" className="field font-normal py-2.5" /></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">Show<select value={view} onChange={(e) => setView(e.target.value)} className="px-4 py-2.5 rounded-full border border-line font-normal">{[['all', 'All products'], ['low', 'Low stock'], ['fast', 'Fast selling'], ['slow', 'Slow selling'], ['none', 'Not selling']].map(([v, l]) => <option key={v} value={v}>{l} ({live.filter((p) => matches(v, p)).length})</option>)}</select></label>
              <span className="text-sm text-muted pb-2.5">{rows.length} products</span>
              {/* Stocking option: scan stock in with the tablet / phone camera or the barcode scanner on a computer. */}
              <button onClick={() => setStockIn(true)} className="btn-dark">▦ Stock in by scanning</button>
              <div className="flex gap-2 items-end flex-wrap pb-0.5">
                <span className="text-sm pb-2">🖨 Print</span>
                <label className="flex flex-col gap-1 text-xs font-semibold">Sheet<select value={prt} onChange={(e) => setPrt(e.target.value as typeof prt)} className="px-3 py-2 rounded-full border border-line font-normal"><option value="">Choose…</option><option value="count">Stock count sheet</option><option value="list">Stock list</option><option value="low">Reorder list</option></select></label>
                <label className="flex flex-col gap-1 text-xs font-semibold">Branch<select value={prtBr} onChange={(e) => setPrtBr(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal"><option value="all">All branches</option>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[900px]">
                <thead><tr>{['Product', 'Category', ...BRS.map((b) => b.name), 'Total', 'Sold · 30 days', 'Status', 'Reserved online', 'Reorder at', 'Actions'].map((h) => <th key={h} scope="col" className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-2 py-2 border-b border-line">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((p) => {
                    const low = BRS.some((b) => p.stock[b.id] <= p.reorder);
                    return (
                      <tr key={p.id} className={adj === p.id ? 'bg-canvas' : ''}>
                        <td className="px-2 py-2 border-b border-line font-semibold">{p.name}</td>
                        <td className="px-2 py-2 border-b border-line text-muted">{p.cat}</td>
                        {BRS.map((b) => <td key={b.id} className="px-2 py-2 border-b border-line"><span className={cx('inline-block min-w-9 text-center px-2 py-1 rounded-lg text-xs font-semibold', p.stock[b.id] <= p.reorder ? 'bg-black text-white' : 'bg-canvas')}>{p.stock[b.id]}</span></td>)}
                        <td className="px-2 py-2 border-b border-line font-semibold">{total(p)}</td>
                        <td className="px-2 py-2 border-b border-line">{p.sold30}</td>
                        <td className="px-2 py-2 border-b border-line"><span className={cx('pill', low ? 'bg-red-100 text-red-800' : p.sold30 >= 100 ? 'bg-green-100 text-green-800' : p.sold30 === 0 ? 'bg-canvas text-muted' : 'bg-blue-100 text-blue-900')}>{low ? 'Low stock' : p.sold30 >= 100 ? 'Fast' : p.sold30 === 0 ? 'Not selling' : p.sold30 < 20 ? 'Slow' : 'OK'}</span></td>
                        <td className="px-2 py-2 border-b border-line">{p.reserved}</td>
                        <td className="px-2 py-2 border-b border-line">{p.reorder}</td>
                        <td className="px-2 py-2 border-b border-line"><button onClick={() => { setAdj(p.id); setAdjQ(''); setAdjErr(''); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">Adjust</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && <span className="text-sm text-muted">No product matches this search or view.</span>}
            <span className="text-xs text-muted">Dark chips are below their reorder level. Stock updates within seconds of a till sale, online order, return or adjustment.</span>
          </section>
          {a && (
            <Card title={`Adjust stock · ${a.name}`}>
              <Pills small opts={REASONS.map((r) => [r, r] as [string, string])} value={adjR} onChange={setAdjR} />
              <div className="flex gap-3 flex-wrap items-end">
                <label className="flex flex-col gap-1 text-[13px] font-semibold">Branch<select value={adjBr} onChange={(e) => setAdjBr(e.target.value as BrId)} className="px-4 py-2.5 rounded-full border border-line font-normal">{BRS.filter((b) => SU || b.id === myBr).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">Quantity (−/+)<input value={adjQ} onChange={(e) => { setAdjQ(e.target.value.replace(/[^\d-]/g, '')); setAdjErr(''); }} placeholder="−2" className="px-4 py-2.5 rounded-full border border-line font-normal w-32" /></label>
                <span className="text-sm text-muted pb-2.5">Now {a.stock[adjBr]} at {brName(adjBr)}{parseInt(adjQ, 10) ? ` → ${a.stock[adjBr] + parseInt(adjQ, 10)}` : ''}</span>
                <button onClick={applyAdj} className="btn-primary">Save adjustment</button>
                <button onClick={() => setAdj('')} className="btn-ghost">Close</button>
              </div>
              {adjErr && <span role="alert" className="text-sm text-danger">{adjErr}</span>}
            </Card>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Stock rules">
              <label className="flex flex-col gap-1 text-[13px] font-semibold">When sold out online<select className="field py-2.5 font-normal"><option>Show as sold out</option><option>Hide the product</option><option>Allow pre-order</option></select></label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">Fulfil online orders from<select className="field py-2.5 font-normal"><option>Nearest branch with stock</option><option>Branch with most stock</option>{BRS.map((b) => <option key={b.id}>{b.name} first</option>)}</select></label>
              <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Valuation method</span><Pills small opts={[['Average cost', 'Average cost'], ['FIFO', 'FIFO'], ['Last cost', 'Last cost']]} value={val} onChange={setVal} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked className="w-4 h-4 accent-[#0b5c5c]" />Low-stock alerts to managers on WhatsApp</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-4 h-4 accent-[#0b5c5c]" />Track consignment stock separately</label>
            </Card>
            <Card title="Shrinkage this month">
              {[['Damaged', ghs(312)], ['Damaged returns logged', String(rets.reduce((s, r) => s + (r.done ? r.lines.reduce((x, l) => x + l.dmg, 0) : 0), 0))], ['Expired', ghs(146.5)], ['Count variance', ghs(88)]].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><b>{v}</b></div>)}
              <span className="text-xs text-muted">Suppliers on file 14 · lead time 3–21 days</span>
            </Card>
          </div>
        </>
      )}

      {tab === 'moves' && (
        <Card title="Stock movements" sub="Every sale, online order, cancellation, return and adjustment changes the stock count here automatically, so the numbers match what is on the shelf.">
          <div className="flex gap-3 flex-wrap">{[['Movements', String(log.length)], ['Stock out', String(log.filter((l) => l.qty < 0).reduce((s, l) => s - l.qty, 0))], ['Stock in', String(log.filter((l) => l.qty > 0).reduce((s, l) => s + l.qty, 0))]].map(([k, v]) => <span key={k} className="px-3 py-2 rounded-xl bg-canvas text-sm">{k} <b>{v}</b></span>)}</div>
          {!log.length ? <span className="text-sm text-muted">No stock movements yet. Make a sale at Sell Now or place an online order.</span> : <T head={['When', 'Product', 'Branch', 'Stock change', 'What happened', 'By']} rows={log.filter((l) => brs.includes(l.br as BrId) || l.br === 'wh').slice(0, 60).map((l) => [l.at, l.name, brName(l.br), <b key="q" className={l.qty < 0 ? 'text-danger' : 'text-ok'}>{l.qty > 0 ? '+' : ''}{l.qty}</b>, <span key="k">{l.kind}<br /><span className="text-xs text-muted">{l.ref}</span></span>, l.by])} />}
        </Card>
      )}

      {tab === 'transfers' && (
        <Card title="Transfers" sub="Stock on the way between the warehouse and branches" actions={<div className="flex gap-2"><Link to="/warehouse" className="btn-ghost min-h-9 text-xs">New transfer</Link><Link to="/warehouse" className="btn-ghost min-h-9 text-xs">Warehouse & transfers</Link></div>}>
          {BRS.filter((b) => live.every((p) => p.stock[b.id] === 0)).map((o) => <div key={o.id} className="p-3 rounded-2xl bg-warn-bg text-sm flex items-center gap-2"><span className="flex-1"><b>{o.name} has no stock yet</b> It shares the company catalogue. Send opening stock from Osu to start selling.</span><Link to="/warehouse" className="btn-dark min-h-9 text-xs">Send opening stock</Link></div>)}
          {!openMoves.length && <span className="text-sm text-muted">No transfers on the way.</span>}
          {openMoves.map((m) => <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl border border-line flex-wrap text-sm"><span className="flex-1 min-w-[220px]"><b>{m.id} · {brName(m.from)} → {brName(m.to)}</b><br /><span className="text-xs text-muted">{m.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</span></span><span className={cx('pill', m.status === 'in_transit' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900')}>{m.status === 'in_transit' ? 'On the way' : 'Requested'}</span>{m.status === 'in_transit' && <><button onClick={() => setRcv(m)} className="h-9 px-4 rounded-full bg-black text-white text-xs font-semibold">Receive (scan)</button><button onClick={() => receiveMove(m)} className="btn-ghost min-h-9 text-xs" title="Receive everything on the transfer without scanning">Receive all</button></>}</div>)}
        </Card>
      )}

      {tab === 'po' && (
        <>
          {pos.map((o) => { const gotL = o.lines.filter((l) => l.got >= l.cartons * l.per).length; return (
            <Card key={o.id} title={`${o.id} · ${o.sup}`} sub={`${o.status === 'received' ? 'Received' : o.status === 'partial' ? 'Partly received' : 'Open'} · ${gotL} of ${o.lines.length} lines · into ${brName(o.to)} · ${o.at}`} actions={o.status !== 'received' ? <button onClick={() => setRcvPo(o)} className="h-9 px-4 rounded-full bg-black text-white text-xs font-semibold">Receive (scan)</button> : undefined}>
              <T head={['Line', 'Ordered', 'Received', ...(SU ? ['Landed unit cost'] : [])]} rows={o.lines.map((l) => [l.name, `${l.cartons} cartons (${l.cartons * l.per})`, String(l.got), ...(SU ? [l.landed ? ghs(l.landed) : '—'] : [])])} />
              {o.id === 'PO-0312' && (SU ? <><div className="grid sm:grid-cols-4 gap-2 text-sm">{[['Goods', 38400], ['Freight', 2150], ['Customs duty', 3840], ['Clearing', 900]].map(([k, v]) => <div key={k as string} className="p-3 rounded-xl bg-canvas">{k as string}<br /><b>{ghs(v as number)}</b></div>)}</div><span className="text-xs text-muted">Freight, duty and clearing are spread over the received units to give the landed cost above.</span></> : <span className="text-xs text-muted">Purchase costs and landed cost are visible to the Admin only. You can still receive the goods.</span>)}
              {o.log.length > 0 && <span className="text-xs text-muted">{o.log[o.log.length - 1]}</span>}
            </Card>
          ); })}
          <Card title="Suggested reorders (from the last 8 weeks of sales)">
            {suggest.map((g) => { const on = pos.find((o) => o.status === 'open' && o.lines.some((l) => l.name === g.name)); return <div key={g.id} className="flex items-center gap-3 text-sm flex-wrap"><span className="flex-1"><b>{g.name}</b><br /><span className="text-xs text-muted">Sells {Math.max(1, Math.round(g.sold30 / 30))} a day · {total(g)} left · {g.supplier}</span></span><button disabled={!!on} onClick={() => addToPo(g)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white disabled:bg-[#bdbdbd]">{on ? `On ${on.id}` : 'Add to purchase order'}</button></div>; })}
          </Card>
        </>
      )}

      {tab === 'count' && (
        <Card title="Stock take" sub="Blind cycle count: scan each item on the shelf (a carton counts its own size) or type the quantity. Posting corrects the stock as “Count correction” and saves a variance report.">
          <StockTake P={P} onHand={onHand} me={me} branches={brs} onPost={postCount} />
        </Card>
      )}
      {rcv && <ReceiveScan doc={{ id: rcv.id, title: `Receive ${rcv.id} · ${brName(rcv.from)} → ${brName(rcv.to)}`, from: brName(rcv.from), lines: rcv.lines }} P={P} onPost={(g, sn, bt) => receiveScanned(rcv, g, sn, bt)} onClose={() => setRcv(null)} />}
      {stockIn && <StockInScan P={P.filter((p) => p.status === 'live' && p.track !== 'digital')} places={SU ? ['wh', ...BRS.map((b) => b.id)] : [myBr]} onPost={postStockIn} onClose={() => setStockIn(false)} />}
      {rcvPo && <ReceiveScan doc={poDoc(rcvPo)} P={P} onPost={(g, sn, bt) => receivePo(rcvPo, g, sn, bt)} onClose={() => setRcvPo(null)} />}

      {role === 'staff' && <div className="card p-4 text-sm flex items-center gap-2"><span className="flex-1">Stock you can see · {brName(myBr)} only</span><Link to="/warehouse" className="text-brand font-semibold">Ask for a transfer</Link></div>}

      {prt && (
        <div className="fixed inset-0 z-[600] bg-black/60 overflow-y-auto p-4 sm:p-8">
          <div className="no-print max-w-[820px] mx-auto mb-3 flex gap-2 justify-end"><span className="flex gap-1 p-1 rounded-full bg-white/15">{(['A4', 'Letter'] as const).map((k) => <button key={k} onClick={() => setPaper(k)} aria-pressed={paper === k} className={cx('text-xs px-3 py-1.5 rounded-full', paper === k ? 'bg-white text-black font-semibold' : 'text-white')}>{k}</button>)}</span><button onClick={() => window.print()} className="btn bg-white text-black">Print or save as PDF</button><button onClick={() => setPrt('')} className="btn bg-white/15 text-white">Close</button></div>
          <style>{`@media print{@page{size:${paper === 'A4' ? 'A4' : 'letter'};margin:12mm}}`}</style>
          <article className="print-doc max-w-[820px] mx-auto bg-white rounded-2xl p-8 text-[12px]">
            <div className="flex justify-between gap-4 pb-4 mb-4 border-b-2 border-brand"><div className="flex gap-3"><CompanyLogo className="w-12 h-12" /><div className="flex flex-col text-xs text-sub"><strong className="text-sm text-black">{COMPANY.name}</strong><span>{COMPANY.addr}</span><span>Tel: {COMPANY.tel}</span></div></div><div className="text-right text-xs"><strong className="text-brand text-sm">{{ count: 'STOCK COUNT SHEET', list: 'STOCK LIST', low: 'REORDER LIST' }[prt]}</strong><br />{prtBr === 'all' ? 'All branches' : brName(prtBr)}<br />{now()} · by {me}</div></div>
            <table className="w-full border-collapse"><thead><tr className="bg-canvas">{['Product', 'Category', 'System', prt === 'count' ? 'Counted' : 'Reorder at', prt === 'count' ? 'Difference' : 'Status'].map((h) => <th key={h} className="text-left p-1.5 border border-line">{h}</th>)}</tr></thead><tbody>{live.filter((p) => prt !== 'low' || BRS.some((b) => p.stock[b.id] <= p.reorder)).map((p) => { const sys = prtBr === 'all' ? total(p) : p.stock[prtBr as BrId]; return <tr key={p.id}><td className="p-1.5 border border-line">{p.name}</td><td className="p-1.5 border border-line">{p.cat}</td><td className="p-1.5 border border-line">{sys}</td><td className="p-1.5 border border-line">{prt === 'count' ? '' : p.reorder}</td><td className="p-1.5 border border-line">{prt === 'count' ? '' : sys <= p.reorder ? 'Reorder' : 'OK'}</td></tr>; })}</tbody></table>
            {prt === 'count' && <div className="grid grid-cols-2 gap-8 mt-8">{['Counted by · Date & time', 'Checked by (Supervisor) · Signature'].map((l) => <div key={l}><span className="block h-10 border-b border-black" />{l}</div>)}</div>}
          </article>
        </div>
      )}
    </>
  );
}
