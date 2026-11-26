// People & HR → People (GTeam.md §4.2): search and branch filter, "+ Add employee" (with the verbatim errors and the
// default pay by role), the staff cards and the employee profile (stats, facts, this week at work, documents, and
// Work badge & QR / Add a review / Book leave / Login & permissions).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRS } from '../../../data/catalogue';
import { inLastDays, type Clock } from '../../../data/clock';
import { staffNoOf } from '../../../data/idcard';
import { ENT, annualTaken, daysBetween, docState, leaveLeft, LEAVE_TYPES, type LeaveReq } from '../../../data/hr';
import { SALES } from '../../../data/sell';
import type { Emp } from '../../../data/people';
import { cx, ghs } from '../../../lib/format';
import { Pills } from '../../finance/shared';
import { Avatar, StateChip, Stat, brTxt, createEmployee, type HrData } from './shared';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Inputs: HR data, staff in view, sign-in codes, the selected person, setters and a message line. */
export default function People({ d, staff, codes, sel, setSel, onBadge, say }: { d: HrData; staff: Emp[]; codes: Record<string, string>; sel: string; setSel: (id: string) => void; onBadge: (name: string) => void; say: (m: string, err?: boolean) => void }) {
  const [q, setQ] = useState('');
  const [br, setBr] = useState('all');
  const [add, setAdd] = useState(false);
  const blank = { name: '', title: '', phone: '', pay: '', br: BRS[0].id as string, contract: 'Full-time' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const list = staff.filter((e) => (br === 'all' || e.br === br) && (!q.trim() || `${e.name} ${e.title} ${brTxt(e.br)}`.toLowerCase().includes(q.toLowerCase())));
  const p = staff.find((e) => e.id === sel);
  const onDuty = (n: string) => inLastDays(d.clock, 1).find((c) => c.name === n && !c.outTs);
  const save = () => {
    if (f.name.trim().split(/\s+/).length < 2) return setErr('Enter the employee’s full name.');
    if (d.E.some((e) => e.name.toLowerCase() === f.name.trim().toLowerCase())) return setErr('Somebody with that name already works here.');
    const { e } = createEmployee(d, { name: f.name, title: f.title, phone: f.phone, pay: parseFloat(f.pay) || 0, br: f.br, contract: f.contract });
    setAdd(false); setF(blank); setErr(''); say(`${e.name} added · staff number and sign-in code created · onboarding started`); setSel(e.id);
  };
  if (p) return <Profile d={d} e={p} code={codes[p.name]} close={() => setSel('')} onBadge={onBadge} say={say} />;
  const inp = 'h-11 px-4 rounded-full border border-line text-sm font-normal w-full';
  return (
    <section className="card p-5 flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name, role or branch" aria-label="Search people" className={cx(inp, 'flex-1 min-w-[220px] w-auto')} /><button onClick={() => { setAdd(!add); setErr(''); }} className="btn-primary">+ Add employee</button></div>
      <Pills small opts={[['all', 'All'], ...BRS.map((b) => [b.id, b.name] as [string, string])]} value={br} onChange={setBr} />
      {add && (
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
          <b>Add employee</b>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold flex flex-col gap-1">Full name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Afia Boateng" className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Job title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Cashier" className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Phone<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+233 24 000 0000" className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Monthly pay (GHS)<input inputMode="decimal" value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value.replace(/[^\d.]/g, '') })} placeholder="e.g. 2400" className={inp} /></label>
          </div>
          <span className="text-xs text-muted">Left blank, pay follows the role: Superuser 6,500 · Branch manager 4,200 · Supervisor 2,800 · Sales staff 2,400 · Rider 1,800 · Stock clerk 2,100.</span>
          <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold">Branch</span><Pills small opts={BRS.map((b) => [b.id, b.name] as [string, string])} value={f.br} onChange={(v) => setF({ ...f, br: v })} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold">Contract</span><Pills small opts={[['Full-time', 'Full-time'], ['Part-time', 'Part-time'], ['Casual', 'Casual']]} value={f.contract} onChange={(v) => setF({ ...f, contract: v })} /></div>
          {err && <span role="alert" className="text-sm text-danger">{err}</span>}
          <div className="flex gap-2"><button onClick={() => { setAdd(false); setErr(''); }} className="btn-ghost">Cancel</button><button onClick={save} className="btn-primary">Save employee</button></div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((e) => { const od = onDuty(e.name); return (
        <button key={e.id} onClick={() => setSel(e.id)} className="rounded-2xl border border-line p-3.5 flex items-center gap-3 text-left hover:bg-canvas">
          <Avatar e={e} hr={d.hr} s={44} />
          <span className="flex-1 min-w-0"><b className="text-sm block truncate">{e.name}</b><span className="text-xs text-muted block truncate">{e.title} · {brTxt(e.br)}</span>{od && <span className="text-[11px] text-ok">On duty since {od.inAt}</span>}</span>
          <StateChip st={e.status} />
        </button>
      ); })}</div>
      {!list.length && <span className="text-sm text-muted">Nobody matches this search.</span>}
    </section>
  );
}

