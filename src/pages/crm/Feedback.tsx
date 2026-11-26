// Feedback & complaints (§5.8): ratings, complaints with SLA, escalation to Tickets, close the loop.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { readKey, writeKey } from '../../lib/persist';
import { cx, ghs } from '../../lib/format';
import { BR, STAFF, ROLE_NAME, addNote, audit, firstName, fmtWhen, logMessage, phoneKey, request, scoped, uid, type Feedback as FB, type Task } from './model';
import { Bars, Chips, Empty, Head, Lock, Pill, Toastish, btnG, btnP, btnS, inp, type Crm } from './ui';
import { useWeb } from '../../data/web';
import { pushWebCode, setReviewHidden } from './web';

const CATS = ['Waiting time', 'Pricing', 'Faulty product', 'Delivery', 'Staff attitude', 'Stock', 'Other'];

export default function Feedback({ m }: { m: Crm }) {
  const { c } = m; const staff = c.role === 'staff';
  const [W] = useWeb();
  const rv = (id?: string) => (id ? W.reviews.find((r) => r.id === id) : undefined);
  const toggleReview = (f: FB) => { const r = rv(f.reviewId); if (!r) return; setReviewHidden(r.id, !r.hidden); addNote(c, f.customerPhone, 'system', `${r.hidden ? 'Showed' : 'Hid'} their webstore review`); audit(c, 'CRM webstore review', `${r.hidden ? 'Shown' : 'Hidden'} · ${r.name} · ${r.stars} stars`); setMsg(r.hidden ? `${f.customer}’s review is showing on the webstore again` : `${f.customer}’s review is hidden on the webstore · you can show it again any time`); };
  const ReviewLine = ({ f }: { f: FB }) => { const r = rv(f.reviewId); if (!r) return null; return <div className="flex items-center gap-2 flex-wrap text-xs p-2.5 rounded-2xl bg-[#f2f4f5]"><span className="flex-1 min-w-[160px]">Webstore review · {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)} · {r.hidden ? 'Hidden on the webstore' : 'Showing on the webstore'}{r.flagged ? ' · flagged' : ''}</span>{!staff && <button onClick={() => toggleReview(f)} className="h-8 px-3 rounded-full bg-white border border-line font-semibold">{r.hidden ? 'Show on webstore' : 'Hide on webstore'}</button>}</div>; };
  const [tab, setTab] = useState<'complaints' | 'ratings'>('complaints');
  const [stF, setStF] = useState<'open' | 'all'>('open');
  const [log, setLog] = useState({ q: '', phone: '', name: '', rating: 0, comment: '', channel: 'Till', kind: 'rating' as FB['kind'], category: 'Waiting time', err: '' });
  const [gift, setGift] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');
  const F = scoped(m.feedback, c, m.vb);
  const complaints = F.filter((f) => f.kind === 'complaint' && (stF === 'all' || f.status !== 'resolved')).sort((a, b) => a.slaDueAt - b.slaDueAt);
  const ratings = F.filter((f) => f.rating);
  const avg = (L: FB[]) => (L.length ? L.reduce((a, f) => a + f.rating, 0) / L.length : 0);
  const up = (id: string, p: Partial<FB>) => m.setFeedback(m.feedback.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const save = () => {
    const cu = m.custs.find((x) => phoneKey(x.phone) === phoneKey(log.phone));
    if (!cu && (log.name.trim().length < 2)) return setLog({ ...log, err: 'Pick the customer or type their name.' });
    if (!log.rating) return setLog({ ...log, err: 'Choose a rating from 1 to 5.' });
    const f: FB = { id: uid('FB'), customerPhone: cu?.phone || log.phone, customer: cu?.name || log.name.trim(), rating: log.rating, comment: log.comment.trim(), channel: log.channel, branch: c.role === 'superuser' ? cu?.br || 'osu' : c.br, staff: c.me, kind: log.kind, category: log.kind === 'complaint' ? log.category : undefined, status: log.kind === 'complaint' ? 'open' : 'resolved', at: Date.now(), slaDueAt: Date.now() + m.settings.slaHours.complaint * 36e5 };
    m.setFeedback([f, ...m.feedback]); if (f.customerPhone) addNote(c, f.customerPhone, 'feedback', `${f.rating}/5 · ${f.comment || f.category || ''}`);
    setLog({ q: '', phone: '', name: '', rating: 0, comment: '', channel: 'Till', kind: 'rating', category: 'Waiting time', err: '' });
    setMsg(f.kind === 'complaint' ? 'Complaint logged · your Supervisor handles it first' : 'Thank you · feedback logged');
  };
  const escalateTicket = (f: FB) => {
    const T = readKey<{ id: string }[]>('ecompos.tickets2', []); const id = 'T-' + (1043 + T.length);
    writeKey('ecompos.tickets2', [{ id, area: 'Customer complaint', br: f.branch, title: `${f.customer} · ${f.category}`, body: f.comment, by: c.me, byLevel: ROLE_NAME[c.role], at: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) + ' ' + new Date().toTimeString().slice(0, 5), status: 'open', pri: f.rating <= 1 ? 'High' : 'Normal', ref: f.id, to: 'admin', forwarded: false, updates: [] }, ...T]);
    up(f.id, { ticketId: id, status: 'in progress' }); audit(c, 'CRM escalation', `${f.id} escalated to ticket ${id}`); setMsg(`Issue ticket ${id} opened · linked both ways`);
  };
  const escalateManager = (f: FB) => {
    const mgr = STAFF.find((s) => s.role === 'manager' && s.br === f.branch)?.name || 'Ama Darko';
    const t: Task = { id: uid('TK'), type: 'Call', title: `Escalated complaint · ${f.customer} · ${f.category}`, relatedTo: { kind: 'feedback', id: f.id, name: f.customer }, assignee: mgr, assignedBy: c.me, branch: f.branch, dueAt: Date.now() + 4 * 36e5, status: 'open', auto: false, source: 'Escalated by Supervisor' };
    m.setTasks([t, ...m.tasks]); up(f.id, { status: 'in progress' }); setMsg(`Escalated to ${mgr}`);
  };
  const closeLoop = (f: FB) => {
    const val = gift[f.id] || 20; const cu = m.custs.find((x) => phoneKey(x.phone) === phoneKey(f.customerPhone));
    if (c.caps.gift === 'request' || (c.caps.gift === 'limit' && val > m.settings.limits.supGift)) { request('gift', `Apology voucher GHS ${val} for ${f.customer} (${f.id})`, c, { feedback: f.id, value: val }); return setMsg(c.caps.gift === 'request' ? 'Asked your Supervisor to send the apology voucher' : `Over your limit of ${ghs(m.settings.limits.supGift)} · sent to Approvals`); }
    const code = `SORRY${val}-${firstName(f.customer).toUpperCase().slice(0, 4)}${Math.floor(Math.random() * 90 + 10)}`;
    if (cu) m.setCusts(m.custs.map((x) => (x.id === cu.id ? { ...x, codes: [{ code, txt: `GHS ${val} off · apology for ${f.category?.toLowerCase() || 'your experience'}`, used: false }, ...x.codes] } : x)));
    if (cu?.sms) logMessage(c, 'SMS', cu.phone, `Hello ${firstName(f.customer)}, we are sorry about your recent experience. Please enjoy GHS ${val} off with code ${code} in store or online. Reply STOP to opt out.`, 1, 'Apology');
    pushWebCode({ code, value: val, note: `Apology · ${f.customer} · ${f.id}`, by: c.me, only: phoneKey(f.customerPhone).length === 9 ? f.customerPhone : undefined, days: 30 });
    up(f.id, { status: 'resolved', apology: code }); addNote(c, f.customerPhone, 'system', `Apology code ${code} sent · works in store and on the webstore · complaint ${f.id} closed`); audit(c, 'CRM apology code', `${code} for ${f.customer}`);
    setMsg(`Apology code ${code} sent${cu?.sms ? ' by SMS' : ''} · complaint closed · the code also works at the webstore checkout`);
  };
  const LogForm = (
    <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3" aria-labelledby="lf-h">
      <h2 id="lf-h" className="m-0 text-lg font-semibold">Log feedback</h2>
      <label className="text-[13px] font-semibold flex flex-col gap-1">Customer<input value={log.q} onChange={(e) => setLog({ ...log, q: e.target.value, err: '' })} placeholder="Find by name or phone" className={inp} /></label>
      {log.q.trim().length >= 2 && m.custs.filter((x) => `${x.name} ${x.phone}`.toLowerCase().includes(log.q.toLowerCase())).slice(0, 5).map((x) => <button key={x.id} onClick={() => setLog({ ...log, phone: x.phone, name: x.name, q: '' })} className="text-left text-sm p-2 rounded-xl hover:bg-[#f6f7f8]">{x.name} · {x.phone}</button>)}
      {log.name ? <Pill t={`${log.name}${log.phone ? ` · ${log.phone}` : ''}`} tone="teal" /> : <input aria-label="Customer name (not in Customers)" value={log.name} onChange={(e) => setLog({ ...log, name: e.target.value })} placeholder="Or type a name" className={inp} />}
      <Chips label="Type" value={log.kind} onChange={(v) => setLog({ ...log, kind: v })} opts={[['rating', 'Rating'], ['complaint', 'Complaint']]} />
      <div role="radiogroup" aria-label="Rating" className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={log.rating === n} onClick={() => setLog({ ...log, rating: n, err: '' })} className={cx('w-12 h-12 rounded-full border text-base font-semibold', log.rating >= n ? 'bg-black text-white border-black' : 'bg-white border-line')}>{n}</button>)}<span className="self-center text-sm text-muted">{log.rating ? `${log.rating} of 5` : 'Tap 1 to 5'}</span></div>
      {log.kind === 'complaint' && <label className="text-[13px] font-semibold flex flex-col gap-1">What about?<select value={log.category} onChange={(e) => setLog({ ...log, category: e.target.value })} className={inp}>{CATS.map((x) => <option key={x}>{x}</option>)}</select></label>}
      <label className="text-[13px] font-semibold flex flex-col gap-1">Channel<select value={log.channel} onChange={(e) => setLog({ ...log, channel: e.target.value })} className={inp}>{['Till', 'Delivery', 'Phone', 'WhatsApp', 'Website'].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="text-[13px] font-semibold flex flex-col gap-1">What they said<textarea rows={3} value={log.comment} onChange={(e) => setLog({ ...log, comment: e.target.value })} className="p-3 rounded-2xl border border-line text-sm font-normal" /></label>
      {log.err && <span role="alert" className="text-sm text-danger">{log.err}</span>}
      <button onClick={save} className={cx(btnP, 'min-h-12')}>Save feedback</button>
    </section>
  );
  if (staff) return (
    <>
      <Head title="Log feedback" sub="Record what customers tell you · complaints go to your Supervisor first" />
      <div className="grid gap-5 lg:grid-cols-2 items-start">{LogForm}
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-2"><h2 className="m-0 text-lg font-semibold">What you logged</h2>{F.map((f) => <div key={f.id} className="flex items-center gap-3 text-sm border-t border-line pt-2"><span className="flex-1">{f.customer} · {f.rating}/5{f.comment ? ` · ${f.comment}` : ''}<br /><span className="text-xs text-muted">{f.channel} · {fmtWhen(f.at)}</span></span><Pill t={f.kind === 'complaint' ? (f.status === 'resolved' ? 'Resolved' : 'Being handled') : 'Rating'} tone={f.kind === 'complaint' ? (f.status === 'resolved' ? 'ok' : 'warn') : 'mute'} /></div>)}{!F.length && <Empty text="Nothing logged yet." />}</section>
      </div>
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  return (
    <>
      <Head title="Feedback & complaints" sub={`Ratings after till sales and deliveries, and complaints with a ${m.settings.slaHours.complaint}-hour response time · ${c.role === 'superuser' ? (m.vb === 'all' ? 'all branches' : BR[m.vb]) : 'My branch'}`} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Average rating</span><br /><strong className="text-2xl font-semibold">{avg(ratings).toFixed(1)} / 5</strong><br /><span className="text-xs text-muted">{ratings.length} ratings</span></div>
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Open complaints</span><br /><strong className="text-2xl font-semibold" style={{ color: '#b26a00' }}>{F.filter((f) => f.kind === 'complaint' && f.status !== 'resolved').length}</strong></div>
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Past response time</span><br /><strong className="text-2xl font-semibold" style={{ color: '#c62828' }}>{F.filter((f) => f.kind === 'complaint' && f.status !== 'resolved' && f.slaDueAt < Date.now()).length}</strong></div>
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Resolved</span><br /><strong className="text-2xl font-semibold" style={{ color: '#1f7a2a' }}>{F.filter((f) => f.kind === 'complaint' && f.status === 'resolved').length}</strong></div>
      </div>
      <Chips label="Section" value={tab} onChange={setTab} opts={[['complaints', 'Complaints'], ['ratings', 'Ratings']]} />
      {tab === 'complaints' ? <div className="grid gap-5 xl:grid-cols-[1fr_400px] items-start">
        <section className="flex flex-col gap-3">
          <Chips label="Status" value={stF} onChange={setStF} opts={[['open', 'Open'], ['all', 'All']]} />
          {complaints.map((f) => { const left = Math.round((f.slaDueAt - Date.now()) / 36e5); const limitGift = c.caps.gift === 'limit'; return (
            <article key={f.id} className="bg-white rounded-[20px] shadow-card p-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-2 flex-wrap"><span><b>{f.customer}</b> · {f.category} · {BR[f.branch]}<br /><span className="text-xs text-muted">{f.id} · {f.channel} · served by {f.staff} · {fmtWhen(f.at)}</span></span><span className="flex gap-1.5 items-start flex-wrap">{f.status === 'resolved' ? <Pill t="Resolved" tone="ok" /> : <Pill t={left < 0 ? `${-left} h past response time` : `${left} h left`} tone={left < 0 ? 'bad' : left < 6 ? 'warn' : 'mute'} />}<Pill t={`${f.rating}/5`} /></span></div>
              {f.comment && <p className="m-0">“{f.comment}”</p>}
              <ReviewLine f={f} />
              {f.ticketId && <span className="text-xs">Linked Issue ticket <Link to="/tickets" className="underline font-semibold">{f.ticketId}</Link></span>}
              {f.apology && <span className="text-xs" style={{ color: '#1f7a2a' }}>Apology code {f.apology} sent</span>}
              {f.status !== 'resolved' && <div className="flex gap-2 flex-wrap items-center">
                {f.status === 'open' && <button onClick={() => { up(f.id, { status: 'in progress' }); setMsg(`You are handling ${f.customer}’s complaint`); }} className={btnG}>I’m handling it</button>}
                {c.role === 'supervisor' && <button onClick={() => escalateManager(f)} className={btnG}>Escalate to Manager</button>}
                {!f.ticketId && <button onClick={() => escalateTicket(f)} className={btnG}>Escalate to ticket</button>}
                <select aria-label="Apology voucher value" value={gift[f.id] || 20} onChange={(e) => setGift({ ...gift, [f.id]: Number(e.target.value) })} className="h-10 rounded-full border border-line px-3 text-[13px]">{[10, 20, 50, 100, 200].map((v) => <option key={v} value={v}>GHS {v}{limitGift && v > m.settings.limits.supGift ? ' · needs approval' : ''}</option>)}</select>
                <button onClick={() => closeLoop(f)} className={btnS}>Close the loop</button>
                <button onClick={() => { up(f.id, { status: 'resolved' }); addNote(c, f.customerPhone, 'system', `Complaint ${f.id} resolved`); setMsg('Marked resolved'); }} className={btnP}>Resolve</button>
              </div>}
            </article>
          ); })}
          {!complaints.length && <Empty text="No open complaints. Customers are happy." />}
        </section>
        {LogForm}
      </div> : <div className="grid gap-5 xl:grid-cols-2 items-start">
        {F.some((f) => f.reviewId && f.kind === 'rating') && <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3 xl:col-span-2" aria-label="Webstore reviews"><h2 className="m-0 text-lg font-semibold">Webstore reviews</h2><span className="text-xs text-muted -mt-2">Reviews customers wrote on the online store. Hiding one here hides it in Post to webstore › Reviews too.</span>{F.filter((f) => f.reviewId && f.kind === 'rating').map((f) => <div key={f.id} className="flex flex-col gap-1.5 text-sm border-b border-line pb-3 last:border-0"><span><b>{f.customer}</b> · {BR[f.branch]} · <span className="text-xs text-muted">{fmtWhen(f.at)}</span></span>{f.comment && <span>“{f.comment}”</span>}<ReviewLine f={f} /></div>)}</section>}
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">By branch</h2><Bars rows={Object.keys(BR).filter((b) => c.role === 'superuser' || b === c.br).map((b) => [BR[b], Number(avg(ratings.filter((f) => f.branch === b)).toFixed(1)), `${ratings.filter((f) => f.branch === b).length} ratings`])} /></section>
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">By staff</h2><Bars rows={Array.from(new Set(ratings.map((f) => f.staff))).filter((n) => c.role !== 'supervisor' || c.team.includes(n)).map((n) => [n, Number(avg(ratings.filter((f) => f.staff === n)).toFixed(1)), `${ratings.filter((f) => f.staff === n).length}`])} /></section>
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">By channel</h2><Bars rows={Array.from(new Set(ratings.map((f) => f.channel))).map((ch) => [ch, Number(avg(ratings.filter((f) => f.channel === ch)).toFixed(1))])} /></section>
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">Trend · last 7 days</h2><Bars rows={days.map((d) => { const L = ratings.filter((f) => new Date(f.at).toDateString() === d.toDateString()); return [d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), Number(avg(L).toFixed(1)), L.length ? `${L.length} ratings` : 'none'] as [string, number, string]; })} /></section>
      </div>}
      {c.role === 'supervisor' && <Lock text={`You can send apology vouchers up to ${ghs(m.settings.limits.supGift)}. Larger ones go to Approvals.`} />}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}
