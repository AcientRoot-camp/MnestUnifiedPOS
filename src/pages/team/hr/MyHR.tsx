// People & HR → My HR (GTeam.md §3): everyone who is not the Admin / support sees only their own HR: sign in or out by
// camera (TimeClock ClockSelf, with the sign-in table), stats, My ID card (after HR sends it), the Getting started
// checklist (new starters), My payslips (only months the Admin has pushed) and My leave with "Ask for leave".
import { useState } from 'react';
import type { Clock, Gate } from '../../../data/clock';
import { ENT, LEAVE_TYPES, daysBetween, leaveError, leaveLeft, onbDone, onbSteps, OWNER_COLOR, type LeaveReq } from '../../../data/hr';
import type { Emp } from '../../../data/people';
import { useSession } from '../../../lib/session';
import { cx } from '../../../lib/format';
import { Card } from '../../finance/shared';
import { Msg } from '../../money/ui';
import { MyPayslips } from '../Payroll';
import { MyIdCard, VerifyId } from '../IdCards';
import { ClockSelf } from '../TimeClock';
import { Stat, brTxt, type HrData } from './shared';
import { staffNoOf } from '../../../data/idcard';

/** Inputs: HR data, the signed-in employee, their sign-in code, the gate code, the company name and the punch action. */
export default function MyHR({ d, e, code, gate, biz, onPunch }: { d: HrData; e: Emp; code: string; gate: Gate | null; biz: string; onPunch: (name: string, via: string) => { err?: string; msg?: string } }) {
  const { session } = useSession();
  const [msg, setMsg] = useState(''); const [bad, setBad] = useState(false);
  const say = (m: string, err = false) => { setMsg(m); setBad(err); };
  const mine: Clock[] = d.clock.filter((c) => c.name === e.name && c.inTs >= Date.now() - 30 * 864e5);
  const hours = Math.round(mine.reduce((a, c) => a + (c.mins || 0), 0) / 6) / 10;
  const left = leaveLeft(e, d.Lv);
  const late = mine.filter((c) => c.late).length;
  const myLeave = d.Lv.filter((l) => l.who === e.name);
  // Getting started: new starters (first 2 months) or anyone with steps left.
  const steps = onbSteps(e); const done = onbDone(e, d.onb, d.docs);
  const start = d.hrx[e.name]?.start || `${e.since}-01-01`;
  const newStarter = (Date.now() - new Date(start).getTime()) < 61 * 864e5 || done.size < steps.length;
  const tick = (k: string) => { const cur = { ...(d.onb[e.name] || {}) }; if (cur[k]) delete cur[k]; else cur[k] = new Date().toISOString().slice(0, 10); d.setOnb({ ...d.onb, [e.name]: cur }); };
  // Ask for leave.
  const [lf, setLf] = useState({ kind: 'Annual leave', other: '', from: '', to: '', note: '' });
  const [another, setAnother] = useState(false);
  const send = () => {
    const kind = another ? lf.other.trim() : lf.kind;
    const err = leaveError(kind, lf.from.trim(), lf.to.trim(), left); if (err) return say(err, true);
    const r: LeaveReq = { id: 'LV-' + Date.now().toString().slice(-5), who: e.name, kind, from: lf.from.trim(), to: lf.to.trim(), days: daysBetween(lf.from.trim(), lf.to.trim()), status: 'pending', note: lf.note.trim() };
    d.setLv((L) => [r, ...L]); setLf({ kind: 'Annual leave', other: '', from: '', to: '', note: '' }); setAnother(false); say('Leave request sent to HR');
  };
  const inp = 'h-10 px-3.5 rounded-full border border-line text-sm font-normal w-full';
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">My HR · {e.name.split(' ')[0]}</h1><p className="m-0 text-sm text-muted">Your own payslip, sign-in records and leave · the rest of HR is kept by the Admin</p><span className="text-xs text-muted">{e.title} · {brTxt(e.br)} · {staffNoOf(e, d.hr)}</span></header>
      {msg && (bad ? <div role="alert" className="rounded-2xl bg-red-50 text-danger px-4 py-3 text-sm flex justify-between gap-2"><span>{msg}</span><button onClick={() => setMsg('')} aria-label="Dismiss">×</button></div> : <Msg text={msg} onClose={() => setMsg('')} />)}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4"><Stat k="Hours (30 days)" v={`${hours} h`} /><Stat k="Shifts" v={mine.length} /><Stat k="Leave left" v={`${left} of ${ENT}`} /><Stat k="Late arrivals" v={late} s="After 08:15" /></div>
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <ClockSelf e={e} code={code} gate={gate} L={d.clock} biz={biz} onPunch={onPunch} />
        <div className="flex flex-col gap-6">
          <MyIdCard e={e} code={code} />
          {(session?.role === 'manager' || session?.role === 'supervisor') && <VerifyId E={d.E} />}
          {newStarter && (
            <Card title="Getting started" sub={`${done.size} of ${steps.length} done`}>
              {steps.map((s) => { const ok = done.has(s.k); const mineStep = s.owner !== 'HR'; return (
                <div key={s.k} className="flex items-start gap-2.5 py-1.5">
                  <button onClick={() => mineStep && tick(s.k)} disabled={!mineStep} role="checkbox" aria-checked={ok} aria-label={s.t} className={cx('w-5 h-5 rounded-md border-2 flex-none flex items-center justify-center text-[10px] mt-0.5', ok ? 'bg-brand border-brand text-white' : 'border-[#ccc]', !mineStep && 'opacity-60')}>{ok ? '✓' : ''}</button>
                  <span className="flex-1 text-sm"><span className={ok ? 'line-through text-muted' : ''}>{s.t}</span><span className="block text-xs text-muted">{s.note}</span></span>
                  <span className="pill text-white text-[10px]" style={{ background: OWNER_COLOR[s.owner] }}>{s.owner}</span>
                </div>
              ); })}
              <span className="text-xs text-muted">{done.size === steps.length ? 'All done. Welcome aboard.' : 'Tick these off as you bring them in. HR sees the same list.'}</span>
            </Card>
          )}
        </div>
      </div>
      <MyPayslips e={e} />
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card title="My leave">
          {!myLeave.length && <span className="text-sm text-muted">No leave asked for yet.</span>}
          {myLeave.map((l) => { const [lbl, cls] = l.status === 'pending' ? ['Waiting', 'bg-amber-100 text-amber-900'] : l.status === 'approved' ? ['Approved', 'bg-green-100 text-green-800'] : ['Declined', 'bg-red-100 text-red-800']; return (
            <div key={l.id} className="rounded-2xl bg-canvas p-3 flex flex-col gap-0.5"><div className="flex justify-between gap-2"><b className="text-sm">{l.kind} · {l.days} day{l.days === 1 ? '' : 's'}</b><span className={cx('pill', cls)}>{lbl}</span></div><span className="text-xs text-muted">{l.from} to {l.to}{l.note ? ` · ${l.note}` : ''}</span>{l.hrNote && <span className="text-xs">HR: {l.hrNote}</span>}</div>
          ); })}
        </Card>
        <Card title="Ask for leave" sub={`${left} days of annual leave left`}>
          <div className="flex flex-wrap gap-1.5">{LEAVE_TYPES.map((t) => <button key={t} type="button" aria-pressed={!another && lf.kind === t} onClick={() => { setAnother(false); setLf({ ...lf, kind: t }); }} className={cx('h-8 px-3 rounded-full text-xs border', !another && lf.kind === t ? 'bg-black text-white border-black' : 'border-line')}>{t}</button>)}<button type="button" aria-pressed={another} onClick={() => setAnother(true)} className={cx('h-8 px-3 rounded-full text-xs border', another ? 'bg-black text-white border-black' : 'border-line')}>+ Another kind</button></div>
          {another && <input value={lf.other} onChange={(x) => setLf({ ...lf, other: x.target.value })} placeholder="What kind of leave? e.g. Exam leave" className={inp} />}
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold flex flex-col gap-1">First day<input value={lf.from} onChange={(x) => setLf({ ...lf, from: x.target.value })} placeholder="2026-11-09" className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Last day<input value={lf.to} onChange={(x) => setLf({ ...lf, to: x.target.value })} placeholder="2026-11-13" className={inp} /></label></div>
          <input value={lf.note} onChange={(x) => setLf({ ...lf, note: x.target.value })} placeholder="Reason (optional)" className={inp} />
          <button onClick={send} className="btn-primary w-fit">Send to HR</button>
        </Card>
      </div>
    </>
  );
}
