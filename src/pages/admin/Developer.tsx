import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { nowTxt, usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { at, devLog, SUPPORT, type DevAct } from '../../lib/sec';
import { cx } from '../../lib/format';
import Accounts from './dev/Accounts';
import Branches from './dev/Branches';
import Companies from './dev/Companies';
import { ALERTS0, LIMITS, ini, useDevData, type Alert } from './dev/data';
import It from './dev/It';
import Monitor from './dev/Monitor';
import Setup from './dev/Setup';
import Training from './dev/Training';
import Updates from './dev/Updates';
import { B, Ctx, Kpi, Modal, Sec, Tag, type Ask } from './dev/ui';
import NoticeModal from '../../components/Notice';

export const TABS: [string, string][] = [['monitor', 'System monitor'], ['accounts', 'User accounts'], ['escalated', 'Escalated issues'], ['company', 'New company'], ['training', 'Training mode'], ['branches', 'Company branches'], ['it', 'IT management'], ['updates', 'Updates & maintenance'], ['setup', 'Set-up & hand-over'], ['activity', 'My activity'], ['limits', 'Access limits']];
const ALIAS: Record<string, string> = { companies: 'company', tickets: 'escalated' };
export type DevAccess = { allowed: boolean; scope: string; by: string; at: string };
export const ACCESS0: DevAccess = { allowed: true, scope: 'backend maintenance, user accounts, IT and new branches', by: 'Ebenezer Mensah', at: '2 Jan 2026' };

export function SupportOnly() {
  return (
    <div role="alert" className="bg-white rounded-3xl shadow-card p-6 flex flex-col gap-2 max-w-2xl">
      <strong className="text-lg">The Security centre is for MNest UnifiedPOS Support only.</strong>
      <span className="text-sm text-sub">If you think something is wrong with your account, tell your Admin so they can raise it with MNest UnifiedPOS Support.</span>
    </div>
  );
}

type Tk = { id: string; area: string; br: string; title: string; body: string; status: string; pri: string; to?: string; forwarded?: boolean; updates?: { who: string; t: string; at: string }[] };
function Escalated({ act, locked }: { act: (w: string, a?: string) => void; locked: boolean }) {
  const [L, setL] = usePersist<Tk[]>('ecompos.tickets2', []);
  const [open, setOpen] = useState('');
  const esc = L.filter((t) => t.to === 'support' || t.forwarded);
  const up = (id: string, status: string, t: string) => { setL((x) => x.map((k) => (k.id === id ? { ...k, status, updates: [...(k.updates || []), { who: SUPPORT, t, at: nowTxt() }] } : k))); act(`${id} · ${t}`, 'Escalated issues'); };
  const brN = (b: string) => ({ osu: 'Osu', legon: 'East Legon', adum: 'Adum', all: 'All branches' }[b] || b);
  return (
    <Sec title="Technical issues sent to you by the Admin" sub="Tickets the Admin forwarded or raised to MNest UnifiedPOS Support. Staff tickets the Admin has not forwarded stay with the Admin.">
      {!esc.length && <span className="text-sm text-muted">Nothing waiting. The Admin escalates technical problems from Issue tickets.</span>}
      {esc.map((t) => (
        <div key={t.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
          <div className="flex items-start gap-3 flex-wrap"><span className="flex-1 min-w-[200px] flex flex-col"><span className="text-xs text-muted">{t.id} · {t.area} · {brN(t.br)} · {t.pri}</span><strong className="text-sm">{t.title}</strong></span><Tag t={t.status === 'resolved' ? 'Fixed · back to the Admin' : t.status === 'progress' ? 'Working on a fix' : t.status} tone={t.status === 'resolved' || t.status === 'closed' ? 'ok' : t.status === 'progress' ? 'info' : 'warn'} /><button onClick={() => setOpen(open === t.id ? '' : t.id)} className={B.sm}>{open === t.id ? 'Close ticket' : 'Open ticket'}</button></div>
          {open === t.id && <div className="rounded-2xl bg-canvas p-3 flex flex-col gap-2 text-sm"><p className="m-0">{t.body}</p>{(t.updates || []).map((u, i) => <span key={i} className="text-xs text-sub">{u.at} · {u.who}: {u.t}</span>)}
            {!['resolved', 'closed'].includes(t.status) && <div className="flex gap-2 flex-wrap"><button disabled={locked} onClick={() => up(t.id, 'progress', 'Working on a fix')} className={B.ghost}>Reply: working on a fix</button><button disabled={locked} onClick={() => up(t.id, 'resolved', 'Fixed · sent back to the Admin to confirm')} className={B.primary}>Mark fixed · back to the Admin</button></div>}
            <Link to="/tickets" className="text-xs font-semibold underline w-fit">See it in Issue tickets</Link></div>}
        </div>
      ))}
    </Sec>
  );
}

export default function Developer() {
  const { tab, sub = '' } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const d = useDevData();
  useEffect(() => { if (!sub) return; const t = window.setTimeout(() => document.getElementById(`sub-${sub}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); return () => window.clearTimeout(t); }, [sub, tab]);
  const [saved, setSaved] = usePersist<string>('ecompos.devTab', 'monitor');
  const [access] = usePersist<DevAccess>('ecompos.devAccess', ACCESS0);
  const [log] = usePersist<DevAct[]>('ecompos.devLog', []);
  const [alerts] = usePersist<Alert[]>('ecompos.sysAlerts', ALERTS0);
  const [msg, setMsg] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  const t0 = ALIAS[tab || ''] || tab || saved;
  const T = TABS.some(([k]) => k === t0) ? t0 : 'monitor';
  useEffect(() => { if (T !== saved) setSaved(T); }, [T]); // eslint-disable-line react-hooks/exhaustive-deps
  if (session?.role !== 'developer') return <><header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Developer console</h1></header><SupportOnly /></>;
  const locked = !access.allowed;
  const act = (what: string, area = 'Developer console', issue = '') => { devLog(what, area, issue); setMsg(what); };
  const go = (k: string) => nav(`/developer/${k}`);
  const open = alerts.filter((a) => a.state !== 'Resolved');
  const meta = d.meta[d.co.id];
  const brs = (d.brs[d.co.id] || []).filter((b) => b.status !== 'Archived');
  return (
    <Ctx.Provider value={{ d, act, say: setMsg, ask: setAsk, locked }}>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-medium tracking-tightest">Developer console</h1>
        <p className="m-0 text-sm text-muted">{SUPPORT} · anonymous system developer account · backend maintenance only</p>
        <span className={cx('text-xs font-semibold w-fit px-3 py-1 rounded-full', locked ? 'bg-red-100 text-danger' : 'bg-green-100 text-ok')}>{locked ? `Access paused by the Admin (${access.by}) · you can look but not change anything` : `Access: the Admin (${access.by}) allows ${access.scope} · since ${access.at}`}</span>
      </header>
      <section aria-label="System health" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi l="System health" v={open.some((a) => a.sev === 'Critical') ? 'Attention' : 'Good'} n={`${open.length} open alerts`} tone={open.some((a) => a.sev === 'Critical') ? 'bad' : 'ok'} />
        <Kpi l="Uptime · 30 days" v="99.96%" n="API & app servers" tone="ok" />
        <Kpi l="E-VAT queue" v="3" n="receipts waiting for GRA" tone="warn" />
        <Kpi l="Last backup" v="03:00" n="Today · test restore passed" />
      </section>
      <div role="tablist" aria-label="Console sections" className="flex gap-1.5 flex-wrap">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={T === k} onClick={() => go(k)} className={cx('text-sm px-4 py-2 rounded-full whitespace-nowrap', T === k ? 'bg-black text-white font-semibold' : 'bg-white shadow-card hover:bg-canvas')}>{l}</button>)}</div>
      <section aria-label="Company in view" className="bg-white rounded-3xl shadow-card p-4 flex items-center gap-4 flex-wrap">
        <span className="w-12 h-12 rounded-2xl bg-canvas overflow-hidden flex items-center justify-center font-bold flex-none">{d.co.logo ? <img src={d.co.logo} alt="" className="w-full h-full object-contain" /> : ini(d.co.name)}</span>
        <span className="flex-1 min-w-[200px] flex flex-col"><strong className="flex items-center gap-2 flex-wrap">{d.co.name} <Tag t={meta?.held ? 'On hold' : d.co.status} tone={meta?.held || d.co.status === 'Suspended' ? 'bad' : 'ok'} /></strong><span className="text-xs text-muted">{d.co.type} · {d.co.plan} plan · Admin {d.co.owner} · Database <code>{d.co.db}</code></span><span className="text-xs text-muted">{brs.map((b) => b.name).join(' · ')}</span></span>
        <span className="text-xs text-muted">Change the company in the side menu</span>
      </section>
      <NoticeModal msg={msg ? `${msg} · logged as “${SUPPORT}”` : ''} onClose={() => setMsg('')} />
      {T === 'monitor' && <Monitor />}
      {T === 'accounts' && <Accounts key={sub} sub={sub} />}
      {T === 'escalated' && <Escalated act={act} locked={locked} />}
      {T === 'company' && <Companies manage={(id) => { d.setSel(id); go('branches'); }} />}
      {T === 'training' && <Training key={sub} sub={sub} />}
      {T === 'branches' && <Branches />}
      {T === 'it' && <It key={sub} sub={sub} />}
      {T === 'updates' && <Updates />}
      {T === 'setup' && <Setup />}
      {T === 'activity' && <Sec title={`Your activity · shown to the Admin in the audit trail as "${SUPPORT}"`}>{!log.length && <span className="text-sm text-muted">Nothing yet. Everything you do here is listed with the time.</span>}<div className="flex flex-col divide-y divide-line">{log.map((l, i) => <div key={i} className="flex gap-3 py-2.5 text-sm flex-wrap"><span className="text-xs text-muted w-28 flex-none">{at(l.ts)}</span><span className="flex-1 min-w-[200px]">{l.what}{l.issue && <span className="text-xs text-muted"> · issue: {l.issue}</span>}</span><span className="text-xs text-muted">{l.area}</span></div>)}</div></Sec>}
      {T === 'limits' && <Sec title="What this account can and cannot do"><div className="grid gap-2 md:grid-cols-2">{LIMITS.map(([ok, t]) => <div key={t} className={cx('flex gap-3 items-start p-3 rounded-2xl', ok ? 'bg-green-50' : 'bg-red-50')}><span className={cx('w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-none', ok ? 'bg-ok' : 'bg-danger')}>{ok ? '✓' : '×'}</span><span className="text-sm">{t}</span></div>)}</div></Sec>}
      {ask && <Modal title={ask.title} onClose={() => setAsk(null)}><p className="m-0 text-sm text-sub">{ask.body}</p><div className="flex gap-2 justify-end"><button onClick={() => setAsk(null)} className={B.ghost}>Cancel</button><button onClick={() => { ask.act(); setAsk(null); }} className={ask.danger ? cx(B.primary, 'bg-danger') : B.primary}>{ask.cta}</button></div></Modal>}
    </Ctx.Provider>
  );
}
