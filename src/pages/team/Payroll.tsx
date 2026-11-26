import { useState } from 'react';
import { brName } from '../../data/catalogue';
import { EMPS0, payslip, type Emp } from '../../data/people';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { download, Msg } from '../money/ui';

import PayslipDoc, { X0, type PayExtra } from './PayslipDoc';
import { PEOPLE } from '../../data/nav';
import { CLOCK_KEY, monthHours, type Clock } from '../../data/clock';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
type Extra = PayExtra;
const STEPS = ['1. Review', '2. Approved by owner', '3. Paid via Hubtel', '4. Payslips sent'];

export default function Payroll() {
  const { session, viewBranch, stepUp: S } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const RUN = SU || role === 'manager';
  // Hours worked come from the HR QR time clock (data/clock.ts): closed shifts in the payslip month.
  const [clock] = usePersist<Clock[]>(CLOCK_KEY, []);
  const hoursOf = (n: string) => monthHours(clock, n, 2026, m);
  const [E] = usePersist<Emp[]>('ecompos.staff2', EMPS0);
  const [ext, setExt] = usePersist<Record<string, Extra>>('ecompos.payExtra2', {});
  const [run, setRun] = usePersist<Record<string, number>>('ecompos.payRun2', { '2026-9': 3, '2026-8': 3 });
  const now = new Date();
  const [m, setM] = useState(now.getMonth());
  const [sel, setSel] = useState('e2');
  const [edit, setEdit] = useState<string>('');
  const [msg, setMsg] = useState('');
  const scope = SU ? viewBranch : session?.branch ?? 'osu';
  const staff = E.filter((e) => e.status !== 'Suspended' && (scope === 'all' || e.br === scope || (SU && e.br === 'all')));
  const key = `2026-${m}`;
  const step = run[key] ?? 0;
  const xs = (e: Emp) => ext[e.id] ?? X0;
  const slips = staff.map((e) => ({ e, x: xs(e), p: payslip(e, xs(e)) }));
  const tot = slips.reduce((a, s) => ({ gross: a.gross + s.p.gross, net: a.net + s.p.net, tax: a.tax + s.p.tax, ssnit: a.ssnit + s.p.ssnit + s.p.employer }), { gross: 0, net: 0, tax: 0, ssnit: 0 });
  const basic = staff.reduce((a, e) => a + e.basic, 0);
  const cur = slips.find((s) => s.e.id === sel) ?? slips[0];
  const advance = () => { const n = Math.min(4, step + 1); setRun({ ...run, [key]: n }); setMsg(['', 'Pay run approved by the owner', `${ghs(tot.net)} paid to ${staff.length} staff via Hubtel`, `Payslips sent on WhatsApp to ${staff.length} staff`][n]); };
  const ed = edit ? { e: staff.find((x) => x.id === edit)!, x: { ...xs(staff.find((x) => x.id === edit)!) } } : null;
  const [form, setForm] = useState<Extra>(X0);

  if (!RUN) {
    const meE = E.find((e) => e.name === PEOPLE[role].name);
    return (
      <>
        <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">My payslips</h1><p className="m-0 text-sm text-muted">Only you can see your payslips. Running payroll is done by the Admin.</p></header>
        <div className="flex gap-1.5 flex-wrap">{MON.map((x, i) => <button key={x} disabled={i > now.getMonth() - (now.getDate() < 25 ? 1 : 0)} onClick={() => setM(i)} aria-pressed={m === i} className={cx('px-3 py-1.5 rounded-full text-sm border', m === i ? 'bg-black text-white border-black' : 'border-line disabled:opacity-40')}>{x}</button>)}</div>
        {meE ? <div className="max-w-xl"><PayslipDoc e={meE} x={xs(meE)} month={`${FULL[m]} 2026`} hours={hoursOf(meE.name)} /></div> : <div className="card p-5 text-sm">No pay record is set up for you yet. Ask your Manager.</div>}
      </>
    );
  }
  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Payroll · {FULL[m]} 2026</h1><p className="m-0 text-sm text-muted">Monthly pay run across every branch · hours come from the QR time clock, commission from till sales, leave from People & HR</p></div>
        <div className="flex gap-1.5 flex-wrap">{STEPS.map((s, i) => <span key={s} className={cx('text-[13px] px-3.5 py-2 rounded-full border', i === step ? 'bg-black text-white border-black' : i < step ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white border-line text-sub')}>{i < step ? '✓ ' : ''}{s}</span>)}</div>
      </header>
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">{[['Gross pay', ghs(tot.gross), `${staff.length} employees · ${new Set(staff.map((e) => e.br).filter((b) => b !== 'all')).size} branches`], ['Net pay to staff', ghs(tot.net), `${staff.filter((e) => e.pay.startsWith('MoMo')).length} by MoMo · ${staff.filter((e) => e.pay.startsWith('Bank')).length} by bank`], ['PAYE to GRA', ghs(tot.tax), 'Due by the 15th of next month'], ['SSNIT (employee + employer)', ghs(tot.ssnit), `18.5% of ${ghs(basic)} basic`]].map(([l, v, n]) => <div key={l} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><strong className="text-[26px] font-medium tracking-tightest">{v}</strong><span className="text-xs text-sub">{n}</span></div>)}</div>
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center"><h2 className="m-0 text-lg font-semibold">Pay period · {FULL[m]} 2026</h2><span className="pill bg-black text-white px-3 py-1.5">2026</span></div>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">{MON.map((x, i) => <button key={x} disabled={i > now.getMonth()} onClick={() => setM(i)} aria-pressed={m === i} className={cx('py-2 rounded-xl text-sm font-semibold border', m === i ? 'bg-black text-white border-black' : 'border-line hover:bg-canvas disabled:text-[#c9c6c4] disabled:hover:bg-transparent')}>{x}</button>)}</div>
        <span className="text-xs text-muted">Pay run for {FULL[m]} 2026. {step >= 4 ? 'Payslips sent.' : 'Pick another month to send or re-send its payslips.'}</span>
      </section>
      <div className="grid gap-6 2xl:grid-cols-[1fr_440px] items-start">
        <section className="card p-5 flex flex-col gap-3 min-w-0">
          <div className="flex justify-between gap-2 flex-wrap"><h2 className="m-0 text-lg font-semibold">Employees</h2><span className="text-xs text-muted">Demo figures · PAYE uses the GRA monthly bands loaded in settings</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm border-collapse min-w-[880px]"><thead><tr>{['Employee', 'Basic', 'Overtime', 'Commission', 'Gross', 'SSNIT 5.5%', 'PAYE', 'Advance', 'Net pay', 'Paid to', ''].map((h) => <th key={h} className="text-left text-xs font-semibold text-muted px-2 py-2 border-b border-line">{h}</th>)}</tr></thead><tbody>{slips.map(({ e, x, p }) => <tr key={e.id} onClick={() => setSel(e.id)} className={cx('cursor-pointer', cur?.e.id === e.id ? 'bg-canvas' : 'hover:bg-canvas/50')}><td className="px-2 py-2.5 border-b border-line"><b>{e.name}</b><br /><span className="text-xs text-muted">{e.title} · {e.br === 'all' ? 'All branches' : brName(e.br)}</span></td><td className="px-2 border-b border-line">{ghs(e.basic)}</td><td className="px-2 border-b border-line">{x.ot ? ghs(x.ot) : '—'}</td><td className="px-2 border-b border-line">{x.comm ? ghs(x.comm) : '—'}</td><td className="px-2 border-b border-line">{ghs(p.gross)}</td><td className="px-2 border-b border-line">{ghs(p.ssnit)}</td><td className="px-2 border-b border-line">{ghs(p.tax)}</td><td className="px-2 border-b border-line">{x.adv ? ghs(x.adv) : '—'}</td><td className="px-2 border-b border-line font-semibold">{ghs(p.net)}</td><td className="px-2 border-b border-line">{e.pay}</td><td className="px-2 border-b border-line">{RUN && step === 0 && <button onClick={(ev) => { ev.stopPropagation(); setEdit(e.id); setForm({ ...x }); }} className="text-xs underline">Edit</button>}</td></tr>)}</tbody></table></div>
          {RUN && step < 4 && <button onClick={() => S(['Approve the pay run', 'Pay staff via Hubtel', 'Send payslips', ''][step], advance)} className="btn-primary w-fit">{['Approve pay run', 'Pay via Hubtel', 'Send payslips on WhatsApp', ''][step]}{step === 1 ? ` · ${ghs(tot.net)}` : ''}</button>}
        </section>
        <div className="flex flex-col gap-6">
          {cur && <PayslipDoc e={cur.e} x={cur.x} month={`${FULL[m]} 2026`} hours={hoursOf(cur.e.name)} />}
          <section className="rounded-4xl bg-black text-white p-5 flex flex-col gap-2"><h2 className="m-0 text-base font-semibold">Statutory returns</h2><span className="text-sm text-white/80">GRA PAYE schedule and SSNIT contribution report are ready to file. Employer SSNIT 13% is added on top of basic pay; of the 18.5% total, 13.5% goes to Tier 1 and 5% to the Tier 2 fund.</span><button onClick={() => download(`paye-ssnit-${MON[m]}-2026.csv`, [['Employee', 'SSNIT no.', 'Basic', 'Employee SSNIT 5.5%', 'Employer SSNIT 13%', 'Taxable', 'PAYE'], ...slips.map(({ e, p }) => [e.name, e.ssnit ?? '', e.basic, p.ssnit, p.employer, (p.gross - p.ssnit).toFixed(2), p.tax])])} className="btn bg-white text-black w-fit">Download schedules</button></section>
        </div>
      </div>
      {ed && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <section role="dialog" aria-modal="true" aria-label={`${ed.e.name} pay details`} className="w-full max-w-lg bg-white rounded-4xl p-6 flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold">{ed.e.name} · pay details</h2>
            <div className="grid grid-cols-2 gap-2">{([['num', 'Staff number'], ['type', 'Pay type'], ['payDate', 'Payment date'], ['tin', 'TIN / Tax number'], ['grade', 'Pay grade'], ['ot', 'Overtime (GHS)'], ['comm', 'Commission (GHS)'], ['allow', 'Employee allowances (GHS)'], ['adv', 'Salary advance (GHS)'], ['loan', 'Loan deduction (GHS)'], ['union', 'Union dues (GHS)'], ['bank', 'Account or MoMo number']] as const).map(([k, l]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l}<input value={String(form[k] ?? '')} onChange={(e) => setForm({ ...form, [k]: typeof X0[k] === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })} className="field py-2 font-normal" /></label>)}</div>
            <div className="flex gap-2 justify-end"><button onClick={() => setEdit('')} className="btn-ghost">Cancel</button><button onClick={() => { setExt({ ...ext, [ed.e.id]: form }); setEdit(''); setMsg(`${ed.e.name}’s details saved`); }} className="btn-primary">Save details</button></div>
          </section>
        </div>
      )}
    </>
  );
}
