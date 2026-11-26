// People & HR: overview, people, onboarding, recruitment, ID cards, the QR time clock (HRSign.md), leave,
// performance, documents and roles. HR admins (Admin, eComPOS Support) see every tab; everyone else sees their own
// self-service page with "Scan to sign in / out".
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { brName, now } from '../../data/catalogue';
import { COMPANY } from '../../data/hirePurchase';
import { PEOPLE } from '../../data/nav';
import { EMPS0, LEAVE0, ini, payslip, type Emp, type Leave } from '../../data/people';
import { BRS } from '../../data/catalogue';
import { CLOCK_KEY, GATE_KEY, HR_KEY, SEEDED_KEY, badgeCodes, clockNow, gateNow, inLastDays, minsOf, punch, reissueBadge, reissueGate, type Clock, type Gate, type HrRec } from '../../data/clock';
import { ClockAdmin, ClockSelf } from './TimeClock';
import { readKey } from '../../lib/persist';
import { pushPunch } from '../../lib/serverSync';
import { IdCardsTab, MyIdCard, VerifyId } from './IdCards';
import { ensureStaffNos } from '../../data/idcard';
import { companyLogo } from '../../lib/brand';
import { bizInfo } from '../pos/Docs';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import { Msg } from '../money/ui';

type Tab = 'overview' | 'people' | 'onboard' | 'recruit' | 'idcard' | 'clock' | 'leave' | 'perf' | 'docs' | 'roles';
type App = { id: string; name: string; job: string; phone: string; stage: 'new' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected'; docs: string[]; note: string; when: string };
const APPS0: App[] = [{ id: 'A-21', name: 'Gifty Owusu', job: 'Sales assistant · Osu', phone: '+233 24 771 2290', stage: 'new', docs: ['CV / résumé', 'Certificates'], note: '2 years at Melcom Achimota', when: '18 Nov' }, { id: 'A-20', name: 'Samuel Tetteh', job: 'Sales assistant · Osu', phone: '+233 20 118 0041', stage: 'interview', docs: ['CV / résumé', 'Reference letter', 'Passport photo'], note: 'Interview Mon 24 Nov, 10:00, Osu', when: '15 Nov' }, { id: 'A-19', name: 'Rita Asante', job: 'Delivery rider · Adum', phone: '+233 55 400 1180', stage: 'offer', docs: ['CV / résumé', 'Driving licence', 'Police report'], note: 'Offer GHS 1,800 sent 17 Nov', when: '10 Nov' }];
const ONB: [string, string][] = [['idcard', 'ID card printed and handed over · HR · With photo and the identity QR on the back.'], ['contract', 'Contract of employment signed'], ['docsOk', 'All uploaded documents checked and genuine'], ['idOk', 'Ghana Card seen and number recorded'], ['ssnitOk', 'SSNIT number recorded'], ['payOk', 'MoMo or bank account recorded'], ['kinOk', 'Next of kin / emergency contact recorded']];
const DOCS = ['CV / résumé', 'Ghana Card', 'Certificates', 'Reference letter', 'Passport photo', 'Police report', 'Driving licence', 'Contract'];
const Avatar = ({ e, s = 10 }: { e: Emp; s?: number }) => <span className="rounded-full text-white text-xs font-semibold flex items-center justify-center flex-none" style={{ width: s * 4, height: s * 4, background: e.color }}>{ini(e.name)}</span>;

export default function Staff() {
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  // HR admin = Admin or eComPOS Support: every tab. Everyone else (Manager, Supervisor, Sales staff): self-service.
  const HRADMIN = role === 'superuser' || role === 'developer';
  const me = session?.name || PEOPLE[role].name;
  const [E, setE] = usePersist<Emp[]>('ecompos.staff2', EMPS0);
  const [Lv, setLv] = usePersist<Leave[]>('ecompos.leave2', LEAVE0);
  // QR time clock (data/clock.ts): sign-in records, the company gate code and the staff badge codes.
  const [CLK, setCLK] = usePersist<Clock[]>(CLOCK_KEY, []);
  const [gate] = usePersist<Gate | null>(GATE_KEY, null);
  const [hr] = usePersist<Record<string, HrRec>>(HR_KEY, {});
  const [qrWho, setQrWho] = useState('');
  const firstBr = BRS[0].id;
  // First load: create the gate code and the demo shifts (both stored, so they only happen once).
  useEffect(() => { if (!readKey(GATE_KEY, null)) gateNow(); if (!readKey(SEEDED_KEY, false)) setCLK(clockNow(E, firstBr)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Staff numbers (EMP-1001 …) for anyone without one, kept on the HR record so a number is never reused.
  useEffect(() => { ensureStaffNos(E); }, [E]);
  const codes = badgeCodes(E, hr);
  /** One scan: sign in or out (data/clock.ts punch). Output: the message or the error. */
  const doPunch = (name: string, via: string) => {
    const r = punch(readKey<Clock[]>(CLOCK_KEY, CLK), E, name, via, firstBr); if ('err' in r) return { err: r.err };
    setCLK(r.list);
    // Also tell the server, so its 09:00 check knows this branch has someone in (lib/serverSync.ts; ignored offline).
    const rec = r.list.filter((c) => c.name === name).sort((a, b) => Math.max(b.inTs, b.outTs || 0) - Math.max(a.inTs, a.outTs || 0))[0];
    if (rec) pushPunch(rec.br, name, rec.outTs ? 'out' : 'in');
    return { msg: r.msg };
  };
  const [A, setA] = usePersist<App[]>('ecompos.apps2', APPS0);
  const [tab, setTab] = useState<Tab>('overview');
  const [alerts, setAlerts] = usePersist<Record<string, boolean>>('ecompos.hrAlerts', {});
  const [msg, setMsg] = useState('');
  const scope = role === 'superuser' ? viewBranch : session?.branch ?? 'osu';
  const mine = E.filter((e) => scope === 'all' || e.br === scope || e.br === 'all');
  const active = mine.filter((e) => e.status !== 'Suspended');
  const meE = E.find((e) => e.name === me);
  const up = (id: string, p: Partial<Emp>) => setE((x) => x.map((y) => (y.id === id ? { ...y, ...p } : y)));
  const biz = bizInfo().name;
  const names = new Set(mine.map((e) => e.name));
  // On duty now: today's open sign-ins for the branches in view.
  const onDuty = inLastDays(CLK, 1).filter((c) => !c.outTs && names.has(c.name));
  // HR insights from the time clock.
  const week = inLastDays(CLK, 7);
  const silent = active.filter((e) => !week.some((c) => c.name === e.name));
  const late30 = inLastDays(CLK, 30).filter((c) => c.late && names.has(c.name));
  const lateBy: Record<string, number> = {}; late30.forEach((c) => { lateBy[c.name] = (lateBy[c.name] || 0) + 1; });
  const lateMany = Object.entries(lateBy).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const long = inLastDays(CLK, 30).filter((c) => c.outTs && c.mins > 9 * 60 && names.has(c.name));
  const extraH = long.reduce((a, c) => a + (c.mins - 9 * 60), 0) / 60;

  if (!HRADMIN) {
    if (!meE) return <><header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">People &amp; HR</h1></header><Card title="Not on the staff list">You ({me}) are not on the staff list yet, so there is nothing to sign in to. Ask HR to add you.</Card></>;
    return <MyView e={meE} roster={E} code={codes[meE.name]} gate={gate} L={CLK} biz={biz} onPunch={doPunch} Lv={Lv.filter((l) => l.who === me)} onLeave={(l) => { setLv((x) => [l, ...x]); setMsg('Leave request sent to HR'); }} msg={msg} setMsg={setMsg} />;
  }

  const ps = active.reduce((a, e) => { const p = payslip(e); return { net: a.net + p.net, tax: a.tax + p.tax, ssnit: a.ssnit + p.ssnit }; }, { net: 0, tax: 0, ssnit: 0 });
  const pend = Lv.filter((l) => l.status === 'pending');
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Welcome back, {me.split(' ')[0]}</h1><p className="m-0 text-sm text-muted">{scope === 'all' ? 'All branches' : brName(scope)} under {COMPANY.name} · {active.length} active staff, paid and tracked from one place</p></header>
      <div className="flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">{([['overview', 'Overview'], ['people', 'People'], ['onboard', 'Onboarding'], ['recruit', 'Recruitment'], ['idcard', 'ID cards'], ['clock', 'Time clock & QR'], ['leave', 'Leave'], ['perf', 'Performance'], ['docs', 'Documents'], ['roles', 'Roles & devices']] as [Tab, string][]).map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={cx('text-sm px-3.5 py-2 rounded-full whitespace-nowrap', tab === k ? 'bg-brand text-white font-semibold' : 'text-sub hover:bg-canvas')}>{l}{k === 'leave' && pend.length ? ` · ${pend.length}` : ''}</button>)}</div>
      <Msg text={msg} onClose={() => setMsg('')} />

      {tab === 'overview' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card><div className="flex justify-between"><div><h2 className="m-0 text-lg font-semibold">Headcount</h2><strong className="text-5xl font-semibold tracking-tightest">{active.length}</strong><p className="m-0 text-sm text-muted">Total employees</p></div><span className="w-16 h-16 rounded-2xl bg-brand-50 text-brand flex items-center justify-center text-2xl">👥</span></div><span className="text-sm font-semibold text-brand">No one joined this month</span></Card>
            <Card title="Headcount trend"><div className="flex items-end gap-2 h-36">{['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, i) => <div key={m} className="flex-1 flex flex-col items-center gap-1 h-full justify-end"><span className="text-[10px] text-muted">{active.length + 1}</span><div className={cx('w-full rounded-t', i === 5 ? 'bg-brand' : 'bg-[#45a3a3]')} style={{ height: '80%' }} /><span className="text-[11px] text-muted">{m}</span></div>)}</div></Card>
            <Card title="Payroll summary">
              <div className="relative w-28 h-28 rounded-full" style={{ background: `conic-gradient(#0b5c5c 0 ${(ps.net / (ps.net + ps.tax + ps.ssnit)) * 100}%, #45a3a3 0 ${((ps.net + ps.tax) / (ps.net + ps.tax + ps.ssnit)) * 100}%, #9fd3d3 0)` }}><div className="absolute inset-4 rounded-full bg-white flex flex-col items-center justify-center text-[11px] font-semibold">{ghs(ps.net).replace('.00', '')}<span className="text-[9px] text-muted font-normal">net pay</span></div></div>
              {[['Net pay', ps.net], ['PAYE tax', ps.tax], ['SSNIT', ps.ssnit]].map(([k, v]) => <div key={k as string} className="flex justify-between text-sm"><span>{k as string}</span><b>{ghs(v as number)}</b></div>)}
              <div className="flex justify-between items-center border-t border-line pt-2"><span className="text-sm text-ok font-semibold">✓ Payroll ready</span><Link to="/payroll" className="text-sm font-semibold px-3 py-1.5 rounded-full bg-brand-50 text-brand">Open payroll</Link></div>
            </Card>
            <Card title="Recent people">{mine.slice(-4).reverse().map((e) => <div key={e.id} className="flex items-center gap-3"><Avatar e={e} /><span className="flex-1 text-sm"><b>{e.name}</b><br /><span className="text-xs text-muted">{e.level}</span></span><span className={cx('pill', e.status === 'Active' ? 'bg-brand-50 text-brand' : 'bg-red-100 text-red-800')}>{e.status}</span></div>)}<button onClick={() => setTab('people')} className="text-sm font-semibold text-brand text-left">View all people →</button></Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <Card title="On duty now" actions={<span className="text-xs text-muted">{onDuty.length} signed in</span>}>{!onDuty.length && <span className="text-sm text-muted">Nobody has scanned in yet today.</span>}{onDuty.map((c) => <div key={c.id} className="flex items-center gap-3 text-sm py-1 border-b border-line last:border-0"><span className="w-2 h-2 rounded-full bg-ok" /><b className="flex-1">{c.name}</b><span className="text-muted">{brName(c.br)}</span><span>in {c.inAt}</span><span className="text-muted w-14 text-right">{(minsOf(c) / 60).toFixed(1)} h</span></div>)}</Card>
            <Card title="✨ HR insights">{[['🌴', `${pend.length} leave requests waiting`, 'Two of them clash with someone else at the same branch, so check cover before approving.', 'bg-brand-50'], ...(silent.length ? [['📵', `${silent.length} not scanning in`, `${silent.map((e) => e.name).join(', ')} ${silent.length === 1 ? 'has' : 'have'} no scan in the last 7 days. Their payroll hours will read zero until they use the QR code.`, 'bg-red-50']] : []), ...(lateMany.length ? [['⏰', 'Late patterns', `${lateMany.slice(0, 3).map(([n, k]) => `${n} (${k} times)`).join(', ')} arrived after 08:15 more than once in the last 30 days.`, 'bg-warn-bg']] : []), ...(long.length ? [['💸', 'Overtime building up', `${long.length} shift${long.length === 1 ? '' : 's'} ran past 9 hours in the last 30 days, about ${extraH.toFixed(1)} extra hours.`, 'bg-warn-bg']] : []), ['🎖', `${E.filter((e) => 2026 - e.since >= 3).length} long-serving staff`, 'Ghana law builds leave entitlement with service, and these are the people most costly to replace.', 'bg-[#f1edff]']].map(([i, t, b, c]) => <div key={t} className={cx('flex gap-3 p-3 rounded-2xl', c)}><span className="text-lg">{i}</span><span className="text-sm"><b>{t}</b><br />{b}</span></div>)}</Card>
          </div>
        </>
      )}
      {tab === 'people' && <People E={mine} setE={setE} up={up} setMsg={setMsg} L={CLK} onBadge={(n) => { setQrWho(n); setTab('clock'); }} />}
      {tab === 'onboard' && <Card title="New starters" sub="Tick each step before the person starts selling">{mine.map((e) => { const n = ONB.filter(([k]) => e.onboard[k]).length; return <details key={e.id} className="p-3 rounded-2xl border border-line"><summary className="flex items-center gap-3 cursor-pointer"><Avatar e={e} s={8} /><b className="flex-1 text-sm">{e.name}</b><span className={cx('pill', n === ONB.length ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{n} of {ONB.length}</span></summary><div className="flex flex-col gap-1.5 mt-2">{ONB.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!e.onboard[k]} onChange={() => up(e.id, { onboard: { ...e.onboard, [k]: !e.onboard[k] } })} className="w-4 h-4 accent-[#0b5c5c]" />{l}</label>)}</div></details>; })}</Card>}
      {tab === 'recruit' && <Recruit A={A} setA={setA} onHire={(a) => { setE((x) => [...x, { ...EMPS0[3], id: 'e' + Date.now(), name: a.name, phone: a.phone, since: 2026, onboard: {}, docs: a.docs, color: '#5433eb', title: a.job.split(' · ')[0], br: 'osu' }]); setMsg(`${a.name} hired · onboarding checklist started`); }} setMsg={setMsg} />}
      {tab === 'idcard' && <IdCardsTab E={mine} codes={codes} me={me} />}
      {tab === 'clock' && <ClockAdmin E={mine} codes={codes} gate={gate} L={CLK} me={me} biz={biz} logo={companyLogo()} who={qrWho} setWho={setQrWho} onPunch={doPunch}
        onNewGate={() => reissueGate(me).code} onNewBadge={(n) => reissueBadge(n)} />}
      {tab === 'leave' && <div className="grid gap-6 lg:grid-cols-2 items-start"><Card title="Leave requests">{!Lv.length && <span className="text-sm text-muted">No leave requests.</span>}{Lv.map((l) => <div key={l.id} className="p-3 rounded-2xl border border-line text-sm flex flex-col gap-1"><div className="flex justify-between"><b>{l.who} · {l.kind}</b><span className={cx('pill', l.status === 'approved' ? 'bg-green-100 text-green-800' : l.status === 'declined' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{l.status}</span></div><span className="text-xs text-muted">{new Date(l.from).toLocaleDateString('en-GB')} – {new Date(l.to).toLocaleDateString('en-GB')} · {l.days} days · {l.note}</span>{Lv.some((o) => o !== l && o.status !== 'declined' && E.find((e) => e.name === o.who)?.br === E.find((e) => e.name === l.who)?.br && o.from <= l.to && o.to >= l.from) && <span className="text-xs text-danger">Clashes with another person at the same branch</span>}{l.status === 'pending' && <div className="flex gap-2"><button onClick={() => { setLv((x) => x.map((y) => (y.id === l.id ? { ...y, status: 'approved' } : y))); const e = E.find((x) => x.name === l.who); if (e) up(e.id, { leaveLeft: e.leaveLeft - l.days }); setMsg(`${l.who}’s leave approved`); }} className="btn bg-ok text-white min-h-9 text-xs">Approve</button><button onClick={() => setLv((x) => x.map((y) => (y.id === l.id ? { ...y, status: 'declined' } : y)))} className="btn-ghost min-h-9 text-xs text-danger">Decline</button></div>}</div>)}</Card><Card title="Leave balances"><T head={['Employee', 'Branch', 'Days left']} rows={mine.map((e) => [e.name, brName(e.br), String(e.leaveLeft)])} /></Card></div>}
      {tab === 'perf' && <Card title="Performance" sub="Ratings from monthly reviews, plus an attendance score from the time clock (days attended 40, punctuality 20 minus 4 per late arrival, last 30 days)">{mine.map((e) => { const a = inLastDays(CLK, 30).filter((c) => c.name === e.name); const days = new Set(a.map((c) => c.day)).size; const sc = Math.round(Math.min(1, days / 22) * 40 + Math.max(0, 20 - 4 * a.filter((c) => c.late).length)); return <div key={e.id} className="flex items-center gap-3 text-sm py-1 border-b border-line last:border-0"><Avatar e={e} s={8} /><span className="flex-1"><b>{e.name}</b><br /><span className="text-xs text-muted">{e.title} · {days} day{days === 1 ? '' : 's'} attended</span></span><span className="pill bg-canvas" title="Attendance score out of 60">⏱ {sc}/60</span><span aria-label={`${e.rating} stars`}>{[1, 2, 3, 4, 5].map((s) => <button key={s} aria-label={`Rate ${e.name} ${s}`} onClick={() => { up(e.id, { rating: s }); setMsg(`Review saved for ${e.name}`); }} className={s <= e.rating ? 'text-[#f2b705]' : 'text-[#d9d9d9]'}>★</button>)}</span></div>; })}</Card>}
      {tab === 'docs' && <Card title="Employee document accounts" actions={<button onClick={() => setMsg(`Requests sent to ${mine.filter((e) => DOCS.slice(0, 3).some((d) => !e.docs.includes(d))).length} people for missing documents`)} className="btn-dark min-h-9 text-xs">Request everything missing</button>}>{mine.map((e) => { const miss = ['Ghana Card', 'CV / résumé', 'Contract', 'Passport photo'].filter((d) => !e.docs.includes(d)); return <div key={e.id} className="p-3 rounded-2xl border border-line flex flex-col gap-1.5 text-sm"><div className="flex justify-between"><b>{e.name}</b><span className={cx('pill', miss.length ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800')}>{miss.length ? `${miss.length} missing` : 'Complete'}</span></div><div className="flex gap-1.5 flex-wrap">{e.docs.map((d) => <span key={d} className="pill bg-canvas">{d} <button aria-label={`Remove ${d}`} onClick={() => up(e.id, { docs: e.docs.filter((x) => x !== d) })}>×</button></span>)}</div><div className="flex gap-2 flex-wrap">{miss.map((d) => <button key={d} onClick={() => up(e.id, { docs: [...e.docs, d] })} className="text-xs px-3 py-1 rounded-full border border-line">+ {d}</button>)}</div></div>; })}</Card>}
      {tab === 'roles' && <Card title="Alerts to the Admin and Managers" sub="Sent by SMS and in notifications when they happen.">{([['void', 'A sale is voided'], ['refund200', 'A refund is over GHS 200'], ['late', 'Nobody has signed in at a branch by 09:00'], ['drawer', 'The cash drawer is opened without a sale'], ['disc', 'A discount over the seller’s limit is approved'], ['newdev', 'A till signs in from a new device']] as const).map(([k, l]) => <label key={k} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas text-sm"><span>{l}</span><input type="checkbox" checked={alerts[k] !== false} onChange={() => { setAlerts({ ...alerts, [k]: alerts[k] === false }); setMsg(`${l}: alert ${alerts[k] === false ? 'on' : 'off'}`); }} className="w-5 h-5 accent-[#0b5c5c]" /></label>)}<div className="flex items-center gap-3 flex-wrap text-sm"><span className="flex-1 text-muted">Alerts go to the bell for the Admin and managers. "Nobody signed in by 09:00" is checked every minute while the system is open on any device (not on Sundays).</span>{'Notification' in window && Notification.permission !== 'granted' && <button onClick={() => Notification.requestPermission().then((p) => setMsg(p === 'granted' ? 'Pop-up alerts are on for this device.' : 'Pop-up alerts were not allowed on this device.'))} className="btn-ghost min-h-9 text-xs">Turn on pop-up alerts on this device</button>}</div></Card>}
      {tab === 'roles' && <Card title="What each role may do"><T head={['Role', 'Sell', 'Approve discounts', 'See costs & profit', 'Manage staff', 'Settings']} rows={[['Admin', '✓', '✓', '✓', '✓', '✓'], ['Manager', '✓', '✓ up to GHS 200', '—', '✓ own branch', 'Branch only'], ['Supervisor', '✓', 'Returns only', '—', '—', '—'], ['Sales staff', '✓', '—', '—', '—', '—'], ['Rider', '—', '—', '—', '—', '—']]} /><span className="text-xs text-muted">Each person signs in with their own username, password and 6-digit passcode. Change permissions in Users & permissions.</span></Card>}
    </>
  );
}

/** All employees, add an employee, and the selected employee's profile (with time-clock stats and their badge). */
function People({ E, setE, up, setMsg, L, onBadge }: { E: Emp[]; setE: (f: (x: Emp[]) => Emp[]) => void; up: (id: string, p: Partial<Emp>) => void; setMsg: (m: string) => void; L: Clock[]; onBadge: (name: string) => void }) {
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: '', title: 'Sales staff', phone: '', basic: '', br: 'osu', err: '' });
  const [sel, setSel] = useState('');
  const p = E.find((e) => e.id === sel);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px] items-start">
      <Card title="All employees" actions={<button onClick={() => setAdd(!add)} className="btn-primary min-h-9 text-xs">+ Add employee</button>}>
        {add && <div className="p-4 rounded-2xl bg-canvas grid sm:grid-cols-2 gap-2">{([['name', 'Full name'], ['title', 'Job title'], ['phone', 'Phone'], ['basic', 'Monthly pay (GHS)']] as const).map(([k, l]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l}<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value, err: '' })} className="field py-2 font-normal" /></label>)}{f.err && <span className="text-sm text-danger">{f.err}</span>}<div className="flex gap-2 sm:col-span-2"><button onClick={() => setAdd(false)} className="btn-ghost min-h-9 text-xs">Cancel</button><button onClick={() => { if (f.name.trim().length < 3) return setF({ ...f, err: 'Enter the full name.' }); if (!(parseFloat(f.basic) > 0)) return setF({ ...f, err: 'Enter the monthly pay.' }); setE((x) => [...x, { ...EMPS0[3], id: 'e' + Date.now(), name: f.name.trim(), title: f.title, phone: f.phone, basic: parseFloat(f.basic), br: f.br, since: 2026, onboard: {}, docs: [], color: '#5433eb' }]); setAdd(false); setMsg(`${f.name} added · onboarding started`); setF({ ...f, name: '', phone: '', basic: '' }); }} className="btn-primary min-h-9 text-xs">Save employee</button></div></div>}
        <input aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role or branch" className="field py-2" />
        {E.filter((e) => !q || (e.name + e.title + brName(e.br)).toLowerCase().includes(q.toLowerCase())).map((e) => <button key={e.id} onClick={() => setSel(e.id)} className={cx('flex items-center gap-3 p-3 rounded-2xl text-left', sel === e.id ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}><Avatar e={e} /><span className="flex-1 text-sm"><b>{e.name}</b><br /><span className="text-xs text-muted">{e.title} · {e.br === 'all' ? 'All branches' : brName(e.br)} · since {e.since}</span></span><span className={cx('pill', e.status === 'Active' ? 'bg-brand-50 text-brand' : 'bg-red-100 text-red-800')}>{e.status}</span></button>)}
      </Card>
      {p && <Card title={p.name} sub={`${p.title} · ${p.br === 'all' ? 'All branches' : brName(p.br)}`}>{(() => { const a = inLastDays(L, 30).filter((c) => c.name === p.name); const wk = inLastDays(L, 7).filter((c) => c.name === p.name); return <><div className="grid grid-cols-2 gap-2">{([['Hours last 30 days', `${(a.reduce((x, c) => x + minsOf(c), 0) / 60).toFixed(1)} h · ${a.length} shifts`], ['Late arrivals', `${a.filter((c) => c.late).length} after 08:15`]] as [string, string][]).map(([k, v]) => <div key={k} className="rounded-2xl bg-canvas p-3 flex flex-col"><span className="text-xs text-muted">{k}</span><b className="text-sm">{v}</b></div>)}</div><div className="flex flex-col gap-1"><span className="text-xs text-muted">This week</span>{!wk.length ? <span className="text-sm text-muted">No sign-ins this week.</span> : wk.slice(0, 7).map((c) => <span key={c.id} className="text-sm flex justify-between"><span>{new Date(c.day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span><span className={c.late ? 'text-[#b26a00]' : ''}>{c.inAt}–{c.outAt || 'on duty'}</span></span>)}</div></>; })()}{[['Phone', p.phone], ['Monthly pay', ghs(p.basic)], ['Paid to', p.pay], ['Ghana Card', p.card], ['SSNIT', p.ssnit], ['Leave left', `${p.leaveLeft} days`]].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="text-muted">{k}</span><b>{v}</b></div>)}<div className="flex gap-2 flex-wrap"><button onClick={() => { up(p.id, { status: p.status === 'Suspended' ? 'Active' : 'Suspended' }); setMsg(`${p.name} ${p.status === 'Suspended' ? 'reinstated' : 'suspended · sign-in blocked'}`); }} className="btn-ghost min-h-9 text-xs">{p.status === 'Suspended' ? 'Reinstate' : 'Suspend'}</button><button onClick={() => setMsg(`Message sent to ${p.name}`)} className="btn-ghost min-h-9 text-xs">Send message</button><button onClick={() => onBadge(p.name)} className="btn-primary min-h-9 text-xs">Work badge &amp; QR</button></div></Card>}
    </div>
  );
}

function Recruit({ A, setA, onHire, setMsg }: { A: App[]; setA: (f: (x: App[]) => App[]) => void; onHire: (a: App) => void; setMsg: (m: string) => void }) {
  const [f, setF] = useState('open');
  const mv = (a: App, stage: App['stage'], note: string) => { setA((x) => x.map((y) => (y.id === a.id ? { ...y, stage, note } : y))); if (stage === 'hired') onHire(a); else setMsg(`${a.name} · ${note}`); };
  const score = (a: App) => Math.min(98, 40 + a.docs.length * 9 + (/\d+\s*(year|yr)/i.test(a.note) ? 18 : 0) + (/retail|sales|shop|melcom|rider|licen/i.test(a.note + a.docs.join(' ')) ? 12 : 0) + (a.docs.some((d) => /reference/i.test(d)) ? 6 : 0));
  const why = (a: App) => [a.docs.length >= 3 ? `${a.docs.length} documents uploaded` : 'Few documents', /\d+\s*(year|yr)/i.test(a.note) ? 'relevant experience' : 'experience not stated', a.docs.some((d) => /reference/i.test(d)) ? 'has a reference' : ''].filter(Boolean).join(' · ');
  const L = A.filter((a) => f === 'all' || a.stage === f || (f === 'open' && ['new', 'shortlisted', 'interview', 'offer'].includes(a.stage))).sort((a, b) => score(b) - score(a));
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-4xl bg-black text-white p-5 flex flex-col gap-2"><h2 className="m-0 text-lg font-semibold">✨ Recruitment intelligence</h2><span className="text-sm text-white/80">{A.filter((a) => a.stage === 'new').length} new application(s) since Monday. Gifty Owusu has the most retail experience for the Osu opening. Rita Asante’s offer has not been answered for 4 days — send a reminder.</span></section>
      <Card title="Applicants" actions={<Link to="/web/updates" className="btn-ghost min-h-9 text-xs">+ Post a job opening</Link>}>
        <Pills small opts={[['open', 'In progress'], ['new', 'New'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['offer', 'Offer made'], ['hired', 'Hired'], ['rejected', 'Not selected'], ['all', 'All']]} value={f} onChange={setF} />
        {!L.length && <span className="text-sm text-muted">Nobody here.</span>}
        {L.map((a) => <div key={a.id} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5 text-sm"><div className="flex justify-between gap-2"><span><b>{a.name}</b> <span className="text-xs text-muted">· {a.job} · applied {a.when}</span></span><span className="flex gap-1.5 items-center"><span className={cx('pill', score(a) >= 75 ? 'bg-green-100 text-green-800' : score(a) >= 55 ? 'bg-amber-100 text-amber-900' : 'bg-canvas')} title={why(a)}>✨ {score(a)}</span><span className="pill bg-canvas">{{ new: 'New', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer made', hired: 'Hired', rejected: 'Not selected' }[a.stage]}</span></span></div><span className="text-xs text-muted">AI score · {why(a)}</span><span className="text-xs text-muted">{a.phone} · {a.docs.join(', ')}</span><span>{a.note}</span><div className="flex gap-2 flex-wrap">{a.stage === 'new' && <button onClick={() => mv(a, 'shortlisted', 'Shortlisted')} className="btn-dark min-h-9 text-xs">Shortlist</button>}{a.stage === 'shortlisted' && <button onClick={() => mv(a, 'interview', `Interview invitation sent by SMS & email`)} className="btn-dark min-h-9 text-xs">Send interview invitation</button>}{a.stage === 'interview' && <button onClick={() => mv(a, 'offer', 'Job offer sent · GHS 2,000 a month')} className="btn-dark min-h-9 text-xs">Send job offer</button>}{a.stage === 'offer' && <button onClick={() => mv(a, 'hired', 'Hired')} className="btn-primary min-h-9 text-xs">Mark as hired</button>}{['new', 'shortlisted', 'interview', 'offer'].includes(a.stage) && <button onClick={() => mv(a, 'rejected', 'Not selected · told by SMS')} className="btn-ghost min-h-9 text-xs">Not selected</button>}{a.stage === 'rejected' && <button onClick={() => mv(a, 'new', 'Application reopened')} className="btn-ghost min-h-9 text-xs">Reopen application</button>}</div></div>)}
      </Card>
    </div>
  );
}

/**
 * Self-service People & HR (Manager, Supervisor, Sales staff): "Scan to sign in / out" with the camera or the typed
 * gate code, their ID card, payslip, leave and a getting-started list.
 */
function MyView({ e, roster, code, gate, L, biz, onPunch, Lv, onLeave, msg, setMsg }: { e: Emp; roster: Emp[]; code: string; gate: Gate | null; L: Clock[]; biz: string; onPunch: (name: string, via: string) => { err?: string; msg?: string }; Lv: Leave[]; onLeave: (l: Leave) => void; msg: string; setMsg: (m: string) => void }) {
  const { session } = useSession();
  const [lf, setLf] = useState({ from: '', to: '', kind: 'Annual leave', note: '' });
  const p = payslip(e);
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Hello, {e.name.split(' ')[0]}</h1><p className="m-0 text-sm text-muted">{e.title} · {brName(e.br)}</p></header>
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ClockSelf e={e} code={code} gate={gate} L={L} biz={biz} onPunch={onPunch} />
        <Card title="Getting started">{[['Sign in with your branch, password and 6-digit passcode', true], ['Scan the gate QR when you arrive and leave', L.some((x) => x.name === e.name)], ['Add your photo in My profile (top right)', false], ['Read the “Before you start” guide in Sell Now', false], ['Check your first payslip below', false]].map(([t, ok]) => <span key={t as string} className="text-sm flex gap-2"><span className={ok ? 'text-ok' : 'text-muted'}>{ok ? '✓' : '○'}</span>{t as string}</span>)}</Card>
        {/* My ID card (IDCard.md §6.4): appears once HR has sent the digital copy. */}
        <MyIdCard e={e} code={code} />
        {/* Managers and Supervisors can check a staff ID card is real and current. */}
        {(session?.role === 'manager' || session?.role === 'supervisor') && <div className="lg:col-span-2"><VerifyId E={roster} /></div>}
        <Card title="My payslips" actions={<Link to="/payroll" className="text-sm font-semibold text-brand">All my payslips →</Link>}>{[['Gross', p.gross], ['SSNIT (5.5%)', -p.ssnit], ['PAYE', -p.tax], ['Net pay', p.net]].map(([k, v]) => <div key={k as string} className="flex justify-between text-sm"><span>{k as string}</span><b>{ghs(v as number)}</b></div>)}<span className="text-xs text-muted">October 2026 · paid to {e.pay}</span><button onClick={() => window.print()} className="btn-ghost w-fit">Print or save as PDF</button></Card>
        <Card title="My leave" sub={`${e.leaveLeft} days left this year`}>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold flex flex-col gap-1">First day<input type="date" value={lf.from} onChange={(x) => setLf({ ...lf, from: x.target.value })} className="field py-2 font-normal" /></label><label className="text-xs font-semibold flex flex-col gap-1">Last day<input type="date" value={lf.to} min={lf.from} onChange={(x) => setLf({ ...lf, to: x.target.value })} className="field py-2 font-normal" /></label></div>
          <Pills small opts={[['Annual leave', 'Annual'], ['Sick leave', 'Sick'], ['Compassionate', 'Compassionate']]} value={lf.kind} onChange={(v) => setLf({ ...lf, kind: v })} />
          <input aria-label="Reason" value={lf.note} onChange={(x) => setLf({ ...lf, note: x.target.value })} placeholder="Reason (optional)" className="field py-2" />
          <button onClick={() => { if (!lf.from || !lf.to) return setMsg('Pick the first and last day.'); const days = Math.max(1, Math.round((new Date(lf.to).getTime() - new Date(lf.from).getTime()) / 864e5) + 1); onLeave({ id: 'LV-0' + Date.now().toString().slice(-3), who: e.name, kind: lf.kind, from: lf.from, to: lf.to, days, status: 'pending', note: lf.note || '—' }); setLf({ from: '', to: '', kind: 'Annual leave', note: '' }); }} className="btn-primary w-fit">Send to HR</button>
          {Lv.map((l) => <span key={l.id} className="text-xs">{l.kind} · {l.days} days · <b>{l.status}</b> · {now() && ''}</span>)}
        </Card>
      </div>
    </>
  );
}
