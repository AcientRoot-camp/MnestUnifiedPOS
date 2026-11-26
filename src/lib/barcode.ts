// Product barcodes (productscan.md): check digits, formats, the validation message under the Barcode field, shop-made
// "200…" codes, ITF-14 carton codes, per-product carton sizes, extra units, weighing-scale labels, GS1-128 batch /
// expiry codes, the till's barcode map, one resolver every scan screen uses, and EAN-13 / EAN-8 bars for labels.
import { CT_SEED, PRODUCTS0, WEIGHED0, type Product } from '../data/catalogue';
import { readKey, writeKey } from './persist';

/** GS1 mod-10 check digit for the digits before it (weights 3,1,3,1… from the right). */
export const checkDigit = (d: string) => { let sum = 0; for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += parseInt(d[i], 10) * w; return String((10 - (sum % 10)) % 10); };
/** True when the last digit is the right check digit. */
export const checkOk = (v: string) => /^\d{2,}$/.test(v) && checkDigit(v.slice(0, -1)) === v.slice(-1);
/** True for a standard EAN-8, UPC-A or EAN-13 with a correct check digit (the IT scanner test). */
export const eanOk = (c: string) => /^\d{8}$|^\d{12,13}$/.test(c) && checkOk(c);

/** Format name by length: 8 EAN-8, 12 UPC-A, 13 EAN-13, 14 ITF-14 (carton). */
export const FORMATS: Record<number, string> = { 8: 'EAN-8', 12: 'UPC-A', 13: 'EAN-13', 14: 'ITF-14 (carton)' };
/** A scanned value as it is looked up: trimmed, spaces removed. */
export const cleanCode = (v: string) => String(v || '').trim().replace(/\s/g, '');

/** Default carton size: a product with no carton size set counts a carton as 12 singles. */
export const CARTON = 12;
/** Singles in one of this product's cartons / crates / packs (productscan.md §2.3 `ct[0]`). */
export const perCarton = (p: Pick<Product, 'ctSize'> | undefined) => (p?.ctSize && p.ctSize > 1 ? Math.round(p.ctSize) : CARTON);
/** What this product's bigger unit is called: Carton, Crate or Pack. */
export const ctName = (p: Pick<Product, 'ctLabel'> | undefined) => p?.ctLabel || 'Carton';
/** "carton of 40", "crate of 24": used on the till, receipts, scan messages and stock screens. */
export const cartonTxt = (p: Pick<Product, 'ctSize' | 'ctLabel'> | undefined) => `${ctName(p).toLowerCase()} of ${perCarton(p)}`;
/** Weighed goods: a quantity in kg to 3 decimals ("1.250 kg"); anything else as a whole number. */
export const qtyTxt = (p: Pick<Product, 'byWeight'> | undefined, n: number) => (p?.byWeight ? `${(Math.round(n * 1000) / 1000).toFixed(3)} kg` : String(Math.round(n * 1000) / 1000));

/**
 * A product's carton barcode: the one saved on it, else (for products sold by the carton) the standard ITF-14 made
 * from its single barcode, so existing carton products can be scanned without re-entering anything.
 */
export const cartonOf = (p: Product) => (p.cartonBc ? cleanCode(p.cartonBc) : p.carton ? cartonCodeFor(p.barcode) : '');
/** Every barcode a product answers to: its main barcode, its carton (ITF-14) barcode and its extra units' barcodes. */
export const codesOf = (p: Product) => [p.barcode ? cleanCode(p.barcode) : '', cartonOf(p), ...(p.units || []).map((u) => cleanCode(u.bc || ''))].filter(Boolean) as string[];
/** The product that already uses a code (main or carton), leaving out one product (the one being edited). */
export const ownerOf = (P: Product[], code: string, exceptId = '') => P.find((p) => p.id !== exceptId && codesOf(p).includes(code));

export type BcCheck = { msg: string; color: string; block: boolean };
/**
 * The live message under a Barcode field (productscan.md §2.1). Inputs: the value, all products and the product
 * being edited (so its own code is not a clash). Output: message, colour and whether it blocks Save (a duplicate).
 */
