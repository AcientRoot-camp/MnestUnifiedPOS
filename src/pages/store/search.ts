// Store-wide search behind the search button in the online store header (Shell.tsx SearchResults).
// One query looks through everything a shopper can open on the store: products (name, category, SKU and the shared
// description), every Help & policies page (title and full text, with the business details filled in), FAQs,
// branches (name, address, hours, phone), About us, careers, store updates, reviews and the main pages, plus a few
// quick actions (Track your order, Cookie settings, My account). Results come back grouped and ranked, each with a
// short snippet around the words that matched.
import { fillTokens } from '../../data/policies';
import type { Web } from '../../data/web';
import { plainText } from '../../lib/describe';
import { BR_INFO, tokensOf, type SP } from './model';

/** What a result does when chosen. */
export type HitGo = { k: 'product'; id: string } | { k: 'path'; path: string } | { k: 'track' } | { k: 'cookies' };
export type Hit = { title: string; sub: string; snippet?: string; go: HitGo; score: number };
export type HitGroup = { key: string; label: string; hits: Hit[] };

const norm = (s: string) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const STOP = new Set('a an and are at be by can do for from how i in is it me my of on or the to what when where which who why with you your'.split(' '));
/** The meaningful words of the query (two letters or more, common words left out unless that is all there is). */
export function terms(q: string): string[] {
  const all = norm(q).replace(/[^a-z0-9&\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  const t = all.filter((w) => !STOP.has(w));
  return t.length ? t : all;
}
/** Words in the query that also appear (as the start of a word) in the text. */
const count = (text: string, ts: string[]) => { const t = ' ' + norm(text).replace(/[^a-z0-9&]+/g, ' '); return ts.filter((w) => t.includes(' ' + w) || (w.length > 4 && t.includes(w))).length; };
/**
 * Score a result: the title counts most, then the subtitle, then the body. Every word must appear somewhere
 * (title, subtitle or body) for a result to count. Output: 0 for no match.
 */
function scoreOf(ts: string[], title: string, sub: string, body: string): number {
  if (!ts.length) return 0;
  const inT = count(title, ts), inS = count(sub, ts), inB = count(body, ts);
  const covered = ts.filter((w) => count(`${title} ${sub} ${body}`, [w]) > 0).length;
  if (covered < ts.length) return 0;
  return inT * 6 + inS * 3 + inB + (norm(title).startsWith(ts[0]) ? 3 : 0) + (norm(title).includes(ts.join(' ')) ? 4 : 0);
}
/**
 * A short piece of text around the first matching word, e.g. "…returned within 7 days with the receipt…".
 * Input: the full text, the query words, the length. Output: the snippet ('' when nothing matched).
 */
export function snippetOf(text: string, ts: string[], len = 150): string {
  // Drop the list markers and heading signs used in page text, so the snippet reads as a sentence.
  const plain = String(text || '').replace(/(^|\n)\s*[-•]\s+/g, '$1').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
  const low = norm(plain);
  let at = -1; for (const w of ts) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return '';
  const start = Math.max(0, at - 50); const end = Math.min(plain.length, start + len);
  return (start > 0 ? '…' : '') + plain.slice(start, end).replace(/^\S*\s/, start > 0 ? '' : '$&').trim() + (end < plain.length ? '…' : '');
}
/** Split text into parts for highlighting the query words (mark: true on matches). */
export function marks(text: string, ts: string[]): { t: string; mark: boolean }[] {
  if (!ts.length || !text) return [{ t: text, mark: false }];
  const re = new RegExp(`(${ts.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).filter(Boolean).map((t) => ({ t, mark: ts.some((w) => norm(t) === w) }));
}

/**
 * Search the whole store. Inputs: the query, the store settings and the live products.
 * Output: groups (Products, Help & policies, FAQs, Branches, Pages & news) with their best results first.
 */
export function searchStore(q: string, W: Web, products: SP[]): HitGroup[] {
  const ts = terms(q);
  if (!ts.length) return [];
  const tok = tokensOf(W);
  const fill = (s: string) => fillTokens(String(s || ''), tok);
  const groups: HitGroup[] = [];
  const add = (key: string, label: string, hits: Hit[], max: number) => { const h = hits.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, max); if (h.length) groups.push({ key, label, hits: h }); };

  // Products: name, category and SKU first; the shared description as the body.
  add('products', 'Products', products.map((p) => {
    const body = plainText(p.desc);
    return { title: p.name, sub: `${p.cat} · GHS ${p.price.toFixed(2)}`, snippet: count(`${p.name} ${p.cat}`, ts) ? undefined : snippetOf(body, ts, 110), go: { k: 'product', id: p.id } as HitGo, score: scoreOf(ts, `${p.name} ${p.sku}`, p.cat, body) };
  }), 6);

  // Help & policies: every policy page and footer page (full text), and the quick actions in that footer column.
  const pol = W.pages.filter((p) => p.live !== false && (p.policy || p.inFooter || !p.builtin));
  add('help', 'Help & policies', [
    ...pol.map((p) => { const body = fill(p.body); return { title: p.title, sub: 'Help & policies', snippet: snippetOf(body, ts), go: { k: 'path', path: `pages/${p.slug}` } as HitGo, score: scoreOf(ts, p.title, `${p.slug.replace(/-/g, ' ')} policy help`, body) }; }),
    { title: 'Track your order', sub: 'Help & policies', snippet: 'Enter your 8-digit order number to see where your order is.', go: { k: 'track' }, score: scoreOf(ts, 'Track your order', 'tracking order status delivery where is my order', '') },
    { title: 'Cookie settings', sub: 'Help & policies', snippet: 'Change which cookies the store may use.', go: { k: 'cookies' }, score: scoreOf(ts, 'Cookie settings', 'cookies privacy consent preferences', '') },
  ], 6);

  // FAQs: question as the title, the answer as the body.
  add('faqs', 'FAQs', (W.faqs || []).filter((f) => f.on).map((f) => ({ title: f.q, sub: `FAQs · ${f.cat}`, snippet: snippetOf(fill(f.a), ts) || fill(f.a).slice(0, 140), go: { k: 'path', path: 'faqs' } as HitGo, score: scoreOf(ts, f.q, f.cat, fill(f.a)) })), 4);

  // Branches: name, address, hours and phone.
  add('branches', 'Branches', BR_INFO.map((b) => ({ title: b.name, sub: `${b.address} · ${b.phone}`, snippet: b.open, go: { k: 'path', path: 'branches' } as HitGo, score: scoreOf(ts, b.name, `${b.address} ${b.short} branch shop store location`, `${b.open} ${b.phone} ${b.gps} opening hours directions`) })), 3);

  // Pages, careers, updates and reviews.
  const A = W.about;
  add('pages', 'Pages & news', [
    { title: 'About us', sub: A?.title || 'Our story', snippet: snippetOf([A?.short, A?.story, A?.mission, A?.vision, A?.values, ...(A?.facts || [])].filter(Boolean).join(' '), ts), go: { k: 'path', path: 'about' } as HitGo, score: scoreOf(ts, 'About us', 'story company history who we are', [A?.short, A?.story, A?.mission, A?.vision, A?.values, ...(A?.facts || [])].filter(Boolean).join(' ')) },
    { title: 'Contact us', sub: `${tok.phone}${tok.email ? ` · ${tok.email}` : ''}`, snippet: tok.hours, go: { k: 'path', path: 'contact' } as HitGo, score: scoreOf(ts, 'Contact us', 'contact phone email whatsapp call message help support', `${tok.phone} ${tok.email} ${tok.whatsapp} ${tok.hours}`) },
    { title: 'Careers & opportunities', sub: 'Jobs', snippet: '', go: { k: 'path', path: 'careers' } as HitGo, score: scoreOf(ts, 'Careers', 'jobs vacancies work hiring apply cv', '') },
    { title: 'My account', sub: 'Orders, payments, purchase history, addresses', snippet: '', go: { k: 'path', path: 'account' } as HitGo, score: scoreOf(ts, 'My account', 'account sign in login orders payments purchase history addresses wishlist password profile', '') },
    ...(W.jobs || []).filter((j) => j.open && !j.draft).map((j) => ({ title: j.title, sub: `Careers · ${j.dept} · ${j.type}`, snippet: snippetOf([j.summary, j.duties, j.reqs].filter(Boolean).join(' '), ts), go: { k: 'path', path: `careers/${j.id}` } as HitGo, score: scoreOf(ts, j.title, `${j.dept} ${j.type} job vacancy`, [j.summary, j.duties, j.reqs, j.offer].filter(Boolean).join(' ')) })),
    ...(W.updates || []).filter((u) => u.live).map((u) => ({ title: u.title, sub: `Store update · ${u.kind}`, snippet: snippetOf(u.body, ts), go: { k: 'path', path: 'updates' } as HitGo, score: scoreOf(ts, u.title, u.kind, u.body) })),
    ...(W.reviews || []).filter((r) => !r.hidden).map((r) => ({ title: `Review by ${r.name}`, sub: r.product || 'Customer review', snippet: snippetOf(r.text, ts), go: { k: 'path', path: 'reviews' } as HitGo, score: scoreOf(ts, r.product || '', `review ${r.name}`, r.text) * 0.6 })),
  ], 5);
  return groups;
}
