// "Install the app" pop-ups (lib/pwa.ts does the browser side).
//   • StoreInstall: invites online store visitors to install the shop on their phone, tablet or computer.
//   • PosInstall:   invites signed-in branch users at /pos to install the Unified POS, but only after they confirm
//                   their personal 6-digit passcode. The passcode is asked every time they choose to install, on
//                   every visit; it is never remembered.
import { useEffect, useRef, useState } from 'react';
import { ACCOUNTS } from '../data/nav';
import { creds, deviceName, secLog } from '../lib/sec';
import { useSession } from '../lib/session';
import { promptInstall, useInstallMode, type InstallMode } from '../lib/pwa';

/** Safely read / write a value in local or session storage (storage can be blocked). */
const store = {
  get: (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } },
  set: (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch { /* blocked */ } },
};

/** Share icon as drawn in Safari's toolbar (a box with an arrow), used in the iPhone instructions. */
const ShareIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" className="inline -mt-0.5"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;

/** What to do on browsers without an install button: iPhone/iPad and Safari on Mac. */
function HowTo({ mode, name }: { mode: InstallMode; name: string }) {
  if (mode === 'ios') return <span>Tap <ShareIcon /> <b>Share</b> in the browser toolbar, then choose <b>Add to Home Screen</b> to add {name}.</span>;
  return <span>In Safari's menu bar, choose <b>File › Add to Dock</b> to add {name}.</span>;
}

/**
 * The pop-up card. Phones: a full-width sheet at the bottom. Tablet and desktop: a card in the bottom-left corner.
 * Inputs: icon, title, text, colour of the main button, mode, and the Install / Not now actions.
 */
function Card({ icon, title, text, accent, mode, name, busy, onInstall, onClose, label }: { icon: string; title: string; text: string; accent: string; mode: InstallMode; name: string; busy?: boolean; onInstall: () => void; onClose: () => void; label: string }) {
  return (
    <section role="dialog" aria-label={label} className="fixed z-[60] left-3 right-3 bottom-3 sm:left-5 sm:right-auto sm:bottom-5 sm:w-[380px] rounded-[24px] bg-white text-black shadow-[0_24px_60px_-20px_rgba(0,0,0,.45)] ring-1 ring-black/10 p-5 flex flex-col gap-4">
      <div className="flex gap-3.5 items-start">
        <img src={icon} alt="" className="w-14 h-14 rounded-2xl ring-1 ring-black/10 flex-none" />
        <div className="flex flex-col gap-1 min-w-0">
          <strong className="text-[16px] leading-snug">{title}</strong>
          <span className="text-[13.5px] leading-relaxed text-[#55524f]">{mode === 'prompt' ? text : <HowTo mode={mode} name={name} />}</span>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mr-1.5 -mt-1.5 w-8 h-8 rounded-full text-[#55524f] hover:bg-black/5 flex-none text-lg leading-none">×</button>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="h-11 px-5 rounded-full text-sm font-semibold border border-black/15 hover:border-black">{mode === 'prompt' ? 'Not now' : 'Got it'}</button>
        {mode === 'prompt' && <button onClick={onInstall} disabled={busy} className="h-11 px-6 rounded-full text-sm font-semibold text-white disabled:opacity-60" style={{ background: accent }}>Install</button>}
      </div>
    </section>
  );
}

const SNOOZE_STORE = 'ecompos.installSnooze.store';
const SNOOZE_DAYS = 7;

/**
 * Online store install pop-up, for every visitor on phones, tablets and computers.
 * Shows 5 seconds after the page opens, once the cookie choice is made (so the two pop-ups never overlap), and not
 * again for 7 days after "Not now". Never shown inside the installed app or on browsers that cannot install.
 * Inputs: the business name, and `ready` (false while another pop-up such as the cookie banner is open).
 */
export function StoreInstall({ name, ready, onInstalled }: { name: string; ready: boolean; onInstalled?: () => void }) {
  const mode = useInstallMode();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!ready || mode === 'none') { setShow(false); return; }
    const until = Number(store.get(localStorage, SNOOZE_STORE) || 0);
    if (Date.now() < until) return;
    const t = window.setTimeout(() => setShow(true), 5000);
    return () => window.clearTimeout(t);
  }, [ready, mode]);
  if (!show || mode === 'none') return null;
  const snooze = () => { store.set(localStorage, SNOOZE_STORE, String(Date.now() + SNOOZE_DAYS * 864e5)); setShow(false); };
  const install = async () => { const r = await promptInstall(); setShow(false); if (r === 'accepted') onInstalled?.(); else snooze(); };
  return <Card label={`Install ${name}`} icon="/icons/store-192.png" title={`Install the ${name} app`} name={name} accent="#1a1240" mode={mode}
    text="Add our shop to your home screen or desktop for one-tap shopping, faster loading and quick order tracking." onInstall={install} onClose={snooze} />;
}

