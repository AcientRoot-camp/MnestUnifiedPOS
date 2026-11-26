// Scanning for stock (productscan.md §4): receive a transfer, purchase order or supplier delivery by scanning it in,
// a blind stock take (cycle count) counted with a phone camera or a handheld scanner, and a small "scan to pick a
// product" box for Damages and goods-in forms. A single's barcode counts 1, a carton code counts that product's carton
// size (e.g. 40), an extra unit's code its size; GS1-128 carton codes also fill the batch and expiry.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BarcodeCamera from '../../components/BarcodeCamera';
import ScanWaySwitch from '../../components/ScanWaySwitch';
import { useScanWay } from '../../lib/scanDevice';
import { BRS, brName, type BrId, type Product } from '../../data/catalogue';
import { cleanCode, codeIndex, qtyTxt, resolveCode, type Gs1 } from '../../lib/barcode';
import { usePersist } from '../../lib/persist';
import { cx, ghs } from '../../lib/format';

/**
 * Which product (and how many singles) a scanned code stands for, across all products: its barcode = 1, its carton
 * code = its carton size, an extra unit's code = that unit's size, a GS1-128 code = by its GTIN (with batch / expiry).
 */
export function readCode(P: Product[], raw: string): { p: Product; n: number; label: string; gs1?: Gs1 } | null {
  const r = resolveCode(P, codeIndex(P), raw);
  return r ? { p: r.p, n: r.n, label: r.label, gs1: r.gs1 } : null;
}

/**
 * A scan box for stocking screens, set up for the device: on a phone or tablet the camera is the scanner (multi: it
 * opens straight away and keeps reading item after item); on a laptop or desktop the box is ready for a barcode
 * scanner plugged in by USB or paired by Bluetooth (it types the code and presses Enter), with the camera as a backup.
 * Inputs: onCode (each code read), label, compact (small box for forms), multi (keep scanning, for counting stock).
 */
export function ScanBox({ onCode, label, compact = false, multi = false }: { onCode: (raw: string) => void; label: string; compact?: boolean; multi?: boolean }) {
  const [way] = useScanWay();
  const [v, setV] = useState('');
  const [cam, setCam] = useState(way === 'camera' && multi);
  const id = 'ss-' + label.replace(/\W+/g, '-').toLowerCase();
  const box = useRef<HTMLInputElement>(null); // the scan box: a barcode scanner types into it
  return (
    <div className="flex flex-col gap-2">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onCode(v); setV(''); } }}>
        <label className="sr-only" htmlFor={id}>{label}</label>
        <input ref={box} id={id} autoFocus={!compact && way === 'scanner'} value={v} onChange={(e) => setV(e.target.value)} placeholder={way === 'scanner' ? (compact ? 'Scan with the barcode scanner or type' : 'Scan now with the barcode scanner') : 'Or type a barcode'} autoComplete="off" className={cx('flex-1 min-w-0 px-4 rounded-2xl border-2 border-black tracking-[0.08em] outline-none', compact ? 'h-10 text-[15px]' : 'h-12 text-[17px]')} />
        <button type="button" onClick={() => setCam(!cam)} aria-expanded={cam} className={cx('px-4 rounded-full text-white text-sm font-semibold whitespace-nowrap', compact ? 'h-10' : 'h-12')} style={{ background: '#0b5c5c' }}>{cam ? 'Close camera' : way === 'camera' ? '📷 Scan with camera' : 'Camera'}</button>
      </form>
      {cam && <BarcodeCamera continuous={multi} onRead={(raw) => { if (!multi) setCam(false); onCode(raw); }} height={compact ? 170 : 220} caption={multi ? 'Scan item after item · the camera stays on' : 'Hold the barcode inside the frame'} />}
      {/* Camera: opens the camera (counting) after access is allowed. Barcode scanner: camera off, cursor in the scan box. */}
      {!compact && <ScanWaySwitch onChange={(w) => { setCam(w === 'camera' && multi); if (w === 'scanner') window.setTimeout(() => box.current?.focus(), 0); }} />}
    </div>
  );
}

