// Developer portal data: companies, branches, alerts, tasks, IT settings, HTTP registry.
import { useCallback } from 'react';
import { usePersist } from '../../../lib/persist';

export type Plan = 'Starter' | 'Growth' | 'Pro';
export type Company = { id: string; name: string; type: string; plan: Plan; owner: string; email: string; phone: string; logo: string; db: string; since: string; status: 'Active' | 'Suspended'; feats: Record<string, boolean>; parent?: string; domain: string; city: string };
export type Meta = { held?: string; heldNote?: string; licExp: string; auto: boolean; hist: { at: string; what: string; by: string }[]; adminLast: string };
export type Br = { id: string; name: string; code: string; city: string; status: 'Open' | 'Closed' | 'Archived'; origin: string; addr?: string; phone?: string; opened?: string; only: number };

export const FEATS = ['Sell Now (POS)', 'Online store', 'Orders & delivery', 'Rider app', 'Inventory & warehouse', 'Returns & refunds', 'Hire purchase', 'Invoices & pro-forma', 'Reports', 'Finance & banking', 'Payroll', 'Marketing & SMS'];
const allFeats = () => Object.fromEntries(FEATS.map((f) => [f, true]));
export const PLANS: Plan[] = ['Starter', 'Growth', 'Pro'];
export const BIZ0 = ['Retail & wholesale', 'Supermarket', 'Restaurant', 'Pharmacy', 'Electronics', 'Salon', 'Bakery', 'Hardware'];

export const CO0: Company[] = [
  { id: 'main', name: 'Ebenezer Unique Ventures', type: 'Retail & wholesale', plan: 'Growth', owner: 'Ebenezer Mensah', email: 'ebenezer@ebenezerunique.com.gh', phone: '+233 24 400 0111', logo: '/assets/mnest-icon.svg', db: 'euv_main', since: 'Jan 2025', status: 'Active', feats: allFeats(), domain: 'ebenezerunique.com.gh', city: 'Accra' },
  { id: 'c2', name: 'Adom Café', type: 'Restaurant', plan: 'Starter', owner: 'Akosua Boateng', email: 'akosua@adomcafe.com.gh', phone: '+233 20 555 1020', logo: '', db: 'adom_cafe', since: 'Jun 2025', status: 'Active', feats: { ...allFeats(), 'Hire purchase': false, Payroll: false }, domain: 'adomcafe.com.gh', city: 'Kumasi' },
  { id: 'c3', name: 'Unique Pharmacy', type: 'Pharmacy', plan: 'Growth', owner: 'Ebenezer Mensah', email: 'ebenezer@ebenezerunique.com.gh', phone: '+233 24 400 0111', logo: '', db: 'euv_pharmacy', since: 'Sep 2026', status: 'Active', feats: allFeats(), parent: 'main', domain: 'ebenezerunique.com.gh', city: 'Accra' },
];
export const META0: Record<string, Meta> = {
  main: { licExp: '2027-01-01', auto: true, hist: [{ at: '2 Jan 2026', what: 'Licence renewed to 01/01/2027 · GHS 9,600.00', by: 'MNest UnifiedPOS Support' }], adminLast: 'Today 08:02' },
  c2: { licExp: '2026-12-05', auto: true, hist: [], adminLast: 'Yesterday 17:40' },
  c3: { licExp: '2027-09-01', auto: false, hist: [], adminLast: '3 days ago' },
};
export const BR0: Record<string, Br[]> = {
  main: [
    { id: 'osu', name: 'Osu', code: 'OSU', city: 'Accra', status: 'Open', origin: 'Set-up · Jan 2025', only: 0 },
    { id: 'legon', name: 'East Legon', code: 'ELG', city: 'Accra', status: 'Open', origin: 'Purchase agreement · 3 Mar 2025', only: 1 },
    { id: 'adum', name: 'Adum', code: 'ADM', city: 'Kumasi', status: 'Open', origin: 'Purchase agreement · 14 Aug 2025', only: 2 },
  ],
  c2: [{ id: 'c2-1', name: 'Kejetia', code: 'KJT', city: 'Kumasi', status: 'Open', origin: 'Set-up · Jun 2025', only: 0 }],
  c3: [{ id: 'c3-1', name: 'Osu Pharmacy', code: 'OPH', city: 'Accra', status: 'Open', origin: 'Set-up · Sep 2026', only: 0 }],
};

