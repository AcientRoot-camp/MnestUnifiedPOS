import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { COLLECTIONS, WEB_ORDERS, type Collection, type WebOrder } from '../../data/sell';
import { readKey, usePersist, writeKey } from '../../lib/persist';
import { cx } from '../../lib/format';
import { useShop, type AuthMode } from './ctx';
import { bizName } from './Shell';
import { BIZ, brInfo, cancelAtStaff, ini, money, orderState, phClean, phErr, phFmt, phOk, pwMeter, pwRules, type ShopUser } from './model';
import { companyLogo } from '../../lib/brand';
import NoticeModal from '../../components/Notice';
import { downloadShopDoc } from './docs';
import { PaymentsTab, PurchasesTab, payRowOf } from './History';

// Form styles for the store's sign-in, sign-up and account windows. Every field has ONE outer border that darkens,
// with a soft ring, while it is focused; the global focus outline is switched off on the inner input so no second
// border appears inside the box.
const inp = 'w-full h-12 px-4 rounded-2xl border border-[#d9d9d9] bg-white text-sm transition-[border-color,box-shadow] hover:border-[#bdbdbd] focus:border-black focus:shadow-[0_0_0_4px_rgba(0,0,0,0.06)] focus-visible:outline-none';
/** Wrapper for fields with a prefix or button inside (password, phone): the border lives here, not on the input. */
const box = 'flex items-center h-12 rounded-2xl border border-[#d9d9d9] bg-white transition-[border-color,box-shadow] hover:border-[#bdbdbd] focus-within:border-black focus-within:shadow-[0_0_0_4px_rgba(0,0,0,0.06)]';
/** The input inside a wrapper: no border and no focus outline of its own. */
const bare = 'flex-1 min-w-0 h-full bg-transparent border-0 text-sm outline-none focus:outline-none focus-visible:outline-none';
const btn = 'h-12 px-5 rounded-full bg-black text-white font-semibold transition-colors hover:bg-[#222] disabled:opacity-60';
const ghost = 'h-12 px-5 rounded-full border border-[#d9d9d9] font-semibold transition-colors hover:border-black';
const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

