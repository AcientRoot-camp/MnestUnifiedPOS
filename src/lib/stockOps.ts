// Stock operations shared by Inventory, Warehouse, Suppliers and Approvals (productscan.md §2.4, §4.3):
// batch / expiry records from receiving, and stock-take variances that wait in Approvals before they change the stock.
import { PRODUCTS0, now, type BrId, type Product } from '../data/catalogue';
import { LOG0, type StockLine } from '../data/stockLog';
import { readKey, writeKey } from './persist';

/** A stock-take line whose variance is this much or more at cost (GHS) needs the Admin's approval before posting. */
export const BIG_VARIANCE = 200;

/** One batch received: product, batch / lot, expiry (YYYY-MM-DD), how many, where, the document and who received it. */
export type Batch = { name: string; batch: string; expiry: string; qty: number; br: string; ref: string; by: string; at: string };
export const BATCHES_KEY = 'ecompos.batches';

/**
 * Save the batch and expiry of each received line that has one (typed on the receive screen or read from a GS1-128
 * carton code). Inputs: batches per product name, singles received per name, where, the document number, who.
 */
export function saveBatches(bt: Record<string, { batch: string; expiry: string }>, got: Record<string, number>, br: string, ref: string, by: string) {
  const add: Batch[] = Object.entries(bt).filter(([n, b]) => (got[n] || 0) > 0 && (b.batch || b.expiry)).map(([n, b]) => ({ name: n, batch: b.batch, expiry: b.expiry, qty: got[n], br, ref, by, at: now() }));
  if (add.length) writeKey(BATCHES_KEY, [...add, ...readKey<Batch[]>(BATCHES_KEY, [])].slice(0, 1000));
}

/**
 * A stock-take variance waiting in Approvals: the same shape as the other approval requests (discounts, returns …)
 * plus cv, the correction to make when it is approved (product, branch, difference in singles, the count's number).
 */
export type CountReq = {
  id: string; kind: string; till: string; br: string; item: string; price: number; asked: number; by: string; byRole: string; at: string;
  status: 'pending' | 'approved' | 'reduced' | 'rejected'; note?: string; final?: number;
  cv?: { name: string; br: string; diff: number; report: string };
};

/**
 * The Admin approved a large stock-take variance: correct the branch stock by the counted difference and log it as
 * "Adjustment · Count correction" (approved). A rejected one leaves the stock as it was. Output: the message shown.
 */
export function applyCountVariance(r: CountReq, approver: string): string {
  if (!r.cv) return '';
  const { name, br, diff, report } = r.cv;
  const P = readKey<Product[]>('ecompos.products2', PRODUCTS0);
  writeKey('ecompos.products2', P.map((p) => (p.name === name ? { ...p, stock: { ...p.stock, [br as BrId]: Math.max(0, p.stock[br as BrId] + diff) } } : p)));
  const log = readKey<StockLine[]>('ecompos.stockLog2', LOG0);
  writeKey('ecompos.stockLog2', [{ ts: Date.now(), at: now(), name, br, qty: diff, kind: 'Adjustment · Count correction (approved)', ref: `Stock take ${report}`, by: approver }, ...log].slice(0, 500));
  return `${name} corrected by ${diff > 0 ? '+' : ''}${diff} after the stock take`;
}
