// HR time clock (staff sign-in and sign-out by QR code), as specified in HRSign.md / the prototype Staff.dc.html.
//
//   Company gate code  GATE-XXXXXX   one per company, works at the main gate of every branch; signs in WHOEVER is
//                                    signed in on the phone that scans it.            → ecompos.gate
//   Staff badge code   EMPKOF1001    one per employee (seeded) / EMP7HK2Q (reissued); signs in THAT employee.
//                                                                                     → ecompos.hr[name].code
//   Clock records      newest first: { id, name, br, day, inTs, inAt, outTs, outAt, mins, via, late }
//                                                                                     → ecompos.clock
// One scan signs in; the next signs out (hours go to payroll); the next signs in again (a new shift), and so on.
import { readKey, writeKey } from '../lib/persist';
import type { Emp } from './people';
import { BRS } from './catalogue';
import type { Notif } from '../components/TopBar';

export const GATE_KEY = 'ecompos.gate';
export const HR_KEY = 'ecompos.hr';
export const CLOCK_KEY = 'ecompos.clock';

export type Gate = { code: string; at: string; by: string };
/** HR-only record per employee name: badge code, staff number (never reused) and the ID card photo (22:28 JPEG). */
export type HrRec = { code?: string; no?: string; photo?: string };
export type Clock = { id: string; name: string; br: string; day: string; inTs: number; inAt: string; outTs: number | null; outAt: string; mins: number; via: string; late: boolean };

/** Late = signed in after 08:15. */
export const LATE_MIN = 8 * 60 + 15;

/** Characters for codes: no I, O, 0 or 1, so nothing can be confused when typed. */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const mkCode = (n = 6) => { let c = ''; for (let i = 0; i < n; i++) c += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length)); return c; };

