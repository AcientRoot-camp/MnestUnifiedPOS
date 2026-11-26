import { useEffect, useMemo, useState } from 'react';
import { ACCOUNTS, BRANCHES } from '../../data/nav';
import { SALES, WEB_ORDERS, type WebOrder } from '../../data/sell';
import { readKey, usePersist, writeKey } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { at, credSet, rateClear, sessionEnd, secLog, sha, SUPPORT, verifyChain, type Cred, type LogE, type Sess, type Signin } from '../../lib/sec';
import { cx } from '../../lib/format';
import { SupportOnly } from './Developer';
import ZeroTrust from './ZeroTrust';
import { B, Chips, Sec, Tag } from './dev/ui';
import NoticeModal from '../../components/Notice';
import { Tabs } from '../../components/ui';

type Tab = 'over' | 'zt' | 'access' | 'threat' | 'fw' | 'int' | 'code';
type Threat = { key: string; score: number; title: string; body: string; advice: string; act?: [string, () => void] };
type Refund = { ref: string; sale: string; amt: number; saleAmt: number; by: string; ts: number };
const REF0: Refund[] = [
  { ref: 'RF-1041', sale: '34391022', amt: 38, saleAmt: 76, by: 'Kwame Asante', ts: Date.now() - 3 * 36e5 },
  { ref: 'RF-1042', sale: '34391101', amt: 145, saleAmt: 145, by: 'Kwame Asante', ts: Date.now() - 2 * 36e5 },
  { ref: 'RF-1043', sale: '34391140', amt: 32, saleAmt: 64, by: 'Ama Darko', ts: Date.now() - 36e5 },
];
const DEP0 = [{ ref: 'DEP-0215', amt: 6200, br: 'osu' }, { ref: 'DEP-0216', amt: 4100, br: 'legon' }];
const DEMO_SESS = (): Sess[] => [
  { sid: 'demo-ama', username: 'ama', name: 'Ama Darko', role: 'Manager', branch: 'osu', device: 'Chrome · Windows', at: Date.now() - 3 * 36e5, last: Date.now() - 4 * 6e4 },
  { sid: 'demo-akua', username: 'akua', name: 'Akua Kyei', role: 'Sales staff', branch: 'osu', device: 'Sunmi T2 · Osu Till 1', at: Date.now() - 5 * 36e5, last: Date.now() - 6e4 },
  { sid: 'demo-akua2', username: 'akua', name: 'Akua Kyei', role: 'Sales staff', branch: 'osu', device: 'Safari · iOS', at: Date.now() - 40 * 6e4, last: Date.now() - 9 * 6e4 },
  { sid: 'demo-admin', username: 'admin', name: 'Ebenezer Mensah', role: 'Admin', branch: 'All branches', device: 'Chrome · Mac', at: Date.now() - 2 * 36e5, last: Date.now() - 12 * 6e4 },
];
const SEED_LOG: [string, string, 'low' | 'medium' | 'high', string][] = [
  ['Sign-in', 'Ebenezer Mensah · password and passcode verified · all', 'low', 'admin'],
  ['Failed password', 'Wrong password for “kwesi” · osu', 'medium', 'kwesi'],
  ['Failed password', 'Wrong password for “kwesi” · osu', 'medium', 'kwesi'],
  ['Failed passcode', 'Wrong passcode for “kwesi” · osu', 'medium', 'kwesi'],
  ['Firewall block', "SQL injection in the username field · request stopped before the account check", 'high', "admin' OR 1=1"],
  ['Wrong-branch sign-in', 'Akua Kyei tried to sign in to Adum branch; assigned to Osu branch', 'medium', 'akua'],
  ['Sign-in', 'Ama Darko · password and passcode verified · osu', 'low', 'ama'],
];
const CONTROLS = (s: { chainOk: boolean; locks: number; fw: number; sealed: boolean; edge: boolean }): [string, string, string][] => [
  ['Enforced', 'Multi-factor sign-in', 'Password plus personal 6-digit passcode for every account, riders included'],
  ['Enforced', 'Zero Trust sessions', 'Each session is re-checked every few seconds and on every account change: registered, bound to its account and role, not ended, account active, password current, two-step verified, under the age limit, right branch, trusted device. Sensitive actions ask for the passcode again.'],
  ['Enforced', 'Automatic sign-out', 'After 5 minutes without activity, with a 1-minute warning'],
  ['Active', 'Sign-in firewall', `Blocks SQL injection, scripts, path tricks, command injection and oversized input before the account check · ${s.fw} blocked in 24 h`],
  ['Active', 'Brute-force lockout', `5 wrong attempts blocks the username on that device, with growing waits · ${s.locks} locked now`],
  ['Active', 'Bot protection', 'Hidden trap field and typing-speed check'],
  ['Active', 'Threat & anomaly detection', 'Scores unusual sign-ins, failed attempts, wrong-branch access and refund spikes'],
  [s.chainOk ? 'Intact' : 'Broken', 'Tamper-proof log', 'SHA-256 hash chain · each entry fingerprints the one before it'],
  [s.sealed ? 'Sealed' : 'Not sealed', 'Data integrity checks & seals', 'Finds duplicates and impossible values; seals key records'],
  [s.edge ? 'Set up' : 'Not connected', 'Code & edge protection', 'Code scanning, live app scanning and an edge WAF on your hosting'],
];
const ZT = ['Verify every session continuously', 'Least-privilege roles', 'Branch-bound accounts', '12-hour session limit', 'Support can end any session'];
const ROLES: [string, string][] = [['Admin', 'Everything, every branch; the only role that sees profit and bank accounts.'], ['Manager', "Their branch's sales, stock, staff, approvals and refunds."], ['Supervisor', 'Selling, returns, approvals up to their limit, refunds.'], ['Sales staff', 'The till, their own sales and cash-up.']];
const FWR = ['SQL injection', 'Cross-site scripting', 'Path traversal', 'Command injection', 'Code / template injection', 'Oversized input', 'Bot trap', 'Typing-speed check', 'Brute-force lockout'];
const CODE: { k: string; name: string; what: string; steps: string[] }[] = [
  { k: 'sast', name: 'SAST · static code scanning', what: 'Finds unsafe code before it is released.', steps: ['Put the code in GitHub', 'Turn on CodeQL code scanning or add Semgrep', 'Block a release on high-severity findings'] },
  { k: 'dast', name: 'DAST · live app scanning', what: 'Attacks a copy of the running app the way a hacker would.', steps: ['Deploy a staging copy', 'Schedule a weekly OWASP ZAP baseline scan', 'Fix high findings before release'] },
  { k: 'waf', name: 'Edge WAF & API protection', what: 'Stops attacks at the edge, before they reach the app.', steps: ['Put the domain behind Cloudflare or a similar CDN', 'Turn on managed WAF rules and the OWASP core rule set', 'Rate-limit /login and the API', 'Enable bot management'] },
];
const SEALS = ['User credentials', 'Sales', 'Refunds', 'Bank deposits', 'Online orders'] as const;
const brN = (b: string) => BRANCHES.find((x) => x.id === b)?.name.replace(' branch', '') || b;

