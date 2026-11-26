import { readKey, usePersist } from '../../lib/persist';
import { WEB_ORDERS, type WebOrder } from '../../data/sell';
import { useState, useEffect } from 'react';
import { balOf, bName, daysInMonth, dAgo, FBR, FLOAT, insights, monthDays, money, MON, outstanding, OVERDUE_CREDIT, SRC, takings, TODAY, EXPENSES_MONTH, dayTxt, type Account, type Refund } from '../../data/finance';
import { cx } from '../../lib/format';
import { Card, Field, num, Pills, r2, stamp, T, type Ctx } from './shared';
import { PORTAL_BASE } from '../../lib/site';

export function Accounts({ c }: { c: Ctx }) {
  const { S, setS, flash } = c;
  const [mw, setMw] = useState({ op: 'MTN', opName: '', type: 'Business', holder: '', number: '', opening: '' });
  const [af, setAf] = useState({ name: '', number: '', opening: '', kind: 'bank' as Account['kind'] });
  const [mwErr, setMwErr] = useState('');
  const [afErr, setAfErr] = useState('');
  const wallets = S.acc.filter((a) => a.kind === 'momo');
  const KIND = { bank: 'Bank account', momo: 'MoMo wallet', clearing: 'Settlement', safe: 'Safe' };

  const addWallet = () => {
    const digits = mw.number.replace(/\D/g, '');
    if (mw.op === 'Other' && !mw.opName.trim()) return setMwErr('Enter the operator name.');
    if (mw.holder.trim().length < 2) return setMwErr('Enter the name on the wallet.');
    if (digits.length !== 10) return setMwErr('Enter the 10-digit wallet number.');
    const op = mw.op === 'Other' ? mw.opName.trim() : mw.op;
    setS((s) => ({ ...s, acc: [...s.acc, { id: 'w' + Date.now(), name: `${op} MoMo wallet · ${mw.holder.trim()}`, kind: 'momo', operator: op, holder: mw.holder.trim(), holderType: mw.type, number: digits.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3'), opening: num(mw.opening) }] }));
    setMw({ op: 'MTN', opName: '', type: 'Business', holder: '', number: '', opening: '' }); setMwErr('');
    flash('MoMo wallet added');
  };
  const addAcc = () => {
    if (af.name.trim().length < 2) return setAfErr('Enter the account name.');
    setS((s) => ({ ...s, acc: [...s.acc, { id: 'a' + Date.now(), name: af.name.trim(), kind: af.kind, number: af.number || '—', opening: num(af.opening) }] }));
    setAf({ name: '', number: '', opening: '', kind: 'bank' }); setAfErr('');
    flash('Account added');
  };

  return (
    <>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {S.acc.map((a) => { const b = balOf(a.id, S); return (
          <article key={a.id} className="card p-5 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted">{KIND[a.kind]}</span>
            <strong className="text-[15px]">{a.name}</strong>
            <span className="text-xs text-muted">{a.number}</span>
            <strong className="text-[22px] font-medium tracking-tightest mt-1">{money(b.bal)}</strong>
            {b.unc > 0 && <span className="text-xs text-[#b26a00]">+ {money(b.unc)} waiting for your check</span>}
          </article>
        ); })}
      </div>
      <Card title={`MoMo wallets · ${wallets.length}`} sub="Mobile Money wallets the business receives and sweeps money through" actions={<strong className="text-lg">{money(wallets.reduce((a, w) => a + balOf(w.id, S).bal, 0))}</strong>}>
        <T head={['Operator', 'Name on the wallet', 'Wallet number', 'Opening balance', 'Balance now']} rows={wallets.map((w) => [<span key="o" className="pill bg-amber-100 text-amber-900">{w.operator}</span>, <span key="h">{w.holder}<br /><span className="text-xs text-muted">{w.holderType}</span></span>, w.number, money(w.opening), <b key="b">{money(balOf(w.id, S).bal)}</b>])} />
        <div className="p-4 rounded-2xl bg-canvas flex flex-col gap-3">
          <strong>Add a MoMo wallet</strong>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Operator</span><Pills small opts={[['MTN', 'MTN MoMo'], ['Telecel', 'Telecel Cash'], ['AirtelTigo', 'AirtelTigo Money'], ['Other', 'Other']]} value={mw.op} onChange={(v) => setMw({ ...mw, op: v })} /></div>
          {mw.op === 'Other' && <Field label="Operator name" value={mw.opName} onChange={(v) => setMw({ ...mw, opName: v })} ph="e.g. G-Money, Zeepay" />}
          <Pills small opts={[['Business', 'Business wallet'], ['Personal', 'Personal wallet']]} value={mw.type} onChange={(v) => setMw({ ...mw, type: v })} />
          <div className="flex gap-3 flex-wrap">
            <Field label={mw.type === 'Business' ? 'Business name on the wallet' : 'Owner’s name on the wallet'} value={mw.holder} onChange={(v) => setMw({ ...mw, holder: v })} ph={mw.type === 'Business' ? 'e.g. Ebenezer Unique Ventures' : 'e.g. Ebenezer Mensah'} />
            <Field label="Wallet number" inputMode="numeric" value={mw.number} onChange={(v) => setMw({ ...mw, number: v })} ph="024 000 0000" />
            <Field label="Opening balance (GHS)" inputMode="decimal" value={mw.opening} onChange={(v) => setMw({ ...mw, opening: v })} ph="0.00" />
          </div>
          {mwErr && <span role="alert" className="text-sm text-danger">{mwErr}</span>}
          <button onClick={addWallet} className="btn-primary w-fit">Add MoMo wallet</button>
        </div>
      </Card>
      <Card title="Add a bank account, safe or settlement account">
        <div className="flex gap-3 flex-wrap">
          <Field label="Name" value={af.name} onChange={(v) => setAf({ ...af, name: v })} ph="e.g. Fidelity Bank · Savings" />
          <Field label="Account number" value={af.number} onChange={(v) => setAf({ ...af, number: v })} />
          <Field label="Opening balance (GHS)" inputMode="decimal" value={af.opening} onChange={(v) => setAf({ ...af, opening: v })} ph="0.00" />
        </div>
        <Pills small opts={[['bank', 'Bank account'], ['safe', 'Safe'], ['clearing', 'Settlement account']]} value={af.kind} onChange={(v) => setAf({ ...af, kind: v })} />
        {afErr && <span role="alert" className="text-sm text-danger">{afErr}</span>}
        <button onClick={addAcc} className="btn-primary w-fit">Add account</button>
      </Card>
    </>
  );
}

const STG = ['Requested', 'Approved', 'Payment sent', 'Refunded'];
const stIdx = (s: Refund['status']) => (s === 'Refunded' ? 3 : s === 'Payment sent' ? 2 : s === 'Approved' ? 1 : 0);
const smsFor = (r: Refund) => ({
  'Refund initiated': `Hello ${r.customer.split(' ')[0]}, we have received your refund request ${r.id} for ${money(r.amount)}. We will update you shortly. – Ebenezer Unique Ventures`,
  Approved: `Hello ${r.customer.split(' ')[0]}, your refund ${r.id} of ${money(r.amount)} has been approved and will be paid to your ${r.via}. – Ebenezer Unique Ventures`,
  'Payment sent': `Hello ${r.customer.split(' ')[0]}, we have sent your refund of ${money(r.amount)}${r.payRef ? ` (ref ${r.payRef})` : ''}. Please confirm when you receive it. – Ebenezer Unique Ventures`,
  Refunded: `Hello ${r.customer.split(' ')[0]}, your refund ${r.id} is complete. Thank you for shopping with us. – Ebenezer Unique Ventures`,
  Rejected: `Hello ${r.customer.split(' ')[0]}, we could not approve refund ${r.id}${r.rejectReason ? `: ${r.rejectReason}` : ''}. Please call us for help. – Ebenezer Unique Ventures`,
})[r.status];

export function Refunds({ c }: { c: Ctx }) {
  const { S, setS, role, me, flash, brs } = c;
  const [filter, setFilter] = useState<'open' | 'pending' | 'approved' | 'done' | 'rejected' | 'all'>('open');
  const [open, setOpen] = useState('');
  const [rs, setRs] = useState<Record<string, { meth?: string; ref?: string; why?: string; note?: string; sms?: string }>>({});
  const can = role !== 'staff';
  const [wo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [rr] = usePersist<{ no: string; reason: string; at: number; by?: string }[]>('ecompos.returnReqs', []);
  // Gather paid cancelled web orders and customers' return requests from the online store into Refunds.
  useEffect(() => {
    const have = new Set(S.refunds.map((r) => r.orderId || r.id));
    const shop = readKey<Record<string, { total: number; name: string; phone: string; brId: string; pay: string }>>('ecompos.shopOrders', {});
    const add: Refund[] = [
      ...wo.filter((o) => o.status === 'Cancelled' && /paid/i.test(o.pay) && !have.has(o.id)).map((o): Refund => ({ id: 'RF-' + o.id.slice(-4), customer: o.who, phone: o.phone, amount: o.items.reduce((a, [q, , p]) => a + q * p, 0) + o.fee, via: o.pay.split(' · ')[0], src: 'Cancelled web order', reason: o.cancelReason || 'Order cancelled', br: o.brId, status: 'Refund initiated', at: o.placed, log: [{ t: 'Refund started automatically · paid order was cancelled', at: o.placed, by: 'System' }], sms: 0, orderId: o.id })),
      ...rr.filter((x) => !have.has('RQ-' + x.no) && shop[x.no]).map((x): Refund => ({ id: 'RQ-' + x.no.slice(-4), customer: shop[x.no].name, phone: shop[x.no].phone, amount: shop[x.no].total, via: shop[x.no].pay.split(' · ')[0], src: 'Return request (online store)', reason: x.reason, br: shop[x.no].brId, status: 'Refund initiated', at: new Date(x.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), log: [{ t: `Customer asked for a return · ${x.reason}`, at: new Date(x.at).toLocaleString('en-GB'), by: x.by || 'Customer' }], sms: 0, orderId: 'RQ-' + x.no })),
    ];
    if (add.length) setS((s2) => ({ ...s2, refunds: [...add, ...s2.refunds] }));
  }, [wo, rr]); // eslint-disable-line react-hooks/exhaustive-deps
  const R = S.refunds.filter((r) => brs.includes(r.br));
  const inF = (r: Refund, f: string) => f === 'all' || (f === 'open' && ['Refund initiated', 'Approved', 'Payment sent'].includes(r.status)) || (f === 'pending' && r.status === 'Refund initiated') || (f === 'approved' && (r.status === 'Approved' || r.status === 'Payment sent')) || (f === 'done' && r.status === 'Refunded') || (f === 'rejected' && r.status === 'Rejected');
  const sum = (f: string) => R.filter((r) => inF(r, f)).reduce((a, r) => a + r.amount, 0);
  const save = (id: string, p: Partial<Refund>, log: string, sms = false) => {
    setS((s) => ({ ...s, refunds: s.refunds.map((r) => (r.id === id ? { ...r, ...p, sms: r.sms + (sms ? 1 : 0), log: [{ t: log, at: stamp(), by: me }, ...r.log] } : r)) }));
    flash(log);
  };
  const csv = () => {
    const rows = [['ID', 'Customer', 'Phone', 'Amount', 'Via', 'Status', 'Source', 'Reason'], ...R.map((r) => [r.id, r.customer, r.phone, String(r.amount), r.via, r.status, r.src, r.reason])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((x) => x.map((v) => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'ecompos-refunds.csv'; a.click();
  };

  return (
    <Card title="Refund requests" sub="Every refund from cancelled online orders, returns and checkout cancellations. Approve it, pay it out, record the reference, and the customer gets an SMS at each step." actions={<button onClick={csv} className="btn-ghost min-h-9 text-xs">Download CSV</button>}>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        {([['To approve', 'pending'], ['In progress', 'approved'], ['Refunded', 'done'], ['Rejected', 'rejected']] as const).map(([l, f]) => (
          <div key={l} className="rounded-2xl bg-canvas p-4 flex flex-col gap-0.5"><span className="text-xs text-muted">{l}</span><strong className="text-lg">{money(sum(f))}</strong><span className="text-xs text-muted">{R.filter((r) => inF(r, f)).length} requests</span></div>
        ))}
      </div>
      <Pills small opts={[['open', 'Open'], ['pending', 'To approve'], ['approved', 'In progress'], ['done', 'Refunded'], ['rejected', 'Rejected'], ['all', 'All']]} value={filter} onChange={setFilter} />
      {R.filter((r) => inF(r, filter)).length === 0 && <p className="text-sm text-muted m-0">No refund requests here.</p>}
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {R.filter((r) => inF(r, filter)).map((r) => {
          const x = rs[r.id] || {};
          const upd = (p: typeof x) => setRs((o) => ({ ...o, [r.id]: { ...x, ...p } }));
          const cur = r.status === 'Rejected' ? -1 : stIdx(r.status);
          const isOpen = open === r.id;
          const smsTxt = x.sms ?? smsFor(r);
          return (
            <li key={r.id} className="rounded-2xl border border-line p-4 flex flex-col gap-3">
              <div className="flex gap-3 flex-wrap justify-between">
                <div className="flex flex-col gap-0.5 min-w-[220px] flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><strong>{r.id}</strong><span className={cx('pill', r.status === 'Refunded' ? 'bg-green-100 text-green-800' : r.status === 'Rejected' ? 'bg-red-100 text-red-800' : r.status === 'Refund initiated' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900')}>{r.status}</span><span className="text-xs text-muted">{r.at}</span></div>
                  <span className="text-sm">{r.customer} · {r.phone} · <strong>{money(r.amount)}</strong> to {r.via}</span>
                  <span className="text-xs text-muted">{r.src} · {r.reason} · {bName(r.br)}</span>
                  {r.payRef && <span className="text-xs text-ok">Paid by {r.payVia} · ref {r.payRef}</span>}
                </div>
                <div className="flex gap-2 items-start">
                  {can && r.status === 'Refund initiated' && <button onClick={() => save(r.id, { status: 'Approved' }, `Refund ${r.id} approved`, true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-ok text-white">Approve</button>}
                  <button onClick={() => setOpen(isOpen ? '' : r.id)} aria-expanded={isOpen} className="text-xs font-semibold px-3 py-2 rounded-full border border-line">{isOpen ? 'Close' : 'Open'}</button>
                </div>
              </div>
              {isOpen && (
                <div className="flex flex-col gap-3 pt-2 border-t border-line">
                  {r.status === 'Rejected' && <span className="text-sm text-danger">This refund was rejected{r.rejectReason ? `: ${r.rejectReason}` : ''}. Reopen it to continue.</span>}
                  <ol className="flex gap-2 list-none p-0 m-0 flex-wrap">
                    {STG.map((g, i) => <li key={g} className="flex items-center gap-2 text-xs"><span className={cx('w-3 h-3 rounded-full', i < cur || (i === cur && r.status === 'Refunded') ? 'bg-ok' : i === cur ? 'bg-brand' : 'bg-[#d9d9d9]')} /><span className={cx(i <= cur ? 'text-black font-semibold' : 'text-[#8a8a8a]')}>{g}</span>{i < 3 && <span className={cx('w-8 h-0.5', i < cur ? 'bg-ok' : 'bg-[#d9d9d9]')} />}</li>)}
                  </ol>
                  {!can && <span className="text-xs text-muted">Approving and paying refunds is done by a Supervisor, Manager or the Admin.</span>}
                  {can && r.status === 'Approved' && (
                    <div className="p-3 rounded-2xl bg-canvas flex flex-col gap-2">
                      <span className="text-[13px] font-semibold">Pay out the refund</span>
                      <Pills small opts={[['MTN MoMo', 'MTN MoMo'], ['Telecel Cash', 'Telecel Cash'], ['Bank transfer', 'Bank transfer'], ['Card reversal', 'Card reversal'], ['Cash', 'Cash']]} value={x.meth || 'MTN MoMo'} onChange={(v) => upd({ meth: v })} />
                      <div className="flex gap-2 items-end flex-wrap"><Field label="Transaction reference" value={x.ref || ''} onChange={(v) => upd({ ref: v })} ph="e.g. MoMo ID 7741203398" /><button onClick={() => { if (!(x.ref || '').trim() && (x.meth || 'MTN MoMo') !== 'Cash') return flash('Enter the transaction reference.', true); save(r.id, { status: 'Payment sent', payRef: x.ref || 'cash', payVia: x.meth || 'MTN MoMo' }, `Payment sent for ${r.id}`, true); }} className="btn-primary">Send payment</button></div>
                    </div>
                  )}
                  {can && r.status === 'Payment sent' && <div className="p-3 rounded-2xl bg-canvas flex items-center gap-3 flex-wrap"><span className="text-sm flex-1">Paid by {r.payVia} · ref {r.payRef}. When the customer confirms they received the money, complete the refund.</span><button onClick={() => save(r.id, { status: 'Refunded' }, `Refund ${r.id} complete`, true)} className="btn-primary">Confirm refund complete</button></div>}
                  {can && ['Refund initiated', 'Approved'].includes(r.status) && <div className="flex gap-2 items-end flex-wrap"><Field label="Reason for rejecting" value={x.why || ''} onChange={(v) => upd({ why: v })} ph="e.g. Items not returned" /><button onClick={() => { if (!(x.why || '').trim()) return flash('Give a reason for rejecting.', true); save(r.id, { status: 'Rejected', rejectReason: x.why }, `Refund ${r.id} rejected`, true); }} className="btn border border-danger text-danger">Reject refund</button></div>}
                  <div className="flex gap-2 items-end flex-wrap"><Field label="Add a note" value={x.note || ''} onChange={(v) => upd({ note: v })} ph="e.g. Customer called, will pick up cash" /><button onClick={() => { if (!(x.note || '').trim()) return; save(r.id, {}, `Note added to ${r.id}: ${x.note}`); upd({ note: '' }); }} className="btn-ghost">Save note</button></div>
                  <div className="p-3 rounded-2xl border border-line flex flex-col gap-2">
                    <span className="text-[13px] font-semibold">SMS update to the customer</span>
                    <div className="grid md:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1 text-xs text-muted">Message (edit before sending)<textarea rows={4} value={smsTxt} onChange={(e) => upd({ sms: e.target.value })} className="text-sm text-black p-3 rounded-xl border border-line" /><span>{smsTxt.length} characters · {Math.ceil(smsTxt.length / 160)} SMS</span></label>
                      <div className="flex flex-col gap-1"><span className="text-xs text-muted">Preview · to {r.phone}</span><div className="text-sm p-3 rounded-2xl bg-[#e3f2fd]">{smsTxt}</div></div>
                    </div>
                    <div className="flex gap-2 flex-wrap"><button onClick={() => save(r.id, {}, `SMS sent to ${r.phone}: ${smsTxt}`, true)} className="btn-primary min-h-9 text-xs">Send SMS update</button><button onClick={() => upd({ sms: undefined })} className="btn-ghost min-h-9 text-xs">Use the message for this stage</button></div>
                  </div>
                  <div className="flex gap-2">{r.orderId && <a href={`${PORTAL_BASE}/orders`} className="btn-ghost min-h-9 text-xs">View order</a>}{can && (r.status === 'Rejected' || r.status === 'Refunded') && <button onClick={() => save(r.id, { status: 'Refund initiated', rejectReason: '' }, `Refund ${r.id} reopened`)} className="btn-ghost min-h-9 text-xs">Reopen</button>}</div>
                  <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Activity & messages · {r.sms} SMS sent</span>{r.log.map((l, i) => <div key={i} className="flex gap-2 text-xs"><span className="pill bg-canvas">Activity</span><span>{l.t} <span className="text-muted">· {l.at} · {l.by}</span></span></div>)}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <span className="sr-only">{r2(0)}{num('0')}</span>
    </Card>
  );
}

const SEV = { high: ['Act now', 'bg-danger', 'Money at risk or overdue'], mid: ['Do soon', 'bg-[#b26a00]', 'Worth doing this week'], low: ['Tips to improve', 'bg-[#0b6bcb]', 'Small changes that help'], info: ['Good to know', 'bg-brand', 'How the business is doing'] } as const;

export function Assistant({ c }: { c: Ctx }) {
  const { S, scope, goTab } = c;
  const [ask, setAsk] = useState('bank');
  const OUT = outstanding(S);
  const md = monthDays();
  const mt = md.reduce((a, d) => a + FBR.reduce((x, b) => x + takings(b.id, d).total, 0), 0);
  const avg14 = Array.from({ length: 14 }, (_, i) => dAgo(i + 1)).reduce((a, d) => a + FBR.reduce((x, b) => x + takings(b.id, d).total, 0), 0) / 14;
  const proj = mt + avg14 * (daysInMonth() - md.length);
  const exM = Object.values(EXPENSES_MONTH).reduce((a, b) => a + b, 0);
  const w = { mtn: balOf('mtn', S).bal, tel: balOf('tel', S).bal };
  const ASK: Record<string, [string, () => [string, string[], string?, string?]]> = {
    bank: ['How much should be banked today?', () => [`About ${money(FBR.reduce((a, b) => a + takings(b.id, TODAY).cash + takings(b.id, TODAY).momo, 0) + OUT.filter((o) => o.late).reduce((a, o) => a + o.amount, 0))} needs to reach the bank by tomorrow morning`, [...FBR.map((b) => { const t = takings(b.id, TODAY); const late = OUT.filter((o) => o.br === b.id && o.late).reduce((a, o) => a + o.amount, 0); return `${b.name}: ${money(t.cash)} cash and ${money(t.momo)} MoMo from today so far${late ? `, plus ${money(late)} overdue from earlier days` : ''}.`; }), `Each branch keeps its ${money(FLOAT)} float in the drawer.`], 'Record the deposits', 'deposits']],
    behind: ['Which branch is behind?', () => { const L = FBR.map((b) => ({ b, late: OUT.filter((o) => o.br === b.id && o.late).reduce((a, o) => a + o.amount, 0), short: S.cus.filter((x) => x.br === b.id && x.day >= dAgo(6) && x.variance < 0).reduce((a, x) => a - x.variance, 0) })).sort((a, b) => b.late + b.short - (a.late + a.short)); const top = L[0]; return [top.late + top.short ? `${top.b.name} needs attention` : 'No branch is behind', L.map((x) => `${x.b.name}: ${x.late ? money(x.late) + ' not banked' : 'banking up to date'}${x.short ? `, ${money(x.short)} short at cash-up this week` : ', cash-ups balanced'}.`), `Call ${top.b.lead}`, 'deposits']; }],
    month: ['What will this month look like?', () => [`Around ${money(Math.round(proj / 100) * 100)} in takings by ${daysInMonth()} ${MON[new Date().getMonth()]}`, [`So far: ${money(mt)} over ${md.length} days.`, `Daily average (last 14 days): ${money(avg14)}.`, `Expenses so far: ${money(exM)} — ${((exM / mt) * 100).toFixed(1)}% of takings${exM / mt > 0.12 ? ', above the 12% guide.' : ', within the 12% guide.'}`, `Expected to bank: about ${money(Math.round((proj * 0.88) / 100) * 100)} (cash, MoMo and GhPay; card settles by itself).`]]],
    leak: ['Where could money be leaking?', () => { const L: string[] = []; FBR.forEach((b) => { const neg = S.cus.filter((x) => x.br === b.id && x.day >= dAgo(6) && x.variance < 0); if (neg.length) L.push(`${b.name}: ${neg.length} short cash-ups this week (${money(-neg.reduce((a, x) => a + x.variance, 0))}).`); }); S.dep.filter((d) => d.status === 'flagged').forEach((d) => L.push(`${bName(d.br)} deposit ${d.id} came up short: ${d.why || ''}`)); if (OVERDUE_CREDIT) L.push(`${money(OVERDUE_CREDIT)} of credit sales are overdue.`); OUT.filter((o) => o.late).forEach((o) => L.push(`${bName(o.br)} still holds ${money(o.amount)} ${SRC[o.src].toLowerCase()} from ${dayTxt(o.day).toLowerCase()}.`)); return [L.length ? `${L.length} things to look at` : 'Nothing looks wrong right now', L.length ? L : ['Cash-ups balance, deposits match and nothing is overdue.']]; }],
    wallet: ['Should I sweep the MoMo wallets?', () => [w.mtn + w.tel > 2500 ? `Yes — sweep about ${money(Math.floor((w.mtn + w.tel - 1000) / 100) * 100)}` : 'Not yet', [`MTN merchant wallet: ${money(w.mtn)}.`, `Telecel Cash merchant wallet: ${money(w.tel)}.`, 'Keep about GHS 500 in each wallet for refunds and reversals.'], 'Record a sweep', 'moves']],
    cash: ['How much cash is in the tills right now?', () => [`About ${money(FBR.reduce((a, b) => a + takings(b.id, TODAY).cash, 0) + FLOAT * FBR.length)} across ${FBR.length} tills`, FBR.map((b) => { const v = takings(b.id, TODAY).cash + FLOAT; return `${b.name}: ${money(v)} (including the float)${v > 4000 ? ' — above the GHS 4,000 limit, move some to the safe.' : '.'}`; }), 'Move cash to the safe', 'moves']],
  };
  const [title, lines, nextLbl, nextTab] = ASK[ask][1]();
  const BAD = /overdue|short|not banked|above|needs attention|move some|came up short|still holds/i;
  const ins = insights(S, scope);
  const bold = (t: string) => t.split(/(GHS\s?[\d,]+(?:\.\d{1,2})?)/g).map((p, i) => (/^GHS/.test(p) ? <b key={i} className="text-white">{p}</b> : <span key={i}>{p}</span>));

  return (
    <>
      <section className="rounded-4xl bg-black text-white p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center text-lg">✦</span><div><h2 className="m-0 text-lg font-semibold">Ask the finance assistant</h2><span className="text-[13px] text-white/70">It reads takings, banking, cash-ups, expenses and credit from every branch, then answers in plain words.</span></div></div>
        <div className="flex gap-2 flex-wrap">{Object.entries(ASK).map(([k, [l]]) => <button key={k} aria-pressed={ask === k} onClick={() => setAsk(k)} className={cx('text-[13px] px-3.5 py-2 rounded-full border border-white/30', ask === k ? 'bg-white text-black' : 'text-white hover:bg-white/10')}>{l}</button>)}</div>
        <div className="rounded-3xl bg-white/[0.08] p-4 flex flex-col gap-3">
          <span className="text-xs text-white/60">You asked · {ASK[ask][0]}</span>
          <strong className="text-xl">{bold(title)}</strong>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">{lines.map((l) => <li key={l} className="flex gap-2 text-sm text-white/80"><span className={cx('pill text-white flex-none', BAD.test(l) ? 'bg-danger' : 'bg-ok')}>{BAD.test(l) ? 'Check' : 'OK'}</span><span>{bold(l)}</span></li>)}</ul>
          {nextLbl && nextTab && <div className="flex items-center gap-3 flex-wrap text-sm"><span>→ <strong>What to do next:</strong> {nextLbl.toLowerCase()}</span><button onClick={() => goTab(nextTab)} className="text-xs font-semibold px-3 py-2 rounded-full bg-white text-black">{nextLbl}</button></div>}
          <span className="text-xs text-white/50">As of {new Date().toTimeString().slice(0, 5)} today</span>
        </div>
      </section>
      <Card title="Everything the assistant noticed" sub={`${ins.length} findings · most urgent first · refreshed every time a branch records a sale, deposit or cash-up`}>
        {(['high', 'mid', 'low', 'info'] as const).map((k) => { const items = ins.filter((i) => i.sev === k); if (!items.length) return null; return (
          <div key={k} className="flex flex-col gap-2">
            <div className="flex items-center gap-2"><strong>{SEV[k][0]}</strong><span className={cx('pill text-white', SEV[k][1])}>{items.length}</span><span className="text-xs text-muted">{SEV[k][2]}</span></div>
            {items.map((i) => <div key={i.title} className="flex gap-3 items-start p-3 rounded-2xl bg-canvas"><div className="flex-1 flex flex-col"><strong className="text-sm">{i.title}</strong><span className="text-[13px] text-muted">{i.body}</span></div>{i.act && i.tab && <button onClick={() => goTab(i.tab!)} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white whitespace-nowrap">{i.act} →</button>}</div>)}
          </div>
        ); })}
      </Card>
    </>
  );
}
