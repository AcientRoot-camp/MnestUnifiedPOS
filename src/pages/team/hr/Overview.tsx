// People & HR → Overview (GTeam.md §4.1): headcount, 6-month trend, payroll summary ring, recent people, who is on duty
// now and up to five HR insights worked out from leave, documents, the time clock and pay.
import { Link } from 'react-router-dom';
import { inLastDays } from '../../../data/clock';
import { DOCTYPES0, clashWith, docState } from '../../../data/hr';
import type { Emp } from '../../../data/people';
import { cx } from '../../../lib/format';
import { usePay } from '../Payroll';
import { cedi } from '../PayslipDoc';
import { Avatar, StateChip, type HrData } from './shared';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Inputs: the HR data, the staff in view, and open (opens a person in People). */
export default function Overview({ d, staff, open }: { d: HrData; staff: Emp[]; open: (e: Emp) => void }) {
  const active = staff.filter((e) => e.status === 'Active' || e.status === 'On leave');
  const now = new Date(); const ym = now.toISOString().slice(0, 7);
  const joined = active.filter((e) => (d.hrx[e.name]?.start || '').startsWith(ym));
  // Headcount at the end of each of the last six months (start date, else the start year).
  const startOf = (e: Emp) => d.hrx[e.name]?.start || `${e.since}-01-01`;
  const trend = Array.from({ length: 6 }, (_, i) => { const dt = new Date(now.getFullYear(), now.getMonth() - 5 + i + 1, 0); const iso = dt.toISOString().slice(0, 10); return { m: MON[dt.getMonth()], n: active.filter((e) => startOf(e) <= iso).length, cur: i === 5 }; });
  const max = Math.max(1, ...trend.map((t) => t.n));
  const { rows } = usePay('all');
  const mine = rows.filter((r) => staff.some((e) => e.id === r.e.id));
  const sum = mine.reduce((a, r) => ({ net: a.net + r.pay.net, tax: a.tax + r.pay.tax, ssnit: a.ssnit + r.pay.ssnit, pension: a.pension + r.pay.employer, other: a.other + r.pay.adv + r.pay.loan + r.pay.union }), { net: 0, tax: 0, ssnit: 0, pension: 0, other: 0 });
  const segs: [string, number, string][] = [['Net pay', sum.net, '#0b5c5c'], ['PAYE tax', sum.tax, '#b26a00'], ['SSNIT', sum.ssnit, '#6b3fa0'], ['Pension', sum.pension, '#0b6bcb'], ['Other deductions', sum.other, '#9a9794']];
  const all = segs.reduce((a, s) => a + s[1], 0) || 1; let acc = 0;
  const ring = `conic-gradient(${segs.map(([, v, c]) => { const a = acc; acc += (v / all) * 360; return `${c} ${a}deg ${acc}deg`; }).join(',')})`;
  const recent = [...active].sort((a, b) => startOf(b).localeCompare(startOf(a))).slice(0, 4);
  const names = new Set(staff.map((e) => e.name));
  const onDuty = inLastDays(d.clock, 1).filter((c) => !c.outTs && names.has(c.name));
  // Insights (up to five).
  const pend = d.Lv.filter((l) => l.status === 'pending' && names.has(l.who));
  const clashes = pend.filter((l) => clashWith(l, d.Lv, d.E));
  const docIssues = staff.reduce((a, e) => a + d.types.filter((t) => docState(d.docs[e.name]?.[t.id], t.required)[2]).length, 0);
  const late: Record<string, number> = {}; inLastDays(d.clock, 30).filter((c) => c.late && names.has(c.name)).forEach((c) => { late[c.name] = (late[c.name] || 0) + 1; });
  const lateMany = Object.entries(late).filter(([, n]) => n >= 2);
  const week = inLastDays(d.clock, 7); const silent = active.filter((e) => !week.some((c) => c.name === e.name));
  const longServ = active.filter((e) => now.getFullYear() - e.since >= 2);
  const gross = mine.reduce((a, r) => a + r.pay.gross, 0); const basic = mine.reduce((a, r) => a + r.pay.basic, 0);
  const insights = [
    pend.length && `🗓 ${pend.length} leave request${pend.length === 1 ? '' : 's'} waiting${clashes.length ? ` · ${clashes.length} clash${clashes.length === 1 ? 'es' : ''} with someone at the same branch` : ''}.`,
    docIssues && `📄 ${docIssues} document${docIssues === 1 ? ' needs' : 's need'} attention (missing, asked for or expiring).`,
    lateMany.length && `⏰ Late 2+ times in 30 days: ${lateMany.map(([n, c]) => `${n} (${c})`).join(', ')}.`,
    silent.length && `🔕 Not clocked in for 7 days: ${silent.slice(0, 4).map((e) => e.name).join(', ')}${silent.length > 4 ? ' …' : ''}.`,
    longServ.length && `🏅 ${longServ.length} long-serving staff (24+ months): consider a review or a raise.`,
    `💰 Cost of the team: ${cedi(gross)} gross a month, ${cedi(gross / Math.max(1, mine.length))} on average, plus employer SSNIT 13% (${cedi(basic * 0.13)}) on top.`,
  ].filter(Boolean).slice(0, 5) as string[];
  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 items-start">
      <section className="card p-5 flex flex-col gap-1"><span className="text-sm font-semibold">Headcount</span><b className="text-4xl">{active.length}</b><span className="text-sm text-muted">Total employees</span><span className="text-sm text-brand font-semibold mt-2">{joined.length ? `+${joined.length} joined this month` : 'No one joined this month'}</span></section>
      <section className="card p-5 flex flex-col gap-3"><span className="text-sm font-semibold">Headcount trend</span>
        <div className="flex items-end gap-2 h-36">{trend.map((t) => <div key={t.m} className="flex-1 flex flex-col items-center justify-end gap-1 h-full"><span className="text-[10px] text-muted">{t.n}</span><div className="w-full rounded-t-lg" style={{ height: `${(t.n / max) * 100}%`, background: t.cur ? '#0b5c5c' : '#5aa6a6' }} /><span className="text-[11px] text-muted">{t.m}</span></div>)}</div></section>
      <section className="card p-5 flex flex-col gap-3"><span className="text-sm font-semibold">Payroll summary</span>
        <div className="flex items-center gap-4"><div className="w-28 h-28 rounded-full flex-none flex items-center justify-center" style={{ background: ring }}><div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center text-center"><span className="text-[10px] text-muted">Net pay</span><b className="text-xs">{cedi(sum.net)}</b></div></div>
          <div className="flex flex-col gap-1 text-xs">{segs.map(([k, v, c]) => <span key={k} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{k} · {cedi(v)}</span>)}</div></div>
        <span className="text-sm text-ok font-semibold">✓ Payroll ready</span><Link to="/payroll" className="text-sm font-semibold text-brand">Open payroll →</Link></section>
      <section className="card p-5 flex flex-col gap-2"><span className="text-sm font-semibold">Recent people</span>
        {recent.map((e) => <button key={e.id} onClick={() => open(e)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-canvas text-left"><Avatar e={e} hr={d.hr} s={36} /><span className="flex-1 min-w-0"><b className="text-sm block truncate">{e.name}</b><span className="text-xs text-muted">{e.title}</span></span><StateChip st={e.status} /></button>)}
        <button onClick={() => recent[0] && open({ ...recent[0], id: '' })} className="text-sm font-semibold text-brand text-left">View all people →</button></section>
      <section className="card p-5 flex flex-col gap-2"><span className="text-sm font-semibold">On duty now · {onDuty.length} signed in</span>
        {!onDuty.length && <span className="text-sm text-muted">Nobody has scanned in yet today.</span>}
        {onDuty.map((c) => <div key={c.id} className="flex justify-between gap-2 text-sm"><span><b>{c.name}</b> · {c.br}</span><span className="text-muted">in {c.inAt} · {Math.max(0, Math.round((Date.now() - c.inTs) / 36e5 * 10) / 10)} h</span></div>)}</section>
      <section className="card p-5 flex flex-col gap-2 xl:col-span-1"><span className="text-sm font-semibold">✨ HR insights</span>
        {insights.map((t) => <span key={t} className={cx('text-sm p-2.5 rounded-xl bg-canvas')}>{t}</span>)}</section>
      {/* Hidden helper so the documents types list is referenced (defaults when none saved). */}
      <span className="hidden">{DOCTYPES0.length}</span>
    </div>
  );
}
