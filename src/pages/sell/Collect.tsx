import { useState } from 'react';
import { Toast } from '../../components/ui';
import { COLLECTIONS, WEB_ORDERS, type Collection, type WebOrder } from '../../data/sell';
import { usePersist, nowTxt, readKey, writeKey } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { returnSaleStock } from '../../lib/stock';
import { cx, ghs } from '../../lib/format';
import { Pills } from '../finance/shared';

type Tab = 'todo' | 'ready' | 'prep' | 'done' | 'cancel';
const BRL: Record<string, string> = { osu: 'Osu', legon: 'East Legon', adum: 'Adum' };
const grp = (c: Collection): Tab => (c.status === 'collected' ? 'done' : c.status === 'cancelled' ? 'cancel' : c.status === 'ready' ? 'ready' : 'prep');
const ini = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);

export default function Collect() {
  const { viewBranch, session } = useSession();
  const view = session?.role === 'superuser' ? viewBranch : session?.branch ?? 'osu';
  const [L, setL] = usePersist<Collection[]>('ecompos.collect2', COLLECTIONS);
  const [tab, setTab] = useState<Tab>('todo');
  const [q, setQ] = useState('');
  const [qCode, setQCode] = useState('');
  const [qErr, setQErr] = useState('');
  const [ho, setHo] = useState<Collection | null>(null);
  const [hoCode, setHoCode] = useState('');
  const [hoMeth, setHoMeth] = useState('Cash');
  const [hoCash, setHoCash] = useState('');
  const [hoErr, setHoErr] = useState('');
  const [sc, setSc] = useState<Collection | null>(null);
  const [scCh, setScCh] = useState<Record<string, boolean>>({ sms: true, whatsapp: false, email: false });
  const [cx_, setCx] = useState<Collection | null>(null);
  const [cxReason, setCxReason] = useState('');
  const [cxNote, setCxNote] = useState('');
  const [toast, setToast] = useState('');

  const mine = L.filter((c) => view === 'all' || c.branch.startsWith(BRL[view]));
  const cnt = (t: Tab) => mine.filter((c) => (t === 'todo' ? ['ready', 'prep'].includes(grp(c)) : grp(c) === t)).length;
  const rows = mine.filter((c) => (tab === 'todo' ? ['ready', 'prep'].includes(grp(c)) : grp(c) === tab) && (!q.trim() || (c.name + c.phone + c.no).toLowerCase().includes(q.toLowerCase())));
  const set = (no: string, p: Partial<Collection>) => {
    setL((x) => x.map((c) => (c.no === no ? { ...c, ...p } : c)));
    // Keep the same online order in Orders (and the customer's tracking page) in step.
    if (!p.status) return;
    // A cancelled collection puts its stock back on the shelf (once), for the till and the online store.
    if (p.status === 'cancelled') returnSaleStock(no);
    const step = { waiting: 0, prep: 1, ready: 3, collected: 4, cancelled: -1 }[p.status];
    const label = { waiting: 'Being confirmed', prep: 'Preparing order', ready: 'Ready to collect', collected: 'Collected', cancelled: 'Cancelled' }[p.status];
    const wo = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
    if (!wo.some((o) => o.id === no)) return;
    writeKey('ecompos.webOrders2', wo.map((o) => (o.id !== no ? o : { ...o, stage: step < 0 ? o.stage : step, status: step < 0 ? 'Cancelled' : step === 4 ? 'Delivered' : 'Active', cancelReason: step < 0 ? p.note || 'Cancelled at the counter' : o.cancelReason, pay: p.paid && !/paid/.test(o.pay) ? o.pay + ' · paid' : o.pay, track: [...o.track, { label, at: nowTxt(), by: 'Collect' }] })));
  };

  const match = () => {
    if (qCode.length !== 6) return setQErr('Type all 6 digits of the code.');
    const hit = mine.find((c) => c.code === qCode && ['ready', 'prep'].includes(grp(c)));
    if (!hit) return setQErr('No waiting order has that code at this branch. Check the SMS with the customer.');
    setQErr(''); setQCode(''); openHo(hit, true);
  };
  const openHo = (c: Collection, codeOk = false) => { setHo(c); setHoCode(codeOk ? c.code : ''); setHoMeth('Cash'); setHoCash(''); setHoErr(''); };
  const handOver = () => {
    if (!ho) return;
    if (hoCode.length !== 6) return setHoErr("Enter the customer's 6-digit code.");
    if (hoCode !== ho.code) return setHoErr(`That code does not match order #${ho.no}. Ask the customer to check their SMS.`);
    if (ho.status !== 'ready') return setHoErr('Mark the order ready before handing it over.');
    if (!ho.paid && ho.pay !== 'hp' && hoMeth === 'Cash' && (parseFloat(hoCash) || 0) < ho.total) return setHoErr(`Cash received must be at least ${ghs(ho.total)}.`);
    set(ho.no, { status: 'collected', paid: true, note: `Collected ${nowTxt()}` });
    setToast(`#${ho.no} handed over to ${ho.name}. A receipt was sent by SMS.`);
    setHo(null);
  };
  const codeOk = ho && hoCode.length === 6 ? hoCode === ho.code : null;
  const change = ho ? Math.max(0, (parseFloat(hoCash) || 0) - ho.total) : 0;

  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Collect orders</h1><p className="m-0 text-sm text-muted">Website orders waiting to be picked up · {view === 'all' ? 'all branches' : BRL[view] + ' branch'} · check the customer's 6-digit code before handing over</p></header>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {([['Ready now', cnt('ready'), 'text-ok'], ['Still preparing', cnt('prep'), 'text-brand'], ['To pay at counter', mine.filter((c) => ['ready', 'prep'].includes(grp(c)) && !c.paid).length, 'text-[#8a4b00]']] as const).map(([k, v, c]) => <div key={k} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{k}</span><strong className={cx('text-3xl font-medium', c)}>{v}</strong></div>)}
      </div>
      <section className="rounded-4xl bg-brand text-white p-5 sm:p-6 flex flex-col gap-3">
        <div><h2 className="m-0 text-lg font-semibold">Customer at the counter?</h2><span className="text-sm text-white/80">Type the code from their SMS or confirmation page. The matching order opens straight away.</span></div>
        <div className="flex gap-2 flex-wrap items-center"><label htmlFor="qcode" className="sr-only">Collection code</label><input id="qcode" inputMode="numeric" value={qCode} onChange={(e) => { setQCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setQErr(''); }} onKeyDown={(e) => e.key === 'Enter' && match()} placeholder="6-digit code" className="text-2xl tracking-[0.4em] text-center w-56 px-4 py-2.5 rounded-full text-black" /><button onClick={match} className="btn bg-white text-black">Match order</button></div>
        {qErr && <span role="alert" className="text-sm bg-white/15 rounded-xl px-3 py-2">{qErr}</span>}
      </section>
      <div className="flex gap-3 flex-wrap items-end justify-between">
        <Pills opts={([['todo', 'To collect'], ['ready', 'Ready now'], ['prep', 'Still preparing'], ['done', 'Collected'], ['cancel', 'Cancelled']] as [Tab, string][]).map(([k, l]) => [k, `${l} · ${cnt(k)}`] as [Tab, string])} value={tab} onChange={setTab} />
        <label className="flex flex-col gap-1 text-xs font-semibold">Filter orders<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, phone or order number" className="px-4 py-2 rounded-full border border-line w-72 font-normal text-sm" /></label>
      </div>
      {!rows.length && <span className="text-sm text-muted">{q ? `No orders match "${q}".` : tab === 'done' ? 'Nothing collected yet.' : 'No orders here.'}</span>}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <article key={r.no} className="card p-5 flex flex-col gap-3">
            <div className="flex justify-between gap-2 flex-wrap"><span><b>#{r.no}</b> <span className="text-xs text-muted">{r.fulfil === 'I' ? 'Hire purchase pickup' : 'Click & collect'} · placed {r.placedAt}</span></span><span className={cx('pill', r.status === 'ready' ? 'bg-green-100 text-green-800' : r.status === 'collected' ? 'bg-canvas text-sub' : r.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-900')}>{{ ready: 'Ready now', prep: 'Still preparing', waiting: 'Still preparing', collected: 'Collected', cancelled: 'Cancelled' }[r.status]}</span></div>
            <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-black text-white text-xs font-semibold flex items-center justify-center">{ini(r.name)}</span><span className="flex flex-col"><b className="text-sm">{r.name}</b><span className="text-xs text-muted">{r.phone} · {r.branch}</span></span></div>
            <div className="flex flex-col gap-1 text-sm p-3 rounded-2xl bg-canvas">{r.items.map((i) => <div key={i.name} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{ghs(i.total)}</span></div>)}</div>
            <div className="flex justify-between text-sm"><span className={r.paid ? 'text-ok' : 'text-[#8a4b00]'}>{r.paid ? `Paid online${r.payRef ? ` · ${r.payRef}` : ''}` : r.pay === 'hp' ? 'Hire purchase · deposit at the counter' : 'To pay at the counter'}</span><b>{ghs(r.total)}</b></div>
            {r.note && <span className="text-xs text-muted">{r.note}</span>}
            {r.sent && <span className="text-xs text-ok">{r.sent}</span>}
            {['ready', 'prep', 'waiting'].includes(r.status) && (
              <div className="flex gap-2 flex-wrap">
                {r.status === 'ready' ? <button onClick={() => openHo(r)} className="btn-primary">Verify code & hand over</button> : <button onClick={() => { set(r.no, { status: 'ready' }); setToast(`#${r.no} is ready · ${r.name} has been told by SMS`); }} className="btn-dark">Mark ready to collect</button>}
                <button onClick={() => setSc(r)} className="btn-ghost">{r.sent ? 'Send code again' : 'Send collection code'}</button>
                <button onClick={() => { setCx(r); setCxReason(''); setCxNote(''); }} className="btn-ghost text-danger">Cancel collection</button>
              </div>
            )}
          </article>
        ))}
      </div>

      {ho && (
        <Modal onClose={() => setHo(null)}>
          <div><h2 className="m-0 text-lg font-semibold">Hand over #{ho.no}</h2><span className="text-sm text-muted">{ho.name} · {ho.phone} · {ho.fulfil === 'I' ? 'Hire purchase pickup' : 'Click & collect'} · {ho.paid ? 'Paid online' : 'To pay now'}</span></div>
          <div className="text-sm p-3 rounded-2xl bg-canvas flex flex-col gap-1">{ho.items.map((i) => <div key={i.name} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{ghs(i.total)}</span></div>)}<div className="flex justify-between font-semibold border-t border-line pt-1"><span>Total</span><span>{ghs(ho.total)}</span></div></div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Customer's 6-digit code<input inputMode="numeric" value={hoCode} onChange={(e) => { setHoCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setHoErr(''); }} placeholder="••••••" className="text-2xl tracking-[0.4em] text-center px-4 py-2 rounded-full border border-line font-normal" /><span className={cx('text-xs font-normal', codeOk === true ? 'text-ok' : codeOk === false ? 'text-danger' : 'text-muted')}>{codeOk === true ? '✓ Code matches this order' : codeOk === false ? 'This code does not match' : 'Ask the customer for the code in their SMS'}</span></label>
          {!ho.paid && ho.pay !== 'hp' && (
            <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Take payment · {ghs(ho.total)}</span><Pills small opts={[['Cash', 'Cash'], ['MoMo', 'MoMo'], ['Card', 'Card']]} value={hoMeth} onChange={setHoMeth} />{hoMeth === 'Cash' && <label className="flex flex-col gap-1 text-xs font-semibold">Cash received<input inputMode="decimal" value={hoCash} onChange={(e) => setHoCash(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="field py-2 font-normal" /><span className="font-normal">Change: <b>{ghs(change)}</b></span></label>}</div>
          )}
          {ho.pay === 'hp' && <span className="text-sm rounded-2xl bg-warn-bg px-4 py-3">Check their Ghana Card and sign the hire purchase agreement before handing over.</span>}
          {hoErr && <span role="alert" className="text-sm text-danger">{hoErr}</span>}
          <div className="flex gap-2 justify-end"><button onClick={() => setHo(null)} className="btn-ghost">Cancel</button><button onClick={handOver} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: "#1f7a2a" }}>{ho.paid || ho.pay === 'hp' ? 'Hand over' : 'Take payment & hand over'}</button></div>
        </Modal>
      )}
      {sc && (
        <Modal onClose={() => setSc(null)}>
          <div><h2 className="m-0 text-lg font-semibold">Send collection code · #{sc.no}</h2><span className="text-sm text-muted">{sc.name} uses this code at the counter to collect the order.</span></div>
          <div className="text-center p-4 rounded-2xl bg-canvas"><span className="text-xs text-muted">Collection code</span><br /><b className="text-3xl tracking-[0.3em]">{sc.code}</b></div>
          {([['sms', `SMS to ${sc.phone}`, 'Text message with the code and branch address'], ['whatsapp', 'WhatsApp', `${sc.phone} · the code and a map pin`], ['email', 'Email', 'No email on file']] as const).map(([k, l, n]) => <button key={k} disabled={k === 'email'} aria-pressed={scCh[k]} onClick={() => setScCh((x) => ({ ...x, [k]: !x[k] }))} className={cx('flex items-center gap-3 p-3 rounded-2xl border text-left disabled:opacity-50', scCh[k] ? 'border-brand bg-brand-50' : 'border-line')}><span className="w-5">{scCh[k] ? '✓' : ''}</span><b className="text-sm">{l}</b><span className="text-xs text-muted">{n}</span></button>)}
          <div className="flex gap-2 justify-end"><button onClick={() => setSc(null)} className="btn-ghost">Cancel</button><button onClick={() => { if (!Object.values(scCh).some(Boolean)) return; set(sc.no, { sent: `Code sent by ${Object.keys(scCh).filter((k) => scCh[k]).join(' and ')} · ${nowTxt()}` }); setSc(null); setToast('Collection code sent'); }} className="btn-primary">Send code</button></div>
        </Modal>
      )}
      {cx_ && (
        <Modal onClose={() => setCx(null)}>
          <div className="flex gap-3"><span className="w-10 h-10 rounded-full bg-red-100 text-danger font-bold flex items-center justify-center">!</span><div><h2 className="m-0 text-lg font-semibold">Cancel collection · #{cx_.no}?</h2><span className="text-sm text-muted">{cx_.name} is told on the website and by SMS. The code stops working. {cx_.paid ? `A refund of ${ghs(cx_.total)} is started in Finance → Refunds.` : ''}</span></div></div>
          <span className="text-[13px] font-semibold">Reason</span>
          <Pills small opts={[['Customer did not collect within 24 hours', 'Customer did not collect within 24 hours'], ['Item out of stock or damaged', 'Item out of stock or damaged'], ['Customer asked us to cancel', 'Customer asked us to cancel'], ['Payment could not be confirmed', 'Payment could not be confirmed'], ['Other', 'Other']]} value={cxReason} onChange={setCxReason} />
          <label className="flex flex-col gap-1 text-xs font-semibold">Note for the customer (optional)<input value={cxNote} onChange={(e) => setCxNote(e.target.value)} placeholder="e.g. We held it for 24 hours" className="field py-2 font-normal" /></label>
          <div className="flex gap-2 justify-end"><button onClick={() => setCx(null)} className="btn-ghost">Keep order</button><button onClick={() => { if (!cxReason) return setToast('Choose a reason.'); set(cx_.no, { status: 'cancelled', note: `Cancelled · ${cxReason}${cxNote ? ` · ${cxNote}` : ''}` }); setCx(null); setToast(`#${cx_.no} cancelled`); }} className="btn bg-danger text-white">Cancel collection</button></div>
        </Modal>
      )}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-16 overflow-y-auto" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <section role="dialog" aria-modal="true" className="w-full max-w-lg bg-white rounded-4xl p-6 flex flex-col gap-4">{children}</section>
    </div>
  );
}
