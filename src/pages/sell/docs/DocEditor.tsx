import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { COMPANY } from '../../../data/hirePurchase';
import { CAT, CUSTOMERS, wordsGhs } from '../../../data/sell';
import { cx, ghs } from '../../../lib/format';
import { DEFAULT_TERMS, TEMPLATES, tplOf, totals, type Doc } from './model';
import { usePersist } from '../../../lib/persist';
import { StampSvg, type Stamp } from '../../admin/Documents';
import CompanyLogo from '../../../components/CompanyLogo';
import { companyBiz, downloadPdf, invoiceDoc } from '../../../lib/docPdfs';
import { bizInfo } from '../../pos/Docs';
import { companyLogo } from '../../../lib/brand';

type Props = { doc: Doc; setDoc: (d: Doc) => void; onSave: () => void; onNew: () => void; onConvert?: () => void; flash: (m: string) => void; saved: boolean; onBack?: () => void; converting?: number };
const SHAPES = ['Circle', 'Seal', 'Oval', 'Rectangle', 'Rounded', 'Square', 'Hexagon'];
const INKS = ['#1a3fa0', '#c62828', '#1f7a2a', '#000000', '#6b2fa0'];
const MODES: [string, string][] = [['Cash', 'Cash at any branch'], ['MoMo', 'MoMo to 0244 000 111 · Ebenezer Unique Ventures'], ['Bank transfer', 'GCB Bank · 1021 3300 4471 · Osu branch'], ['Cheque', 'Cheques payable to Ebenezer Unique Ventures Ltd']];

