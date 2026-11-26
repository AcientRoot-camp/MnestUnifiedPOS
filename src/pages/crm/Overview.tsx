// CRM overview (§5.1) and the portal homes: Manager (§6.1), Supervisor (§6.2), Sales staff "My day" (§6.3).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BRANCHES } from '../../data/nav';
import { COLLECTIONS, SALES, WEB_ORDERS, type Collection, type WebOrder } from '../../data/sell';
import { readKey } from '../../lib/persist';
import { cx, ghs } from '../../lib/format';
import { BR, STAFF, ctxOf, daysAgo, firstName, fillTemplate, fmtDate, fmtPhone, fmtWhen, health, isOverdue, isToday, lifecycle, logMessage, owesOf, phoneKey, request, scoped, spendOf, uid, audit, addNote, type Ctx, type Lead, type Task, type CrmRole } from './model';
import { Bars, Chips, Empty, Head, ICON, Pill, Tile, TierPill, Toastish, btnG, btnP, btnS, inp, type Crm } from './ui';
import { OnlineStoreCard } from './WebCard';

const DAY = 864e5;
type P = { m: Crm; c: Ctx; say: (s: string) => void };

export default function Overview({ m }: { m: Crm }) {
  const [as, setAs] = useState<CrmRole>(m.c.role);
  const [msg, setMsg] = useState('');
  // The Admin can preview each portal home with that portal's demo person (read from the same data).
  const PREVIEW: Record<CrmRole, [string, string]> = { superuser: [m.c.me, m.c.br], manager: ['Ama Darko', 'osu'], supervisor: ['Kwame Asante', 'osu'], staff: ['Akua Kyei', 'osu'] };
  const c = m.c.role === 'superuser' && as !== 'superuser' ? ctxOf(as, PREVIEW[as][0], PREVIEW[as][1]) : m.c;
  return (
    <>
      {m.c.role === 'superuser' && (
        <div className="flex items-center gap-3 flex-wrap rounded-2xl bg-white shadow-card px-4 py-2.5">
          <span className="text-[13px] font-semibold">View as</span>
          <Chips label="View as" value={as} onChange={setAs} opts={[['superuser', 'Admin · Ebenezer Mensah'], ['manager', 'Manager · Ama Darko'], ['supervisor', 'Supervisor · Kwame Asante'], ['staff', 'Sales staff · Akua Kyei']]} />
          {as !== 'superuser' && <span className="text-xs text-muted">Preview of their home, using their scope. Actions still run as you.</span>}
        </div>
      )}
      {c.role === 'superuser' && <AdminHome m={m} c={c} say={setMsg} />}
      {c.role === 'manager' && <ManagerHome m={m} c={c} say={setMsg} />}
      {c.role === 'supervisor' && <SupervisorHome m={m} c={c} say={setMsg} />}
      {c.role === 'staff' && <StaffHome m={m} c={c} say={setMsg} />}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}

/* ---------- shared bits ---------- */
function useNumbers(m: Crm, c: Ctx, vb: string) {
  const cs = (c.role === 'superuser' ? (vb === 'all' ? m.custs : m.custs.filter((x) => x.br === vb)) : m.custs.filter((x) => x.br === c.br));
  const deals = scoped(m.deals, c, vb); const tasks = scoped(m.tasks, c, vb); const leads = scoped(m.leads, c, vb); const fb = scoped(m.feedback, c, vb);
  const life = cs.map((x) => lifecycle(x));
  const open = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
  const ratings = fb.filter((f) => f.rating);
  const repeat = cs.filter((x) => spendOf(x).count >= 2).length;
  return {
    cs, deals, tasks, leads, fb, open,
    active: life.filter((l) => l !== 'Lapsed').length, newM: life.filter((l) => l === 'New').length, risk: life.filter((l) => l === 'At risk' || l === 'Lapsed').length,
    repeatRate: cs.length ? Math.round((repeat / cs.length) * 100) : 0, openValue: open.reduce((a, d) => a + d.value, 0), weighted: open.reduce((a, d) => a + (d.value * d.probability) / 100, 0),
    overdue: tasks.filter(isOverdue).length, sat: ratings.length ? ratings.reduce((a, f) => a + f.rating, 0) / ratings.length : 0, owed: cs.reduce((a, x) => a + owesOf(x), 0),
    pastSla: fb.filter((f) => f.kind === 'complaint' && f.status !== 'resolved' && f.slaDueAt < Date.now()),
  };
}
function TaskRow({ t, m, c, say, reassign }: { t: Task; m: Crm; c: Ctx; say: (s: string) => void; reassign?: string[] }) {
  const over = isOverdue(t);
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-line text-sm flex-wrap">
      <span className="flex-1 min-w-[180px] flex flex-col"><b className="font-medium">{t.title}</b><span className="text-xs text-muted">{t.type} · {t.assignee} · due {fmtWhen(t.dueAt)}{t.auto ? ' · Automatic' : ''}</span></span>
      {over ? <Pill t="Overdue" tone="warn" /> : isToday(t.dueAt) ? <Pill t="Today" tone="teal" /> : null}
      {reassign && reassign.length > 1 && <select aria-label={`Reassign ${t.title}`} value={t.assignee} onChange={(e) => { m.setTasks(m.tasks.map((x) => (x.id === t.id ? { ...x, assignee: e.target.value, assignedBy: c.me } : x))); audit(c, 'CRM reassignment', `${t.id} reassigned to ${e.target.value}`); say(`Reassigned to ${e.target.value}`); }} className="h-9 rounded-full border border-line px-3 text-[13px]">{reassign.map((n) => <option key={n}>{n}</option>)}</select>}
      <button onClick={() => { m.setTasks(m.tasks.map((x) => (x.id === t.id ? { ...x, status: 'done', doneAt: Date.now() } : x))); say('Follow-up marked done'); }} className="h-9 px-3.5 rounded-full border border-line text-[13px]">Mark done</button>
    </div>
  );
}
function Alerts({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <div role="region" aria-label="Alerts" className="flex flex-col gap-2">{items.map((a) => <div key={a} className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm" style={{ background: '#fff8e1', color: '#7a4a00' }}><b className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#b26a00] text-white">Alert</b>{a}</div>)}</div>;
}
function Card({ title, sub, actions, children, className }: { title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cx('bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3 min-w-0', className)}><div className="flex justify-between gap-3 items-start flex-wrap"><div><h2 className="m-0 text-lg font-semibold">{title}</h2>{sub && <span className="text-[13px] text-muted">{sub}</span>}</div>{actions}</div>{children}</section>;
}
function exportCsv(name: string, rows: (string | number)[][]) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = name; a.click();
}

