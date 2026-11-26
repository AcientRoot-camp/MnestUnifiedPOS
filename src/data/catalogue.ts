// Catalogue + stock model shared by Products, Categories, Inventory, Warehouse and Damages.
// The demo shop sells electronics and home appliances (TVs, fridges, air conditioners, freezers, fans, DStv / GOtv).
// Branch stock figures come from the prototype's Inventory seed table.
export const BRS = [
  { id: 'osu', name: 'Osu' },
  { id: 'legon', name: 'East Legon' },
  { id: 'adum', name: 'Adum' },
] as const;
export type BrId = (typeof BRS)[number]['id'];
/** True for the drawn product illustrations (scripts/productArt.ts), which carry their own soft background. */
export const isArt = (src?: string) => !!src && src.startsWith('/assets/products/');
/** The illustrations' background, for the space around them when a picture box is not square. */
export const ART_BG = 'linear-gradient(135deg,#eeeaff 0%,#f6f1ff 60%,#ffe9d6 100%)';
export const brName = (id: string) => (id === 'wh' ? 'Warehouse' : BRS.find((b) => b.id === id)?.name ?? id);

export type Product = {
  id: string; name: string; cat: string; sku: string; barcode: string; price: number; carton?: number; cost: number;
  stock: Record<BrId, number>; wh: number; reserved: number; reorder: number; sold30: number;
  web: boolean; pos: boolean; status: 'live' | 'pending' | 'rejected'; desc: string; supplier: string;
  track: 'batch' | 'serial' | 'digital' | 'none'; by?: string; when?: string; reason?: string; scope: 'all' | BrId;
  /** Main photo (first image added in Products) · shown on the till and the website. */ img?: string; isNew?: boolean;
  /** Scheduled sale set in Products → Pricing: discounted single price, optional first/last day ("YYYY-MM-DD"). */
  sale?: number; saleFrom?: string; saleTo?: string;
  /** Carton barcode (ITF-14). When empty, a carton product answers to the standard one made from its single barcode (lib/barcode.ts cartonOf). */
  cartonBc?: string;
  /** Serial numbers scanned when units were received (serial-tracked products, e.g. appliances). */
  serials?: string[];
  /** Singles in one carton / crate / pack (productscan.md §2.3 `ct[0]`, e.g. a pack of 6 batteries). Empty = 12. */
  ctSize?: number;
  /** What the bigger unit is called on the till, labels and receipts. Empty = "Carton". */
  ctLabel?: 'Carton' | 'Crate' | 'Pack';
  /** Extra selling units beyond single and carton (e.g. half carton of 20): each has its own size, price and barcode. */
  units?: ExtraUnit[];
  /** A variant (size) of another product: the parent's id and the size shown (e.g. "10kg"). Own stock, price and barcode. */
  variantOf?: string; size?: string;
  /**
   * Sold by weight (loose rice, gari): price is per kg and stock is counted in kg. plu is the 5-digit item code the
   * weighing scale prints inside its barcode label (lib/barcode.ts scaleRead).
   */
  byWeight?: boolean; plu?: string;
};
/** An extra selling unit: id, name ("Half carton"), how many singles it holds, its price and (optional) own barcode. */
export type ExtraUnit = { id: string; label: string; size: number; price: number; bc?: string };

/** Demo barcode: 12 digits (Ghana prefix 603…) + the GS1 check digit, so the demo packs scan as valid EAN-13s. */
const ean13 = (d: string) => { let sum = 0; for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += parseInt(d[i], 10) * w; return d + String((10 - (sum % 10)) % 10); };
/**
 * Carton sizes that differ from 12 in the demo data. The demo shop now sells electronics (one unit each, no cartons),
 * so there are none; the field stays for shops that sell packs (e.g. a pack of 6 batteries).
 */
export const CT_SEED: Record<string, { ctSize: number; ctLabel: Product['ctLabel'] }> = {};
/** Big electronics are sold one at a time: no carton price unless a product is set up with one in Products. */
const P = (id: string, name: string, cat: string, price: number, s: [number, number, number, number, number], reorder: number, sold30: number, supplier: string, track: Product['track'] = 'serial', wh = 0): Product => ({
  id, name, cat, sku: 'SKU-' + id.toUpperCase(), barcode: ean13('603420' + String(1000000 + parseInt(id.replace(/\D/g, ''), 10) * 7919).slice(-6)),
  price, carton: undefined, ...(CT_SEED[id] || {}), cost: Math.round(price * 0.8 * 100) / 100,
  stock: { osu: s[0], legon: s[1], adum: s[2] }, reserved: s[3], wh: wh || s[4], reorder, sold30, web: true, pos: true, status: 'live',
  desc: `${name}. Available at every branch and online.`, supplier, track, scope: 'all',
  // Product illustration drawn by scripts/productArt.ts (replace it with a real photo in Products → Edit).
  img: `/assets/products/${id}.svg`,
});

