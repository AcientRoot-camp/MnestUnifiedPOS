// Shared live stock for the till (Sell Now) and the online store, so both always show the same number.
//
//   available at a branch = branch stock (Products)
//                         − units sold (ecompos.stockMoves: till sales and online orders; returns add back)
//                         − units held right now (not paid yet):
//                             • online baskets  (ecompos.stockHolds, kind 'web')
//                             • open till sales (ecompos.stockHolds, kind 'till')
//                             • parked till sales (read straight from ecompos.parked2)
//
// Holds are not sales: removing an item from a basket or a till sale, or deleting a parked sale, gives the units
// back at once. When the sale is paid the hold is swapped for a real stock move in the same step.
// Holds expire so a basket left open in a closed browser cannot lock stock forever (see HOLD_TTL).
// Paid sales are also recorded per order/sale number, so a cancellation or void puts the stock back exactly once.
import type { Product } from '../data/catalogue';
import { BRS } from '../data/catalogue';
import { readKey, writeKey } from './persist';

export const HOLDS_KEY = 'ecompos.stockHolds';
export const PARKED_KEY = 'ecompos.parked2';
export const MOVES_KEY = 'ecompos.stockMoves';
const SOLD_KEY = 'ecompos.saleStock';

/** One held product at one branch, in single units (a carton of 12 = 12). */
export type HoldLine = { pid: string; name: string; br: string; qty: number };
/** Everything one owner (a basket or a till) is holding, with the time it was last touched. */
export type Hold = { kind: 'web' | 'till'; ts: number; lines: HoldLine[] };
export type Holds = Record<string, Hold>;
export type Moves = Record<string, Record<string, number>>;
/** The parts of a parked sale this module needs (pos/model.ts Parked). */
export type ParkedLike = { br: string; lines: { pid: string; qty: number; per?: number }[] };

/**
 * How long a hold lasts after it was last touched.
 * Online baskets: 60 minutes (refreshed while the store is open and on every basket change).
 * Till sales: 12 hours (a shift); the till also clears its hold whenever the sale screen opens empty.
 */
export const HOLD_TTL: Record<Hold['kind'], number> = { web: 60 * 60e3, till: 12 * 60 * 60e3 };

/** Holds that have not expired. Input: all holds. Output: only the live ones. */
export const liveHolds = (h: Holds, now = Date.now()): Holds =>
  Object.fromEntries(Object.entries(h || {}).filter(([, x]) => x && now - x.ts < HOLD_TTL[x.kind]));

/**
 * Units of a product held at a branch, by baskets, open till sales and parked sales.
 * `except` leaves one owner out (a till or basket counts its own items separately, so they are not counted twice).
 */
export function heldAt(pid: string, br: string, holds: Holds, parked: ParkedLike[], except = ''): number {
  let n = 0;
  Object.entries(liveHolds(holds)).forEach(([owner, h]) => { if (owner !== except) h.lines.forEach((l) => { if (l.pid === pid && l.br === br) n += l.qty; }); });
  (parked || []).forEach((p) => { if (p.br === br) p.lines.forEach((l) => { if (l.pid === pid) n += l.qty * (l.per || 1); }); });
  return n;
}

/** Units of a product on the shelf at a branch: branch stock minus what has been sold (holds not taken off). */
export const onHandAt = (p: Product, br: string, moves: Moves) =>
  Math.max(0, (p.stock[br as keyof Product['stock']] ?? 0) - Number(moves?.[p.name]?.[br] || 0));

/** Units of a product anyone can still sell at a branch: on the shelf minus every live hold (minus `except`'s own). */
export const availAt = (p: Product, br: string, moves: Moves, holds: Holds, parked: ParkedLike[], except = '') =>
  Math.max(0, onHandAt(p, br, moves) - heldAt(p.id, br, holds, parked, except));

/** Replace (or with null, remove) one owner's hold, dropping expired holds at the same time. */
export function setHold(owner: string, hold: Hold | null) {
  const all = liveHolds(readKey<Holds>(HOLDS_KEY, {}));
  const had = !!all[owner];
  if (hold && hold.lines.length) all[owner] = hold; else delete all[owner];
  if (!hold?.lines.length && !had) return; // nothing to change: avoid waking every screen for no reason
  writeKey(HOLDS_KEY, all);
}

/** Push back the expiry of an owner's hold (the shopper or cashier is still here). */
export function touchHold(owner: string) {
  const all = readKey<Holds>(HOLDS_KEY, {});
  if (!all[owner]) return;
  all[owner] = { ...all[owner], ts: Date.now() };
  writeKey(HOLDS_KEY, liveHolds(all));
}

/**
 * Hold an online basket against branch stock.
 * Inputs: the basket's owner id, the units wanted per product id, and which branches sell each product online.
 * The basket has no branch until checkout, so each product is held at the branch with the most available units
 * (spilling over to the next branch if needed). Branches already holding an item keep it, so numbers do not jump
 * around between branches as the shopper adds more.
 */
