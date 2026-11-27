// Sell Now documents: 80 mm till receipt and A4 sales invoice (sell.md §2.7).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BRANCHES } from '../../data/nav';
import { COMPANY } from '../../data/hirePurchase';
import { readKey } from '../../lib/persist';
import { useCompanyLogo } from '../../lib/brand';
import { ghs } from '../../lib/format';
import { qrCells, taxOf, type TillSale } from './model';
import { QrBox } from '../../components/QrBox';
import { RECEIPT_QR_PX, receiptQrText } from '../../lib/receiptQr';

export type Biz = { name: string; addr: string; city?: string; phone: string; mobile?: string; email: string; web: string; tin: string };
export function bizInfo(): Biz {
  const b = readKey<Partial<Biz>>('ecompos.bizInfo2', {});
  return { name: b.name || COMPANY.name, addr: [b.addr, b.city].filter(Boolean).join(', ') || COMPANY.addr, phone: b.phone || COMPANY.tel, email: b.email || COMPANY.email, web: (b.web || COMPANY.web).replace(/^https?:\/\//, ''), tin: b.tin || 'C0012345678' };
}
const brName = (b: string) => BRANCHES.find((x) => x.id === b)?.short ?? b;
const mono = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };
const dt = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date(ts).toTimeString().slice(0, 5);

/** Receipt item names: as many of the first 4 words as fit on line 1 (4, else 3, 2…), the rest on line 2.
 *  The 80 mm paper is a fixed 302 px, so the item column is about 129 px wide; each name is measured in the receipt
 *  font (bold 10.5 px monospace, letter spacing −0.03em) so line 1 never overflows. */
const ITEM_COL_PX = 128;
let measureCtx: CanvasRenderingContext2D | null | undefined;
function textPx(t: string) {
  if (measureCtx === undefined) { try { measureCtx = document.createElement('canvas').getContext('2d'); if (measureCtx) measureCtx.font = "700 10.5px ui-monospace, 'SF Mono', Menlo, Consolas, monospace"; } catch { measureCtx = null; } }
  if (!measureCtx) return t.length * 6.1;
  return measureCtx.measureText(t).width - t.length * 0.315;
}
export function nameLines(name: string, maxPx = ITEM_COL_PX): [string, string] {
  const w = name.trim().split(/\s+/);
  for (let k = Math.min(4, w.length); k >= 1; k--) { const a = w.slice(0, k).join(' '); if (textPx(a) <= maxPx || k === 1) return [a, w.slice(k).join(' ')]; }
  return [name, ''];
}

/** The receipt font size (px) at which a line fits the item column: 10.5 px normally, smaller only if needed (to 8). */
const fitPx = (t: string, maxPx = ITEM_COL_PX) => { const w = textPx(t); return w <= maxPx ? 10.5 : Math.max(8, Math.floor((10.5 * maxPx / w) * 4) / 4); };

/**
 * An item name on the receipt in at most two lines, never three. Line 1: the first 4 words, or the first 3 if 4 do
 * not fit even slightly smaller (a 1–2 word name stays whole). Line 2: the rest of the name plus the unit (e.g.
 * "(carton of 12)") on one line. Each line keeps the normal size and is shrunk only as much as it needs to fit the item
 * column; a line that still does not fit at the smallest size is cut with "…" (the full name is on the invoice).
 * Inputs: the name and the unit text ('' for single items). Output: the two lines and their font sizes.
 */
export function itemLines(name: string, unit: string): { l1: string; f1: number; l2: string; f2: number } {
  const w = name.trim().split(/\s+/);
  const four = w.slice(0, 4).join(' ');
  const k = w.length <= 3 || fitPx(four) >= 9 ? Math.min(4, w.length) : 3;
  const l1 = w.slice(0, k).join(' ');
  const l2 = [w.slice(k).join(' '), unit].filter(Boolean).join(' ');
  return { l1, f1: fitPx(l1), l2, f2: l2 ? fitPx(l2) : 10.5 };
}

export function QR({ seed, size }: { seed: string; size: number }) {
  const cells = qrCells(seed);
  return <svg width={size} height={size} viewBox="0 0 21 21" role="img" aria-label="QR code" shapeRendering="crispEdges">{cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#000" /> : null))}</svg>;
}

/** Totals shared by both documents. Individuals pay no VAT, NHIL or GETFund; businesses have them added on top. */
export function sums(s: TillSale) {
  const afterDisc = Math.max(0, s.sub - s.disc - s.credit);
  const t = s.biz ? { vat: afterDisc * 0.15, nhil: afterDisc * 0.025, getf: afterDisc * 0.025 } : { vat: 0, nhil: 0, getf: 0 };
  void taxOf;
  return { afterDisc, ...t };
}
const Row = ({ l, v, b }: { l: string; v: string; b?: boolean }) => <div className="flex justify-between gap-2" style={{ fontWeight: b ? 700 : 400 }}><span>{l}</span><span className="text-right">{v}</span></div>;

export function TillReceipt({ s }: { s: TillSale }) {
  const B = bizInfo(); const logo = useCompanyLogo(); const x = sums(s); const credit = s.kind === 'credit';
  // Thanked by name: the customer's full name, else the business buyer's name; a walk-in with no name gets a general thank-you.
  const thanksTo = (s.cust?.name || s.biz?.name || '').trim();
  // The QR link (items + totals), always at the standard receipt size (about 30 mm).
  const qrText = receiptQrText(s, brName(s.br));
  return (
    <div className="rounded-2xl p-4 flex justify-center" style={{ background: '#e9ebed' }}>
      <article className="print-doc bg-white flex flex-col gap-1.5 p-4 text-black" style={{ ...mono, width: 302, maxWidth: '100%', fontSize: 11.5, lineHeight: 1.35, boxShadow: 'rgba(0,0,0,0.12) 0 2px 10px' }}>
        {s.training && <div className="text-center text-[10px] font-bold text-white bg-[#c62828] rounded px-1">TRAINING MODE · practice data only, not for real sales</div>}
        <div className="text-center flex flex-col items-center gap-0.5">
          <img src={logo} alt="" className="object-contain" style={{ width: 56, height: 56, filter: 'grayscale(1)' }} />
          <strong className="uppercase" style={{ fontSize: 15 }}>{B.name}</strong>
          <span>{B.addr}</span><span>Tel: {B.phone}</span><span>Email: {B.email}</span><span>Website: {B.web}</span>
        </div>
        <div className="bg-black text-white text-center py-1.5 flex flex-col"><strong style={{ fontSize: 13 }}>{credit ? 'CREDIT SALES RECEIPT' : 'SALES RECEIPT'}</strong><span>Receipt No. {s.code || s.no}</span></div>
        <div className="flex flex-col font-bold" style={{ fontSize: 10 }}>
          <Row l="Date" v={dt(s.ts)} /><Row l="Customer" v={s.cust?.name || 'Walk-in customer'} /><Row l="Phone" v={s.cust?.phone || '—'} />
          {s.cust?.email && <Row l="Email" v={s.cust.email} />}
          {s.cust?.addr && <Row l={s.deliver ? 'Deliver to' : 'Address'} v={[s.cust.addr, s.cust.landmark, s.cust.gps].filter(Boolean).join(' · ')} />}
          {s.biz && <Row l="Buyer" v={`Business · ${s.biz.name}${s.biz.tin ? ` · TIN ${s.biz.tin}` : ''}`} />}
          <Row l="Till" v={`${brName(s.br)} · Till 1 · ${s.staff}`} />
          {s.adminWhy && <Row l="Sold by Admin (exceptional)" v={s.adminWhy} />}
        </div>
        <table className="w-full border-collapse" style={{ fontSize: 10.5, tableLayout: 'fixed' }}>
          <colgroup><col /><col style={{ width: '7%' }} /><col style={{ width: '20%' }} /><col style={{ width: '22%' }} /></colgroup>
          <thead><tr className="bg-black text-white font-bold whitespace-nowrap leading-tight"><th className="text-left px-1 py-0.5">Item</th><th className="text-right px-1 py-0.5">Qty</th><th className="text-right px-1 py-0.5">Price</th><th className="text-right px-1 py-0.5">Amount</th></tr></thead>
          <tbody>{s.lines.map((l, i) => <tr key={l.pid + (l.unit || '')} className="align-top" style={i < s.lines.length - 1 ? { borderBottom: '1px dashed #000' } : undefined}><td className="px-1 py-1 font-bold" style={{ letterSpacing: '-0.03em' }}>{(() => {
                // At most two lines (itemLines): 3 or 4 words on the first, the rest and the unit on the second.
                const n = itemLines(l.name, l.unit && l.unit !== 'single' ? `(${l.unit})` : '');
                return <><span className="block whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: n.f1 }}>{n.l1}</span>{n.l2 && <span className="block whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: n.f2 }}>{n.l2}</span>}{l.serials?.length ? <span className="block font-normal" style={{ overflowWrap: 'anywhere' }}>SN {l.serials.join(', ')}</span> : null}</>;
              })()}</td><td className="text-right px-1 py-1 whitespace-nowrap">{l.qty}</td><td className="text-right px-1 py-1 whitespace-nowrap">{l.price.toFixed(2)}</td><td className="text-right px-1 py-1 whitespace-nowrap">{(l.qty * l.price).toFixed(2)}</td></tr>)}</tbody>
        </table>
        {/* Thin dashed lines between the items. Above the totals: short dashes like the item lines, but solid black and
            thicker (2 px). Drawn as an SVG line so it always prints (printers can skip borders and backgrounds). */}
        <svg aria-hidden="true" width="100%" height="2" className="block mt-0.5" preserveAspectRatio="none"><line x1="0" y1="1" x2="100%" y2="1" stroke="#000" strokeWidth="2" strokeDasharray="3 3" /></svg>
        <div className="pt-1 flex flex-col">
          <Row l="Subtotal" v={ghs(s.sub)} b />
          <Row l="Discount" v={`− ${ghs(s.disc)}`} />
          {s.credit > 0 && <Row l="Exchange credit" v={`− ${ghs(s.credit)}`} />}
          <Row l="Subtotal after discount" v={ghs(x.afterDisc)} b />
          {s.biz && <><Row l="VAT 15%" v={ghs(x.vat)} /><Row l="NHIL 2.5%" v={ghs(x.nhil)} /><Row l="GETFund 2.5%" v={ghs(x.getf)} /></>}
          {s.fee > 0 && <Row l="Delivery fee" v={ghs(s.fee)} />}
          <span className="text-[10px]">{s.biz ? 'VAT 15%, NHIL 2.5% and GETFund 2.5% added · business sale' : 'VAT, NHIL and GETFund · inclusive' /* individual sale: prices already include them */}</span>
        </div>
        <div className="border-t border-dashed border-black pt-1 flex flex-col">
          {s.method.startsWith('Cash') && !s.parts[1] && <><Row l="Paid by" v="Cash" /><Row l="Cash received" v={ghs(s.cashRecv ?? s.parts[0]?.amt ?? s.total)} /><Row l="Change" v={ghs(s.change)} /></>}
          {s.parts.length > 1 && s.parts.map((p) => <Row key={p.m} l={`Paid by ${p.m}`} v={ghs(p.amt)} />)}
          {s.method.startsWith('Mobile Money') && <><Row l="Paid by" v={`Mobile Money · ${s.momoNet || 'MTN'}`} /><Row l="Reference" v={s.payRef || '—'} /></>}
          {s.method.startsWith('GhPay') && <><Row l="Paid by" v="GhPay" /><Row l="Reference" v={s.payRef || '—'} /></>}
          {credit && <><Row l="Paid now" v={ghs(s.paidNow || 0)} />{s.paidBy && <Row l="Paid now by" v={s.paidBy} />}<Row l="Balance owed" v={ghs(s.balance || 0)} b /><Row l="Balance due" v={s.due || '—'} /></>}
        </div>
        {/* What was paid: the full total for a sale; for a credit sale, the amount paid today (the balance owed is above). */}
        <div className="bg-black text-white px-1.5 py-1 flex justify-between font-bold" style={{ fontSize: 12 }}><span>TOTAL PAID</span><span>{ghs(credit ? s.paidNow || 0 : s.total)}</span></div>
        <div className="text-center flex flex-col items-center pt-2">
          {/* The receipt QR (lib/receiptQr.ts) at the standard size: a phone camera opens the receipt with the items
              bought; the till's Return / exchange reads the receipt number from it. */}
          <QrBox text={qrText} px={RECEIPT_QR_PX} label={`Receipt QR code for ${s.code || s.no}. Scan it with a phone to see the items, or at returns to find this sale.`} className="!rounded-none !border-0" />
          {/* These two lines sit together with no gap. */}
          <div className="flex flex-col leading-tight mt-1">
            {/* Smaller, with tighter word spacing (the receipt font is monospaced, so its spaces are wide). */}
            <strong style={{ fontSize: 11, wordSpacing: '-0.25em', letterSpacing: '-0.01em' }}>Scan at returns to find this sale</strong>
            <span>Receipt No. {s.code || s.no}</span>
          </div>
          {/* A tiny space, then the thank-you and the Akwaaba line with a tiny space between them. */}
          <strong className="mt-1.5">{thanksTo ? `THANK YOU, ${thanksTo.toUpperCase()}` : 'THANK YOU FOR SHOPPING WITH US'}</strong>
          {/* Exactly two lines on the 80 mm paper: each line is kept whole and sized to fit the receipt width. */}
          <span className="mt-1 flex flex-col items-center leading-snug" style={{ fontSize: 9.5, letterSpacing: '-0.03em' }}><span className="whitespace-nowrap">Akwaaba! Money paid is not refundable,</span><span className="whitespace-nowrap">but items purchased can be returned and exchanged</span></span>
          {/* Platform credit at the foot of the receipt (in place of the shop's web address). */}
          <strong className="mt-1.5 block" style={{ color: '#000', fontWeight: 800 }}>Developed by Mnest Systems</strong>
          <span>info@mnestsystems.com</span>
          <span aria-hidden>- - - - - - - - - -</span>
        </div>
      </article>
    </div>
  );
}