export function barcodeCheck(raw: string, P: Product[], exceptId = ''): BcCheck {
  const v = cleanCode(raw);
  if (!v) return { msg: 'Scan the barcode printed on the pack so the till can find this product by scanning.', color: '#5f5c5a', block: false };
  const dup = ownerOf(P, v, exceptId);
  if (dup) return { msg: `Already used by ${dup.name}. Each barcode can belong to one product only.`, color: '#c62828', block: true };
  const fmt = FORMATS[v.length];
  if (!/^\d+$/.test(v) || !fmt) return { msg: `Saved as a custom code (${v.length} characters). Check it matches the pack.`, color: '#5f5c5a', block: false };
  return checkOk(v)
    ? { msg: `${fmt} · check digit correct · not used by any other product`, color: '#1f7a2a', block: false }
    : { msg: `${fmt} · check digit does not match, scan again or check the number`, color: '#c62828', block: false };
}

/**
 * The next shop-made barcode: "200" (in-store range) + 9 digits + check digit = a valid EAN-13. Numbers come from a
 * stored sequence (ecompos.shopBcSeq) and any code already on a product is skipped, so a code is never repeated.
 * A hosted system should take the number from a server sequence so two tills never make the same code.
 */
export function nextShopBarcode(P: Product[]): string {
  const used = new Set(P.flatMap(codesOf));
  let n = Math.max(readKey<number>('ecompos.shopBcSeq', 100000), 100000);
  let code = '';
  do { n += 1; const base = '200' + String(n).padStart(9, '0'); code = base + checkDigit(base); } while (used.has(code));
  writeKey('ecompos.shopBcSeq', n);
  return code;
}

/** ITF-14 carton barcode from a single's EAN-13: indicator 1 + its first 12 digits + a new check digit. */
export function cartonCodeFor(single: string): string {
  const v = cleanCode(single);
  if (!/^\d{13}$/.test(v)) return '';
  const base = '1' + v.slice(0, 12);
  return base + checkDigit(base);
}

/* ---------- the till's barcode map ---------- */

/** What a barcode stands for: the product and the unit (s single, c carton, u an extra unit with its id). */
export type BcHit = { pid: string; unit: 's' | 'c' | 'u'; uid?: string };
/** barcode → product and unit for a list of products (every code of every product in the list). */
export function codeIndex(P: Product[]): Record<string, BcHit> {
  const M: Record<string, BcHit> = {};
  P.forEach((p) => {
    if (p.barcode) M[cleanCode(p.barcode)] = { pid: p.id, unit: 's' };
    const ct = cartonOf(p);
    if (ct && p.carton) M[ct] = { pid: p.id, unit: 'c' };
    (p.units || []).forEach((u) => { if (u.bc) M[cleanCode(u.bc)] = { pid: p.id, unit: 'u', uid: u.id }; });
  });
  return M;
}
/** The products one branch's till may scan: sold at the till, approved (live), company-wide or this branch's own. */
export const tillProducts = (P: Product[], br: string) => P.filter((p) => p.pos !== false && p.status === 'live' && (p.scope === 'all' || p.scope === br));
/**
 * barcode → product and unit for one branch's till (productscan.md §3.2). Only products sold at the till, approved and
 * company-wide or belonging to this branch are in the map, so pending, rejected, non-till and other-branch products
 * cannot be scanned. Built from the products saved on the device, so it keeps working offline.
 */
export const barcodeMap = (P: Product[], br: string) => codeIndex(tillProducts(P, br));

/* ---------- weighing-scale labels (productscan.md §5.2 HW-08) ---------- */

/**
 * Scale label prefixes (IT management → Weighing scale): an EAN-13 that starts with the weight prefix carries the
 * weight in grams, one that starts with the price prefix carries the price in pesewas. Layout: PP IIIII VVVVV C =
 * 2-digit prefix, the product's 5-digit item code (PLU), 5-digit value, check digit. Shop codes start 200, so the
 * scale prefixes must be 21–29.
 */
export type ScaleCfg = { w: string; p: string };
export const SCALE_KEY = 'ecompos.scaleCfg';
export const scaleCfg = (): ScaleCfg => ({ w: '21', p: '22', ...readKey<Partial<ScaleCfg>>(SCALE_KEY, {}) });
/** A weighing-scale label read: the product, the weight in kg and the price for that weight. null if it is not one. */
export function scaleRead(raw: string, P: Product[], cfg = scaleCfg()): { p: Product; kg: number; price: number } | null {
  const v = cleanCode(raw);
  if (!/^\d{13}$/.test(v) || !checkOk(v)) return null;
  const pre = v.slice(0, 2);
  if (pre !== cfg.w && pre !== cfg.p) return null;
  const plu = v.slice(2, 7); const val = parseInt(v.slice(7, 12), 10);
  const p = P.find((x) => x.byWeight && x.plu === plu);
  if (!p || !(val > 0)) return null;
  if (pre === cfg.w) { const kg = val / 1000; return { p, kg, price: Math.round(kg * p.price * 100) / 100 }; }
  const price = val / 100;
  return { p, kg: Math.round((price / p.price) * 1000) / 1000, price };
}
/** Make a scale label code (for tests and the IT page sample): weight in kg, or a price in GHS when byPrice. */
export function scaleCode(plu: string, value: number, byPrice = false, cfg = scaleCfg()) {
  const base = (byPrice ? cfg.p : cfg.w) + plu.padStart(5, '0').slice(-5) + String(Math.round(value * (byPrice ? 100 : 1000))).padStart(5, '0').slice(-5);
  return base + checkDigit(base);
}

