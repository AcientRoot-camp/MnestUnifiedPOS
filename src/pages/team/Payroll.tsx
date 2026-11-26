// Grow & team → Payroll (GTeam.md §5). Admin and eComPOS Support run the pay run: steps (review → owner approval →
// payout → payslips), totals, pay period by year and month, the employees table worked out from the QR time clock and
// till sales (data/hr.ts calcPay), send all / send one into each employee's My HR, company lines and per-employee
// payslip details, A4 / Letter, print / download, statutory returns and the year tracker. Everyone else sees
// "My payslip": only their own pay. MyPayslips is reused by My HR.
import { useMemo, useState } from 'react';
import { brName } from '../../data/catalogue';
import { EMPS0, type Emp } from '../../data/people';
import { SALES } from '../../data/sell';
import { CLOCK_KEY, HR_KEY, type Clock, type HrRec } from '../../data/clock';
import { staffNoOf } from '../../data/idcard';
import { BANDS0, CO_KEY, META0, META_KEY, MONTHS, PAPER_KEY, PAYE_KEY, SLIPS_KEY, calcPay, defaultMethod, hours30, leaveLeft, monthKey, payRef, sales30, type Company, type LeaveReq, type PayMeta, type PaySnap, type SlipMap } from '../../data/hr';
import { LEAVE0 } from '../../data/people';
import type { TillSale } from '../pos/model';
import { bizInfo } from '../pos/Docs';
import { companyLogo } from '../../lib/brand';
import { readKey, usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx } from '../../lib/format';
import { Msg } from '../money/ui';
import PayslipFrame, { cedi, downloadPayslip, payslipCsv, payslipHtml, printPayslip, type Paper } from './PayslipDoc';

const STEPS = ['1. Review', '2. Approved by owner', '3. Paid via Hubtel', '4. Payslips sent'];
const MON = MONTHS.map((m) => m.slice(0, 3));

/** Company lines printed on payslips (Admin can edit; defaults from the till receipt company details). */
export function companyLines(): Company {
  const b = bizInfo(); const saved = readKey<Partial<Company>>(CO_KEY, {});
  return { name: b.name, addr: saved.addr ?? b.addr, tel: saved.tel ?? b.phone, email: saved.email ?? b.email, tin: saved.tin ?? b.tin };
}
/**
 * Pay figures for everyone this month, worked out the same way for the Admin and in My HR.
 * Output: staff in scope, one row per person (employee, details, pay) and the sent payslips.
 */
export function usePay(scope: string) {
  const [E] = usePersist<Emp[]>('ecompos.staff2', EMPS0);
  const [clock] = usePersist<Clock[]>(CLOCK_KEY, []);
  const [till] = usePersist<TillSale[]>('ecompos.sales2', []);
  const [meta, setMeta] = usePersist<Record<string, PayMeta>>(META_KEY, {});
  const [bands] = usePersist<[number, number][]>(PAYE_KEY, BANDS0);
  const [Lv] = usePersist<LeaveReq[]>('ecompos.leave2', LEAVE0 as LeaveReq[]);
  const [slips, setSlips] = usePersist<SlipMap>(SLIPS_KEY, {});
  const [hr] = usePersist<Record<string, HrRec>>(HR_KEY, {});
  const sales = useMemo(() => [...SALES.map((s) => ({ staff: s.staff, total: s.total, ts: s.ts, status: s.status })), ...till.map((s) => ({ staff: s.staff, total: s.total, ts: s.ts, status: s.status }))], [till]);
  const staff = E.filter((e) => e.status !== 'Left' && e.status !== 'Suspended' && (scope === 'all' || e.br === scope || e.br === 'all'));
  const B = bands.map(([w, r]) => [w === null ? Infinity : w, r] as [number, number]); // Infinity is stored as null
  const rows = staff.map((e) => { const m = { ...META0, ...(meta[e.name] || {}) }; return { e, m, pay: calcPay(e, m, hours30(clock, e.name), sales30(sales, e.name), B) }; });
  /** The payslip snapshot for one person and month (what is put in their account when sent). */
  const snapOf = (r: (typeof rows)[number], key: string): PaySnap => {
    const [y, mo] = key.split('-').map(Number); const no = staffNoOf(r.e, hr);
    return { name: r.e.name, empId: r.e.id, no, role: r.e.level, title: r.e.title, br: r.e.br === 'all' ? 'All branches' : brName(r.e.br), since: r.e.since, month: `${MONTHS[mo - 1]} ${y}`, key, pay: r.pay, meta: r.m, method: defaultMethod(r.e), leaveLeft: leaveLeft(r.e, Lv), company: companyLines(), sent: new Date().toLocaleString('en-GB'), ref: payRef(key, no) };
  };
  return { E, staff, rows, meta, setMeta, slips, setSlips, snapOf, hr };
}

