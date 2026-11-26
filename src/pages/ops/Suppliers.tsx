import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BRS, CATS0, DAMAGES0, PRODUCTS0, SUPPLIERS, brName, now, type Damage, type Product } from '../../data/catalogue';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { ScanPick } from '../catalogue/ScanStock';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import { Head, Msg } from '../money/ui';

type Sup = { name: string; contact: string; terms: string; lead: number; phone: string; email: string; addr: string; tin: string; pay: string; status: 'active' | 'hold'; addedBy: string };
type GI = { id: string; sup: string; ref: string; to: string; lines: { name: string; qty: number; cost: number }[]; note: string; at: string; by: string };
type SClaim = { id: string; supplier: string; what: string; cause: string; want: string; qty: number; amt: number; ref: string; note: string; status: 'open' | 'chased' | 'replaced' | 'settled'; at: string; ts: number; log: { t: string }[] };
const SUPS0: Sup[] = SUPPLIERS.map((s, i) => ({ ...s, phone: s.contact.split(' · ')[1], email: `orders@${s.name.toLowerCase().replace(/[^a-z]+/g, '')}.com.gh`, addr: ['Tema Industrial Area', 'Spintex Road, Accra', 'Kaneshie, Accra', 'Kumasi Ahinsan', 'Tema Harbour', 'North Industrial Area', 'Tema Free Zone', 'Ring Road Central'][i], tin: 'C00' + (10000000 + i * 734421), pay: i % 2 ? '30 days credit' : 'Cash on delivery', status: 'active', addedBy: 'Added by Ebenezer Mensah · Jan 2026' }));
const TABS: [string, string][] = [['', 'Overview'], ['in', 'Goods in'], ['new', 'New product'], ['out', 'Damages out'], ['claims', 'Claims'], ['book', 'Supplier details'], ['manage', 'Manage suppliers']];
const CAUSE: [string, Damage['liable']][] = [['Packaging damage', 'supplier'], ['Manufacturing fault', 'supplier'], ['Expired or spoilt', 'supplier'], ['Handling in transit', 'transport'], ['Storage conditions', 'us']];

