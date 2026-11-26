// Online store ↔ CRM bridge. The store keeps its own keys (shopUsers, shopOrders, contactMsgs, backInStock,
// returnReqs, web2.reviews); this file turns each new store event into CRM records once, and lets the CRM
// push customer codes back to the webstore (Post to webstore › Discount codes).
import { readKey, writeKey } from '../../lib/persist';
import { mergeWeb, type Code, type Review, type Web } from '../../data/web';
import type { Customer } from '../../data/sell';
import { PRODUCTS0, type Product } from '../../data/catalogue';
import { K, STAFF, SETTINGS0, fmtPhone, phoneKey, uid, type Feedback, type Lead, type Note, type Settings, type Task } from './model';
import { storeUrl } from '../../lib/site';

type Line = { pid: string; unit: string; qty: number };
type ShopUser = { email: string; name: string; phone: string; verified: boolean; offers: boolean; created: string; wish: string[]; cart: Line[]; orders: string[]; notif?: { sms?: boolean; whatsapp?: boolean; email?: boolean } };
export type WebOrderLine = { pid: string; name: string; unit: string; qty: number; each: number };
export type ShopOrder = { no: string; at: string; ts: number; fulfil: 'D' | 'P' | 'I'; brId: string; where: string; name: string; phone: string; email: string; lines: WebOrderLine[]; total: number; pay: string; payKey: string; paid: boolean; hp?: unknown; user?: string; status?: string; returnReq?: string; codeTxt?: string };
type Contact = { id: string; name: string; phone: string; email: string; msg: string; at: string };
type Stock = { name: string; phone: string; email: string; product: string; at: number; notified?: number; via?: string };
type Ret = { no: string; reason: string; at: number; by?: string };

export const WK = { users: 'ecompos.shopUsers', orders: 'ecompos.shopOrders', contact: 'ecompos.contactMsgs', stock: 'ecompos.backInStock', returns: 'ecompos.returnReqs', web: 'ecompos.web2', synced: 'ecompos.crm.webSynced' } as const;
const STORE_KEYS: string[] = [WK.users, WK.orders, WK.contact, WK.stock, WK.returns, WK.web, 'ecompos.products2', 'ecompos.stockMoves'];

const rd = <T,>(k: string, d: T): T => { try { return readKey<T>(k, d) ?? d; } catch { return d; } };
const DAY = 864e5;
const BRS = ['osu', 'legon', 'adum'];
const brOf = (id?: string) => (id && BRS.includes(id) ? id : 'osu');
const COMPLAINT = /broken|faulty|damag|not working|stopped working|late|delay|never arrived|refund|complain|rude|bad service|poor|wrong item|missing|disappoint|cheat|overcharg/i;

