import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Toast } from '../../components/ui';
import { CAT, RIDERS, STAGES, WEB_ORDERS, type WebOrder } from '../../data/sell';
import { PEOPLE } from '../../data/nav';
import { usePersist, nowTxt } from '../../lib/persist';
import { returnSaleStock } from '../../lib/stock';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import CompanyLogo from '../../components/CompanyLogo';

const BRN: Record<string, string> = { osu: 'Osu', legon: 'East Legon', adum: 'Adum' };
const FUL = { D: 'Delivery', P: 'Click & collect', I: 'Hire purchase pickup' };
const total = (o: WebOrder) => o.items.reduce((a, i) => a + i[0] * i[2], 0) + o.fee;

export default function Orders() {
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  const me = PEOPLE[role].name;
  const view = role === 'superuser' ? viewBranch : session?.branch ?? 'osu';
  const [L, setL] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [refunded, setRefunded] = usePersist<Record<string, boolean>>('ecompos.ordRefunded2', {});
  const [dismissed, setDismissed] = usePersist<Record<string, boolean>>('ecompos.cancelDismissed', {});
  const [ch, setCh] = useState('All');
  const [qs] = useSearchParams();
  const [sel, setSel] = useState(qs.get('open') || '');
  const [manual, setManual] = useState(false);
  const [mf, setMf] = useState({ phone: '', by: 'Phone call', q: '', items: [] as [number, string, number][] });
  const [pick, setPick] = useState('');
  const [rcv, setRcv] = useState('');
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'' | 'refund' | 'edit' | 'slip'>('');

  const mine = L.filter((o) => view === 'all' || o.brId === view);
  // Channels as in sell.md: Website · POS (till) · Phone (calls and WhatsApp).
  const chOf = (o: WebOrder) => (o.ch === 'Till' ? 'POS' : o.ch === 'WhatsApp' ? 'Phone' : o.ch);
  const shown = mine.filter((o) => (ch === 'Cancelled' ? o.status === 'Cancelled' : ch === 'All' || chOf(o) === ch));
  const [notified, setNotified] = useState<Record<string, boolean>>({});
  const o = L.find((x) => x.id === sel);
  const up = (id: string, p: Partial<WebOrder>) => setL((x) => x.map((y) => (y.id === id ? { ...y, ...p } : y)));
  const cancelled = mine.filter((x) => x.status === 'Cancelled');
  const rfOpen = cancelled.filter((x) => /paid/i.test(x.pay) && !refunded[x.id]);
  const riders = o ? RIDERS.filter((r) => r.br === o.brId) : [];
  const maxStage = o?.type === 'D' ? 5 : 4;
  const stageNames = o?.type === 'D' ? STAGES : (['Being confirmed', 'Preparing order', 'Packing', 'Ready to collect', 'Collected'] as const);

  const advance = () => {
    if (!o) return;
    setErr('');
    if (o.type === 'D' && o.stage === 2 && !o.rider) return setErr('Assign a rider before the order leaves the branch.');
    if (o.stage === maxStage - 1 && o.type === 'D' && !rcv.trim()) return setErr('Type the name of the person who received it.');
    const next = Math.min(maxStage, o.stage + 1);
    up(o.id, { stage: next, status: next === maxStage ? 'Delivered' : 'Active', received: next === maxStage ? rcv || o.who : o.received, track: [...o.track, { label: stageNames[next], at: nowTxt(), by: me }] });
    setRcv('');
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Orders</h1><p className="m-0 text-sm text-muted">Website, till and phone orders in one list · {view === 'all' ? 'all branches' : BRN[view] + ' branch'}</p></div>
        <div className="flex gap-2"><Link to="/rider" className="btn-ghost">Open rider app</Link><button onClick={() => setManual(!manual)} className="btn-primary">New manual order</button></div>
      </header>

      {rfOpen.length > 0 && (
        <Card title="Refunds for cancelled online orders" sub={`${rfOpen.length} to complete`}>
          {rfOpen.map((f) => <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl bg-red-50 flex-wrap text-sm"><span className="flex-1 min-w-[220px]"><b>{f.id} · {f.who} · {ghs(total(f))}</b><br /><span className="text-xs text-muted">Refund to {f.pay.split(' · ')[0]} · {f.phone} · {f.placed} · {f.cancelReason}</span></span><span className="pill bg-amber-100 text-amber-900">Refund initiated</span><button onClick={() => { setRefunded((r) => ({ ...r, [f.id]: true })); setToast(`${f.id} marked refunded · customer told by SMS`); }} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white">Mark refunded</button></div>)}
        </Card>
      )}

      {manual && (
        <Card title="New manual order" sub="For phone calls and walk-ins · the customer gets a payment link by SMS">
          <div className="flex gap-3 flex-wrap">
            <label className="flex flex-col gap-1 text-[13px] font-semibold">Customer phone<span className="flex items-center gap-2"><span className="text-sm text-muted">+233</span><input maxLength={12} value={mf.phone} onChange={(e) => setMf({ ...mf, phone: e.target.value.replace(/[^\d ]/g, '') })} placeholder="24 555 0142" className="field py-2.5 font-normal w-48" /></span><span className={cx('text-xs font-normal', mf.phone && mf.phone.replace(/\D/g, '').length !== 9 ? 'text-danger' : 'text-muted')}>{mf.phone && mf.phone.replace(/\D/g, '').length !== 9 ? 'Enter 9 digits after +233' : '9 digits after +233, without the first 0'}</span></label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">Came in by<select value={mf.by} onChange={(e) => setMf({ ...mf, by: e.target.value })} className="px-4 py-2.5 rounded-full border border-line font-normal"><option>Phone call</option><option>Walk-in</option></select></label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold flex-1 min-w-[220px]">Items<input value={mf.q} onChange={(e) => setMf({ ...mf, q: e.target.value })} placeholder="Search products to add" className="field py-2.5 font-normal" /></label>
          </div>
          {mf.q.trim() && CAT.filter((c) => c[0].toLowerCase().includes(mf.q.toLowerCase())).slice(0, 5).map((c) => <button key={c[0]} onClick={() => setMf({ ...mf, q: '', items: mf.items.some((i) => i[1] === c[0]) ? mf.items.map((i) => (i[1] === c[0] ? [i[0] + 1, i[1], i[2]] : i)) : [...mf.items, [1, c[0], c[1]]] })} className="flex justify-between text-sm px-3 py-2 rounded-xl hover:bg-canvas"><span>{c[0]}</span><span>{ghs(c[1])} · Add</span></button>)}
          {mf.items.map((i) => <div key={i[1]} className="flex justify-between text-sm"><span>{i[0]} × {i[1]}</span><b>{ghs(i[0] * i[2])}</b></div>)}
          <button onClick={() => { if (mf.phone.replace(/\D/g, '').length !== 9) return setToast('Enter a valid phone number.'); if (!mf.items.length) return setToast('Add at least one item.'); const id = 'W-' + (2312 + L.length); setL((x) => [{ id, ch: 'Phone', who: 'Phone customer', phone: '+233 ' + mf.phone, items: mf.items, fee: 0, pay: 'Payment link sent', type: 'D', brId: view === 'all' ? 'osu' : view, where: 'To be confirmed', placed: nowTxt(), stage: 0, status: 'Active', track: [{ label: 'Being confirmed', at: nowTxt(), by: me }], trackId: Math.random().toString(36).slice(2, 8).toUpperCase() }, ...x]); setManual(false); setMf({ phone: '', by: 'Phone call', q: '', items: [] }); setSel(id); setToast(`${id} created · payment link sent by SMS`); }} className="btn-primary w-fit">Create and send payment link</button>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap"><span className="text-[13px] font-semibold">Channel</span><Pills opts={[...['All', 'Website', 'POS', 'Phone'].map((c) => [c, `${c} (${c === 'All' ? mine.length : mine.filter((o) => chOf(o) === c).length})`] as [string, string]), ['Cancelled', `Cancelled orders (${mine.filter((o) => o.status === 'Cancelled').length})`]]} value={ch} onChange={setCh} /></div>
      {cancelled.filter((c) => !dismissed[c.id]).map((c) => <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-warn-bg border border-warn text-sm flex-wrap"><b>!</b><span className="flex-1">{c.id} cancelled by {c.track[c.track.length - 1]?.by} · {c.track[c.track.length - 1]?.at} · {BRN[c.brId]} branch{/paid/i.test(c.pay) ? ' · refund started' : ''}</span><button onClick={() => setSel(c.id)} className="text-xs font-semibold underline">View order</button><button onClick={() => setDismissed((d) => ({ ...d, [c.id]: true }))} className="text-xs font-semibold underline">Dismiss</button></div>)}

      <div className={cx('grid gap-6 items-start', o && 'xl:grid-cols-[1fr_460px]')}>
        <section className="card p-4 flex flex-col gap-2">
          {shown.map((x) => (
            <button key={x.id} onClick={() => { setSel(x.id); setErr(''); setPick(''); }} aria-pressed={sel === x.id} className={cx('grid grid-cols-[90px_1fr_auto] sm:grid-cols-[90px_70px_90px_1fr_auto_auto] gap-3 items-center p-3 rounded-2xl text-left text-sm', sel === x.id ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}>
              <b>{x.id}</b><span className="hidden sm:block text-xs text-muted">{x.placed.split(' ').slice(-1)}</span><span className="hidden sm:block text-xs">{x.ch}</span>
              <span className="min-w-0"><span className="block truncate">{x.who}</span><span className="text-xs text-muted">{FUL[x.type]} · {BRN[x.brId]}</span></span>
              <span className={cx('pill', x.status === 'Cancelled' ? 'bg-red-100 text-red-800' : x.status === 'Delivered' ? 'bg-green-100 text-green-800' : x.stage === 0 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900')}>{x.status === 'Active' ? (x.type === 'D' ? STAGES[x.stage] : ['Being confirmed', 'Preparing order', 'Packing', 'Ready to collect', 'Collected'][x.stage]) : x.status}</span>
              <b className="text-right">{ghs(total(x))}</b>
            </button>
          ))}
          {!shown.length && <span className="text-sm text-muted p-2">No orders from this channel today.</span>}
        </section>

        {o && (
          <section className="card p-5 sm:p-6 flex flex-col gap-3 xl:sticky xl:top-6">
            <div className="flex justify-between gap-2"><h2 className="m-0 text-[22px] font-semibold">{o.id}</h2><button onClick={() => setSel('')} className="text-sm">Close ×</button></div>
            <div className="flex gap-2 flex-wrap text-xs"><span className="pill bg-canvas">{o.ch}</span><span className={cx('pill', o.status === 'Cancelled' ? 'bg-red-100 text-red-800' : o.status === 'Delivered' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{o.status}</span></div>
            <div className="flex justify-between items-center text-sm gap-2 flex-wrap"><span><b>{o.who}</b><br /><span className="text-xs text-muted">{o.phone} · Placed {o.placed}</span></span><div className="flex gap-2"><Link to="/customers" className="text-xs font-semibold underline">Profile</Link><button onClick={() => { const t = `Hello ${o.who.split(' ')[0]}, your order #${o.id} is ${stageNames[o.stage].toLowerCase()}. Track it: ebenezerunique.com.gh/track/${o.trackId || o.id}`; window.open(`https://wa.me/${o.phone.replace(/\D/g, '')}?text=${encodeURIComponent(t)}`, '_blank', 'noopener'); setNotified({ ...notified, [o.id]: true }); }} className={cx('text-xs font-semibold px-3 py-1.5 rounded-full border', notified[o.id] ? 'border-[#1f7a2a] text-[#1f7a2a] bg-[#e7f4e8]' : 'border-line')}>{notified[o.id] ? '✓ Customer notified' : 'Notify on WhatsApp'}</button></div></div>
            <div className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-1">{o.items.map((i) => <div key={i[1]} className="flex justify-between"><span>{i[0]} × {i[1]}</span><span>{ghs(i[0] * i[2])}</span></div>)}{o.type === 'D' && <div className="flex justify-between text-muted"><span>Delivery fee</span><span>{o.fee ? ghs(o.fee) : 'Free'}</span></div>}<div className="flex justify-between font-semibold border-t border-line pt-1"><span>Total</span><span>{ghs(total(o))}</span></div></div>
            <div className="text-sm flex flex-col gap-0.5"><span>Payment <b>{o.pay}</b></span><span>{FUL[o.type]} · {o.where}</span>{o.landmark && <span className="text-xs text-muted">Landmark: {o.landmark}</span>}{o.gps && <span className="text-xs text-muted">GhanaPostGPS: {o.gps}</span>}</div>

            {o.type === 'D' && o.status !== 'Cancelled' && (
              <div className="p-3 rounded-2xl border border-line flex flex-col gap-2">
                <strong className="text-sm">Delivery rider</strong>
                <span className="text-xs text-muted">{o.rider ? `${RIDERS.find((r) => r.id === o.rider)?.name} is on this order · alert sent` : 'Assign a rider and send the alert. They see the address, landmark and GhanaPostGPS in the rider app.'}</span>
                {!riders.length && <span className="text-xs text-muted">No active riders at {BRN[o.brId]}. The Admin can add one in Users & permissions.</span>}
                {!o.rider && riders.map((r) => <button key={r.id} disabled={r.state !== 'Free'} onClick={() => setPick(r.id)} aria-pressed={pick === r.id} className={cx('flex items-center gap-3 p-2 rounded-xl border text-left text-sm disabled:opacity-50', pick === r.id ? 'border-brand bg-brand-50' : 'border-line')}><span className="w-8 h-8 rounded-full bg-black text-white text-xs flex items-center justify-center">{r.name.split(' ').map((w) => w[0]).join('')}</span><span className="flex-1"><b>{r.name}</b><br /><span className="text-xs text-muted">{r.note}</span></span><span className="text-xs">{r.state}</span></button>)}
                {!o.rider && <button disabled={!pick} onClick={() => { up(o.id, { rider: pick, track: [...o.track, { label: `Rider ${RIDERS.find((r) => r.id === pick)?.name} assigned`, at: nowTxt(), by: me }] }); setToast('Rider alerted on the rider app'); }} className="btn-dark min-h-9 text-xs w-fit">Assign & send alert</button>}
              </div>
            )}

            {o.status !== 'Cancelled' ? (
              <div className="p-3 rounded-2xl bg-canvas flex flex-col gap-2">
                <strong className="text-sm">{o.type === 'D' ? 'Delivery status' : 'Pickup status'} · step {o.stage + 1} of {maxStage + 1}</strong>
                <ol className="flex gap-1 list-none p-0 m-0">{stageNames.map((s, i) => <li key={s} className="flex-1 flex flex-col items-center gap-1 text-[10px] text-center"><span className={cx('w-full h-1.5 rounded-full', i <= o.stage ? 'bg-ok' : 'bg-[#d9d9d9]')} /><span className={i === o.stage ? 'font-semibold' : 'text-muted'}>{s}</span></li>)}</ol>
                {o.stage < maxStage && o.stage === maxStage - 1 && o.type === 'D' && <label className="flex flex-col gap-1 text-xs font-semibold">Received by<input value={rcv} onChange={(e) => setRcv(e.target.value)} placeholder="Name of the person who received it" className="px-3 py-2 rounded-full border border-line font-normal text-sm" /></label>}
                {o.stage < maxStage && <button onClick={advance} className="btn-primary min-h-9 text-xs w-fit">Move to {stageNames[o.stage + 1]}</button>}
                {o.stage === maxStage && <span className="text-sm text-ok">✓ {o.type === 'D' ? `Delivered · received by ${o.received}` : 'Collected'}</span>}
                <label className="flex flex-col gap-1 text-xs font-semibold">Change status (shows on the customer's account, Sell Now and the rider app)<select value={o.stage} onChange={(e) => { const s = Number(e.target.value); up(o.id, { stage: s, status: s === maxStage ? 'Delivered' : 'Active', track: [...o.track, { label: stageNames[s], at: nowTxt(), by: me }] }); }} className="px-3 py-2 rounded-full border border-line font-normal text-sm">{stageNames.map((s, i) => <option key={s} value={i}>{s}</option>)}</select></label>
                {err && <span role="alert" className="text-sm text-danger">{err}</span>}
              </div>
            ) : <span className="text-sm rounded-2xl bg-red-50 px-4 py-3">This order was cancelled. Do not send it.</span>}

            <div className="flex flex-col gap-1.5"><strong className="text-sm">Timeline</strong>{[...o.track].reverse().map((e, i) => <div key={i} className="flex justify-between text-xs gap-2"><span>{e.label} <span className="text-muted">· {e.by}</span></span><span className="text-muted">{e.at}</span></div>)}</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setModal('slip')} className="btn-ghost min-h-9 text-xs">Packing slip</button>
              <button onClick={() => setModal('edit')} className="btn-ghost min-h-9 text-xs">Edit order</button>
              {o.status !== 'Cancelled' && <button onClick={() => setModal('refund')} className="btn min-h-9 text-xs border border-danger text-danger">Refund</button>}
            </div>
            <span className="text-xs text-muted">Customer tracking page: ebenezerunique.com.gh/track/{o.trackId}</span>
          </section>
        )}
      </div>

      <Card title="Delivery zones & rates">
        <T head={['Zone', 'From branch', 'Fee', 'Time']} rows={[['Osu, Cantonments, Labone', 'Osu', 'GHS 20.00', 'Same day'], ['East Legon, Shiashie, Adjiringanor', 'East Legon', 'GHS 25.00', 'Same day'], ['Adum, Ahodwo, Asokwa (Kumasi)', 'Adum', 'GHS 20.00', 'Same day'], ['Rest of Ghana · courier', 'Nearest', 'From GHS 45.00', '1–3 days'], ['Free delivery', 'All', 'Orders over GHS 600', '—']]} />
      </Card>

      {o && modal && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-16 overflow-y-auto">
          <section role="dialog" aria-modal="true" className={cx('w-full bg-white rounded-4xl p-6 flex flex-col gap-4', modal === 'slip' ? 'max-w-xl print-doc' : 'max-w-md')}>
            {modal === 'refund' && <><h2 className="m-0 text-lg font-semibold">Refund {o.id}?</h2><p className="m-0 text-sm text-muted">The order is cancelled and {ghs(total(o))} is refunded to {o.pay.split(' · ')[0]}. {o.who} gets an SMS at each step, and the refund appears in Finance → Refunds.</p><div className="flex gap-2 justify-end"><button onClick={() => setModal('')} className="btn-ghost">Cancel</button><button onClick={() => { /* cancelled: its stock goes back on the shelf (once) for the till and the online store */ returnSaleStock(o.id); up(o.id, { status: 'Cancelled', cancelReason: 'Refunded by ' + me, track: [...o.track, { label: 'Cancelled and refunded', at: nowTxt(), by: me }] }); setModal(''); setToast('Refund started'); }} className="btn bg-danger text-white">Refund order</button></div></>}
            {modal === 'edit' && <><h2 className="m-0 text-lg font-semibold">Edit {o.id}</h2>{o.items.map((i, k) => <div key={i[1]} className="flex items-center gap-2 text-sm"><span className="flex-1">{i[1]}</span><button aria-label="One less" onClick={() => up(o.id, { items: o.items.map((x, j) => (j === k ? [Math.max(1, x[0] - 1), x[1], x[2]] : x)) })} className="w-7 h-7 rounded-full border border-line">−</button><b>{i[0]}</b><button aria-label="One more" onClick={() => up(o.id, { items: o.items.map((x, j) => (j === k ? [x[0] + 1, x[1], x[2]] : x)) })} className="w-7 h-7 rounded-full border border-line">+</button></div>)}<div className="flex justify-end"><button onClick={() => { setModal(''); setToast('Order updated · customer told by SMS'); }} className="btn-primary">Done</button></div></>}
            {modal === 'slip' && <><div className="flex justify-between items-center gap-3"><span className="flex items-center gap-2"><CompanyLogo className="w-10 h-10" /><h2 className="m-0 text-lg font-semibold">Packing slip · {o.id}</h2></span><span className="text-xs text-muted">{o.placed}</span></div><span className="text-sm"><b>{o.who}</b> · {o.phone}<br />{o.where}</span><T head={['Qty', 'Item', '✓']} rows={o.items.map((i) => [String(i[0]), i[1], '☐'])} /><div className="no-print flex gap-2 justify-end"><button onClick={() => setModal('')} className="btn-ghost">Close</button><button onClick={() => window.print()} className="btn-primary">Print</button></div></>}
          </section>
        </div>
      )}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}
