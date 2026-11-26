// Staff identity cards (IDCard.md): staff numbers, card records (issue, send, replace), the identity QR payload and
// the verifier that decides "Valid card" or why not. Records live in ecompos.idcards keyed by employee name, photos and
// staff numbers on the HR record (ecompos.hr). A hosted system keeps both on the server (id_cards / employees tables).
import { brName } from './catalogue';
import { BRANCHES } from './nav';
import { HR_KEY, badgeCodes, dayKey, type HrRec } from './clock';
import type { Emp } from './people';
import { readKey, writeKey } from '../lib/persist';

export const IDC_KEY = 'ecompos.idcards';
/** One line of a card's audit trail: what happened, who did it, when (ms). */
export type IdLog = { t: string; by: string; at: number };
/**
 * A card record. issueNo grows with every replacement; token is a random code printed in the QR (9th field) so a
 * typed-up or replaced card fails verification. snap: the details printed on the card, to spot when it is out of date.
 */
export type IdRec = {
  no: string; exp: string; issued: string; issuedTs: number; by: string; sent?: string; sentTs?: number;
  issueNo: number; token: string; snap: { name: string; role: string; br: string };
  replaced?: { issueNo: number; token: string; why: string; at: number }[]; log: IdLog[];
};
export type IdMap = Record<string, IdRec>;

/** Colour tones for the initials when there is no photo (verbatim from the prototype). */
export const TONES = ['#0b5c5c', '#1f7a7a', '#3b5bdb', '#b26a00', '#7a1f5c', '#1f7a2a'];
export const toneOf = (n: string) => TONES[(String(n).charCodeAt(0) + String(n).length) % TONES.length];
export const iniOf = (n: string) => String(n || '').split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();
/** Issuer's initials for the "FOR HR" line: "Ebenezer Mensah" → "E.M.". */
export const signOf = (n: string) => String(n || '').split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + '.').join('').slice(0, 6);