/* ---------- Admin (§5.1) ---------- */
function AdminHome({ m, c, say }: P) {
  const nav = useNavigate();
  const [br, setBr] = useState(m.vb || 'all');
  const [range, setRange] = useState('month');
  const N = useNumbers(m, c, br);
  const stages = m.settings.stages;
  const top = [...N.cs].sort((a, b) => spendOf(b).total - spendOf(a).total).slice(0, 10);
  const lifeCount = (['New', 'Active', 'Loyal', 'At risk', 'Lapsed'] as const).map((l) => [l, N.cs.filter((x) => lifecycle(x) === l).length] as [string, number]);
  const sales = SALES.filter((s) => br === 'all' || s.br === br);
  const wo = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS).filter((o) => br === 'all' || o.brId === br);
  const channels: [string, number][] = [['Till', sales.filter((s) => s.ch === 'till').length], ['Website', sales.filter((s) => s.ch === 'web').length + wo.filter((o) => o.ch === 'Website').length], ['Phone', wo.filter((o) => o.ch === 'Phone').length], ['WhatsApp', wo.filter((o) => o.ch === 'WhatsApp').length]];
  const goldIdle = m.custs.filter((x) => x.tier === 'Gold' && (spendOf(x).last ? daysAgo(spendOf(x).last) : 999) > 45).length;
  const quiet = m.deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost' && daysAgo(d.stageSince) >= 7).length;
  const exports = m.requests.filter((r) => r.status === 'pending' && (r.type === 'export' || r.type === 'merge')).length;
  const activity = [...m.notes.map((n) => ({ at: n.at, t: `${n.by} · ${n.kind} · ${n.text}` })), ...m.feedback.map((f) => ({ at: f.at, t: `${f.customer} rated ${f.rating}/5 · ${BR[f.branch]}${f.kind === 'complaint' ? ' · complaint' : ''}` })), ...m.leads.map((l) => ({ at: l.createdAt, t: `New lead · ${l.name} · ${l.source} · ${BR[l.branch]}` }))].filter((x) => x.at).sort((a, b) => b.at - a.at).slice(0, 8);
  return (
    <>
      <Head title="CRM" sub="Every customer relationship across the till, website, phone and WhatsApp" actions={<>
        <select aria-label="Branch" value={br} onChange={(e) => setBr(e.target.value)} className="h-10 rounded-full border border-line bg-white px-4 text-sm"><option value="all">All branches</option>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.short}</option>)}</select>
        <select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)} className="h-10 rounded-full border border-line bg-white px-4 text-sm"><option value="month">This month</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This year</option></select>
        <button onClick={() => nav('/crm/leads?new=1')} className={btnP}>+ New lead</button>
        <button onClick={() => { exportCsv('crm-customers.csv', [['Name', 'Phone', 'Branch', 'Tier', 'Lifecycle', 'Health', 'Owes (GHS)'], ...N.cs.map((x) => [x.name, x.phone, BR[x.br] || x.br, x.tier, lifecycle(x), health(x).score, owesOf(x).toFixed(2)])]); audit(c, 'CRM export', `${N.cs.length} customers exported (${br === 'all' ? 'all branches' : BR[br]})`); say('Export downloaded · logged in the Audit trail'); }} className={btnS}>Export</button>
      </>} />
      <Alerts items={[goldIdle ? `${goldIdle} Gold customer${goldIdle === 1 ? ' hasn’t' : 's haven’t'} bought in 45 days` : '', quiet ? `${quiet} deal${quiet === 1 ? ' has' : 's have'} had no contact in 7 days` : '', N.pastSla.length ? `${N.pastSla.length} complaint${N.pastSla.length === 1 ? ' is' : 's are'} past the response time` : '', exports ? `${exports} export or merge request${exports === 1 ? '' : 's'} waiting for you` : ''].filter(Boolean)} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile l="Active customers" v={N.active} n={`${N.cs.length} customers in total`} />
        <Tile l="New this month" v={N.newM} />
        <Tile l="Repeat-purchase rate" v={`${N.repeatRate}%`} n="Bought 2 or more times" />
        <Tile l="Customers at risk" v={N.risk} tone={N.risk ? 'warn' : undefined} n="At risk or lapsed" onClick={() => nav('/crm/segments')} />
        <Tile l="Open deals value" v={ghs(N.openValue)} n={`Weighted ${ghs(N.weighted)}`} onClick={() => nav('/crm/pipeline')} />
        <Tile l="Overdue follow-ups" v={N.overdue} tone={N.overdue ? 'warn' : 'ok'} onClick={() => nav('/crm/tasks')} />
        <Tile l="Average satisfaction" v={N.sat ? `${N.sat.toFixed(1)} / 5` : '—'} n={`${N.fb.filter((f) => f.rating).length} ratings`} onClick={() => nav('/crm/feedback')} />
        <Tile l="Credit owed by CRM customers" v={ghs(N.owed)} tone={N.owed ? 'bad' : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <Card title="Pipeline by stage" sub="Open deals and their value"><Bars money={ghs} rows={stages.map((s) => [s, N.deals.filter((d) => d.stage === s).reduce((a, d) => a + d.value, 0), `${N.deals.filter((d) => d.stage === s).length} deals`])} /></Card>
        <Card title="Customers by lifecycle" sub="New → Active → Loyal → At risk → Lapsed"><Bars rows={lifeCount} /></Card>
        <Card title="Top 10 customers" sub="By spend at the till">{top.map((x, i) => <div key={x.id} className="flex items-center gap-3 text-sm"><span className="w-5 text-muted">{i + 1}</span><span className="flex-1 min-w-0 truncate">{x.name} <span className="text-xs text-muted">· {BR[x.br]}</span></span><TierPill tier={x.tier} /><b className="w-28 text-right">{ghs(spendOf(x).total)}</b></div>)}</Card>
        <Card title="Channel mix" sub="Where customers come from"><Bars rows={channels} /></Card>
        <OnlineStoreCard br={br} leads={m.leads} canPost />
        <Card title="Branch comparison" sub="Osu vs East Legon vs Adum" className="xl:col-span-2">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[620px]"><thead><tr className="text-left text-xs text-muted uppercase tracking-wide">{['Branch', 'Customers', 'At risk', 'Open deals', 'Overdue follow-ups', 'Avg rating', 'Credit owed'].map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{BRANCHES.map((b) => { const cs = m.custs.filter((x) => x.br === b.id); const fb = m.feedback.filter((f) => f.branch === b.id); return <tr key={b.id} className="border-t border-line"><td className="py-2.5 pr-3 font-medium">{b.short}</td><td>{cs.length}</td><td>{cs.filter((x) => ['At risk', 'Lapsed'].includes(lifecycle(x))).length}</td><td>{ghs(m.deals.filter((d) => d.branch === b.id && d.stage !== 'Won' && d.stage !== 'Lost').reduce((a, d) => a + d.value, 0))}</td><td>{m.tasks.filter((t) => t.branch === b.id && isOverdue(t)).length}</td><td>{fb.length ? (fb.reduce((a, f) => a + f.rating, 0) / fb.length).toFixed(1) : '—'}</td><td>{ghs(cs.reduce((a, x) => a + owesOf(x), 0))}</td></tr>; })}</tbody></table></div>
        </Card>
        <Card title="Today’s follow-ups" actions={<Link to="/crm/tasks" className="text-sm underline">All follow-ups</Link>}>{N.tasks.filter((t) => t.status === 'open' && (isToday(t.dueAt) || isOverdue(t))).slice(0, 6).map((t) => <TaskRow key={t.id} t={t} m={m} c={c} say={say} />)}{!N.tasks.some((t) => t.status === 'open' && (isToday(t.dueAt) || isOverdue(t))) && <Empty text="No follow-ups due today." />}</Card>
        <Card title="Recent activity">{activity.map((a, i) => <div key={i} className="flex gap-3 text-sm"><span className="w-2 h-2 rounded-full mt-1.5 flex-none" style={{ background: '#0b5c5c' }} /><span className="flex-1">{a.t}<br /><span className="text-xs text-muted">{fmtWhen(a.at)}</span></span></div>)}</Card>
      </div>
    </>
  );
}

