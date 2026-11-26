// People & HR shared pieces: the HR data every tab reads (staff, leave, onboarding ticks, documents, reviews, job
// openings and applications), small display parts (avatar with photo, state chip, stat tile) and the actions that
// touch several records at once (create an employee from a hire, with staff number, sign-in code and login).
import type { ReactNode } from 'react';
import { BRS } from '../../../data/catalogue';
import { CLOCK_KEY, HR_KEY, type Clock, type HrRec } from '../../../data/clock';
import { DOCTYPES0, DOCTYPES_KEY, EMPDOCS_KEY, ONB_KEY, seedDocs, seedOnboard, type DocMap, type DocType, type JobApp, type JobLite, type LeaveReq, type OnbMap, type Review, type Stage } from '../../../data/hr';
import { EMPS0, LEAVE0, ini, type Emp } from '../../../data/people';
import { useWeb, type Job } from '../../../data/web';
import { ensureStaffNos } from '../../../data/idcard';
import { credSet } from '../../../lib/sec';
import { readKey, usePersist, writeKey } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { seed as seedAccounts, type UAcc } from '../../admin/Users';

/** Extra HR facts not on the staff list: contract, email, start date (ISO). */
export type HrX = { contract?: string; email?: string; start?: string };
export const HRX_KEY = 'ecompos.hrx';
export const REVIEWS_KEY = 'ecompos.reviews2';
const REVIEWS0: Review[] = [
  { id: 'rv1', name: 'Akua Kyei', stars: 5, note: 'Top seller on TVs this month and always on time.', by: 'Ama Darko', at: '12 Nov' },
  { id: 'rv2', name: 'Kwame Asante', stars: 4, note: 'Runs the floor well; needs to close the till faster at night.', by: 'Ama Darko', at: '5 Nov' },
];

/** Every HR record the tabs share, from browser storage (the hosted build reads the same from the API). */
export function useHr() {
  const [E, setE] = usePersist<Emp[]>('ecompos.staff2', EMPS0);
  const [Lv, setLv] = usePersist<LeaveReq[]>('ecompos.leave2', LEAVE0 as LeaveReq[]);
  const [onb, setOnb] = usePersist<OnbMap>(ONB_KEY, readKey<OnbMap | null>(ONB_KEY, null) || seedOnboard(readKey<Emp[]>('ecompos.staff2', EMPS0)));
  const [docs, setDocs] = usePersist<DocMap>(EMPDOCS_KEY, readKey<DocMap | null>(EMPDOCS_KEY, null) || seedDocs(readKey<Emp[]>('ecompos.staff2', EMPS0)));
  const [types, setTypes] = usePersist<DocType[]>(DOCTYPES_KEY, DOCTYPES0);
  const [reviews, setReviews] = usePersist<Review[]>(REVIEWS_KEY, REVIEWS0);
  const [hrx, setHrx] = usePersist<Record<string, HrX>>(HRX_KEY, {});
  const [clock] = usePersist<Clock[]>(CLOCK_KEY, []);
  const [hr] = usePersist<Record<string, HrRec>>(HR_KEY, {});
  const up = (id: string, p: Partial<Emp>) => setE((x) => x.map((y) => (y.id === id ? { ...y, ...p } : y)));
  return { E, setE, up, Lv, setLv, onb, setOnb, docs, setDocs, types, setTypes, reviews, setReviews, hrx, setHrx, clock, hr };
}
export type HrData = ReturnType<typeof useHr>;

/** Job openings as the online store keeps them (Post to webstore → Careers & jobs uses the same list). */
export function useJobs() {
  const [W, up] = useWeb();
  const jobs = W.jobs || [];
  const setJobs = (f: (j: Job[]) => Job[]) => up({ jobs: f(jobs) });
  return { jobs, setJobs, W };
}
export const toLite = (j: Job): JobLite => ({ id: j.id, title: j.title, role: j.role, br: j.br, type: j.type, salMin: j.salMin, salMax: j.salMax, summary: j.summary, duties: j.duties, reqs: j.reqs, offer: j.offer, docs: j.docs });

