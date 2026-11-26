import { useState } from 'react';
import { usePersist } from '../../lib/persist';
import { accountOf, at, credSet, creds, mfaOk, onDefaultPw, sessionEnd, secLog, SUPPORT, ZT0, ztChecks, type Cred, type LogE, type Sess, type ZtPolicy } from '../../lib/sec';
import { ACCOUNTS } from '../../data/nav';
import { cx } from '../../lib/format';
import { useSession } from '../../lib/session';
import { B, Chips, Sec, Tag } from './dev/ui';
import NoticeModal from '../../components/Notice';

const PRINCIPLES: [string, string][] = [
  ['Never trust, always verify', 'No one is trusted because they are on the shop Wi-Fi or already signed in. Every session proves itself again on every check.'],
  ['Least privilege', 'Each role only sees what it needs. Sales staff never see profit; support never sees cost prices or customers.'],
  ['Assume breach', 'Every action is in a tamper-proof log, and support can end any session at once.'],
  ['Verify explicitly', 'Sensitive actions (accounts, permissions, restores, pay runs, policy) ask for the passcode again, even inside a valid session.'],
  ['One identity, one session', 'Each person has one live session. A new sign-in ends the old one, and a changed role, branch or password ends it at once.'],
];
type Level = 'Traditional' | 'Initial' | 'Advanced' | 'Optimal';
const LV: Level[] = ['Traditional', 'Initial', 'Advanced', 'Optimal'];

