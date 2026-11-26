// The employee payslip document (GTeam.md §5.4) as one self-contained HTML page. The same page is shown on screen
// (in a frame), printed / saved as PDF (a print window sized A4 or Letter) and downloaded as
// payslip-{name}-{yyyy-mm}.html, so the Admin and the employee in My HR always see exactly the same document.
import { useEffect, useRef, useState } from 'react';
import type { PaySnap } from '../../data/hr';

/** Money as GH₵1,234.00. */
export const cedi = (n: number) => 'GH₵' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export type Paper = 'A4' | 'Letter';

/** Build the payslip page. Inputs: the snapshot, the paper size and the company logo (data URL or path). */
export function payslipHtml(s: PaySnap, paper: Paper = 'A4', logo = ''): string {
  const p = s.pay; const m = s.meta; const c = s.company;
  const momo = s.method.toLowerCase().startsWith('momo');
  const ded = p.ssnit + p.tax + p.adv + p.loan + p.union;
  const earn: [string, number][] = ([['Basic Salary', p.basic], ['Overtime', p.ot], ['Commission on sales', p.comm], ['Employee Allowances', p.allow], ['Other Allowances', p.other]] as [string, number][]).filter(([, v]) => v);
  const deds: [string, number][] = ([['SSNIT Pension Contribution (5.5%)', p.ssnit], ['PAYE / Income Tax', p.tax], ['Salary advance', p.adv], ['Loan Deduction', p.loan], ['Union Dues', p.union]] as [string, number][]).filter(([, v]) => v);
  const payDate = m.payDate || (() => { const [y, mo] = s.key.split('-').map(Number); return new Date(y, mo, 0).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })();
  const facts: [string, string][] = [['PAYROLL PERIOD', s.month], ['EMPLOYEE NO', s.no], ['EMPLOYEE NAME', s.name], ['TIN / TAX NUMBER', m.tin || '—'], ['EMPLOYEE TYPE', m.type || 'Permanent Staff (Full-time)'], ['PAY GRADE', m.grade || '—'],
    ['POSITION / RANK', s.title], ['BRANCH / DEPARTMENT', s.br], ['DATE EMPLOYED', String(s.since)], ['PAYMENT DATE', payDate], ['CURRENCY', 'GHS (Ghana Cedi)'], ['HOURS WORKED', `${p.hours} h on the time clock`]];
  const rows = (L: [string, number][]) => L.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${cedi(v)}</td></tr>`).join('');
  const contact = [c.tel && `Tel: ${c.tel}`, c.email].filter(Boolean).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payslip · ${esc(s.name)} · ${esc(s.month)}</title>
<style>
@page{size:${paper === 'A4' ? 'A4' : 'letter'};margin:14mm}
*{box-sizing:border-box}body{margin:0;font:12px/1.45 Inter,Arial,Helvetica,sans-serif;color:#111;background:#fff}
.doc{max-width:${paper === 'A4' ? '182mm' : '190mm'};margin:0 auto;padding:18px}
.top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0b5c5c;padding-bottom:12px}
.co{display:flex;gap:12px;align-items:flex-start}.logo{width:52px;height:52px;border-radius:12px;background:#0b5c5c;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;overflow:hidden}
.logo img{width:100%;height:100%;object-fit:contain;background:#fff}
h1{margin:0;font-size:11px;letter-spacing:.18em;color:#0b5c5c}.cn{font-size:16px;font-weight:700;margin:2px 0}.mut{color:#666}
.who{text-align:right}.who b{font-size:15px;display:block}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 14px;margin:14px 0;padding:12px;background:#f6f7f8;border-radius:10px}
.facts span{display:block;font-size:9px;letter-spacing:.08em;color:#666}.facts b{font-size:11.5px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;letter-spacing:.08em;color:#0b5c5c;border-bottom:1px solid #ccc;padding:6px 0}
td{padding:5px 0;border-bottom:1px solid #eee}.r{text-align:right}
.box{margin-top:8px;padding:8px 10px;background:#f6f7f8;border-radius:8px}.box div{display:flex;justify-content:space-between}
.sum{margin:14px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.sum div{border:1px solid #ddd;border-radius:10px;padding:10px}
.sum span{display:block;font-size:10px;color:#666;letter-spacing:.06em}.sum b{font-size:15px}.sum .take{background:#0b5c5c;color:#fff;border-color:#0b5c5c}.sum .take span{color:#cde}
h2{font-size:10.5px;letter-spacing:.1em;color:#0b5c5c;margin:14px 0 6px}
.exp{font-size:10.5px;color:#444}.exp li{margin:2px 0}.foot{margin-top:14px;padding-top:8px;border-top:1px solid #ddd;font-size:9.5px;color:#777}
@media (max-width:560px){.facts{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.sum{grid-template-columns:1fr}.top{flex-direction:column}.who{text-align:left}}
</style></head><body><div class="doc">
<div class="top"><div class="co"><div class="logo">${logo ? `<img src="${esc(logo)}" alt="">` : esc(c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</div>
<div><h1>EMPLOYEE PAYSLIP</h1><div class="cn">${esc(c.name)}</div>${c.addr ? `<div class="mut">${esc(c.addr)}</div>` : ''}${contact ? `<div class="mut">${esc(contact)}</div>` : ''}${c.tin ? `<div class="mut">Tax No: ${esc(c.tin)}</div>` : ''}</div></div>
<div class="who"><b>${esc(s.name)}</b><div>${esc(s.month)}</div><div class="mut">${esc(s.ref)}</div></div></div>
<div class="facts">${facts.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
<div class="two"><div><table><tr><th>EARNINGS</th><th class="r">AMOUNT (GHS)</th></tr>${rows(earn)}</table></div>
<div><table><tr><th>DEDUCTIONS</th><th class="r">AMOUNT (GHS)</th></tr>${rows(deds)}</table>
<div class="box"><div><span>Total Deductions</span><b>${cedi(ded)}</b></div><div><span>Taxable (gross − SSNIT)</span><b>${cedi(p.taxable)}</b></div></div></div></div>
<h2>SUMMARY (GHS)</h2><div class="sum"><div><span>Gross Salary</span><b>${cedi(p.gross)}</b></div><div><span>Net Pay</span><b>${cedi(p.net)}</b></div><div class="take"><span>Take Home Pay</span><b>${cedi(p.net)}</b></div></div>
<div class="two"><div><h2>SOCIAL SECURITY CONTRIBUTION</h2><table><tr><td>Employer SSNIT Contribution (13%)</td><td class="r">${cedi(p.employer)}</td></tr><tr><td>Employee SSNIT Contribution (5.5%)</td><td class="r">${cedi(p.ssnit)}</td></tr></table></div>
<div><h2>EMPLOYEE TAX BREAKDOWN</h2><table><tr><td>PAYE / Income Tax</td><td class="r">${cedi(p.tax)}</td></tr></table></div></div>
<h2>${momo ? 'PAYMENT BY MOBILE MONEY' : 'PAYMENT BY BANK TRANSFER'}</h2><table>
<tr><td>Employee Name</td><td class="r">${esc(s.name)}</td></tr>
${momo ? `<tr><td>Network</td><td class="r">${esc(m.bank || s.method.split('·')[1]?.trim() || 'MTN')}</td></tr><tr><td>MoMo Number</td><td class="r">${esc(m.acct || '—')}</td></tr>`
    : `<tr><td>Bank</td><td class="r">${esc(m.bank || s.method.split('·')[1]?.trim() || '—')}</td></tr><tr><td>Branch</td><td class="r">${esc(m.bankBr || '—')}</td></tr><tr><td>Bank Account#</td><td class="r">${esc(m.acct || '—')}</td></tr>`}</table>
<h2>UNDERSTANDING YOUR PAYSLIP</h2><ul class="exp">
<li><b>Earnings</b> are everything you earned this month: your basic salary, plus overtime (hours over 173 at time-and-a-half), 1.5% commission on your own till sales and any allowances.</li>
<li><b>Net pay / take-home pay</b> is what reaches your MoMo or bank account after deductions.</li>
<li><b>SSNIT</b> is your pension: 5.5% of your <b>basic salary only</b> is taken from your pay, and the company adds 13% on top (it is not taken from you).</li>
<li><b>PAYE</b> is income tax paid to the GRA on your gross pay less SSNIT, using the GRA monthly bands.</li>
<li><b>Salary advance</b> and <b>loan</b> deductions repay money you received earlier. Leave left: ${s.leaveLeft} days.</li></ul>
<div class="foot">This payslip is issued electronically and is valid without a signature. Questions about your pay? Speak to HR at ${esc(c.name)}${c.email ? ` (${esc(c.email)})` : ''}.</div>
</div></body></html>`;
}

/** Open the payslip in a print window (print or save as PDF). */
export function printPayslip(html: string) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return false;
  w.document.open(); w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body>')); w.document.close();
  return true;
}
/** Download the payslip as a stand-alone HTML file payslip-{name}-{yyyy-mm}.html. */
export function downloadPayslip(html: string, s: PaySnap) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `payslip-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.key}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
/** Download one payslip's figures as CSV (My HR "Download as CSV"). */
export function payslipCsv(s: PaySnap) {
  const p = s.pay; const rows: [string, string | number][] = [['Employee', s.name], ['Staff number', s.no], ['Month', s.month], ['Basic Salary', p.basic], ['Overtime', p.ot], ['Commission', p.comm], ['Allowances', p.allow + p.other], ['Gross', p.gross], ['SSNIT (5.5%)', p.ssnit], ['PAYE', p.tax], ['Salary advance', p.adv], ['Loan', p.loan], ['Union dues', p.union], ['Net pay', p.net], ['Employer SSNIT (13%)', p.employer], ['Hours', p.hours]];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(([k, v]) => `"${k}","${v}"`).join('\r\n')], { type: 'text/csv' }));
  a.download = `payslip-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.key}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/** On-screen payslip: the HTML page in a frame that grows to its content. */
export default function PayslipFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null); const [h, setH] = useState(900);
  useEffect(() => { const f = ref.current; if (!f) return; const fit = () => { try { setH((f.contentDocument?.documentElement.scrollHeight || 900) + 8); } catch { /* cross-origin never happens here */ } }; f.addEventListener('load', fit); const t = setTimeout(fit, 300); return () => { f.removeEventListener('load', fit); clearTimeout(t); }; }, [html]);
  return <iframe ref={ref} title={title} srcDoc={html} className="w-full rounded-2xl border border-line bg-white" style={{ height: h }} />;
}