/* ---------- Manager (§6.1) ---------- */
function ManagerHome({ m, c, say }: P) {
  const nav = useNavigate();
  const N = useNumbers(m, c, c.br);
  const team = STAFF.filter((s) => s.br === c.br && s.role !== 'manager');
  const unassigned = N.leads.filter((l) => !l.owner && l.status === 'New' && Date.now() - l.createdAt > DAY);
  const busiest = team.map((s) => [s.name, N.tasks.filter((t) => t.assignee === s.name && isOverdue(t)).length] as [string, number]).sort((a, b) => b[1] - a[1])[0];
  const atRisk = N.cs.filter((x) => ['Gold', 'Silver'].includes(x.tier) && ['At risk', 'Lapsed'].includes(lifecycle(x)));
  const all = m.custs; const coSat = m.feedback.length ? m.feedback.reduce((a, f) => a + f.rating, 0) / m.feedback.length : 0;
  const idx = (mine: number, co: number) => (co ? Math.round((mine / co) * 100) : 100);
  const coRepeat = all.length ? (all.filter((x) => spendOf(x).count >= 2).length / all.length) * 100 : 0;
  const assignFollow = (name: string, phone: string, who: string) => { const t: Task = { id: uid('TK'), type: 'Call', title: `Check in with ${name}`, relatedTo: { kind: 'customer', id: phone, name }, assignee: who, assignedBy: c.me, branch: c.br, dueAt: Date.now() + DAY, status: 'open', auto: false, source: 'At-risk customer' }; m.setTasks([t, ...m.tasks]); audit(c, 'CRM assignment', `${name} follow-up assigned to ${who}`); say(`Follow-up for ${name} assigned to ${who}`); };
  return (
    <>
      <Head title={`CRM · ${BR[c.br]} branch`} sub="My branch · customers, team follow-ups, pipeline and complaints" actions={<>
        <Pill t="My branch" tone="teal" />
        <button onClick={() => nav('/crm/leads?new=1')} className={btnP}>+ New lead</button>
        <button onClick={() => { request('export', `Export ${BR[c.br]} customer list (CSV)`, c, { rows: N.cs.length }); say('Export request sent to Approvals'); }} className={btnS}>Request export</button>
      </>} />
      <Alerts items={[unassigned.length ? `${unassigned.length} lead${unassigned.length === 1 ? '' : 's'} unassigned for over 24 hours` : '', busiest && busiest[1] ? `${firstName(busiest[0])} has ${busiest[1]} overdue follow-up${busiest[1] === 1 ? '' : 's'}` : ''].filter(Boolean)} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile l="Active customers" v={N.active} /><Tile l="New this month" v={N.newM} /><Tile l="Repeat rate" v={`${N.repeatRate}%`} /><Tile l="At-risk customers" v={N.risk} tone={N.risk ? 'warn' : undefined} />
        <Tile l="Open deals" v={ghs(N.openValue)} onClick={() => nav('/crm/pipeline')} /><Tile l="Overdue follow-ups across my team" v={N.overdue} tone={N.overdue ? 'warn' : 'ok'} onClick={() => nav('/crm/tasks')} /><Tile l="Average rating" v={N.sat ? `${N.sat.toFixed(1)} / 5` : '—'} /><Tile l="Credit owed at this branch" v={ghs(N.owed)} tone={N.owed ? 'bad' : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <Card title="Team follow-up board" sub="Open and overdue follow-ups for each person">
          {team.map((s) => { const L = N.tasks.filter((t) => t.assignee === s.name && t.status === 'open'); return <details key={s.name} className="rounded-2xl border border-line p-3"><summary className="cursor-pointer flex items-center gap-2 text-sm"><b className="flex-1">{s.name} <span className="text-xs text-muted font-normal">· {s.role === 'supervisor' ? 'Supervisor' : 'Sales staff'}</span></b><Pill t={`${L.length} open`} />{L.filter(isOverdue).length > 0 && <Pill t={`${L.filter(isOverdue).length} overdue`} tone="warn" />}</summary><div className="flex flex-col gap-2 mt-2">{L.map((t) => <TaskRow key={t.id} t={t} m={m} c={c} say={say} reassign={STAFF.filter((x) => x.br === c.br).map((x) => x.name)} />)}{!L.length && <span className="text-xs text-muted">Nothing open.</span>}</div></details>; })}
        </Card>
        <Card title="Branch pipeline" actions={<Link to="/crm/pipeline" className="text-sm underline">Open pipeline</Link>}><Bars money={ghs} rows={m.settings.stages.map((s) => [s, N.deals.filter((d) => d.stage === s).reduce((a, d) => a + d.value, 0), `${N.deals.filter((d) => d.stage === s).length} deals`])} /></Card>
        <Card title="At-risk Gold and Silver customers" sub="Assign a follow-up before they drift away">{atRisk.map((x) => <div key={x.id} className="flex items-center gap-3 text-sm flex-wrap"><span className="flex-1 min-w-[160px]">{x.name} <TierPill tier={x.tier} /><br /><span className="text-xs text-muted">{lifecycle(x)} · last bought {spendOf(x).last ? `${daysAgo(spendOf(x).last)} days ago` : 'a while ago'}</span></span><select aria-label={`Assign follow-up for ${x.name}`} defaultValue="" onChange={(e) => e.target.value && assignFollow(x.name, x.phone, e.target.value)} className="h-9 rounded-full border border-line px-3 text-[13px]"><option value="">Assign follow-up…</option>{team.map((s) => <option key={s.name}>{s.name}</option>)}</select></div>)}{!atRisk.length && <Empty text="No Gold or Silver customers at risk. Nice work." />}</Card>
        <Card title="Complaints past their response time">{N.pastSla.map((f) => <div key={f.id} className="flex items-center gap-3 text-sm"><span className="flex-1">{f.customer} · {f.category}<br /><span className="text-xs text-muted">{f.comment}</span></span><Pill t={`${Math.round((Date.now() - f.slaDueAt) / 36e5)} h late`} tone="bad" /></div>)}{!N.pastSla.length && <Empty text="Every complaint is inside its response time." />}</Card>
        <Card title="Top customers of the branch">{[...N.cs].sort((a, b) => spendOf(b).total - spendOf(a).total).slice(0, 6).map((x) => <div key={x.id} className="flex items-center gap-3 text-sm"><span className="flex-1">{x.name}</span><TierPill tier={x.tier} /><b className="w-28 text-right">{ghs(spendOf(x).total)}</b></div>)}</Card>
        <OnlineStoreCard br={c.br} leads={m.leads} canPost />
        <Card title="My branch vs company average" sub="An index: 100 is the company average. Other branches’ figures stay private.">
          {[['Average rating', idx(N.sat, coSat)], ['Repeat-purchase rate', idx(N.repeatRate, coRepeat)], ['Follow-ups on time', idx(N.tasks.length - N.overdue, Math.max(1, m.tasks.length - m.tasks.filter(isOverdue).length) / 3)]].map(([l, v]) => <div key={l as string} className="flex items-center gap-3 text-sm"><span className="flex-1">{l as string}</span><b style={{ color: (v as number) >= 100 ? '#1f7a2a' : '#b26a00' }}>{v as number}</b><span className="text-xs text-muted w-28">{(v as number) >= 100 ? 'above average' : 'below average'}</span></div>)}
        </Card>
      </div>
    </>
  );
}

/* ---------- Supervisor (§6.2) ---------- */
function SupervisorHome({ m, c, say }: P) {
  const N = useNumbers(m, c, c.br);
  const team = STAFF.filter((s) => s.team === c.me);
  const teamNames = [c.me, ...team.map((s) => s.name)];
  const todays = N.tasks.filter((t) => teamNames.includes(t.assignee) && t.status === 'open' && (isToday(t.dueAt) || isOverdue(t)));
  const newLeads = N.leads.filter((l) => !l.owner && l.status === 'New');
  const complaints = N.fb.filter((f) => f.kind === 'complaint' && f.status !== 'resolved');
  const col = readKey<Collection[]>('ecompos.collect2', COLLECTIONS).filter((x) => x.branch.toLowerCase().startsWith(BR[c.br].toLowerCase()) && ['ready', 'prep', 'waiting'].includes(x.status));
  const dueToday = N.tasks.filter((t) => t.status === 'open' && isToday(t.dueAt) && (t.type === 'Collect payment'));
  const pend = m.requests.filter((r) => r.status === 'pending' && r.branch === c.br && (r.type === 'close-deal' || r.type === 'gift') && team.some((s) => s.name === r.requestedBy));
  const doneToday = N.tasks.filter((t) => t.status === 'done' && t.doneAt && isToday(t.doneAt) && teamNames.includes(t.assignee)).length;
  const ratedToday = N.fb.filter((f) => isToday(f.at)).length;
  const decide = (id: string, ok: boolean) => {
    const r = m.requests.find((x) => x.id === id); if (!r) return;
    const deal = m.deals.find((d) => d.id === r.payload.deal);
    if (ok && deal && deal.value > m.settings.limits.supDeal) { say(`Over your limit of ${ghs(m.settings.limits.supDeal)} · left in Approvals for the Manager`); return; }
    m.setRequests(m.requests.map((x) => (x.id === id ? { ...x, status: ok ? 'approved' : 'rejected', decidedBy: c.me, decidedAt: Date.now() } : x)));
    if (ok && deal) m.setDeals(m.deals.map((d) => (d.id === deal.id ? { ...d, stage: String(r.payload.want || 'Won'), probability: r.payload.want === 'Lost' ? 0 : 100, stageSince: Date.now() } : d)));
    audit(c, 'CRM approval', `${id} ${ok ? 'approved' : 'declined'}`); say(ok ? 'Approved' : 'Declined');
  };
  return (
    <>
      <Head title="CRM · My team today" sub={`${BR[c.br]} branch · follow-ups, new leads and complaints for your team`} actions={<Pill t="My branch" tone="teal" />} />
      <div className="grid gap-5 lg:grid-cols-3 items-start">
        <Card title="Today’s team follow-ups" sub={`${todays.length} to do · ${todays.filter(isOverdue).length} overdue`}>{todays.map((t) => <TaskRow key={t.id} t={t} m={m} c={c} say={say} reassign={teamNames} />)}{!todays.length && <Empty text="No follow-ups due for the team today." />}</Card>
        <Card title="New leads to hand out" sub="Assign to a team member in one tap">{newLeads.map((l) => <div key={l.id} className="flex flex-col gap-2 p-3 rounded-2xl border border-line text-sm"><span><b>{l.name}</b> · {l.interest}<br /><span className="text-xs text-muted">{l.source} · {fmtWhen(l.createdAt)} · {ghs(l.estValue)}</span></span><div className="flex gap-1.5 flex-wrap">{teamNames.map((n) => <button key={n} onClick={() => { m.setLeads(m.leads.map((x) => (x.id === l.id ? { ...x, owner: n } : x))); audit(c, 'CRM assignment', `${l.id} given to ${n}`); say(`${l.name} given to ${n}`); }} className="min-h-11 px-4 rounded-full border border-brand text-brand text-[13px] font-semibold">{firstName(n)}</button>)}</div></div>)}{!newLeads.length && <Empty text="Every new lead has an owner." />}</Card>
        <Card title="Complaints to handle now">{complaints.map((f) => { const left = Math.round((f.slaDueAt - Date.now()) / 36e5); return <div key={f.id} className="flex flex-col gap-1.5 p-3 rounded-2xl border border-line text-sm"><span className="flex justify-between gap-2"><b>{f.customer}</b><Pill t={left < 0 ? `${-left} h late` : `${left} h left`} tone={left < 0 ? 'bad' : left < 6 ? 'warn' : 'mute'} /></span><span className="text-xs text-muted">{f.category} · {f.comment}</span><Link to="/crm/feedback" className="text-[13px] underline w-fit">Handle</Link></div>; })}{!complaints.length && <Empty text="No open complaints." />}</Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Card title="Customers in store or expected today">
          {col.map((x) => <div key={x.no} className="flex items-center gap-3 text-sm"><span className="flex-1">{x.name} · collect order #{x.no}</span><Pill t={x.status === 'ready' ? 'Ready' : 'Preparing'} tone={x.status === 'ready' ? 'ok' : 'mute'} /></div>)}
          {dueToday.map((t) => <div key={t.id} className="flex items-center gap-3 text-sm"><span className="flex-1">{t.relatedTo.name} · {t.source}</span><Pill t="Due today" tone="teal" /></div>)}
          {!col.length && !dueToday.length && <Empty text="Nobody expected today." />}
        </Card>
        <Card title="Waiting for your approval" sub={`You can approve deals up to ${ghs(m.settings.limits.supDeal)} and gifts up to ${ghs(m.settings.limits.supGift)}`}>{pend.map((r) => <div key={r.id} className="flex flex-col gap-2 p-3 rounded-2xl border border-line text-sm"><span><b>{r.title}</b><br /><span className="text-xs text-muted">{r.requestedBy} · {fmtWhen(r.at)}</span></span><div className="flex gap-2"><button onClick={() => decide(r.id, true)} className={btnP}>Approve</button><button onClick={() => decide(r.id, false)} className={btnG}>Decline</button></div></div>)}{!pend.length && <Empty text="Nothing waiting for you." />}</Card>
      </div>
      <Card title="Team snapshot"><div className="grid gap-3 grid-cols-2 lg:grid-cols-4"><Tile l="Follow-ups done today" v={doneToday} tone="ok" /><Tile l="Ratings received today" v={ratedToday} /><Tile l="Open team follow-ups" v={N.tasks.filter((t) => teamNames.includes(t.assignee) && t.status === 'open').length} /><Tile l="Team deals open" v={N.open.filter((d) => teamNames.includes(d.owner)).length} /></div></Card>
    </>
  );
}

/* ---------- Sales staff "My day" (§6.3) ---------- */
function StaffHome({ m, c, say }: P) {
  const [nl, setNl] = useState({ name: '', phone: '', interest: '', consent: false, err: '' });
  const [tpl, setTpl] = useState<Record<string, string>>({});
  const mine = m.tasks.filter((t) => t.assignee === c.me && t.status === 'open' && (isToday(t.dueAt) || isOverdue(t)));
  const myLeads = m.leads.filter((l) => l.owner === c.me && l.status !== 'Converted' && l.status !== 'Lost');
  const myDeals = m.deals.filter((d) => d.owner === c.me && d.stage !== 'Won' && d.stage !== 'Lost');
  const served = readKey<{ username?: string; staff: string; cust?: { phone: string }; ts: number }[]>('ecompos.sales2', []).filter((s) => s.staff === c.me && s.cust?.phone).map((s) => s.cust!.phone);
  const notedBy = m.notes.filter((n) => n.by === c.me).map((n) => n.customerPhone);
  const ownedFromDeals = m.deals.filter((d) => d.owner === c.me).map((d) => d.customerPhone);
  const myCusts = m.custs.filter((x) => [...served, ...notedBy, ...ownedFromDeals].some((p) => phoneKey(p) === phoneKey(x.phone)));
  const weekAgo = Date.now() - 7 * DAY;
  const doneWeek = m.tasks.filter((t) => t.assignee === c.me && t.status === 'done' && (t.doneAt || t.dueAt) > weekAgo).length;
  const converted = m.leads.filter((l) => l.owner === c.me && l.status === 'Converted').length;
  const myRatings = m.feedback.filter((f) => f.staff === c.me && f.rating);
  const avg = myRatings.length ? myRatings.reduce((a, f) => a + f.rating, 0) / myRatings.length : 0;
  const templates = m.settings.templates;
  const addLead = () => {
    const d = phoneKey(nl.phone);
    if (nl.name.trim().length < 2) return setNl({ ...nl, err: 'Add the name.' });
    if (d.length !== 9) return setNl({ ...nl, err: 'Phone: 9 digits after +233, without the first 0.' });
    if (!nl.interest.trim()) return setNl({ ...nl, err: 'What are they interested in?' });
    const L: Lead = { id: uid('LD'), name: nl.name.trim(), phone: fmtPhone(d), email: '', source: 'Walk-in', interest: nl.interest.trim(), estValue: 0, branch: c.br, owner: c.me, status: 'New', consent: { sms: nl.consent, whatsapp: nl.consent, email: false }, createdBy: c.me, createdAt: Date.now(), lastContactAt: Date.now(), nextStepAt: Date.now() + DAY, nextStep: 'Follow up' };
    m.setLeads([L, ...m.leads]); setNl({ name: '', phone: '', interest: '', consent: false, err: '' }); say(`${L.name} added to My leads`);
  };
  const waSend = (t: Task) => {
    const cu = m.custs.find((x) => phoneKey(x.phone) === phoneKey(t.relatedTo.id)) ; const lead = m.leads.find((l) => l.id === t.relatedTo.id);
    const phone = cu?.phone || lead?.phone || ''; const ok = cu ? cu.whatsapp : lead ? lead.consent.whatsapp : false;
    if (!phone) return say('No phone number on this follow-up.');
    if (!ok) return say('This customer has not opted in to WhatsApp. Call them instead.');
    const tp = templates.find((x) => x.id === (tpl[t.id] || templates[0].id))!;
    const text = fillTemplate(tp.text, { first: firstName(t.relatedTo.name), staff: c.me, branch: BR[c.br], interest: lead?.interest });
    window.open(`https://wa.me/233${phoneKey(phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    logMessage(c, 'WhatsApp', fmtPhone(phone), text); addNote(c, phone, 'message', `WhatsApp sent · ${tp.name}`); say('WhatsApp opened with the approved message · logged in Messages');
  };
  const tel = (t: Task) => { const cu = m.custs.find((x) => phoneKey(x.phone) === phoneKey(t.relatedTo.id)); const lead = m.leads.find((l) => l.id === t.relatedTo.id); return cu?.phone || lead?.phone || ''; };
  return (
    <>
      <Head title="My day" sub={`Your follow-ups, leads and customers · ${BR[c.br]} branch`} />
      <section className="flex flex-col gap-3" aria-labelledby="mf-h">
        <h2 id="mf-h" className="m-0 text-lg font-semibold">My follow-ups today · {mine.length}</h2>
        {!mine.length && <Empty text="No follow-ups today, nice work." />}
        <div className="grid gap-3 md:grid-cols-2">
          {mine.map((t) => { const ph = tel(t); return (
            <article key={t.id} className="bg-white rounded-3xl shadow-card p-4 flex flex-col gap-3">
              <div className="flex justify-between gap-2"><span className="flex flex-col"><b>{t.relatedTo.name}</b><span className="text-sm text-muted">{t.title}</span></span>{isOverdue(t) ? <Pill t="Overdue" tone="warn" /> : <Pill t={new Date(t.dueAt).toTimeString().slice(0, 5)} tone="teal" />}</div>
              {t.auto && <span className="text-xs text-muted">Automatic · {t.source}</span>}
              <select aria-label="Approved message" value={tpl[t.id] || templates[0].id} onChange={(e) => setTpl({ ...tpl, [t.id]: e.target.value })} className="h-11 rounded-full border border-line px-4 text-sm">{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <div className="grid grid-cols-2 gap-2">
                <a href={ph ? `tel:+233${phoneKey(ph)}` : undefined} onClick={() => ph && addNote(c, ph, 'call', `Called about: ${t.title}`)} aria-disabled={!ph} className="min-h-12 rounded-full bg-black text-white font-semibold inline-flex items-center justify-center gap-2">{ICON.phone} Call</a>
                <button onClick={() => waSend(t)} className="min-h-12 rounded-full text-white font-semibold inline-flex items-center justify-center gap-2" style={{ background: '#1f7a2a' }}>{ICON.chat} WhatsApp</button>
                <button onClick={() => { m.setTasks(m.tasks.map((x) => (x.id === t.id ? { ...x, status: 'done', doneAt: Date.now() } : x))); say('Done · well handled'); }} className="min-h-12 rounded-full border border-brand text-brand font-semibold inline-flex items-center justify-center gap-2">{ICON.check} Mark done</button>
                <button onClick={() => { const tm = new Date(); tm.setDate(tm.getDate() + 1); tm.setHours(10, 0, 0, 0); m.setTasks(m.tasks.map((x) => (x.id === t.id ? { ...x, dueAt: tm.getTime() } : x))); say('Snoozed to tomorrow 10:00'); }} className="min-h-12 rounded-full border border-line font-semibold inline-flex items-center justify-center gap-2">{ICON.clock} Snooze to tomorrow</button>
              </div>
            </article>
          ); })}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Card title="My leads" sub="Add a lead in three fields">
          <div className="grid gap-2">
            <label className="text-[13px] font-semibold flex flex-col gap-1">Name<input value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value, err: '' })} className={inp} /></label>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Phone<span className="flex items-center h-12 rounded-full border border-line px-4 gap-2 bg-white"><b>+233</b><input inputMode="numeric" value={nl.phone} onChange={(e) => setNl({ ...nl, phone: e.target.value.replace(/[^\d ]/g, ''), err: '' })} placeholder="24 555 0142" className="flex-1 min-w-0 outline-none font-normal" /></span></label>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Interested in<input value={nl.interest} onChange={(e) => setNl({ ...nl, interest: e.target.value, err: '' })} placeholder='e.g. Samsung 55" TV' className={inp} /></label>
            <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={nl.consent} onChange={() => setNl({ ...nl, consent: !nl.consent })} className="w-5 h-5 accent-[#0b5c5c]" />They agree to receive SMS and WhatsApp updates</label>
            {nl.err && <span role="alert" className="text-sm text-danger">{nl.err}</span>}
            <button onClick={addLead} className={cx(btnP, 'min-h-12 w-full')}>Add lead</button>
          </div>
          {myLeads.map((l) => <div key={l.id} className="flex items-center gap-3 text-sm border-t border-line pt-2"><span className="flex-1">{l.name} · {l.interest}<br /><span className="text-xs text-muted">{l.status} · next: {l.nextStep}</span></span><Link to="/crm/leads" className="text-[13px] underline">Open</Link></div>)}
        </Card>
        <Card title="My customers" sub="People you served recently or that are yours">
          {myCusts.map((x) => { const owe = owesOf(x); const s = spendOf(x); return <div key={x.id} className="flex items-center gap-3 text-sm flex-wrap"><span className="flex-1 min-w-[160px]">{x.name}<br /><span className="text-xs text-muted">{x.points} points · last visit {s.last ? fmtDate(s.last) : '—'}</span></span><TierPill tier={x.tier} />{owe > 0 && <Pill t={`Owes ${ghs(owe)}`} tone="bad" />}</div>; })}
          {!myCusts.length && <Empty text="Customers you serve at the till will show here." />}
        </Card>
        {myDeals.length > 0 && <Card title="My deals" sub="Move up to Quote sent, then ask your supervisor to close">{myDeals.map((d) => <div key={d.id} className="flex items-center gap-3 text-sm flex-wrap"><span className="flex-1 min-w-[160px]"><b>{d.customer}</b> · {d.title}<br /><span className="text-xs text-muted">{d.stage} · {ghs(d.value)}</span></span>{d.stage === 'New' && <button onClick={() => { m.setDeals(m.deals.map((x) => (x.id === d.id ? { ...x, stage: 'Quote sent', probability: 40, stageSince: Date.now() } : x))); say('Moved to Quote sent'); }} className={btnS}>Quote sent</button>}{d.stage !== 'New' && (d.approval?.status === 'pending' ? <Pill t="Waiting for supervisor" tone="warn" /> : <button onClick={() => { request('close-deal', `Mark ${d.id} ${d.customer} as Won (${ghs(d.value)})`, c, { deal: d.id, want: 'Won' }); m.setDeals(m.deals.map((x) => (x.id === d.id ? { ...x, approval: { requestedBy: c.me, status: 'pending', want: 'Won' } } : x))); say('Asked your supervisor to close it'); }} className={btnS}>Ask supervisor to close</button>)}</div>)}</Card>}
        <Card title="My week">
          <div className="grid gap-3 grid-cols-3"><Tile l="Follow-ups done" v={doneWeek} tone="ok" /><Tile l="Leads converted" v={converted} /><Tile l="Average rating" v={avg ? avg.toFixed(1) : '—'} /></div>
          <span className="text-sm text-muted">{doneWeek >= 5 ? 'Great follow-through this week. Customers notice when you call back.' : 'Every follow-up counts. One call today keeps a customer coming back.'}</span>
        </Card>
      </div>
    </>
  );
}
void health; void ghs;
