// Online store content, managed in "Post to online" and read live by the customer store (/shop).
import { useCallback, useMemo } from 'react';
import { usePersist } from '../lib/persist';
import { BRS } from './catalogue';
import { OLD_POLICY_BODIES, POLICY_TEMPLATES } from './policies';
import { ABOUT_V2, CONTACT_INTRO_V2, MORE_FAQS, MORE_JOBS, MORE_UPDATES, OLD_ABOUT, OLD_CONTACT_INTRO } from './webContent';

export type Code = { code: string; type: 'pct' | 'cash' | 'ship'; value: number; cap: number; min: number; from: string; to: string; limit: number; once: boolean; note: string; paused: boolean; banner: boolean; used: number; by: string; pushed?: string; uses?: string[]; only?: string };
export type UpdTarget = 'shop' | 'branches' | 'contact' | 'about';
export type Upd = { id: string; title: string; kind: string; body: string; cta: string; to?: UpdTarget; img?: string; pinned: boolean; live: boolean; at: string };
export type Job = {
  id: string; title: string; dept: string; br: string; type: string; salMin: string; salMax: string; open: boolean; apps: number; summary: string;
  role?: string; openings?: number; closes?: string; showSal?: boolean; duties?: string; reqs?: string; offer?: string; docs?: string[]; draft?: boolean;
};
export type Review = { id: string; name: string; place: string; text: string; product: string; stars: number; verified: boolean; hidden: boolean; flagged?: boolean; photo?: string; at?: string };
export type Page = { slug: string; title: string; body: string; live: boolean; builtin: boolean; policy?: boolean; img?: string; inNav?: boolean; inFooter?: boolean; seoTitle?: string; seoDesc?: string; updated?: string;
  /** Uploaded PDF version of the page (Post to online › Store policies), embedded on the store page with a download button. */
  doc?: { name: string; dataUrl: string } };
export type Zone = { name: string; fee: number; eta: string; on: boolean };
export type Faq = { id: string; cat: string; q: string; a: string; on: boolean };
export type BranchWeb = {
  show: boolean; hours: string; whatsapp: string; email: string; services: string; note: string; map: string;
  manager?: string; landmark?: string; parking?: string; areas?: string; pays?: string; lat?: string; lng?: string; photos?: string[]; stocked?: 'all' | 'none' | 'pick'; picked?: string[];
};
export type Site = {
  name: string; social: Record<string, string>; hero: string;
  logo?: string; heroPics?: string[]; heroVideo?: string; heroInterval?: number; heroArt?: boolean; tagline?: string; heroTitle?: string; heroText?: string;
  announceOn?: boolean; announce?: string; phone?: string; whatsapp?: string; email?: string; hours?: string; contactIntro?: string; footerLine?: string;
  trustpilot?: string; newsOn?: boolean; log?: string[];
};
export type Web = {
  codes: Code[]; updates: Upd[]; jobs: Job[];
  desc: Record<string, { desc: string; bullets: string; seoTitle: string; seoDesc: string; live: boolean; sale: string; ctSale?: string; saleFrom?: string; saleTo?: string }>;
  about: { title: string; founded: string; short: string; story: string; values: string; facts: string[]; storyTitle?: string; aim?: string; vision?: string; mission?: string; photos?: string[] };
  branches: Record<string, BranchWeb>; reviews: Review[]; pages: Page[];
  seo: { domain: string; title: string; desc: string; keywords: string; robots: string; ga: string; redirects: [string, string][]; ogTitle?: string; ogDesc?: string; gsc?: string; pixel?: string; perPage?: Record<string, { title: string; desc: string }> };
  plugins: Record<string, boolean>; zones: Zone[]; freeOver: number; freeOn: boolean; collect: number; collectNote?: string;
  site: Site; faqs: Faq[]; navNames: Record<string, string>; lastPost?: string;
  /** Version of the ready-made content this store has received (see CONTENT_V and mergeWeb). */
  contentV?: number;
};

const D = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 16);

