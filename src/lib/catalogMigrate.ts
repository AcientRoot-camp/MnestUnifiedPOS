// One-time switch of a device's saved data from the old grocery demo catalogue to the electronics catalogue
// (TVs, fridges, air conditioners, freezers, fans, DStv & GOtv … from brands sold in Ghana). Runs once per device
// (flag ecompos.catalogV) before anything else reads the products:
//  - Products: the new catalogue, plus any product staff added themselves that is not a grocery item.
//  - Categories: the new categories, plus any category staff added themselves that is not a grocery one.
//  - Saved demo records that mention the old grocery products (stock moves, damages, orders, sales, purchase orders,
//    deals, hire purchase, notifications …) are cleared so they reload with the electronics demo data.
//  - Website settings are kept; only the hero, the Google text and reviews still showing the old grocery wording are
//    updated, and old per-product sale prices are dropped (those products no longer exist).
// Accounts, staff, sign-in, security settings and everything else are left as they are.
import { CATS0, PRODUCTS0, type Category, type Product } from '../data/catalogue';
import { readKey, writeKey } from './persist';
import { ABOUT_V2, MORE_UPDATES } from '../data/webContent';

const FLAG = 'ecompos.catalogV';
const VERSION = 'electronics-1';
/** Names of the old grocery demo products (and phrases from their demo records). */
const OLD = ['Jasmine rice', 'Vegetable oil', 'Instant noodles', 'Evaporated milk', 'Sardines', 'Malt drink', 'Bottled water', 'Laundry detergent', 'Gari 1kg', 'Tomato paste',
  'Sugar cubes', 'Bar soap', 'Corned beef', 'Shea butter', 'Loose rice', 'Loose gari', 'Gas cooker 4-burner', 'Deep freezer 300L', 'Binatone Blender', 'Standing Fan 16"', 'Standing Fan 16\\"',
  'Tecno Spark Phone', 'Airtime top-up', 'Rice 50kg', 'Golden Grains Ltd', 'Coastal Foods Ltd', 'Sunrise Oils Ltd'];
const GROCERY_CATS = new Set(['Staples', 'Tins', 'Drinks', 'Household', 'Groceries', 'Baby care']);
const OLD_CATS = new Set([...GROCERY_CATS, 'Appliances', 'Electronics', 'TVs & displays']);
/** Keys that hold accounts, people or settings: never cleared even if a grocery word appears in them. */
const KEEP = new Set(['ecompos.web2', 'ecompos.products2', 'ecompos.cats2', 'ecompos.shopUsers', 'ecompos.shopSession', 'ecompos.staff2', 'ecompos.hr', 'ecompos.idcards', 'ecompos.session',
  'ecompos.accounts3', 'ecompos.sessions', 'ecompos.creds', 'ecompos.profiles', 'ecompos.bizInfo2', 'ecompos.logo', FLAG]);

