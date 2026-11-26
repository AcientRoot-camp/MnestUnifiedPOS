// Grow & team → People & HR (GTeam.md §3–4). HR admins (Admin and eComPOS Support) see every tab: Overview, People,
// Onboarding, Recruitment, ID cards (IDCard.md), Time clock & QR (HRSign.md), Leave, Performance, Documents and
// Roles & devices. Everyone else (Manager, Supervisor, Sales staff) sees My HR: their own sign-ins, ID card,
// onboarding, payslips and leave. The tabs live in ./hr; the time clock and ID cards in TimeClock.tsx / IdCards.tsx.
import { useEffect, useState } from 'react';
import { BRS } from '../../data/catalogue';
import { COMPANY } from '../../data/hirePurchase';
import { PEOPLE } from '../../data/nav';
import { CLOCK_KEY, GATE_KEY, SEEDED_KEY, badgeCodes, clockNow, gateNow, punch, reissueBadge, reissueGate, type Clock, type Gate } from '../../data/clock';
import { ensureStaffNos } from '../../data/idcard';
import { readKey, usePersist } from '../../lib/persist';
import { pushPunch } from '../../lib/serverSync';
import { useSession } from '../../lib/session';
import { companyLogo } from '../../lib/brand';
import { bizInfo } from '../pos/Docs';
import { Tabs } from '../../components/ui';
import { Card } from '../finance/shared';
import { ClockAdmin } from './TimeClock';
import { IdCardsTab } from './IdCards';
import Overview from './hr/Overview';
import People from './hr/People';
import Recruitment from './hr/Recruitment';
import MyHR from './hr/MyHR';
import { Documents, Leave, Onboarding, Performance, Roles } from './hr/Tabs';
import { useHr } from './hr/shared';

type Tab = 'overview' | 'people' | 'onboard' | 'recruit' | 'idcard' | 'clock' | 'leave' | 'perf' | 'docs' | 'roles';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['people', 'People'], ['onboard', 'Onboarding'], ['recruit', 'Recruitment'], ['idcard', 'ID cards'], ['clock', 'Time clock & QR'], ['leave', 'Leave'], ['perf', 'Performance'], ['docs', 'Documents'], ['roles', 'Roles & devices']];

export default function Staff() {
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  // HR admin = Admin or eComPOS Support: every tab. Everyone else: My HR (self-service).
  const HRADMIN = role === 'superuser' || role === 'developer';
  const me = session?.name || PEOPLE[role].name;
  const d = useHr();
  const [CLK, setCLK] = usePersist<Clock[]>(CLOCK_KEY, []);
  const [gate] = usePersist<Gate | null>(GATE_KEY, null);
  const firstBr = BRS[0].id;
  // First load: create the gate code and the demo shifts (both stored, so they only happen once).
  useEffect(() => { if (!readKey(GATE_KEY, null)) gateNow(); if (!readKey(SEEDED_KEY, false)) setCLK(clockNow(d.E, firstBr)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Staff numbers (EMP-1001 …) for anyone without one, kept on the HR record so a number is never reused.
  useEffect(() => { ensureStaffNos(d.E); }, [d.E]);
  const codes = badgeCodes(d.E, d.hr);
  /** One scan: sign in or out (data/clock.ts punch), also told to the server for the 09:00 check. */
  const doPunch = (name: string, via: string) => {
    const r = punch(readKey<Clock[]>(CLOCK_KEY, CLK), d.E, name, via, firstBr); if ('err' in r) return { err: r.err };
    setCLK(r.list);
    const rec = r.list.filter((c) => c.name === name).sort((a, b) => Math.max(b.inTs, b.outTs || 0) - Math.max(a.inTs, a.outTs || 0))[0];
    if (rec) pushPunch(rec.br, name, rec.outTs ? 'out' : 'in');
    return { msg: r.msg };
  };
  const [tab, setTab] = useState<Tab>('overview');
  const [sel, setSel] = useState('');
  const [qrWho, setQrWho] = useState('');
  const [msg, setMsg] = useState<{ t: string; err: boolean } | null>(null);
  const say = (t: string, err = false) => setMsg({ t, err });
  const biz = bizInfo().name;
  const scope = role === 'superuser' ? viewBranch : session?.branch ?? 'osu';
  const staff = d.E.filter((e) => scope === 'all' || e.br === scope || e.br === 'all');
  const active = staff.filter((e) => e.status === 'Active' || e.status === 'On leave');

  if (!HRADMIN) {
    const meE = d.E.find((e) => e.name === me);
    if (!meE) return <><header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">My HR</h1></header><Card title="Not on the staff list">You ({me}) are not on the staff list yet, so there is nothing to sign in to. Ask HR to add you.</Card></>;
    return <MyHR d={d} e={meE} code={codes[meE.name]} gate={gate} biz={biz} onPunch={doPunch} />;
  }

  const pend = d.Lv.filter((l) => l.status === 'pending' && staff.some((e) => e.name === l.who));
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{tab === 'overview' ? `Welcome back, ${me.split(' ')[0]}` : 'People & HR'}</h1><p className="m-0 text-sm text-muted">{scope === 'all' ? 'All branches' : BRS.find((b) => b.id === scope)?.name} under {COMPANY.name} · {active.length} active staff, paid and tracked from one place</p></header>
      {/* Pill tabs on computers, a dropdown on phones and tablets (components/ui Tabs). */}
      <Tabs label="People & HR sections" tabs={TABS.map(([k, l]) => ({ id: k, label: l, badge: k === 'leave' && pend.length ? pend.length : undefined }))} value={tab} onChange={(k) => { setTab(k as Tab); setSel(''); }} />
      {msg && <div role={msg.err ? 'alert' : 'status'} className={msg.err ? 'rounded-2xl bg-red-50 text-danger px-4 py-3 text-sm flex justify-between gap-3' : 'rounded-2xl bg-brand text-white px-4 py-3 text-sm flex justify-between gap-3'}><span>{msg.t}</span><button onClick={() => setMsg(null)} aria-label="Dismiss" className="text-lg leading-none">×</button></div>}
      {tab === 'overview' && <Overview d={d} staff={staff} open={(e) => { setTab('people'); setSel(e.id); }} />}
      {tab === 'people' && <People d={d} staff={staff} codes={codes} sel={sel} setSel={setSel} onBadge={(n) => { setQrWho(n); setTab('clock'); }} say={say} />}
      {tab === 'onboard' && <Onboarding d={d} staff={staff} />}
      {tab === 'recruit' && <Recruitment d={d} admin={role === 'superuser' || role === 'developer'} say={say} />}
      {tab === 'idcard' && <IdCardsTab E={staff} codes={codes} me={me} />}
      {tab === 'clock' && <ClockAdmin E={staff} codes={codes} gate={gate} L={CLK} me={me} biz={biz} logo={companyLogo()} who={qrWho} setWho={setQrWho} onPunch={doPunch}
        onNewGate={() => reissueGate(me).code} onNewBadge={(n) => reissueBadge(n)} />}
      {tab === 'leave' && <Leave d={d} staff={staff} me={me} say={say} />}
      {tab === 'perf' && <Performance d={d} staff={staff} />}
      {tab === 'docs' && <Documents d={d} staff={staff} say={say} />}
      {tab === 'roles' && <Roles say={say} />}
    </>
  );
}
