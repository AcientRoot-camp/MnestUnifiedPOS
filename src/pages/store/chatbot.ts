// Online store shopping assistant: the "brain" behind the chat bubble (Chat.tsx).
// Shoppers can type anything — a few words, a full question, even with spelling mistakes. It answers from the store's
// own live data: order tracking, the basket, products (price, stock, carton, description, follow-ups like "how much
// is it?"), delivery, collection, branches and hours, payments, returns, and then anything else on the store through
// its knowledge search (knowledge.ts: every Help & policies page, FAQs, About us, contact, careers, updates and
// products), replying with the best passage and a link to the page. Only when nothing on the store matches does it
// ask the AI endpoint (/api/chat, Claude, when set up) with a fact sheet of the store, so answers stay grounded.
import type { Web } from '../../data/web';
import { plainText } from '../../lib/describe';
import { askKb, clip, correct, tokens, type Kb, type KbHit } from './knowledge';
import { BR_INFO, isOos, money, orderState, stockLine, totalStock, waHref, type SP, type ShopOrder } from './model';

/** Something a reply's button does in the store. */
export type ChatAct = { k: 'cart' } | { k: 'track'; no: string } | { k: 'go'; path: string } | { k: 'url'; href: string } | { k: 'signin' } | { k: 'ask'; text: string };
/** Live order status card shown inside the chat. */
export type ChatOrder = { no: string; status: string; names: string[]; idx: number; times: string[]; cancelled: boolean; total: number; where: string; code?: string };
/** One assistant reply: text, plus optional product cards, an order card and buttons. */
export type Reply = { text: string; products?: SP[]; order?: ChatOrder; acts?: { label: string; act: ChatAct }[]; ai?: boolean };
/** What the assistant can see: the store's live data and this shopper's basket and orders. */
export type ChatCtx = {
  W: Web; products: SP[]; orders: Record<string, ShopOrder>; myOrders: string[]; signedIn: boolean; name?: string;
  count: number; sub: number; biz: string;
  status: (no: string) => ReturnType<typeof orderState> | null;
  /** The store's knowledge (knowledge.ts buildKb). */
  kb: Kb;
  /** The product the conversation is about (the last one shown), for "how much is it?" follow-ups. */
  last?: SP;
};