/** Sales staff with the fewest open web leads in the branch take the next one (round robin). */
function ownerFor(br: string, leads: Lead[]) {
  const pool = STAFF.filter((s) => s.role === 'staff' && s.br === br).map((s) => s.name);
  if (!pool.length) return STAFF.find((s) => s.br === br)?.name || 'Ebenezer Mensah';
  const load = (n: string) => leads.filter((l) => l.owner === n && (l.status === 'New' || l.status === 'Contacted')).length;
  return pool.sort((a, b) => load(a) - load(b))[0];
}
const supOf = (br: string) => STAFF.find((s) => s.role === 'supervisor' && s.br === br)?.name || 'Kwame Asante';
const monthYear = () => new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/* ---------- Store → CRM ---------- */
let busy = false;
/** Idempotent: every store record is turned into CRM records once (tracked in ecompos.crm.webSynced). */
export function syncStore(): number {
  if (busy) return 0;
  busy = true;
  try {
    const prev = rd<string[] | null>(WK.synced, null);
    const done = new Set(prev || []);
    const first = prev === null;
    const settings = rd<Settings>(K.settings, SETTINGS0);
    let custs = rd<Customer[]>(K.customers, []);
    let leads = rd<Lead[]>(K.leads, []);
    let tasks = rd<Task[]>(K.tasks, []);
    let notes = rd<Note[]>(K.notes, []);
    let fb = rd<Feedback[]>(K.feedback, []);
    const touched = { c: false, l: false, t: false, n: false, f: false };
    let n = 0;
    const now = Date.now();
    const users = rd<ShopUser[]>(WK.users, []);
    const orders = Object.values(rd<Record<string, ShopOrder>>(WK.orders, {}));
    const custBy = (ph: string) => custs.find((x) => phoneKey(x.phone) === phoneKey(ph));
    const note = (ph: string, text: string, br: string, at = now) => { notes = [{ id: uid('N'), customerPhone: fmtPhone(ph), kind: 'system', text, by: 'Online store', role: 'Website', branch: br, at }, ...notes]; touched.n = true; };
    const task = (t: Omit<Task, 'id' | 'assignedBy' | 'status' | 'auto'>) => { tasks = [{ ...t, id: uid('TK'), assignedBy: 'Online store', status: 'open', auto: true }, ...tasks]; touched.t = true; };
    const lead = (l: Omit<Lead, 'id' | 'createdBy' | 'createdAt' | 'lastContactAt' | 'status' | 'owner' | 'consent'> & { consent?: Lead['consent'] }) => {
      const open = leads.find((x) => phoneKey(x.phone) === phoneKey(l.phone) && x.phone && (x.status === 'New' || x.status === 'Contacted' || x.status === 'Qualified') && x.source === l.source);
      if (open) { leads = leads.map((x) => (x.id === open.id ? { ...x, interest: x.interest.includes(l.interest) ? x.interest : `${x.interest} · ${l.interest}`, estValue: Math.max(x.estValue, l.estValue), lastContactAt: now } : x)); touched.l = true; return open; }
      const owner = ownerFor(l.branch, leads);
      const L: Lead = { consent: { sms: false, whatsapp: false, email: false }, ...l, id: uid('LD'), owner, status: 'New', createdBy: 'Online store', createdAt: now, lastContactAt: now };
      leads = [L, ...leads]; touched.l = true;
      return L;
    };
    /** Creates a CRM profile for a store shopper the shops have never met. */
    const ensureCust = (name: string, phone: string, email: string, br: string, offers: boolean) => {
      if (phoneKey(phone).length !== 9) return null;
      const have = custBy(phone);
      if (have) {
        if (!have.email && email) { custs = custs.map((x) => (x.id === have.id ? { ...x, email } : x)); touched.c = true; }
        return have;
      }
      const c: Customer = { id: 'w' + phoneKey(phone), name: name || 'Web customer', phone: fmtPhone(phone), email: email || '', group: 'Retail', since: monthYear(), tier: 'Bronze', points: 0, limit: 0, sms: offers, whatsapp: offers, email_ok: offers && !!email, br, credits: [], codes: [], gifts: [] };
      custs = [...custs, c]; touched.c = true;
      return c;
    };

    // 1. Sign-ups → customer profile (consent from "Send me offers"), and a lead while they have not ordered.
    users.forEach((u) => {
      const id = 'u:' + u.email;
      if (done.has(id)) return;
      done.add(id); n++;
      const myOrders = orders.filter((o) => o.user === u.email || u.orders?.includes(o.no));
      const br = brOf(myOrders[0]?.brId);
      const known = !!custBy(u.phone);
      const c = ensureCust(u.name, u.phone, u.email, br, u.offers);
      if (!first && c) note(u.phone, known ? `Linked online store account ${u.email}` : `Signed up on the online store (${u.email})`, br);
      if (!known && !myOrders.length && !first) lead({ name: u.name, phone: fmtPhone(u.phone), email: u.email, source: 'Website', interest: u.wish?.length ? `Wish list · ${u.wish.length} item${u.wish.length > 1 ? 's' : ''}` : 'New store account', estValue: 0, branch: br, nextStepAt: now + DAY, nextStep: 'Welcome call · help with a first order', consent: { sms: u.offers, whatsapp: u.offers, email: u.offers } });
    });

    // 2. Orders → profile, timeline, convert open web leads; hire purchase → application lead.
    orders.forEach((o) => {
      const id = 'o:' + o.no;
      if (done.has(id)) {
        const rid = 'x:' + o.no;
        if (o.status === 'Cancelled' && !done.has(rid)) { done.add(rid); n++; if (!first) note(o.phone, `Cancelled online order ${o.no}`, brOf(o.brId)); }
        return;
      }
      done.add(id); n++;
      if (first) return;
      const br = brOf(o.brId);
      const u = users.find((x) => x.email === o.user);
      ensureCust(o.name, o.phone, o.email, br, !!u?.offers);
      const how = o.fulfil === 'D' ? `delivery to ${o.where}` : o.fulfil === 'P' ? `pickup at ${o.where}` : `in store at ${o.where}`;
      note(o.phone, `Online order ${o.no} · GHS ${o.total.toFixed(2)} · ${o.lines.length} item${o.lines.length > 1 ? 's' : ''} · ${how} · ${o.pay}${o.codeTxt ? ` · code ${o.codeTxt}` : ''}`, br, o.ts || now);
      const open = leads.filter((l) => phoneKey(l.phone) === phoneKey(o.phone) && (l.status === 'New' || l.status === 'Contacted' || l.status === 'Qualified') && l.source === 'Website');
      if (open.length) { leads = leads.map((l) => (open.includes(l) ? { ...l, status: 'Converted', lastContactAt: now } : l)); touched.l = true; }
      if (o.hp || o.payKey === 'hp') {
        const L = lead({ name: o.name, phone: fmtPhone(o.phone), email: o.email, source: 'Hire-purchase application', interest: o.lines.map((l) => l.name).join(', '), estValue: o.total, branch: br, nextStepAt: now + 4 * 36e5, nextStep: 'Check documents and guarantor · start the agreement' });
        task({ type: 'Call', title: `Hire purchase from the website · ${o.name} · order ${o.no}`, relatedTo: { kind: 'lead', id: L.id, name: o.name }, assignee: L.owner, branch: br, dueAt: now + 4 * 36e5, source: 'Online store' });
      }
    });

    // 3. Contact form → complaint (Feedback) or enquiry (lead / note + reply task).
    rd<Contact[]>(WK.contact, []).forEach((m) => {
      const id = 'm:' + m.id;
      if (done.has(id)) return;
      done.add(id); n++;
      if (first) return;
      const cu = m.phone ? custBy(m.phone) : undefined;
      const br = cu?.br || 'osu';
      const ph = m.phone ? fmtPhone(m.phone) : '';
      if (COMPLAINT.test(m.msg)) {
        const f: Feedback = { id: uid('FB'), customerPhone: ph, customer: m.name, rating: 2, comment: m.msg, channel: 'Website', branch: br, staff: 'Online store', kind: 'complaint', category: /late|delay|arriv/i.test(m.msg) ? 'Delivery' : /broken|faulty|damag|working/i.test(m.msg) ? 'Product quality' : /rude|service/i.test(m.msg) ? 'Staff' : 'Other', status: 'open', slaDueAt: now + settings.slaHours.complaint * 36e5, at: now };
        fb = [f, ...fb]; touched.f = true;
        task({ type: 'Call', title: `Website complaint · ${m.name}`, relatedTo: { kind: 'feedback', id: f.id, name: m.name }, assignee: supOf(br), branch: br, dueAt: f.slaDueAt, source: 'Online store' });
        return;
      }
      if (cu) {
        note(cu.phone, `Website message: “${m.msg.slice(0, 160)}”`, br);
        task({ type: m.email && !m.phone ? 'Email' : 'Call', title: `Reply to website message · ${cu.name}`, relatedTo: { kind: 'customer', id: cu.phone, name: cu.name }, assignee: ownerFor(br, leads), branch: br, dueAt: now + 36e5, source: 'Online store' });
      } else {
        const L = lead({ name: m.name, phone: ph, email: m.email, source: 'Website', interest: m.msg.slice(0, 80), estValue: 0, branch: br, nextStepAt: now + 36e5, nextStep: 'Reply to their website message' });
        task({ type: m.phone ? 'Call' : 'Email', title: `Reply to website message · ${m.name}`, relatedTo: { kind: 'lead', id: L.id, name: m.name }, assignee: L.owner, branch: br, dueAt: now + 36e5, source: 'Online store' });
      }
    });

    // 4. Back-in-stock requests → lead (interest = the product).
    rd<Stock[]>(WK.stock, []).forEach((s) => {
      const id = `s:${s.at}:${s.product}`;
      if (done.has(id)) return;
      done.add(id); n++;
      if (first) return;
      const cu = s.phone ? custBy(s.phone) : undefined;
      const br = cu?.br || 'osu';
      if (cu) note(cu.phone, `Asked to be told when ${s.product} is back in stock`, br);
      lead({ name: s.name, phone: s.phone ? fmtPhone(s.phone) : '', email: s.email || '', source: 'Website', interest: `${s.product} (back in stock)`, estValue: 0, branch: br, nextStepAt: now + 3 * DAY, nextStep: 'Tell them when it is back in stock' });
    });

    // 5. Return requests → complaint + task for the branch.
    rd<Ret[]>(WK.returns, []).forEach((r) => {
      const id = `r:${r.no}:${r.at}`;
      if (done.has(id)) return;
      done.add(id); n++;
      if (first) return;
      const o = orders.find((x) => x.no === r.no);
      const br = brOf(o?.brId);
      const name = o?.name || users.find((u) => u.email === r.by)?.name || 'Web customer';
      const f: Feedback = { id: uid('FB'), customerPhone: o ? fmtPhone(o.phone) : '', customer: name, rating: 2, comment: `Return requested for order ${r.no}: ${r.reason}`, channel: 'Website', branch: br, staff: 'Online store', kind: 'complaint', category: 'Returns', status: 'open', slaDueAt: now + settings.slaHours.complaint * 36e5, at: now };
      fb = [f, ...fb]; touched.f = true;
      if (o) note(o.phone, `Return requested on order ${r.no} · ${r.reason}`, br);
      task({ type: 'Call', title: `Arrange return · order ${r.no} · ${name}`, relatedTo: { kind: 'feedback', id: f.id, name }, assignee: supOf(br), branch: br, dueAt: now + 24 * 36e5, source: 'Online store' });
    });

    // 6. Abandoned baskets of signed-in shoppers who agreed to offers → reminder task (journey “Abandoned basket”).
    users.forEach((u) => {
      if (!u.cart?.length) return;
      const sig = u.cart.map((l) => `${l.pid}${l.unit}${l.qty}`).sort().join('|');
      const id = `b:${u.email}:${sig}`;
      if (done.has(id)) return;
      done.add(id); n++;
      if (first || !u.offers) return;
      const cu = custBy(u.phone);
      const br = cu?.br || 'osu';
      const items = u.cart.reduce((a, l) => a + l.qty, 0);
      task({ type: 'WhatsApp', title: `Basket left on the website · ${u.name} · ${items} item${items > 1 ? 's' : ''}`, relatedTo: { kind: 'customer', id: fmtPhone(u.phone), name: u.name }, assignee: ownerFor(br, leads), branch: br, dueAt: now + 2 * 36e5, source: 'Online store' });
    });

    // 7. Webstore reviews → feedback (Website), linked by reviewId so hiding works both ways.
    const W = mergeWeb(rd<Partial<Web> | null>(WK.web, null));
    W.reviews.forEach((r) => {
      const id = 'v:' + r.id;
      if (done.has(id)) return;
      done.add(id); n++;
      if (first) return;
      const cu = custs.find((x) => x.name.toLowerCase() === r.name.toLowerCase());
      const br = cu?.br || 'osu';
      const bad = r.stars <= 2;
      const f: Feedback = { id: uid('FB'), customerPhone: cu?.phone || '', customer: r.name, rating: r.stars, comment: `${r.product ? r.product + ' · ' : ''}${r.text}`, channel: 'Website', branch: br, staff: 'Online store', kind: bad ? 'complaint' : 'rating', category: bad ? 'Product quality' : undefined, status: bad ? 'open' : 'resolved', slaDueAt: now + settings.slaHours.complaint * 36e5, at: now, reviewId: r.id };
      fb = [f, ...fb]; touched.f = true;
      if (cu) note(cu.phone, `Wrote a ${r.stars}-star review on the webstore`, br);
    });

    if (touched.c) writeKey(K.customers, custs);
    if (touched.l) writeKey(K.leads, leads);
    if (touched.t) writeKey(K.tasks, tasks);
    if (touched.n) writeKey(K.notes, notes);
    if (touched.f) writeKey(K.feedback, fb);
    if (n || first) writeKey(WK.synced, [...done]);
    return n;
  } finally {
    busy = false;
  }
}


