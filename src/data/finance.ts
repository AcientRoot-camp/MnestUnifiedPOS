// Finance model, ported from the prototype's Finance.dc.html.
export const FBR = [
  { id: 'osu', name: 'Osu', lead: 'Ama Darko' },
  { id: 'legon', name: 'East Legon', lead: 'Efua Sarpong' },
  { id: 'adum', name: 'Adum', lead: 'Yaw Boakye' },
] as const;
export const bName = (id: string) => FBR.find((b) => b.id === id)?.name ?? id;
export const FLOAT = 200;
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const TODAY = iso(new Date());
export const dAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
export const dayTxt = (k: string) => {
  if (k === TODAY) return 'Today';
  if (k === dAgo(1)) return 'Yesterday';
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export type Takings = { cash: number; momo: number; ghpay: number; card: number; credit: number; total: number };
const BASE: Record<string, number> = { osu: 8470, legon: 6080, adum: 3870 };
// Deterministic daily takings so numbers are stable across reloads.
export function takings(br: string, day: string): Takings {
  const seed = [...(br + day)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const wd = new Date(day).getDay();
  const k = (wd === 6 ? 1.3 : wd === 0 ? 0.6 : 1) * (0.85 + (seed % 30) / 100);
  const hour = day === TODAY ? Math.min(1, Math.max(0.15, (new Date().getHours() - 7) / 13)) : 1;
  const total = Math.round(BASE[br] * k * hour);
  const cash = Math.round(total * 0.34), momo = Math.round(total * 0.41), ghpay = Math.round(total * 0.06), card = Math.round(total * 0.12);
  return { cash, momo, ghpay, card, credit: total - cash - momo - ghpay - card, total };
}
export const monthDays = () => { const n = new Date().getDate(); return Array.from({ length: n }, (_, i) => dAgo(n - 1 - i)); };
export const daysInMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };

export type Src = 'cash' | 'momo' | 'ghpay';
export const SRC: Record<Src, string> = { cash: 'Cash from the till', momo: 'MoMo wallet sweep', ghpay: 'GhPay settlement' };

export type Account = { id: string; name: string; kind: 'bank' | 'momo' | 'clearing' | 'safe'; number: string; opening: number; operator?: string; holder?: string; holderType?: string };
export const ACC0: Account[] = [
  { id: 'gcb', name: 'GCB Bank · Business current', kind: 'bank', number: '1021 3300 4471', opening: 184500 },
  { id: 'eco', name: 'Ecobank · Collections', kind: 'bank', number: '0441 2290 1180', opening: 96200 },
  { id: 'mtn', name: 'MTN MoMo merchant wallet', kind: 'momo', operator: 'MTN', holder: 'Ebenezer Unique Ventures', holderType: 'Business', number: '0244 000 111', opening: 3200 },
  { id: 'tel', name: 'Telecel Cash merchant wallet', kind: 'momo', operator: 'Telecel', holder: 'Ebenezer Unique Ventures', holderType: 'Business', number: '0204 000 111', opening: 850 },
  { id: 'ghipss', name: 'GhIPSS settlement', kind: 'clearing', number: 'GHP-SET-0042', opening: 0 },
  { id: 'safe', name: 'Head office safe', kind: 'safe', number: 'Osu HQ', opening: 12000 },
];

export type Deposit = { id: string; br: string; days: string[]; src: Src; amount: number; acc: string; slip: string; note: string; status: 'pending' | 'verified' | 'flagged'; by: string; at: string; ts: number; why?: string };
export type Cashup = { id: string; br: string; day: string; till: string; expected: number; counted: number; variance: number; note: string; by: string };
export type Movement = { id: string; type: string; amount: number; from: string; to: string; ref: string; note: string; status: 'pending' | 'approved' | 'rejected'; by: string; at: string; ts: number };
export type Refund = { id: string; customer: string; phone: string; amount: number; via: string; src: string; reason: string; br: string; status: 'Refund initiated' | 'Approved' | 'Payment sent' | 'Refunded' | 'Rejected'; at: string; payRef?: string; payVia?: string; rejectReason?: string; log: { t: string; at: string; by: string }[]; sms: number; orderId?: string };

export type FinState = { dep: Deposit[]; cus: Cashup[]; mov: Movement[]; acc: Account[]; refunds: Refund[] };

const at = (daysAgo: number, h: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, 20); return { at: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + String(h).padStart(2, '0') + ':20', ts: d.getTime() }; };

