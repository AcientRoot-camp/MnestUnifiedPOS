// Shared security engine (window.__ecSec): hash-chained log, sign-in firewall, rate limit,
// MFA marks, session registry, account holds and the support audit trail.
import { readKey, writeKey } from './persist';

export const SUPPORT = 'MNest UnifiedPOS Support';

/* ---------- SHA-256 ---------- */
export async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- tamper-proof log ---------- */
export type Sev = 'low' | 'medium' | 'high';
export type LogE = { id: string; ts: number; type: string; detail: string; sev: Sev; who: string; prev: string; hash: string };
const body = (e: Omit<LogE, 'hash'>) => [e.id, e.ts, e.type, e.detail, e.sev, e.who, e.prev].join('|');
let chainQ: Promise<void> = Promise.resolve();
/** Appends an entry whose hash covers the previous entry's hash (starts from "GENESIS"). */
export function secLog(type: string, detail: string, sev: Sev = 'low', who = '') {
  chainQ = chainQ.then(async () => {
    const L = readKey<LogE[]>('ecompos.secLog', []);
    const prev = L.length ? L[L.length - 1].hash : 'GENESIS';
    const e: Omit<LogE, 'hash'> = { id: 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: Date.now(), type, detail, sev, who, prev };
    const hash = await sha(body(e));
    writeKey('ecompos.secLog', [...L, { ...e, hash }].slice(-600));
    window.dispatchEvent(new CustomEvent('ecompos:sec'));
  });
  return chainQ;
}
/** Re-checks every link. Returns the ids of entries that were changed or whose link is broken. */
export async function verifyChain(L = readKey<LogE[]>('ecompos.secLog', [])) {
  const bad: string[] = [];
  let prev = L.length ? L[0].prev : 'GENESIS';
  for (const e of L) {
    const { hash, ...rest } = e;
    if (rest.prev !== prev || (await sha(body(rest))) !== hash) bad.push(e.id);
    prev = hash;
  }
  return { ok: bad.length === 0, n: L.length, bad };
}

