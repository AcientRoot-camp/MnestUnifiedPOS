// Shared sell-side records (till sales, customers, online orders, collections),
// shaped after the prototype's seeded localStorage data.
import { iso } from './finance';

/** Items the demo sales history is made from: name, price (GHS), category (electronics shop). */
export const CAT: [string, number, string][] = [
  ['TCL 43" 4K UHD Google TV', 4999, 'TV'], ['TCL 55" QLED Google TV', 8999, 'TV'], ['Nasco 43" Smart Android TV', 3499, 'TV'], ['Samsung 55" Crystal UHD 4K Smart TV', 9499, 'TV'],
  ['LG 50" UHD 4K Smart TV', 7499, 'TV'], ['TCL 252L Double-Door Fridge', 6499, 'Fridge'], ['Nasco 138L Single-Door Fridge', 2899, 'Fridge'], ['Samsung 384L Twin Cooling Fridge', 11999, 'Fridge'],
  ['Hisense 205L Double-Door Fridge', 4299, 'Fridge'], ['TCL 1.5HP Inverter Split Air Conditioner', 6999, 'Air Conditioner'], ['Nasco 1.5HP Split Air Conditioner', 5299, 'Air Conditioner'], ['Samsung 1.5HP WindFree Inverter Air Conditioner', 9999, 'Air Conditioner'],
  ['Midea 2HP Split Air Conditioner', 7800, 'Air Conditioner'], ['Bruhm 300L Chest Freezer', 5499, 'Freezer'], ['Nasco 32" HD LED TV', 1850, 'TV'], ['Hisense 43" Smart VIDAA TV', 3650, 'TV'],
  ['Binatone 16" Standing Fan', 450, 'Fan'], ['Nasco 18" Wall Fan', 520, 'Fan'], ['DStv HD Decoder & Dish Kit', 899, 'DStv & GOtv'], ['GOtv Supa+ Decoder', 349, 'DStv & GOtv'],
];
export const METHODS = ['Cash', 'MTN MoMo', 'Telecel Cash', 'Card', 'Cash + MoMo', 'CREDIT', 'Bank transfer'];
export const STAFF = [{ name: 'Akua Kyei', br: 'osu' }, { name: 'Ama Darko', br: 'osu' }, { name: 'Kwame Asante', br: 'osu' }, { name: 'Efua Sarpong', br: 'legon' }, { name: 'Yaw Boateng', br: 'legon' }, { name: 'Kofi Antwi', br: 'adum' }, { name: 'Efua Mensah', br: 'adum' }];

export type Customer = {
  id: string; name: string; phone: string; email: string; group: 'Retail' | 'Wholesale' | 'Staff'; since: string; tier: 'Bronze' | 'Silver' | 'Gold';
  points: number; limit: number; birthday?: string; sms: boolean; whatsapp: boolean; email_ok: boolean; br: string;
  credits: { no: string; at: string; total: number; paid: number; due: string; by: string; appr?: string }[];
  codes: { code: string; txt: string; used: boolean }[]; gifts: { what: string; txt: string; given: boolean }[];
};