/** Shows a fixed-width page (A4 = 794 px) scaled down to fit its container, so the layout is identical at any size. */
export function Fit({ width = 794, children }: { width?: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null); const inner = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1); const [h, setH] = useState(0);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => { const kk = Math.min(1, el.clientWidth / width); setK(kk); setH((inner.current?.offsetHeight || 0) * kk); });
    ro.observe(el); if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width]);
  return <div ref={box} className="w-full overflow-hidden print:overflow-visible" style={{ height: h || undefined }}><div ref={inner} className="origin-top-left print:!transform-none" style={{ width, transform: `scale(${k})` }}>{children}</div></div>;
}

/** Red round PAID stamp: two rings, business name on top, boxed PAID, the date, OFFICIAL INVOICE underneath. */
export function PaidStamp({ name, date }: { name: string; date: string }) {
  const top = name.toUpperCase().slice(0, 28);
  return (
    <svg width="116" height="116" viewBox="0 0 116 116" style={{ transform: 'rotate(-14deg)', opacity: 0.72 }} role="img" aria-label="PAID stamp">
      <defs><path id="stTop" d="M 16 58 A 42 42 0 0 1 100 58" /><path id="stBot" d="M 18 62 A 40 40 0 0 0 98 62" /></defs>
      <circle cx="58" cy="58" r="55" fill="none" stroke="#c62828" strokeWidth="3" />
      <circle cx="58" cy="58" r="47" fill="none" stroke="#c62828" strokeWidth="1.5" />
      <text fill="#c62828" fontSize="8" fontWeight="700" letterSpacing="1"><textPath href="#stTop" startOffset="50%" textAnchor="middle">{top}</textPath></text>
      <text fill="#c62828" fontSize="7.5" fontWeight="700" letterSpacing="1"><textPath href="#stBot" startOffset="50%" textAnchor="middle">OFFICIAL INVOICE</textPath></text>
      <rect x="14" y="40" width="88" height="34" fill="none" stroke="#c62828" strokeWidth="2.5" />
      <text x="58" y="68" textAnchor="middle" fill="#c62828" fontSize="30" style={{ fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900 }}>PAID</text>
      <text x="58" y="85" textAnchor="middle" fill="#c62828" fontSize="7" fontWeight="700">{date}</text>
    </svg>
  );
}

