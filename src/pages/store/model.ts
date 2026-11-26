// Customer store model: products, stock, badges, discount codes, phones and order placement.
import { useMemo } from 'react';
import { BRS, PRODUCTS0, type Product } from '../../data/catalogue';
import { COLLECTIONS, WEB_ORDERS, type Collection, type WebOrder } from '../../data/sell';
import { useWeb, type Code, type Web } from '../../data/web';
import { readKey, usePersist, writeKey } from '../../lib/persist';
import { priceOf, todayIso } from '../../lib/pricing';
import { ctName, perCarton } from '../../lib/barcode';
import { shownDesc } from '../../lib/describe';
import type { TokenValues } from '../../data/policies';
import { HOLDS_KEY, PARKED_KEY, availAt, returnSaleStock, sellStock, type Holds, type Moves, type ParkedLike } from '../../lib/stock';

export const BIZ = 'Ebenezer Unique Ventures';
export const money = (n: number) => 'GHS ' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const NAVY = '#1a1240';

export type BrInfo = { id: string; name: string; short: string; address: string; gps: string; phone: string; note: string; open: string };
export const BR_INFO: BrInfo[] = [
  { id: 'osu', name: 'Osu, Accra', short: 'Osu', address: '12 Oxford Street, Osu, Accra', gps: 'GA-123-4567', phone: '+233 30 000 1111', note: '12 Oxford Street · open until 21:00', open: 'Mon–Sat 7:30–21:00 · Sun 10:00–18:00' },
  { id: 'legon', name: 'East Legon, Accra', short: 'East Legon', address: 'Lagos Avenue, East Legon, Accra', gps: 'GA-492-0010', phone: '+233 30 000 2222', note: 'Lagos Avenue · open until 21:00', open: 'Mon–Sat 8:00–21:00 · Sun 11:00–18:00' },
  { id: 'adum', name: 'Adum, Kumasi', short: 'Adum', address: 'Prempeh II Street, Adum, Kumasi', gps: 'AK-039-0101', phone: '+233 32 000 3333', note: 'Prempeh II Street · open until 20:00', open: 'Mon–Sat 7:00–20:00' },
];
export const brInfo = (id: string) => BR_INFO.find((b) => b.id === id) ?? BR_INFO[0];
/**
 * Values for the {tokens} in store policies (data/policies.ts), taken from the store's own settings, so the same
 * policy text works for any business. Output: business name, phone, WhatsApp, email, main address, website, hours.
 */
export const tokensOf = (W: Web): TokenValues => ({
  business: W.site.name?.trim() || BIZ, phone: W.site.phone || BR_INFO[0].phone, whatsapp: W.site.whatsapp || W.site.phone || '',
  email: W.site.email || '', address: `${BR_INFO[0].address} (GhanaPostGPS ${BR_INFO[0].gps})`, website: W.seo.domain || window.location.host, hours: W.site.hours || BR_INFO[0].open,
});
export const mapsHref = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
export const dirHref = (q: string) => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
export const embedHref = (q: string) => 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=15&output=embed';
export const waHref = (n: string, text = '') => 'https://wa.me/' + String(n).replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');

/** Each category's line on the shop page and its tile colour (the demo shop sells electronics and appliances). */
export const CAT_INFO: Record<string, [string, string]> = {
  TV: ['Smart, 4K and QLED TVs from TCL, Nasco, Samsung, LG, Hisense and Sony · hire purchase available.', '#e4e7ef'],
  Fridge: ['Table-top, single-door, double-door and side-by-side fridges.', '#e3f2fd'],
  'Air Conditioner': ['Split, inverter and floor-standing air conditioners, with installation.', '#e1f5fe'],
  Freezer: ['Chest freezers for homes, shops and chop bars.', '#ede7f6'],
  Fan: ['Standing, wall, ceiling, tower and rechargeable fans.', '#fff3e0'],
  'DStv & GOtv': ['Decoders, dish kits and monthly subscriptions.', '#e8eaf6'],
  'Sound & Home Theatre': ['Soundbars, home theatre systems and Bluetooth speakers.', '#f3e5f5'],
  'Washing Machine': ['Front-load, top-load and twin-tub washing machines.', '#e0f2f1'],
  Microwave: ['Solo and grill microwaves.', '#fbe9e7'],
  'Stabiliser & Power': ['Voltage stabilisers, fridge guards and UPS to protect your appliances.', '#eceff1'],
  'Water Dispenser': ['Hot and cold water dispensers.', '#e1f5fe'],
};