/** "Nov 2028" from YYYY-MM-DD. */
export const monYr = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return isNaN(+d) ? '—' : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
/** Two years from a date, as YYYY-MM-DD (cards are valid for 2 years from issue). */
export const plus2y = (d = new Date()) => dayKey(new Date(d.getFullYear() + 2, d.getMonth(), d.getDate()));
/** Branch name on the card ("All branches" for all-branch staff) and the short tag in capitals (OSU, ALL). */
export const brFull = (br: string) => (br === 'all' ? 'All branches' : brName(br));
export const brTag = (br: string) => (br === 'all' ? 'ALL' : (BRANCHES.find((b) => b.id === br)?.short || brName(br)).toUpperCase());
/** Phone formatted +233 … for the HR copy of the card. */
export const phoneFmt = (p: string) => { const d = String(p || '').replace(/\D/g, '').replace(/^233/, '').replace(/^0/, ''); return d.length === 9 ? `+233 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : p; };

/* ---------- staff numbers ---------- */

/** The number from an employee id ("e4" → 4), used for the demo staff's numbers. */
const idNum = (e: Emp) => parseInt(e.id.replace(/\D/g, ''), 10) || 0;
/** Staff number: the HR record's (EMP-1001 …), else the demo staff's own (EMP-1000 + n). */
export function staffNoOf(e: Emp, hr: Record<string, HrRec> = readKey(HR_KEY, {})): string {
  return hr[e.name]?.no || (idNum(e) > 0 && idNum(e) < 9000 ? `EMP-${1000 + idNum(e)}` : 'EMP-NEW');
}
/**
 * Give every employee without one a staff number and keep it on the HR record. Demo staff keep EMP-1000 + n; anyone
 * else takes the next number after the highest in use (ecompos.staffNoSeq), so a number is never reused.
 * A hosted system takes the number from a server sequence per company. Output: true when something was assigned.
 */
export function ensureStaffNos(E: Emp[]): boolean {
  const hr = { ...readKey<Record<string, HrRec>>(HR_KEY, {}) };
  const used = new Set(Object.values(hr).map((h) => h.no).filter(Boolean) as string[]);
  let seq = Math.max(readKey<number>('ecompos.staffNoSeq', 1000), ...[...used].map((n) => parseInt(n.replace(/\D/g, ''), 10) || 0));
  let changed = false;
  E.forEach((e) => {
    if (hr[e.name]?.no) return;
    let no = idNum(e) > 0 && idNum(e) < 9000 ? `EMP-${1000 + idNum(e)}` : '';
    if (!no || used.has(no)) { do { seq += 1; no = `EMP-${seq}`; } while (used.has(no)); }
    used.add(no); hr[e.name] = { ...(hr[e.name] || {}), no }; changed = true;
    seq = Math.max(seq, parseInt(no.replace(/\D/g, ''), 10));
  });
  if (changed) { writeKey(HR_KEY, hr); writeKey('ecompos.staffNoSeq', seq); }
  return changed;
}

/* ---------- the identity QR ---------- */

/** A random 6-character token (no look-alike letters), from the browser's secure random generator. */
const mkToken = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map((x) => A[x % A.length]).join(''); };
/**
 * Identity QR text: ECOMPOS|ID|no|name|role|branch|company|badge code|R{issue}.{token}. The badge code stays inside
 * the text as "|CODE|", so the card also signs the holder in and out at the time clock. The last field identifies this
 * issue of the card: a replaced or typed-up copy fails verification.
 */
export const idQrText = (no: string, name: string, role: string, br: string, company: string, code: string, rec?: Pick<IdRec, 'issueNo' | 'token'>) =>
  `ECOMPOS|ID|${no}|${name}|${role}|${br === 'all' ? 'ALL BRANCHES' : brName(br)}|${company}|${code}${rec ? `|R${rec.issueNo}.${rec.token}` : ''}`;

/* ---------- issue, send, replace ---------- */

/** Who sees what changed: one audit line on the card (kept to the last 50). */
const logged = (r: IdRec, t: string, by: string): IdRec => ({ ...r, log: [{ t, by, at: Date.now() }, ...(r.log || [])].slice(0, 50) });
const dateTxt = (d = new Date()) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Issue (or re-issue) a card: issue date, issuer, expiry 2 years on, the details printed now. send: also record the
 * digital copy (it then appears in the employee's My HR). replace: a new issue number and token; the old card stops
 * verifying ("Card replaced"). Output: the new records.
 */
export function issueCard(I: IdMap, e: Emp, by: string, opts: { send?: boolean; replace?: string } = {}): IdMap {
  const now = new Date(); const old = I[e.name];
  const fresh = !old || !!opts.replace;
  let r: IdRec = {
    ...(old || { log: [] as IdLog[], replaced: [] }),
    no: staffNoOf(e), exp: plus2y(now), issued: dateTxt(now), issuedTs: now.getTime(), by,
    issueNo: fresh ? (old?.issueNo || 0) + 1 : old!.issueNo, token: fresh ? mkToken() : old!.token,
    snap: { name: e.name, role: e.level, br: e.br },
    replaced: opts.replace && old ? [...(old.replaced || []), { issueNo: old.issueNo, token: old.token, why: opts.replace, at: Date.now() }] : old?.replaced || [],
    log: old?.log || [],
  };
  if (opts.send) r = { ...r, sent: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), sentTs: now.getTime() };
  r = logged(r, opts.replace ? `Card replaced (${opts.replace}) · issue ${r.issueNo}` : opts.send ? 'Card issued and digital copy sent' : 'Card issued', by);
  return { ...I, [e.name]: r };
}
/** Add an audit line (printed, photo changed …) without changing the card. */
export const noteCard = (I: IdMap, name: string, t: string, by: string): IdMap => (I[name] ? { ...I, [name]: logged(I[name], t, by) } : I);
/** The card's printed details no longer match the employee (name, role or branch changed since it was issued). */
export const outOfDate = (r: IdRec | undefined, e: Emp) => !!r && (r.snap.name !== e.name || r.snap.role !== e.level || r.snap.br !== e.br);
/** Days until the card expires (negative once expired). */
export const daysLeft = (r: IdRec, today = new Date()) => Math.round((new Date(r.exp + 'T12:00:00').getTime() - new Date(dayKey(today) + 'T12:00:00').getTime()) / 864e5);

/* ---------- verify ---------- */

export type IdCheck = { ok: boolean; reason: string; emp?: Emp; rec?: IdRec; status?: string };
/**
 * Verify a scanned ID card QR (IDCard.md §5.1). Valid only if it is this company's card, the staff number is on the
 * roster, the name matches, the employee is Active (On leave still counts as employed), it is the latest issue and it
 * has not expired. Inputs: the scanned text, the roster, the card records, the company name and today.
 */
export function verifyId(raw: string, E: Emp[], I: IdMap, company: string, today = new Date()): IdCheck {
  const f = String(raw || '').trim().split('|');
  if (f[0]?.toUpperCase() !== 'ECOMPOS' || f[1]?.toUpperCase() !== 'ID' || f.length < 8) return { ok: false, reason: 'Not a card from this company' };
  const [, , no, name, , , co, , tok] = f;
  if (company && co && co.trim().toLowerCase() !== company.trim().toLowerCase()) return { ok: false, reason: 'Not a card from this company' };
  const hr = readKey<Record<string, HrRec>>(HR_KEY, {});
  const emp = E.find((e) => staffNoOf(e, hr).toUpperCase() === no.toUpperCase());
  if (!emp || emp.name.toLowerCase() !== String(name).toLowerCase()) return { ok: false, reason: 'Not a card from this company' };
  const rec = I[emp.name]; const status = emp.status === 'Left' ? 'Left' : emp.status === 'Suspended' ? 'Suspended' : 'Active';
  const base = { emp, rec, status };
  if (emp.status === 'Left') return { ...base, ok: false, reason: 'Employee has left' };
  if (emp.status === 'Suspended') return { ...base, ok: false, reason: 'Employee suspended' };
  if (!rec) return { ...base, ok: false, reason: 'No card has been issued for this staff number' };
  const m = /^R(\d+)\.([A-Z0-9]{6})$/i.exec(String(tok || '').trim());
  if (!m || Number(m[1]) !== rec.issueNo || m[2].toUpperCase() !== rec.token) {
    const older = !m || Number(m[1]) < rec.issueNo || (rec.replaced || []).some((x) => x.token === m[2].toUpperCase());
    return { ...base, ok: false, reason: older ? 'Card replaced — this copy is no longer valid' : 'Not a card from this company' };
  }
  if (daysLeft(rec, today) < 0) return { ...base, ok: false, reason: `Card expired ${new Date(rec.exp + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` };
  return { ...base, ok: true, reason: 'Valid card' };
}
/**
 * At the time clock: an ID card that fails verification (replaced, expired, suspended, left) must not sign anyone in.
 * Output: '' for anything that is not an ID card or a valid one, else the reason.
 */
export function idCardProblem(raw: string, E: Emp[], company: string): string {
  if (!/^ECOMPOS\|ID\|/i.test(String(raw || '').trim())) return '';
  const r = verifyId(raw, E, readKey<IdMap>(IDC_KEY, {}), company);
  // A badge code still works on its own; only ID-card scans are checked here.
  return r.ok ? '' : r.reason;
}
/** Every employee's badge code (for the QR), re-exported so the ID card screens need one import. */
export { badgeCodes };
