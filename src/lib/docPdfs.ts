// Builds the PDF documents customers and staff can download: online store Order Confirmations, receipts and
// invoices; till receipts and tax invoices; pro-forma invoices and invoices; hire purchase receipts.
// Each builder turns the app's own record into a PdfDoc (lib/pdf.ts) so every document has the same layout.
import { ghs } from './format';
import { downloadBlob, renderPdf, type PdfDoc } from './pdf';
import type { ShopOrder } from '../pages/store/model';
import type { TillSale } from '../pages/pos/model';
import type { Sale } from '../data/sell';
import { totals, type Doc } from '../pages/sell/docs/model';
import type { HPAg } from '../data/hirePurchase';
import type { SaleDocData } from './pdfStyles';

/** The business printed at the top of a document. */
export type Biz = { name: string; lines: string[]; logo?: string };

/** Business block for back-office documents, from the company details used on till receipts (pos/Docs bizInfo). */
export const companyBiz = (b: { name: string; addr: string; phone: string; email: string; web: string; tin: string }, logo?: string): Biz => ({
  name: b.name, lines: [b.addr, `Tel ${b.phone} · ${b.email}`, `${b.web} · TIN ${b.tin}`], logo,
});

const ITEM_COLS = (unitLabel = 'Unit price') => [{ label: 'Qty', w: 7, align: 'right' as const }, { label: 'Item', w: 46 }, { label: 'SKU', w: 15 }, { label: unitLabel, w: 15, align: 'right' as const }, { label: 'Amount', w: 17, align: 'right' as const }];
const stamp = (ts: number) => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ---------- Online store ---------- */

/**
 * Online store order as an Order Confirmation (sent after payment) in the standard layout. The store's receipt and
 * invoice use their own premium designs (shopDocData + lib/pdfStyles.ts); this layout still serves them as a fallback.
 */
export function shopOrderDoc(o: ShopOrder, biz: Biz, branch: { name: string; address: string; phone: string }, kind: 'confirmation' | 'receipt' | 'invoice'): PdfDoc {
  const title = kind === 'confirmation' ? 'Order Confirmation' : kind === 'invoice' ? 'Tax invoice' : 'Sales receipt';
  const prefix = kind === 'confirmation' ? 'OC' : kind === 'invoice' ? 'INV' : 'RCP';
  const ful = o.fulfil === 'D' ? 'Delivery' : o.fulfil === 'P' ? 'Click & collect' : 'Buy in store';
  return {
    title, number: `${prefix}-${o.no}`, business: { name: biz.name, lines: [`${branch.name} · ${branch.address}`, ...biz.lines] }, logoUrl: biz.logo,
    badge: o.status === 'Cancelled' ? { text: 'CANCELLED', tone: 'bad' } : o.paid ? { text: 'PAID', tone: 'ok' } : { text: 'TO PAY', tone: 'warn' },
    meta: [['Order number', `#${o.no}`], ['Order date', o.at], ['Channel', 'Online store'], ['Customer', o.name], ['Phone', o.phone ? `+233 ${o.phone}` : '—'], ['Email', o.email || '—'],
      ['Fulfilment', ful], ['Where', o.where], ['When', o.when], ['Payment', o.pay + (o.payRef ? ` · ref ${o.payRef}` : '')]],
    highlight: o.code ? ['Collection code · show it at the branch', o.code] : undefined,
    table: { cols: ITEM_COLS(), rows: o.lines.map((l) => [String(l.qty), l.name + (l.unit && l.unit !== 'Single' ? ` (${l.unit})` : ''), l.sku, ghs(l.each), ghs(l.qty * l.each)]) },
    totals: [['Subtotal', ghs(o.sub)], ...(o.disc ? [[`Discount${o.codeTxt ? ' · ' + o.codeTxt : ''}`, '-' + ghs(o.disc)] as [string, string]] : []), [o.fulfil === 'D' ? 'Delivery' : 'Collection', o.fee ? ghs(o.fee) : 'Free'], ['Total (VAT, NHIL & GETFund incl.)', ghs(o.total), true]],
    notes: [
      kind === 'confirmation' ? `Thank you for your order. We have received it and ${o.paid ? 'your payment is confirmed' : o.payKey === 'cod' ? `you pay ${ghs(o.total)} on delivery` : 'we will confirm your payment shortly'}. Keep your order number to track or collect your order.` : 'Thank you for shopping with us.',
      ...(o.hp ? [`Hire purchase: ${o.hp}. Bring your Ghana Card to sign the agreement.`] : []),
      'Unopened items can be returned within 7 days with this document. See our Returns & refunds policy on our website.',
    ],
    footer: `${biz.name} · ${title} ${prefix}-${o.no}`,
  };
}