export type SP = {
  id: string; name: string; cat: string; sku: string; price: number; was?: number;
  ct?: { size: number; price: number; label: string; was?: number };
  desc: string; bullets: string[]; tone: string; stock: Record<string, number | null>; isNew: boolean; best: boolean; sold: number; order: number; img?: string;
};

const TONES = ['#e9e4dc', '#dfe3dd', '#e6dfd6', '#ece6dd', '#e3e6e8', '#e1e4df', '#e6eaec', '#e8e3e6'];

/** Whether a branch sells a product online (not limited to another branch, and stocked there in Post to online). */
export function sellsOnlineAt(p: Product, W: Web, br: string) {
  const bw = W.branches[br];
  return !((p.scope !== 'all' && p.scope !== br) || bw?.stocked === 'none' || (bw?.stocked === 'pick' && !(bw.picked || []).includes(p.id)));
}

/**
 * The website's product list. Stock per branch is the same live figure the till uses (lib/stock.ts):
 * branch stock − sold − held by online baskets (this shopper's too), open till sales and parked sales.
 * Inputs: Products, Post to online settings, stock moves, holds and parked sales. Output: one SP per live product.
 */
export function buildProducts(P: Product[], W: Web, moves: Moves, holds: Holds = {}, parked: ParkedLike[] = []): SP[] {
  const today = todayIso();
  const live = P.filter((p) => p.web && p.status === 'live' && W.desc[p.id]?.live !== false);
  const top = [...live].sort((a, b) => b.sold30 - a.sold30).slice(0, 3).map((p) => p.id);
  const base = new Set(PRODUCTS0.map((p) => p.id));
  return live.map((p, i) => {
    const d = W.desc[p.id];
    const stock: Record<string, number | null> = {};
    BRS.forEach((b) => { stock[b.id] = sellsOnlineAt(p, W, b.id) ? availAt(p, b.id, moves, holds, parked) : null; });
    // The product's own carton size and name (Products → Units & variants): e.g. noodles carton of 40, malt crate of 24.
    const ctLabel = ctName(p);
    // Same sale rules as the till (lib/pricing.ts): Products scheduled sale or Post to online sale, lower one wins.
    const pr = priceOf(p, d, today);
    const { price, was } = pr;
    const ct = p.carton ? { size: perCarton(p), price: pr.ctPrice ?? p.carton, label: ctLabel, was: pr.ctWas } as SP['ct'] : undefined;
    return {
      id: p.id, name: p.name, cat: p.cat, sku: p.sku, price, was, ct, img: p.img,
      // One description shared with the POS (lib/describe.ts shownDesc): the product's own, else a generated draft.
      desc: shownDesc(p, d?.desc || '', W.site.name?.trim() || BIZ), bullets: (d?.bullets || '').split('\n').map((s) => s.trim()).filter(Boolean),
      tone: CAT_INFO[p.cat]?.[1] ?? TONES[i % TONES.length], stock, isNew: !base.has(p.id) || p.sold30 < 5, best: top.includes(p.id), sold: p.sold30, order: i,
    };
  });
}

export const totalStock = (p: SP) => Object.values(p.stock).reduce<number>((a, n) => a + (n ?? 0), 0);
export const isOos = (p: SP) => totalStock(p) <= 0;
export const isLow = (p: SP) => !isOos(p) && Object.values(p.stock).some((n) => n != null && n > 0 && n <= 10);
export const stockTxt = (n: number | null) => (n == null ? 'Not stocked here' : n <= 0 ? 'Out of stock' : n <= 10 ? `Low stock (${n})` : `${n} in stock`);
/**
 * The stock line on a product card: the total units free across all branches right now (live, after baskets,
 * till sales and parked sales), e.g. "125 in stock · 3 branches" or "Only 6 left".
 */
export const stockLine = (p: SP) => {
  if (isOos(p)) return 'Out of stock';
  const n = totalStock(p); const k = Object.values(p.stock).filter((x) => (x ?? 0) > 0).length;
  return n <= 10 ? `Only ${n} left` : `${n.toLocaleString('en-GB')} in stock · ${k} branch${k === 1 ? '' : 'es'}`;
};
/* ---------- "Complete your order" suggestions ---------- */

