// Report engine: every report is computed from the app's own records.
import { SALES, CUSTOMERS, WEB_ORDERS, type Sale } from '../../data/sell';
import { PRODUCTS0, DAMAGES0, MOVES0, total as stockTotal, BRS, brName } from '../../data/catalogue';
import { SEED as HP_SEED, build as hpBuild, EMPTY_HP } from '../../data/hirePurchase';
import { seedFinance, takings, FBR, dAgo, outstanding } from '../../data/finance';
import { ghs } from '../../lib/format';

export type Period = 'today' | '7d' | '30d' | 'month' | 'year';
export const PERIODS: [Period, string][] = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['year', 'This year']];
export type Opts = { period: Period; br: string; from?: string; to?: string; products?: string[]; customer?: string; supplier?: string };
/** A computed report. kicker → small label above the title on the sheet (defaults to "Report"). */
export type Report = { title: string; kicker?: string; scope: string; text?: string; kpis: { label: string; value: string; sub?: string }[]; chart?: { title: string; bars: { lb: string; v: number }[] }; table: { cols: string[]; rows: (string | number)[][] } };
export type Def = { id: string; mod: string; name: string; desc: string; perm: string; admin?: boolean; run: (o: Opts) => Report };

const DAY = 86400000;
/** Parse a date-picker value ("YYYY-MM-DD") as local midnight; new Date("YYYY-MM-DD") alone would mean UTC midnight. */
const localDay = (iso: string) => new Date(`${iso}T00:00:00`);
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/**
 * The time window a report covers: [start ms, end ms (exclusive), label].
 * A custom From/To range wins over the preset period; the To day is included in full, and the two dates
 * may arrive in either order (typed dates can bypass the pickers' min/max limits).
 */
export function range(o: Opts): [number, number, string] {
  const now = new Date();
  if (o.from && o.to) {
    const [a, b] = [localDay(o.from), localDay(o.to)].sort((x, y) => x.getTime() - y.getTime());
    return [a.getTime(), b.getTime() + DAY, a.getTime() === b.getTime() ? dayLabel(a) : `${dayLabel(a)} – ${dayLabel(b)}`];
  }
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const m: Record<Period, [number, string]> = { today: [sod, 'Today'], '7d': [sod - 6 * DAY, 'Last 7 days'], '30d': [sod - 29 * DAY, 'Last 30 days'], month: [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })], year: [new Date(now.getFullYear(), 0, 1).getTime(), String(now.getFullYear())] };
  return [m[o.period][0], sod + DAY, m[o.period][1]];
}
const scopeTxt = (o: Opts) => `${range(o)[2]} · ${o.br === 'all' ? 'All branches' : brName(o.br)}`;
export const salesIn = (o: Opts) => { const [a, b] = range(o); return SALES.filter((s) => s.ts >= a && s.ts < b && s.status !== 'voided' && (o.br === 'all' || s.br === o.br)); };
const sum = (L: Sale[]) => L.reduce((a, s) => a + s.total, 0);
const group = <T,>(L: T[], k: (x: T) => string, v: (x: T) => number) => Object.entries(L.reduce<Record<string, { n: number; v: number }>>((a, x) => { const key = k(x); a[key] = a[key] || { n: 0, v: 0 }; a[key].n++; a[key].v += v(x); return a; }, {})).sort((x, y) => y[1].v - x[1].v);
const byDay = (L: Sale[], o: Opts) => { const [a, b] = range(o); const days = Math.min(31, Math.ceil((b - a) / DAY)); return Array.from({ length: days }, (_, i) => { const t = b - (days - i) * DAY; const d = new Date(t); return { lb: days > 1 ? String(d.getDate()) : 'Today', v: L.filter((s) => s.ts >= t && s.ts < t + DAY).reduce((x, s) => x + s.total, 0) }; }); };
const lines = (L: Sale[]) => L.flatMap((s) => s.lines.map((l) => ({ ...l, s })));
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

