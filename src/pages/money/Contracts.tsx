import { useState } from 'react';
import Icon from '../../components/Icon';
import { cx, ghs } from '../../lib/format';
import { usePersist, nowTxt } from '../../lib/persist';
import { Card, Pills, T } from '../finance/shared';
import { download, Head, Msg } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DUE = 18000;
type Pay = { date: string; month: number; ref: string; amount: number; void: boolean };
const PAYS0: Pay[] = MONTHS.slice(0, 10).map((_, k) => ({ date: `${12 + (k % 9)} ${MONTHS[Math.min(11, k + 1)]} 2026`, month: k, ref: `GCB-77${100 + k * 3}`, amount: k === 7 ? 12000 : k === 9 ? 0 : DUE, void: false })).filter((p) => p.amount > 0);
const DOCS = [['Main subcontract agreement', 'Contract', '6 Jan 2026'], ['Insurance certificate', 'Certificate', '6 Jan 2026'], ['Bank advice · August', 'Payment', '21 Sep 2026'], ['Bank advice · September', 'Payment', '19 Oct 2026']];

export default function Contracts() {
  const [tab, setTab] = useState<'details' | 'payments' | 'docs' | 'report'>('details');
  const [contract, setContract] = useState('Tema Port warehouse · cleaning & supply');
  const [pays, setPays] = usePersist<Pay[]>('ecompos.contractPays2', PAYS0);
  const [docs, setDocs] = usePersist<string[][]>('ecompos.contractDocs2', DOCS);
  const [form, setForm] = useState<{ month: number; ref: string } | null>(null);
  const [q, setQ] = useState('');
  const [upload, setUpload] = useState<string>('');
  const [msg, setMsg] = useState('');
  const paidOf = (k: number) => pays.filter((p) => p.month === k && !p.void).reduce((a, p) => a + p.amount, 0);
  const months = MONTHS.map((name, k) => { const paid = paidOf(k); const due = k <= 9; return { name, k, paid, owed: due ? DUE - paid : 0, state: !due ? 'Not yet due' : paid >= DUE ? 'Paid' : paid > 0 ? 'Part paid' : 'Unpaid' }; });
  const arrears = months.filter((m) => m.owed > 0);
  const arrearsTotal = arrears.reduce((a, m) => a + m.owed, 0);
  const paidTotal = months.reduce((a, m) => a + m.paid, 0);
  const kpis: [string, string][] = [['Monthly payment', ghs(DUE)], ['Due Jan–Oct', ghs(DUE * 10)], ['Received', ghs(paidTotal)], ['In arrears', ghs(arrearsTotal)]];
  const record = () => { if (!form) return; if (!form.ref.trim()) return setMsg('Enter the bank reference first.'); const owed = DUE - paidOf(form.month); setPays((x) => [{ date: nowTxt(), month: form.month, ref: form.ref.trim(), amount: owed, void: false }, ...x]); setMsg(`${ghs(owed)} recorded for ${MONTHS[form.month]} 2026`); setForm(null); };

  return (
    <>
      <Head title="Contracts" sub="Subcontracting work · track monthly payments, arrears and documents">
        <label className="flex flex-col gap-1 text-xs font-semibold">Contract<select value={contract} onChange={(e) => setContract(e.target.value)} className="px-4 py-2.5 rounded-full border border-line font-normal text-sm"><option>Tema Port warehouse · cleaning & supply</option><option>KNUST hostel canteen supply</option></select></label>
        <button onClick={() => setMsg('New contract form opened · add the main contractor, start date and monthly amount')} className="btn-primary self-end">New contract</button>
      </Head>
      <Pills opts={[['details', 'Details'], ['payments', 'Payments'], ['docs', 'Documents'], ['report', 'Report']]} value={tab} onChange={setTab} />
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">{kpis.map(([l, v]) => <div key={l} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><strong className={cx('text-[24px] font-medium tracking-tightest', l === 'In arrears' && arrearsTotal ? 'text-danger' : '')}>{v}</strong></div>)}</div>

      {tab === 'details' && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card><span className="text-xs uppercase text-muted">Subcontractor · us</span><h2 className="m-0 text-lg font-semibold">Ebenezer Unique Ventures Ltd</h2><span className="text-sm text-muted">12 Oxford Street, Osu, Accra · accounts@ebenezerunique.com.gh</span><span className="text-sm">Signatory: Ebenezer Mensah, Managing Director</span></Card>
            <Card><span className="text-xs uppercase text-muted">Main contractor</span><h2 className="m-0 text-lg font-semibold">[Main contractor name]</h2><span className="text-sm text-muted">Tema Industrial Area · [contact email]</span><span className="text-sm">Contact: [name], Procurement</span></Card>
          </div>
          <Card title="Months · 2026">
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">{months.map((m) => <button key={m.name} onClick={() => m.owed > 0 && (setForm({ month: m.k, ref: '' }), setTab('payments'))} title={`${m.name}: ${m.state}`} className={cx('p-2 rounded-xl text-center text-xs border', m.state === 'Paid' ? 'bg-black text-white border-black' : m.state === 'Not yet due' ? 'bg-canvas text-muted border-canvas' : 'bg-white border-black')}><b className="block">{m.name}</b>{m.state}</button>)}</div>
            <span className="text-xs text-muted">Black = paid in full · white = in arrears · grey = not yet due</span>
            {arrearsTotal > 0 && <span className="text-sm text-danger font-semibold">Payments in arrears: {ghs(arrearsTotal)} · {arrears.length} months unpaid or part paid</span>}
          </Card>
        </>
      )}

      {tab === 'payments' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px] items-start">
          <div className="flex flex-col gap-6">
            <Card title="Arrears">
              <label className="text-[13px] font-semibold flex flex-col gap-1">Search payments<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search month, reference or amount" className="field py-2 font-normal" /></label>
              <T head={['Month', 'Due', 'Paid', 'Owed', 'Action']} rows={arrears.filter((m) => !q || (m.name + m.owed).toLowerCase().includes(q.toLowerCase())).map((m) => [`${m.name} 2026`, ghs(DUE), ghs(m.paid), <b key="o" className="text-danger">{ghs(m.owed)}</b>, <button key="r" onClick={() => setForm({ month: m.k, ref: '' })} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Record payment</button>])} />
            </Card>
            <Card title="Payments received">
              {pays.filter((p) => !q || (MONTHS[p.month] + p.ref + p.amount).toLowerCase().includes(q.toLowerCase())).map((p, i) => <div key={i} className={cx('flex items-center gap-3 p-3 rounded-2xl border border-line text-sm flex-wrap', p.void && 'opacity-60')}><span className="flex-1 min-w-[200px]">{p.date}<br /><span className="text-xs text-muted">{MONTHS[p.month]} 2026 · ref {p.ref}</span></span><b className={p.void ? 'line-through' : ''}>{ghs(p.amount)}</b>{p.void && <span className="pill bg-red-100 text-red-800">Voided</span>}<button onClick={() => setPays((x) => x.map((y) => (y === p ? { ...y, void: !y.void } : y)))} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">{p.void ? 'Restore' : 'Void'}</button></div>)}
            </Card>
          </div>
          <Card title="Record payment">
            {!form ? <span className="text-sm text-muted">Pick a month in Arrears to record its payment.</span> : (
              <>
                <label className="text-[13px] font-semibold flex flex-col gap-1">For month<input readOnly value={`${MONTHS[form.month]} 2026`} className="field py-2 font-normal bg-canvas" /></label>
                <label className="text-[13px] font-semibold flex flex-col gap-1">Amount (GHS)<input readOnly value={(DUE - paidOf(form.month)).toFixed(2)} className="field py-2 font-normal bg-canvas" /></label>
                <label className="text-[13px] font-semibold flex flex-col gap-1">Bank reference<input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="From the bank advice" className="field py-2 font-normal" /></label>
                <button onClick={record} className="btn-primary">Save payment</button>
              </>
            )}
            <span className="text-xs text-muted">A wrong entry is voided, not deleted, and can be restored.</span>
          </Card>
        </div>
      )}

      {tab === 'docs' && (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <Card title="Upload a payment document" sub="Bank advice, remittance or certificate · PDF or photo">
            <label className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-line cursor-pointer hover:bg-canvas text-sm"><Icon name="documents" size={26} className="text-brand" />Choose a file<input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => setUpload(e.target.files?.[0]?.name ?? '')} /></label>
            {upload && (
              <div className="p-4 rounded-2xl bg-canvas flex flex-col gap-2">
                <strong className="text-sm">AI extraction · review before saving</strong>
                {[['File', upload], ['Payer', '[Main contractor name]'], ['Amount', ghs(18000)], ['Reference', 'GCB-77120'], ['For month', 'August 2026']].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="text-muted">{k}</span><b>{v}</b></div>)}
                <span className="text-xs text-danger">Possible duplicate: a GHS 18,000.00 payment with reference GCB-77120 was already recorded for August 2026. Save anyway only if this is a second payment.</span>
                <button onClick={() => { setPays((x) => [{ date: nowTxt(), month: 7, ref: 'GCB-77120', amount: DUE - paidOf(7), void: false }, ...x]); setDocs((d) => [[upload, 'Payment', nowTxt()], ...d]); setUpload(''); setMsg('Saved to the register and recorded as a payment for August'); }} className="btn-primary w-fit">Save and record as payment</button>
              </div>
            )}
          </Card>
          <Card title="Document register">{docs.map((d, i) => <div key={i} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span>{d[0]}</span><span className="text-muted">{d[1]} · {d[2]}</span></div>)}</Card>
        </div>
      )}

      {tab === 'report' && (
        <>
          <Card title="Due vs paid · 2026" sub="Grey = due · violet = paid">
            <div className="flex items-end gap-2 h-44">{months.slice(0, 10).map((m) => <div key={m.name} className="flex-1 flex items-end gap-0.5 h-full" title={`${m.name}: due ${ghs(DUE)}, paid ${ghs(m.paid)}`}><div className="flex-1 bg-[#d9d9d9] rounded-t" style={{ height: '100%' }} /><div className="flex-1 bg-[#6b3fa0] rounded-t" style={{ height: `${(m.paid / DUE) * 100}%` }} /></div>)}</div>
            <div className="flex gap-2">{months.slice(0, 10).map((m) => <span key={m.name} className="flex-1 text-center text-[11px] text-muted">{m.name}</span>)}</div>
          </Card>
          <Card title="Summary" actions={<div className="flex gap-2"><button onClick={() => window.print()} className="btn-ghost min-h-9 text-xs">Export PDF</button><button onClick={() => download('contract-2026.xls', [['Month', 'Due', 'Paid', 'Owed'], ...months.slice(0, 10).map((m) => [m.name, DUE, m.paid, m.owed])])} className="btn-ghost min-h-9 text-xs">Export Excel</button><button onClick={() => download('contract-2026.csv', [['Month', 'Due', 'Paid', 'Owed'], ...months.slice(0, 10).map((m) => [m.name, DUE, m.paid, m.owed])])} className="btn-ghost min-h-9 text-xs">Export CSV</button></div>}>
            <p className="m-0 text-sm print-doc">From January to October 2026 the main contractor owed {ghs(DUE * 10)} at a monthly payment of {ghs(DUE)}. {ghs(paidTotal)} has been received and {ghs(arrearsTotal)} is in arrears across {arrears.length} months. The average payment delay is 19 days after the due date.</p>
            <div className="grid grid-cols-2 gap-8 mt-4 text-xs">{['Prepared by · Ebenezer Mensah, Ebenezer Unique Ventures Ltd · Date', 'Acknowledged by · [Main contractor] · Date'].map((l) => <div key={l}><span className="block h-10 border-b border-black" />{l}</div>)}</div>
          </Card>
        </>
      )}
    </>
  );
}
