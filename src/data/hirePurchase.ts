// Hire purchase model, ported from the prototype's HirePurchase.dc.html.
export type HPRaw = {
  id: string;
  customer: string;
  phone: string;
  guarantor: string;
  item: string;
  goods: number; // cash price of goods before taxes
  depPct: number;
  term: number; // months
  branch: 'osu' | 'legon' | 'adum';
  startY: number;
  startM: number; // 0-based
  paid: number; // instalments paid at seed time
  overdueDays: number;
  state: 'active' | 'default';
  buyer: 'ind' | 'biz';
  tin?: string;
  rate?: number; // HP charge % (flat)
  disc?: number;
  items?: { name: string; price: number; qty: number }[];
  depMethod?: string;
  /** Captured on the new-agreement form and printed on the agreement. */
  gPhone?: string; gAddr?: string; card?: string; addr?: string; emp?: string; respNum?: string;
  /** Who the terms & conditions were read to, and when they were accepted. */
  termsTo?: { name: string; tel: string; gName: string; gTel: string; at: string };
};

export const BRN: Record<string, string> = { osu: 'Osu', legon: 'East Legon', adum: 'Adum' };
// Default HP charge by term (months), used when an agreement has no custom rate.
const RATE0: Record<number, number> = { 3: 6, 6: 12, 9: 15, 12: 18 };
export const rateFor = (term: number) => RATE0[term] ?? Math.round(term * 1.5 * 10) / 10;

export const SEED: HPRaw[] = [
  { id: 'HP-2607-0011', customer: 'Ama Owusu', phone: '+233 24 555 0142', guarantor: 'Kwesi Owusu', item: 'TCL 43" 4K UHD Google TV', goods: 4999, depPct: 25, term: 6, branch: 'osu', startY: 2026, startM: 6, paid: 4, overdueDays: 0, state: 'active', buyer: 'ind' },
  { id: 'HP-2609-0017', customer: 'Coastal Guest House Ltd', phone: '+233 30 000 4455', guarantor: 'Respondent · Mensah Owusu', item: 'TCL 1.5HP Inverter Split Air Conditioner × 2', goods: 13998, depPct: 25, term: 12, branch: 'legon', startY: 2026, startM: 8, paid: 1, overdueDays: 22, state: 'active', buyer: 'biz', tin: 'C0004455210' },
  { id: 'HP-2608-0014', customer: 'Kofi Boateng', phone: '+233 24 118 7702', guarantor: 'Akosua Boateng', item: 'Bruhm 300L Chest Freezer', goods: 5499, depPct: 25, term: 6, branch: 'adum', startY: 2026, startM: 7, paid: 2, overdueDays: 0, state: 'active', buyer: 'ind' },
  { id: 'HP-2602-0004', customer: 'Yaw Antwi', phone: '+233 26 455 8810', guarantor: 'Esi Antwi', item: 'Industrial sewing machine', goods: 2500, depPct: 20, term: 6, branch: 'osu', startY: 2026, startM: 1, paid: 6, overdueDays: 0, state: 'active', buyer: 'ind' },
  { id: 'HP-2604-0006', customer: 'Abena Sarpong', phone: '+233 20 771 3304', guarantor: 'Kojo Sarpong', item: 'Chest freezer 200L', goods: 4200, depPct: 10, term: 9, branch: 'adum', startY: 2026, startM: 3, paid: 3, overdueDays: 96, state: 'default', buyer: 'ind' },
];