export function seedFinance(): FinState {
  const dep: Deposit[] = [];
  let n = 210;
  // Earlier days: everything banked except Adum's last two days of cash and Osu yesterday's MoMo.
  for (let i = 6; i >= 1; i--) {
    FBR.forEach((b) => {
      (['cash', 'momo'] as Src[]).forEach((src) => {
        const t = takings(b.id, dAgo(i));
        const late = (b.id === 'adum' && src === 'cash' && i <= 2) || (b.id === 'osu' && src === 'momo' && i === 1);
        if (late) return;
        const short = b.id === 'legon' && src === 'cash' && i === 3;
        const amt = src === 'cash' ? t.cash : t.momo;
        dep.push({ id: 'DEP-0' + n++, br: b.id, days: [dAgo(i)], src, amount: short ? amt - 120 : amt, acc: src === 'cash' ? 'gcb' : 'eco', slip: src === 'cash' ? 'GCB-' + (552100 + n) : 'MTN-' + (77412000 + n), note: '', status: i <= 1 ? 'pending' : short ? 'flagged' : 'verified', why: short ? 'Slip shows GHS 120 less than the cash-up' : undefined, by: b.lead, ...at(i - 1, 9) });
      });
    });
  }
  const cus: Cashup[] = [];
  for (let i = 6; i >= 1; i--) FBR.forEach((b) => {
    const t = takings(b.id, dAgo(i));
    const v = b.id === 'adum' && i === 2 ? -40 : b.id === 'legon' && i === 3 ? -120 : 0;
    cus.push({ id: `CU-${b.id}-${i}`, br: b.id, day: dAgo(i), till: 'Till 1', expected: FLOAT + t.cash, counted: FLOAT + t.cash + v, variance: v, note: v ? (b.id === 'legon' ? 'Counted twice, still short' : 'Change given twice') : '', by: b.lead });
  });
  const mov: Movement[] = [
    { id: 'MV-0081', type: 'sweep', amount: 2400, from: 'mtn', to: 'eco', ref: 'MTN sweep 99812', note: '', status: 'pending', by: 'Ama Darko', ...at(0, 10) },
    { id: 'MV-0080', type: 'branch', amount: 5000, from: 'branchsafe', to: 'safe', ref: 'Courier slip 0031', note: 'Weekly safe drop', status: 'pending', by: 'Yaw Boakye', ...at(0, 9) },
    { id: 'MV-0079', type: 'supplier', amount: 18400, from: 'gcb', to: 'payee', ref: 'Samsung Electronics West Africa · INV 2231', note: '', status: 'approved', by: 'Ebenezer Mensah', ...at(2, 14) },
    { id: 'MV-0078', type: 'tax', amount: 14320, from: 'gcb', to: 'payee', ref: 'GRA · October VAT', note: '', status: 'approved', by: 'Ebenezer Mensah', ...at(5, 11) },
  ];
  const refunds: Refund[] = [
    { id: 'RF-422885', customer: 'Akosua Frimpong', phone: '+233 24 410 2290', amount: 236, via: 'MTN MoMo', src: 'Online store · cancelled order #34422885', reason: 'Order cancelled · out of stock', br: 'osu', status: 'Refund initiated', ...at(0, 8), log: [{ t: 'Refund RF-422885 created from cancelled order', at: 'Today, 08:20', by: 'MNest UnifiedPOS' }], sms: 1, orderId: '#34422885' },
    { id: 'RF-R10112', customer: 'Kwame Ntim', phone: '+233 20 118 4471', amount: 520, via: 'Original payment', src: 'Return R-0112 · Nasco 18" Wall Fan', reason: 'Faulty motor', br: 'legon', status: 'Approved', ...at(1, 15), log: [{ t: 'Approved by Ebenezer Mensah', at: 'Yesterday, 15:40', by: 'Ebenezer Mensah' }], sms: 2 },
    { id: 'RF-398110', customer: 'Esi Mensah', phone: '+233 24 555 0192', amount: 1850, via: 'Card', src: 'Online store · cancelled order #33981102', reason: 'Customer changed mind', br: 'osu', status: 'Payment sent', payRef: 'PSK 7741203398', payVia: 'Card reversal', ...at(2, 11), log: [{ t: 'Payment sent · PSK 7741203398', at: '2 days ago', by: 'Ama Darko' }], sms: 3 },
    { id: 'RF-371002', customer: 'Nana Yeboah', phone: '+233 55 302 7781', amount: 92, via: 'Cash', src: 'Checkout cancelled · S-1018', reason: 'Double charge', br: 'adum', status: 'Refunded', ...at(4, 10), log: [{ t: 'Refund complete', at: '4 days ago', by: 'Yaw Boakye' }], sms: 4 },
  ];
  return { dep, cus, mov, acc: ACC0, refunds };
}