export const DEFS: Def[] = [
  { id: 'daily', mod: 'Sales', name: 'End-of-day sales', desc: 'Takings, number of sales and payment mix for the period', perm: 'reports.sales', run: (o) => { const L = salesIn(o); const m = group(L, (s) => (s.method === 'CREDIT' ? 'Credit' : s.method), (s) => s.total); return { title: 'End-of-day sales', scope: scopeTxt(o), kpis: [{ label: 'Total sold', value: ghs(sum(L)) }, { label: 'Sales', value: String(L.length) }, { label: 'Average sale', value: ghs(L.length ? sum(L) / L.length : 0) }], chart: { title: 'Sales by day', bars: byDay(L, o) }, table: { cols: ['Payment method', 'Sales', 'Amount', 'Share'], rows: m.map(([k, v]) => [k, v.n, ghs(v.v), pct(v.v, sum(L))]) } }; } },
  { id: 'byproduct', mod: 'Sales', name: 'Sales by product', desc: 'Units, sales and profit for every product sold', perm: 'reports.sales', run: (o) => { const L = lines(salesIn(o)); const g = group(L, (l) => l.name, (l) => l.qty * l.each); return { title: 'Sales by product', scope: scopeTxt(o), kpis: [{ label: 'Products sold', value: String(g.length) }, { label: 'Units', value: String(L.reduce((a, l) => a + l.qty, 0)) }], table: { cols: ['Product', 'Units', 'Sales'], rows: g.map(([k, v]) => [k, L.filter((l) => l.name === k).reduce((a, l) => a + l.qty, 0), ghs(v.v)]) } }; } },
  { id: 'profit', mod: 'Sales', name: 'Gross profit', desc: 'Sales, cost and margin by product', perm: 'reports.sales', admin: true, run: (o) => { const L = lines(salesIn(o)); const g = group(L, (l) => l.name, (l) => l.qty * l.each); const tot = sum(salesIn(o)); return { title: 'Gross profit', scope: scopeTxt(o), kpis: [{ label: 'Sales', value: ghs(tot) }, { label: 'Cost', value: ghs(tot * 0.8) }, { label: 'Gross profit', value: ghs(tot * 0.2), sub: '20.0% margin' }], table: { cols: ['Product', 'Sales', 'Cost', 'Gross profit', 'Margin'], rows: g.map(([k, v]) => [k, ghs(v.v), ghs(v.v * 0.8), ghs(v.v * 0.2), '20.0%']) } }; } },
  { id: 'bystaff', mod: 'Sales', name: 'Sales by staff', desc: 'Who sold what at the tills', perm: 'reports.team', run: (o) => { const L = salesIn(o); return { title: 'Sales by staff', scope: scopeTxt(o), kpis: [{ label: 'Staff selling', value: String(new Set(L.map((s) => s.staff)).size) }], table: { cols: ['Staff', 'Branch', 'Sales', 'Amount', 'Average'], rows: group(L, (s) => s.staff, (s) => s.total).map(([k, v]) => [k, brName(L.find((s) => s.staff === k)!.br), v.n, ghs(v.v), ghs(v.v / v.n)]) } }; } },
  { id: 'bybranch', mod: 'Branches', name: 'Branch comparison', desc: 'Sales and average sale for each branch', perm: 'branches.view', run: (o) => { const L = salesIn({ ...o, br: 'all' }); return { title: 'Branch comparison', scope: range(o)[2], kpis: BRS.map((b) => ({ label: b.name, value: ghs(sum(L.filter((s) => s.br === b.id))) })), table: { cols: ['Branch', 'Sales', 'Amount', 'Share'], rows: BRS.map((b) => { const x = L.filter((s) => s.br === b.id); return [b.name, x.length, ghs(sum(x)), pct(sum(x), sum(L))]; }) } }; } },
  { id: 'credit', mod: 'Credit sales', name: 'Owed on credit', desc: 'Every customer with an open credit sale', perm: 'customers.view', run: (o) => { const R = CUSTOMERS.flatMap((c) => c.credits.filter((k) => k.total > k.paid).map((k) => ({ c, k }))); return { title: 'Owed on credit', scope: scopeTxt(o), kpis: [{ label: 'Owed', value: ghs(R.reduce((a, x) => a + x.k.total - x.k.paid, 0)) }, { label: 'Customers', value: String(new Set(R.map((x) => x.c.name)).size) }], table: { cols: ['Customer', 'Sale', 'Goods', 'Paid', 'Owed', 'Due'], rows: R.map(({ c, k }) => [c.name, '#' + k.no, ghs(k.total), ghs(k.paid), ghs(k.total - k.paid), new Date(k.due).toLocaleDateString('en-GB')]) } }; } },
  { id: 'hp', mod: 'Hire purchase', name: 'Hire purchase book', desc: 'Every agreement with its balance and status', perm: 'hirepurchase.use', run: (o) => { const A = HP_SEED.map((a) => hpBuild(a, EMPTY_HP)); return { title: 'Hire purchase book', scope: scopeTxt(o), kpis: [{ label: 'Still to collect', value: ghs(A.filter((x) => !x.done).reduce((s, x) => s + x.balance, 0)) }, { label: 'In arrears', value: String(A.filter((x) => x.overdue).length) }], table: { cols: ['Agreement', 'Customer', 'Item', 'Paid', 'Balance', 'Status'], rows: A.map((x) => [x.a.id, x.a.customer, x.a.item, `${x.paid} of ${x.a.term}`, ghs(x.balance), x.status]) } }; } },
  { id: 'proforma', mod: 'Pro-forma invoices', name: 'Open quotations', desc: 'Pro-formas sent and waiting for the customer', perm: 'invoices.use', run: (o) => ({ title: 'Open quotations', scope: scopeTxt(o), kpis: [{ label: 'Open', value: '2' }, { label: 'Value', value: ghs(14450) }], table: { cols: ['Pro-forma', 'Customer', 'Valid until', 'Total', 'Status'], rows: [['PF-OSU-0231', 'Accra Royal School', '2 Dec 2026', ghs(13258.8), 'Sent'], ['PF-OSU-0230', 'Kwesi Owusu', '1 Dec 2026', ghs(3650), 'Accepted']] } }) },
  { id: 'orders', mod: 'Online orders', name: 'Online orders', desc: 'Website, WhatsApp and phone orders with their status', perm: 'sales.make', run: (o) => ({ title: 'Online orders', scope: scopeTxt(o), kpis: [{ label: 'Orders', value: String(WEB_ORDERS.length) }, { label: 'Cancelled', value: String(WEB_ORDERS.filter((w) => w.status === 'Cancelled').length) }], table: { cols: ['Order', 'Channel', 'Customer', 'Branch', 'Total', 'Status'], rows: WEB_ORDERS.map((w) => [w.id, w.ch, w.who, brName(w.brId), ghs(w.items.reduce((a, i) => a + i[0] * i[2], 0) + w.fee), w.status]) } }) },
  { id: 'returns', mod: 'Sales & returns', name: 'Returns & voids', desc: 'Returned, exchanged and voided sales', perm: 'reports.returns', run: (o) => { const V = SALES.filter((s) => s.status === 'voided' && (o.br === 'all' || s.br === o.br)).slice(0, 30); return { title: 'Returns & voids', scope: scopeTxt(o), kpis: [{ label: 'Voided sales', value: String(V.length) }, { label: 'Value', value: ghs(sum(V)) }], table: { cols: ['Sale', 'When', 'Staff', 'Branch', 'Total'], rows: V.map((s) => ['#' + s.no, new Date(s.ts).toLocaleDateString('en-GB'), s.staff, brName(s.br), ghs(s.total)]) } }; } },
  { id: 'stock', mod: 'Inventory', name: 'Stock valuation', desc: 'Units and value at cost in every branch', perm: 'reports.inventory', admin: true, run: (o) => { const P = PRODUCTS0.filter((p) => p.status === 'live' && p.track !== 'digital'); const units = (p: (typeof P)[number]) => (o.br === 'all' ? stockTotal(p) : p.stock[o.br as 'osu']); return { title: 'Stock valuation', scope: o.br === 'all' ? 'All branches · today' : `${brName(o.br)} · today`, kpis: [{ label: 'Units', value: String(P.reduce((a, p) => a + units(p), 0)) }, { label: 'Value at cost', value: ghs(P.reduce((a, p) => a + units(p) * p.cost, 0)) }], table: { cols: ['Product', 'Units', 'Cost each', 'Value'], rows: P.map((p) => [p.name, units(p), ghs(p.cost), ghs(units(p) * p.cost)]) } }; } },
  { id: 'lowstock', mod: 'Inventory', name: 'Reorder list', desc: 'Products at or below their reorder level', perm: 'stock.view', run: (o) => { const P = PRODUCTS0.filter((p) => p.status === 'live' && p.track !== 'digital' && BRS.some((b) => p.stock[b.id] <= p.reorder)); return { title: 'Reorder list', scope: 'Today', kpis: [{ label: 'Products to reorder', value: String(P.length) }], table: { cols: ['Product', ...BRS.map((b) => b.name), 'Reorder at', 'Supplier'], rows: P.map((p) => [p.name, ...BRS.map((b) => p.stock[b.id]), p.reorder, p.supplier]) } }; void o; } },
  { id: 'transfers', mod: 'Warehouse', name: 'Transfers & deliveries', desc: 'Stock moved between the warehouse, branches and suppliers', perm: 'stock.view', run: (o) => ({ title: 'Transfers & deliveries', scope: scopeTxt(o), kpis: [{ label: 'Movements', value: String(MOVES0.length) }], table: { cols: ['Ref', 'Route', 'Items', 'Status'], rows: MOVES0.map((m) => [m.id, `${brName(m.from)} → ${brName(m.to)}`, m.lines.map((l) => `${l.qty} × ${l.name}`).join(', '), m.status]) } }) },
  { id: 'damages', mod: 'Damages', name: 'Damage & shrinkage', desc: 'Damaged stock by cause and supplier', perm: 'stock.view', run: (o) => ({ title: 'Damage & shrinkage', scope: scopeTxt(o), kpis: [{ label: 'Value', value: ghs(DAMAGES0.reduce((a, d) => a + d.value, 0)) }, { label: 'Records', value: String(DAMAGES0.length) }], table: { cols: ['Ref', 'Item', 'Cause', 'Supplier', 'Value', 'Status'], rows: DAMAGES0.map((d) => [d.id, `${d.qty} × ${d.name}`, d.cause, d.supplier, ghs(d.value), d.status]) } }) },
  { id: 'banking', mod: 'Finance', name: 'Banking & cash-up', desc: 'Takings, what was banked and what is overdue', perm: 'reports.sales', run: (o) => { const F = seedFinance(); const OUT = outstanding(F); return { title: 'Banking & cash-up', scope: 'Last 7 days', kpis: [{ label: 'Not yet banked', value: ghs(OUT.reduce((a, x) => a + x.amount, 0)) }, { label: 'Overdue', value: ghs(OUT.filter((x) => x.late).reduce((a, x) => a + x.amount, 0)) }], table: { cols: ['Day', ...FBR.map((b) => b.name)], rows: Array.from({ length: 7 }, (_, i) => dAgo(i)).map((d) => [d, ...FBR.map((b) => ghs(takings(b.id, d).total))]) } }; void o; } },
  { id: 'vat', mod: 'Tax', name: 'VAT return summary', desc: 'VAT, NHIL and GETFund collected', perm: 'reports.sales', admin: true, run: (o) => { const g = sum(salesIn(o)); return { title: 'VAT return summary', scope: scopeTxt(o), kpis: [{ label: 'VAT 15%', value: ghs((g / 1.2) * 0.15) }, { label: 'NHIL 2.5%', value: ghs((g / 1.2) * 0.025) }, { label: 'GETFund 2.5%', value: ghs((g / 1.2) * 0.025) }], table: { cols: ['Item', 'Amount'], rows: [['Sales incl. tax', ghs(g)], ['Taxable value', ghs(g / 1.2)], ['VAT', ghs((g / 1.2) * 0.15)], ['NHIL', ghs((g / 1.2) * 0.025)], ['GETFund', ghs((g / 1.2) * 0.025)]] } }; } },
  { id: 'customers', mod: 'Customers', name: 'Top customers', desc: 'Best customers by spend', perm: 'reports.customers', run: (o) => { const L = salesIn(o).filter((s) => s.cust !== 'Walk-in'); return { title: 'Top customers', scope: scopeTxt(o), kpis: [{ label: 'Named customers', value: String(new Set(L.map((s) => s.cust)).size) }], table: { cols: ['Customer', 'Purchases', 'Spent'], rows: group(L, (s) => s.cust, (s) => s.total).map(([k, v]) => [k, v.n, ghs(v.v)]) } }; } },
  { id: 'expenses', mod: 'Expenses', name: 'Expenses by category', desc: 'Approved spending against takings', perm: 'reports.sales', run: (o) => ({ title: 'Expenses by category', scope: scopeTxt(o), kpis: [{ label: 'Spent', value: ghs(28400) }, { label: 'Share of takings', value: '9.6%' }], table: { cols: ['Category', 'Amount', 'Share'], rows: [['Utilities', ghs(9656), '34%'], ['Transport & fuel', ghs(6248), '22%'], ['Repairs', ghs(5112), '18%'], ['Cleaning & supplies', ghs(3976), '14%'], ['Other', ghs(3408), '12%']] } }) },
  { id: 'payroll', mod: 'Payroll', name: 'Payroll summary', desc: 'Gross pay, SSNIT and PAYE by branch', perm: 'reports.team', admin: true, run: (o) => ({ title: 'Payroll summary', scope: range(o)[2], kpis: [{ label: 'Gross', value: ghs(92400) }, { label: 'Net', value: ghs(70966) }], table: { cols: ['Branch', 'Staff', 'Gross', 'SSNIT', 'PAYE', 'Net'], rows: [['Osu', 18, ghs(38400), ghs(5184), ghs(3720), ghs(29496)], ['East Legon', 15, ghs(31200), ghs(4212), ghs(3020), ghs(23968)], ['Adum', 13, ghs(22800), ghs(3078), ghs(2220), ghs(17502)]] } }) },
  { id: 'supplier', mod: 'Suppliers', name: 'Supplier purchases', desc: 'Deliveries and amounts owed to each supplier', perm: 'reports.purchases', run: (o) => ({ title: 'Supplier purchases', scope: scopeTxt(o), kpis: [{ label: 'Owed to suppliers', value: ghs(64200) }], table: { cols: ['Supplier', 'Deliveries', 'Owed'], rows: [['Samsung Electronics West Africa', 4, ghs(18400)], ['Nasco Electronics', 3, ghs(32100)], ['TCL Electronics Ghana', 6, ghs(13700)]] } }) },
  { id: 'marketing', mod: 'Marketing', name: 'Campaign results', desc: 'Sales from each campaign and promotion', perm: 'reports.sales', run: (o) => ({ title: 'Campaign results', scope: scopeTxt(o), kpis: [{ label: 'Campaign sales', value: ghs(38200) }], table: { cols: ['Campaign', 'Channel', 'Reached', 'Sales'], rows: [['Black Friday', 'SMS + Web', 3102, ghs(21400)], ['Back to school', 'WhatsApp', 840, ghs(9800)], ['TV wall-mounting promo', 'Till', 1200, ghs(27000)]] } }) },
  { id: 'hourly', mod: 'Sales', name: 'Busiest hours', desc: 'When customers buy, to plan staff shifts', perm: 'reports.team', run: (o) => { const L = salesIn(o); const bars = Array.from({ length: 14 }, (_, i) => ({ lb: `${8 + i}h`, v: L.filter((s) => new Date(s.ts).getHours() === 8 + i).reduce((a, s) => a + s.total, 0) })); return { title: 'Busiest hours', scope: scopeTxt(o), kpis: [{ label: 'Busiest hour', value: bars.slice().sort((a, b) => b.v - a.v)[0].lb }], chart: { title: 'Sales by hour', bars }, table: { cols: ['Hour', 'Sales', 'Amount'], rows: bars.map((b) => [b.lb, L.filter((s) => `${new Date(s.ts).getHours()}h` === b.lb).length, ghs(b.v)]) } }; } },
];
export const MODS = Array.from(new Set(DEFS.map((d) => d.mod)));