/** Switch this device to the electronics catalogue (once). */
export function migrateCatalogue() {
  if (typeof localStorage === 'undefined' || readKey<string>(FLAG, '') === VERSION) return;
  const seedIds = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20', 'p21', 'p22', 'p23', 'p24', ...PRODUCTS0.map((p) => p.id)]);

  // Products: the new range plus staff-added products that are not groceries.
  const oldP = readKey<Product[] | null>('ecompos.products2', null);
  if (oldP) writeKey('ecompos.products2', [...PRODUCTS0, ...oldP.filter((p) => !seedIds.has(p.id) && !GROCERY_CATS.has(p.cat))]);
  // Categories: the new list plus staff-added ones that are not grocery or old demo categories.
  const oldC = readKey<Category[] | null>('ecompos.cats2', null);
  if (oldC) writeKey('ecompos.cats2', [...CATS0, ...oldC.filter((c) => !OLD_CATS.has(c.name) && !CATS0.some((n) => n.name === c.name))]);

  // Saved demo records that mention the old products: cleared, so they reload with the new demo data.
  const drop: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || '';
    if (!k.startsWith('ecompos.') || KEEP.has(k)) continue;
    const v = localStorage.getItem(k) || '';
    if (OLD.some((w) => v.includes(w))) drop.push(k);
  }
  // Baskets, stock holds and stock movements point at the old products' ids or names: start them fresh too.
  ['ecompos.shopCart', 'ecompos.stockMoves', 'ecompos.holds', 'ecompos.parked', 'ecompos.batches', 'ecompos.shopRecent', 'ecompos.shopWish'].forEach((k) => { if (localStorage.getItem(k) !== null) drop.push(k); });
  // The CRM seeds all its records together (flag ecompos.crm.seeded): if any CRM record mentioned the old products,
  // clear all of them and the flag, so the CRM reseeds as one consistent set.
  if (drop.some((k) => k.startsWith('ecompos.crm.'))) for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('ecompos.crm.')) drop.push(k); }
  [...new Set(drop)].forEach((k) => localStorage.removeItem(k));
  // Signed-in shoppers' saved baskets and wishlists hold old product ids.
  const users = readKey<{ cart?: unknown[]; wish?: unknown[] }[] | null>('ecompos.shopUsers', null);
  if (users) writeKey('ecompos.shopUsers', users.map((u) => ({ ...u, cart: [], wish: [] })));

  // Website: keep the store's own settings, update only text that still shows the old grocery defaults.
  type W = { site?: Record<string, unknown>; seo?: Record<string, unknown>; reviews?: { product?: string; text?: string }[]; desc?: Record<string, unknown> };
  const web = readKey<W | null>('ecompos.web2', null);
  if (web) {
    const site = { ...(web.site || {}) };
    if (/groceries and household goods/i.test(String(site.heroTitle || ''))) site.heroTitle = 'TVs, fridges and air conditioners, delivered the same day';
    if (/rice, oil, tins/i.test(String(site.heroText || ''))) site.heroText = 'TCL, Nasco, Samsung, LG and Hisense at fair prices, with warranty, installation and hire purchase. Order online, collect at a branch, or get it delivered today.';
    const seo = { ...(web.seo || {}) };
    if (/groceries/i.test(String(seo.title || ''))) seo.title = 'Ebenezer Unique Ventures | TVs, fridges & ACs | Accra & Kumasi';
    if (/rice, oil/i.test(String(seo.desc || ''))) seo.desc = 'Shop TCL, Nasco, Samsung, LG and Hisense TVs, fridges, air conditioners and DStv online. Same-day delivery in Accra and Kumasi, click & collect and hire purchase.';
    if (/groceries/i.test(String(seo.keywords || ''))) seo.keywords = 'TV Accra, fridge Accra, air conditioner Ghana, DStv decoder, TCL, Nasco, Samsung, hire purchase';
    const reviews = (web.reviews || []).map((r) => (OLD.some((w) => String(r.product || '').includes(w)) ? { ...r, product: 'TCL 43" 4K UHD Google TV', text: /rice|oil/i.test(String(r.text || '')) ? 'Ordered my TV at 9 and it arrived, wall-mounted, before lunch. Very reliable.' : r.text } : r));
    // About us and store updates that still carry the old grocery wording take the new electronics text.
    const about = (web as { about?: Record<string, unknown> }).about;
    const about2 = about && /groceries|rice, oil/i.test(`${about.short || ''} ${about.story || ''}`) ? { ...about, ...ABOUT_V2 } : about;
    const ups = ((web as { updates?: { id: string; body?: string }[] }).updates || []).map((u) => (/rice, oil|cooker today/i.test(String(u.body || '')) ? (MORE_UPDATES.find((m) => m.id === u.id) || u) : u));
    const facts = about2 && Array.isArray((about2 as { facts?: string[] }).facts) ? (about2 as { facts: string[] }).facts.map((f) => (f === 'By the carton' ? 'TCL, Nasco, Samsung, LG & more' : f === 'Wholesale' ? 'Brands' : f)) : undefined;
    writeKey('ecompos.web2', { ...web, site, seo, reviews, desc: {}, ...(about2 ? { about: { ...about2, ...(facts ? { facts } : {}) } } : {}), ...((web as { updates?: unknown[] }).updates ? { updates: ups } : {}) });
  }
  writeKey(FLAG, VERSION);
}