/** Money taken but not yet banked, per branch/day/source. Earlier days are "late". */
export function outstanding(S: FinState) {
  const out: { br: string; day: string; src: Src; amount: number; late: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = dAgo(i);
    FBR.forEach((b) => {
      const t = takings(b.id, day);
      (['cash', 'momo'] as Src[]).forEach((src) => {
        const due = src === 'cash' ? t.cash : t.momo;
        const banked = S.dep.filter((d) => d.br === b.id && d.src === src && d.days.includes(day) && d.status !== 'flagged').reduce((a, d) => a + d.amount / d.days.length, 0);
        const flaggedShort = S.dep.some((d) => d.br === b.id && d.src === src && d.days.includes(day) && d.status === 'flagged');
        const left = Math.round(due - banked);
        if (left > 1 && !flaggedShort) out.push({ br: b.id, day, src, amount: left, late: i > 0 });
      });
    });
  }
  return out;
}

export const MT: [string, string, 'staff' | 'supervisor' | 'manager' | 'superuser', string, string, string][] = [
  ['safe', 'Till cash → safe', 'staff', 'Move extra cash out of the drawer into the branch safe during the day.', 'till', 'safe'],
  ['float', 'Float top-up', 'supervisor', 'Give a till more change from the safe.', 'safe', 'till'],
  ['sweep', 'MoMo wallet → bank', 'supervisor', 'Sweep the merchant wallet to the bank. Keep about GHS 500 for refunds.', 'mtn', 'eco'],
  ['branch', 'Branch cash → head office', 'manager', 'Send branch safe cash to the head office safe.', 'branchsafe', 'safe'],
  ['transfer', 'Bank → bank', 'superuser', 'Move money between the business accounts.', 'gcb', 'eco'],
  ['supplier', 'Pay a supplier', 'superuser', 'Pay a supplier from a business account.', 'gcb', 'payee'],
  ['salary', 'Pay salaries', 'superuser', 'Pay the month’s salaries (see Payroll).', 'gcb', 'payee'],
  ['tax', 'Pay GRA taxes', 'superuser', 'Pay VAT, NHIL, GETFund or PAYE to GRA.', 'gcb', 'payee'],
  ['drawing', 'Owner drawing', 'superuser', 'Money the owner takes out of the business.', 'gcb', 'payee'],
  ['capital', 'Owner puts money in', 'superuser', 'New capital or a loan coming into the business.', 'payer', 'gcb'],
  ['loan', 'Loan repayment', 'superuser', 'Repay a bank or supplier loan.', 'gcb', 'payee'],
];
export const RANK = { staff: 0, supervisor: 1, manager: 2, superuser: 3 } as const;

export function placeName(id: string, S: FinState) {
  return { till: 'Till drawer', branchsafe: 'Branch safe', payee: 'Someone outside (payee)', payer: 'Owner / lender' }[id] ?? S.acc.find((a) => a.id === id)?.name ?? id;
}

export function balOf(id: string, S: FinState) {
  const a = S.acc.find((x) => x.id === id);
  if (!a) return { bal: 0, unc: 0 };
  let bal = a.opening, unc = 0;
  S.dep.filter((d) => d.acc === id).forEach((d) => (d.status === 'verified' ? (bal += d.amount) : d.status === 'pending' ? (unc += d.amount) : 0));
  S.mov.filter((m) => m.status === 'approved').forEach((m) => { if (m.to === id) bal += m.amount; if (m.from === id) bal -= m.amount; });
  return { bal, unc };
}

