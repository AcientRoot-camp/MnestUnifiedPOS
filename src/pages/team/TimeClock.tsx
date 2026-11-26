// HR time clock screens (HRSign.md): the QR display, the camera scanner, the staff "Scan to sign in / out" card and
// the HR admin "Time clock & QR" tab. The rules and data live in data/clock.ts; the QR encoder in lib/qr.ts.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { noSignInCheck } from '../../data/clock';
import { NOTIF0 } from '../../components/TopBar';
import { useSession } from '../../lib/session';
import { brName } from '../../data/catalogue';
import { staffNoOf, idCardProblem } from '../../data/idcard';
import { badgePayload, dayTxt, gatePayload, inLastDays, matches, minsOf, openOf, type Clock, type Gate } from '../../data/clock';
import { BRS } from '../../data/catalogue';
import { ini, payslip, type Emp } from '../../data/people';
import { useCodeCamera, type CamErr } from '../../lib/camera';
import { cx, ghs } from '../../lib/format';

const TEAL = '#0b5c5c';
const brTxt = (br: string) => (br === 'all' ? 'All branches' : brName(br));
/** Staff number shown on badges and ID cards: the HR record's number (EMP-1001 …, data/idcard.ts), else from the id. */
export const staffNo = (e: Emp) => staffNoOf(e);

/* ---------------- QR display (components/QrBox.tsx) ---------------- */
export { QrBox } from '../../components/QrBox';
import { QrBox } from '../../components/QrBox';

/* ---------------- camera scanner ---------------- */

/** The time clock's camera messages (HRSign.md §4), for each way the shared camera scanner (lib/camera.ts) can fail. */
const HR_CAM: Record<CamErr, string> = {
  denied: 'You said no to the camera. Turn it back on for this site in your browser settings, or type the code under the gate QR.',
  nocam: 'No camera was found on this device. Type the code under the gate QR instead.',
  failed: 'The camera could not start. Type the code under the gate QR instead.',
  unsupported: 'This device has no camera we can open here. Type the code under the gate QR instead.',
};

/** Message banner: teal for success, red for errors. */
export function ClockMsg({ msg, bad, onClose }: { msg: string; bad?: boolean; onClose: () => void }) {
  if (!msg) return null;
  return <div role={bad ? 'alert' : 'status'} className="rounded-2xl px-4 py-3 text-sm text-white flex items-start gap-3" style={{ background: bad ? '#c62828' : TEAL }}><span className="flex-1">{msg}</span><button onClick={onClose} aria-label="Dismiss" className="text-lg leading-none">×</button></div>;
}

/** One row of a sign-in table: "8.2 h", the In time with "· late", Out or "still on duty". */
const hrs = (c: Clock) => (c.outTs ? (c.mins / 60).toFixed(1) + ' h' : '—');

/* ---------------- staff self-service: Scan to sign in / out ---------------- */

/**
 * The employee's own sign-in card (Manager, Supervisor, Sales staff). Opens the camera after a short explanation,
 * reads the gate QR (or the person's own badge), or takes the typed code. Shows the duty strip, the person's stats
 * and their sign-in history. Inputs: the employee, their badge code, the gate, the clock list, the business name,
 * the punch function and the message setter.
 */