export function syncWebHold(owner: string, want: Record<string, number>, sellsAt: (p: Product, br: string) => boolean) {
  const P = readKey<Product[]>('ecompos.products2', []);
  const moves = readKey<Moves>(MOVES_KEY, {});
  const holds = readKey<Holds>(HOLDS_KEY, {});
  const parked = readKey<ParkedLike[]>(PARKED_KEY, []);
  const prev = liveHolds(holds)[owner]?.lines || [];
  const lines: HoldLine[] = [];
  Object.entries(want).forEach(([pid, units]) => {
    const p = P.find((x) => x.id === pid);
    if (!p || units <= 0) return;
    let need = units;
    // 1) keep what is already held for this basket (up to the amount still wanted)
    prev.filter((l) => l.pid === pid).forEach((l) => { const q = Math.min(l.qty, need); if (q > 0) { lines.push({ ...l, qty: q }); need -= q; } });
    // 2) take the rest from the branches with the most free units
    if (need > 0) {
      const free = BRS.map((b) => b.id).filter((br) => sellsAt(p, br))
        .map((br) => ({ br, n: availAt(p, br, moves, holds, parked, owner) - lines.filter((l) => l.pid === pid && l.br === br).reduce((a, l) => a + l.qty, 0) }))
        .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
      for (const f of free) { if (need <= 0) break; const q = Math.min(f.n, need); const hit = lines.find((l) => l.pid === pid && l.br === f.br); if (hit) hit.qty += q; else lines.push({ pid, name: p.name, br: f.br, qty: q }); need -= q; }
    }
  });
  setHold(owner, lines.length ? { kind: 'web', ts: Date.now(), lines } : null);
}

/* ---------- paid sales: take stock, and put it back once on cancel / void ---------- */

type Sold = { br: string; lines: { name: string; qty: number }[]; back?: boolean };

/** Take sold units off a branch (positive sign) or put them back (sign −1). Lines are in single units. */
export function moveStock(lines: { name: string; qty: number }[], br: string, sign = 1) {
  const mv = readKey<Moves>(MOVES_KEY, {});
  lines.forEach((l) => { if (!l.qty) return; mv[l.name] = mv[l.name] || {}; mv[l.name][br] = (mv[l.name][br] || 0) + sign * l.qty; });
  writeKey(MOVES_KEY, mv);
}

/**
 * Record a paid sale: takes the stock off the branch and remembers it under the order/sale number,
 * so a later cancellation or void can put exactly that stock back. Optionally releases a hold in the same step.
 */
export function sellStock(no: string, br: string, lines: { name: string; qty: number }[], releaseOwner = '') {
  moveStock(lines, br);
  const sold = readKey<Record<string, Sold>>(SOLD_KEY, {});
  sold[no] = { br, lines };
  writeKey(SOLD_KEY, sold);
  if (releaseOwner) setHold(releaseOwner, null);
}

/**
 * Put a cancelled order's or voided sale's stock back on the shelf, once only.
 * Output: true when stock was returned, false when there was nothing to return (unknown, or already returned).
 */
export function returnSaleStock(no: string): boolean {
  const sold = readKey<Record<string, Sold>>(SOLD_KEY, {});
  const s = sold[no];
  if (!s || s.back) return false;
  moveStock(s.lines, s.br, -1);
  sold[no] = { ...s, back: true };
  writeKey(SOLD_KEY, sold);
  return true;
}

/**
 * A till return put some units back already (good condition items): take them off the sale's record,
 * so voiding the same sale afterwards cannot return them a second time.
 */
export function noteReturned(no: string, lines: { name: string; qty: number }[]) {
  const sold = readKey<Record<string, Sold>>(SOLD_KEY, {});
  const s = sold[no];
  if (!s) return;
  const left = s.lines.map((l) => ({ ...l, qty: Math.max(0, l.qty - lines.filter((r) => r.name === l.name).reduce((a, r) => a + r.qty, 0)) }));
  sold[no] = { ...s, lines: left };
  writeKey(SOLD_KEY, sold);
}

/**
 * An id for this browser tab (kept for the tab's life in sessionStorage), so two tills open in two tabs keep
 * separate holds, and reloading a tab replaces its own hold instead of leaving an orphan behind.
 */
export function tabId(): string {
  try {
    let id = sessionStorage.getItem('ecompos.tabId');
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('ecompos.tabId', id); }
    return id;
  } catch { return 'tab'; }
}

/**
 * Units of a product free at a branch right now, read fresh from storage (for checks just before a sale).
 * `except` leaves out one owner's own hold (the basket or till doing the check).
 */
export function freeNow(pid: string, br: string, except = ''): number {
  const p = readKey<Product[]>('ecompos.products2', []).find((x) => x.id === pid);
  if (!p) return 0;
  return availAt(p, br, readKey<Moves>(MOVES_KEY, {}), readKey<Holds>(HOLDS_KEY, {}), readKey<ParkedLike[]>(PARKED_KEY, []), except);
}