/** Password field with a Show/Hide button inside the same bordered box. */
function PwInput({ id, label, value, onChange, show, toggle, ac }: { id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; toggle: () => void; ac: string }) {
  return <div className="flex flex-col gap-1.5"><label htmlFor={id} className="text-[13px] font-semibold">{label}</label><div className={cx(box, 'pr-1.5')}><input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={ac} className={cx(bare, 'px-4')} /><button type="button" onClick={toggle} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'} className="text-xs font-semibold px-3 h-9 rounded-xl text-[#3d3a38] hover:bg-canvas focus-visible:outline-offset-0">{show ? 'Hide' : 'Show'}</button></div></div>;
}
function Meter({ pw }: { pw: string }) {
  const m = pwMeter(pw);
  return <div className="flex flex-col gap-1.5"><div className="h-1.5 rounded-full bg-canvas overflow-hidden"><div className={cx('h-full transition-all', m.cls)} style={{ width: `${(m.n / 4) * 100}%` }} /></div><span className="text-xs">Password strength: <strong>{m.label}</strong></span><ul className="m-0 p-0 list-none grid grid-cols-2 gap-x-3 text-xs">{pwRules(pw).map((r) => <li key={r.t} className={r.ok ? 'text-ok' : 'text-muted'}>{r.ok ? '✓' : '○'} {r.t}</li>)}</ul></div>;
}
function PhoneIn({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [raw, setRaw] = useState(value);
  return <div className="flex flex-col gap-1.5"><label htmlFor={id} className="text-[13px] font-semibold">{label}</label><div className={box}><span className="pl-4 pr-2 text-sm font-semibold text-[#3d3a38]">+233</span><input id={id} inputMode="numeric" autoComplete="tel-national" maxLength={12} value={raw} onChange={(e) => { setRaw(e.target.value); onChange(phClean(e.target.value)); }} placeholder="24 555 0142" className={cx(bare, 'pr-4')} /></div>{phErr(raw) && <span role="alert" className="text-xs text-danger">{phErr(raw)}</span>}<span className="text-xs text-muted">9 digits after +233, without the first 0</span></div>;
}

const OA: [string, string][] = [['google', 'Google'], ['apple', 'Apple'], ['facebook', 'Facebook']];

/**
 * The real sign-in brand marks, drawn as inline SVG so they stay sharp at any size and need no image download:
 * Google's four-colour "G", Apple's black apple and Facebook's blue "f" roundel, in their official colours and
 * shapes (brand rules: the marks are not recoloured or redrawn). Inputs: k ('google' | 'apple' | 'facebook') and
 * size in px. Output: an <svg>, hidden from screen readers because the button text already names the provider.
 */
export function BrandLogo({ k, size = 20 }: { k: string; size?: number }) {
  if (k === 'google') return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
  if (k === 'apple') return (
    // Apple's mark is taller than wide (814 × 1000), so it is drawn a touch narrower to sit level with the others.
    <svg width={size * 0.82} height={size} viewBox="0 0 814 1000" aria-hidden="true" focusable="false">
      <path fill="#000000" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      <path fill="#FFFFFF" d="M16.671 15.563l.532-3.49h-3.328v-2.25c0-.944.465-1.874 1.956-1.874h1.513V4.978s-1.374-.236-2.686-.236c-2.741 0-4.533 1.671-4.533 4.697v2.634H7.078v3.49h3.047V24a12.15 12.15 0 003.75 0v-8.437h2.796z" />
    </svg>
  );
}

export function AuthModal() {
  const { auth, setAuth, users, setUsers, signIn, W, go } = useShop();
  const [v, setV] = useState({ email: '', pw: '', pw2: '', name: '', phone: '', code: '', oEmail: '' });
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [terms, setTerms] = useState(false);
  const [offers, setOffers] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [oName, setOName] = useState('Google');
  const [pending, setPending] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [resetFor, setResetFor] = useState('');
  useEffect(() => { setErr(''); setOk(''); }, [auth]);
  if (!auth) return null;
  const mode = (m: AuthMode) => { setAuth(m); setV((x) => ({ ...x, pw: '', pw2: '', code: '' })); };
  const f = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => { setV({ ...v, [k]: e.target.value }); setErr(''); };
  const code6 = () => { const c = String(100000 + Math.floor(Math.random() * 900000)); setSentCode(c); return c; };
  const n = bizName(W);
  const doIn = () => { const u = users.find((x) => x.email.toLowerCase() === v.email.trim().toLowerCase()); if (!emailOk(v.email)) return setErr('Type your email address.'); if (!u || u.pw !== v.pw) return setErr('That email and password do not match. Try again or reset your password.'); if (u.secure?.twofa) { setPending(u.email); const c = code6(); setOk(`We sent a 6-digit code by SMS to ${phFmt(u.phone)} (demo code ${c}).`); return setAuth('twofa'); } signIn(u.email); };
  const doUp = () => {
    if (v.name.trim().split(/\s+/).length < 2) return setErr('Add your full name.');
    if (!emailOk(v.email)) return setErr('Type a valid email address.');
    if (users.some((x) => x.email.toLowerCase() === v.email.trim().toLowerCase())) return setErr('An account already uses this email. Sign in instead.');
    if (v.phone && !phOk(v.phone)) return setErr('The phone number needs 9 digits after +233.');
    if (pwMeter(v.pw).n < 3) return setErr('Choose a stronger password (see the rules below the box).');
    if (v.pw !== v.pw2) return setErr('The two passwords do not match.');
    if (!terms) return setErr('Tick the box to agree to the terms of sale and privacy notice.');
    const u: ShopUser = { email: v.email.trim().toLowerCase(), name: v.name.trim(), phone: v.phone, pw: v.pw, verified: false, offers, created: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), addr: [], wish: [], cart: [], orders: [], inbox: [], notif: { sms: true, whatsapp: true, email: true, offers }, linked: { google: false, apple: false, facebook: false }, secure: { twofa: false, alerts: true } };
    setUsers((L) => [...L, u]); setPending(u.email); const c = code6(); setOk(`Account created. We sent a 6-digit code to ${u.email} (demo code ${c}).`); setAuth('verify');
  };
  const doVerify = () => { if (v.code.trim() !== sentCode) return setErr('That code is not right. Check the email or send a new code.'); setUsers((L) => L.map((u) => (u.email === pending ? { ...u, verified: true } : u))); signIn(pending); };
  const oauthGo = (email: string, name: string) => { const e = email.trim().toLowerCase(); if (!emailOk(e)) return setErr('Type a valid email address.'); const k = oName.toLowerCase(); if (!users.some((u) => u.email === e)) setUsers((L) => [...L, { email: e, name, phone: '', pw: '', verified: true, offers: false, created: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), addr: [], wish: [], cart: [], orders: [], inbox: [], notif: { sms: true, whatsapp: true, email: true, offers: false }, linked: { google: false, apple: false, facebook: false, [k]: true }, secure: { twofa: false, alerts: true }, via: oName }]); else setUsers((L) => L.map((u) => (u.email === e ? { ...u, linked: { ...u.linked, [k]: true } } : u))); signIn(e); };
  const titles: Record<AuthMode, [string, string]> = { in: ['Sign in', `Welcome back to ${n}`], up: ['Create your account', 'Track orders, save addresses and reorder in a tap'], verify: ['Verify your email', `Enter the 6-digit code we sent to ${pending}`], twofa: ['Enter your code', 'Extra security is on for this account'], reset: ['Forgot your password?', 'We will email you a link to set a new one'], sent: ['Check your email', 'Reset link sent'], newpw: ['Set a new password', resetFor], oauth: [`Continue with ${oName}`, `Sign in to ${n} with ${oName}`], otp: ['Use your phone number', 'We send a code by SMS or WhatsApp'] };
  const [t, sub] = titles[auth];
  // Social sign-in: three compact buttons in one row, then an "or with email" divider before the email fields.
  const oaBtns = (verb: string) => <><div className="grid grid-cols-3 gap-2" role="group" aria-label={`${verb} with Google, Apple or Facebook`}>{OA.map(([k, l]) => <button key={k} type="button" onClick={() => { setOName(l); setAuth('oauth'); }} aria-label={`${verb} with ${l}`} className="h-12 rounded-2xl border border-[#d9d9d9] font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors hover:border-black"><span className="w-5 h-5 flex items-center justify-center flex-none"><BrandLogo k={k} size={19} /></span>{l}</button>)}</div><div className="flex items-center gap-3 text-xs text-muted" aria-hidden><span className="flex-1 h-px bg-line" />or with email<span className="flex-1 h-px bg-line" /></div></>;
  return (
    <div className="fixed inset-0 z-[75] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setAuth(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="au-h" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-[440px] max-h-[94vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 flex flex-col gap-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]">
        {/* Header: store mark, title and one-line purpose, close button. */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={W.site.logo || companyLogo()} alt="" className="w-11 h-11 rounded-xl object-contain ring-1 ring-black/[.06] p-1 flex-none" />
            <div className="min-w-0"><h2 id="au-h" className="m-0 text-[22px] font-semibold tracking-tight leading-tight">{t}</h2><span className="text-sm text-muted">{sub}</span></div>
          </div>
          <button onClick={() => setAuth(null)} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-canvas text-xl flex-none">×</button>
        </div>
        {(auth === 'in' || auth === 'up') && <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#f2f4f5]">{([['in', 'Sign in'], ['up', 'Sign up']] as [AuthMode, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={auth === k} onClick={() => mode(k)} className={cx('h-10 rounded-xl text-sm transition-colors', auth === k ? 'bg-white text-black font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[#5f5c5a] hover:text-black')}>{l}</button>)}</div>}
        <NoticeModal msg={ok} onClose={() => setOk('')} />
        {err && <div role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-danger">{err}</div>}
        {auth === 'in' && <form onSubmit={(e) => { e.preventDefault(); doIn(); }} className="flex flex-col gap-3">
          {oaBtns('Continue')}
          <div className="flex flex-col gap-1.5"><label htmlFor="au-em" className="text-[13px] font-semibold">Email address</label><input id="au-em" value={v.email} onChange={f('email')} placeholder="you@example.com" autoComplete="email" className={inp} /></div>
          <PwInput id="au-pw" label="Password" value={v.pw} onChange={(x) => setV({ ...v, pw: x })} show={show} toggle={() => setShow(!show)} ac="current-password" />
          <div className="flex justify-between items-center"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keep} onChange={() => setKeep(!keep)} className="w-4 h-4 accent-black" />Keep me signed in</label><button type="button" onClick={() => mode('reset')} className="text-sm underline">Forgot password?</button></div>
          <button className={cx(btn, 'w-full')}>Sign in</button>
          <button type="button" onClick={() => mode('otp')} className={cx(ghost, 'w-full')}>Use my phone number instead</button>
          <span className="text-xs text-muted text-center">Demo account: ama.owusu@gmail.com · Adom2026!</span>
        </form>}
        {auth === 'up' && <form onSubmit={(e) => { e.preventDefault(); doUp(); }} className="flex flex-col gap-3">
          {oaBtns('Sign up')}
          <div className="flex flex-col gap-1.5"><label htmlFor="su-nm" className="text-[13px] font-semibold">Full name</label><input id="su-nm" value={v.name} onChange={f('name')} placeholder="Ama Owusu" autoComplete="name" className={inp} /></div>
          <div className="flex flex-col gap-1.5"><label htmlFor="su-em" className="text-[13px] font-semibold">Email address</label><input id="su-em" value={v.email} onChange={f('email')} placeholder="you@example.com" autoComplete="email" className={inp} /></div>
          <PhoneIn id="su-ph" label="Phone number (optional · for delivery updates)" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
          <PwInput id="su-pw" label="Create a password" value={v.pw} onChange={(x) => setV({ ...v, pw: x })} show={show} toggle={() => setShow(!show)} ac="new-password" />
          <Meter pw={v.pw} />
          <PwInput id="su-pw2" label="Confirm password" value={v.pw2} onChange={(x) => setV({ ...v, pw2: x })} show={show} toggle={() => setShow(!show)} ac="new-password" />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} className="w-4 h-4 mt-0.5 accent-black" /><span>I agree to the {n} <button type="button" onClick={() => { setAuth(null); go('pages/terms'); }} className="underline font-semibold">terms of sale</button> and <button type="button" onClick={() => { setAuth(null); go('pages/privacy'); }} className="underline font-semibold">privacy notice</button></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={offers} onChange={() => setOffers(!offers)} className="w-4 h-4 mt-0.5 accent-black" />Send me offers by email (optional)</label>
          <button className={cx(btn, 'w-full')}>Create account</button>
        </form>}
        {(auth === 'verify' || auth === 'twofa') && <form onSubmit={(e) => { e.preventDefault(); if (auth === 'verify') doVerify(); else if (v.code.trim() !== sentCode) setErr('That code is not right.'); else signIn(pending); }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1"><label htmlFor="vf-code" className="text-sm font-semibold">{auth === 'verify' ? '6-digit code' : 'Code sent by SMS'}</label><input id="vf-code" value={v.code} onChange={f('code')} inputMode="numeric" maxLength={6} placeholder="123456" autoComplete="one-time-code" className={cx(inp, 'tracking-[0.4em] text-center text-lg')} /></div>
          <button className={btn}>{auth === 'verify' ? 'Verify email' : 'Confirm and sign in'}</button>
          <div className="flex justify-between"><button type="button" onClick={() => { const c = code6(); setOk(`New code sent (demo code ${c}).`); }} className="text-sm underline">Send a new code</button>{auth === 'verify' && <button type="button" onClick={() => signIn(pending)} className="text-sm underline">Verify later</button>}</div>
        </form>}
        {auth === 'reset' && <form onSubmit={(e) => { e.preventDefault(); if (!emailOk(v.email)) return setErr('Type the email address on your account.'); setResetFor(v.email.trim().toLowerCase()); setAuth('sent'); }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1"><label htmlFor="rs-em" className="text-sm font-semibold">Email address</label><input id="rs-em" value={v.email} onChange={f('email')} placeholder="you@example.com" autoComplete="email" className={inp} /></div>
          <button className={btn}>Send reset link</button><button type="button" onClick={() => mode('in')} className={ghost}>Back to sign in</button>
        </form>}
        {auth === 'sent' && <div className="flex flex-col gap-3">
          <p className="m-0 text-sm">If an account uses <strong>{resetFor}</strong>, a reset link is on its way. The link works once and expires in 30 minutes. Check your spam folder too.</p>
          <button onClick={() => { if (!users.some((u) => u.email === resetFor)) return setErr('This link has expired or was already used. Ask for a new one.'); mode('newpw'); }} className={btn}>Open the reset link (demo)</button>
          <div className="flex justify-between"><button onClick={() => setOk('Sent again · the earlier link no longer works.')} className="text-sm underline">Send it again</button><button onClick={() => mode('in')} className="text-sm underline">Back to sign in</button></div>
        </div>}
        {auth === 'newpw' && <form onSubmit={(e) => { e.preventDefault(); if (pwMeter(v.pw).n < 3) return setErr('Choose a stronger password.'); if (v.pw !== v.pw2) return setErr('The two passwords do not match.'); setUsers((L) => L.map((u) => (u.email === resetFor ? { ...u, pw: v.pw } : u))); setResetFor(''); setV({ ...v, email: resetFor, pw: '', pw2: '' }); setAuth('in'); setTimeout(() => setOk('Password changed · sign in with your new password.'), 0); }} className="flex flex-col gap-3">
          <PwInput id="np-pw" label="New password" value={v.pw} onChange={(x) => setV({ ...v, pw: x })} show={show} toggle={() => setShow(!show)} ac="new-password" />
          <Meter pw={v.pw} />
          <PwInput id="np-pw2" label="Confirm new password" value={v.pw2} onChange={(x) => setV({ ...v, pw2: x })} show={show} toggle={() => setShow(!show)} ac="new-password" />
          <button className={btn}>Save new password</button>
        </form>}
        {auth === 'oauth' && <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-canvas p-3 text-sm flex items-start gap-3"><span className="w-9 h-9 rounded-full bg-white border border-line flex items-center justify-center flex-none"><BrandLogo k={oName.toLowerCase()} size={18} /></span><span>{oName} will share your name, email address and profile picture with {n}. {n} never sees your {oName} password.</span></div>
          <button onClick={() => oauthGo('ama.owusu@gmail.com', 'Ama Owusu')} className="flex items-center gap-3 p-3 rounded-2xl border border-line text-left hover:border-black"><span className="w-10 h-10 rounded-full bg-black text-white text-sm font-bold flex items-center justify-center">AO</span><span className="flex flex-col"><span className="font-semibold text-sm">Ama Owusu</span><span className="text-xs text-muted">ama.owusu@gmail.com</span></span></button>
          <form onSubmit={(e) => { e.preventDefault(); oauthGo(v.oEmail, v.oEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())); }} className="flex flex-col gap-2"><label htmlFor="oa-em" className="text-sm font-semibold">Use another account</label><input id="oa-em" value={v.oEmail} onChange={f('oEmail')} placeholder="name@example.com" autoComplete="email" className={inp} /><button className={btn}>Continue with {oName}</button></form>
          <button onClick={() => mode('in')} className="text-sm underline">Cancel</button>
        </div>}
        {auth === 'otp' && <form onSubmit={(e) => { e.preventDefault(); const u = users.find((x) => x.phone && x.phone === v.phone); if (!phOk(v.phone)) return setErr('Type the phone number on your account.'); if (!sentCode) { const c = code6(); return setOk(`Code sent to ${phFmt(v.phone)} by SMS and WhatsApp (demo code ${c}).`); } if (v.code.trim() !== sentCode) return setErr('That code is not right.'); if (!u) return setErr('No account uses this phone number. Sign up first.'); signIn(u.email); }} className="flex flex-col gap-3">
          <PhoneIn id="ot-ph" label="Phone number on your account" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
          <div className="flex flex-col gap-1"><label htmlFor="ot-code" className="text-sm font-semibold">Code sent by SMS or WhatsApp</label><input id="ot-code" value={v.code} onChange={f('code')} inputMode="numeric" maxLength={6} placeholder="6 digits" autoComplete="one-time-code" className={inp} /></div>
          <button className={btn}>{sentCode ? 'Verify and sign in' : 'Send me a code'}</button>
          <button type="button" onClick={() => mode('in')} className={ghost}>Use email instead</button>
        </form>}
      </div>
    </div>
  );
}

// Payments and Purchase history (History.tsx) sit next to Orders: all three are read from the same order records.
const TABS: [string, string][] = [['overview', 'Overview'], ['orders', 'Orders'], ['payments', 'Payments'], ['purchases', 'Purchase history'], ['addresses', 'Addresses'], ['wishlist', 'Wishlist'], ['security', 'Login & security'], ['notifications', 'Notifications'], ['privacy', 'Privacy & data']];
const Sw = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => <button role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={cx('w-12 h-7 rounded-full p-0.5 transition-colors flex-none', on ? 'bg-ok' : 'bg-[#d9d9d9]')}><span className={cx('block w-6 h-6 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} /></button>;

export function AccountPage() {
  const { tab = 'overview' } = useParams();
  const s = useShop();
  const { me, upMe, go, orders, setOrders, setMd, byId, add, setAuth, signOut, say } = s;
  const [wo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [col] = usePersist<Collection[]>('ecompos.collect2', COLLECTIONS);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!me) setAuth('in'); }, [me, setAuth]);
  if (!me) return <main className="px-[var(--gut)] py-16 text-center flex flex-col items-center gap-3"><h1 className="m-0 text-2xl">Sign in to see your account</h1><button onClick={() => setAuth('in')} className={btn}>Sign in / Sign up</button></main>;
  const T = TABS.some((t) => t[0] === tab) ? tab : 'overview';
  const my = me.orders.map((no) => orders[no]).filter(Boolean);
  const unread = me.inbox.filter((m) => !m.read).length;
  const pending = my.filter((o) => payRowOf(o).status === 'Pending').length;
  const counts: Record<string, string> = { orders: String(my.length), payments: pending ? `${pending} due` : String(my.length), purchases: String(new Set(my.filter((o) => o.status !== 'Cancelled').flatMap((o) => o.lines.map((l) => l.pid))).size), addresses: String(me.addr.length), wishlist: String(me.wish.length), overview: unread ? `${unread} new` : '' };
  const row = (k: string, v: string) => <div key={k} className="flex flex-col"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 text-sm font-medium">{v || '—'}</dd></div>;
  const download = (name: string, body: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' })); a.download = name; a.click(); };
  return (
    <main className="px-[var(--gut)] py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap"><div className="flex items-center gap-4"><span className="w-14 h-14 rounded-full bg-black text-white text-lg font-bold flex items-center justify-center">{ini(me.name)}</span><div><h1 className="m-0 text-[28px] font-semibold tracking-tight">Hello, {me.name.split(' ')[0]}</h1><span className="text-sm text-muted">{me.email} · <span className={me.verified ? 'text-ok font-semibold' : 'text-[#b26a00] font-semibold'}>{me.verified ? '✓ Verified' : 'Not verified'}</span></span></div></div><button onClick={signOut} className={ghost}>Sign out</button></div>
      {!me.verified && <div role="status" className="rounded-2xl bg-[#fff8e1] p-4 flex items-center justify-between gap-3 flex-wrap"><span className="text-sm">Please verify your email address so we can send receipts and password resets.</span><button onClick={() => { upMe({ verified: true }); setMsg('Email verified ✓'); }} className="h-10 px-4 rounded-full bg-black text-white text-sm font-semibold">Verify now</button></div>}
      <NoticeModal msg={msg} onClose={() => setMsg('')} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
        <nav aria-label="My account" className="flex lg:flex-col gap-1 overflow-x-auto pb-1">{TABS.map(([k, l]) => <button key={k} onClick={() => go(k === 'overview' ? 'account' : `account/${k}`)} aria-current={T === k ? 'page' : undefined} className={cx('flex justify-between gap-3 px-4 py-2.5 rounded-2xl text-sm whitespace-nowrap text-left', T === k ? 'bg-black text-white font-semibold' : 'hover:bg-canvas')}><span>{l}</span><span className={T === k ? 'text-white/70' : 'text-muted'}>{counts[k]}</span></button>)}</nav>
        <div className="flex flex-col gap-5 min-w-0">
          {T === 'overview' && (
            <>
              {me.inbox.length > 0 && <section aria-labelledby="ib-h" className="rounded-3xl border border-line p-5 flex flex-col gap-3"><div className="flex items-center gap-2"><h2 id="ib-h" className="m-0 text-lg font-semibold">Messages from the branch</h2>{unread > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-danger text-white">{unread} new</span>}</div>
                {me.inbox.map((m) => <article key={m.id} className={cx('rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center', m.read ? 'bg-canvas' : 'bg-[#fff8e1]')}><div className="flex-1 flex flex-col gap-0.5"><strong className="text-sm">{m.title}</strong><span className="text-sm text-sub">{m.body}</span><span className="text-xs text-muted">{m.from}</span></div>{m.code && <div className="rounded-xl bg-white px-4 py-2 text-center"><span className="text-[11px] text-muted block">Collection code</span><strong className="font-mono tracking-[0.2em] text-lg">{m.code}</strong></div>}<div className="flex gap-2 items-center"><button onClick={() => setMd({ k: 'track', no: m.no })} className="h-9 px-3 rounded-full bg-black text-white text-xs font-semibold">View order</button>{m.read ? <span className="text-xs text-muted">Read</span> : <button onClick={() => upMe((u) => ({ inbox: u.inbox.map((x) => (x.id === m.id ? { ...x, read: true } : x)) }))} className="text-xs underline">Mark as read</button>}</div></article>)}
              </section>}
              <section aria-labelledby="ad-h" className="rounded-3xl border border-line p-5 flex flex-col gap-3"><div className="flex justify-between items-center gap-2 flex-wrap"><h2 id="ad-h" className="m-0 text-lg font-semibold">Account details</h2><div className="flex gap-2"><button onClick={() => setMd({ k: 'profile' })} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">Edit details</button><button onClick={signOut} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">Sign out</button></div></div>
                <dl className="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{row('Name', me.name)}{row('Email', me.email)}{row('Phone', phFmt(me.phone))}{row('Member since', me.created)}{row('Default address', me.addr.find((a) => a.def)?.street ?? '')}{row('Signed in with', me.via || 'Email and password')}{row('Offers by email', me.offers ? 'Yes' : 'No')}{row('Orders', String(my.length))}</dl>
              </section>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">{[['Orders', String(my.length), 'View orders', 'account/orders'], ['Payments', pending ? `${pending} awaiting payment` : 'All settled', 'Payment history', 'account/payments'], ['Purchases', `${counts.purchases} products`, 'Buy again', 'account/purchases'], ['Addresses', String(me.addr.length), 'Manage', 'account/addresses'], ['Wishlist', String(me.wish.length), 'Open', 'account/wishlist'], ['Security', me.secure.twofa ? 'Extra security on' : 'Password', 'Review', 'account/security']].map(([l, v, c, p]) => <button key={l} onClick={() => go(p)} className="rounded-3xl bg-canvas p-4 text-left flex flex-col gap-1"><span className="text-xs text-muted">{l}</span><span className="font-semibold">{v}</span><span className="text-xs font-semibold underline">{c} →</span></button>)}</div>
            </>
          )}
          {T === 'orders' && (
            <section aria-label="Orders" className="flex flex-col gap-3">
              {!my.length && <div className="rounded-3xl bg-canvas p-6 flex items-center justify-between gap-3 flex-wrap"><span>No orders yet.</span><button onClick={() => go('')} className={btn}>Start shopping</button></div>}
              {my.map((o) => { const st = orderState(o.no, wo, col, o); return (
                <article key={o.no} className="rounded-3xl border border-line p-5 flex flex-col gap-3">
                  <div className="flex justify-between gap-3 flex-wrap"><div className="flex flex-col gap-1"><strong>Order #{o.no}</strong><span className="text-xs"><span className="text-muted">Tracking no.</span> <strong>{o.no}</strong></span><span className="text-sm text-muted">{o.at} · {o.lines.reduce((a, l) => a + l.qty, 0)} items · {o.fulfil === 'D' ? 'Delivery' : o.fulfil === 'P' ? 'Click & collect' : 'In store'}</span>{o.code && !st.cancelled && <span className="text-xs"><span className="text-muted">Collection code</span> <strong className="font-mono tracking-widest">{o.code}</strong></span>}</div><div className="flex flex-col items-end gap-1"><span className={cx('text-xs font-bold px-2.5 py-1 rounded-full', st.cancelled ? 'bg-red-100 text-red-800' : st.idx === 3 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{st.status}</span><strong>{money(o.total)}</strong>{o.returnReq && <span className="text-xs text-muted">Return requested · {o.returnReq}</span>}</div></div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setMd({ k: 'track', no: o.no })} className="h-9 px-3 rounded-full bg-black text-white text-xs font-semibold">{st.cancelled ? 'View status' : 'Track'}</button>
                    <button onClick={() => { o.lines.forEach((l) => byId[l.pid] && add(l.pid, l.unit === 'Single' ? 's' : 'c', l.qty, true)); s.setAdded({ name: `Items from order ${o.no}`, sub: `${o.lines.length} line${o.lines.length === 1 ? '' : 's'}` }); }} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">Buy again</button>
                    {/* Direct PDF downloads of this order's documents (store/docs.ts). */}
                    {([['confirmation', 'Order Confirmation PDF'], ['receipt', 'Receipt PDF'], ['invoice', 'Invoice PDF']] as const).map(([k, l]) => <button key={k} onClick={() => { void downloadShopDoc(o, s.W, k); }} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">⬇ {l}</button>)}
                    {st.canCancel && <button onClick={() => setMd({ k: 'confirm', title: `Cancel order ${o.no}?`, body: o.paid ? `Your ${money(o.total)} will be refunded to the way you paid within 24 hours.` : 'The branch stops preparing it straight away.', cta: 'Yes, cancel order', danger: true, act: () => { cancelAtStaff(o.no, 'Cancelled by customer'); setOrders((O) => ({ ...O, [o.no]: { ...O[o.no], status: 'Cancelled' } })); say(`Order ${o.no} cancelled`); } })} className="h-9 px-3 rounded-full border border-danger text-danger text-xs font-semibold">Cancel order</button>}
                    {!st.cancelled && st.idx === 3 && !o.returnReq && <button onClick={() => setMd({ k: 'return', no: o.no })} className="h-9 px-3 rounded-full border border-line text-xs font-semibold">Request a return</button>}
                  </div>
                </article>
              ); })}
            </section>
          )}
          {T === 'payments' && <PaymentsTab my={my} />}
          {T === 'purchases' && <PurchasesTab my={my} />}
          {T === 'addresses' && (
            <section aria-label="Addresses" className="flex flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-2">{me.addr.map((a) => <div key={a.id} className="rounded-3xl border border-line p-5 flex flex-col gap-2"><div className="flex justify-between"><strong>{a.label}</strong>{a.def && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black text-white">Default</span>}</div><span className="text-sm text-sub">{a.street}<br />{a.area} · GPS {a.gps || '—'}<br />{phFmt(a.phone)}</span><div className="flex gap-3">{!a.def && <button onClick={() => upMe((u) => ({ addr: u.addr.map((x) => ({ ...x, def: x.id === a.id })) }))} className="text-sm underline">Make default</button>}<button onClick={() => upMe((u) => { const L = u.addr.filter((x) => x.id !== a.id); if (a.def && L[0]) L[0] = { ...L[0], def: true }; return { addr: L }; })} className="text-sm underline text-danger">Remove</button></div></div>)}</div>
              {!me.addr.length && <p className="m-0 text-sm text-muted">No saved addresses yet.</p>}
              <button onClick={() => setMd({ k: 'addr' })} className={cx(btn, 'w-fit')}>Add an address</button>
            </section>
          )}
          {T === 'wishlist' && (
            <section aria-label="Wishlist" className="flex flex-col gap-3">
              {!me.wish.length && <div className="rounded-3xl bg-canvas p-6 text-sm">Nothing saved yet. Tap “Save to wishlist” on any product.</div>}
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{me.wish.filter((x) => byId[x]).map((x) => { const p = byId[x]; return <div key={x} className="rounded-3xl border border-line p-3 flex flex-col gap-2"><button onClick={() => s.open(p.id)} aria-label={`View ${p.name}`} className="h-28 rounded-2xl" style={{ background: p.tone }} /><span className="text-sm font-medium">{p.name}</span><span className="text-sm">{money(p.price)}</span><div className="flex gap-2 flex-wrap"><button onClick={() => add(p.id)} className="h-9 px-3 rounded-full bg-black text-white text-xs font-semibold">Move to basket</button><button onClick={() => upMe((u) => ({ wish: u.wish.filter((y) => y !== x) }))} aria-label={`Remove ${p.name}`} className="text-xs underline">Remove</button></div></div>; })}</div>
            </section>
          )}
          {T === 'security' && (
            <section aria-label="Login and security" className="flex flex-col gap-3">
              <div className="rounded-3xl border border-line p-5 flex flex-col gap-3"><div className="flex justify-between"><strong>Profile</strong><button onClick={() => setMd({ k: 'profile' })} className="text-sm underline">Edit profile</button></div><dl className="m-0 grid gap-3 sm:grid-cols-3">{row('Name', me.name)}{row('Email', me.email)}{row('Phone', phFmt(me.phone))}</dl></div>
              <div className="rounded-3xl border border-line p-5 flex justify-between items-center gap-3 flex-wrap"><div className="flex flex-col"><strong>Password</strong><span className="text-sm text-muted">{me.pw ? 'Set · change it any time' : `You sign in with ${me.via || 'a linked account'} · set a password to sign in with email too`}</span></div><button onClick={() => setMd({ k: 'pw' })} className="h-10 px-4 rounded-full border border-black text-sm font-semibold">{me.pw ? 'Change password' : 'Set a password'}</button></div>
              <div className="rounded-3xl border border-line p-5 flex flex-col gap-3"><strong>Sign-in methods</strong>{OA.map(([k, l]) => <div key={k} className="flex justify-between items-center gap-3"><span className="flex items-center gap-3"><span className="w-9 h-9 rounded-full border border-line flex items-center justify-center flex-none"><BrandLogo k={k} size={18} /></span><span className="flex flex-col"><span className="text-sm font-medium">{l}</span><span className="text-xs text-muted">{me.linked[k] ? 'Linked' : 'Not linked'}</span></span></span><Sw on={!!me.linked[k]} label={`${l} sign-in`} onClick={() => upMe((u) => ({ linked: { ...u.linked, [k]: !u.linked[k] } }))} /></div>)}</div>
              <div className="rounded-3xl border border-line p-5 flex flex-col gap-3"><strong>Extra security</strong>{[['twofa', 'Text me a code when I sign in', 'Two-step sign-in by SMS'], ['alerts', 'Email me about new sign-ins', 'Alerts for new devices']].map(([k, l, n]) => <div key={k} className="flex justify-between items-center gap-3"><span className="flex flex-col"><span className="text-sm font-medium">{l}</span><span className="text-xs text-muted">{n}</span></span><Sw on={!!me.secure[k]} label={l} onClick={() => { if (k === 'twofa' && !me.phone) return setMsg('Add a phone number to your profile first.'); upMe((u) => ({ secure: { ...u.secure, [k]: !u.secure[k] } })); }} /></div>)}</div>
              <div className="rounded-3xl border border-line p-5 flex flex-col gap-2"><strong>Where you're signed in</strong>{[['This device · ' + (navigator.userAgent.includes('Mac') ? 'Mac' : navigator.userAgent.includes('Android') ? 'Android' : 'Windows') + ' · Accra', 'Active now'], ['iPhone · Safari · Accra', '2 days ago']].map(([d, w]) => <div key={d} className="flex justify-between text-sm"><span>{d}</span><span className="text-muted">{w}</span></div>)}<button onClick={() => setMsg('Signed out of all other devices.')} className="text-sm underline w-fit mt-1">Sign out of all other devices</button></div>
            </section>
          )}
          {T === 'notifications' && <div className="rounded-3xl border border-line p-5 flex flex-col gap-3"><strong>How we contact you</strong>{[['sms', 'SMS', 'Order updates and collection codes'], ['whatsapp', 'WhatsApp', 'Order updates and rider calls'], ['email', 'Email', 'Receipts and account emails'], ['offers', 'Offers and news', 'Discounts and new stock, about twice a month']].map(([k, l, n]) => <div key={k} className="flex justify-between items-center gap-3"><span className="flex flex-col"><span className="text-sm font-medium">{l}</span><span className="text-xs text-muted">{n}</span></span><Sw on={!!me.notif[k]} label={l} onClick={() => upMe((u) => ({ notif: { ...u.notif, [k]: !u.notif[k] }, offers: k === 'offers' ? !u.notif[k] : u.offers }))} /></div>)}</div>}
          {T === 'privacy' && (
            <section aria-label="Privacy and data" className="flex flex-col gap-3">
              <div className="rounded-3xl border border-line p-5 flex flex-col gap-2"><strong>Download your data</strong><span className="text-sm text-muted">A file with your profile, addresses, orders and preferences (Ghana Data Protection Act, 2012).</span><button onClick={() => setMd({ k: 'confirm', title: 'Download your data?', body: 'We create a file with your profile, addresses, orders and preferences. Your password is not included.', cta: 'Download my data', act: () => { const { pw: _pw, ...rest } = me; void _pw; download(`my-data-${BIZ.replace(/\s/g, '-')}.json`, JSON.stringify({ ...rest, orders: my }, null, 2)); say('Your data file is downloading'); } })} className="h-10 px-4 rounded-full border border-black text-sm font-semibold w-fit">Download my data</button></div>
              <div className="rounded-3xl border border-danger/40 p-5 flex flex-col gap-2"><strong>Delete my account</strong><span className="text-sm text-muted">Permanently remove your login, addresses and wishlist.</span><button onClick={() => setMd({ k: 'del' })} className="h-10 px-4 rounded-full bg-danger text-white text-sm font-semibold w-fit">Delete account…</button></div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export function Modals() {
  const s = useShop();
  const { md, setMd, orders, setOrders, me, upMe, users, setUsers, sess, say, W, go } = s;
  const [wo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [col] = usePersist<Collection[]>('ecompos.collect2', COLLECTIONS);
  const [tlNo, setTlNo] = useState('');
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [v, setV] = useState({ label: '', street: '', area: '', gps: '', phone: '', pName: '', pEmail: '', pPhone: '', cur: '', npw: '', npw2: '', del: '' });
  const [show, setShow] = useState(false);
  useEffect(() => { setErr(''); setReason(''); if (me) setV((x) => ({ ...x, pName: me.name, pEmail: me.email, pPhone: me.phone, phone: me.phone, cur: '', npw: '', npw2: '', del: '' })); }, [md, me]);
  if (!md) return null;
  const close = () => setMd(null);
  const shell = (title: string, body: React.ReactNode, icon?: string, wide = false) => (
    <div className="fixed inset-0 z-[72] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="md-h" onClick={(e) => e.stopPropagation()} className={cx('bg-white w-full max-h-[94vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 flex flex-col gap-4', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex justify-between gap-3 items-start no-print"><div className="flex items-center gap-3">{icon && <span className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center font-bold">{icon}</span>}<h2 id="md-h" className="m-0 text-xl font-semibold">{title}</h2></div><button onClick={close} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-canvas text-xl flex-none">×</button></div>
        {err && <div role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-danger">{err}</div>}
        {body}
      </div>
    </div>
  );
  if (md.k === 'confirm') return shell(md.title, <><p className="m-0 text-sm text-sub">{md.body}</p><div className="flex gap-2 justify-end"><button onClick={close} className={ghost}>Keep it</button><button onClick={() => { md.act(); close(); }} className={cx('h-11 px-5 rounded-full font-semibold text-white', md.danger ? 'bg-danger' : 'bg-black')}>{md.cta}</button></div></>, md.danger ? '!' : '?');
  if (md.k === 'look') return shell('Track your order', <form onSubmit={(e) => { e.preventDefault(); const no = tlNo.replace(/\D/g, ''); if (no.length < 6) return setErr('Type the 8-digit order number from your confirmation.'); if (!orders[no] && !wo.some((x) => x.id === no || x.trackId === no) && !col.some((c) => c.no === no)) return setErr(`We could not find order ${no}. Check the number on your SMS or receipt.`); setMd({ k: 'track', no }); }} className="flex flex-col gap-3"><div className="flex flex-col gap-1"><label htmlFor="tl-no" className="text-sm font-semibold">Tracking number (your order number)</label><input id="tl-no" inputMode="numeric" value={tlNo} onChange={(e) => { setTlNo(e.target.value); setErr(''); }} placeholder="e.g. 34452610" className={inp} /></div><div className="flex gap-2 justify-end"><button type="button" onClick={close} className={ghost}>Cancel</button><button className={btn}>Track order</button></div></form>, '📦');
  if (md.k === 'track') {
    const o = orders[md.no];
    const st = orderState(md.no, wo, col, o);
    const live: [string, string][] = [['Order', `#${md.no}`], ['Status', st.status], ...(o ? [[o.fulfil === 'D' ? 'Delivering to' : 'Branch', o.fulfil === 'D' ? o.where : brInfo(o.brId).name] as [string, string], ['Total', money(o.total)] as [string, string]] : []), ...(st.rider && !st.pickup ? [['Rider', st.rider === 'r2' ? 'Yaw Darko' : st.rider === 'r4' ? 'Abdul Rahman' : 'Assigned'] as [string, string]] : [])];
    return shell(`Order ${md.no}`, <>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{live.flatMap(([k, x]) => [<dt key={k + 'k'} className="text-muted">{k}</dt>, <dd key={k} className="m-0 font-medium">{x}</dd>])}</dl>
      <span className="text-xs text-muted">This page updates on its own when the branch or rider changes the status.</span>
      {st.cancelled && <div role="status" className="rounded-2xl bg-red-50 p-3 text-sm text-danger">This order was cancelled{st.reason ? ` · ${st.reason}` : ''}.{o?.paid ? ' Your refund is on its way to the way you paid.' : ''}</div>}
      {st.proof && <figure className="m-0 rounded-2xl overflow-hidden border border-line"><img src={st.proof} alt="Photo proof of delivery" className="w-full max-h-56 object-cover" /><figcaption className="p-2 text-sm text-ok font-semibold">✓ Delivered · photo taken by the rider</figcaption></figure>}
      {!st.cancelled && <ol className="m-0 p-0 list-none flex flex-col gap-0">{st.names.map((n, i) => <li key={n} className="flex gap-3"><span className="flex flex-col items-center"><span className={cx('w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center', i <= st.idx ? 'bg-ok text-white' : 'bg-canvas text-muted')}>{i <= st.idx ? '✓' : i + 1}</span>{i < 3 && <span className={cx('w-0.5 h-7', i < st.idx ? 'bg-ok' : 'bg-line')} />}</span><span className="flex flex-col pb-3"><span className={cx('text-sm', i === st.idx ? 'font-semibold' : i > st.idx && 'text-muted')}>{n}</span><span className="text-xs text-muted">{i <= st.idx ? st.times[i] : 'Not yet'}</span></span></li>)}</ol>}
      <div className="flex gap-2 justify-end flex-wrap">{st.canCancel && <button onClick={() => setMd({ k: 'confirm', title: `Cancel order ${md.no}?`, body: o?.paid ? 'Your payment will be refunded within 24 hours.' : 'The branch stops preparing it straight away.', cta: 'Yes, cancel order', danger: true, act: () => { cancelAtStaff(md.no, 'Cancelled by customer'); if (o) setOrders((O) => ({ ...O, [md.no]: { ...O[md.no], status: 'Cancelled' } })); say(`Order ${md.no} cancelled`); } })} className="h-11 px-5 rounded-full border border-danger text-danger font-semibold">Cancel order</button>}{o && <button onClick={() => setMd({ k: 'receipt', no: md.no })} className={ghost}>Receipt</button>}<button onClick={close} className={btn}>Done</button></div>
    </>, '📦');
  }
  if (md.k === 'receipt') {
    const o = orders[md.no];
    if (!o) return shell('Receipt', <p className="m-0 text-sm">This receipt is not on this device.</p>);
    const b = brInfo(o.brId);
    const inv = !!md.invoice;
    // Order Confirmation: the version shown and emailed after payment (same order, its own title and number).
    const conf = !inv && md.kind === 'confirmation';
    const kind = inv ? 'invoice' : conf ? 'confirmation' : 'receipt';
    const docName = inv ? 'Invoice' : conf ? 'Order Confirmation' : 'Receipt';
    const docNo = `${inv ? 'INV' : conf ? 'OC' : 'RCP'}-${o.no}`;
    const sums: [string, string][] = [['Subtotal', money(o.sub)], ...(o.disc ? [[`Discount${o.codeTxt ? ' · ' + o.codeTxt : ''}`, '− ' + money(o.disc)] as [string, string]] : []), [o.fulfil === 'D' ? 'Delivery' : 'Collection', o.fee ? money(o.fee) : 'Free'], ['Total (VAT, NHIL & GETFund included)', money(o.total)]];
    // Download the same document as a PDF file (lib/pdf.ts), built from the order record.
    const dl = () => { void downloadShopDoc(o, W, kind); };
    return shell(docName, <>
      <article className="print-doc rounded-2xl border border-line p-5 flex flex-col gap-4 text-sm">
        <div className="flex flex-col items-center text-center gap-1"><img src={W.site.logo || companyLogo()} alt="" className="w-12 h-12" /><strong className="text-base">{bizName(W)}</strong><span className="text-xs text-muted">{b.name} · {b.address}</span><span className="text-xs text-muted">{b.phone} · {W.site.email}</span></div>
        <div className="flex justify-between gap-3 border-y border-line py-3"><div className="flex flex-col"><strong>{inv ? 'Tax invoice' : conf ? 'Order Confirmation' : 'Sales receipt'}</strong><span className="text-xs">{inv ? 'Invoice no.' : conf ? 'Confirmation no.' : 'Receipt no.'} {docNo}</span><span className="text-xs">Order #{o.no} · tracking no. {o.no}</span><span className="text-xs text-muted">{o.at} · Online store</span></div><span className={cx('h-fit text-xs font-bold px-2.5 py-1 rounded-full', o.status === 'Cancelled' ? 'bg-red-100 text-red-800' : o.paid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{o.status === 'Cancelled' ? 'CANCELLED' : o.paid ? 'PAID' : 'TO PAY'}</span></div>
        <dl className="m-0 grid grid-cols-2 gap-2">{[['Customer', o.name], ['Phone', phFmt(o.phone)], ['Fulfilment', o.fulfil === 'D' ? 'Delivery' : o.fulfil === 'P' ? 'Click & collect' : 'Buy in store'], ['Where', o.where], ['When', o.when], ['Payment', o.pay + (o.payRef ? ` · ${o.payRef}` : '')]].map(([k, x]) => <div key={k}><dt className="text-[11px] text-muted">{k}</dt><dd className="m-0 text-xs">{x}</dd></div>)}</dl>
        {o.code && <div className="rounded-xl bg-canvas p-3 flex justify-between items-center"><span className="flex flex-col"><span className="font-semibold">Collection code</span><span className="text-xs text-muted">Show it at the {b.short} counter</span></span><strong className="font-mono text-xl tracking-[0.25em]">{o.code}</strong></div>}
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted border-b border-line">{['Qty', 'Item', 'SKU', 'Unit price', 'Amount'].map((h) => <th key={h} scope="col" className="py-1.5 pr-2 font-semibold">{h}</th>)}</tr></thead><tbody>{o.lines.map((l, i) => <tr key={i} className="border-b border-line"><td className="py-1.5 pr-2">{l.qty}</td><td className="pr-2">{l.name}{l.unit !== 'Single' ? ` (${l.unit})` : ''}</td><td className="pr-2">{l.sku}</td><td className="pr-2">{money(l.each)}</td><td>{money(l.qty * l.each)}</td></tr>)}</tbody></table></div>
        <div className="flex justify-between gap-3"><span className="text-xs text-muted">{o.lines.reduce((a, l) => a + l.qty, 0)} items</span><div className="flex flex-col gap-0.5 min-w-[200px]">{sums.map(([k, x]) => <div key={k} className={cx('flex justify-between gap-3', k.startsWith('Total') && 'font-bold border-t border-line pt-1')}><span className={k.startsWith('Total') ? '' : 'text-muted'}>{k}</span><span>{x}</span></div>)}</div></div>
        {o.hp && <span className="text-xs rounded-xl bg-[#fff8e1] p-2">Hire purchase: {o.hp}. Bring your Ghana Card to sign the agreement.</span>}
        <div className="text-center flex flex-col gap-0.5 border-t border-line pt-3"><strong>Thank you for shopping with us · Akwaaba!</strong><span className="text-xs text-muted">Unopened items can be returned within 7 days with this receipt. Keep it for your records.</span></div>
      </article>
      <div className="flex gap-2 justify-end flex-wrap no-print"><button onClick={close} className={ghost}>Close</button><button onClick={dl} className={ghost}>⬇ Download PDF</button><button onClick={() => window.print()} className={btn}>Print {docName.toLowerCase()}</button></div>
    </>, undefined, true);
  }
  if (md.k === 'return') {
    const RS = ['Damaged or faulty', 'Wrong item delivered', 'Expired or close to expiry', 'Changed my mind (unopened)'];
    return shell(`Return items from ${md.no}`, <><p className="m-0 text-sm text-sub">Tell us why. Bring the items and receipt to any branch within 7 days, or we arrange a pickup.</p><div role="radiogroup" aria-label="Reason" className="flex flex-col gap-2">{RS.map((r) => <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={cx('text-left px-4 py-3 rounded-2xl border text-sm', reason === r ? 'border-black bg-black text-white' : 'border-line')}>{r}</button>)}</div><div className="flex gap-2 justify-end"><button onClick={close} className={ghost}>Cancel</button><button onClick={() => { if (!reason) return setErr('Pick a reason.'); setOrders((O) => ({ ...O, [md.no]: { ...O[md.no], returnReq: reason } })); writeKey('ecompos.returnReqs', [{ no: md.no, reason, at: Date.now(), by: me?.email }, ...readKey<unknown[]>('ecompos.returnReqs', [])]); say('Return requested · the branch will contact you'); close(); }} className={btn}>Request return</button></div></>, '↩');
  }
  if (md.k === 'addr') return shell('Add an address', <form onSubmit={(e) => { e.preventDefault(); if (!v.label.trim() || !v.street.trim() || !v.area.trim()) return setErr('Add a label, the street and the area.'); if (!phOk(v.phone)) return setErr('The rider phone needs 9 digits after +233.'); upMe((u) => ({ addr: [...u.addr, { id: 'a' + Date.now(), label: v.label.trim(), street: v.street.trim(), area: v.area.trim(), gps: v.gps.trim().toUpperCase(), phone: v.phone, def: !u.addr.length }] })); say('Address saved'); close(); }} className="flex flex-col gap-3">
    {([['ad-l', 'Label', 'label', 'Home, Office…'], ['ad-s', 'House number and street', 'street', '14 Ring Road East'], ['ad-a', 'Area and town', 'area', 'Osu, Accra'], ['ad-g', 'Ghana Post GPS (digital address)', 'gps', 'GA-123-4567']] as [string, string, keyof typeof v, string][]).map(([id, l, k, ph]) => <div key={id} className="flex flex-col gap-1"><label htmlFor={id} className="text-sm font-semibold">{l}</label><input id={id} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} className={inp} /></div>)}
    <PhoneIn id="ad-p" label="Phone for the rider" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
    <div className="flex gap-2"><button className={btn}>Save address</button><button type="button" onClick={close} className={ghost}>Cancel</button></div>
  </form>);
  if (md.k === 'profile') return shell('Edit profile', <form onSubmit={(e) => { e.preventDefault(); if (v.pName.trim().length < 2) return setErr('Add your full name.'); if (!emailOk(v.pEmail)) return setErr('Type a valid email address.'); const ne = v.pEmail.trim().toLowerCase(); if (ne !== sess && users.some((u) => u.email === ne)) return setErr('Another account uses this email.'); if (v.pPhone && !phOk(v.pPhone)) return setErr('The phone needs 9 digits after +233.'); setUsers((L) => L.map((u) => (u.email === sess ? { ...u, name: v.pName.trim(), email: ne, phone: v.pPhone, verified: ne === sess ? u.verified : false } : u))); if (ne !== sess) s.setSess(ne); say('Profile saved'); close(); }} className="flex flex-col gap-3">
    <div className="flex flex-col gap-1"><label htmlFor="pf-n" className="text-sm font-semibold">Full name</label><input id="pf-n" value={v.pName} onChange={(e) => setV({ ...v, pName: e.target.value })} autoComplete="name" className={inp} /></div>
    <div className="flex flex-col gap-1"><label htmlFor="pf-e" className="text-sm font-semibold">Email address</label><input id="pf-e" value={v.pEmail} onChange={(e) => setV({ ...v, pEmail: e.target.value })} autoComplete="email" className={inp} /></div>
    <PhoneIn id="pf-p" label="Phone number" value={v.pPhone} onChange={(x) => setV({ ...v, pPhone: x })} />
    <button className={cx(btn, 'w-fit')}>Save profile</button>
  </form>);
  if (md.k === 'pw') return shell(me?.pw ? 'Change password' : 'Set a password', <form onSubmit={(e) => { e.preventDefault(); if (me?.pw && v.cur !== me.pw) return setErr('Your current password is not right.'); if (pwMeter(v.npw).n < 3) return setErr('Choose a stronger password.'); if (v.npw !== v.npw2) return setErr('The two passwords do not match.'); upMe({ pw: v.npw }); say('Password saved'); close(); }} className="flex flex-col gap-3">
    {me?.pw && <PwInput id="cp-c" label="Current password" value={v.cur} onChange={(x) => setV({ ...v, cur: x })} show={show} toggle={() => setShow(!show)} ac="current-password" />}
    <PwInput id="cp-n" label="New password" value={v.npw} onChange={(x) => setV({ ...v, npw: x })} show={show} toggle={() => setShow(!show)} ac="new-password" />
    <Meter pw={v.npw} />
    <PwInput id="cp-n2" label="Confirm new password" value={v.npw2} onChange={(x) => setV({ ...v, npw2: x })} show={show} toggle={() => setShow(!show)} ac="new-password" />
    <div className="flex gap-3 items-center flex-wrap"><button className={btn}>{me?.pw ? 'Change password' : 'Set password'}</button>{me?.pw && <button type="button" onClick={() => { close(); s.signOut(); s.setAuth('reset'); }} className="text-sm underline">Forgot your current password?</button>}</div>
  </form>);
  if (md.k === 'del') return shell('Delete your account?', <form onSubmit={(e) => { e.preventDefault(); if (v.del !== 'DELETE') return setErr('Type DELETE in capitals to confirm.'); const email = sess; setOrders((O) => { const N = { ...O }; Object.keys(N).forEach((k) => { if (N[k].user === email) N[k] = { ...N[k], user: undefined, name: 'Deleted customer', email: '' }; }); return N; }); setUsers((L) => L.filter((u) => u.email !== email)); s.signOut(); go(''); say('Your account was deleted'); }} className="flex flex-col gap-3">
    <span className="text-sm text-sub">This removes your login, addresses and wishlist. Receipts we must keep for tax are kept without your name.</span>
    <div className="flex flex-col gap-1"><label htmlFor="del-c" className="text-sm font-semibold">Type DELETE to confirm</label><input id="del-c" value={v.del} onChange={(e) => setV({ ...v, del: e.target.value })} placeholder="DELETE" autoComplete="off" className={inp} /></div>
    <button className="h-11 px-5 rounded-full bg-danger text-white font-semibold w-fit">Delete account</button>
  </form>, '!');
  return null;
}