/** "HH:MM" and "YYYY-MM-DD" (local time). */
export const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** "Today" / "Yesterday" / "Mon 23 Nov" for a YYYY-MM-DD day. */
export function dayTxt(day: string) {
  const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (day === dayKey(t)) return 'Today';
  if (day === dayKey(y)) return 'Yesterday';
  return new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
const issuedAt = (withTime: boolean) => { const d = new Date(); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + (withTime ? ', ' + hhmm(d) : ''); };

/* ---------- gate code ---------- */

/** The company gate code, created automatically on first load ("eComPOS set-up"). */
export function gateNow(): Gate {
  const g = readKey<Gate | null>(GATE_KEY, null);
  if (g && g.code) return g;
  const fresh: Gate = { code: 'GATE-' + mkCode(6), at: issuedAt(false), by: 'eComPOS set-up' };
  writeKey(GATE_KEY, fresh);
  return fresh;
}
/** Issue a new gate code (the old one stops working at once). Input: the HR person. Output: the new gate. */
export function reissueGate(by: string): Gate {
  const g: Gate = { code: 'GATE-' + mkCode(6), at: issuedAt(true), by };
  writeKey(GATE_KEY, g); // also fires ecompos:hr (lib/persist.ts)
  return g;
}

/* ---------- staff badge codes ---------- */

/** Seeded badge code: EMP + first 3 letters of the name + 4 digits (EMPKOF1001 for employee e1). */
export const seedCode = (e: Emp) => 'EMP' + (e.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XXX') + String(1000 + ((parseInt(e.id.replace(/\D/g, ''), 10) || 0) % 9000));
/** Every employee's badge code: the one HR issued (ecompos.hr), else the seeded one. Input: the roster. */
export function badgeCodes(E: Emp[], hr: Record<string, HrRec>): Record<string, string> {
  return Object.fromEntries(E.map((e) => [e.name, hr[e.name]?.code || seedCode(e)]));
}
/** Issue a new badge code for one employee (EMP + 5 random characters). Output: the new code. */
export function reissueBadge(name: string): string {
  const H = { ...readKey<Record<string, HrRec>>(HR_KEY, {}) };
  const c = 'EMP' + mkCode(5);
  H[name] = { ...(H[name] || {}), code: c };
  writeKey(HR_KEY, H); // also fires ecompos:hr (lib/persist.ts)
  return c;
}

/* ---------- QR payloads and reading a scanned code ---------- */

export const gatePayload = (code: string, biz: string) => `ECOMPOS|GATE|${code}|${biz}`;
export const badgePayload = (code: string, name: string) => `ECOMPOS|EMP|${code}|${name}`;
export const idPayload = (no: string, name: string, role: string, branch: string, biz: string, code: string) => `ECOMPOS|ID|${no}|${name}|${role}|${branch}|${biz}|${code}`;
/** True when a scanned / typed value is this code: the plain code, or any payload containing "|CODE|". Case ignored. */
export function matches(raw: string, code: string) {
  const r = String(raw || '').trim().toUpperCase(); const c = String(code || '').trim().toUpperCase();
  return !!c && (r === c || r.indexOf('|' + c + '|') >= 0 || r.endsWith('|' + c));
}

/* ---------- punch: one scan signs in or out ---------- */

export const openOf = (L: Clock[], name: string) => L.find((c) => c.name === name && !c.outTs);
export type PunchResult = { list: Clock[]; msg: string } | { err: string };

/**
 * Sign someone in or out. Inputs: the clock list, the roster, the person's name, how they scanned (via) and,
 * optionally, the time (for tests). Output: the new list and the message, or an error for unknown / inactive people.
 * Late = after 08:15. Hours = minutes since sign-in, at least 1 minute. All-branch staff are booked to the first branch.
 */
export function punch(L: Clock[], E: Emp[], name: string, via: string, firstBr: string, at = new Date()): PunchResult {
  const p = E.find((e) => e.name === name);
  if (!p) return { err: 'That code does not match anyone at this company.' };
  if (p.status !== 'Active') return { err: `${p.name} is not an active employee, so they cannot sign in.` };
  const open = openOf(L, name); const ts = at.getTime();
  if (open) {
    const mins = Math.max(1, Math.round((ts - open.inTs) / 60000));
    return { list: L.map((c) => (c.id === open.id ? { ...c, outTs: ts, outAt: hhmm(at), mins } : c)), msg: `${name} signed out at ${hhmm(at)} · ${(mins / 60).toFixed(1)} hours today. The hours go to payroll.` };
  }
  const late = at.getHours() * 60 + at.getMinutes() > LATE_MIN;
  const rec: Clock = { id: 'CK-' + Math.random().toString(36).slice(2, 7), name, br: p.br === 'all' ? firstBr : p.br, day: dayKey(at), inTs: ts, inAt: hhmm(at), outTs: null, outAt: '', mins: 0, via: via || 'QR scan', late };
  return { list: [rec, ...L], msg: `${name} signed in at ${hhmm(at)}${late ? ' · marked late' : ''}.` };
}


/** Minutes worked so far: closed shifts use mins, an open shift counts up to now. */
export const minsOf = (c: Clock, now = Date.now()) => (c.outTs ? c.mins : Math.max(0, Math.round((now - c.inTs) / 60000)));
/** Records in the last n days (n = 1 means today only). */
export function inLastDays(L: Clock[], n: number) {
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (n - 1));
  const k = dayKey(from);
  return L.filter((c) => c.day >= k);
}
/** Hours a person worked in a calendar month (closed shifts only), for payroll. Month is 0–11. */
export function monthHours(L: Clock[], name: string, year: number, month: number) {
  const pre = `${year}-${String(month + 1).padStart(2, '0')}`;
  return Math.round(L.filter((c) => c.name === name && c.day.startsWith(pre) && c.outTs).reduce((a, c) => a + c.mins, 0) / 6) / 10;
}

/* ---------- demo shifts ---------- */

export const SEEDED_KEY = 'ecompos.clockSeeded';
/**
 * Demo shifts, created once per company (flag ecompos.clockSeeded) unless the company data was cleared before first
 * use (ecompos.cleared): the past 12 working days, plus three people already on duty this morning. A flag is used,
 * not "is the list empty", because opening any screen that reads the clock stores an empty list straight away.
 * Output: the clock list to use (the existing one when already seeded).
 */
export function clockNow(E: Emp[], firstBr: string): Clock[] {
  const have = readKey<Clock[]>(CLOCK_KEY, []);
  if (readKey<boolean>(SEEDED_KEY, false)) return have;
  writeKey(SEEDED_KEY, true);
  if (readKey<boolean>('ecompos.cleared', false)) return have;
  const L: Clock[] = []; let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 16) / 65536; };
  const people = E.filter((e) => e.status === 'Active');
  // Demo: two people never scan (so the "not scanning in" insight has something to show).
  const quiet = new Set(people.slice(-2).map((e) => e.name));
  for (let back = 12; back >= 1; back--) {
    const d = new Date(); d.setDate(d.getDate() - back);
    if (d.getDay() === 0) continue; // closed on Sundays in the demo
    people.forEach((e) => {
      if (quiet.has(e.name) || rnd() < 0.08) return;
      const inM = 7 * 60 + 35 + Math.floor(rnd() * 55);                 // 07:35 – 08:30
      const outM = inM + 8 * 60 + Math.floor(rnd() * 110) - 20;         // about 8–9.5 hours later
      const a = new Date(d); a.setHours(0, inM, 0, 0); const b = new Date(d); b.setHours(0, outM, 0, 0);
      L.push({ id: 'CK-' + Math.random().toString(36).slice(2, 7), name: e.name, br: e.br === 'all' ? firstBr : e.br, day: dayKey(d), inTs: a.getTime(), inAt: hhmm(a), outTs: b.getTime(), outAt: hhmm(b), mins: outM - inM, via: rnd() < 0.6 ? 'Gate QR · camera' : 'QR scan', late: inM > LATE_MIN });
    });
  }
  // Already on duty this morning (the till demo user, Akua, is left to sign in herself).
  const today = new Date();
  ['Ebenezer Mensah', 'Ama Darko', 'Kwame Asante'].forEach((n, i) => {
    const e = people.find((x) => x.name === n); if (!e) return;
    const a = new Date(today); a.setHours(7, 40 + i * 9, 0, 0);
    if (a.getTime() > Date.now()) return;
    L.push({ id: 'CK-' + Math.random().toString(36).slice(2, 7), name: n, br: e.br === 'all' ? firstBr : e.br, day: dayKey(a), inTs: a.getTime(), inAt: hhmm(a), outTs: null, outAt: '', mins: 0, via: 'Gate QR · camera', late: false });
  });
  // Keep anything already recorded (real scans), then the demo shifts; newest first.
  const all = [...have, ...L].sort((x, y) => y.inTs - x.inTs);
  writeKey(CLOCK_KEY, all);
  return all;
}

