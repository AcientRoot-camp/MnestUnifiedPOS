// The QR code printed on till receipts. Scanned with any phone camera it opens the receipt on the online store
// (/r, pages/store/ReceiptView.tsx) showing the items bought, the totals and how it was paid. Scanned at the till's
// Return / exchange it finds the sale by its receipt number.
//
// Link: <site>/r?c=<receipt no.>#<details>. The details travel inside the link itself, so the page needs no login and
// no server and works on the customer's own phone. The receipt number is also in plain sight (?c=) so the till reads
// it without decoding anything. The details use a compact text format (not JSON) so the code stays small with few,
// big squares that any phone camera reads easily, and a large sale still fits:
//   2~<time, base 36>~<branch>~<served by>~<paid by>~<subtotal>~<discount>~<credit>~<fee>~<total>~<k>~<paid now>~<owed>~<due>~<more>~<items>
//   items = name!qty!price joined by *, names percent-encoded with spaces as +; k = "c" for a credit sale.
import { qrMake } from './qr';
import type { TillSale } from '../pages/pos/model';

/** What a receipt link holds. */
export type ReceiptData = {
  t: number; br: string; st: string; m: string;
  s: number; d: number; c: number; f: number; T: number;
  credit: boolean; p: number; o: number; due: string;
  more: number;                    // items left out because they did not fit
  i: [string, number, number][];   // item name, quantity, unit price
};

/** One text field: percent-encoded, spaces as +, and the separators ~ ! * escaped too. */
const enc = (x: string) => encodeURIComponent(x).replace(/%20/g, '+').replace(/[~!*'()]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
const dec = (x: string) => decodeURIComponent(x.replace(/\+/g, ' '));
/** Money without needless decimals (4999, 4999.5). */
const num = (x: number) => String(Math.round(x * 100) / 100);

/** Largest QR version used on receipts and invoices: at the standard printed size (RECEIPT_QR_PX, about 30 mm) a
 *  version 12 code (65 squares a side) still has squares of about 0.4 mm, which phone cameras read reliably. */
export const RECEIPT_QR_MAX_VER = 12;
/** Standard on-paper size of the receipt / invoice QR code, in CSS px (about 30 mm on an 80 mm receipt). */
export const RECEIPT_QR_PX = 128;

/**
 * The text to put in a sale's QR code. Inputs: the sale, the branch name and the site address (default: this site).
 * Output: the link. Long item names are shortened, and items that would make the code bigger than the standard
 * (RECEIPT_QR_MAX_VER) are left out, last first (the page says how many more are on the printed receipt).
 */
export function receiptQrText(s: TillSale, branch: string, origin = window.location.origin): string {
  const code = s.code || s.no;
  const items = s.lines.map((l) => {
    const name = l.name + (l.unit && l.unit !== 'single' ? ` (${l.unit})` : '');
    return [enc(name.length > 30 ? name.slice(0, 29) + '…' : name), l.qty, num(l.price)].join('!');
  });
  const credit = s.kind === 'credit';
  const head = ['2', Math.round(s.ts / 1000).toString(36), enc(branch), enc(s.staff.split(' ')[0]), enc(s.method.split(' · ')[0]),
    num(s.sub), num(s.disc), num(s.credit), num(s.fee), num(s.total), credit ? 'c' : '', credit ? num(s.paidNow || 0) : '', credit ? num(s.balance || 0) : '', credit ? enc(s.due || '') : ''];
  const link = (keep: number) => `${origin}/r?c=${encodeURIComponent(code)}#${[...head, keep < items.length ? String(items.length - keep) : '', items.slice(0, keep).join('*')].join('~')}`;
  for (let keep = items.length; keep >= 0; keep--) { const txt = link(keep); const q = qrMake(txt, 0); if (q && q.ver <= RECEIPT_QR_MAX_VER) return txt; }
  return `${origin}/r?c=${encodeURIComponent(code)}`;
}

/** Read a receipt link back. Input: the page address (or any scanned text). Output: the receipt number and details. */
export function readReceiptLink(href: string): { code: string; data: ReceiptData | null } | null {
  try {
    const u = new URL(href);
    const code = u.searchParams.get('c') || '';
    if (!/\/r\/?$/.test(u.pathname) || !code) return null;
    let data: ReceiptData | null = null;
    try {
      const f = u.hash.slice(1); // fields are decoded one by one (dec), so a browser re-encoding the address is fine
      const p = f.split('~');
      if (p[0] === '2' && p.length >= 16) {
        const n = (x: string) => Number(x) || 0;
        data = {
          t: parseInt(p[1], 36), br: dec(p[2]), st: dec(p[3]), m: dec(p[4]), s: n(p[5]), d: n(p[6]), c: n(p[7]), f: n(p[8]), T: n(p[9]),
          credit: p[10] === 'c', p: n(p[11]), o: n(p[12]), due: dec(p[13]), more: n(p[14]),
          i: p.slice(15).join('~').split('*').filter(Boolean).map((it) => { const [nm, q, pr] = it.split('!'); return [dec(nm), n(q), n(pr)] as [string, number, number]; }),
        };
      }
    } catch { data = null; }
    return { code, data };
  } catch { return null; }
}