/** Categories that go well together in one basket (TV → soundbar, DStv and a stabiliser; fridge → fridge guard …). */
const GOES_WITH: Record<string, string[]> = {
  TV: ['Sound & Home Theatre', 'DStv & GOtv', 'Stabiliser & Power'], Fridge: ['Stabiliser & Power', 'Freezer', 'Water Dispenser'],
  'Air Conditioner': ['Stabiliser & Power', 'Fan'], Freezer: ['Stabiliser & Power', 'Fridge'], Fan: ['Air Conditioner'],
  'DStv & GOtv': ['TV', 'Sound & Home Theatre'], 'Sound & Home Theatre': ['TV', 'DStv & GOtv'], 'Washing Machine': ['Stabiliser & Power'],
  Microwave: ['Fridge', 'Stabiliser & Power'], 'Stabiliser & Power': ['Fridge', 'TV', 'Air Conditioner'], 'Water Dispenser': ['Fridge', 'Stabiliser & Power'],
};
export type Suggestion = { p: SP; why: string };
/**
 * Products to suggest in the basket's "Complete your order" box. There is always a suggestion while anything that is
 * not in the basket is in stock: new arrivals rank first, then products that go with what is in the basket, then
 * best sellers, sale items and small add-ons (GHS 1,000 or less: fans, decoders, stabilisers). `shift` rotates the list ("Show others", and after each add), so a
 * fresh product comes up instead of the same three.
 * Inputs: the store's products, the basket lines (each with its product), how far to rotate, how many to show.
 * Output: up to `n` products, each with a short reason ("New in", "Goes with TCL 43\" 4K UHD Google TV", …).
 */
export function suggestFor(products: SP[], lines: { pid: string; p: SP }[], shift = 0, n = 3): Suggestion[] {
  const inCart = new Set(lines.map((l) => l.pid));
  const cats = new Set(lines.map((l) => l.p.cat));
  const pair = (c: string) => lines.find((l) => (GOES_WITH[l.p.cat] || []).includes(c));
  const ranked = products.filter((p) => !inCart.has(p.id) && !isOos(p)).map((p) => {
    const mate = pair(p.cat);
    const score = (p.isNew ? 6 : 0) + (mate ? 4 : 0) + (cats.has(p.cat) ? 2 : 0) + (p.best ? 2 : 0) + (p.was && p.was > p.price ? 1 : 0) + (p.price <= 1000 ? 1 : 0) + p.sold / 1000;
    const why = p.isNew ? 'New in' : mate ? `Goes with ${mate.p.name}` : p.was && p.was > p.price ? `On sale · was ${money(p.was)}` : p.best ? 'Best seller' : cats.has(p.cat) ? `More ${p.cat.toLowerCase()}` : 'Popular add-on';
    return { p, why, score };
  }).sort((a, b) => b.score - a.score || a.p.order - b.p.order);
  if (!ranked.length) return [];
  // Rotate through the whole ranked list so every product gets its turn; the top picks still come first at shift 0.
  const k = ((shift % ranked.length) + ranked.length) % ranked.length;
  return [...ranked.slice(k), ...ranked.slice(0, k)].slice(0, Math.min(n, ranked.length)).map(({ p, why }) => ({ p, why }));
}

export type Badge = { t: string; cls: string };
export function badgesOf(p: SP, brId?: string): Badge[] {
  const B: Badge[] = [];
  const oos = brId ? (p.stock[brId] ?? 0) <= 0 : isOos(p);
  if (p.isNew) B.push({ t: 'New in', cls: 'bg-danger text-white' });
  if (p.was && p.was > p.price) B.push({ t: `Sale −${Math.round((1 - p.price / p.was) * 100)}%`, cls: 'bg-danger text-white' });
  if (p.best) B.push({ t: '★ Best seller', cls: 'bg-[#f2b705] text-black' });
  if (oos) B.push({ t: 'Out of stock', cls: 'bg-sub text-white' });
  else if (brId ? (p.stock[brId] ?? 0) <= 10 : isLow(p)) B.push({ t: 'Low stock', cls: 'bg-[#b26a00] text-white' });
  return B;
}

