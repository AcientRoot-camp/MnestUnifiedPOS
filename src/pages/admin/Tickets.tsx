import { useState } from 'react';
import { PEOPLE } from '../../data/nav';
import { brName, now } from '../../data/catalogue';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx } from '../../lib/format';
import { Pills } from '../finance/shared';
import { Msg } from '../money/ui';

type St = 'open' | 'review' | 'progress' | 'waiting' | 'resolved' | 'closed';
type Tk = { id: string; area: string; br: string; title: string; body: string; by: string; byLevel: string; at: string; status: St; pri: 'Normal' | 'High' | 'Urgent'; ref: string; to: 'admin' | 'support'; forwarded: boolean; updates: { who: string; t: string; at: string }[] };
const TK0: Tk[] = [
  { id: 'T-1042', area: 'Sale', br: 'osu', title: 'MoMo payment taken but sale still shows unpaid', body: 'Customer paid GHS 860.00 by MTN MoMo and got the SMS, but the till kept waiting and I had to take the sale again as cash. The customer was charged once only.', by: 'Akua Kyei', byLevel: 'Sales staff', at: '27/10 14:20', status: 'review', pri: 'High', ref: 'S-2610270118', to: 'admin', forwarded: false, updates: [{ who: 'Akua Kyei', t: 'Reported the issue', at: '27/10 14:20' }, { who: 'Ebenezer Mensah', t: 'Started review · checking Hubtel settlement report', at: '27/10 15:05' }] },
  { id: 'T-1041', area: 'System failure', br: 'osu', title: 'Till 2 receipt printer stops after every 3 receipts', body: 'The printer goes offline after three receipts and needs a restart.', by: 'Kwame Asante', byLevel: 'Supervisor', at: '27/10 11:02', status: 'progress', pri: 'Urgent', ref: 'Till 2', to: 'admin', forwarded: true, updates: [{ who: 'Kwame Asante', t: 'Reported the issue', at: '27/10 11:02' }, { who: 'Ebenezer Mensah', t: 'Forwarded to MNest UnifiedPOS Support (developer)', at: '27/10 11:30' }] },
  { id: 'T-1037', area: 'Stock', br: 'adum', title: 'Transfer from Osu arrived 2 units short', body: 'TR-0086 listed 10 GOtv Supa+ decoders; 8 arrived.', by: 'Abena Mensah', byLevel: 'Supervisor', at: '25/10 12:40', status: 'open', pri: 'Normal', ref: 'TR-0086', to: 'admin', forwarded: false, updates: [{ who: 'Abena Mensah', t: 'Reported the issue', at: '25/10 12:40' }] },
  { id: 'T-1030', area: 'Sale', br: 'legon', title: 'Discount button greyed out for Adjoa', body: '', by: 'Adjoa Badu', byLevel: 'Sales staff', at: '20/10 09:15', status: 'resolved', pri: 'Normal', ref: '', to: 'admin', forwarded: false, updates: [{ who: 'Ebenezer Mensah', t: 'Resolved · permission switched on', at: '20/10 10:00' }] },
];
const STEPS: [St, string][] = [['open', 'Reported'], ['review', 'Under review'], ['progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']];
const PRI = { Normal: ['🔵', 'bg-blue-50 text-blue-800', 'border-l-[#0b6bcb]'], High: ['🟠', 'bg-orange-50 text-orange-800', 'border-l-[#e65100]'], Urgent: ['🔴', 'bg-red-50 text-red-800', 'border-l-danger'] } as const;
const ST_TXT: Record<St, string> = { open: 'Open', review: 'Under review', progress: 'In progress', waiting: 'Waiting for reporter', resolved: 'Resolved', closed: 'Closed' };

