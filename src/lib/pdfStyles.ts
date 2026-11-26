// Premium online store documents, each with its own design (the Order Confirmation keeps the standard layout in
// lib/pdf.ts). Both are restrained: black ink, greys and hairlines, with one accent — the store's deep navy — used
// only for a fine top rule, the title and the total.
//  - Receipt: a narrow digital receipt (113 mm wide, as long as the order needs), Stripe-style: logo and business,
//    "Receipt" with its number and status, three summary columns (amount, date, payment method), a light grey
//    summary panel with the items, sums and total, the tax included, details, the collection code, a scannable QR
//    code to the order and a thank you.
//  - Invoice: a formal A4 tax invoice in serif type: letterhead with the TIN, a meta table under the title, Billed
//    to / Fulfilment / Payment blocks, a ledger table with a light grey heading row that flows onto more pages,
//    totals with the VAT, NHIL and GETFund included, notes, an authorised signature line and a grey status stamp.
import { assemble, loadJpeg, lit, rgb, winAnsi } from './pdf';
import { qrMake } from './qr';

/* ---------- data ---------- */

/** One online store order, ready to print as a receipt or an invoice (built by docPdfs.ts shopDocData). */
export type SaleDocData = {
  biz: { name: string; lines: string[]; logo?: string; tin?: string };
  branch: { name: string; address: string; phone: string };
  docNo: string; orderNo: string; date: string; status: 'PAID' | 'TO PAY' | 'CANCELLED' | 'REFUNDED';
  customer: { name: string; phone: string; email: string };
  fulfil: string; where: string; when: string;
  pay: string; payRef?: string; code?: string; hp?: string;
  lines: { qty: number; name: string; sku: string; unit: string; each: number }[];
  sub: number; disc: number; discLabel?: string; fee: number; feeLabel: string; total: number;
  /** Link the QR code opens (the order page on the store). */
  url: string;
};

/* ---------- fonts and measuring ---------- */

type Font = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';
type C3 = readonly [number, number, number];
/* Standard character widths (1/1000 em), ASCII 32–126: Helvetica, Helvetica-Bold, Times-Roman, Times-Bold, Times-Italic. */
const HV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const TR = [250,333,408,500,500,833,778,333,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];
const TB = [250,333,555,500,500,1000,833,333,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520];
const TI = [250,333,420,500,500,833,778,333,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541];
const TABLE: Record<Font, number[]> = { F1: HV, F2: HB, F3: TR, F4: TB, F5: TI, F6: HV };
const serif = (f: Font) => f === 'F3' || f === 'F4' || f === 'F5';
/** Width of a string in points, with letter spacing `sp` between characters. */
function measure(s: string, size: number, f: Font, sp = 0): number {
  const codes = winAnsi(s); const T = TABLE[f];
  const w = codes.reduce((a, c) => a + (c >= 32 && c <= 126 ? T[c - 32] : c === 0xb7 ? (serif(f) ? 250 : 278) : c === 0x95 ? 350 : c === 0x97 ? 1000 : c === 0x96 ? 500 : serif(f) ? 500 : 556), 0) * size / 1000;
  return w + Math.max(0, codes.length - 1) * sp;
}
/** Break text into lines that fit a width (long words are cut). */
function wrapF(text: string, maxW: number, size: number, f: Font): string[] {
  const out: string[] = [];
  String(text ?? '').split('\n').forEach((para) => {
    let cur = '';
    para.split(/\s+/).filter(Boolean).forEach((word) => {
      let w = word;
      while (measure(w, size, f) > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && measure(w.slice(0, k), size, f) > maxW) k--; if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, k)); w = w.slice(k); }
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next, size, f) <= maxW) cur = next; else { if (cur) out.push(cur); cur = w; }
    });
    out.push(cur);
  });
  return out.length ? out : [''];
}
const money = (n: number) => 'GHS ' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Tax inside a VAT-inclusive total: VAT 15% + NHIL 2.5% + GETFund 2.5% (20% on the net), as on till invoices. */
const taxIn = (total: number) => { const net = total / 1.2; return { net, vat: net * 0.15, nhil: net * 0.025, getf: net * 0.025 }; };
const hex = (h: string): C3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const K = 0.5523; // Bézier constant for drawing circles and rounded corners

