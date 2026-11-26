import { useState } from 'react';
import { BRS, CLAIMS0, DAMAGES0, PRODUCTS0, SUPPLIERS, brName, now, type BrId, type Claim, type Damage, type Product } from '../../data/catalogue';
import { COMPANY } from '../../data/hirePurchase';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { ScanPick } from './ScanStock';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';

type Tab = 'overview' | 'records' | 'report' | 'claims' | 'suppliers';
const ST: Record<Damage['status'], [string, string]> = { reported: ['Reported · needs action', 'bg-amber-100 text-amber-900'], at_supplier: ['With the supplier', 'bg-blue-100 text-blue-900'], returned: ['Back from supplier', 'bg-green-100 text-green-800'], written_off: ['Written off', 'bg-canvas text-muted'], closed: ['Closed', 'bg-green-100 text-green-800'] };
const SRC: Record<Damage['src'], string> = { storage: 'Found in storage', customer: 'Customer return', transit: 'Damaged in transit' };
const CAUSES: [RegExp, string, Damage['liable'], string][] = [
  [/leak|seal|seam|dent|torn|burst/i, 'Packaging damage', 'supplier', 'Claim from the supplier · their packaging failed'],
  [/not work|faulty|motor|dead|won.?t|power/i, 'Manufacturing fault', 'supplier', 'Repair or replace under warranty'],
  [/crack|drop|fell|van|transit|arriv/i, 'Handling in transit', 'transport', 'Check how it was packed and who carried it'],
  [/roof|rain|wet|soak|heat|sun|rat|pest/i, 'Storage conditions', 'us', 'Our loss · fix the storage problem'],
  [/expir|spoil|mould|rotten/i, 'Expired or spoilt', 'us', 'Rotate stock: first in, first out'],
];
const guess = (t: string) => CAUSES.find((c) => c[0].test(t)) ?? null;

