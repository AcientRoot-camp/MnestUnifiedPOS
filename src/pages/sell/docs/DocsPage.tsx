import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { Toast } from '../../../components/ui';
import { BRN, SEED as HP_SEED, build, EMPTY_HP } from '../../../data/hirePurchase';
import { PEOPLE } from '../../../data/nav';
import { SALES, WEB_ORDERS } from '../../../data/sell';
import { usePersist } from '../../../lib/persist';
import { useSession } from '../../../lib/session';
import { cx, ghs } from '../../../lib/format';
import { Pills } from '../../finance/shared';
import DocEditor from './DocEditor';
import type { TillSale } from '../../pos/model';
import { SalesInvoice, bizInfo } from '../../pos/Docs';
import { companyBiz, downloadPdf, invoiceDoc, summaryDoc, tillSaleDoc } from '../../../lib/docPdfs';
import { companyLogo } from '../../../lib/brand';
import Intro, { PF_INTRO, introSeen } from '../../../components/Intro';
import { DEFAULT_TERMS, SEED_DOCS, totals, type Doc } from './model';

type Row = { no: string; type: string; code: string; date: string; ts: number; cust: string; phone: string; items: string; by: string; br: string; meth: string; status: string; total: number; group: string; doc?: Doc; sale?: TillSale };
const BRCODE: Record<string, string> = { osu: 'OSU', legon: 'LEG', adum: 'ADM' };
const BRNAME: Record<string, string> = { osu: 'Osu', legon: 'East Legon', adum: 'Adum' };

