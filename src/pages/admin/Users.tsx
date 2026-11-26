import { useMemo, useState } from 'react';
import { ACCESS0, type DevAccess } from './Developer';
import { ACCOUNTS, BRANCHES, type Role } from '../../data/nav';
import { EMPS0 } from '../../data/people';
import { readKey, usePersist, writeKey } from '../../lib/persist';
import { PERMS, can, canHold, isDefault, type Grants, type Perm } from '../../lib/perms';
import { credSet, secLog, sessionEnd, sessions, type Cred } from '../../lib/sec';
import { cx } from '../../lib/format';
import { useSession } from '../../lib/session';
import NoticeModal from '../../components/Notice';

type Level = 'Admin' | 'Manager' | 'Supervisor' | 'Sales staff' | 'Rider';
export type UAcc = { username: string; name: string; level: Level; role: Role; br: string; phone: string; email: string; reportsTo: string; closed?: boolean; last: string };
const ROLE_OF: Record<Level, Role> = { Admin: 'superuser', Manager: 'manager', Supervisor: 'supervisor', 'Sales staff': 'staff', Rider: 'rider' };
export const PAY_METHODS: [string, string][] = [['cash', 'Cash'], ['momo', 'Mobile Money'], ['ghpay', 'GhPay'], ['split', 'Split'], ['credit', 'On account (credit)'], ['hp', 'Hire purchase']];
const seed = (): UAcc[] => {
  const base = ACCOUNTS.filter((a) => a.role !== 'developer').map((a) => ({ username: a.username, name: a.name, level: a.level as Level, role: a.role, br: a.branch || 'all', phone: '+233 24 ' + a.passcode.slice(0, 3) + ' ' + a.passcode.slice(3), email: `${a.username}@ebenezerunique.com.gh`, reportsTo: a.role === 'superuser' ? '' : a.role === 'manager' ? 'admin' : a.role === 'supervisor' ? 'ama' : a.role === 'rider' ? 'ama' : 'kwame', last: 'Today 08:02' }));
  const extra = EMPS0.filter((e) => !base.some((b) => b.name === e.name) && e.level !== 'Admin').map((e) => ({ username: e.name.split(' ')[0].toLowerCase() + '.' + e.name.split(' ').slice(-1)[0][0].toLowerCase(), name: e.name, level: e.level, role: ROLE_OF[e.level], br: e.br, phone: e.phone, email: `${e.name.split(' ')[0].toLowerCase()}@ebenezerunique.com.gh`, reportsTo: e.level === 'Manager' ? 'admin' : '', last: '2 days ago' }));
  return [...base, ...extra];
};
const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const brN = (b: string) => (b === 'all' ? 'All branches' : BRANCHES.find((x) => x.id === b)?.short ?? b);
const tmpPw = () => 'Adom' + Math.floor(1000 + Math.random() * 9000) + '!';