export const FAQ0: Faq[] = [
  ['Orders & delivery', 'How fast is delivery?', 'Orders placed in Accra before 15:00 are delivered the same day. Kumasi deliveries go out the next working day.'],
  ['Orders & delivery', 'How much does delivery cost?', 'The delivery charge depends on your area and is shown at checkout before you pay. Orders over the free-delivery amount shown in the basket are delivered free.'],
  ['Orders & delivery', 'Can I collect my order from a branch?', 'Yes. Choose click and collect at checkout and pick your order up from the branch you select. Bring your 6-digit collection code.'],
  ['Orders & delivery', 'How do I track my order?', 'Use Track order at the top of the store and enter the 8-digit order number from your confirmation. We also send SMS and WhatsApp updates when your order is on its way.'],
  ['Payments', 'How can I pay?', 'You can pay with Mobile Money (MTN, Telecel, AirtelTigo), GhPay, Paystack (card, MoMo or bank), bank transfer, or pay on delivery with cash or MoMo to the rider.'],
  ['Payments', 'Do your prices include tax?', 'Yes. Prices are in Ghana cedis and include VAT and levies where they apply. You get a receipt for every order.'],
  ['Payments', 'How do I use a discount code?', 'Type the code in the discount box at checkout and press Apply. Codes have a start and end date and some have a usage limit.'],
  ['Returns & refunds', 'Can I return something?', 'Bring back unused items with the receipt within 7 days for an exchange or refund.'],
  ['Returns & refunds', 'What if an electrical item is faulty?', 'Faulty electrical items are covered by the manufacturer’s warranty. Bring the item and receipt to any branch and we will help you claim it.'],
  ['Shopping with us', 'Do you sell wholesale?', 'Yes. Many products can be bought by the piece or by the carton at wholesale prices. For large or regular orders, send us a message on the Contact page for a quote.'],
  ['Shopping with us', 'Are prices the same in the shop and online?', 'Yes. Prices are the same in every branch and online.'],
  ['Shopping with us', 'Where are your branches?', 'We have branches in Osu and East Legon in Accra, and Adum in Kumasi. See the Branches page for addresses, opening hours and phone numbers.'],
  ['Account & support', 'Do I need an account to order?', 'No. You can check out as a guest. With an account you can see past orders, reorder quickly and keep a wishlist.'],
  ['Account & support', 'How do I contact you?', 'Use the form on the Contact page, call your nearest branch, or message us on WhatsApp. We reply within the hour during opening times.'],
  ['Account & support', 'Are you hiring?', 'See Careers & opportunities for open jobs. You can apply online and upload your CV.'],
].map(([cat, q, a], i) => ({ id: 'fq' + (i + 1), cat, q, a, on: true } as Faq)).concat(MORE_FAQS);

export const NAV_NAMES0: Record<string, string> = { shop: 'Shop', about: 'About us', branches: 'Branches', contact: 'Contact', updates: 'Updates', reviews: 'Reviews', careers: 'Careers & opportunities', faqs: 'FAQs', track: 'Track order' };

const BR_EXTRA: Record<string, Partial<BranchWeb>> = {
  osu: { manager: 'Ama Darko', landmark: 'Opposite the Osu Castle road junction', parking: 'Free parking in front', areas: 'Osu, Labone, Cantonments, Ridge', pays: 'Cash, MoMo, card, hire purchase', lat: '5.5560', lng: '-0.1820', hours: 'Mon–Sat 7:30–21:00 · Sun 10:00–18:00' },
  legon: { manager: 'Kwame Asante', landmark: 'Near A&C Mall', parking: 'Shared mall parking', areas: 'East Legon, Shiashie, Adjiringanor', pays: 'Cash, MoMo, card', lat: '5.6370', lng: '-0.1540', hours: 'Mon–Sat 8:00–21:00 · Sun 11:00–18:00' },
  adum: { manager: 'Kofi Antwi', landmark: 'Next to the Prempeh II roundabout', parking: 'Street parking', areas: 'Adum, Ahodwo, Asokwa', pays: 'Cash, MoMo, hire purchase', lat: '6.6900', lng: '-1.6250', hours: 'Mon–Sat 7:00–20:00' },
};

