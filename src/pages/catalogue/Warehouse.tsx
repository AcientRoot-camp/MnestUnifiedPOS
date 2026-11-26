import { useState } from 'react';
import { BRS, DAMAGES0, MOVES0, PRODUCTS0, SUPPLIERS, brName, now, type BrId, type Damage, type Move, type Product } from '../../data/catalogue';
import { LOG0, type StockLine } from '../../data/stockLog';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { ScanPick } from './ScanStock';
import { useSession } from '../../lib/session';
import { cx } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';

type Tab = 'overview' | 'stock' | 'sup' | 'wh2br' | 'br2wh' | 'br2br' | 'history';
type Line = { name: string; qty: number };
const KIND_TXT: Record<Move['kind'], string> = { sup: 'Supplier delivery', wh2br: 'Warehouse → store', br2wh: 'Store → warehouse', br2br: 'Branch → branch' };
const ST_TXT: Record<Move['status'], string> = { requested: 'Waiting for approval', in_transit: 'On the way', received: 'Received', cancelled: 'Cancelled' };
const REASONS: Record<string, string[]> = { wh2br: ['Restock', 'Opening stock', 'Promotion'], br2wh: ['Overstock', 'Slow selling', 'Damaged · for supplier'], br2br: ['Low stock', 'Customer order', 'Balance stock'] };