export default function Security() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('over');
  const [log] = usePersist<LogE[]>('ecompos.secLog', []);
  const [sess] = usePersist<Sess[]>('ecompos.sessions', []);
  const [rate, setRate] = usePersist<Record<string, { n: number; until: number; step: number; fails?: number[] }>>('ecompos.secRate', {});
  const [C, setC] = usePersist<Record<string, Cred>>('ecompos.creds', {});
  const [dis, setDis] = usePersist<string[]>('ecompos.secDismissed', []);
  const [seals, setSeals] = usePersist<Record<string, { hash: string; at: number; n: number }>>('ecompos.secSeals', {});
  const [code, setCode] = usePersist<Record<string, boolean>>('ecompos.secCode', {});
  const [signins] = usePersist<Signin[]>('ecompos.signins', []);
  const [wo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [refunds] = usePersist<Refund[]>('ecompos.refunds', REF0);
  const [deps] = usePersist('ecompos.deposits', DEP0);
  const [chain, setChain] = useState<{ ok: boolean; n: number; bad: string[] } | null>(null);
  const [cur, setCur] = useState<Record<string, string>>({});
  const [lf, setLf] = useState('all');
  const [msg, setMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  const me = session?.username;
  const say = (m: string, detail?: string) => { setMsg(m); secLog('Support action', detail || m, 'low', SUPPORT); };

  // Seed a first history so every panel has something to show, then keep the "as of" clock live.
  useEffect(() => {
    if (!readKey<LogE[]>('ecompos.secLog', []).length) SEED_LOG.forEach(([t, dt, s, w]) => secLog(t, dt, s, w));
    if (!readKey<string>('ecompos.secSeeded', '')) { writeKey('ecompos.sessions', [...readKey<Sess[]>('ecompos.sessions', []), ...DEMO_SESS()]); writeKey('ecompos.secSeeded', '1'); }
    const t = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { verifyChain(log).then(setChain); }, [log]);
  const datasets = useMemo<Record<string, [string, number]>>(() => ({
    'User credentials': [JSON.stringify(ACCOUNTS.map((a) => [a.username, C[a.username]?.pw || a.password, a.passcode])), ACCOUNTS.length],
    Sales: [JSON.stringify(SALES.map((s) => [s.no, s.total, s.status])), SALES.length],
    Refunds: [JSON.stringify(refunds), refunds.length],
    'Bank deposits': [JSON.stringify(deps), (deps as unknown[]).length],
    'Online orders': [JSON.stringify(wo.map((o) => [o.id, o.items, o.fee, o.status])), wo.length],
  }), [C, refunds, deps, wo]);
  useEffect(() => { (async () => { const o: Record<string, string> = {}; for (const k of SEALS) o[k] = await sha(datasets[k][0]); setCur(o); })(); }, [datasets]);

  if (session?.role !== 'developer') return <><header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Security centre</h1></header><SupportOnly /></>;

  const day = (e: { ts: number }) => now - e.ts < 864e5;
  const fwBlocks = log.filter((e) => day(e) && ['Firewall block', 'Bot trap', 'Typing-speed check', 'Brute-force lockout'].includes(e.type));
  const locks = Object.entries(rate).filter(([, r]) => r.until > now);
  const defaults = ACCOUNTS.filter((a) => !C[a.username]?.pw);
  const T: Threat[] = [];
  // Possible password guessing: 3+ failures in 24 h.
  const fails: Record<string, number> = {};
  log.filter((e) => day(e) && /^Failed (password|passcode)/.test(e.type)).forEach((e) => { fails[e.who] = (fails[e.who] || 0) + 1; });
  Object.entries(fails).filter(([, n]) => n >= 3).forEach(([u, n]) => T.push({ key: `guess:${u}:${n}`, score: Math.min(95, 40 + 10 * n), title: `Possible password guessing on “${u}”`, body: `${n} failed sign-in or passcode attempts in the last 24 hours.`, advice: 'Lock the account and ask the person to reset their password with the Admin.', act: ACCOUNTS.some((a) => a.username === u) ? ['Lock account', () => { credSet(u, { locked: true }); setC(readKey('ecompos.creds', {})); sess.filter((s) => s.username === u).forEach((s) => sessionEnd(s.sid)); say(`Locked “${u}” and ended their sessions`); }] : undefined }));
  if (fwBlocks.filter((e) => e.type === 'Firewall block').length) { const n = fwBlocks.filter((e) => e.type === 'Firewall block').length; T.push({ key: `fw:${n}`, score: Math.min(98, 60 + 8 * n), title: 'Attack attempts blocked at sign-in', body: `${n} request${n > 1 ? 's' : ''} carried injection or script patterns and ${n > 1 ? 'were' : 'was'} stopped by the firewall before the account check.`, advice: 'No account was reached. Check the firewall log for the source and consider an edge WAF.', act: ['Open firewall log', () => setTab('fw')] }); }
  const bots = fwBlocks.filter((e) => e.type === 'Bot trap' || e.type === 'Typing-speed check');
  if (bots.length) T.push({ key: `bot:${bots.length}`, score: 55, title: 'Automated sign-in attempts', body: `${bots.length} sign-in${bots.length > 1 ? 's' : ''} filled the hidden trap field or arrived faster than a person can type.`, advice: 'These were blocked. Turn on bot management at the edge if they keep coming.' });
  log.filter((e) => day(e) && e.type === 'Wrong-branch sign-in').forEach((e) => T.push({ key: `wb:${e.id}`, score: 45, title: 'Sign-in to the wrong branch', body: e.detail, advice: 'Confirm with the branch manager whether the person was moving branch.' }));
  sess.filter((s) => { const h = new Date(s.at).getHours(); return h < 6 || h >= 22; }).forEach((s) => T.push({ key: `hrs:${s.sid}`, score: 50, title: `${s.name} signed in outside normal hours`, body: `Signed in at ${new Date(s.at).toTimeString().slice(0, 5)} on ${s.device} (normal hours 06:00–22:00).`, advice: 'Check with the person. End the session if they did not sign in.', act: s.username === me ? undefined : ['End their sessions', () => { sess.filter((x) => x.username === s.username).forEach((x) => sessionEnd(x.sid)); say(`Ended ${s.name}'s sessions`); }] }));
  const multi: Record<string, Sess[]> = {};
  sess.forEach((s) => { (multi[s.username] = multi[s.username] || []).push(s); });
  Object.values(multi).filter((L) => L.length >= 2 && L[0].username !== me).forEach((L) => T.push({ key: `multi:${L[0].username}:${L.length}`, score: 42, title: `${L[0].name} is signed in on ${L.length} screens`, body: L.map((s) => s.device).join(' · '), advice: 'Accounts should not be shared. End the older sessions.', act: ['End other sessions', () => { L.slice(1).forEach((s) => sessionEnd(s.sid)); say(`Ended ${L.length - 1} older session(s) for ${L[0].name}`); }] }));
  const rByStaff: Record<string, Refund[]> = {};
  refunds.filter(day).forEach((r) => { (rByStaff[r.by] = rByStaff[r.by] || []).push(r); });
  Object.entries(rByStaff).filter(([, L]) => L.length >= 2).forEach(([by, L]) => T.push({ key: `ref:${by}:${L.length}`, score: Math.min(80, 35 + 15 * L.length), title: `Refund spike · ${by}`, body: `${L.length} refunds today worth GHS ${L.reduce((a, r) => a + r.amt, 0).toFixed(2)} (${L.map((r) => r.ref).join(', ')}).`, advice: 'Ask the branch manager to check the receipts and the returned items.' }));
  const threats = T.filter((t) => !dis.includes(t.key)).sort((a, b) => b.score - a.score);
  const high = threats.filter((t) => t.score >= 70).length, med = threats.filter((t) => t.score >= 40 && t.score < 70).length;
  const edge = !!code.waf;
  const sealed = SEALS.some((k) => seals[k]);
  const chainOk = chain?.ok !== false;
  const score = Math.max(0, 100 - Math.min(45, high * 15) - Math.min(21, med * 7) - (chainOk ? 0 : 20) - (defaults.length ? 10 : 0) - (edge ? 0 : 10));
  const label = score >= 90 ? 'Strong' : score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'At risk';
  const note = [high ? `${high} high-risk alert${high > 1 ? 's' : ''}` : '', med ? `${med} medium` : '', !chainOk ? 'log chain broken' : '', defaults.length ? `${defaults.length} accounts on the default password` : '', !edge ? 'edge protection not connected' : ''].filter(Boolean);
  const fwShown = [...log].reverse().filter((e) => lf === 'all' || (lf === 'high' && e.sev === 'high') || (lf === 'fw' && ['Firewall block', 'Bot trap', 'Typing-speed check'].includes(e.type)) || (lf === 'sign' && /Sign-in|Failed|Wrong-branch|Blocked sign-in/.test(e.type)) || (lf === 'lock' && /lockout|Lock/.test(e.type)) || (lf === 'support' && e.who === SUPPORT));
  const dupOrders = wo.length - new Set(wo.map((o) => o.id)).size;
  const dq: [string, number, string][] = [
    ['Duplicate order numbers', dupOrders, dupOrders ? 'Two online orders share a number. Check Orders.' : 'Every online order number is unique.'],
    ['Duplicate refund references', refunds.length - new Set(refunds.map((r) => r.ref)).size, 'Each refund reference should be used once.'],
    ['Refunds with impossible amounts', refunds.filter((r) => r.amt <= 0 || r.amt > r.saleAmt).length, 'A refund can never be more than the sale or zero.'],
    ['Sales with negative totals', SALES.filter((s) => s.total < 0).length, 'Sales totals must be zero or more.'],
    ['Orders with negative quantities or prices', wo.filter((o) => o.items.some(([q, , p]) => q <= 0 || p < 0)).length, 'Quantities must be 1 or more and prices 0 or more.'],
    ['Accounts still on the default password', defaults.length, defaults.length ? `${defaults.map((a) => a.name).join(', ')} should set their own password.` : 'Everyone has set their own password.'],
  ];
  const tabs: [Tab, string][] = [['over', 'Overview'], ['zt', 'Zero Trust'], ['access', 'Identity & access'], ['threat', `Threats & anomalies${threats.length ? ` · ${threats.length}` : ''}`], ['fw', `Firewall log${fwBlocks.filter((e) => e.sev === 'high').length ? ` · ${fwBlocks.filter((e) => e.sev === 'high').length} high` : ''}`], ['int', 'Data integrity'], ['code', 'Code & edge']];
  const sevTone = (n: number) => (n >= 70 ? 'bg-danger' : n >= 40 ? 'bg-[#b26a00]' : 'bg-brand');
  const th = 'py-2 pr-3 text-left text-xs text-muted font-semibold';
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Security centre</h1><p className="m-0 text-sm text-muted">{SUPPORT} only · Zero Trust sign-in, firewall, threat detection and data integrity in one place</p><span className="text-xs text-muted">As of {new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · updates live</span></header>
      <Tabs label="Security sections" tabs={tabs.map(([k, l]) => ({ id: k, label: l }))} value={tab} onChange={(k) => setTab(k as typeof tab)} />
      <NoticeModal msg={msg} onClose={() => setMsg('')} />

      {tab === 'over' && <>
        <section aria-labelledby="sc-score" className="bg-black text-white rounded-3xl p-6 flex flex-col gap-4">
          <span id="sc-score" className="text-sm text-white/70">Security score</span>
          <div className="flex items-end gap-3 flex-wrap"><strong className={cx('text-6xl font-semibold tracking-tight', score >= 75 ? 'text-[#6ee7a0]' : score >= 50 ? 'text-[#f2c94c]' : 'text-[#ff8a80]')}>{score}</strong><span className="text-lg pb-2">/ 100 · {label}</span></div>
          <span className="text-sm text-white/80">{note.length ? `Points off for: ${note.join(' · ')}.` : 'No open issues. Keep it up.'}</span>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[[String(sess.length), 'Active sessions'], [String(fwBlocks.length), 'Blocked in 24 h'], [String(locks.length), 'Usernames locked out'], [String(threats.length), 'Open alerts']].map(([v, l]) => <div key={l} className="rounded-2xl bg-white/10 p-3"><strong className="text-2xl">{v}</strong><br /><span className="text-xs text-white/70">{l}</span></div>)}</div>
        </section>
        <Sec id="sc-ctl" title="Controls in force" actions={<button onClick={() => setTab('zt')} className={B.sm}>Open Zero Trust</button>}><div className="grid gap-2 md:grid-cols-2">{CONTROLS({ chainOk, locks: locks.length, fw: fwBlocks.length, sealed, edge }).map(([st, n, t]) => <div key={n} className="flex gap-3 items-start p-3 rounded-2xl bg-canvas"><Tag t={st} tone={/Broken|Not/.test(st) ? (st === 'Broken' ? 'bad' : 'warn') : 'ok'} /><span className="flex flex-col text-sm"><strong>{n}</strong><span className="text-xs text-sub">{t}</span></span></div>)}</div></Sec>
      </>}

      {tab === 'zt' && <ZeroTrust me={session?.sid} code={code} chainOk={chainOk} sealed={sealed} say={say} />}

      {tab === 'access' && <>
        <Sec id="sc-mfa" title="Multi-factor sign-in is enforced for everyone" sub="Step 1: username and password. Step 2: the person’s own 6-digit passcode. Riders use the same two steps in the rider app. The till PIN only unlocks a till for someone who has already passed both steps on that device in the last 12 hours. This policy cannot be turned off.">
          <div className="flex gap-2 flex-wrap">{ZT.map((z) => <span key={z} className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-ok font-semibold">✓ {z}</span>)}</div>
        </Sec>
        <Sec id="sc-ses" title={`Active sessions · ${sess.length}`} sub="Every session is checked again every few seconds (Zero Trust). Ending one signs that person out straight away." actions={<button onClick={() => { const o = sess.filter((s) => s.username !== me); o.forEach((s) => sessionEnd(s.sid)); say(`Ended ${o.length} other session(s)`); }} className={B.dark}>End all other sessions</button>}>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]"><thead><tr className="border-b border-line">{['Person', 'Role', 'Branch', 'Device', 'Signed in', 'Last active', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{sess.map((x) => <tr key={x.sid} className="border-b border-line"><td className="py-2 pr-3"><strong>{x.name}</strong></td><td className="pr-3">{x.role}</td><td className="pr-3">{brN(x.branch)}</td><td className="pr-3">{x.device}</td><td className="pr-3">{at(x.at)}</td><td className="pr-3">{at(x.last)}</td><td>{x.sid === session?.sid ? <span className="text-xs text-muted">This is you</span> : <button onClick={() => { sessionEnd(x.sid); say(`Ended ${x.name}'s session on ${x.device}`); }} className={B.sm}>End session</button>}</td></tr>)}</tbody></table></div>
          {sess.length <= 1 && <span className="text-sm text-muted">No one else is signed in right now.</span>}
        </Sec>
        <Sec id="sc-acc" title="Accounts & access (IAM)" sub="Least privilege: each role only sees what it needs. Lock an account to stop it signing in anywhere.">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[700px]"><thead><tr className="border-b border-line">{['Person', 'Role', 'Branch', 'MFA', 'Password', 'Status', 'Last sign-in', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{ACCOUNTS.map((a) => { const c = C[a.username] || {}; const st = c.held ? 'On hold' : c.locked ? 'Locked' : rate[a.username]?.until > now ? 'Locked out' : 'Active'; const ls = signins.find((s) => s.username === a.username && s.ok); return <tr key={a.username} className="border-b border-line"><td className="py-2 pr-3"><strong>{a.name}</strong></td><td className="pr-3">{a.level}</td><td className="pr-3">{a.branch ? brN(a.branch) === 'all' ? 'All branches' : brN(a.branch) : 'Remote'}</td><td className="pr-3"><Tag t="On" tone="ok" /></td><td className="pr-3">{c.pw ? 'Own' : <span className="text-[#b26a00]">Default</span>}</td><td className="pr-3"><Tag t={st} tone={st === 'Active' ? 'ok' : 'bad'} /></td><td className="pr-3">{ls ? at(ls.ts) : '—'}</td><td>{a.username !== me && (c.locked ? <button onClick={() => { credSet(a.username, { locked: false }); setC(readKey('ecompos.creds', {})); say(`Unlocked ${a.name}`); }} className={B.sm}>Unlock</button> : <button onClick={() => { credSet(a.username, { locked: true }); setC(readKey('ecompos.creds', {})); sess.filter((s) => s.username === a.username).forEach((s) => sessionEnd(s.sid)); say(`Locked ${a.name} and ended their sessions`); }} className={B.sm}>Lock</button>)}</td></tr>; })}</tbody></table></div>
          <div className="grid gap-2 md:grid-cols-2">{ROLES.map(([n, c]) => <div key={n} className="p-3 rounded-2xl bg-canvas text-sm"><strong>{n}</strong><br /><span className="text-xs text-sub">{c}</span></div>)}</div>
        </Sec>
        <Sec id="sc-lock" title="Sign-in lockouts" sub="After 5 wrong attempts a username is blocked on that device for 1 minute, then 2, 4, 8… up to 30 minutes.">
          {locks.map(([u, r]) => <div key={u} className="flex items-center gap-3 p-3 rounded-2xl bg-red-50 flex-wrap"><span className="flex-1 text-sm"><strong>{u}</strong> · blocked for {Math.ceil((r.until - now) / 60000)} more min · next block {Math.min(30, 2 ** r.step)} min</span><button onClick={() => { rateClear(u); setRate(readKey('ecompos.secRate', {})); say(`Cleared the lockout on “${u}”`); }} className={B.sm}>Clear lockout</button></div>)}
          {!locks.length && <span className="text-sm text-muted">No usernames are locked out.</span>}
        </Sec>
      </>}

      {tab === 'threat' && <Sec id="sc-ai" title="✦ Threat & anomaly detection" sub="Watches sign-in times, failed attempts, branch access, refunds and session patterns, and scores anything unusual from 0 to 100.">
        {!threats.length && <span className="text-sm text-ok font-semibold">Nothing unusual detected. Keep it up.</span>}
        {threats.map((t) => <div key={t.key} className="flex gap-4 p-4 rounded-2xl border border-line flex-wrap sm:flex-nowrap"><span className={cx('w-16 h-16 rounded-2xl text-white flex flex-col items-center justify-center flex-none', sevTone(t.score))}><strong className="text-xl leading-none">{t.score}</strong><span className="text-[10px]">risk</span></span><span className="flex-1 flex flex-col gap-1 min-w-[200px]"><strong>{t.title}</strong><span className="text-sm text-sub">{t.body}</span><span className="text-sm"><strong>Suggested:</strong> {t.advice}</span><span className="flex gap-2 flex-wrap mt-1">{t.act && <button onClick={t.act[1]} className={B.dark}>{t.act[0]}</button>}<button onClick={() => { setDis([...dis, t.key]); say(`Marked “${t.title}” as safe`); }} className={B.ghost}>Mark as safe</button></span></span></div>)}
      </Sec>}

      {tab === 'fw' && <Sec id="sc-fw" title="Firewall & request filter" sub={`${fwBlocks.length} blocked in the last 24 hours.`}>
        <span className="text-sm text-sub">Every sign-in is checked before it reaches the account check: injection patterns, oversized input, bots (hidden trap field and impossible typing speed) and repeated failures are blocked and logged.</span>
        <div className="flex gap-2 flex-wrap">{FWR.map((r) => <span key={r} className="text-xs px-3 py-1.5 rounded-full bg-canvas">🛡 {r}</span>)}</div>
        <Chips label="Filter log" value={lf} onChange={setLf} opts={[['all', `All · ${log.length}`], ['high', 'High'], ['fw', 'Firewall & bots'], ['sign', 'Sign-ins'], ['lock', 'Lockouts'], ['support', 'Support actions']]} />
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]"><thead><tr className="border-b border-line">{['When', 'Event', 'Detail', 'Who', 'Severity'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{fwShown.slice(0, 80).map((e) => <tr key={e.id} className="border-b border-line align-top"><td className="py-2 pr-3 whitespace-nowrap">{at(e.ts)}</td><td className="pr-3"><strong>{e.type}</strong></td><td className="pr-3">{e.detail}</td><td className="pr-3 break-all">{e.who}</td><td><Tag t={e.sev} tone={e.sev === 'high' ? 'bad' : e.sev === 'medium' ? 'warn' : 'mute'} /></td></tr>)}</tbody></table></div>
        {!fwShown.length && <span className="text-sm text-muted">No security events yet.</span>}
      </Sec>}

      {tab === 'int' && <>
        <Sec id="sc-chain" title="Tamper-proof security log" sub="Each entry carries a SHA-256 fingerprint of the one before it, so changing or deleting any entry breaks the chain.">
          <strong className={chainOk ? 'text-ok' : 'text-danger'}>{chain ? (chain.ok ? `Chain intact · ${chain.n} entries verified` : `Chain broken · ${chain.bad.length} ${chain.bad.length === 1 ? "entry" : "entries"} altered`) : 'Checking…'}</strong>
          <span className="text-xs text-muted">{chain && !chain.ok ? `Affected entries: ${chain.bad.join(', ')}` : `Starts from GENESIS · latest fingerprint ${log[log.length - 1]?.hash.slice(0, 16) || '—'}…`}</span>
          <button onClick={async () => { const r = await verifyChain(readKey('ecompos.secLog', [])); setChain(r); say(r.ok ? `Chain verified · ${r.n} entries intact` : `Chain broken · ${r.bad.length} ${r.bad.length === 1 ? "entry" : "entries"} altered`); }} className={cx(B.dark, 'w-fit')}>Verify the chain now</button>
        </Sec>
        <Sec id="sc-dq" title="Smart data integrity checks" sub="Looks for records that should not exist: duplicates, impossible values and mismatches.">
          <div className="grid gap-2 md:grid-cols-2">{dq.map(([n, c, t]) => <div key={n} className="flex gap-3 items-start p-3 rounded-2xl bg-canvas"><Tag t={c ? `${c} found` : 'OK'} tone={c ? 'warn' : 'ok'} /><span className="flex flex-col text-sm"><strong>{n}</strong><span className="text-xs text-sub">{t}</span></span></div>)}</div>
        </Sec>
        <Sec id="sc-seal" title="Data seals" sub="Take a fingerprint of key records. Anything that changes afterwards is flagged so you can confirm it was expected.">
          <div className="flex flex-col divide-y divide-line">{SEALS.map((k) => { const s = seals[k]; const st = !s ? 'Not sealed yet' : s.hash === cur[k] ? 'Unchanged since seal' : 'Changed since seal'; return <div key={k} className="flex items-center gap-3 py-2.5 flex-wrap"><span className="flex-1 text-sm"><strong>{k}</strong> · {datasets[k][1]} records{s ? <span className="text-xs text-muted"> · sealed {at(s.at)}</span> : ''}</span><Tag t={st} tone={!s ? 'mute' : st.startsWith('Unchanged') ? 'ok' : k === 'User credentials' ? 'bad' : 'warn'} /></div>; })}</div>
          <span className="text-xs text-muted">{SEALS.some((k) => seals[k] && seals[k].hash !== cur[k]) ? 'Some records changed since the seal. Confirm the changes were expected, then seal again.' : 'Seal again after expected changes, such as a price update or a new user.'}</span>
          <button onClick={() => { const o: typeof seals = {}; SEALS.forEach((k) => { o[k] = { hash: cur[k], at: Date.now(), n: datasets[k][1] }; }); setSeals(o); say('Sealed current data · 5 record sets fingerprinted'); }} className={cx(B.dark, 'w-fit')}>Seal current data</button>
        </Sec>
      </>}

      {tab === 'code' && <>
        <Sec id="sc-code" title="Code scanning and edge protection need your hosting" sub="These run on your code repository and web host, not inside the app. Until they are connected, the in-app request filter on the Firewall tab protects sign-in." />
        <div className="grid gap-4 lg:grid-cols-3">{CODE.map((c) => <Sec key={c.k} title={c.name} actions={<Tag t={code[c.k] ? 'Marked as set up' : 'Not connected'} tone={code[c.k] ? 'ok' : 'warn'} />}><span className="text-sm text-sub">{c.what}</span><ol className="m-0 pl-5 text-sm flex flex-col gap-1">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol><button onClick={() => { setCode({ ...code, [c.k]: !code[c.k] }); say(`${c.name} ${code[c.k] ? 'marked as not set up' : 'marked as set up'}`); }} className={cx(code[c.k] ? B.ghost : B.primary, 'w-fit')}>{code[c.k] ? 'Mark as not set up' : 'I have set this up'}</button></Sec>)}</div>
      </>}
    </>
  );
}