export default function ZeroTrust({ me, code, chainOk, sealed, say }: { me?: string; code: Record<string, boolean>; chainOk: boolean; sealed: boolean; say: (m: string) => void }) {
  const [sess] = usePersist<Sess[]>('ecompos.sessions', []);
  const [P, setP] = usePersist<ZtPolicy>('ecompos.ztPolicy', ZT0);
  const [log] = usePersist<LogE[]>('ecompos.secLog', []);
  const [C] = usePersist<Record<string, Cred>>('ecompos.creds', {});
  const [made] = usePersist<{ username: string; name: string; level: string; closed?: boolean }[]>('ecompos.accounts3', []);
  const [open, setOpen] = useState('');
  const [ran, setRan] = useState('');
  const pol = { ...ZT0, ...P };
  const rows = sess.map((s) => ({ s, checks: ztChecks(s, s.role === 'Developer', pol) }));
  const failing = rows.filter((r) => r.s.sid !== me && r.checks.some((c) => !c.ok));
  const devices = Array.from(new Set(sess.map((s) => s.device)));
  const { stepUp: S } = useSession();
  const accts = [...ACCOUNTS.filter((a) => a.role !== 'developer').map((a) => ({ username: a.username, name: a.name, level: a.level })), ...made.filter((m) => !ACCOUNTS.some((a) => a.username === m.username))];
  const weak = accts.filter((a) => !creds()[a.username]?.force && !accountOf(a.username)?.closed && onDefaultPw(a.username)).length;
  void C;
  const set = (p: Partial<ZtPolicy>, what: string) => S(`Change the Zero Trust policy · ${what}`, () => { setP({ ...pol, ...p }); say(what); });
  const run = () => {
    failing.forEach((r) => { const why = r.checks.filter((c) => !c.ok).map((c) => c.why).join(' · '); sessionEnd(r.s.sid); secLog('Zero Trust sign-out', `${r.s.name} on ${r.s.device} · ${why}`, 'medium', r.s.username); });
    secLog('Zero Trust check', `${rows.length} sessions verified · ${failing.length} ended`, 'low', SUPPORT);
    setRan(`Checked ${rows.length} session${rows.length === 1 ? '' : 's'} against ${rows[0]?.checks.length ?? 9} rules · ${failing.length ? `${failing.length} failed and ${failing.length === 1 ? 'was' : 'were'} signed out` : 'all passed'} · ${new Date().toTimeString().slice(0, 5)}`);
  };
  const decisions = [...log].reverse().filter((e) => /Zero Trust|Blocked sign-in|Till PIN refused|Brute-force|Firewall block|Session tampering|Step-up|Access denied|Single session|Session replaced|Password change required/.test(e.type)).slice(0, 25);
  const pillars: [string, Level, string][] = [
    ['Identity', 'Advanced', 'Two-step sign-in for everyone, brute-force lockout, least-privilege roles'],
    ['Devices', pol.deviceBind ? 'Advanced' : 'Initial', pol.deviceBind ? `Device trust on · ${pol.blocked.length} blocked` : 'Device trust off · any device can sign in'],
    ['Networks', code.waf ? 'Advanced' : 'Initial', code.waf ? 'Edge WAF and rate limits in front of the app' : 'In-app sign-in firewall only · edge WAF not connected'],
    ['Applications', code.sast && code.dast ? 'Advanced' : 'Initial', `Sign-in firewall on${code.sast ? ' · code scanning' : ''}${code.dast ? ' · live app scanning' : ''}`],
    ['Data', chainOk && sealed ? 'Advanced' : chainOk ? 'Initial' : 'Traditional', `${chainOk ? 'Hash chain intact' : 'Hash chain broken'}${sealed ? ' · records sealed' : ' · records not sealed'}`],
  ];
  return (
    <>
      <Sec id="zt-h" title="Zero Trust" sub="Every session is treated as untrusted until it proves itself, and it has to prove itself again every few seconds. Nothing is trusted because of where it is or because it was trusted a minute ago.">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">{PRINCIPLES.map(([t, d]) => <div key={t} className="p-4 rounded-2xl bg-canvas flex flex-col gap-1"><strong className="text-sm">✓ {t}</strong><span className="text-xs text-sub">{d}</span></div>)}</div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[[String(rows.length), 'Sessions under watch'], [String(rows.length - failing.length), 'Passing every rule'], [String(failing.length), 'Failing a rule'], [`${pol.recheck} s`, 'Re-check interval']].map(([v, l], i) => <div key={l} className={cx('rounded-2xl p-3', i === 2 && failing.length ? 'bg-red-50' : 'bg-canvas')}><strong className={cx('text-2xl', i === 2 && failing.length ? 'text-danger' : '')}>{v}</strong><br /><span className="text-xs text-muted">{l}</span></div>)}</div>
      </Sec>

      <Sec title="Continuous verification" sub="The same rules the system runs on every open session every few seconds. A session that fails any rule is signed out straight away." actions={<button onClick={run} className={B.dark}>Run Zero Trust check now</button>}>
        <NoticeModal msg={ran} onClose={() => setRan('')} />
        <div className="flex flex-col divide-y divide-line">
          {rows.map(({ s, checks }) => { const bad = checks.filter((c) => !c.ok); const mine = s.sid === me; return (
            <div key={s.sid} className="py-3 flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex-1 min-w-[200px] flex flex-col"><strong className="text-sm">{s.name} {mine && <span className="text-xs text-muted font-normal">· this is you</span>}</strong><span className="text-xs text-muted">{s.role} · {s.branch} · {s.device} · signed in {at(s.at)}</span></span>
                <Tag t={bad.length ? `Fails ${bad.length} of ${checks.length}` : `Passes all ${checks.length}`} tone={bad.length ? 'bad' : 'ok'} />
                <button onClick={() => setOpen(open === s.sid ? '' : s.sid)} aria-expanded={open === s.sid} className={B.sm}>{open === s.sid ? 'Hide checks' : 'See checks'}</button>
                {!mine && <button onClick={() => { sessionEnd(s.sid); secLog('Zero Trust sign-out', `${s.name} on ${s.device} · ended by support`, 'medium', s.username); say(`Ended ${s.name}'s session`); }} className={B.sm}>End session</button>}
              </div>
              {open === s.sid && <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{checks.map((c) => <div key={c.k} className={cx('flex gap-2 items-start p-2.5 rounded-xl text-xs', c.ok ? 'bg-green-50' : 'bg-red-50')}><span className={cx('font-bold', c.ok ? 'text-ok' : 'text-danger')}>{c.ok ? '✓' : '×'}</span><span className="flex flex-col"><strong>{c.label}</strong><span className="text-sub">{c.why}</span></span></div>)}</div>}
            </div>
          ); })}
          {!rows.length && <span className="text-sm text-muted py-3">No one is signed in right now.</span>}
        </div>
      </Sec>

      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <Sec title="Zero Trust policy" sub="Two-step sign-in for every account cannot be turned off.">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold w-48">Longest a session can last</span><Chips value={String(pol.maxAge)} onChange={(v) => set({ maxAge: Number(v) }, `Sessions now end after ${v} hours`)} opts={[['4', '4 h'], ['8', '8 h'], ['12', '12 h']]} /></div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold w-48">Sign out after no activity</span><Chips value={String(pol.idle)} onChange={(v) => set({ idle: Number(v) }, `Automatic sign-out after ${v} minutes without activity`)} opts={[['3', '3 min'], ['5', '5 min'], ['10', '10 min']]} /></div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold w-48">Re-check every session</span><Chips value={String(pol.recheck)} onChange={() => say('The re-check runs every 10 seconds on every device')} opts={[['10', 'Every 10 s']]} /></div>
          {([['branchBind', 'Branch-bound accounts', 'Staff can only sign in to the branch they belong to'], ['deviceBind', 'Device trust', 'Blocked devices are signed out and cannot sign in']] as const).map(([k, l, d]) => <button key={k} role="switch" aria-checked={pol[k]} onClick={() => set({ [k]: !pol[k] } as Partial<ZtPolicy>, `${l} ${pol[k] ? 'turned off' : 'turned on'}`)} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas text-left"><span className="flex flex-col"><span className="text-sm font-medium">{l}</span><span className="text-xs text-muted">{d}</span></span><span className={cx('w-11 h-6 rounded-full p-0.5 flex-none', pol[k] ? 'bg-ok' : 'bg-[#cfcfcf]')}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', pol[k] && 'translate-x-5')} /></span></button>)}
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold w-48">Ask for the passcode again</span><Chips value={String(pol.stepUp)} onChange={(v) => set({ stepUp: Number(v) }, `Sensitive actions re-check the passcode after ${v} minutes`)} opts={[['1', 'Every time (1 min)'], ['5', '5 min'], ['15', '15 min']]} /></div>
          <button role="switch" aria-checked={pol.single} onClick={() => set({ single: !pol.single }, pol.single ? 'Single session turned off · a person may be signed in on several devices' : 'Single session on · a new sign-in ends the person’s other sessions')} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas text-left"><span className="flex flex-col"><span className="text-sm font-medium">One session per person</span><span className="text-xs text-muted">A new sign-in ends that person’s older sessions on every device</span></span><span className={cx('w-11 h-6 rounded-full p-0.5 flex-none', pol.single ? 'bg-ok' : 'bg-[#cfcfcf]')}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', pol.single && 'translate-x-5')} /></span></button>
          {([['Session binding and tamper check', 'The stored session must match the account and the sign-in that issued it. Editing it on the device signs it out.'], ['Instant re-check on any account change', 'A hold, close, reset, role change or revoke ends the session in seconds, in every open tab'], ['New password before the first session', 'Temporary passwords from the Admin must be replaced at sign-in'], ['Branch scope locked', 'Only the Admin can view another branch, whatever is stored on the device']] as const).map(([l, d]) => <div key={l} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="flex flex-col"><span className="text-sm font-medium">{l}</span><span className="text-xs text-muted">{d}</span></span><span className="text-xs font-semibold text-ok flex-none">Always on</span></div>)}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="flex flex-col"><span className="text-sm font-medium">Two-step sign-in for everyone</span><span className="text-xs text-muted">Password plus the person’s own 6-digit passcode · till PIN only after both steps on that device</span></span><Tag t="Always on" tone="ok" /></div>
        </Sec>
        <Sec title="Devices" sub="Every device with an open session. Block one to sign it out and stop it signing in again.">
          {devices.map((d) => { const blocked = pol.blocked.includes(d); const n = sess.filter((s) => s.device === d).length; return <div key={d} className={cx('flex items-center gap-3 p-3 rounded-2xl flex-wrap', blocked ? 'bg-red-50' : 'bg-canvas')}><span className="flex-1 min-w-[160px] flex flex-col"><strong className="text-sm">{d}</strong><span className="text-xs text-muted">{n} session{n === 1 ? '' : 's'} · {blocked ? 'Blocked' : 'Trusted after two-step sign-in'}</span></span><Tag t={blocked ? 'Blocked' : 'Trusted'} tone={blocked ? 'bad' : 'ok'} />{!sess.some((s) => s.device === d && s.sid === me) && <button onClick={() => { if (blocked) set({ blocked: pol.blocked.filter((x) => x !== d) }, `${d} trusted again`); else { set({ blocked: [...pol.blocked, d] }, `${d} blocked and signed out`); sess.filter((s) => s.device === d).forEach((s) => { sessionEnd(s.sid); secLog('Zero Trust sign-out', `${s.name} on ${d} · device blocked`, 'medium', s.username); }); } }} className={B.sm}>{blocked ? 'Trust again' : 'Block device'}</button>}</div>; })}
          {pol.blocked.filter((d) => !devices.includes(d)).map((d) => <div key={d} className="flex items-center gap-3 p-3 rounded-2xl bg-red-50"><span className="flex-1 text-sm"><strong>{d}</strong> · blocked, no open sessions</span><button onClick={() => set({ blocked: pol.blocked.filter((x) => x !== d) }, `${d} trusted again`)} className={B.sm}>Trust again</button></div>)}
          {!devices.length && <span className="text-sm text-muted">No devices signed in.</span>}
        </Sec>
      </div>

      <Sec title="Zero Trust maturity" sub="Where MNest UnifiedPOS stands on each pillar of the CISA Zero Trust Maturity Model.">
        <div className="flex flex-col gap-2">{pillars.map(([p, lv, note]) => <div key={p} className="grid gap-2 md:grid-cols-[140px_1fr_220px] items-center p-3 rounded-2xl bg-canvas"><strong className="text-sm">{p}</strong><span className="text-xs text-sub">{note}</span><div className="flex gap-1">{LV.map((l, i) => <span key={l} title={l} className={cx('flex-1 h-2 rounded-full', i <= LV.indexOf(lv) ? (lv === 'Traditional' ? 'bg-danger' : lv === 'Initial' ? 'bg-[#b26a00]' : 'bg-ok') : 'bg-[#dcdcdc]')} />)}<span className="text-xs font-semibold w-20 text-right">{lv}</span></div></div>)}</div>
        <span className="text-xs text-muted">Connect the edge WAF and code scanning on the Code &amp; edge tab to move Networks and Applications to Advanced.</span>
      </Sec>

      <Sec title="Access decisions" sub="Every time Zero Trust refused or ended access, newest first.">
        {decisions.map((e) => <div key={e.id} className="flex gap-3 text-sm py-1.5 border-b border-line last:border-0 flex-wrap"><span className="text-xs text-muted w-28">{at(e.ts)}</span><strong className="w-44">{e.type}</strong><span className="flex-1 min-w-[200px] text-sub">{e.detail}</span></div>)}
        {!decisions.length && <span className="text-sm text-muted">No access has been refused yet.</span>}
      </Sec>
      <Sec title="Account posture" sub="Zero Trust starts with the accounts. Every account is checked for a shared or temporary password, a pending change, a hold, a lock or closure, and a live session.">
        <div className="flex flex-col divide-y divide-line">
          {accts.map((a) => { const cr = C[a.username] || {}; const acc = accountOf(a.username); const live = sess.filter((s) => s.username === a.username).length; const flags = [acc?.closed && ['Closed', 'bad'], cr.held && ['On hold', 'bad'], cr.locked && !acc?.closed && ['Locked', 'bad'], cr.force && ['Must set a new password', 'warn'], !cr.force && onDefaultPw(a.username) && ['Shared default password', 'bad'], live > 1 && [`${live} sessions`, 'warn'], !cr.pw && !ACCOUNTS.some((x) => x.username === a.username) && ['No password yet · cannot sign in', 'mute']].filter(Boolean) as [string, 'bad' | 'warn' | 'mute'][]; return (
            <div key={a.username} className="py-2.5 flex items-center gap-3 flex-wrap">
              <span className="flex-1 min-w-[200px] flex flex-col"><strong className="text-sm">{a.name}</strong><span className="text-xs text-muted">@{a.username} · {a.level}{live ? ` · signed in${mfaOk(a.name) ? ' · two-step verified' : ''}` : ''}</span></span>
              <span className="flex gap-1.5 flex-wrap">{flags.length ? flags.map(([t, tone]) => <Tag key={t} t={t} tone={tone} />) : <Tag t="Healthy" tone="ok" />}</span>
              {!cr.force && !acc?.closed && onDefaultPw(a.username) && <button onClick={() => S(`Require ${a.name} to set a new password`, () => { credSet(a.username, { force: true }); secLog('Password change required', `${a.name} · shared default password · must set a new one (open sessions ended)`, 'medium', me ? 'admin' : SUPPORT); say(`${a.name} must set a new password at the next sign-in`); })} className={B.sm}>Require new password</button>}
            </div>
          ); })}
        </div>
        <span className="text-xs text-muted">{weak} account{weak === 1 ? '' : 's'} still on a shared or temporary password. Requiring a new password ends that person’s open session straight away.</span>
      </Sec>
    </>
  );
}
