// Online store page /r: what a customer sees after scanning the QR code on their till receipt with a phone camera.
// The details come from the link itself (lib/receiptQr.ts), so it works on any phone with no login: the shop name,
// receipt number, date, branch, every item with its quantity and price, the totals and how it was paid.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { readReceiptLink } from '../../lib/receiptQr';
import { useShop } from './ctx';
import { money } from './model';
import { bizName } from './Shell';

/** The receipt page. Reads the address on every change (the details are in the part after #). */
export default function ReceiptView() {
  const { W, go } = useShop();
  const loc = useLocation();
  const r = readReceiptLink(window.location.href);
  const d = r?.data;
  useEffect(() => { window.scrollTo(0, 0); }, [loc.key]);
  const row = (k: string, v: string, b = false) => <div className={`flex justify-between gap-3 ${b ? 'font-semibold text-black' : 'text-sub'}`}><span>{k}</span><span className="text-right">{v}</span></div>;
  return (
    <main className="px-[var(--gut)] py-8 flex justify-center">
      <article aria-labelledby="rv-h" className="w-full max-w-md bg-white rounded-[28px] shadow-card ring-1 ring-black/5 overflow-hidden">
        <div className="bg-[#1a1240] text-white px-6 py-5 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[.18em] text-white/70">{d?.credit ? 'Credit sales receipt' : 'Sales receipt'}</span>
          <h1 id="rv-h" className="m-0 text-2xl font-semibold">{bizName(W)}</h1>
          {r?.code && <span className="text-sm text-white/80">Receipt No. {r.code}</span>}
        </div>
        {!d ? (
          <div className="p-6 flex flex-col gap-3 text-sm">
            <p className="m-0">{r?.code ? `This QR code only has the receipt number (${r.code}). Bring the printed receipt to any branch to see the items or to return or exchange them.` : 'This QR code could not be read. Try scanning it again, or bring the printed receipt to any branch.'}</p>
            <button onClick={() => go('')} className="w-fit h-11 px-5 rounded-full bg-black text-white font-semibold">Go to the shop</button>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[['Date', new Date(d.t * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })], ['Branch', d.br], ['Served by', d.st], ['Paid by', d.m]].map(([k, v]) => <div key={k} className="rounded-2xl bg-canvas px-3 py-2"><span className="block text-muted">{k}</span><b className="font-semibold">{v}</b></div>)}
            </div>
            <table className="w-full border-collapse">
              <thead><tr className="text-left text-xs text-muted"><th className="font-semibold pb-1.5">Item</th><th className="font-semibold pb-1.5 text-right">Qty</th><th className="font-semibold pb-1.5 text-right">Amount</th></tr></thead>
              <tbody>{d.i.map(([name, qty, price], k) => <tr key={k} className="align-top border-t border-dashed border-black/20"><td className="py-2 pr-2">{name}<span className="block text-xs text-muted">{money(price)} each</span></td><td className="py-2 text-right">{qty}</td><td className="py-2 pl-2 text-right font-medium whitespace-nowrap">{money(qty * price)}</td></tr>)}</tbody>
            </table>
            {d.more ? <span className="text-xs text-muted">…and {d.more} more item{d.more === 1 ? '' : 's'} on the printed receipt.</span> : null}
            <div className="flex flex-col gap-1 border-t-[3px] border-dashed border-black pt-3">
              {row('Subtotal', money(d.s))}
              {d.d > 0 && row('Discount', `− ${money(d.d)}`)}
              {d.c > 0 && row('Exchange credit', `− ${money(d.c)}`)}
              {d.f > 0 && row('Delivery fee', money(d.f))}
              {row('Total', money(d.T), true)}
              {d.credit && <>{row('Paid now', money(d.p))}{row('Balance owed', money(d.o), true)}{d.due && row('Balance due', d.due)}</>}
            </div>
            <p className="m-0 text-xs text-muted leading-relaxed">Items bought can be returned or exchanged at any branch: bring the printed receipt, or show this page. Money paid is not refundable.</p>
            <button onClick={() => go('')} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Shop again</button>
          </div>
        )}
      </article>
    </main>
  );
}