/** One employee's profile. */
function Profile({ d, e, code, close, onBadge, say }: { d: HrData; e: Emp; code: string; close: () => void; onBadge: (n: string) => void; say: (m: string, err?: boolean) => void }) {
  const [rv, setRv] = useState<null | { stars: number; note: string }>(null);
  const [bl, setBl] = useState<null | { kind: string; from: string; to: string; note: string }>(null);
  const x = d.hrx[e.name] || {};
  const no = staffNoOf(e, d.hr);
  const shifts = d.clock.filter((c: Clock) => c.name === e.name && c.inTs >= Date.now() - 30 * 864e5);
  const hours = Math.round(shifts.reduce((a, c) => a + (c.mins || 0), 0) / 6) / 10;
  const late = shifts.filter((c) => c.late).length;
  const left = leaveLeft(e, d.Lv);
  const sold = SALES.filter((s) => s.staff === e.name && s.ts >= Date.now() - 30 * 864e5).reduce((a, s) => a + s.total, 0);
  const startIso = x.start || `${e.since}-01-01`;
  const months = Math.max(0, Math.round((Date.now() - new Date(startIso).getTime()) / (30.44 * 864e5)));
  const serv = months >= 12 ? `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''}${months % 12 ? ` ${months % 12} month${months % 12 === 1 ? '' : 's'}` : ''}` : `${months} month${months === 1 ? '' : 's'}`;
  // This week (Mon–Sun) at work.
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const week = DAYS.map((dn, i) => { const day = new Date(mon.getTime() + i * 864e5).toDateString(); const S = d.clock.filter((c) => c.name === e.name && new Date(c.inTs).toDateString() === day); return { dn, h: Math.round(S.reduce((a, c) => a + (c.mins || 0), 0) / 6) / 10, on: S.some((c) => !c.outTs) }; });
  const facts: [string, string][] = [['Staff number', no], ['Started', new Date(startIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })], ['Length of service', serv], ['Contract', x.contract || 'Full-time'], ['Phone', e.phone], ['Email', x.email || `${e.name.split(' ')[0].toLowerCase()}@ebenezerunique.com.gh`], [e.level === 'Rider' ? 'Deliveries' : 'Sales this period', e.level === 'Rider' ? `${shifts.length * 4} this month` : ghs(sold)], ['Sign-in code', code || '—']];
  const setState = (st: Emp['status']) => { d.up(e.id, { status: st }); say(`${e.name} is now ${st}`); };
  const bookLeave = () => {
    if (!bl) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bl.from) || !/^\d{4}-\d{2}-\d{2}$/.test(bl.to)) return say('Enter both dates as 2026-11-09.', true);
    const n = daysBetween(bl.from, bl.to); if (n < 1) return say('The last day cannot be before the first day.', true);
    if (bl.kind === 'Annual leave' && n > left) return say(`That is ${n} days but ${e.name.split(' ')[0]} has only ${left} left.`, true);
    const r: LeaveReq = { id: 'LV-' + Date.now().toString().slice(-5), who: e.name, kind: bl.kind, from: bl.from, to: bl.to, days: n, status: 'approved', note: bl.note || 'Booked by HR', hrNote: 'Booked by HR', decided: today() };
    d.setLv((L) => [r, ...L]); setBl(null); say(`${n} day${n === 1 ? '' : 's'} of ${bl.kind.toLowerCase()} booked for ${e.name}`);
  };
  return (
    <section className="card p-5 flex flex-col gap-4">
      <button onClick={close} className="text-sm font-semibold w-fit">← All people</button>
      <div className="flex items-center gap-4 flex-wrap"><Avatar e={e} hr={d.hr} s={64} /><div className="flex-1 min-w-0"><h2 className="m-0 text-2xl font-semibold">{e.name}</h2><span className="text-sm text-muted">{e.title} · {brTxt(e.br)} · staff no. {no}</span></div><StateChip st={e.status} /></div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat k="Monthly pay" v={ghs(e.basic)} s={x.contract || 'Full-time'} />
        <Stat k="Hours last 30 days" v={`${hours} h`} s={`${shifts.length} shifts`} />
        <Stat k="Leave left" v={`${left} of ${ENT}`} s={`${annualTaken(e.name, d.Lv) + (ENT - (e.leaveLeft ?? ENT))} days taken`} />
        <Stat k="Late arrivals" v={late} s="After 08:15" />
      </div>
      <dl className="m-0 grid gap-3 grid-cols-2 lg:grid-cols-4">{facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 text-sm font-semibold break-words">{v}</dd></div>)}</dl>
      <div className="flex flex-col gap-2"><b className="text-sm">This week at work</b><div className="grid grid-cols-7 gap-1.5">{week.map((w) => <div key={w.dn} className={cx('rounded-xl p-2 text-center', w.h || w.on ? 'bg-brand-50' : 'bg-canvas')}><span className="text-[11px] text-muted block">{w.dn}</span><b className="text-xs">{w.on ? 'in' : w.h ? `${w.h} h` : '—'}</b></div>)}</div></div>
      <div className="flex flex-col gap-1.5"><b className="text-sm">Documents</b>{d.types.map((t) => { const [lbl, col] = docState(d.docs[e.name]?.[t.id], t.required); return <div key={t.id} className="flex justify-between gap-2 text-sm"><span>{t.name}</span><span style={{ color: col }} className="font-semibold text-xs">{lbl}</span></div>; })}</div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onBadge(e.name)} className="btn-dark">Work badge &amp; QR</button>
        <button onClick={() => setRv(rv ? null : { stars: 4, note: '' })} className="btn-ghost">Add a review</button>
        <button onClick={() => setBl(bl ? null : { kind: 'Annual leave', from: '', to: '', note: '' })} className="btn-ghost">Book leave</button>
        <Link to="/users" className="btn-ghost">Login &amp; permissions</Link>
        {e.status === 'Active' ? <button onClick={() => setState('Suspended')} className="btn-ghost text-danger">Suspend</button> : e.status !== 'Left' && <button onClick={() => setState('Active')} className="btn-ghost">Reactivate</button>}
        {e.status !== 'Left' && <button onClick={() => { if (window.confirm(`Mark ${e.name} as left? Their ID card stops working.`)) setState('Left'); }} className="btn-ghost">Mark as left</button>}
      </div>
      {rv && <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><b className="text-sm">Review for {e.name}</b><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRv({ ...rv, stars: n })} aria-label={`${n} stars`} className={cx('text-2xl', n <= rv.stars ? 'text-[#f2b705]' : 'text-[#ddd]')}>★</button>)}</div><textarea rows={3} value={rv.note} onChange={(ev) => setRv({ ...rv, note: ev.target.value })} placeholder="What went well, and what to work on" className="p-3 rounded-2xl border border-line text-sm" /><div className="flex gap-2"><button onClick={() => { if (rv.note.trim().length < 4) return say('Write a short note with the review.', true); d.setReviews((L) => [{ id: 'rv' + Date.now(), name: e.name, stars: rv.stars, note: rv.note.trim(), by: 'Admin', at: today() }, ...L]); d.up(e.id, { rating: rv.stars }); setRv(null); say(`Review saved for ${e.name}`); }} className="btn-primary">Save review</button><button onClick={() => setRv(null)} className="btn-ghost">Cancel</button></div></div>}
      {bl && <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><b className="text-sm">Book leave for {e.name} · {left} days left</b><Pills small opts={LEAVE_TYPES.map((t) => [t, t] as [string, string])} value={bl.kind} onChange={(v) => setBl({ ...bl, kind: v })} /><div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold flex flex-col gap-1">First day<input value={bl.from} onChange={(ev) => setBl({ ...bl, from: ev.target.value })} placeholder="2026-11-09" className="h-10 px-3.5 rounded-full border border-line text-sm font-normal" /></label><label className="text-xs font-semibold flex flex-col gap-1">Last day<input value={bl.to} onChange={(ev) => setBl({ ...bl, to: ev.target.value })} placeholder="2026-11-13" className="h-10 px-3.5 rounded-full border border-line text-sm font-normal" /></label></div><input value={bl.note} onChange={(ev) => setBl({ ...bl, note: ev.target.value })} placeholder="Reason (optional)" className="h-10 px-3.5 rounded-full border border-line text-sm" /><div className="flex gap-2"><button onClick={bookLeave} className="btn-primary">Book leave</button><button onClick={() => setBl(null)} className="btn-ghost">Cancel</button></div></div>}
    </section>
  );
}