/* ---------- drawing kit ---------- */

/**
 * A small page painter. Coordinates are from the top-left (y grows downwards). Each drawing step is kept as a
 * function of the page height, so a page whose height is only known at the end (the receipt) can still be written.
 */
class Painter {
  pages: ((H: number) => string)[][] = [[]];
  get ops() { return this.pages[this.pages.length - 1]; }
  private push(f: (H: number) => string) { this.ops.push(f); }
  /** Position in the current page's steps, to slip a background in behind content drawn later. */
  mark() { return this.ops.length; }
  insertAt(i: number, f: (H: number) => string) { this.ops.splice(i, 0, f); }
  newPage() { this.pages.push([]); }
  raw(f: (H: number) => string) { this.push(f); }
  text(x: number, y: number, s: string, o: { size?: number; f?: Font; c?: C3; align?: 'left' | 'center' | 'right'; sp?: number } = {}) {
    const size = o.size ?? 9, f = o.f ?? 'F1', c = o.c ?? [0.09, 0.09, 0.1], sp = o.sp ?? 0;
    const w = measure(s, size, f, sp); const tx = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    this.push((H) => `BT /${f} ${size} Tf ${sp.toFixed(2)} Tc ${rgb(c)} rg ${tx.toFixed(2)} ${(H - y).toFixed(2)} Td ${lit(s)} Tj ET`);
    return w;
  }
  /** Text turned by `deg` degrees around (x, y), centred there (used for the stamp). */
  textRot(x: number, y: number, s: string, deg: number, o: { size: number; f: Font; c: C3; sp?: number }) {
    const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a); const sp = o.sp ?? 0;
    const w = measure(s, o.size, o.f, sp); const dx = -w / 2, dy = -o.size * 0.35;
    this.push((H) => { const px = x + dx * cs - dy * sn, py = H - y + dx * sn + dy * cs; return `BT /${o.f} ${o.size} Tf ${sp.toFixed(2)} Tc ${rgb(o.c)} rg ${cs.toFixed(4)} ${sn.toFixed(4)} ${(-sn).toFixed(4)} ${cs.toFixed(4)} ${px.toFixed(2)} ${py.toFixed(2)} Tm ${lit(s)} Tj ET`; });
  }
  rect(x: number, y: number, w: number, h: number, fill: C3) { this.push((H) => `${rgb(fill)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  /** Rounded rectangle path (no painting operator). */
  private rr(x: number, y: number, w: number, h: number, r: number, H: number) {
    r = Math.min(r, w / 2, h / 2); const t = H - y, b = H - y - h, k = r * K;
    return `${(x + r).toFixed(2)} ${t.toFixed(2)} m ${(x + w - r).toFixed(2)} ${t.toFixed(2)} l ${(x + w - r + k).toFixed(2)} ${t.toFixed(2)} ${(x + w).toFixed(2)} ${(t - r + k).toFixed(2)} ${(x + w).toFixed(2)} ${(t - r).toFixed(2)} c ${(x + w).toFixed(2)} ${(b + r).toFixed(2)} l ${(x + w).toFixed(2)} ${(b + r - k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${b.toFixed(2)} ${(x + w - r).toFixed(2)} ${b.toFixed(2)} c ${(x + r).toFixed(2)} ${b.toFixed(2)} l ${(x + r - k).toFixed(2)} ${b.toFixed(2)} ${x.toFixed(2)} ${(b + r - k).toFixed(2)} ${x.toFixed(2)} ${(b + r).toFixed(2)} c ${x.toFixed(2)} ${(t - r).toFixed(2)} l ${x.toFixed(2)} ${(t - r + k).toFixed(2)} ${(x + r - k).toFixed(2)} ${t.toFixed(2)} ${(x + r).toFixed(2)} ${t.toFixed(2)} c h`;
  }
  rrect(x: number, y: number, w: number, h: number, r: number, o: { fill?: C3; stroke?: C3; lw?: number; dash?: string }) {
    return (H: number) => `q ${o.dash ? `[${o.dash}] 0 d` : ''} ${o.fill ? `${rgb(o.fill)} rg` : ''} ${o.stroke ? `${rgb(o.stroke)} RG ${(o.lw ?? 0.6).toFixed(2)} w` : ''} ${this.rr(x, y, w, h, r, H)} ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'} Q`;
  }
  round(x: number, y: number, w: number, h: number, r: number, o: { fill?: C3; stroke?: C3; lw?: number; dash?: string }) { this.push(this.rrect(x, y, w, h, r, o)); }
  line(x1: number, y1: number, x2: number, y2: number, c: C3, lw = 0.6, dash = '') {
    this.push((H) => `q ${dash ? `[${dash}] 0 d` : ''} ${rgb(c)} RG ${lw.toFixed(2)} w 1 J ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S Q`);
  }
  circle(cx: number, cy: number, r: number, o: { fill?: C3; stroke?: C3; lw?: number }) {
    this.push((H) => { const y = H - cy, k = r * K; return `q ${o.fill ? `${rgb(o.fill)} rg` : ''} ${o.stroke ? `${rgb(o.stroke)} RG ${(o.lw ?? 0.8).toFixed(2)} w` : ''} ${(cx + r).toFixed(2)} ${y.toFixed(2)} m ${(cx + r).toFixed(2)} ${(y + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(y + r).toFixed(2)} ${cx.toFixed(2)} ${(y + r).toFixed(2)} c ${(cx - k).toFixed(2)} ${(y + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(y + k).toFixed(2)} ${(cx - r).toFixed(2)} ${y.toFixed(2)} c ${(cx - r).toFixed(2)} ${(y - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(y - r).toFixed(2)} ${cx.toFixed(2)} ${(y - r).toFixed(2)} c ${(cx + k).toFixed(2)} ${(y - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(y - k).toFixed(2)} ${(cx + r).toFixed(2)} ${y.toFixed(2)} c ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'} Q`; });
  }
  image(x: number, y: number, w: number, h: number) { this.push((H) => `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(H - y - h).toFixed(2)} cm /Im1 Do Q`); }
  /** A real, scannable QR code drawn as dark squares (runs on a row are merged to keep the file small). */
  qr(x: number, y: number, size: number, text: string, c: C3) {
    const q = qrMake(text); if (!q) return false;
    const quiet = 2, n = q.size + quiet * 2, m = size / n; const parts: string[] = [];
    q.rows.forEach((row, r) => { let c0 = -1; row.forEach((on, cI) => { if (on && c0 < 0) c0 = cI; if ((!on || cI === row.length - 1) && c0 >= 0) { const end = on ? cI + 1 : cI; parts.push(`${(x + (c0 + quiet) * m).toFixed(2)} Y${(y + (r + quiet + 1) * m).toFixed(3)} ${((end - c0) * m + 0.02).toFixed(2)} ${(m + 0.02).toFixed(2)} re`); c0 = -1; } }); });
    this.push((H) => `q ${rgb(c)} rg ${parts.map((p) => p.replace(/Y([\d.]+)/, (_s, v) => (H - Number(v)).toFixed(2))).join(' ')} f Q`);
    return true;
  }
  /** Finish: resolve every step against the page height and write the PDF. */
  build(size: [number, number], logo: { data: Uint8Array; w: number; h: number } | null) {
    return assemble(this.pages.map((p) => p.map((f) => f(size[1]))), logo, size);
  }
}

/* =====================================================================================================
 * Shared palette: black ink, greys and one accent (the store's deep navy), used sparingly.
 * ===================================================================================================== */

const INK = hex('#111114'), MUTE = hex('#6b6b72'), HAIR = hex('#e3e3e8'), SOFT = hex('#9a9aa2'), PANEL = hex('#f6f6f8'), NAVY = hex('#1a1240');
const statusTxt = (d: SaleDocData) => (d.status === 'REFUNDED' ? 'REFUNDED' : d.status === 'PAID' ? 'PAID' : d.status === 'CANCELLED' ? 'CANCELLED' : 'PAYMENT DUE');
const amountLabel = (d: SaleDocData) => (d.status === 'REFUNDED' ? 'Amount refunded' : d.status === 'PAID' ? 'Amount paid' : d.status === 'CANCELLED' ? 'Order total (cancelled)' : 'Amount due');

/* =====================================================================================================
 * RECEIPT · narrow digital receipt (Stripe-style): summary columns, a grey summary panel, details and a QR code.
 * ===================================================================================================== */

/** Receipt width: 320 pt ≈ 113 mm; the height follows the order (one page, never split). */
const RW = 320;

/**
 * Lay out the receipt and return the PDF.
 * Input: the order data. Output: the PDF file as a Blob.
 */
export async function renderReceipt(d: SaleDocData): Promise<Blob> {
  const logo = d.biz.logo ? await loadJpeg(d.biz.logo) : null;
  const P = new Painter();
  const L = 28, R = RW - 28, CW = R - L;
  let end = 0; // where the content ends (the page height follows it)

  // A fine navy rule across the top: the only colour on the receipt besides the total.
  P.rect(0, 0, RW, 4, NAVY);
  // Header: logo, business, branch and phone.
  let bx = L;
  if (logo) { const h = 30, w = Math.min(46, (logo.w / logo.h) * h); P.image(L, 24, w, h); bx = L + w + 10; }
  P.text(bx, 37, d.biz.name, { size: 10.5, f: 'F2', c: INK });
  P.text(bx, 49, `${d.branch.name} · ${d.branch.phone}`, { size: 7, c: MUTE });

  // Title row: "Receipt", number, status.
  let y = 92;
  P.text(L, y, 'Receipt', { size: 21, f: 'F2', c: INK });
  P.text(R, y - 10, d.docNo, { size: 7.5, f: 'F2', c: INK, align: 'right', sp: 0.4 });
  const st = statusTxt(d); const sw = measure(st, 6.4, 'F2', 1) + 14;
  P.round(R - sw, y - 3, sw, 13, 6.5, { stroke: d.status === 'PAID' ? NAVY : SOFT, lw: 0.7 });
  P.text(R - sw / 2, y + 6.2, st, { size: 6.4, f: 'F2', c: d.status === 'PAID' ? NAVY : MUTE, align: 'center', sp: 1 });
  y += 26;

  // Summary columns: amount, date, payment method.
  const colW = CW / 3;
  const cols: [string, string][] = [[amountLabel(d).toUpperCase(), money(d.total)], ['DATE', d.date], ['PAYMENT METHOD', d.pay]];
  let colH = 0;
  cols.forEach(([k, v], i) => {
    const x = L + i * colW;
    P.text(x, y, k, { size: 5.8, f: 'F2', c: MUTE, sp: 0.8 });
    const ls = wrapF(v, colW - 8, 8.6, 'F2');
    ls.slice(0, 3).forEach((l, n) => P.text(x, y + 13 + n * 10.5, l, { size: 8.6, f: 'F2', c: INK }));
    colH = Math.max(colH, 13 + Math.min(3, ls.length) * 10.5);
  });
  y += colH + 12;

  // Summary panel: items, sums and the total.
  P.text(L, y, 'SUMMARY', { size: 6.2, f: 'F2', c: MUTE, sp: 1.2 }); y += 9;
  const panelTop = y; const panelAt = P.mark(); y += 16;
  d.lines.forEach((l, i) => {
    const amt = money(l.qty * l.each); const aw = measure(amt, 8.2, 'F2');
    const nm = wrapF(l.name, CW - 28 - aw - 10, 8.2, 'F2');
    nm.forEach((t, n) => P.text(L + 12, y + n * 10.2, t, { size: 8.2, f: 'F2', c: INK }));
    P.text(R - 12, y, amt, { size: 8.2, f: 'F2', c: INK, align: 'right' });
    y += nm.length * 10.2;
    P.text(L + 12, y, `Qty ${l.qty} × ${money(l.each)}${l.unit && l.unit !== 'Single' ? ` · ${l.unit}` : ''} · ${l.sku}`, { size: 6.7, c: MUTE }); y += 8;
    if (i < d.lines.length - 1) { P.line(L + 12, y, R - 12, y, HAIR, 0.5); y += 12; } else y += 6;
  });
  if (!d.lines.length) { P.text(L + 12, y, 'No items.', { size: 8, c: MUTE }); y += 14; }
  P.line(L + 12, y, R - 12, y, HAIR, 0.6); y += 13;
  const sums: [string, string][] = [['Subtotal', money(d.sub)], ...(d.disc ? [[`Discount${d.discLabel ? ` · ${d.discLabel}` : ''}`, `− ${money(d.disc)}`] as [string, string]] : []), [d.feeLabel, d.fee ? money(d.fee) : 'Free']];
  sums.forEach(([k, v]) => { P.text(L + 12, y, k, { size: 7.6, c: MUTE }); P.text(R - 12, y, v, { size: 7.8, c: INK, align: 'right' }); y += 12.5; });
  y += 2; P.line(L + 12, y - 4, R - 12, y - 4, INK, 0.8); y += 12;
  P.text(L + 12, y, amountLabel(d), { size: 8.8, f: 'F2', c: INK });
  P.text(R - 12, y + 1, money(d.total), { size: 11.5, f: 'F2', c: NAVY, align: 'right' }); y += 14;
  P.insertAt(panelAt, P.rrect(L, panelTop, CW, y - panelTop, 8, { fill: PANEL }));
  y += 10;
  const tx = taxIn(d.total);
  wrapF(`Prices include VAT ${money(tx.vat)} · NHIL ${money(tx.nhil)} · GETFund ${money(tx.getf)}`, CW, 6.2, 'F1').forEach((l) => { P.text(L, y, l, { size: 6.2, c: MUTE }); y += 8.4; });
  y += 12;

  // Details.
  P.text(L, y, 'DETAILS', { size: 6.2, f: 'F2', c: MUTE, sp: 1.2 }); y += 13;
  const rows: [string, string][] = [['Order', `#${d.orderNo}`], ['Customer', d.customer.name || 'Guest'], ...(d.customer.phone ? [['Phone', d.customer.phone] as [string, string]] : []),
    ['Fulfilment', d.where.toLowerCase().startsWith(d.fulfil.toLowerCase()) ? d.where : `${d.fulfil} · ${d.where}`], ...(d.payRef ? [['Payment reference', d.payRef] as [string, string]] : []), ['Branch', d.branch.name]];
  rows.forEach(([k, v]) => {
    const ls = wrapF(v, CW - 100, 7.6, 'F1');
    P.text(L, y, k, { size: 7.2, c: MUTE });
    ls.forEach((l, n) => P.text(R, y + n * 9.6, l, { size: 7.6, c: INK, align: 'right' }));
    y += Math.max(1, ls.length) * 9.6 + 4;
  });
  y += 8;

  // Collection code (pickups).
  if (d.code && d.status !== 'CANCELLED') {
    P.round(L, y, CW, 44, 8, { stroke: SOFT, lw: 0.7, dash: '2.5 2' });
    P.text(L + 14, y + 17, 'COLLECTION CODE', { size: 6, f: 'F2', c: MUTE, sp: 1.2 });
    P.text(L + 14, y + 31, 'Show it at the counter', { size: 6.8, c: MUTE });
    P.text(R - 14, y + 29, d.code.split('').join(' '), { size: 16, f: 'F2', c: INK, align: 'right', sp: 1 }); y += 58;
  }
  if (d.hp) { wrapF(`Hire purchase: ${d.hp}. Bring your Ghana Card to sign the agreement.`, CW, 6.8, 'F1').forEach((l) => { P.text(L, y, l, { size: 6.8, c: INK }); y += 9; }); y += 8; }

  // QR code to the order page.
  const qs = 58;
  if (P.qr(L - 2, y - 2, qs, d.url, INK)) {
    P.text(L + qs + 8, y + 16, 'View your order online', { size: 8, f: 'F2', c: INK });
    wrapF('Scan to track it, download your documents or ask for a return.', CW - qs - 10, 6.7, 'F1').forEach((l, n) => P.text(L + qs + 8, y + 28 + n * 8.8, l, { size: 6.7, c: MUTE }));
    y += qs + 10;
  }

  // Footer.
  P.line(L, y, R, y, HAIR, 0.6); y += 16;
  P.text(L, y, 'Thank you for shopping with us.', { size: 11, f: 'F5', c: INK }); y += 13;
  wrapF(`Questions? Call ${d.branch.phone}. Unopened items can be returned within 7 days with this receipt; refunds go back to the way you paid.`, CW, 6.3, 'F1').forEach((l) => { P.text(L, y, l, { size: 6.3, c: MUTE }); y += 8.3; });
  y += 4; P.text(L, y, `${d.biz.name} · ${d.docNo}`, { size: 6, c: SOFT, sp: 0.3 });
  end = y + 24;
  P.insertAt(0, (H) => `1 1 1 rg 0 0 ${RW} ${H.toFixed(2)} re f`);
  return P.build([RW, end], logo);
}

/* =====================================================================================================
 * INVOICE · formal A4 tax invoice: serif title, meta table, three address blocks, a ledger table with a light grey
 * header, totals with the tax breakdown, signature and a grey status stamp.
 * ===================================================================================================== */

const AW = 595.28, AH = 841.89, AM = 52;

/**
 * Lay out the tax invoice on A4 and return the PDF. The items table flows onto more pages with its heading repeated;
 * every page carries the top rule, the footer and "Page x of y".
 * Input: the order data. Output: the PDF file as a Blob.
 */
export async function renderInvoice(d: SaleDocData): Promise<Blob> {
  const logo = d.biz.logo ? await loadJpeg(d.biz.logo) : null;
  const P = new Painter();
  const L = AM, R = AW - AM, TW = R - L;
  const bottom = AH - 72;
  const topRule = () => P.rect(0, 0, AW, 5, NAVY);
  const cont = () => { P.newPage(); topRule(); P.text(L, 44, `${d.docNo} · continued`, { size: 7.5, f: 'F5', c: MUTE }); return 64; };
  topRule();

  // Letterhead (left) and title with the invoice facts (right).
  let y = 50; let bx = L;
  if (logo) { const h = 44, w = Math.min(110, (logo.w / logo.h) * h); P.image(L, y, w, h); bx = L + w + 14; }
  P.text(bx, y + 14, d.biz.name, { size: 14, f: 'F4', c: INK });
  const bl = [...d.biz.lines, ...(d.biz.tin ? [`TIN ${d.biz.tin}`] : [])];
  bl.forEach((l, i) => P.text(bx, y + 27 + i * 10.2, l, { size: 7.6, c: MUTE }));
  P.text(R, y + 22, 'Invoice', { size: 30, f: 'F4', c: NAVY, align: 'right' });
  const meta: [string, string][] = [['Invoice no.', d.docNo], ['Date issued', d.date], ['Order no.', `#${d.orderNo}`], ['Status', statusTxt(d)]];
  meta.forEach(([k, v], i) => { const yy = y + 42 + i * 12; P.text(R - 118, yy, k, { size: 7.4, c: MUTE }); P.text(R, yy, v, { size: 7.8, f: 'F2', c: INK, align: 'right' }); });
  y += Math.max(42 + meta.length * 12, 30 + bl.length * 10.2) + 18;
  P.line(L, y, R, y, HAIR, 0.8); y += 22;

  // Billed to · Fulfilment · Payment.
  const col = (TW - 32) / 3;
  const blocks: [string, [string, boolean?][]][] = [
    ['BILLED TO', [[d.customer.name || 'Customer', true], ...(d.customer.phone ? [[d.customer.phone] as [string]] : []), ...(d.customer.email ? [[d.customer.email] as [string]] : [])]],
    [d.fulfil.toUpperCase(), [[d.where, true], [d.when], [`From ${d.branch.name}`]]],
    ['PAYMENT', [[d.pay, true], ...(d.payRef ? [[`Ref. ${d.payRef}`] as [string]] : []), [d.status === 'PAID' ? 'Paid in full' : d.status === 'REFUNDED' ? 'Refunded to the payer' : d.status === 'CANCELLED' ? 'Cancelled · nothing to pay' : 'Due before release']]],
  ];
  let bh = 0;
  blocks.forEach(([h, ls], i) => {
    const x = L + i * (col + 16); let yy = y;
    P.text(x, yy, h, { size: 6.4, f: 'F2', c: MUTE, sp: 1.3 }); yy += 15;
    ls.forEach(([t, b]) => wrapF(t, col - 4, b ? 9.6 : 8.2, b ? 'F4' : 'F3').forEach((l) => { P.text(x, yy, l, { size: b ? 9.6 : 8.2, f: b ? 'F4' : 'F3', c: b ? INK : MUTE }); yy += b ? 12 : 10.6; }));
    bh = Math.max(bh, yy - y);
  });
  y += bh + 22;

  // Ledger table with a light grey heading row.
  const cols = [{ h: '#', w: 28, a: 'left' }, { h: 'DESCRIPTION', w: TW - 28 - 46 - 92 - 96, a: 'left' }, { h: 'QTY', w: 46, a: 'right' }, { h: 'UNIT PRICE', w: 92, a: 'right' }, { h: 'AMOUNT', w: 96, a: 'right' }] as const;
  const xs: number[] = []; let acc = L; cols.forEach((c) => { xs.push(acc); acc += c.w; });
  const cx = (i: number) => (cols[i].a === 'right' ? xs[i] + cols[i].w - 10 : xs[i] + 10);
  const head = () => { P.rect(L, y, TW, 24, PANEL); cols.forEach((c, i) => P.text(cx(i), y + 15.5, c.h, { size: 6.6, f: 'F2', c: MUTE, align: c.a, sp: 1.1 })); y += 24 + 16; };
  head();
  d.lines.forEach((l, i) => {
    const nm = wrapF(l.name, cols[1].w - 20, 9.6, 'F4'); const rh = nm.length * 12 + 11 + 12;
    if (y + rh > bottom) { y = cont(); head(); }
    P.text(cx(0), y, String(i + 1), { size: 8.4, f: 'F3', c: MUTE });
    nm.forEach((t, n) => P.text(cx(1), y + n * 12, t, { size: 9.6, f: 'F4', c: INK }));
    P.text(cx(1), y + nm.length * 12 - 0.5, `${l.sku} · ${l.unit && l.unit !== 'Single' ? l.unit : 'Single unit'}`, { size: 7, c: MUTE });
    P.text(cx(2), y, String(l.qty), { size: 9.2, f: 'F3', c: INK, align: 'right' });
    P.text(cx(3), y, money(l.each), { size: 9.2, f: 'F3', c: INK, align: 'right' });
    P.text(cx(4), y, money(l.qty * l.each), { size: 9.2, f: 'F4', c: INK, align: 'right' });
    y += rh - 12; P.line(L, y, R, y, HAIR, 0.6); y += 16;
  });
  if (!d.lines.length) { P.text(cx(1), y, 'No items.', { size: 9, f: 'F5', c: MUTE }); y += 20; }

  // Totals (right) and notes (left), kept together.
  const tx = taxIn(d.total);
  const sums: [string, string][] = [['Subtotal', money(d.sub)], ...(d.disc ? [[`Discount${d.discLabel ? ` (${d.discLabel})` : ''}`, `− ${money(d.disc)}`] as [string, string]] : []), [d.feeLabel, d.fee ? money(d.fee) : 'Free']];
  const taxes: [string, string][] = [['Net before tax', money(tx.net)], ['VAT 15%', money(tx.vat)], ['NHIL 2.5%', money(tx.nhil)], ['GETFund 2.5%', money(tx.getf)]];
  if (y + 40 + sums.length * 15 + taxes.length * 12.5 + 70 > bottom) y = cont();
  y += 2; const tTop = y; const TX = R - 230;
  sums.forEach(([k, v]) => { P.text(TX, y, k, { size: 8.8, f: 'F3', c: MUTE }); P.text(R, y, v, { size: 9.2, f: 'F3', c: INK, align: 'right' }); y += 15; });
  P.line(TX, y - 5, R, y - 5, HAIR, 0.6); y += 9;
  P.text(TX, y, 'TAX INCLUDED IN THE TOTAL', { size: 6, f: 'F2', c: SOFT, sp: 1 }); y += 12;
  taxes.forEach(([k, v]) => { P.text(TX, y, k, { size: 7.8, f: 'F3', c: MUTE }); P.text(R, y, v, { size: 8, f: 'F3', c: MUTE, align: 'right' }); y += 12.5; });
  y += 6; P.line(TX, y, R, y, NAVY, 1.2); y += 22;
  P.text(TX, y, amountLabel(d), { size: 9.2, f: 'F2', c: NAVY });
  P.text(R, y + 2, money(d.total), { size: 17, f: 'F4', c: NAVY, align: 'right' }); y += 10;
  P.text(TX, y + 4, 'Ghana cedis, VAT and levies included', { size: 6.6, f: 'F5', c: MUTE });
  const tBottom = y + 10;

  let ly = tTop; const LW = TX - 30 - L;
  if (d.code && d.status !== 'CANCELLED') { P.text(L, ly, 'COLLECTION CODE', { size: 6.4, f: 'F2', c: MUTE, sp: 1.3 }); ly += 19; P.text(L, ly, d.code.split('').join(' '), { size: 16, f: 'F4', c: INK, sp: 1 }); ly += 22; }
  P.text(L, ly, 'NOTES', { size: 6.4, f: 'F2', c: MUTE, sp: 1.3 }); ly += 14;
  [...(d.hp ? [`Hire purchase: ${d.hp}. Bring your Ghana Card to sign the agreement.`] : []), 'Prices are in Ghana cedis and include VAT 15%, NHIL 2.5% and GETFund 2.5%.', 'Unopened items can be returned within 7 days with this invoice; faulty electricals are covered by the manufacturer’s warranty.', 'Refunds are paid back to the way you paid. Please quote the invoice number in any correspondence.'].forEach((t) => {
    wrapF(t, LW, 7.8, 'F3').forEach((l) => { P.text(L, ly, l, { size: 7.8, f: 'F3', c: MUTE }); ly += 10.2; }); ly += 3;
  });

  // Signature and status stamp.
  y = Math.max(tBottom, ly) + 44;
  if (y + 70 > bottom) y = cont() + 20;
  P.line(L, y, L + 190, y, INK, 0.6);
  P.text(L, y + 12, 'Authorised signature', { size: 7.4, c: MUTE }); P.text(L, y + 23, `For ${d.biz.name}`, { size: 8, f: 'F5', c: INK });
  const stamp = statusTxt(d) === 'PAYMENT DUE' ? 'DUE' : statusTxt(d);
  const scx = R - 60, scy = y - 6;
  P.circle(scx, scy, 38, { stroke: SOFT, lw: 1.3 }); P.circle(scx, scy, 33, { stroke: SOFT, lw: 0.5 });
  P.textRot(scx, scy - 2, stamp, -14, { size: stamp.length > 5 ? 11 : 16, f: 'F4', c: SOFT, sp: 1.4 });
  P.textRot(scx + 3, scy + 14, d.date.split(',')[0], -14, { size: 6, f: 'F2', c: SOFT, sp: 0.5 });

  // Footer on every page.
  const n = P.pages.length;
  P.pages.forEach((_, i) => {
    P.pages[i].push((H) => `${rgb(HAIR)} RG 0.6 w ${L} ${(H - (AH - 46)).toFixed(2)} m ${R} ${(H - (AH - 46)).toFixed(2)} l S`);
    const foot = (t: string, x: number, align: 'left' | 'right' | 'center', f: Font, size: number) => { const w = measure(t, size, f); const tx2 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; P.pages[i].push((H) => `BT /${f} ${size} Tf 0 Tc ${rgb(MUTE)} rg ${tx2.toFixed(2)} ${(H - (AH - 31)).toFixed(2)} Td ${lit(t)} Tj ET`); };
    foot('Thank you for your business.', L, 'left', 'F5', 8.4);
    foot(`${d.biz.name}${d.biz.tin ? ` · TIN ${d.biz.tin}` : ''} · ${d.docNo}`, AW / 2, 'center', 'F1', 6.6);
    foot(`Page ${i + 1} of ${n}`, R, 'right', 'F1', 7);
  });
  return P.build([AW, AH], logo);
}
