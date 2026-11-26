// Follow-ups & tasks (§5.4): Today, Overdue, This week, All and an agenda view.
import { useState } from 'react';
import { cx } from '../../lib/format';
import { BR, assignable, audit, fmtWhen, isOverdue, isToday, scoped, uid, type Task, type TaskType } from './model';
import { Chips, Drawer, Empty, Head, Pill, Toastish, btnP, inp, type Crm } from './ui';

const TYPES: TaskType[] = ['Call', 'WhatsApp', 'SMS', 'Email', 'Visit', 'Collect payment', 'Deliver', 'Feedback call'];
const DAY = 864e5;

export default function Tasks({ m }: { m: Crm }) {
  const { c } = m; const staff = c.role === 'staff';
  const [view, setView] = useState<'today' | 'overdue' | 'week' | 'all' | 'agenda'>('today');
  const [type, setType] = useState('all');
  const [who, setWho] = useState('all');
  const [add, setAdd] = useState<null | { type: TaskType; title: string; name: string; assignee: string; due: string; err: string }>(null);
  const [msg, setMsg] = useState('');
  const people = assignable(c);
  const all = scoped(m.tasks, c, m.vb).filter((t) => (type === 'all' || t.type === type) && (who === 'all' || t.assignee === who));
  const end = new Date(); end.setHours(23, 59, 59, 999); const weekEnd = end.getTime() + 6 * DAY;
  const L = (view === 'today' ? all.filter((t) => t.status === 'open' && isToday(t.dueAt)) : view === 'overdue' ? all.filter(isOverdue) : view === 'week' ? all.filter((t) => t.status === 'open' && t.dueAt <= weekEnd) : all).sort((a, b) => (a.status === b.status ? a.dueAt - b.dueAt : a.status === 'open' ? -1 : 1));
  const up = (id: string, p: Partial<Task>) => m.setTasks(m.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const counts = { today: all.filter((t) => t.status === 'open' && isToday(t.dueAt)).length, overdue: all.filter(isOverdue).length, week: all.filter((t) => t.status === 'open' && t.dueAt <= weekEnd).length };
  const save = () => {
    if (!add) return; if (!add.title.trim()) return setAdd({ ...add, err: 'What needs doing?' });
    const assignee = add.assignee || c.me; const s = people.find((p) => p.name === assignee);
    const t: Task = { id: uid('TK'), type: add.type, title: add.title.trim(), relatedTo: { kind: 'customer', id: '', name: add.name.trim() || '—' }, assignee, assignedBy: c.me, branch: s && s.br !== 'all' ? s.br : c.br, dueAt: new Date(add.due).getTime(), status: 'open', auto: false, source: 'Manual' };
    m.setTasks([t, ...m.tasks]); setAdd(null); setMsg(`Follow-up added for ${assignee}`);
  };
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
  const Row = ({ t }: { t: Task }) => (
    <div className={cx('flex items-center gap-3 p-3 rounded-2xl border text-sm flex-wrap bg-white', t.status === 'done' ? 'border-line opacity-60' : isOverdue(t) ? 'border-[#b26a00]' : 'border-line')}>
      <Pill t={t.type} tone="teal" />
      <span className="flex-1 min-w-[200px] flex flex-col"><b className={cx('font-medium', t.status === 'done' && 'line-through')}>{t.title}</b><span className="text-xs text-muted">{t.relatedTo.name} · {t.assignee}{c.role === 'superuser' ? ` · ${BR[t.branch]}` : ''} · {fmtWhen(t.dueAt)}{t.auto ? ` · Automatic: ${t.source}` : ''}</span></span>
      {t.auto && <Pill t="Automatic" tone="info" />}
      {t.status === 'done' ? <Pill t="Done" tone="ok" /> : isOverdue(t) ? <Pill t="Overdue" tone="warn" /> : isToday(t.dueAt) ? <Pill t="Today" tone="teal" /> : null}
      {t.status === 'open' && <>
        {c.caps.assign !== 'self' && <select aria-label={`Reassign ${t.title}`} value={t.assignee} onChange={(e) => { up(t.id, { assignee: e.target.value, assignedBy: c.me }); audit(c, 'CRM reassignment', `${t.id} reassigned to ${e.target.value}`); setMsg(`Reassigned to ${e.target.value}`); }} className="h-10 rounded-full border border-line px-3 text-[13px]">{Array.from(new Set([t.assignee, ...people.map((p) => p.name)])).map((n) => <option key={n}>{n}</option>)}</select>}
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); up(t.id, { dueAt: d.getTime() }); setMsg('Snoozed to tomorrow'); }} className="min-h-10 px-3.5 rounded-full border border-line text-[13px]">Snooze</button>
        <button onClick={() => { up(t.id, { status: 'done', doneAt: Date.now() }); setMsg('Marked done'); }} className="min-h-10 px-3.5 rounded-full text-white text-[13px] font-semibold" style={{ background: '#0b5c5c' }}>Mark done</button>
      </>}
    </div>
  );
  return (
    <>
      <Head title={staff ? 'My follow-ups' : 'Follow-ups & tasks'} sub={staff ? 'Calls, messages and visits you promised customers' : `Calls, visits, payments to collect and feedback calls · ${c.role === 'superuser' ? (m.vb === 'all' ? 'all branches' : BR[m.vb]) : 'My branch'}`} actions={<button onClick={() => setAdd({ type: 'Call', title: '', name: '', assignee: '', due: new Date(Date.now() + DAY).toISOString().slice(0, 16), err: '' })} className={btnP}>+ New follow-up</button>} />
      <Chips label="View" value={view} onChange={setView} opts={[['today', `Today · ${counts.today}`], ['overdue', `Overdue · ${counts.overdue}`], ['week', `This week · ${counts.week}`], ['all', 'All'], ['agenda', 'Agenda']]} />
      <div className="flex gap-2 flex-wrap">
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="h-11 rounded-full border border-line bg-white px-4 text-sm"><option value="all">Every type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        {!staff && <select aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)} className="h-11 rounded-full border border-line bg-white px-4 text-sm"><option value="all">Everyone</option>{people.map((p) => <option key={p.name}>{p.name}</option>)}</select>}
      </div>
      {view === 'agenda' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{days.map((d) => { const T = all.filter((t) => t.status === 'open' && new Date(t.dueAt).toDateString() === d.toDateString()); return <section key={d.toISOString()} className="bg-white rounded-3xl shadow-card p-4 flex flex-col gap-2"><b className="text-sm">{d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</b>{T.map((t) => <div key={t.id} className="text-sm border-l-2 border-brand pl-2"><b className="font-medium">{new Date(t.dueAt).toTimeString().slice(0, 5)}</b> · {t.type} · {t.relatedTo.name}<br /><span className="text-xs text-muted">{t.assignee}{t.auto ? ' · Automatic' : ''}</span></div>)}{!T.length && <span className="text-xs text-muted">Nothing planned.</span>}</section>; })}</div>
      ) : L.length ? <div className="flex flex-col gap-2">{L.map((t) => <Row key={t.id} t={t} />)}</div> : <Empty text={view === 'today' ? (staff ? 'No follow-ups today, nice work.' : 'Nothing due today.') : view === 'overdue' ? 'Nothing overdue. Well done.' : 'No follow-ups here.'} />}
      {add && <Drawer title="New follow-up" onClose={() => setAdd(null)}>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Type<select value={add.type} onChange={(e) => setAdd({ ...add, type: e.target.value as TaskType })} className={inp}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">What needs doing?<input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value, err: '' })} placeholder="e.g. Call about the fridge delivery" className={inp} /></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Customer<input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} list="crm-custs" className={inp} /><datalist id="crm-custs">{m.custs.map((x) => <option key={x.id} value={x.name} />)}</datalist></label>
        {c.caps.assign !== 'self' && <label className="text-[13px] font-semibold flex flex-col gap-1">Who<select value={add.assignee} onChange={(e) => setAdd({ ...add, assignee: e.target.value })} className={inp}><option value="">Me</option>{people.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>}
        <label className="text-[13px] font-semibold flex flex-col gap-1">When<input type="datetime-local" value={add.due} onChange={(e) => setAdd({ ...add, due: e.target.value })} className={inp} /></label>
        {add.err && <span role="alert" className="text-sm text-danger">{add.err}</span>}
        <button onClick={save} className={btnP}>Add follow-up</button>
      </Drawer>}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}