/**
 * Built-in illustrations for the big picture at the top of the online store (public/assets). They are shown when
 * the Admin has not uploaded photos, or mixed in with the photos when "Also show the built-in illustrations" is on
 * (site.heroArt). Each is 1600 × 720 with its products in the right-hand part, so the heading on computers and the
 * right-aligned crop on phones never cover them.
 */
export const HERO_ART: { src: string; name: string }[] = [
  { src: '/assets/hero-electronics.svg', name: 'TV, fridge, air conditioner and fan' },
  { src: '/assets/hero-kitchen.svg', name: 'Microwave, washing machine and water dispenser' },
  { src: '/assets/hero-cooling.svg', name: 'Air conditioner, chest freezer and fans' },
  { src: '/assets/hero-entertainment.svg', name: 'Smart TV, soundbar, speakers and GOtv' },
  { src: '/assets/hero-power.svg', name: 'Stabiliser, UPS and fridge guard' },
];
/** True for one of the built-in illustrations (they are aligned right on phones; photos stay centred). */
export const isHeroArt = (u: string) => HERO_ART.some((a) => a.src === u);

export const WEB0: Web = {
  codes: [
    { code: 'BLACKFRI', type: 'pct', value: 15, cap: 500, min: 300, from: D(-6), to: D(10), limit: 0, once: true, note: 'Black Friday electronics', paused: false, banner: true, used: 212, by: 'Ebenezer Mensah' },
    { code: 'WELCOME10', type: 'cash', value: 10, cap: 0, min: 100, from: D(-300), to: D(300), limit: 0, once: true, note: 'First order', paused: false, banner: false, used: 1044, by: 'Ebenezer Mensah' },
  ],
  updates: [
    { id: 'u1', title: 'New Samsung TVs in store', kind: 'New stock', body: '55" 4K Crystal UHD TVs now at Osu and East Legon. Available on hire purchase.', cta: 'Shop the offer', to: 'shop', pinned: true, live: true, at: '18 Nov' },
    { id: 'u2', title: 'Adum branch now opens on Sundays', kind: 'Announcement', body: 'From this week, Adum opens 10:00–16:00 on Sundays.', cta: 'See branches', to: 'branches', pinned: false, live: true, at: '12 Nov' },
    ...MORE_UPDATES,
  ],
  jobs: [
    { id: 'j1', title: 'Sales assistant', dept: 'Sales', br: 'osu', type: 'Full time', salMin: '1800', salMax: '2400', open: true, apps: 14, summary: 'Serve customers at the till and keep the shop floor tidy.', role: 'Sales', openings: 2, closes: D(21).slice(0, 10), showSal: true, duties: 'Serve customers at the till\nKeep shelves full and tidy\nHelp with click & collect orders', reqs: 'SHS certificate or higher\nFriendly and honest\nSpeaks English and Twi', offer: 'Monthly salary and SSNIT\nStaff discount\nTraining on the till system', docs: ['CV / résumé'] },
    { id: 'j2', title: 'Delivery rider', dept: 'Delivery', br: 'legon', type: 'Full time', salMin: '1600', salMax: '2000', open: true, apps: 6, summary: 'Deliver online orders around East Legon and Accra safely and on time.', role: 'Rider', openings: 1, closes: D(14).slice(0, 10), showSal: true, duties: 'Deliver orders and collect payment on delivery\nTake photo proof of delivery\nLook after the company motorbike', reqs: 'Valid motorbike licence (class A)\nKnows Accra well\nOwns a smartphone', offer: 'Monthly salary plus delivery bonus\nFuel and helmet provided', docs: ['CV / résumé', 'Driving licence'] },
    ...MORE_JOBS,
  ],
  desc: {},
  about: {
    title: 'About us', founded: '2019', storyTitle: 'Our story',
    // Fuller ready-made About content (webContent.ts): short intro, story, values, aim, vision, mission.
    ...ABOUT_V2,
    facts: ['Branches', '3', 'Brands', 'TCL, Nasco, Samsung, LG & more', 'Delivery', 'Same day'],
    photos: [],
  },
  branches: Object.fromEntries(BRS.map((b) => [b.id, { show: true, hours: 'Mon–Sat 08:00–21:00', whatsapp: '+233 24 400 0111', email: `${b.id}@ebenezerunique.com.gh`, services: 'Click & collect, delivery, wholesale', note: '', map: '', stocked: 'all' as const, picked: [], photos: [], ...BR_EXTRA[b.id] }])),
  reviews: [
    { id: 'r1', name: 'Esi Mensah', place: 'Osu, Accra', text: 'Ordered my TV at 9 and it arrived, wall-mounted, before lunch. Very reliable.', product: 'TCL 43" 4K UHD Google TV', stars: 5, verified: true, hidden: false, at: '16 Nov' },
    { id: 'r2', name: 'Kwame Ntim', place: 'East Legon', text: 'Got my TV on hire purchase. The process was simple and the staff were patient.', product: 'Hisense 43" Smart TV', stars: 5, verified: true, hidden: false, at: '11 Nov' },
    { id: 'r4', name: 'Abena Ofori', place: 'Ahodwo, Kumasi', text: 'Good price on my chest freezer for the shop. Collection at Adum was quick.', product: 'Bruhm 300L Chest Freezer', stars: 4, verified: true, hidden: false, at: '6 Nov' },
    { id: 'r3', name: 'Anonymous', place: 'Kumasi', text: 'Rubbish service!!! call me 0244…', product: '', stars: 1, verified: false, hidden: true, flagged: true },
  ],
  pages: [
    ...['Shop', 'About us', 'Branches', 'Contact', 'Updates', 'Reviews', 'Careers & opportunities', 'FAQs'].map((t) => ({ slug: t.toLowerCase().replace(/\W+/g, '-').replace(/-$/, ''), title: t, body: '', live: true, builtin: true })),
    // Store policies from the templates in policies.ts ({tokens} are filled in from the store settings when shown).
    ...POLICY_TEMPLATES.map((t) => ({ ...t, live: true, builtin: false, policy: true, updated: '24 Nov 2026' })),
  ],
  seo: { domain: 'shop.ebenezerunique.com.gh', title: 'Ebenezer Unique Ventures | TVs, fridges & ACs | Accra & Kumasi', desc: 'Shop TCL, Nasco, Samsung, LG and Hisense TVs, fridges, air conditioners and DStv online. Same-day delivery in Accra and Kumasi, click & collect and hire purchase.', keywords: 'TV Accra, fridge Accra, air conditioner Ghana, DStv decoder, TCL, Nasco, Samsung, hire purchase', robots: 'index', ga: '', redirects: [['/promo', '/pages/updates']], ogTitle: '', ogDesc: '', gsc: '', pixel: '', perPage: {} },
  plugins: { whatsapp: true, ga: false, pixel: false, reviews: true, chat: false, mailchimp: false },
  zones: [
    { name: 'Osu, Cantonments, Labone', fee: 20, eta: 'Same day', on: true },
    { name: 'East Legon, Shiashie, Adjiringanor', fee: 25, eta: 'Same day', on: true },
    { name: 'Adum, Ahodwo, Asokwa (Kumasi)', fee: 20, eta: 'Same day', on: true },
    { name: 'Rest of Ghana · courier', fee: 45, eta: '1–3 days', on: true },
  ],
  freeOver: 500, freeOn: true, collect: 0, collectNote: '',
  site: {
    name: '', social: { tiktok: 'https://www.tiktok.com/@ebenezerunique', instagram: 'https://www.instagram.com/ebenezerunique', facebook: 'https://www.facebook.com/ebenezerunique', whatsapp: 'https://wa.me/233244000111', youtube: '', x: '' }, hero: 'slides',
    logo: '', heroPics: [], heroVideo: '', heroInterval: 4, heroArt: false, tagline: '', heroTitle: 'TVs, fridges and air conditioners, delivered the same day', heroText: 'TCL, Nasco, Samsung, LG and Hisense at fair prices, with warranty, installation and hire purchase. Order online, collect at a branch, or get it delivered today.',
    announceOn: false, announce: 'Free delivery in Accra on orders over GHS 500 this week.', phone: '+233 30 000 1111', whatsapp: '+233 24 400 0111', email: 'info@ebenezerunique.com.gh', hours: 'Mon–Sat 8:00–20:00 · Sun 12:00–18:00',
    contactIntro: CONTACT_INTRO_V2, footerLine: 'Accra · Kumasi', trustpilot: '', newsOn: true, log: [],
  },
  faqs: FAQ0,
  navNames: {},
  contentV: 3,
};

