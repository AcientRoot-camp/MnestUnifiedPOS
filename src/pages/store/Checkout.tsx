import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cx } from '../../lib/format';
import { freeNow, setHold } from '../../lib/stock';
import { useShop } from './ctx';
import { Svg } from './Shell';
import { downloadShopDoc, emailConfirmationOnce } from './docs';
import { BIZ, BR_INFO, brInfo, codeCheck, money, netOf, newCode, newNo, nowStr, phClean, phErr, phFmt, phOk, pushToStaff, type Fulfil, type ShopOrder } from './model';

const STEPN = ['Basket', 'Delivery or pickup', 'Your details', 'Payment', 'Review'];
const PAYSET: Record<Fulfil, [string, string, string][]> = {
  D: [['momo', 'Mobile Money', 'MTN, Telecel, AirtelTigo · prompt on your phone'], ['ghpay', 'GhPay', 'Pay from your GhanaPay wallet or any bank app'], ['paystack', 'Paystack', 'Card, MoMo or bank · secure'], ['bank', 'Bank transfer / USSD', 'Confirmed automatically'], ['cod', 'Pay on delivery', 'Cash or MoMo to the rider']],
  P: [['momo', 'Mobile Money', 'MTN, Telecel, AirtelTigo · prompt on your phone'], ['ghpay', 'GhPay', 'Pay from your GhanaPay wallet or any bank app'], ['paystack', 'Paystack', 'Card, MoMo or bank · secure'], ['counter', 'Pay at the counter', 'Cash or MoMo when you collect · with your code']],
  I: [['momo', 'Mobile Money', 'Approve on your phone at the till'], ['cash', 'Cash', 'Pay at the till'], ['hp', 'Hire purchase', 'Deposit today, pay monthly · in store only']],
};
const HPT = [3, 6, 9, 12];
const pad = (n: number) => String(n).padStart(2, '0');
const isoD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoDT = (d: Date) => `${isoD(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtD = (v: string) => { const d = new Date(v + 'T00:00:00'); return isNaN(+d) ? v : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
const fmtDT = (v: string) => { const d = new Date(v); return isNaN(+d) ? v : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const mkRef = (p: string) => p + '_' + Math.random().toString(36).slice(2, 10).toUpperCase();
const pill = (on: boolean) => cx('px-4 py-3 rounded-2xl border text-left flex flex-col gap-0.5', on ? 'bg-black text-white border-black' : 'border-line bg-white hover:border-black');
const inp = 'w-full h-11 px-4 rounded-full border border-line text-sm';

function Phone({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string, raw: string) => void }) {
  const [raw, setRaw] = useState(value);
  const e = phErr(raw);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="flex items-center h-11 rounded-full border border-line overflow-hidden"><span className="px-3 text-sm text-muted border-r border-line h-full flex items-center bg-canvas">+233</span><input id={id} inputMode="numeric" autoComplete="tel-national" maxLength={12} aria-describedby={`${id}-err`} value={raw} onChange={(ev) => { setRaw(ev.target.value); onChange(phClean(ev.target.value), ev.target.value); }} placeholder="24 555 0142" className="flex-1 min-w-0 px-3 outline-none text-sm" /></div>
      {e && <span id={`${id}-err`} role="alert" className="text-xs text-danger">{e}</span>}
      <span className="text-xs text-muted">9 digits after +233, without the first 0</span>
    </div>
  );
}

export function Checkout() {
  const s = useShop();
  const { W, up, me, lines, sub, setCart, setWish, go, say, setOrders, upMe, bump, holdOwner } = s;
  const [step, setStep] = useState(1);
  const [ful, setFul] = useState<Fulfil>('D');
  const defAddr = me?.addr.find((a) => a.def) ?? me?.addr[0];
  const [addrSel, setAddrSel] = useState<string>(defAddr?.id ?? 'new');
  const zones = W.zones.filter((z) => z.on && z.name);
  const [area, setArea] = useState(0);
  const [co, setCo] = useState({ street: '', land: '', gps: '', name: me?.name ?? '', phone: me?.phone ?? '', email: me?.email ?? '', note: '', momo: me?.phone ?? '', ghpay: me?.phone ?? '', hpDep: '' });
  const set = (k: keyof typeof co, v: string) => { setCo((c) => ({ ...c, [k]: v })); setErr(''); };
  const NOW = new Date();
  const DMIN = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 3), DMAX = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 60);
  const PMIN = (() => { const d = new Date(Math.ceil((NOW.getTime() + 36e5) / 9e5) * 9e5); if (d.getHours() < 8) d.setHours(8, 0, 0, 0); else if (d.getHours() >= 20) { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); } return d; })();
  const PMAX = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 14, 20, 0);
  const [delDate, setDelDate] = useState(isoD(DMIN));
  const [br, setBr] = useState(0);
  const [pickDT, setPickDT] = useState(isoDT(PMIN));
  const [visit, setVisit] = useState(isoD(NOW));
  const [consent, setConsent] = useState(true);
  const [pay, setPay] = useState('momo');
  const [net, setNet] = useState('MTN');
  const [momoSt, setMomoSt] = useState<'' | 'wait' | 'ok'>('');
  const [ghSt, setGhSt] = useState<'' | 'wait' | 'ok'>('');
  const [ps, setPs] = useState<'' | 'choose' | 'busy' | 'done'>('');
  const [psM, setPsM] = useState('Card');
  const [paid, setPaid] = useState<{ via: string; amt: number; ref: string } | null>(null);
  const [hpTerm, setHpTerm] = useState(6);
  const [codeVal, setCodeVal] = useState('');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [err, setErr] = useState('');
  const [cxSt, setCxSt] = useState<'' | 'ask'>('');
  const [cxMsg, setCxMsg] = useState('');
  const tmr = useRef<number>();
  useEffect(() => () => window.clearTimeout(tmr.current), []);
  useEffect(() => { if (me) setCo((c) => ({ ...c, name: c.name || me.name, phone: c.phone || me.phone, email: c.email || me.email, momo: c.momo || me.phone, ghpay: c.ghpay || me.phone })); }, [me]);

  const free = W.freeOn && W.freeOver > 0 && sub >= W.freeOver;
  const zone = zones[Math.min(area, zones.length - 1)] ?? { name: 'Delivery', fee: 0, eta: '' };
  const fee = ful === 'D' ? (free ? 0 : zone.fee) : ful === 'P' ? W.collect : 0;
  const CODE = code ? codeCheck(W.codes, code, sub, fee, co.phone) : null;
  const disc = CODE && !CODE.err ? CODE.amt : 0;
  const total = Math.max(0, sub - disc + fee);
  const payKeys = PAYSET[ful].map((p) => p[0]);
  const PAY = payKeys.includes(pay) ? pay : payKeys[0];
  const payName = PAYSET[ful].find((p) => p[0] === PAY)![1];
  const online = (PAY === 'momo' && ful !== 'I') || PAY === 'paystack' || PAY === 'ghpay';
  const paidNow = !!paid && online && paid.via === PAY && Math.abs(paid.amt - total) < 0.005;
  const locked = !!paid && Math.abs(paid.amt - total) < 0.005;
  const NET = netOf(co.momo) || net;
  const addrs = me?.addr ?? [];
  const newAddr = !addrs.length || addrSel === 'new';
  const selAddr = addrs.find((a) => a.id === addrSel);
  const B = BR_INFO[br] ?? BR_INFO[0];
  const hpDep = parseFloat(co.hpDep);
  const depOk = !isNaN(hpDep) && hpDep >= total * 0.1 && hpDep < total;
  const hpBal = Math.max(0, total - (isNaN(hpDep) ? 0 : hpDep));
  const hpMonthly = (hpBal + hpBal * 0.03 * hpTerm) / hpTerm;
  const nearest = /kumasi|adum|ahodwo|asokwa/i.test(zone.name) ? 'adum' : /legon|shiashie|adjiringanor/i.test(zone.name) ? 'legon' : 'osu';
  // Stock check at the branch that will fulfil the order (lib/stock.ts), not counting this basket's own hold.
  // need = units wanted per product; short(br) = the first product that branch cannot supply in full (or null).
  const need: Record<string, { n: number; name: string }> = {};
  lines.forEach((l) => { const u = l.unit === 'c' ? l.qty * (l.p.ct?.size || 12) : l.qty; need[l.pid] = { n: (need[l.pid]?.n || 0) + u, name: l.p.name }; });
  const short = (brId: string) => { for (const [pid, w] of Object.entries(need)) { const f = freeNow(pid, brId, holdOwner); if (f < w.n) return { ...w, free: f }; } return null; };
  // Delivery is packed at the nearest branch, or the next branch that can supply the whole basket.
  const shipBr = ful === 'D' ? (!short(nearest) ? nearest : BR_INFO.map((b) => b.id).find((id) => !short(id)) ?? nearest) : B.id;
  const where = ful === 'D' ? `${newAddr ? [co.street, co.land].filter(Boolean).join(', ') || 'New address' : `${selAddr!.label} · ${selAddr!.street}, ${selAddr!.area}`} · ${zone.name}` : `${ful === 'P' ? 'Click & collect at' : 'Buy in store at'} ${B.name}`;
  const when = ful === 'D' ? `Delivery on ${fmtD(delDate)}` : ful === 'P' ? fmtDT(pickDT) : fmtD(visit);
  const routeNote = ful === 'D' ? `Packed at our ${brInfo(shipBr).name} branch and delivered by a rider to ${zone.name} on ${fmtD(delDate)}.` : `Sent straight to the ${B.name} ${ful === 'P' ? 'counter' : 'till'} · ${when}.`;
  const payLine = payName + (PAY === 'momo' && ful !== 'I' ? ` · ${NET} ${phFmt(co.momo)}` : PAY === 'ghpay' ? ` · ${phFmt(co.ghpay)}` : PAY === 'counter' ? ' · with your collection code' : PAY === 'hp' ? ` · deposit ${money(isNaN(hpDep) ? 0 : hpDep)} + ${hpTerm} × ${money(hpMonthly)}` : '') + (paidNow ? ` · paid, ref ${paid!.ref}` : '');

  const validate = (k: number): string => {
    if (k === 1 && !lines.length) return 'Your basket is empty.';
    if (k === 1 && CODE?.err) return CODE.err;
    if (k === 2 && ful === 'D' && newAddr && !co.street.trim() && !co.land.trim()) return 'Add your street or a landmark so the rider can find you.';
    if (k === 2 && ful === 'D' && (delDate < isoD(DMIN) || delDate > isoD(DMAX))) return `Pick a delivery date from ${fmtD(isoD(DMIN))}.`;
    if (k === 2 && ful === 'P') { const d = new Date(pickDT); if (isNaN(+d) || d < PMIN || d > PMAX) return `Pick a collection time from ${fmtDT(isoDT(PMIN))}.`; if (d.getHours() < 8 || d.getHours() >= 20) return 'Collection is during shop hours, 8:00 to 20:00.'; }
    if (k === 2) { const sh = short(shipBr); if (sh) return sh.free <= 0 ? `Sorry, ${sh.name} has just sold out at ${brInfo(shipBr).name}. Remove it from your basket${ful !== 'D' ? ' or choose another branch' : ''}.` : `Only ${sh.free} ${sh.name} left at ${brInfo(shipBr).name}. Lower the quantity to ${sh.free}${ful !== 'D' ? ' or choose another branch' : ''}.`; }
    if (k === 3 && co.name.trim().length < 2) return 'Add your full name.';
    if (k === 3 && !phOk(co.phone)) return 'Add a phone number: 9 digits after +233, without the first 0.';
    if (k === 3 && co.email && !/^\S+@\S+\.\S+$/.test(co.email)) return 'That email address does not look right.';
    if (k === 4 && online && !paidNow) return PAY === 'momo' ? 'Send the MoMo prompt and approve it on your phone first.' : PAY === 'ghpay' ? 'Send the GhPay request and approve it first.' : 'Pay with Paystack first.';
    if (k === 4 && PAY === 'momo' && ful === 'I' && !phOk(co.momo)) return 'Add the MoMo number you will pay from at the till.';
    if (k === 4 && PAY === 'hp' && !depOk) return `The deposit must be at least ${money(total * 0.1)} (10%) and less than the total.`;
    return '';
  };
  const next = () => {
    if (step < 5) { const e = validate(step); if (e) return setErr(e); setErr(''); setStep(step + 1); window.scrollTo(0, 0); return; }
    for (let k = 1; k <= 4; k++) { const e = validate(k); if (e) { setErr(e); setStep(k); return; } }
    place();
  };
  const goStep = (k: number) => { if (k === step) return; if (locked && k >= 2 && k <= 4) return; if (k > step) { for (let i = step; i < k; i++) { const e = validate(i); if (e) { setErr(e); setStep(i); return; } } } setErr(''); setStep(k); };

  const advance = (via: string, ref: string) => { setPaid({ via, amt: total, ref }); setStep(5); setErr(''); window.scrollTo(0, 0); };
  const sendPrompt = () => { if (!phOk(co.momo)) return setErr('Enter your MoMo number: 9 digits after +233, without the first 0.'); setErr(''); setMomoSt('wait'); window.clearTimeout(tmr.current); tmr.current = window.setTimeout(() => { setMomoSt('ok'); advance('momo', mkRef('MOMO')); }, 4500); };
  const ghSend = () => { if (!phOk(co.ghpay)) return setErr('Enter your GhPay number: 9 digits after +233.'); setErr(''); setGhSt('wait'); window.clearTimeout(tmr.current); tmr.current = window.setTimeout(() => { setGhSt('ok'); advance('ghpay', mkRef('GHP')); }, 4500); };
  const psPay = () => { setPs('busy'); window.setTimeout(() => { setPs('done'); const ref = mkRef('PSK'); window.setTimeout(() => { setPs(''); advance('paystack', ref); }, 1100); }, 1600); };

  const buildOrder = (no: string, cancelled = false): ShopOrder => ({
    no, code: ful !== 'D' ? newCode() : undefined, at: nowStr(), ts: Date.now(), fulfil: ful, brId: shipBr, where, when,
    name: co.name.trim() || me?.name || 'Guest', phone: co.phone, email: co.email, note: co.note,
    lines: lines.map((l) => ({ pid: l.pid, name: l.p.name, sku: l.p.sku, unit: l.unitName, qty: l.qty, each: l.each })),
    sub, disc, codeTxt: CODE && !CODE.err ? `${CODE.c!.code} · ${CODE.label}` : undefined, fee, total, pay: payLine, payKey: PAY, paid: paidNow, payRef: paidNow ? paid!.ref : undefined,
    hp: PAY === 'hp' ? `${hpTerm} months · deposit ${money(hpDep)} · ${money(hpMonthly)} a month` : undefined, user: me?.email, status: cancelled ? 'Cancelled' : undefined,
  });
  const place = () => {
    const no = newNo();
    const o = buildOrder(no);
    setOrders((O) => ({ ...O, [no]: o }));
    pushToStaff(o);
    // The order has taken the stock, so this basket's hold is let go in the same step (never counted twice).
    setHold(holdOwner, null);
    if (CODE && !CODE.err && CODE.c) up({ codes: W.codes.map((c) => (c.code === CODE.c!.code ? { ...c, used: c.used + 1, uses: [...(c.uses || []), phClean(co.phone)] } : c)) });
    if (me) upMe((u) => ({ cart: [], orders: [no, ...u.orders], inbox: o.code ? [{ id: 'm' + Date.now(), title: `Order ${no} received`, body: `We have your order. Show this code at the ${brInfo(o.brId).short} ${ful === 'P' ? 'counter' : 'till'} when you come.`, from: `${brInfo(o.brId).short} branch · ${o.at}`, code: o.code, no, read: false, at: o.at }, ...u.inbox] : u.inbox }));
    else setCart(() => []);
    go(`done/${no}`);
  };
  const cancelCheckout = () => {
    const no = newNo();
    const o = buildOrder(no, true);
    setOrders((O) => ({ ...O, [no]: o }));
    pushToStaff(o, true, paidNow ? 'Customer cancelled at checkout after paying · refund due' : 'Customer cancelled at checkout');
    if (me) upMe((u) => ({ cart: [], orders: [no, ...u.orders] })); else setCart(() => []);
    setCxSt(''); setStep(1); setPaid(null); setMomoSt(''); setGhSt(''); setCode(''); setCodeVal('');
    setCxMsg(`Order ${no} cancelled.${paidNow ? ` Your ${money(total)} will be refunded to ${payName} within 24 hours.` : ''} Nothing else will be charged.`);
    say('Order cancelled');
  };
  const applyCode = () => { if (code) { setCode(''); setCodeVal(''); setCodeErr(''); return; } const r = codeCheck(W.codes, codeVal, sub, fee, co.phone); if (r.err) return setCodeErr(r.err); setCodeErr(''); setCode(codeVal.trim().toUpperCase()); };

  const codeBox = (id: string) => (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2"><label htmlFor={id} className="sr-only">Discount code</label><input id={id} placeholder="Discount code" value={code || codeVal} onChange={(e) => { setCodeVal(e.target.value.toUpperCase()); setCodeErr(''); }} readOnly={!!code || locked} autoComplete="off" className={cx(inp, 'uppercase tracking-wider')} /><button onClick={applyCode} disabled={locked} className="h-11 px-4 rounded-full border border-black text-sm font-semibold whitespace-nowrap disabled:opacity-40">{code ? 'Remove' : 'Apply'}</button></div>
      {(codeErr || CODE?.err) && <span role="alert" className="text-xs text-danger">{codeErr || CODE?.err}</span>}
      {CODE && !CODE.err && <span role="status" className="text-xs text-ok font-semibold">✓ {CODE.c!.code} applied · {CODE.label}{CODE.amt ? ` · you save ${money(CODE.amt)}` : ''}</span>}
    </div>
  );
  // ± on a basket line: shared with the basket everywhere (store ctx bump), so + stops when nothing more is free.
  const setQty = (pid: string, unit: string, d: number) => bump(pid, unit, d);
  const nextLabel = step === 1 ? 'Continue to delivery' : step === 2 ? 'Continue to your details' : step === 3 ? 'Continue to payment' : step === 4 ? (online && !paidNow ? 'Pay first to continue' : 'Review your order') : `Place order · ${money(total)}`;
  const guestBox = (t: string) => !me && <div className="rounded-2xl bg-canvas p-4 flex items-center justify-between gap-3 flex-wrap"><span className="text-sm">{t}</span><button onClick={() => { s.setAuthAfter('checkout'); s.setAuth('in'); }} className="h-10 px-4 rounded-full bg-black text-white text-sm font-semibold">Sign in</button></div>;

  return (
    <main className="px-[var(--gut)] py-8 flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap"><h1 className="m-0 text-[32px] font-semibold tracking-tight">Checkout</h1><span className="text-sm text-muted">Step {step} of 5 · {STEPN[step - 1]}</span></div>
      <nav aria-label="Checkout progress" className="flex flex-col gap-3">
        <div className="h-1.5 rounded-full bg-canvas overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${((step - 1) / 4) * 100}%` }} /></div>
        <ol className="m-0 p-0 list-none grid grid-cols-5 gap-1">{STEPN.map((n, i) => { const k = i + 1; const lk = locked && k >= 2 && k <= 4; return <li key={n} className="flex flex-col items-center gap-1 text-center"><button onClick={() => goStep(k)} disabled={lk} aria-current={k === step ? 'step' : undefined} aria-label={`Step ${k}: ${n}${k < step ? ', done' : ''}${lk ? ', locked after payment' : ''}`} className={cx('w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center', k < step ? 'bg-ok text-white' : k === step ? 'bg-black text-white' : 'bg-canvas text-muted', lk && 'opacity-50')}>{k < step ? '✓' : k}</button><span className={cx('text-[11px] sm:text-xs', k === step ? 'font-semibold' : 'text-muted')}>{n}</span></li>; })}</ol>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {step === 1 && (
            <section aria-labelledby="s1-h" className="flex flex-col gap-4">
              <h2 id="s1-h" className="m-0 text-xl font-semibold">Your basket</h2>
              {!lines.length && <p className="m-0 text-muted">Your basket is empty.</p>}
              <ul className="m-0 p-0 list-none flex flex-col gap-3">{lines.map((l) => (
                <li key={l.pid + l.unit} className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                  <div className="flex justify-between gap-3"><span className="font-medium">{l.p.name} <span className="text-sm text-muted">({l.unitName})</span></span><strong>{money(l.total)}</strong></div>
                  <div className="flex justify-between items-center gap-3 flex-wrap">
                    <div role="group" aria-label={`Quantity of ${l.p.name}`} className="flex items-center rounded-full border border-line"><button onClick={() => setQty(l.pid, l.unit, -1)} aria-label={`One less ${l.p.name}`} className="w-10 h-10 text-lg">−</button><span aria-live="polite" className="w-8 text-center font-semibold">{l.qty}</span><button onClick={() => setQty(l.pid, l.unit, 1)} aria-label={`One more ${l.p.name}`} className="w-10 h-10 text-lg">+</button></div>
                    <div className="flex gap-3"><button onClick={() => { setWish((W2) => Array.from(new Set([...W2, l.pid]))); setQty(l.pid, l.unit, -l.qty); say('Moved to your wishlist', 3000); }} aria-label={`Move ${l.p.name} to wishlist`} className="text-sm flex items-center gap-1.5"><Svg d="heart" size={15} />Move to wishlist</button><button onClick={() => setQty(l.pid, l.unit, -l.qty)} aria-label={`Remove ${l.p.name} from basket`} className="text-sm flex items-center gap-1.5 text-danger"><Svg d="trash" size={15} />Remove</button></div>
                  </div>
                </li>
              ))}</ul>
              <div className="flex gap-2 flex-wrap">{lines.length > 1 && <button onClick={() => setCart(() => [])} className="h-10 px-4 rounded-full border border-line text-sm font-semibold">Empty basket</button>}{!lines.length && <button onClick={() => go('')} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Continue shopping</button>}</div>
              <div className="lg:hidden">{codeBox('co-code-m')}</div>
              {guestBox('Checking out as a guest. Sign in to use saved addresses and track orders.')}
            </section>
          )}
          {step === 2 && (
            <section aria-labelledby="s2-h" className="flex flex-col gap-4">
              <h2 id="s2-h" className="m-0 text-xl font-semibold">How would you like to get it?</h2>
              <div role="group" aria-label="Fulfilment" className="grid gap-2 sm:grid-cols-3">
                {([['D', 'Delivery', zones.some((z) => /same/i.test(z.eta)) ? 'Same day in Accra and Kumasi' : 'Delivered to your door'], ['P', 'Click & collect', `Ready in about 1 hour · ${W.collect > 0 ? money(W.collect) : 'free'}`], ['I', 'Buy in store', 'Pay at the till · hire purchase available']] as [Fulfil, string, string][]).map(([k, l, n]) => <button key={k} onClick={() => setFul(k)} aria-pressed={ful === k} className={pill(ful === k)}><span className="font-semibold">{l}</span><span className="text-xs opacity-80">{n}</span></button>)}
              </div>
              {ful === 'D' && (
                <div className="flex flex-col gap-4">
                  {addrs.length > 0 && <div className="flex flex-col gap-2"><span className="text-sm font-semibold">Deliver to a saved address</span><div className="grid gap-2 sm:grid-cols-2">{[...addrs.map((a) => [a.id, a.label + (a.def ? ' · default' : ''), `${a.street}, ${a.area}`]), ['new', '+ A new address', 'Type it below']].map(([id, l, n]) => <button key={id} onClick={() => setAddrSel(id)} aria-pressed={addrSel === id} className={pill(addrSel === id)}><span className="font-semibold text-sm">{l}</span><span className="text-xs opacity-80">{n}</span></button>)}</div></div>}
                  <div className="flex flex-col gap-2"><span className="text-sm font-semibold">Delivery area</span><div role="group" aria-label="Delivery area" className="flex gap-2 flex-wrap">{zones.map((z, k) => <button key={z.name} onClick={() => setArea(k)} aria-pressed={area === k} className={cx('text-sm px-4 py-2 rounded-full border', area === k ? 'bg-black text-white border-black' : 'border-line')}>{z.name} · {free ? 'free' : z.fee > 0 ? money(z.fee) : 'free'}{z.eta ? ` · ${z.eta}` : ''}</button>)}</div>{free && <span className="text-xs text-ok font-semibold">🎉 Free delivery · your order is over {money(W.freeOver)}</span>}{W.collectNote && <span className="text-xs text-muted">{W.collectNote}</span>}</div>
                  {newAddr && <div className="grid gap-3 sm:grid-cols-3"><div className="flex flex-col gap-1"><label htmlFor="co-street" className="text-sm font-semibold">House number and street</label><input id="co-street" value={co.street} onChange={(e) => set('street', e.target.value)} placeholder="14 Ring Road East" autoComplete="street-address" className={inp} /></div><div className="flex flex-col gap-1"><label htmlFor="co-land" className="text-sm font-semibold">Landmark or directions</label><input id="co-land" value={co.land} onChange={(e) => set('land', e.target.value)} placeholder="Blue gate opposite the filling station" className={inp} /></div><div className="flex flex-col gap-1"><label htmlFor="co-gps" className="text-sm font-semibold">Ghana Post GPS (optional)</label><input id="co-gps" value={co.gps} onChange={(e) => set('gps', e.target.value.toUpperCase())} placeholder="GA-000-0000" className={inp} /></div></div>}
                  <div className="flex flex-col gap-1 max-w-sm"><label htmlFor="co-deldate" className="text-sm font-semibold">Delivery date</label><input id="co-deldate" type="date" value={delDate} min={isoD(DMIN)} max={isoD(DMAX)} onChange={(e) => setDelDate(e.target.value)} className={inp} /><span className="text-xs text-muted">Earliest delivery is {fmtD(isoD(DMIN))} · today and the next two days are not available so we can prepare and pack your order.</span></div>
                </div>
              )}
              {ful !== 'D' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2"><span className="text-sm font-semibold">{ful === 'P' ? 'Collect from' : 'Which branch will you visit?'}</span><div role="group" aria-label="Branch" className="grid gap-2 sm:grid-cols-3">{BR_INFO.map((b, k) => <button key={b.id} onClick={() => setBr(k)} aria-pressed={br === k} className={pill(br === k)}><span className="font-semibold text-sm">{b.name}</span><span className="text-xs opacity-80">{b.note}</span></button>)}</div></div>
                  <div className="flex flex-col gap-1 max-w-sm"><label htmlFor="co-when" className="text-sm font-semibold">{ful === 'P' ? 'Collection date and time' : 'When will you come?'}</label>
                    {ful === 'P' ? <><input id="co-when" type="datetime-local" value={pickDT} min={isoDT(PMIN)} max={isoDT(PMAX)} step={900} onChange={(e) => setPickDT(e.target.value)} className={inp} /><span className="text-xs text-muted">Choose the date and time you will collect (shop hours 8:00–20:00) · earliest {fmtDT(isoDT(PMIN))}.</span></>
                      : <><input id="co-when" type="date" value={visit} min={isoD(NOW)} max={isoD(new Date(NOW.getTime() + 30 * 864e5))} onChange={(e) => setVisit(e.target.value)} className={inp} /><span className="text-xs text-muted">Pick the day you will come to the shop.</span></>}
                  </div>
                  <div role="note" className="rounded-2xl bg-canvas p-4 text-sm">{ful === 'P' ? `We send your order to ${B.name} and give you a 6-digit collection code. ${W.collect > 0 ? `A collection charge of ${money(W.collect)} applies.` : 'Collection is free.'}` : `Your items are kept aside at ${B.name}. Pay at the till when you arrive · hire purchase is available in store.`}</div>
                </div>
              )}
            </section>
          )}
          {step === 3 && (
            <section aria-labelledby="s3-h" className="flex flex-col gap-4">
              <h2 id="s3-h" className="m-0 text-xl font-semibold">Your details</h2>
              {guestBox('Have an account? Sign in to fill this in for you.')}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1"><label htmlFor="co-name" className="text-sm font-semibold">Full name</label><input id="co-name" value={co.name} onChange={(e) => set('name', e.target.value)} placeholder="Ama Owusu" autoComplete="name" className={inp} /></div>
                <Phone id="co-phone" label="Phone number (for the rider or branch)" value={co.phone} onChange={(v) => { set('phone', v); if (!co.momo) set('momo', v); }} />
                <div className="flex flex-col gap-1"><label htmlFor="co-email" className="text-sm font-semibold">Email for the receipt (optional)</label><input id="co-email" value={co.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" autoComplete="email" className={inp} /></div>
                <div className="flex flex-col gap-1"><label htmlFor="co-note" className="text-sm font-semibold">Note for us (optional)</label><input id="co-note" value={co.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. call when you arrive" className={inp} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} className="w-4 h-4 accent-black" />Send me order updates on WhatsApp. You can opt out any time.</label>
            </section>
          )}
          {step === 4 && (
            <section aria-labelledby="s4-h" className="flex flex-col gap-4">
              <h2 id="s4-h" className="m-0 text-xl font-semibold">{ful === 'I' ? 'How will you pay in store?' : 'How would you like to pay?'}</h2>
              {ful === 'I' && <div role="note" className="rounded-2xl bg-canvas p-4 text-sm">In-store purchases are paid at the till with Mobile Money or cash. Hire purchase is available for in-store purchases only.</div>}
              <div role="group" aria-label="Payment method" className="grid gap-2 sm:grid-cols-2">{PAYSET[ful].map(([k, l, n]) => <button key={k} onClick={() => { if (!paidNow) { setPay(k); setErr(''); } }} aria-pressed={PAY === k} disabled={paidNow && PAY !== k} className={cx(pill(PAY === k), paidNow && PAY !== k && 'opacity-40')}><span className="font-semibold">{l}</span><span className="text-xs opacity-80">{n}</span></button>)}</div>
              {PAY === 'momo' && (
                <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                  <Phone id="co-momo" label="MoMo wallet number" value={co.momo} onChange={(v) => { set('momo', v); setMomoSt(''); }} />
                  {netOf(co.momo) && <span role="status" className="text-xs text-ok font-semibold">✓ {netOf(co.momo)} detected</span>}
                  <div role="group" aria-label="Network" className="flex gap-2 flex-wrap">{['MTN', 'Telecel', 'AirtelTigo'].map((n) => <button key={n} onClick={() => setNet(n)} aria-pressed={NET === n} className={cx('text-sm px-4 py-2 rounded-full border', NET === n ? 'bg-black text-white border-black' : 'border-line')}>{n}</button>)}</div>
                  {ful !== 'I' && (
                    <>
                      {!momoSt && <button onClick={sendPrompt} className="h-11 px-5 rounded-full bg-black text-white font-semibold w-fit flex items-center gap-2"><Svg d="phone" size={16} />Send payment prompt to my phone</button>}
                      {momoSt === 'wait' && <div role="status" aria-live="polite" className="rounded-2xl bg-[#fff8e1] p-4 flex flex-col gap-2"><div className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /><strong>Check your phone</strong></div><span className="text-sm">We sent a {NET} MoMo prompt for {money(total)} to {phFmt(co.momo)}. Enter your MoMo PIN to approve. We detect it automatically and move you on.</span><div className="flex gap-3 flex-wrap"><button onClick={sendPrompt} className="text-sm font-semibold underline">Resend prompt</button><button onClick={() => { window.clearTimeout(tmr.current); setMomoSt(''); }} className="text-sm font-semibold underline">Cancel</button><button onClick={() => { window.clearTimeout(tmr.current); setMomoSt(''); setPay(payKeys.find((k) => k !== 'momo')!); setErr('MoMo payment did not go through. Choose another way to pay.'); }} className="text-sm font-semibold underline text-danger">Payment failed? Use another option</button></div></div>}
                      {paidNow && <div role="status" className="rounded-2xl bg-green-50 p-3 text-sm text-ok font-semibold">✓ {money(total)} approved on {phFmt(co.momo)} · ref {paid!.ref}</div>}
                    </>
                  )}
                  <span className="text-xs text-muted">{ful === 'I' ? 'You approve the payment on your phone at the till.' : 'Prices are in GHS. No extra charge for MoMo.'}</span>
                </div>
              )}
              {PAY === 'ghpay' && (
                <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                  <span className="text-sm"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#0b5c5c] text-white mr-2">GhPay</span>Pay {money(total)} from your GhanaPay wallet or your bank app. You approve the request on your phone.</span>
                  <Phone id="co-gh" label="GhPay number" value={co.ghpay} onChange={(v) => { set('ghpay', v); setGhSt(''); }} />
                  {!ghSt && !paidNow && <button onClick={ghSend} className="h-11 px-5 rounded-full bg-black text-white font-semibold w-fit">Send GhPay request</button>}
                  {ghSt === 'wait' && !paidNow && <div role="status" className="rounded-2xl bg-[#fff8e1] p-4 flex items-center justify-between gap-3 flex-wrap"><span className="text-sm">⏳ Request sent to {phFmt(co.ghpay)}. Open GhanaPay or your bank app and approve {money(total)}.</span><button onClick={() => { window.clearTimeout(tmr.current); setGhSt(''); }} className="text-sm underline font-semibold">Cancel</button></div>}
                  {paidNow && <div role="status" className="rounded-2xl bg-green-50 p-3 text-sm text-ok font-semibold">✓ Paid {money(total)} with GhPay · ref {paid!.ref}</div>}
                </div>
              )}
              {PAY === 'paystack' && (
                <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                  <span className="text-sm">Pay securely through Paystack with a Visa or Mastercard card, Mobile Money or bank transfer. {BIZ} never sees your card details.</span>
                  {!paidNow ? <button onClick={() => setPs('choose')} className="h-11 px-5 rounded-full bg-[#011b33] text-white font-semibold w-fit">Pay {money(total)} with Paystack</button> : <div role="status" className="rounded-2xl bg-green-50 p-3 text-sm text-ok font-semibold">✓ Paid {money(total)} through Paystack · ref {paid!.ref}</div>}
                </div>
              )}
              {PAY === 'counter' && <div className="rounded-2xl bg-canvas p-4 text-sm">We send your order to the {B.name} counter and give you a 6-digit collection code. Show the code at the counter and pay {money(total)} by cash or MoMo when you collect.</div>}
              {PAY === 'bank' && <div className="rounded-2xl bg-canvas p-4 text-sm">Pay to <strong>{BIZ} Ltd · GCB Bank · 1021 3040 5060</strong> or dial <strong>*422*1*34430804#</strong>. Use reference <strong>34430804</strong>. We confirm automatically.</div>}
              {PAY === 'cod' && <div className="rounded-2xl bg-canvas p-4 text-sm">Pay {money(total)} to the rider in cash or by MoMo when your order arrives. Please have the exact amount ready if paying cash.</div>}
              {PAY === 'cash' && <div className="rounded-2xl bg-canvas p-4 text-sm">Pay {money(total)} in cash at the {B.name} till when you come on {fmtD(visit)}.</div>}
              {PAY === 'hp' && (
                <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                  <strong>Hire purchase plan</strong>
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold">Pay over</span><div role="group" aria-label="Months" className="flex gap-2">{HPT.map((m) => <button key={m} onClick={() => setHpTerm(m)} aria-pressed={hpTerm === m} className={cx('text-sm px-3.5 py-1.5 rounded-full border', hpTerm === m ? 'bg-black text-white border-black' : 'border-line')}>{m} months</button>)}</div></div>
                  <div className="grid gap-3 sm:grid-cols-2"><div className="flex flex-col gap-1"><label htmlFor="co-hpdep" className="text-sm font-semibold">Deposit today (GHS) · at least 10%</label><input id="co-hpdep" inputMode="decimal" value={co.hpDep} onChange={(e) => set('hpDep', e.target.value.replace(/[^\d.]/g, ''))} placeholder={(total * 0.1).toFixed(2)} className={inp} /></div><div className="rounded-2xl bg-canvas p-3 flex flex-col"><span className="text-xs text-muted">Monthly instalment</span><strong className="text-lg">{depOk ? money(hpMonthly) : '—'}</strong></div></div>
                  <span className="text-sm text-sub">{depOk ? `Deposit ${money(hpDep)} today, then ${hpTerm} payments of ${money(hpMonthly)} (3% a month on the balance of ${money(hpBal)}).` : `Minimum deposit ${money(total * 0.1)}.`}</span>
                  <span className="text-sm rounded-2xl bg-[#fff8e1] p-3">Bring your Ghana Card. The branch checks your details and signs the hire purchase agreement with you before you take the items home.</span>
                </div>
              )}
            </section>
          )}
          {step === 5 && (
            <section aria-labelledby="s5-h" className="flex flex-col gap-4">
              <h2 id="s5-h" className="m-0 text-xl font-semibold">Review and place your order</h2>
              <div role="note" className="rounded-2xl bg-canvas p-4 flex gap-2 text-sm"><span>📍</span><span><strong>Where your order goes:</strong> {routeNote}</span></div>
              <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
                <div className="flex justify-between"><strong>Items · {lines.reduce((a, l) => a + l.qty, 0)}</strong>{!locked && <button onClick={() => setStep(1)} className="text-sm underline font-semibold">Edit basket</button>}</div>
                <ul className="m-0 p-0 list-none flex flex-col gap-2">{lines.map((l) => <li key={l.pid + l.unit} className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl flex-none" style={{ background: l.p.tone }} /><span className="flex-1 flex flex-col"><span className="text-sm font-medium">{l.p.name}</span><span className="text-xs text-muted">{l.unitName} · {l.qty} × {money(l.each)}</span></span><strong className="text-sm">{money(l.total)}</strong></li>)}</ul>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {([[2, ful === 'D' ? 'Delivery' : ful === 'P' ? 'Click & collect' : 'Buy in store', [where, when]], [3, 'Your details', [co.name, phFmt(co.phone), co.email || 'No email · receipt by SMS', consent ? 'WhatsApp updates on' : 'No WhatsApp updates']], [4, 'Payment', [payLine]]] as [number, string, string[]][]).map(([k, t, L]) => (
                  <div key={k} className="rounded-2xl border border-line p-4 flex flex-col gap-1"><div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">{k}</span><strong className="text-sm">{t}</strong></span>{!locked && <button onClick={() => setStep(k)} className="text-xs underline font-semibold">Change</button>}</div>{L.filter(Boolean).map((x) => <span key={x} className="text-sm text-sub">{x}</span>)}</div>
                ))}
              </div>
              <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1 text-sm">{[['Subtotal', money(sub)], ...(disc ? [['Discount', '− ' + money(disc)]] : []), [ful === 'D' ? 'Delivery' : 'Collection', fee ? money(fee) : 'Free'], ['Total', money(total)]].map(([k, v]) => <div key={k} className={cx('flex justify-between', k === 'Total' && 'font-bold text-base pt-1 border-t border-line')}><span>{k}</span><span>{v}</span></div>)}<span className="text-xs text-muted pt-1">By placing this order you agree to the store <button onClick={() => go('pages/terms')} className="underline">terms of sale</button>.</span></div>
            </section>
          )}
          {cxMsg && <div role="status" className="rounded-2xl bg-[#fff8e1] p-4 flex items-start gap-3"><span className="flex-1 text-sm">{cxMsg}</span><button onClick={() => setCxMsg('')} aria-label="Dismiss" className="w-7 h-7">×</button></div>}
          {err && <div role="alert" className="rounded-2xl bg-red-50 border border-danger p-4 text-sm text-danger">{err}</div>}
          <div className="flex gap-2 justify-between flex-wrap">
            {step > 1 ? (locked && step === 5 ? <button disabled aria-disabled="true" title="Payment received · you can no longer go back" className="h-12 px-5 rounded-full border border-line font-semibold opacity-40">← Back</button> : <button onClick={() => { setErr(''); setStep(step - 1); }} className="h-12 px-5 rounded-full border border-line font-semibold">← Back</button>) : <button onClick={() => go('')} className="h-12 px-5 rounded-full border border-line font-semibold">← Continue shopping</button>}
            <button onClick={next} disabled={!lines.length} className="h-12 px-6 rounded-full bg-black text-white font-semibold disabled:opacity-40">{nextLabel}</button>
          </div>
        </div>
        <aside aria-label="Order summary" className="rounded-3xl border border-line p-5 flex flex-col gap-3 lg:sticky lg:top-40">
          <h2 className="m-0 text-lg font-semibold">Order summary</h2>
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">{lines.map((l) => <li key={l.pid + l.unit} className="flex justify-between gap-2 text-sm"><span>{l.qty} × {l.p.name}</span><span>{money(l.total)}</span></li>)}{!lines.length && <li className="text-sm text-muted">No items</li>}</ul>
          {step >= 2 && <div className="flex flex-col gap-1 text-xs text-sub border-t border-line pt-2"><div className="flex justify-between gap-2"><span className="text-muted">{ful === 'D' ? 'Delivery' : ful === 'P' ? 'Collect' : 'In store'}</span><span className="text-right">{ful === 'D' ? zone.name : B.name}</span></div>{step >= 4 && <div className="flex justify-between gap-2"><span className="text-muted">Payment</span><span className="text-right">{payName}</span></div>}</div>}
          <div className="hidden lg:block">{codeBox('co-code')}</div>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-1 text-sm border-t border-line pt-3"><dt>Subtotal</dt><dd className="m-0 text-right">{money(sub)}</dd><dt>Discount</dt><dd className="m-0 text-right text-ok">{disc ? '− ' + money(disc) : money(0)}</dd><dt>{ful === 'D' ? 'Delivery' : 'Collection'}</dt><dd className="m-0 text-right">{fee ? money(fee) : 'Free'}</dd><dt className="font-bold text-base pt-1">Total</dt><dd className="m-0 text-right font-bold text-base pt-1">{money(total)}</dd></dl>
          <span className="text-xs text-muted flex items-center gap-1.5"><Svg d="lock" size={14} />Secure checkout · your details are encrypted</span>
          {lines.length > 0 && (cxSt === '' ? <button onClick={() => setCxSt('ask')} className="text-sm text-danger underline w-fit">Cancel order</button> : <div role="alertdialog" aria-label="Cancel order" className="rounded-2xl bg-red-50 p-3 flex flex-col gap-2"><span className="text-sm">{paidNow ? `Cancel this order? Your ${money(total)} will be refunded to ${payName}.` : 'Cancel this order and empty your basket?'}</span><div className="flex gap-2"><button onClick={cancelCheckout} className="h-9 px-3 rounded-full bg-danger text-white text-xs font-semibold">Yes, cancel order</button><button onClick={() => setCxSt('')} className="h-9 px-3 rounded-full border border-line text-xs font-semibold bg-white">Keep my order</button></div></div>)}
        </aside>
      </div>
      {ps && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="ps-h" className="bg-white w-full max-w-sm rounded-3xl overflow-hidden">
            <div className="bg-[#011b33] text-white p-5 flex justify-between gap-3"><div className="flex flex-col"><strong id="ps-h">Paystack secure checkout</strong><span className="text-xs text-white/70">{BIZ} · {co.email || 'guest@checkout'}</span></div><div className="text-right"><span className="text-xs text-white/70">Pay</span><br /><strong>{money(total)}</strong></div></div>
            <div className="p-5 flex flex-col gap-3">
              {ps === 'choose' && <><span className="text-sm font-semibold">Choose how to pay</span>{['Card', 'Mobile Money', 'Bank transfer'].map((m) => <button key={m} onClick={() => setPsM(m)} aria-pressed={psM === m} className={cx('h-11 rounded-2xl border text-sm font-semibold', psM === m ? 'border-[#3bb75e] bg-green-50' : 'border-line')}>{m}</button>)}<button onClick={psPay} className="h-11 rounded-full bg-[#3bb75e] text-white font-semibold">Pay {money(total)}</button><span className="text-[11px] text-muted text-center">Demo · in the live system Paystack's own secure window opens here</span></>}
              {ps === 'busy' && <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6"><span className="w-8 h-8 border-4 border-[#3bb75e] border-t-transparent rounded-full animate-spin" /><span className="text-sm">Processing payment…</span></div>}
              {ps === 'done' && <div role="status" className="flex flex-col items-center gap-2 py-6"><span className="w-12 h-12 rounded-full bg-[#3bb75e] text-white text-2xl flex items-center justify-center">✓</span><strong>Payment successful</strong><span className="text-xs text-muted">Taking you to review…</span></div>}
              {ps === 'choose' && <button onClick={() => setPs('')} className="text-sm underline">Cancel payment</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * After checkout: the Order Confirmation page. Emails the Order Confirmation PDF to the customer automatically
 * (once per order, when they gave an email) and offers the same PDF to download.
 */
export function Done() {
  const { no = '' } = useParams();
  const { orders, setOrders, me, go, setMd, setAuth, W } = useShop();
  const o = orders[no];
  // Email status shown to the customer: sending → sent / failed. Only "sent" when the email service accepted it.
  const [mail, setMail] = useState<'' | 'sending' | 'sent' | 'failed'>(o?.emailed || '');
  const [pdfBusy, setPdfBusy] = useState(false);
  useEffect(() => {
    if (!o || !o.email || o.emailed === 'sent') return;
    setMail('sending');
    emailConfirmationOnce(o, W).then((r) => { if (!r) return; setMail(r); setOrders((O) => (O[o.no] ? { ...O, [o.no]: { ...O[o.no], emailed: r } } : O)); });
  }, [o?.no]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return <main className="px-[var(--gut)] py-16 text-center"><h1 className="m-0 text-2xl">Order not found</h1><button onClick={() => go('')} className="mt-4 h-11 px-5 rounded-full bg-black text-white font-semibold">Keep shopping</button></main>;
  const b = brInfo(o.brId);
  const title = o.fulfil === 'D' ? 'Thank you · your order is on its way' : o.fulfil === 'P' ? 'Thank you · your order is going to the branch' : 'Thank you · your items are being kept aside';
  const note = o.fulfil === 'D' ? `We are packing it at our ${b.name} branch now. A rider will call ${phFmt(o.phone)} before arriving. ${o.paid ? 'Paid' : o.payKey === 'cod' ? `Pay ${money(o.total)} to the rider` : `Pay ${money(o.total)} by bank transfer · we confirm automatically`}.` : o.fulfil === 'P' ? `Your order has gone straight to the ${b.short} counter. We will message you when it is ready to collect.` : `Come to ${b.name} on ${o.when} and pay at the till.${o.payKey === 'hp' ? ' Bring your Ghana Card to sign the hire purchase agreement.' : ''}`;
  return (
    <main className="px-[var(--gut)] py-12 flex flex-col items-center text-center gap-4 max-w-2xl mx-auto">
      <span className="w-16 h-16 rounded-full bg-ok text-white flex items-center justify-center"><Svg d="check" size={32} /></span>
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">{title}</h1>
      <p className="m-0 text-base text-sub">{note}</p>
      <p role="note" className="m-0 text-sm rounded-2xl bg-canvas px-4 py-3">📍 {o.where} · {o.when}</p>
      {o.code && <div className="rounded-3xl border-2 border-black px-8 py-5 flex flex-col gap-1"><span className="text-sm text-muted">Your collection code</span><strong className="text-[40px] tracking-[0.3em] font-mono">{o.code}</strong><span className="text-xs text-muted">Show this code at the {b.short} {o.fulfil === 'P' ? 'counter' : 'till'}. We also sent it by SMS.</span></div>}
      <p className="m-0 text-sm">Order <strong>{o.no}</strong> · the branch updates the status here as it prepares your order · also by SMS and WhatsApp</p>
      {/* Order Confirmation: PDF download + automatic email status. */}
      <section aria-labelledby="oc-h" className="w-full rounded-3xl border border-line p-5 flex flex-col items-center gap-3">
        <h2 id="oc-h" className="m-0 text-lg font-semibold">Order Confirmation</h2>
        {o.email ? <p role="status" className={cx('m-0 text-sm', mail === 'failed' && 'text-danger')}>
          {mail === 'sending' ? `📧 Sending your Order Confirmation to ${o.email}…` : mail === 'sent' ? `📧 We emailed your Order Confirmation (PDF) to ${o.email}.` : mail === 'failed' ? `We could not email your Order Confirmation to ${o.email} right now. Please download it below.` : `📧 Your Order Confirmation goes to ${o.email}.`}
        </p> : <p className="m-0 text-sm text-muted">No email was given, so download your Order Confirmation below to keep a copy.</p>}
        <div className="flex gap-2 flex-wrap justify-center">
          <button disabled={pdfBusy} onClick={async () => { setPdfBusy(true); try { await downloadShopDoc(o, W, 'confirmation'); } finally { setPdfBusy(false); } }} className="h-11 px-5 rounded-full bg-black text-white font-semibold disabled:opacity-60">{pdfBusy ? 'Preparing PDF…' : '⬇ Download Order Confirmation (PDF)'}</button>
          <button onClick={() => setMd({ k: 'receipt', no: o.no, kind: 'confirmation' })} className="h-11 px-5 rounded-full border border-black font-semibold">View Order Confirmation</button>
        </div>
      </section>
      <div className="flex gap-2 flex-wrap justify-center">
        <button onClick={() => setMd({ k: 'track', no: o.no })} className="h-11 px-5 rounded-full border border-black font-semibold">Track this order</button>
        {me && <button onClick={() => go('account/orders')} className="h-11 px-5 rounded-full border border-line font-semibold">Track it in My orders</button>}
        {!me && <button onClick={() => setAuth('up')} className="h-11 px-5 rounded-full border border-line font-semibold">Create an account to track this order</button>}
        <button onClick={() => go('')} className="h-11 px-5 rounded-full border border-line font-semibold">Keep shopping</button>
      </div>
    </main>
  );
}
