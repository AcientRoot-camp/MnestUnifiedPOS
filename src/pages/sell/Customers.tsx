import { useMemo, useState } from 'react';
import { Toast } from '../../components/ui';
import { CUSTOMERS, SALES, wordsGhs, type Customer, type Sale } from '../../data/sell';
import { PEOPLE } from '../../data/nav';
import { usePersist, nowTxt } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { can } from '../../lib/perms';
import type { TillSale } from '../pos/model';
import { cx, ghs } from '../../lib/format';
import { Card, Field, Pills, T } from '../finance/shared';
import { COMPANY } from '../../data/hirePurchase';
import CompanyLogo from '../../components/CompanyLogo';
import Relationship from '../crm/Relationship';
import { StampSvg, type Stamp } from '../admin/Documents';
import NoticeModal from '../../components/Notice';

type Pay = { id: string; cust: string; sale: string; amt: number; method: string; ref: string; at: string; by: string; left: number };
const SEGS = ['All', 'Retail', 'Wholesale', 'Staff', 'Owes money'] as const;
const ini = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);
const owes = (c: Customer) => c.credits.reduce((a, k) => a + Math.max(0, k.total - k.paid), 0);

export default function Customers() {
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const me = PEOPLE[role].name;
  const [list, setList] = usePersist<Customer[]>('ecompos.customers2', CUSTOMERS);
  const [pays, setPays] = usePersist<Pay[]>('ecompos.creditPays2', []);
  const [seg, setSeg] = useState<(typeof SEGS)[number]>('All');
  const [cq, setCq] = useState('');
  const [sel, setSel] = useState(list[0]?.id ?? '');
  const [drill, setDrill] = useState<'' | 'spend' | 'owes' | 'points' | 'visits'>('');
  const [ow, setOw] = useState({ sale: '', amt: '', method: 'Cash', ref: '', err: '', sms: '' });
  const [spQ, setSpQ] = useState('');
  const [rcpt, setRcpt] = useState<Pay | null>(null);
  const [paper, setPaper] = useState<'A5' | 'A4'>('A5');
  const [stamp] = usePersist<Stamp>('ecompos.stamp2', { shape: 'circle', color: '#1a3fa0', word: 'PAID', top: COMPANY.name, bottom: 'Accra · Ghana', sig: '' });
  const [del, setDel] = useState(false);
  const [toast, setToast] = useState('');
  const [smsLog, setSmsLog] = useState<Record<string, string[]>>({});

  const shown = list.filter((c) => (seg === 'All' || (seg === 'Owes money' ? owes(c) > 0 : c.group === seg)) && (!cq.trim() || (c.name + c.phone + c.email).toLowerCase().includes(cq.toLowerCase())));
  const p = list.find((c) => c.id === sel) ?? shown[0];
  const upd = (patch: Partial<Customer>) => p && setList((L) => L.map((c) => (c.id === p.id ? { ...c, ...patch } : c)));
  const [till] = usePersist<TillSale[]>('ecompos.sales2', []);
  const hist = useMemo(() => (p ? [...till.filter((t) => t.cust && (t.cust.phone.replace(/\D/g, '').slice(-9) === p.phone.replace(/\D/g, '').slice(-9))).map((t): Sale => ({ no: t.no, ts: t.ts, day: new Date(t.ts).toISOString().slice(0, 10), br: t.br, staff: t.staff, cust: p.name, phone: p.phone, method: t.method, lines: t.lines.map((l) => ({ name: l.name, qty: l.qty, each: l.price })), total: t.total, ch: 'till', status: 'completed', cost: 0 })), ...SALES.filter((s) => s.cust === p.name)] : []), [p, till]);
  const canView = can(role, session?.username, 'customers.view') || can(role, session?.username, 'customers.manage');
  const [nc, setNc] = useState({ name: '', phone: '', err: '', ok: '' });
  const spend = hist.reduce((a, s) => a + s.total, 0);
  const owesNow = p ? owes(p) : 0;
  const open = p ? p.credits.filter((k) => k.total > k.paid) : [];
  const curSale = open.find((k) => k.no === ow.sale) ?? open[0];
  const smsDefault = p && curSale ? `Hello ${p.name.split(' ')[0]}, this is a reminder that ${ghs(curSale.total - curSale.paid)} is due on sale #${curSale.no} by ${new Date(curSale.due).toLocaleDateString('en-GB')}. Pay by MoMo to 0244 000 111. Thank you – ${COMPANY.name}` : '';
  const sms = ow.sms || smsDefault;
  const bulk = list.filter((c) => owes(c) > 0);

  const recordPay = () => {
    if (!p || !curSale) return;
    const a = parseFloat(ow.amt);
    if (!(a > 0)) return setOw({ ...ow, err: 'Enter the amount paid.' });
    const left = curSale.total - curSale.paid;
    if (a > left + 0.001) return setOw({ ...ow, err: `That is more than the ${ghs(left)} owed on this sale.` });
    if (ow.method !== 'Cash' && !ow.ref.trim()) return setOw({ ...ow, err: 'Enter the transaction reference.' });
    upd({ credits: p.credits.map((k) => (k.no === curSale.no ? { ...k, paid: k.paid + a } : k)) });
    const pay = { id: 'CRP-' + Date.now(), cust: p.name, sale: curSale.no, amt: a, method: ow.method, ref: ow.ref, at: nowTxt(), by: me, left: left - a };
    setPays((L) => [pay, ...L]);
    setOw({ sale: curSale.no, amt: '', method: 'Cash', ref: '', err: '', sms: '' });
    setRcpt(pay);
  };

  if (!p) return null;
  const drillRows: [string, string, string][] = drill === 'spend' ? hist.slice(0, 12).map((s) => [new Date(s.ts).toLocaleDateString('en-GB'), '#' + s.no, ghs(s.total)]) : drill === 'points' ? [['Earned from purchases', `${Math.round(spend / 10)} pts`, ''], ['Redeemed', `${Math.max(0, Math.round(spend / 10) - p.points)} pts`, ''], ['Balance', `${p.points} pts`, `= ${ghs(p.points / 20)} off`]] : drill === 'visits' ? Object.entries(hist.reduce<Record<string, number>>((a, s) => ((a[s.br] = (a[s.br] || 0) + 1), a), {})).map(([b, n]) => [b, `${n} visits`, '']) : [];

  if (!canView) return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Customers</h1><p className="m-0 text-sm text-muted">One profile per phone number across the till, website and phone.</p></header>
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">Add a customer</h2>
          <input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Full name" className="field" aria-label="Full name" />
          <div className="flex items-center rounded-full border border-line overflow-hidden"><span className="px-3 text-sm text-muted bg-canvas py-2.5">+233</span><input inputMode="numeric" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="24 555 0142" aria-label="Phone" className="flex-1 px-3 py-2.5 outline-none" /></div>
          {nc.err && <span role="alert" className="text-sm text-danger">{nc.err}</span>}<NoticeModal msg={nc.ok} onClose={() => setNc({ ...nc, ok: '' })} />
          <button onClick={() => { const d = nc.phone.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, ''); if (nc.name.trim().length < 2) return setNc({ ...nc, err: 'Add the name.', ok: '' }); if (d.length !== 9) return setNc({ ...nc, err: '9 digits after +233, without the first 0.', ok: '' }); if (list.some((c) => c.phone.replace(/\D/g, '').endsWith(d))) return setNc({ ...nc, err: '409 Conflict · A customer already uses this phone number.', ok: '' }); setList([{ ...CUSTOMERS[0], id: 'c' + Date.now(), name: nc.name.trim(), phone: '+233 ' + d, email: '', group: 'Retail', since: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), tier: 'Bronze', points: 0, limit: 500, br: session?.branch || 'osu', credits: [], codes: [], gifts: [] }, ...list]); setNc({ name: '', phone: '', err: '', ok: `✓ ${nc.name.trim()} added` }); }} className="btn-primary w-fit">Save customer</button>
        </section>
        <section className="card p-5 flex flex-col gap-2"><h2 className="m-0 text-lg font-semibold">Customer profiles</h2><span className="text-sm text-muted">Profiles, credit and purchase history are for Supervisors, Managers and the Admin. You can add customers here and at the till.</span></section>
      </div>
    </>
  );
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Customers</h1><p className="m-0 text-sm text-muted">One profile per phone number, across the till, website and phone</p></header>
      <div className="flex items-center gap-3 flex-wrap"><span className="text-[13px] font-semibold">Segment</span><Pills opts={SEGS.map((s) => [s, s] as [(typeof SEGS)[number], string])} value={seg} onChange={setSeg} /></div>
      <div className="grid gap-6 xl:grid-cols-[340px_1fr] items-start">
        <section className="card p-4 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Search name, phone or email<input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="e.g. Ama, 0244, gmail" className="field font-normal py-2.5" /></label>
          {cq && <button onClick={() => setCq('')} className="text-xs underline w-fit">Show all customers</button>}
          {shown.map((c) => (
            <button key={c.id} onClick={() => { setSel(c.id); setDrill(''); setOw({ sale: '', amt: '', method: 'Cash', ref: '', err: '', sms: '' }); setDel(false); }} aria-pressed={p.id === c.id} className={cx('flex items-center gap-3 p-3 rounded-2xl text-left', p.id === c.id ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}>
              <span className="w-10 h-10 rounded-full bg-black text-white text-xs font-semibold flex items-center justify-center flex-none">{ini(c.name)}</span>
              <span className="flex-1 min-w-0 flex flex-col"><b className="text-sm truncate">{c.name}</b><span className="text-xs text-muted">{c.phone} · {c.group}</span></span>
              <span className="flex flex-col items-end text-xs"><span>{ghs(SALES.filter((s) => s.cust === c.name).reduce((a, s) => a + s.total, 0))}</span>{owes(c) > 0 && <span className="text-danger font-semibold">Owes {ghs(owes(c))}</span>}</span>
            </button>
          ))}
          {!shown.length && <span className="text-sm text-muted p-2">No customers in this segment.</span>}
          {seg === 'Owes money' && bulk.length > 0 && <div className="p-3 rounded-2xl bg-red-50 flex items-center gap-2 flex-wrap text-sm"><span className="flex-1">{ghs(bulk.reduce((a, c) => a + owes(c), 0))} owed by {bulk.length}</span><button onClick={() => setToast(`Reminders sent to ${bulk.length} customers`)} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white">Send reminders to all</button></div>}
        </section>

        <div className="flex flex-col gap-6 min-w-0">
          <section className="card p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="w-14 h-14 rounded-full bg-black text-white font-semibold flex items-center justify-center">{ini(p.name)}</span>
              <div className="flex-1 min-w-[200px]"><h2 className="m-0 text-[22px] font-semibold">{p.name}</h2><span className="text-[13px] text-muted">{p.phone}{p.email ? ` · ${p.email}` : ''} · customer since {p.since}</span></div>
              <span className={cx('pill text-sm px-3', p.tier === 'Gold' ? 'bg-[#f2c94c] text-black' : p.tier === 'Silver' ? 'bg-[#e1e4e6] text-black' : 'bg-[#e8c3a0] text-black')}>{p.tier}</span>
            </div>
            <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              {([['spend', 'Total spent', ghs(spend), `${hist.length} purchases`], ['owes', 'Owes', ghs(owesNow), owesNow ? `${open.length} open credit sale(s)` : 'Nothing owed'], ['points', 'Loyalty points', String(p.points), `= ${ghs(p.points / 20)} off`], ['visits', 'Branches visited', String(new Set(hist.map((s) => s.br)).size), 'Till and website']] as const).map(([k, l, v, s]) => (
                <button key={k} onClick={() => setDrill(drill === k ? '' : k)} aria-expanded={drill === k} className={cx('rounded-2xl p-3 text-left flex flex-col gap-0.5', drill === k ? 'bg-black text-white' : 'bg-canvas')}><span className="text-xs opacity-70 flex justify-between">{l}<span>{drill === k ? '▴' : '▾'}</span></span><b className={cx('text-lg', k === 'owes' && owesNow && drill !== k ? 'text-danger' : '')}>{v}</b><span className="text-xs opacity-70">{s}</span></button>
              ))}
            </div>
            {drill && (
              <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                <div className="flex justify-between"><strong>{{ spend: 'What they bought', owes: 'Credit sales', points: 'Loyalty points', visits: 'Visits by branch' }[drill]}</strong><button onClick={() => setDrill('')} className="text-xs underline">Close</button></div>
                {drill === 'owes' ? (
                  <>
                    {!open.length && <span className="text-sm text-ok">✓ Paid in full. Nothing is owed on this account.</span>}
                    {p.credits.map((k) => (
                      <div key={k.no} className="flex gap-3 flex-wrap items-center p-3 rounded-xl bg-canvas text-sm">
                        <span className={cx('pill', k.paid >= k.total ? 'bg-green-100 text-green-800' : new Date(k.due) < new Date() ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{k.paid >= k.total ? 'Paid' : new Date(k.due) < new Date() ? 'Overdue' : 'Owing'}</span>
                        <span className="flex-1 min-w-[200px]">Sale #{k.no} · {k.at}<br /><span className="text-xs text-muted">Goods {ghs(k.total)} · paid {ghs(k.paid)} · taken by {k.by}{k.appr ?? ''}</span></span>
                        <span className="text-xs">Due {new Date(k.due).toLocaleDateString('en-GB')}</span>
                        <b className={k.paid < k.total ? 'text-danger' : ''}>{ghs(Math.max(0, k.total - k.paid))}</b>
                        {k.paid < k.total && <><button onClick={() => setOw({ ...ow, sale: k.no })} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Take a payment on this sale</button><label className="text-xs flex items-center gap-1">Move the due date<input type="date" value={k.due} onChange={(e) => upd({ credits: p.credits.map((x) => (x.no === k.no ? { ...x, due: e.target.value } : x)) })} className="px-2 py-1 rounded-full border border-line" /></label></>}
                      </div>
                    ))}
                  </>
                ) : drill === 'spend' ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs font-semibold">Search items, sale no. or branch<input value={spQ} onChange={(e) => setSpQ(e.target.value)} placeholder="e.g. TV, 34391209, Osu" className="field font-normal py-2" /></label>
                    <T head={['Date', 'Sale', 'Item', 'Qty', 'Each', 'Total']} rows={hist.flatMap((s) => s.lines.map((l) => ({ s, l }))).filter(({ s, l }) => !spQ || (l.name + s.no + s.br).toLowerCase().includes(spQ.toLowerCase())).slice(0, 15).map(({ s, l }) => [new Date(s.ts).toLocaleDateString('en-GB'), `#${s.no} ${s.ch === 'web' ? '· web' : ''}`, l.name, String(l.qty), ghs(l.each), ghs(l.qty * l.each)])} />
                  </>
                ) : <T head={['', '', '']} rows={drillRows} />}
              </div>
            )}
          </section>

          <Relationship customer={p} />
          <Card title="Credit account" sub={`Owes ${ghs(owesNow)} · limit ${ghs(p.limit)}`} actions={<div className="flex gap-1.5 flex-wrap"><button onClick={() => { setSmsLog((l) => ({ ...l, [p.id]: [`${nowTxt()} · Statement sent · owes ${ghs(owesNow)} of ${ghs(p.limit)} limit`, ...(l[p.id] || [])] })); setToast(`Statement sent to ${p.phone}${p.email ? ` and ${p.email}` : ''}`); }} className="h-9 px-4 rounded-full bg-black text-white text-xs font-semibold">Send statement</button><button onClick={() => document.getElementById('cu-pay')?.scrollIntoView({ behavior: 'smooth' })} className="h-9 px-4 rounded-full border border-[#d9d9d9] bg-white text-xs">Record part-payment</button><button onClick={() => document.getElementById('cu-sms')?.scrollIntoView({ behavior: 'smooth' })} className="h-9 px-4 rounded-full border border-[#d9d9d9] bg-white text-xs">Send SMS reminder</button></div>}>
            <div className="h-2 rounded-full bg-canvas overflow-hidden"><div className={cx('h-full', owesNow / p.limit > 0.8 ? 'bg-danger' : 'bg-brand')} style={{ width: `${Math.min(100, (owesNow / p.limit) * 100)}%` }} /></div>
            <span className="text-xs text-muted">{owesNow ? `${Math.round((owesNow / p.limit) * 100)}% of the credit limit used. Sales that go over the limit are refused at the till.` : 'Nothing owed. The full credit limit is available.'}</span>
            {open.length > 0 && curSale && (
              <div className="grid lg:grid-cols-2 gap-4">
                <div id="cu-pay" className="p-4 rounded-2xl bg-canvas flex flex-col gap-3">
                  <strong className="text-sm">Record a part payment</strong>
                  {open.length > 1 && <Pills small opts={open.map((k) => [k.no, `#${k.no} · ${ghs(k.total - k.paid)}`] as [string, string])} value={curSale.no} onChange={(v) => setOw({ ...ow, sale: v, sms: '' })} />}
                  <div className="flex gap-2 items-end flex-wrap"><Field label="Amount paid (GHS)" inputMode="decimal" value={ow.amt} onChange={(v) => setOw({ ...ow, amt: v.replace(/[^0-9.]/g, ''), err: '' })} ph="0.00" />{[[`Pay it all · ${ghs(curSale.total - curSale.paid)}`, curSale.total - curSale.paid], ['Half', (curSale.total - curSale.paid) / 2]].map(([l, v]) => <button key={l as string} onClick={() => setOw({ ...ow, amt: (v as number).toFixed(2), err: '' })} className="text-xs px-3 py-2 rounded-full border border-line bg-white mb-1">{l as string}</button>)}</div>
                  <Pills small opts={[['Cash', 'Cash'], ['Mobile Money', 'Mobile Money'], ['GhPay', 'GhPay'], ['Bank transfer', 'Bank transfer']]} value={ow.method} onChange={(v) => setOw({ ...ow, method: v, err: '' })} />
                  {ow.method !== 'Cash' && <Field label="Transaction reference" value={ow.ref} onChange={(v) => setOw({ ...ow, ref: v, err: '' })} ph="e.g. 77412039" />}
                  {ow.err && <span role="alert" className="text-sm text-danger">{ow.err}</span>}
                  <button onClick={recordPay} className="btn-primary">Record payment{parseFloat(ow.amt) > 0 ? ` · ${ghs(parseFloat(ow.amt))}` : ''}</button>
                </div>
                <div id="cu-sms" className="p-4 rounded-2xl border border-line flex flex-col gap-2">
                  <div className="flex justify-between"><strong className="text-sm">SMS reminder</strong><span className="text-xs text-muted">To {p.phone} · {sms.length} characters</span></div>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Message (you can edit it)<textarea rows={4} value={sms} onChange={(e) => setOw({ ...ow, sms: e.target.value })} className="text-sm font-normal p-3 rounded-xl border border-line" /></label>
                  <div className="flex gap-2 flex-wrap"><button onClick={() => { setSmsLog((l) => ({ ...l, [p.id]: [`${nowTxt()} · ${sms}`, ...(l[p.id] || [])] })); setToast(`Reminder sent to ${p.phone}`); }} className="btn-dark min-h-9 text-xs">{smsLog[p.id]?.length ? 'Send again' : 'Send SMS reminder'}</button><button onClick={() => setOw({ ...ow, sms: '' })} className="btn-ghost min-h-9 text-xs">Reset the wording</button></div>
                  <span className="text-xs text-muted">Payment reminders are service messages, so they go even if the customer has not opted in to SMS offers.</span>
                  {(smsLog[p.id] || []).map((l) => <span key={l} className="text-xs text-sub">📱 {l}</span>)}
                </div>
              </div>
            )}
          </Card>

          <Card title="Credit payment history" sub="Every part payment, with its receipt">
            {pays.filter((x) => x.cust === p.name).length === 0 ? <span className="text-sm text-muted">No credit payments recorded yet.</span> : pays.filter((x) => x.cust === p.name).map((x) => <div key={x.id} className="flex items-center gap-3 p-3 rounded-2xl border border-line text-sm flex-wrap"><span>💵</span><span className="flex-1 min-w-[200px]"><b>Part payment on sale #{x.sale}</b><br /><span className="text-xs text-muted">{x.at} · {x.method}{x.ref ? ` · ${x.ref}` : ''} · by {x.by}</span></span><b>{ghs(x.amt)}</b><span className="text-xs text-muted">{ghs(x.left)} left</span><button onClick={() => { setPaper('A5'); setRcpt(x); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">🧾 Receipt</button><button onClick={() => { setPaper('A4'); setRcpt(x); }} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: '#0b5c5c' }}>A5 / A4 receipt</button></div>)}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Marketing consent">
              {([['sms', 'Order updates and offers', 'SMS · order updates, offers and reminders'], ['whatsapp', 'Receipts and offers', 'WhatsApp · receipts, offers and updates'], ['email_ok', 'Newsletter', 'Email · newsletter and receipts']] as const).map(([k, l, n]) => (
                <div key={k} className="flex items-center justify-between gap-3"><span className="flex flex-col"><b className="text-sm">{l}</b><span className="text-xs text-muted">{n}</span></span><button role="switch" aria-checked={p[k]} aria-label={l} onClick={() => upd({ [k]: !p[k] } as Partial<Customer>)} className={cx('w-12 h-7 rounded-full relative transition-colors', p[k] ? 'bg-ok' : 'bg-[#cccccc]')}><span className={cx('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', p[k] ? 'left-6' : 'left-1')} /></button></div>
              ))}
            </Card>
            <Card title="🎁 Discount codes & gifts" actions={<div className="flex gap-2"><button onClick={() => upd({ codes: [{ code: `${p.name.split(' ')[0].toUpperCase()}10-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, txt: '10% off · issued by ' + me, used: false }, ...p.codes] })} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">Issue 10% code</button><button onClick={() => upd({ gifts: [{ what: 'GHS 20 gift voucher', txt: 'Added by ' + me, given: false }, ...p.gifts] })} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">Add gift voucher</button></div>}>
              <span className="text-xs text-muted">Earned automatically from till purchases: a 5% code every 5th purchase and a GHS 20 gift voucher for every GHS 1,000 spent. Codes are used at Sell Now.</span>
              {!p.codes.length && !p.gifts.length && <span className="text-sm text-muted">No codes or gifts yet.</span>}
              {p.codes.map((k) => <div key={k.code} className="flex justify-between text-sm"><span><b>{k.code}</b> · {k.txt}</span><span className={cx('pill', k.used ? 'bg-canvas text-muted' : 'bg-green-100 text-green-800')}>{k.used ? 'Used' : 'Active'}</span></div>)}
              {p.gifts.map((g, i) => <div key={i} className="flex justify-between items-center text-sm gap-2"><span>{g.what} · {g.txt}</span>{g.given ? <span className="pill bg-canvas text-muted">Given</span> : <button onClick={() => upd({ gifts: p.gifts.map((x, j) => (j === i ? { ...x, given: true } : x)) })} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Mark given</button>}</div>)}
            </Card>
          </div>

          <Card title="Recent orders" actions={<div className="flex gap-2"><button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...p, purchases: hist.slice(0, 50) }, null, 2)], { type: 'application/json' })); a.download = `${p.name}.json`; a.click(); }} className="btn-ghost min-h-9 text-xs">Export customer data</button>{role === 'superuser' && <button onClick={() => setDel(true)} className="btn min-h-9 text-xs border border-danger text-danger">Delete customer record</button>}</div>}>
            {role !== 'superuser' && <span className="text-xs text-muted">🔒 Customer records can only be deleted by the Admin.</span>}
            {del && <div className="p-3 rounded-2xl bg-red-50 flex items-center gap-2 flex-wrap text-sm"><span className="flex-1">Delete {p.name}? Their purchases stay in the sales record without their name.</span><button onClick={() => { setList((L) => L.filter((c) => c.id !== p.id)); setDel(false); setSel(''); setToast('Customer record deleted'); }} className="btn bg-danger text-white min-h-9 text-xs">Yes, delete this record</button><button onClick={() => setDel(false)} className="btn-ghost min-h-9 text-xs">Keep it</button></div>}
            {hist.slice(0, 6).map((s) => <div key={s.no} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span><b>#{s.no}</b> <span className="text-muted">{s.ch === 'web' ? 'Website' : 'Till'} · {new Date(s.ts).toLocaleDateString('en-GB')}</span></span><b>{ghs(s.total)}</b></div>)}
            {!hist.length && <span className="text-sm text-muted">No purchases yet.</span>}
          </Card>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Loyalty programme"><span className="text-sm">1 point per GHS 10 · 100 points = GHS 5 off</span><span className="text-sm">Tiers: Bronze · Silver (GHS 2,000/yr) · Gold (GHS 5,000/yr)</span><span className="text-sm text-muted">Works at the till and online</span></Card>
        <Card title="Automations">{[['Birthday offer on WhatsApp', true], ['Win-back after 60 days', true], ['Referral reward GHS 20 each', false], ['Ask for a 1–5 rating after delivery', true]].map(([l, on]) => <label key={l as string} className="flex items-center gap-2.5 text-sm"><input type="checkbox" defaultChecked={on as boolean} className="w-4 h-4 accent-[#0b5c5c]" />{l as string}</label>)}</Card>
      </div>

      {rcpt && (() => { const sale = p.credits.find((k) => k.no === rcpt.sale); const tot = sale?.total || rcpt.amt + rcpt.left; const paidPct = Math.round(((tot - rcpt.left) / tot) * 100); return (
        <div className="fixed inset-0 z-[600] overflow-y-auto p-4 sm:p-8" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="no-print mx-auto mb-3 flex gap-2 justify-end flex-wrap" style={{ maxWidth: paper === 'A5' ? 560 : 794 }}>
            <div className="flex gap-1 p-1 rounded-full bg-white/15">{(['A5', 'A4'] as const).map((k) => <button key={k} aria-pressed={paper === k} onClick={() => setPaper(k)} className="h-9 px-4 rounded-full text-sm font-semibold" style={paper === k ? { background: '#0b5c5c', color: '#fff' } : { color: '#fff' }}>{k} receipt</button>)}</div>
            <button onClick={() => window.print()} className="h-10 px-4 rounded-full bg-white text-black text-sm font-semibold">Print or save as PDF</button><button onClick={() => setRcpt(null)} className="h-10 px-4 rounded-full bg-white/15 text-white text-sm">Close</button>
          </div>
          <article className="print-doc mx-auto bg-white overflow-hidden text-[13px]" style={{ maxWidth: paper === 'A5' ? 560 : 794, borderRadius: 14 }}>
            <div className="text-white p-6 flex justify-between gap-4 flex-wrap" style={{ background: 'linear-gradient(110deg,#000 70%,#1f7a2a 70%)' }}>
              <div className="flex gap-3 items-center"><CompanyLogo onDark className="w-14 h-14" /><div className="flex flex-col text-xs text-white/80"><strong className="text-base text-white">{COMPANY.name}</strong><span>{COMPANY.addr}</span><span>Tel: {COMPANY.tel}</span><span>Email: {COMPANY.email}</span></div></div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex justify-between gap-4 flex-wrap"><div className="flex flex-col"><span className="text-[11px] font-bold tracking-[0.12em]" style={{ color: '#1f7a2a' }}>OFFICIAL RECEIPT</span><strong className="text-xl">Credit payment receipt</strong></div><div className="text-right text-xs flex flex-col"><span>No. <b>{rcpt.id}</b></span><span>{rcpt.at}</span></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl p-3" style={{ background: '#f6f7f8' }}><span className="text-[11px] uppercase text-[#5f5c5a] font-semibold">Received from</span><br /><b>{rcpt.cust}</b><br />{p.phone}</div><div className="rounded-xl p-3" style={{ background: '#f6f7f8' }}><span className="text-[11px] uppercase text-[#5f5c5a] font-semibold">For</span><br /><b>Credit sale #{rcpt.sale}</b><br />{sale ? `Goods ${ghs(sale.total)} · due ${sale.due}` : ''}</div></div>
              <div className="rounded-2xl bg-black text-white p-5"><span className="text-xs text-white/70">Amount received</span><br /><strong style={{ fontSize: 28 }}>{ghs(rcpt.amt)}</strong><br /><span className="text-xs text-white/80">{wordsGhs(rcpt.amt)}</span></div>
              <div className="flex flex-col">{[['Paid by', rcpt.method + (rcpt.ref ? ` · ${rcpt.ref}` : '')], ['Sale total', ghs(tot)], ['Paid so far', ghs(tot - rcpt.left)], ['Still owed on this sale', ghs(rcpt.left)]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-[#ebebeb] py-1.5"><span>{k}</span><b>{v}</b></div>)}</div>
              <div className="flex flex-col gap-1"><span className="text-xs">Paid so far on this sale {paidPct}%</span><div className="h-2 rounded-full bg-[#ebebeb] overflow-hidden"><div className="h-full" style={{ width: `${paidPct}%`, background: '#1f7a2a' }} /></div></div>
              <div className="flex justify-between items-end text-xs mt-4 gap-4"><span className="border-t border-black pt-1 flex-1">Received by · {rcpt.by}</span><StampSvg s={stamp} size={110} /><span className="border-t border-black pt-1 flex-1 text-right">Paid by · {rcpt.cust}</span></div>
              <p className="text-xs text-[#5f5c5a] text-center m-0">Thank you for your payment. Keep this receipt as proof of payment · {COMPANY.name}</p>
            </div>
          </article>
        </div>
      ); })()}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}