export function useStoreData() {
  const [W, up] = useWeb();
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [moves] = usePersist<Moves>('ecompos.stockMoves', {});
  // Live holds (baskets, open till sales) and parked till sales: the website counts them as taken, like the till.
  const [holds] = usePersist<Holds>(HOLDS_KEY, {});
  const [parked] = usePersist<ParkedLike[]>(PARKED_KEY, []);
  const products = useMemo(() => buildProducts(P, W, moves, holds, parked), [P, W, moves, holds, parked]);
  return { W, up, products };
}

/* ---------- phones ---------- */
export const phClean = (v: string) => String(v || '').replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '').slice(0, 9);
export const phOk = (v: string) => phClean(v).length === 9;
export const phFmt = (v: string) => { const d = phClean(v); return d ? `+233 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`.trim() : ''; };
export const phErr = (raw: string) => (/[^\d\s+]/.test(raw) ? 'Use numbers only.' : phClean(raw).length > 0 && phClean(raw).length < 9 ? '9 digits needed after +233.' : '');
const NETP: Record<string, string[]> = { MTN: ['24', '54', '55', '59', '25', '53'], Telecel: ['20', '50'], AirtelTigo: ['26', '56', '27', '57'] };
export const netOf = (v: string) => { const d = phClean(v); return d.length >= 2 ? Object.keys(NETP).find((n) => NETP[n].includes(d.slice(0, 2))) || '' : ''; };

/* ---------- discount codes ---------- */
export type CodeRes = { err?: string; c?: Code; amt: number; label?: string };
export function codeCheck(codes: Code[], raw: string, sub: number, fee: number, phone: string): CodeRes {
  const c = codes.find((x) => x.code === String(raw || '').trim().toUpperCase());
  if (!c) return { err: 'That code does not exist. Check the spelling.', amt: 0 };
  const t = Date.now();
  if (c.paused) return { err: `Code ${c.code} is paused at the moment.`, amt: 0 };
  if (t < new Date(c.from).getTime()) return { err: `Code ${c.code} starts on ${new Date(c.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${new Date(c.from).toTimeString().slice(0, 5)}.`, amt: 0 };
  if (t > new Date(c.to).getTime()) return { err: `Code ${c.code} expired on ${new Date(c.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`, amt: 0 };
  if (c.limit > 0 && c.used >= c.limit) return { err: `Code ${c.code} has been used up.`, amt: 0 };
  const ph = phClean(phone);
  if (c.only && ph && ph !== c.only) return { err: `Code ${c.code} belongs to another customer. Use the phone number it was sent to.`, amt: 0 };
  if (c.once && ph && (c.uses || []).includes(ph)) return { err: `You have already used code ${c.code}.`, amt: 0 };
  if (c.min > 0 && sub < c.min) return { err: `Code ${c.code} needs an order of at least ${money(c.min)}. Add ${money(c.min - sub)} more.`, amt: 0 };
  let amt = c.type === 'pct' ? (sub * c.value) / 100 : c.type === 'cash' ? Math.min(c.value, sub) : fee;
  if (c.type === 'pct' && c.cap > 0) amt = Math.min(amt, c.cap);
  amt = Math.round(amt * 100) / 100;
  return { c, amt, label: c.type === 'pct' ? `${c.value}% off` : c.type === 'cash' ? `${money(c.value)} off` : 'Free delivery' };
}