export default function Users() {
  const [A, setA] = usePersist<UAcc[]>('ecompos.accounts3', seed());
  const [grants, setGrants] = usePersist<Grants>('ecompos.grants', {});
  const [pay, setPay] = usePersist<Record<string, Record<string, boolean>>>('ecompos.payAllow', {});
  const [C, setC] = usePersist<Record<string, Cred>>('ecompos.creds', {});
  const [devAcc, setDevAcc] = usePersist<DevAccess>('ecompos.devAccess', ACCESS0);
  const [ho, setHo] = usePersist<{ to: string; code: string; at: number } | null>('ecompos.adminHandover', null);
  const [, setOv] = usePersist<Record<string, { role: Role; level: string; branch: string }>>('ecompos.roleOverride', {});
  const { session, stepUp: S } = useSession();
  const [sel, setSel] = useState('');
  const [q, setQ] = useState('');
  const [brF, setBrF] = useState('all');
  const [msg, setMsg] = useState('');
  const [nw, setNw] = useState<null | { name: string; phone: string; email: string; level: Level; br: string; reportsTo: string; must: boolean; pw: string; err: string }>(null);
  const [hold, setHold] = useState('');
  const [hoTo, setHoTo] = useState('');
  const [hoCode, setHoCode] = useState('');
  const [shown, setShown] = useState('');
  const cur = A.find((a) => a.username === sel);
  const status = (a: UAcc) => (a.closed ? 'Closed' : C[a.username]?.held ? 'On hold' : C[a.username]?.locked ? 'Locked' : C[a.username]?.force ? 'Must change password' : 'Active');
  const shownA = A.filter((a) => (brF === 'all' || a.br === brF) && (!q || `${a.name} ${a.level} ${a.username} ${brN(a.br)}`.toLowerCase().includes(q.toLowerCase())));
  const say = (m: string, detail = m) => { setMsg(m); secLog('Account change', detail, 'low', session?.username || 'admin'); };
  const endAll = (u: string) => sessions().filter((s) => s.username === u).forEach((s) => sessionEnd(s.sid));
  const reload = () => setC(readKey('ecompos.creds', {}));
  const tree = useMemo(() => BRANCHES.map((b) => ({ b, mgr: A.filter((a) => a.br === b.id && a.level === 'Manager' && !a.closed), sup: A.filter((a) => a.br === b.id && a.level === 'Supervisor' && !a.closed), staff: A.filter((a) => a.br === b.id && a.level === 'Sales staff' && !a.closed), riders: A.filter((a) => a.br === b.id && a.level === 'Rider' && !a.closed) })), [A]);
  const admin = A.find((a) => a.level === 'Admin');
  const create = () => {
    if (!nw) return;
    if (nw.name.trim().split(/\s+/).length < 2) return setNw({ ...nw, err: '422 Unprocessable Content · Add the full name.' });
    if (nw.phone.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '').length !== 9) return setNw({ ...nw, err: '422 Unprocessable Content · Mobile: 9 digits after +233, without the first 0.' });
    if (!/^\S+@\S+\.\S+$/.test(nw.email)) return setNw({ ...nw, err: '422 Unprocessable Content · Add a work email.' });
    const user = nw.name.trim().split(/\s+/)[0].toLowerCase() + (A.some((a) => a.username === nw.name.trim().split(/\s+/)[0].toLowerCase()) ? '.' + nw.name.trim().split(/\s+/).slice(-1)[0][0].toLowerCase() : '');
    if (A.some((a) => a.username === user)) return setNw({ ...nw, err: `409 Conflict · The username ${user} is taken.` });
    const a: UAcc = { username: user, name: nw.name.trim(), level: nw.level, role: ROLE_OF[nw.level], br: nw.br, phone: nw.phone, email: nw.email, reportsTo: nw.reportsTo, last: 'Never' };
    const pc = String(100000 + Math.floor(Math.random() * 900000));
    setA([...A, a]); credSet(user, { pw: nw.pw, force: nw.must, passcode: pc }); reload();
    say(`${a.name} created · username ${user} · temporary password ${nw.pw} · passcode ${pc}${nw.must ? ' · must change the password at first sign-in' : ''}`, `Created ${a.level} account ${user} for ${a.name} at ${brN(a.br)}`);
    setNw(null); setSel(user);
  };
  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap"><div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Users & permissions</h1><p className="m-0 text-sm text-muted">Admin only · everyone signs in to their own account · there is no “preview as” switch.</p></div><button onClick={() => setNw({ name: '', phone: '', email: '', level: 'Sales staff', br: 'osu', reportsTo: 'kwame', must: true, pw: tmpPw(), err: '' })} className="btn-primary">+ Create account</button></header>
      <NoticeModal msg={msg} onClose={() => setMsg('')} />
      <section className="rounded-4xl bg-black text-white p-5 text-sm flex items-center gap-4 flex-wrap"><span className="flex-1 min-w-[240px] flex flex-col gap-1"><b>MNest UnifiedPOS Support · system developer (anonymous)</b><span className="text-white/75">Support keeps the system running: updates, backups and technical issues you escalate. Every change they make is logged in the Audit trail as “MNest UnifiedPOS Support”.</span><span className="text-xs font-semibold">{devAcc.allowed ? '✓ Support access allowed' : '⏸ Support access paused · support can look but not change anything'}</span></span><button onClick={() => S(`Change MNest UnifiedPOS Support access`, () => { setDevAcc({ ...devAcc, allowed: !devAcc.allowed, by: 'Ebenezer Mensah', at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }); say(devAcc.allowed ? 'Support access paused' : 'Support access allowed'); })} className="btn bg-white text-black min-h-10 text-sm">{devAcc.allowed ? 'Pause support access' : 'Allow support access'}</button></section>

      <section className="card p-5 flex flex-col gap-3" aria-labelledby="tree-h">
        <h2 id="tree-h" className="m-0 text-lg font-semibold">Branch structure</h2>
        <div className="flex items-center gap-2 text-sm"><span className="w-8 h-8 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">{ini(admin?.name ?? 'KA')}</span><b>{admin?.name}</b><span className="pill bg-brand-50 text-brand">Admin · every branch</span></div>
        <div className="grid gap-3 md:grid-cols-3 pl-4 border-l-2 border-line">{tree.map(({ b, mgr, sup, staff, riders }) => <div key={b.id} className="rounded-2xl bg-canvas p-3 flex flex-col gap-1.5 text-sm"><strong>{b.name}</strong>{[['Manager', mgr], ['Supervisor', sup], ['Sales staff', staff], ['Rider', riders]].map(([l, L]) => (L as UAcc[]).length ? <div key={l as string} className="flex flex-col gap-0.5"><span className="text-[11px] text-muted uppercase tracking-wider">{l as string}</span>{(L as UAcc[]).map((a) => <button key={a.username} onClick={() => setSel(a.username)} className="text-left hover:underline">{a.name}</button>)}</div> : null)}</div>)}</div>
      </section>

      <div className={cx('grid gap-6 items-start', cur && 'xl:grid-cols-[1fr_460px]')}>
        <section className="card p-5 flex flex-col gap-3">
          <div className="flex justify-between items-center gap-2 flex-wrap"><h2 className="m-0 text-lg font-semibold">Accounts · {A.filter((a) => !a.closed).length}</h2><div className="flex gap-2 flex-wrap"><select value={brF} onChange={(e) => setBrF(e.target.value)} className="field py-2 w-40" aria-label="Branch"><option value="all">All branches</option>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.short}</option>)}</select><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="field py-2 w-48" /></div></div>
          <div className="flex flex-col divide-y divide-line">{shownA.map((a) => { const st = status(a); return (
            <button key={a.username} onClick={() => { setSel(a.username); setShown(''); }} aria-pressed={sel === a.username} className={cx('flex items-center gap-3 py-2.5 px-2 rounded-xl text-left', sel === a.username ? 'bg-brand-50' : 'hover:bg-canvas', a.closed && 'opacity-50')}>
              <span className="w-9 h-9 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center flex-none">{ini(a.name)}</span>
              <span className="flex-1 min-w-0 flex flex-col"><b className="text-sm">{a.name}</b><span className="text-xs text-muted truncate">{a.level} · {brN(a.br)} · @{a.username}{a.reportsTo ? ` · reports to ${A.find((x) => x.username === a.reportsTo)?.name.split(' ')[0] ?? a.reportsTo}` : ''}</span></span>
              <span className={cx('pill', st === 'Active' ? 'bg-green-100 text-green-800' : st === 'Closed' ? 'bg-canvas' : 'bg-amber-100 text-amber-900')}>{st}</span>
            </button>
          ); })}</div>
        </section>
        {cur && (
          <section className="card p-5 flex flex-col gap-3" aria-label={`Account of ${cur.name}`}>
            <div className="flex justify-between gap-2"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-full bg-black text-white text-sm font-bold flex items-center justify-center">{ini(cur.name)}</span><div><h2 className="m-0 text-lg font-semibold">{cur.name}</h2><span className="text-xs text-muted">{cur.level} · {brN(cur.br)} · @{cur.username}</span></div></div><button onClick={() => setSel('')} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-canvas">×</button></div>
            {shown && <div role="status" className="rounded-2xl bg-warn-bg p-3 text-sm">{shown}<br /><span className="text-xs text-muted">Shown once. It was also sent to {cur.name.split(' ')[0]} by SMS.</span></div>}
            <dl className="m-0 grid grid-cols-2 gap-2 text-sm">{[['Mobile', cur.phone], ['Work email', cur.email], ['Reports to', A.find((x) => x.username === cur.reportsTo)?.name ?? '—'], ['Last sign-in', cur.last], ['Sign-in', 'Password + 6-digit passcode'], ['Status', status(cur)]].map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 font-medium truncate">{v}</dd></div>)}</dl>
            {cur.level !== 'Admin' && cur.level !== 'Rider' && <>
              <div className="flex justify-between items-center"><strong className="text-sm">Permissions</strong><button onClick={() => S(`Reset ${cur.name}’s permissions`, () => { const g = { ...grants }; delete g[cur.username]; setGrants(g); say(`${cur.name}'s permissions reset to ${cur.level} defaults`); })} className="btn-ghost min-h-8 text-xs">Reset to defaults</button></div>
              <span className="text-xs text-muted">The menu and pages follow these straight away. Greyed items are above what a {cur.level} may hold.</span>
              {Array.from(new Set(PERMS.map((p) => p[2]))).map((grp) => <div key={grp} className="flex flex-col gap-1"><span className="text-[11px] text-muted uppercase tracking-wider">{grp}</span><div className="grid gap-1 sm:grid-cols-2">{PERMS.filter((p) => p[2] === grp).map(([k, l]) => { const hold2 = canHold(cur.role, k); const on = can(cur.role, cur.username, k, grants); const changed = grants[cur.username]?.[k] !== undefined && grants[cur.username]?.[k] !== isDefault(cur.role, k); return <button key={k} role="switch" aria-checked={on} disabled={!hold2} onClick={() => S(`Change “${l}” for ${cur.name}`, () => { setGrants({ ...grants, [cur.username]: { ...(grants[cur.username] || {}), [k as Perm]: !on } }); say(`${on ? 'Turned off' : 'Turned on'} “${l}” for ${cur.name}`); })} className={cx('flex justify-between items-center gap-2 px-3 py-2 rounded-xl text-xs text-left', !hold2 ? 'opacity-40 bg-canvas' : on ? 'bg-green-50' : 'bg-canvas')}><span className="flex flex-col"><span className="font-semibold">{l}</span><span className="text-muted">{!hold2 ? `Not for a ${cur.level}` : changed ? 'Changed by you' : 'Role default'}</span></span><span className={cx('w-9 h-5 rounded-full p-0.5 flex-none', on ? 'bg-ok' : 'bg-[#cfcfcf]')}><span className={cx('block w-4 h-4 rounded-full bg-white transition-transform', on && 'translate-x-4')} /></span></button>; })}</div></div>)}
              <strong className="text-sm">Payment methods allowed at the till</strong>
              <div className="flex gap-1.5 flex-wrap">{PAY_METHODS.map(([k, l]) => { const on = pay[cur.username]?.[k] ?? !(cur.level === 'Sales staff' && (k === 'credit' || k === 'hp')); return <button key={k} aria-pressed={on} onClick={() => S(`Change ${l} at the till for ${cur.name}`, () => { setPay({ ...pay, [cur.username]: { ...(pay[cur.username] || {}), [k]: !on } }); say(`${l} ${on ? 'locked' : 'allowed'} at the till for ${cur.name}`); })} className={cx('text-xs px-3 py-1.5 rounded-full border', on ? 'bg-black text-white border-black' : 'border-line')}>{on ? '✓ ' : '🔒 '}{l}</button>; })}</div>
              <span className="text-xs text-muted">A locked method shows “Locked · is turned off for {cur.name.split(' ')[0]}” at the till. A Manager or you can allow it for one sale with a PIN.</span>
            </>}
            <strong className="text-sm">Manage this account</strong>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => S(`Reset ${cur.name}’s password`, () => { const p = tmpPw(); credSet(cur.username, { pw: p, force: true }); reload(); endAll(cur.username); setShown(`Temporary password for ${cur.name}: ${p}`); say(`Password reset for ${cur.name}`); })} className="btn-ghost min-h-9 text-xs">Reset password</button>
              <button onClick={() => S(`Reset ${cur.name}’s passcode`, () => { const p = String(100000 + Math.floor(Math.random() * 900000)); credSet(cur.username, { passcode: p }); reload(); endAll(cur.username); setShown(`New passcode for ${cur.name}: ${p} · till PIN is the last 4 digits (${p.slice(-4)})`); say(`Passcode and till PIN reset for ${cur.name}`); })} className="btn-ghost min-h-9 text-xs">Reset PIN</button>
              {C[cur.username]?.locked && <button onClick={() => S(`Unlock ${cur.name}`, () => { credSet(cur.username, { locked: false }); reload(); say(`${cur.name} unlocked`); })} className="btn-ghost min-h-9 text-xs">Unlock</button>}
            </div>
            {cur.level !== 'Admin' && (!C[cur.username]?.held ? <div className="flex gap-2 items-end flex-wrap"><label className="text-[13px] font-semibold flex flex-col gap-1 flex-1 min-w-[180px]">Reason for a hold<input value={hold} onChange={(e) => setHold(e.target.value)} placeholder="e.g. On leave · under investigation" className="field py-2 font-normal" /></label><button onClick={() => S(`Put ${cur.name} on hold`, () => { if (!hold.trim()) return setMsg('Type the reason for the hold.'); credSet(cur.username, { held: hold.trim() }); reload(); endAll(cur.username); say(`${cur.name} put on hold · ${hold.trim()}`); setHold(''); })} className="btn-ghost min-h-10 text-xs text-danger">Hold account</button></div>
              : <div className="flex items-center gap-2 p-3 rounded-2xl bg-warn-bg text-sm flex-wrap"><span className="flex-1">On hold · {C[cur.username]?.held}</span><button onClick={() => S(`Release ${cur.name}’s hold`, () => { credSet(cur.username, { held: '' }); reload(); say(`${cur.name}'s hold released`); })} className="btn-primary min-h-9 text-xs">Release the hold</button></div>)}
            {cur.level !== 'Admin' && !cur.closed && <button onClick={() => S(`Close ${cur.name}’s account`, () => { if (!window.confirm(`Close ${cur.name}'s account? They will not be able to sign in. Their sales and records stay in the system.`)) return; setA(A.map((x) => (x.username === cur.username ? { ...x, closed: true } : x))); credSet(cur.username, { locked: true }); reload(); endAll(cur.username); say(`${cur.name}'s account closed`); })} className="text-xs text-danger underline w-fit">Close account</button>}
            {cur.closed && <button onClick={() => S(`Reopen ${cur.name}’s account`, () => { setA(A.map((x) => (x.username === cur.username ? { ...x, closed: false } : x))); credSet(cur.username, { locked: false }); reload(); say(`${cur.name}'s account reopened`); })} className="text-xs underline w-fit">Reopen account</button>}
          </section>
        )}
      </div>

      <section className="card p-5 flex flex-col gap-3" aria-labelledby="ho-h">
        <h2 id="ho-h" className="m-0 text-lg font-semibold">Hand over the Admin role</h2>
        <span className="text-sm text-muted">There is one Admin per company. When you hand it over you become a Manager, and the new Admin must accept with a code sent to their phone.</span>
        {!ho ? <div className="flex gap-2 items-end flex-wrap"><label className="text-[13px] font-semibold flex flex-col gap-1">New Admin<select value={hoTo} onChange={(e) => setHoTo(e.target.value)} className="field py-2 font-normal w-64"><option value="">Choose a Manager…</option>{A.filter((a) => a.level === 'Manager' && !a.closed).map((a) => <option key={a.username} value={a.username}>{a.name} · {brN(a.br)}</option>)}</select></label><button onClick={() => S(`Start the Admin hand-over`, () => { if (!hoTo) return setMsg('Choose who becomes the Admin.'); const code = String(100000 + Math.floor(Math.random() * 900000)); setHo({ to: hoTo, code, at: Date.now() }); say(`Hand-over started · a code was sent to ${A.find((a) => a.username === hoTo)?.name}'s phone (demo code ${code})`); })} className="btn-dark">Send the code</button></div>
          : <div className="flex flex-col gap-2 p-3 rounded-2xl bg-warn-bg"><span className="text-sm">Waiting for <b>{A.find((a) => a.username === ho.to)?.name}</b> to accept with the code sent to their phone.</span><div className="flex gap-2 items-end flex-wrap"><label className="text-[13px] font-semibold flex flex-col gap-1">Code they received<input value={hoCode} onChange={(e) => setHoCode(e.target.value.replace(/\D/g, ''))} maxLength={6} inputMode="numeric" className="field py-2 font-normal w-40" /></label><button onClick={() => S(`Hand over the Admin role`, () => { if (hoCode !== ho.code) return setMsg('401 Unauthorized · That code is not right.'); const to = A.find((a) => a.username === ho.to)!; const me2 = admin!; setA(A.map((a) => (a.username === to.username ? { ...a, level: 'Admin', role: 'superuser', br: 'all', reportsTo: '' } : a.username === me2.username ? { ...a, level: 'Manager', role: 'manager', br: to.br, reportsTo: to.username } : a))); setOv((o) => ({ ...o, [to.username]: { role: 'superuser', level: 'Admin', branch: 'all' }, [me2.username]: { role: 'manager', level: 'Manager', branch: to.br } })); writeKey('ecompos.adminHandover', null); setHo(null); setHoCode(''); say(`${to.name} is now the Admin · ${me2.name} is now a Manager at ${brN(to.br)} · sign in again to continue`); })} className="btn-primary">Accept hand-over</button><button onClick={() => { setHo(null); setHoCode(''); say('Hand-over cancelled'); }} className="btn-ghost">Cancel</button></div></div>}
      </section>

      {nw && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setNw(null)}>
          <section role="dialog" aria-modal="true" aria-label="Create account" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 flex flex-col gap-3">
            <div className="flex justify-between"><h2 className="m-0 text-xl font-semibold">Create account</h2><button onClick={() => setNw(null)} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button></div>
            <label className="label">Full name<input value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} className="field" /></label>
            <label className="label">Mobile<div className="flex items-center rounded-full border border-line overflow-hidden"><span className="px-3 text-sm text-muted bg-canvas py-2.5">+233</span><input inputMode="numeric" value={nw.phone} onChange={(e) => setNw({ ...nw, phone: e.target.value })} placeholder="24 555 0142" className="flex-1 px-3 py-2.5 outline-none font-normal" /></div></label>
            <label className="label">Work email<input value={nw.email} onChange={(e) => setNw({ ...nw, email: e.target.value })} placeholder="name@ebenezerunique.com.gh" className="field" /></label>
            <span className="text-[13px] font-semibold">Level</span>
            <div className="flex gap-1.5 flex-wrap">{(['Sales staff', 'Supervisor', 'Manager', 'Rider'] as Level[]).map((l) => <button key={l} aria-pressed={nw.level === l} onClick={() => setNw({ ...nw, level: l, reportsTo: l === 'Manager' ? 'admin' : l === 'Supervisor' ? (A.find((a) => a.level === 'Manager' && a.br === nw.br)?.username ?? 'admin') : (A.find((a) => a.level === 'Supervisor' && a.br === nw.br)?.username ?? 'admin') })} className={cx('text-sm px-3.5 py-1.5 rounded-full border', nw.level === l ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}</div>
            <span className="text-xs text-muted">There is only one Admin. To make someone Admin, use Hand over the Admin role.{nw.level === 'Rider' ? ' Riders use the separate Rider app.' : ''}</span>
            <div className="grid grid-cols-2 gap-2"><label className="label">Branch<select value={nw.br} onChange={(e) => setNw({ ...nw, br: e.target.value })} className="field">{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="label">Reports to<select value={nw.reportsTo} onChange={(e) => setNw({ ...nw, reportsTo: e.target.value })} className="field">{A.filter((a) => !a.closed && ['Admin', 'Manager', 'Supervisor'].includes(a.level)).map((a) => <option key={a.username} value={a.username}>{a.name} · {a.level}</option>)}</select></label></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={nw.must} onChange={() => setNw({ ...nw, must: !nw.must })} className="w-4 h-4 accent-brand" />Must change password at first sign-in</label>
            <label className="label">Temporary password<div className="flex gap-2"><input value={nw.pw} onChange={(e) => setNw({ ...nw, pw: e.target.value })} className="field flex-1" /><button onClick={() => setNw({ ...nw, pw: tmpPw() })} className="btn-ghost">New</button></div></label>
            {nw.err && <span role="alert" className="text-sm text-danger">{nw.err}</span>}
            <button onClick={() => S(`Create an account for ${nw.name || "a new person"}`, create)} className="btn-primary w-fit">Create account</button>
          </section>
        </div>
      )}
    </>
  );
}