/** Companies, their meta and branches, plus the company picked in the side menu. */
export function useDevData() {
  const [cos, setCos] = usePersist<Company[]>('ecompos.companies', CO0);
  const [meta, setMeta] = usePersist<Record<string, Meta>>('ecompos.companyMeta', META0);
  const [brs, setBrs] = usePersist<Record<string, Br[]>>('ecompos.branches', BR0);
  const [sel, setSel] = usePersist<string>('ecompos.devCompany', 'main');
  const co = cos.find((c) => c.id === sel) ?? cos[0];
  const upCo = useCallback((id: string, p: Partial<Company>) => setCos((L) => L.map((c) => (c.id === id ? { ...c, ...p } : c))), [setCos]);
  const upMeta = useCallback((id: string, p: Partial<Meta>) => setMeta((M) => ({ ...M, [id]: { ...(M[id] || { licExp: '', auto: false, hist: [], adminLast: 'Never' }), ...p } })), [setMeta]);
  return { cos, setCos, upCo, meta, setMeta, upMeta, brs, setBrs, sel, setSel, co };
}
export const ini = (n: string) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const dbName = (n: string) => n.toLowerCase().replace(/\b(ltd|limited|ventures|company|co)\b/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'company';

export type Alert = { id: string; sev: 'Critical' | 'Warning' | 'Info'; title: string; area: string; when: string; source: string; state: 'Open' | 'Acknowledged' | 'Resolved'; detail: string; cause: string; fix: string; auto?: string; notified?: boolean };
export const ALERTS0: Alert[] = [
  { id: 'AL-31', sev: 'Critical', title: 'Osu Till 2 offline for 47 minutes', area: 'Tills sync', when: 'Today 09:12', source: 'Till heartbeat', state: 'Open', detail: 'The till stopped sending its heartbeat. 6 sales are stored on the device and will sync when it reconnects.', cause: 'The shop Wi-Fi router restarted and the till did not rejoin the network.', fix: 'Ask the branch to turn the till’s Wi-Fi off and on, or plug in the network cable. Sales are safe offline.' },
  { id: 'AL-30', sev: 'Warning', title: '3 E-VAT receipts queued for 2 hours', area: 'E-VAT link to GRA', when: 'Today 08:05', source: 'GRA E-VAT API', state: 'Open', detail: 'Receipts #34391022, #34391040 and #34391051 have not been accepted by GRA yet.', cause: 'GRA’s E-VAT service returned 503 Service Unavailable between 07:55 and 08:20.', fix: 'Re-send the queued receipts now that GRA is back.', auto: 'Re-sent 3 receipts to GRA · all accepted' },
  { id: 'AL-29', sev: 'Warning', title: 'Telecel Cash timeouts at 30%', area: 'Mobile Money', when: 'Today 07:40', source: 'Payment gateway', state: 'Open', detail: '30% of Telecel Cash prompts timed out in the last hour (normal is under 5%).', cause: 'Telecel is slow to deliver payment prompts this morning.', fix: 'Tell tills to offer MTN MoMo or cash if a Telecel prompt does not arrive within 60 seconds.' },
  { id: 'AL-28', sev: 'Info', title: 'Search index is 2 days old', area: 'Product search', when: 'Yesterday 22:00', source: 'Nightly job', state: 'Open', detail: '14 new products may not appear in Sell Now search.', cause: 'The nightly re-index job was skipped during the backup window.', fix: 'Re-index product search.', auto: 'Product search re-indexed · 1,214 products' },
  { id: 'AL-27', sev: 'Warning', title: 'Receipt printer reconnects every 3 receipts', area: 'Hardware', when: '19 Nov 10:20', source: 'Ticket T-1041', state: 'Acknowledged', detail: 'Osu Till 2 printer drops Bluetooth after a few prints.', cause: 'Printer firmware 1.2 has a known Bluetooth sleep bug.', fix: 'Switch the printer to the 80 mm network connection or update its firmware.' },
];

export const TASKS0 = [
  { id: 'db', name: 'Database health check & clean-up', last: 'Last run today 03:00', btn: 'Run now' },
  { id: 'evat', name: 'Re-send queued E-VAT receipts to GRA', last: '3 waiting', btn: 'Re-send now' },
  { id: 'idx', name: 'Re-index product search', last: 'Last run 2 days ago', btn: 'Re-index' },
  { id: 'restore', name: 'Test restore of last night’s backup', last: 'Last test 18 Nov · passed', btn: 'Test restore' },
  { id: 'keys', name: 'Rotate payment gateway keys', last: 'Due in 12 days', btn: 'Rotate keys' },
];

export const SETUP = [
  ['Sign the purchase agreement', 'Licence, plan, number of branches and tills'],
  ['Create the company and its database', 'New company tab · separate database, same features'],
  ['Create the very first Admin account', 'Owner signs in with a temporary password and sets their own'],
  ['Add branches', 'Company branches tab · one per signed purchase agreement'],
  ['Connect payments, SMS and E-VAT', 'IT management · Paystack, Mobile Money, SMS, GRA E-VAT'],
  ['Register tills, printers and scanners', 'IT management · Hardware, devices & offline'],
  ['Train the staff', 'Training mode · every printout watermarked'],
  ['Clear training data', 'Training mode · type CLEAR'],
  ['Hand over to the Admin', 'The Admin owns the data and controls support access'],
];

export const LIMITS: [boolean, string][] = [
  [true, 'Create the very first Admin account (once, at set-up)'],
  [true, 'Create new branches under the company after a signed purchase agreement'],
  [true, 'IT management: integrations, API keys, payment gateways, devices and offline sync'],
  [true, 'Install updates and run maintenance'],
  [true, 'Read and fix technical tickets the Admin escalates'],
  [true, 'See system health, queues and error logs'],
  [false, 'See cost prices, profit or customer details'],
  [false, 'Make sales, refunds, discounts or price changes'],
  [false, 'Create, edit or delete staff accounts after hand-over'],
  [false, 'Work without the Admin’s permission (every action is in the audit trail)'],
];

export const HTTP: [number, string, string, string][] = [
  [200, 'OK', 'RFC 9110', 'Saved or loaded'], [201, 'Created', 'RFC 9110', 'New record created'], [204, 'No Content', 'RFC 9110', 'Deleted'],
  [301, 'Moved Permanently', 'RFC 9110', 'Store redirects'], [304, 'Not Modified', 'RFC 9110', 'Cached screen reused'],
  [400, 'Bad Request', 'RFC 9110', 'Input blocked by the sign-in firewall'], [401, 'Unauthorized', 'RFC 9110', 'Wrong PIN or password'], [402, 'Payment Required', 'RFC 9110', 'Licence overdue'], [403, 'Forbidden', 'RFC 9110', 'Not allowed for this role'], [404, 'Not Found', 'RFC 9110', 'Nothing found'], [408, 'Request Timeout', 'RFC 9110', 'Till took too long to answer'], [409, 'Conflict', 'RFC 9110', 'Already exists or clashes'], [413, 'Content Too Large', 'RFC 9110', 'File too large'], [415, 'Unsupported Media Type', 'RFC 9110', 'Wrong file type'], [422, 'Unprocessable Content', 'RFC 9110', 'Missing field'], [423, 'Locked', 'RFC 4918', 'Locked or on hold'], [429, 'Too Many Requests', 'RFC 6585', 'Too many attempts'],
  [500, 'Internal Server Error', 'RFC 9110', 'Could not save'], [502, 'Bad Gateway', 'RFC 9110', 'Provider error (MoMo, Paystack, GRA)'], [503, 'Service Unavailable', 'RFC 9110', 'Offline or not set up'], [504, 'Gateway Timeout', 'RFC 9110', 'Provider timeout'],
];
export type HttpLog = { id: string; ts: number; code: number; reason: string; msg: string; page: string; by: string };
export const HTTPLOG0: HttpLog[] = [
  { id: 'h1', ts: Date.now() - 18 * 6e4, code: 401, reason: 'Unauthorized', msg: 'Wrong PIN', page: 'Sell Now', by: 'Akua Kyei' },
  { id: 'h2', ts: Date.now() - 52 * 6e4, code: 504, reason: 'Gateway Timeout', msg: 'Telecel Cash prompt timed out', page: 'Sell Now', by: 'Kwesi Ofori' },
  { id: 'h3', ts: Date.now() - 2 * 36e5, code: 503, reason: 'Service Unavailable', msg: 'GRA E-VAT not reachable · receipt queued', page: 'Tax & E-VAT', by: 'System' },
  { id: 'h4', ts: Date.now() - 5 * 36e5, code: 413, reason: 'Content Too Large', msg: 'Logo bigger than 2 MB', page: 'Settings', by: 'Ebenezer Mensah' },
  { id: 'h5', ts: Date.now() - 26 * 36e5, code: 409, reason: 'Conflict', msg: 'Barcode already used by another product', page: 'Products', by: 'Ama Darko' },
];
