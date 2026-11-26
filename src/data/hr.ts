// People & HR and Payroll rules (GTeam.md): leave, onboarding steps, employee documents, performance score, the role
// permission matrix, recruitment (AI match score, interview kit, offer advice, offer letter, first-week plan) and the
// pay calculation (GRA PAYE bands, SSNIT 5.5% / 13%, overtime over 173 h, 1.5% commission). The screens in
// pages/team read and write the records through these helpers, so the numbers are the same everywhere.
import { BRS, brName } from './catalogue';
import type { Emp } from './people';
import type { Clock } from './clock';

/* ======================================================================= leave */

/** Paid leave days a year at this company (Ghana law: at least 15 working days). */
export const ENT = 18;
/** Signing in after this time counts as late (HRSign.md). */
export const LATE_AFTER = '08:15';
export const LEAVE_TYPES = ['Annual leave', 'Sick leave', 'Compassionate leave', 'Maternity leave', 'Study leave', 'Unpaid leave'];
export type LeaveReq = { id: string; who: string; kind: string; from: string; to: string; days: number; status: 'pending' | 'approved' | 'declined'; note: string; hrNote?: string; decided?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Days from the first to the last day, both included. */
export const daysBetween = (from: string, to: string) => Math.round((new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 864e5) + 1;
/** Annual leave already approved for someone this year (days). */
export const annualTaken = (name: string, L: LeaveReq[], year = new Date().getFullYear()) => L.filter((l) => l.who === name && l.status === 'approved' && l.kind === 'Annual leave' && l.from.startsWith(String(year))).reduce((a, l) => a + l.days, 0);
/** Annual leave left: the employee's starting balance less what has been approved since. */
export const leaveLeft = (e: Emp, L: LeaveReq[]) => Math.max(0, (e.leaveLeft ?? ENT) - annualTaken(e.name, L));
/**
 * Check a leave request (GTeam.md §3, verbatim errors). Output: the error, or '' when it can be sent.
 * Inputs: kind (or '' when "+ Another kind" has no name yet), first and last day, the annual days left.
 */
export function leaveError(kind: string, from: string, to: string, left: number): string {
  if (!kind.trim()) return 'Say what kind of leave this is.';
  if (!ISO.test(from) || !ISO.test(to)) return 'Enter both dates as 2026-11-09.';
  const n = daysBetween(from, to);
  if (n < 1) return 'The last day cannot be before the first day.';
  if (kind === 'Annual leave' && n > left) return `That is ${n} days but you have only ${left} left.`;
  return '';
}
/** Someone else at the same branch already off on any of those days (for the clash warning). */
export function clashWith(r: LeaveReq, L: LeaveReq[], E: Emp[]): string {
  const me = E.find((e) => e.name === r.who); if (!me) return '';
  const o = L.find((x) => x.id !== r.id && x.status !== 'declined' && x.who !== r.who && E.find((e) => e.name === x.who)?.br === me.br && x.from <= r.to && x.to >= r.from);
  return o ? o.who : '';
}

/* ======================================================================= onboarding */

export type OnbOwner = 'HR' | 'Employee' | 'Together';
export type OnbStep = { k: string; t: string; owner: OnbOwner; note: string; doc?: string };
export const ONB_KEY = 'ecompos.onboard';
/** Onboarding ticks: employee name → step key → date ticked. */
export type OnbMap = Record<string, Record<string, string>>;
export const OWNER_COLOR: Record<OnbOwner, string> = { HR: '#5433eb', Employee: '#b26a00', Together: '#0b5c5c' };
/** The 14 steps (GTeam.md §4.3), with the till / road-safety steps worded for the person's role. doc: the document that ticks it. */
export function onbSteps(e: Emp): OnbStep[] {
  const till = e.level === 'Sales staff' || e.level === 'Supervisor' || e.level === 'Manager';
  const rider = e.level === 'Rider';
  return [
    { k: 'welcome', t: 'Welcome pack and first-day briefing', owner: 'HR', note: 'Show them the shop, the staff room and who to ask for help.' },
    { k: 'contract', t: 'Contract of employment signed', owner: 'Together', note: 'Both copies signed, one kept by the employee.', doc: 'contract' },
    { k: 'ghcard', t: 'Ghana Card seen and copied', owner: 'Employee', note: 'Bring the original; HR keeps a copy on file.', doc: 'ghcard' },
    { k: 'ssnit', t: 'SSNIT number recorded', owner: 'Employee', note: 'Needed before the first pay run.', doc: 'ssnit' },
    { k: 'tin', t: 'TIN recorded for PAYE', owner: 'Employee', note: 'From the GRA. HR can help if it is missing.', doc: 'tin' },
    { k: 'pay', t: 'How they get paid (MoMo or bank)', owner: 'Together', note: 'Name on the account must match the employee.', doc: 'bank' },
    { k: 'kin', t: 'Next of kin and emergency contact', owner: 'Employee', note: 'Name, relationship and a phone number that answers.', doc: 'kin' },
    { k: 'badge', t: 'Sign-in badge code issued', owner: 'HR', note: 'Gives them the QR badge for the gate.' },
    { k: 'idcard', t: 'ID card printed and handed over', owner: 'HR', note: 'With photo and the identity QR on the back.', doc: 'photo' },
    { k: 'login', t: 'System login and PIN set up', owner: 'HR', note: 'Done in Users & permissions.' },
    { k: 'train', t: till ? 'Till training: sell, refund, park a sale' : 'System training for the role', owner: 'Together', note: 'Watch them do one of each before they serve alone.' },
    { k: 'safety', t: rider ? 'Road safety, helmet and bike checks' : 'Health, safety and fire exits', owner: 'Together', note: 'Ghana law expects this to be recorded.' },
    { k: 'rules', t: 'Shop rules, breaks and leave explained', owner: 'Together', note: 'Includes the 18 days of paid leave a year.' },
    { k: 'probation', t: 'Probation review date set', owner: 'HR', note: 'Three months from the start date.' },
  ];
}
/** Steps done for someone (ticks + documents on file that tick a step). */
export function onbDone(e: Emp, M: OnbMap, D: DocMap): Set<string> {
  const s = new Set(Object.keys(M[e.name] || {}));
  onbSteps(e).forEach((st) => { if (st.doc && D[e.name]?.[st.doc]?.state === 'filed') s.add(st.k); });
  return s;
}
/** Demo ticks: long-serving staff are fully onboarded; the newest two are part way. */
export function seedOnboard(E: Emp[]): OnbMap {
  const M: OnbMap = {}; const yr = new Date().getFullYear();
  E.forEach((e) => { const steps = onbSteps(e); const n = e.since >= yr ? 6 : e.since >= yr - 1 ? 11 : steps.length; M[e.name] = Object.fromEntries(steps.slice(0, n).map((s) => [s.k, `${e.since}-03-0${1 + (steps.indexOf(s) % 9)}`])); });
  return M;
}

/* ======================================================================= documents */

export type DocType = { id: string; name: string; required: boolean; expires: boolean; note?: string };
export const DOCTYPES_KEY = 'ecompos.docTypes';
export const EMPDOCS_KEY = 'ecompos.empdocs';
export const DOCTYPES0: DocType[] = [
  { id: 'contract', name: 'Contract of employment', required: true, expires: false },
  { id: 'ghcard', name: 'Ghana Card', required: true, expires: true },
  { id: 'ssnit', name: 'SSNIT number', required: true, expires: false },
  { id: 'tin', name: 'TIN certificate', required: true, expires: false },
  { id: 'bank', name: 'Bank or MoMo details', required: true, expires: false },
  { id: 'kin', name: 'Next of kin form', required: true, expires: false },
  { id: 'photo', name: 'Passport photo', required: false, expires: false, note: 'used on ID card' },
  { id: 'medical', name: 'Medical / food handler certificate', required: false, expires: true },
  { id: 'licence', name: "Driver's licence", required: false, expires: true, note: 'riders' },
  { id: 'police', name: 'Police report', required: false, expires: false, note: 'cash roles' },
];
export type EmpDoc = { state: 'missing' | 'asked' | 'filed'; ref?: string; exp?: string; filed?: string; asked?: string; log?: { t: string; at: string }[] };
export type DocMap = Record<string, Record<string, EmpDoc>>;
/** Status of one document (verbatim rule): label, colour, needs attention. */
export function docState(d: EmpDoc | undefined, required: boolean): [string, string, boolean] {
  const x = d || { state: 'missing' as const };
  if (x.state === 'missing') return [required ? 'Missing' : 'Not supplied', required ? '#c62828' : '#9a9794', !!required];
  if (x.state === 'asked') return ['Asked for ' + (x.asked || ''), '#b26a00', true];
  if (!x.exp) return ['On file', '#1f7a2a', false];
  const days = Math.round((new Date(x.exp).getTime() - Date.now()) / 86400000);
  if (days < 0) return ['Expired ' + Math.abs(days) + ' days ago', '#c62828', true];
  if (days < 60) return ['Expires in ' + days + ' days', '#b26a00', true];
  return ['Valid', '#1f7a2a', false];
}
/** Demo document files: most required papers on file, a few missing, asked or expiring, so the screens have something to show. */
export function seedDocs(E: Emp[]): DocMap {
  const M: DocMap = {}; const y = new Date().getFullYear();
  E.forEach((e, i) => {
    const m: Record<string, EmpDoc> = {};
    DOCTYPES0.forEach((t, j) => {
      const r = (i * 7 + j * 3) % 11;
      if (!t.required && t.id !== 'photo' && !(t.id === 'licence' && e.level === 'Rider')) { m[t.id] = { state: 'missing' }; return; }
      if (r === 0) { m[t.id] = { state: 'missing' }; return; }
      if (r === 1) { m[t.id] = { state: 'asked', asked: '18 Nov' }; return; }
      m[t.id] = { state: 'filed', filed: `${Math.max(e.since, y - 2)}-0${1 + (j % 9)}-12`, ref: t.id === 'ghcard' ? `GHA-7${String(100000000 + i * 7919).slice(-8)}-${i % 10}` : t.id === 'ssnit' ? `C0${String(1000000000 + i * 104729).slice(-10)}` : undefined, exp: t.expires ? (r === 2 ? `${y}-12-${10 + (i % 15)}` : `${y + 3}-0${1 + (i % 9)}-01`) : undefined };
    });
    M[e.name] = m;
  });
  return M;
}

/* ======================================================================= performance */

/** Performance score out of 100 (verbatim): sales share 40, attendance 40 (20 days = full), punctuality 20 (−4 per late). */
export function perfScore(sold: number, maxSale: number, days: number, late: number) {
  const sScore = maxSale > 0 ? (sold / maxSale) * 40 : 0, aScore = Math.min(1, days / 20) * 40, pScore = Math.max(0, 20 - late * 4);
  return Math.round(sScore + aScore + pScore);
}
export type Review = { id: string; name: string; stars: number; note: string; by: string; at: string };

/* ======================================================================= roles & devices */

export type Perm = 'Y' | 'PIN' | '-';
export const ROLE_COLS = ['Superuser', 'Manager', 'Supervisor', 'Sales staff', 'Rider'];
/** The default role matrix (GTeam.md §4.10): action → [Superuser, Manager, Supervisor, Sales staff, Rider]. */
export const MATRIX0: [string, Perm[]][] = [
  ['Sell at the till', ['Y', 'Y', 'Y', 'Y', '-']], ['Discount over 10%', ['Y', 'Y', 'PIN', '-', '-']], ['Refund over GHS 200', ['Y', 'Y', 'PIN', '-', '-']],
  ['Void a sale', ['Y', 'Y', 'PIN', '-', '-']], ['Change prices', ['Y', 'Y', '-', '-', '-']], ['Adjust stock', ['Y', 'Y', 'Y', '-', '-']],
  ['See stock & warehouse', ['Y', 'Y', 'Y', 'Y', '-']], ['Approve transfers', ['Y', 'Y', 'Y', '-', '-']], ['Send damages to suppliers', ['Y', 'Y', '-', '-', '-']],
  ['Cash in / out of drawer', ['Y', 'Y', 'PIN', '-', '-']], ['View reports', ['Y', 'Y', '-', '-', '-']], ['Manage staff & payroll', ['Y', '-', '-', '-', '-']],
  ['Approve leave', ['Y', 'Y', '-', '-', '-']], ['Collect cash on delivery', ['Y', 'Y', '-', '-', 'Y']],
];
export const nextPerm = (p: Perm): Perm => (p === 'Y' ? 'PIN' : p === 'PIN' ? '-' : 'Y');
export type Device = { id: string; name: string; kind: string; seen: string; state?: 'Signed out' | 'Locked' };
export const DEVICES0: Device[] = [
  { id: 'd1', name: 'Osu Till 1', kind: 'Android tablet', seen: 'Active now' },
  { id: 'd2', name: 'Osu Till 2', kind: 'iPad', seen: 'Active now' },
  { id: 'd3', name: 'Adum Till 1', kind: 'Android phone', seen: 'Last seen 2 h ago' },
];

/* ======================================================================= recruitment */

export type Stage = 'new' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';
export const STAGES: [Stage, string][] = [['new', 'New'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['offer', 'Offer made'], ['hired', 'Hired'], ['rejected', 'Not selected']];
export const STAGE_LABEL = Object.fromEntries(STAGES) as Record<Stage, string>;
/** Years of experience each role needs (verbatim). */
export const LVNEED: Record<string, number> = { 'Sales staff': 1, Supervisor: 2, Manager: 4, Rider: 1, 'Stock clerk': 1 };
export const JOB_DOCS = ['CV / résumé', 'Ghana Card', 'Certificates', 'Reference letter', 'Passport photo', 'Police report', 'Driving licence'];
export const APPS_KEY = 'ecompos.jobApps';
/** A job application (from the store's Careers page or added by HR). */
export type JobApp = {
  id: string; jobId: string; name: string; phone: string; email?: string; town?: string; exp?: string; avail?: string; note?: string; when: number;
  docs: { name: string; file: string; verified?: boolean }[]; stage: Stage; history: { t: string; at: string }[];
  interview?: { date: string; time: string; place: string }; scores?: Record<string, number>;
  offer?: { pay: number; start: string; contract: string }; letter?: string; letterSent?: boolean;
  onb?: { card: string; ssnit: string; tin: string; payBy: 'MoMo' | 'Bank'; acct: string; kin: string; kinPhone: string }; checks?: Record<string, boolean>;
  reason?: string; hired?: { empId: string; username: string; code: string; no: string };
};
/** A job opening as the online store keeps it (data/web Job). */
export type JobLite = { id: string; title: string; role?: string; br: string; type: string; salMin: string; salMax: string; summary: string; duties?: string; reqs?: string; offer?: string; docs?: string[] };
const nowTxt = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + new Date().toTimeString().slice(0, 5);
export const logApp = (a: JobApp, t: string): JobApp => ({ ...a, history: [{ t, at: nowTxt() }, ...(a.history || [])] });

/** Days until the candidate can start, from what they typed ("Immediately", "2 weeks", "1 month", a date); null if unknown. */
export function availDays(s?: string): number | null {
  const t = String(s || '').toLowerCase().trim(); if (!t) return null;
  if (/immediate|now|asap|today|any ?time/.test(t)) return 0;
  const n = parseFloat(t.match(/\d+(\.\d+)?/)?.[0] || '1');
  if (/week/.test(t)) return n * 7; if (/month/.test(t)) return n * 30; if (/day/.test(t)) return n;
  const d = new Date(t); return isNaN(+d) ? null : Math.max(0, Math.round((d.getTime() - Date.now()) / 864e5));
}
const WORDS = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOPW.has(w));
const STOPW = new Set('with that this from have will your about their they them what when where which while into over under than then also must able good work working other more most some such very each every shop store customers customer'.split(' '));
/**
 * AI match score out of 100 (verbatim parts): Documents 25, Experience 25, Location 15, Skills match 25, Availability 10.
 * Output: total, the parts, the recommendation and colour, strengths and gaps to check.
 */
export function aiScore(a: JobApp, j?: JobLite) {
  const role = j?.role || 'Sales staff';
  const want = (j?.docs?.length ? j.docs : ['CV / résumé']);
  const have = new Set(a.docs.map((d) => d.name));
  const sDocs = Math.round((want.filter((d) => have.has(d)).length / want.length) * 25);
  const yrs = parseFloat(String(a.exp || '0')) || 0; const need = LVNEED[role] ?? 1;
  const sExp = Math.round(Math.min(1, yrs / need) * 25);
  const town = String(a.town || '').toLowerCase(); const br = j ? brName(j.br).toLowerCase() : '';
  const city = j?.br === 'adum' ? 'kumasi' : 'accra';
  const sLoc = !town ? 5 : (br && town.includes(br)) ? 15 : town.includes(city) ? 10 : 3;
  const kws = [...new Set(WORDS(`${j?.duties || ''} ${j?.reqs || ''} ${j?.summary || ''}`))].slice(0, 30);
  const said = new Set(WORDS(`${a.note || ''} ${a.docs.map((d) => d.file).join(' ')}`));
  const hits = kws.filter((k) => said.has(k));
  const sKw = Math.round(Math.min(1, hits.length / Math.min(6, Math.max(1, kws.length))) * 25);
  const ad = availDays(a.avail);
  const sAv = ad === null ? 5 : ad <= 14 ? 10 : ad <= 30 ? 7 : 3;
  const parts: [string, number, number][] = [['Documents', sDocs, 25], ['Experience', sExp, 25], ['Location', sLoc, 15], ['Skills match', sKw, 25], ['Availability', sAv, 10]];
  const total = sDocs + sExp + sLoc + sKw + sAv;
  const rec: [string, string] = total >= 75 ? ['Strong match · shortlist', '#1f7a2a'] : total >= 55 ? ['Possible match · review the CV', '#b26a00'] : ['Weak match · likely decline', '#c62828'];
  const strengths: string[] = []; const gaps: string[] = [];
  if (sDocs === 25) strengths.push('Every document the job asks for is uploaded'); else gaps.push(`Missing: ${want.filter((d) => !have.has(d)).join(', ')}`);
  if (yrs >= need) strengths.push(`${yrs} years' experience (the role needs ${need})`); else gaps.push(`${yrs || 'No'} years' experience; the role needs ${need}`);
  if (sLoc >= 10) strengths.push(`Lives near the branch (${a.town})`); else if (a.town) gaps.push(`Lives in ${a.town}, far from ${br || 'the branch'}`); else gaps.push('Did not say where they live');
  if (hits.length) strengths.push(`Mentions ${hits.slice(0, 4).join(', ')}`); else gaps.push('Cover note does not mention the duties or skills in the advert');
  if (ad !== null && ad <= 14) strengths.push(ad === 0 ? 'Can start immediately' : `Can start within ${ad} days`); else if (ad === null) gaps.push('Start date not given'); else gaps.push(`Can only start in about ${ad} days`);
  return { total, parts, rec, strengths, gaps };
}
/** Interview questions for the role, plus follow-ups on the gaps the AI found. */
export function interviewKit(role: string, gaps: string[]): string[] {
  const base: Record<string, string[]> = {
    'Sales staff': ['Tell me about a time you helped a customer choose between two products.', 'A customer wants a refund without a receipt. What do you do?', 'How do you explain hire purchase to a customer?', 'What would you do if your till was GHS 50 short at cash-up?'],
    Supervisor: ['How do you plan the shift when two staff call in sick?', 'A cashier keeps making voids. How do you handle it?', 'How do you check stock against the system?', 'Tell me about a team you led and a result you are proud of.'],
    Manager: ['How do you grow sales at a branch in a slow month?', 'How do you manage stock losses and damages?', 'Tell me about a difficult staff issue you resolved.', 'How do you read a daily sales report?'],
    Rider: ['How do you plan a route with five deliveries?', 'A customer is not home and not answering. What do you do?', 'How do you handle cash on delivery safely?', 'What checks do you do on your bike each morning?'],
    'Stock clerk': ['How do you receive a delivery against a purchase order?', 'What do you do when goods arrive damaged?', 'How do you run a stock count?', 'How do you keep the store room safe and tidy?'],
  };
  return [...(base[role] || base['Sales staff']), ...gaps.slice(0, 3).map((g) => `Follow up: ${g.replace(/\.$/, '')} — ask them to explain.`)];
}
export const SCORECARD = ['Customer service', 'Product knowledge', 'Honesty and handling cash', 'Communication', 'Fit with the team'];
/** Suggested starting pay inside the advert's range, from the AI score. */
export function offerAdvice(a: JobApp, j?: JobLite) {
  const lo = parseFloat(j?.salMin || '0') || 1800, hi = parseFloat(j?.salMax || '0') || lo; const s = aiScore(a, j).total;
  const pay = Math.round((lo + (hi - lo) * Math.max(0, Math.min(1, (s - 40) / 50))) / 50) * 50;
  const why = s >= 75 ? 'A strong match with the experience the role needs: offer near the top of the range to secure them.' : s >= 55 ? 'A reasonable match: start in the middle of the range and review after probation.' : 'Some gaps to close: start near the bottom of the range with a review after three months.';
  return { pay, why };
}
/** The offer letter, drafted from the job advert and the offer. */
export function offerLetter(company: string, a: JobApp, j: JobLite | undefined, pay: number, start: string, contract: string): string {
  const d = start ? new Date(start + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '[start date]';
  return `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

Dear ${a.name},

Offer of employment · ${j?.title || 'the role'}

Thank you for interviewing with ${company}. We are pleased to offer you the position of ${j?.title || 'the role'} at our ${j ? brName(j.br) : ''} branch.

• Start date: ${d}
• Contract: ${contract || j?.type || 'Full-time'}
• Monthly pay: GHS ${pay.toLocaleString('en-GB')} before SSNIT and PAYE
• Paid leave: 18 working days a year
• Probation: three months, with a review at the end

${j?.duties ? `Your main duties will include:\n${j.duties.split('\n').filter(Boolean).map((x) => `• ${x}`).join('\n')}\n\n` : ''}On your first day, please bring your Ghana Card, SSNIT number, TIN (if you have one), your MoMo or bank details and the name and phone number of your next of kin.

Please reply to accept this offer within 5 working days.

Yours sincerely,

For ${company}`;
}
/** A five-day first week for the role. */
export function firstWeekPlan(role: string): string[] {
  const till = role !== 'Rider' && role !== 'Stock clerk';
  return [
    'Day 1 · Welcome, contract, tour of the branch, meet the team, get the sign-in badge.',
    till ? 'Day 2 · Shadow a cashier: watch sales, refunds and parked sales; learn the products.' : role === 'Rider' ? 'Day 2 · Ride along on deliveries; learn the routes and the delivery app.' : 'Day 2 · Shadow receiving and stock counts.',
    till ? 'Day 3 · Serve customers with a supervisor beside you; do one of each till action.' : 'Day 3 · Do the work with a supervisor checking each task.',
    'Day 4 · Health, safety and fire exits; shop rules, breaks and leave.',
    'Day 5 · Review the week with the manager; set goals for the first month.',
  ];
}
/** Demo applications for the two sample jobs (store Careers page). */
export function seedApps(jobs: JobLite[]): JobApp[] {
  const j1 = jobs[0]?.id || 'j1', j2 = jobs[1]?.id || jobs[0]?.id || 'j2'; const t = Date.now(); const D = 864e5;
  const mk = (id: string, jobId: string, name: string, phone: string, town: string, exp: string, avail: string, note: string, docs: string[], stage: Stage, ago: number, extra: Partial<JobApp> = {}): JobApp => ({ id, jobId, name, phone, email: `${name.split(' ')[0].toLowerCase()}@gmail.com`, town, exp, avail, note, when: t - ago * D, docs: docs.map((d) => ({ name: d, file: `${d.split(' ')[0].toLowerCase()}-${name.split(' ')[0].toLowerCase()}.pdf` })), stage, history: [{ t: 'Applied on the online store', at: new Date(t - ago * D).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }], ...extra });
  return [
    mk('A-031', j1, 'Gifty Owusu', '+233 24 771 2290', 'Osu, Accra', '2', 'Immediately', 'Two years selling TVs and fridges at Melcom Achimota. Good with customers, cash and hire purchase forms.', ['CV / résumé', 'Ghana Card', 'Certificates'], 'new', 3),
    mk('A-030', j1, 'Samuel Tetteh', '+233 20 448 1102', 'Teshie, Accra', '1', '2 weeks', 'Worked as a sales attendant at a phone shop. I am honest and punctual.', ['CV / résumé'], 'new', 2),
    mk('A-029', j1, 'Esther Mensah', '+233 55 210 3391', 'Kumasi', '0', '1 month', 'Recent graduate looking for a first job in sales.', ['CV / résumé', 'Certificates'], 'shortlisted', 6),
    mk('A-028', j2, 'Kofi Asare', '+233 26 771 0042', 'East Legon, Accra', '3', 'Immediately', 'Three years delivering for a courier company, own licence and helmet, knows Accra routes well. Cash on delivery experience.', ['CV / résumé', 'Ghana Card', 'Driving licence'], 'interview', 9, { interview: { date: new Date(t + D).toISOString().slice(0, 10), time: '10:00', place: 'Osu branch, ask for the manager' } }),
    mk('A-027', j1, 'Abigail Boateng', '+233 24 990 1203', 'Osu, Accra', '4', 'Immediately', 'Four years selling electronics and appliances, top seller at my last shop, handles the till and stock counts.', ['CV / résumé', 'Ghana Card', 'Certificates', 'Reference letter'], 'offer', 14, { offer: { pay: 2300, start: new Date(t + 7 * D).toISOString().slice(0, 10), contract: 'Full-time' } }),
    mk('A-026', j2, 'Yaw Darko', '+233 54 112 7788', 'Tema', '0', '2 months', 'Looking for any job.', ['CV / résumé'], 'rejected', 20, { reason: 'No riding experience' }),
  ];
}

/* ======================================================================= payroll */

export const PAYE_KEY = 'ecompos.payeBands';
/** GRA monthly PAYE bands (width, rate), applied after the 5.5% employee SSNIT. Editable in Settings → Tax. */
export const BANDS0: [number, number][] = [[490, 0], [110, 0.05], [130, 0.1], [3166.67, 0.175], [16000, 0.25], [30520, 0.3], [Infinity, 0.35]];
/** PAYE on a taxable amount (verbatim loop). */
export function payeOn(taxable: number, bands: [number, number][] = BANDS0) { let left = taxable, tax = 0; for (const b of bands) { const part = Math.min(left, b[0]); if (part <= 0) break; tax += part * b[1]; left -= part; } return Math.round(tax * 100) / 100; }
/** Per-employee payslip details kept by HR (GTeam.md §5.3). */
export type PayMeta = { allow: number; other: number; loan: number; union: number; adv: number; tin: string; grade: string; type: string; bank: string; bankBr: string; acct: string; payDate: string };
export const META0: PayMeta = { allow: 0, other: 0, loan: 0, union: 0, adv: 0, tin: '', grade: 'G3', type: 'Permanent Staff (Full-time)', bank: '', bankBr: '', acct: '', payDate: '' };
export const META_KEY = 'ecompos.payMeta';
/** Hours on the time clock in the last 30 days. */
export const hours30 = (L: Clock[], name: string) => Math.round(L.filter((c) => c.name === name && c.inTs >= Date.now() - 30 * 864e5).reduce((a, c) => a + (c.mins || 0), 0) / 60 * 10) / 10;
/** Own till sales in the last 30 days (sales list: { staff, total, ts }). */
export const sales30 = (S: { staff: string; total: number; ts: number; status?: string }[], name: string) => S.filter((x) => String(x.staff || '').split(' (')[0] === name && x.ts >= Date.now() - 30 * 864e5 && x.status !== 'voided' && x.status !== 'cancelled').reduce((a, x) => a + (Number(x.total) || 0), 0);
/** Pay for a month (verbatim maths): overtime over 173 h at time-and-a-half; commission 1.5% of own till sales; SSNIT 5.5% of basic; PAYE on gross − SSNIT. */
export function calcPay(e: Emp, m: PayMeta, hours: number, sold: number, bands: [number, number][] = BANDS0) {
  const basic = e.basic;
  const ot = Math.round(Math.max(0, hours - 173) * (basic / 173) * 1.5 * 100) / 100;
  const comm = Math.round(sold * 0.015 * 100) / 100;
  const gross = Math.round((basic + ot + comm + m.allow + m.other) * 100) / 100;
  const ssnit = Math.round(basic * 0.055 * 100) / 100;
  const tax = payeOn(gross - ssnit, bands);
  const net = Math.round((gross - ssnit - tax - m.adv - m.loan - m.union) * 100) / 100;
  return { basic, ot, comm, allow: m.allow, other: m.other, gross, ssnit, taxable: Math.round((gross - ssnit) * 100) / 100, tax, adv: m.adv, loan: m.loan, union: m.union, net, employer: Math.round(basic * 0.13 * 100) / 100, hours };
}
export type PayCalc = ReturnType<typeof calcPay>;
/** A sent payslip: the full snapshot the employee opens in My HR. */
export type PaySnap = { name: string; empId: string; no: string; role: string; title: string; br: string; since: number; month: string; key: string; pay: PayCalc; meta: PayMeta; method: string; leaveLeft: number; company: Company; sent: string; ref: string };
export const SLIPS_KEY = 'ecompos.payslips';
/** Sent payslips: 'yyyy-mm' → employee name → snapshot. */
export type SlipMap = Record<string, Record<string, PaySnap>>;
export type Company = { name: string; addr: string; tel: string; email: string; tin: string };
export const CO_KEY = 'ecompos.payrollco';
export const PAPER_KEY = 'ecompos.payslipPaper';
export const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Default way someone is paid (verbatim): riders and sales staff by MTN MoMo, others by GCB bank. */
export const defaultMethod = (e: Emp) => e.pay || (e.level === 'Rider' || e.level === 'Sales staff' ? 'MoMo · MTN' : 'Bank · GCB');
/** Payslip reference PAY-GH-yyyymm + staff number digits. */
export const payRef = (key: string, no: string) => `PAY-GH-${key.replace('-', '')}${no.replace(/\D/g, '').slice(-4)}`;
export const branchesTxt = (n: number) => `${n} branch${n === 1 ? '' : 'es'}`;
export const BRANCH_IDS = BRS.map((b) => b.id);
