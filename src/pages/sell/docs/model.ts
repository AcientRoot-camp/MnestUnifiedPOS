export type DocLine = { name: string; qty: number; rate: number };
export type DocStatus = 'Draft' | 'Sent' | 'Accepted' | 'Converted' | 'Paid' | 'Part paid' | 'Unpaid' | 'Expired';
export type Doc = {
  no: string; kind: 'pf' | 'inv'; date: string; buyer: 'ind' | 'biz';
  cust: { name: string; biz: string; addr: string; phone: string; email: string; tin?: string };
  lines: DocLine[]; discMode: 'none' | 'pct' | 'cash'; discVal: string;
  validUntil?: string; advMode?: 'pct' | 'cash'; advVal?: string;
  paid: number; payRef?: string; depositedBy?: string; terms: string; soldBy: string; br: string;
  status: DocStatus; ref?: string; template: string; deleted?: boolean;
  shipTo?: string; modes?: string[]; stamp?: { on: boolean; sig: boolean; shape?: string; color?: string; word?: string; date?: string };
};

export function totals(d: Doc) {
  const sub = d.lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const v = parseFloat(d.discVal) || 0;
  const disc = d.discMode === 'pct' ? (sub * v) / 100 : d.discMode === 'cash' ? Math.min(sub, v) : 0;
  const net = sub - disc;
  const biz = d.buyer === 'biz';
  const vat = biz ? net * 0.15 : 0, nhil = biz ? net * 0.025 : 0, getf = biz ? net * 0.025 : 0;
  const total = net + vat + nhil + getf;
  const av = parseFloat(d.advVal || '') || 0;
  const adv = d.advMode === 'cash' ? Math.min(total, av) : (total * av) / 100;
  return { sub, disc, net, vat, nhil, getf, tax: vat + nhil + getf, total, adv, rest: total - adv, balance: Math.max(0, total - d.paid) };
}

export const TEMPLATES = [['classic', 'Classic', '#0b5c5c', false], ['green', 'Modern Green', '#1f7a2a', true], ['minimal', 'Minimal', '#000000', false], ['bold', 'Bold Black', '#000000', true], ['terracotta', 'Warm Terracotta', '#a8492a', true], ['blue', 'Fresh Blue', '#1d5fa8', true], ['exec', 'Executive', '#1a1240', false]] as const;
export const tplOf = (t: string) => TEMPLATES.find((x) => x[0] === t) ?? TEMPLATES[0];

export const DEFAULT_TERMS = {
  pf: 'Prices are valid until the date shown. Goods are reserved once the advance is received. Delivery within Greater Accra in 2–3 working days after payment.',
  inv: 'Payment due within 14 days. Pay by MoMo to 0244 000 111 (Ebenezer Unique Ventures) or GCB Bank 1021 3300 4471. Goods remain our property until paid in full.',
};

export const SEED_DOCS: Doc[] = [
  { no: 'PF-OSU-0231', kind: 'pf', date: '18 Nov 2026', buyer: 'biz', cust: { name: 'Mrs Adwoa Boateng', biz: 'Accra Royal School', addr: '22 Liberation Road, Airport', phone: '+233 30 222 1100', email: 'bursar@accraroyal.edu.gh', tin: 'C0012284410' }, lines: [{ name: 'Binatone 16" Standing Fan', qty: 30, rate: 450 }, { name: 'Nasco 1.5HP Split Air Conditioner', qty: 4, rate: 5299 }], discMode: 'pct', discVal: '5', validUntil: '2026-12-02', advMode: 'pct', advVal: '50', paid: 0, terms: DEFAULT_TERMS.pf, soldBy: 'Ama Darko', br: 'Osu', status: 'Sent', template: 'classic' },
  { no: 'PF-OSU-0230', kind: 'pf', date: '17 Nov 2026', buyer: 'ind', cust: { name: 'Kwesi Owusu', biz: '', addr: 'East Legon', phone: '+233 24 220 1180', email: '', }, lines: [{ name: 'Hisense 43" Smart TV', qty: 1, rate: 3650 }], discMode: 'none', discVal: '', validUntil: '2026-12-01', advMode: 'pct', advVal: '30', paid: 0, terms: DEFAULT_TERMS.pf, soldBy: 'Ama Darko', br: 'Osu', status: 'Accepted', template: 'classic' },
  { no: 'PF-LEG-0228', kind: 'pf', date: '12 Nov 2026', buyer: 'biz', cust: { name: 'Pastor Mensah', biz: 'Grace Church Osu', addr: 'Osu', phone: '+233 20 300 1122', email: 'office@gracechurch.org' }, lines: [{ name: 'Samsung 55" Crystal UHD 4K Smart TV', qty: 2, rate: 9499 }, { name: 'Samsung 3.1 Soundbar with Subwoofer', qty: 1, rate: 3999 }], discMode: 'cash', discVal: '200', validUntil: '2026-11-19', advMode: 'pct', advVal: '50', paid: 0, terms: DEFAULT_TERMS.pf, soldBy: 'Efua Sarpong', br: 'East Legon', status: 'Expired', template: 'classic' },
  { no: 'INV-OSU-1190', kind: 'inv', date: '15 Nov 2026', buyer: 'biz', cust: { name: 'Mrs Adwoa Boateng', biz: 'Accra Royal School', addr: '22 Liberation Road, Airport', phone: '+233 30 222 1100', email: 'bursar@accraroyal.edu.gh', tin: 'C0012284410' }, lines: [{ name: 'Midea 2HP Split Air Conditioner', qty: 1, rate: 7800 }], discMode: 'none', discVal: '', paid: 3000, payRef: 'GCB 552190', terms: DEFAULT_TERMS.inv, soldBy: 'Ama Darko', br: 'Osu', status: 'Part paid', template: 'classic' },
  { no: 'INV-OSU-1189', kind: 'inv', date: '10 Nov 2026', buyer: 'biz', cust: { name: 'Dr Kumi', biz: 'Mercy Hospital', addr: 'Adabraka', phone: '+233 30 244 9910', email: 'accounts@mercy.org' }, lines: [{ name: 'Nasco 138L Single-Door Fridge', qty: 2, rate: 2899 }, { name: 'Nasco 18" Wall Fan', qty: 6, rate: 520 }], discMode: 'none', discVal: '', paid: 0, terms: DEFAULT_TERMS.inv, soldBy: 'Kwame Asante', br: 'Osu', status: 'Unpaid', template: 'classic' },
  { no: 'INV-ADM-0415', kind: 'inv', date: '8 Nov 2026', buyer: 'ind', cust: { name: 'Kwesi Owusu', biz: '', addr: 'East Legon', phone: '+233 24 220 1180', email: '' }, lines: [{ name: 'Hisense 43" Smart TV', qty: 1, rate: 3650 }], discMode: 'none', discVal: '', paid: 3650, payRef: 'MTN 77412088', terms: DEFAULT_TERMS.inv, soldBy: 'Kofi Antwi', br: 'Adum', status: 'Paid', ref: 'PF-OSU-0226', template: 'classic' },
];