/* ---------- "Nobody signed in by 09:00" alert ---------- */

/**
 * Checks, after 09:00, whether any branch has had no time-clock sign-in today and, once per branch per day, posts the
 * notification "Nobody signed in at {branch} by 09:00" to the Admin and that branch's own manager (the bell; br set). Sundays are skipped
 * (branches open later). Turned off with People & HR → Roles & devices → "Nobody has signed in at a branch by 09:00"
 * (on by default). Inputs: the time (for tests) and the demo notifications to keep when none are stored yet.
 * Output: the branches alerted now. The server job api/cron/no-sign-in.js does the same by email when no device is open.
 */
export function noSignInCheck(notif0: Notif[], at = new Date()): { id: string; name: string }[] {
  if (readKey<Record<string, boolean>>('ecompos.hrAlerts', {}).late === false) return [];
  if (at.getDay() === 0 || at.getHours() * 60 + at.getMinutes() < 9 * 60) return [];
  const day = dayKey(at);
  const sent = readKey<Record<string, string[]>>('ecompos.lateAlertSent', {})[day] || [];
  const signed = new Set(readKey<Clock[]>(CLOCK_KEY, []).filter((c) => c.day === day && c.inTs <= at.getTime()).map((c) => c.br));
  const missing = BRS.filter((b) => !signed.has(b.id) && !sent.includes(b.id));
  if (!missing.length) return [];
  const N = readKey<Notif[] | null>('ecompos.notifs', null) ?? notif0;
  const add: Notif[] = missing.map((b) => ({ id: `NS-${day}-${b.id}`, t: `Nobody signed in at ${b.name} by 09:00`, s: `No one at ${b.name} has scanned the gate QR today. Check the branch is open and that staff are signing in.`, at: at.getTime(), to: ['superuser', 'manager'], br: b.id, readBy: [], link: '/staff' }));
  writeKey('ecompos.notifs', [...add, ...N]);
  writeKey('ecompos.lateAlertSent', { [day]: [...sent, ...missing.map((b) => b.id)] }); // only today's list is kept
  return missing.map((b) => ({ id: b.id, name: b.name }));
}