/**
 * "My payslips" (Payroll for managers, supervisors and sales staff, and My HR): the pay period by year and month.
 * Only months whose payslip the Admin has pushed can be opened; every other month stays greyed out until then.
 * The open payslip has Print / Download / CSV.
 */
export function MyPayslips({ e }: { e: Emp }) {
  const { slips } = usePay('all');
  const [paper] = usePersist<Paper>(PAPER_KEY, 'A4');
  const now = new Date();
  const sentKeys = Object.keys(slips).filter((k) => slips[k]?.[e.name]).sort().reverse();
  const years = [...new Set([String(now.getFullYear()), ...sentKeys.map((k) => k.slice(0, 4))])].sort().reverse();
  const [yr, setYr] = useState(sentKeys[0]?.slice(0, 4) || String(now.getFullYear()));
  const [key, setKey] = useState(sentKeys[0] || '');
  const open = key ? slips[key]?.[e.name] : undefined;
  const h = open ? payslipHtml(open, paper, companyLogo()) : '';
  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold">Pay period</h2>
      <div className="flex gap-1.5 flex-wrap">{years.map((y) => <button key={y} onClick={() => setYr(y)} aria-pressed={yr === y} className={cx('h-9 px-3.5 rounded-full text-sm border', yr === y ? 'bg-black text-white border-black' : 'border-line')}>{y}</button>)}</div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">{MON.map((x, i) => { const k = monthKey(Number(yr), i); const s = slips[k]?.[e.name]; return (
        <button key={x} disabled={!s} onClick={() => setKey(k)} aria-pressed={key === k} title={s ? `${MONTHS[i]} payslip · take-home ${cedi(s.pay.net)}` : 'Not sent yet · the Admin pushes each payslip after the pay run'}
          className={cx('py-2 rounded-xl text-sm font-semibold border flex flex-col items-center', key === k ? 'bg-black text-white border-black' : s ? 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100' : 'border-line text-[#c4c4c4] bg-[#f7f7f7] cursor-not-allowed')}>{x}{s ? <span className="text-[10px] font-normal">{cedi(s.pay.net)}</span> : null}</button>
      ); })}</div>
      <span className="text-xs text-muted">{sentKeys.length ? 'Green months have a payslip from the Admin. Grey months open once the Admin pushes that payslip.' : 'No payslip sent yet. HR sends it when the pay run is done.'}</span>
      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap items-center"><b className="text-sm mr-auto">Payslip · {open.month}</b><button onClick={() => setKey('')} className="btn-ghost">Close</button><button onClick={() => printPayslip(h)} className="btn-dark">Print or save as PDF</button><button onClick={() => downloadPayslip(h, open)} className="btn-ghost">Download</button><button onClick={() => payslipCsv(open)} className="btn-ghost">Download as CSV</button></div>
          <PayslipFrame html={h} title={`Payslip ${open.month}`} />
        </div>
      )}
    </section>
  );
}

/** The account holder's own details at the top of their Payroll page. */
function AccountHolder({ e, no, method, meta, left }: { e: Emp; no: string; method: string; meta: PayMeta; left: number }) {
  const acct = meta.acct ? `${'•'.repeat(Math.max(0, meta.acct.length - 4))}${meta.acct.slice(-4)}` : '—';
  // Position shows the level only when it differs from the job title (avoids "Sales staff · Sales staff").
  const facts: [string, string][] = [['Name', e.name], ['Staff number', no], ['Position', e.title === e.level ? e.title : `${e.title} · ${e.level}`], ['Branch', e.br === 'all' ? 'All branches' : brName(e.br)], ['Paid to', `${method}${meta.acct ? ` · ${acct}` : ''}`], ['TIN / Tax number', meta.tin || '—'], ['With the company since', String(e.since)], ['Leave left', `${left} of 18 days`]];
  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold">Account holder</h2>
      <dl className="m-0 grid gap-3 grid-cols-2 lg:grid-cols-4">{facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 text-sm font-semibold break-words">{v}</dd></div>)}</dl>
    </section>
  );
}

