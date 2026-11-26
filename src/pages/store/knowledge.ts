// What the shop assistant knows about the online store, and how it finds the answer to a typed question.
// Everything a shopper can read on the store becomes short passages: every Help & policies page (split at its
// headings), the FAQs, About us, contact details, each branch, delivery zones, payment methods, categories, open jobs,
// store updates and products. A question (a few words, a whole sentence, or words with typing mistakes) is cleaned up
// — misspelt words are corrected against the store's own vocabulary and common words expanded to their synonyms
// ("money back" → refund, "shipping" → delivery) — and the passages are ranked (BM25, a standard search ranking,
// with extra weight for words in the title). The assistant answers with the best passage and a link to its page.
import { fillTokens, toBlocks } from '../../data/policies';
import type { Web } from '../../data/web';
import { plainText } from '../../lib/describe';
import { BR_INFO, CAT_INFO, money, tokensOf, type SP } from './model';

/** One piece of store content. go: the store page it comes from (for the "Open …" button). */
export type Passage = { id: string; source: string; title: string; text: string; go: string; kind: 'policy' | 'faq' | 'page' | 'branch' | 'job' | 'update' | 'product' | 'info'; pid?: string };
export type Kb = { passages: Passage[]; vocab: Set<string>; df: Map<string, number>; avgLen: number; toks: string[][]; titleToks: Set<string>[] };
export type KbHit = { p: Passage; score: number; inTitle: number; covered: number; nTerms: number };

const norm = (s: string) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
/** Common words that say nothing about the topic. */
const STOP = new Set(('a about after again all also am an and any are as at be been before being but by can could did do does doing done for from get got had has have having he her here hi hello hey him his how i if in into is it its just me more most my no not now of off on once only or other our out over please so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours tell know want need like thanks thank ok okay pls plz').split(' '));
/** Singular / base form, so "refunds", "delivered" and "delivering" meet "refund" and "deliver". */
export const stem = (w: string) => {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('es') && !w.endsWith('ses') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};
/** Words of a text, lower case, stop words out, stemmed. */
export const tokens = (s: string) => norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

/** Words that mean the same thing to a shopper: each key also searches its list (both ways). */
const SYN: Record<string, string[]> = {
  refund: ['return', 'money', 'back', 'reimburse', 'exchange'], return: ['refund', 'exchange'], exchange: ['return', 'swap'],
  deliver: ['delivery', 'shipping', 'ship', 'dispatch', 'rider', 'courier', 'send'], delivery: ['deliver', 'shipping', 'rider', 'courier'], shipping: ['delivery', 'deliver'],
  pay: ['payment', 'momo', 'mobile', 'card', 'cash', 'paystack', 'ghpay', 'transfer'], payment: ['pay', 'momo', 'card', 'cash'], momo: ['mobile', 'money', 'payment'],
  cost: ['price', 'fee', 'charge'], price: ['cost', 'fee'], fee: ['cost', 'charge', 'price'], cheap: ['price', 'sale', 'discount'],
  open: ['hour', 'opening', 'close', 'time'], hour: ['open', 'opening', 'time'], close: ['closing', 'hour'],
  job: ['career', 'vacancy', 'work', 'hiring', 'employment', 'apply'], career: ['job', 'vacancy'], work: ['job', 'career'], vacancy: ['job', 'career'],
  privacy: ['data', 'personal', 'information'], data: ['privacy', 'personal', 'information'], personal: ['privacy', 'data'],
  cookie: ['tracking', 'analytic'], location: ['branch', 'address', 'where', 'direction'], branch: ['shop', 'store', 'location', 'address'], address: ['location', 'branch'],
  contact: ['phone', 'call', 'email', 'whatsapp', 'reach'], phone: ['call', 'contact', 'number'], call: ['phone', 'contact'],
  warranty: ['guarantee', 'faulty', 'defect', 'broken'], faulty: ['warranty', 'damaged', 'broken', 'defect'], damaged: ['faulty', 'broken'],
  cancel: ['cancellation', 'stop'], discount: ['promo', 'coupon', 'code', 'offer', 'sale'], promo: ['discount', 'code', 'offer'], coupon: ['discount', 'code'],
  wholesale: ['bulk', 'carton', 'crate'], bulk: ['wholesale', 'carton'], account: ['login', 'sign', 'password', 'profile'], password: ['account', 'reset', 'login'],
  collect: ['collection', 'pickup', 'pick'], pickup: ['collect', 'collection'], track: ['tracking', 'status', 'where'], hire: ['purchase', 'installment', 'credit', 'monthly'],
  installment: ['hire', 'purchase', 'monthly'], credit: ['hire', 'installment'], vat: ['tax', 'levy'], tax: ['vat', 'levy', 'nhil', 'getfund'], receipt: ['invoice', 'proof'],
  invoice: ['receipt'], terms: ['condition', 'rule'], founded: ['about', 'story', 'history', 'since', 'started', 'founder'],
  own: ['owner', 'about', 'story', 'family', 'founder'], owner: ['about', 'story', 'family', 'founder'], company: ['about', 'business', 'story'], history: ['about', 'story', 'founded'],
  aircon: ['air', 'conditioner', 'ac', 'split'], ac: ['air', 'conditioner', 'aircon'], install: ['installation', 'mount', 'technician', 'fitting'], installation: ['install', 'mount', 'technician'], mount: ['wall', 'install', 'bracket'],
  create: ['account', 'sign', 'register'], register: ['account', 'sign'], signup: ['account', 'register'], login: ['account', 'sign', 'password'],
};
// The synonym table in the same stemmed form as the search words ("shipping" and "shipp" meet).
const SYNS: [string, string[]][] = Object.entries(SYN).map(([k, v]) => [stem(k), v.map(stem)]);
const synOf = (w: string) => { const out = new Set<string>(); SYNS.forEach(([k, v]) => { if (k === w) v.forEach((x) => out.add(x)); else if (v.includes(w)) out.add(k); }); out.delete(w); return [...out]; };

