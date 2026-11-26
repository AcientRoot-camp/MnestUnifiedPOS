import { useState } from 'react';
import { ACCOUNTS, PEOPLE } from '../../data/nav';
import { brName, now } from '../../data/catalogue';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { creds, secLog } from '../../lib/sec';
import { cx, ghs } from '../../lib/format';
import { Card, Pills } from '../finance/shared';
import { Msg } from '../money/ui';
import CrmApprovals from '../crm/ApprovalsCard';
import { applyCountVariance, type CountReq } from '../../lib/stockOps';

/** An approval request. cv: a stock-take variance (lib/stockOps.ts) applied to the stock when approved. */
type Req = CountReq;
type Cred = { id: string; cust: string; br: string; amount: number; paidNow: number; due: string; by: string; at: string; status: 'pending' | 'approved' | 'rejected'; note?: string };
type Issue = { id: string; kind: string; br: string; text: string; by: string; at: string; read: boolean };
/** Demo approval requests (also the starting list Inventory adds stock-take variances to). */
export const REQS0: Req[] = [
  { id: 'DR-0141', kind: 'discount', till: 'Osu · Till 2', br: 'osu', item: 'Hisense 43" Smart TV', price: 3650, asked: 547.5, by: 'Akua Kyei', byRole: 'Sales staff', at: 'Today 09:51', status: 'pending' },
  { id: 'DR-0140', kind: 'below_cost', till: 'Adum · Till 1', br: 'adum', item: 'Nasco 18" Wall Fan × 5', price: 2600, asked: 1900, by: 'Kofi Antwi', byRole: 'Supervisor', at: 'Today 09:20', status: 'pending' },
  { id: 'DR-0139', kind: 'return', till: 'East Legon · Till 1', br: 'legon', item: 'Nasco 18" Wall Fan', price: 520, asked: 520, by: 'Adjoa Badu', byRole: 'Sales staff', at: 'Yesterday 16:10', status: 'pending' },
  { id: 'DR-0138', kind: 'price_change', till: 'Osu · Back office', br: 'osu', item: 'Binatone 16" Standing Fan', price: 430, asked: 450, by: 'Ama Darko', byRole: 'Manager', at: 'Yesterday 11:00', status: 'approved', final: 450 },
];
const C0: Cred[] = [{ id: 'CS-0033', cust: 'Kojo Badu', br: 'legon', amount: 1850, paidNow: 600, due: '30 Nov 2026', by: 'Efua Sarpong', at: 'Today 10:02', status: 'pending' }, { id: 'CS-0032', cust: 'Mansa Boateng', br: 'osu', amount: 480, paidNow: 150, due: '1 Dec 2026', by: 'Akua Kyei', at: 'Yesterday 15:30', status: 'pending' }];
const I0: Issue[] = [{ id: 'IS-012', kind: 'Till shortage', br: 'adum', text: 'Till 1 cash-up GHS 40.00 short on Wednesday', by: 'Kofi Antwi', at: 'Yesterday 21:05', read: false }, { id: 'IS-011', kind: 'Damaged stock', br: 'osu', text: '2 tins of evaporated milk dented on arrival', by: 'Akua Kyei', at: 'Yesterday 09:05', read: true }];
const KIND: Record<string, string> = { count_variance: 'Stock count variance', discount: 'Discount', below_cost: 'Below cost', below_stock: 'Below stock', return: 'Return', refund: 'Refund', price_change: 'Price change' };
const NOTES0 = [{ t: 'Deposit DEP-0215 is waiting for your check', at: 'Today 08:40', read: false }, { t: 'New website order #34422885 for pickup at Osu', at: 'Today 09:40', read: false }, { t: 'Akua Kyei asked for 7 days’ leave', at: 'Yesterday', read: true }];