export default function Payroll() {
  const { session, viewBranch, stepUp: S } = useSession();
  const role = session?.role ?? 'superuser';
  // Admin (superuser) and eComPOS Support run payroll; everyone else sees only their own payslip.
  const HRADM = role === 'superuser' || role === 'developer';
  const scope = HRADM ? viewBranch : session?.branch ?? 'osu';
  const { E, staff, rows, setMeta, meta, slips, setSlips, snapOf } = usePay(HRADM ? scope : 'all');
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const key = monthKey(yr, m); const label = `${MONTHS[m]} ${yr}`;
  const [run, setRun] = usePersist<Record<string, number>>('ecompos.payRun3', {});
  const step = run[key] ?? 0;
  const [sel, setSel] = useState('');
  const [msg, setMsg] = useState('');
  const [flash, setFlash] = useState('');
  const [paper, setPaper] = usePersist<Paper>(PAPER_KEY, 'A4');
  const [coOpen, setCoOpen] = useState(false);
  const [co, setCo] = useState<Company>(companyLines());
  const [edit, setEdit] = useState<{ name: string; f: PayMeta } | null>(null);
  const future = yr > now.getFullYear() || (yr === now.getFullYear() && m > now.getMonth());
  const sentNow = slips[key] || {};
  const nSent = Object.keys(sentNow).length;

  if (!HRADM) {
    // Managers, supervisors and sales staff: their own account details and the payslips the Admin has pushed only.
    const meE = E.find((e) => e.name === (session?.name || ''));
    const r = rows.find((x) => x.e.name === meE?.name);
    return (
      <>
        <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">My payslip</h1><p className="m-0 text-sm text-muted">Your own payslip. The full pay run is kept by the Admin, who is HR for this company.</p></header>
        {!meE || !r ? <div className="card p-5 text-sm">Your record is kept by HR</div> : <>
          <AccountHolder e={meE} no={snapOf(r, key).no} method={defaultMethod(meE)} meta={r.m} left={snapOf(r, key).leaveLeft} />
          <MyPayslips e={meE} />
        </>}
      </>
    );
  }

  const tot = rows.reduce((a, r) => ({ gross: a.gross + r.pay.gross, net: a.net + r.pay.net, tax: a.tax + r.pay.tax, ssnit: a.ssnit + r.pay.ssnit + r.pay.employer }), { gross: 0, net: 0, tax: 0, ssnit: 0 });
  const basic = rows.reduce((a, r) => a + r.pay.basic, 0);
  const brs = new Set(staff.map((e) => e.br).filter((b) => b !== 'all')).size;
  const momo = staff.filter((e) => defaultMethod(e).startsWith('MoMo')).length;
  const cur = rows.find((r) => r.e.name === sel) || rows[0];
  const curSnap = cur ? (sentNow[cur.e.name] || snapOf(cur, key)) : null;
  const curHtml = curSnap ? payslipHtml(curSnap, paper, companyLogo()) : '';
  const BTN = [`Approve pay run (owner PIN)`, `Pay ${staff.length} staff by MoMo and bank`, 'Send payslips on WhatsApp', 'Pay run complete'];
  const NOTE = ['Hours come from the QR time clock. Check overtime, commission and advances, then approve.', 'Approved by the Admin', `Bulk payout sent through Hubtel · all ${staff.length} confirmed`, 'Payslips delivered by WhatsApp and email'];
  /** Move the pay run on. Approving asks for the owner PIN; the last step also puts every payslip in My HR. */
  const advance = () => {
    if (step >= 3) return;
    const go = () => { const n = step + 1; setRun({ ...run, [key]: n }); if (n === 3) sendAll(); setMsg(['', 'Pay run approved by the owner', `${cedi(tot.net)} paid to ${staff.length} staff via Hubtel`, `Payslips sent on WhatsApp to ${staff.length} staff`][n]); };
    if (step === 0) S('Approve the pay run', go); else go();
  };
  const sendAll = () => { const map = Object.fromEntries(rows.map((r) => [r.e.name, snapOf(r, key)])); setSlips({ ...slips, [key]: map }); setFlash(`Payslips sent to ${rows.length} staff`); };
  const sendOne = (name: string) => { const r = rows.find((x) => x.e.name === name); if (!r) return; setSlips({ ...slips, [key]: { ...sentNow, [name]: snapOf(r, key) } }); setFlash(`Sent. ${name} can now open, print or download this payslip in My HR.`); };
  /** Statutory schedules as CSV: GRA PAYE and SSNIT contributions. */
  const schedules = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const paye = [['Employee', 'TIN', 'Gross', 'SSNIT (5.5%)', 'Taxable', 'PAYE'], ...rows.map((r) => [r.e.name, r.m.tin || '', r.pay.gross.toFixed(2), r.pay.ssnit.toFixed(2), r.pay.taxable.toFixed(2), r.pay.tax.toFixed(2)])];
    const ssnit = [['Employee', 'SSNIT number', 'Basic', 'Employee 5.5%', 'Employer 13%', 'Total 18.5%', 'Tier 1 (13.5%)', 'Tier 2 (5%)'], ...rows.map((r) => [r.e.name, r.e.ssnit || '', r.pay.basic.toFixed(2), r.pay.ssnit.toFixed(2), r.pay.employer.toFixed(2), (r.pay.ssnit + r.pay.employer).toFixed(2), (r.pay.basic * 0.135).toFixed(2), (r.pay.basic * 0.05).toFixed(2)])];
    [[`gra-paye-schedule-${key}.csv`, paye], [`ssnit-contribution-report-${key}.csv`, ssnit]].forEach(([n, L]) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + (L as (string | number)[][]).map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' })); a.download = n as string; a.click(); });
    setMsg('GRA PAYE schedule and SSNIT report downloaded');
  };
  const years = [now.getFullYear() - 1, now.getFullYear()];
  const inp = 'h-10 px-3.5 rounded-full border border-line text-sm font-normal w-full';
  const yearSent = Object.entries(slips).filter(([k]) => k.startsWith(String(yr)));
  const yearTotal = yearSent.reduce((a, [, v]) => a + Object.values(v).reduce((b, s) => b + s.pay.net, 0), 0);
  const yearCount = yearSent.reduce((a, [, v]) => a + Object.keys(v).length, 0);
  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Payroll · {label}</h1><p className="m-0 text-sm text-muted">Monthly pay run across every branch · hours come from the QR time clock, commission from till sales, leave from People & HR</p></div>
      </header>
      <Msg text={msg} onClose={() => setMsg('')} />
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex gap-1.5 flex-wrap">{STEPS.map((s, i) => <span key={s} className={cx('text-[13px] px-3.5 py-2 rounded-full border', i <= step ? 'bg-black text-white border-black' : 'bg-white border-line text-sub')}>{s}</span>)}</div>
        <div className="flex gap-3 items-center flex-wrap"><button onClick={advance} disabled={step >= 3} className="btn-primary disabled:opacity-60">{BTN[step]}</button><span className="text-sm text-muted">{NOTE[step]}</span></div>
      </section>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{([['Gross pay', cedi(tot.gross), `${staff.length} employees · ${brs} branches`], ['Net pay to staff', cedi(tot.net), `${momo} by MoMo · ${staff.length - momo} by bank`], ['PAYE to GRA', cedi(tot.tax), 'Due by the 15th of next month'], ['SSNIT (employee + employer)', cedi(tot.ssnit), `18.5% of ${cedi(basic)} basic`]] as [string, string, string][]).map(([k, v, s]) => <div key={k} className="card p-4 flex flex-col gap-0.5"><span className="text-xs text-muted">{k}</span><b className="text-lg">{v}</b><span className="text-xs text-muted">{s}</span></div>)}</div>
      <section className="card p-5 flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold">Pay period</h2>
        <div className="flex gap-1.5">{years.map((y) => <button key={y} onClick={() => setYr(y)} aria-pressed={yr === y} className={cx('h-9 px-3.5 rounded-full text-sm border', yr === y ? 'bg-black text-white border-black' : 'border-line')}>{y}</button>)}</div>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">{MON.map((x, i) => { const k = monthKey(yr, i); const n = Object.keys(slips[k] || {}).length; const fut = yr > now.getFullYear() || (yr === now.getFullYear() && i > now.getMonth()); return <button key={x} onClick={() => setM(i)} aria-pressed={m === i} className={cx('py-2 rounded-xl text-sm font-semibold border flex flex-col items-center', m === i ? 'bg-black text-white border-black' : n ? 'bg-green-100 text-green-800 border-green-200' : fut ? 'border-line text-[#bbb]' : 'border-line hover:bg-canvas')}>{x}{n ? <span className="text-[10px] font-normal">{n} sent</span> : null}</button>; })}</div>
        <span className="text-xs text-muted">{future ? `${label} has not happened yet — sending now records it in advance.` : `Pay run for ${label}. Pick another month to send or re-send its payslips.`}</span>
      </section>
      <div className="grid gap-6 2xl:grid-cols-[1fr_460px] items-start">
        <section className="card p-5 flex flex-col gap-3">
          <div className="flex justify-between gap-2 flex-wrap"><h2 className="m-0 text-lg font-semibold">Employees</h2><span className="text-xs text-muted">Demo figures · PAYE uses the GRA monthly bands loaded in settings</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm border-collapse min-w-[900px]"><thead><tr>{['Employee', 'Basic', 'Overtime', 'Commission', 'Gross', 'SSNIT 5.5%', 'PAYE', 'Advance', 'Net pay', 'Paid to', ''].map((h) => <th key={h} className="text-left text-xs font-semibold text-muted px-2 py-2 border-b border-line">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.e.id} onClick={() => setSel(r.e.name)} className={cx('cursor-pointer', cur?.e.name === r.e.name ? 'bg-canvas' : 'hover:bg-canvas/60')}>
              <td className="px-2 py-2 border-b border-line"><b>{r.e.name}</b><br /><span className="text-xs text-muted">{r.e.level}{sentNow[r.e.name] ? ' · ✓ sent' : ''}</span></td>
              {[r.pay.basic, r.pay.ot, r.pay.comm, r.pay.gross, r.pay.ssnit, r.pay.tax, r.pay.adv].map((v, i) => <td key={i} className="px-2 py-2 border-b border-line whitespace-nowrap">{cedi(v)}</td>)}
              <td className="px-2 py-2 border-b border-line font-semibold whitespace-nowrap">{cedi(r.pay.net)}</td><td className="px-2 py-2 border-b border-line text-xs">{defaultMethod(r.e)}</td>
              <td className="px-2 py-2 border-b border-line"><button onClick={(ev) => { ev.stopPropagation(); setEdit({ name: r.e.name, f: { ...r.m } }); }} className="text-xs font-semibold underline">Edit</button></td></tr>)}</tbody></table></div>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-canvas p-4">
            <button onClick={sendAll} className={cx('w-fit', flash.startsWith('Payslips sent') ? 'h-11 px-5 rounded-full bg-green-700 text-white font-semibold' : 'btn-primary')}>{flash.startsWith('Payslips sent') ? flash : nSent ? `Re-send ${MONTHS[m]} payslips to ${rows.length} staff` : `Send ${label} payslips to ${rows.length} staff`}</button>
            <span className="text-xs text-muted">{flash.startsWith('Payslips sent') ? `Each person can now view, print or download ${label} in My HR.` : nSent ? `${nSent} payslips already sent for ${MONTHS[m]}. Sending again replaces them.` : `Builds a ${label} payslip for every employee and puts it in their own account.`}</span>
          </div>
        </section>
        <div className="flex flex-col gap-4">
          {cur && curSnap && (
            <section className="card p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 pb-2 border-b border-line"><img src={companyLogo()} alt="" className="w-9 h-9 object-contain" /><span className="flex flex-col"><b className="text-sm">{curSnap.company.name}</b><span className="text-xs text-muted">Payslip · {label}</span></span></div>
              <b>{cur.e.name}</b><span className="text-xs text-muted">{cur.e.level} · {cur.pay.hours} hours from the QR time clock</span>
              {([['Gross', cur.pay.gross, ''], ['SSNIT (employee)', cur.pay.ssnit, '−'], ['PAYE', cur.pay.tax, '−'], ['Salary advance', cur.pay.adv, '−']] as [string, number, string][]).map(([k, v, s]) => <div key={k} className="flex justify-between text-sm"><span>{s ? `${s} ${k}` : k}</span><span>{cedi(v)}</span></div>)}
              <div className="flex justify-between font-semibold border-t border-line pt-2"><span>Net pay</span><span>{cedi(cur.pay.net)}</span></div>
              <span className="text-xs text-muted">Leave: {curSnap.leaveLeft} days left · paid to {defaultMethod(cur.e)}</span>
              <button onClick={() => sendOne(cur.e.name)} className={cx('w-fit', sentNow[cur.e.name] && flash.includes(cur.e.name) ? 'h-10 px-4 rounded-full bg-green-700 text-white text-sm font-semibold' : 'btn-dark')}>{sentNow[cur.e.name] && flash.includes(cur.e.name) ? `Sent to ${cur.e.name.split(' ')[0]}` : `Send this payslip to ${cur.e.name.split(' ')[0]}`}</button>
              {flash && !flash.startsWith('Payslips sent') && <span className="text-xs text-ok">{flash}</span>}
            </section>
          )}
          <section className="rounded-4xl bg-black text-white p-5 flex flex-col gap-2"><h2 className="m-0 text-base font-semibold">Statutory returns</h2><span className="text-sm text-white/80">GRA PAYE schedule and SSNIT contribution report are ready to file. Employer SSNIT 13% is added on top of basic pay; of the 18.5% total, 13.5% goes to Tier 1 and 5% to Tier 2.</span><button onClick={schedules} className="h-10 px-4 rounded-full bg-white text-black text-sm font-semibold w-fit">Download schedules</button></section>
          <section className="card p-5 flex flex-col gap-1.5 text-sm"><h2 className="m-0 text-base font-semibold">Other countries &amp; links</h2><span>UK stores: PAYE, National Insurance, pension auto-enrolment and RTI to HMRC.</span><span>US and Canada stores: hand-off to Gusto, ADP or Wagepoint.</span><span>Wages journal posts to accounting; staff records sync with the HR system.</span></section>
          <section className="card p-5 flex flex-col gap-2">
            <button onClick={() => setCoOpen(!coOpen)} aria-expanded={coOpen} className="text-left font-semibold">Company details on the payslip {coOpen ? '▴' : '▾'}</button>
            {coOpen && <>{([['addr', 'Street address'], ['tel', 'Telephone'], ['email', 'Payroll email'], ['tin', 'Employer TIN']] as [keyof Company, string][]).map(([k, l]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l}<input value={co[k]} onChange={(e) => setCo({ ...co, [k]: e.target.value })} className={inp} /></label>)}
              <span className="text-xs text-muted">These appear under {co.name} at the top of every payslip. Leave a line blank and it is left off.</span>
              <button onClick={() => { localStorage.setItem(CO_KEY, JSON.stringify({ addr: co.addr, tel: co.tel, email: co.email, tin: co.tin })); setMsg('Company details saved'); setCoOpen(false); }} className="btn-primary w-fit">Save</button></>}
          </section>
        </div>
      </div>
      {curSnap && (
        <section className="card p-5 flex flex-col gap-3">
          <div className="flex justify-between gap-2 flex-wrap items-center"><div><h2 className="m-0 text-lg font-semibold">Payslip for {curSnap.name}</h2><span className="text-xs text-muted">{sentNow[curSnap.name] ? 'This is exactly what the employee opens in My HR.' : 'A preview. Send the payslips to put this in each employee account.'}</span></div>
            <div className="flex gap-2 flex-wrap items-center"><div role="group" aria-label="Paper size" className="flex gap-1 p-1 rounded-full bg-canvas">{([['A4', 'A4 (210 × 297 mm)'], ['Letter', 'Letter (8.5 × 11 in)']] as [Paper, string][]).map(([k, l]) => <button key={k} onClick={() => setPaper(k)} aria-pressed={paper === k} className={cx('h-8 px-3 rounded-full text-xs font-semibold', paper === k ? 'bg-black text-white' : '')}>{l}</button>)}</div>
              <button onClick={() => printPayslip(curHtml)} className="btn-dark">Print or save as PDF</button><button onClick={() => downloadPayslip(curHtml, curSnap)} className="btn-ghost">Download</button></div></div>
          <PayslipFrame html={curHtml} title={`Payslip for ${curSnap.name}`} />
        </section>
      )}
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between gap-2 flex-wrap"><h2 className="m-0 text-lg font-semibold">Payslips through {yr}</h2><span className="text-xs text-muted">{yearCount ? `${yearCount} payslips sent in ${yr} · ${cedi(yearTotal)} paid out` : `Nothing sent for ${yr} yet`}</span></div>
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[860px]"><thead><tr><th className="text-left text-xs text-muted font-semibold px-2 py-2">Employee</th>{MON.map((x) => <th key={x} className="text-xs text-muted font-semibold px-1 py-2">{x}</th>)}<th className="text-left text-xs text-muted font-semibold px-2">Paid</th><th className="text-left text-xs text-muted font-semibold px-2">Net for the year</th></tr></thead>
          <tbody>{rows.map((r) => { const cells = MON.map((_, i) => slips[monthKey(yr, i)]?.[r.e.name]); const paid = cells.filter(Boolean).length; return <tr key={r.e.id} className="border-t border-line">
            <td className="px-2 py-2"><b>{r.e.name}</b><br /><span className="text-xs text-muted">{r.e.level} · {snapOf(r, key).no}</span></td>
            {cells.map((c, i) => { const fut = yr > now.getFullYear() || (yr === now.getFullYear() && i > now.getMonth()); return <td key={i} className="text-center"><button onClick={() => { setM(i); setSel(r.e.name); }} aria-label={`${r.e.name} ${MONTHS[i]}`} className={cx('w-8 h-8 rounded-lg text-sm', c ? 'bg-green-100 text-green-800 font-bold' : fut ? '' : 'text-muted hover:bg-canvas')}>{c ? '✓' : fut ? '' : '–'}</button></td>; })}
            <td className="px-2 text-xs">Paid {paid} of 12</td><td className="px-2 font-semibold whitespace-nowrap">{cedi(cells.reduce((a, c) => a + (c?.pay.net || 0), 0))}</td></tr>; })}</tbody></table></div>
        <span className="text-xs text-muted">A green tick means that month's payslip is in the employee's account. Click any month to open it, change it, and send or re-send it.</span>
      </section>
      {edit && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={() => setEdit(null)}>
          <section role="dialog" aria-modal="true" aria-label={`Edit payslip details · ${edit.name}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-4xl p-6 flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold">Edit payslip details · {edit.name}</h2>
            <span className="text-xs text-muted">Only {edit.name}’s payslip changes. The staff number is generated by the system and stays with them.</span>
            <div className="grid sm:grid-cols-2 gap-2">
              {([['tin', 'TIN / Tax number', 'GHA-000000000-0'], ['grade', 'Pay grade', 'G3'], ['type', 'Employee type', 'Permanent Staff (Full-time)'], ['bank', 'Bank or network', 'GCB Bank'], ['bankBr', 'Bank branch', ''], ['acct', 'Account or MoMo number', '']] as [keyof PayMeta, string, string][]).map(([k, l, ph]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l}<input value={String(edit.f[k] ?? '')} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} placeholder={ph} className={inp} /></label>)}
              {([['allow', 'Employee allowances'], ['other', 'Other allowances'], ['loan', 'Loan deduction'], ['union', 'Union dues'], ['adv', 'Salary advance']] as [keyof PayMeta, string][]).map(([k, l]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l} (GHS)<input inputMode="decimal" value={String(edit.f[k] || '')} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0 } })} placeholder="0.00" className={inp} /></label>)}
              <label className="text-xs font-semibold flex flex-col gap-1 sm:col-span-2">Payment date<input value={edit.f.payDate} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, payDate: e.target.value } })} placeholder="Left blank, the payslip uses the last day of the pay month." className={inp} />
                <span className="flex gap-2 font-normal"><button type="button" onClick={() => setEdit({ ...edit, f: { ...edit.f, payDate: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } })} className="text-xs underline">Use today's date and time</button><button type="button" onClick={() => setEdit({ ...edit, f: { ...edit.f, payDate: new Date(yr, m + 1, 0).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) } })} className="text-xs underline">Use the end of the month</button></span></label>
            </div>
            <div className="flex gap-2 justify-end"><button onClick={() => setEdit(null)} className="btn-ghost">Cancel</button><button onClick={() => { setMeta({ ...meta, [edit.name]: edit.f }); setFlash(`Saved. ${edit.name}’s payslip is updated — send it so they get the new copy.`); setSel(edit.name); setEdit(null); }} className="btn-primary">Save details</button></div>
          </section>
        </div>
      )}
    </>
  );
}