/* ---------- Back in stock: tell everyone who tapped “Notify me” as soon as stock returns ---------- */
let notifying = false;
export function notifyBackInStock(): number {
  if (notifying) return 0;
  notifying = true;
  try {
    const reqs = rd<Stock[]>(WK.stock, []);
    if (!reqs.some((r) => !r.notified)) return 0;
    const P = rd<Product[]>('ecompos.products2', PRODUCTS0);
    const moves = rd<Record<string, Record<string, number>>>('ecompos.stockMoves', {});
    const live = (p: Product) => BRS.reduce((a, b) => a + Math.max(0, (p.stock as Record<string, number>)[b] - Number(moves[p.name]?.[b] || 0)), 0);
    const stocked = (name: string) => { const p = P.find((x) => x.name === name); return p && p.web !== false && live(p) > 0 ? p : null; };
    const users = rd<(ShopUser & { inbox?: { id: string; title: string; body: string; from: string; no: string; read: boolean; at: string }[] })[]>(WK.users, []);
    const out = rd<unknown[]>('ecompos.smsOutbox', []);
    let leads = rd<Lead[]>(K.leads, []); let notes = rd<Note[]>(K.notes, []);
    const custs = rd<Customer[]>(K.customers, []);
    let n = 0; let uTouched = false; let lTouched = false; let nTouched = false;
    const when = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + new Date().toTimeString().slice(0, 5);
    const next = reqs.map((r) => {
      if (r.notified) return r;
      const p = stocked(r.product);
      if (!p) return r;
      const first = (r.name || 'there').split(' ')[0];
      const link = storeUrl(`p/${p.id}`);
      const text = `Hello ${first}, good news: ${p.name} is back in stock at Ebenezer Unique Ventures. Order now before it sells out: ${link}`;
      const via: string[] = [];
      if (phoneKey(r.phone || '').length === 9) { out.unshift({ at: when, by: 'Online store · automatic', via: 'SMS', to: fmtPhone(r.phone), n: 1, kind: 'Back in stock', text, status: 'Sent' }); via.push('SMS'); }
      if (/^\S+@\S+\.\S+$/.test(r.email || '')) { out.unshift({ at: when, by: 'Online store · automatic', via: 'Email', to: r.email, n: 1, kind: 'Back in stock', text, status: 'Sent' }); via.push('Email'); }
      const u = users.find((x) => (r.email && x.email === r.email) || (r.phone && phoneKey(x.phone) === phoneKey(r.phone)));
      if (u) { u.inbox = [{ id: uid('m'), title: `${p.name} is back in stock`, body: `You asked us to tell you. It is available again online and in store.`, from: 'Online store · just now', no: '', read: false, at: when }, ...(u.inbox || [])]; uTouched = true; via.push('Account inbox'); }
      leads = leads.map((l) => (l.interest.includes(r.product) && ((r.phone && phoneKey(l.phone) === phoneKey(r.phone)) || (r.email && l.email === r.email)) ? (lTouched = true, { ...l, status: l.status === 'New' ? 'Contacted' : l.status, lastContactAt: Date.now(), nextStep: 'Told them it is back in stock · check if they ordered', nextStepAt: Date.now() + 2 * DAY }) : l));
      const cu = r.phone ? custs.find((x) => phoneKey(x.phone) === phoneKey(r.phone)) : undefined;
      if (cu) { notes = [{ id: uid('N'), customerPhone: cu.phone, kind: 'message', text: `Told automatically that ${p.name} is back in stock (${via.join(' · ') || 'no contact'})`, by: 'Online store', role: 'Website', branch: cu.br, at: Date.now() }, ...notes]; nTouched = true; }
      n++;
      return { ...r, notified: Date.now(), via: via.join(' · ') };
    });
    if (!n) return 0;
    writeKey(WK.stock, next);
    writeKey('ecompos.smsOutbox', out);
    if (uTouched) writeKey(WK.users, users);
    if (lTouched) writeKey(K.leads, leads);
    if (nTouched) writeKey(K.notes, notes);
    return n;
  } catch { return 0; } finally { notifying = false; }
}