export default function Approvals() {
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role].name;
  const [R, setR] = usePersist<Req[]>('ecompos.discReq2', REQS0);
  const [C, setC] = usePersist<Cred[]>('ecompos.creditReq2', C0);
  const [I, setI] = usePersist<Issue[]>('ecompos.issues2', I0);
  const [N, setN] = usePersist('ecompos.notes2', NOTES0);
  const [tab, setTab] = useState<'approvals' | 'issues' | 'notes'>('approvals');
  const [rev, setRev] = useState<Req | null>(null);
  const [dec, setDec] = useState<'approve' | 'reduce' | 'reject'>('approve');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [iss, setIss] = useState({ kind: 'damaged', text: '' });
  const [msg, setMsg] = useState('');
  const canDecide = (r: Req) => SU || (role === 'manager' && r.asked <= 200 && r.byRole !== 'Manager');
  const pend = R.filter((r) => r.status === 'pending');
  const [crmReq] = usePersist<{ status: string; branch: string }[]>('ecompos.crm.requests', []);
  const crmPend = crmReq.filter((r) => r.status === 'pending' && (SU || r.branch === session?.branch)).length;
  const decide = () => {
    if (!rev) return;
    if (pin.length !== 6) return setMsg('Confirm with your 6-digit PIN.');
    const acc = ACCOUNTS.find((a) => a.username === session?.username);
    if (!acc || pin !== (creds()[acc.username]?.passcode || acc.passcode)) { secLog('Failed approval PIN', `${me} entered a wrong PIN on ${rev.id}`, 'medium', session?.username || ''); return setMsg('401 Unauthorized · That PIN is not right. The decision was not saved.'); }
    if (dec === 'reduce' && !(parseFloat(amt) > 0 && parseFloat(amt) < rev.asked)) return setMsg(`Enter an amount below ${ghs(rev.asked)}.`);
    if (dec === 'reject' && !note.trim()) return setMsg('Add a note for the seller when you reject.');
    setR((x) => x.map((y) => (y.id === rev.id ? { ...y, status: dec === 'approve' ? 'approved' : dec === 'reduce' ? 'reduced' : 'rejected', final: dec === 'reduce' ? parseFloat(amt) : rev.asked, note } : y)));
    // A stock-take variance changes the stock only now, when it is approved (rejected: the stock stays as it was).
    const cvMsg = rev.cv && dec === 'approve' ? applyCountVariance(rev, me) : '';
    secLog('Approval signed', `${me} ${dec === 'approve' ? 'approved' : dec === 'reduce' ? `approved less (${ghs(parseFloat(amt))})` : 'rejected'} ${rev.id} · ${rev.till} · signed with PIN`, 'low', session?.username || '');
    setMsg(`${rev.id} ${dec === 'approve' ? 'approved' : dec === 'reduce' ? `approved at ${ghs(parseFloat(amt))}` : 'rejected'} · ${rev.till} has been told${cvMsg ? ` · ${cvMsg}` : ''}`);
    setRev(null); setPin(''); setNote(''); setAmt('');
  };
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Approvals & issues</h1><p className="m-0 text-sm text-muted">Discounts, below-cost sales, returns, refunds, price changes and credit sales waiting for a decision, plus issues reported by the branches.</p></header>
      <Pills opts={[['approvals', `Approvals · ${pend.length + C.filter((c) => c.status === 'pending').length + crmPend}`], ['issues', `Issues · ${I.filter((i) => !i.read).length}`], ['notes', `Notifications · ${N.filter((n) => !n.read).length} unread`]]} value={tab} onChange={setTab} />
      <Msg text={msg} onClose={() => setMsg('')} />
      {tab === 'approvals' && (
        <div className="grid gap-6 xl:grid-cols-2 items-start">
          <Card title="Discount requests from the tills" sub={SU ? 'You decide every request' : 'You can approve up to GHS 200.00 from Supervisors and Sales staff'}>
            {R.map((r) => <div key={r.id} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5 text-sm"><div className="flex justify-between gap-2"><span><b>{r.id} · {KIND[r.kind]}</b> <span className="text-xs text-muted">· {r.till} · {r.at}</span></span><span className={cx('pill', r.status === 'pending' ? 'bg-amber-100 text-amber-900' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}>{r.status === 'reduced' ? `Approved ${ghs(r.final ?? 0)}` : r.status}</span></div>{r.cv ? <span>{r.item} · variance {ghs(r.asked)} at cost · counted by {r.by} ({r.byRole}) · the stock changes only when approved</span> : <span>{r.item} · {ghs(r.price)} · asked {r.kind === 'price_change' ? `+${ghs(r.asked)}` : ghs(r.asked)} off by {r.by} ({r.byRole})</span>}{r.note && <span className="text-xs text-muted">Note: {r.note}</span>}{r.status === 'pending' && (canDecide(r) ? <button onClick={() => { setRev(r); setDec('approve'); }} className="btn-dark w-fit min-h-9 text-xs">Review</button> : <span className="text-xs text-muted">Waiting for the Admin</span>)}</div>)}
          </Card>
          <Card title="Credit sale approvals">
            {C.map((c) => <div key={c.id} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5 text-sm"><div className="flex justify-between"><b>{c.id} · {c.cust}</b><span className={cx('pill', c.status === 'pending' ? 'bg-amber-100 text-amber-900' : c.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{c.status}</span></div><span>{ghs(c.amount)} goods · {ghs(c.paidNow)} paid now · {ghs(c.amount - c.paidNow)} due {c.due}</span><span className="text-xs text-muted">{brName(c.br)} · taken by {c.by} · {c.at}</span>{c.status === 'pending' && SU && <div className="flex gap-2"><button onClick={() => { setC((x) => x.map((y) => (y.id === c.id ? { ...y, status: 'approved' } : y))); setMsg(`${c.id} approved · ${c.by} can complete the sale`); }} className="btn bg-ok text-white min-h-9 text-xs">Approve credit sale</button><button onClick={() => { setC((x) => x.map((y) => (y.id === c.id ? { ...y, status: 'rejected' } : y))); setMsg(`${c.id} rejected`); }} className="btn-ghost min-h-9 text-xs text-danger">Reject credit sale</button></div>}</div>)}
          </Card>
          <CrmApprovals />
        </div>
      )}
      {tab === 'issues' && (
        <div className="grid gap-6 xl:grid-cols-2 items-start">
          <Card title="Report an issue"><Pills small opts={[['damaged', 'Damaged stock'], ['pricing', 'Pricing error'], ['shortage', 'Till shortage'], ['other', 'Other']]} value={iss.kind} onChange={(v) => setIss({ ...iss, kind: v })} /><label className="text-[13px] font-semibold flex flex-col gap-1">What happened<textarea rows={3} value={iss.text} onChange={(e) => setIss({ ...iss, text: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></label><button onClick={() => { if (iss.text.trim().length < 5) return setMsg('Say what happened.'); setI((x) => [{ id: 'IS-0' + (13 + x.length), kind: { damaged: 'Damaged stock', pricing: 'Pricing error', shortage: 'Till shortage', other: 'Other' }[iss.kind]!, br: session?.branch ?? 'osu', text: iss.text, by: me, at: now(), read: false }, ...x]); setIss({ ...iss, text: '' }); setMsg('Issue reported'); }} className="btn-primary w-fit">Report issue</button></Card>
          <Card title="Issues" actions={<button onClick={() => setI((x) => x.map((y) => ({ ...y, read: true })))} className="btn-ghost min-h-9 text-xs">Mark all read</button>}>{I.map((i) => <div key={i.id} className={cx('p-3 rounded-2xl text-sm', i.read ? 'bg-canvas' : 'bg-brand-50')}><b>{i.id} · {i.kind}</b> <span className="text-xs text-muted">· {brName(i.br)} · {i.by} · {i.at}</span><br />{i.text}</div>)}</Card>
        </div>
      )}
      {tab === 'notes' && <Card title={`Notifications · ${N.filter((n) => !n.read).length} unread`} actions={<button onClick={() => setN(N.map((n) => ({ ...n, read: true })))} className="btn-ghost min-h-9 text-xs">Mark all read</button>}>{N.map((n, i) => <div key={i} className={cx('p-3 rounded-2xl text-sm flex justify-between gap-2', n.read ? 'bg-canvas' : 'bg-brand-50')}><span>{n.t}</span><span className="text-xs text-muted">{n.at}</span></div>)}</Card>}
      {rev && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <section role="dialog" aria-modal="true" aria-label={`${rev.cv ? 'Review stock count' : 'Review discount request'} ${rev.id}`} className="w-full max-w-md bg-white rounded-4xl p-6 flex flex-col gap-3">
            <div className="flex justify-between"><h2 className="m-0 text-lg font-semibold">{rev.cv ? 'Review stock count' : 'Review discount request'} · {rev.id}</h2><button onClick={() => setRev(null)} aria-label="Close" className="text-xl">×</button></div>
            {rev.cv ? <span className="text-sm">{rev.item}<br />Variance <b>{ghs(rev.asked)}</b> at cost · {rev.till} · counted by {rev.by}. Approving corrects the stock to the count; rejecting keeps the system figure (ask for a recount).</span>
              : <span className="text-sm">{rev.item} · {ghs(rev.price)}<br />{rev.by} asks for <b>{ghs(rev.asked)}</b> {KIND[rev.kind].toLowerCase()} at {rev.till}</span>}
            {/* "Approve less" has no meaning for a stock count: approve applies the counted difference, reject keeps the stock. */}
            <Pills small opts={rev.cv ? [['approve', 'Approve the count'], ['reject', 'Reject · recount']] : [['approve', 'Approve'], ['reduce', 'Approve less'], ['reject', 'Reject']]} value={dec} onChange={setDec} />
            {dec === 'reduce' && <label className="text-[13px] font-semibold flex flex-col gap-1">Approve this amount instead<input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" className="field py-2 font-normal" /></label>}
            <label className="text-[13px] font-semibold flex flex-col gap-1">Note to the seller {dec === 'reject' ? '' : '(optional)'}<input value={note} onChange={(e) => setNote(e.target.value)} className="field py-2 font-normal" /></label>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Confirm with your PIN · {me}<input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className="field py-2 font-normal tracking-[0.5em] text-center" /></label>
            <div className="flex gap-2 justify-end"><button onClick={() => setRev(null)} className="btn-ghost">Decide later</button><button onClick={decide} className={cx('btn', dec === 'reject' ? 'bg-danger text-white' : 'bg-ok text-white')}>{dec === 'reject' ? 'Reject…' : 'Approve'}</button></div>
          </section>
        </div>
      )}
    </>
  );
}
