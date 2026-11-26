import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACCOUNTS, applyAccount, type Account, type Role } from '../data/nav';
import { readKey } from './persist';
import { creds, deviceName, mfaOk, SUPPORT, sessions, endOtherSessions, secLog, sessionAdd, sessionEnd, sessionTouch, stepClear, stepMark, stepOk, ztChecks, ztLog, ztPolicy } from './sec';

type Session = { role: Role; branch: string; name: string; username?: string; at?: number; sid?: string; via?: 'support' } | null;
type Ctx = {
  session: Session;
  signIn: (a: Account, branch: string, opts?: { viewAs?: boolean }) => void;
  signOut: () => void;
  viewBranch: string; // 'all' or branch id
  setViewBranch: (b: string) => void;
  online: boolean;
  /** Zero Trust step-up: run `fn` only after the signed-in person re-enters their passcode (valid a few minutes). */
  stepUp: (why: string, fn: () => void) => void;
};

const SessionCtx = createContext<Ctx | null>(null);
const KEY = 'ecompos.session';

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => {
    const s = read<Session>(KEY, null);
    if (s) { const a = ACCOUNTS.find((x) => x.username === s.username) ?? ACCOUNTS.find((x) => x.role === s.role); if (a) applyAccount(a); }
    return s;
  });
  const [viewBranch0, setViewBranch0] = useState<string>(() => read('ecompos.branch', 'all'));
  // Least privilege: only the Admin (and support) may look at another branch. Everyone else is pinned to the branch they signed in to,
  // whatever is stored on the device.
  const wide = session?.role === 'superuser' || session?.role === 'developer';
  const viewBranch = session && !wide ? session.branch : viewBranch0;
  const setViewBranch = (b: string) => {
    if (session && !wide && b !== session.branch) { secLog('Access denied', `${session.name} tried to switch to ${b} · only the Admin can view other branches`, 'medium', session.username || session.name); return; }
    setViewBranch0(b);
  };
  const [step, setStep] = useState<null | { why: string; fn: () => void; pin: string; err: string; n: number }>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [warn, setWarn] = useState(false);
  const last = useRef(Date.now());
  const ended = useRef<string | undefined>(undefined); // the session already being signed out (stops repeat checks and logs)

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ecompos.branch', JSON.stringify(viewBranch0));
    } catch {
      /* storage blocked */
    }
  }, [viewBranch0]);

  const signOut = () => {
    const sid = session?.sid ?? read<Session>(KEY, null)?.sid;
    ended.current = sid || 'none';
    if (sid) sessionEnd(sid);
    const stored = read<Session>(KEY, null);
    stepClear();
    setStep(null);
    setSession(null);
    setWarn(false);
    // Only clear the stored session if it is this one (another tab may have signed in since).
    try {
      if (!stored || !sid || stored.sid === sid) localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  };

  // Zero Trust: never trust, always verify. Every rule is re-checked every few seconds AND the moment anything the
  // rules depend on changes (account record, sessions, revocations, company hold, policy, or the stored session itself, in
  // this tab or another one). One failed rule ends the session.
  const verify = (why = 're-check') => {
    if (!session || ended.current === (session.sid || 'none')) return;
    const who = session.username || session.name;
    const P = ztPolicy();
    const idle = Date.now() - last.current;
    if (idle >= P.idle * 60_000) { ztLog(who, `no activity for ${P.idle} minutes`); return signOut(); }
    setWarn(idle >= (P.idle - 1) * 60_000);
    // Tampering: the session kept on the device must be the one this sign-in issued.
    const stored = read<Session>(KEY, null);
    if (stored && stored.sid && stored.sid !== session.sid && sessions().some((x) => x.sid === stored.sid)) {
      // A newer, genuine sign-in on this browser replaced this tab's session: step aside without touching it.
      secLog('Session replaced', `${who} · another sign-in on this browser (${stored.name}) took over this tab`, 'low', who);
      if (session.sid) sessionEnd(session.sid);
      const a = ACCOUNTS.find((x) => x.username === stored.username); if (a) applyAccount({ ...a, role: stored.role, name: stored.name }); setSession(stored); last.current = Date.now();
      return;
    }
    if (!stored || stored.sid !== session.sid || stored.username !== session.username || stored.role !== session.role || stored.branch !== session.branch) {
      secLog('Session tampering', `${who} · the stored session was ${stored ? `changed (${['sid', 'username', 'role', 'branch'].filter((k) => (stored as Record<string, unknown>)[k] !== (session as Record<string, unknown>)[k]).join(', ')})` : 'removed'} · signed out`, 'high', who);
      return signOut();
    }
    const bad = ztChecks({ sid: session.sid, username: session.username || '', name: session.name, role: session.role, branch: session.branch, device: deviceName(), at: session.at || 0 }, session.role === 'developer', P)
      // The company-hold rule is shown as a blocking screen (SystemOverlays) instead of a sign-out, so people see why.
      .filter((c) => !c.ok && c.k !== 'idle' && c.k !== 'co' && !(c.k === 'br' && session.role === 'superuser') && !(c.k === 'mfa' && session.via === 'support'));
    // Support viewing someone's account: support's own two-step sign-in must still be valid, and the Admin must still allow support access.
    if (session.via === 'support') {
      if (!mfaOk(SUPPORT)) bad.push({ k: 'mfa', label: 'Support two-step sign-in', ok: false, why: 'Support has no valid two-step sign-in' });
      if (readKey<{ allowed?: boolean }>('ecompos.devAccess', {}).allowed === false) bad.push({ k: 'sup', label: 'Support access allowed', ok: false, why: 'The Admin paused support access' });
    }
    if (bad.length) { ztLog(who, `${bad.map((c) => c.why).join(' · ')} (${why})`); return signOut(); }
    if (session.sid) sessionTouch(session.sid);
  };
  const verifyRef = useRef(verify);
  verifyRef.current = verify;

  useEffect(() => {
    if (!session) return;
    const bump = () => { last.current = Date.now(); setWarn(false); };
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const WATCH = ['ecompos.devAccess', 'ecompos.creds', 'ecompos.sessions', 'ecompos.secRevoked', 'ecompos.companyMeta', 'ecompos.ztPolicy', 'ecompos.roleOverride', 'ecompos.accounts3', 'ecompos.secMfa', KEY];
    const onPersist = (e: Event) => { const k = (e as CustomEvent<{ key?: string }>).detail?.key; if (!k || WATCH.includes(k)) setTimeout(() => verifyRef.current(`change to ${k || 'account'}`), 0); };
    const onStorage = (e: StorageEvent) => { if (!e.key || WATCH.includes(e.key)) verifyRef.current(`change to ${e.key || 'storage'} in another tab`); };
    const onSess = () => setTimeout(() => verifyRef.current('session list changed'), 0);
    window.addEventListener('ecompos:persist', onPersist);
    window.addEventListener('storage', onStorage);
    window.addEventListener('ecompos:session', onSess);
    const t = setInterval(() => verifyRef.current(), Math.max(3, ztPolicy().recheck) * 1000);
    verifyRef.current('page load');
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      window.removeEventListener('ecompos:persist', onPersist);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ecompos:session', onSess);
      clearInterval(t);
    };
  }, [session]);

  const stepUp = (why: string, fn: () => void) => {
    if (!session) return;
    if (stepOk(session.username || session.name)) { secLog('Step-up reused', `${session.name} · ${why}`, 'low', session.username || session.name); return fn(); }
    setStep({ why, fn, pin: '', err: '', n: 0 });
  };
  const stepCheck = () => {
    if (!step || !session) return;
    const acc = ACCOUNTS.find((a) => a.username === session.username);
    const real = creds()[session.username || '']?.passcode || acc?.passcode;
    const who = session.username || session.name;
    if (!real || step.pin !== real) {
      const n = step.n + 1;
      secLog('Step-up failed', `${session.name} · wrong passcode for “${step.why}” (${n}/3)`, n >= 3 ? 'high' : 'medium', who);
      if (n >= 3) { ztLog(who, '3 wrong passcodes at a step-up check'); return signOut(); }
      return setStep({ ...step, pin: '', n, err: `401 Unauthorized · That passcode is not right. ${3 - n} ${3 - n === 1 ? 'try' : 'tries'} left before you are signed out.` });
    }
    stepMark(who);
    secLog('Step-up verified', `${session.name} · ${step.why}`, 'low', who);
    const fn = step.fn;
    setStep(null);
    fn();
  };

  const signIn = (a: Account, branch: string, opts: { viewAs?: boolean } = {}) => {
    applyAccount(a);
    // The Admin may sign in to All branches (live data from every branch) or to one branch.
    const br = a.branch === 'all' ? (branch && branch !== 'all' ? branch : 'osu') : a.branch;
    const sid = sessionAdd({ username: a.username, name: a.name, role: a.level, branch: a.role === 'developer' ? 'Remote' : a.role === 'superuser' && (!branch || branch === 'all') ? 'All branches' : br });
    const s: Session = { role: a.role, branch: br, name: a.name, username: a.username, at: Date.now(), sid, ...(opts.viewAs ? { via: 'support' as const } : {}) };
    // Viewing as support must not throw the real person out of their own session.
    ended.current = undefined;
    if (ztPolicy().single && !opts.viewAs) endOtherSessions(a.username, sid);
    stepClear();
    setSession(s);
    setViewBranch0(a.role === 'superuser' ? branch || 'all' : br);
    last.current = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage blocked */
    }
  };

  return (
    <SessionCtx.Provider value={{ session, signIn, signOut, viewBranch, setViewBranch, online, stepUp }}>
      {children}
      {warn && session && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="idle-h" className="fixed inset-0 z-[900] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-4xl p-6 flex flex-col gap-3 text-center">
            <h2 id="idle-h" className="m-0 text-lg font-semibold">Are you still there?</h2>
            <p className="m-0 text-sm text-muted">You will be signed out in about a minute to keep the account safe.</p>
            <div className="flex gap-2 justify-center"><button onClick={signOut} className="btn-ghost">Sign out</button><button onClick={() => { last.current = Date.now(); setWarn(false); }} className="btn-primary">Stay signed in</button></div>
          </div>
        </div>
      )}
      {step && session && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="su-h" className="fixed inset-0 z-[950] bg-black/60 flex items-center justify-center p-4" onClick={() => setStep(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); stepCheck(); }} className="w-full max-w-sm bg-white rounded-4xl p-6 flex flex-col gap-3 text-center">
            <span className="mx-auto w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-xl" aria-hidden>🔐</span>
            <h2 id="su-h" className="m-0 text-lg font-semibold">Confirm it's you</h2>
            <p className="m-0 text-sm text-muted">Zero Trust · <b className="text-black">{step.why}</b> is a sensitive action. Enter your 6-digit passcode, {session.role === 'developer' ? 'Support' : session.name.split(' ')[0]}. It stays valid for {ztPolicy().stepUp} minutes in this tab.</p>
            <input autoFocus aria-label="Your 6-digit passcode" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={step.pin} onChange={(e) => setStep({ ...step, pin: e.target.value.replace(/\D/g, '').slice(0, 6), err: '' })} placeholder="••••••" className="text-2xl tracking-[0.5em] text-center px-4 py-3 rounded-2xl border border-line w-full" />
            {step.err && <span role="alert" className="text-[13px] text-danger">{step.err}</span>}
            <div className="flex gap-2 justify-center"><button type="button" onClick={() => setStep(null)} className="btn-ghost">Cancel</button><button type="submit" disabled={step.pin.length !== 6} className="btn-primary disabled:opacity-40">Confirm</button></div>
          </form>
        </div>
      )}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}