/* ---------- GS1-128 / GS1 DataMatrix: batch and expiry on cartons (productscan.md §2.4) ---------- */

/** What a GS1 code carries: GTIN-14, batch (AI 10), expiry (AI 17, as YYYY-MM-DD), serial (AI 21), count (AI 30/37). */
export type Gs1 = { gtin?: string; batch?: string; expiry?: string; best?: string; serial?: string; count?: number };
const FIXED: Record<string, number> = { '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2 };
const VARIABLE = new Set(['10', '21', '22', '30', '37', '240', '241', '250', '400']);
const GS = String.fromCharCode(29);
/** YYMMDD → YYYY-MM-DD (DD 00 = last day of that month, as GS1 allows). */
const gsDate = (d: string) => { const y = 2000 + parseInt(d.slice(0, 2), 10); const m = parseInt(d.slice(2, 4), 10); let day = parseInt(d.slice(4, 6), 10); if (!day) day = new Date(y, m, 0).getDate(); return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };
/**
 * Read a GS1 element string, with brackets "(01)…(17)…(10)…" or raw with the FNC1 / GS separator (what scanners send,
 * sometimes after the "]C1" symbology prefix). Output: the fields found, or null when the value is not GS1.
 */
export function parseGs1(raw0: string): Gs1 | null {
  let raw = String(raw0 || '').trim().replace(/^\](C1|d2|Q3|e0)/, '');
  const put = (o: Gs1, ai: string, v: string) => {
    if (ai === '01' || ai === '02') o.gtin = v;
    else if (ai === '10') o.batch = v;
    else if (ai === '17') o.expiry = gsDate(v);
    else if (ai === '15') o.best = gsDate(v);
    else if (ai === '21') o.serial = v;
    else if (ai === '30' || ai === '37') o.count = parseInt(v, 10) || undefined;
  };
  const o: Gs1 = {};
  if (/^\(\d{2,4}\)/.test(raw)) {
    const re = /\((\d{2,4})\)([^()]*)/g; let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) put(o, m[1], m[2].trim());
    return Object.keys(o).length ? o : null;
  }
  // Raw form: only when it clearly is GS1 (a separator, or GTIN-14 followed by another AI), so ordinary codes pass by.
  const looks = raw.includes(GS) || /^01\d{14}(1[01234567]|21|30|37|10)/.test(raw) || /^00\d{18}/.test(raw);
  if (!looks) return null;
  raw = raw.replace(/^\x1d/, '');
  let i = 0; let guard = 0;
  while (i < raw.length && guard++ < 30) {
    const ai2 = raw.slice(i, i + 2); const ai3 = raw.slice(i, i + 3); const ai4 = raw.slice(i, i + 4);
    if (FIXED[ai2]) { put(o, ai2, raw.slice(i + 2, i + 2 + FIXED[ai2])); i += 2 + FIXED[ai2]; }
    else if (/^31\d\d$/.test(ai4)) i += 4 + 6; // net weight: skipped (scale labels are read by scaleRead)
    else { const ai = VARIABLE.has(ai3) ? ai3 : VARIABLE.has(ai2) ? ai2 : ''; if (!ai) break; const end = raw.indexOf(GS, i); const v = raw.slice(i + ai.length, end < 0 ? raw.length : end); put(o, ai, v); i = end < 0 ? raw.length : end + 1; }
    if (raw[i] === GS) i++;
  }
  return o.gtin || o.batch || o.expiry ? o : null;
}

/* ---------- one resolver for every scan screen ---------- */