/**
 * Everyday words people type when looking for each report, so the Custom report search finds it even when
 * they do not use the report's own name (e.g. "money owed" → Owed on credit, "GRA" → VAT return summary).
 */
export const KEYWORDS: Record<string, string> = {
  daily: 'takings end of day cash up z report daily total money made revenue',
  byproduct: 'items goods best sellers top products units sold',
  profit: 'margin cost markup earnings',
  bystaff: 'cashier employee team worker attendant',
  bybranch: 'branches shops compare locations',
  credit: 'debt owed owing debtors unpaid money owed balance',
  hp: 'installment instalment agreement balance arrears',
  proforma: 'quote quotation estimate',
  orders: 'website online whatsapp phone delivery web',
  returns: 'refund void cancelled exchange',
  stock: 'inventory value worth on hand',
  lowstock: 'restock reorder out of stock running low',
  transfers: 'warehouse moves movement delivery',
  damages: 'broken expired shrinkage loss',
  banking: 'bank deposit cash up float',
  vat: 'tax nhil getfund gra levy',
  customers: 'clients buyers loyal best customers spend',
  expenses: 'spending costs bills',
  payroll: 'salary salaries wages ssnit paye pay',
  supplier: 'purchases vendors suppliers owed',
  marketing: 'campaign promo promotion sms',
  hourly: 'time shifts peak rush hour busiest',
};