export default function Tickets() {
  const { session } = useSession();
  const role = (session?.role ?? 'superuser') as string;
  const SU = role === 'superuser';
  const DEV = role === 'developer';
  const me = DEV ? 'MNest UnifiedPOS Support' : PEOPLE[role as 'superuser'].name;
  const myLevel = DEV ? 'Developer' : PEOPLE[role as 'superuser'].level;
  const [L, setL] = usePersist<Tk[]>('ecompos.tickets2', TK0);
  const [f, setF] = useState('active');
  const [sel, setSel] = useState('');
  const [comment, setComment] = useState('');
  const [nt, setNt] = useState<null | { title: string; area: string; pri: Tk['pri']; body: string; ref: string }>(null);
  const [msg, setMsg] = useState('');
  // Visibility rules from the build spec.
  const mine = L.filter((t) => (DEV ? t.forwarded || t.to === 'support' : SU ? true : t.by === me));
  const shown = mine.filter((t) => f === 'all' || (f === 'active' ? !['resolved', 'closed'].includes(t.status) : t.status === f));
  const cur = mine.find((t) => t.id === sel) ?? shown[0];
  const up = (id: string, p: Partial<Tk>, t: string) => { setL((x) => x.map((y) => (y.id === id ? { ...y, ...p, updates: [...y.updates, { who: me, t, at: now() }] } : y))); setMsg(t); };
  const stepIdx = cur ? Math.max(0, STEPS.findIndex((s) => s[0] === (cur.status === 'waiting' ? 'review' : cur.status))) : 0;
  const alerts = cur ? Array.from(new Set([cur.by, ...(cur.br === 'osu' ? ['Ama Darko', 'Kwame Asante', 'Kwesi Ofori'] : cur.br === 'legon' ? ['Efua Sarpong', 'Nana Ampofo'] : ['Yaw Boakye', 'Abena Mensah'])])).join(', ') : '';
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Issue tickets</h1><p className="m-0 text-sm text-muted">{DEV ? 'Tickets forwarded by the Admin, and tickets the Admin raised, come to you.' : SU ? 'Tickets from your Manager, Supervisor and Sales staff come to you. Resolve them or forward them to MNest UnifiedPOS Support. Your own tickets go straight to MNest UnifiedPOS Support.' : 'Report a problem to the Admin. You only see the tickets you raised.'}</p></header>
      {!DEV && <button onClick={() => setNt({ title: '', area: 'Sale', pri: 'Normal', body: '', ref: '' })} className="btn-primary w-fit shadow-[0_6px_20px_rgba(84,51,235,0.25)]">{SU ? 'Raise a ticket to MNest UnifiedPOS Support' : 'Report an issue to the Admin'}</button>}
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[['Open tickets', mine.filter((t) => t.status === 'open').length, 'bg-white text-black'], ['Under review', mine.filter((t) => t.status === 'review').length, 'bg-brand text-white'], ['Urgent', mine.filter((t) => t.pri === 'Urgent' && !['resolved', 'closed'].includes(t.status)).length, 'bg-danger text-white'], ['Resolved this week', mine.filter((t) => t.status === 'resolved').length, 'bg-ok text-white']].map(([l, v, c]) => <div key={l as string} className={cx('rounded-3xl p-5 shadow-card flex flex-col gap-1', c as string)}><span className="text-[13px] opacity-90">{l as string}</span><strong className="text-[26px] font-medium">{v as number}</strong></div>)}</div>
      <div className="grid gap-6 xl:grid-cols-[520px_1fr] items-start">
        <section className="card p-4 flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold">{DEV ? 'Escalated tickets' : SU ? 'All tickets' : 'My tickets'}</h2>
          <Pills small opts={[['active', 'Active'], ['open', 'Open'], ['review', 'Under review'], ['progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'All']]} value={f} onChange={setF} />
          {!shown.length && <span className="text-sm text-muted">No tickets here.</span>}
          {shown.map((t) => <button key={t.id} onClick={() => setSel(t.id)} className={cx('text-left p-4 rounded-2xl border border-l-4 flex flex-col gap-1.5', PRI[t.pri][2], cur?.id === t.id ? 'border-black' : 'border-line')}><div className="flex justify-between gap-2"><span className="text-xs text-muted">{t.id} · {t.area} · {brName(t.br)}</span><span className={cx('pill', t.status === 'review' ? 'bg-brand text-white' : t.status === 'progress' ? 'bg-black text-white' : t.status === 'resolved' ? 'bg-ok text-white' : 'bg-[#6b6866] text-white')}>{ST_TXT[t.status]}</span></div><b className="text-sm">{t.title}</b><span className="h-1 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${((STEPS.findIndex((s) => s[0] === t.status) + 1) / 5) * 100}%` }} /></span><div className="flex justify-between text-xs"><span className="text-muted">{t.by} · {t.at}</span><span className={cx('pill', PRI[t.pri][1])}>{PRI[t.pri][0]} {t.pri}</span></div></button>)}
        </section>
        {cur && (
          <section className="card p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex justify-between gap-3 flex-wrap"><div><span className="text-xs text-muted">{cur.id} · {cur.area} · opened {cur.at} · response target: reply within {cur.pri === 'Urgent' ? '1 hour' : cur.pri === 'High' ? '4 hours' : '1 day'}</span><h2 className="m-0 text-[22px] font-semibold">{cur.title}</h2><span className="text-sm text-sub">Reported by {cur.by} · {cur.byLevel} · {brName(cur.br)} branch</span></div><span className={cx('pill h-fit border px-3 py-1', PRI[cur.pri][1])}>{PRI[cur.pri][0]} {cur.pri} priority</span></div>
            <div className="grid grid-cols-5 gap-2">{STEPS.map(([k, l], i) => <div key={k} className="flex flex-col gap-1 text-xs"><span className={cx('h-1 rounded-full', i <= stepIdx ? 'bg-brand' : 'bg-line')} /><span className={i === stepIdx ? 'font-semibold' : 'text-muted'}>{l}</span></div>)}</div>
            <div className="px-4 py-3 rounded-2xl bg-brand text-white text-sm"><b>{ST_TXT[cur.status]}</b> {cur.forwarded ? 'MNest UnifiedPOS Support is working on it.' : cur.status === 'resolved' ? 'Fixed. The reporter can close it or reopen it.' : 'The Admin is looking into it. Everyone affected is kept updated.'}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[['Related to', cur.ref || '—'], ['Branch', brName(cur.br)], ['Reported to', cur.forwarded || cur.to === 'support' ? 'MNest UnifiedPOS Support' : 'Ebenezer Mensah · Admin'], ['Alerts go to', alerts]].map(([k, v]) => <div key={k} className="p-3 rounded-2xl bg-canvas text-sm"><span className="text-xs text-muted">{k}</span><br />{v}</div>)}</div>
            {cur.body && <p className="m-0 text-sm">{cur.body}</p>}
            {(SU || DEV) && !['resolved', 'closed'].includes(cur.status) && <div className="p-4 rounded-2xl border border-black flex flex-col gap-2"><b className="text-sm">{DEV ? 'Support actions' : 'Admin actions'}</b><div className="flex gap-2 flex-wrap">{SU && !cur.forwarded && cur.to === 'admin' && <button onClick={() => up(cur.id, { forwarded: true, status: 'review' }, 'Forwarded to MNest UnifiedPOS Support (developer)')} className="btn bg-[#3d3a38] text-white">Forward to MNest UnifiedPOS Support (developer)</button>}<button onClick={() => up(cur.id, { status: 'progress' }, 'Marked in progress')} className="btn-dark">Mark in progress</button><button onClick={() => up(cur.id, { status: 'waiting' }, `Asked ${cur.by} for more details`)} className="btn bg-[#a8492a] text-white">Ask reporter for more</button><button onClick={() => up(cur.id, { status: 'resolved' }, 'Marked resolved')} className="btn bg-ok text-white">Mark resolved</button></div><span className="text-xs text-muted">Every status change alerts the reporter and the {brName(cur.br)} team until the issue is resolved.</span></div>}
            {!SU && !DEV && cur.status === 'resolved' && <div className="p-4 rounded-2xl bg-canvas flex items-center gap-2 flex-wrap text-sm"><span className="flex-1">The Admin marked this resolved. Is it fixed?</span><button onClick={() => up(cur.id, { status: 'closed' }, 'Closed by the reporter')} className="btn-primary min-h-9 text-xs">Yes, close the ticket</button><button onClick={() => up(cur.id, { status: 'open' }, 'Reopened by the reporter')} className="btn-ghost min-h-9 text-xs">No, reopen it</button></div>}
            <div className="flex flex-col gap-2"><b className="text-sm">Updates</b>{cur.updates.map((u, i) => <div key={i} className="flex gap-2 text-sm"><span className={cx('w-2.5 h-2.5 rounded-full mt-1.5', i ? 'bg-brand' : 'bg-black')} /><span><b>{u.who}</b> · {u.t}<br /><span className="text-xs text-muted">{u.at}</span></span></div>)}</div>
            <div className="flex gap-2"><input aria-label="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" className="field py-2.5" /><button onClick={() => { if (comment.trim()) { up(cur.id, {}, comment.trim()); setComment(''); } }} className="btn-dark">Post</button></div>
          </section>
        )}
      </div>
      {nt && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <section role="dialog" aria-modal="true" aria-label="New ticket" className="w-full max-w-lg bg-white rounded-4xl p-6 flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold">{SU ? 'Raise a ticket to MNest UnifiedPOS Support' : 'Report an issue to the Admin'}</h2>
            <label className="text-[13px] font-semibold flex flex-col gap-1">What is wrong<input value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} placeholder="One line, e.g. Till 2 printer stops" className="field py-2 font-normal" /></label>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Area</span><Pills small opts={['Sale', 'Stock', 'System failure', 'Payments', 'Other'].map((a) => [a, a] as [string, string])} value={nt.area} onChange={(v) => setNt({ ...nt, area: v })} /></div>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Priority</span><Pills small opts={[['Normal', 'Normal'], ['High', 'High'], ['Urgent', 'Urgent']]} value={nt.pri} onChange={(v) => setNt({ ...nt, pri: v })} /></div>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Sale, order or till (optional)<input value={nt.ref} onChange={(e) => setNt({ ...nt, ref: e.target.value })} className="field py-2 font-normal" /></label>
            <label className="text-[13px] font-semibold flex flex-col gap-1">What happened<textarea rows={4} value={nt.body} onChange={(e) => setNt({ ...nt, body: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
            <div className="flex gap-2 justify-end"><button onClick={() => setNt(null)} className="btn-ghost">Cancel</button><button onClick={() => { if (nt.title.trim().length < 5) return setMsg('Say in one line what is wrong.'); const t: Tk = { id: 'T-10' + (43 + L.length), area: nt.area, br: session?.branch ?? 'osu', title: nt.title, body: nt.body, by: me, byLevel: myLevel, at: now(), status: 'open', pri: nt.pri, ref: nt.ref, to: SU ? 'support' : 'admin', forwarded: SU, updates: [{ who: me, t: 'Reported the issue', at: now() }] }; setL((x) => [t, ...x]); setNt(null); setSel(t.id); setMsg(SU ? `${t.id} sent to MNest UnifiedPOS Support` : `${t.id} sent to the Admin`); }} className="btn-primary">{SU ? 'Send to MNest UnifiedPOS Support' : 'Send to the Admin'}</button></div>
          </section>
        </div>
      )}
    </>
  );
}