/**
 * Online store order as data for the premium receipt and invoice designs (lib/pdfStyles.ts).
 * Inputs: the order, the business block (with TIN for the invoice), the fulfilling branch, the receipt or invoice
 * number prefix and the order page link for the QR code. Output: SaleDocData.
 */
export function shopDocData(o: ShopOrder, biz: Biz & { tin?: string }, branch: { name: string; address: string; phone: string }, kind: 'receipt' | 'invoice', url: string): SaleDocData {
  const ful = o.fulfil === 'D' ? 'Delivery' : o.fulfil === 'P' ? 'Click & collect' : 'Buy in store';
  // Paid then cancelled means the money went back to the shopper.
  const status = o.status === 'Cancelled' ? (o.paid ? 'REFUNDED' : 'CANCELLED') : o.paid ? 'PAID' : 'TO PAY';
  return {
    biz: { name: biz.name, lines: [`${branch.name} · ${branch.address}`, ...biz.lines], logo: biz.logo, tin: biz.tin },
    branch, docNo: `${kind === 'invoice' ? 'INV' : 'RCP'}-${o.no}`, orderNo: o.no, date: o.at, status,
    customer: { name: o.name, phone: o.phone ? `+233 ${o.phone.slice(0, 2)} ${o.phone.slice(2, 5)} ${o.phone.slice(5)}` : '', email: o.email || '' },
    fulfil: ful, where: o.where, when: o.when, pay: o.pay.split(' · paid')[0], payRef: o.payRef, code: o.code, hp: o.hp,
    lines: o.lines.map((l) => ({ qty: l.qty, name: l.name, sku: l.sku, unit: l.unit, each: l.each })),
    sub: o.sub, disc: o.disc, discLabel: o.codeTxt, fee: o.fee, feeLabel: o.fulfil === 'D' ? 'Delivery' : 'Collection', total: o.total, url,
  };
}

/* ---------- Till (Sell Now) ---------- */

/** Till sale as a sales receipt or (for business buyers) a tax invoice with the VAT and levies shown. */
export function tillSaleDoc(s: TillSale, biz: Biz, kind: 'receipt' | 'invoice', branchName: string): PdfDoc {
  const inv = kind === 'invoice';
  const after = Math.max(0, s.sub - s.disc - s.credit);
  const taxed = !!s.biz;                              // business sale: VAT 15% + NHIL 2.5% + GETFund 2.5% on top
  const no = inv ? (s.inv || `INV-${s.no}`) : (s.code ? `RCP-${s.code}` : `RCP-${s.no}`);
  return {
    title: inv ? 'Tax invoice' : 'Sales receipt', number: no, business: biz, logoUrl: biz.logo,
    badge: s.status === 'voided' ? { text: 'VOIDED', tone: 'bad' } : (s.balance ?? 0) > 0.005 ? { text: 'BALANCE DUE', tone: 'warn' } : { text: 'PAID', tone: 'ok' },
    meta: [['Sale number', `#${s.no}`], ['Date', stamp(s.ts)], ['Branch · till', `${branchName} · ${s.till}`], ['Served by', s.staff],
      ['Customer', s.biz?.name || s.cust?.name || 'Walk-in customer'], ...(s.biz?.tin ? [['Customer TIN', s.biz.tin] as [string, string]] : []),
      ['Payment', s.parts?.length ? s.parts.map((p) => `${p.m} ${ghs(p.amt)}`).join(' + ') : s.method], ...(s.payRef ? [['Payment ref', s.payRef] as [string, string]] : [])],
    table: { cols: ITEM_COLS(), rows: s.lines.map((l) => [String(l.qty), l.name + (l.unit && l.unit !== 'single' ? ` (${l.unit})` : ''), l.sku, ghs(l.price), ghs(l.price * l.qty)]) },
    totals: [['Subtotal', ghs(s.sub)], ...(s.disc ? [['Discount', '-' + ghs(s.disc)] as [string, string]] : []), ...(s.credit ? [['Store credit used', '-' + ghs(s.credit)] as [string, string]] : []),
      ...(taxed ? [['VAT 15%', ghs(after * 0.15)], ['NHIL 2.5%', ghs(after * 0.025)], ['GETFund 2.5%', ghs(after * 0.025)]] as [string, string][] : []),
      ...(s.fee ? [['Delivery', ghs(s.fee)] as [string, string]] : []), ['Total', ghs(s.total), true],
      ...(s.paidNow !== undefined && s.kind === 'credit' ? [['Paid now', ghs(s.paidNow)], ['Balance to pay', ghs(s.balance ?? 0)]] as [string, string][] : []),
      ...(s.change ? [['Change given', ghs(s.change)] as [string, string]] : [])],
    notes: [...(s.due ? [`Balance due by ${s.due}.`] : []), taxed ? 'Prices above are before VAT and levies, which are shown separately.' : 'Prices include VAT and levies where they apply.', 'Thank you for shopping with us. Unopened items can be returned within 7 days with this document.'],
    footer: `${biz.name} · ${no}`,
  };
}