/** Edit distance between two short words (stops early once it is over the limit). */
function dist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1; prev = cur;
  }
  return prev[b.length];
}
/**
 * Correct misspelt words against the store's own words ("refnd" → "refund", "delivary" → "delivery").
 * Short words and numbers are left alone. Output: the corrected list of words.
 */
export function correct(ws: string[], vocab: Set<string>): string[] {
  return ws.map((w) => {
    if (vocab.has(w) || w.length < 4 || /\d/.test(w)) return w;
    const max = w.length >= 7 ? 2 : 1; let best = w; let bd = max + 1;
    for (const v of vocab) { if (v[0] !== w[0] && max < 2) continue; const d = dist(w, v, max); if (d < bd || (d === bd && v.length === w.length)) { bd = d; best = v; if (d === 0) break; } }
    return bd <= max ? best : w;
  });
}

/** Cut text to about n characters at a sentence end (or word end), for answers. */
export function clip(text: string, n = 480): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n); const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return dot > n * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

/**
 * Build the assistant's knowledge from the store as it is right now (settings, pages, FAQs, products).
 * Output: the passages plus the search statistics and the vocabulary for spelling correction.
 */
export function buildKb(W: Web, products: SP[]): Kb {
  const tok = tokensOf(W); const fill = (s: string) => fillTokens(String(s || ''), tok);
  const P: Passage[] = [];
  const push = (x: Omit<Passage, 'id'>) => { if (x.text.trim()) P.push({ ...x, id: `k${P.length}` }); };

  // Help & policies and other pages, one passage per heading (bullets kept as sentences).
  W.pages.filter((pg) => pg.live !== false && (pg.policy || pg.inFooter || !pg.builtin)).forEach((pg) => {
    let head = pg.title; let buf: string[] = [];
    const flush = () => { if (buf.length) push({ source: pg.title, title: head === pg.title ? pg.title : `${pg.title} · ${head}`, text: buf.join(' '), go: `pages/${pg.slug}`, kind: 'policy' }); buf = []; };
    toBlocks(fill(pg.body)).forEach((b) => { if (b.t === 'h') { flush(); head = b.text; } else if (b.t === 'p') buf.push(b.text); else buf.push(b.items.map((i) => (/[.!?]$/.test(i) ? i : i + '.')).join(' ')); });
    flush();
  });
  // FAQs.
  (W.faqs || []).filter((f) => f.on).forEach((f) => push({ source: 'FAQs', title: f.q, text: fill(f.a), go: 'faqs', kind: 'faq' }));
  // About us.
  const A = W.about;
  if (A) {
    push({ source: 'About us', title: `About ${tok.business} · who we are, our story and when we were founded`, text: [A.short, A.founded ? `Founded ${A.founded}.` : '', A.story].filter(Boolean).join(' '), go: 'about', kind: 'page' });
    if (A.mission || A.vision || A.aim) push({ source: 'About us', title: 'Our mission and vision', text: [A.aim, A.mission && `Mission: ${A.mission}`, A.vision && `Vision: ${A.vision}`].filter(Boolean).join(' '), go: 'about', kind: 'page' });
    if (A.values || A.facts?.length) push({ source: 'About us', title: 'Our values', text: [A.values, ...(A.facts || [])].filter(Boolean).join('. '), go: 'about', kind: 'page' });
  }
  // Contact, branches, delivery, payment, categories.
  push({ source: 'Contact us', title: 'Contact us · phone, WhatsApp and email', text: `Call ${tok.phone}${tok.whatsapp ? `, WhatsApp ${tok.whatsapp}` : ''}${tok.email ? `, or email ${tok.email}` : ''}. Opening hours: ${tok.hours}. You can also use the form on the Contact page; we reply within the hour during opening times.`, go: 'contact', kind: 'info' });
  BR_INFO.forEach((b) => push({ source: 'Branches', title: `${b.name} branch · address and opening hours`, text: `${b.name}: ${b.address} (GhanaPostGPS ${b.gps}). Open ${b.open}. Phone ${b.phone}. ${b.note}.`, go: 'branches', kind: 'branch' }));
  const zones = W.zones.filter((z) => z.on !== false);
  push({ source: 'Delivery', title: 'Delivery fees and times', text: `${zones.map((z) => `${z.name}: ${z.fee ? money(z.fee) : 'free'}${z.eta ? ` (${z.eta})` : ''}`).join('; ')}.${W.freeOn && W.freeOver ? ` Orders over ${money(W.freeOver)} are delivered free.` : ''} Click & collect from a branch ${W.collect ? `costs ${money(W.collect)}` : 'is free'}.`, go: 'pages/delivery', kind: 'info' });
  push({ source: 'Payments', title: 'Hire purchase · pay monthly', text: 'Hire purchase lets you take appliances and electronics home with a deposit today and pay the rest monthly over 3, 6, 9 or 12 months. It is arranged in store: bring your Ghana Card and a guarantor to any branch. Choose “Buy in store” and Hire purchase at checkout to reserve the item.', go: 'branches', kind: 'info' });
  push({ source: 'Delivery', title: 'Installation · air conditioners and TV wall mounting', text: 'Our trained technicians install split and floor-standing air conditioners and wall-mount TVs in Accra and Kumasi. Installation is arranged when your item is delivered: add a note at checkout or ask at any branch for the price for your home or office. We recommend a voltage stabiliser for every fridge, freezer and air conditioner.', go: 'pages/delivery', kind: 'info' });
  push({ source: 'My account', title: 'Open or create an account · sign up', text: 'Tap the person icon at the top of the store and choose Sign up, or sign up with Google. You can also check out as a guest. With an account you can track orders, see your payment and purchase history, save addresses and a wishlist, and reorder in one tap. Forgot your password? Choose Forgot password on the sign-in form.', go: 'account', kind: 'info' });
  push({ source: 'Payments', title: 'Ways to pay', text: 'Pay with Mobile Money (MTN, Telecel, AirtelTigo), GhPay, Paystack (card, MoMo or bank) or bank transfer. For delivery you can pay the rider in cash or MoMo; for click & collect you can pay at the counter. Hire purchase (deposit today, then monthly) is available in store for appliances and electronics with your Ghana Card. Prices include VAT and levies.', go: 'faqs', kind: 'info' });
  Object.entries(CAT_INFO).forEach(([c, [d]]) => push({ source: 'Shop', title: `${c} aisle`, text: `${c}: ${d} ${products.filter((p) => p.cat === c).slice(0, 8).map((p) => p.name).join(', ')}.`, go: '', kind: 'page' }));
  // Careers and store updates.
  (W.jobs || []).filter((j) => j.open && !j.draft).forEach((j) => push({ source: 'Careers', title: `Job: ${j.title} (${j.dept}, ${j.type})`, text: [j.summary, j.duties && `Duties: ${j.duties}`, j.reqs && `Requirements: ${j.reqs}`, j.closes && `Closes ${j.closes}.`].filter(Boolean).join(' '), go: `careers/${j.id}`, kind: 'job' }));
  if (!(W.jobs || []).some((j) => j.open && !j.draft)) push({ source: 'Careers', title: 'Jobs and careers', text: 'There are no open jobs right now. Check Careers & opportunities again soon.', go: 'careers', kind: 'job' });
  (W.updates || []).filter((u) => u.live).forEach((u) => push({ source: 'Store updates', title: u.title, text: u.body, go: 'updates', kind: 'update' }));
  // Products (name, price, stock and the shared description).
  products.forEach((p) => push({ source: 'Products', title: p.name, text: `${p.name} costs ${money(p.price)}${p.ct ? `, or ${money(p.ct.price)} for a ${p.ct.label.toLowerCase()} of ${p.ct.size}` : ''}. ${plainText(p.desc, 400)}`, go: `p/${p.id}`, kind: 'product', pid: p.id }));

  const toks = P.map((x) => tokens(`${x.title} ${x.text}`));
  const titleToks = P.map((x) => new Set(tokens(`${x.title} ${x.source}`)));
  const df = new Map<string, number>(); toks.forEach((ts) => new Set(ts).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const vocab = new Set<string>(); toks.forEach((ts) => ts.forEach((t) => vocab.add(t))); Object.keys(SYN).forEach((k) => vocab.add(k));
  return { passages: P, vocab, df, avgLen: toks.reduce((a, t) => a + t.length, 0) / Math.max(1, toks.length), toks, titleToks };
}

/**
 * Rank the passages for a question. Words typed by the shopper count fully, their synonyms at half weight; a word
 * in the passage title counts extra. Output: the best passages first, with how many of the question's words they
 * contain (covered) out of all (nTerms).
 */
export function askKb(q: string, kb: Kb, n = 5): KbHit[] {
  const base = [...new Set(correct(tokens(q), kb.vocab))];
  if (!base.length) return [];
  const N = kb.passages.length; const k1 = 1.4, b = 0.7;
  const weights = new Map<string, number>(); base.forEach((w) => weights.set(w, 1));
  base.forEach((w) => synOf(w).forEach((s) => { if (!weights.has(s)) weights.set(s, 0.45); }));
  const idf = (t: string) => { const d = kb.df.get(t) || 0; return Math.log(1 + (N - d + 0.5) / (d + 0.5)); };
  const hits: KbHit[] = [];
  kb.passages.forEach((p, i) => {
    const ts = kb.toks[i]; if (!ts.length) return;
    const tf = new Map<string, number>(); ts.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    let score = 0; let inTitle = 0; let covered = 0;
    base.forEach((w) => { const syn = [w, ...synOf(w)]; if (syn.some((s) => tf.has(s))) covered++; if (syn.some((s) => kb.titleToks[i].has(s))) inTitle++; });
    weights.forEach((wt, t) => { const f = tf.get(t); if (!f) return; score += wt * idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * ts.length) / kb.avgLen))); if (kb.titleToks[i].has(t)) score += wt * idf(t) * 0.9; });
    // Job adverts only rank high when the question is about jobs ("hire purchase" is not a job search).
    const jobQ = base.some((w) => /^(job|career|vacanc|hiring|hire$|apply|work|cv|employ)/.test(w)) && !base.includes('purchase');
    const kindWt = p.kind === 'job' && !jobQ ? 0.35 : 1;
    // Naming a page ("terms of sale", "privacy policy") brings up that page's opening passage, not a later section.
    const opening = p.title === p.source && base.every((w) => [w, ...synOf(w)].some((x) => tokens(p.source).includes(x))) ? 1.6 : 1;
    if (score > 0) hits.push({ p, score: score * kindWt * opening * (0.6 + 0.4 * (covered / base.length)), inTitle, covered, nTerms: base.length });
  });
  return hits.sort((a, c) => c.score - a.score).slice(0, n);
}
