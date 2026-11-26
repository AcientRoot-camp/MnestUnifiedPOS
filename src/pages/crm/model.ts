// CRM data model (MNestPOS_CRM_Prompt.md §4, §8). One CRM, role-aware views.
// Reads the existing ecompos.* keys and never forks them; new data lives under ecompos.crm.*.
import { readKey, writeKey } from '../../lib/persist';
import { secLog } from '../../lib/sec';
import { CUSTOMERS, SALES, type Customer } from '../../data/sell';

export type CrmRole = 'superuser' | 'manager' | 'supervisor' | 'staff';
export const ROLE_NAME: Record<CrmRole, string> = { superuser: 'Admin', manager: 'Manager', supervisor: 'Supervisor', staff: 'Sales staff' };
export const BR: Record<string, string> = { osu: 'Osu', legon: 'East Legon', adum: 'Adum' };

/** Staff who own CRM records (same people as Staff & Users). */
export const STAFF: { name: string; role: CrmRole; br: string; team?: string }[] = [
  { name: 'Ebenezer Mensah', role: 'superuser', br: 'all' },
  { name: 'Ama Darko', role: 'manager', br: 'osu' },
  { name: 'Kwame Asante', role: 'supervisor', br: 'osu' },
  { name: 'Akua Kyei', role: 'staff', br: 'osu', team: 'Kwame Asante' },
  { name: 'Kwesi Ofori', role: 'staff', br: 'osu', team: 'Kwame Asante' },
  { name: 'Efua Sarpong', role: 'manager', br: 'legon' },
  { name: 'Nana Ampofo', role: 'supervisor', br: 'legon' },
  { name: 'Adjoa Badu', role: 'staff', br: 'legon', team: 'Nana Ampofo' },
  { name: 'Yaw Boakye', role: 'manager', br: 'adum' },
  { name: 'Abena Mensah', role: 'supervisor', br: 'adum' },
  { name: 'Kojo Appiah', role: 'staff', br: 'adum', team: 'Abena Mensah' },
];

/* ---------- Capability object (§4.2), like Expenses' mine / inbox / all / petty / set ---------- */
export type Caps = {
  overview: 'company' | 'branch' | 'team' | 'myday'; spend: 'full' | 'branch' | 'spend' | 'tier'; credit: 'all' | 'own';
  addLead: boolean; assign: 'anyone' | 'branch' | 'team' | 'self'; deals: 'all' | 'limit' | 'own'; closeDeal: 'yes' | 'request' | 'no';
  notes: boolean; message: 'any' | 'templates'; segmentSend: 'yes' | 'branch' | 'no'; segmentCreate: 'yes' | 'branch' | 'no';
  complaints: 'all' | 'first' | 'log'; escalate: boolean; gift: 'yes' | 'limit' | 'request'; loyaltyEdit: 'yes' | 'view' | 'no';
  journeys: 'build' | 'view' | 'no'; exportData: 'yes' | 'request' | 'no'; merge: 'yes' | 'request' | 'no'; del: boolean; settings: boolean;
  team: 'all' | 'branch' | 'team' | 'own';
};
export const CAPS0: Record<CrmRole, Caps> = {
  superuser: { overview: 'company', spend: 'full', credit: 'all', addLead: true, assign: 'anyone', deals: 'all', closeDeal: 'yes', notes: true, message: 'any', segmentSend: 'yes', segmentCreate: 'yes', complaints: 'all', escalate: true, gift: 'yes', loyaltyEdit: 'yes', journeys: 'build', exportData: 'yes', merge: 'yes', del: true, settings: true, team: 'all' },
  manager: { overview: 'branch', spend: 'branch', credit: 'all', addLead: true, assign: 'branch', deals: 'all', closeDeal: 'yes', notes: true, message: 'any', segmentSend: 'branch', segmentCreate: 'branch', complaints: 'all', escalate: true, gift: 'yes', loyaltyEdit: 'view', journeys: 'view', exportData: 'request', merge: 'request', del: false, settings: false, team: 'branch' },
  supervisor: { overview: 'team', spend: 'spend', credit: 'all', addLead: true, assign: 'team', deals: 'limit', closeDeal: 'request', notes: true, message: 'any', segmentSend: 'no', segmentCreate: 'no', complaints: 'first', escalate: true, gift: 'limit', loyaltyEdit: 'view', journeys: 'no', exportData: 'no', merge: 'no', del: false, settings: false, team: 'team' },
  staff: { overview: 'myday', spend: 'tier', credit: 'own', addLead: true, assign: 'self', deals: 'own', closeDeal: 'no', notes: true, message: 'templates', segmentSend: 'no', segmentCreate: 'no', complaints: 'log', escalate: true, gift: 'request', loyaltyEdit: 'no', journeys: 'no', exportData: 'no', merge: 'no', del: false, settings: false, team: 'own' },
};
export const capsOf = (role: CrmRole): Caps => ({ ...CAPS0[role], ...(readKey<Settings>(K.settings, SETTINGS0).caps?.[role] || {}) });

/* ---------- Keys ---------- */
export const K = {
  leads: 'ecompos.crm.leads', deals: 'ecompos.crm.deals', tasks: 'ecompos.crm.tasks', notes: 'ecompos.crm.notes', segments: 'ecompos.crm.segments',
  journeys: 'ecompos.crm.journeys', feedback: 'ecompos.crm.feedback', settings: 'ecompos.crm.settings', requests: 'ecompos.crm.requests',
  customers: 'ecompos.customers2',
} as const;