export function SalesInvoice({ s }: { s: TillSale }) {
  const B = bizInfo(); const logo = useCompanyLogo(); const x = sums(s); const credit = s.kind === 'credit';
  const paid = credit ? s.paidNow || 0 : s.total; const bal = Math.max(0, s.total - paid);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-[#5f5c5a] no-print">A4 page · prints full size</span>
      <Fit><article className="print-doc bg-white text-black relative flex flex-col gap-4 p-8 mx-auto w-full" style={{ border: '1px solid #e1e4e6', borderRadius: 4, minHeight: 1123, fontSize: 12, width: 794 }}>
        {s.training && <div className="text-center text-[11px] font-bold text-white bg-[#c62828] rounded-full px-2 py-0.5 w-fit mx-auto">TRAINING MODE · practice data only, not for real sales</div>}
        <header className="flex justify-between gap-4 pb-3 relative" style={{ borderBottom: '2px solid #000' }}>
          <div className="flex gap-3">
            {logo ? <img src={logo} alt="" className="object-contain" style={{ width: 46, height: 46 }} /> : <span className="bg-black text-white font-bold flex items-center justify-center rounded-lg" style={{ width: 46, height: 46 }}>{B.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
            <div className="flex flex-col"><b style={{ fontSize: 15 }}>{B.name}</b><span>{B.addr}</span><span>Tel: {B.phone}</span><span>Email: {B.email}</span><span>Website: {B.web}</span></div>
          </div>
          <div className="text-right flex flex-col">
            <b style={{ fontSize: 18, letterSpacing: '0.06em' }}>{credit ? 'INVOICE' : 'SALES INVOICE'}</b>
            <span className="uppercase text-[#5f5c5a]" style={{ fontSize: 10 }}>Invoice No.</span>
            <b style={{ fontSize: 15, letterSpacing: '0.08em' }}>{s.code || s.no}</b>
            <span>{dt(s.ts)}</span>
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 bg-white px-2 text-[11px]">{BRANCHES.find((b) => b.id === s.br)?.short ?? s.br} Branch</span>
        </header>
        {credit && <div className="mx-auto px-4 py-1 font-bold" style={{ border: '2px solid #000', letterSpacing: '0.06em' }}>CREDIT SALES INVOICE</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 flex flex-col gap-0.5" style={{ background: '#f6f7f8', borderRadius: 10 }}><span className="uppercase text-[10px] text-[#5f5c5a] font-semibold">Bill to</span><b>{s.biz ? s.biz.name : s.cust?.name || 'Walk-in customer'}</b>{s.biz && s.cust && <span>Attn: {s.cust.name}</span>}{s.biz?.tin && <span>TIN {s.biz.tin}</span>}<span>{s.cust?.phone || 'No phone taken'}</span>{s.cust?.addr && <span>{s.cust.addr}</span>}</div>
          <div className="p-3 flex flex-col gap-0.5" style={{ background: '#f6f7f8', borderRadius: 10 }}><span className="uppercase text-[10px] text-[#5f5c5a] font-semibold">Details</span><span>Receipt No. {s.code || s.no} · {brName(s.br)} · Till 1</span><span>Sold by {s.staff}</span><span>{credit ? `Terms: credit · balance ${ghs(s.balance || 0)} due ${s.due}` : 'Terms: paid on receipt'}</span>{s.inv && <span>Invoice ref {s.inv}</span>}</div>
        </div>
        <table className="w-full border-collapse">
          <thead><tr className="bg-black text-white"><th className="text-left p-2">Item Description</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Unit Price</th><th className="text-right p-2">Total</th></tr></thead>
          <tbody>{s.lines.map((l) => <tr key={l.pid + (l.unit || '')} style={{ borderBottom: '1px solid #e1e4e6' }}><td className="p-2">{l.name}{l.unit ? ` · ${l.unit}` : ''}</td><td className="p-2 text-right">{l.qty}</td><td className="p-2 text-right">{ghs(l.price)}</td><td className="p-2 text-right">{ghs(l.qty * l.price)}</td></tr>)}</tbody>
        </table>
        <div className="flex justify-between gap-6 items-start">
          {/* The same real receipt QR as the till receipt, at the same standard size (lib/receiptQr.ts). */}
          <div className="flex gap-3 items-center max-w-[300px]"><QrBox text={receiptQrText(s, brName(s.br))} px={RECEIPT_QR_PX} label={`QR code for sale ${s.code || s.no}. Scan it to see this sale and its items.`} className="!rounded-none !border-0 flex-none" /><span className="text-[11px] leading-snug"><b className="block text-[12px]">Scan to see this sale and its items</b>Receipt No. {s.code || s.no} · scan it at returns to find this sale</span></div>
          <div className="flex flex-col gap-0.5 min-w-[240px] relative">
            <Row l="Subtotal" v={ghs(s.sub)} b /><Row l="Discount" v={`− ${ghs(s.disc)}`} />{s.credit > 0 && <Row l="Exchange credit" v={`− ${ghs(s.credit)}`} />}<Row l="Subtotal after discount" v={ghs(x.afterDisc)} b />
            {s.biz ? <><Row l="VAT 15%" v={ghs(x.vat)} /><Row l="NHIL 2.5%" v={ghs(x.nhil)} /><Row l="GETFund 2.5%" v={ghs(x.getf)} /></> : <span className="text-[11px] text-[#5f5c5a]">VAT, NHIL and GETFund · inclusive</span>}
            {s.fee > 0 && <Row l="Delivery fee" v={ghs(s.fee)} />}
            <div className="flex justify-between font-bold pt-1 mt-1" style={{ fontSize: 15, borderTop: '2px solid #000' }}><span>Invoice total</span><span>{ghs(s.total)}</span></div>
            <Row l={`Paid · ${s.method.split(' · ')[0]}`} v={ghs(paid)} />
            <Row l="Balance due" v={ghs(bal)} b />
            {bal < 0.005 && <div className="absolute -left-36 -top-4 pointer-events-none"><PaidStamp name={B.name} date={new Date(s.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} /></div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-10 mt-auto pt-8 text-[11px]">{[`Sold by · ${s.staff}`, `Received by · ${s.cust?.name || 'Customer'}`].map((t) => <div key={t} className="pt-1" style={{ borderTop: '1px solid #000' }}>{t}</div>)}</div>
        <footer className="text-center text-[11px] text-[#5f5c5a]">Thank you for your business. Money paid is not refundable, but items purchased can be returned and exchanged with this invoice no.: {s.code || s.no}</footer>
      </article></Fit>
    </div>
  );
}