/**
 * Demo stock for product number n: 18–30 at Osu, 16–25 at East Legon and 16–25 at Adum (50 or more in all), a few
 * reserved, and 20–60 in the warehouse. Deterministic so every device shows the same figures.
 */
const seedStock = (n: number): [number, number, number, number, number] => [18 + ((n * 7) % 13), 16 + ((n * 5) % 10), 16 + ((n * 3) % 10), n % 3, 20 + ((n * 11) % 41)];
/**
 * The demo catalogue: an electronics shop with brands sold in Ghana — TCL, Nasco, Samsung, LG, Hisense, Midea,
 * Bruhm, Binatone, Sony — and DStv / GOtv from MultiChoice Ghana. Ids p1–p24 are kept so links in demo orders,
 * baskets and reports still point at a product. Prices are typical Accra shelf prices in Ghana cedis.
 */
export const PRODUCTS0: Product[] = [
  P('p1', 'TCL 43" 4K UHD Google TV', 'TV', 4999, seedStock(1), 4, 18, 'TCL Electronics Ghana'),
  P('p2', 'TCL 55" QLED Google TV', 'TV', 8999, seedStock(2), 2, 9, 'TCL Electronics Ghana'),
  P('p3', 'Nasco 43" Smart Android TV', 'TV', 3499, seedStock(3), 4, 22, 'Nasco Electronics'),
  P('p4', 'Samsung 55" Crystal UHD 4K Smart TV', 'TV', 9499, seedStock(4), 2, 11, 'Samsung Electronics West Africa'),
  P('p5', 'LG 50" UHD 4K Smart TV', 'TV', 7499, seedStock(5), 2, 7, 'LG Electronics Ghana'),
  P('p6', 'TCL 252L Double-Door Fridge', 'Fridge', 6499, seedStock(6), 2, 8, 'TCL Electronics Ghana'),
  P('p7', 'Nasco 138L Single-Door Fridge', 'Fridge', 2899, seedStock(7), 3, 16, 'Nasco Electronics'),
  P('p8', 'Samsung 384L Twin Cooling Fridge', 'Fridge', 11999, seedStock(8), 1, 4, 'Samsung Electronics West Africa'),
  P('p9', 'Hisense 205L Double-Door Fridge', 'Fridge', 4299, seedStock(9), 3, 10, 'Hisense Ghana'),
  P('p10', 'TCL 1.5HP Inverter Split Air Conditioner', 'Air Conditioner', 6999, seedStock(10), 3, 14, 'TCL Electronics Ghana'),
  P('p11', 'Nasco 1.5HP Split Air Conditioner', 'Air Conditioner', 5299, seedStock(11), 3, 12, 'Nasco Electronics'),
  P('p12', 'Samsung 1.5HP WindFree Inverter Air Conditioner', 'Air Conditioner', 9999, seedStock(12), 2, 5, 'Samsung Electronics West Africa'),
  P('p13', 'Midea 2HP Split Air Conditioner', 'Air Conditioner', 7800, seedStock(13), 2, 4, 'Midea Ghana'),
  P('p14', 'Bruhm 300L Chest Freezer', 'Freezer', 5499, seedStock(14), 2, 6, 'Bruhm Ghana'),
  P('p15', 'Nasco 32" HD LED TV', 'TV', 1850, seedStock(15), 3, 15, 'Nasco Electronics'),
  P('p16', 'Hisense 43" Smart VIDAA TV', 'TV', 3650, seedStock(16), 2, 9, 'Hisense Ghana'),
  P('p17', 'Binatone 16" Standing Fan', 'Fan', 450, seedStock(17), 8, 46, 'Binatone Ghana'),
  P('p18', 'Nasco 18" Wall Fan', 'Fan', 520, seedStock(18), 6, 31, 'Nasco Electronics'),
  P('p19', 'DStv HD Decoder & Dish Kit', 'DStv & GOtv', 899, seedStock(19), 6, 27, 'MultiChoice Ghana'),
  P('p20', 'DStv Compact subscription (1 month)', 'DStv & GOtv', 335, seedStock(20), 0, 140, 'MultiChoice Ghana', 'digital'),
  P('p23', 'GOtv Supa+ Decoder', 'DStv & GOtv', 349, seedStock(23), 6, 33, 'MultiChoice Ghana'),
  P('p24', 'Samsung 3.1 Soundbar with Subwoofer', 'Sound & Home Theatre', 3999, seedStock(24), 2, 5, 'Samsung Electronics West Africa'),
];
/**
 * The rest of the range (p25 onwards): [name, category, price GHS, supplier]. Stock is spread over the branches so
 * every product has 50 or more units (see seedStock).
 */
