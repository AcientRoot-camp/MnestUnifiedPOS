// My account → Payments and Purchase history (online store). Both are read from the shopper's own orders
// (ecompos.shopOrders), so they always match the Orders tab, the receipts and the invoices:
//  - Payments: every payment with its method, reference, amount and status (Paid, Pending, Refunded, Refund requested,
//    Cancelled), totals at the top, filters, search, receipt / invoice PDF downloads and a CSV export.
//  - Purchase history: every product the shopper has bought, by product (times bought, units, spend, last bought)
//    or as a month-by-month timeline, with Buy again.
import { useMemo, useState } from 'react';
import { cx } from '../../lib/format';
import { useShop } from './ctx';
import { downloadShopDoc } from './docs';
import { isOos, money, type ShopOrder } from './model';

const chip = (on: boolean) => cx('h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors', on ? 'bg-black text-white' : 'bg-canvas hover:bg-[#ececec]');
const field = 'h-10 px-3.5 rounded-full border border-[#d9d9d9] bg-white text-sm focus:border-black focus-visible:outline-none';
/** "21 Nov 2026" from an order's timestamp. */
const day = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** The date printed on the order ("21 Nov 2026" from "21 Nov 2026, 09:40"), else from its timestamp. */
const dateOf = (o: ShopOrder) => o.at?.split(',')[0]?.trim() || day(o.ts);
/** "November 2026" from an order's timestamp (timeline groups). */
const month = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/* ---------- payments ---------- */

export type PayStatus = 'Paid' | 'Pending' | 'Refunded' | 'Refund requested' | 'Cancelled';
export type PayRow = { o: ShopOrder; method: string; ref: string; status: PayStatus; note: string };

/**
 * One payment line per order. Paid and cancelled → Refunded (refunds go back the way the shopper paid); not paid and
 * cancelled → Cancelled (no money moved); a return request on a paid order → Refund requested; not paid yet →
 * Pending, with how it will be paid (to the rider, at the counter, hire purchase deposit).
 */
export function payRowOf(o: ShopOrder): PayRow {
  // The method is the payment line without the "· paid, ref …" tail (the reference has its own column).
  const method = o.pay.split(' · paid')[0];
  const status: PayStatus = o.status === 'Cancelled' ? (o.paid ? 'Refunded' : 'Cancelled') : o.paid ? (o.returnReq ? 'Refund requested' : 'Paid') : 'Pending';
  const note = status === 'Pending' ? (o.payKey === 'cod' ? 'Pay the rider on delivery' : o.payKey === 'counter' ? 'Pay when you collect' : o.payKey === 'hp' ? 'Deposit due in store' : o.payKey === 'bank' ? 'Waiting for your transfer' : 'Awaiting confirmation')
    : status === 'Refunded' ? 'Back to the way you paid' : status === 'Refund requested' ? o.returnReq || '' : status === 'Cancelled' ? 'Order cancelled before payment' : 'Payment confirmed';
  return { o, method, ref: o.payRef || '—', status, note };
}
const TONE: Record<PayStatus, string> = { Paid: 'bg-green-100 text-green-800', Pending: 'bg-amber-100 text-amber-900', Refunded: 'bg-sky-100 text-sky-900', 'Refund requested': 'bg-violet-100 text-violet-900', Cancelled: 'bg-[#eee] text-[#555]' };