/* ---------- customers ---------- */
export type Addr = { id: string; label: string; street: string; area: string; gps: string; phone: string; def: boolean };
export type Inbox = { id: string; title: string; body: string; from: string; code?: string; no: string; read: boolean; at: string };
export type Line = { pid: string; unit: 's' | 'c'; qty: number };
export type ShopUser = {
  email: string; name: string; phone: string; pw: string; verified: boolean; offers: boolean; created: string;
  addr: Addr[]; wish: string[]; cart: Line[]; orders: string[]; inbox: Inbox[];
  notif: Record<string, boolean>; linked: Record<string, boolean>; secure: Record<string, boolean>; via?: string;
};
export const USERS0: ShopUser[] = [{
  email: 'ama.owusu@gmail.com', name: 'Ama Owusu', phone: '245550142', pw: 'Adom2026!', verified: true, offers: true, created: '3 Mar 2025',
  addr: [{ id: 'a1', label: 'Home', street: '14 Ring Road East', area: 'Osu, Accra', gps: 'GA-121-4410', phone: '245550142', def: true }, { id: 'a2', label: 'Office', street: 'Independence Avenue, Ridge', area: 'Ridge, Accra', gps: 'GA-055-1290', phone: '245550142', def: false }],
  wish: [], cart: [], orders: ['34422885'], inbox: [{ id: 'm1', title: 'Your order 34422885 is ready to collect', body: 'Show this code at the Osu counter to collect your order.', from: 'Osu branch · Today 10:05', code: '482913', no: '34422885', read: false, at: 'Today 10:05' }],
  notif: { sms: true, whatsapp: true, email: true, offers: true }, linked: { google: true, apple: false, facebook: false }, secure: { twofa: false, alerts: true },
}];
export const pwRules = (pw: string) => [
  { ok: pw.length >= 8, t: 'At least 8 characters' },
  { ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw), t: 'Upper and lower case letters' },
  { ok: /\d/.test(pw), t: 'At least one number' },
  { ok: /[^A-Za-z0-9]/.test(pw), t: 'At least one symbol' },
];
export const pwMeter = (pw: string) => { const n = pwRules(pw).filter((r) => r.ok).length; return { n, label: !pw ? '—' : n <= 1 ? 'Weak' : n === 2 ? 'Fair' : n === 3 ? 'Good' : 'Strong', cls: n <= 1 ? 'bg-danger' : n === 2 ? 'bg-[#b26a00]' : n === 3 ? 'bg-[#f2b705]' : 'bg-ok' }; };

/* ---------- orders ---------- */
export type Fulfil = 'D' | 'P' | 'I';
export type ShopOrder = {
  no: string; code?: string; at: string; ts: number; fulfil: Fulfil; brId: string; where: string; when: string;
  name: string; phone: string; email: string; note: string;
  lines: { pid: string; name: string; sku: string; unit: string; qty: number; each: number }[];
  sub: number; disc: number; codeTxt?: string; fee: number; total: number; pay: string; payKey: string; paid: boolean; payRef?: string; hp?: string; user?: string;
  status?: 'Cancelled'; returnReq?: string;
  /** Whether the Order Confirmation PDF was emailed to the customer (store/docs.ts emailConfirmationOnce). */
  emailed?: 'sent' | 'failed';
};
export const ORDERS0: Record<string, ShopOrder> = {
  '34422885': { no: '34422885', code: '482913', at: '21 Nov 2026, 09:40', ts: Date.now() - 36e5, fulfil: 'P', brId: 'osu', where: 'Click & collect at Osu, Accra', when: 'Today, 11:00', name: 'Ama Owusu', phone: '245550142', email: 'ama.owusu@gmail.com', note: '', lines: [{ pid: 'p3', name: 'Nasco 43" Smart Android TV', sku: 'SKU-P3', unit: 'Single', qty: 1, each: 3499 }, { pid: 'p17', name: 'Binatone 16" Standing Fan', sku: 'SKU-P17', unit: 'Single', qty: 2, each: 450 }], sub: 4399, disc: 0, fee: 0, total: 4399, pay: 'Mobile Money · MTN', payKey: 'momo', paid: true, payRef: 'MOMO_8F2K1Q', user: 'ama.owusu@gmail.com' },
};

export const STEP_D = ['Order placed', 'Packed', 'Out for delivery', 'Delivered'];
export const STEP_P = ['Order placed', 'Packed', 'Ready to collect', 'Collected'];
/** Where an order is now, read live from the staff Orders and Collect screens. */
export function orderState(no: string, wo: WebOrder[], col: Collection[], so?: ShopOrder) {
  const w = wo.find((x) => x.id === no || x.trackId === no);
  const c = col.find((x) => x.no === no);
  const pickup = so ? so.fulfil !== 'D' : w ? w.type !== 'D' : !!c;
  const names = pickup ? STEP_P : STEP_D;
  let idx = 0;
  if (w) idx = pickup ? [0, 0, 1, 2, 3][w.stage] ?? 0 : [0, 0, 1, 2, 2, 3][w.stage] ?? 0;
  if (c) idx = Math.max(idx, { waiting: 0, prep: 0, ready: 2, collected: 3, cancelled: 0 }[c.status]);
  const cancelled = so?.status === 'Cancelled' || w?.status === 'Cancelled' || c?.status === 'cancelled';
  if (w?.status === 'Delivered') idx = 3;
  const times: string[] = names.map((_n, i) => {
    if (i === 0) return w?.placed || so?.at || c?.placedAt || '';
    const hit = w?.track.find((t) => (i === 1 ? /pack/i : i === 2 ? (pickup ? /ready/i : /transit|out for/i) : /deliver|collect/i).test(t.label));
    return hit ? hit.at : i <= idx ? 'Done' : '';
  });
  const status = cancelled ? 'Cancelled' : names[idx];
  return { w, c, pickup, names, idx, cancelled, times, status, canCancel: !cancelled && idx === 0, proof: (w as WebOrder & { proof?: string })?.proof, rider: w?.rider, reason: w?.cancelReason };
}

