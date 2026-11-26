import { brName } from '../../data/catalogue';
import { COMPANY } from '../../data/hirePurchase';
import { BANDS, payslip, type Emp } from '../../data/people';
import { ghs } from '../../lib/format';
import CompanyLogo from '../../components/CompanyLogo';

export type PayExtra = { ot: number; comm: number; adv: number; allow: number; loan: number; tin: string; grade: string; union: number; bank: string; num?: string; type?: string; payDate?: string };
export const X0: PayExtra = { ot: 0, comm: 0, adv: 0, allow: 0, loan: 0, tin: '', grade: 'G3', union: 0, bank: '', num: '', type: 'Monthly salary', payDate: '25th of each month' };
export function taxBands(taxable: number) { const out: [string, number, number][] = []; let left = taxable, from = 0; for (const [w, r] of BANDS) { const x = Math.min(left, w); if (x <= 0) break; out.push([`${ghs(from)} – ${w === Infinity ? 'above' : ghs(from + w)} at ${Math.round(r * 1000) / 10}%`, x, x * r]); from += w; left -= x; } return out; }

/** Payslip with earnings, deductions, summary, SSNIT both sides, tax breakdown and a plain-language explanation. */
export default function PayslipDoc({ e, x, month, hours }: { e: Emp; x: PayExtra; month: string; hours: number }) {
  const p = payslip(e, x);
  const net = Math.round((p.net - (x.union || 0)) * 100) / 100;
  const ded = p.ssnit + p.tax + x.adv + x.loan + (x.union || 0);
  const row = (k: string, v: number, neg = false) => v ? <div key={k} className="flex justify-between text-sm"><span>{k}</span><span>{neg ? '− ' : ''}{ghs(v)}</span></div> : null;
  return (
    <section className="print-doc card p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 pb-2 border-b border-line"><CompanyLogo className="w-10 h-10" /><span className="flex flex-col"><b>{COMPANY.name}</b><span className="text-xs text-muted">Payslip · {month}</span></span></div>
      <h3 className="m-0 text-lg font-semibold">{e.name}</h3>
      <span className="text-xs text-muted">{e.title} · {e.br === 'all' ? 'All branches' : brName(e.br)} · staff no. {x.num || e.id.toUpperCase()} · TIN {x.tin || '—'} · grade {x.grade} · {hours} h from the QR time clock</span>
      <strong className="text-sm mt-1">Earnings</strong>
      {row('Basic pay', e.basic)}{row('Overtime', x.ot)}{row('Commission', x.comm)}{row('Allowances', x.allow)}
      <strong className="text-sm mt-1">Deductions</strong>
      {row('SSNIT (employee 5.5%)', p.ssnit, true)}{row('PAYE income tax', p.tax, true)}{row('Salary advance', x.adv, true)}{row('Loan repayment', x.loan, true)}{row('Union dues', x.union, true)}
      <strong className="text-sm mt-1">Summary</strong>
      {row('Gross pay', p.gross)}{row('Total deductions', ded, true)}
      <div className="flex justify-between text-lg font-semibold border-t border-line pt-2"><span>Net pay</span><span>{ghs(net)}</span></div>
      <span className="text-xs text-muted">Paid to {e.pay}{x.bank ? ` · ${x.bank}` : ''} · {x.payDate || '25th of each month'}</span>
      <div className="grid grid-cols-2 gap-2 text-xs mt-1"><div className="rounded-xl bg-canvas p-2.5"><b>SSNIT · both sides</b><br />You 5.5%: {ghs(p.ssnit)}<br />Employer 13%: {ghs(p.employer)}<br />Total 18.5%: {ghs(p.ssnit + p.employer)}<br /><span className="text-muted">Tier 1 (13.5%) {ghs(e.basic * 0.135)} · Tier 2 (5%) {ghs(e.basic * 0.05)}</span></div><div className="rounded-xl bg-canvas p-2.5"><b>How PAYE was worked out</b><br />Taxable pay {ghs(p.gross - p.ssnit)}{taxBands(p.gross - p.ssnit).map(([k, , t]) => <span key={k} className="block">{k}: {ghs(t)}</span>)}</div></div>
      <details className="text-xs"><summary className="font-semibold cursor-pointer">Understanding your payslip</summary><ul className="m-0 pl-4 mt-1 flex flex-col gap-1"><li><b>Gross pay</b> is everything you earned this month before anything is taken off.</li><li><b>SSNIT</b> is your pension. You pay 5.5% of basic pay and the company adds 13% on top; it goes to Tier 1 (SSNIT) and Tier 2 (your private pension fund).</li><li><b>PAYE</b> is income tax for GRA. Only pay after SSNIT is taxed, and each slice is taxed at a different rate, starting at 0%.</li><li><b>Net pay</b> is what reaches your MoMo or bank account.</li><li>Hours come from your scans on the branch QR code. Ask your Manager if a day is missing.</li></ul></details>
      <button onClick={() => window.print()} className="no-print btn-ghost w-fit min-h-9 text-xs">Print or save as PDF</button>
    </section>
  );
}