/** A sale from the sales history (Sales & returns), as a receipt or invoice. Prices include VAT and levies. */
export function saleDoc(sl: Sale, biz: Biz, kind: 'receipt' | 'invoice', branchName: string): PdfDoc {
  const inv = kind === 'invoice'; const no = `${inv ? 'INV' : 'RCP'}-${sl.no}`;
  return {
    title: inv ? 'Tax invoice' : 'Sales receipt', number: no, business: biz, logoUrl: biz.logo,
    badge: sl.status === 'voided' ? { text: 'VOIDED', tone: 'bad' } : sl.status === 'completed' ? { text: 'PAID', tone: 'ok' } : { text: sl.status.toUpperCase(), tone: 'warn' },
    meta: [['Sale number', `#${sl.no}`], ['Date', stamp(sl.ts)], ['Branch', branchName], ['Served by', sl.staff], ['Customer', sl.cust || 'Walk-in customer'], ['Payment', sl.method === 'CREDIT' ? 'Credit' : sl.method]],
    table: { cols: [{ label: 'Qty', w: 8, align: 'right' }, { label: 'Item', w: 58 }, { label: 'Unit price', w: 16, align: 'right' }, { label: 'Amount', w: 18, align: 'right' }], rows: sl.lines.map((l) => [String(l.qty), l.name, ghs(l.each), ghs(l.qty * l.each)]) },
    totals: [['Total (VAT, NHIL & GETFund incl.)', ghs(sl.total), true]],
    notes: ['Thank you for shopping with us. Unopened items can be returned within 7 days with this document.'],
    footer: `${biz.name} · ${no}`,
  };
}

/* ---------- Pro-forma invoices and invoices ---------- */