export const newNo = () => String(34400000 + Math.floor(Math.random() * 99999));
export const newCode = () => String(100000 + Math.floor(Math.random() * 900000));
export const nowStr = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toTimeString().slice(0, 5);

/** Sends the order to Orders (all), Collect (pickups / in store) and the stock count. */
export function pushToStaff(o: ShopOrder, cancelled = false, reason = '') {
  const wo = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const w: WebOrder = {
    id: o.no, ch: 'Website', who: o.name || 'Guest', phone: phFmt(o.phone), items: o.lines.map((l) => [l.qty, l.name + (l.unit !== 'Single' ? ` (${l.unit})` : ''), l.each] as [number, string, number]), fee: o.fee,
    pay: o.pay + (o.paid && !/paid/.test(o.pay) ? ' · paid' : ''), type: o.fulfil, brId: o.brId, where: o.where, placed: o.at, stage: 0, status: cancelled ? 'Cancelled' : 'Active',
    track: [{ label: cancelled ? 'Cancelled' : 'Being confirmed', at: o.at, by: 'Website' }], trackId: o.no, cancelReason: cancelled ? reason : undefined,
  };
  writeKey('ecompos.webOrders2', [w, ...wo.filter((x) => x.id !== o.no)]);
  if (!cancelled && o.fulfil !== 'D' && o.code) {
    const col = readKey<Collection[]>('ecompos.collect2', COLLECTIONS);
    const c: Collection = { no: o.no, code: o.code, name: o.name, phone: phFmt(o.phone), items: o.lines.map((l) => ({ name: l.name, qty: l.qty, total: l.qty * l.each })), total: o.total, fulfil: o.fulfil === 'I' ? 'I' : 'P', branch: brInfo(o.brId).name, pay: o.payKey === 'hp' ? 'hp' : o.paid ? 'momo' : 'counter', paid: o.paid, payRef: o.payRef, status: 'prep', placedAt: o.at, note: o.note };
    writeKey('ecompos.collect2', [c, ...col]);
  }
  // Placed: take the stock at the fulfilling branch, recorded under the order number so a cancel can put it back.
  // The basket's hold is dropped by the caller (Checkout) in the same step.
  if (!cancelled) { const PL = readKey<Product[]>('ecompos.products2', PRODUCTS0); sellStock(o.no, o.brId, o.lines.map((l) => ({ name: l.name, qty: l.unit === 'Single' ? l.qty : l.qty * perCarton(PL.find((x) => x.id === l.pid)) }))); }
}

/** The customer cancelled an order: tell Orders and Collect, and put its stock back on the shelf (once). */
export function cancelAtStaff(no: string, reason: string) {
  returnSaleStock(no);
  const wo = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  writeKey('ecompos.webOrders2', wo.map((x) => (x.id === no ? { ...x, status: 'Cancelled' as const, cancelReason: reason, track: [...x.track, { label: 'Cancelled', at: nowStr(), by: 'Customer' }] } : x)));
  const col = readKey<Collection[]>('ecompos.collect2', COLLECTIONS);
  writeKey('ecompos.collect2', col.map((x) => (x.no === no ? { ...x, status: 'cancelled' as const } : x)));
}

export const paras = (s: string) => String(s || '').split(/\n\s*\n|\n/).map((t) => t.trim()).filter(Boolean);
export const ini = (n: string) => String(n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const stars = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n)));