/** Scan result line: green for a counted item, red for a problem (with "Add as new product" for an unknown code). */
export const Note = ({ m }: { m: { ok: boolean; t: string; code?: string } | null }) => !m ? null : (
  <div role="status" className="rounded-2xl bg-white px-4 py-3 text-sm flex items-center gap-3 flex-wrap" style={{ border: `2px solid ${m.ok ? '#1f7a2a' : '#c62828'}` }}>
    <span className="flex-1">{m.t}</span>
    {m.code && <Link to={`/products?barcode=${encodeURIComponent(m.code)}`} className="h-9 px-4 rounded-full bg-black text-white text-[13px] font-semibold inline-flex items-center hover:text-white">Add as new product</Link>}
  </div>
);
/** The message for a code that is not a product: unknown 8–14 digits get "Add as new product". */
const unknownMsg = (raw: string) => { const v = cleanCode(raw); return /^\d{8,14}$/.test(v) ? { ok: false, t: `Barcode ${v} is not in the system yet.`, code: v } : { ok: false, t: `“${v}” is not a product barcode.` }; };

/**
 * "Scan to pick the product" (productscan.md §4.4): a compact scan box for Damages and goods-in forms. A read picks the
 * product (and says how many singles the code stands for, e.g. a carton of 40); unknown codes say so.
 * Inputs: the products that may be picked and onPick(product, singles).
 */
export function ScanPick({ P, onPick, label = 'Scan to pick the product' }: { P: Product[]; onPick: (p: Product, n: number) => void; label?: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string; code?: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold">{label}</span>
      <ScanBox compact label={label} onCode={(raw) => { const r = readCode(P, raw); if (!r) return setMsg(unknownMsg(raw)); setMsg({ ok: true, t: `Scanned · ${r.p.name}${r.n !== 1 ? ` (${r.label})` : ''}` }); onPick(r.p, r.n); }} />
      <Note m={msg} />
    </div>
  );
}

/* ---------------- Receive by scanning: transfers, purchase orders, supplier deliveries ---------------- */

/** What is being received: its number, title, who sent it, the expected lines (in singles) and a short note. */
export type RecvDoc = { id: string; title: string; from: string; lines: { name: string; qty: number }[]; note?: string };
/** Batch number and expiry recorded for a line (typed, or read from a GS1-128 carton code). */
export type BatchIn = { batch: string; expiry: string };

/**
 * Receive (scan): the expected lines, then each item or carton scanned in, with Expected / Scanned / Difference live.
 * Serial-tracked products ask for each unit's serial number; batch-tracked lines take a batch and expiry (filled from
 * GS1-128 carton codes). Post receipt hands the counts, serials and batches back.
 * Inputs: the document, the products, onPost and onClose.
 */
