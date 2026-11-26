// Team performance (§5.10): league per branch and per staff member, with drill-down.
import { useState } from 'react';
import { cx, ghs } from '../../lib/format';
import { BR, STAFF, isOverdue } from './model';
import { Head, Pill, type Crm } from './ui';

export default function Team({ m }: { m: Crm }) {
  const { c } = m;
  const [br, setBr] = useState(c.role === 'superuser' ? '' : c.br);
  const people = (c.role === 'superuser' ? STAFF.filter((s) => s.role !== 'superuser' && (!br || s.br === br)) : c.role === 'manager' ? STAFF.filter((s) => s.br === c.br && s.name !== c.me) : STAFF.filter((s) => s.team === c.me || s.name === c.me));
  const row = (names: string[]) => {
    const leads = m.leads.filter((l) => names.includes(l.owner)); const conv = leads.filter((l) => l.status === 'Converted').length;
    const won = m.deals.filter((d) => names.includes(d.owner) && d.stage === 'Won').reduce((a, d) => a + d.value, 0);
    const tasks = m.tasks.filter((t) => names.includes(t.assignee)); const done = tasks.filter((t) => t.status === 'done'); const onTime = done.filter((t) => (t.doneAt || t.dueAt) <= t.dueAt + 864e5).length;
    const fb = m.feedback.filter((f) => names.includes(f.staff)); const r = fb.filter((f) => f.rating);
    return { leads: leads.length, conv: leads.length ? Math.round((conv / leads.length) * 100) : 0, won, onTime: done.length ? Math.round((onTime / done.length) * 100) : 0, overdue: tasks.filter(isOverdue).length, rating: r.length ? r.reduce((a, f) => a + f.rating, 0) / r.length : 0, complaints: fb.filter((f) => f.kind === 'complaint').length };
  };
  const head = ['Leads handled', 'Conversion', 'Deals won', 'Follow-ups on time', 'Overdue', 'Avg rating', 'Complaints'];
  const cells = (x: ReturnType<typeof row>) => [x.leads, `${x.conv}%`, ghs(x.won), `${x.onTime}%`, x.overdue ? <Pill key="o" t={x.overdue} tone="warn" /> : '0', x.rating ? x.rating.toFixed(1) : '—', x.complaints];
  return (
    <>
      <Head title="Team performance" sub={c.role === 'superuser' ? (br ? `${BR[br]} branch · tap All branches to go back` : 'Every branch · tap a branch to see its staff') : c.role === 'manager' ? 'My branch staff' : 'My team'} />
      {c.role === 'superuser' && !br && <section className="bg-white rounded-3xl shadow-card overflow-x-auto"><table className="w-full text-sm min-w-[820px]"><thead><tr className="text-left text-xs text-muted uppercase tracking-wide"><th className="px-4 py-3 font-semibold">Branch</th>{head.map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{Object.keys(BR).map((b) => <tr key={b} className="border-t border-line hover:bg-[#f6f7f8] cursor-pointer" onClick={() => setBr(b)}><td className="px-4 py-3 font-medium underline">{BR[b]}</td>{cells(row(STAFF.filter((s) => s.br === b).map((s) => s.name))).map((v, i) => <td key={i} className="px-3">{v}</td>)}</tr>)}</tbody></table></section>}
      {(c.role !== 'superuser' || br) && <>
        {c.role === 'superuser' && <button onClick={() => setBr('')} className="w-fit min-h-10 px-4 rounded-full border border-line bg-white text-sm">← All branches</button>}
        <section className="bg-white rounded-3xl shadow-card overflow-x-auto"><table className="w-full text-sm min-w-[820px]"><thead><tr className="text-left text-xs text-muted uppercase tracking-wide"><th className="px-4 py-3 font-semibold">Staff</th>{head.map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{people.map((s) => <tr key={s.name} className={cx('border-t border-line', s.name === c.me && 'bg-[#eef6f6]')}><td className="px-4 py-3"><b className="font-medium">{s.name}</b><br /><span className="text-xs text-muted">{s.role === 'manager' ? 'Manager' : s.role === 'supervisor' ? 'Supervisor' : 'Sales staff'}</span></td>{cells(row([s.name])).map((v, i) => <td key={i} className="px-3">{v}</td>)}</tr>)}</tbody></table></section>
      </>}
      <span className="text-xs text-muted">Follow-ups on time = done within a day of the due date. Ratings come from Feedback & complaints.</span>
    </>
  );
}