/* ---------------- Unified POS ---------------- */

const LOCK_TRIES = 5;          // wrong passcodes allowed before installing is locked
const LOCK_MIN = 15;           // how long the lock lasts
const lockKey = (u: string) => 'ecompos.installLock.' + u;

/** The signed-in person's 6-digit passcode: their own changed passcode if they set one, else the account's. */
function passcodeOf(username: string) {
  return creds()[username]?.passcode || ACCOUNTS.find((a) => a.username === username)?.passcode || '';
}

/**
 * Unified POS install pop-up, for signed-in branch staff only (not riders, not remote support).
 * "Install" first opens a passcode check; only the right 6-digit passcode opens the browser's install dialog (or the
 * Add to Home Screen steps on iPhone / Mac Safari). 5 wrong tries lock installing for 15 minutes. Every try is logged
 * in the security log. "Not now" hides the pop-up until the next visit (new browser session).
 */
export function PosInstall() {
  const { session } = useSession();
  const mode = useInstallMode();
  const [show, setShow] = useState(false);
  const [pin, setPin] = useState<null | { v: string; err: string }>(null); // the passcode step, when open
  const [steps, setSteps] = useState(false);                                 // iPhone / Mac Safari steps after the passcode
  const [done, setDone] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const user = session?.username || '';
  const allowed = !!session && !!user && session.role !== 'rider' && session.role !== 'developer' && session.via !== 'support';
  const SESSION_KEY = 'ecompos.installSnooze.pos';

  useEffect(() => {
    if (!allowed || mode === 'none' || store.get(sessionStorage, SESSION_KEY)) { setShow(false); return; }
    const t = window.setTimeout(() => setShow(true), 3000);
    return () => window.clearTimeout(t);
  }, [allowed, mode]);
  useEffect(() => { if (pin) input.current?.focus(); }, [pin?.err, !!pin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!allowed) return null;
  const close = () => { store.set(sessionStorage, SESSION_KEY, '1'); setShow(false); setPin(null); setSteps(false); };
  const lockedMins = () => { const until = Number(store.get(localStorage, lockKey(user)) || 0); return until > Date.now() ? Math.ceil((until - Date.now()) / 60000) : 0; };

  /** Check the passcode; on success open the browser's install dialog (this runs inside the click, as browsers require). */
  const confirm = async () => {
    if (!pin) return;
    const m = lockedMins();
    if (m) return setPin({ ...pin, err: `Too many wrong passcodes. Try again in ${m} minute${m === 1 ? '' : 's'}.` });
    if (!/^\d{6}$/.test(pin.v)) return setPin({ ...pin, err: 'Enter all 6 digits of your passcode.' });
    if (pin.v !== passcodeOf(user)) {
      const k = 'ecompos.installTries.' + user; const n = Number(store.get(sessionStorage, k) || 0) + 1; store.set(sessionStorage, k, String(n));
      const lock = n >= LOCK_TRIES;
      if (lock) { store.set(localStorage, lockKey(user), String(Date.now() + LOCK_MIN * 60000)); store.set(sessionStorage, k, '0'); }
      secLog('POS install · wrong passcode', `${session!.name} entered a wrong passcode to install the POS on ${deviceName()}${lock ? ` · installing locked for ${LOCK_MIN} minutes` : ''}`, lock ? 'high' : 'medium', user);
      return setPin({ v: '', err: lock ? `Too many wrong passcodes. Installing is locked for ${LOCK_MIN} minutes.` : `That passcode is not right. ${LOCK_TRIES - n} tr${LOCK_TRIES - n === 1 ? 'y' : 'ies'} left.` });
    }
    store.set(sessionStorage, 'ecompos.installTries.' + user, '0');
    secLog('POS install · passcode confirmed', `${session!.name} confirmed their passcode to install the POS on ${deviceName()}`, 'low', user);
    setPin(null);
    if (mode !== 'prompt') { setSteps(true); return; }
    const r = await promptInstall();
    if (r === 'accepted') { setShow(false); setDone('MNest UnifiedPOS is installed. Open it from your home screen, desktop or app list.'); }
  };

  return (
    <>
      {show && !pin && (steps
        ? <Card label="Install MNest UnifiedPOS" icon="/icons/pos-192.png" title="Install MNest UnifiedPOS" name="MNest UnifiedPOS" accent="#0b5c5c" mode={mode} text="" onInstall={() => undefined} onClose={close} />
        : <Card label="Install MNest UnifiedPOS" icon="/icons/pos-192.png" title="Install MNest UnifiedPOS on this device" name="MNest UnifiedPOS" accent="#0b5c5c" mode="prompt"
            text="Open the POS straight from your home screen or desktop, full screen. You will confirm your 6-digit passcode first."
            onInstall={() => setPin({ v: '', err: '' })} onClose={close} />)}
      {pin && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setPin(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="pi-h" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); confirm(); }} className="w-full max-w-sm bg-white text-black rounded-[24px] p-6 flex flex-col gap-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)]">
            <div className="flex items-center gap-3"><img src="/icons/pos-192.png" alt="" className="w-12 h-12 rounded-xl ring-1 ring-black/10" /><div className="flex flex-col"><h2 id="pi-h" className="m-0 text-lg font-semibold">Confirm it is you</h2><span className="text-sm text-[#55524f]">Before installing MNest UnifiedPOS</span></div></div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Your 6-digit passcode
              <input ref={input} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin.v} onChange={(e) => setPin({ v: e.target.value.replace(/\D/g, '').slice(0, 6), err: '' })} aria-invalid={!!pin.err} aria-describedby="pi-e"
                className="h-14 rounded-2xl border border-black/15 px-4 text-center text-2xl tracking-[.6em] font-semibold focus:outline-none focus:border-[#0b5c5c]" placeholder="••••••" />
            </label>
            {pin.err ? <span id="pi-e" role="alert" className="text-sm text-[#c62828] -mt-2">{pin.err}</span> : <span id="pi-e" className="text-xs text-[#55524f] -mt-2">The same passcode you use to finish signing in. It is asked every time you install.</span>}
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setPin(null)} className="h-11 px-5 rounded-full text-sm font-semibold border border-black/15">Cancel</button><button type="submit" className="h-11 px-6 rounded-full text-sm font-semibold text-white" style={{ background: '#0b5c5c' }}>Confirm and install</button></div>
          </form>
        </div>
      )}
      {done && <div role="status" className="fixed z-[60] left-3 right-3 bottom-3 sm:left-5 sm:right-auto sm:w-[380px] rounded-2xl bg-[#0b5c5c] text-white p-4 text-sm flex gap-3 items-start"><span className="flex-1">{done}</span><button onClick={() => setDone('')} aria-label="Close" className="text-lg leading-none">×</button></div>}
    </>
  );
}