export const CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Ama Owusu', phone: '+233 24 555 0142', email: 'ama.owusu@gmail.com', group: 'Retail', since: 'Mar 2024', tier: 'Gold', points: 1240, limit: 3000, sms: true, whatsapp: true, email_ok: true, br: 'osu', credits: [], codes: [{ code: 'AMA5-7K2Q', txt: '5% off · 5th purchase', used: false }], gifts: [{ what: 'GHS 20 gift voucher', txt: 'For GHS 1,000 spent', given: false }] },
  { id: 'c2', name: 'Kojo Badu', phone: '+233 20 811 4410', email: 'kojo.badu@yahoo.com', group: 'Retail', since: 'Jan 2025', tier: 'Silver', points: 380, limit: 2000, sms: true, whatsapp: false, email_ok: false, br: 'legon', credits: [{ no: '33102284', at: '2 Nov 2026', total: 1850, paid: 600, due: '2026-11-30', by: 'Efua Sarpong', appr: ' · approved by Ebenezer Mensah' }], codes: [], gifts: [] },
  { id: 'c3', name: 'Comfort Nyarko', phone: '+233 55 210 6618', email: '', group: 'Wholesale', since: 'Aug 2023', tier: 'Gold', points: 2050, limit: 10000, sms: true, whatsapp: true, email_ok: false, br: 'adum', credits: [{ no: '33099170', at: '28 Oct 2026', total: 4200, paid: 2650, due: '2026-11-15', by: 'Kofi Antwi' }], codes: [], gifts: [{ what: 'GHS 20 gift voucher', txt: 'For GHS 1,000 spent', given: true }] },
  { id: 'c4', name: 'Mansa Boateng', phone: '+233 24 771 0093', email: 'mansa.b@outlook.com', group: 'Retail', since: 'May 2025', tier: 'Bronze', points: 140, limit: 1000, sms: false, whatsapp: true, email_ok: true, br: 'osu', credits: [{ no: '34410021', at: '14 Nov 2026', total: 480, paid: 150, due: '2026-12-01', by: 'Ama Darko' }], codes: [], gifts: [] },
  { id: 'c5', name: 'Yaw Owusu-Ansah', phone: '+233 26 304 9921', email: '', group: 'Wholesale', since: 'Feb 2024', tier: 'Silver', points: 920, limit: 8000, sms: true, whatsapp: true, email_ok: false, br: 'legon', credits: [{ no: '33102291', at: '9 Nov 2026', total: 2800, paid: 2800, due: '2026-11-20', by: 'Yaw Boateng' }], codes: [], gifts: [] },
  { id: 'c6', name: 'Esi Mensah', phone: '+233 24 555 0192', email: 'esi.mensah@gmail.com', group: 'Retail', since: 'Jun 2022', tier: 'Gold', points: 1610, limit: 3000, sms: true, whatsapp: true, email_ok: true, br: 'osu', credits: [], codes: [{ code: 'ESI10-P3M1', txt: '10% off · issued by Admin', used: true }], gifts: [] },
  { id: 'c7', name: 'Akua Kyei', phone: '+233 24 400 7781', email: 'akua@ebenezerunique.com.gh', group: 'Staff', since: 'Jan 2026', tier: 'Bronze', points: 60, limit: 500, sms: true, whatsapp: true, email_ok: true, br: 'osu', credits: [], codes: [], gifts: [] },
  { id: 'c8', name: 'Accra Royal School', phone: '+233 30 222 1100', email: 'bursar@accraroyal.edu.gh', group: 'Wholesale', since: 'Sep 2024', tier: 'Gold', points: 3300, limit: 25000, sms: false, whatsapp: false, email_ok: true, br: 'osu', credits: [], codes: [], gifts: [] },
  { id: 'c9', name: 'Nana Yeboah', phone: '+233 55 302 7781', email: '', group: 'Retail', since: 'Oct 2025', tier: 'Bronze', points: 90, limit: 1000, sms: true, whatsapp: false, email_ok: false, br: 'adum', credits: [], codes: [], gifts: [] },
  { id: 'c10', name: 'Kwame Ntim', phone: '+233 20 118 4471', email: 'kntim@gmail.com', group: 'Retail', since: 'Jul 2025', tier: 'Silver', points: 470, limit: 2000, sms: true, whatsapp: true, email_ok: true, br: 'legon', credits: [], codes: [], gifts: [] },
];

export type SaleLine = { name: string; qty: number; each: number };
export type Sale = { no: string; ts: number; day: string; br: string; staff: string; cust: string; phone: string; method: string; lines: SaleLine[]; total: number; ch: 'till' | 'web'; status: 'completed' | 'open' | 'held' | 'cancelled' | 'voided'; cost: number };

function rnd(seed: number) { let x = seed; return () => (x = (x * 9301 + 49297) % 233280) / 233280; }