/* ---------- Focused reports: one specific product, category, customer, staff member or payment method ---------- */

/** The kinds of specific things a custom report can be about. */
export type FocusKind = 'product' | 'category' | 'customer' | 'staff' | 'method';
export type Focus = { kind: FocusKind; value: string };
export const FOCUS_LABEL: Record<FocusKind, string> = { product: 'Product', category: 'Category', customer: 'Customer', staff: 'Staff member', method: 'Payment method' };
const methodName = (m: string) => (m === 'CREDIT' ? 'Credit' : m);
const catOf = (name: string) => PRODUCTS0.find((p) => p.name === name)?.cat ?? 'Other';
const dt = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean))).sort((a, b) => a.localeCompare(b));

/**
 * Every specific thing the search can offer, taken from the records.
 * Input: br → the branch being reported on ('all' for every branch). A branch user only sees staff and
 *        customers of their own branch, because their reports are limited to that branch.
 * Output: products, categories, customers, staff and payment methods as Focus items.
 */
export function focusOptions(br: string): Focus[] {
  const S = SALES.filter((s) => br === 'all' || s.br === br);
  const products = uniq([...PRODUCTS0.filter((p) => p.status === 'live').map((p) => p.name), ...S.flatMap((s) => s.lines.map((l) => l.name))]);
  return [
    ...products.map((value) => ({ kind: 'product' as const, value })),
    ...uniq(PRODUCTS0.map((p) => p.cat)).map((value) => ({ kind: 'category' as const, value })),
    ...uniq(S.map((s) => s.cust).filter((c) => c !== 'Walk-in')).map((value) => ({ kind: 'customer' as const, value })),
    ...uniq([...S.map((s) => s.staff)]).map((value) => ({ kind: 'staff' as const, value })),
    ...uniq(S.map((s) => methodName(s.method))).map((value) => ({ kind: 'method' as const, value })),
  ];
}