const lc = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
/** Words that carry no meaning for matching ("do you have any …"). */
const STOP = new Set('a an and any are at be buy can do does for from get have how i in is it me much my need of on or please price prices sell show some the there this to want what where which with you your cost costs got looking'.split(' '));
const words = (s: string) => lc(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
/** Singular form for matching ("tins" → "tin", "noodles" → "noodle"). */
const stem = (w: string) => (w.length > 3 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

/** The store phone, WhatsApp number and opening hours from Post to online settings (first branch as fallback). */
const contact = (W: Web) => ({ phone: W.site.phone || BR_INFO[0].phone, wa: W.site.whatsapp || W.site.phone || '', hours: W.site.hours || BR_INFO[0].open, email: W.site.email || '' });
const human = (W: Web): { label: string; act: ChatAct }[] => { const c = contact(W); return [...(c.wa ? [{ label: 'WhatsApp us', act: { k: 'url', href: waHref(c.wa, 'Hello, I have a question') } as ChatAct }] : []), { label: `Call ${c.phone}`, act: { k: 'url', href: `tel:${c.phone.replace(/\s/g, '')}` } }]; };

/**
 * Products matching the shopper's words, best match first. A word counts when it starts a word of the product name,
 * category or SKU ("tcl" → "TCL 43\" 4K UHD Google TV"); in-stock products rank above sold-out ones.
 */
export function findProducts(text: string, products: SP[], n = 4): SP[] {
  const ws = words(text).map(stem);
  if (!ws.length) return [];
  const scored = products.map((p) => {
    const hay = words(`${p.name} ${p.cat} ${p.sku}`).map(stem); const catW = words(p.cat).map(stem);
    // A word that names the product's category ("fridge" → Fridge) counts extra, so a fridge beats a fridge guard.
    const score = ws.reduce((a, w) => a + (hay.some((h) => h === w) ? 3 : hay.some((h) => h.startsWith(w) || (w.length > 4 && w.startsWith(h))) ? 2 : 0) + (catW.includes(w) ? 1.5 : 0), 0);
    return { p, score: score ? score + (isOos(p) ? 0 : 0.5) : 0 };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score || a.p.price - b.p.price);
  return scored.slice(0, n).map((x) => x.p);
}

/** Reply from a knowledge passage: the passage (shortened at a sentence), where it is from and a link to the page. */
function kbReply(h: KbHit, more: KbHit[]): Reply {
  const p = h.p;
  const lead = p.kind === 'faq' ? '' : p.kind === 'policy' ? `From our ${p.source} page:\n` : p.kind === 'job' ? '' : p.kind === 'update' ? 'From our store updates:\n' : '';
  const others = more.filter((x) => x.p.go !== p.go && x.p.kind !== 'product' && x.score >= h.score * 0.75 && x.covered === x.nTerms).slice(0, 2);
  return {
    text: `${lead}${p.kind === 'faq' || p.kind === 'job' || p.kind === 'update' ? `${p.title}\n` : ''}${clip(p.text)}`,
    acts: [{ label: `Open ${p.source === 'FAQs' ? 'FAQs' : p.source}`, act: { k: 'go', path: p.go } }, ...others.map((x) => ({ label: x.p.source === 'FAQs' ? x.p.title.slice(0, 38) : `See ${x.p.source}`, act: (x.p.source === 'FAQs' ? { k: 'ask', text: x.p.title } : { k: 'go', path: x.p.go }) as ChatAct }))],
  };
}

/** Order card for the chat from the live staff status (Orders and Collect screens). */
function orderCard(o: ShopOrder | undefined, no: string, st: NonNullable<ReturnType<ChatCtx['status']>>): ChatOrder {
  return { no, status: st.status, names: st.names, idx: st.idx, times: st.times, cancelled: st.cancelled, total: o?.total ?? 0, where: o?.where ?? '', code: !st.cancelled ? o?.code : undefined };
}

/**
 * Answer one message from the store's own data. Output: the reply, or null when the message needs the AI
 * (or, without it, the "not sure" fallback in fallbackReply).
 */
export function localReply(text: string, c: ChatCtx): Reply | null {
  // Intent checks see both what was typed and the spelling-corrected words ("delivary fee" → delivery fee).
  const fixed = correct(tokens(text), c.kb.vocab);
  const t = `${lc(text).trim()} ${fixed.join(' ')}`;
  const W = c.W; const k = contact(W);
  const hits = askKb(text, c.kb, 6);
  const top = hits[0];
  // A strong match: a question of two or more words whose words are in a passage's title (or all in its text),
  // e.g. "how long does a refund take" → the FAQ of that name. It wins over the general answers below.
  const strong = !!top && top.p.kind !== 'product' && top.nTerms >= 2 && (top.inTitle >= 2 || (top.nTerms >= 3 && top.covered === top.nTerms));
  const first = c.name ? c.name.split(' ')[0] : '';

  // Order number anywhere in the message → live tracking.
  const no = /\b(\d{8})\b/.exec(t)?.[1];
  if (no) {
    const st = c.status(no);
    if (!st) return { text: `I couldn’t find order #${no}. Check the 8-digit number on your Order Confirmation, or ask us on WhatsApp.`, acts: human(W) };
    const o = c.orders[no];
    return { text: st.cancelled ? `Order #${no} was cancelled${st.reason ? ` (${st.reason})` : ''}.${o?.paid ? ' Your refund goes back to the way you paid.' : ''}` : `Here’s the latest on order #${no}: ${st.status}.`, order: orderCard(o, no, st) };
  }
  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|akwaaba|maakye|ete sen|yo)\b/.test(t)) {
    return { text: `Akwaaba${first ? `, ${first}` : ''}! I can find products and prices, check stock, track an order, or explain delivery, payment and returns. What can I help you with?`, acts: [{ label: 'Track my order', act: { k: 'ask', text: 'Track my order' } }, { label: 'Today’s deals', act: { k: 'ask', text: 'Show me items on sale' } }, { label: 'Delivery fees', act: { k: 'ask', text: 'How much is delivery?' } }] };
  }
  if (/\b(thanks|thank you|thx|medaase|cheers)\b/.test(t)) return { text: 'You’re welcome! Anything else I can help with?' };
  if (/^(bye|goodbye|see you|later)\b/.test(t)) return { text: 'Bye for now, and thank you for shopping with us!' };
  if (/\b(card number|cvv|pin|password|otp|one.?time code)\b/.test(t) && /\b(my|here|is)\b/.test(t)) return { text: 'Please don’t share card numbers, PINs, passwords or one-time codes in this chat. We will never ask for them.' };

  // Hours questions get the branch list; other strong matches ("can I cancel my order") answer from the store text.
  const hoursQ = /\b(what time|opening|closing|close at|are you open|hours)\b/.test(t);
  if (strong && !hoursQ && !/\b(deliver\w*|fee|cost|how much|track\w*|where('?s| is) my|status)\b/.test(t)) return kbReply(top!, hits.slice(1));
  if (/\b(track|tracking|where('?s| is) my|order status|my order|my orders|order update)\b/.test(t)) {
    const mine = c.myOrders.map((n) => c.orders[n]).filter(Boolean).sort((a, b) => b.ts - a.ts);
    if (mine[0]) { const st = c.status(mine[0].no); if (st) return { text: `Your latest order is #${mine[0].no}: ${st.status}. For another order, type its 8-digit number.`, order: orderCard(mine[0], mine[0].no, st), acts: [{ label: 'All my orders', act: { k: 'go', path: 'account/orders' } }] }; }
    return { text: 'Type your 8-digit order number (it’s on your Order Confirmation and in the SMS we sent) and I’ll check it for you.', acts: c.signedIn ? [{ label: 'My orders', act: { k: 'go', path: 'account/orders' } }] : [{ label: 'Sign in to see your orders', act: { k: 'signin' } }] };
  }
  if (/\b(basket|cart|checkout|check out)\b/.test(t)) {
    return c.count ? { text: `You have ${c.count} item${c.count === 1 ? '' : 's'} in your basket, ${money(c.sub)} so far.${W.freeOn && W.freeOver > c.sub ? ` Add ${money(W.freeOver - c.sub)} more for free delivery.` : W.freeOn ? ' Your delivery is free.' : ''}`, acts: [{ label: 'Open my basket', act: { k: 'cart' } }, { label: 'Checkout', act: { k: 'go', path: 'checkout' } }] }
      : { text: 'Your basket is empty. Tell me what you’re looking for and I’ll find it.', acts: [{ label: 'Best sellers', act: { k: 'ask', text: 'Show me best sellers' } }] };
  }
  if (/\b(deliver|delivery|shipping|ship|rider|dispatch)\b/.test(t)) {
    const z = W.zones.filter((x) => x.on !== false).slice(0, 5).map((x) => `${x.name}: ${x.fee ? money(x.fee) : 'free'}${x.eta ? ` (${x.eta})` : ''}`).join('\n');
    return { text: `We deliver from our branches.${z ? `\n${z}` : ''}${W.freeOn && W.freeOver > 0 ? `\nOrders over ${money(W.freeOver)} are delivered free.` : ''}\nYou can also collect from a branch${W.collect ? ` for ${money(W.collect)}` : ' for free'}.` };
  }
  if (/\b(collect|collection|pick ?up|click (and|&) collect)\b/.test(t)) {
    return { text: `Choose click & collect at checkout and pick up from Osu, East Legon or Adum${W.collect ? ` (${money(W.collect)})` : ' at no charge'}. We send a 6-digit collection code when it’s ready; show it at the counter.`, acts: [{ label: 'Branch hours', act: { k: 'ask', text: 'Where are your branches?' } }] };
  }
  // Branches and hours ("open" alone is not enough: "open an account" is not about hours).
  if (/\b(branch|branches|location|address|where are you|located|directions?|are you open|open (today|now|on|at|till|until|tomorrow)|when\b.*\bopen|opening|closing|close at|hours|what time)\b/.test(t)) {
    return { text: BR_INFO.map((b) => `${b.name}: ${b.address}\n${b.open} · ${b.phone}`).join('\n\n'), acts: [{ label: 'See branches', act: { k: 'go', path: 'branches' } }] };
  }
  if (/\b(pay|payment|momo|mobile money|card|visa|mastercard|cash|paystack|ghpay|transfer|hire purchase|instal+ment|credit)\b/.test(t)) {
    return { text: 'You can pay with Mobile Money (MTN, Telecel, AirtelTigo), GhPay, Paystack (card, MoMo or bank) or bank transfer. For delivery you can also pay the rider; for collection, pay at the counter. Hire purchase (deposit today, then monthly) is available in store for appliances and electronics with your Ghana Card.' };
  }
  if (/\b(return|refund|exchange|damaged|faulty|broken|wrong item|expired)\b/.test(t)) {
    return { text: 'Unopened items can be returned within 7 days with your receipt for an exchange or refund. Faulty electricals are covered by the manufacturer’s warranty. Refunds go back the way you paid.', acts: [...(c.signedIn ? [{ label: 'Request a return', act: { k: 'go', path: 'account/orders' } as ChatAct }] : []), { label: 'Returns policy', act: { k: 'go', path: 'pages/returns' } }] };
  }
  if (/\b(human|agent|person|someone|staff|talk to|speak to|call you|phone number|contact|whatsapp|email)\b/.test(t)) {
    return { text: `You can reach us on ${k.phone}${k.wa ? ' or WhatsApp' : ''}${k.email ? `, or email ${k.email}` : ''}. ${k.hours}.`, acts: human(W) };
  }
  if (/\b(sign ?in|log ?in|account|password|sign ?up|register)\b/.test(t)) {
    return c.signedIn ? { text: 'You’re signed in. Your orders, payments, purchase history and addresses are in My account.', acts: [{ label: 'My account', act: { k: 'go', path: 'account' } }] }
      : { text: 'You can check out as a guest, or sign in to see your orders, payment history and reorder in one tap. Forgot your password? Use “Forgot password” on the sign-in form.', acts: [{ label: 'Sign in / Sign up', act: { k: 'signin' } }] };
  }
  const live = c.products.filter((p) => !isOos(p));
  if (/\b(sale|deal|deals|discount|promo|offer|offers|cheap|bargain)\b/.test(t)) {
    const on = live.filter((p) => p.was && p.was > p.price).sort((a, b) => b.was! / b.price - a.was! / a.price).slice(0, 4);
    return on.length ? { text: 'Here are today’s best deals:', products: on } : { text: 'There are no items on sale right now. Discount codes go in the box at checkout.', products: live.filter((p) => p.best).slice(0, 3) };
  }
  if (/\b(new|latest|arrival|arrivals|just in)\b/.test(t)) { const nw = live.filter((p) => p.isNew).slice(0, 4); if (nw.length) return { text: 'New in this week:', products: nw }; }
  if (/\b(best ?sell|popular|recommend|top|bestseller|best seller)\w*/.test(t)) return { text: 'Our best sellers right now:', products: [...live].sort((a, b) => b.sold - a.sold).slice(0, 4) };
  // "How much is it in a carton?" is about the product being discussed, not wholesale in general.
  const followUp = !!c.last && /\b(it|this|that|them|its)\b/.test(t);
  if (!followUp && /\b(wholesale|carton|crate|bulk)\b/.test(t)) { const ct = live.filter((p) => p.ct).slice(0, 4); return { text: 'Many items come by the carton or crate at a lower price per piece. Pick “Carton” on the product. For large regular orders, WhatsApp us for a quote.', products: ct, acts: human(W) }; }

  // Products: "do you have milo?", "price of rice", "is oil in stock", "tell me about the freezer".
  // Follow-ups ("how much is it?", "is it in stock?") are about the last product shown.
  let found = findProducts(text, c.products);
  // Typing mistakes: try the corrected words, but say so ("I couldn't find “milo” — did you mean …").
  let guessed = false;
  if (!found.length) { found = findProducts(fixed.join(' '), c.products); guessed = found.length > 0; }
  if (!found.length && c.last && /\b(it|this|that|them|its|one)\b/.test(t)) found = [c.last];
  // Policy questions about a product ("warranty on freezers", "can I return a TV") answer the policy, with the product.
  const pol = hits.find((h) => h.p.kind !== 'product' && h.covered >= 1);
  if (found.length && pol && /\b(warranty|guarantee|return|refund|exchange|hire purchase|instal\w*|deliver\w*|install\w*|faulty|damaged)\b/.test(t)) return { ...kbReply(pol, []), products: found.slice(0, 2) };
  if (guessed) { const raw = tokens(text); const odd = raw.filter((w, i) => w !== fixed[i]); return { text: `I couldn’t find “${odd.join(' ') || text.trim()}” on our store. Did you mean:`, products: found }; }
  if (found.length && /\b(describe|description|about|details?|what is|what's|specs?|specification|how to use|use it|storage|store it|good for|made of)\b/.test(t) && !/\b(price|cost|how much|stock)\b/.test(t)) {
    const p = found[0];
    return { text: `${p.name}: ${clip(plainText(p.desc), 420)}`, products: [p], acts: [{ label: 'Full details', act: { k: 'go', path: `p/${p.id}` } }] };
  }
  if (found.length) {
    const p = found[0];
    const stockQ = /\b(stock|available|availability|left|have)\b/.test(t);
    const head = found.length === 1
      ? `${p.name} is ${money(p.price)}${p.was && p.was > p.price ? ` (was ${money(p.was)})` : ''}${p.ct ? `, or ${money(p.ct.price)} for a ${p.ct.label.toLowerCase()} of ${p.ct.size}` : ''}. ${isOos(p) ? 'It’s out of stock right now; tap Notify me on the product and we’ll tell you when it’s back.' : stockQ ? stockLine(p) + '.' : 'In stock.'}`
      : `I found ${found.length} matches${stockQ ? '; stock is shown on each' : ''}:`;
    return { text: head, products: found };
  }
  // Anything else on the store: the best knowledge passage, when it really matches.
  if (top && top.score >= 1.2 && top.covered >= Math.min(top.nTerms, Math.max(1, Math.ceil(top.nTerms / 2)))) {
    if (top.p.kind === 'product' && top.p.pid) { const p = c.products.find((x) => x.id === top.p.pid); if (p) return { text: `${p.name} is ${money(p.price)}. ${clip(plainText(p.desc), 260)}`, products: [p] }; }
    return kbReply(top, hits.slice(1));
  }
  return null;
}

/**
 * Reply when nothing on the store matches and the AI is not available (not set up, offline or busy): the closest
 * topics as buttons, then WhatsApp and call.
 */
export const fallbackReply = (c: ChatCtx, text = ''): Reply => {
  const near = askKb(text, c.kb, 8).filter((h) => h.p.kind !== 'product').slice(0, 3);
  return {
    text: near.length ? 'I couldn’t find an exact answer to that. Did you mean one of these?' : 'I couldn’t find that on our store. Try other words — a product name, “delivery”, “refund”, “opening hours” or a question — or ask our team.',
    acts: [...near.map((h) => ({ label: h.p.title.length > 42 ? h.p.title.slice(0, 40) + '…' : h.p.title, act: (h.p.kind === 'faq' ? { k: 'ask', text: h.p.title } : { k: 'go', path: h.p.go }) as ChatAct })), ...human(c.W)],
  };
};

/**
 * A short fact sheet about the store for the AI (system prompt): contact details, branches, delivery, payment,
 * returns, FAQs, the product list with prices and stock, and the text of the store pages and policies. Kept under
 * the endpoint's 30,000-character limit.
 */
export function factSheet(c: ChatCtx): string {
  const W = c.W; const k = contact(W);
  const P = c.products.slice(0, 120).map((p) => `- ${p.name} [${p.cat}] ${money(p.price)}${p.was && p.was > p.price ? ` (was ${money(p.was)})` : ''}${p.ct ? `; ${p.ct.label} of ${p.ct.size} ${money(p.ct.price)}` : ''}; ${isOos(p) ? 'out of stock' : `${totalStock(p)} in stock`}${p.isNew ? '; new' : ''}${p.best ? '; best seller' : ''}`);
  const faqs = (W.faqs || []).filter((f) => f.on).slice(0, 30).map((f) => `Q: ${f.q} A: ${f.a}`);
  const out = [
    `Store: ${c.biz}. Phone ${k.phone}${k.wa ? `, WhatsApp ${k.wa}` : ''}${k.email ? `, email ${k.email}` : ''}. Hours: ${k.hours}. Website ${W.seo.domain || ''}.`,
    `Branches: ${BR_INFO.map((b) => `${b.name} (${b.address}; ${b.open}; ${b.phone})`).join(' | ')}.`,
    `Delivery zones: ${W.zones.filter((z) => z.on !== false).map((z) => `${z.name} ${z.fee ? money(z.fee) : 'free'}${z.eta ? ` ${z.eta}` : ''}`).join('; ') || 'shown at checkout'}.${W.freeOn && W.freeOver ? ` Free delivery over ${money(W.freeOver)}.` : ''} Click & collect ${W.collect ? money(W.collect) : 'free'}.`,
    'Payment: Mobile Money (MTN, Telecel, AirtelTigo), GhPay, Paystack (card/MoMo/bank), bank transfer, pay on delivery, pay at the counter on collection, hire purchase in store with Ghana Card.',
    'Returns: unopened items within 7 days with the receipt; faulty electricals under manufacturer warranty; refunds to the original payment method.',
    `Shopper: ${c.signedIn ? `signed in as ${c.name || 'a customer'}` : 'guest'}; basket ${c.count} items, ${money(c.sub)}.`,
    'Products:', ...P, 'FAQs:', ...faqs,
    // Pages and policies (Help & policies, About us, careers, updates) so the AI can answer from their text too.
    'Store pages:', ...c.kb.passages.filter((x) => x.kind !== 'product' && x.kind !== 'faq').map((x) => `[${x.title}] ${clip(x.text, 600)}`),
  ].join('\n');
  return out.slice(0, 29800);
}

/**
 * Ask the AI endpoint. Output: the reply text, or null when the AI is not set up, unreachable, busy or failed
 * (the chat then shows fallbackReply). Gives up after 20 seconds.
 */
export async function askAi(history: { role: 'user' | 'assistant'; content: string }[], facts: string): Promise<string | null> {
  if (typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12), facts }), signal: ctl.signal });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null) as { reply?: string } | null;
    return d?.reply?.trim() || null;
  } catch { return null; } finally { clearTimeout(tm); }
}