/** A pro-forma invoice or invoice from Invoices & receipts. */
export function invoiceDoc(d: Doc, biz: Biz): PdfDoc {
  const t = totals(d); const pf = d.kind === 'pf';
  return {
    title: pf ? 'Pro-forma invoice' : 'Invoice', number: d.no, business: biz, logoUrl: biz.logo,
    badge: { text: d.status.toUpperCase(), tone: d.status === 'Paid' || d.status === 'Accepted' || d.status === 'Converted' ? 'ok' : d.status === 'Expired' ? 'bad' : 'warn' },
    meta: [['Date', d.date], ...(pf && d.validUntil ? [['Valid until', d.validUntil] as [string, string]] : []), ['Bill to', [d.cust.biz, d.cust.name].filter(Boolean).join(' · ') || '—'],
      ['Phone', d.cust.phone || '—'], ['Email', d.cust.email || '—'], ['Address', d.cust.addr || '—'], ...(d.cust.tin ? [['Customer TIN', d.cust.tin] as [string, string]] : []), ['Prepared by', d.soldBy], ...(d.shipTo ? [['Ship to', d.shipTo] as [string, string]] : [])],
    table: { cols: [{ label: 'Qty', w: 8, align: 'right' }, { label: 'Description', w: 58 }, { label: 'Rate', w: 16, align: 'right' }, { label: 'Amount', w: 18, align: 'right' }], rows: d.lines.map((l) => [String(l.qty), l.name, ghs(l.rate), ghs(l.qty * l.rate)]) },
    totals: [['Subtotal', ghs(t.sub)], ...(t.disc ? [['Discount', '-' + ghs(t.disc)] as [string, string]] : []), ...(t.tax ? [['VAT 15%', ghs(t.vat)], ['NHIL 2.5%', ghs(t.nhil)], ['GETFund 2.5%', ghs(t.getf)]] as [string, string][] : []),
      ['Total', ghs(t.total), true], ...(t.adv ? [['Advance to pay now', ghs(t.adv)] as [string, string]] : []), ...(d.paid ? [['Paid', ghs(d.paid)], ['Balance', ghs(t.balance)]] as [string, string][] : [])],
    notes: [...(d.modes?.length ? [`How to pay: ${d.modes.join(' · ')}`] : []), ...(d.terms ? [d.terms] : [])],
    footer: `${biz.name} · ${pf ? 'Pro-forma' : 'Invoice'} ${d.no}`,
  };
}

/* ---------- Hire purchase ---------- */

/** Official receipt for a hire purchase deposit or instalment. */
export function hpReceiptDoc(c: HPAg, pay: { no: number; label: string; amt: number; method: string; at: string; ref?: string }, biz: Biz): PdfDoc {
  const no = 'HPR-' + c.a.id.replace('HP-', '') + '-' + String(pay.no).padStart(2, '0');
  const balance = Math.max(0, c.total - pay.no * c.inst);
  return {
    title: 'Hire purchase receipt', number: no, business: biz, logoUrl: biz.logo, badge: { text: 'PAID', tone: 'ok' },
    meta: [['Date', pay.at], ['Received from', c.a.customer], ['Phone', c.a.phone], ['Agreement', c.a.id], ['Items', c.a.item], ['Term', `${c.a.term} months`]],
    highlight: ['Amount received', ghs(pay.amt)],
    table: { cols: [{ label: 'Payment', w: 44 }, { label: 'Paid by', w: 34 }, { label: 'Amount', w: 22, align: 'right' }], rows: [[pay.label, pay.method + (pay.ref ? ` · ref ${pay.ref}` : ''), ghs(pay.amt)]] },
    totals: [['Total payable on agreement', ghs(c.total)], ['Instalments paid', `${pay.no} of ${c.a.term}`], ['Balance after this payment', ghs(balance), true]],
    notes: ['Keep this receipt as proof of payment. Missed instalments are handled as set out in your hire purchase agreement.'],
    footer: `${biz.name} · ${no}`,
  };
}

/* ---------- Anything else in Invoices & receipts ---------- */

/** A simple document for a register row that has no full record on this device (e.g. a web order summary). */
export function summaryDoc(r: { type: string; no: string; date: string; cust: string; br: string; meth: string; status: string; by: string; items: string; total: number }, biz: Biz): PdfDoc {
  return {
    title: r.type, number: r.no, business: biz, logoUrl: biz.logo,
    meta: [['Date', r.date], ['Customer', r.cust], ['Branch', r.br], ['Payment', r.meth || '—'], ['Status', r.status], ['Served by', r.by || '—']],
    table: { cols: [{ label: 'Items', w: 78 }, { label: 'Total', w: 22, align: 'right' }], rows: [[r.items || '—', ghs(r.total)]] },
    totals: [['Total', ghs(r.total), true]], notes: ['Thank you for your business.'], footer: `${biz.name} · ${r.type} ${r.no}`,
  };
}

/** Build a document and download it as a PDF file. */
export async function downloadPdf(doc: PdfDoc, filename: string) {
  downloadBlob(await renderPdf(doc), filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