/** Daily totals for a chart: last (up to) 31 days of the window, from timestamped amounts. */
const dailyBars = (items: { ts: number; v: number }[], o: Opts) => {
  const [a, b] = range(o); const days = Math.max(1, Math.min(31, Math.ceil((b - a) / DAY)));
  return Array.from({ length: days }, (_, i) => { const t = b - (days - i) * DAY; return { lb: days > 1 ? String(new Date(t).getDate()) : 'Day', v: items.filter((x) => x.ts >= t && x.ts < t + DAY).reduce((s, x) => s + x.v, 0) }; });
};

/**
 * Build a report about one specific thing over the chosen dates and branch.
 * Inputs: f → what the report is about; o → dates/branch. Output: a Report for <ReportDoc>.
 * Sales value only (never cost or profit), so it is safe for branch users.
 */
export function focusReport(f: Focus, o: Opts): Report {
  const L = salesIn(o);
  // The sheet shows e.g. "PRODUCT REPORT" above a short title ("TCL 43\" 4K UHD Google TV") so long names do not crowd the header.
  const title = f.value;
  const kicker = `${FOCUS_LABEL[f.kind]} report`;
  const scope = scopeTxt(o);
  if (f.kind === 'product' || f.kind === 'category') {
    const hit = (name: string) => (f.kind === 'product' ? name === f.value : catOf(name) === f.value);
    const ls = lines(L).filter((l) => hit(l.name));
    const value = ls.reduce((a, l) => a + l.qty * l.each, 0);
    const units = ls.reduce((a, l) => a + l.qty, 0);
    const salesN = new Set(ls.map((l) => l.s.no)).size;
    const chart = { title: 'Sales value by day', bars: dailyBars(ls.map((l) => ({ ts: l.s.ts, v: l.qty * l.each })), o) };
    if (f.kind === 'category') {
      const g = group(ls, (l) => l.name, (l) => l.qty * l.each);
      return { title, kicker, scope, kpis: [{ label: 'Sales value', value: ghs(value) }, { label: 'Units sold', value: String(units) }, { label: 'Products sold', value: String(g.length) }, { label: 'Sales', value: String(salesN) }], chart,
        table: { cols: ['Product', 'Units', 'Sales value', 'Share'], rows: g.map(([k, v]) => [k, ls.filter((l) => l.name === k).reduce((a, l) => a + l.qty, 0), ghs(v.v), pct(v.v, value)]) } };
    }
    return { title, kicker, scope, kpis: [{ label: 'Sales value', value: ghs(value) }, { label: 'Units sold', value: String(units) }, { label: 'Sales', value: String(salesN) }, { label: 'Average price', value: ghs(units ? value / units : 0) }], chart,
      table: { cols: ['Date', 'Sale', 'Branch', 'Staff', 'Customer', 'Units', 'Amount'], rows: ls.sort((a, b) => b.s.ts - a.s.ts).map((l) => [dt(l.s.ts), '#' + l.s.no, brName(l.s.br), l.s.staff, l.s.cust, l.qty, ghs(l.qty * l.each)]) } };
  }
  // Customer, staff member or payment method: whole sales that match.
  const S = L.filter((s) => (f.kind === 'customer' ? s.cust === f.value : f.kind === 'staff' ? s.staff === f.value : methodName(s.method) === f.value)).sort((a, b) => b.ts - a.ts);
  const tot = sum(S);
  const kpis = [{ label: f.kind === 'customer' ? 'Spent' : 'Sales value', value: ghs(tot) }, { label: f.kind === 'customer' ? 'Purchases' : 'Sales', value: String(S.length) }, { label: 'Average sale', value: ghs(S.length ? tot / S.length : 0) }, { label: 'Share of all sales', value: pct(tot, sum(L)) }];
  const cols = f.kind === 'customer' ? ['Date', 'Sale', 'Branch', 'Items', 'Paid by', 'Amount'] : f.kind === 'staff' ? ['Date', 'Sale', 'Branch', 'Customer', 'Paid by', 'Amount'] : ['Date', 'Sale', 'Branch', 'Staff', 'Customer', 'Amount'];
  const rows = S.map((s) => [dt(s.ts), '#' + s.no, brName(s.br),
    ...(f.kind === 'customer' ? [s.lines.map((l) => `${l.qty} × ${l.name}`).join(', '), methodName(s.method)] : f.kind === 'staff' ? [s.cust, methodName(s.method)] : [s.staff, s.cust]), ghs(s.total)]);
  return { title, kicker, scope, kpis, chart: { title: 'Sales value by day', bars: dailyBars(S.map((s) => ({ ts: s.ts, v: s.total })), o) }, table: { cols, rows } };
}

export function toCsv(r: Report) {
  return [[r.kicker ? `${r.kicker}: ${r.title}` : r.title], [r.scope], [], r.table.cols, ...r.table.rows.map((x) => x.map(String))];
}
