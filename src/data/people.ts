// Staff records shared by People & HR, Payroll and Users. Pay figures match the prototype screenshots.
export type Emp = { id: string; name: string; title: string; level: 'Admin' | 'Manager' | 'Supervisor' | 'Sales staff' | 'Rider'; br: string; basic: number; pay: string; phone: string; since: number; status: 'Active' | 'Suspended' | 'On leave' | 'Left'; leaveLeft: number; color: string; card?: string; ssnit?: string; kin?: string; docs: string[]; onboard: Record<string, boolean>; rating: number };
const E = (id: string, name: string, title: string, level: Emp['level'], br: string, basic: number, pay: string, since: number, color: string, leaveLeft = 18, status: Emp['status'] = 'Active'): Emp => ({ id, name, title, level, br, basic, pay, phone: '+233 24 ' + (100 + parseInt(id.slice(1), 10) * 37) + ' ' + (1000 + parseInt(id.slice(1), 10) * 211), since, status, leaveLeft, color, card: 'GHA-7' + (10000000 + parseInt(id.slice(1), 10) * 9137) + '-1', ssnit: 'C0' + (90000000 + parseInt(id.slice(1), 10) * 4441), kin: 'Next of kin on file', docs: ['Ghana Card', 'CV / résumé', 'Contract'], onboard: { contract: true, docsOk: true, idOk: true, ssnitOk: true, payOk: true, kinOk: true }, rating: 4 });
export const EMPS0: Emp[] = [
  E('e1', 'Ebenezer Mensah', 'Managing director', 'Admin', 'all', 6500, 'Bank · GCB', 2021, '#0b5c5c'),
  E('e2', 'Ama Darko', 'Branch manager', 'Manager', 'osu', 4200, 'Bank · GCB', 2022, '#b26a00'),
  E('e3', 'Kwame Asante', 'Supervisor', 'Supervisor', 'osu', 2800, 'Bank · GCB', 2023, '#6b3fa0'),
  E('e4', 'Akua Kyei', 'Sales staff', 'Sales staff', 'osu', 2400, 'MoMo · MTN', 2024, '#c62828', 14),
  E('e5', 'Kwesi Ofori', 'Sales staff', 'Sales staff', 'osu', 2400, 'MoMo · MTN', 2025, '#0b6bcb'),
  E('e6', 'Efua Sarpong', 'Branch manager', 'Manager', 'legon', 4200, 'Bank · GCB', 2022, '#1f7a2a'),
  E('e7', 'Nana Ampofo', 'Supervisor', 'Supervisor', 'legon', 2800, 'Bank · GCB', 2023, '#1f7a2a'),
  E('e8', 'Adjoa Badu', 'Sales staff', 'Sales staff', 'legon', 2400, 'MoMo · Telecel', 2025, '#b26a00'),
  E('e9', 'Yaw Boakye', 'Branch manager', 'Manager', 'adum', 4200, 'Bank · Ecobank', 2022, '#000000'),
  E('e10', 'Abena Mensah', 'Supervisor', 'Supervisor', 'adum', 2800, 'Bank · Ecobank', 2023, '#1f7a2a'),
  { ...E('e11', 'Kojo Appiah', 'Sales staff', 'Sales staff', 'adum', 2400, 'MoMo · MTN', 2025, '#3f51b5', 18, 'Suspended') },
];
export type Leave = { id: string; who: string; kind: string; from: string; to: string; days: number; status: 'pending' | 'approved' | 'declined'; note: string };
export const LEAVE0: Leave[] = [
  { id: 'LV-031', who: 'Akua Kyei', kind: 'Annual leave', from: '2026-12-23', to: '2027-01-02', days: 7, status: 'pending', note: 'Christmas with family in Ho' },
  { id: 'LV-030', who: 'Kwesi Ofori', kind: 'Annual leave', from: '2026-12-24', to: '2026-12-31', days: 5, status: 'pending', note: 'Travelling to Takoradi' },
  { id: 'LV-027', who: 'Nana Ampofo', kind: 'Sick leave', from: '2026-11-10', to: '2026-11-11', days: 2, status: 'approved', note: 'Malaria · doctor’s note uploaded' },
];
// GRA monthly PAYE bands (2024), applied after the 5.5% employee SSNIT.
export const BANDS: [number, number][] = [[490, 0], [110, 0.05], [130, 0.1], [3166.67, 0.175], [16000, 0.25], [30520, 0.3], [Infinity, 0.35]];
export function paye(taxable: number) { let left = taxable, tax = 0; for (const [w, r] of BANDS) { const x = Math.min(left, w); tax += x * r; left -= x; if (left <= 0) break; } return Math.round(tax * 100) / 100; }
export function payslip(e: Emp, extra = { ot: 0, comm: 0, adv: 0, allow: 0, loan: 0 }) {
  const gross = e.basic + extra.ot + extra.comm + extra.allow;
  const ssnit = Math.round(e.basic * 0.055 * 100) / 100;
  const tax = paye(gross - ssnit);
  const net = Math.round((gross - ssnit - tax - extra.adv - extra.loan) * 100) / 100;
  return { gross, ssnit, tax, net, employer: Math.round(e.basic * 0.13 * 100) / 100 };
}
export const ini = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