export function ReceiveScan({ doc, P, onPost, onClose }: { doc: RecvDoc; P: Product[]; onPost: (counts: Record<string, number>, serials: Record<string, string[]>, batches: Record<string, BatchIn>) => void; onClose: () => void }) {
  const [got, setGot] = useState<Record<string, number>>({});
  const [sns, setSns] = useState<Record<string, string[]>>({});
  const [bt, setBt] = useState<Record<string, BatchIn>>({});
  const [msg, setMsg] = useState<{ ok: boolean; t: string; code?: string } | null>(null);
  const [snFor, setSnFor] = useState('');
  const [sn, setSn] = useState('');
  const names = [...new Set([...doc.lines.map((l) => l.name), ...Object.keys(got)])];
  const exp = (n: string) => doc.lines.filter((l) => l.name === n).reduce((a, l) => a + l.qty, 0);
  const add = (n: string, k: number) => setGot((g) => ({ ...g, [n]: Math.max(0, (g[n] || 0) + k) }));
  const prod = (n: string) => P.find((p) => p.name === n);
  const scan = (raw: string) => {
    const r = readCode(P, raw);
    if (!r) return setMsg(unknownMsg(raw));
    const n = r.p.name;
    add(n, r.n);
    if (r.gs1?.batch || r.gs1?.expiry) setBt((b) => ({ ...b, [n]: { batch: r.gs1?.batch || b[n]?.batch || '', expiry: r.gs1?.expiry || b[n]?.expiry || '' } }));
    setMsg({ ok: true, t: `Scanned ${r.gs1?.gtin || cleanCode(raw)} · +${r.n} ${n}${r.n !== 1 ? ` (${r.label})` : ''}${r.gs1?.batch ? ` · batch ${r.gs1.batch}` : ''}${r.gs1?.expiry ? ` · expires ${r.gs1.expiry}` : ''}${exp(n) ? '' : ` · not on ${doc.id}`}` });
    if (r.p.track === 'serial') setSnFor(n);
  };
  const short = names.filter((n) => (got[n] || 0) !== exp(n));
  const batchLines = names.filter((n) => prod(n)?.track === 'batch' && (got[n] || 0) > 0);
  return (
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="rs-h" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white rounded-[28px] p-6 flex flex-col gap-4 my-8">
        <div className="flex justify-between items-center gap-2"><div><h2 id="rs-h" className="m-0 text-lg font-semibold">{doc.title}</h2><span className="text-sm text-muted">Scan every item or carton as it comes off the van. A carton barcode counts the whole carton (its own size); GS1 carton codes also fill the batch and expiry.</span></div><button onClick={onClose} className="h-9 px-4 rounded-full text-white text-sm font-semibold flex-none" style={{ background: '#c62828' }}>Close</button></div>
        <ScanBox multi onCode={scan} label="Scan an item or carton" />
        <Note m={msg} />
        {snFor && (
          <form className="rounded-2xl bg-[#f2f4f5] p-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); const v = sn.trim().toUpperCase(); if (!v) return; const all = Object.values(sns).flat(); if (all.includes(v) || (prod(snFor)?.serials || []).includes(v)) { setMsg({ ok: false, t: `Serial ${v} is already recorded. Each unit has its own serial.` }); return; } setSns((x) => ({ ...x, [snFor]: [...(x[snFor] || []), v] })); setSn(''); if ((sns[snFor]?.length || 0) + 1 >= (got[snFor] || 0)) setSnFor(''); }}>
            <b className="text-sm">Scan serial number · {snFor} ({sns[snFor]?.length || 0} of {got[snFor] || 0})</b>
            <div className="flex gap-2"><input autoFocus value={sn} onChange={(e) => setSn(e.target.value)} placeholder="Scan the serial on the unit" className="field py-2 flex-1 uppercase" aria-label="Serial number" /><button type="submit" className="btn-dark min-h-10">Add serial</button></div>
          </form>
        )}
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Product', 'Expected', 'Scanned', 'Difference', ''].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{names.map((n) => { const d = (got[n] || 0) - exp(n); return <tr key={n} className="border-t border-line"><td className="py-2 pr-3 font-medium">{n}{sns[n]?.length ? <span className="block text-xs text-muted">SN {sns[n].join(', ')}</span> : null}{bt[n]?.batch || bt[n]?.expiry ? <span className="block text-xs text-muted">Batch {bt[n].batch || '—'} · expires {bt[n].expiry || '—'}</span> : null}</td><td className="py-2 pr-3">{exp(n)}</td><td className="py-2 pr-3"><b>{got[n] || 0}</b></td><td className={cx('py-2 pr-3 font-semibold', d < 0 ? 'text-danger' : d > 0 ? 'text-[#b26a00]' : 'text-ok')}>{d === 0 ? '✓ 0' : d > 0 ? `+${d}` : d}</td><td className="py-2 whitespace-nowrap"><button aria-label={`One less ${n}`} onClick={() => add(n, -1)} className="w-7 h-7 rounded-full border border-line">−</button> <button aria-label={`One more ${n}`} onClick={() => add(n, 1)} className="w-7 h-7 rounded-full border border-line">+</button></td></tr>; })}</tbody></table></div>
        {batchLines.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl bg-[#f2f4f5] p-3">
            <b className="text-sm">Batch &amp; expiry · one per delivery line (filled automatically from GS1 carton codes)</b>
            {batchLines.map((n) => <div key={n} className="flex gap-2 items-center flex-wrap text-sm"><span className="flex-1 min-w-[140px]">{n}</span><input aria-label={`Batch number for ${n}`} value={bt[n]?.batch || ''} onChange={(e) => setBt({ ...bt, [n]: { batch: e.target.value.trim(), expiry: bt[n]?.expiry || '' } })} placeholder="Batch / lot" className="field py-1.5 w-32" /><input type="date" aria-label={`Expiry date for ${n}`} value={bt[n]?.expiry || ''} onChange={(e) => setBt({ ...bt, [n]: { batch: bt[n]?.batch || '', expiry: e.target.value } })} className="field py-1.5 w-40" /></div>)}
          </div>
        )}
        <span className="text-xs text-muted">{short.length ? `${short.length} line${short.length === 1 ? '' : 's'} differ from ${doc.id}. Posting records a variance note for ${doc.from}.` : `Everything matches ${doc.id}.`}{doc.note ? ` ${doc.note}` : ''}</span>
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="btn-ghost">Cancel</button><button disabled={!Object.values(got).some((n) => n > 0)} onClick={() => onPost(got, sns, bt)} className="btn-primary disabled:opacity-40">Post receipt</button></div>
      </section>
    </div>
  );
}

/* ---------------- Stock in by scanning ---------------- */

/** Where scanned stock can go: a branch or the warehouse. */
export type StockInTo = BrId | 'wh';
/**
 * "Stock in by scanning": add new stock to a branch or the warehouse by scanning each item (a tablet or phone camera,
 * or a barcode scanner on a laptop / desktop). Each scan counts 1 (a carton code counts its carton size); quantities
 * can be corrected with − / + before posting. Inputs: the products, the places this user may stock, onPost(to,
 * counts by product name, reference) and onClose.
 */
export function StockInScan({ P, places, onPost, onClose }: { P: Product[]; places: StockInTo[]; onPost: (to: StockInTo, counts: Record<string, number>, ref: string) => void; onClose: () => void }) {
  const [to, setTo] = useState<StockInTo>(places[0] || 'wh');
  const [got, setGot] = useState<Record<string, number>>({});
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string; code?: string } | null>(null);
  const add = (n: string, k: number) => setGot((g) => { const v = Math.max(0, (g[n] || 0) + k); const x = { ...g, [n]: v }; if (!v) delete x[n]; return x; });
  const now = (n: string) => { const p = P.find((x) => x.name === n); return !p ? 0 : to === 'wh' ? p.wh : p.stock[to]; };
  const scan = (raw: string) => {
    const r = readCode(P, raw);
    if (!r) return setMsg(unknownMsg(raw));
    add(r.p.name, r.n);
    setMsg({ ok: true, t: `Scanned ${cleanCode(raw)} · +${r.n} ${r.p.name}${r.n !== 1 ? ` (${r.label})` : ''} · ${(got[r.p.name] || 0) + r.n} counted` });
  };
  const names = Object.keys(got); const units = names.reduce((a, n) => a + got[n], 0);
  return (
    <div className="fixed inset-0 z-[500] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="si-h" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white rounded-[28px] p-6 flex flex-col gap-4 my-8">
        <div className="flex justify-between items-start gap-2"><div><h2 id="si-h" className="m-0 text-lg font-semibold">Stock in by scanning</h2><span className="text-sm text-muted">Scan each item as you put it away. On a tablet or phone the camera keeps scanning; on a laptop or desktop use the barcode scanner.</span></div><button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Add stock to<select value={to} onChange={(e) => setTo(e.target.value as StockInTo)} className="field py-2.5 font-normal">{places.map((b) => <option key={b} value={b}>{brName(b)}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Reference (optional)<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. supplier invoice NAS-20441" className="field py-2.5 font-normal" /></label>
        </div>
        <ScanBox multi onCode={scan} label="Scan an item to stock in" />
        <Note m={msg} />
        {names.length > 0 ? (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Product', `Now at ${brName(to)}`, 'Adding', 'After', ''].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{names.map((n) => <tr key={n} className="border-t border-line"><td className="py-2 pr-3 font-medium">{n}</td><td className="py-2 pr-3">{now(n)}</td>
              <td className="py-2 pr-3"><span className="inline-flex items-center gap-1.5"><button onClick={() => add(n, -1)} aria-label={`One less ${n}`} className="w-7 h-7 rounded-full border border-line">−</button><b className="w-8 text-center">{got[n]}</b><button onClick={() => add(n, 1)} aria-label={`One more ${n}`} className="w-7 h-7 rounded-full border border-line">+</button></span></td>
              <td className="py-2 pr-3 font-semibold">{now(n) + got[n]}</td><td className="py-2"><button onClick={() => add(n, -got[n])} className="text-xs text-danger font-semibold">Remove</button></td></tr>)}</tbody></table></div>
        ) : <span className="text-sm text-muted">Nothing scanned yet.</span>}
        <div className="flex gap-2 justify-end items-center flex-wrap"><span className="text-sm text-muted mr-auto">{units ? `${units} unit${units === 1 ? '' : 's'} of ${names.length} product${names.length === 1 ? '' : 's'}` : ''}</span><button onClick={onClose} className="btn-ghost">Cancel</button><button disabled={!units} onClick={() => onPost(to, got, ref.trim())} className="btn-primary disabled:opacity-40">Add to stock</button></div>
      </section>
    </div>
  );
}