const RANGE: [string, string, number, string][] = [
  ['TCL 32" HD Android TV', 'TV', 2199, 'TCL Electronics Ghana'],
  ['TCL 40" FHD Android TV', 'TV', 3099, 'TCL Electronics Ghana'],
  ['TCL 50" 4K UHD Google TV', 'TV', 5999, 'TCL Electronics Ghana'],
  ['TCL 65" 4K UHD Google TV', 'TV', 10999, 'TCL Electronics Ghana'],
  ['TCL 65" QLED Google TV', 'TV', 12999, 'TCL Electronics Ghana'],
  ['TCL 75" QLED Google TV', 'TV', 17999, 'TCL Electronics Ghana'],
  ['TCL 85" Mini-LED Google TV', 'TV', 34999, 'TCL Electronics Ghana'],
  ['Nasco 24" HD LED TV', 'TV', 1199, 'Nasco Electronics'],
  ['Nasco 40" FHD Smart TV', 'TV', 2799, 'Nasco Electronics'],
  ['Nasco 50" 4K Smart TV', 'TV', 4799, 'Nasco Electronics'],
  ['Nasco 55" 4K Smart TV', 'TV', 5799, 'Nasco Electronics'],
  ['Nasco 65" 4K Smart TV', 'TV', 8999, 'Nasco Electronics'],
  ['Samsung 32" HD Smart TV', 'TV', 2899, 'Samsung Electronics West Africa'],
  ['Samsung 43" Crystal UHD 4K Smart TV', 'TV', 5799, 'Samsung Electronics West Africa'],
  ['Samsung 50" Crystal UHD 4K Smart TV', 'TV', 7299, 'Samsung Electronics West Africa'],
  ['Samsung 65" Crystal UHD 4K Smart TV', 'TV', 13999, 'Samsung Electronics West Africa'],
  ['Samsung 55" QLED 4K Smart TV', 'TV', 11999, 'Samsung Electronics West Africa'],
  ['Samsung 65" QLED 4K Smart TV', 'TV', 16999, 'Samsung Electronics West Africa'],
  ['Samsung 75" Crystal UHD 4K Smart TV', 'TV', 21999, 'Samsung Electronics West Africa'],
  ['LG 32" HD Smart TV', 'TV', 2699, 'LG Electronics Ghana'],
  ['LG 43" UHD 4K Smart TV', 'TV', 5299, 'LG Electronics Ghana'],
  ['LG 55" UHD 4K Smart TV', 'TV', 8499, 'LG Electronics Ghana'],
  ['LG 65" UHD 4K Smart TV', 'TV', 12499, 'LG Electronics Ghana'],
  ['LG 65" NanoCell 4K Smart TV', 'TV', 15999, 'LG Electronics Ghana'],
  ['LG 55" OLED evo 4K Smart TV', 'TV', 24999, 'LG Electronics Ghana'],
  ['Hisense 32" HD Smart TV', 'TV', 2099, 'Hisense Ghana'],
  ['Hisense 50" 4K UHD Smart TV', 'TV', 5199, 'Hisense Ghana'],
  ['Hisense 55" 4K UHD Smart TV', 'TV', 6299, 'Hisense Ghana'],
  ['Hisense 65" 4K UHD Smart TV', 'TV', 9799, 'Hisense Ghana'],
  ['Hisense 65" ULED 4K Smart TV', 'TV', 13999, 'Hisense Ghana'],
  ['Sony 43" Bravia 4K Google TV', 'TV', 7499, 'Sony Ghana'],
  ['Sony 55" Bravia 4K Google TV', 'TV', 11999, 'Sony Ghana'],
  ['Sony 65" Bravia 4K Google TV', 'TV', 16999, 'Sony Ghana'],
  ['Skyworth 32" HD Android TV', 'TV', 1899, 'Skyworth Ghana'],
  ['Skyworth 43" FHD Android TV', 'TV', 2999, 'Skyworth Ghana'],
  ['Skyworth 55" 4K Google TV', 'TV', 5999, 'Skyworth Ghana'],
  ['TCL 120L Single-Door Fridge', 'Fridge', 2399, 'TCL Electronics Ghana'],
  ['TCL 330L Double-Door Inverter Fridge', 'Fridge', 7999, 'TCL Electronics Ghana'],
  ['TCL 516L Side-by-Side Fridge', 'Fridge', 15999, 'TCL Electronics Ghana'],
  ['Nasco 90L Table-Top Fridge', 'Fridge', 1699, 'Nasco Electronics'],
  ['Nasco 210L Double-Door Fridge', 'Fridge', 3999, 'Nasco Electronics'],
  ['Nasco 350L Double-Door Fridge', 'Fridge', 5999, 'Nasco Electronics'],
  ['Samsung 203L Double-Door Fridge', 'Fridge', 5499, 'Samsung Electronics West Africa'],
  ['Samsung 253L Digital Inverter Fridge', 'Fridge', 6999, 'Samsung Electronics West Africa'],
  ['Samsung 655L Side-by-Side Fridge', 'Fridge', 21999, 'Samsung Electronics West Africa'],
  ['LG 190L Smart Inverter Single-Door Fridge', 'Fridge', 4499, 'LG Electronics Ghana'],
  ['LG 260L Smart Inverter Double-Door Fridge', 'Fridge', 7499, 'LG Electronics Ghana'],
  ['LG 423L Double-Door Fridge', 'Fridge', 11499, 'LG Electronics Ghana'],
  ['LG 674L InstaView Side-by-Side Fridge', 'Fridge', 27999, 'LG Electronics Ghana'],
  ['Hisense 120L Single-Door Fridge', 'Fridge', 2499, 'Hisense Ghana'],
  ['Hisense 270L Double-Door Fridge', 'Fridge', 5299, 'Hisense Ghana'],
  ['Hisense 508L Side-by-Side Fridge', 'Fridge', 12999, 'Hisense Ghana'],
  ['Midea 92L Table-Top Fridge', 'Fridge', 1799, 'Midea Ghana'],
  ['Midea 207L Double-Door Fridge', 'Fridge', 4199, 'Midea Ghana'],
  ['Bruhm 150L Single-Door Fridge', 'Fridge', 2699, 'Bruhm Ghana'],
  ['Bruhm 240L Double-Door Fridge', 'Fridge', 4699, 'Bruhm Ghana'],
  ['Haier 180L Single-Door Fridge', 'Fridge', 3199, 'Haier Ghana'],
  ['Roch 98L Table-Top Fridge', 'Fridge', 1599, 'Roch Ghana'],
  ['TCL 1HP Split Air Conditioner', 'Air Conditioner', 4999, 'TCL Electronics Ghana'],
  ['TCL 2HP Inverter Split Air Conditioner', 'Air Conditioner', 8999, 'TCL Electronics Ghana'],
  ['TCL 2.5HP Split Air Conditioner', 'Air Conditioner', 10999, 'TCL Electronics Ghana'],
  ['Nasco 1HP Split Air Conditioner', 'Air Conditioner', 4199, 'Nasco Electronics'],
  ['Nasco 2HP Split Air Conditioner', 'Air Conditioner', 6999, 'Nasco Electronics'],
  ['Samsung 1HP Inverter Split Air Conditioner', 'Air Conditioner', 7499, 'Samsung Electronics West Africa'],
  ['Samsung 2HP WindFree Inverter Air Conditioner', 'Air Conditioner', 13499, 'Samsung Electronics West Africa'],
  ['LG 1HP Dual Inverter Split Air Conditioner', 'Air Conditioner', 7299, 'LG Electronics Ghana'],
  ['LG 1.5HP Dual Inverter Split Air Conditioner', 'Air Conditioner', 8999, 'LG Electronics Ghana'],
  ['LG 2HP Dual Inverter Split Air Conditioner', 'Air Conditioner', 11999, 'LG Electronics Ghana'],
  ['Hisense 1HP Split Air Conditioner', 'Air Conditioner', 4799, 'Hisense Ghana'],
  ['Hisense 1.5HP Split Air Conditioner', 'Air Conditioner', 5999, 'Hisense Ghana'],
  ['Hisense 2HP Split Air Conditioner', 'Air Conditioner', 7499, 'Hisense Ghana'],
  ['Midea 1HP Split Air Conditioner', 'Air Conditioner', 4599, 'Midea Ghana'],
  ['Midea 1.5HP Split Air Conditioner', 'Air Conditioner', 5899, 'Midea Ghana'],
  ['Midea 3HP Floor-Standing Air Conditioner', 'Air Conditioner', 18999, 'Midea Ghana'],
  ['Bruhm 1.5HP Split Air Conditioner', 'Air Conditioner', 5499, 'Bruhm Ghana'],
  ['Westpool 1.5HP Split Air Conditioner', 'Air Conditioner', 4999, 'Westpool Ghana'],
  ['Haier 1.5HP Inverter Split Air Conditioner', 'Air Conditioner', 6499, 'Haier Ghana'],
  ['Nasco 150L Chest Freezer', 'Freezer', 2799, 'Nasco Electronics'],
  ['Nasco 250L Chest Freezer', 'Freezer', 3999, 'Nasco Electronics'],
  ['Bruhm 200L Chest Freezer', 'Freezer', 4199, 'Bruhm Ghana'],
  ['Bruhm 500L Chest Freezer', 'Freezer', 7999, 'Bruhm Ghana'],
  ['Hisense 150L Chest Freezer', 'Freezer', 2999, 'Hisense Ghana'],
  ['Hisense 300L Chest Freezer', 'Freezer', 4799, 'Hisense Ghana'],
  ['Midea 198L Chest Freezer', 'Freezer', 3699, 'Midea Ghana'],
  ['Haier 200L Chest Freezer', 'Freezer', 3999, 'Haier Ghana'],
  ['Roch 230L Chest Freezer', 'Freezer', 3899, 'Roch Ghana'],
  ['Binatone 18" Standing Fan', 'Fan', 520, 'Binatone Ghana'],
  ['Binatone 16" Table Fan', 'Fan', 380, 'Binatone Ghana'],
  ['Binatone 56" Ceiling Fan', 'Fan', 650, 'Binatone Ghana'],
  ['Nasco 16" Standing Fan', 'Fan', 430, 'Nasco Electronics'],
  ['Nasco 56" Ceiling Fan', 'Fan', 620, 'Nasco Electronics'],
  ['Nasco 14" Rechargeable Fan', 'Fan', 690, 'Nasco Electronics'],
  ['Midea 16" Standing Fan', 'Fan', 470, 'Midea Ghana'],
  ['Midea Tower Fan', 'Fan', 899, 'Midea Ghana'],
  ['Westpool 18" Standing Fan', 'Fan', 499, 'Westpool Ghana'],
  ['Westpool 16" Wall Fan', 'Fan', 420, 'Westpool Ghana'],
  ['Roch 16" Standing Fan', 'Fan', 399, 'Roch Ghana'],
  ['DStv Explora Ultra Decoder', 'DStv & GOtv', 1499, 'MultiChoice Ghana'],
  ['DStv Smart LNB', 'DStv & GOtv', 149, 'MultiChoice Ghana'],
  ['DStv Premium subscription (1 month)', 'DStv & GOtv', 1100, 'MultiChoice Ghana'],
  ['DStv Compact Plus subscription (1 month)', 'DStv & GOtv', 535, 'MultiChoice Ghana'],
  ['DStv Family subscription (1 month)', 'DStv & GOtv', 185, 'MultiChoice Ghana'],
  ['GOtv Max subscription (1 month)', 'DStv & GOtv', 115, 'MultiChoice Ghana'],
  ['GOtv Supa+ subscription (1 month)', 'DStv & GOtv', 150, 'MultiChoice Ghana'],
  ['LG 2.1 Soundbar 300W', 'Sound & Home Theatre', 2499, 'LG Electronics Ghana'],
  ['LG 5.1 Home Theatre System', 'Sound & Home Theatre', 3999, 'LG Electronics Ghana'],
  ['Sony 2.1 Soundbar HT-S100F', 'Sound & Home Theatre', 2299, 'Sony Ghana'],
  ['Samsung 5.1 Soundbar HW-Q600C', 'Sound & Home Theatre', 5999, 'Samsung Electronics West Africa'],
  ['TCL 2.1 Soundbar S522W', 'Sound & Home Theatre', 1899, 'TCL Electronics Ghana'],
  ['Nasco 5.1 Home Theatre System', 'Sound & Home Theatre', 1999, 'Nasco Electronics'],
  ['JBL Flip 6 Bluetooth Speaker', 'Sound & Home Theatre', 1599, 'Sony Ghana'],
  ['JBL PartyBox 110 Speaker', 'Sound & Home Theatre', 4999, 'Sony Ghana'],
  ['Sony SRS-XB13 Bluetooth Speaker', 'Sound & Home Theatre', 799, 'Sony Ghana'],
  ['LG 7kg Top Load Washing Machine', 'Washing Machine', 5499, 'LG Electronics Ghana'],
  ['Samsung 8kg Front Load Washing Machine', 'Washing Machine', 8999, 'Samsung Electronics West Africa'],
  ['Hisense 7kg Twin Tub Washing Machine', 'Washing Machine', 2999, 'Hisense Ghana'],
  ['Midea 8kg Top Load Washing Machine', 'Washing Machine', 4599, 'Midea Ghana'],
  ['Nasco 9kg Twin Tub Washing Machine', 'Washing Machine', 2799, 'Nasco Electronics'],
  ['TCL 10kg Front Load Washing Machine', 'Washing Machine', 9499, 'TCL Electronics Ghana'],
  ['Samsung 23L Solo Microwave', 'Microwave', 1599, 'Samsung Electronics West Africa'],
  ['LG 20L Solo Microwave', 'Microwave', 1399, 'LG Electronics Ghana'],
  ['Midea 20L Microwave', 'Microwave', 1099, 'Midea Ghana'],
  ['Nasco 25L Grill Microwave', 'Microwave', 1299, 'Nasco Electronics'],
  ['Binatone 20L Microwave', 'Microwave', 999, 'Binatone Ghana'],
  ['Sollatek 1000VA Voltage Stabiliser', 'Stabiliser & Power', 799, 'Sollatek Ghana'],
  ['Sollatek 2000VA Voltage Stabiliser', 'Stabiliser & Power', 1299, 'Sollatek Ghana'],
  ['Sollatek Fridge Guard', 'Stabiliser & Power', 249, 'Sollatek Ghana'],
  ['APC 1200VA UPS', 'Stabiliser & Power', 1899, 'Sollatek Ghana'],
  ['Binatone 5000VA Voltage Stabiliser', 'Stabiliser & Power', 2499, 'Binatone Ghana'],
  ['Nasco Hot & Cold Water Dispenser', 'Water Dispenser', 1499, 'Nasco Electronics'],
  ['Midea Water Dispenser with Fridge', 'Water Dispenser', 2799, 'Midea Ghana'],
  ['Hisense Hot & Cold Water Dispenser', 'Water Dispenser', 1699, 'Hisense Ghana'],
  ['Bruhm Water Dispenser', 'Water Dispenser', 1399, 'Bruhm Ghana'],
];
RANGE.forEach(([name, cat, price, supplier], i) => {
  const n = 25 + i;
  PRODUCTS0.push(P(`p${n}`, name, cat, price, seedStock(n), 10, 4 + ((n * 13) % 57), supplier, /subscription/i.test(name) ? 'digital' : 'serial'));
});
/**
 * Goods sold by weight (price per kg, sold by scanning a weighing-scale label). The electronics demo shop has none;
 * kept so the scale set-up and the till still support them for shops that do.
 */