// Products in stock that can go on hire purchase: name, price, category, stock at [osu, legon, adum].
export const HP_CATALOGUE: [string, number, string, [number, number, number]][] = [
  ['TCL 43" 4K UHD Google TV', 4999, 'TV', [8, 4, 6]],
  ['TCL 55" QLED Google TV', 8999, 'TV', [4, 3, 3]],
  ['Samsung 55" Crystal UHD 4K Smart TV', 9499, 'TV', [3, 4, 2]],
  ['LG 50" UHD 4K Smart TV', 7499, 'TV', [3, 2, 3]],
  ['Nasco 43" Smart Android TV', 3499, 'TV', [9, 7, 6]],
  ['TCL 252L Double-Door Fridge', 6499, 'Fridge', [4, 3, 2]],
  ['Samsung 384L Twin Cooling Fridge', 11999, 'Fridge', [2, 2, 1]],
  ['Nasco 138L Single-Door Fridge', 2899, 'Fridge', [7, 5, 6]],
  ['TCL 1.5HP Inverter Split Air Conditioner', 6999, 'Air Conditioner', [5, 6, 3]],
  ['Samsung 1.5HP WindFree Inverter Air Conditioner', 9999, 'Air Conditioner', [2, 3, 1]],
  ['Bruhm 300L Chest Freezer', 5499, 'Freezer', [3, 2, 2]],
];

export const LATE_FEE = 50;

export const dueOf = (y: number, m: number, k: number) => {
  const t = m + k;
  return '05/' + String((t % 12) + 1).padStart(2, '0') + '/' + (y + Math.floor(t / 12));
};

export type HPStatus = 'Active' | 'In arrears' | 'Completed' | 'Defaulted' | 'Repossession';

export type HPPayment = { no: number; amt: number; method: string; ref: string; at: string };

export type HPState = {
  extraPaid: Record<string, number>;
  pays: Record<string, HPPayment[]>;
  created: HPRaw[];
  defSent: Record<string, boolean>;
  reminded: Record<string, boolean>;
  resched: Record<string, boolean>;
  hand: Record<string, { printed?: string; signed?: string; uploaded?: string; handed?: string }>;
};

export const EMPTY_HP: HPState = { extraPaid: {}, pays: {}, created: [], defSent: {}, reminded: {}, resched: {}, hand: {} };

export function build(a: HPRaw, S: HPState) {
  const biz = a.buyer === 'biz';
  const vat = biz ? a.goods * 0.15 : 0;
  const lev = biz ? a.goods * 0.05 : 0;
  const cash = Math.max(0, a.goods + vat + lev - (a.disc || 0));
  const dep = (cash * a.depPct) / 100;
  const fin = cash - dep;
  const rate = a.rate ?? rateFor(a.term);
  const charge = (fin * rate) / 100;
  const total = fin + charge;
  const inst = total / a.term;
  const extra = S.extraPaid[a.id] || 0;
  const paid = Math.min(a.term, a.paid + extra);
  const done = paid >= a.term;
  const overdue = !done && a.overdueDays > 0 && !extra;
  const missed = overdue ? Math.max(1, Math.floor(a.overdueDays / 30) + (a.overdueDays % 30 > 0 ? 1 : 0)) : 0;
  const status: HPStatus = a.state === 'default' ? (S.defSent[a.id] ? 'Repossession' : 'Defaulted') : done ? 'Completed' : overdue ? 'In arrears' : 'Active';
  const fee = overdue && a.overdueDays > 7 ? LATE_FEE * missed : 0;
  const balance = Math.max(0, total - paid * inst);
  return { a, biz, vat, lev, cash, dep, fin, rate, charge, total, inst, paid, done, overdue, missed, status, fee, balance, branch: BRN[a.branch] };
}
export type HPAg = ReturnType<typeof build>;

export function scheduleRows(c: HPAg) {
  const rows: { no: number; due: string; amount: number; paidOn: string; after: number; status: 'Paid' | 'Overdue' | 'Due next' | 'Upcoming' }[] = [];
  let bal = c.total;
  for (let i = 0; i < c.a.term; i++) {
    const isPaid = i < c.paid;
    bal -= c.inst;
    const isOver = !isPaid && c.overdue && i < c.paid + c.missed;
    const due = dueOf(c.a.startY, c.a.startM, i + 1);
    rows.push({
      no: i + 1,
      due,
      amount: c.inst,
      paidOn: isPaid ? due.replace('05/', '0' + (3 + (i % 4)) + '/') : '—',
      after: Math.max(0, bal),
      status: isPaid ? 'Paid' : isOver ? 'Overdue' : i === c.paid && !c.done ? 'Due next' : 'Upcoming',
    });
  }
  return rows;
}

