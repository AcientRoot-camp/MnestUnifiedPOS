import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo, { Wordmark } from '../components/Logo';
import { ACCOUNTS, BRANCHES, type Account } from '../data/nav';
import { useSession } from '../lib/session';
import { readKey } from '../lib/persist';
import { cx } from '../lib/format';
import { LoginInstall } from '../components/InstallPrompt';

import { companyHeld, credSet, creds, inspect, lockedMins, mfaMark, pwProblem, rateClear, rateFail, secLog, signinAdd } from '../lib/sec';

export default function Login() {
  const { signIn } = useSession();
  const nav = useNavigate();
  const [branch, setBranch] = useState('');
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [hp, setHp] = useState(''); // honeypot: real people never fill this
  const [acc, setAcc] = useState<Account | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [chg, setChg] = useState<null | { p1: string; p2: string }>(null);
  const opened = useRef(Date.now());
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  useEffect(() => setErr(''), [branch]);

  const lockedFor = lockedMins;
  const fail = (u: string, text: string, step = 'password') => {
    const mins = rateFail(u);
    signinAdd({ username: u, name: u, ok: false, branch, why: `Wrong ${step}` });
    secLog(`Failed ${step}`, `Wrong ${step} for “${u}”${branch ? ` · ${branch}` : ''}`, 'medium', u);
    if (mins) { secLog('Brute-force lockout', `“${u}” blocked on this device for ${mins} min after 5 wrong attempts`, 'high', u); setErr(`429 Too Many Requests · Too many tries. This username is blocked on this device for ${mins} minute${mins > 1 ? 's' : ''}.`); }
    else setErr(`401 Unauthorized · ${text}`);
  };

  const submit = () => {
    const u = user.trim().toLowerCase();
    const bad = inspect({ username: user, password: pw });
    if (bad) { secLog('Firewall block', `${bad.rule} in the ${bad.field} field · request stopped before the account check`, 'high', u.slice(0, 40) || 'unknown'); return setErr('400 Bad Request · That input is not allowed. Type your username and password only.'); }
    if (hp) { secLog('Bot trap', 'Hidden trap field was filled on the sign-in form', 'high', u || 'unknown'); return setErr('Please try again.'); }
    if (Date.now() - opened.current < 800) { secLog('Typing-speed check', 'Sign-in sent faster than a person can type', 'high', u || 'unknown'); return setErr('Please try again.'); }
    const made = readKey<{ username: string; name: string; role: Account['role']; level: string; br: string; closed?: boolean }[]>('ecompos.accounts3', []).find((x) => x.username === u && !x.closed && !ACCOUNTS.some((y) => y.username === u));
    const a0 = ACCOUNTS.find((x) => x.username === u) ?? (made ? { username: made.username, name: made.name, role: made.role, level: made.level, branch: made.br, password: creds()[u]?.pw || '', passcode: creds()[u]?.passcode || '' } : undefined);
    const ov = a0 ? readKey<Record<string, { role: Account['role']; level: string; branch: string }>>('ecompos.roleOverride', {})[a0.username] : undefined;
    const a = a0 && ov ? { ...a0, ...ov } : a0;
    if (a && lockedFor(u)) return setErr(`Too many tries. Try again in ${lockedFor(u)} minutes.`);
    if (!branch && a?.role !== 'developer') return setErr('Choose your branch first, then sign in.');
    const cr = a ? creds()[a.username] || {} : {};
    if (!a || (cr.pw || a.password) !== pw) return fail(u, 'That username and password don’t match. Try again.');
    if (cr.held || cr.locked) { secLog('Blocked sign-in', `“${u}” is ${cr.held ? 'on hold' : 'locked'}`, 'medium', u); return setErr(`423 Locked · This account is ${cr.held ? 'on hold' : 'locked'}. Ask your Admin.`); }
    if (a.role !== 'developer' && companyHeld()) return setErr('402 Payment Required · This company is on hold until the licence is settled. Ask your Admin to contact MNest UnifiedPOS Support.');
    if (a.role !== 'superuser' && a.role !== 'developer' && branch && a.branch !== branch) {
      const picked = branch === 'all' ? 'All branches' : BRANCHES.find((b) => b.id === branch)?.name ?? 'That branch';
      const mine = BRANCHES.find((b) => b.id === a.branch)?.name ?? a.branch;
      secLog('Wrong-branch sign-in', `${a.name} tried to sign in to ${picked}; assigned to ${mine}`, 'medium', a.username);
      return setErr(`${picked} was not assigned to you, ${a.name.split(' ')[0]}. You work at ${mine}. Select ${mine} and sign in again.`);
    }
    setErr(''); setAcc(a); setPin('');
  };
  const checkPin = (p: string) => {
    if (!acc || p.length !== 6) return;
    if (p !== (creds()[acc.username]?.passcode || acc.passcode)) { setPin(''); return fail(acc.username, 'That passcode is not right. Try again.', 'passcode'); }
    rateClear(acc.username);
    // Zero Trust: a password the Admin set (new account or reset) is never trusted for a working session. Change it first.
    if (creds()[acc.username]?.force) { secLog('Password change required', `${acc.name} · temporary password must be replaced before the session starts`, 'low', acc.username); setChg({ p1: '', p2: '' }); return; }
    finish(acc);
  };
  const finish = (a: Account) => {
    mfaMark(a.name); signinAdd({ username: a.username, name: a.name, ok: true, branch: branch || a.branch || 'remote' });
    secLog('Sign-in', `${a.name} · password and passcode verified${branch ? ` · ${branch}` : ' · remote'}`, 'low', a.username);
    signIn(a, branch);
    nav(a.role === 'developer' ? '/developer' : a.role === 'rider' ? '/rider' : a.role === 'staff' ? '/sell' : '/');
  };
  const savePw = () => {
    if (!acc || !chg) return;
    const bad = inspect({ password: chg.p1 });
    if (bad) return setErr('400 Bad Request · That input is not allowed.');
    const why = pwProblem(chg.p1, acc.username);
    if (why) return setErr(`422 Unprocessable Content · ${why}`);
    if (chg.p1 === (creds()[acc.username]?.pw || acc.password)) return setErr('422 Unprocessable Content · Choose a password you have not used before.');
    if (chg.p1 !== chg.p2) return setErr('422 Unprocessable Content · The two passwords do not match.');
    credSet(acc.username, { pw: chg.p1, force: false, tempPw: '' });
    secLog('Password changed', `${acc.name} replaced the temporary password at sign-in`, 'low', acc.username);
    setChg(null); setErr('');
    finish(acc);
  };
  const press = (k: string) => { setErr(''); if (k === '⌫') return setPin((p) => p.slice(0, -1)); if (k === 'C') return setPin(''); const n = (pin + k).slice(0, 6); setPin(n); if (n.length === 6) checkPin(n); };

  return (
    <div className="relative min-h-screen bg-canvas flex justify-center overflow-hidden">
      {/* Background: a faint, small repeating tile of the MNest Systems logo (SVG) only, no text. contain:strict keeps
          the oversized tilted pattern from widening the page on phones (which would make the sign-in page zoom out). */}
      <div aria-hidden className="fixed inset-0 pointer-events-none select-none overflow-hidden [contain:strict]">
      {/* A square far larger than any screen, centred and tilted, so the pattern fills every corner at any size and while scrolling. */}
      <div className="absolute left-1/2 top-1/2 w-[260vmax] h-[260vmax] -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-[0.05] grid grid-cols-[repeat(auto-fill,230px)] auto-rows-[230px] justify-center place-items-center overflow-hidden">
        {Array.from({ length: 900 }, (_, i) => (
          <span key={i} className="flex flex-col items-center text-center">
            {/* MNest Systems mark (public/assets/mnest-logo-tight.svg: the supplied mnestlogo.svg with its empty margins trimmed). */}
            <img src="/assets/mnest-logo-tight.svg" alt="" className="block w-32 h-auto" />
          </span>
        ))}
      </div>
      </div>
      <main className="relative w-full max-w-[460px] px-4 pt-10 pb-[180px] flex flex-col gap-[18px]">
        {/* "Install MNest UnifiedPOS" card: top right on wide screens, top of the page otherwise, until closed. */}
        <LoginInstall />
        <div className="flex flex-col items-center gap-2 text-center">
          {/* The logo file has the old "eCom" wordmark baked in, so the artwork is cropped above it and the name is
              set below it: the MNEST logo image in place of the word "MNest", then teal "UnifiedPOS". */}
          <span className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.12)]"><Logo size={112} navy textClass="text-[30px]" logoWord /></span>
        </div>
        {/* Frosted, see-through card: the MNest logo pattern shows through; fields stay solid white so text is easy to read. */}
        <section aria-labelledby="li-h" className="mt-6 bg-white/25 backdrop-blur-[1px] border-2 border-brand rounded-4xl p-6 flex flex-col gap-4 shadow-card">
          <div className="-m-6 mb-0 px-6 pt-[22px] pb-5 bg-brand text-white rounded-t-[26px] text-center flex flex-col gap-1">
            <h1 id="li-h" className="m-0 text-[26px] font-medium tracking-tightest">{chg ? 'Choose a new password' : acc ? `Welcome, ${acc.name.split(' ')[0]}` : 'Sign in to your account'}</h1>
            <span className="text-sm">{chg ? 'Your password and passcode were verified. One more step.' : acc ? 'Enter your personal 6-digit passcode to finish signing in.' : 'Everyone uses their own account, so every sale, refund and change is recorded against the person who made it.'}</span>
          </div>
          {!acc ? (
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <div className="flex flex-col gap-2">
                <span id="br-l" className="text-[13px] font-semibold text-center">Choose the branch you are working at</span>
                <select aria-labelledby="br-l" value={branch} onChange={(e) => setBranch(e.target.value)} className="text-[15px] px-3.5 py-3 min-h-12 rounded-[14px] border border-[#d9d9d9] bg-white w-full">
                  <option value="">Select your branch…</option>
                  <option value="all">All branches (Admin only)</option>
                  {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <span className="text-[13px] font-semibold mt-1 text-center">Sign in with your username and password</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="li-em" className="label inline-flex items-center gap-1.5"><Icon name="user" size={15} /> Username</label>
                <div className="relative flex"><Icon name="user" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input id="li-em" autoComplete="username" autoCapitalize="none" value={user} onChange={(e) => { setUser(e.target.value); setErr(''); }} placeholder="Enter your username" className="field pl-11" /></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="li-pw" className="label inline-flex items-center gap-1.5"><Icon name="lock" size={15} /> Password</label>
                <div className="relative flex">
                  <Icon name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input id="li-pw" type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} placeholder="Enter your password" className="field pl-11 pr-13" />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-controls="li-pw" aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[38px] h-[38px] rounded-full flex items-center justify-center text-muted"><Icon name={show ? 'unlock' : 'lockDot'} /></button>
                </div>
              </div>
              <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden"><label htmlFor="li-web">Website</label><input id="li-web" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></div>
              <button type="submit" className="btn-primary text-[15px] min-h-12">Sign in</button>
            </form>
          ) : chg ? (
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); savePw(); }}>
              <div className="p-3 rounded-2xl bg-warn-bg text-sm"><b>Set your own password.</b> Your Admin gave you a temporary password. Zero Trust does not let a session start on it.</div>
              <label className="label">New password<input type="password" autoComplete="new-password" value={chg.p1} onChange={(e) => { setChg({ ...chg, p1: e.target.value }); setErr(''); }} className="field" /></label>
              <label className="label">Type it again<input type="password" autoComplete="new-password" value={chg.p2} onChange={(e) => { setChg({ ...chg, p2: e.target.value }); setErr(''); }} className="field" /></label>
              <ul className="m-0 pl-4 text-xs text-muted flex flex-col gap-0.5">{[['8 or more characters', chg.p1.length >= 8], ['Upper and lower case', /[A-Z]/.test(chg.p1) && /[a-z]/.test(chg.p1)], ['A number', /\d/.test(chg.p1)], ['A symbol', /[^A-Za-z0-9]/.test(chg.p1)], ['Both match', !!chg.p1 && chg.p1 === chg.p2]].map(([l, ok]) => <li key={l as string} className={ok ? 'text-ok' : ''}>{ok ? '✓' : '○'} {l as string}</li>)}</ul>
              <button type="submit" className="btn-primary min-h-12">Save and sign in</button>
              <button type="button" onClick={() => { setAcc(null); setChg(null); setPin(''); setPw(''); }} className="text-sm underline text-muted">Cancel</button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <span className="text-[13px] text-muted">Passcode for @{acc.username}</span>
              {touch ? (
                <input autoFocus aria-label="Your 6-digit passcode" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setErr(''); if (v.length === 6) checkPin(v); }} placeholder="••••••" className="text-2xl tracking-[0.5em] text-center px-4 py-3 rounded-2xl border border-line w-full" />
              ) : (
                <>
                  <div aria-live="polite" aria-label={`${pin.length} of 6 digits entered`} className="flex gap-3">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden className={cx('w-4 h-4 rounded-full border-2 border-black', i < pin.length && 'bg-black')} />)}</div>
                  <div role="group" aria-label="Passcode keypad" className="grid grid-cols-[repeat(3,72px)] gap-2">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => <button key={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete' : k === 'C' ? 'Clear' : k} className="h-14 rounded-[18px] border border-line bg-white text-xl font-semibold hover:bg-canvas">{k}</button>)}</div>
                </>
              )}
              <button onClick={() => { setAcc(null); setPin(''); setPw(''); }} className="text-sm underline text-muted">Not {acc.name.split(' ')[0]}? Go back</button>
            </div>
          )}
          {err && <span role="alert" className="text-[13px] text-danger text-center">{err}</span>}
          <span className="text-xs text-muted text-center">
            Forgot your login details? Contact your Admin.
            <br />
            <span className="inline-flex gap-1.5 items-center mt-1.5 text-brand font-semibold">🛡 Protected by MFA, Zero Trust and Automatic Lockout</span>
          </span>
        </section>
      </main>
      {/* Page footer: full width, pinned to the bottom edge, about 150px tall, text centred in it. */}
      <footer className="fixed inset-x-0 bottom-0 z-10 h-[150px] bg-black text-white text-center px-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {/* `dark` puts the wordmark in a white pill so the navy MNEST logo and teal "UnifiedPOS" stay readable on black. */}
        <Wordmark dark logo className="text-[18px]" />
        <span className="text-[16px] leading-tight font-normal">The Power of your business with Technology</span>
      </footer>
    </div>
  );
}