export const WEIGHED0: Product[] = [];
// Two products waiting for the Admin (added by a Manager / Supervisor), as in the prototype's approval queue.
PRODUCTS0.push(
  { ...P('p21', 'LG 8kg Front Load Washing Machine', 'Washing Machine', 8499, seedStock(21), 2, 0, 'LG Electronics Ghana'), status: 'pending', cost: 0, by: 'Ama Darko (Manager)', when: 'Today 09:12', web: true, pos: true },
  { ...P('p22', 'Sony 5.1 Home Theatre System', 'Sound & Home Theatre', 4500, seedStock(22), 2, 0, 'Sony Ghana'), status: 'pending', cost: 0, by: 'Kwame Asante (Supervisor)', when: 'Yesterday 16:40', web: true, pos: false },
);

export type Category = { name: string; desc: string; parent: string; color: string; till: boolean; online: boolean; archived: boolean };
export const CATS0: Category[] = [
  { name: 'TV', desc: 'LED, smart, 4K and QLED TVs from TCL, Nasco, Samsung, LG and Hisense · hire purchase available', parent: '', color: '#000000', till: true, online: true, archived: false },
  { name: 'Fridge', desc: 'Single-door, double-door and large fridges · hire purchase available', parent: '', color: '#0b6bcb', till: true, online: true, archived: false },
  { name: 'Air Conditioner', desc: 'Split and inverter air conditioners, 1HP to 2.5HP, with installation', parent: '', color: '#0b5c5c', till: true, online: true, archived: false },
  { name: 'Freezer', desc: 'Chest and upright freezers for homes, shops and chop bars', parent: '', color: '#3b5bdb', till: true, online: true, archived: false },
  { name: 'Fan', desc: 'Standing, wall and ceiling fans', parent: '', color: '#b26a00', till: true, online: true, archived: false },
  { name: 'DStv & GOtv', desc: 'Decoders, dish kits and monthly subscriptions', parent: '', color: '#1f4fa0', till: true, online: true, archived: false },
  { name: 'Sound & Home Theatre', desc: 'Soundbars, home theatre systems and speakers', parent: '', color: '#6b3fa0', till: true, online: true, archived: false },
  { name: 'Washing Machine', desc: 'Front-load and top-load washing machines', parent: '', color: '#1f7a7a', till: true, online: true, archived: false },
  { name: 'Microwave', desc: 'Solo and grill microwaves', parent: '', color: '#c62828', till: true, online: true, archived: false },
  { name: 'Stabiliser & Power', desc: 'Voltage stabilisers, fridge guards and UPS to protect your appliances', parent: '', color: '#444444', till: true, online: true, archived: false },
  { name: 'Water Dispenser', desc: 'Hot and cold water dispensers', parent: '', color: '#0b6bcb', till: true, online: true, archived: false },
  { name: 'Services', desc: 'Installation, wall mounting and delivery', parent: '', color: '#1f7a2a', till: true, online: false, archived: false },
];

