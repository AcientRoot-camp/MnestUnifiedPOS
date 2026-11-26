// Sell Now (sell.md §2) and Credit sales (§4): full-screen till.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Wordmark } from '../components/Logo';
import { Toast } from '../components/ui';
import Intro, { CREDIT_INTRO, introSeen } from '../components/Intro';
import { BRANCHES, PEOPLE } from '../data/nav';
import { ART_BG, PRODUCTS0, isArt, type Product } from '../data/catalogue';
import { COLLECTIONS, CUSTOMERS, RIDERS, SALES, WEB_ORDERS, type Collection, type Customer, type Rider, type WebOrder } from '../data/sell';
import { useWeb } from '../data/web';
import { priceOf } from '../lib/pricing';
import { companyBiz, downloadPdf, tillSaleDoc } from '../lib/docPdfs';
import { readKey, usePersist, writeKey } from '../lib/persist';
import { creds, secLog } from '../lib/sec';
import { useSession } from '../lib/session';
import { useCompanyLogo } from '../lib/brand';
import { HOLDS_KEY, availAt, onHandAt, setHold, sellStock, tabId, type Holds } from '../lib/stock';
import { barcodeMap, cartonTxt, cleanCode, ctName, expired, perCarton, qtyTxt, resolveCode, tillProducts, type Scan } from '../lib/barcode';
import BarcodeCamera from '../components/BarcodeCamera';
import { cx, ghs } from '../lib/format';
import { DISC_LIMIT, docCode, invNo, nextNo, nowTxt, phClean, type Cust, type Deliver, type Line, type Parked, type TillSale } from './pos/model';
import { ClosePanel, LockScreen, MySalesPanel, OnlinePanel, ParkDialog, ParkedPanel, PickupPanel, ReturnPanel, RidersPanel } from './pos/Panels';
import Pay, { type PayDone } from './pos/Pay';
import { SalesInvoice, TillReceipt, bizInfo } from './pos/Docs';
import TillPanel from './crm/TillPanel';
import ProductDesc from '../components/ProductDesc';
import ScanWaySwitch from '../components/ScanWaySwitch';
import { useScanWay } from '../lib/scanDevice';
import { shownDesc } from '../lib/describe';

type DiscReq = { id: string; kind: string; till: string; br: string; item: string; price: number; asked: number; by: string; byRole: string; at: string; status: 'pending' | 'approved' | 'reduced' | 'rejected'; note?: string; final?: number };
type Notice = { id: string; title: string; state: string; to: string[]; kind?: string };
const TEAL = '#0b5c5c';
const SHADOW = 'rgba(69,36,219,0.34) 0 4px 24px 0';
const RED = '#c62828';
const topPill = 'h-11 px-3.5 rounded-full bg-white border border-[#ebebeb] text-[13px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap';
const ADMIN_WHY = ['Cashier on lunch', 'Queue of customers waiting', 'Till staff off sick', 'Training a new cashier', 'Big customer order'];
const custBlank: Cust = { name: '', phone: '', email: '', addr: '', landmark: '', gps: '' };
const TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