export default function Warehouse() {
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role].name;
  const myBr = (session?.branch ?? 'osu') as BrId;
  const [P, setP] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [M, setM] = usePersist<Move[]>('ecompos.moves2', MOVES0);
  const [, setLog] = usePersist<StockLine[]>('ecompos.stockLog2', LOG0);
  const [, setDmg] = usePersist<Damage[]>('ecompos.damages2', DAMAGES0);
  const [tab, setTab] = useState<Tab>('overview');
  const [msg, setMsg] = useState('');
  const [rcv, setRcv] = useState<{ id: string; dmg: Record<string, number> } | null>(null);
  const live = P.filter((p) => p.status === 'live' && p.track !== 'digital');
  const avail = (name: string, at: string) => { const p = P.find((x) => x.name === name); return !p ? 0 : at === 'wh' ? p.wh : p.stock[at as BrId] ?? 0; };
  const shift = (lines: Line[], from: string | null, to: string | null, mult = 1) => setP((x) => x.map((p) => { const l = lines.find((y) => y.name === p.name); if (!l) return p; const s = { ...p.stock }; let wh = p.wh; if (from) { if (from === 'wh') wh -= l.qty * mult; else s[from as BrId] -= l.qty * mult; } if (to) { if (to === 'wh') wh += l.qty * mult; else s[to as BrId] += l.qty * mult; } return { ...p, stock: s, wh }; }));
  const log = (lines: Line[], br: string, sign: number, kind: string, ref: string) => setLog((x) => [...lines.map((l, i) => ({ ts: Date.now() + i, at: now(), name: l.name, br, qty: sign * l.qty, kind, ref, by: me })), ...x]);
  const upM = (id: string, p: Partial<Move>, t: string) => setM((x) => x.map((m) => (m.id === id ? { ...m, ...p, log: [...m.log, { t: `${t} · ${me} · ${now()}` }] } : m)));
  const nextId = (k: Move['kind']) => (k === 'sup' ? 'GRN-0' : 'TR-0') + String(312 + M.length);

  const dispatch = (m: Move) => { shift(m.lines, m.from, null); log(m.lines, m.from, -1, 'Transfer out', m.id); upM(m.id, { status: 'in_transit' }, 'Approved and dispatched'); setMsg(`${m.id} dispatched to ${brName(m.to)}`); };
  const receive = (m: Move, dmg: Record<string, number>) => {
    const good = m.lines.map((l) => ({ name: l.name, qty: l.qty - (dmg[l.name] || 0) }));
    shift(good, null, m.to); log(good, m.to, 1, 'Transfer in', m.id);
    const bad = m.lines.filter((l) => dmg[l.name]);
    if (bad.length) setDmg((x) => [...bad.map((l, i) => ({ id: 'DM-0' + (50 + x.length + i), name: l.name, qty: dmg[l.name], src: 'transit' as const, loc: m.to === 'wh' ? 'osu' : m.to, note: `Damaged on ${m.id} from ${brName(m.from)}`, cause: 'Handling in transit', liable: 'transport' as const, supplier: P.find((p) => p.name === l.name)?.supplier ?? '', value: (P.find((p) => p.name === l.name)?.cost ?? 0) * dmg[l.name], status: 'reported' as const, at: now(), log: [{ t: `Logged on receiving ${m.id}` }] })), ...x]);
    upM(m.id, { status: 'received', lines: m.lines.map((l) => ({ ...l, dmg: dmg[l.name] || 0 })) }, `Received at ${brName(m.to)}${bad.length ? ` · ${bad.reduce((s, l) => s + dmg[l.name], 0)} damaged to Damages` : ''}`);
    setRcv(null); setMsg(`${m.id} received at ${brName(m.to)}`);
  };
  const cancel = (m: Move) => { if (m.status === 'in_transit') { shift(m.lines, null, m.from); log(m.lines, m.from, 1, 'Transfer cancelled · returned', m.id); } upM(m.id, { status: 'cancelled' }, m.status === 'in_transit' ? 'Recalled' : 'Cancelled'); setMsg(`${m.id} cancelled`); };

  const open = M.filter((m) => m.status === 'requested' || m.status === 'in_transit');
  const lowCells = live.flatMap((p) => BRS.filter((b) => p.stock[b.id] <= p.reorder).map((b) => ({ p, b })));
  const suggestions = lowCells.slice(0, 4).map(({ p, b }) => {
    const donor = BRS.filter((x) => x.id !== b.id).sort((x, y) => p.stock[y.id] - p.stock[x.id])[0];
    const need = p.reorder * 2 - p.stock[b.id];
    const fromWh = p.wh >= need;
    const onWay = open.some((m) => m.to === b.id && m.lines.some((l) => l.name === p.name));
    return { p, b, need, from: fromWh ? 'wh' : donor.id, onWay, tag: onWay ? 'On the way' : fromWh ? 'From warehouse' : 'Branch to branch' };
  });

  const Row = ({ m }: { m: Move }) => (
    <div className="p-4 rounded-2xl border border-line flex flex-col gap-2">
      <div className="flex justify-between gap-2 flex-wrap"><b className="text-sm">{m.id} · {brName(m.from)} → {brName(m.to)}</b><span className={cx('pill', m.status === 'received' ? 'bg-green-100 text-green-800' : m.status === 'cancelled' ? 'bg-red-100 text-red-800' : m.status === 'in_transit' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900')}>{ST_TXT[m.status]}</span></div>
      <span className="text-sm">{m.lines.map((l) => `${l.qty} × ${l.name}${l.dmg ? ` (${l.dmg} damaged)` : ''}`).join(', ')}</span>
      <span className="text-xs text-muted">{m.reason} · by {m.by} · {m.at}{m.note ? ` · ${m.note}` : ''}{m.ref ? ` · ${m.ref}` : ''}</span>
      {m.log.map((t, i) => <span key={i} className="text-xs text-sub">• {t.t}</span>)}
      {rcv?.id === m.id ? (
        <div className="p-3 rounded-2xl bg-canvas flex flex-col gap-2">
          <strong className="text-sm">Check what arrived · mark anything damaged</strong>
          {m.lines.map((l) => <div key={l.name} className="flex items-center gap-2 text-sm"><span className="flex-1">{l.qty} × {l.name}</span><span className="text-xs text-muted">Damaged</span><button aria-label="One less damaged" onClick={() => setRcv({ id: m.id, dmg: { ...rcv.dmg, [l.name]: Math.max(0, (rcv.dmg[l.name] || 0) - 1) } })} className="w-7 h-7 rounded-full border border-line bg-white">−</button><b className="w-5 text-center">{rcv.dmg[l.name] || 0}</b><button aria-label="One more damaged" onClick={() => setRcv({ id: m.id, dmg: { ...rcv.dmg, [l.name]: Math.min(l.qty, (rcv.dmg[l.name] || 0) + 1) } })} className="w-7 h-7 rounded-full border border-line bg-white">+</button></div>)}
          <span className="text-xs text-muted">Damaged items are not added to stock. They go to Damages & suppliers so the supplier can repair or replace them.</span>
          <div className="flex gap-2"><button onClick={() => setRcv(null)} className="btn-ghost min-h-9 text-xs">Back</button><button onClick={() => receive(m, rcv.dmg)} className="btn-primary min-h-9 text-xs">Confirm received</button></div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {m.status === 'requested' && (SU || role === 'manager') && <button onClick={() => dispatch(m)} className="btn-primary min-h-9 text-xs">Approve & dispatch</button>}
          {m.status === 'in_transit' && (SU || m.to === myBr || m.to === 'wh') && <button onClick={() => setRcv({ id: m.id, dmg: {} })} className="btn-dark min-h-9 text-xs">Receive at {brName(m.to)}</button>}
          {(m.status === 'requested' || m.status === 'in_transit') && <button onClick={() => cancel(m)} className="btn-ghost min-h-9 text-xs text-danger">{m.status === 'in_transit' ? 'Recall' : 'Cancel request'}</button>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Warehouse & transfers</h1><p className="m-0 text-sm text-muted">{SU ? 'Main warehouse and every branch' : `${brName(myBr)} branch and the main warehouse`} · supplier deliveries, transfers and stock on the move</p></header>
      <Pills opts={[['overview', 'Overview'], ['stock', 'Warehouse stock'], ['sup', 'Supplier deliveries'], ['wh2br', 'Warehouse → store'], ['br2wh', 'Store → warehouse'], ['br2br', 'Branch → branch'], ['history', 'History']]} value={tab} onChange={(t) => { setTab(t); setRcv(null); }} />
      {msg && <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#e6f4e8] border border-ok text-sm"><span className="flex-1">✓ {msg}</span><button onClick={() => setMsg('')} aria-label="Close">×</button></div>}

      {tab === 'overview' && (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {[['Units in the warehouse', live.reduce((s, p) => s + p.wh, 0).toLocaleString(), `${live.filter((p) => p.wh > 0).length} products`], ['On the move', String(M.filter((m) => m.status === 'in_transit').length), 'Dispatched, not yet received'], ['Waiting for approval', String(M.filter((m) => m.status === 'requested').length), 'Transfer requests'], ['Below reorder', String(lowCells.length), 'Branch stock cells']].map(([l, v, n]) => <div key={l} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><strong className="text-[26px] font-medium tracking-tightest">{v}</strong><span className="text-xs text-sub">{n}</span></div>)}
          </div>
          <Card title="✨ Smart stock suggestions" sub="Worked out from live stock, reorder levels and what is already on the way">
            {!suggestions.length && <span className="text-sm text-muted">Every branch is above its reorder level. Nothing needs moving right now.</span>}
            {suggestions.map((s) => (
              <div key={s.p.id + s.b.id} className="flex items-center gap-3 p-3 rounded-2xl bg-canvas flex-wrap">
                <span className="pill bg-white">{s.tag}</span>
                <span className="flex-1 min-w-[220px] text-sm"><b>Send {s.need} × {s.p.name} to {s.b.name}</b><br /><span className="text-xs text-muted">{s.b.name} has {s.p.stock[s.b.id]} (reorder at {s.p.reorder}) · {brName(s.from)} has {avail(s.p.name, s.from)}</span></span>
                <button onClick={() => setTab(s.from === 'wh' ? 'wh2br' : 'br2br')} className="btn-ghost min-h-9 text-xs">Review</button>
                <button disabled={s.onWay} onClick={() => { const id = nextId(s.from === 'wh' ? 'wh2br' : 'br2br'); const m: Move = { id, kind: s.from === 'wh' ? 'wh2br' : 'br2br', from: s.from, to: s.b.id, lines: [{ name: s.p.name, qty: Math.min(s.need, avail(s.p.name, s.from)) }], reason: 'Low stock', note: 'From smart suggestion', status: 'requested', by: me, at: now(), log: [{ t: `Requested by ${me} · ${now()}` }] }; setM((x) => [m, ...x]); setMsg(`${id} requested`); }} className="btn-primary min-h-9 text-xs">{s.onWay ? 'Already on the way' : 'Create transfer'}</button>
              </div>
            ))}
          </Card>
          <Card title="On the move & waiting">{!open.length ? <span className="text-sm text-muted">No open movements.</span> : open.map((m) => <Row key={m.id} m={m} />)}</Card>
        </>
      )}

      {tab === 'stock' && (
        <Card title="Stock in the warehouse and every branch" sub="Dark cells are below the reorder level">
          <T head={['Product', 'Warehouse', ...BRS.map((b) => b.name), 'Reorder at', 'Actions']} rows={live.map((p) => [<b key="n">{p.name}</b>, <b key="w">{p.wh}</b>, ...BRS.map((b) => <span key={b.id} className={cx('inline-block min-w-9 text-center px-2 py-1 rounded-lg text-xs font-semibold', p.stock[b.id] <= p.reorder ? 'bg-black text-white' : 'bg-canvas')}>{p.stock[b.id]}</span>), String(p.reorder), <button key="a" disabled={!p.wh} onClick={() => setTab('wh2br')} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line disabled:opacity-40">Send to store</button>])} />
        </Card>
      )}

      {tab === 'sup' && <Supplier P={live} M={M} me={me} onSave={(m) => { setM((x) => [m, ...x]); shift(m.lines, null, m.to); log(m.lines, m.to, 1, 'Supplier delivery', m.id); setMsg(`${m.id} received · ${m.lines.reduce((s, l) => s + l.qty, 0)} units added to ${brName(m.to)}`); }} nextId={nextId('sup')} />}

      {(tab === 'wh2br' || tab === 'br2wh' || tab === 'br2br') && (
        <TransferForm key={tab} kind={tab} P={live} avail={avail} SU={SU} myBr={myBr} nextId={nextId(tab)} me={me}
          onSave={(m, now_) => { setM((x) => [m, ...x]); if (now_) { shift(m.lines, m.from, null); log(m.lines, m.from, -1, 'Transfer out', m.id); } setMsg(`${m.id} ${now_ ? 'dispatched' : 'requested'}`); }}
          list={M.filter((m) => m.kind === tab)} Row={Row} />
      )}

      {tab === 'history' && (
        <Card title={`All movements · ${M.length}`}>
          <T head={['Ref', 'Type', 'Route', 'Items', 'By', 'When', 'Status']} rows={M.map((h) => [<b key="i">{h.id}</b>, KIND_TXT[h.kind], `${brName(h.from)} → ${brName(h.to)}`, h.lines.map((l) => `${l.qty} × ${l.name}`).join(', '), h.by, h.at, <span key="s" className={cx('pill', h.status === 'received' ? 'bg-green-100 text-green-800' : h.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{ST_TXT[h.status]}</span>])} />
        </Card>
      )}
    </>
  );
}

function LinePicker({ P, at, lines, setLines, availLabel }: { P: Product[]; at: string; lines: Line[]; setLines: (l: Line[]) => void; availLabel: (name: string) => [number, string] }) {
  const [q, setQ] = useState('');
  const hits = P.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, q.trim() ? 8 : 0);
  const add = (name: string, n: number) => { const [max] = availLabel(name); const cur = lines.find((l) => l.name === name); const next = Math.max(0, Math.min(max, (cur?.qty ?? 0) + n)); setLines(cur ? lines.map((l) => (l.name === name ? { ...l, qty: next } : l)).filter((l) => l.qty > 0) : next ? [...lines, { name, qty: next }] : lines); };
  return (
    <div className="flex flex-col gap-2">
      {/* Scan to add a line: an item adds 1, a carton code adds the whole carton (productscan.md §4.1–4.2). */}
      <ScanPick P={P} label="Scan an item or carton" onPick={(p, n) => add(p.name, n)} />
      <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="field py-2.5" />
      <div className="flex gap-1.5 flex-wrap">{hits.map((p) => { const [n, t] = availLabel(p.name); return <button key={p.id} disabled={!n} onClick={() => { add(p.name, 1); setQ(''); }} className="text-xs px-3 py-1.5 rounded-full border border-line disabled:opacity-40">+ {p.name} · {t}</button>; })}</div>
      {lines.map((l) => <div key={l.name} className="flex items-center gap-2 text-sm p-2 rounded-xl bg-canvas"><span className="flex-1">{l.name}<br /><span className="text-xs text-muted">{availLabel(l.name)[1]} at {brName(at)}</span></span><button aria-label="One less" onClick={() => add(l.name, -1)} className="w-7 h-7 rounded-full border border-line bg-white">−</button><b className="w-8 text-center">{l.qty}</b><button aria-label="One more" onClick={() => add(l.name, 1)} className="w-7 h-7 rounded-full border border-line bg-white">+</button><button onClick={() => add(l.name, 10)} className="text-xs px-2 py-1 rounded-full border border-line bg-white">+10</button><button aria-label={`Remove ${l.name}`} onClick={() => setLines(lines.filter((x) => x.name !== l.name))} className="w-7 h-7 text-danger">×</button></div>)}
    </div>
  );
}

function Supplier({ P, M, me, onSave, nextId }: { P: Product[]; M: Move[]; me: string; onSave: (m: Move) => void; nextId: string }) {
  const [sup, setSup] = useState(SUPPLIERS[0].name);
  const [to, setTo] = useState('wh');
  const [kind, setKind] = useState('New stock');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState('');
  const mine = P.filter((p) => p.supplier === sup);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr] items-start">
      <Card title="Receive a delivery from a supplier" sub="New stock, replacements for damaged goods and repaired items coming back. What you receive here is added to stock straight away and can be sold.">
        <span className="text-xs p-3 rounded-xl bg-canvas">Waiting on suppliers · CL-0019 Nasco Electronics (1 blender on claim). Items from a damage claim are added back from Damages & suppliers, so the claim closes with them.</span>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Supplier</span><Pills small opts={SUPPLIERS.map((s) => [s.name, s.name] as [string, string])} value={sup} onChange={(v) => { setSup(v); setLines([]); }} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Receive into</span><Pills small opts={[['wh', 'Warehouse'], ...BRS.map((b) => [b.id, b.name] as [string, string])]} value={to} onChange={setTo} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">What kind of delivery</span><Pills small opts={[['New stock', 'New stock'], ['Replacement', 'Replacement for damaged'], ['Repaired', 'Repaired item back']]} value={kind} onChange={setKind} /></div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Delivery or invoice number (optional)<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. INV-88214 or waybill 3391" className="field py-2.5 font-normal" /></label>
        <span className="text-[13px] font-semibold">Add what arrived <span className="font-normal text-muted">· {sup} supplies {mine.map((p) => p.name).join(', ') || 'nothing on file'}</span></span>
        <LinePicker P={mine.length ? mine : P} at={to} lines={lines} setLines={setLines} availLabel={(n) => [9999, `${(to === 'wh' ? P.find((p) => p.name === n)?.wh : P.find((p) => p.name === n)?.stock[to as BrId]) ?? 0} now`]} />
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 cartons short, supplier to send the rest" className="field py-2.5 font-normal" /></label>
        {err && <span role="alert" className="text-sm text-danger">{err}</span>}
        <button onClick={() => { if (!lines.length) return setErr('Add what arrived.'); onSave({ id: nextId, kind: 'sup', from: sup, to, supplier: sup, lines, reason: kind, note, status: 'received', by: me, at: now(), ref, log: [{ t: `Received into ${brName(to)} · ${now()}` }] }); setLines([]); setRef(''); setNote(''); setErr(''); }} className="btn-primary">Receive & add to stock</button>
      </Card>
      <Card title="Deliveries received">
        {!M.some((m) => m.kind === 'sup') && <span className="text-sm text-muted">No supplier deliveries recorded yet.</span>}
        {M.filter((m) => m.kind === 'sup').map((d) => <div key={d.id} className="p-3 rounded-2xl border border-line text-sm flex flex-col gap-1"><div className="flex justify-between"><b>{d.id} · {d.supplier} → {brName(d.to)}</b><span className="pill bg-green-100 text-green-800">Received</span></div><span>{d.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</span><span className="text-xs text-muted">{d.reason} · {d.ref || 'no reference'} · by {d.by} · {d.at}</span></div>)}
      </Card>
    </div>
  );
}

function TransferForm({ kind, P, avail, SU, myBr, nextId, me, onSave, list, Row }: { kind: 'wh2br' | 'br2wh' | 'br2br'; P: Product[]; avail: (n: string, at: string) => number; SU: boolean; myBr: BrId; nextId: string; me: string; onSave: (m: Move, now_: boolean) => void; list: Move[]; Row: (p: { m: Move }) => JSX.Element }) {
  const froms = kind === 'wh2br' ? ['wh'] : BRS.map((b) => b.id).filter((b) => SU || b === myBr);
  const tos = kind === 'br2wh' ? ['wh'] : BRS.map((b) => b.id);
  const [from, setFrom] = useState<string>(froms[0]);
  const [to, setTo] = useState<string>(tos.find((t) => t !== froms[0]) ?? tos[0]);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState(REASONS[kind][0]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const title = { wh2br: 'Send stock from the warehouse to a store', br2wh: 'Send stock back to the warehouse', br2br: 'Move stock between branches' }[kind];
  const go = (dispatchNow: boolean) => {
    if (from === to) return setErr('Pick a different place to send to.');
    if (!lines.length) return setErr('Add the products to send.');
    onSave({ id: nextId, kind, from, to, lines, reason, note, status: dispatchNow ? 'in_transit' : 'requested', by: me, at: now(), log: [{ t: `${dispatchNow ? 'Dispatched' : 'Requested'} by ${me} · ${now()}` }] }, dispatchNow);
    setLines([]); setNote(''); setErr('');
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr] items-start">
      <Card title={title} sub={SU ? 'As Admin you can dispatch straight away.' : 'Your request goes to the Admin or the branch manager to approve and dispatch.'}>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">From</span><Pills small opts={froms.map((f) => [f, brName(f)] as [string, string])} value={from} onChange={(v) => { setFrom(v); setLines([]); }} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">To</span><Pills small opts={tos.filter((t) => t !== from).map((t) => [t, brName(t)] as [string, string])} value={to} onChange={setTo} /></div>
        <span className="text-[13px] font-semibold">Add products · stock shown is what {brName(from)} has now</span>
        <LinePicker P={P} at={from} lines={lines} setLines={setLines} availLabel={(n) => [avail(n, from), `${avail(n, from)} available`]} />
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Reason</span><Pills small opts={REASONS[kind].map((r) => [r, r] as [string, string])} value={reason} onChange={setReason} /></div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Use the blue van · call Ama on arrival" className="field py-2.5 font-normal" /></label>
        {err && <span role="alert" className="text-sm text-danger">{err}</span>}
        <div className="flex gap-2 flex-wrap"><button onClick={() => go(false)} className="btn-ghost">Send request</button>{SU && <button onClick={() => go(true)} className="btn-primary">Dispatch now</button>}</div>
        <span className="text-xs text-muted">Stock leaves {brName(from)} when it is dispatched and is added at {brName(to)} when it is received there.</span>
      </Card>
      <Card title={`${KIND_TXT[kind]} · ${list.length}`}>{!list.length ? <span className="text-sm text-muted">Nothing here yet.</span> : list.map((m) => <Row key={m.id} m={m} />)}</Card>
    </div>
  );
}