export const SUPPLIERS = [
  { name: 'TCL Electronics Ghana', contact: 'Kofi Boateng · 024 300 1180', terms: 'Repair or replace under warranty (2 years)', lead: 10 },
  { name: 'Nasco Electronics', contact: 'Kwame Osei · 020 900 1122', terms: 'Repair or replace under warranty', lead: 7 },
  { name: 'Samsung Electronics West Africa', contact: 'Efua Kumi · 030 221 7788', terms: 'Repair at an authorised service centre', lead: 14 },
  { name: 'LG Electronics Ghana', contact: 'Yaw Darko · 030 290 4455', terms: 'Replace dead-on-arrival units within 7 days', lead: 14 },
  { name: 'Hisense Ghana', contact: 'Kojo Mensah · 020 455 9011', terms: 'Credit note within 30 days', lead: 10 },
  { name: 'Midea Ghana', contact: 'Abena Owusu · 024 118 2020', terms: 'Repair or replace under warranty', lead: 14 },
  { name: 'Bruhm Ghana', contact: 'Kwesi Aidoo · 024 771 3300', terms: 'Replace dented or faulty units on proof', lead: 7 },
  { name: 'Binatone Ghana', contact: 'Ama Boakye · 030 221 0000', terms: 'Credit note within 14 days', lead: 5 },
  { name: 'MultiChoice Ghana', contact: 'Dealer desk · 030 274 4040', terms: 'Replace faulty decoders within 30 days', lead: 3 },
  { name: 'Sony Ghana', contact: 'Nana Asare · 020 811 4499', terms: 'Repair at an authorised service centre', lead: 21 },
  { name: 'Skyworth Ghana', contact: 'Esi Quaye · 024 660 3121', terms: 'Repair or replace under warranty', lead: 14 },
  { name: 'Haier Ghana', contact: 'Kwabena Frimpong · 020 733 5810', terms: 'Repair or replace under warranty', lead: 14 },
  { name: 'Roch Ghana', contact: 'Adjoa Mensah · 024 552 9087', terms: 'Credit note within 14 days', lead: 7 },
  { name: 'Westpool Ghana', contact: 'Fiifi Ansah · 026 410 2276', terms: 'Credit note within 14 days', lead: 7 },
  { name: 'Sollatek Ghana', contact: 'Richard Owusu · 030 223 6655', terms: 'Replace faulty units within 12 months', lead: 5 },
];