export default function POS() {
  const { session, signOut, online: netOnline } = useSession();
  const { tab } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const creditMode = tab === 'credit' || loc.pathname.replace(/\/$/, '') === '/sell/credit';
  const role = session?.role ?? 'staff';
  const SU = role === 'superuser';
  const me = PEOPLE[role];
  const username = session?.username || me.username;
  const br = session?.branch && session.branch !== 'all' ? session.branch : 'osu';
  const branch = BRANCHES.find((b) => b.id === br) ?? BRANCHES[0];
  const till = `${branch.short} · Till 1`;
  const logo = useCompanyLogo(true);
  const B = bizInfo();
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  // Post to online data: its sale prices also apply at the till.
  const [W] = useWeb();
  const [moves] = usePersist<Record<string, Record<string, number>>>('ecompos.stockMoves', {});
  // Units held right now by online baskets and other tills (lib/stock.ts), so the till never sells what a shopper holds.
  const [holds] = usePersist<Holds>(HOLDS_KEY, {});
  const [customers, setCustomers] = usePersist<Customer[]>('ecompos.customers2', CUSTOMERS);
  const [sales, setSales] = usePersist<TillSale[]>('ecompos.sales2', []);
  const [parked, setParked] = usePersist<Parked[]>('ecompos.parked2', []);
  const [discReq, setDiscReq] = usePersist<DiscReq[]>('ecompos.discReq2', []);
  const [payAllow] = usePersist<Record<string, Record<string, boolean>>>('ecompos.payAllow', {});
  const [wo] = usePersist<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS);
  const [col] = usePersist<Collection[]>('ecompos.collect2', COLLECTIONS);
  const [riders] = usePersist<Rider[]>('ecompos.riders2', RIDERS);
  const [notices] = usePersist<Notice[]>('ecompos.announcements', []);
  const [train] = usePersist<{ on: boolean }>('ecompos.training2', { on: false });
  const [queue, setQueue] = usePersist<string[]>('ecompos.offlineQueue', []);
  const [shift] = useState(() => { const k = 'ecompos.shift.' + username + '.' + new Date().toDateString(); let t = readKey<string>(k, ''); if (!t) { t = new Date().toTimeString().slice(0, 5); writeKey(k, t); } return t; });

  // Offline: the real connection, or the till switched to offline by hand.
  const [manualOff, setManualOff] = useState(false);
  const online = netOnline && !manualOff;
  const [syncing, setSyncing] = useState(false);
  const wasOff = useRef(!online);
  useEffect(() => { if (online && wasOff.current && queue.length) { setSyncing(true); const t = setTimeout(() => { setQueue([]); setSyncing(false); }, 2500); wasOff.current = false; return () => clearTimeout(t); } wasOff.current = !online; }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [cam, setCam] = useState(false);
  // How this till scans: the camera on tablets / phones, a USB or Bluetooth barcode scanner on laptops / desktops.
  const [scanWay] = useScanWay();
  const [scanMsg, setScanMsg] = useState<null | { tone: 'ok' | 'bad' | 'warn'; text: string; unknown?: string }>(null);
  const [oos, setOos] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [biz, setBiz] = useState<{ on: boolean; name: string; tin: string }>({ on: false, name: '', tin: '' });
  const [cust, setCust] = useState<Cust>(custBlank);
  const [cq, setCq] = useState('');
  const [picked, setPicked] = useState<Customer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saved, setSaved] = useState(false);
  const [more, setMore] = useState(false);
  const [del, setDel] = useState<Deliver & { free: boolean; note: string; time: string }>({ on: false, when: 'asap', at: '', fee: 20, free: false, note: '', time: '' });
  const [disc, setDisc] = useState(''); const [discApplied, setDiscApplied] = useState(0); const [discId, setDiscId] = useState(''); const [discOk, setDiscOk] = useState(0);
  const [credit, setCredit] = useState<{ amt: number; ref: string } | null>(null);
  const [step, setStep] = useState<'sell' | 'pay' | 'done'>('sell');
  const [doneSale, setDoneSale] = useState<TillSale | null>(null);
  const [docTab, setDocTab] = useState<'r' | 'i'>('r');
  const [sent, setSent] = useState<Record<string, string>>({});
  const [wa, setWa] = useState(''); const [waErr, setWaErr] = useState('');
  const [panel, setPanel] = useState<'' | 'parked' | 'park' | 'return' | 'online' | 'pickup' | 'riders' | 'close' | 'mysales'>('');
  const [locked, setLocked] = useState(false);
  const [lockPinOnly, setLockPinOnly] = useState(false);
  const [adminOk, setAdminOk] = useState<{ why: string; more: string } | null>(null);
  const [gate, setGate] = useState({ why: '', more: '' });
  const [intro, setIntro] = useState(() => creditMode && !introSeen('credit', username));
  const [toast, setToast] = useState('');
  useEffect(() => { setIntro(creditMode && !introSeen('credit', username)); }, [creditMode, username]);

  // This till's hold id: one per user, branch and browser tab (lib/stock.ts).
  const tillOwner = useMemo(() => `till:${username}:${br}:${tabId()}`, [username, br]);
  /**
   * Units this till can still sell: branch stock − sold − held by online baskets, other tills and parked sales.
   * This till's own cart is left out here and taken off on the card (inCart), so it is never counted twice.
   */
  const stockAt = (p: Product) => availAt(p, br, moves, holds, parked, tillOwner);
  // Current price incl. any running sale (Products scheduled sale or Post to online sale) · same rule as the website.
  const priced = (p: Product) => priceOf(p, W.desc[p.id]);
  /** Low stock (automatic): at or below the product's reorder level at this branch (10 if no level is set). */
  const isLowAt = (p: Product, n: number) => n > 0 && n <= (p.reorder > 0 ? p.reorder : 10);
  // Best sellers (automatic): the 5 products with the most units sold at this branch in the last 30 days,
  // counting the sales history plus sales rung up on this till. Recomputed whenever a sale is completed.
  const best = useMemo(() => {
    const since = Date.now() - 30 * 864e5; const units: Record<string, number> = {};
    SALES.filter((s) => s.br === br && s.ts >= since && s.status !== 'voided').forEach((s) => s.lines.forEach((l) => { units[l.name] = (units[l.name] || 0) + l.qty; }));
    sales.filter((s) => s.br === br && s.ts >= since && s.status !== 'voided').forEach((s) => s.lines.forEach((l) => { units[l.name] = (units[l.name] || 0) + l.qty * (l.per || 1); }));
    return new Set(Object.entries(units).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name));
  }, [br, sales]);
  const inCart = (pid: string) => cart.filter((l) => l.pid === pid).reduce((a, l) => a + l.qty * (l.per || 1), 0);
  // Hold whatever is in the current sale, so the online store and other tills show it as taken straight away.
  // Removing a line (or emptying the sale) gives the units back. After payment ('done') the sale itself has taken
  // the stock, so the hold is dropped.
  useEffect(() => {
    setHold(tillOwner, step === 'done' || !cart.length ? null : { kind: 'till', ts: Date.now(), lines: cart.map((l) => ({ pid: l.pid, name: l.name, br, qty: l.qty * (l.per || 1) })) });
  }, [cart, step, tillOwner, br]);
  const list = P.filter((p) => p.pos !== false && (p.status === 'live' || p.by === me.name) && (p.scope === 'all' || p.scope === br));
  const cats = Array.from(new Set(list.map((p) => p.cat)));
  // Barcode map for this till (productscan.md §3.2): barcode → product + unit (single / carton). Only live, till-enabled
  // products for this branch (or every branch) are in it. Built from the products saved on this device, so it works offline.
  const bcMap = useMemo(() => barcodeMap(P, br), [P, br]);
  const codesById = useMemo(() => { const m: Record<string, string[]> = {}; Object.entries(bcMap).forEach(([k, h]) => { (m[h.pid] = m[h.pid] || []).push(k); }); return m; }, [bcMap]);
  const qd = cleanCode(q);
  // Name / SKU / category search, plus live filtering by part of a barcode (3+ digits).
  const shown = list.filter((p) => (cat === 'All' || p.cat === cat) && (!q || `${p.name} ${p.sku} ${p.cat}`.toLowerCase().includes(q.toLowerCase().trim()) || (qd.length >= 3 && /^\d+$/.test(qd) && (codesById[p.id] || []).some((k) => k.includes(qd)))));
  const qRef = useRef<HTMLInputElement>(null);
  const [weigh, setWeigh] = useState<null | { p: Product; kg: string }>(null); // weight prompt for goods sold by weight
  const [info, setInfo] = useState<Product | null>(null); // product info window (shared description, price, stock)
  const [serialFor, setSerialFor] = useState<null | { pid: string; unit: string }>(null); // serial number prompt (optional, from the sale line)
  // What a scan does: add one to the sale (normal) or take one off (Remove mode, for corrections). Same for USB,
  // Bluetooth and camera scans.
  const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
  const saleNo = readKey<number>('ecompos.saleNo', 34420100) + 1;

  // Money
  const sub = cart.reduce((a, l) => a + l.price * l.qty, 0);
  const discAmt = Math.min(sub, discApplied);
  const limit = DISC_LIMIT[role] ?? 0;
  const myReq = discReq.find((r) => r.id === discId);
  const needApproval = discAmt > limit && discOk !== discAmt;
  const onHold = needApproval && !!myReq && myReq.status === 'pending';
  const credUse = Math.min(credit?.amt ?? 0, Math.max(0, sub - discAmt));
  const after = Math.max(0, sub - discAmt - credUse);
  const tx = biz.on ? { vat: after * 0.15, nhil: after * 0.025, getf: after * 0.025 } : { vat: 0, nhil: 0, getf: 0 };
  const fee = del.on && !del.free ? del.fee : 0;
  const total = Math.round((after + tx.vat + tx.nhil + tx.getf + fee) * 100) / 100;
  useEffect(() => { if (!myReq) return; if (myReq.status === 'approved' && discOk !== discAmt) { setDiscOk(discAmt); setToast(`Discount approved · ${ghs(discAmt)}`); } if (myReq.status === 'reduced' && myReq.final) { setDisc(String(myReq.final)); setDiscApplied(myReq.final); setDiscOk(myReq.final); setToast(`Discount approved at ${ghs(myReq.final)}`); } if (myReq.status === 'rejected') { setDisc(''); setDiscApplied(0); setDiscId(''); setToast(`Discount rejected${myReq.note ? ` · ${myReq.note}` : ''} · selling at full price`); } }, [myReq?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cart
  /**
   * Why a product cannot be added (same rules for a tap and a scan, productscan.md §3.5), or '' when it can.
   * Selling below stock is only possible through the Below stock approval.
   */
  const whyNot = (p: Product, per = 1, label = 'single') => {
    const max = stockAt(p); const left = max - inCart(p.id);
    if (left >= per - 1e-9) return '';
    const held = onHandAt(p, br, moves) - max;
    if (left <= 0 && max > 0) return `${p.name}: all ${qtyTxt(p, max)} left are already in this sale.`;
    if (left <= 0) return held > 0 ? `${p.name}: the last ${qtyTxt(p, held)} at ${branch.short} are held in online baskets or parked sales.` : `${p.name} is out of stock at this branch. Receive stock or ask for a transfer before selling it.`;
    return p.byWeight ? `${p.name}: only ${qtyTxt(p, left)} left, not enough for ${label}.` : `${p.name}: only ${left} left, not enough for a ${label}.`;
  };
  /**
   * The unit being sold: a single, the product's carton / crate / pack (its own size), an extra unit (e.g. half carton)
   * or a weighed amount from the scale. Output: its line name, singles (kg) in it and price, using any running sale.
   */
  const unitFor = (p: Product, kind: 's' | 'c' | 'u' | 'w', o: { uid?: string; kg?: number; price?: number } = {}) => {
    const pr = priced(p);
    if (kind === 'c') return { unit: cartonTxt(p), per: perCarton(p), price: pr.ctPrice || pr.price * perCarton(p) };
    if (kind === 'u') { const u = (p.units || []).find((x) => x.id === o.uid); if (u) return { unit: `${u.label.toLowerCase()} of ${u.size}`, per: u.size, price: u.price }; }
    if (kind === 'w') { const kg = o.kg || 0; return { unit: `${kg.toFixed(3)} kg @ ${ghs(pr.price)}/kg`, per: kg, price: o.price ?? Math.round(kg * pr.price * 100) / 100 }; }
    return { unit: 'single', per: 1, price: pr.price };
  };
  /** Add one unit (single, carton, extra unit or weighed amount). quiet: the caller shows the reason itself (scans). */
  const addUnit = (p: Product, kind: 's' | 'c' | 'u' | 'w', o: { uid?: string; kg?: number; price?: number } = {}, quiet = false) => {
    const max = stockAt(p); const u = unitFor(p, kind, o);
    const why = whyNot(p, u.per, u.unit);
    if (why) { if (!quiet) setOos(why); return false; }
    setOos('');
    // Same unit again = same line +1 (single, carton and each weight are kept on separate lines).
    setCart((c) => { const i = c.findIndex((l) => l.pid === p.id && (l.unit || 'single') === u.unit); if (i < 0) return [...c, { pid: p.id, name: p.name, sku: p.sku, price: u.price, cost: Math.round(p.cost * u.per * 100) / 100, qty: 1, max: Math.floor(max / u.per), unit: u.unit, per: u.per }]; const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; });
    // Tapping + (or scanning) just adds the item: no serial pop-up. Serial numbers stay optional and can be added from
    // the sale line ("Add serial number").
    return true;
  };
  /** Add one single or one carton (the card buttons). Weighed goods ask for the weight first. */
  const add = (p: Product, carton = false, quiet = false) => {
    if (p.byWeight && !carton) { setWeigh({ p, kg: '' }); return false; }
    return addUnit(p, carton ? 'c' : 's', {}, quiet);
  };
  const setQty = (l: Line, qty: number) => {
    if (qty > l.qty) { const p = P.find((x) => x.id === l.pid); if (p && stockAt(p) - inCart(l.pid) < (l.per || 1)) return setOos(`No more ${l.name} in stock at ${branch.short}.`); }
    setCart((c) => (qty <= 0 ? c.filter((x) => x !== l) : c.map((x) => (x === l ? { ...x, qty } : x))));
  };
  /**
   * One scan (handheld scanner, camera or a typed barcode + Enter), productscan.md §3.3–3.4:
   * known single → +1 single; known carton (ITF-14) → +1 carton (12 singles); same code again → same line +1;
   * unknown 8–14 digits → "not in the system yet" with Add as new product. The stock rules for a tap apply too.
   * Focus goes back to the search box so the next scan lands there.
   */
  const doScan = (raw: string) => {
    const v = cleanCode(raw);
    if (!v) return;
    // Barcode, carton / extra-unit code, weighing-scale label or GS1-128 carton code (lib/barcode.ts resolveCode).
    const r: Scan | null = resolveCode(tillProducts(P, br), bcMap, raw);
    if (r && scanMode === 'remove') {
      // Remove mode: the scanned item comes off the sale one at a time (the line goes when it reaches 0).
      const u = unitFor(r.p, r.unit, { uid: r.uid, kg: r.kg, price: r.price });
      const line = cart.find((l) => l.pid === r.p.id && (l.unit || 'single') === u.unit) || cart.find((l) => l.pid === r.p.id);
      if (line) { setQty(line, line.qty - 1); setScanMsg({ tone: 'ok', text: `Scanned ${r.code} · removed 1 × ${r.p.name}${line.qty - 1 > 0 ? ` · ${line.qty - 1} left in the sale` : ' · line removed'}` }); }
      else setScanMsg({ tone: 'bad', text: `${r.p.name} is not in this sale, so there is nothing to remove.` });
      setQ(''); window.setTimeout(() => qRef.current?.focus(), 0); return;
    }
    if (r) {
      const p = r.p;
      const kind = r.unit;
      const u = unitFor(p, kind, { uid: r.uid, kg: r.kg, price: r.price });
      const why = expired(r.gs1) ? `${p.name}: this batch${r.gs1?.batch ? ` (${r.gs1.batch})` : ''} expired on ${r.gs1!.expiry}. Do not sell it; report it in Damages.` : whyNot(p, u.per, u.unit);
      if (why) setScanMsg({ tone: 'bad', text: why });
      else { addUnit(p, kind, { uid: r.uid, kg: r.kg, price: r.price }, true); setScanMsg({ tone: 'ok', text: `Scanned ${r.code} · added 1 × ${p.name}${kind === 's' ? '' : ` (${kind === 'w' ? `${r.kg!.toFixed(3)} kg · ${ghs(u.price)}` : u.unit})`}${r.gs1?.batch ? ` · batch ${r.gs1.batch}` : ''}${r.gs1?.expiry ? ` · expires ${r.gs1.expiry}` : ''}` }); }
      setQ('');
    } else if (/^\d{8,14}$/.test(v)) {
      setScanMsg({ tone: 'bad', text: `Barcode ${v} is not in the system yet.`, unknown: v }); setQ('');
    } else setQ(v);
    window.setTimeout(() => qRef.current?.focus(), 0);
  };
  /** Enter / Search in the box: a known barcode scans; otherwise a name search; long unknown digits count as a scan. */
  const search = () => {
    const v = q.trim(); if (!v) { setScanMsg(null); return; }
    const d = cleanCode(v);
    if (bcMap[d] || resolveCode(tillProducts(P, br), bcMap, v)) return doScan(v);
    const m = list.filter((p) => `${p.name} ${p.cat} ${p.sku}`.toLowerCase().includes(v.toLowerCase()));
    if (/^\d{6,}$/.test(d) && !m.length) return doScan(d);
    setScanMsg(m.length ? { tone: 'ok', text: m.length === 1 ? '1 product found · tap Add to put it in the sale' : `${m.length} products found for “${v}”` } : { tone: 'bad', text: `No product matches “${v}”` });
  };
  // Keyboard-wedge scanners when the search box is not focused (e.g. after tapping a button): fast digits ending in
  // Enter, typed outside any text field, are treated as a scan.
  useEffect(() => {
    let buf = ''; let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const now = Date.now(); if (now - last > 80) buf = ''; last = now;
      if (e.key === 'Enter') { if (buf.length >= 6) { e.preventDefault(); doScan(buf); } buf = ''; return; }
      if (/^[0-9A-Za-z]$/.test(e.key)) buf += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Customer
  const hits = cq.trim().length >= 2 ? customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(cq.toLowerCase().trim()) || c.phone.replace(/\D/g, '').includes(cq.replace(/\D/g, '') || '§')).slice(0, 6) : [];
  const dup = isNew && phClean(cust.phone).length === 9 ? customers.find((c) => c.phone.replace(/\D/g, '').endsWith(phClean(cust.phone))) : undefined;
  const owesOf = (c: Customer | null) => (c ? c.credits.reduce((a, x) => a + Math.max(0, x.total - x.paid), 0) : 0);
  const useCustomer = (c: Customer) => { setPicked(c); setIsNew(false); setSaved(true); setCust({ ...custBlank, name: c.name, phone: c.phone, email: c.email }); setCq(''); };
  const startNew = (seed = '') => { setPicked(null); setIsNew(true); setSaved(false); const digits = seed.replace(/\D/g, ''); setCust({ ...custBlank, name: digits.length >= 6 ? '' : seed, phone: digits.length >= 6 ? phClean(digits) : '' }); setCq(''); };
  const phoneOk = phClean(cust.phone).length === 9;
  const emailOk = !cust.email || /^\S+@\S+\.\S+$/.test(cust.email);
  const saveCustomer = () => {
    if (cust.name.trim().length < 2) return setToast('Add the customer name.');
    if (!phoneOk) return setToast('Phone: 9 digits after +233, without the first 0.');
    if (dup) return setToast(`This number belongs to ${dup.name}.`);
    const phone = '+233 ' + phClean(cust.phone);
    const c: Customer = { ...CUSTOMERS[0], id: 'c' + Date.now(), name: cust.name.trim(), phone, email: cust.email || '', group: biz.on ? 'Wholesale' : 'Retail', since: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), tier: 'Bronze', points: 0, limit: 500, br, credits: [], codes: [], gifts: [] };
    setCustomers([c, ...customers]); setPicked(c); setSaved(true); setCust({ ...cust, phone }); setToast(`${c.name} saved as a customer`);
  };
  const custOut = (): Cust | undefined => (cust.name.trim() || phoneOk ? { ...cust, name: cust.name.trim(), phone: phoneOk ? '+233 ' + phClean(cust.phone) : '' } : undefined);

  // Discount
  const applyDisc = () => { const v = Math.min(sub, parseFloat(disc) || 0); if (!(v > 0)) return setToast('Type the discount in GHS.'); setDiscApplied(v); setDiscOk(0); setDiscId(''); if (v > limit) { const id = 'DR-' + Date.now().toString().slice(-5); setDiscReq([{ id, kind: 'discount', till, br, item: cart.map((l) => `${l.qty} × ${l.name}`).join(', '), price: sub, asked: v, by: me.name, byRole: me.level, at: nowTxt(), status: 'pending', note: `Cash discount of ${ghs(v)} on ${ghs(sub)}` }, ...discReq]); setDiscId(id); } };
  const removeDisc = () => { if (discId && myReq?.status === 'pending') setDiscReq(discReq.map((r) => (r.id === discId ? { ...r, status: 'rejected', note: 'Cancelled by the seller' } : r))); setDisc(''); setDiscApplied(0); setDiscId(''); setDiscOk(0); };

  const reset = () => { setCart([]); setCust(custBlank); setPicked(null); setIsNew(false); setSaved(false); setMore(false); setCq(''); setBiz({ on: false, name: '', tin: '' }); setDel({ on: false, when: 'asap', at: '', fee: 20, free: false, note: '', time: '' }); setDisc(''); setDiscApplied(0); setDiscId(''); setDiscOk(0); setCredit(null); setScanMsg(null); setOos(''); };
  const newSale = () => { reset(); setStep('sell'); setDoneSale(null); setDocTab('r'); setSent({}); setWa(''); setWaErr(''); if (SU) setAdminOk(null); };

  // Serial numbers are optional: payment is never held up waiting for them.
  const charge = () => {
    if (!cart.length) return setToast('Scan or tap a product to start the sale.');
    if (needApproval) return setToast('The discount needs approval before you can charge.');
    if (creditMode && (!cust.name.trim() || !phoneOk)) return setToast('A credit sale needs the customer’s name and phone number.');
    if (del.on && !cust.addr) return setToast('Add the home address so the rider can find the customer.');
    setStep('pay');
  };
  const complete = (d: PayDone) => {
    const no = nextNo();
    const c = custOut();
    const s: TillSale = { no, ts: Date.now(), br, till, staff: me.name, username, lines: cart, sub, disc: discAmt, credit: credUse, fee, total, method: d.method, parts: d.parts, change: d.change, cust: c, biz: biz.on ? { name: biz.name.trim(), tin: biz.tin } : undefined, status: 'completed', ref: credit?.ref, adminWhy: SU && adminOk ? [adminOk.why, adminOk.more].filter(Boolean).join(' · ') : undefined, allowedBy: d.allowedBy, deliver: del.on ? del : undefined, code: docCode(), inv: invNo(br), kind: d.kind, paidNow: d.paidNow, balance: d.balance, due: d.due, momoNet: d.momoNet, payRef: d.payRef, cashRecv: d.cashRecv, offline: !online, training: train.on };
    setSales([s, ...sales]);
    // Serial numbers sold on this sale can never be sold again (ecompos.serialsSold); a return releases them.
    if (!train.on) { const sold = readKey<Record<string, { pid: string; name: string; sale: string; br: string; ts: number }>>('ecompos.serialsSold', {}); cart.forEach((l) => (l.serials || []).forEach((sn) => { sold[sn.toUpperCase()] = { pid: l.pid, name: l.name, sale: no, br, ts: Date.now() }; })); writeKey('ecompos.serialsSold', sold); }
    // Paid: take the stock and drop this till's hold in the same step (training sales take no stock).
    if (!train.on) sellStock(no, br, cart.map((l) => ({ name: l.name, qty: l.qty * (l.per || 1) })), tillOwner);
    else setHold(tillOwner, null);
    if (!online) setQueue([...queue, no]);
    if (d.kind === 'credit' && c) {
      const idx = customers.findIndex((x) => x.phone.replace(/\D/g, '').endsWith(phClean(c.phone)));
      const entry = { no, at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), total, paid: d.paidNow || 0, due: d.due || '', by: me.name, appr: SU ? me.name : 'Admin' };
      if (idx >= 0) setCustomers(customers.map((x, i) => (i === idx ? { ...x, credits: [entry, ...x.credits] } : x)));
      else setCustomers([{ ...CUSTOMERS[0], id: 'c' + Date.now(), name: c.name, phone: c.phone, email: c.email || '', group: 'Retail', since: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), tier: 'Bronze', points: 0, limit: 500, br, credits: [entry], codes: [], gifts: [] }, ...customers]);
    }
    if (del.on && c) { const w: WebOrder = { id: no, ch: 'Till', who: c.name, phone: c.phone, items: cart.map((l) => [l.qty, l.name, l.price]), fee, pay: s.method + ' · paid', type: 'D', brId: br, where: [c.addr, c.landmark].filter(Boolean).join(' · ') || 'Address to confirm', landmark: c.landmark, gps: c.gps, placed: nowTxt(), stage: 1, status: 'Active', track: [{ label: `Till sale · deliver ${del.when === 'asap' ? 'as soon as a rider is free' : del.when === 'pick' ? del.at : del.when === 'today' ? `later today ${del.time}` : `tomorrow ${del.time}`}`, at: nowTxt(), by: me.name }], trackId: no }; writeKey('ecompos.webOrders2', [w, ...readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS)]); }
    if (SU) secLog('Admin sale', `Sale ${no} by the Admin at ${till} · ${ghs(total)} · reason: ${s.adminWhy}`, 'medium', username);
    window.dispatchEvent(new CustomEvent('ecompos:sales'));
    setDoneSale(s); setStep('done'); setWa(c?.phone ? phClean(c.phone) : '');
  };
  const parkIt = (name: string, reason: string, note: string) => { setParked([{ id: 'PK-' + Date.now().toString().slice(-5), ts: Date.now(), br, by: me.name, lines: cart, cust: custOut() || (name ? { name, phone: '' } : undefined), note: [reason, note].filter(Boolean).join(' · '), disc: discAmt }, ...parked]); reset(); setPanel(''); setToast('Sale parked · its items stay held until it is resumed or deleted'); };

  const freeRiders = riders.filter((r) => r.br === br && r.state === 'Free').length;
  const openOnline = wo.filter((o) => o.brId === br && o.status === 'Active').length;
  const toConfirm = wo.filter((o) => o.brId === br && o.status === 'Active' && o.type === 'D' && o.stage >= 4).length;
  const pickups = col.filter((c) => c.branch.toLowerCase().startsWith(branch.short.toLowerCase()) && ['ready', 'prep', 'waiting'].includes(c.status)).length;
  const mySalesToday = sales.filter((s) => s.username === username && new Date(s.ts).toDateString() === new Date().toDateString() && s.status === 'completed');
  const myParked = parked.filter((p) => p.br === br).length;
  const ann = notices.filter((n) => n.state === 'Sent' && n.to.includes(role))[0];
  const month = new Date().getMonth(); const day = new Date().getDate();
  const season = month === 11 ? '🎄 Christmas season · extra stock out front' : month === 2 && day <= 8 ? '🇬🇭 Independence Day week' : '';
  const xmas = month === 11 && day === 25;
  const allowSwitch = !creds()[username]?.pinOff;
  const ini = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const deliveryAt = del.when === 'asap' ? 'as soon as a rider is free' : del.when === 'today' ? `later today${del.time ? ` at ${del.time}` : ''}` : del.when === 'tomorrow' ? `tomorrow${del.time ? ` at ${del.time}` : ''}` : del.at ? new Date(del.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'pick a date and time';
  const sendVia = (k: string) => {
    if (!doneSale) return;
    if (k === 'Print') { window.print(); return setSent({ ...sent, Print: 'Printed' }); }
    if ((k === 'WhatsApp' || k === 'SMS') && phClean(wa).length !== 9) return setWaErr("Enter the customer's WhatsApp number first, then tap WhatsApp.");
    if (k === 'Email' && !doneSale.cust?.email) return setWaErr('Add the customer’s email under More details to email the receipt.');
    setWaErr('');
    const text = `${B.name} · receipt ${doneSale.code} · ${ghs(doneSale.total)} · ${doneSale.method}. Thank you!`;
    if (k === 'WhatsApp') window.open(`https://wa.me/233${phClean(wa)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    writeKey('ecompos.outbox', [{ id: 'OB-' + Date.now(), ch: k, to: k === 'Email' ? doneSale.cust?.email : '+233 ' + phClean(wa), text, at: nowTxt(), by: me.name }, ...readKey<unknown[]>('ecompos.outbox', [])]);
    setSent({ ...sent, [k]: 'Sent' });
  };

  const gateOpen = SU && !adminOk && step !== 'done';
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f2f4f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <header className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <span className="w-[38px] h-[38px] rounded-[10px] overflow-hidden flex items-center justify-center flex-none">{logo ? <img src={logo} alt="" className="w-full h-full object-contain" /> : <span className="w-full h-full bg-black text-white text-xs font-bold flex items-center justify-center">{ini(B.name)}</span>}</span>
          <span className="flex flex-col leading-tight min-w-0"><b className="text-[18px] font-semibold truncate">{B.name}</b><span className="text-[11px] text-[#5f5c5a]">Sell Now · <Wordmark className="text-[11px]" /></span></span>
        </Link>
        <span className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center" style={{ background: '#f2f4f5', border: '1px solid #ebebeb' }}>{branch.short} · Till 1</span>
        <span className="flex items-center gap-2 h-11 pl-1 pr-3 rounded-full bg-white border border-[#ebebeb]">
          <span className="w-[30px] h-[30px] rounded-full bg-black text-white text-[11px] font-bold flex items-center justify-center">{ini(me.name)}</span>
          <span className="flex flex-col leading-tight"><span className="text-[13px] font-medium">{me.name} · {me.level}</span><span className="text-[11px] text-[#5f5c5a]">Shift opened {shift}</span></span>
          {allowSwitch && <button onClick={() => { setLockPinOnly(true); setLocked(true); }} className="text-[12px] underline ml-1">Switch user (PIN)</button>}
        </span>
        <div className="ml-auto flex gap-1.5 flex-wrap items-center">
          {season && <span className="h-11 px-3.5 rounded-full text-[13px] inline-flex items-center" style={{ background: '#fff4e5' }}>{season}</span>}
          {ann && <span className="h-11 px-3.5 rounded-full text-[13px] inline-flex items-center max-w-[220px] truncate" style={{ background: '#e7f4e8' }} title={ann.title}>📣 {ann.title}</span>}
          <button onClick={() => setPanel('riders')} className={topPill}><Icon name="bike" size={15} />Riders<span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: '#1f7a2a' }}>{freeRiders}</span></button>
          <button onClick={() => setPanel('online')} className={topPill}>Online orders<span className="min-w-5 h-5 px-1.5 rounded-full bg-black text-white text-[11px] font-bold flex items-center justify-center">{openOnline}</span>{toConfirm > 0 && <span className="h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center" style={{ background: '#1f7a2a' }}>✓ {toConfirm}</span>}</button>
          <button onClick={() => setPanel('pickup')} className={topPill}>Online pickups<span className="min-w-5 h-5 px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center" style={{ background: TEAL }}>{pickups}</span></button>
          <button onClick={() => setManualOff(!manualOff)} aria-pressed={!online} className={topPill}><span className="w-2 h-2 rounded-full" style={{ background: online ? '#1f7a2a' : RED }} />{online ? 'Online' : 'Offline'}</button>
          <button onClick={() => setPanel('mysales')} className={topPill}>My sales<span className="min-w-5 h-5 px-1.5 rounded-full bg-black text-white text-[11px] font-bold flex items-center justify-center">{mySalesToday.length}</span></button>
          <button onClick={() => { setLockPinOnly(false); setLocked(true); }} className={topPill}><Icon name="lock" size={15} />Lock till</button>
          <button onClick={() => setPanel('close')} className={topPill}>Close shift</button>
          <button onClick={signOut} className="h-11 px-4 rounded-full text-white text-[13px] font-semibold" style={{ background: RED }}>Log out</button>
        </div>
      </header>
      {!online && <div role="status" className="mx-4 mb-2 rounded-2xl px-4 py-2.5 text-sm text-white" style={{ background: '#332f2d' }}>Offline. The internet is down or the till is set to offline. Keep selling: cash, MoMo to merchant (0244 000 111), cash + MoMo and credit sales all work. Receipts print as normal. {queue.length} sale{queue.length === 1 ? '' : 's'} queued on this till and will sync automatically when the connection is back.</div>}
      {syncing && <div role="status" className="mx-4 mb-2 rounded-2xl px-4 py-2.5 text-sm text-white" style={{ background: '#1f7a2a' }}>Back online · syncing {queue.length} queued sale{queue.length === 1 ? '' : 's'} and E-VAT receipts…</div>}
      {SU && adminOk && <div className="mx-4 mb-2 w-fit rounded-full bg-black text-white text-[13px] px-4 py-2">Exceptional sale by the Admin · Reason: {[adminOk.why, adminOk.more].filter(Boolean).join(' · ')} · logged in the audit trail</div>}
      {train.on && <div className="mx-4 mb-2 w-fit rounded-full text-white text-[12px] font-bold px-4 py-1.5" style={{ background: RED }}>TRAINING MODE · practice data only, not for real sales</div>}

      <div className="flex-1 grid gap-4 px-4 pb-4 lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_620px] 2xl:grid-cols-[1fr_720px] items-start">
        {/* Products */}
        <section className="flex flex-col gap-3 min-w-0">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[260px] flex items-center gap-2 h-[50px] pl-4 pr-1.5 rounded-full bg-white border border-[rgba(0,0,0,0.1)] focus-within:border-brand">
              <Icon name="search" size={18} className="text-muted flex-none" />
              {/* The scan target: a USB / Bluetooth scanner types the code and presses Enter here. Escape clears. */}
              <label htmlFor="pos-q" className="sr-only">Search or scan</label>
              <input ref={qRef} id="pos-q" type="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setScanMsg(null); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); search(); } else if (e.key === 'Escape') { setQ(''); setScanMsg(null); } }} placeholder="Search products or scan a barcode" className="flex-1 min-w-0 outline-none bg-transparent text-[15px] [&::-webkit-search-cancel-button]:hidden" autoFocus />
              {q && <button onClick={() => { setQ(''); qRef.current?.focus(); }} aria-label="Clear the search" className="w-7 h-7 rounded-full bg-[#e5e5e5] text-[#5f5c5a] flex items-center justify-center text-sm">×</button>}
              <button onClick={search} aria-label="Search" className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-none"><Icon name="search" size={16} /></button>
              {/* Scan icon: opens the camera on a tablet / phone; on a computer it readies the box for the barcode scanner. */}
              <button onClick={() => { if (scanWay === 'camera') setCam(!cam); else { setCam(false); qRef.current?.focus(); setScanMsg({ tone: 'ok', text: 'Barcode scanner ready · scan the product now (USB or Bluetooth scanner).' }); } }} aria-label={scanWay === 'camera' ? 'Scan barcodes with the camera' : 'Get ready to scan with the barcode scanner'} aria-expanded={scanWay === 'camera' ? cam : undefined} className="w-10 h-10 rounded-full text-white flex items-center justify-center flex-none" style={{ background: TEAL, boxShadow: SHADOW }}><Icon name="barcode" size={17} /></button>
            </div>
            {/* Scan adds / Scan removes: what the next scans do (USB or Bluetooth scanner, or the camera icon). */}
            <div role="group" aria-label="What a scan does" className="flex items-center h-[50px] p-1 rounded-full bg-white border border-[rgba(0,0,0,0.1)]">
              {([['add', '+ Scan adds'], ['remove', '− Scan removes']] as const).map(([k, l]) => <button key={k} onClick={() => { setScanMode(k); setScanMsg({ tone: 'ok', text: k === 'add' ? 'Scans now add items to the sale.' : 'Scans now remove items from the sale. Switch back to “Scan adds” when done.' }); qRef.current?.focus(); }} aria-pressed={scanMode === k} className={cx('h-full px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap', scanMode === k ? (k === 'remove' ? 'bg-[#c62828] text-white' : 'bg-black text-white') : 'text-[#3d3a38]')}>{l}</button>)}
            </div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="h-[50px] px-4 rounded-full bg-white border border-black text-[15px]">
              <option value="All">All categories · {list.length}</option>
              {cats.map((c) => <option key={c} value={c}>{c} · {list.filter((p) => p.cat === c).length}</option>)}
            </select>
          </div>
          {/* How this till scans (camera on tablets / phones, barcode scanner on computers); changeable per device. */}
          <ScanWaySwitch onChange={(w) => { if (w === 'scanner') setCam(false); }} />
          {/* Camera scanner card: stays on and adds every product it reads to the sale (Remove mode takes one off). */}
          {cam && <div className="rounded-[24px] bg-white p-4 flex gap-4 flex-wrap items-start">
            <BarcodeCamera continuous onRead={doScan} height={150} className="w-[240px] flex-none" caption="Scan item after item" />
            <div className="flex-1 min-w-[220px] flex flex-col gap-2"><b>Camera scanner · {scanMode === 'remove' ? 'removing items' : 'adding items'}</b><span className="text-sm text-[#5f5c5a]">Point the camera at each product’s barcode. Every item it reads goes straight into the sale; the camera stays on until you close it.</span>
              <button onClick={() => setCam(false)} className="h-9 px-4 rounded-full text-white text-[13px] font-semibold w-fit" style={{ background: RED }}>Close</button>
            </div>
          </div>}
          {scanMsg && <div role="status" className="rounded-[18px] bg-white px-4 py-3 text-sm flex items-center gap-3 flex-wrap" style={{ border: `2px solid ${scanMsg.tone === 'ok' ? '#1f7a2a' : scanMsg.tone === 'bad' ? RED : '#b26a00'}` }}><span className="flex-1">{scanMsg.text}</span>{scanMsg.unknown && <Link to={`/products?barcode=${encodeURIComponent(scanMsg.unknown)}`} className="h-9 px-4 rounded-full bg-black text-white text-[13px] font-semibold inline-flex items-center">Add as new product</Link>}<button onClick={() => setScanMsg(null)} aria-label="Dismiss" className="text-lg">×</button></div>}
          {oos && <div role="alert" className="rounded-[18px] px-4 py-3 text-sm flex items-center gap-3" style={{ background: '#fbeaea', border: `1px solid ${RED}`, color: '#7d1a1a' }}><span className="flex-1">{oos}</span><button onClick={() => setOos('')} aria-label="Dismiss" className="text-lg">×</button></div>}
          {q && <div className="flex items-center gap-3 text-sm"><span>{shown.length} product{shown.length === 1 ? '' : 's'} match “{q}”</span><button onClick={() => { setQ(''); setCat('All'); }} className="h-8 px-3.5 rounded-full border border-black text-[13px]">Show all products</button></div>}
          {!shown.length && <div className="rounded-[20px] border-2 border-dashed border-[#d9d9d9] p-6 text-center text-sm text-[#5f5c5a]">No products match your search. Check the spelling, try part of the name, or scan the barcode.</div>}
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => {
              // free = what this till may sell; n = what is left after this sale's own items (shown on the card).
              // gone = nothing left even before this sale (greyed out as sold out); n = 0 with items in the sale just stops adding.
              const free = stockAt(p); const inSale = inCart(p.id); const n = Math.max(0, free - inSale); const gone = free <= 0; const out = n <= 0;
              const isNewP = p.isNew || p.sold30 < 5; const cartonOk = !!p.carton && n >= perCarton(p);
              const pr = priced(p); const low = isLowAt(p, n); const top = best.has(p.name);
              // Corner badges, most important first; at most 3 so they fit the small photo.
              const badges = ([pr.was && [`-${pr.off}%`, RED, 'On sale'], top && ['★ Best seller', '#b8860b', 'One of the 5 best sellers here in the last 30 days'], low && !out && ['Low stock', '#b26a00', `Only ${n} left · reorder level ${p.reorder || 10}`], isNewP && !out && ['New', '#0b5c5c', 'New product']].filter(Boolean) as [string, string, string][]).slice(0, 3);
              return (
              <article key={p.id} className="bg-white flex flex-col gap-1 p-1.5" style={{ borderRadius: 16, border: `1px solid ${gone ? '#cccccc' : '#000'}`, opacity: gone ? 0.68 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="relative overflow-hidden" style={{ aspectRatio: '2 / 1', borderRadius: 10, background: isArt(p.img) ? ART_BG : '#f2f4f5' }}>
                  {/* Drawn illustrations are shown whole (contain) on their own background; photos fill the box. */}
                  {p.img ? <img src={p.img} alt="" className={cx('w-full h-full', isArt(p.img) ? 'object-contain' : 'object-cover')} /> : <span className="absolute inset-0 flex items-center justify-center text-[#9a9794]"><Icon name="products" size={20} /></span>}
                  {/* Product info: the same description the online store shows (lib/describe.ts). */}
                  <button onClick={() => setInfo(p)} aria-label={`About ${p.name}`} title="Product info" className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full bg-white/90 border border-black/10 text-[11px] font-bold italic font-serif flex items-center justify-center hover:bg-white">i</button>
                  {badges.length > 0 && <span className="absolute left-1.5 top-1.5 flex flex-col items-start gap-0.5">{badges.map(([t, bg, why]) => <span key={t} title={why} className="text-[9px] font-bold px-1.5 py-px rounded-full text-white whitespace-nowrap" style={{ background: bg }}>{t}</span>)}</span>}
                  <span className="absolute left-1.5 right-1.5 bottom-1 flex justify-end 2xl:justify-between items-end gap-1 text-[10px] leading-tight">{inSale ? <span /> : <span className="hidden 2xl:inline text-[#5f5c5a] bg-white/80 rounded px-1 truncate min-w-0">{p.cat}</span>}<span className="bg-white/85 rounded px-1 text-right flex-none max-w-[72%]" style={{ color: out ? RED : low ? '#b26a00' : '#3d3a38', fontWeight: out ? 700 : 500 }}>{gone ? 'Out of stock' : out ? '0 left' : low ? `${qtyTxt(p, n)} left` : `${qtyTxt(p, n)} in stock`}{inSale ? ` · ${qtyTxt(p, inSale)} in sale` : ''}</span></span>
                </div>
                <span className="text-[12px] font-medium leading-tight line-clamp-2" style={gone ? { textDecoration: 'line-through', color: '#9a9794' } : undefined} title={p.name}>{p.name}</span>
                {/* On sale: normal price crossed out, sale price beside it in red. */}
                {pr.was
                  ? <span className="flex items-baseline gap-1.5 flex-wrap"><s className="text-[11px] text-[#9a9794]" aria-label={`Was ${ghs(pr.was)}`}>{ghs(pr.was)}</s><b className="text-[12px] font-semibold whitespace-nowrap" style={{ color: RED }} aria-label={`Now ${ghs(pr.price)}`}>{ghs(pr.price)}</b></span>
                  : <b className="text-[12px] font-semibold whitespace-nowrap">{ghs(p.price)}{p.byWeight ? ' / kg' : ''}</b>}
                <div className="flex items-center gap-1.5 mt-auto">
                  <span className="flex-1 min-w-0 flex">
                    {gone ? <span className="w-fit text-[9px] font-bold text-white px-1.5 py-px rounded-full" style={{ background: RED }}>OUT OF STOCK</span>
                      : p.carton && <button onClick={() => add(p, true)} disabled={!cartonOk} title={`Add a ${cartonTxt(p)} · ${ghs(pr.ctPrice || p.carton)}${pr.ctWas ? ` (was ${ghs(pr.ctWas)})` : ''}`} className={cx('w-fit max-w-full truncate h-[22px] px-1.5 rounded-full border text-[10px] font-medium', cartonOk ? 'bg-white border-black' : 'bg-[#f2f2f2] border-[#e0e0e0] text-[#9a9794]')}>{ctName(p)} ({perCarton(p)})</button>}
                  </span>
                  <button onClick={() => add(p)} disabled={out} aria-label={out ? (gone ? `${p.name} is sold out` : `No more ${p.name} left to add`) : `Add ${p.name}`} title={out ? (gone ? 'Sold out' : 'All the rest is already in this sale') : 'Add to the sale'} className={cx('w-7 h-7 flex-none rounded-full flex items-center justify-center ml-auto', out ? 'bg-[#e5e5e5] text-[#9a9794]' : 'bg-black text-white hover:bg-[#333]')}><Icon name="plus" size={15} /></button>
                </div>
              </article>
            ); })}
          </div>
        </section>

        {/* Current sale */}
        <aside aria-label="Current sale" className="bg-white flex flex-col lg:sticky lg:top-3" style={{ borderRadius: 28, padding: 22, gap: 16, boxShadow: 'rgba(0,0,0,0.1) 0 4px 6px -1px' }}>
          {step === 'sell' && <>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="m-0 text-[20px] font-medium flex-1 whitespace-nowrap" style={{ letterSpacing: '-0.05em' }}>{creditMode ? 'Credit Sale' : 'Sale'} #{saleNo}</h2>
              <button onClick={() => setPanel('return')} className="h-9 px-3.5 rounded-full border border-[#d9d9d9] bg-white text-[13px]">Return / exchange</button>
              <button onClick={() => setPanel('parked')} className={cx('h-9 px-3.5 rounded-full border text-[13px] inline-flex items-center gap-1', myParked ? 'bg-[#fff4e5] border-[#b26a00] text-[#8a4b00] font-semibold' : 'bg-white border-[#d9d9d9]')}>⏸ Parked sales · {myParked}</button>
            </div>

            <div className="p-3.5 flex flex-col gap-2" style={{ background: '#f2f4f5', borderRadius: 16 }}>
              <span className="text-[13px] font-semibold text-[#3d3a38]">Selling to</span>
              <div role="radiogroup" aria-label="Selling to" className="flex gap-2">{([[false, 'Individual'], [true, 'Business']] as const).map(([v, l]) => <button key={l} role="radio" aria-checked={biz.on === v} onClick={() => setBiz({ ...biz, on: v })} className={cx('h-10 px-4 rounded-full border text-sm font-medium', biz.on === v ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{l}</button>)}</div>
              <span className="text-xs text-[#5f5c5a]">{biz.on ? 'VAT 15%, NHIL 2.5% and GETFund 2.5% are added' : 'No VAT, NHIL or GETFund'}</span>
              {biz.on && <div className="grid grid-cols-2 gap-2"><label className="flex flex-col gap-1 text-xs font-semibold text-[#3d3a38]">Business name<input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} placeholder="e.g. Mensah Traders Ltd" className="h-10 rounded-full border border-[#d9d9d9] bg-white px-3.5 text-sm font-normal text-black" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-[#3d3a38]">TIN (optional)<input value={biz.tin} onChange={(e) => setBiz({ ...biz, tin: e.target.value.toUpperCase() })} placeholder="e.g. C0001234567" className="h-10 rounded-full border border-[#d9d9d9] bg-white px-3.5 text-sm font-normal text-black uppercase" /></label></div>}
            </div>

            {/* Customer */}
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#3d3a38]">Customer · find a previous customer or add a new one ({creditMode ? 'required for credit' : 'optional'})</span>
              {!picked && !isNew && <>
                <div className="flex gap-2"><span className="flex-1 flex items-center gap-2 h-11 px-3.5 rounded-full border border-[#d9d9d9]"><Icon name="search" size={15} /><input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Find a previous customer · name or phone" aria-label="Find a previous customer" className="flex-1 min-w-0 outline-none text-sm" /></span><button onClick={() => startNew()} className="h-11 px-3.5 rounded-full border border-black bg-white text-[13px] font-medium whitespace-nowrap">+ New customer</button></div>
                {hits.length > 0 && <div className="bg-white border border-[#ebebeb] flex flex-col overflow-hidden" style={{ borderRadius: 14 }}>{hits.map((c) => <button key={c.id} onClick={() => useCustomer(c)} className="flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f2f4f5] border-b border-[#f2f2f2] last:border-0"><span className="flex-1 min-w-0 flex flex-col"><b className="text-sm font-medium">{c.name}</b><span className="text-xs text-[#5f5c5a]">{c.phone}{owesOf(c) ? ` · owes ${ghs(owesOf(c))}` : ''}</span></span><span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f2f4f5]">{c.group} · {c.tier}</span></button>)}</div>}
                {cq.trim().length >= 2 && !hits.length && <div className="text-sm flex items-center gap-2 flex-wrap"><span>No previous customer matches “{cq}”.</span><button onClick={() => startNew(cq)} className="h-8 px-3 rounded-full bg-black text-white text-[12px] font-semibold">Add as a new customer</button></div>}
              </>}
              {picked && saved && !isNew && <div className="rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-sm" style={{ background: '#e8f5e9' }}><span className="flex-1"><b>Returning customer</b> · {picked.name} · {picked.phone}{owesOf(picked) ? ` · owes ${ghs(owesOf(picked))}` : ''}</span><button onClick={() => { setPicked(null); setCust(custBlank); setSaved(false); }} className="h-8 px-3 rounded-full bg-white border border-[#d9d9d9] text-[12px]">Change</button></div>}
              {picked && saved && !isNew && <TillPanel phone={picked.phone} onNewCustomer={() => startNew()} />}
              {isNew && <div className="rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-sm flex-wrap" style={{ background: '#e3f0fb', color: '#0b4f8a' }}><span className="flex-1"><b>New customer</b>{saved ? ' · saved' : ' · not saved yet'}</span>{!saved && <button onClick={saveCustomer} className="h-8 px-3 rounded-full bg-white text-black border border-[#d9d9d9] text-[12px] font-semibold">Save customer now</button>}<button onClick={() => { setIsNew(false); setCust(custBlank); setSaved(false); setPicked(null); }} className="h-8 px-3 rounded-full bg-white text-black border border-[#d9d9d9] text-[12px]">Change</button></div>}
              {dup && <div className="rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-sm" style={{ background: '#fff4e5', color: '#8a4b00' }}><span className="flex-1">This number belongs to {dup.name}.</span><button onClick={() => useCustomer(dup)} className="h-8 px-3 rounded-full bg-black text-white text-[12px] font-semibold">Use {dup.name.split(' ')[0]}</button></div>}
              {(isNew || picked) && <div className="grid gap-2">
                <input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder="Customer name" aria-label="Customer name" className="h-11 rounded-full border border-[#d9d9d9] px-4 text-sm" />
                <label className="flex flex-col gap-1"><span className="flex items-center h-11 rounded-full border border-[#d9d9d9] px-4 gap-2"><b className="text-sm">+233</b><input inputMode="numeric" value={phClean(cust.phone)} onChange={(e) => setCust({ ...cust, phone: e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 9) })} placeholder="24 555 0142" aria-label="Customer phone" className="flex-1 min-w-0 outline-none text-sm" /></span><span className="text-xs text-[#5f5c5a]">9 digits after +233, without the first 0</span>{cust.phone && !phoneOk && <span className="text-xs" style={{ color: RED }}>The number needs 9 digits after +233.</span>}</label>
                {cust.name.trim() && phoneOk && <span className="text-xs font-semibold" style={{ color: '#1f7a2a' }}>✓ {cust.name.trim()} · +233 {phClean(cust.phone)} · goes on the receipt</span>}
              </div>}
              {(isNew || picked) && <button onClick={() => setMore(!more)} aria-expanded={more} className="h-10 rounded-full border border-dashed border-[#9a9794] text-[13px] text-[#3d3a38]">{more ? '− Fewer details' : '+ More details'}</button>}
              {more && (isNew || picked) && <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#3d3a38]">Email (optional · for the receipt and delivery updates)<input type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} className="h-10 rounded-full border border-[#d9d9d9] px-3.5 text-sm font-normal text-black" />{cust.email && <span className="font-normal" style={{ color: emailOk ? '#1f7a2a' : RED }}>{emailOk ? '✓ Email looks right' : 'Check the email address'}</span>}</label>
                <input value={cust.addr} onChange={(e) => setCust({ ...cust, addr: e.target.value })} placeholder="House no., street, area, town" aria-label="Home address" className="h-10 rounded-full border border-[#d9d9d9] px-3.5 text-sm" />
                <div className="grid grid-cols-2 gap-2"><input value={cust.landmark} onChange={(e) => setCust({ ...cust, landmark: e.target.value })} placeholder="e.g. Blue gate near the pharmacy" aria-label="Landmark" className="h-10 rounded-full border border-[#d9d9d9] px-3.5 text-sm" /><input value={cust.gps} onChange={(e) => setCust({ ...cust, gps: e.target.value.toUpperCase() })} placeholder="GA-123-4567" aria-label="GhanaPostGPS" className="h-10 rounded-full border border-[#d9d9d9] px-3.5 text-sm" /></div>
                <button role="switch" aria-checked={del.on} onClick={() => setDel({ ...del, on: !del.on })} className="flex items-center gap-3 text-left p-3 rounded-2xl bg-[#f2f4f5]"><span className="w-10 h-6 rounded-full p-0.5 flex-none" style={{ background: del.on ? '#1f7a2a' : '#cfcfcf' }}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', del.on && 'translate-x-4')} /></span><span className="flex flex-col text-sm"><b>Deliver to this address</b><span className="text-xs text-[#5f5c5a]">After payment, send the sale to a rider with these details filled in</span></span></button>
                {del.on && <div className="flex flex-col gap-2 p-3 rounded-2xl border border-[#ebebeb]">
                  <span className="text-xs font-semibold text-[#3d3a38]">When to deliver</span>
                  <div className="flex gap-1.5 flex-wrap">{([['asap', 'As soon as a rider is free'], ['today', 'Later today'], ['tomorrow', 'Tomorrow'], ['pick', 'Pick a date and time']] as const).map(([k, l]) => <button key={k} aria-pressed={del.when === k} onClick={() => setDel({ ...del, when: k })} className={cx('h-9 px-3 rounded-full border text-[12px]', del.when === k ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{l}</button>)}</div>
                  {(del.when === 'today' || del.when === 'tomorrow') && <div className="flex gap-1.5 flex-wrap">{TIMES.map((t) => <button key={t} aria-pressed={del.time === t} onClick={() => setDel({ ...del, time: t })} className={cx('h-8 px-3 rounded-full border text-[12px]', del.time === t ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{t}</button>)}</div>}
                  {del.when === 'pick' && <input type="datetime-local" value={del.at} onChange={(e) => setDel({ ...del, at: e.target.value })} aria-label="Delivery date and time" className="h-10 rounded-full border border-[#d9d9d9] px-3.5 text-sm" />}
                  <span className="text-xs text-[#5f5c5a]">Deliver {deliveryAt}</span>
                  <input value={del.note} onChange={(e) => setDel({ ...del, note: e.target.value })} placeholder="Note for the rider (optional)" aria-label="Note for the rider" className="h-10 rounded-full border border-[#d9d9d9] px-3.5 text-sm" />
                  <span className="text-xs font-semibold text-[#3d3a38]">Delivery fee</span>
                  <div className="flex gap-1.5 items-center flex-wrap">{([[false, 'Charge a fee'], [true, 'Free delivery']] as const).map(([v, l]) => <button key={l} aria-pressed={del.free === v} onClick={() => setDel({ ...del, free: v })} className={cx('h-9 px-3 rounded-full border text-[12px]', del.free === v ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{l}</button>)}{!del.free && <span className="flex items-center h-9 rounded-full border border-[#d9d9d9] px-3 gap-1.5"><b className="text-[12px]">GHS</b><input inputMode="decimal" value={del.fee} onChange={(e) => setDel({ ...del, fee: parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0 })} aria-label="Delivery fee in GHS" className="w-16 outline-none text-sm" /></span>}</div>
                  <span className="text-xs text-[#5f5c5a]">{del.free ? 'No fee is charged · the delivery still goes to a rider.' : 'Osu, Cantonments and Labone: GHS 20 · free on orders over GHS 600.'}</span>
                  {!cust.addr && <span className="text-xs" style={{ color: RED }}>Add the home address so the rider can find the customer.</span>}
                </div>}
              </div>}
            </div>

            {/* Cart */}
            <div className="flex flex-col gap-2.5">
              {!cart.length && <div className="rounded-2xl bg-[#f2f4f5] p-5 text-center text-sm text-[#5f5c5a]">Scan or tap a product to start the sale.</div>}
              {cart.map((l) => <div key={l.pid + (l.unit || '')} className="flex items-center gap-2"><span className="flex-1 min-w-0 flex flex-col"><span className="text-sm font-medium truncate">{l.name}</span><span className="text-xs text-[#5f5c5a]">{l.unit || 'single'} · {ghs(l.price)}</span>{l.serials?.length ? <span className="text-xs text-[#5f5c5a]">SN {l.serials.join(', ')}</span> : null}{P.find((x) => x.id === l.pid)?.track === 'serial' && (l.serials?.length || 0) < l.qty * (l.per || 1) && <button onClick={() => setSerialFor({ pid: l.pid, unit: l.unit || 'single' })} className="text-xs text-[#5f5c5a] underline w-fit">Add serial number (optional)</button>}</span><button onClick={() => setQty(l, l.qty - 1)} aria-label={`One less ${l.name}`} className="w-9 h-9 rounded-full border border-[#d9d9d9] text-lg">−</button><span className="w-6 text-center text-sm font-semibold">{l.qty}</span><button onClick={() => setQty(l, l.qty + 1)} aria-label={`One more ${l.name}`} className="w-9 h-9 rounded-full border border-[#d9d9d9] text-lg">+</button><b className="w-20 text-right text-sm font-medium">{ghs(l.qty * l.price)}</b></div>)}
            </div>

            {cart.length > 0 && <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#3d3a38]">Discount (cash)</span>
              <div className="flex gap-2"><span className="flex-1 flex items-center h-11 rounded-full border px-4 gap-2" style={{ borderColor: discApplied > 0 && !needApproval ? '#1f7a2a' : '#d9d9d9', background: discApplied > 0 && !needApproval ? '#e7f4e8' : undefined }}><b className="text-sm">GHS</b><input inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" aria-label="Discount in GHS" className="flex-1 min-w-0 outline-none text-sm" /></span><button onClick={applyDisc} className="h-11 px-4 rounded-full bg-black text-white text-sm font-semibold">Apply</button>{discApplied > 0 && <button onClick={removeDisc} className="h-11 px-4 rounded-full border border-[#d9d9d9] text-sm">Remove</button>}</div>
              <span className={cx('text-xs', discApplied > 0 && !needApproval ? 'font-semibold' : 'text-[#5f5c5a]')} style={discApplied > 0 && !needApproval ? { color: '#1f7a2a' } : undefined}>{discApplied > 0 && !needApproval ? `✓ ${ghs(discAmt)} discount deducted from this sale` : `You can give up to ${limit === Infinity ? 'any amount' : ghs(limit)} without approval. Above that, a Manager or the Admin must approve it.`}</span>
              {needApproval && discId && <div className="bg-black text-white p-4 flex flex-col gap-2" style={{ borderRadius: 18 }}>
                <div className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full flex items-center justify-center font-bold flex-none" style={{ background: RED }}>!</span><span className="flex flex-col text-sm"><b>Approval needed · sale on hold</b><span className="text-white/80">{ghs(discAmt)} off {ghs(sub)} is above your limit of {ghs(limit)}.</span><span style={{ color: '#f2b705' }}>{myReq?.status === 'pending' ? `Waiting for ${role === 'staff' || role === 'supervisor' ? 'a Manager or the Admin' : 'the Admin'} to review it on their account · ${discId}` : 'Request sent'}</span></span></div>
                <button onClick={removeDisc} className="h-10 rounded-full text-white text-sm font-semibold" style={{ background: RED }}>Cancel request · continue sale</button>
                <span className="text-[11px] text-white/70">The sale cannot be charged until this discount is approved. Approval is given only from the Manager or Admin account, not at the till, so it is always recorded against the person who gave it.</span>
              </div>}
            </div>}

            <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              <dt>Subtotal</dt><dd className="m-0 text-right">{ghs(sub)}</dd>
              {discAmt > 0 && !needApproval ? <><dt className="font-semibold" style={{ color: '#1f7a2a' }}>Discount · deducted</dt><dd className="m-0 text-right font-semibold" style={{ color: '#1f7a2a' }}>− {ghs(discAmt)}</dd></> : discAmt > 0 ? <><dt style={{ color: '#b26a00' }}>Discount · awaiting approval</dt><dd className="m-0 text-right" style={{ color: '#b26a00' }}>− {ghs(discAmt)}</dd></> : <><dt>Discount</dt><dd className="m-0 text-right">− {ghs(discAmt)}</dd></>}
              {credit && <><dt style={{ color: '#1f7a2a' }}>Exchange credit · {credit.ref}</dt><dd className="m-0 text-right" style={{ color: '#1f7a2a' }}>− {ghs(credUse)}</dd></>}
              {del.on && <><dt>Delivery fee</dt><dd className="m-0 text-right">{del.free ? 'Free' : ghs(fee)}</dd></>}
              {biz.on ? <><dt>VAT 15% · business</dt><dd className="m-0 text-right">{ghs(tx.vat)}</dd><dt>NHIL 2.5% · GETFund 2.5%</dt><dd className="m-0 text-right">{ghs(tx.nhil + tx.getf)}</dd></> : <><dt className="text-[#5f5c5a]">No VAT, NHIL or GETFund · individual</dt><dd className="m-0 text-right text-[#5f5c5a]">GHS 0.00</dd></>}
              <dt className="text-[18px] pt-1">Total</dt><dd className="m-0 text-right text-[22px] font-medium">{ghs(total)}</dd>
            </dl>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button onClick={() => cart.length ? setPanel('park') : setToast('Add products before parking a sale.')} className="h-[52px] px-5 rounded-full bg-white border border-[#d9d9d9] text-[15px] font-medium">Park sale</button>
              <button onClick={charge} disabled={!cart.length || onHold} className="h-[52px] rounded-full text-white text-base font-medium disabled:opacity-50" style={{ background: TEAL, boxShadow: SHADOW }}>{onHold ? 'Approval needed' : `Charge ${ghs(total)}`}</button>
            </div>
          </>}

          {step === 'pay' && <Pay total={total} cust={custOut() || null} online={online} me={me} role={role} username={username} SU={SU} br={br} till={till} owes={owesOf(picked)} payAllow={payAllow[username]} creditFirst={creditMode} onBack={() => setStep('sell')} onDone={complete} onHP={() => nav('/hirepurchase')} onIntro={() => setIntro(true)} />}

          {step === 'done' && doneSale && <div className="flex flex-col gap-3">
            {xmas && <div aria-hidden className="pointer-events-none fixed inset-0 z-[700] overflow-hidden">{Array.from({ length: 14 }, (_, i) => <span key={i} className="absolute text-3xl" style={{ left: `${(i * 7) % 100}%`, bottom: -40, animation: `balloon ${4 + (i % 4)}s ease-in ${i * 0.2}s forwards` }}>🎈</span>)}<style>{'@keyframes balloon{to{transform:translateY(-120vh)}}'}</style></div>}
            <div className="flex items-center gap-2 flex-wrap"><h2 className="m-0 text-[20px] font-medium flex-1 whitespace-nowrap">Paid · {doneSale.method.split(' · ')[0]}</h2><button onClick={newSale} className="h-10 px-4 rounded-full text-white text-sm font-semibold inline-flex items-center gap-1.5" style={{ background: TEAL }}><span className="text-base">+</span> New sale</button><button onClick={() => setPanel('riders')} className="h-10 px-4 rounded-full bg-white text-sm font-medium inline-flex items-center gap-1.5" style={{ border: '1.5px solid #000' }}><Icon name="bike" size={15} />Deliver with rider</button></div>
            {doneSale.training && <span className="w-fit rounded-full text-white text-[11px] font-bold px-3 py-1" style={{ background: RED }}>TRAINING MODE · practice data only, not for real sales</span>}
            <div role="tablist" className="flex gap-1 p-1 rounded-full bg-[#f2f4f5] w-fit">{([['r', 'Receipt · 80 mm'], ['i', 'Sales invoice · A4']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={docTab === k} onClick={() => setDocTab(k)} className={cx('h-9 px-4 rounded-full text-[13px]', docTab === k ? 'bg-white font-semibold shadow-sm' : 'text-[#5f5c5a]')}>{l}</button>)}</div>
            {docTab === 'r' ? <TillReceipt s={doneSale} /> : <SalesInvoice s={doneSale} />}
            <div className="flex gap-2"><button onClick={() => { setDocTab('r'); setTimeout(() => window.print(), 50); }} className="flex-1 h-11 rounded-full bg-white border border-black text-sm font-semibold">Print receipt</button><button onClick={() => { setDocTab('i'); setTimeout(() => window.print(), 50); }} className="flex-1 h-11 rounded-full bg-black text-white text-sm font-semibold">Print invoice</button></div>
            {/* PDF copies of this sale's receipt and invoice (lib/docPdfs.ts), to save, attach or send. */}
            <div className="flex gap-2">{([['receipt', 'Receipt PDF'], ['invoice', 'Invoice PDF']] as const).map(([k, l]) => <button key={k} onClick={() => { void downloadPdf(tillSaleDoc(doneSale, companyBiz(bizInfo(), logo), k, branch.short), `${k}-${doneSale.code || doneSale.no}`); }} className="flex-1 h-11 rounded-full bg-white border border-[#d9d9d9] text-sm font-semibold">⬇ {l}</button>)}</div>
            <span className="text-[13px] font-semibold text-[#3d3a38]">Send receipt</span>
            <div className="grid grid-cols-4 gap-2">{['Print', 'WhatsApp', 'SMS', 'Email'].map((k) => <button key={k} onClick={() => sendVia(k)} className={cx('h-11 rounded-full border text-[13px] font-medium', sent[k] ? 'bg-[#e7f4e8] border-[#1f7a2a] text-[#1f7a2a]' : 'bg-white border-[#d9d9d9]')}>{sent[k] ? `✓ ${sent[k]}` : k}</button>)}</div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#3d3a38]">WhatsApp number<span className="flex items-center h-11 rounded-full border border-[#d9d9d9] px-4 gap-2"><b className="text-sm text-black">+233</b><input inputMode="numeric" value={wa} onChange={(e) => { setWa(e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 9)); setWaErr(''); }} placeholder="24 555 0142" className="flex-1 min-w-0 outline-none text-sm font-normal text-black" /></span></label>
            {waErr && <span role="alert" className="text-xs" style={{ color: '#b26a00' }}>{waErr}</span>}
            {doneSale.deliver && <div className="rounded-2xl p-3 text-sm" style={{ background: '#e7f4e8', color: '#1f7a2a' }}>🏠 Deliver to {doneSale.cust?.name} · {[doneSale.cust?.addr, doneSale.cust?.landmark, doneSale.cust?.gps].filter(Boolean).join(' · ')} · {doneSale.cust?.phone}. Tap below to pick a rider; the details are filled in.</div>}
          </div>}
        </aside>
      </div>

      {/* Admin gate */}
      {gateOpen && !locked && <div className="fixed inset-0 z-[450] bg-black/60 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="ag-h" className="bg-white w-full max-w-md p-6 flex flex-col gap-3" style={{ border: '2px solid #000', borderRadius: 24 }}>
          <h2 id="ag-h" className="m-0 text-xl font-semibold">You're signed in as the Admin</h2>
          <p className="m-0 text-sm text-[#5f5c5a]">The Admin sells only in exceptional cases. Choose why you are selling. The reason goes on the receipt and into the audit trail.</p>
          <div className="flex gap-1.5 flex-wrap">{ADMIN_WHY.map((w) => <button key={w} aria-pressed={gate.why === w} onClick={() => setGate({ ...gate, why: w })} className={cx('h-9 px-3.5 rounded-full border text-[13px]', gate.why === w ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{w}</button>)}</div>
          <input value={gate.more} onChange={(e) => setGate({ ...gate, more: e.target.value })} placeholder="More detail (optional)" aria-label="More detail (optional)" className="h-11 rounded-full border border-[#d9d9d9] px-4 text-sm" />
          <div className="flex gap-2 flex-wrap"><button disabled={!gate.why} onClick={() => { setAdminOk({ ...gate }); secLog('Admin till unlock', `Admin unlocked ${till} for one sale · ${gate.why}${gate.more ? ` · ${gate.more}` : ''}`, 'medium', username); setGate({ why: '', more: '' }); }} className="h-11 px-5 rounded-full text-white text-sm font-semibold disabled:opacity-40" style={{ background: TEAL }}>Unlock till for this sale</button><button onClick={() => nav('/')} className="h-11 px-5 rounded-full border border-[#d9d9d9] text-sm">Back to Home</button></div>
        </div>
      </div>}

      {intro && <Intro d={CREDIT_INTRO} user={username} onBack={() => { setIntro(false); if (step === 'sell' && !cart.length) nav('/sell'); }} onGo={() => setIntro(false)} />}
      {panel === 'park' && <ParkDialog defName={cust.name} onPark={parkIt} onClose={() => setPanel('')} />}
      {info && <ProductInfo p={info} desc={shownDesc(info, W.desc[info.id]?.desc || '', B.name)} price={priced(info)} stock={Math.max(0, stockAt(info) - inCart(info.id))} onAdd={() => { add(info); setInfo(null); }} onClose={() => setInfo(null)} />}
      {weigh && <WeighPrompt p={weigh.p} kg={weigh.kg} setKg={(kg) => setWeigh({ ...weigh, kg })} price={priced(weigh.p).price} onAdd={(kg) => { if (addUnit(weigh.p, 'w', { kg })) setWeigh(null); }} err={oos} onClose={() => { setWeigh(null); setOos(''); }} />}
      {serialFor && <SerialPrompt line={cart.find((l) => l.pid === serialFor.pid && (l.unit || 'single') === serialFor.unit)} product={P.find((x) => x.id === serialFor.pid)} cart={cart} onSave={(sns) => { setCart((c) => c.map((l) => (l.pid === serialFor.pid && (l.unit || 'single') === serialFor.unit ? { ...l, serials: sns } : l))); setSerialFor(null); window.setTimeout(() => qRef.current?.focus(), 0); }} onClose={() => { setSerialFor(null); window.setTimeout(() => qRef.current?.focus(), 0); }} />}
      {panel === 'parked' && <ParkedPanel br={br} me={me.name} role={role} onResume={(p) => { /* take it off the parked list here too: the panel closes before its own save runs, and a parked sale left behind would hold its stock twice */ setParked((L) => L.filter((x) => x.id !== p.id)); setCart(p.lines); if (p.cust) { setCust({ ...custBlank, ...p.cust, phone: p.cust.phone ? phClean(p.cust.phone) : '' }); setIsNew(true); setSaved(!!p.cust.phone); } if (p.disc) { setDisc(String(p.disc)); setDiscApplied(p.disc); setDiscOk(p.disc); } setStep('sell'); setPanel(''); setToast('Parked sale resumed'); }} onClose={() => setPanel('')} />}
      {panel === 'return' && <ReturnPanel br={br} staff={me.name} onCredit={(amt, ref) => { setCredit({ amt, ref }); setToast(`${ghs(amt)} exchange credit added · add the replacement items`); }} onClose={() => setPanel('')} />}
      {panel === 'online' && <OnlinePanel br={br} me={me.name} onClose={() => setPanel('')} />}
      {panel === 'pickup' && <PickupPanel br={br} me={me.name} onClose={() => setPanel('')} />}
      {panel === 'riders' && <RidersPanel br={br} me={me.name} sale={doneSale && doneSale.deliver ? doneSale : null} onClose={() => setPanel('')} />}
      {panel === 'mysales' && <MySalesPanel name={me.name} sales={mySalesToday} onClose={() => setPanel('')} />}
      {panel === 'close' && <ClosePanel br={br} me={me.name} username={username} onClosed={() => { signOut(); nav('/'); }} onClose={() => setPanel('')} />}
      {locked && <LockScreen me={me.name} username={username} till={till} pinOnly={lockPinOnly} onUnlock={() => setLocked(false)} onClose={() => { setLocked(false); setPanel('close'); }} onLogout={signOut} />}
      <Toast msg={toast} onClose={() => setToast('')} />
    </div>
  );
}

/**
 * "Scan serial number" for a serial-tracked product (productscan.md §2.4): one serial per unit on the line, typed,
 * from a handheld scanner, or read with the camera. A serial cannot be used twice in the sale or sold again; if serials
 * were scanned when the stock was received, the serial must be one of them.
 */
function SerialPrompt({ line, product, cart, onSave, onClose }: { line?: Line; product?: Product; cart: Line[]; onSave: (sns: string[]) => void; onClose: () => void }) {
  const need = line ? line.qty * (line.per || 1) : 0;
  const [sns, setSns] = useState<string[]>(line?.serials || []);
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [cam, setCam] = useState(false);
  if (!line || !product) return null;
  const take = (raw: string) => {
    const sn = String(raw || '').trim().toUpperCase();
    if (!sn) return setErr('Scan or type the serial number printed on the unit.');
    const sold = readKey<Record<string, { sale: string }>>('ecompos.serialsSold', {});
    if (sold[sn]) return setErr(`Serial ${sn} was already sold (sale ${sold[sn].sale}). Check the unit.`);
    if (sns.includes(sn) || cart.some((l) => l !== line && (l.serials || []).includes(sn))) return setErr(`Serial ${sn} is already in this sale.`);
    if (product.serials?.length && !product.serials.map((x) => x.toUpperCase()).includes(sn)) return setErr(`Serial ${sn} was not received into stock for ${product.name}.`);
    setErr(''); setV(''); setCam(false);
    setSns((x) => [...x, sn].slice(0, need));
  };
  return (
    <div className="fixed inset-0 z-[450] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="sn-h" onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white p-6 flex flex-col gap-3" style={{ borderRadius: 24 }}>
        <div className="flex justify-between items-center gap-2"><h2 id="sn-h" className="m-0 text-lg font-semibold">Scan serial number</h2><button onClick={onClose} className="h-9 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#c62828' }}>Close</button></div>
        <span className="text-sm text-[#5f5c5a]">{product.name} · {sns.length} of {need} scanned. Each unit sold needs its serial number on the sale and the receipt.</span>
        {cam ? <BarcodeCamera onRead={take} height={180} /> : null}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); take(v); }}>
          <label htmlFor="sn-in" className="sr-only">Serial number</label>
          <input id="sn-in" autoFocus value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} placeholder="Scan now" autoComplete="off" className="flex-1 min-w-0 h-12 px-4 rounded-2xl border-2 border-black text-[16px] tracking-[0.08em] uppercase outline-none" disabled={sns.length >= need} />
          <button type="button" onClick={() => setCam(!cam)} aria-label="Scan the serial with the camera" className="w-12 h-12 rounded-full text-white flex items-center justify-center flex-none" style={{ background: '#0b5c5c' }}><Icon name="barcode" size={18} /></button>
        </form>
        {err && <span role="alert" className="text-sm text-[#c62828]">{err}</span>}
        {sns.length > 0 && <div className="flex gap-1.5 flex-wrap">{sns.map((sn) => <span key={sn} className="h-8 pl-3 pr-1 rounded-full bg-[#f2f4f5] text-[13px] inline-flex items-center gap-1">SN {sn}<button onClick={() => setSns((x) => x.filter((y) => y !== sn))} aria-label={`Remove serial ${sn}`} className="w-6 h-6 rounded-full hover:bg-black/10">×</button></span>)}</div>}
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="h-11 px-5 rounded-full border border-[#d9d9d9] text-sm">Later</button><button onClick={() => onSave(sns)} disabled={!sns.length} className="h-11 px-5 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40">Save {sns.length} serial{sns.length === 1 ? '' : 's'}</button></div>
      </section>
    </div>
  );
}

/**
 * Weight prompt for goods sold by weight (loose rice, gari) when there is no scale label to scan: type the weight
 * shown on the scale in kg; the price is the price per kg × weight. Scanning the scale's label skips this.
 * Inputs: the product, the typed weight, the price per kg, onAdd(kg), the stock message and onClose.
 */
/**
 * Sell Now product info: photo, price (sale price shown), what is left to sell at this branch and the product's
 * description, exactly as the online store shows it, so staff can answer customers' questions at the till.
 * Inputs: the product, its description, its price now, units free to sell, and Add / Close actions.
 */
function ProductInfo({ p, desc, price, stock, onAdd, onClose }: { p: Product; desc: string; price: { price: number; was?: number }; stock: number; onAdd: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center p-4 pt-16" style={{ background: 'rgba(0,0,0,.45)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="pi-h" onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] max-h-[82vh] bg-white rounded-[28px] flex flex-col overflow-hidden">
        <div className="p-5 flex gap-4 items-start border-b border-[#eee]">
          <span className="w-20 h-20 rounded-2xl flex-none overflow-hidden bg-[#f2f4f5] flex items-center justify-center">{p.img ? <img src={p.img} alt="" className="w-full h-full object-cover" /> : <Icon name="products" size={26} />}</span>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5"><span className="text-xs text-[#5f5c5a]">{p.cat} · {p.sku}</span><h2 id="pi-h" className="m-0 text-lg font-semibold leading-tight">{p.name}</h2>
            <span className="text-sm">{price.was ? <><s className="text-[#9a9794] mr-1.5">{ghs(price.was)}</s><b style={{ color: RED }}>{ghs(price.price)}</b></> : <b>{ghs(price.price)}{p.byWeight ? ' / kg' : ''}</b>}{p.carton ? <span className="text-[#5f5c5a]"> · {cartonTxt(p)} {ghs(p.carton)}</span> : null}</span>
            <span className={cx('text-xs font-semibold', stock <= 0 ? 'text-[#c62828]' : stock <= 10 ? 'text-[#b26a00]' : 'text-[#1f7a2a]')}>{stock <= 0 ? 'Out of stock at this branch' : `${stock} left to sell at this branch`}</span></div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-[#f2f4f5] text-xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto"><ProductDesc text={desc} dense /></div>
        <div className="p-4 border-t border-[#eee] flex gap-2 justify-end"><button onClick={onClose} className="h-11 px-5 rounded-full border border-[#d9d9d9] font-semibold text-sm">Close</button><button onClick={onAdd} disabled={stock <= 0} className="h-11 px-5 rounded-full bg-black text-white font-semibold text-sm disabled:opacity-40">Add to the sale</button></div>
      </div>
    </div>
  );
}

function WeighPrompt({ p, kg, setKg, price, onAdd, err, onClose }: { p: Product; kg: string; setKg: (v: string) => void; price: number; onAdd: (kg: number) => void; err: string; onClose: () => void }) {
  const n = Math.round((parseFloat(kg) || 0) * 1000) / 1000;
  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center p-4 pt-24" style={{ background: 'rgba(0,0,0,.45)' }} onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="wg-h" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (n > 0) onAdd(n); }} className="w-full max-w-[400px] bg-white rounded-[28px] p-6 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2"><h2 id="wg-h" className="m-0 text-lg font-semibold">Weigh {p.name}</h2><button type="button" onClick={onClose} className="h-9 px-4 rounded-full text-white text-sm font-semibold" style={{ background: RED }}>Close</button></div>
        <span className="text-sm text-[#5f5c5a]">Put the bag on the scale and type the weight, or scan the label the scale prints. {ghs(price)} per kg.</span>
        <label className="flex flex-col gap-1 text-xs font-semibold">Weight (kg)<input autoFocus inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 1.250" className="h-14 px-4 rounded-2xl border-2 border-black font-normal text-[18px] tracking-[0.04em] outline-none" /></label>
        <span className="text-sm">{n > 0 ? <>Price <b>{ghs(Math.round(n * price * 100) / 100)}</b> for {n.toFixed(3)} kg</> : 'Type the weight to see the price.'}</span>
        {err && <span role="alert" className="text-sm text-[#c62828]">{err}</span>}
        <button type="submit" disabled={!(n > 0)} className="h-12 rounded-full bg-black text-white font-semibold disabled:opacity-40">Add to the sale</button>
      </form>
    </div>
  );
}