/* ---------- Entities (§8) ---------- */
export type Consent = { sms: boolean; whatsapp: boolean; email: boolean };
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
export type Lead = { id: string; name: string; phone: string; email: string; source: string; interest: string; estValue: number; branch: string; owner: string; status: LeadStatus; consent: Consent; createdBy: string; createdAt: number; lastContactAt: number; nextStepAt: number; nextStep: string; lostReason?: string };
export type Deal = { id: string; customerPhone: string; customer: string; title: string; value: number; stage: string; probability: number; owner: string; branch: string; linkedDocs: { type: string; no: string }[]; expectedClose: number; stageSince: number; nextFollowUp: number; lostReason?: string; items: { name: string; qty: number; price: number }[]; approval?: { requestedBy: string; status: 'pending' | 'approved' | 'rejected'; want: string } };
export type TaskType = 'Call' | 'WhatsApp' | 'SMS' | 'Email' | 'Visit' | 'Collect payment' | 'Deliver' | 'Feedback call';
export type Task = { id: string; type: TaskType; title: string; relatedTo: { kind: 'customer' | 'lead' | 'deal' | 'feedback'; id: string; name: string }; assignee: string; assignedBy: string; branch: string; dueAt: number; status: 'open' | 'done'; auto: boolean; source: string; doneAt?: number };
export type Note = { id: string; customerPhone: string; kind: 'note' | 'call' | 'visit' | 'message' | 'feedback' | 'system'; text: string; by: string; role: string; branch: string; at: number };
export type Rule = { field: string; op: string; value: string };
export type Segment = { id: string; name: string; scope: 'company' | 'branch'; branch: string; rules: Rule[]; createdBy: string; system?: boolean };
export type Step = { kind: 'trigger' | 'wait' | 'condition' | 'action'; text: string };
export type Journey = { id: string; name: string; trigger: string; steps: Step[]; active: boolean; channel: string; stats: { sent: number; converted: number; revenue: number }; byBranch: Record<string, { sent: number; converted: number }> };
export type Feedback = { id: string; customerPhone: string; customer: string; rating: number; comment: string; channel: string; branch: string; staff: string; kind: 'rating' | 'complaint'; category?: string; ticketId?: string; status: 'open' | 'in progress' | 'resolved'; slaDueAt: number; at: number; apology?: string; reviewId?: string };
export type ReqType = 'export' | 'merge' | 'close-deal' | 'gift' | 'segment-send' | 'loyalty';
export type CrmRequest = { id: string; type: ReqType; title: string; requestedBy: string; role: string; branch: string; payload: Record<string, unknown>; status: 'pending' | 'approved' | 'rejected'; decidedBy?: string; at: number; decidedAt?: number };
export type Settings = {
  stages: string[]; lostReasons: string[]; sources: string[]; assignment: 'round-robin' | 'category' | 'manual'; slaHours: { complaint: number; lead: number };
  health: { recency: number; spend: number; frequency: number; credit: number; satisfaction: number }; tags: string[];
  limits: { supDeal: number; supGift: number; mgrSegment: number }; templates: { id: string; name: string; text: string }[];
  caps?: Partial<Record<CrmRole, Partial<Caps>>>; retentionMonths: number;
  loyalty: { earnPer: number; burnPoints: number; burnValue: number; silver: number; gold: number; expiryMonths: number; referral: number; birthday: number; excluded: string[] };
};
export const SETTINGS0: Settings = {
  stages: ['New', 'Quote sent', 'Negotiating', 'Awaiting payment', 'Won', 'Lost'],
  lostReasons: ['Price too high', 'Bought elsewhere', 'Out of stock', 'No budget', 'No response', 'Changed mind'],
  sources: ['Walk-in', 'Website', 'WhatsApp', 'Phone', 'Pro-forma request', 'Hire-purchase application', 'Referral'],
  assignment: 'round-robin', slaHours: { complaint: 24, lead: 24 },
  health: { recency: 35, spend: 25, frequency: 20, credit: 10, satisfaction: 10 },
  tags: ['VIP', 'Wholesale', 'School', 'Church', 'Hire purchase', 'Credit customer', 'Birthday soon'],
  limits: { supDeal: 5000, supGift: 100, mgrSegment: 200 },
  templates: [
    { id: 't1', name: 'Thank you for visiting', text: 'Hello {first}, thank you for shopping with Ebenezer Unique Ventures today. Reply STOP to opt out.' },
    { id: 't2', name: 'Follow-up on your enquiry', text: 'Hello {first}, this is {staff} from Ebenezer Unique Ventures {branch}. Following up on the {interest} you asked about. Reply STOP to opt out.' },
    { id: 't3', name: 'Your order is ready', text: 'Hello {first}, your order is ready to collect at our {branch} branch. Reply STOP to opt out.' },
    { id: 't4', name: 'Payment reminder', text: 'Hello {first}, a friendly reminder that your balance with Ebenezer Unique Ventures is due soon. Thank you.' },
  ],
  retentionMonths: 84,
  loyalty: { earnPer: 10, burnPoints: 100, burnValue: 5, silver: 2000, gold: 5000, expiryMonths: 12, referral: 20, birthday: 20, excluded: [] },
};

