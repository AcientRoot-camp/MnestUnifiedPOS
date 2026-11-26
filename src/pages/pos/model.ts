// Sell Now model: till sales, parked sales, returns, approvals, tax and shift totals.
import { readKey, writeKey } from '../../lib/persist';

/** A sale line. serials: the serial numbers scanned for serial-tracked products (one per unit sold). */
export type Line = { pid: string; name: string; sku: string; price: number; cost: number; qty: number; max: number; unit?: string; per?: number; serials?: string[] };
export type Cust = { name: string; phone: string; email?: string; addr?: string; landmark?: string; gps?: string };
export type Deliver = { on: boolean; when: 'asap' | 'today' | 'tomorrow' | 'pick'; at: string; fee: number };
export type TillSale = {
  no: string; ts: number; br: string; till: string; staff: string; username: string; lines: Line[]; sub: number; disc: number; credit: number; fee: number; total: number;
  method: string; parts: { m: string; amt: number }[]; change: number; cust?: Cust; biz?: { name: string; tin: string }; status: 'completed' | 'voided' | 'credit-pending'; ref?: string; adminWhy?: string; allowedBy?: string; deliver?: Deliver;
  /** Receipt code YYMM + 4 digits, invoice number, credit details, payment references. */
  code?: string; inv?: string; kind?: 'sale' | 'credit'; paidBy?: string; paidNow?: number; balance?: number; due?: string; momoNet?: string; payRef?: string; cashRecv?: number; offline?: boolean; training?: boolean;
};
export type Parked = { id: string; ts: number; br: string; by: string; lines: Line[]; cust?: Cust; note: string; disc: number };
export type RetLine = { pid: string; name: string; qty: number; each: number; cond: 'good' | 'damaged' };
export type Ret = { id: string; ts: number; sale: string; br: string; by: string; lines: RetLine[]; reason: string; value: number; to: string };

export const DISC_LIMIT: Record<string, number> = { staff: 20, supervisor: 100, manager: Infinity, superuser: Infinity };
export const nowTxt = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + new Date().toTimeString().slice(0, 5);
export const nextNo = () => { const n = readKey<number>('ecompos.saleNo', 34420100) + 1; writeKey('ecompos.saleNo', n); return String(n); };
/** Tax inside a VAT-inclusive total: VAT 15% + NHIL 2.5% + GETFund 2.5% = 20%. */
export function taxOf(total: number) { const net = total / 1.2; return { net, vat: net * 0.15, nhil: net * 0.025, getf: net * 0.025 }; }
/** Take sold units off (or with sign −1 put back on) a branch's stock · one shared implementation in lib/stock.ts. */
export { moveStock } from '../../lib/stock';
const NETP: Record<string, string[]> = { MTN: ['24', '54', '55', '59', '25', '53'], Telecel: ['20', '50'], AirtelTigo: ['26', '56', '27', '57'] };
export const phClean = (v: string) => v.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '').slice(0, 9);
export const netOf = (v: string) => { const d = phClean(v); return d.length >= 2 ? Object.keys(NETP).find((n) => NETP[n].includes(d.slice(0, 2))) || '' : ''; };
/** A small deterministic QR-like grid for the E-VAT block on receipts. */
export function qrCells(seed: string) { let x = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0; const out: boolean[] = []; for (let i = 0; i < 21 * 21; i++) { x = (x * 1103515245 + 12345) >>> 0; out.push((x >> 16) % 2 === 0); } const fix = (r0: number, c0: number) => { for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) out[(r0 + r) * 21 + c0 + c] = r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5); }; fix(0, 0); fix(0, 14); fix(14, 0); return out; }

/** Receipt code: YYMM + 4 random digits (e.g. 26114832). Unique and never reused (kept in ecompos.docCodes). */
export function docCode() {
  const used = new Set(readKey<string[]>('ecompos.docCodes', []));
  const d = new Date(); const pre = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
  let c = '';
  for (let i = 0; i < 50; i++) { c = pre + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); if (!used.has(c)) break; }
  writeKey('ecompos.docCodes', [...used, c].slice(-5000));
  return c;
}
/** Invoice number per branch: INV-OSU-1188 onwards (ecompos.invSeq starts after 1187). */
export function invNo(br: string) { const n = readKey<number>('ecompos.invSeq', 1187) + 1; writeKey('ecompos.invSeq', n); return `INV-${br.toUpperCase().slice(0, 3)}-${n}`; }
export const fmtWhen = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + new Date(ts).toTimeString().slice(0, 5);
/** Amount in words for receipts: "Four thousand cedis". */
export function inWords(n: number) {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const w = (x: number): string => x < 20 ? a[x] : x < 100 ? b[Math.floor(x / 10)] + (x % 10 ? '-' + a[x % 10] : '') : x < 1000 ? a[Math.floor(x / 100)] + ' hundred' + (x % 100 ? ' and ' + w(x % 100) : '') : x < 1e6 ? w(Math.floor(x / 1000)) + ' thousand' + (x % 1000 ? (x % 1000 < 100 ? ' and ' : ' ') + w(x % 1000) : '') : w(Math.floor(x / 1e6)) + ' million' + (x % 1e6 ? ' ' + w(x % 1e6) : '');
  const c = Math.floor(n); const p = Math.round((n - c) * 100);
  const t = (c ? w(c) : 'zero') + ' cedi' + (c === 1 ? '' : 's') + (p ? ' and ' + w(p) + ' pesewa' + (p === 1 ? '' : 's') : '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