/* ---------------- Stock take (blind cycle count) ---------------- */

type Count = { id: string; br: BrId; cat: string; by: string; started: string; counts: Record<string, number> };
/** A posted stock take. held: products whose large variance is waiting in Approvals (not yet applied). */
export type CountReport = { id: string; br: BrId; cat: string; by: string; at: string; lines: { name: string; expected: number; counted: number; diff: number; value: number }[]; held?: string[] };

/**
 * Stock take: choose a branch and an aisle (category), then scan each item on the shelf (a carton counts its size) or type a
 * quantity for bulk. Expected quantities are hidden while counting (blind count) and shown on review. Posting corrects
 * the stock with reason "Count correction" and saves the variance report. The count in progress is kept on the device.
 * Inputs: products, on-hand stock per product and branch, who is counting, which branches they may count, onPost.
 */
export function StockTake({ P, onHand, me, branches, onPost }: { P: Product[]; onHand: (p: Product, br: BrId) => number; me: string; branches: BrId[]; onPost: (r: CountReport) => void }) {
  const [draft, setDraft] = usePersist<Count | null>('ecompos.countDraft', null);
  const [reports] = usePersist<CountReport[]>('ecompos.countReports', []);
  const cats = [...new Set(P.map((p) => p.cat))];
  const [br, setBr] = useState<BrId>(branches[0] || 'osu');
  const [cat, setCat] = useState(cats[0] || '');
  const [review, setReview] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string; code?: string } | null>(null);

  if (!draft) return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Branch<select value={br} onChange={(e) => setBr(e.target.value as BrId)} className="px-4 py-2.5 rounded-full border border-line font-normal">{BRS.filter((b) => branches.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Aisle / category<select value={cat} onChange={(e) => setCat(e.target.value)} className="px-4 py-2.5 rounded-full border border-line font-normal">{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button onClick={() => { setDraft({ id: 'SC-' + Date.now().toString().slice(-5), br, cat, by: me, started: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), counts: {} }); setReview(false); setMsg(null); }} className="btn-primary">Start count</button>
      </div>
      <span className="text-sm text-muted">Counted on a phone or with a handheld scanner. The expected numbers stay hidden until you review, so the count is honest.</span>
      {reports.length > 0 && <div className="flex flex-col gap-1.5"><b className="text-sm">Posted counts</b>{reports.slice(0, 5).map((r) => { const v = r.lines.reduce((a, l) => a + l.value, 0); return <span key={r.id} className="text-sm">{r.id} · {brName(r.br)} · {r.cat} · {r.lines.length} products · variance {v < 0 ? '−' : ''}{ghs(Math.abs(v))} · {r.by} · {r.at}</span>; })}</div>}
    </div>
  );

  const items = P.filter((p) => p.cat === draft.cat && p.status === 'live' && p.track !== 'digital');
  const done = items.filter((p) => draft.counts[p.id] !== undefined).length;
  const setN = (id: string, n: number) => setDraft({ ...draft, counts: { ...draft.counts, [id]: Math.max(0, n) } });
  const scan = (raw: string) => {
    const r = readCode(P, raw);
    if (!r) return setMsg(unknownMsg(raw));
    setN(r.p.id, (draft.counts[r.p.id] || 0) + r.n);
    setMsg({ ok: true, t: `Scanned · +${qtyTxt(r.p, r.n)} ${r.p.name}${r.n !== 1 ? ` (${r.label})` : ''} (${qtyTxt(r.p, (draft.counts[r.p.id] || 0) + r.n)} counted)${r.p.cat !== draft.cat ? ` · note: it belongs to ${r.p.cat}` : ''}` });
  };
  const lines = items.filter((p) => draft.counts[p.id] !== undefined).map((p) => { const expected = onHand(p, draft.br); const counted = draft.counts[p.id]; const diff = counted - expected; return { p, name: p.name, expected, counted, diff, value: Math.round(diff * p.cost * 100) / 100 }; });
  const varValue = lines.reduce((a, l) => a + l.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-2 flex-wrap"><div><b>Cycle count · {brName(draft.br)} · {draft.cat}</b><br /><span className="text-sm text-muted">Counted by {draft.by} · started {draft.started}</span></div>
        <button onClick={() => { if (window.confirm('Cancel this count? What was counted is lost.')) setDraft(null); }} className="btn-ghost min-h-9 text-xs">Cancel count</button></div>
      <div className="flex items-center gap-3"><div className="flex-1 h-2 rounded-full bg-canvas overflow-hidden"><div className="h-full bg-brand" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div><span className="text-sm">{done} of {items.length} products counted</span></div>
      {!review ? (
        <>
          <ScanBox multi onCode={scan} label="Scan an item on the shelf" />
          <Note m={msg} />
          <div className="flex flex-col gap-1.5">{items.map((p) => <div key={p.id} className="flex items-center gap-2 text-sm p-2 rounded-xl border border-line"><span className="flex-1">{p.name}</span><label className="sr-only" htmlFor={`ct-${p.id}`}>Counted {p.name}</label><input id={`ct-${p.id}`} inputMode="numeric" value={draft.counts[p.id] ?? ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v === '') { const c = { ...draft.counts }; delete c[p.id]; setDraft({ ...draft, counts: c }); } else setN(p.id, parseInt(v, 10)); }} placeholder="Count" className="w-24 px-3 py-1.5 rounded-lg border border-line text-right" /></div>)}</div>
          <button disabled={!done} onClick={() => setReview(true)} className="btn-primary w-fit disabled:opacity-40">Review count</button>
        </>
      ) : (
        <>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Product', 'Expected', 'Counted', 'Variance'].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{items.map((p) => { const l = lines.find((x) => x.p.id === p.id); return <tr key={p.id} className="border-t border-line"><td className="py-2 pr-3">{p.name}</td><td className="py-2 pr-3">{onHand(p, draft.br)}</td><td className="py-2 pr-3">{l ? l.counted : <span className="text-muted">Not counted</span>}</td><td className={cx('py-2 pr-3 font-semibold', l && l.diff < 0 ? 'text-danger' : l && l.diff > 0 ? 'text-[#b26a00]' : '')}>{!l ? '—' : l.diff === 0 ? '0' : `${l.diff > 0 ? '+' : '−'}${Math.abs(l.diff)} · ${ghs(Math.abs(l.value))}`}</td></tr>; })}</tbody></table></div>
          <span className="text-sm">Total variance {varValue < 0 ? '−' : ''}{ghs(Math.abs(varValue))} at cost{lines.length < items.length ? ` · ${items.length - lines.length} not counted (left as they are)` : ''}.</span>
          <div className="flex gap-2"><button onClick={() => setReview(false)} className="btn-ghost">Back to counting</button><button onClick={() => { onPost({ id: draft.id, br: draft.br, cat: draft.cat, by: draft.by, at: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), lines: lines.map(({ name, expected, counted, diff, value }) => ({ name, expected, counted, diff, value })) }); setDraft(null); setReview(false); }} className="btn-primary">Post count</button></div>
        </>
      )}
    </div>
  );
}