/* ---------- Helpers ---------- */
const DAY = 864e5;
export const now = () => Date.now();
export const uid = (p: string) => p + '-' + Date.now().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 90 + 10);
export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtShort = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtWhen = (ts: number) => { const d = new Date(ts); const t = new Date(); const y = new Date(Date.now() - DAY); const hm = d.toTimeString().slice(0, 5); return d.toDateString() === t.toDateString() ? `Today ${hm}` : d.toDateString() === y.toDateString() ? `Yesterday ${hm}` : `${fmtShort(ts)} ${hm}`; };
export const daysAgo = (ts: number) => Math.floor((Date.now() - ts) / DAY);
export const phoneKey = (p: string) => p.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '').slice(-9);
export const fmtPhone = (p: string) => { const d = phoneKey(p); return d.length === 9 ? `+233 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : p; };
export const firstName = (n: string) => n.split(' ')[0];
export const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString();
export const isOverdue = (t: Task) => t.status === 'open' && t.dueAt < new Date().setHours(0, 0, 0, 0);
const safeRead = <T,>(k: string, d: T): T => { try { return readKey<T>(k, d); } catch { return d; } };
const safeWrite = (k: string, v: unknown) => { try { writeKey(k, v); } catch { /* storage blocked */ } };

/** Who is signed in and what they may see. */
export type Ctx = { role: CrmRole; me: string; br: string; caps: Caps; team: string[] };
export function ctxOf(role: string, me: string, br: string): Ctx {
  const r = (['superuser', 'manager', 'supervisor', 'staff'].includes(role) ? role : 'staff') as CrmRole;
  return { role: r, me, br: br || 'osu', caps: capsOf(r), team: STAFF.filter((s) => s.team === me).map((s) => s.name).concat(me) };
}
/** §8 filtering rule: filter by branch (Manager/Supervisor) or by owner (Sales staff) BEFORE rendering. */
export function scoped<T extends { branch?: string; owner?: string; assignee?: string; staff?: string }>(list: T[], c: Ctx, viewBranch = 'all'): T[] {
  if (c.role === 'superuser') return viewBranch === 'all' ? list : list.filter((x) => x.branch === viewBranch);
  if (c.role === 'staff') return list.filter((x) => (x.owner ?? x.assignee ?? x.staff) === c.me);
  return list.filter((x) => x.branch === c.br);
}
export const staffIn = (c: Ctx) => (c.role === 'superuser' ? STAFF.filter((s) => s.role !== 'superuser') : c.role === 'manager' ? STAFF.filter((s) => s.br === c.br && s.role !== 'manager') : c.role === 'supervisor' ? STAFF.filter((s) => s.team === c.me) : STAFF.filter((s) => s.name === c.me));
/** People this person may assign work to (§4.2 "Assign / reassign"). */
export const assignable = (c: Ctx) => (c.caps.assign === 'anyone' ? STAFF.filter((s) => s.role !== 'superuser') : c.caps.assign === 'branch' ? STAFF.filter((s) => s.br === c.br) : c.caps.assign === 'team' ? STAFF.filter((s) => s.team === c.me || s.name === c.me) : STAFF.filter((s) => s.name === c.me));

/* ---------- Customers (read the existing key; never fork it) ---------- */
export const customers = () => safeRead<Customer[]>(K.customers, CUSTOMERS);
export const customerByPhone = (p: string) => customers().find((c) => phoneKey(c.phone) === phoneKey(p));
export const owesOf = (c: Customer) => c.credits.reduce((a, k) => a + Math.max(0, k.total - k.paid), 0);
export function spendOf(c: Customer) { const s = SALES.filter((x) => x.cust === c.name); return { total: s.reduce((a, x) => a + x.total, 0), count: s.length, last: s.length ? Math.max(...s.map((x) => x.ts)) : 0 }; }
export type Life = 'New' | 'Active' | 'Loyal' | 'At risk' | 'Lapsed';
export function lifecycle(c: Customer): Life {
  const s = spendOf(c); const d = s.last ? daysAgo(s.last) : 999; const sinceMonths = Math.max(0, (Date.now() - new Date('1 ' + c.since).getTime()) / (30 * DAY));
  if (sinceMonths < 2) return 'New';
  if (d > 90) return 'Lapsed';
  if (d > 45) return 'At risk';
  return c.tier === 'Gold' || s.count >= 6 ? 'Loyal' : 'Active';
}
/** Health 0–100 with a plain-language reason (weights from CRM settings). */
export function health(c: Customer): { score: number; why: string } {
  const W = safeRead<Settings>(K.settings, SETTINGS0).health; const s = spendOf(c); const d = s.last ? daysAgo(s.last) : 120;
  const fb = safeRead<Feedback[]>(K.feedback, []).filter((f) => phoneKey(f.customerPhone) === phoneKey(c.phone));
  const avg = fb.length ? fb.reduce((a, f) => a + f.rating, 0) / fb.length : 4;
  const parts = { recency: Math.max(0, 1 - d / 90), spend: Math.min(1, s.total / 5000), frequency: Math.min(1, s.count / 8), credit: owesOf(c) > c.limit * 0.8 ? 0 : owesOf(c) > 0 ? 0.6 : 1, satisfaction: avg / 5 };
  const tot = W.recency + W.spend + W.frequency + W.credit + W.satisfaction || 1;
  const score = Math.round(((parts.recency * W.recency + parts.spend * W.spend + parts.frequency * W.frequency + parts.credit * W.credit + parts.satisfaction * W.satisfaction) / tot) * 100);
  const why = d > 45 ? `No purchase for ${d} days` : owesOf(c) > c.limit * 0.8 ? 'Credit close to the limit' : avg < 3 ? 'Recent low ratings' : s.count >= 6 ? 'Buys often and recently' : 'Bought recently';
  return { score, why };
}

/* ---------- Requests → Approvals, and audit ---------- */
export function request(type: ReqType, title: string, c: Ctx, payload: Record<string, unknown> = {}) {
  const r: CrmRequest = { id: uid('CRQ'), type, title, requestedBy: c.me, role: ROLE_NAME[c.role], branch: c.role === 'superuser' ? 'all' : c.br, payload, status: 'pending', at: now() };
  safeWrite(K.requests, [r, ...safeRead<CrmRequest[]>(K.requests, [])]);
  audit(c, 'CRM request', `${title} · sent to Approvals`);
  return r;
}
export const audit = (c: Ctx, type: string, detail: string) => { try { secLog(type, `${c.me} (${ROLE_NAME[c.role]}) · ${detail}`, 'low', c.me); } catch { /* logging is best-effort */ } };
/** Message log: every CRM send appears in Messages, tagged with sender and role. Consent is checked by the caller. */
export function logMessage(c: Ctx, via: string, to: string, text: string, n = 1, kind = 'CRM') {
  const out = safeRead<unknown[]>('ecompos.smsOutbox', []);
  safeWrite('ecompos.smsOutbox', [{ at: fmtWhen(now()), by: `${c.me} · ${ROLE_NAME[c.role]}`, via, to, n, kind, text, status: 'Sent' }, ...out]);
}
export function addNote(c: Ctx, customerPhone: string, kind: Note['kind'], text: string) {
  const n: Note = { id: uid('N'), customerPhone, kind, text, by: c.me, role: ROLE_NAME[c.role], branch: c.role === 'superuser' ? 'all' : c.br, at: now() };
  safeWrite(K.notes, [n, ...safeRead<Note[]>(K.notes, [])]);
  return n;
}
export function fillTemplate(t: string, v: { first?: string; staff?: string; branch?: string; interest?: string }) {
  return t.replace('{first}', v.first || 'there').replace('{staff}', v.staff || 'our team').replace('{branch}', v.branch || '').replace('{interest}', v.interest || 'item');
}

/* ---------- Segments: live counts ---------- */
export const RULE_FIELDS: [string, string, string[]][] = [
  ['tier', 'Tier', ['Gold', 'Silver', 'Bronze']], ['group', 'Group', ['Retail', 'Wholesale', 'Staff']], ['lifecycle', 'Lifecycle', ['New', 'Active', 'Loyal', 'At risk', 'Lapsed']],
  ['owes', 'Owes money', ['Yes', 'No']], ['whatsapp', 'Opted in to WhatsApp', ['Yes', 'No']], ['sms', 'Opted in to SMS', ['Yes', 'No']], ['branch', 'Branch', ['osu', 'legon', 'adum']],
  ['lastBuy', 'Last purchase over (days)', ['30', '45', '60', '90']], ['hp', 'Hire purchase', ['Yes', 'No']], ['birthday', 'Birthday this month', ['Yes', 'No']],
];
export function matches(c: Customer, rules: Rule[]) {
  return rules.every((r) => {
    const s = spendOf(c);
    switch (r.field) {
      case 'tier': return c.tier === r.value;
      case 'group': return c.group === r.value;
      case 'lifecycle': return lifecycle(c) === r.value;
      case 'owes': return (owesOf(c) > 0) === (r.value === 'Yes');
      case 'whatsapp': return c.whatsapp === (r.value === 'Yes');
      case 'sms': return c.sms === (r.value === 'Yes');
      case 'branch': return c.br === r.value;
      case 'lastBuy': return (s.last ? daysAgo(s.last) : 999) > Number(r.value);
      case 'hp': return (['Ama Owusu', 'Comfort Nyarko', 'Kwame Ntim'].includes(c.name)) === (r.value === 'Yes');
      case 'birthday': return (!!c.birthday && new Date(c.birthday).getMonth() === new Date().getMonth()) === (r.value === 'Yes');
      default: return true;
    }
  });
}

/* ---------- Seed data (first load), with records for every demo user ---------- */
function seed() {
  const t = now(); const d = (n: number, h = 10) => new Date(new Date().setHours(h, 0, 0, 0)).getTime() + n * DAY;
  const C: Consent = { sms: true, whatsapp: true, email: false };
  const leads: Lead[] = [
    { id: 'LD-1101', name: 'Abena Owusu', phone: '+233 24 312 7781', email: '', source: 'Walk-in', interest: 'Bruhm 300L Chest Freezer', estValue: 5499, branch: 'osu', owner: 'Akua Kyei', status: 'New', consent: C, createdBy: 'Akua Kyei', createdAt: t - 0.2 * DAY, lastContactAt: t - 0.2 * DAY, nextStepAt: d(0, 16), nextStep: 'Call with the freezer price' },
    { id: 'LD-1102', name: 'Kofi Mensah', phone: '+233 20 445 9012', email: 'kofi.m@gmail.com', source: 'WhatsApp', interest: 'Hisense 43" Smart TV', estValue: 3650, branch: 'osu', owner: 'Kwesi Ofori', status: 'Contacted', consent: C, createdBy: 'Kwesi Ofori', createdAt: t - 2 * DAY, lastContactAt: t - 1 * DAY, nextStepAt: d(1), nextStep: 'Send the TV photos on WhatsApp' },
    { id: 'LD-1103', name: 'Grace Church Osu', phone: '+233 20 300 1122', email: 'office@gracechurch.org', source: 'Pro-forma request', interest: 'Standing fans × 20', estValue: 9000, branch: 'osu', owner: 'Kwame Asante', status: 'Qualified', consent: { sms: false, whatsapp: false, email: true }, createdBy: 'Ama Darko', createdAt: t - 4 * DAY, lastContactAt: t - 3 * DAY, nextStepAt: d(0, 14), nextStep: 'Send the pro-forma' },
    { id: 'LD-1104', name: 'Yaa Asantewaa', phone: '+233 27 664 1209', email: '', source: 'Hire-purchase application', interest: 'TCL 43" 4K UHD Google TV', estValue: 4999, branch: 'osu', owner: '', status: 'New', consent: C, createdBy: 'Website', createdAt: t - 1.5 * DAY, lastContactAt: t - 1.5 * DAY, nextStepAt: d(0), nextStep: 'Assign and call' },
    { id: 'LD-1105', name: 'Efo Kwasi Agbeko', phone: '+233 24 909 3341', email: '', source: 'Website', interest: 'DStv HD Decoder & Dish Kit', estValue: 899, branch: 'osu', owner: '', status: 'New', consent: C, createdBy: 'Website', createdAt: t - 1.2 * DAY, lastContactAt: t - 1.2 * DAY, nextStepAt: d(0), nextStep: 'Assign and call' },
    { id: 'LD-1106', name: 'Akosua Frimpong', phone: '+233 55 772 1180', email: '', source: 'Referral', interest: 'Binatone 16" Standing Fan', estValue: 450, branch: 'osu', owner: 'Akua Kyei', status: 'Converted', consent: C, createdBy: 'Akua Kyei', createdAt: t - 9 * DAY, lastContactAt: t - 6 * DAY, nextStepAt: d(-6), nextStep: 'Done' },
    { id: 'LD-1107', name: 'Mercy Hospital', phone: '+233 30 244 9910', email: 'accounts@mercy.org', source: 'Phone', interest: 'Split air conditioners for the wards', estValue: 42000, branch: 'legon', owner: 'Adjoa Badu', status: 'Qualified', consent: { sms: false, whatsapp: false, email: true }, createdBy: 'Efua Sarpong', createdAt: t - 5 * DAY, lastContactAt: t - 2 * DAY, nextStepAt: d(1), nextStep: 'Confirm quantities' },
    { id: 'LD-1108', name: 'Selorm Dzokoto', phone: '+233 24 118 6602', email: '', source: 'Walk-in', interest: 'Nasco 32" HD LED TV', estValue: 1850, branch: 'legon', owner: 'Nana Ampofo', status: 'Contacted', consent: C, createdBy: 'Nana Ampofo', createdAt: t - 3 * DAY, lastContactAt: t - 3 * DAY, nextStepAt: d(-1), nextStep: 'Call back' },
    { id: 'LD-1109', name: 'Kumasi Royal Hotel', phone: '+233 32 202 4411', email: 'procure@krh.com.gh', source: 'Pro-forma request', interest: 'Chest freezers × 3', estValue: 16497, branch: 'adum', owner: 'Abena Mensah', status: 'Qualified', consent: { sms: false, whatsapp: true, email: true }, createdBy: 'Yaw Boakye', createdAt: t - 8 * DAY, lastContactAt: t - 8 * DAY, nextStepAt: d(-2), nextStep: 'Chase the quote' },
    { id: 'LD-1110', name: 'Owusu Osei', phone: '+233 20 776 4410', email: '', source: 'Walk-in', interest: 'Binatone 16" Standing Fan', estValue: 450, branch: 'adum', owner: 'Kojo Appiah', status: 'Lost', consent: C, createdBy: 'Kojo Appiah', createdAt: t - 12 * DAY, lastContactAt: t - 10 * DAY, nextStepAt: d(-10), nextStep: '—', lostReason: 'Bought elsewhere' },
    { id: 'LD-1111', name: 'Esi Quansah', phone: '+233 24 555 0192', email: '', source: 'Walk-in', interest: 'Samsung 384L Twin Cooling Fridge', estValue: 11999, branch: 'osu', owner: 'Akua Kyei', status: 'New', consent: C, createdBy: 'Akua Kyei', createdAt: t - 0.1 * DAY, lastContactAt: t - 0.1 * DAY, nextStepAt: d(1), nextStep: 'Explain hire purchase' },
  ];
  const deals: Deal[] = [
    { id: 'DL-301', customerPhone: '+233 30 222 1100', customer: 'Accra Royal School', title: 'Air conditioners for the classrooms', value: 73788, stage: 'Negotiating', probability: 60, owner: 'Ama Darko', branch: 'osu', linkedDocs: [{ type: 'Pro-forma', no: 'PF-OSU-0231' }], expectedClose: d(6), stageSince: t - 4 * DAY, nextFollowUp: d(1), items: [{ name: 'Nasco 1.5HP Split Air Conditioner', qty: 6, price: 5299 }, { name: 'TCL 1.5HP Inverter Split Air Conditioner', qty: 6, price: 6999 }] },
    { id: 'DL-302', customerPhone: '+233 20 300 1122', customer: 'Grace Church Osu', title: '20 standing fans', value: 9000, stage: 'Quote sent', probability: 40, owner: 'Kwame Asante', branch: 'osu', linkedDocs: [{ type: 'Pro-forma', no: 'PF-LEG-0228' }], expectedClose: d(10), stageSince: t - 9 * DAY, nextFollowUp: d(-1), items: [{ name: 'Binatone 16" Standing Fan', qty: 20, price: 450 }] },
    { id: 'DL-303', customerPhone: '+233 24 312 7781', customer: 'Abena Owusu', title: 'Chest freezer for her shop', value: 5499, stage: 'New', probability: 20, owner: 'Akua Kyei', branch: 'osu', linkedDocs: [], expectedClose: d(14), stageSince: t - 0.2 * DAY, nextFollowUp: d(0, 16), items: [{ name: 'Bruhm 300L Chest Freezer', qty: 1, price: 5499 }] },
    { id: 'DL-304', customerPhone: '+233 24 555 0142', customer: 'Ama Owusu', title: 'TCL 43" TV on hire purchase', value: 4999, stage: 'Awaiting payment', probability: 85, owner: 'Akua Kyei', branch: 'osu', linkedDocs: [{ type: 'Hire-purchase agreement', no: 'HP-2607-0011' }], expectedClose: d(2), stageSince: t - 2 * DAY, nextFollowUp: d(1), items: [{ name: 'TCL 43" 4K UHD Google TV', qty: 1, price: 4999 }] },
    { id: 'DL-305', customerPhone: '+233 20 445 9012', customer: 'Kofi Mensah', title: 'Hisense TV', value: 3650, stage: 'Quote sent', probability: 40, owner: 'Kwesi Ofori', branch: 'osu', linkedDocs: [], expectedClose: d(5), stageSince: t - 1 * DAY, nextFollowUp: d(1), items: [{ name: 'Hisense 43" Smart TV', qty: 1, price: 3650 }] },
    { id: 'DL-306', customerPhone: '+233 30 244 9910', customer: 'Mercy Hospital', title: 'Fridges and fans for the staff rooms', value: 27794, stage: 'Negotiating', probability: 55, owner: 'Adjoa Badu', branch: 'legon', linkedDocs: [{ type: 'Invoice', no: 'INV-OSU-1189' }], expectedClose: d(4), stageSince: t - 6 * DAY, nextFollowUp: d(-1), items: [{ name: 'Nasco 138L Single-Door Fridge', qty: 6, price: 2899 }, { name: 'Nasco 18" Wall Fan', qty: 20, price: 520 }] },
    { id: 'DL-307', customerPhone: '+233 26 304 9921', customer: 'Yaw Owusu-Ansah', title: 'Air conditioner for the office', value: 46800, stage: 'Won', probability: 100, owner: 'Efua Sarpong', branch: 'legon', linkedDocs: [{ type: 'Invoice', no: 'INV-OSU-1190' }], expectedClose: d(-3), stageSince: t - 3 * DAY, nextFollowUp: d(20), items: [{ name: 'Midea 2HP Split Air Conditioner', qty: 6, price: 7800 }] },
    { id: 'DL-308', customerPhone: '+233 32 202 4411', customer: 'Kumasi Royal Hotel', title: '3 chest freezers', value: 16497, stage: 'Quote sent', probability: 40, owner: 'Abena Mensah', branch: 'adum', linkedDocs: [{ type: 'Pro-forma', no: 'PF-ADM-0044' }], expectedClose: d(9), stageSince: t - 8 * DAY, nextFollowUp: d(-2), items: [{ name: 'Bruhm 300L Chest Freezer', qty: 3, price: 5499 }] },
    { id: 'DL-309', customerPhone: '+233 55 210 6618', customer: 'Comfort Nyarko', title: 'Fridges and a freezer for the shop', value: 58788, stage: 'Awaiting payment', probability: 80, owner: 'Yaw Boakye', branch: 'adum', linkedDocs: [{ type: 'Contract', no: 'CT-0012' }], expectedClose: d(3), stageSince: t - 1 * DAY, nextFollowUp: d(1), items: [{ name: 'Hisense 205L Double-Door Fridge', qty: 6, price: 4299 }, { name: 'Bruhm 300L Chest Freezer', qty: 6, price: 5499 }] },
    { id: 'DL-310', customerPhone: '+233 20 776 4410', customer: 'Owusu Osei', title: 'Standing fan', value: 450, stage: 'Lost', probability: 0, owner: 'Kojo Appiah', branch: 'adum', linkedDocs: [], expectedClose: d(-10), stageSince: t - 10 * DAY, nextFollowUp: d(-10), lostReason: 'Bought elsewhere', items: [{ name: 'Binatone 16" Standing Fan', qty: 1, price: 450 }] },
  ];
  const T = (id: string, type: TaskType, title: string, rel: Task['relatedTo'], assignee: string, by: string, branch: string, due: number, auto = false, source = 'Manual', status: Task['status'] = 'open'): Task => ({ id, type, title, relatedTo: rel, assignee, assignedBy: by, branch, dueAt: due, status, auto, source });
  const tasks: Task[] = [
    T('TK-501', 'Call', 'Call Abena with the freezer price', { kind: 'lead', id: 'LD-1101', name: 'Abena Owusu' }, 'Akua Kyei', 'Akua Kyei', 'osu', d(0, 16)),
    T('TK-502', 'WhatsApp', 'Send Ama the TV instalment plan', { kind: 'deal', id: 'DL-304', name: 'Ama Owusu' }, 'Akua Kyei', 'Kwame Asante', 'osu', d(0, 11)),
    T('TK-503', 'Collect payment', 'Mansa Boateng · credit balance due', { kind: 'customer', id: '+233 24 771 0093', name: 'Mansa Boateng' }, 'Akua Kyei', 'System', 'osu', d(-1), true, 'Credit due date'),
    T('TK-504', 'Feedback call', 'Ask Esi Mensah how the blender is working', { kind: 'customer', id: '+233 24 555 0192', name: 'Esi Mensah' }, 'Kwesi Ofori', 'System', 'osu', d(0, 15), true, 'Rating after delivery'),
    T('TK-505', 'Call', 'Kofi Mensah · TV photos sent, call back', { kind: 'lead', id: 'LD-1102', name: 'Kofi Mensah' }, 'Kwesi Ofori', 'Kwesi Ofori', 'osu', d(-2)),
    T('TK-506', 'Email', 'Send Grace Church the pro-forma', { kind: 'deal', id: 'DL-302', name: 'Grace Church Osu' }, 'Kwame Asante', 'Ama Darko', 'osu', d(0, 14)),
    T('TK-507', 'Visit', 'Accra Royal School · meet the bursar', { kind: 'deal', id: 'DL-301', name: 'Accra Royal School' }, 'Ama Darko', 'Ama Darko', 'osu', d(1, 9)),
    T('TK-508', 'WhatsApp', 'Birthday offer for Esi Mensah', { kind: 'customer', id: '+233 24 555 0192', name: 'Esi Mensah' }, 'Akua Kyei', 'System', 'osu', d(2), true, 'Birthday'),
    T('TK-509', 'Call', 'Win-back call · Mansa Boateng', { kind: 'customer', id: '+233 24 771 0093', name: 'Mansa Boateng' }, 'Kwesi Ofori', 'System', 'osu', d(-3), true, 'Win-back after 60 days'),
    T('TK-510', 'Collect payment', 'HP instalment 5 · Ama Owusu', { kind: 'customer', id: '+233 24 555 0142', name: 'Ama Owusu' }, 'Kwame Asante', 'System', 'osu', d(0, 12), true, 'Hire-purchase instalment'),
    T('TK-511', 'Call', 'Unanswered complaint · Kwame Ntim', { kind: 'feedback', id: 'FB-704', name: 'Kwame Ntim' }, 'Nana Ampofo', 'System', 'legon', d(-1), true, 'Unanswered complaint'),
    T('TK-512', 'Call', 'Mercy Hospital · confirm quantities', { kind: 'deal', id: 'DL-306', name: 'Mercy Hospital' }, 'Adjoa Badu', 'Efua Sarpong', 'legon', d(1)),
    T('TK-513', 'Call', 'Kumasi Royal Hotel · chase the quote', { kind: 'deal', id: 'DL-308', name: 'Kumasi Royal Hotel' }, 'Abena Mensah', 'Yaw Boakye', 'adum', d(-2)),
    T('TK-514', 'Deliver', 'Deliver the fridges and freezer to Comfort Nyarko', { kind: 'deal', id: 'DL-309', name: 'Comfort Nyarko' }, 'Kojo Appiah', 'Yaw Boakye', 'adum', d(1)),
    T('TK-515', 'SMS', 'Thank Akosua for the referral', { kind: 'lead', id: 'LD-1106', name: 'Akosua Frimpong' }, 'Akua Kyei', 'Akua Kyei', 'osu', d(-5), false, 'Manual', 'done'),
    T('TK-516', 'Call', 'Kwesi · six overdue follow-ups review', { kind: 'customer', id: '+233 20 118 4471', name: 'Kwame Ntim' }, 'Kwesi Ofori', 'Kwame Asante', 'osu', d(-4)),
  ];
  const notes: Note[] = [
    { id: 'N-1', customerPhone: '+233 24 555 0142', kind: 'call', text: 'Promised to call about the fridge after payday (25th).', by: 'Akua Kyei', role: 'Sales staff', branch: 'osu', at: t - 2 * DAY },
    { id: 'N-2', customerPhone: '+233 30 222 1100', kind: 'visit', text: 'Bursar wants delivery before the term starts. Asked for 5% off on 20 bags.', by: 'Ama Darko', role: 'Manager', branch: 'osu', at: t - 4 * DAY },
    { id: 'N-3', customerPhone: '+233 24 771 0093', kind: 'note', text: 'Prefers WhatsApp. Pays on Fridays.', by: 'Kwesi Ofori', role: 'Sales staff', branch: 'osu', at: t - 7 * DAY },
  ];
  const segments: Segment[] = [
    { id: 'SG-1', name: 'VIP · Gold', scope: 'company', branch: 'all', rules: [{ field: 'tier', op: 'is', value: 'Gold' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-2', name: 'At risk', scope: 'company', branch: 'all', rules: [{ field: 'lifecycle', op: 'is', value: 'At risk' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-3', name: 'Lapsed 60+ days', scope: 'company', branch: 'all', rules: [{ field: 'lastBuy', op: 'over', value: '60' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-4', name: 'New this month', scope: 'company', branch: 'all', rules: [{ field: 'lifecycle', op: 'is', value: 'New' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-5', name: 'Wholesale', scope: 'company', branch: 'all', rules: [{ field: 'group', op: 'is', value: 'Wholesale' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-6', name: 'Credit customers who owe', scope: 'company', branch: 'all', rules: [{ field: 'owes', op: 'is', value: 'Yes' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-7', name: 'Hire-purchase customers', scope: 'company', branch: 'all', rules: [{ field: 'hp', op: 'is', value: 'Yes' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-8', name: 'Birthdays this month', scope: 'company', branch: 'all', rules: [{ field: 'birthday', op: 'is', value: 'Yes' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-9', name: 'Opted in to WhatsApp', scope: 'company', branch: 'all', rules: [{ field: 'whatsapp', op: 'is', value: 'Yes' }], createdBy: 'Ebenezer Mensah', system: true },
    { id: 'SG-10', name: 'Osu Gold on WhatsApp', scope: 'branch', branch: 'osu', rules: [{ field: 'branch', op: 'is', value: 'osu' }, { field: 'tier', op: 'is', value: 'Gold' }, { field: 'whatsapp', op: 'is', value: 'Yes' }], createdBy: 'Ama Darko' },
  ];
  const J = (id: string, name: string, trigger: string, channel: string, steps: Step[], active: boolean, stats: Journey['stats']): Journey => ({ id, name, trigger, channel, steps, active, stats, byBranch: { osu: { sent: Math.round(stats.sent * 0.45), converted: Math.round(stats.converted * 0.5) }, legon: { sent: Math.round(stats.sent * 0.3), converted: Math.round(stats.converted * 0.28) }, adum: { sent: Math.round(stats.sent * 0.25), converted: Math.round(stats.converted * 0.22) } } });
  const journeys: Journey[] = [
    J('JR-1', 'Birthday offer on WhatsApp', 'Customer birthday', 'WhatsApp Business +233 24 000 1111', [{ kind: 'trigger', text: '3 days before the customer’s birthday' }, { kind: 'condition', text: 'Opted in to WhatsApp' }, { kind: 'action', text: 'Send a GHS 20 birthday voucher on WhatsApp' }, { kind: 'wait', text: 'Wait 7 days' }, { kind: 'condition', text: 'Voucher not used' }, { kind: 'action', text: 'Create a follow-up call for the owner' }], true, { sent: 64, converted: 21, revenue: 7340 }),
    J('JR-2', 'Win-back after 60 days', 'No purchase for 60 days', 'SMS · sender ID EBENEZERUV', [{ kind: 'trigger', text: 'No purchase for 60 days' }, { kind: 'condition', text: 'Opted in to SMS' }, { kind: 'action', text: 'Send a 10% code by SMS (Reply STOP to opt out)' }, { kind: 'wait', text: 'Wait 14 days' }, { kind: 'condition', text: 'Still no purchase' }, { kind: 'action', text: 'Create a win-back call for the owner' }], true, { sent: 112, converted: 18, revenue: 5120 }),
    J('JR-3', 'Referral reward', 'A referred friend buys', 'SMS · sender ID EBENEZERUV', [{ kind: 'trigger', text: 'A new customer names a referrer' }, { kind: 'wait', text: 'Wait until their first purchase' }, { kind: 'action', text: 'Give both a GHS 20 voucher' }], false, { sent: 0, converted: 0, revenue: 0 }),
    J('JR-4', 'Rating after delivery', 'Order delivered', 'SMS · sender ID EBENEZERUV', [{ kind: 'trigger', text: 'Delivery confirmed by the rider' }, { kind: 'wait', text: 'Wait 2 hours' }, { kind: 'action', text: 'Ask for a 1–5 rating by SMS' }, { kind: 'condition', text: 'Rating is 2 or less' }, { kind: 'action', text: 'Open a complaint and alert the supervisor' }], true, { sent: 238, converted: 141, revenue: 0 }),
    J('JR-5', 'Abandoned basket reminder', 'Basket left on the website', 'Email · hello@ebenezerunique.com.gh', [{ kind: 'trigger', text: 'Basket left for 4 hours' }, { kind: 'condition', text: 'Opted in to email' }, { kind: 'action', text: 'Send a reminder email with the basket' }, { kind: 'wait', text: 'Wait 1 day' }, { kind: 'action', text: 'Send a WhatsApp reminder if opted in' }], true, { sent: 47, converted: 9, revenue: 4880 }),
  ];
  const F = (id: string, p: string, name: string, rating: number, comment: string, channel: string, branch: string, staff: string, kind: Feedback['kind'], hoursAgo: number, status: Feedback['status'] = 'resolved', category?: string): Feedback => ({ id, customerPhone: p, customer: name, rating, comment, channel, branch, staff, kind, category, status, at: t - hoursAgo * 36e5, slaDueAt: t - hoursAgo * 36e5 + 24 * 36e5 });
  const feedback: Feedback[] = [
    F('FB-701', '+233 24 555 0142', 'Ama Owusu', 5, 'Akua explained hire purchase very clearly.', 'Till', 'osu', 'Akua Kyei', 'rating', 30),
    F('FB-702', '+233 24 771 0093', 'Mansa Boateng', 2, 'Waited 25 minutes at the till on Saturday.', 'Till', 'osu', 'Kwesi Ofori', 'complaint', 30, 'open', 'Waiting time'),
    F('FB-703', '+233 24 555 0192', 'Esi Mensah', 4, 'Delivery was on time.', 'Delivery', 'osu', 'Kwesi Ofori', 'rating', 50),
    F('FB-704', '+233 20 118 4471', 'Kwame Ntim', 1, 'Wall fan stopped working after 3 days.', 'Phone', 'legon', 'Adjoa Badu', 'complaint', 40, 'open', 'Faulty product'),
    F('FB-705', '+233 26 304 9921', 'Yaw Owusu-Ansah', 5, 'Good wholesale price.', 'Till', 'legon', 'Efua Sarpong', 'rating', 70),
    F('FB-706', '+233 55 302 7781', 'Nana Yeboah', 3, 'Rider could not find the house.', 'Delivery', 'adum', 'Kojo Appiah', 'complaint', 20, 'in progress', 'Delivery'),
    F('FB-707', '+233 55 210 6618', 'Comfort Nyarko', 4, 'Quick service.', 'Till', 'adum', 'Abena Mensah', 'rating', 90),
    F('FB-708', '+233 30 222 1100', 'Accra Royal School', 5, 'Ama sorted our invoice fast.', 'Phone', 'osu', 'Ama Darko', 'rating', 100),
    F('FB-709', '+233 24 312 7781', 'Abena Owusu', 2, 'The price on the shelf was different from the till.', 'Till', 'osu', 'Akua Kyei', 'complaint', 6, 'open', 'Pricing'),
  ];
  const requests: CrmRequest[] = [
    { id: 'CRQ-1', type: 'export', title: 'Export Osu customer list (CSV)', requestedBy: 'Ama Darko', role: 'Manager', branch: 'osu', payload: { rows: 6 }, status: 'pending', at: t - 5 * 36e5 },
    { id: 'CRQ-2', type: 'close-deal', title: 'Mark DL-302 Grace Church Osu as Won (GHS 9,000.00, over the Supervisor limit)', requestedBy: 'Kwame Asante', role: 'Supervisor', branch: 'osu', payload: { deal: 'DL-302', want: 'Won' }, status: 'pending', at: t - 2 * 36e5 },
  ];
  safeWrite(K.leads, leads); safeWrite(K.deals, deals); safeWrite(K.tasks, tasks); safeWrite(K.notes, notes); safeWrite(K.segments, segments);
  safeWrite(K.journeys, journeys); safeWrite(K.feedback, feedback); safeWrite(K.requests, requests); safeWrite(K.settings, SETTINGS0);
  safeWrite('ecompos.crm.seeded', 1);
}
/** Seed realistic demo data once (MNestPOS_CRM_Prompt.md §8). */
export function ensureCrmSeed() { try { if (!readKey<number>('ecompos.crm.seeded', 0)) seed(); } catch { /* storage blocked */ } }
export const DAY_MS = DAY;