export const CREDIT_PAYMENTS = [
  { br: 'legon', cust: 'Yaw Owusu-Ansah', no: '33102284', amt: 300, meth: 'Cash', by: 'Yaw Boateng', h: 10 },
  { br: 'adum', cust: 'Comfort Nyarko', no: '33099170', amt: 450, meth: 'Mobile Money', by: 'Efua Mensah', h: 11 },
  { br: 'osu', cust: 'Mansa Boateng', no: '34410021', amt: 150, meth: 'Cash', by: 'Ama Darko', h: 12 },
];
export const EXPENSES_MONTH: Record<string, number> = { osu: 9800, legon: 11200, adum: 7400 };
export const OWED = 14320, OVERDUE_CREDIT = 2140;

export type Insight = { sev: 'high' | 'mid' | 'low' | 'info'; title: string; body: string; act?: string; tab?: string };
export const money = (n: number) => 'GHS ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function insights(S: FinState, scope: string): Insight[] {
  const L: Insight[] = [];
  const brs = scope === 'all' ? FBR.map((b) => b.id) : [scope];
  const OUT = outstanding(S);
  brs.forEach((id) => {
    const late = OUT.filter((o) => o.br === id && o.late);
    if (!late.length) return;
    const tot = late.reduce((a, o) => a + o.amount, 0);
    L.push({ sev: 'high', title: `${bName(id)} has ${money(tot)} not yet banked`, body: late.map((o) => `${dayTxt(o.day)} · ${SRC[o.src].toLowerCase()} ${money(o.amount)}`).join('; ') + `. Bank it before midday or ask ${FBR.find((b) => b.id === id)?.lead} what happened.`, act: 'Record the deposit', tab: 'deposits' });
  });
  const pend = S.dep.filter((d) => d.status === 'pending' && brs.includes(d.br));
  if (pend.length) L.push({ sev: 'mid', title: `${pend.length} deposits are waiting for your check`, body: `${money(pend.reduce((a, d) => a + d.amount, 0))} recorded by the branches. Tick each one off against the bank or MoMo statement.`, act: 'Check deposits', tab: 'deposits' });
  const pm = S.mov.filter((m) => m.status === 'pending');
  if (pm.length) L.push({ sev: 'mid', title: `${pm.length} money movements need your approval`, body: pm.map((m) => `${m.by}: ${money(m.amount)}`).join('; ') + '.', act: 'Review', tab: 'moves' });
  S.dep.filter((d) => d.status === 'flagged' && brs.includes(d.br)).forEach((d) => L.push({ sev: 'high', title: `${bName(d.br)} deposit ${d.id} came up short`, body: d.why || 'The bank statement does not match.', act: 'See deposit', tab: 'deposits' }));
  const shortCu = S.cus.filter((c) => brs.includes(c.br) && c.variance < 0 && c.day >= dAgo(6));
  if (shortCu.length) L.push({ sev: 'mid', title: `${shortCu.length} short cash-ups this week`, body: shortCu.map((c) => `${bName(c.br)} ${dayTxt(c.day)}: ${money(-c.variance)} short`).join('; ') + '.', act: 'See cash-ups', tab: 'cashup' });
  const w = balOf('mtn', S).bal + balOf('tel', S).bal;
  if (w > 2500) L.push({ sev: 'low', title: 'Sweep the MoMo wallets', body: `${money(w)} is sitting in the merchant wallets. Keep about GHS 500 in each and move the rest to the bank.`, act: 'Record a sweep', tab: 'moves' });
  brs.forEach((id) => { const p = EXPENSES_MONTH[id] / monthDays().reduce((a, d) => a + takings(id, d).total, 0); if (p > 0.12) L.push({ sev: 'low', title: `${bName(id)} expenses are ${Math.round(p * 1000) / 10}% of takings`, body: 'Above the 12% guide. Check fuel, transport and repairs in Expenses.' }); });
  L.push({ sev: 'info', title: 'MoMo is your biggest payment method', body: 'About 41% of takings come in by Mobile Money, 34% in cash. Card settles by itself the next working day.' });
  if (OVERDUE_CREDIT) L.push({ sev: 'mid', title: `${money(OVERDUE_CREDIT)} of credit sales are overdue`, body: 'Send reminders from Customers → Owing on credit.' });
  const order = { high: 0, mid: 1, low: 2, info: 3 };
  return L.sort((a, b) => order[a.sev] - order[b.sev]);
}