/** A resolved scan: product, unit, how many singles (kg for weighed goods) it stands for, the unit's name and price. */
export type Scan = { p: Product; unit: 's' | 'c' | 'u' | 'w'; n: number; label: string; price?: number; uid?: string; gs1?: Gs1; kg?: number; code: string };
/**
 * What a scanned value means, given the products that may be scanned here and their code index:
 * a barcode (single 1, carton = its carton size, extra unit = its size), a weighing-scale label (kg and price), or a
 * GS1-128 carton code whose GTIN matches a barcode (batch / expiry kept on the result). Output: null if nothing matches.
 */
export function resolveCode(P: Product[], M: Record<string, BcHit>, raw: string): Scan | null {
  const v = cleanCode(raw);
  if (!v) return null;
  const byHit = (h: BcHit, code: string, gs1?: Gs1): Scan | null => {
    const p = P.find((x) => x.id === h.pid); if (!p) return null;
    if (h.unit === 'c') return { p, unit: 'c', n: perCarton(p), label: cartonTxt(p), price: p.carton, code, gs1 };
    if (h.unit === 'u') { const u = (p.units || []).find((x) => x.id === h.uid); if (u) return { p, unit: 'u', n: u.size, label: `${u.label.toLowerCase()} of ${u.size}`, price: u.price, uid: u.id, code, gs1 }; }
    return { p, unit: 's', n: 1, label: 'single', price: p.price, code, gs1 };
  };
  if (M[v]) return byHit(M[v], v);
  const sc = scaleRead(v, P);
  if (sc) return { p: sc.p, unit: 'w', n: sc.kg, kg: sc.kg, price: sc.price, label: `${sc.kg.toFixed(3)} kg`, code: v };
  const g = parseGs1(String(raw || '').trim());
  if (g?.gtin) {
    // A GTIN-14 is either the carton code itself or "0" + the single's EAN-13 (or "00" + a UPC-A).
    const tries = [g.gtin, g.gtin.replace(/^0/, ''), g.gtin.replace(/^00/, '')];
    for (const t of tries) if (M[t]) { const r = byHit(M[t], t, g); if (r && g.count && r.unit === 's') r.n = g.count; return r; }
  }
  return null;
}
/** True when a GS1 expiry date has passed (the till refuses expired batches). */
export const expired = (g?: Gs1, today = new Date()) => !!g?.expiry && g.expiry < `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

/* ---------- one-time update of products saved before carton sizes existed ---------- */

/**
 * Products saved on a device before carton sizes and weighed goods existed keep working with 12 per carton. This
 * gives the demo products their real carton sizes (noodles 40, malt drink crate 24, water pack 12) with a matching
 * carton price, and adds the loose rice / gari sold by weight. Runs once per device (ecompos.ctMigrated).
 */
export function migrateProducts() {
  if (readKey<boolean>('ecompos.ctMigrated', false)) return;
  const L = readKey<Product[] | null>('ecompos.products2', null);
  if (L) {
    const seed = Object.fromEntries(PRODUCTS0.map((p) => [p.id, p]));
    const out = L.map((p) => (CT_SEED[p.id] && !p.ctSize ? { ...p, ...CT_SEED[p.id], carton: seed[p.id]?.carton ?? p.carton } : p));
    WEIGHED0.forEach((w) => { if (!out.some((p) => p.id === w.id)) out.push(w); });
    writeKey('ecompos.products2', out);
  }
  writeKey('ecompos.ctMigrated', true);
}

/* ---------- printed bars (labels) ---------- */

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/**
 * Bar pattern ("1" = black module) for an EAN-13 (a 12-digit UPC-A is printed as EAN-13 with a leading 0) or EAN-8.
 * Output: { bits, text } or null for codes that cannot be printed as EAN (custom codes, ITF-14).
 */
export function eanBits(code: string): { bits: string; text: string } | null {
  let v = cleanCode(code);
  if (/^\d{12}$/.test(v)) v = '0' + v;
  if (/^\d{13}$/.test(v)) {
    const par = PARITY[+v[0]];
    let b = '101';
    for (let i = 1; i <= 6; i++) b += (par[i - 1] === 'L' ? L : G)[+v[i]];
    b += '01010';
    for (let i = 7; i <= 12; i++) b += R[+v[i]];
    return { bits: b + '101', text: v };
  }
  if (/^\d{8}$/.test(v)) {
    let b = '101';
    for (let i = 0; i < 4; i++) b += L[+v[i]];
    b += '01010';
    for (let i = 4; i < 8; i++) b += R[+v[i]];
    return { bits: b + '101', text: v };
  }
  return null;
}