export type Move = { id: string; kind: 'sup' | 'wh2br' | 'br2wh' | 'br2br'; from: string; to: string; supplier?: string; lines: { name: string; qty: number; dmg?: number }[]; reason: string; note: string; status: 'requested' | 'in_transit' | 'received' | 'cancelled'; by: string; at: string; ref?: string; log: { t: string }[] };
export const MOVES0: Move[] = [
  { id: 'TR-0091', kind: 'wh2br', from: 'wh', to: 'adum', lines: [{ name: 'TCL 43" 4K UHD Google TV', qty: 6 }, { name: 'TCL 55" QLED Google TV', qty: 3 }], reason: 'Restock', note: '', status: 'in_transit', by: 'Ebenezer Mensah', at: 'Today 08:10', log: [{ t: 'Dispatched by Ebenezer Mensah · Today 08:10' }] },
  { id: 'TR-0090', kind: 'br2br', from: 'legon', to: 'osu', lines: [{ name: 'Samsung 55" Crystal UHD 4K Smart TV', qty: 2 }], reason: 'Low stock', note: 'Call Ama on arrival', status: 'requested', by: 'Ama Darko', at: 'Yesterday 17:20', log: [{ t: 'Requested by Ama Darko · Yesterday 17:20' }] },
  { id: 'GRN-0311', kind: 'sup', from: 'Samsung Electronics West Africa', to: 'wh', supplier: 'Samsung Electronics West Africa', lines: [{ name: 'Samsung 384L Twin Cooling Fridge', qty: 4 }, { name: 'Samsung 1.5HP WindFree Inverter Air Conditioner', qty: 6 }], reason: 'New stock', note: '', status: 'received', by: 'Ebenezer Mensah', at: '17 Nov 10:40', ref: 'INV-88214', log: [{ t: 'Received into Warehouse · 17 Nov 10:40' }] },
  { id: 'TR-0088', kind: 'br2br', from: 'legon', to: 'osu', lines: [{ name: 'TCL 252L Double-Door Fridge', qty: 2 }], reason: 'Low stock', note: '', status: 'received', by: 'Efua Sarpong', at: '16 Nov 15:05', log: [{ t: 'Received at Osu · 16 Nov 16:30' }] },
];