/* ---------- sign-in firewall ---------- */
export const FW_RULES: [string, RegExp][] = [
  ['SQL injection', /('|%27)\s*(or|and)\s+[\w'"]+\s*=|union\s+select|;\s*(drop|delete|insert|update)\s|--\s*$|\/\*.*\*\//i],
  ['Cross-site scripting', /<\s*script|javascript:|on\w+\s*=|<\s*iframe|<\s*img[^>]+onerror/i],
  ['Path traversal', /\.\.\/|\.\.\\|%2e%2e%2f|\/etc\/passwd/i],
  ['Command injection', /[;&|`]\s*(cat|ls|rm|wget|curl|bash|sh|powershell)\b|\$\(.+\)/i],
  ['Code / template injection', /\{\{.*\}\}|\$\{.*\}|<%.*%>|__proto__|constructor\s*\[/i],
];
export const MAX_FIELD = 128;
/** Returns the rule that matched, or '' when the input is clean. */
export function inspect(fields: Record<string, string>) {
  for (const [k, v] of Object.entries(fields)) {
    if (String(v).length > MAX_FIELD) return { rule: 'Oversized input', field: k };
    for (const [name, re] of FW_RULES) if (re.test(String(v))) return { rule: name, field: k };
  }
  return null;
}

/* ---------- brute-force lockout (per username, per device) ---------- */
type Rate = Record<string, { n: number; until: number; step: number; fails?: number[] }>;
export const rateRead = () => readKey<Rate>('ecompos.secRate', {});
export function lockedMins(u: string) { const r = rateRead()[u]; return r && r.until > Date.now() ? Math.ceil((r.until - Date.now()) / 60000) : 0; }
/** 5 failures lock the username; the wait doubles from 1 minute up to 30 minutes. */
export function rateFail(u: string) {
  const R = rateRead();
  const cur = R[u] ?? { n: 0, until: 0, step: 0, fails: [] };
  cur.n += 1;
  cur.fails = [...(cur.fails || []), Date.now()].filter((t) => Date.now() - t < 864e5);
  let locked = 0;
  if (cur.n >= 5) { locked = Math.min(30, 2 ** cur.step); cur.until = Date.now() + locked * 60000; cur.step += 1; cur.n = 0; }
  R[u] = cur;
  writeKey('ecompos.secRate', R);
  return locked;
}
export function rateClear(u: string, keepHistory = true) { const R = rateRead(); if (!R[u]) return; if (keepHistory) R[u] = { ...R[u], n: 0, until: 0, step: 0 }; else delete R[u]; writeKey('ecompos.secRate', R); }

/* ---------- MFA marks ---------- */
export function mfaMark(name: string) { writeKey('ecompos.secMfa', { ...readKey<Record<string, number>>('ecompos.secMfa', {}), [name]: Date.now() }); }
export function mfaOk(name: string) { const t = readKey<Record<string, number>>('ecompos.secMfa', {})[name]; return !!t && Date.now() - t < 12 * 36e5; }

/* ---------- session registry ---------- */
export type Sess = { sid: string; username: string; name: string; role: string; branch: string; device: string; at: number; last: number };
export const sessions = () => readKey<Sess[]>('ecompos.sessions', []);
export const deviceName = () => { const u = navigator.userAgent; const os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Linux'; const br = /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : 'Browser'; return `${br} · ${os}`; };
export function sessionAdd(s: Omit<Sess, 'sid' | 'at' | 'last' | 'device'>) {
  const x: Sess = { ...s, sid: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), device: deviceName(), at: Date.now(), last: Date.now() };
  writeKey('ecompos.sessions', [x, ...sessions().filter((y) => Date.now() - y.at < 12 * 36e5)].slice(0, 40));
  window.dispatchEvent(new CustomEvent('ecompos:session'));
  return x.sid;
}
export function sessionTouch(sid: string) { const L = sessions(); const i = L.findIndex((s) => s.sid === sid); if (i < 0) return; if (Date.now() - L[i].last < 30000) return; L[i] = { ...L[i], last: Date.now() }; writeKey('ecompos.sessions', L); }
export function sessionEnd(sid: string) { writeKey('ecompos.sessions', sessions().filter((s) => s.sid !== sid)); writeKey('ecompos.secRevoked', Array.from(new Set([...readKey<string[]>('ecompos.secRevoked', []), sid])).slice(-200)); window.dispatchEvent(new CustomEvent('ecompos:session')); }
export const isRevoked = (sid: string) => { const r = readKey<string[] | string>('ecompos.secRevoked', []); return Array.isArray(r) ? r.includes(sid) : r === sid; };

/* ---------- account state (holds, locks, temp passwords) ---------- */
export type Cred = { passcode?: string; held?: string; locked?: boolean; force?: boolean; pinOff?: boolean; tempPw?: string; pw?: string; email?: string; phone?: string; role?: string; branch?: string; perms?: Record<string, boolean> };
export const creds = () => readKey<Record<string, Cred>>('ecompos.creds', {});
export function credSet(u: string, p: Partial<Cred>) { const C = creds(); C[u] = { ...(C[u] || {}), ...p }; writeKey('ecompos.creds', C); }
/** A company on hold blocks every one of its users (licence or payment not settled). */
export const companyHeld = () => readKey<Record<string, { held?: string }>>('ecompos.companyMeta', {}).main?.held || '';

/* ---------- sign-in history ---------- */
export type Signin = { ts: number; username: string; name: string; ok: boolean; branch: string; why?: string };
export function signinAdd(s: Omit<Signin, 'ts'>) { writeKey('ecompos.signins', [{ ...s, ts: Date.now() }, ...readKey<Signin[]>('ecompos.signins', [])].slice(0, 400)); }

/* ---------- support audit trail ---------- */
export type DevAct = { ts: number; what: string; area: string; issue?: string };
/** Every developer action: "My activity" plus the Admin's audit trail, always as the support account. */
export function devLog(what: string, area = 'Developer console', issue = '') {
  writeKey('ecompos.devLog', [{ ts: Date.now(), what, area, issue }, ...readKey<DevAct[]>('ecompos.devLog', [])].slice(0, 500));
  secLog('Support action', what + (issue ? ` · issue: ${issue}` : ''), 'low', SUPPORT);
}

declare global { interface Window { __ecSec?: unknown } }
if (typeof window !== 'undefined') window.__ecSec = { sha, log: secLog, verify: verifyChain, inspect, rateFail, rateClear, lockedMins, mfaMark, mfaOk, sessions, sessionAdd, sessionEnd };

export const ago = (ts: number) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
export const at = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + new Date(ts).toTimeString().slice(0, 5);

/* ---------- Zero Trust ---------- */
import { ACCOUNTS, type Role } from '../data/nav';
export type ZtPolicy = { recheck: number; maxAge: number; idle: number; branchBind: boolean; deviceBind: boolean; blocked: string[]; single: boolean; stepUp: number };
export const ZT0: ZtPolicy = { recheck: 10, maxAge: 12, idle: 5, branchBind: true, deviceBind: true, blocked: [], single: true, stepUp: 5 };
export const ztPolicy = () => ({ ...ZT0, ...readKey<Partial<ZtPolicy>>('ecompos.ztPolicy', {}) });
export type ZtCheck = { k: string; label: string; ok: boolean; why: string };
/** The account as the system knows it now: demo account or one the Admin created, with any Admin hand-over applied. */
export function accountOf(u: string): { role: Role; branch: string; closed: boolean } | null {
  const base = ACCOUNTS.find((a) => a.username === u);
  const made = readKey<{ username: string; role: Role; br: string; closed?: boolean }[]>('ecompos.accounts3', []).find((x) => x.username === u);
  if (!base && !made) return null;
  const ov = readKey<Record<string, { role: Role; branch: string }>>('ecompos.roleOverride', {})[u];
  return { role: ov?.role ?? base?.role ?? made!.role, branch: ov?.branch ?? base?.branch ?? made!.br, closed: !!made?.closed };
}
/** Every rule a session must pass on each re-check. The same rules run in the live session check. */
export function ztChecks(s: { sid?: string; username: string; name: string; role?: string; branch: string; device?: string; at: number; last?: number }, dev = false, P = ztPolicy()): ZtCheck[] {
  const cr = creds()[s.username] || {};
  const acc = accountOf(s.username);
  const ageH = (Date.now() - s.at) / 36e5;
  const idleM = s.last ? (Date.now() - s.last) / 6e4 : 0;
  const entry = s.sid ? sessions().find((x) => x.sid === s.sid) : undefined;
  const reg = !!entry;
  const LV2ROLE: Record<string, string> = { Admin: 'superuser', Manager: 'manager', Supervisor: 'supervisor', 'Sales staff': 'staff', Developer: 'developer', Rider: 'rider' };
  const sRole = s.role ? LV2ROLE[s.role] ?? s.role : '';
  const bindOk = !!acc && !!entry && entry.username === s.username && (!sRole || sRole === acc.role);
  const branchOk = !P.branchBind || !acc || acc.role === 'superuser' || acc.role === 'developer' || acc.role === 'rider' || !acc.branch || s.branch === acc.branch;
  const devOk = !P.deviceBind || !s.device || !P.blocked.includes(s.device);
  return [
    { k: 'reg', label: 'Session registered', ok: reg, why: reg ? 'Known to the session registry' : s.sid ? 'Not in the session registry' : 'No session id · not issued by the sign-in' },
    { k: 'bind', label: 'Bound to the account', ok: bindOk, why: bindOk ? 'Username and role match the account record' : !acc ? 'The account no longer exists' : sRole && sRole !== acc.role ? `Role changed · session says ${sRole}, account is now ${acc.role}` : 'Session does not match its registry entry' },
    { k: 'rev', label: 'Not ended by support', ok: !(s.sid && isRevoked(s.sid)), why: s.sid && isRevoked(s.sid) ? 'Ended in the Security centre or by a newer sign-in' : 'Still allowed' },
    { k: 'acct', label: 'Account active', ok: !cr.held && !cr.locked && !acc?.closed, why: acc?.closed ? 'Account closed' : cr.held ? `On hold · ${cr.held}` : cr.locked ? 'Account locked' : 'Not locked, closed or on hold' },
    { k: 'pw', label: 'Password up to date', ok: !cr.force, why: cr.force ? 'The Admin reset the password · a new one must be set' : 'No password change pending' },
    { k: 'co', label: 'Company in good standing', ok: dev || !companyHeld(), why: !dev && companyHeld() ? `Company on hold · ${companyHeld()}` : 'Licence settled' },
    { k: 'mfa', label: 'Two-step sign-in in the last 12 h', ok: mfaOk(s.name), why: mfaOk(s.name) ? 'Password and passcode verified' : 'No two-step sign-in on record' },
    { k: 'age', label: `Under ${P.maxAge} hours old`, ok: ageH < P.maxAge, why: `${ageH < 1 ? Math.round(ageH * 60) + ' min' : ageH.toFixed(1) + ' h'} old` },
    { k: 'idle', label: `Active in the last ${P.idle} min`, ok: idleM < P.idle, why: s.last ? `Last active ${Math.round(idleM)} min ago` : 'Active now' },
    { k: 'br', label: 'Branch-bound', ok: branchOk, why: branchOk ? 'Signed in to the branch the account belongs to' : `Account belongs to ${acc?.branch}, session is ${s.branch}` },
    { k: 'dev', label: 'Device trusted', ok: devOk, why: devOk ? s.device || 'This device' : `${s.device} is blocked` },
  ];
}
export const ztLog = (who: string, reason: string) => secLog('Zero Trust sign-out', `${who} signed out · ${reason}`, 'medium', who);
/** One session per person: a new sign-in ends that person's other sessions (on any device). */
export function endOtherSessions(username: string, keep: string) {
  const others = sessions().filter((s) => s.username === username && s.sid !== keep);
  others.forEach((s) => sessionEnd(s.sid));
  if (others.length) secLog('Single session', `${username} signed in again · ${others.length} older session${others.length > 1 ? 's' : ''} ended (${others.map((o) => o.device).join(', ')})`, 'medium', username);
  return others.length;
}
/** Step-up: sensitive actions need the passcode again, valid for a few minutes in this tab only. */
const STEP = 'ecompos.stepUp';
export function stepOk(u: string) { try { const v = JSON.parse(sessionStorage.getItem(STEP) || 'null') as { u: string; at: number } | null; return !!v && v.u === u && Date.now() - v.at < ztPolicy().stepUp * 60_000; } catch { return false; } }
export function stepMark(u: string) { try { sessionStorage.setItem(STEP, JSON.stringify({ u, at: Date.now() })); } catch { /* blocked */ } }
export function stepClear() { try { sessionStorage.removeItem(STEP); } catch { /* blocked */ } }
/** Password rules shared by sign-in, profile and reset: 8+ characters with upper, lower, number and symbol, not a default. */
export const DEFAULT_PWS = ['Adom2026!', 'Support2026!', 'Ride2026!'];
export function pwProblem(p: string, u = '') {
  if (p.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p)) return 'Use upper and lower case letters.';
  if (!/\d/.test(p)) return 'Add a number.';
  if (!/[^A-Za-z0-9]/.test(p)) return 'Add a symbol such as ! or #.';
  if (DEFAULT_PWS.includes(p)) return 'That is a shared default password. Choose your own.';
  if (u && p.toLowerCase().includes(u.toLowerCase())) return 'Do not use your username in the password.';
  return '';
}
/** True while the account still uses the password it was given (a shared default or an Admin-set temporary one). */
export function onDefaultPw(u: string) { const cr = creds()[u] || {}; const base = ACCOUNTS.find((a) => a.username === u); return !cr.pw ? !!base : !!cr.force || DEFAULT_PWS.includes(cr.pw); }

/**
 * One-time update after the Admin's username changed from "kofi" to "admin": settings saved on this device under the
 * old username move to the new one, so a password or passcode the Admin already changed keeps working, and the
 * profile photo, role, lockout state, user list entry and the open session carry over. Runs once (ecompos.adminRenamed).
 */
export function migrateAdminUsername(from = 'kofi', to = 'admin') {
  if (readKey<boolean>('ecompos.adminRenamed', false)) return;
  // Maps keyed by username.
  ['ecompos.creds', 'ecompos.profiles', 'ecompos.roleOverride', 'ecompos.secRate'].forEach((k) => {
    const m = readKey<Record<string, unknown> | null>(k, null);
    if (m && from in m && !(to in m)) { const { [from]: v, ...rest } = m; writeKey(k, { ...rest, [to]: v }); }
  });
  // Lists and records with a username field (and the user list's "reports to").
  ['ecompos.accounts3', 'ecompos.sessions'].forEach((k) => {
    const L = readKey<{ username?: string; reportsTo?: string }[] | null>(k, null);
    if (Array.isArray(L) && L.some((x) => x?.username === from || x?.reportsTo === from)) writeKey(k, L.map((x) => ({ ...x, ...(x?.username === from ? { username: to } : {}), ...(x?.reportsTo === from ? { reportsTo: to } : {}) })));
  });
  const s = readKey<{ username?: string } | null>('ecompos.session', null);
  if (s && s.username === from) writeKey('ecompos.session', { ...s, username: to });
  writeKey('ecompos.adminRenamed', true);
}

/**
 * One-time update after the Admin's name changed from "Kofi Adom" to "Ebenezer Mensah" (password, passcode and username
 * stay the same). Records saved on this device under the old name follow the person: the staff list, time-clock
 * sign-ins, leave, HR record (staff number, photo, badge code), ID card record, step-up sign-in mark and the open
 * session. The badge code already printed (EMPKOF1001) is kept so it still works at the time clock; the ID card keeps
 * the old printed name, so HR sees "Card details out of date — reissue". Past activity logs keep the name they were
 * written with. Runs once (ecompos.adminNameChanged).
 */
export function migrateAdminName(from = 'Kofi Adom', to = 'Ebenezer Mensah') {
  if (readKey<boolean>('ecompos.adminNameChanged', false)) return;
  // Maps keyed by the person's name.
  ['ecompos.hr', 'ecompos.idcards', 'ecompos.secMfa'].forEach((k) => {
    const m = readKey<Record<string, unknown> | null>(k, null);
    if (m && from in m && !(to in m)) { const { [from]: v, ...rest } = m; writeKey(k, { ...rest, [to]: v }); }
  });
  // Keep the badge code the old name produced (lib data/clock.ts seedCode), unless HR had already issued one.
  const hr = readKey<Record<string, { code?: string }>>('ecompos.hr', {});
  if (!hr[to]?.code && readKey<unknown[] | null>('ecompos.staff2', null)) writeKey('ecompos.hr', { ...hr, [to]: { ...(hr[to] || {}), code: 'EMPKOF1001' } });
  // Lists with the person's name in a field.
  ([['ecompos.staff2', 'name'], ['ecompos.clock', 'name'], ['ecompos.sessions', 'name'], ['ecompos.leave2', 'who']] as const).forEach(([k, f]) => {
    const L = readKey<Record<string, unknown>[] | null>(k, null);
    if (Array.isArray(L) && L.some((x) => x?.[f] === from)) writeKey(k, L.map((x) => (x?.[f] === from ? { ...x, [f]: to } : x)));
  });
  const s = readKey<{ name?: string } | null>('ecompos.session', null);
  if (s && s.name === from) writeKey('ecompos.session', { ...s, name: to });
  writeKey('ecompos.adminNameChanged', true);
}