export function ClockSelf({ e, code, gate, L, biz, onPunch }: { e: Emp; code: string; gate: Gate | null; L: Clock[]; biz: string; onPunch: (name: string, via: string) => { err?: string; msg?: string } }) {
  const [ask, setAsk] = useState(false);
  const [perm, setPerm] = useState('');
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const mine = L.filter((c) => c.name === e.name);
  const open = openOf(L, e.name);
  const last30 = inLastDays(mine, 30);
  const mins30 = last30.reduce((a, c) => a + minsOf(c), 0);

  /**
   * A scanned or typed value: accept the gate code or this person's own badge, then sign in or out.
   * typed → recorded as "· typed" rather than "· camera" so attendance shows how each sign-in really happened.
   */
  const gateScan = (raw0: string, typedIn = false) => {
    const raw = String(raw0 || '').trim().toUpperCase();
    const bad = (m: string) => { setErr(m); setMsg(''); }; // an error replaces the last success message
    if (!raw) return bad('Scan the gate QR, or type the code under it.');
    const ok = (gate && matches(raw, gate.code)) || matches(raw, code);
    if (!ok) return bad('That code is not this company’s gate code. Ask HR for today’s code.');
    const idBad = idCardProblem(raw, [e], biz); if (idBad) return bad(`This ID card cannot be used: ${idBad}.`);
    cam.stop();
    const r = onPunch(e.name, typedIn ? (raw.includes('GATE') ? 'Gate code · typed' : 'Badge · typed') : (raw.includes('GATE') ? 'Gate QR · camera' : 'Badge · camera'));
    if (r.err) return bad(r.err);
    setErr(''); setTyped(''); setMsg(r.msg || '');
  };
  // Shared camera scanner, QR codes only (it uses the browser's reader or ZXing on iPhone Safari / Firefox).
  const cam = useCodeCamera(['qr_code'], (raw) => gateScan(raw));
  const askCam = () => {
    setAsk(true); setErr('');
    try { navigator.permissions?.query({ name: 'camera' as PermissionName }).then((p) => setPerm(p.state)).catch(() => undefined); } catch { /* not supported */ }
  };
  const allow = () => { setAsk(false); cam.start((k) => { setErr(HR_CAM[k]); if (k === 'denied') setPerm('denied'); }); };
  const p = payslip(e);

  return (
    <section aria-labelledby="ck-me" className="bg-white rounded-[24px] p-[22px] flex flex-col gap-4 shadow-card">
      {/* Header: initials, name, role · branch · staff no */}
      <div className="flex items-center gap-3">
        <span className="w-[54px] h-[54px] rounded-full text-white font-semibold flex items-center justify-center flex-none" style={{ background: e.color }}>{ini(e.name)}</span>
        <div className="flex flex-col min-w-0"><h2 id="ck-me" className="m-0 text-[20px] font-semibold leading-tight">{e.name}</h2><span className="text-sm text-muted">{e.title} · {brTxt(e.br)} · {staffNo(e)}</span></div>
      </div>
      {/* Duty strip */}
      <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2.5" style={open ? { background: '#e7f4e8', color: '#1f5f24' } : { background: '#f2f4f5', color: '#5f5c5a' }}>
        <span className="w-[9px] h-[9px] rounded-full flex-none" style={{ background: 'currentColor' }} />
        {open ? `Signed in at ${open.inAt} · ${(minsOf(open) / 60).toFixed(1)} hours so far` : 'Not signed in yet today'}
      </div>
      <ClockMsg msg={msg} onClose={() => setMsg('')} />
      {/* Teal scan panel */}
      <div className="rounded-[20px] p-5 text-white flex flex-col gap-3" style={{ background: TEAL }}>
        <strong className="text-lg">{open ? 'Scan to sign out' : 'Scan to sign in'}</strong>
        <span className="text-sm text-white/80">HR issues the gate code. Scanning it at the main gate works for every branch of {biz}.</span>
        <div ref={cam.host} id="hr-cam" aria-label="Camera" className={cx('w-full aspect-[4/3] rounded-2xl overflow-hidden', !cam.on && 'hidden')} style={{ background: '#063c3c' }} />
        {cam.on
          ? <button onClick={cam.stop} className="h-11 px-5 rounded-full border border-white text-white text-sm font-semibold w-fit">Close camera</button>
          : <button onClick={askCam} className="h-11 px-5 rounded-full bg-white text-sm font-semibold w-fit" style={{ color: TEAL }}>Open camera &amp; scan</button>}
        {perm === 'denied' && <span className="text-sm" style={{ color: '#ffd2d2' }}>Camera blocked for this site — turn it on for this site in your browser settings.</span>}
        <span className="text-sm text-white/80 mt-1">Camera not working? Type the code printed under the gate QR.</span>
        <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); gateScan(typed, true); }}>
          <label htmlFor="ck-code" className="sr-only">Gate code</label>
          <input id="ck-code" value={typed} onChange={(x) => { setTyped(x.target.value.toUpperCase()); setErr(''); }} placeholder="GATE-XXXXXX" autoComplete="off" className="flex-1 min-w-0 h-11 px-4 rounded-full bg-white text-black uppercase tracking-wider text-sm outline-none" />
          <button type="submit" className="h-11 px-5 rounded-full border border-white text-white text-sm font-semibold">Sign</button>
        </form>
        {err && <span role="alert" className="text-sm" style={{ color: '#ffd2d2' }}>{err}</span>}
      </div>
      {/* My stats */}
      <div className="grid grid-cols-2 gap-2">
        {([['Hours last 30 days', `${(mins30 / 60).toFixed(1)} h`, `${last30.length} shift${last30.length === 1 ? '' : 's'}`], ['Leave left', `${e.leaveLeft} days`, 'of 18 days'], ['Late arrivals', String(last30.filter((c) => c.late).length), 'after 08:15'], ['Monthly pay', ghs(e.basic).replace('.00', ''), `contract · net ${ghs(p.net).replace('.00', '')}`]] as [string, string, string][]).map(([k, v, s]) => (
          <div key={k} className="rounded-2xl bg-[#f2f4f5] p-3 flex flex-col"><span className="text-xs text-muted">{k}</span><b className="text-lg">{v}</b><span className="text-xs text-muted">{s}</span></div>
        ))}
      </div>
      {/* My sign-in and sign-out */}
      <div className="flex flex-col gap-2">
        <strong className="text-sm">My sign-in and sign-out</strong>
        {!mine.length ? <span className="text-sm text-muted">Nothing yet. Scan the gate QR when you arrive.</span> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Day', 'In', 'Out', 'Hours', 'How'].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{mine.slice(0, 14).map((c) => <tr key={c.id} className="border-t border-line"><td className="py-2 pr-3 whitespace-nowrap">{dayTxt(c.day)}</td><td className="py-2 pr-3 whitespace-nowrap" style={{ color: c.late ? '#b26a00' : undefined }}>{c.inAt}{c.late ? ' · late' : ''}</td><td className="py-2 pr-3 whitespace-nowrap">{c.outAt || 'still on duty'}</td><td className="py-2 pr-3">{hrs(c)}</td><td className="py-2 text-muted">{c.via}</td></tr>)}</tbody></table></div>
        )}
      </div>
      {/* Camera permission explanation, before the browser asks */}
      {ask && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setAsk(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ck-cam-h" onClick={(x) => x.stopPropagation()} className="w-full max-w-sm bg-white rounded-[24px] p-6 flex flex-col gap-3">
            <h3 id="ck-cam-h" className="m-0 text-lg font-semibold">Use your camera to sign in?</h3>
            <p className="m-0 text-sm text-sub leading-relaxed">{e.name}, we need your camera only to read the gate QR code. Your browser will ask you next — choose Allow. Nothing is recorded or sent anywhere; the picture stays on your phone and only the code is read.</p>
            {perm === 'denied' && <span className="text-sm text-danger">Camera blocked for this site — turn it on for this site in your browser settings.</span>}
            <div className="flex gap-2 justify-end"><button onClick={() => setAsk(false)} className="h-11 px-5 rounded-full border border-line text-sm font-semibold">Not now</button><button onClick={allow} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>Allow camera</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------- HR admin: Time clock & QR ---------------- */

const RANGES: [number, string][] = [[1, 'Today'], [7, 'Last 7 days'], [30, 'Last 30 days']];

/**
 * The HR admin tab: the printable gate poster / staff badge, the scan box (typed or a USB / Bluetooth scanner),
 * quick sign-in taps, and attendance with ranges and KPIs. Inputs: the roster (in view), all badge codes, the gate,
 * the clock list, the HR person's name, the business name and logo, the selected badge (who), and the actions.
 */
export function ClockAdmin({ E, codes, gate, L, me, biz, logo, who, setWho, onPunch, onNewGate, onNewBadge }: {
  E: Emp[]; codes: Record<string, string>; gate: Gate | null; L: Clock[]; me: string; biz: string; logo?: string; who: string; setWho: (n: string) => void;
  onPunch: (name: string, via: string) => { err?: string; msg?: string }; onNewGate: () => string; onNewBadge: (name: string) => string;
}) {
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [range, setRange] = useState(7);
  const active = E.filter((e) => e.status === 'Active');
  const target = who ? E.find((e) => e.name === who) : undefined;
  const isGate = !target;
  const tCode = target ? codes[target.name] : gate?.code || '';
  const qrText = target ? `ECOMPOS|EMP|${tCode}|${target.name}` : `ECOMPOS|GATE|${tCode}|${biz}`;
  const names = new Set(E.map((e) => e.name));
  const inView = L.filter((c) => names.has(c.name));
  const R = inLastDays(inView, range);
  const onNow = inView.filter((c) => !c.outTs);

  const run = (name: string, via: string) => { const r = onPunch(name, via); if (r.err) { fail(r.err); return; } setErr(''); setTyped(''); setMsg(r.msg || ''); };
  /** Show an error under the box and clear the last success message, so the two are never confused. */
  const fail = (m: string) => { setErr(m); setMsg(''); };
  const scan = () => {
    const raw = typed.trim().toUpperCase();
    if (!raw) return fail('Scan a badge or type the code printed under the QR.');
    if (gate && matches(raw, gate.code)) { if (!E.some((e) => e.name === me)) return fail(`The gate code signs in whoever is logged in, and ${me} is not on the staff list.`); return run(me, 'Gate QR'); }
    // A replaced, expired, suspended or left employee's ID card never signs anyone in (data/idcard.ts).
    const bad = idCardProblem(raw, E, biz); if (bad) return fail(`This ID card cannot be used: ${bad}.`);
    const hit = E.find((e) => matches(raw, codes[e.name]) || e.name.toUpperCase() === raw);
    if (!hit) return fail('That code does not match anyone at this company.');
    run(hit.name, 'QR scan');
  };
  /**
   * Print one layout: 'hr' the on-screen card, 'poster' the A4 gate poster, 'badge' the 85.6 × 54 mm staff badge.
   * The body gets print-{kind} so the print stylesheet (index.css) shows only that layout, and the page size is set
   * for the poster (A4, no margin) or the badge (A4 sheet to cut out). Both are removed after printing.
   */
  const print = (kind: 'hr' | 'poster' | 'badge' = 'hr') => {
    const cls = 'print-' + kind; const st = document.createElement('style');
    st.textContent = kind === 'poster' ? '@media print{@page{size:A4 portrait;margin:0}}' : kind === 'badge' ? '@media print{@page{size:A4 portrait;margin:12mm}}' : '';
    document.head.appendChild(st); document.body.classList.add(cls);
    const off = () => { document.body.classList.remove(cls); st.remove(); window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    try { window.print(); } catch { off(); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr] items-start">
      {/* Printable QR card */}
      <section className="hr-print bg-white rounded-[24px] p-6 flex flex-col items-center text-center gap-3 shadow-card">
        {logo && <img src={logo} alt="" className="h-10 w-auto object-contain" />}
        <h2 className="m-0 text-xl font-semibold">{isGate ? 'Company gate pass' : target!.name}</h2>
        <span className="text-sm text-muted">{isGate ? `${biz} · works at the main gate of every branch` : `${target!.title} · ${brTxt(target!.br)} · ${staffNo(target!)}`}</span>
        <QrBox text={qrText} label={isGate ? `Gate QR code ${tCode}` : `Badge QR code for ${target!.name}, ${tCode}`} />
        <b className="text-[17px] tracking-[.08em]">{tCode}</b>
        {isGate && gate && <span className="text-xs text-muted">Issued {gate.at} by {gate.by || 'HR'}</span>}
        <p className="m-0 text-sm text-sub leading-relaxed max-w-xs">{isGate ? 'Staff open your profile on the right top of the home welcome screen and select My sign-in, ID card, payslips & leave, and scan the QR code with your camera. The first scan of the day signs them in, the next signs them out. If the camera will not read it, they type the code above.' : 'Scan this badge at the start and the end of the shift. The first scan signs in, the next signs out.'}</p>
        <div className="no-print flex gap-1.5 flex-wrap justify-center" role="group" aria-label="Show the QR for">
          {[{ k: '', l: 'Gate pass' }, ...active.slice(0, 7).map((e) => ({ k: e.name, l: e.name.split(' ')[0] }))].map((w) => <button key={w.k || 'gate'} onClick={() => setWho(w.k)} aria-pressed={who === w.k} className={cx('h-9 px-3.5 rounded-full text-sm border', who === w.k ? 'text-white border-transparent font-semibold' : 'bg-white border-line hover:border-black')} style={who === w.k ? { background: TEAL } : undefined}>{w.l}</button>)}
          {who && !active.slice(0, 7).some((e) => e.name === who) && <span className="h-9 px-3.5 rounded-full text-sm text-white font-semibold inline-flex items-center" style={{ background: TEAL }}>{who.split(' ')[0]}</span>}
        </div>
        <div className="no-print flex gap-2 flex-wrap justify-center">
          <button onClick={() => print(isGate ? 'poster' : 'badge')} className="h-11 px-5 rounded-full bg-white border border-line text-sm font-semibold hover:border-black">{isGate ? 'Print A4 poster' : 'Print badge (card size)'}</button>
          <button onClick={() => print('hr')} className="h-11 px-4 rounded-full text-sm text-sub underline underline-offset-4">Print this card</button>
          <button onClick={() => { if (isGate) { const c = onNewGate(); setMsg(`New gate code ${c} issued. Print the poster again for the main gate; the old code no longer works.`); } else { const c = onNewBadge(target!.name); setMsg(`New sign-in code for ${target!.name}: ${c}. Give them the badge again.`); } }} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>{isGate ? 'Issue a new gate code' : 'Issue a new badge code'}</button>
        </div>
      </section>
      {/* Print-only layouts (shown only while printing that kind). They are rendered straight under <body>, outside
          the app, so the print stylesheet can hide the whole app (#root) and the sheet holds only the poster or badge:
          no blank pages after it from the hidden app still taking up room. */}
      {createPortal(isGate ? <GatePoster code={tCode} biz={biz} logo={logo} issued={gate ? `Issued ${gate.at} by ${gate.by || 'HR'}` : ''} />
        : <BadgePrint e={target!} code={tCode} biz={biz} logo={logo} />, document.body)}

      <div className="flex flex-col gap-6 min-w-0">
        <ClockMsg msg={msg} onClose={() => setMsg('')} />
        {/* Scan to sign in or out */}
        <section className="bg-white rounded-[24px] p-6 flex flex-col gap-3 shadow-card">
          <div className="flex justify-between gap-2 flex-wrap"><h2 className="m-0 text-lg font-semibold">Scan to sign in or out</h2><span className="text-sm text-muted">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
          <p className="m-0 text-sm text-sub">An employee scans the poster at the branch, or a supervisor scans the employee badge. A scan signs them in; the next scan signs them out and the hours go to payroll.</p>
          <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); scan(); }}>
            <label htmlFor="ck-scan" className="sr-only">Scanned code</label>
            <input id="ck-scan" value={typed} onChange={(x) => { setTyped(x.target.value.toUpperCase()); setErr(''); }} placeholder={`Scanned code · e.g. ${codes[E[0]?.name] || 'EMPKOF1001'}`} autoComplete="off" className="field py-2 flex-1 min-w-0 uppercase placeholder:normal-case" />
            <button type="submit" className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>Scan</button>
          </form>
          {err && <span role="alert" className="text-sm text-danger">{err}</span>}
          <span className="text-sm text-sub mt-1">No scanner to hand? Tap a name to sign them in or out.</span>
          <div className="flex gap-1.5 flex-wrap">{active.slice(0, 8).map((e) => { const o = openOf(L, e.name); return <button key={e.id} onClick={() => run(e.name, `Tapped by ${me}`)} className="h-9 px-3.5 rounded-full text-sm border" style={o ? { background: TEAL, color: '#fff', borderColor: TEAL } : { background: '#fff', color: '#000', borderColor: '#ebebeb' }}>{o ? 'Sign out ' : 'Sign in '}{e.name.split(' ')[0]}</button>; })}</div>
        </section>
        {/* Attendance */}
        <section className="bg-white rounded-[24px] p-6 flex flex-col gap-4 shadow-card">
          <div className="flex justify-between gap-2 flex-wrap items-center"><h2 className="m-0 text-lg font-semibold">Attendance</h2>
            <div className="flex gap-1.5" role="group" aria-label="Period">{RANGES.map(([n, l]) => <button key={n} onClick={() => setRange(n)} aria-pressed={range === n} className={cx('h-9 px-3.5 rounded-full text-sm border', range === n ? 'text-white border-transparent font-semibold' : 'bg-white border-line')} style={range === n ? { background: TEAL } : undefined}>{l}</button>)}</div></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{([['Shifts', String(R.length), '#000000'], ['Hours', (R.reduce((a, c) => a + minsOf(c), 0) / 60).toFixed(1), TEAL], ['On duty now', String(onNow.length), '#1f7a2a'], ['Late arrivals', String(R.filter((c) => c.late).length), R.some((c) => c.late) ? '#b26a00' : '#1f7a2a']] as [string, string, string][]).map(([k, v, c]) => <div key={k} className="rounded-2xl bg-[#f2f4f5] p-3 flex flex-col"><span className="text-xs text-muted">{k}</span><b className="text-2xl" style={{ color: c }}>{v}</b></div>)}</div>
          {!R.length ? <span className="text-sm text-muted">No attendance recorded in this period yet.</span> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Employee', 'Branch', 'Day', 'In', 'Out', 'Hours', 'How'].map((h) => <th key={h} className="py-1.5 pr-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>{R.slice(0, 40).map((c) => <tr key={c.id} className="border-t border-line"><td className="py-2 pr-3 whitespace-nowrap font-medium">{c.name}</td><td className="py-2 pr-3 whitespace-nowrap">{brName(c.br)}</td><td className="py-2 pr-3 whitespace-nowrap">{dayTxt(c.day)}</td><td className="py-2 pr-3 whitespace-nowrap" style={{ color: c.late ? '#b26a00' : undefined }}>{c.inAt}{c.late ? ' · late' : ''}</td><td className="py-2 pr-3 whitespace-nowrap">{c.outAt || 'still on duty'}</td><td className="py-2 pr-3">{hrs(c)}</td><td className="py-2 text-muted whitespace-nowrap">{c.via}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- "Nobody signed in by 09:00" watcher ---------------- */

/**
 * Runs the 09:00 check (data/clock.ts noSignInCheck) every minute while the portal is open on this device. New alerts go
 * to the bell for the Admin and managers; if this device allowed notifications and the person signed in is the Admin or
 * a manager, a pop-up notification shows as well. Renders nothing.
 */
export function NoSignInWatch() {
  const { session } = useSession();
  useEffect(() => {
    if (!session) return;
    const run = () => {
      const hit = noSignInCheck(NOTIF0);
      if (!hit.length || !(session.role === 'superuser' || session.role === 'manager')) return;
      // A manager gets the pop-up only for their own branch; the Admin gets every branch.
      const mineOnly = hit.filter((b) => session.role === 'superuser' || !session.branch || session.branch === 'all' || session.branch === b.id);
      try { if ('Notification' in window && Notification.permission === 'granted') mineOnly.forEach((b) => new Notification(`Nobody signed in at ${b.name} by 09:00`, { body: 'No one has scanned the gate QR today. Open People & HR to check.', icon: '/icons/pos-192.png', tag: 'nosignin-' + b.id })); } catch { /* notifications blocked */ }
    };
    run();
    const t = window.setInterval(run, 60_000);
    return () => window.clearInterval(t);
  }, [session]);
  return null;
}

/* ---------------- print layouts: A4 gate poster and staff badge ---------------- */

/**
 * A4 gate poster (HRSign.md §7.8): "Scan to sign in / out" heading, the gate QR 12 cm wide with a 4-module quiet zone,
 * the code under it, the branch list and the issue line. Laminate it and put it at eye level at the main gate of each
 * branch (the same code works everywhere). Shown only while printing with body.print-poster.
 */
function GatePoster({ code, biz, logo, issued }: { code: string; biz: string; logo?: string; issued: string }) {
  return (
    <div className="hr-poster print-doc" style={{ width: '210mm', height: '296mm', overflow: 'hidden', padding: '16mm 18mm', boxSizing: 'border-box', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center', background: '#fff', color: '#000' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3mm' }}>
        {logo && <img src={logo} alt="" style={{ height: '18mm', width: 'auto' }} />}
        <span style={{ fontSize: '14pt', fontWeight: 600 }}>{biz}</span>
        <h1 style={{ margin: '4mm 0 0', fontSize: '40pt', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.02em' }}>Scan to sign in / out</h1>
        <span style={{ fontSize: '13pt', maxWidth: '160mm', lineHeight: 1.4 }}>Staff: open your profile on the right top of the home welcome screen, select My sign-in, ID card, payslips &amp; leave, and scan this code with your camera when you arrive and when you leave. The first scan signs you in, the next signs you out.</span>
      </div>
      <QrBox text={gatePayload(code, biz)} size="120mm" label={`Gate QR code ${code}`} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm' }}>
        <span style={{ fontSize: '12pt' }}>Camera not working? Type this code:</span>
        <b style={{ fontSize: '30pt', letterSpacing: '0.12em' }}>{code}</b>
        <span style={{ fontSize: '12pt', marginTop: '3mm' }}>Works at the main gate of every branch: {BRS.map((b) => b.name).join(' · ')}</span>
        <span style={{ fontSize: '9pt', color: '#555', marginTop: '2mm' }}>{issued}. If this poster is damaged or the code is shared, HR issues a new code and this poster stops working.</span>
      </div>
    </div>
  );
}

/**
 * Staff badge at bank-card size, 85.6 × 54 mm (HRSign.md §7.8): business strip, name, role · branch · staff no, and the
 * badge QR (30 mm) with its code. Printed on an A4 sheet to cut out and put in a badge holder. Shown only while printing
 * with body.print-badge.
 */
function BadgePrint({ e, code, biz, logo }: { e: Emp; code: string; biz: string; logo?: string }) {
  return (
    <div className="hr-badge-print print-doc" style={{ padding: 0, background: '#fff' }}>
      <div style={{ width: '85.6mm', height: '54mm', border: '0.2mm solid #999', borderRadius: '3mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', color: '#000', breakInside: 'avoid' }}>
        <div style={{ background: '#0b5c5c', color: '#fff', padding: '1.6mm 3mm', display: 'flex', alignItems: 'center', gap: '2mm', fontSize: '7.5pt', fontWeight: 700, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          {logo && <img src={logo} alt="" style={{ height: '5mm', width: 'auto', background: '#fff', borderRadius: '1mm', padding: '0.4mm' }} />}<span>{biz}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3mm', padding: '2mm 3mm' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.8mm' }}>
            <b style={{ fontSize: '11pt', lineHeight: 1.1 }}>{e.name}</b>
            <span style={{ fontSize: '7.5pt' }}>{e.title}</span>
            <span style={{ fontSize: '7.5pt' }}>{brTxt(e.br)} · {staffNo(e)}</span>
            <span style={{ fontSize: '6.5pt', color: '#444', marginTop: '1mm' }}>Scan at the start and the end of each shift.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6mm' }}>
            <QrBox text={badgePayload(code, e.name)} size="30mm" label={`Badge QR code ${code}`} />
            <b style={{ fontSize: '7pt', letterSpacing: '0.08em' }}>{code}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