export default function DocEditor({ doc, setDoc, onSave, onNew, onConvert, flash, saved, onBack, converting = 0 }: Props) {
  const pf = doc.kind === 'pf';
  const t = totals(doc);
  const locked = doc.status === 'Converted';
  const up = (p: Partial<Doc>) => !locked && setDoc({ ...doc, ...p });
  const [csOpen, setCsOpen] = useState(false);
  const [csQ, setCsQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [nc, setNc] = useState({ name: '', biz: '', addr: '', phone: '', email: '' });
  const [tpQ, setTpQ] = useState('');
  const [cu, setCu] = useState({ name: '', qty: '1', price: '' });
  const [cuErr, setCuErr] = useState('');
  const [sentMsg, setSentMsg] = useState('');
  const hits = csQ.trim() ? CUSTOMERS.filter((c) => (c.name + c.phone + c.email).toLowerCase().includes(csQ.toLowerCase())) : CUSTOMERS.slice(0, 6);
  const prods = tpQ.trim() ? CAT.filter((c) => (c[0] + ' ' + c[2]).toLowerCase().includes(tpQ.toLowerCase())).slice(0, 10) : [];
  const addLine = (name: string, rate: number, qty = 1) => {
    const i = doc.lines.findIndex((l) => l.name === name);
    up({ lines: i >= 0 ? doc.lines.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l)) : [...doc.lines, { name, qty, rate }] });
  };
  const validDays = doc.validUntil ? Math.round((new Date(doc.validUntil).getTime() - Date.now()) / 86400000) : 0;
  const title = pf ? 'PRO-FORMA INVOICE' : doc.status === 'Paid' ? 'SALES RECEIPT' : 'INVOICE';
  const TP = tplOf(doc.template);
  const band = TP[3];
  const accent = TP[2];
  const head = band ? 'text-white -mx-8 -mt-8 px-8 pt-8 pb-5 rounded-t-2xl' : 'border-b-2';
  const headStyle = band ? { background: accent } : { borderColor: accent };
  const [stamp0] = usePersist<Stamp | null>('ecompos.stamp2', null);
  const [stOpts, setStOpts] = useState(false);
  const [tool, setTool] = useState<'products' | 'company' | 'customers'>('products');
  const [cats, setCats] = useState('All');
  const [docs2] = usePersist<Doc[]>('ecompos.docs2', []);
  const [savedCust, setSavedCust] = usePersist<{ name: string; biz: string; addr: string; phone: string; email: string }[]>('ecompos.docCustomers', []);
  const ds = doc.stamp ?? { on: !!stamp0, sig: !!stamp0?.sig };
  const stamp: Stamp | null = stamp0 ? { ...stamp0, ...(ds.shape ? { shape: ds.shape.toLowerCase() } : {}), ...(ds.color ? { color: ds.color } : {}), ...(ds.word ? { word: ds.word } : {}), ...(ds.date ? { date: ds.date } : {}), sig: ds.sig ? stamp0.sig : '' } : null;
  const useStamp = ds.on;
  const setDs = (p: Partial<NonNullable<Doc['stamp']>>) => up({ stamp: { ...ds, ...p } });
  const STATUS_COLOR: Record<string, string> = { Draft: '#5f5c5a', Sent: '#0b4f8a', Accepted: '#1f7a2a', Expired: '#c62828', Converted: '#1f7a2a', Paid: '#1f7a2a', 'Part paid': '#b26a00', Unpaid: '#c62828' };

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_360px] items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <div className="no-print card p-4 flex gap-2 flex-wrap items-end">
          <label className="flex flex-col gap-1 text-xs font-semibold">Template<select value={doc.template} onChange={(e) => up({ template: e.target.value })} className="px-3 py-2 rounded-full border border-line text-sm">{TEMPLATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {onBack && <button onClick={onBack} className="btn-ghost">← Back to list</button>}
          <button onClick={onNew} className="btn-ghost"><Icon name="plus" /> New</button>
          {/* Real PDF file of this pro-forma / invoice (lib/docPdfs.ts); Print still uses the on-screen layout. */}
          <button onClick={() => { void downloadPdf(invoiceDoc(doc, companyBiz(bizInfo(), companyLogo())), `${pf ? 'proforma' : 'invoice'}-${doc.no}`); }} className="btn-ghost">⬇ Download PDF</button>
          <button onClick={() => window.print()} className="h-11 px-5 rounded-full bg-black text-white text-sm font-semibold inline-flex items-center gap-1.5"><Icon name="printer" /> Print</button>
          <button onClick={() => { if (!doc.cust.phone && !doc.cust.email) return flash('Add the customer’s phone or email first.'); setSentMsg(`Sent to ${[doc.cust.phone, doc.cust.email].filter(Boolean).join(' and ')} · ${new Date().toTimeString().slice(0, 5)}`); if (pf && doc.status === 'Draft') up({ status: 'Sent' }); }} className="h-11 px-5 rounded-full bg-white border border-black text-sm font-semibold">📨 Send by SMS & email</button>
          <button onClick={onSave} disabled={locked} className="h-11 px-5 rounded-full text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#0b5c5c' }}>{saved ? 'Save changes' : `Save ${pf ? 'pro-forma' : 'invoice'}`}</button>
          {sentMsg && <span className="text-xs text-ok w-full">{sentMsg}</span>}
        </div>

        {pf && (
          <div className="no-print card p-4 flex flex-col gap-3">
            <div className="flex gap-4 flex-wrap items-end">
              <label className="flex flex-col gap-1 text-xs font-semibold">Valid until date<input type="date" value={doc.validUntil || ''} onChange={(e) => up({ validUntil: e.target.value })} className="px-3 py-2 rounded-full border border-line text-sm" /><span className={cx('font-normal', validDays < 0 ? 'text-danger' : 'text-muted')}>{validDays < 0 ? 'Expired' : `Valid for ${validDays} days`}</span></label>
              <div className="flex flex-col gap-1 text-xs font-semibold">Advance required
                <div className="flex gap-1.5 flex-wrap items-center">
                  {['0', '30', '50', '100'].map((v) => <button key={v} aria-pressed={doc.advMode !== 'cash' && doc.advVal === v} onClick={() => up({ advMode: 'pct', advVal: v })} className={cx('text-xs px-3 py-1.5 rounded-full border', doc.advMode !== 'cash' && doc.advVal === v ? 'bg-black text-white border-black' : 'border-line')}>{v === '0' ? 'None' : v + '%'}</button>)}
                  <input aria-label="Custom advance percentage" type="number" min={0} max={100} placeholder="Custom %" value={doc.advMode === 'pct' && !['0', '30', '50', '100'].includes(doc.advVal || '') ? doc.advVal : ''} onChange={(e) => up({ advMode: 'pct', advVal: e.target.value })} className="w-24 px-3 py-1.5 rounded-full border border-line font-normal" />
                  <input aria-label="Advance as a cash amount in GHS" type="number" min={0} step="0.01" placeholder="GHS amount" value={doc.advMode === 'cash' ? doc.advVal : ''} onChange={(e) => up({ advMode: 'cash', advVal: e.target.value })} className="w-28 px-3 py-1.5 rounded-full border border-line font-normal" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { up({ status: 'Sent' }); flash(`Pro-forma ${doc.no} sent to ${doc.cust.name || 'the customer'}`); }} disabled={locked} className="btn-ghost">Send to customer</button>
              {onConvert && <button onClick={onConvert} disabled={locked || !doc.lines.length} className="btn-dark">Convert to invoice</button>}
            </div>
            {locked && <span className="text-xs text-muted">This pro-forma was converted to an invoice and is locked.</span>}
          </div>
        )}
        {doc.ref && !pf && <div className="no-print text-sm rounded-2xl px-4 py-3 flex flex-col gap-2" style={{ background: '#e7f4e8', color: '#1f7a2a' }}><span>Converted from pro-forma {doc.ref} · customer, lines, prices and discount copied. The pro-forma is now marked Converted and locked.</span>{converting > 0 && converting < 100 && <span className="flex items-center gap-2 text-xs"><span className="flex-1 h-1.5 rounded-full bg-white overflow-hidden"><span className="block h-full" style={{ width: `${converting}%`, background: '#1f7a2a' }} /></span>Building the PDF · {converting}%</span>}</div>}

        {stamp0 ? <div className="no-print rounded-[20px] p-4 flex flex-col gap-3" style={{ background: '#fafafa', border: '1px solid #ebebeb' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <b className="text-sm flex-1">Company stamp</b>
            <button role="switch" aria-checked={useStamp} onClick={() => setDs({ on: !useStamp })} className="flex items-center gap-2 text-xs"><span className="w-10 h-6 rounded-full p-0.5" style={{ background: useStamp ? '#1f7a2a' : '#cfcfcf' }}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', useStamp && 'translate-x-4')} /></span>{useStamp ? 'On' : 'Off'}</button>
            <button aria-expanded={stOpts} onClick={() => setStOpts(!stOpts)} className="text-xs px-3 py-1.5 rounded-full border border-line bg-white">{stOpts ? 'Hide options' : 'Options'}</button>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={ds.sig} onChange={() => setDs({ sig: !ds.sig })} className="accent-black" />Signature</label>
            <input type="date" aria-label="Stamp date" value={ds.date || ''} onChange={(e) => setDs({ date: e.target.value })} className="text-xs px-3 py-1.5 rounded-full border border-line bg-white" />
          </div>
          {stOpts && <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">{SHAPES.map((sh) => <button key={sh} aria-pressed={(ds.shape || stamp0.shape).toLowerCase() === sh.toLowerCase()} onClick={() => setDs({ shape: sh })} className={cx('text-xs px-3 py-1.5 rounded-full border', (ds.shape || stamp0.shape).toLowerCase() === sh.toLowerCase() ? 'bg-black text-white border-black' : 'border-line bg-white')}>{sh}</button>)}</div>
            <div className="flex gap-2 items-center flex-wrap"><span className="text-xs">Ink</span>{INKS.map((c) => <button key={c} aria-label={`Ink ${c}`} aria-pressed={(ds.color || stamp0.color) === c} onClick={() => setDs({ color: c })} className="w-7 h-7 rounded-full border-2" style={{ background: c, borderColor: (ds.color || stamp0.color) === c ? '#000' : '#fff', boxShadow: '0 0 0 1px #d9d9d9' }} />)}<label className="text-xs flex items-center gap-1.5 ml-2">Word in the middle<input value={ds.word ?? stamp0.word} onChange={(e) => setDs({ word: e.target.value.toUpperCase().slice(0, 12) })} className="w-28 px-3 py-1 rounded-full border border-line bg-white" /></label></div>
          </div>}
          <div className="flex items-center gap-3 flex-wrap"><button onClick={() => up({ stamp: undefined })} className="text-xs px-3 py-1.5 rounded-full border border-line bg-white">Use company default</button><span className="text-xs text-muted">Applies to this document only · change the default in Documents & stamp</span></div>
        </div> : <div className="no-print text-xs text-muted">No company stamp yet · set it in <Link to="/documents" className="underline">Documents & stamp</Link>.</div>}

        <article className="print-doc relative bg-white rounded-2xl shadow-card p-8 text-[13px] text-black overflow-hidden">
          {!pf && doc.status === 'Paid' && <span aria-hidden className="absolute right-10 top-40 rotate-[-18deg] border-4 border-ok text-ok text-4xl font-extrabold tracking-widest px-5 py-1 rounded-xl opacity-70">PAID</span>}
          <div className={cx('flex justify-between gap-6 flex-wrap pb-5 mb-5', head)} style={headStyle}>
            <div className="flex gap-3">
              <CompanyLogo className="w-16 h-16" />
              <div className={cx('flex flex-col text-xs', band ? 'text-white/85' : 'text-sub')}><strong className={cx('text-base', band ? 'text-white' : 'text-black')}>{COMPANY.name}</strong>{!pf && <span>Reg. CS123456789 · TIN C0012345678</span>}<span>Tel: {COMPANY.tel}</span><span>Email: {COMPANY.email}</span><span>Website: {COMPANY.web}</span><span>{COMPANY.addr}</span></div>
            </div>
            <div className="flex flex-col text-right text-xs gap-0.5"><strong className={cx('text-lg', band ? 'text-white' : '', doc.template === 'exec' && 'font-serif tracking-wide')} style={band ? undefined : { color: accent }}>{title}</strong>{pf && <span>Prepared for {doc.cust.biz || doc.cust.name || '—'}</span>}<span>No. <b>{doc.no}</b></span><span>{doc.date}</span>{doc.ref && <span>Ref. pro-forma {doc.ref}</span>}{pf && <span className="self-end mt-1 px-3 py-1 font-extrabold tracking-[0.12em] uppercase text-[13px]" style={{ border: `3px solid ${STATUS_COLOR[doc.status] || '#5f5c5a'}`, color: STATUS_COLOR[doc.status] || '#5f5c5a', borderRadius: 6 }}>{doc.status}</span>}{pf && doc.validUntil && <span>Valid until {new Date(doc.validUntil).toLocaleDateString('en-GB')}</span>}</div>
          </div>

          <div className="no-print flex items-center gap-2 flex-wrap mb-3"><span className="text-xs font-semibold">Customer type</span>{([['ind', 'Individual'], ['biz', 'Business']] as const).map(([k, l]) => <button key={k} aria-pressed={doc.buyer === k} onClick={() => up({ buyer: k })} className={cx('text-xs px-3 py-1.5 rounded-full border', doc.buyer === k ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}<span className="text-xs text-muted">{doc.buyer === 'biz' ? 'VAT 15%, NHIL 2.5% and GETFund 2.5% are added' : 'No VAT, NHIL or GETFund for an individual'}</span></div>

          <div className="flex justify-between gap-6 flex-wrap mb-4">
            <div className="flex flex-col text-sm min-w-[220px]">
              <span className="text-[11px] uppercase tracking-wider text-muted">{pf ? 'Prepared for' : 'Bill to'}</span>
              {doc.cust.biz && <strong>{doc.cust.biz}</strong>}
              <span className={doc.cust.biz ? '' : 'font-semibold'}>{doc.cust.biz ? `Attn: ${doc.cust.name}` : doc.cust.name || 'No customer yet'}</span>
              {doc.cust.addr && <span className="text-muted">{doc.cust.addr}</span>}
              {doc.cust.phone && <span className="text-muted">{doc.cust.phone}</span>}
              {doc.cust.email && <span className="text-muted">{doc.cust.email}</span>}
              {doc.cust.tin && <span className="text-muted">TIN {doc.cust.tin}</span>}
              {!pf && <div className="flex flex-col mt-2"><span className="text-[11px] uppercase tracking-wider text-muted">Ship to</span><input aria-label="Ship to" value={doc.shipTo ?? ''} onChange={(e) => up({ shipTo: e.target.value })} placeholder={doc.cust.addr || 'Same as bill to'} className="text-sm border-b border-dashed border-line outline-none bg-transparent print:border-0" /></div>}
              <div className="no-print flex gap-2 mt-2">
                <button onClick={() => { setNewOpen(true); setCsOpen(false); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">+ New customer</button>
                <button onClick={() => { setCsOpen((v) => !v); setNewOpen(false); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">🔍 Search customers</button>
              </div>
              {csOpen && (
                <div className="no-print mt-2 p-2 rounded-xl border border-line flex flex-col gap-1 w-80 max-w-full">
                  <input autoFocus value={csQ} onChange={(e) => setCsQ(e.target.value)} placeholder="Name, phone, business or email" className="px-3 py-2 rounded-full border border-line text-sm" />
                  <span className="text-xs text-muted px-1">{hits.length} found</span>
                  {hits.length === 0 && <span className="text-xs text-muted px-1">No customer matches. Use + New customer to add them.</span>}
                  {hits.map((c) => <button key={c.id} onClick={() => { up({ cust: { name: c.name, biz: c.group === 'Wholesale' && /school|ltd|hospital/i.test(c.name) ? c.name : '', addr: '', phone: c.phone, email: c.email }, buyer: c.group === 'Wholesale' ? 'biz' : doc.buyer }); setCsOpen(false); }} className="text-left px-2 py-1.5 rounded-lg hover:bg-canvas text-sm"><b>{c.name}</b> <span className="text-xs text-muted">{c.phone} · {c.group}</span></button>)}
                </div>
              )}
              {newOpen && (
                <div className="no-print mt-2 p-3 rounded-xl border border-line flex flex-col gap-2 w-80 max-w-full">
                  <strong className="text-sm">New customer</strong>
                  {([['name', 'Customer name', 'e.g. Yaw Mensah'], ['biz', 'Business name (optional)', 'e.g. Mensah Building Supplies'], ['addr', 'Address (optional)', 'Street, town'], ['phone', 'Phone (optional)', '024 000 0000'], ['email', 'Email (optional)', 'name@example.com']] as const).map(([k, l, ph]) => <label key={k} className="flex flex-col gap-0.5 text-xs font-semibold">{l}<input value={nc[k]} onChange={(e) => setNc({ ...nc, [k]: e.target.value })} placeholder={ph} className="px-3 py-1.5 rounded-full border border-line font-normal text-sm" /></label>)}
                  <div className="flex gap-2"><button onClick={() => { if (nc.name.trim().length < 2) return flash('Enter the customer name.'); up({ cust: { ...nc }, buyer: nc.biz ? 'biz' : doc.buyer }); setNewOpen(false); setNc({ name: '', biz: '', addr: '', phone: '', email: '' }); }} className="btn-primary min-h-9 text-xs">Save & use on this {pf ? 'pro-forma' : 'invoice'}</button><button onClick={() => setNewOpen(false)} className="btn-ghost min-h-9 text-xs">Cancel</button></div>
                </div>
              )}
            </div>
            <dl className="text-xs grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 h-fit">
              <dt className="text-muted">Date</dt><dd className="m-0 font-semibold">{doc.date}</dd>
              <dt className="text-muted">Branch</dt><dd className="m-0 font-semibold">{doc.br}</dd>
              <dt className="text-muted">Sold by</dt><dd className="m-0 font-semibold">{doc.soldBy}</dd>
              {!pf && <><dt className="text-muted">Status</dt><dd className="m-0 font-semibold">{doc.status}</dd></>}
            </dl>
          </div>

          <table className="w-full border-collapse mb-3">
            <caption className="sr-only">Invoice lines</caption>
            <thead><tr className={doc.template === 'minimal' ? 'border-b-2 border-black' : 'text-white'} style={doc.template === 'minimal' ? undefined : { background: accent }}>{['Item', 'Qty', 'Rate', 'Amount'].map((h, i) => <th key={h} scope="col" className={cx('p-2 font-semibold', i ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
            <tbody>
              {doc.lines.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted">No items yet · search for a product in the panel to add it</td></tr>}
              {doc.lines.map((l, i) => (
                <tr key={l.name} className="border-b border-line">
                  <td className="p-2"><span className="no-print"><button aria-label={`Remove ${l.name}`} onClick={() => up({ lines: doc.lines.filter((_, j) => j !== i) })} className="text-danger mr-2">×</button></span>{l.name}</td>
                  <td className="p-2 text-right"><span className="no-print inline-flex items-center gap-1"><button aria-label="One less" onClick={() => up({ lines: doc.lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)) })} className="w-6 h-6 rounded-full border border-line">−</button><input aria-label={`Quantity of ${l.name}`} value={l.qty} onChange={(e) => up({ lines: doc.lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value, 10) || 1) } : x)) })} className="w-12 text-center border border-line rounded" /><button aria-label="One more" onClick={() => up({ lines: doc.lines.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)) })} className="w-6 h-6 rounded-full border border-line">+</button></span><span className="hidden print:inline">{l.qty}</span></td>
                  <td className="p-2 text-right">{ghs(l.rate)}</td>
                  <td className="p-2 text-right font-semibold">{ghs(l.qty * l.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[240px] flex flex-col gap-2">
              {!pf && (
                <div className="no-print flex flex-col gap-2 p-3 rounded-xl bg-canvas">
                  <span className="text-xs font-semibold">Payment</span>
                  <div className="flex gap-1.5 flex-wrap">{(['Paid', 'Part paid', 'Unpaid'] as const).map((s) => <button key={s} aria-pressed={doc.status === s} onClick={() => up({ status: s, paid: s === 'Paid' ? t.total : s === 'Unpaid' ? 0 : doc.paid })} className={cx('text-xs px-3 py-1.5 rounded-full border', doc.status === s ? 'bg-black text-white border-black' : 'border-line bg-white')}>{s}</button>)}</div>
                  {doc.status === 'Part paid' && <label className="text-xs font-semibold flex flex-col gap-0.5">Amount paid (GHS)<input inputMode="decimal" value={doc.paid || ''} onChange={(e) => up({ paid: parseFloat(e.target.value) || 0 })} className="px-3 py-1.5 rounded-full border border-line font-normal" /></label>}
                  <span className="text-xs font-semibold">Payment modes</span>
                  <div className="flex gap-1.5 flex-wrap">{MODES.map(([m]) => { const on = (doc.modes ?? ['MoMo', 'Bank transfer']).includes(m); return <button key={m} role="switch" aria-checked={on} onClick={() => { const cur = doc.modes ?? ['MoMo', 'Bank transfer']; up({ modes: on ? cur.filter((x) => x !== m) : [...cur, m] }); }} className={cx('text-xs px-3 py-1.5 rounded-full border', on ? 'bg-black text-white border-black' : 'border-line bg-white')}>{on ? '✓ ' : ''}{m}</button>; })}</div>
                  <span className="text-[11px] text-sub">{(doc.modes ?? ['MoMo', 'Bank transfer']).map((m) => MODES.find((x) => x[0] === m)?.[1]).filter(Boolean).join(' · ') || 'No payment mode shown on the invoice'}</span>
                  <Link to="/hirepurchase" className="w-fit text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Set up hire purchase agreement</Link>
                  <label className="text-xs font-semibold flex flex-col gap-0.5">Bank payment reference<input value={doc.payRef || ''} onChange={(e) => up({ payRef: e.target.value })} placeholder="From the bank statement" className="px-3 py-1.5 rounded-full border border-line font-normal" /></label>
                  <label className="text-xs font-semibold flex flex-col gap-0.5">Deposited by<input value={doc.depositedBy || ''} onChange={(e) => up({ depositedBy: e.target.value })} placeholder="Staff name (cash banked)" className="px-3 py-1.5 rounded-full border border-line font-normal" /></label>
                </div>
              )}
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">Notes & terms</span><button className="no-print text-xs font-semibold text-brand" onClick={() => up({ terms: DEFAULT_TERMS[doc.kind] + (doc.buyer === 'biz' ? ' Prices include VAT, NHIL and GETFund where shown.' : '') })}>Draft with AI</button></div>
              <textarea aria-label="Notes and terms" rows={3} value={doc.terms} onChange={(e) => up({ terms: e.target.value })} className="text-xs p-2 rounded-lg border border-line resize-y" />
              <span className="text-xs text-muted">Sold by: {doc.soldBy}</span>
            </div>
            <div className="w-72 max-w-full flex flex-col gap-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{ghs(t.sub)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="flex items-center gap-1">Discount <span className="no-print inline-flex gap-1">{([['none', 'None'], ['pct', '%'], ['cash', 'GHS']] as const).map(([k, l]) => <button key={k} aria-pressed={doc.discMode === k} onClick={() => up({ discMode: k })} className={cx('text-[11px] px-2 py-0.5 rounded-full border', doc.discMode === k ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}</span></span>
                <span>{doc.discMode !== 'none' && <input aria-label="Discount value" value={doc.discVal} onChange={(e) => up({ discVal: e.target.value.replace(/[^0-9.]/g, '') })} placeholder={doc.discMode === 'pct' ? '5' : '0.00'} className="no-print w-14 text-right border border-line rounded px-1 mr-1" />}− {ghs(t.disc)}</span>
              </div>
              {doc.buyer === 'biz' ? <><div className="flex justify-between text-xs text-sub"><span>VAT 15%</span><span>{ghs(t.vat)}</span></div><div className="flex justify-between text-xs text-sub"><span>NHIL 2.5%</span><span>{ghs(t.nhil)}</span></div><div className="flex justify-between text-xs text-sub"><span>GETFund 2.5%</span><span>{ghs(t.getf)}</span></div></> : <div className="flex justify-between text-xs text-sub"><span>VAT, NHIL and GETFund · inclusive</span><span>{ghs(0)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t-2 border-black pt-1"><span>Total</span><span>{ghs(t.total)}</span></div>
              {!pf && <><div className="flex justify-between"><span>Amount paid</span><span>{ghs(doc.paid)}</span></div><div className="flex justify-between font-semibold"><span>Balance due</span><span>{ghs(t.balance)}</span></div></>}
              {pf && <><div className="flex justify-between"><span>Advance {doc.advMode === 'cash' ? '' : `(${doc.advVal || 0}%)`}</span><span>{ghs(t.adv)}</span></div><div className="flex justify-between font-semibold"><span>Balance on delivery</span><span>{ghs(t.rest)}</span></div></>}
              <span className="text-[11px] text-muted">{wordsGhs(t.total)}</span>
            </div>
          </div>

          {pf && <div className="no-print flex gap-1.5 flex-wrap mt-4">{(['Draft', 'Sent', 'Accepted', 'Expired'] as const).map((st) => <button key={st} aria-pressed={doc.status === st} onClick={() => up({ status: st })} className="text-xs px-3 py-1.5 rounded-full border" style={doc.status === st ? { background: STATUS_COLOR[st], color: '#fff', borderColor: STATUS_COLOR[st] } : { borderColor: '#d9d9d9' }}>{st}</button>)}</div>}
          {pf && <p className="text-[11px] text-muted mt-4">This is a pro-forma invoice: an estimate of the items and prices, not a tax invoice. Quantities and prices may change before the final invoice, and it is not a demand for payment. Prices and stock are held until {doc.validUntil ? new Date(doc.validUntil).toLocaleDateString('en-GB') : 'the date shown'}. Goods are reserved once the advance is received. A VAT invoice with a GRA E-VAT receipt is issued on payment.</p>}
          <div className="grid grid-cols-2 gap-8 mt-8 text-xs">
            {pf && <div className="flex flex-col gap-1"><span className="h-10 border-b border-black" /><span>Accepted by (customer name & signature) · Date</span></div>}
            <div className={cx('flex flex-col gap-1 relative', !pf && 'col-start-2')}>{useStamp && stamp && <span className="absolute right-0 -top-16 pointer-events-none"><StampSvg s={stamp} size={110} /></span>}<span className="h-10 border-b border-black" /><span>For {COMPANY.name} · Authorised signature</span></div>
          </div>
          <p className="text-[11px] text-muted mt-4 text-center">{pf ? 'Thank you for considering us.' : 'Thank you for your business.'} · {COMPANY.name} · {COMPANY.web}</p>
        </article>
      </div>

      <aside className="no-print bg-white flex flex-col gap-3 p-5 2xl:sticky 2xl:top-6" style={{ borderRadius: 24 }}>
        <div role="tablist" className="flex gap-1 p-1 rounded-full bg-[#f2f4f5]">{([['products', 'Products'], ['company', 'Company'], ['customers', 'Customers']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tool === k} onClick={() => setTool(k)} className={cx('flex-1 h-9 rounded-full text-[13px]', tool === k ? 'bg-black text-white font-semibold' : '')}>{l}</button>)}</div>
        {tool === 'products' && <>
          <label htmlFor="tpq" className="sr-only">Search products</label>
          <input id="tpq" value={tpQ} onChange={(e) => setTpQ(e.target.value)} placeholder={`Search ${CAT.length} products by name or category`} className="field py-2.5" />
          <div className="flex gap-1.5 flex-wrap">{['All', ...Array.from(new Set(CAT.map((c) => c[2])))].map((c) => <button key={c} aria-pressed={cats === c} onClick={() => setCats(c)} className={cx('text-xs px-3 py-1 rounded-full border', cats === c ? 'bg-black text-white border-black' : 'border-line')}>{c}</button>)}</div>
          {(tpQ.trim() || cats !== 'All' ? CAT.filter((c) => (cats === 'All' || c[2] === cats) && (!tpQ.trim() || (c[0] + ' ' + c[2]).toLowerCase().includes(tpQ.toLowerCase()))).slice(0, 12) : prods).map((c) => <div key={c[0]} className="flex items-center gap-2 text-sm"><span className="flex-1"><b>{c[0]}</b><br /><span className="text-xs text-muted">{ghs(c[1])} · {c[2]}</span></span><button disabled={locked} onClick={() => addLine(c[0], c[1])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Add</button></div>)}
          {!tpQ.trim() && cats === 'All' && <span className="text-xs text-muted">Type a product name or tap a category, then tap Add.</span>}
          {tpQ.trim() && !prods.length && <span className="text-xs text-muted">No product matches. Add it as a custom item below.</span>}
          <div className="border-t border-line pt-3 mt-1 flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Add an item not in the list</span>
            <input aria-label="Custom item name" value={cu.name} onChange={(e) => setCu({ ...cu, name: e.target.value })} placeholder="Item or service, e.g. Installation" className="field py-2" />
            <div className="flex gap-2"><input aria-label="Quantity" inputMode="numeric" value={cu.qty} onChange={(e) => setCu({ ...cu, qty: e.target.value.replace(/\D/g, '') })} placeholder="Qty" className="field py-2 w-20" /><input aria-label="Price each" inputMode="decimal" value={cu.price} onChange={(e) => setCu({ ...cu, price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Price each" className="field py-2 flex-1" /><button disabled={locked} onClick={() => { const pr = parseFloat(cu.price); const q = parseInt(cu.qty, 10) || 1; if (cu.name.trim().length < 2 || !(pr > 0)) return setCuErr('Add the item name and price.'); setCuErr(''); addLine(cu.name.trim(), pr, q); setCu({ name: '', qty: '1', price: '' }); }} className="text-xs font-semibold px-4 rounded-full bg-black text-white">Add</button></div>
            {cuErr && <span className="text-xs text-danger">{cuErr}</span>}
          </div>
          <span className="text-xs text-muted">Selling prices only. Adding the same product again increases its quantity. Cost price is never shown or printed.</span>
        </>}
        {tool === 'company' && <>
          <strong className="text-sm">Company on this document</strong>
          <button aria-pressed="true" className="text-left p-3 rounded-2xl border-2 border-black flex flex-col gap-0.5"><b className="text-sm">{COMPANY.name}</b><span className="text-xs text-muted">Prefix EUV · numbers {doc.no.split('-').slice(0, 2).join('-')}-… · Osu, East Legon, Adum</span></button>
          <span className="text-xs text-muted">Companies are archived, never deleted, so every document keeps the details it was issued with. Add a company in Settings → Manage company.</span>
        </>}
        {tool === 'customers' && <>
          {!newOpen ? <button onClick={() => setNewOpen(true)} className="text-sm font-semibold px-4 py-2.5 rounded-full border border-black">+ Add a new customer</button> : <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#f2f4f5]">
            {([['name', 'Customer name'], ['biz', 'Business name (optional)'], ['addr', 'Address'], ['phone', 'Phone'], ['email', 'Email']] as const).map(([k, l]) => <input key={k} aria-label={l} placeholder={l} value={nc[k]} onChange={(e) => setNc({ ...nc, [k]: e.target.value })} className="field py-2 text-sm" />)}
            <div className="flex gap-2"><button onClick={() => { if (nc.name.trim().length < 2) return flash('Add the customer name.'); up({ cust: { ...nc, name: nc.name.trim() }, buyer: nc.biz ? 'biz' : doc.buyer }); setSavedCust([nc, ...savedCust.filter((x) => x.name !== nc.name)]); setNewOpen(false); setNc({ name: '', biz: '', addr: '', phone: '', email: '' }); flash('Customer saved and used'); }} className="text-xs font-semibold px-4 py-2 rounded-full text-white" style={{ background: '#0b5c5c' }}>Save & use on this {pf ? 'pro-forma' : 'invoice'}</button><button onClick={() => setNewOpen(false)} className="text-xs px-4 py-2 rounded-full border border-line bg-white">Cancel</button></div>
          </div>}
          <strong className="text-sm">Customers who owe</strong>
          {CUSTOMERS.filter((c) => c.credits.some((k) => k.total > k.paid)).map((c) => <div key={c.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{c.name}<br /><span className="text-xs text-danger">Owes {ghs(c.credits.reduce((a, k) => a + k.total - k.paid, 0))}</span></span><button onClick={() => up({ cust: { name: c.name, biz: '', addr: '', phone: c.phone, email: c.email } })} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Use</button></div>)}
          {savedCust.length > 0 && <><strong className="text-sm pt-1">Saved customers</strong>{savedCust.slice(0, 8).map((c) => <div key={c.name + c.phone} className="flex items-center gap-2 text-sm"><span className="flex-1">{c.biz || c.name}<br /><span className="text-xs text-muted">{c.phone}</span></span><button onClick={() => up({ cust: c })} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Use</button></div>)}</>}
          <div className="flex gap-2 flex-wrap border-t border-line pt-3">
            <button onClick={() => { const add = docs2.map((d) => d.cust).filter((c) => c.name && !savedCust.some((x) => x.name === c.name && x.phone === c.phone)); const uniq = add.filter((c, i) => add.findIndex((x) => x.name === c.name && x.phone === c.phone) === i); setSavedCust([...savedCust, ...uniq]); flash(uniq.length ? `${uniq.length} customer${uniq.length === 1 ? '' : 's'} imported from saved invoices` : 'Every customer on saved invoices is already here'); }} className="text-xs px-3 py-1.5 rounded-full border border-line">Import customers from saved invoices</button>
            <button onClick={() => { if (!doc.cust.name.trim()) return flash('Fill in the bill-to customer first.'); setSavedCust([doc.cust, ...savedCust.filter((x) => !(x.name === doc.cust.name && x.phone === doc.cust.phone))]); flash(`${doc.cust.biz || doc.cust.name} saved as a customer`); }} className="text-xs px-3 py-1.5 rounded-full border border-line">Save bill-to as customer</button>
          </div>
        </>}
      </aside>
    </div>
  );
}
