import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACCOUNTS, BRANCHES } from '../../../data/nav';
import { readKey, usePersist, writeKey } from '../../../lib/persist';
import { useSession } from '../../../lib/session';
import { at, credSet, lockedMins, rateClear, sessions, sessionEnd, SUPPORT, type Cred, type DevAct, type Signin } from '../../../lib/sec';
import { cx } from '../../../lib/format';
import { B, Chips, F, Kpi, Sec, Tag, inp, useDev } from './ui';
import NoticeModal from '../../../components/Notice';

type Person = { username: string; name: string; level: string; role: string; branch: string; email: string; phone: string; kind: string };
const LEVELS = ['Admin', 'Manager', 'Supervisor', 'Sales staff', 'Rider'];
const PERMS: Record<string, string[]> = {
  Admin: ['Sell', 'Refunds', 'Discounts', 'Price changes', 'Approve returns', 'See profit', 'Bank accounts', 'Manage staff', 'All branches'],
  Manager: ['Sell', 'Refunds', 'Discounts', 'Approve returns', 'Stock transfers', 'Manage staff'],
  Supervisor: ['Sell', 'Refunds', 'Approve returns', 'Discounts up to 10%'],
  'Sales staff': ['Sell', 'Own sales', 'Cash-up'],
  Rider: ['Deliveries', 'Collect payment on delivery'],
};
const ALLP = Array.from(new Set(Object.values(PERMS).flat()));
const OTHER: Record<string, Person[]> = {
  c2: [{ username: 'akosua', name: 'Akosua Boateng', level: 'Admin', role: 'superuser', branch: 'all', email: 'akosua@adomcafe.com.gh', phone: '205551020', kind: 'Admin' }, { username: 'yaa', name: 'Yaa Mensah', level: 'Sales staff', role: 'staff', branch: 'c2-1', email: 'yaa@adomcafe.com.gh', phone: '245550190', kind: 'Staff' }],
  c3: [{ username: 'ebenezer.ph', name: 'Ebenezer Mensah', level: 'Admin', role: 'superuser', branch: 'all', email: 'ebenezer@ebenezerunique.com.gh', phone: '244000111', kind: 'Admin' }, { username: 'esi.ph', name: 'Esi Owusu', level: 'Manager', role: 'manager', branch: 'c3-1', email: 'esi@uniquepharmacy.com.gh', phone: '205550011', kind: 'Staff' }],
};
const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Accounts({ sub = '' }: { sub?: string }) {
  const { d, act, locked } = useDev();
  const nav = useNavigate();
  const { signIn, stepUp } = useSession();
  const [C, setC] = usePersist<Record<string, Cred>>('ecompos.creds', {});
  const [audit, setAudit] = usePersist<{ ts: number; t: string }[]>('ecompos.acctAudit', []);
  const [signins] = usePersist<Signin[]>('ecompos.signins', []);
  const [tickets] = usePersist<{ id: string; title: string; to?: string; forwarded?: boolean; status: string }[]>('ecompos.tickets2', []);
  const [tk, setTk] = useState('');
  const [tkTxt, setTkTxt] = useState('');
  const [br, setBr] = useState('all');
  const [q, setQ] = useState('');
  const [f, setF] = useState<'all' | 'held' | 'locked' | 'force' | 'admins' | 'riders'>(sub === 'locked' ? 'locked' : sub === 'held' ? 'held' : 'all');
  const [sel, setSel] = useState<string[]>([]);
  const [open, setOpen] = useState('');
  const [why, setWhy] = useState('');
  const [shown, setShown] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<{ email: string; phone: string; level: string; branch: string } | null>(null);
  const [eErr, setEErr] = useState('');

  const people: Person[] = useMemo(() => (d.co.id === 'main'
    ? ACCOUNTS.filter((a) => a.role !== 'developer').map((a) => ({ username: a.username, name: a.name, level: a.level, role: a.role, branch: a.branch || 'all', email: `${a.username}@ebenezerunique.com.gh`, phone: '24' + a.passcode.slice(0, 7), kind: a.role === 'superuser' ? 'Admin' : a.role === 'rider' ? 'Rider' : 'Staff' }))
    : OTHER[d.co.id] || []).map((p) => { const c = C[p.username] || {}; return { ...p, email: c.email || p.email, phone: c.phone || p.phone, level: c.role || p.level, branch: c.branch || p.branch }; }), [d.co.id, C]);
  const brName = (id: string) => (id === 'all' ? 'All branches' : (d.brs[d.co.id] || []).find((b) => b.id === id)?.name || BRANCHES.find((b) => b.id === id)?.name || id);
  const status = (p: Person) => { const c = C[p.username] || {}; return c.held ? 'On hold' : c.locked || lockedMins(p.username) ? 'Locked' : c.force ? 'Must change password' : 'Active'; };
  const issue = tk === 'other' ? tkTxt.trim() : tickets.find((t) => t.id === tk) ? `${tk} · ${tickets.find((t) => t.id === tk)!.title}` : '';
  const esc = tickets.filter((t) => (t.to === 'support' || t.forwarded) && !['resolved', 'closed'].includes(t.status));
  const rows = people.filter((p) => (br === 'all' || p.branch === br) && (!q || `${p.name} ${p.level} ${brName(p.branch)} ${p.email} ${p.username}`.toLowerCase().includes(q.toLowerCase())) && (f === 'all' || (f === 'held' && status(p) === 'On hold') || (f === 'locked' && status(p) === 'Locked') || (f === 'force' && status(p) === 'Must change password') || (f === 'admins' && p.kind === 'Admin') || (f === 'riders' && p.kind === 'Rider')));
  const change = (names: string[], what: string, p: Partial<Cred> | null, fx?: (u: string) => void) => {
    if (locked) return setMsg('The Admin has paused support access. Ask them to allow it in Users & permissions.');
    if (!issue) return setMsg('Pick the issue you are resolving first. It goes into the audit trail with the change.');
    names.forEach((u) => { if (p) credSet(u, p); fx?.(u); });
    setC(readKey('ecompos.creds', {}));
    const who = names.map((u) => people.find((x) => x.username === u)?.name || u).join(', ');
    const line = `${what} · ${who} · ${d.co.name} · issue: ${issue}`;
    setAudit((A) => [{ ts: Date.now(), t: line }, ...A].slice(0, 300));
    act(`${what} · ${who}`, 'User accounts', issue);
    setMsg(`${what} · ${who}`);
  };
  const endAll = (u: string) => sessions().filter((s) => s.username === u).forEach((s) => sessionEnd(s.sid));
  const D = people.find((p) => p.username === open);
  const hist = readKey<DevAct[]>('ecompos.devLog', []).filter((h) => D && h.what.includes(D.name)).slice(0, 6);
  const permsOf = (p: Person) => { const def = PERMS[p.level] || []; const o = C[p.username]?.perms || {}; return ALLP.map((k) => ({ k, on: o[k] ?? def.includes(k), src: o[k] === undefined ? (def.includes(k) ? 'Role default' : 'Not in role') : 'Changed by support' })); };
  const kinds = { total: people.length, held: people.filter((p) => status(p) === 'On hold').length, locked: people.filter((p) => status(p) === 'Locked').length, force: people.filter((p) => status(p) === 'Must change password').length };

  return (
    <>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4"><Kpi l="Accounts" v={kinds.total} n={d.co.name} /><Kpi l="On hold" v={kinds.held} tone={kinds.held ? 'warn' : undefined} /><Kpi l="Locked" v={kinds.locked} tone={kinds.locked ? 'bad' : undefined} /><Kpi l="Must change password" v={kinds.force} /></div>
      {sub === 'branch' && <Sec title="Accounts by branch" sub="Pick a branch to list only its accounts.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[{ id: 'all', name: 'All branches' }, ...(d.brs[d.co.id] || []).filter((b) => b.status !== 'Archived')].map((b) => { const n = b.id === 'all' ? people.length : people.filter((p) => p.branch === b.id).length; return <button key={b.id} onClick={() => setBr(b.id)} aria-pressed={br === b.id} className={cx('p-3 rounded-2xl text-left flex flex-col', br === b.id ? 'bg-black text-white' : 'bg-canvas')}><strong className="text-sm">{b.name}</strong><span className="text-xs opacity-80">{n} account{n === 1 ? '' : 's'}</span></button>; })}</div>
      </Sec>}
      {sub === 'reset' && <div id="sub-reset" className="scroll-mt-6"><Sec title="Password & PIN resets" sub="Open an account below and use Reset password or Reset till PIN. The temporary password is shown once and also sent to the person.">
        {audit.filter((a) => /Reset|password/i.test(a.t)).slice(0, 10).map((a) => <span key={a.ts + a.t} className="text-sm"><span className="text-xs text-muted">{at(a.ts)} · </span>{a.t}</span>)}
        {!audit.some((a) => /Reset|password/i.test(a.t)) && <span className="text-sm text-muted">No resets yet.</span>}
        <span className="text-xs font-semibold">{people.filter((p) => status(p) === 'Must change password').length} account(s) must change their password at the next sign-in.</span>
      </Sec></div>}
      {sub === 'perms' && <div id="sub-perms" className="scroll-mt-6"><Sec title="Roles & permissions" sub="What each role can do by default. Open an account to change permissions for that person only.">
        <div className="grid gap-2 md:grid-cols-2">{Object.entries(PERMS).map(([r, L]) => <div key={r} className="p-3 rounded-2xl bg-canvas"><strong className="text-sm">{r}</strong> <span className="text-xs text-muted">· {people.filter((p) => p.level === r).length} people</span><div className="flex gap-1 flex-wrap mt-1.5">{L.map((x) => <span key={x} className="text-[11px] px-2 py-0.5 rounded-full bg-white">{x}</span>)}</div></div>)}</div>
      </Sec></div>}
      {sub === 'signins' && <div id="sub-signins" className="scroll-mt-6"><Sec title="Sign-in history" sub="Every sign-in and failed attempt on this server, newest first.">
        <div className="flex flex-col divide-y divide-line">{signins.slice(0, 40).map((x) => <div key={x.ts + x.username} className="flex gap-3 py-2 text-sm flex-wrap"><span className={x.ok ? 'text-ok font-bold' : 'text-danger font-bold'}>{x.ok ? '✓' : '×'}</span><span className="text-xs text-muted w-28">{at(x.ts)}</span><span className="flex-1 min-w-[160px]">{people.find((p) => p.username === x.username)?.name || x.name}{x.why ? ` · ${x.why}` : ''}</span><span className="text-xs text-muted">{x.branch}</span></div>)}</div>
        {!signins.length && <span className="text-sm text-muted">No sign-ins recorded yet.</span>}
      </Sec></div>}
      <NoticeModal msg={msg} onClose={() => setMsg('')} />
      <div className={cx('grid gap-5 items-start', D && 'xl:grid-cols-[1fr_440px]')}>
        <Sec id="am-h" title="User accounts" sub={`${people.length} · every portal except your own`}>
          <div className="rounded-2xl bg-[#fff8e1] p-4 flex flex-col gap-2">
            <strong className="text-sm">Issue you are resolving</strong>
            <span className="text-xs text-sub">Pick the escalated issue or describe it. It is written into the audit trail with every change you make, so the company can see why support touched an account.</span>
            <div className="grid gap-2 md:grid-cols-2">
              <F l="Issue"><select value={tk} onChange={(e) => setTk(e.target.value)} className={inp}><option value="">Choose the issue…</option>{esc.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}<option value="other">Something else · describe it</option></select></F>
              {tk === 'other' && <F l="Describe the issue or ticket number"><input value={tkTxt} onChange={(e) => setTkTxt(e.target.value)} placeholder="e.g. Adum tills cannot sign in after update" className={inp} /></F>}
            </div>
            <span className="text-xs font-semibold">{issue ? `✓ Changes will be logged against: ${issue}` : 'No issue chosen · you cannot change accounts yet'}</span>
          </div>
          <div id="sub-branch" className="grid gap-2 md:grid-cols-2 scroll-mt-6">
            <F l="Branch"><select value={br} onChange={(e) => setBr(e.target.value)} className={inp}><option value="all">All branches</option>{(d.brs[d.co.id] || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></F>
            <F l="Find an account"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role, branch, email or staff number" className={inp} /></F>
          </div>
          <span className="text-xs text-muted"><b className="text-black">{br === 'all' ? `All branches · ${people.length} accounts` : `${brName(br)} · ${people.filter((p) => p.branch === br).length} accounts`}</b></span>
          <div className="flex gap-2 flex-wrap items-center">
            <Chips label="Show" value={f} onChange={setF} opts={[['all', 'Everyone'], ['held', `On hold · ${kinds.held}`], ['locked', `Locked · ${kinds.locked}`], ['force', 'Must change password'], ['admins', 'Admins'], ['riders', 'Riders']]} />
            <button onClick={() => setSel(rows.map((r) => r.username))} className={B.sm}>Select all {rows.length}</button><button onClick={() => setSel([])} className={B.sm}>Clear</button>
          </div>
          {sel.length > 0 && <div className="flex gap-2 flex-wrap items-center p-3 rounded-2xl bg-canvas"><strong className="text-sm mr-1">{sel.length} selected</strong>
            <button onClick={() => change(sel, 'Held accounts', { held: why.trim() || 'Held by support' }, endAll)} className={B.sm}>Hold</button>
            <button onClick={() => change(sel, 'Released holds', { held: '' })} className={B.sm}>Release</button>
            <button onClick={() => change(sel, 'Unlocked accounts', { locked: false }, (u) => rateClear(u))} className={B.sm}>Unlock</button>
            <button onClick={() => change(sel, 'Forced a password change', { force: true })} className={B.sm}>Force password change</button>
            <button onClick={() => change(sel, 'Signed out everywhere', null, endAll)} className={B.sm}>Sign out everywhere</button>
          </div>}
          <div className="flex flex-col divide-y divide-line">
            {rows.map((r) => { const st = status(r); const lst = signins.find((s) => s.username === r.username && s.ok); return (
              <div key={r.username} className="flex items-center gap-3 py-3 flex-wrap sm:flex-nowrap">
                <button role="checkbox" aria-checked={sel.includes(r.username)} aria-label={`Select ${r.name}`} onClick={() => setSel((S) => (S.includes(r.username) ? S.filter((x) => x !== r.username) : [...S, r.username]))} className={cx('w-6 h-6 rounded-md border flex-none text-xs', sel.includes(r.username) ? 'bg-black border-black text-white' : 'border-line')}>{sel.includes(r.username) ? '✓' : ''}</button>
                <span className="w-9 h-9 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center flex-none">{ini(r.name)}</span>
                <span className="flex flex-col min-w-0 flex-1"><strong className="text-sm">{r.name}</strong><span className="text-xs text-muted truncate">{r.level} · {brName(r.branch)} · {r.email}</span></span>
                <Tag t={st} tone={st === 'Active' ? 'ok' : st === 'Locked' ? 'bad' : 'warn'} />
                <span className="text-xs text-muted w-28 hidden md:block">{lst ? at(lst.ts) : 'Today 08:02'}</span>
                <button onClick={() => { setOpen(open === r.username ? '' : r.username); setShown(''); setEdit(null); }} aria-expanded={open === r.username} className={B.sm}>{open === r.username ? 'Close' : 'Open'}</button>
              </div>
            ); })}
            {!rows.length && <span className="text-sm text-muted py-4">No account matches. Clear the search or pick Everyone.</span>}
          </div>
        </Sec>
        {D && (
          <Sec id="ad-h" title={<span className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-black text-white text-sm font-bold flex items-center justify-center">{ini(D.name)}</span>{D.name}</span>} sub={`${D.level} · ${D.kind} account`} actions={<><Tag t={status(D)} tone={status(D) === 'Active' ? 'ok' : 'warn'} /><button onClick={() => setOpen('')} aria-label="Close this account" className="w-8 h-8 rounded-full hover:bg-canvas">×</button></>}>
            {shown && <div role="status" className="rounded-2xl bg-[#fff8e1] p-3 text-sm">{shown}<br /><span className="text-xs text-muted">Shown once. It has also been sent to them.</span></div>}
            <dl className="m-0 grid grid-cols-2 gap-2 text-sm">{[['Username', D.username], ['Branch', brName(D.branch)], ['Email', D.email], ['Phone', '+233 ' + D.phone], ['MFA', 'Password + 6-digit passcode'], ['Till PIN sign-in', C[D.username]?.pinOff ? 'Off' : 'On']].map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 font-semibold truncate">{v}</dd></div>)}</dl>
            {d.co.id === 'main' && <div className="rounded-2xl bg-canvas p-3 flex flex-col gap-2"><strong className="text-sm">See exactly what {D.name.split(' ')[0]} sees</strong><span className="text-xs text-muted">Opens their portal with their menu, branch and permissions. A banner lets you come back here. Everything you do is logged against support.</span><button disabled={locked} onClick={() => { if (!issue) return setMsg('Pick the issue you are resolving first.'); const a = ACCOUNTS.find((x) => x.username === D.username)!; stepUp(`View ${D.name}’s account as support`, () => { writeKey('ecompos.devView', { as: D.username, name: D.name, at: Date.now(), issue }); act(`Viewed ${D.name}'s account`, 'User accounts', issue); signIn(a, a.branch || 'all', { viewAs: true }); nav(a.role === 'rider' ? '/rider' : a.role === 'staff' ? '/sell' : '/'); }); }} className={cx(B.dark, 'w-fit')}>View {D.name.split(' ')[0]}’s account</button></div>}
            <div className="flex justify-between items-center"><strong className="text-sm">Account details</strong><button onClick={() => { setEdit(edit ? null : { email: D.email, phone: D.phone, level: D.level, branch: D.branch }); setEErr(''); }} className={B.sm}>{edit ? 'Cancel' : 'Edit details'}</button></div>
            {edit && <div className="flex flex-col gap-2">
              <F l="Email (used to sign in)"><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className={inp} /></F>
              <F l="Phone"><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 9) })} className={inp} /></F>
              {D.kind !== 'Admin' && <><span className="text-[13px] font-semibold">Role</span><Chips value={edit.level} onChange={(v) => setEdit({ ...edit, level: v })} opts={LEVELS.filter((l) => l !== 'Admin').map((l) => [l, l] as [string, string])} /><span className="text-[13px] font-semibold">Branch</span><Chips value={edit.branch} onChange={(v) => setEdit({ ...edit, branch: v })} opts={(d.brs[d.co.id] || []).map((b) => [b.id, b.name] as [string, string])} /></>}
              {eErr && <span role="alert" className="text-sm text-danger">{eErr}</span>}
              <button onClick={() => { if (!/^\S+@\S+\.\S+$/.test(edit.email)) return setEErr('422 Unprocessable Content · Type a valid email.'); if (edit.phone.length !== 9) return setEErr('422 Unprocessable Content · 9 digits after +233.'); change([D.username], 'Updated account details', { email: edit.email, phone: edit.phone, role: edit.level, branch: edit.branch }); setEdit(null); }} className={cx(B.primary, 'w-fit')}>Save details</button>
            </div>}
            <div className="flex justify-between items-center"><strong className="text-sm">Permissions</strong><button onClick={() => change([D.username], 'Reset permissions to role defaults', { perms: {} })} className={B.sm}>Reset to role defaults</button></div>
            <span className="text-xs text-muted">From the {D.level} role. Changes here override the role for this person only.</span>
            <div className="grid gap-1.5 sm:grid-cols-2">{permsOf(D).map((p) => <button key={p.k} role="switch" aria-checked={p.on} onClick={() => change([D.username], `${p.on ? 'Turned off' : 'Turned on'} “${p.k}”`, { perms: { ...(C[D.username]?.perms || {}), [p.k]: !p.on } })} className={cx('flex justify-between items-center gap-2 px-3 py-2 rounded-xl text-left text-xs', p.on ? 'bg-green-50' : 'bg-canvas')}><span className="flex flex-col"><span className="font-semibold">{p.k}</span><span className="text-muted">{p.src}</span></span><span>{p.on ? '✓' : '—'}</span></button>)}</div>
            <strong className="text-sm">Manage this account</strong>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { const pw = 'Tmp-' + Math.random().toString(36).slice(2, 8) + '!'; change([D.username], 'Reset password', { pw, force: true, tempPw: pw }, endAll); setShown(`Temporary password for ${D.name}: ${pw}`); }} className={B.sm}>Reset password</button>
              <button onClick={() => { const pin = String(1000 + Math.floor(Math.random() * 9000)); change([D.username], 'Reset till PIN', {}); setShown(`New till PIN for ${D.name}: ${pin}`); }} className={B.sm}>Reset till PIN</button>
              <button onClick={() => change([D.username], 'Forced a password change', { force: true })} className={B.sm}>Force password change</button>
              {status(D) === 'Locked' && <button onClick={() => change([D.username], 'Unlocked account', { locked: false }, (u) => rateClear(u))} className={B.sm}>Unlock</button>}
              <button onClick={() => change([D.username], 'Signed out everywhere', null, endAll)} className={B.sm}>Sign out everywhere</button>
              <button onClick={() => change([D.username], C[D.username]?.pinOff ? 'Turned till PIN sign-in on' : 'Turned till PIN sign-in off', { pinOff: !C[D.username]?.pinOff })} className={B.sm}>{C[D.username]?.pinOff ? 'Turn till PIN sign-in on' : 'Turn till PIN sign-in off'}</button>
            </div>
            {!C[D.username]?.held ? <div className="flex gap-2 items-end flex-wrap"><F l="Reason for the hold"><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. Left the company · under investigation · lost phone" className={inp} /></F><button onClick={() => { if (!why.trim()) return setMsg('Type the reason for the hold.'); change([D.username], `Held account (${why.trim()})`, { held: why.trim() }, endAll); setWhy(''); }} className={B.danger}>Hold account</button></div>
              : <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-amber-50 text-sm"><span className="flex-1">On hold · {C[D.username]?.held}</span><button onClick={() => change([D.username], 'Released the hold', { held: '' })} className={B.primary}>Release the hold</button></div>}
            <strong className="text-sm">Recent sign-ins</strong>
            {signins.filter((s) => s.username === D.username).slice(0, 5).map((s) => <span key={s.ts} className="text-xs text-sub">{s.ok ? '✓' : '×'} {at(s.ts)} · {s.branch}{s.why ? ` · ${s.why}` : ''}</span>)}
            {!signins.some((s) => s.username === D.username) && <span className="text-xs text-muted">No sign-ins recorded on this server yet.</span>}
            <strong className="text-sm">What support has done</strong>
            {hist.map((h) => <span key={h.ts} className="text-xs text-sub">{at(h.ts)} · {h.what}{h.issue ? ` · ${h.issue}` : ''}</span>)}
            {!hist.length && <span className="text-xs text-muted">Nothing yet.</span>}
          </Sec>
        )}
      </div>
      {(audit.length > 0 || sub === 'audit') && <div id="sub-audit" className="scroll-mt-6"><Sec id="aa-h" title="Account changes by support" sub={`Shown to the Admin as “${SUPPORT}”`}>{audit.slice(0, sub === 'audit' ? 60 : 12).map((a) => <span key={a.ts + a.t} className="text-sm"><span className="text-muted text-xs">{at(a.ts)} · </span>{a.t}</span>)}{!audit.length && <span className="text-sm text-muted">Support has not changed any account yet.</span>}</Sec></div>}
    </>
  );
}