/** Turn an application saved by the store's Careers form (older, flatter shape) into a full JobApp. */
export function normApp(a: Record<string, unknown>): JobApp {
  const docs = Array.isArray(a.docs) ? (a.docs as unknown[]).map((d) => (typeof d === 'string' ? { name: d.split(':')[0].trim(), file: d.split(':').slice(1).join(':').trim() || d } : d as JobApp['docs'][number])) : [];
  const when = typeof a.when === 'number' ? a.when : Date.parse(String(a.when || '')) || Number(String(a.id || '').replace(/\D/g, '')) || Date.now();
  return { history: [{ t: 'Applied on the online store', at: new Date(when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }], ...(a as object), docs, when, stage: ((a.stage as Stage) || 'new') } as JobApp;
}

/** Photo from the HR record, else coloured initials. */
export function Avatar({ e, hr, s = 40 }: { e: Emp; hr?: Record<string, HrRec>; s?: number }) {
  const ph = (hr || readKey<Record<string, HrRec>>(HR_KEY, {}))[e.name]?.photo;
  return ph ? <img src={ph} alt="" className="rounded-full object-cover flex-none" style={{ width: s, height: s }} />
    : <span className="rounded-full text-white font-semibold flex items-center justify-center flex-none" style={{ width: s, height: s, background: e.color, fontSize: s / 3 }}>{ini(e.name)}</span>;
}
/** Active (teal) / Suspended (red) / Left (grey) / On leave (amber). */
export function StateChip({ st }: { st: Emp['status'] }) {
  const c = st === 'Active' ? 'bg-brand-50 text-brand' : st === 'Suspended' ? 'bg-red-100 text-red-800' : st === 'On leave' ? 'bg-amber-100 text-amber-900' : 'bg-[#eee] text-[#666]';
  return <span className={cx('pill', c)}>{st}</span>;
}
/** A figure tile. */
export const Stat = ({ k, v, s, children }: { k: string; v: ReactNode; s?: ReactNode; children?: ReactNode }) => <div className="rounded-2xl bg-canvas p-3.5 flex flex-col gap-0.5 min-w-0"><span className="text-xs text-muted">{k}</span><b className="text-lg leading-tight">{v}</b>{s && <span className="text-xs text-muted">{s}</span>}{children}</div>;
export const brTxt = (b: string) => (b === 'all' ? 'All branches' : BRS.find((x) => x.id === b)?.name ?? b);
export const LEVEL_PAY: Record<string, number> = { Admin: 6500, Superuser: 6500, Manager: 4200, 'Branch manager': 4200, Supervisor: 2800, 'Sales staff': 2400, Rider: 1800, 'Stock clerk': 2100 };
/** Role from a job title ("Branch manager" → Manager, "Delivery rider" → Rider …). */
export const levelOf = (title: string): Emp['level'] => (/manager/i.test(title) ? 'Manager' : /supervisor/i.test(title) ? 'Supervisor' : /rider|driver|delivery/i.test(title) ? 'Rider' : /director|admin|owner/i.test(title) ? 'Admin' : 'Sales staff');
const COLORS = ['#0b5c5c', '#b26a00', '#6b3fa0', '#c62828', '#0b6bcb', '#1f7a2a', '#3f51b5'];

/**
 * Create an employee (Add employee or a hire): staff list, contract facts, staff number and sign-in code (generated by
 * the system), and, for a hire, a login with a temporary password and passcode. Output: the new employee and login.
 */
export function createEmployee(d: HrData, f: { name: string; title: string; phone: string; pay: number; br: string; contract: string; email?: string; level?: Emp['level'] }, withLogin = false) {
  const level = f.level || levelOf(f.title);
  const e: Emp = { id: 'e' + Date.now(), name: f.name.trim(), title: f.title.trim() || level, level, br: f.br, basic: f.pay || LEVEL_PAY[f.title.trim()] || LEVEL_PAY[level] || 2400, pay: level === 'Rider' || level === 'Sales staff' ? 'MoMo · MTN' : 'Bank · GCB', phone: f.phone || '+233 24 000 0000', since: new Date().getFullYear(), status: 'Active', leaveLeft: 18, color: COLORS[d.E.length % COLORS.length], docs: [], onboard: {}, rating: 0 };
  d.setE((x) => [...x, e]);
  d.setHrx((x) => ({ ...x, [e.name]: { contract: f.contract, email: f.email, start: new Date().toISOString().slice(0, 10) } }));
  d.setOnb((x) => ({ ...x, [e.name]: {} }));
  setTimeout(() => ensureStaffNos(readKey<Emp[]>('ecompos.staff2', [])), 0);
  let login: { username: string; pw: string; passcode: string } | null = null;
  if (withLogin) {
    const base = e.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + '.' + (e.name.split(' ').slice(-1)[0][0] || 'x').toLowerCase();
    const list = readKey<UAcc[] | null>('ecompos.accounts3', null) || seedAccounts();
    let u = base; let k = 2; while (list.some((a) => a.username === u)) u = base + k++;
    const pw = 'Adom' + Math.floor(1000 + Math.random() * 9000) + '!'; const passcode = String(Math.floor(100000 + Math.random() * 900000));
    const role = level === 'Manager' ? 'manager' : level === 'Supervisor' ? 'supervisor' : level === 'Rider' ? 'rider' : level === 'Admin' ? 'superuser' : 'staff';
    writeKey('ecompos.accounts3', [...list, { username: u, name: e.name, level: level as UAcc['level'], role: role as UAcc['role'], br: f.br, phone: e.phone, email: f.email || '', reportsTo: 'admin', last: 'Never' }]);
    // Temporary password and passcode; the employee must change the password at first sign-in.
    credSet(u, { pw, passcode, force: true, tempPw: pw });
    login = { username: u, pw, passcode };
  }
  return { e, login };
}
/** Put a message in the staff / candidate outbox (shown in Messages; sent by SMS / email in the hosted build). */
export function outbox(to: string, channel: string, text: string) {
  writeKey('ecompos.outbox', [{ id: 'm' + Date.now(), to, channel, text, at: new Date().toLocaleString('en-GB') }, ...readKey<unknown[]>('ecompos.outbox', [])].slice(0, 300));
}