/** Fills in anything an older saved copy is missing, so new fields always have a value. */
export function mergeWeb(w: Partial<Web> | null | undefined): Web {
  const x = w || {};
  const branches: Record<string, BranchWeb> = {};
  Object.keys(WEB0.branches).forEach((id) => { branches[id] = { ...WEB0.branches[id], ...(x.branches?.[id] || {}) }; });
  // --- Ready-made content upgrade (pure and repeatable; it is saved with the store's next change) ---
  // 1. Store policies are always available: any missing one is added back from its template, and one still
  //    holding the old short text gets the full template. A policy the company edited is never touched.
  const policy = (pg: Page): Page => (pg.policy && OLD_POLICY_BODIES[pg.slug] === pg.body ? { ...pg, body: POLICY_TEMPLATES.find((t) => t.slug === pg.slug)!.body } : pg);
  let pages = (Array.isArray(x.pages) ? x.pages : WEB0.pages).map(policy);
  POLICY_TEMPLATES.forEach((t) => { if (!pages.some((pg) => pg.slug === t.slug)) pages = [...pages, { ...t, live: true, builtin: false, policy: true, updated: '24 Nov 2026' }]; });
  // 2. Once per store (contentV below 2): add the new FAQs, updates and jobs it does not have yet. After that,
  //    anything the company deletes stays deleted, because contentV 2 is saved with their next change.
  const old = (x.contentV ?? 1) < 2;
  const topUp = <T extends { id: string }>(have: T[] | undefined, more: T[], base: T[]) => { const list = Array.isArray(have) ? have : base; return old ? [...list, ...more.filter((m) => !list.some((l) => l.id === m.id))] : list; };
  // 3. About and contact texts still at their old defaults move to the fuller versions; edited texts stay.
  const about = { ...WEB0.about, ...(x.about || {}) };
  (Object.keys(OLD_ABOUT) as (keyof typeof OLD_ABOUT)[]).forEach((k) => { if (about[k] === OLD_ABOUT[k]) about[k] = ABOUT_V2[k]; });
  const site = { ...WEB0.site, ...(x.site || {}), social: { ...WEB0.site.social, ...(x.site?.social || {}) } };
  if (site.contactIntro === OLD_CONTACT_INTRO) site.contactIntro = CONTACT_INTRO_V2;
  // 4. Once per store (contentV below 3): the picture card used to change every 5 s by default and now changes every
  //    4 s; a store still on the old default moves to 4 s. The old demo tagline "Accra · Kumasi · family-run" is
  //    cleared (it is no longer shown). Choices made after this upgrade are kept, because contentV 3 is saved.
  if ((x.contentV ?? 1) < 3) {
    if (site.heroInterval === 5 || !site.heroInterval) site.heroInterval = 4;
    if ((site.tagline || '').trim() === 'Accra · Kumasi · family-run') site.tagline = '';
  }
  return {
    ...WEB0, ...x,
    about,
    site,
    seo: { ...WEB0.seo, ...(x.seo || {}) },
    branches,
    pages,
    faqs: topUp(x.faqs, MORE_FAQS, WEB0.faqs),
    updates: topUp(x.updates, MORE_UPDATES, WEB0.updates),
    jobs: topUp(x.jobs, MORE_JOBS, WEB0.jobs),
    navNames: x.navNames || {},
    contentV: 3,
  } as Web;
}

export function useWeb() {
  const [raw, setRaw] = usePersist<Web>('ecompos.web2', WEB0);
  const W = useMemo(() => mergeWeb(raw), [raw]);
  const up = useCallback((p: Partial<Web>) => setRaw((w) => ({ ...mergeWeb(w), ...p, lastPost: new Date().toISOString() })), [setRaw]);
  return [W, up] as const;
}

export const navName = (W: Web, k: string) => (W.navNames[k] || '').trim() || NAV_NAMES0[k] || k;