export const RULES = {
  rates: [
    'The HP charge is a custom flat rate — the percentage is typed on each new agreement, as agreed with the customer.',
    'It is charged once on the amount financed (cash price less deposit) and does not change for the term.',
    'Minimum deposit 10%. Items over GHS 10,000.00 need a Manager to approve.',
  ],
  late: [
    '7-day grace period after each due date',
    'Late fee GHS 50.00 per missed instalment after the grace period',
    'Guarantor is notified when an instalment is 7 days late',
    '3 missed instalments: agreement can be marked defaulted (Admin approval)',
  ],
  reminders: [
    'SMS 3 days before each due date',
    'SMS and WhatsApp message on the due date',
    'Issue raised to the branch Supervisor at 7 days overdue',
    'Escalated to the Manager at 30 days overdue',
  ],
  own: [
    'The item stays the property of the shop until the last instalment is paid',
    'Ownership passes automatically and a completion certificate is printed',
    'Early settlement: 50% of the unearned HP charge is refunded',
    'Cost price is never shown on the agreement, schedule or statement',
  ],
};

export const TERMS = (co: string): [string, string][] => [
  ['Ownership', `The goods remain the property of ${co} until every instalment is paid; ownership then passes automatically.`],
  ['Deposit', 'A deposit of at least 10% of the cash price is paid on signing. It is not refundable except as the law allows.'],
  ['HP charge', 'A flat hire purchase charge, agreed and entered on the agreement, is added to the balance after the deposit and does not change for the term.'],
  ['Instalments', 'Instalments are paid on the same day every month until the remaining amount is cleared. A receipt is issued for every payment.'],
  ['Late payment', 'There is a 7-day grace period; after it a late fee of GHS 50.00 per missed instalment applies and the guarantor is contacted.'],
  ['Care of the goods', 'The goods must be kept in good condition and must not be sold, pledged, lent or moved without telling us.'],
  ['Default', 'If two or more instalments are missed, written notice is given; if not cleared within 14 days the goods may be recovered under the Hire Purchase Act.'],
  ['Early settlement', 'The agreement can be paid off early at any time with a rebate of 50% of the unearned HP charge.'],
  ['Guarantor', 'The guarantor (or the authorised officer for a business) is responsible for payment if the customer defaults.'],
];

export const TERM_CHECKS = (biz: boolean, who?: { name: string; tel: string; gName: string; gTel: string }) => {
  const c = who?.name.trim() ? `${who.name.trim()}${who.tel ? ` (Tel +233 ${who.tel})` : ''}` : biz ? 'the business' : 'the customer';
  const g = who?.gName.trim() ? `${who.gName.trim()}${who.gTel ? ` (Tel +233 ${who.gTel})` : ''}` : biz ? 'the authorised officer' : 'the guarantor';
  return [
    `I have read or explained every term to ${c}${biz ? ` and ${g}` : ` and ${g}`} in a language they understand`,
    `${c.charAt(0).toUpperCase() + c.slice(1)} understands the goods stay ours until the last instalment is paid`,
    biz ? `${g.charAt(0).toUpperCase() + g.slice(1)} accepts these terms for ${c} and wants to continue` : `${c.charAt(0).toUpperCase() + c.slice(1)} and guarantor ${g} accept these terms and want to continue`,
  ];
};
export const CREATE_CHECKS = ['Ghana Card checked and copied', 'Guarantor called and agreed', 'Item serial number recorded'];

export const COMPANY = {
  name: 'Ebenezer Unique Ventures',
  addr: '12 Oxford Street, Osu, Accra, Greater Accra, GPS GA-123-4567',
  tel: '+233 30 000 1111 · +233 24 400 0111',
  email: 'info@ebenezerunique.com.gh',
  web: 'www.ebenezerunique.com.gh',
};