export type Damage = { id: string; name: string; qty: number; src: 'storage' | 'customer' | 'transit'; loc: string; note: string; cause: string; liable: 'supplier' | 'us' | 'transport'; supplier: string; value: number; status: 'reported' | 'at_supplier' | 'returned' | 'written_off' | 'closed'; at: string; claimId?: string; rcv?: number; log: { t: string }[] };
export const DAMAGES0: Damage[] = [
  { id: 'DM-0044', name: 'Nasco 138L Single-Door Fridge', qty: 1, src: 'storage', loc: 'osu', note: 'Door dented, found when the box was opened', cause: 'Packaging damage', liable: 'supplier', supplier: 'Nasco Electronics', value: 2899, status: 'reported', at: 'Today 09:05', log: [{ t: 'Reported by Akua Kyei · Today 09:05' }] },
  { id: 'DM-0043', name: 'Nasco 32" HD LED TV', qty: 1, src: 'transit', loc: 'adum', note: 'Screen cracked on arrival from the warehouse', cause: 'Handling in transit', liable: 'transport', supplier: 'Nasco Electronics', value: 1850, status: 'reported', at: 'Yesterday 14:20', log: [{ t: 'Reported by Kofi Antwi · Yesterday 14:20' }] },
  { id: 'DM-0042', name: 'Nasco 18" Wall Fan', qty: 1, src: 'customer', loc: 'legon', note: 'Customer return R-0112 · motor not working', cause: 'Manufacturing fault', liable: 'supplier', supplier: 'Nasco Electronics', value: 520, status: 'at_supplier', at: '17 Nov', claimId: 'CL-0019', log: [{ t: 'Sent to Nasco Electronics on claim CL-0019' }] },
  { id: 'DM-0040', name: 'TCL 43" 4K UHD Google TV', qty: 1, src: 'storage', loc: 'osu', note: 'Remote control missing from the box', cause: 'Packaging damage', liable: 'supplier', supplier: 'TCL Electronics Ghana', value: 4999, status: 'closed', at: '12 Nov', log: [{ t: 'Replaced by TCL Electronics Ghana · closed' }] },
  { id: 'DM-0038', name: 'Binatone 16" Standing Fan', qty: 2, src: 'storage', loc: 'adum', note: 'Roof leak soaked the boxes on the bottom row', cause: 'Storage conditions', liable: 'us', supplier: 'Binatone Ghana', value: 900, status: 'written_off', at: '9 Nov', log: [{ t: 'Written off by Yaw Boakye' }] },
];

export type Claim = { id: string; supplier: string; items: string[]; status: 'draft' | 'sent' | 'collected' | 'closed'; at: string; log: { t: string }[] };
export const CLAIMS0: Claim[] = [{ id: 'CL-0019', supplier: 'Nasco Electronics', items: ['DM-0042'], status: 'collected', at: '17 Nov', log: [{ t: 'Claim sent · 17 Nov' }, { t: 'Supplier collected the items · 18 Nov' }] }];

export const total = (p: Product) => p.stock.osu + p.stock.legon + p.stock.adum;
export const now = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + new Date().toTimeString().slice(0, 5);