/** Run once at start-up and whenever a store key changes (this tab or another). */
let started = false;
export function startStoreSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  const later = () => { clearTimeout(t); t = setTimeout(() => { syncStore(); notifyBackInStock(); }, 60); };
  try { syncStore(); notifyBackInStock(); } catch { /* storage blocked */ }
  window.addEventListener('ecompos:persist', (e) => { const k = (e as CustomEvent<{ key: string }>).detail?.key; if (k && STORE_KEYS.includes(k)) later(); });
  window.addEventListener('storage', (e) => { if (e.key && STORE_KEYS.includes(e.key)) later(); });
}

/* ---------- Reads for CRM screens ---------- */
export function webOf(phone: string) {
  const pk = phoneKey(phone);
  const user = rd<ShopUser[]>(WK.users, []).find((u) => phoneKey(u.phone) === pk) || null;
  const orders = Object.values(rd<Record<string, ShopOrder>>(WK.orders, {})).filter((o) => phoneKey(o.phone) === pk || (user && o.user === user.email)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return { user, orders, spend: orders.filter((o) => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0) };
}
export function webStats(br: string) {
  const inBr = (b?: string) => br === 'all' || brOf(b) === br;
  const wk = Date.now() - 7 * DAY;
  const orders = Object.values(rd<Record<string, ShopOrder>>(WK.orders, {})).filter((o) => inBr(o.brId));
  const recent = orders.filter((o) => (o.ts || 0) >= wk && o.status !== 'Cancelled');
  const users = rd<ShopUser[]>(WK.users, []);
  const W = mergeWeb(rd<Partial<Web> | null>(WK.web, null));
  return {
    orders: recent.length, revenue: recent.reduce((a, o) => a + o.total, 0), accounts: users.length, offers: users.filter((u) => u.offers).length,
    baskets: users.filter((u) => u.cart?.length).length, reviews: W.reviews.length, hidden: W.reviews.filter((r) => r.hidden).length,
    stars: W.reviews.length ? W.reviews.reduce((a, r) => a + r.stars, 0) / W.reviews.length : 0,
    codes: W.codes.filter((c) => /CRM/.test(c.note)).length,
  };
}

/* ---------- CRM → webstore ---------- */
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
/** Adds a code to Post to webstore › Discount codes. `only` ties it to one customer's phone. */
export function pushWebCode(o: { code: string; value: number; type?: Code['type']; note: string; by: string; days?: number; only?: string; limit?: number; min?: number }) {
  const W = mergeWeb(rd<Partial<Web> | null>(WK.web, null));
  const from = new Date(); const to = new Date(Date.now() + (o.days ?? 30) * DAY);
  const c: Code = { code: o.code.toUpperCase(), type: o.type || 'cash', value: o.value, cap: 0, min: o.min || 0, from: local(from), to: local(to), limit: o.limit ?? (o.only ? 1 : 0), once: true, note: `CRM · ${o.note}`, paused: false, banner: false, used: 0, by: o.by, uses: [], only: o.only ? phoneKey(o.only) : undefined };
  writeKey(WK.web, { ...W, codes: [c, ...W.codes.filter((x) => x.code !== c.code)], lastPost: new Date().toISOString() });
  return c;
}
/** Hide or show a webstore review from the CRM (same switch as Post to webstore › Reviews). */
export function setReviewHidden(id: string, hidden: boolean) {
  const W = mergeWeb(rd<Partial<Web> | null>(WK.web, null));
  writeKey(WK.web, { ...W, reviews: W.reviews.map((r: Review) => (r.id === id ? { ...r, hidden, flagged: false } : r)), lastPost: new Date().toISOString() });
}
export function reviewOf(id?: string) {
  if (!id) return null;
  return mergeWeb(rd<Partial<Web> | null>(WK.web, null)).reviews.find((r) => r.id === id) || null;
}