export default function Suppliers() {
  const { tab = '' } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role].name;
  const [sups, setSups] = usePersist<Sup[]>('ecompos.suppliers2', SUPS0);
  const [P, setP] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [D, setD] = usePersist<Damage[]>('ecompos.damages2', DAMAGES0);
  const [G, setG] = usePersist<GI[]>('ecompos.goodsIn2', [{ id: 'GI-0101', sup: 'Nasco Electronics', ref: 'NAS-INV-88190', to: 'wh', lines: [{ name: 'Nasco 43" Smart Android TV', qty: 24, cost: 2799 }, { name: 'Nasco 138L Single-Door Fridge', qty: 18, cost: 2319 }], note: '', at: '15 Nov 10:20', by: 'Ebenezer Mensah' }]);
  const [C, setC] = usePersist<SClaim[]>('ecompos.supClaims2', [{ id: 'SC-0012', supplier: 'Hisense Ghana', what: '3 × Hisense 205L Double-Door Fridge', cause: 'Short delivery', want: 'Replacement', qty: 3, amt: 10317, ref: 'DN-4471', note: '3 fridges missing from the delivery', status: 'open', at: '2 Nov', ts: Date.now() - 18 * 864e5, log: [{ t: 'Claim raised by Ebenezer Mensah · 2 Nov' }] }]);
  const [msg, setMsg] = useState('');
  const active = sups.filter((s) => s.status === 'active');
  const gTotal = G.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.qty * l.cost, 0), 0);
  const openC = C.filter((c) => c.status !== 'settled');
  const go = (t: string) => nav(t ? `/suppliers/${t}` : '/suppliers');
  const addStock = (lines: { name: string; qty: number }[], to: string) => setP((x) => x.map((p) => { const l = lines.find((y) => y.name === p.name); if (!l) return p; return to === 'wh' ? { ...p, wh: p.wh + l.qty } : { ...p, stock: { ...p.stock, [to]: p.stock[to as 'osu'] + l.qty } }; }));

  return (
    <>
      <Head title={SU ? 'Supplier account' : 'Suppliers'} sub="Goods in from your suppliers, damaged goods back out to them, claims, and the supplier book itself."><span className="text-xs text-muted text-right">{SU ? `All ${BRS.length} branches and the warehouse` : brName(session?.branch ?? 'osu')}<br />{active.length} active suppliers</span></Head>
      <Pills opts={TABS.filter(([k]) => k !== 'manage' || SU)} value={tab} onChange={go} />
      <Msg text={msg} onClose={() => setMsg('')} />

      {tab === '' && (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">{[['Goods in', ghs(gTotal), `${G.length} deliveries received`], ['Damaged out', ghs(D.reduce((a, d) => a + d.value, 0)), `${D.length} damage records · value at cost`], ['Open claims', String(openC.length), openC.length ? `${ghs(openC.reduce((a, c) => a + c.amt, 0))} claimed` : 'Nothing outstanding'], ['Ready to report', String(D.filter((d) => d.status === 'reported' && d.liable === 'supplier').length), D.some((d) => d.status === 'reported' && d.liable === 'supplier') ? 'Supplier-liable damage not yet sent' : 'All reported']].map(([l, v, n]) => <div key={l} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><strong className="text-[26px] font-medium tracking-tightest">{v}</strong><span className="text-xs text-sub">{n}</span></div>)}</div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Into the company">{G.map((g) => <div key={g.id} className="flex justify-between gap-2 text-sm py-1 border-b border-line last:border-0"><span><b>{g.sup}</b><br /><span className="text-xs text-muted">{g.id} · {g.lines.length} lines · {brName(g.to)} · {g.at}</span></span><b>{ghs(g.lines.reduce((x, l) => x + l.qty * l.cost, 0))}</b></div>)}<span className="text-xs text-muted">New stock from suppliers, with what it cost.</span></Card>
            <Card title="Out of the company">{D.slice(0, 6).map((d) => <div key={d.id} className="flex justify-between gap-2 text-sm py-1 border-b border-line last:border-0"><span><b>{d.qty} × {d.name}</b><br /><span className="text-xs text-muted">{d.id} · {d.supplier}</span></span><span className="pill bg-canvas">{d.status.replace('_', ' ')}</span></div>)}<span className="text-xs text-muted">Damaged goods leaving the store, and where each one stands.</span></Card>
          </div>
        </>
      )}

      {tab === 'in' && <GoodsIn sups={active} P={P} onSave={(g) => { setG((x) => [g, ...x]); addStock(g.lines, g.to); setMsg(`${g.id} received · ${g.lines.reduce((a, l) => a + l.qty, 0)} units added to ${brName(g.to)}`); }} me={me} SU={SU} n={G.length} />}
      {tab === 'new' && <NewProd sups={active} SU={SU} me={me} onSave={(p) => { setP((x) => [p, ...x]); setMsg(SU ? `${p.name} added and stocked into ${p.wh ? 'the warehouse' : 'the branch'}` : `${p.name} sent to the Admin for approval`); }} />}
      {tab === 'out' && <DamageOut P={P} me={me} onSave={(d, report) => { setD((x) => [d, ...x]); setP((x) => x.map((p) => (p.name === d.name ? { ...p, stock: { ...p.stock, [d.loc]: Math.max(0, p.stock[d.loc as 'osu'] - d.qty) } } : p))); if (report) setC((x) => [{ id: 'SC-00' + (13 + x.length), supplier: d.supplier, what: `${d.qty} × ${d.name}`, cause: d.cause, want: 'Replacement', qty: d.qty, amt: d.value, ref: d.id, note: d.note, status: 'open', at: now(), ts: Date.now(), log: [{ t: `Claim raised by ${me} · ${now()}` }] }, ...x]); setMsg(`${d.id} recorded${report ? ' and reported to ' + d.supplier : ''}`); }} n={D.length} />}
      {tab === 'claims' && (
        <>
          <NewClaim sups={active} D={D.filter((d) => d.status === 'reported' && !C.some((c) => c.ref === d.id))} P={P} onSave={(c) => { setC((x) => [{ ...c, id: 'SC-00' + (13 + x.length), log: [{ t: `Claim raised by ${me} · ${now()}` }] }, ...x]); setMsg('Claim raised and emailed to the supplier'); }} />
          <Card title="Supplier claims" sub={`${openC.length} open · oldest first`}>
            {!C.length && <span className="text-sm text-muted">No claim has been raised yet. Raise one above, or report a damage under Damages out.</span>}
            {C.map((c) => { const age = Math.floor((Date.now() - c.ts) / 864e5); const t = sups.find((s) => s.name === c.supplier)?.terms; const up = (p: Partial<SClaim>, l: string) => setC((x) => x.map((y) => (y.id === c.id ? { ...y, ...p, log: [...y.log, { t: `${l} · ${me} · ${now()}` }] } : y))); return (
              <div key={c.id} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5">
                <div className="flex justify-between gap-2 flex-wrap"><span className="text-sm"><b>{c.id} · {c.supplier}</b><br /><span className="text-xs text-muted">{c.what} · {c.cause} · raised {c.at} · {age} days ago</span></span><span className={cx('pill', c.status === 'settled' ? 'bg-green-100 text-green-800' : c.status === 'replaced' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900')}>{{ open: 'Open', chased: 'Chased', replaced: 'Replacement received', settled: 'Settled' }[c.status]}</span></div>
                <span className="text-xs text-muted">Their terms: {t}</span>
                {age > 14 && c.status !== 'settled' && <span className="text-xs text-danger">Open more than two weeks. Worth chasing.</span>}
                {c.log.map((l, i) => <span key={i} className="text-xs text-sub">• {l.t}</span>)}
                {c.status !== 'settled' && <div className="flex gap-2 flex-wrap">{c.status !== 'replaced' && <><button onClick={() => up({ status: 'chased' }, 'Chased by email and SMS')} className="btn-ghost min-h-9 text-xs">Chase the supplier</button><button onClick={() => up({ status: 'replaced' }, 'Replacement received')} className="btn-dark min-h-9 text-xs">Replacement received</button></>}<button onClick={() => up({ status: 'settled' }, 'Closed as settled')} className="btn-primary min-h-9 text-xs">Close as settled</button></div>}
              </div>
            ); })}
          </Card>
        </>
      )}
      {tab === 'book' && <Book sups={sups} G={G} C={C} D={D} />}
      {tab === 'manage' && SU && <Manage sups={sups} setSups={setSups} me={me} />}
    </>
  );
}

function GoodsIn({ sups, P, onSave, me, SU, n }: { sups: Sup[]; P: Product[]; onSave: (g: GI) => void; me: string; SU: boolean; n: number }) {
  const [sup, setSup] = useState(sups[0]?.name ?? '');
  const [ref, setRef] = useState('');
  const [to, setTo] = useState('wh');
  const [lines, setLines] = useState<{ name: string; qty: number; cost: number }[]>([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const s = sups.find((x) => x.name === sup);
  const theirs = P.filter((p) => p.supplier === sup && p.status === 'live');
  const add = (p: Product) => !lines.some((l) => l.name === p.name) && setLines([...lines, { name: p.name, qty: 1, cost: p.cost }]);
  const total = lines.reduce((a, l) => a + l.qty * l.cost, 0);
  return (
    <Card title="Record a delivery from a supplier" sub="This adds the goods to stock straight away.">
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Supplier</span><Pills small opts={sups.map((x) => [x.name, x.name] as [string, string])} value={sup} onChange={(v) => { setSup(v); setLines([]); }} /></div>
      <span className="text-xs text-muted">{s?.terms} · usually delivers in {s?.lead} days</span>
      <label className="text-[13px] font-semibold flex flex-col gap-1">Supplier invoice or waybill number<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. GG-INV-88214" className="field py-2.5 font-normal" /></label>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Received into</span><Pills small opts={[['wh', 'Warehouse'], ...BRS.map((b) => [b.id, b.name] as [string, string])]} value={to} onChange={setTo} /></div>
      {/* Receive by scanning (productscan.md §4.2): each scan adds the item, or the whole carton, to its line. */}
      <ScanPick P={P.filter((p) => p.status === 'live' && p.track !== 'digital')} label="Scan what arrived (item or carton)" onPick={(p, n) => setLines((L) => (L.some((l) => l.name === p.name) ? L.map((l) => (l.name === p.name ? { ...l, qty: l.qty + n } : l)) : [...L, { name: p.name, qty: n, cost: p.cost }]))} />
      <span className="text-[13px] font-semibold">What {sup} supplies · tap to add a line</span>
      <div className="flex gap-1.5 flex-wrap">{theirs.map((p) => <button key={p.id} onClick={() => add(p)} className="text-xs px-3 py-1.5 rounded-full border border-line">+ {p.name}</button>)}{!theirs.length && <span className="text-xs text-muted">Nothing on file for this supplier.</span>}</div>
      <span className="text-xs text-muted">Anything else in the catalogue:</span>
      <select aria-label="Add any product" value="" onChange={(e) => { const p = P.find((x) => x.name === e.target.value); if (p) add(p); }} className="field py-2 w-fit"><option value="">Choose a product…</option>{P.filter((p) => p.status === 'live' && p.supplier !== sup && p.track !== 'digital').map((p) => <option key={p.id}>{p.name}</option>)}</select>
      {lines.map((l, i) => { const agreed = P.find((p) => p.name === l.name)?.cost ?? 0; return <div key={l.name} className="flex items-end gap-2 flex-wrap p-3 rounded-2xl bg-canvas text-sm"><b className="flex-1 min-w-[160px] pb-2">{l.name}</b><label className="text-xs font-semibold flex flex-col gap-0.5">Quantity<input inputMode="numeric" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: parseInt(e.target.value, 10) || 0 } : x)))} className="w-20 px-2 py-1.5 rounded-lg border border-line font-normal" /></label>{SU && <label className="text-xs font-semibold flex flex-col gap-0.5">Cost each<input inputMode="decimal" value={l.cost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, cost: parseFloat(e.target.value) || 0 } : x)))} className="w-24 px-2 py-1.5 rounded-lg border border-line font-normal" /></label>}{SU && <span className={cx('text-xs pb-2', l.cost > agreed ? 'text-danger' : 'text-muted')}>Agreed cost {ghs(agreed)}</span>}{SU && <b className="pb-2">{ghs(l.qty * l.cost)}</b>}<button aria-label={`Remove ${l.name}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="pb-2 text-danger">×</button></div>; })}
      {SU && lines.length > 0 && <div className="flex justify-between text-sm font-semibold"><span>Delivery value</span><span>{ghs(total)}</span></div>}
      {!SU && <span className="text-xs text-muted">Costs are visible to the Admin only.</span>}
      <label className="text-[13px] font-semibold flex flex-col gap-1">Note (optional)<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short delivery, driver name, anything worth recording" className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
      <div className="flex gap-2"><button onClick={() => { if (!lines.length || lines.some((l) => l.qty <= 0)) return setErr('Add each item with a quantity above 0.'); onSave({ id: 'GI-0' + (102 + n), sup, ref, to, lines, note, at: now(), by: me }); setLines([]); setRef(''); setNote(''); setErr(''); }} className="btn-primary">Receive into stock</button><button onClick={() => { setLines([]); setRef(''); setNote(''); }} className="btn-ghost">Clear</button></div>
    </Card>
  );
}

function NewProd({ sups, SU, me, onSave }: { sups: Sup[]; SU: boolean; me: string; onSave: (p: Product) => void }) {
  const [f, setF] = useState({ name: '', cost: '', price: '', qty: '', sup: sups[0]?.name ?? '', cat: 'TV', to: 'wh', err: '' });
  const c = parseFloat(f.cost) || 0, p = parseFloat(f.price) || 0;
  return (
    <Card title="New product from a supplier" sub={SU ? 'Added straight to the catalogue and stocked.' : 'Goes to the Admin for approval before it can be sold.'}>
      <label className="text-[13px] font-semibold flex flex-col gap-1">Product name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, err: '' })} placeholder="As it should read on the shelf and the till" className="field py-2.5 font-normal" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-[13px] font-semibold flex flex-col gap-1">Cost each (GHS)<input inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="0.00" className="field py-2.5 font-normal" /></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Shelf price (GHS)<input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0.00" className="field py-2.5 font-normal" /></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">How many arrived<input inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="0" className="field py-2.5 font-normal" /></label>
      </div>
      {c > 0 && p > 0 && <span className={cx('text-xs', p <= c ? 'text-danger' : 'text-ok')}>{p <= c ? 'The shelf price is not above the cost.' : `Profit ${ghs(p - c)} each · ${(((p - c) / p) * 100).toFixed(1)}% margin`}</span>}
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Supplier</span><Pills small opts={sups.map((x) => [x.name, x.name] as [string, string])} value={f.sup} onChange={(v) => setF({ ...f, sup: v })} /></div>
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Category</span><Pills small opts={CATS0.filter((x) => !x.archived && !x.parent).map((x) => [x.name, x.name] as [string, string])} value={f.cat} onChange={(v) => setF({ ...f, cat: v })} /></div>
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Stock it into</span><Pills small opts={[['wh', 'Warehouse'], ...BRS.map((b) => [b.id, b.name] as [string, string])]} value={f.to} onChange={(v) => setF({ ...f, to: v })} /></div>
      {f.err && <span role="alert" className="text-sm text-danger">{f.err}</span>}
      <div className="flex gap-2"><button onClick={() => { if (f.name.trim().length < 2) return setF({ ...f, err: 'Enter the product name.' }); if (!(p > 0)) return setF({ ...f, err: 'Enter the shelf price.' }); const q = parseInt(f.qty, 10) || 0; const id = 'p' + Date.now(); onSave({ id, name: f.name.trim(), cat: f.cat, sku: 'SKU-' + id.slice(-6), barcode: '200' + id.slice(-10), price: p, cost: c, stock: { osu: f.to === 'osu' ? q : 0, legon: f.to === 'legon' ? q : 0, adum: f.to === 'adum' ? q : 0 }, wh: f.to === 'wh' ? q : 0, reserved: 0, reorder: 5, sold30: 0, web: true, pos: true, status: SU ? 'live' : 'pending', desc: '', supplier: f.sup, track: 'batch', scope: 'all', by: me, when: now() }); setF({ name: '', cost: '', price: '', qty: '', sup: f.sup, cat: f.cat, to: f.to, err: '' }); }} className="btn-primary">Add the product</button><button onClick={() => setF({ ...f, name: '', cost: '', price: '', qty: '', err: '' })} className="btn-ghost">Clear</button></div>
    </Card>
  );
}

function DamageOut({ P, me, onSave, n }: { P: Product[]; me: string; onSave: (d: Damage, report: boolean) => void; n: number }) {
  const items = P.filter((p) => p.status === 'live' && p.track !== 'digital');
  const [f, setF] = useState({ name: items[0]?.name ?? '', qty: '', loc: 'osu', src: 'storage' as Damage['src'], cause: CAUSE[0][0], note: '', photo: '', err: '' });
  const prod = P.find((p) => p.name === f.name);
  const liable = CAUSE.find((c) => c[0] === f.cause)?.[1] ?? 'us';
  const save = (report: boolean) => { const q = parseInt(f.qty, 10) || 0; if (!q) return setF({ ...f, err: 'Enter how many.' }); if (prod && q > prod.stock[f.loc as 'osu']) return setF({ ...f, err: `${brName(f.loc)} only has ${prod.stock[f.loc as 'osu']}.` }); if (f.note.trim().length < 4) return setF({ ...f, err: 'Say what happened in one line.' }); onSave({ id: 'DM-0' + (45 + n), name: f.name, qty: q, src: f.src, loc: f.loc, note: f.note, cause: f.cause, liable, supplier: prod?.supplier ?? '', value: (prod?.cost ?? 0) * q, status: report && liable !== 'us' ? 'at_supplier' : 'reported', at: now(), log: [{ t: `Recorded by ${me}${f.photo ? ' · photo attached' : ''} · ${now()}` }] }, report && liable !== 'us'); setF({ ...f, qty: '', note: '', photo: '', err: '' }); };
  return (
    <Card title="Record a damage" sub="Record it, and report it to the supplier where they should answer for it.">
      <ScanPick P={items} onPick={(p, n) => setF({ ...f, name: p.name, qty: String(n), err: '' })} />
      <label className="text-[13px] font-semibold flex flex-col gap-1">Which item<select value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="field py-2.5 font-normal">{items.map((p) => <option key={p.id}>{p.name}</option>)}</select></label>
      <span className="text-xs text-muted">Supplied by {prod?.supplier}</span>
      <label className="text-[13px] font-semibold flex flex-col gap-1">How many<input inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value, err: '' })} placeholder="0" className="field py-2.5 font-normal w-32" /></label>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Where it happened</span><Pills small opts={BRS.map((b) => [b.id, b.name] as [string, string])} value={f.loc} onChange={(v) => setF({ ...f, loc: v })} /></div>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">How it came to light</span><Pills small opts={[['storage', 'Found in storage'], ['customer', 'Customer brought it back'], ['transit', 'Arrived damaged']]} value={f.src} onChange={(v) => setF({ ...f, src: v })} /></div>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">What caused it</span><Pills small opts={CAUSE.map((c) => [c[0], c[0]] as [string, string])} value={f.cause} onChange={(v) => setF({ ...f, cause: v })} /><span className="text-xs text-muted">{liable === 'supplier' ? 'The supplier should answer for this' : liable === 'transport' ? 'Transport is responsible' : 'Our loss'}</span></div>
      <label className="text-[13px] font-semibold flex flex-col gap-1">What happened<textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value, err: '' })} placeholder="One line. The supplier reads this on the claim." className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
      <label className="text-[13px] font-semibold flex flex-col gap-1">Attach a photo<input type="file" accept="image/*" capture="environment" onChange={(e) => setF({ ...f, photo: e.target.files?.[0]?.name ?? '' })} className="text-sm font-normal" /></label>
      {f.photo && <span className="text-xs text-ok">Attached: {f.photo}</span>}
      {f.err && <span role="alert" className="text-sm text-danger">{f.err}</span>}
      <div className="flex gap-2 flex-wrap"><button onClick={() => save(false)} className="btn-ghost">Record it only</button><button onClick={() => save(true)} className="btn-primary">Record and report to the supplier</button><button onClick={() => setF({ ...f, qty: '', note: '', photo: '', err: '' })} className="btn-ghost">Clear</button></div>
    </Card>
  );
}

function NewClaim({ sups, D, P, onSave }: { sups: Sup[]; D: Damage[]; P: Product[]; onSave: (c: Omit<SClaim, 'id' | 'log'>) => void }) {
  const [on, setOn] = useState<'damage' | 'product'>('product');
  const [dmg, setDmg] = useState(D[0]?.id ?? '');
  const [f, setF] = useState({ sup: sups[0]?.name ?? '', prod: '', prodTxt: '', cause: 'Short delivery', want: 'Replacement', qty: '1', amt: '', ref: '', note: '', err: '' });
  const d = D.find((x) => x.id === dmg);
  const prods = P.filter((p) => p.supplier === f.sup);
  return (
    <Card title="Raise a supplier claim" sub="Claim on a damaged item you already recorded, or on any product from a supplier (short delivery, faulty, expired, wrong item, overcharged).">
      <Pills small opts={[['damage', 'A damaged item I recorded'], ['product', 'A product from a supplier']]} value={on} onChange={setOn} />
      {on === 'damage' ? (D.length ? <Pills small opts={D.map((x) => [x.id, `${x.qty} × ${x.name} · ${x.supplier}`] as [string, string])} value={dmg} onChange={setDmg} /> : <span className="text-sm text-muted">No unclaimed damages. Record one under Damages out, or claim on a product instead.</span>) : (
        <>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Supplier</span><Pills small opts={sups.map((x) => [x.name, x.name] as [string, string])} value={f.sup} onChange={(v) => setF({ ...f, sup: v, prod: '' })} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Product</span><Pills small opts={prods.map((p) => [p.name, p.name] as [string, string])} value={f.prod} onChange={(v) => setF({ ...f, prod: v })} /><label className="text-xs font-semibold flex flex-col gap-1">Or type the product<input value={f.prodTxt} onChange={(e) => setF({ ...f, prodTxt: e.target.value })} placeholder='e.g. Standing fan 16"' className="field py-2 font-normal" /></label></div>
        </>
      )}
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">What is wrong</span><Pills small opts={['Short delivery', 'Damaged', 'Faulty', 'Expired', 'Wrong item', 'Overcharged'].map((x) => [x, x] as [string, string])} value={f.cause} onChange={(v) => setF({ ...f, cause: v })} /></div>
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">What we want back</span><Pills small opts={['Replacement', 'Credit note', 'Refund', 'Repair'].map((x) => [x, x] as [string, string])} value={f.want} onChange={(v) => setF({ ...f, want: v })} /></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {([['qty', 'Quantity', ''], ['amt', 'Value claimed (GHS, optional)', '0.00'], ['ref', 'Delivery note / invoice no.', 'e.g. DN-4471'], ['note', 'Details for the supplier', 'e.g. 3 cartons crushed on arrival, photos kept']] as const).map(([k, l, ph]) => <label key={k} className="text-[13px] font-semibold flex flex-col gap-1">{l}<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value, err: '' })} placeholder={ph} className="field py-2.5 font-normal" /></label>)}
      </div>
      {f.err && <span role="alert" className="text-sm text-danger">{f.err}</span>}
      <button onClick={() => { const what = on === 'damage' ? (d ? `${d.qty} × ${d.name}` : '') : `${f.qty} × ${f.prod || f.prodTxt}`; if (!what || what.endsWith('× ')) return setF({ ...f, err: 'Pick what the claim is for.' }); onSave({ supplier: on === 'damage' && d ? d.supplier : f.sup, what, cause: f.cause, want: f.want, qty: parseInt(f.qty, 10) || 1, amt: parseFloat(f.amt) || (d?.value ?? 0), ref: on === 'damage' && d ? d.id : f.ref, note: f.note, status: 'open', at: now(), ts: Date.now() }); setF({ ...f, prod: '', prodTxt: '', amt: '', ref: '', note: '' }); }} className="btn-primary w-fit">Raise claim and email the supplier</button>
    </Card>
  );
}

function Book({ sups, G, C, D }: { sups: Sup[]; G: GI[]; C: SClaim[]; D: Damage[] }) {
  const [sel, setSel] = useState(sups[0]?.name ?? '');
  const s = sups.find((x) => x.name === sel);
  const gi = G.filter((g) => g.sup === sel);
  const items = Object.entries(gi.flatMap((g) => g.lines).reduce<Record<string, { q: number; c: number; t: number }>>((a, l) => { a[l.name] = a[l.name] || { q: 0, c: l.cost, t: 0 }; a[l.name].q += l.qty; a[l.name].t++; return a; }, {}));
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr] items-start">
      <Card title="Supplier details" sub={`${sups.length} suppliers on file`}>{sups.map((x) => <button key={x.name} onClick={() => setSel(x.name)} aria-pressed={sel === x.name} className={cx('text-left p-3 rounded-2xl text-sm', sel === x.name ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}><b>{x.name}</b> <span className={cx('pill ml-1', x.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{x.status === 'active' ? 'Active' : 'On hold'}</span><br /><span className="text-xs text-muted">{x.phone} · {x.lead} days lead time · {G.filter((g) => g.sup === x.name).length} deliveries</span></button>)}</Card>
      {s && <Card title={s.name}>
        {[['Address', s.addr], ['Email', s.email], ['TIN', s.tin], ['Terms on damages', s.terms], ['Payment', `${s.pay} · ${s.lead} days lead time`], ['Record with us', `${gi.length} deliveries worth ${ghs(gi.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.qty * l.cost, 0), 0))} · ${C.filter((c) => c.supplier === sel).length} claims · ${D.filter((d) => d.supplier === sel).length} damages`]].map(([k, v]) => <div key={k} className="text-sm"><span className="text-muted">{k} · </span>{v}</div>)}
        <span className="text-xs text-muted">{s.addedBy}</span>
        <span className="text-[13px] font-semibold">Everything they have supplied</span>
        <T head={['Item', 'Received', 'Cost', 'Deliveries', 'Value']} rows={items.map(([n, v]) => [n, String(v.q), ghs(v.c), String(v.t), ghs(v.q * v.c)])} />
        <span className="text-[13px] font-semibold">Every delivery</span>
        <T head={['Ref', 'Invoice', 'Into', 'When', 'Value']} rows={gi.map((g) => [g.id, g.ref || '—', brName(g.to), g.at, ghs(g.lines.reduce((x, l) => x + l.qty * l.cost, 0))])} />
      </Card>}
    </div>
  );
}

function Manage({ sups, setSups, me }: { sups: Sup[]; setSups: (f: (s: Sup[]) => Sup[]) => void; me: string }) {
  const [f, setF] = useState({ name: '', contact: '', phone: '', email: '', addr: '', tin: '', terms: 'Credit note within 14 days', lead: '7', pay: 'Cash on delivery', err: '' });
  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card title="Add a supplier">
        {([['name', 'Supplier name'], ['contact', 'Contact person'], ['phone', 'Phone'], ['email', 'Email'], ['addr', 'Address'], ['tin', 'TIN'], ['terms', 'Terms on damages'], ['lead', 'Lead time (days)'], ['pay', 'Payment terms']] as const).map(([k, l]) => <label key={k} className="text-[13px] font-semibold flex flex-col gap-1">{l}<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value, err: '' })} className="field py-2 font-normal" /></label>)}
        {f.err && <span role="alert" className="text-sm text-danger">{f.err}</span>}
        <button onClick={() => { if (f.name.trim().length < 2) return setF({ ...f, err: 'Enter the supplier name.' }); if (sups.some((s) => s.name.toLowerCase() === f.name.trim().toLowerCase())) return setF({ ...f, err: 'That supplier is already on file.' }); setSups((x) => [...x, { name: f.name.trim(), contact: `${f.contact} · ${f.phone}`, phone: f.phone, email: f.email, addr: f.addr, tin: f.tin, terms: f.terms, lead: parseInt(f.lead, 10) || 7, pay: f.pay, status: 'active', addedBy: `Added by ${me} · ${now()}` }]); setF({ ...f, name: '', contact: '', phone: '', email: '', addr: '', tin: '' }); }} className="btn-primary w-fit">Add supplier</button>
      </Card>
      <Card title="Suppliers on file">{sups.map((s) => <div key={s.name} className="flex items-center gap-2 text-sm"><span className="flex-1"><b>{s.name}</b><br /><span className="text-xs text-muted">{s.contact}</span></span><button onClick={() => setSups((x) => x.map((y) => (y.name === s.name ? { ...y, status: y.status === 'active' ? 'hold' : 'active' } : y)))} className={cx('text-xs font-semibold px-3 py-1.5 rounded-full border', s.status === 'hold' ? 'border-ok text-ok' : 'border-danger text-danger')}>{s.status === 'active' ? 'Put on hold' : 'Release'}</button></div>)}<span className="text-xs text-muted">A supplier on hold cannot deliver until the Admin releases them.</span></Card>
    </div>
  );
}
