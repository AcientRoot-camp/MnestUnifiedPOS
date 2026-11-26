// Sale (discount) prices, shared by the Sell Now till and the online store so both always charge the same.
// A sale can be set in two places:
//   1. Products → Pricing → Scheduled sale (product stock)   → Product.sale / saleFrom / saleTo
//   2. Post to online → Product descriptions → Sale price     → Web.desc[productId].sale / saleFrom / saleTo (+ ctSale)
import type { Product } from '../data/catalogue';
import type { Web } from '../data/web';

/** Today's local calendar date as "YYYY-MM-DD", the format the sale date pickers store. */
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** True when a sale's optional first/last day include today (an empty date means "no limit"). */
const running = (today: string, from?: string, to?: string) => (!from || from <= today) && (!to || to >= today);

/**
 * The price to show and charge right now.
 * price / ctPrice → single and carton price to charge; was / ctWas → the normal price to show crossed out (only
 * set when a sale is running); off → whole-number percentage saved on a single; src → where the sale came from.
 */
export type Priced = { price: number; was?: number; off?: number; ctPrice?: number; ctWas?: number; src?: 'stock' | 'web' };

/**
 * Work out a product's current price.
 * Inputs: p → the product; d → its Post to online entry (if any); today → date to test sale windows against.
 * Output: Priced. A sale only counts while it is running and lower than the normal price; when both places
 * set one, the lower price wins so the customer always gets the better deal.
 */
export function priceOf(p: Product, d?: Web['desc'][string], today = todayIso()): Priced {
  const offers: [number, 'stock' | 'web'][] = [];
  if (p.sale && p.sale > 0 && p.sale < p.price && running(today, p.saleFrom, p.saleTo)) offers.push([p.sale, 'stock']);
  const web = d && running(today, d.saleFrom, d.saleTo);
  if (web && parseFloat(d.sale) > 0 && parseFloat(d.sale) < p.price) offers.push([parseFloat(d.sale), 'web']);
  const out: Priced = { price: p.price, ctPrice: p.carton };
  if (offers.length) {
    const [price, src] = offers.sort((a, b) => a[0] - b[0])[0];
    Object.assign(out, { price, was: p.price, src, off: Math.round((1 - price / p.price) * 100) });
  }
  // Carton sale price is only set in Post to online.
  if (web && p.carton && d.ctSale && parseFloat(d.ctSale) > 0 && parseFloat(d.ctSale) < p.carton) Object.assign(out, { ctPrice: parseFloat(d.ctSale), ctWas: p.carton });
  return out;
}