/** Save the payments as a CSV file (opens in Excel or Google Sheets). */
function exportCsv(rows: PayRow[]) {
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [['Date', 'Order', 'Method', 'Reference', 'Amount (GHS)', 'Status'].map(q).join(','), ...rows.map((r) => [dateOf(r.o), r.o.no, r.method, r.ref, r.o.total.toFixed(2), r.status].map(q).join(','))].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })); a.download = 'payment-history.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/** Payments tab. Input: the shopper's orders. */
export function PaymentsTab({ my }: { my: ShopOrder[] }) {
  const { W, go } = useShop();
  const [f, setF] = useState<'all' | 'paid' | 'pending' | 'refunds'>('all');
  const [q, setQ] = useState('');
  const all = useMemo(() => [...my].sort((a, b) => b.ts - a.ts).map(payRowOf), [my]);
  const sum = (s: PayStatus[]) => all.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.o.total, 0);
  const rows = all.filter((r) => (f === 'all' || (f === 'paid' && r.status === 'Paid') || (f === 'pending' && r.status === 'Pending') || (f === 'refunds' && (r.status === 'Refunded' || r.status === 'Refund requested')))
    && (!q.trim() || `${r.o.no} ${r.ref} ${r.method}`.toLowerCase().includes(q.trim().toLowerCase())));
  if (!all.length) return <div className="rounded-3xl bg-canvas p-6 flex items-center justify-between gap-3 flex-wrap"><span className="text-sm">No payments yet. They appear here as soon as you place an order.</span><button onClick={() => go('')} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Start shopping</button></div>;
  return (
    <section aria-label="Payment history" className="flex flex-col gap-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([['Total paid', money(sum(['Paid', 'Refund requested'])), `${all.filter((r) => r.status === 'Paid' || r.status === 'Refund requested').length} payments`], ['Awaiting payment', money(sum(['Pending'])), `${all.filter((r) => r.status === 'Pending').length} orders`], ['Refunded', money(sum(['Refunded'])), `${all.filter((r) => r.status === 'Refunded').length} refunds`], ['Last payment', all.find((r) => r.o.paid) ? dateOf(all.find((r) => r.o.paid)!.o) : '—', all.find((r) => r.o.paid)?.method.split(' · ')[0] || 'None yet']] as [string, string, string][]).map(([l, v, s]) => (
          <div key={l} className="rounded-3xl bg-canvas p-4 flex flex-col gap-0.5"><span className="text-xs text-muted">{l}</span><strong className="text-lg tracking-tight">{v}</strong><span className="text-xs text-muted">{s}</span></div>
        ))}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <div role="group" aria-label="Show" className="flex gap-1.5 overflow-x-auto">{([['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['refunds', 'Refunds']] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)} className={chip(f === k)}>{l}</button>)}</div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order or reference" aria-label="Search payments" className={cx(field, 'flex-1 min-w-[180px]')} />
        <button onClick={() => exportCsv(rows)} className="h-10 px-4 rounded-full border border-line text-xs font-semibold hover:border-black">⬇ Export CSV</button>
      </div>
      {!rows.length && <p className="m-0 text-sm text-muted">No payments match.</p>}
      {/* Tablet and desktop: a table. */}
      {rows.length > 0 && <div className="hidden md:block rounded-3xl border border-line overflow-hidden"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted bg-canvas">{['Date', 'Order', 'Method', 'Reference', 'Amount', 'Status', ''].map((h) => <th key={h} scope="col" className={cx('py-2.5 px-4 font-semibold', h === 'Amount' && 'text-right')}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.o.no} className="border-t border-line align-top">
          <td className="py-3 px-4 whitespace-nowrap">{dateOf(r.o)}</td>
          <td className="py-3 px-4 font-semibold whitespace-nowrap">#{r.o.no}</td>
          <td className="py-3 px-4"><span className="block">{r.method}</span><span className="text-xs text-muted">{r.note}</span></td>
          <td className="py-3 px-4 font-mono text-xs">{r.ref}</td>
          <td className={cx('py-3 px-4 text-right font-semibold whitespace-nowrap', r.status === 'Refunded' && 'text-sky-800')}>{r.status === 'Refunded' ? '+ ' : ''}{money(r.o.total)}</td>
          <td className="py-3 px-4"><span className={cx('text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap', TONE[r.status])}>{r.status}</span></td>
          <td className="py-3 px-4 whitespace-nowrap text-right"><span className="inline-flex gap-1.5">{r.o.paid && <button onClick={() => void downloadShopDoc(r.o, W, 'receipt')} className="h-8 px-3 rounded-full border border-line text-xs font-semibold hover:border-black">Receipt</button>}<button onClick={() => void downloadShopDoc(r.o, W, 'invoice')} className="h-8 px-3 rounded-full border border-line text-xs font-semibold hover:border-black">Invoice</button></span></td>
        </tr>)}</tbody>
      </table></div>}
      {/* Phones: one card per payment. */}
      <div className="md:hidden flex flex-col gap-2.5">{rows.map((r) => (
        <article key={r.o.no} className="rounded-3xl border border-line p-4 flex flex-col gap-2">
          <div className="flex justify-between gap-3"><span className="flex flex-col"><strong className="text-sm">#{r.o.no}</strong><span className="text-xs text-muted">{dateOf(r.o)}</span></span><span className="flex flex-col items-end gap-1"><strong>{r.status === 'Refunded' ? '+ ' : ''}{money(r.o.total)}</strong><span className={cx('text-[11px] font-bold px-2 py-0.5 rounded-full', TONE[r.status])}>{r.status}</span></span></div>
          <span className="text-sm">{r.method}</span><span className="text-xs text-muted">{r.note}{r.ref !== '—' ? ` · ref ${r.ref}` : ''}</span>
          <div className="flex gap-2">{r.o.paid && <button onClick={() => void downloadShopDoc(r.o, W, 'receipt')} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">⬇ Receipt</button>}<button onClick={() => void downloadShopDoc(r.o, W, 'invoice')} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">⬇ Invoice</button></div>
        </article>
      ))}</div>
    </section>
  );
}

/* ---------- purchase history ---------- */

/** One product the shopper has bought, added up across their orders. */
export type Bought = { pid: string; name: string; sku: string; times: number; units: number; spent: number; last: number; lastAt: string; lastNo: string; unit: string };
/**
 * Add up every line of the shopper's orders by product (cancelled orders left out, since nothing was bought).
 * Output: one entry per product with how many orders it was in, units, money spent and when it was last bought.
 */
export function boughtOf(my: ShopOrder[]): Bought[] {
  const M: Record<string, Bought> = {};
  my.filter((o) => o.status !== 'Cancelled').forEach((o) => {
    const seen = new Set<string>();
    o.lines.forEach((l) => {
      const k = l.pid || l.sku || l.name;
      const b = M[k] || (M[k] = { pid: l.pid, name: l.name, sku: l.sku, times: 0, units: 0, spent: 0, last: 0, lastAt: '', lastNo: '', unit: l.unit });
      if (!seen.has(k)) { b.times += 1; seen.add(k); }
      b.units += l.qty; b.spent += l.qty * l.each;
      if (o.ts > b.last) { b.last = o.ts; b.lastAt = dateOf(o); b.lastNo = o.no; b.unit = l.unit; }
    });
  });
  return Object.values(M);
}

/** Purchase history tab. Input: the shopper's orders. */
export function PurchasesTab({ my }: { my: ShopOrder[] }) {
  const { byId, add, open, setAdded, go, setMd } = useShop();
  const [view, setView] = useState<'products' | 'timeline'>('products');
  const [sort, setSort] = useState<'recent' | 'most' | 'spend'>('recent');
  const [q, setQ] = useState('');
  const items = useMemo(() => boughtOf(my), [my]);
  const kept = useMemo(() => [...my].filter((o) => o.status !== 'Cancelled').sort((a, b) => b.ts - a.ts), [my]);
  const hit = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const list = items.filter((b) => hit(`${b.name} ${b.sku}`)).sort((a, b) => (sort === 'most' ? b.units - a.units : sort === 'spend' ? b.spent - a.spent : b.last - a.last));
  // Favourite category: the one the shopper spent most on (from the live catalogue; unknown products count as "Other").
  const byCat: Record<string, number> = {}; items.forEach((b) => { const c = byId[b.pid]?.cat || 'Other'; byCat[c] = (byCat[c] || 0) + b.spent; });
  const fav = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  /** Put one product back in the basket (single or carton, as last bought), with the "added to cart" pop-up. */
  const again = (b: Bought) => add(b.pid, b.unit === 'Single' ? 's' : 'c', 1);
  if (!items.length) return <div className="rounded-3xl bg-canvas p-6 flex items-center justify-between gap-3 flex-wrap"><span className="text-sm">Nothing bought yet. Products you buy will be listed here so you can order them again in one tap.</span><button onClick={() => go('')} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Start shopping</button></div>;
  const groups: [string, ShopOrder[]][] = []; kept.forEach((o) => { const m = month(o.ts); const g = groups.find((x) => x[0] === m); if (g) g[1].push(o); else groups.push([m, [o]]); });
  return (
    <section aria-label="Purchase history" className="flex flex-col gap-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([['Total spent', money(items.reduce((a, b) => a + b.spent, 0)), `${kept.length} order${kept.length === 1 ? '' : 's'}`], ['Items bought', items.reduce((a, b) => a + b.units, 0).toLocaleString('en-GB'), `${items.length} different products`], ['Most bought', [...items].sort((a, b) => b.units - a.units)[0]?.name || '—', `${[...items].sort((a, b) => b.units - a.units)[0]?.units || 0} units`], ['Favourite aisle', fav, byCat[fav] ? money(byCat[fav]) : '']] as [string, string, string][]).map(([l, v, s]) => (
          <div key={l} className="rounded-3xl bg-canvas p-4 flex flex-col gap-0.5 min-w-0"><span className="text-xs text-muted">{l}</span><strong className="text-lg tracking-tight truncate" title={v}>{v}</strong><span className="text-xs text-muted">{s}</span></div>
        ))}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <div role="tablist" aria-label="View" className="flex gap-1 p-1 rounded-full bg-canvas">{([['products', 'By product'], ['timeline', 'Timeline']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cx('h-8 px-3.5 rounded-full text-xs font-semibold', view === k ? 'bg-black text-white' : 'hover:bg-white')}>{l}</button>)}</div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search purchases" className={cx(field, 'flex-1 min-w-[160px]')} />
        {view === 'products' && <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={cx(field, 'pr-8')}><option value="recent">Most recent</option><option value="most">Most bought</option><option value="spend">Highest spend</option></select>}
      </div>
      {view === 'products' && (
        <div className="flex flex-col gap-2.5">
          {!list.length && <p className="m-0 text-sm text-muted">No products match.</p>}
          {list.map((b) => { const p = byId[b.pid]; const can = !!p && !isOos(p); return (
            <article key={b.pid + b.sku} className="rounded-3xl border border-line p-3.5 flex items-center gap-3.5 flex-wrap sm:flex-nowrap">
              <button onClick={() => p && open(p.id)} disabled={!p} aria-label={`View ${b.name}`} className="w-16 h-16 rounded-2xl flex-none overflow-hidden bg-white border border-line">{p?.img ? <img src={p.img} alt="" className="w-full h-full object-contain p-1.5" /> : <span className="block w-full h-full" style={{ background: p?.tone || '#eee' }} />}</button>
              <div className="flex-1 min-w-[160px] flex flex-col gap-0.5"><strong className="text-sm">{b.name}</strong>
                <span className="text-xs text-muted">Bought {b.times} time{b.times === 1 ? '' : 's'} · {b.units} unit{b.units === 1 ? '' : 's'}{b.unit !== 'Single' ? ` (${b.unit})` : ''}</span>
                <span className="text-xs text-muted">Last bought {b.lastAt} · <button onClick={() => setMd({ k: 'track', no: b.lastNo })} className="underline">order #{b.lastNo}</button></span></div>
              <div className="flex flex-col items-end gap-1.5 ml-auto"><strong className="text-sm">{money(b.spent)}</strong>
                {can ? <button onClick={() => again(b)} className="h-9 px-3.5 rounded-full bg-black text-white text-xs font-semibold">Buy again{p && ` · ${money(b.unit !== 'Single' && p.ct ? p.ct.price : p.price)}`}</button> : <span className="text-xs text-muted">{p ? 'Out of stock right now' : 'No longer sold online'}</span>}</div>
            </article>
          ); })}
        </div>
      )}
      {view === 'timeline' && (
        <ol className="m-0 p-0 list-none flex flex-col gap-5">
          {groups.map(([m, os]) => { const rows = os.map((o) => ({ o, ls: o.lines.filter((l) => hit(`${l.name} ${l.sku}`)) })).filter((x) => x.ls.length); if (!rows.length) return null; return (
            <li key={m} className="flex flex-col gap-2.5"><h3 className="m-0 text-xs font-bold tracking-[0.12em] uppercase text-muted">{m}</h3>
              {rows.map(({ o, ls }) => (
                <article key={o.no} className="rounded-3xl border border-line p-4 flex flex-col gap-2.5">
                  <div className="flex justify-between gap-3 flex-wrap"><span className="flex flex-col"><strong className="text-sm">{dateOf(o)} · order #{o.no}</strong><span className="text-xs text-muted">{o.fulfil === 'D' ? 'Delivered' : o.fulfil === 'P' ? 'Click & collect' : 'Bought in store'} · {o.where}</span></span><strong className="text-sm">{money(o.total)}</strong></div>
                  <ul className="m-0 p-0 list-none flex flex-col divide-y divide-line">{ls.map((l, i) => <li key={i} className="py-1.5 flex justify-between gap-3 text-sm"><span>{l.qty} × {l.name}{l.unit !== 'Single' ? ` (${l.unit})` : ''}</span><span className="text-muted whitespace-nowrap">{money(l.qty * l.each)}</span></li>)}</ul>
                  <div className="flex gap-2 flex-wrap"><button onClick={() => { o.lines.forEach((l) => byId[l.pid] && add(l.pid, l.unit === 'Single' ? 's' : 'c', l.qty, true)); setAdded({ name: `Items from order ${o.no}`, sub: `${o.lines.length} line${o.lines.length === 1 ? '' : 's'}` }); }} className="h-9 px-3 rounded-full bg-black text-white text-xs font-semibold">Buy all again</button><button onClick={() => setMd({ k: 'track', no: o.no })} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">View order</button></div>
                </article>
              ))}
            </li>
          ); })}
        </ol>
      )}
    </section>
  );
}