export default function DocsPage({ mode }: { mode: 'pf' | 'inv' }) {
  const pf = mode === 'pf';
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const me = PEOPLE[role].name;
  const br = session?.branch ?? 'osu';
  const [docs, setDocs] = usePersist<Doc[]>('ecompos.docs2', SEED_DOCS);
  const [till] = usePersist<TillSale[]>('ecompos.sales2', []);
  const [tab, setTab] = useState(pf ? 'sheet' : 'saved');
  const [intro, setIntro] = useState(() => pf && !introSeen('proforma', session?.username || me));
  const [show, setShow] = useState('all');
  const [brF, setBrF] = useState('all');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [prev, setPrev] = useState<number | null>(null);
  const [share, setShare] = useState<null | { title: string; cust: string; phone: string; msg: string }>(null);
  const [zip, setZip] = useState(0);
  const [upPct, setUpPct] = useState(0);
  const [convPct, setConvPct] = useState(0);
  const [listTab, setListTab] = useState('saved');
  const nextNo = (kind: 'pf' | 'inv') => `${kind === 'pf' ? 'PF' : 'INV'}-${BRCODE[br]}-${String(Math.max(0, ...docs.filter((d) => d.kind === kind).map((d) => parseInt(d.no.split('-')[2], 10) || 0)) + 1).padStart(4, '0')}`;
  const blank = (kind: 'pf' | 'inv'): Doc => ({ no: nextNo(kind), kind, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), buyer: 'ind', cust: { name: '', biz: '', addr: '', phone: '', email: '' }, lines: [], discMode: 'none', discVal: '', validUntil: kind === 'pf' ? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) : undefined, advMode: 'pct', advVal: kind === 'pf' ? '50' : '', paid: 0, terms: DEFAULT_TERMS[kind], soldBy: me, br: BRNAME[br], status: kind === 'pf' ? 'Draft' : 'Unpaid', template: 'classic' });
  const [cur, setCur] = useState<Doc>(() => blank(mode));
  const [toast, setToast] = useState('');
  const [savedOpen, setSavedOpen] = useState<Doc | null>(null);
  const [pendingDel, setPendingDel] = useState('');
  const [q, setQ] = useState('');
  const [per, setPer] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [st, setSt] = useState('all');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState(25);
  const [upload, setUpload] = useState<null | { name: string; fields: { field: string; value: string; on: boolean }[] }>(null);
  const isSaved = docs.some((d) => d.no === cur.no);

  const save = () => {
    if (!cur.cust.name.trim()) return setToast('Add the customer first.');
    if (!cur.lines.length) return setToast('Add at least one item.');
    setDocs((L) => (L.some((d) => d.no === cur.no) ? L.map((d) => (d.no === cur.no ? cur : d)) : [cur, ...L]));
    setSavedOpen(cur);
  };
  const convert = () => {
    const inv: Doc = { ...blank('inv'), buyer: cur.buyer, cust: cur.cust, lines: cur.lines, discMode: cur.discMode, discVal: cur.discVal, ref: cur.no, paid: totals(cur).adv, status: totals(cur).adv > 0 ? 'Part paid' : 'Unpaid' };
    setDocs((L) => [inv, ...L.filter((d) => d.no !== cur.no), { ...cur, status: 'Converted' }]);
    setCur({ ...cur, status: 'Converted' });
    setToast(`Converted to invoice ${inv.no}. Open it from Invoices & Receipts.`);
    setConvPct(5); const iv = setInterval(() => setConvPct((x) => { if (x >= 100) { clearInterval(iv); return 100; } return x + 19; }), 250);
  };

  const rows: Row[] = useMemo(() => {
    const own = docs.filter((d) => d.kind === mode && !d.deleted).map((d) => ({ no: d.no, type: d.kind === 'pf' ? 'Pro-forma' : 'Invoice', code: d.no.slice(-4), date: d.date, ts: new Date(d.date).getTime() || Date.now(), cust: d.cust.biz || d.cust.name, phone: d.cust.phone, items: d.lines.map((l) => `${l.qty} × ${l.name}`).join(', '), by: d.soldBy, br: d.br, meth: d.payRef ? 'Bank / MoMo' : '—', status: d.status, total: totals(d).total, group: 'saved', doc: d }));
    if (pf) return own;
    // Sell Now receipts and invoices (receipt code YYMM + 4 digits), newest first.
    const tillDocs = till.filter((t) => !t.training).map((t) => ({ no: t.inv || t.code || t.no, type: t.kind === 'credit' ? 'Credit sale' : 'Sales receipt', code: t.code || t.no.slice(-6), date: new Date(t.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), ts: t.ts, cust: t.biz?.name || t.cust?.name || 'Walk-in customer', phone: t.cust?.phone || '', items: t.lines.map((l) => `${l.qty} × ${l.name}${l.unit && l.unit !== 'single' ? ` (${l.unit})` : ''}`).join(', '), by: t.staff, br: BRNAME[t.br], meth: t.method.split(' · ')[0], status: t.status === 'voided' ? 'Voided' : t.kind === 'credit' && (t.balance || 0) > 0.005 ? 'Owing' : 'Paid', total: t.total, group: t.kind === 'credit' ? 'credit' : 'sales', sale: t }));
    const sales = SALES.slice(0, 160).map((s) => ({ no: (s.method === 'CREDIT' ? 'CS-' : 'RCP-') + s.no, type: s.method === 'CREDIT' ? 'Credit sale' : s.ch === 'web' ? 'Online order receipt' : 'Sales receipt', code: s.no.slice(-6), date: new Date(s.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), ts: s.ts, cust: s.cust, phone: s.phone, items: s.lines.map((l) => `${l.qty} × ${l.name}`).join(', '), by: s.staff, br: BRNAME[s.br], meth: s.method === 'CREDIT' ? 'Credit' : s.method, status: s.status === 'voided' ? 'Voided' : s.method === 'CREDIT' ? 'Owing' : 'Paid', total: s.total, group: s.method === 'CREDIT' ? 'credit' : 'sales' }));
    const hp = HP_SEED.map((a) => { const c = build(a, EMPTY_HP); return { no: a.id, type: 'Hire purchase', code: a.id.slice(-4), date: `05/${String(a.startM + 1).padStart(2, '0')}/${a.startY}`, ts: new Date(a.startY, a.startM, 5).getTime(), cust: a.customer, phone: a.phone, items: a.item, by: 'Ebenezer Mensah', br: BRN[a.branch], meth: 'Instalments', status: c.status, total: c.total + c.dep, group: 'hp' }; });
    const web = WEB_ORDERS.map((o) => ({ no: o.id, type: 'Online order', code: o.trackId, date: o.placed, ts: Date.now(), cust: o.who, phone: o.phone, items: o.items.map((i) => `${i[0]} × ${i[1]}`).join(', '), by: o.ch, br: BRNAME[o.brId], meth: o.pay, status: o.status, total: o.items.reduce((a, i) => a + i[0] * i[2], 0) + o.fee, group: 'web' }));
    return [...own, ...tillDocs, ...sales, ...hp, ...web].sort((a, b) => b.ts - a.ts);
  }, [docs, mode, pf, till]);

  const DAY = 86400000;
  const now0 = new Date();
  const since = per === 'today' ? new Date().setHours(0, 0, 0, 0) : per === 'week' ? new Date(now0.getFullYear(), now0.getMonth(), now0.getDate() - ((now0.getDay() + 6) % 7)).getTime() : per === 'month' ? new Date(now0.getFullYear(), now0.getMonth(), 1).getTime() : per === 'year' ? new Date(now0.getFullYear(), 0, 1).getTime() : 0;
  const fromTs = from ? new Date(from).getTime() : 0; const toTs = to ? new Date(to).getTime() + DAY - 1 : Infinity;
  const stOf = (x: string) => (/Overdue|arrears|Expired|Default/i.test(x) ? 'Overdue' : /Unpaid|Owing|Part/i.test(x) ? 'owing' : /Paid$|Completed|Delivered|Converted|Accepted|Collected/.test(x) ? 'Paid' : 'Open');
  const regTab = tab === 'saved' || tab === 'upload' || tab === 'sheet' ? 'all' : tab;
  const R = rows.filter((r) => (regTab === 'all' || r.group === regTab) && (show === 'all' || r.type === show) && (brF === 'all' || r.br === brF) && r.ts >= since && r.ts >= fromTs && r.ts <= toTs && (st === 'all' || stOf(r.status) === st) && (!q.trim() || Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase())));
  const selN = Object.values(sel).filter(Boolean).length;
  const deleted = docs.filter((d) => d.kind === mode && d.deleted);
  const tabs: [string, string][] = pf ? [['sheet', 'Invoice sheet'], ['saved', 'All receipts & invoices'], ['upload', 'Upload invoice']] : [['saved', 'All Receipts & Invoices'], ['sales', 'All Sales Invoices & Receipts'], ['credit', 'All Credit Sales Invoices & Receipts'], ['hp', 'All Hire Purchase Invoices & Receipts'], ['web', 'All Webstore Receipts & Invoices'], ['upload', 'Upload invoice']];
  const types = Array.from(new Set(rows.map((r) => r.type)));
  const brs = Array.from(new Set(rows.map((r) => r.br))).filter(Boolean);

  const csv = () => {
    const out = [['Document', 'Type', 'Date', 'Customer', 'Phone', 'Items', 'Sold by', 'Branch', 'Payment', 'Status', 'Total'], ...R.map((r) => [r.no, r.type, r.date, r.cust, r.phone, r.items, r.by, r.br, r.meth, r.status, r.total.toFixed(2)])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.map((x) => x.map((v) => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = `${pf ? 'proformas' : 'receipts-invoices'}.csv`; a.click();
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{pf ? 'Pro-forma invoices' : 'Invoices & Receipts'}</h1>{pf && <button onClick={() => setIntro(true)} className="text-[13px] px-3 py-1.5 rounded-full border border-brand text-brand">ⓘ What is a pro-forma?</button>}</div>
          <p className="m-0 text-sm text-muted">{pf ? 'Estimates and quotations for customers · set how long they are valid and the advance needed · convert to an invoice when accepted' : 'Every invoice and receipt the system makes from sales, credit sales, hire purchase and the webstore · numbered per company and branch · open, print, share or upload'}</p>
        </div>
      </header>
      <div role="tablist" className="flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setShown(25); if (k !== 'sheet' && k !== 'upload') setListTab(k); }} className={cx('text-sm px-3.5 py-2 rounded-full whitespace-nowrap', tab === k ? 'bg-black text-white font-semibold' : 'text-sub hover:bg-canvas')}>{l}</button>)}
      </div>

      {!pf && tab !== 'sheet' && <div className="flex justify-end -mt-2"><button onClick={() => { setCur(blank('inv')); setTab('sheet'); }} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: '#0b5c5c' }}>+ New invoice</button></div>}
      {tab === 'sheet' && <DocEditor doc={cur} setDoc={setCur} saved={isSaved} onSave={save} onNew={() => setCur(blank(mode))} onConvert={pf ? convert : undefined} flash={setToast} onBack={pf ? undefined : () => setTab(listTab)} converting={convPct} />}

      {tab !== 'sheet' && (
        <>
          {tab !== 'upload' && <section className="card p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex justify-between gap-3 flex-wrap"><div><h2 className="m-0 text-lg font-semibold">{tabs.find((x) => x[0] === tab)?.[1] ?? 'Every receipt and invoice'}</h2><span className="text-[13px] text-muted">{pf ? 'All pro-formas from every branch' : 'Sales receipts and invoices, credit sales, hire purchase, pro-formas, typed invoices and online orders, from every branch'}</span></div><button onClick={csv} className="btn-ghost min-h-9 text-xs">Download list (CSV)</button></div>
            <div className="flex gap-2 items-end flex-wrap">
              <label className="flex flex-col gap-1 text-[13px] font-semibold flex-1 min-w-[260px]">Search receipts and invoices<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, code, customer, phone, item, staff…" className="h-11 rounded-full bg-white px-4 text-sm font-normal" style={{ border: '1.5px solid #000' }} /></label>
              {q && <button onClick={() => setQ('')} className="btn-ghost">Clear</button>}
            </div>
            <div className="flex gap-4 flex-wrap items-center">
              <label className="flex items-center gap-1.5 text-xs font-semibold">Show<select value={show} onChange={(e) => setShow(e.target.value)} className="h-9 rounded-full border border-line px-3 text-sm font-normal"><option value="all">Every document type</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="flex items-center gap-1.5 text-xs font-semibold">Branch<select value={brF} onChange={(e) => setBrF(e.target.value)} className="h-9 rounded-full border border-line px-3 text-sm font-normal"><option value="all">All branches</option>{brs.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
              <label className="flex items-center gap-1.5 text-xs font-semibold">When<select value={per} onChange={(e) => setPer(e.target.value as typeof per)} className="h-9 rounded-full border border-line px-3 text-sm font-normal"><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option></select></label>
              <span className="text-xs font-semibold">Status</span><Pills small opts={[['all', 'Any'], ['Open', 'Open'], ['owing', 'owing'], ['Paid', 'Paid'], ['Overdue', 'Overdue']]} value={st} onChange={setSt} />
            </div>
            <div className="flex gap-2 items-end flex-wrap p-3 rounded-2xl bg-canvas"><span className="text-xs font-semibold self-center">Generate over a period</span><label className="flex flex-col gap-0.5 text-xs">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-full border border-line bg-white px-3 text-sm" /></label><label className="flex flex-col gap-0.5 text-xs">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-full border border-line bg-white px-3 text-sm" /></label>{(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="h-9 px-3 rounded-full border border-line bg-white text-xs">Clear</button>}
            </div>
            <div className="flex gap-3 flex-wrap text-sm">{[['Documents', String(R.length)], ['Total', ghs(R.reduce((a, r) => a + r.total, 0))], ['Unpaid / owing', String(R.filter((r) => /Unpaid|Owing|Part/.test(r.status)).length)]].map(([k, v]) => <span key={k} className="px-3 py-2 rounded-xl bg-canvas">{k} <b>{v}</b></span>)}</div>
            {R.length === 0 ? <span className="text-sm text-muted">{q ? `Nothing matches “${q}”.` : 'Nothing here yet.'}</span> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[900px]">
                  <thead><tr>{['Select', 'Document', 'Date', 'Customer', 'Items', 'Sold by · branch', 'Status', 'Total', 'Actions'].map((h) => <th key={h} scope="col" className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-2 py-2 border-b border-line">{h}</th>)}</tr></thead>
                  <tbody>
                    {R.slice(0, shown).map((r) => (
                      <tr key={r.no} className="hover:bg-canvas/50">
                        <td className="px-2 py-2.5 border-b border-line"><input type="checkbox" aria-label={`Select ${r.no}`} checked={!!sel[r.no]} onChange={() => setSel((s) => ({ ...s, [r.no]: !s[r.no] }))} className="w-4 h-4 accent-[#0b5c5c]" /></td>
                        <td className="px-2 py-2.5 border-b border-line"><b>{r.no}</b><br /><span className="text-xs text-muted">{r.type} · Code {r.code}</span></td>
                        <td className="px-2 py-2.5 border-b border-line whitespace-nowrap">{r.date}</td>
                        <td className="px-2 py-2.5 border-b border-line">{r.cust}<br /><span className="text-xs text-muted">{r.phone}</span></td>
                        <td className="px-2 py-2.5 border-b border-line max-w-[220px] truncate" title={r.items}>{r.items}</td>
                        <td className="px-2 py-2.5 border-b border-line">{r.by}<br /><span className="text-xs text-muted">{r.br} · {r.meth}</span></td>
                        <td className="px-2 py-2.5 border-b border-line"><span className={cx('pill', /Paid$|Completed|Delivered|Converted|Accepted/.test(r.status) && !/Part|Un/.test(r.status) ? 'bg-green-100 text-green-800' : /Unpaid|Owing|arrears|Overdue|Expired|Voided|Cancelled|Default/.test(r.status) ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{r.status}</span></td>
                        <td className="px-2 py-2.5 border-b border-line font-semibold whitespace-nowrap">{ghs(r.total)}</td>
                        <td className="px-2 py-2.5 border-b border-line whitespace-nowrap">
                          {r.doc ? <button onClick={() => { setCur(r.doc!); setTab('sheet'); }} className="text-xs font-semibold text-brand underline mr-2">Open</button> : <button onClick={() => setPrev(R.indexOf(r))} className="text-xs font-semibold text-brand underline mr-2">Open</button>}<button onClick={() => setShare({ title: `${r.type} ${r.no}`, cust: r.cust, phone: r.phone, msg: `Hello ${r.cust.split(' ')[0]}, here is your ${r.type.toLowerCase()} ${r.no} for ${ghs(r.total)} from Ebenezer Unique Ventures. Thank you!` })} className="text-xs font-semibold mr-2">Share</button>
                          {pf && r.doc && r.doc.status !== 'Converted' && <button onClick={() => { setCur(r.doc!); setTab('sheet'); }} className="text-xs font-semibold mr-2">Convert</button>}
                          {r.doc && <button onClick={() => setPendingDel(r.no)} className="text-xs font-semibold text-danger">Delete</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {R.length > shown && <button onClick={() => setShown(shown + 25)} className="btn-ghost w-fit">Show {Math.min(25, R.length - shown)} more</button>}
            {selN > 0 && <div className="flex gap-2 items-center flex-wrap p-3 rounded-2xl bg-black text-white"><span className="text-sm flex-1">{selN} selected</span><button onClick={() => window.print()} className="btn bg-white text-black min-h-9 text-xs">Download as one PDF</button><button onClick={() => { setZip(4); const iv = setInterval(() => setZip((x) => { if (x >= 100) { clearInterval(iv); setToast(`${selN} PDFs downloaded as a ZIP`); return 0; } return Math.min(100, x + 12); }), 200); }} className="btn bg-white/15 text-white min-h-9 text-xs">Download ZIP of PDFs</button>{zip > 0 && <span className="w-full flex items-center gap-2 text-xs"><span className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden"><span className="block h-full bg-white" style={{ width: `${zip}%` }} /></span>{zip}%</span>}<button onClick={() => setSel({})} className="text-xs underline">Clear</button></div>}
          </section>}
          <div className="grid gap-6 lg:grid-cols-2">
            {tab !== 'upload' && <section className="card p-5 sm:p-6 flex flex-col gap-3 lg:col-span-2">
              <h2 className="m-0 text-lg font-semibold">Deleted invoices · restorable</h2>
              {!deleted.length && <span className="text-sm text-muted">Nothing deleted.</span>}
              {deleted.map((d) => <div key={d.no} className="flex items-center gap-2 text-sm"><span className="flex-1">{d.no} · {d.cust.biz || d.cust.name}</span><button onClick={() => setDocs((L) => L.map((x) => (x.no === d.no ? { ...x, deleted: false } : x)))} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">Restore</button></div>)}
            </section>}
            {tab === 'upload' && <section className="card p-5 sm:p-6 flex flex-col gap-3 lg:col-span-2">
              <h2 className="m-0 text-lg font-semibold">Upload invoice</h2>
              <label className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-line text-center cursor-pointer hover:bg-canvas">
                <Icon name="documents" size={28} className="text-brand" />
                <span className="text-sm font-semibold">Drop a PDF or photo here</span>
                <span className="text-xs text-muted">A PDF made by MNest UnifiedPOS opens exactly with its saved data. Other files are read by AI.</span>
                <span className="h-10 px-5 rounded-full text-white text-sm font-semibold inline-flex items-center" style={{ background: '#0b5c5c' }}>Choose file</span>
                <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setUpload(null); setUpPct(5); const iv = setInterval(() => setUpPct((x) => { if (x >= 100) { clearInterval(iv); setUpload({ name: f.name, fields: [{ field: 'Supplier / customer', value: 'Nasco Electronics', on: true }, { field: 'Invoice number', value: 'NAS-20441', on: true }, { field: 'Date', value: new Date().toLocaleDateString('en-GB'), on: true }, { field: 'Nasco 1.5HP Split Air Conditioner × 2', value: ghs(10598), on: true }, { field: 'Total', value: ghs(6500), on: true }] }); return 0; } return Math.min(100, x + 15); }), 180); }} />
              </label>
              {upPct > 0 && <div className="flex items-center gap-2 text-xs" role="status"><span className="flex-1 h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full" style={{ width: `${upPct}%`, background: '#0b5c5c' }} /></span>Reading the file · {upPct}%</div>}
              {upload && (
                <div className="p-4 rounded-2xl bg-canvas flex flex-col gap-2">
                  <strong className="text-sm">Suggestions from {upload.name}</strong>
                  <span className="text-xs text-muted">Tick each value you want to use. Nothing is filled in until you confirm; missing values stay blank.</span>
                  {upload.fields.map((f, i) => <label key={f.field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.on} onChange={() => setUpload({ ...upload, fields: upload.fields.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} className="w-4 h-4 accent-[#0b5c5c]" /><span className="flex-1 text-muted">{f.field}</span><b>{f.value}</b></label>)}
                  <button onClick={() => { const on = upload.fields.filter((f) => f.on); setCur({ ...blank(mode), cust: { name: on.find((f) => f.field.startsWith('Supplier'))?.value ?? '', biz: '', addr: '', phone: '', email: '' }, lines: on.some((f) => f.field.startsWith('Nasco')) ? [{ name: 'Nasco 1.5HP Split Air Conditioner', qty: 2, rate: 5299 }] : [] }); setUpload(null); setTab('sheet'); }} className="btn-primary w-fit">Use {upload.fields.filter((f) => f.on).length} ticked values</button>
                </div>
              )}
            </section>}
          </div>
        </>
      )}

      {savedOpen && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white rounded-4xl p-6 flex flex-col gap-3 text-center">
            <span className="w-12 h-12 mx-auto rounded-full bg-green-100 text-ok flex items-center justify-center"><Icon name="check" size={24} /></span>
            <h2 className="m-0 text-lg font-semibold">{pf ? 'Pro-forma saved' : 'Invoice saved'}</h2>
            <p className="m-0 text-sm text-muted">{savedOpen.no} is saved to {pf ? 'All pro-formas' : 'Saved invoices'} and can be reopened and changed later.</p>
            <div className="flex gap-2 justify-center flex-wrap"><button onClick={() => { setDocs((L) => L.filter((d) => d.no !== savedOpen.no)); setSavedOpen(null); }} className="btn-ghost">Undo</button><button onClick={() => { setCur(blank(mode)); setSavedOpen(null); }} className="btn-ghost">Record another</button><button onClick={() => { setSavedOpen(null); setTab('saved'); }} className="btn-primary">View report</button></div>
          </div>
        </div>
      )}
      {pendingDel && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md bg-white rounded-4xl p-6 flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold">Delete {pendingDel}?</h2>
            <p className="m-0 text-sm text-muted">It moves to Deleted invoices and can be restored. Payments and customer balances linked to it are kept.</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setPendingDel('')} className="btn-ghost">Cancel</button><button onClick={() => { setDocs((L) => L.map((d) => (d.no === pendingDel ? { ...d, deleted: true } : d))); setPendingDel(''); }} className="btn bg-danger text-white">Delete invoice</button></div>
          </div>
        </div>
      )}
      {prev !== null && R[prev] && (() => { const r = R[prev]; return (
        <div className="fixed inset-0 z-[550] bg-black/60 flex flex-col p-3 sm:p-6" onClick={() => setPrev(null)}>
          <div role="dialog" aria-modal="true" aria-label={`${r.type} ${r.no}`} onClick={(e) => e.stopPropagation()} className="bg-white rounded-[24px] w-full max-w-3xl mx-auto flex flex-col max-h-full overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-line flex-wrap">
              <div className="flex-1 min-w-[180px]"><b>{r.type} · {r.no}</b><br /><span className="text-xs text-muted">{r.cust} · {r.date} · {r.br}</span></div>
              <span className="text-xs text-muted">{prev + 1} of {R.length}</span>
              <button aria-label="Previous" disabled={prev === 0} onClick={() => setPrev(prev - 1)} className="w-9 h-9 rounded-full border border-line disabled:opacity-40">‹</button>
              <button aria-label="Next" disabled={prev >= R.length - 1} onClick={() => setPrev(prev + 1)} className="w-9 h-9 rounded-full border border-line disabled:opacity-40">›</button>
              {/* Real PDF of this document: invoice / pro-forma, till sale, or a summary for other rows (lib/docPdfs.ts). */}
              <button onClick={() => { const biz = companyBiz(bizInfo(), companyLogo()); void downloadPdf(r.doc ? invoiceDoc(r.doc, biz) : r.sale ? tillSaleDoc(r.sale, biz, /invoice/i.test(r.type) ? 'invoice' : 'receipt', r.br) : summaryDoc(r, biz), `${r.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${r.no}`); }} className="h-9 px-3 rounded-full border border-line text-xs">⬇ Download PDF</button>
              <button onClick={() => window.print()} className="h-9 px-3 rounded-full bg-black text-white text-xs">Print</button>
              <a href={`/track/${r.code}`} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-full border border-line text-xs inline-flex items-center">Open link</a>
              <button onClick={() => setShare({ title: `${r.type} ${r.no}`, cust: r.cust, phone: r.phone, msg: `Hello ${r.cust.split(' ')[0]}, here is your ${r.type.toLowerCase()} ${r.no} for ${ghs(r.total)} from Ebenezer Unique Ventures. Thank you!` })} className="h-9 px-3 rounded-full border border-line text-xs">Share</button>
              <button onClick={() => setPrev(null)} aria-label="Close" className="w-9 h-9 rounded-full text-white text-lg" style={{ background: '#c62828' }}>×</button>
            </div>
            {r.sale ? <div className="overflow-y-auto p-4"><SalesInvoice s={r.sale} /></div> :             <article className="print-doc overflow-y-auto p-8 flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b-2 border-black pb-3"><b className="text-base">Ebenezer Unique Ventures</b><div className="text-right"><b className="tracking-wide">{r.type.toUpperCase()}</b><br />No. {r.no} · Code {r.code}<br />{r.date}</div></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl p-3" style={{ background: '#f6f7f8' }}><span className="text-[11px] uppercase text-muted">Customer</span><br /><b>{r.cust}</b><br />{r.phone}</div><div className="rounded-xl p-3" style={{ background: '#f6f7f8' }}><span className="text-[11px] uppercase text-muted">Details</span><br />Sold by {r.by}<br />{r.br} · {r.meth}</div></div>
              <div><span className="text-[11px] uppercase text-muted">Items</span><p className="m-0">{r.items}</p></div>
              <div className="flex justify-between font-bold text-base border-t-2 border-black pt-2"><span>Total</span><span>{ghs(r.total)}</span></div>
              <span className="text-xs">Status: {r.status}</span>
            </article>}
            <button onClick={() => setPrev(null)} className="h-12 border-t border-line text-sm font-semibold">✕ Close</button>
          </div>
        </div>
      ); })()}
      {share && (
        <div className="fixed inset-0 z-[560] bg-black/55 flex items-center justify-center p-4" onClick={() => setShare(null)}>
          <div role="dialog" aria-modal="true" aria-label="Share" onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-[24px] p-6 flex flex-col gap-3">
            <div className="flex justify-between gap-2"><h2 className="m-0 text-lg font-semibold">{share.title} · To {share.cust}</h2><button onClick={() => setShare(null)} aria-label="Close" className="w-9 h-9 rounded-full text-white flex-none" style={{ background: '#c62828' }}>×</button></div>
            <label className="flex flex-col gap-1 text-xs font-semibold">Customer phone<input value={share.phone} onChange={(e) => setShare({ ...share, phone: e.target.value })} className="h-11 rounded-full border border-line px-4 text-sm font-normal" /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold">Message<textarea rows={4} value={share.msg} onChange={(e) => setShare({ ...share, msg: e.target.value })} className="p-3 rounded-2xl border border-line text-sm font-normal" /></label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setToast(`SMS sent to ${share.phone} · logged in Messages`); setShare(null); }} className="h-11 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#0b5c5c' }}>💬 Send by SMS</button>
              <button onClick={() => { window.open(`https://wa.me/${share.phone.replace(/\D/g, '')}?text=${encodeURIComponent(share.msg)}`, '_blank', 'noopener'); setShare(null); }} className="h-11 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#1f7a2a' }}>WhatsApp</button>
              <button onClick={() => { navigator.clipboard?.writeText(share.msg); setToast('Message copied'); }} className="h-11 px-4 rounded-full border border-line text-sm">Copy</button>
            </div>
            <span className="text-xs text-muted">SMS is sent through your SMS provider and logged in Messages. WhatsApp opens with the message ready to send.</span>
          </div>
        </div>
      )}
      {intro && <Intro d={PF_INTRO} user={session?.username || me} onBack={() => setIntro(false)} onGo={() => { setIntro(false); setTab('sheet'); }} />}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}