export default function Damages() {
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role].name;
  const myBr = (session?.branch ?? 'osu') as BrId;
  const [D, setD] = usePersist<Damage[]>('ecompos.damages2', DAMAGES0);
  const [C, setC] = usePersist<Claim[]>('ecompos.claims2', CLAIMS0);
  const [P, setP] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [tab, setTab] = useState<Tab>('overview');
  const [filter, setFilter] = useState('open');
  const [selIds, setSelIds] = useState<Record<string, boolean>>({});
  const [rcv, setRcv] = useState<{ id: string; qty: number; to: string; how?: 'repaired' | 'replaced' | 'credit'; cn?: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [rp, setRp] = useState({ src: 'storage' as Damage['src'], loc: myBr as string, q: '', name: '', qty: 1, note: '', cause: '', err: '' });
  const [letterOpen, setLetterOpen] = useState('');
  const mine = D.filter((d) => SU || d.loc === myBr);
  const up = (id: string, p: Partial<Damage>, t: string) => setD((x) => x.map((d) => (d.id === id ? { ...d, ...p, log: [...d.log, { t: `${t} · ${me} · ${now()}` }] } : d)));
  const toStock = (name: string, qty: number, at: string) => setP((x) => x.map((p) => (p.name === name ? (at === 'wh' ? { ...p, wh: p.wh + qty } : { ...p, stock: { ...p.stock, [at]: p.stock[at as BrId] + qty } }) : p)));
  const fromStock = (name: string, qty: number, at: string) => setP((x) => x.map((p) => (p.name === name ? { ...p, stock: { ...p.stock, [at]: Math.max(0, p.stock[at as BrId] - qty) } } : p)));

  const open = mine.filter((d) => d.status === 'reported' || d.status === 'returned');
  const value = (f: (d: Damage) => boolean) => mine.filter(f).reduce((s, d) => s + d.value, 0);
  const recovered = value((d) => d.status === 'closed' && d.liable === 'supplier');
  const kpis: [string, string, string, Tab][] = [
    ['Damaged this month', ghs(value(() => true)), `${mine.reduce((s, d) => s + d.qty, 0)} units`, 'records'],
    ['Needs action', String(open.length), 'Send, write off or restock', 'records'],
    ['With suppliers', ghs(value((d) => d.status === 'at_supplier')), `${mine.filter((d) => d.status === 'at_supplier').length} records on claim`, 'claims'],
    ['Recovered', ghs(recovered), 'Replaced or credited by suppliers', 'suppliers'],
  ];
  const bySup = Object.entries(mine.reduce<Record<string, number>>((a, d) => ((a[d.supplier] = (a[d.supplier] || 0) + d.qty), a), {})).sort((a, b) => b[1] - a[1]);
  const byCause = Object.entries(mine.reduce<Record<string, number>>((a, d) => ((a[d.cause] = (a[d.cause] || 0) + d.value), a), {})).sort((a, b) => b[1] - a[1]);
  const intel = [
    bySup[0] && { icon: '🏭', title: `${bySup[0][0]} has the most damaged units (${bySup[0][1]})`, body: 'Raise it at the next supplier meeting and ask for better packing.' },
    byCause[0] && { icon: '🔍', title: `${byCause[0][0]} costs the most · ${ghs(byCause[0][1])}`, body: CAUSES.find((c) => c[1] === byCause[0][0])?.[3] ?? '' },
    { icon: '🚚', title: `${mine.filter((d) => d.src === 'transit').length} damaged in transit`, body: 'Use crates for TVs and glass, and check items before signing the waybill.' },
    { icon: '💰', title: `${ghs(value((d) => d.liable === 'supplier' && d.status === 'reported'))} can still be claimed`, body: 'Supplier-liable damage not yet sent. Pick the records and send them on one claim.' },
  ].filter(Boolean) as { icon: string; title: string; body: string }[];

  const filtered = mine.filter((d) => filter === 'all' || (filter === 'open' && (d.status === 'reported' || d.status === 'returned' || d.status === 'at_supplier')) || (filter === 'closed' && (d.status === 'closed' || d.status === 'written_off')) || d.src === filter);
  const selected = filtered.filter((d) => selIds[d.id] && d.status === 'reported' && d.liable !== 'us');
  const makeClaim = (ids: string[], extra: Damage[] = []) => {
    const recs = [...extra, ...D].filter((d) => ids.includes(d.id));
    const groups = Array.from(new Set(recs.map((r) => r.supplier)));
    const made: Claim[] = groups.map((s, i) => ({ id: 'CL-00' + (20 + C.length + i), supplier: s, items: recs.filter((r) => r.supplier === s).map((r) => r.id), status: 'draft', at: now(), log: [{ t: `Claim drafted by ${me} · ${now()}` }] }));
    setC((x) => [...made, ...x]);
    setD((x) => x.map((d) => { const c = made.find((m) => m.items.includes(d.id)); return c ? { ...d, status: 'at_supplier', claimId: c.id, log: [...d.log, { t: `Added to claim ${c.id}` }] } : d; }));
    setSelIds({}); setTab('claims'); setMsg(`${made.length} claim${made.length > 1 ? 's' : ''} drafted · send ${made.length > 1 ? 'them' : 'it'} to the supplier`);
  };
  const g = guess(rp.note);
  const hits = rp.q.trim() ? P.filter((p) => p.status === 'live' && p.name.toLowerCase().includes(rp.q.toLowerCase())).slice(0, 6) : [];
  const stockAt = P.find((p) => p.name === rp.name)?.stock[rp.loc as BrId] ?? 0;
  const saveReport = (send: boolean) => {
    if (!rp.name) return setRp({ ...rp, err: 'Pick the product.' });
    if (rp.qty > stockAt) return setRp({ ...rp, err: `${brName(rp.loc)} only has ${stockAt} in stock.` });
    if (rp.note.trim().length < 6) return setRp({ ...rp, err: 'Say what happened.' });
    const cause = rp.cause || g?.[1] || 'Other';
    const c = CAUSES.find((x) => x[1] === cause);
    const prod = P.find((p) => p.name === rp.name)!;
    const id = 'DM-0' + (45 + D.length);
    const rec: Damage = { id, name: rp.name, qty: rp.qty, src: rp.src, loc: rp.loc, note: rp.note, cause, liable: c?.[2] ?? 'us', supplier: prod.supplier, value: prod.cost * rp.qty, status: 'reported', at: now(), log: [{ t: `Reported by ${me} · ${now()}` }] };
    setD((x) => [rec, ...x]);
    fromStock(rp.name, rp.qty, rp.loc);
    setRp({ src: 'storage', loc: myBr, q: '', name: '', qty: 1, note: '', cause: '', err: '' });
    if (send && rec.liable !== 'us') { makeClaim([id], [rec]); } else { setTab('records'); setMsg(`${id} saved · ${rec.qty} taken out of sellable stock at ${brName(rec.loc)}`); }
  };

  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Damages & suppliers</h1><p className="m-0 text-sm text-muted">{SU ? 'Every branch and the warehouse' : brName(myBr) + ' branch'} · record losses, claim back from suppliers, restock what comes back</p></header>
      <Pills opts={[['overview', 'Overview'], ['records', 'Damage records'], ['report', 'Report damage'], ['claims', 'Supplier claims'], ['suppliers', 'Suppliers']]} value={tab} onChange={setTab} />
      {msg && <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#e6f4e8] border border-ok text-sm"><span className="flex-1">✓ {msg}</span><button onClick={() => setMsg('')} aria-label="Close">×</button></div>}

      {tab === 'overview' && (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">{kpis.map(([l, v, n, t]) => <button key={l} onClick={() => setTab(t)} className="card p-5 flex flex-col gap-1 text-left hover:bg-canvas/40"><span className="text-[13px] text-muted">{l}</span><strong className="text-[26px] font-medium tracking-tightest">{v}</strong><span className="text-xs text-sub">{n}</span></button>)}</div>
          <section className="rounded-4xl bg-black text-white p-5 sm:p-6 flex flex-col gap-3"><div><h2 className="m-0 text-lg font-semibold">✨ Damage intelligence</h2><span className="text-[13px] text-white/70">Patterns found in every damage record across the company</span></div>{intel.map((i) => <div key={i.title} className="flex gap-3 p-3 rounded-2xl bg-white/[0.08]"><span className="text-xl">{i.icon}</span><span className="flex flex-col"><b className="text-sm">{i.title}</b><span className="text-[13px] text-white/75">{i.body}</span></span></div>)}</section>
          <Card title="Needs action">{!open.length ? <span className="text-sm text-muted">Nothing waiting. Every damage is with a supplier or closed.</span> : open.map((d) => <button key={d.id} onClick={() => { setTab('records'); setFilter('open'); }} className="flex items-center gap-3 p-3 rounded-2xl border border-line text-left hover:bg-canvas flex-wrap"><span className="flex-1 min-w-[220px] text-sm"><b>{d.id} · {d.qty} × {d.name}</b><br /><span className="text-xs text-muted">{d.status === 'returned' ? 'Add what came back to stock' : d.liable === 'us' ? 'Write it off' : `Send to ${d.supplier}`}</span></span><span className={cx('pill', ST[d.status][1])}>{ST[d.status][0]}</span></button>)}</Card>
        </>
      )}

      {tab === 'records' && (
        <Card title="Damage records">
          <div className="flex gap-3 flex-wrap items-center justify-between"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Show</span><Pills small opts={[['open', 'Open'], ['all', 'All'], ['storage', 'Storage'], ['customer', 'Customer returns'], ['transit', 'Transit'], ['closed', 'Closed']]} value={filter} onChange={setFilter} /></div><button disabled={!selected.length} onClick={() => makeClaim(selected.map((d) => d.id))} className="btn-dark min-h-9 text-xs">{selected.length ? `Send ${selected.length} to supplier on a claim` : 'Tick records to claim'}</button></div>
          {!filtered.length && <span className="text-sm text-muted">No damage records here.</span>}
          {filtered.map((d) => (
            <article key={d.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
              <div className="flex gap-3 items-start flex-wrap">
                <input type="checkbox" aria-label={`Select ${d.id}`} disabled={d.status !== 'reported' || d.liable === 'us'} checked={!!selIds[d.id]} onChange={() => setSelIds({ ...selIds, [d.id]: !selIds[d.id] })} className="mt-1 w-4 h-4 accent-[#0b5c5c]" />
                <span className="flex-1 min-w-[220px] text-sm"><b>{d.qty} × {d.name}</b><br /><span className="text-xs text-muted">{d.id} · {SRC[d.src]} · {brName(d.loc)} · {d.at}</span></span>
                <span className={cx('pill', ST[d.status][1])}>{ST[d.status][0]}</span>
              </div>
              <span className="text-sm">{d.note}</span>
              <span className="text-xs p-2 rounded-xl bg-canvas">✨ {d.cause} · {d.liable === 'supplier' ? 'Supplier is liable' : d.liable === 'transport' ? 'Transport / handling' : 'Our loss'} · {CAUSES.find((c) => c[1] === d.cause)?.[3] ?? ''} <br />Supplier: {d.supplier} · value {ghs(d.value)}</span>
              {d.log.map((t, i) => <span key={i} className="text-xs text-sub">• {t.t}</span>)}
              {d.rcv !== undefined && d.status === 'closed' && <span className="text-xs text-ok">📦 {d.rcv} of {d.qty} came back and were added to stock</span>}
              {rcv?.id === d.id ? (
                <div className="p-3 rounded-2xl bg-canvas flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">What came back</span><Pills small opts={[['replaced', 'Replaced'], ['repaired', 'Repaired'], ['credit', 'Credit note']]} value={rcv.how || 'replaced'} onChange={(v) => setRcv({ ...rcv, how: v as 'credit' })} /></div>
                  {rcv.how === 'credit' ? <label className="text-xs font-semibold flex flex-col gap-1">Credit note number and value<input value={rcv.cn || ''} onChange={(e) => setRcv({ ...rcv, cn: e.target.value })} placeholder={`e.g. CN-2210 · GHS ${d.value.toFixed(2)}`} className="field py-2 font-normal" /></label> : <><div className="flex items-center gap-2 text-sm">How many came back? <button aria-label="One less" onClick={() => setRcv({ ...rcv, qty: Math.max(0, rcv.qty - 1) })} className="w-7 h-7 rounded-full border border-line bg-white">−</button><b>{rcv.qty}</b><button aria-label="One more" onClick={() => setRcv({ ...rcv, qty: Math.min(d.qty, rcv.qty + 1) })} className="w-7 h-7 rounded-full border border-line bg-white">+</button> of {d.qty} sent</div>
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Add them to</span><Pills small opts={[['wh', 'Warehouse'], ...BRS.map((b) => [b.id, b.name] as [string, string])]} value={rcv.to} onChange={(v) => setRcv({ ...rcv, to: v })} /></div></>}
                  <span className="text-xs text-muted">Anything the supplier did not send back stays on this record so you can chase it.</span>
                  <div className="flex gap-2"><button onClick={() => setRcv(null)} className="btn-ghost min-h-9 text-xs">Cancel</button><button onClick={() => { if (rcv.how === 'credit') { if (!(rcv.cn || '').trim()) return setMsg('Add the credit note number and value.'); up(d.id, { status: 'closed' }, `Credit note received · ${rcv.cn}`); setRcv(null); return setMsg(`${d.id} closed with credit note ${rcv.cn}`); } toStock(d.name, rcv.qty, rcv.to); up(d.id, rcv.qty >= d.qty ? { status: 'closed', rcv: rcv.qty } : { qty: d.qty - rcv.qty, rcv: rcv.qty }, `${rcv.qty} ${rcv.how === 'repaired' ? 'repaired' : 'replaced'} and received back into ${brName(rcv.to)}`); setRcv(null); setMsg(`${rcv.qty} × ${d.name} added to ${brName(rcv.to)}`); }} className="btn-primary min-h-9 text-xs">{rcv.how === 'credit' ? 'Close with credit note' : 'Add to stock'}</button></div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {d.status === 'reported' && d.liable !== 'us' && <button onClick={() => makeClaim([d.id])} className="btn-dark min-h-9 text-xs">Send to supplier</button>}
                  {(d.status === 'at_supplier' || d.status === 'returned') && <button onClick={() => setRcv({ id: d.id, qty: d.qty, to: d.loc })} className="btn-primary min-h-9 text-xs">Receive & add to stock</button>}
                  {d.status === 'reported' && (SU || role === 'manager') && <button onClick={() => up(d.id, { status: 'written_off' }, 'Written off')} className="btn-ghost min-h-9 text-xs">Write off</button>}
                  {d.claimId && <button onClick={() => { setTab('claims'); setLetterOpen(d.claimId!); }} className="btn-ghost min-h-9 text-xs">Open claim {d.claimId}</button>}
                </div>
              )}
            </article>
          ))}
        </Card>
      )}

      {tab === 'report' && (
        <Card title="Report a damaged item" sub="For damage found while storing goods, or items a customer brought back damaged. Damaged stock is taken out of what can be sold.">
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Where was it found?</span><Pills small opts={[['storage', 'Found in storage'], ['customer', 'Returned by a customer'], ['transit', 'Damaged in transit']]} value={rp.src} onChange={(v) => setRp({ ...rp, src: v, err: '' })} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Location</span><Pills small opts={BRS.filter((b) => SU || b.id === myBr).map((b) => [b.id, b.name] as [string, string])} value={rp.loc} onChange={(v) => setRp({ ...rp, loc: v, err: '' })} /></div>
          {/* Scan to pick the product (productscan.md §4.4): a carton code picks the product with the whole carton's count. */}
          <ScanPick P={P.filter((p) => p.status === 'live' && p.track !== 'digital')} onPick={(p, n) => setRp({ ...rp, name: p.name, q: '', qty: n, err: '' })} />
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Product<input value={rp.name || rp.q} onChange={(e) => setRp({ ...rp, q: e.target.value, name: '', err: '' })} placeholder="Search products" className="field py-2.5 font-normal" /></label>
          {!rp.name && <div className="flex gap-1.5 flex-wrap">{hits.map((p) => <button key={p.id} onClick={() => setRp({ ...rp, name: p.name, q: '', qty: 1 })} className="text-xs px-3 py-1.5 rounded-full border border-line">{p.name}</button>)}</div>}
          <div className="flex items-center gap-2 text-sm">Quantity damaged <button aria-label="One less" onClick={() => setRp({ ...rp, qty: Math.max(1, rp.qty - 1) })} className="w-8 h-8 rounded-full border border-line">−</button><b className="w-6 text-center">{rp.qty}</b><button aria-label="One more" onClick={() => setRp({ ...rp, qty: rp.qty + 1 })} className="w-8 h-8 rounded-full border border-line">+</button><span className="text-xs text-muted">{rp.name ? `${stockAt} in stock at ${brName(rp.loc)}` : 'Pick a product'}</span></div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">What happened?<textarea rows={3} value={rp.note} onChange={(e) => setRp({ ...rp, note: e.target.value, err: '' })} placeholder="e.g. Two bags leaking at the seam when the carton was opened · or · roof leak soaked the bottom row" className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
          {rp.note.trim().length > 5 && (
            <div className="p-3 rounded-2xl bg-brand-50 flex flex-col gap-2 text-sm">
              <span>✨ <b>{g ? `Looks like ${g[1].toLowerCase()}` : 'Pick the cause'}</b> · {g ? g[3] : 'The assistant could not tell from the description.'}</span>
              <div className="flex gap-1.5 flex-wrap">{CAUSES.map((c) => <button key={c[1]} aria-pressed={(rp.cause || g?.[1]) === c[1]} onClick={() => setRp({ ...rp, cause: c[1] })} className={cx('text-xs px-3 py-1.5 rounded-full border', (rp.cause || g?.[1]) === c[1] ? 'bg-black text-white border-black' : 'border-line bg-white')}>{c[1]}</button>)}</div>
            </div>
          )}
          {rp.err && <span role="alert" className="text-sm text-danger">{rp.err}</span>}
          <div className="flex gap-2 flex-wrap"><button onClick={() => saveReport(false)} className="btn-ghost">Save damage record</button><button onClick={() => saveReport(true)} className="btn-primary">Save & send to supplier</button></div>
        </Card>
      )}

      {tab === 'claims' && (
        <Card title="Supplier claims">
          {!C.length && <span className="text-sm text-muted">No supplier claims yet. Pick damaged items in Damage records and send them to their supplier.</span>}
          {C.map((c) => {
            const sup = SUPPLIERS.find((s) => s.name === c.supplier);
            const recs = D.filter((d) => c.items.includes(d.id));
            const letter = `Dear ${sup?.contact.split(' · ')[0] ?? 'Sir/Madam'},\n\nWe are returning the items below under your damage terms (${sup?.terms ?? 'as agreed'}). Please ${recs.some((r) => r.cause === 'Manufacturing fault') ? 'repair or replace' : 'replace or credit'} them.\n\n${recs.map((r) => `• ${r.qty} × ${r.name} · ${r.cause} · ${ghs(r.value)}`).join('\n')}\n\nTotal value: ${ghs(recs.reduce((s, r) => s + r.value, 0))}\n\nKind regards,\n${me}\n${COMPANY.name}`;
            return (
              <article key={c.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
                <div className="flex justify-between gap-2 flex-wrap"><span className="text-sm"><b>{c.id} · {c.supplier}</b><br /><span className="text-xs text-muted">{sup?.contact} · {sup?.terms}</span></span><span className={cx('pill', c.status === 'closed' ? 'bg-green-100 text-green-800' : c.status === 'draft' ? 'bg-canvas text-sub' : 'bg-blue-100 text-blue-900')}>{{ draft: 'Draft', sent: 'Sent to supplier', collected: 'Collected by supplier', closed: 'Closed' }[c.status]}</span></div>
                {recs.map((r) => <span key={r.id} className="text-sm">{r.qty} × {r.name} · {brName(r.loc)} · {r.cause} <span className="text-xs text-muted">· {ST[r.status][0]}</span></span>)}
                {letterOpen === c.id && <pre className="print-doc whitespace-pre-wrap text-xs p-3 rounded-xl bg-canvas font-sans">{letter}</pre>}
                {c.log.map((t, i) => <span key={i} className="text-xs text-sub">• {t.t}</span>)}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setLetterOpen(letterOpen === c.id ? '' : c.id)} className="btn-ghost min-h-9 text-xs">{letterOpen === c.id ? 'Hide claim letter' : 'Show claim letter'}</button>
                  {c.status === 'draft' && <button onClick={() => { setC((x) => x.map((y) => (y.id === c.id ? { ...y, status: 'sent', log: [...y.log, { t: `Sent to ${c.supplier} by email · ${now()}` }] } : y))); setMsg(`${c.id} sent to ${c.supplier}`); }} className="btn-dark min-h-9 text-xs">Send claim to supplier</button>}
                  {c.status === 'sent' && <button onClick={() => setC((x) => x.map((y) => (y.id === c.id ? { ...y, status: 'collected', log: [...y.log, { t: `Supplier collected the items · ${now()}` }] } : y)))} className="btn-dark min-h-9 text-xs">Supplier collected the items</button>}
                  {c.status === 'collected' && <button onClick={() => { recs.forEach((r) => toStock(r.name, r.qty, r.loc)); setD((x) => x.map((d) => (c.items.includes(d.id) ? { ...d, status: 'closed', rcv: d.qty, log: [...d.log, { t: `Replacement received into ${brName(d.loc)} · ${now()}` }] } : d))); setC((x) => x.map((y) => (y.id === c.id ? { ...y, status: 'closed', log: [...y.log, { t: `Everything received back and added to stock · ${now()}` }] } : y))); setMsg(`${c.id} closed · items added back to stock`); }} className="btn-primary min-h-9 text-xs">Receive all & add to stock</button>}
                  <button onClick={() => { setLetterOpen(c.id); setTimeout(() => window.print(), 50); }} className="btn-ghost min-h-9 text-xs">Print claim</button>
                </div>
              </article>
            );
          })}
        </Card>
      )}

      {tab === 'suppliers' && (
        <Card title="Suppliers & damage terms">
          <T head={['Supplier', 'Products', 'Contact', 'Damage terms', 'Damaged units', 'Recovered']} rows={SUPPLIERS.map((s) => [<b key="n">{s.name}</b>, P.filter((p) => p.supplier === s.name).map((p) => p.name).join(', ') || '—', s.contact, s.terms, String(D.filter((d) => d.supplier === s.name).reduce((a, d) => a + d.qty, 0)), ghs(D.filter((d) => d.supplier === s.name && d.status === 'closed').reduce((a, d) => a + d.value, 0))])} />
        </Card>
      )}
    </>
  );
}