/** Deterministic till + online sales over the last 400 days. */
export const SALES: Sale[] = (() => {
  const r = rnd(42);
  const out: Sale[] = [];
  let no = 34391000;
  const now = new Date();
  for (let d = 400; d >= 0; d--) {
    const day = new Date(now); day.setDate(day.getDate() - d);
    const n = d === 0 ? 14 : 6 + Math.floor(r() * 10);
    for (let i = 0; i < n; i++) {
      const st = STAFF[Math.floor(r() * STAFF.length)];
      const nl = 1 + Math.floor(r() * 3);
      const lines: SaleLine[] = [];
      for (let k = 0; k < nl; k++) {
        const big = r() < 0.08;
        const c = CAT[big ? 12 + Math.floor(r() * 8) : Math.floor(r() * 12)];
        if (lines.some((l) => l.name === c[0])) continue;
        lines.push({ name: c[0], qty: big ? 1 : 1 + Math.floor(r() * 4), each: c[1] });
      }
      const total = Math.round(lines.reduce((a, l) => a + l.qty * l.each, 0) * 100) / 100;
      const cu = r() < 0.4 ? CUSTOMERS[Math.floor(r() * CUSTOMERS.length)] : null;
      const ts = new Date(day); ts.setHours(8 + Math.floor(r() * 12), Math.floor(r() * 60));
      if (d === 0 && ts > now) ts.setTime(now.getTime() - (n - i) * 600000);
      const web = r() < 0.12;
      const status: Sale['status'] = d === 0 && i === n - 1 ? 'held' : d < 3 && r() < 0.04 ? 'voided' : web && d < 1 ? 'open' : 'completed';
      out.push({ no: String(no++), ts: ts.getTime(), day: iso(ts), br: st.br, staff: st.name, cust: cu ? cu.name : 'Walk-in', phone: cu?.phone ?? '', method: cu && r() < 0.15 ? 'CREDIT' : METHODS[Math.floor(r() * 5)], lines, total, ch: web ? 'web' : 'till', status, cost: Math.round(total * 0.8 * 100) / 100 });
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
})();

export type Rider = { id: string; name: string; br: string; state: 'Free' | 'On a delivery' | 'Off duty'; note: string };
export const RIDERS: Rider[] = [
  { id: 'r1', name: 'Kwesi Mensah', br: 'osu', state: 'Free', note: 'Motorbike · GR 4471-24' },
  { id: 'r2', name: 'Yaw Darko', br: 'osu', state: 'On a delivery', note: 'Motorbike · GR 9910-23' },
  { id: 'r3', name: 'Kojo Asamoah', br: 'legon', state: 'Free', note: 'Motorbike · GE 2210-25' },
  { id: 'r4', name: 'Abdul Rahman', br: 'adum', state: 'Free', note: 'Tricycle · AS 1180-24' },
];

export const STAGES = ['Being confirmed', 'Preparing order', 'Packing', 'In transit', 'Out for delivery', 'Delivered'] as const;
export type WebOrder = {
  id: string; ch: 'Website' | 'WhatsApp' | 'Phone' | 'Till'; who: string; phone: string; items: [number, string, number][]; fee: number; pay: string;
  type: 'D' | 'P' | 'I'; brId: string; where: string; landmark?: string; gps?: string; placed: string; stage: number; status: 'Active' | 'Cancelled' | 'Delivered';
  rider?: string; received?: string; track: { label: string; at: string; by: string }[]; cancelReason?: string; trackId: string; proof?: string;
};
export const WEB_ORDERS: WebOrder[] = [
  { id: 'W-2311', ch: 'Website', who: 'Efua Amoah', phone: '+233 24 118 3302', items: [[1, 'Nasco 32" HD LED TV', 1850]], fee: 0, pay: 'Card · paid', type: 'D', brId: 'osu', where: '14 Ring Road East, Labone', landmark: 'Opposite Labone SHS', gps: 'GA-121-4410', placed: 'Today 08:42', stage: 3, status: 'Active', rider: 'r2', track: [{ label: 'Being confirmed', at: 'Today 08:42', by: 'Website' }, { label: 'Preparing order', at: 'Today 08:55', by: 'Ama Darko' }, { label: 'Packing', at: 'Today 09:10', by: 'Kwame Asante' }, { label: 'In transit', at: 'Today 09:30', by: 'Yaw Darko' }], trackId: 'T8K2Q1' },
  { id: 'W-2310', ch: 'Website', who: 'Nana Yeboah', phone: '+233 55 302 7781', items: [[1, 'Hisense 43" Smart TV', 3650]], fee: 0, pay: 'MoMo · paid', type: 'P', brId: 'osu', where: 'Pickup at Osu branch', placed: 'Today 08:10', stage: 1, status: 'Active', track: [{ label: 'Being confirmed', at: 'Today 08:10', by: 'Website' }, { label: 'Preparing order', at: 'Today 08:30', by: 'Ama Darko' }], trackId: 'P4M7X2' },
  { id: 'W-2309', ch: 'WhatsApp', who: 'Kwame Ntim', phone: '+233 20 118 4471', items: [[1, 'TCL 43" 4K UHD Google TV', 4999], [1, 'DStv HD Decoder & Dish Kit', 899]], fee: 25, pay: 'Pay on delivery', type: 'D', brId: 'legon', where: '7 Lagos Avenue, East Legon', landmark: 'Near A&C Mall', gps: 'GA-492-1187', placed: 'Today 07:58', stage: 0, status: 'Active', track: [{ label: 'Being confirmed', at: 'Today 07:58', by: 'WhatsApp' }], trackId: 'W2N8B5' },
  { id: 'W-2307', ch: 'Phone', who: 'Abena Ofori', phone: '+233 24 909 1120', items: [[2, 'Binatone 16" Standing Fan', 450]], fee: 20, pay: 'MoMo · paid', type: 'D', brId: 'adum', where: 'Ahodwo roundabout, Kumasi', placed: 'Yesterday 15:20', stage: 5, status: 'Delivered', rider: 'r4', received: 'Abena Ofori', track: [{ label: 'Being confirmed', at: 'Yesterday 15:20', by: 'Phone' }, { label: 'Delivered', at: 'Yesterday 17:40', by: 'Abdul Rahman' }], trackId: 'K9P1L3' },
  { id: 'W-2306', ch: 'Website', who: 'Akosua Frimpong', phone: '+233 24 410 2290', items: [[1, 'Nasco 18" Wall Fan', 520], [1, 'GOtv Supa+ Decoder', 349]], fee: 20, pay: 'MoMo · paid', type: 'D', brId: 'osu', where: '3 Oxford Street, Osu', placed: 'Yesterday 11:05', stage: 0, status: 'Cancelled', cancelReason: 'Out of stock', track: [{ label: 'Cancelled', at: 'Yesterday 12:00', by: 'Ama Darko' }], trackId: 'C3V6Z9' },
  { id: 'W-2305', ch: 'Website', who: 'Yaw Mensah', phone: '+233 26 771 9900', items: [[1, 'Bruhm 300L Chest Freezer', 5499]], fee: 0, pay: 'Hire purchase · deposit paid', type: 'I', brId: 'adum', where: 'Pickup at Adum branch', placed: 'Yesterday 09:30', stage: 2, status: 'Active', track: [{ label: 'Being confirmed', at: 'Yesterday 09:30', by: 'Website' }, { label: 'Packing', at: 'Yesterday 14:00', by: 'Kofi Antwi' }], trackId: 'H5R2T8' },
];

export type Collection = { no: string; code: string; name: string; phone: string; items: { name: string; qty: number; total: number }[]; total: number; fulfil: 'P' | 'I'; branch: string; pay: 'momo' | 'counter' | 'hp'; paid: boolean; payRef?: string; status: 'waiting' | 'ready' | 'prep' | 'collected' | 'cancelled'; placedAt: string; sent?: string; note?: string };
export const COLLECTIONS: Collection[] = [
  { no: '34422885', code: '482913', name: 'Ama Owusu', phone: '+233 24 555 0142', items: [{ name: 'Nasco 43" Smart Android TV', qty: 1, total: 3499 }, { name: 'Binatone 16" Standing Fan', qty: 2, total: 900 }], total: 4399, fulfil: 'P', branch: 'Osu, Accra', pay: 'momo', paid: true, payRef: 'MOMO_8F2K1Q', status: 'ready', placedAt: 'Today 09:40' },
  { no: '34375371', code: '730155', name: 'Yaw Antwi', phone: '+233 20 111 2233', items: [{ name: 'GOtv Supa+ Decoder', qty: 1, total: 349 }], total: 349, fulfil: 'P', branch: 'Osu, Accra', pay: 'counter', paid: false, status: 'prep', placedAt: 'Yesterday 17:05' },
  { no: '34366102', code: '215880', name: 'Yaw Mensah', phone: '+233 26 771 9900', items: [{ name: 'Bruhm 300L Chest Freezer', qty: 1, total: 5499 }], total: 5499, fulfil: 'I', branch: 'Adum, Kumasi', pay: 'hp', paid: false, status: 'prep', placedAt: 'Yesterday 09:30' },
  { no: '34310044', code: '908812', name: 'Esi Mensah', phone: '+233 24 555 0192', items: [{ name: 'Hisense 205L Double-Door Fridge', qty: 1, total: 4299 }], total: 4299, fulfil: 'P', branch: 'East Legon, Accra', pay: 'momo', paid: true, status: 'collected', placedAt: '17 Nov 10:12' },
];

export const wordsGhs = (n: number) => {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const w = (x: number): string => x < 20 ? a[x] : x < 100 ? b[Math.floor(x / 10)] + (x % 10 ? '-' + a[x % 10] : '') : x < 1000 ? a[Math.floor(x / 100)] + ' hundred' + (x % 100 ? ' and ' + w(x % 100) : '') : x < 1e6 ? w(Math.floor(x / 1000)) + ' thousand' + (x % 1000 ? ' ' + w(x % 1000) : '') : String(x);
  const c = Math.round((n % 1) * 100);
  const s = (Math.floor(n) ? w(Math.floor(n)) : 'zero') + ' Ghana cedis' + (c ? ' and ' + w(c) + ' pesewas' : '');
  return s.charAt(0).toUpperCase() + s.slice(1) + ' only';
};
