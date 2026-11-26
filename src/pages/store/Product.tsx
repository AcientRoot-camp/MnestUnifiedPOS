import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cx } from '../../lib/format';
import { readKey, writeKey } from '../../lib/persist';
import { useShop } from './ctx';
import { Crumb, Svg } from './Shell';
import { BR_INFO, badgesOf, isOos, money, stockLine, stockTxt, suggestFor, waHref, type SP } from './model';
import NoticeModal from '../../components/Notice';
import { storeUrl } from '../../lib/site';
import { ART_BG, isArt } from '../../data/catalogue';
import { parseDescription, plainText } from '../../lib/describe';
import { SectionBody } from '../../components/ProductDesc';

export function Price({ p, big = false }: { p: SP; big?: boolean }) {
  return p.was && p.was > p.price
    ? <span className={cx('flex items-baseline gap-2 flex-wrap', big ? 'text-2xl' : 'text-[15px]')}><s className="text-muted text-[0.8em]">{money(p.was)}</s><strong className="text-danger">{money(p.price)}</strong></span>
    : <strong className={big ? 'text-2xl' : 'text-[15px]'}>{money(p.price)}</strong>;
}

function Photo({ p, label = true, className = '' }: { p: SP; label?: boolean; className?: string }) {
  // Drawn illustrations fill the box on their own matching background; real photos sit on white with a margin.
  if (p.img && isArt(p.img)) return <span className={cx('w-full flex items-center justify-center overflow-hidden', className)} style={{ background: ART_BG }}><img src={p.img} alt={label ? p.name : ''} loading="lazy" className="w-full h-full object-contain" /></span>;
  if (p.img) return <span className={cx('w-full flex items-center justify-center bg-white overflow-hidden', className)}><img src={p.img} alt={label ? p.name : ''} loading="lazy" className="w-full h-full object-contain p-[6%]" /></span>;
  return <span className={cx('w-full flex items-center justify-center text-xs text-muted', className)} style={{ background: p.tone }}>{label ? 'Product photo' : ''}</span>;
}

export function Heart({ p, className = '' }: { p: SP; className?: string }) {
  const { wish, wishTog } = useShop();
  const on = wish.includes(p.id);
  return <button onClick={() => wishTog(p.id)} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Save'} ${p.name} ${on ? 'from' : 'to'} your wishlist`} title="Wishlist" className={cx('w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-lg', on ? 'text-danger' : 'text-black', className)}>{on ? '♥' : '♡'}</button>;
}

/** Product card used everywhere: home grid, category rows and branch pages. */
export function ProductCard({ p, brId, compact = false }: { p: SP; brId?: string; compact?: boolean }) {
  const { open, add, setQv, setBis, cart } = useShop();
  const oos = brId ? (p.stock[brId] ?? 0) <= 0 : isOos(p);
  // Sold out because this shopper's own basket holds the last ones: say so, instead of "Out of stock" + "Notify me".
  const mine = cart.filter((l) => l.pid === p.id).reduce((a, l) => a + (l.unit === 'c' ? l.qty * (p.ct?.size || 12) : l.qty), 0);
  const allMine = oos && mine > 0;
  const B = allMine ? [...badgesOf(p, brId).filter((b) => b.t !== 'Out of stock'), { t: 'In your basket', cls: 'bg-ok text-white' }] : badgesOf(p, brId);
  return (
    <div className={cx('group rounded-3xl border bg-white flex flex-col overflow-hidden', oos && !allMine ? 'border-black/10 opacity-80' : 'border-black/[0.18]')}>
      <div className="relative">
        <button onClick={() => open(p.id)} aria-label={`View ${p.name}`} className="block w-full"><Photo p={p} className="aspect-square" /></button>
        {B.length > 0 && <span className="absolute left-2.5 top-2.5 flex flex-col gap-1 items-start pointer-events-none">{B.map((b) => <span key={b.t} className={cx('text-[11px] font-bold px-2 py-0.5 rounded-full', b.cls)}>{b.t}</span>)}</span>}
        <Heart p={p} className="absolute right-2.5 top-2.5" />
        <button onClick={() => setQv(p.id)} aria-label={`Quick view ${p.name}`} className="absolute left-1/2 -translate-x-1/2 bottom-2.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white shadow-card opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity whitespace-nowrap">👁 Quick view</button>
      </div>
      <div className="p-3.5 pr-14 flex flex-col gap-1 flex-1 relative">
        <button onClick={() => open(p.id)} className={cx('text-left text-[14.5px] font-medium leading-snug', oos && !allMine && 'line-through text-[#9a9794]')}>{p.name}</button>
        <span className="flex items-baseline gap-1.5 flex-wrap"><Price p={p} />{!compact && p.ct && <span className="text-xs text-muted">· {p.ct.label.toLowerCase()} {money(p.ct.price)}</span>}</span>
        <span className={cx('text-xs', allMine ? 'text-ok font-semibold' : oos ? 'text-danger font-bold' : 'text-muted')}>{allMine ? `All ${mine} left are in your basket` : brId ? stockTxt(p.stock[brId]) : stockLine(p)}</span>
        {allMine ? null : !oos
          ? <button onClick={() => add(p.id, 's')} aria-label={`Add ${p.name} to basket`} title="Add to basket" className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg></button>
          : <button onClick={() => setBis(p.id)} className="mt-2 -mr-11 h-9 rounded-full border border-black text-xs font-semibold">🔔 Notify me when back</button>}
      </div>
    </div>
  );
}

export function MiniCard({ p }: { p: SP }) {
  const { open, setQv } = useShop();
  return (
    <div className="flex flex-col gap-1.5 min-w-[150px]">
      <div className="relative"><button onClick={() => open(p.id)} aria-label={`View ${p.name}`} className="block w-full rounded-2xl overflow-hidden"><Photo p={p} label={false} className="h-28" /></button><Heart p={p} className="absolute right-2 top-2 w-8 h-8 text-base" /></div>
      <span className="text-sm font-medium leading-snug">{p.name}</span>
      <Price p={p} />
      <button onClick={() => setQv(p.id)} className="text-xs font-semibold underline w-fit">Quick view</button>
    </div>
  );
}

/**
 * Shopify-style product details under the buy buttons: the description and highlights open, then collapsible rows for
 * specifications, how to use, storage or care, delivery and collection, returns and (for big items) hire purchase.
 * The text is the product's shared description (POS and online, lib/describe.ts); delivery and returns come from the
 * store settings. Input: the product.
 */
function DetailRows({ p }: { p: SP }) {
  const { W, go } = useShop();
  const d = parseDescription(p.desc);
  const hi = d.sections.find((x) => /highlight|feature|why/i.test(x.title));
  const spec = d.sections.find((x) => x.specs.length > 0);
  const rest = d.sections.filter((x) => x !== hi && x !== spec);
  // Highlights typed in Post to online are added after the description's own (without repeats).
  const points = [...(hi?.bullets || []), ...p.bullets.filter((b) => !(hi?.bullets || []).includes(b))];
  const specs: [string, string][] = [...(spec?.specs || []), ...(!(spec?.specs || []).some(([k]) => /sku/i.test(k)) ? [['SKU', p.sku] as [string, string]] : [])];
  const big = /appliances|electronics/i.test(p.cat) || p.price >= 1000;
  const zones = W.zones.filter((z) => z.on !== false);
  const row = 'group border-t border-line';
  const sum = 'flex items-center justify-between gap-3 py-4 cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden';
  const Chev = () => <span aria-hidden className="w-7 h-7 rounded-full border border-line flex items-center justify-center text-sm transition-transform group-open:rotate-45">+</span>;
  return (
    <div className="flex flex-col mt-2 border-b border-line">
      <details open className={row}><summary className={sum}>Description<Chev /></summary>
        <div className="pb-5 flex flex-col gap-3">
          {d.intro.map((t, i) => <p key={i} className="m-0 text-[15px] leading-7 text-sub">{t}</p>)}
          {points.length > 0 && <SectionBody s={{ title: 'Highlights', bullets: points, specs: [], paras: hi?.paras || [] }} />}
        </div>
      </details>
      <details className={row}><summary className={sum}>Specifications<Chev /></summary><div className="pb-5"><SectionBody s={{ title: 'Specifications', bullets: spec?.bullets || [], specs, paras: spec?.paras || [] }} /></div></details>
      {rest.map((x) => <details key={x.title} className={row}><summary className={sum}>{x.title}<Chev /></summary><div className="pb-5"><SectionBody s={x} /></div></details>)}
      <details className={row}><summary className={sum}>Delivery & collection<Chev /></summary>
        <div className="pb-5 flex flex-col gap-2 text-sm text-sub">
          {zones.length > 0 && <table className="w-full text-sm"><tbody>{zones.map((z) => <tr key={z.name} className="border-b border-line last:border-0"><th scope="row" className="py-2 pr-3 text-left font-medium text-muted">{z.name}</th><td className="py-2 text-right font-medium text-black whitespace-nowrap">{z.fee ? money(z.fee) : 'Free'}{z.eta ? ` · ${z.eta}` : ''}</td></tr>)}</tbody></table>}
          {W.freeOn && W.freeOver > 0 && <span>Free delivery on orders over <b className="text-black">{money(W.freeOver)}</b>.</span>}
          <span>Click & collect from Osu, East Legon or Adum{W.collect ? ` for ${money(W.collect)}` : ' at no charge'}: we send a 6-digit code when your order is ready.</span>
        </div>
      </details>
      <details className={row}><summary className={sum}>Returns & refunds<Chev /></summary>
        <div className="pb-5 flex flex-col gap-2 text-sm text-sub"><span>Unopened items can be returned within 7 days with your receipt for an exchange or refund. Faulty electricals are covered by the manufacturer’s warranty. Refunds go back to the way you paid.</span><button onClick={() => go('pages/returns')} className="w-fit text-sm font-semibold text-black underline">Read the returns policy</button></div>
      </details>
      {big && <details className={row}><summary className={sum}>Hire purchase<Chev /></summary><div className="pb-5 text-sm text-sub">Pay a deposit today and the rest monthly over 3 to 12 months. Available in store with your Ghana Card and a guarantor; ask at any branch.</div></details>}
    </div>
  );
}

export function ProductPage() {
  const { id = '' } = useParams();
  const s = useShop();
  const { byId, products, recent, add, wish, wishTog, setBis, W } = s;
  const p = byId[id];
  const [unit, setUnit] = useState<'s' | 'c'>('s');
  useEffect(() => { setUnit('s'); if (p) s.setRecent((R) => [p.id, ...R.filter((x) => x !== p.id)].slice(0, 8)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <main className="px-[var(--gut)] py-16 text-center flex flex-col gap-3 items-center"><h1 className="m-0 text-2xl">This product is not on the store any more</h1><button onClick={() => s.go('')} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Back to the shop</button></main>;
  const oos = isOos(p);
  const rv = W.reviews.filter((r) => !r.hidden && r.product === p.name);
  const avg = rv.length ? (rv.reduce((a, r) => a + r.stars, 0) / rv.length).toFixed(1) : '4.8';
  const related = products.filter((x) => x.cat === p.cat && x.id !== p.id).concat(products.filter((x) => x.cat !== p.cat)).slice(0, 6);
  const rec = recent.filter((x) => x !== p.id && byId[x]).slice(0, 6).map((x) => byId[x]);
  return (
    <main className="px-[var(--gut)] py-8 flex flex-col gap-8">
      <Crumb items={[['Shop', ''], [p.cat, ''], [p.name, null]]} />
      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-3">
          <div className="relative"><Photo p={p} className="h-[340px] sm:h-[440px] rounded-3xl text-sm" /><Heart p={p} className="absolute right-4 top-4" /></div>
          <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <span key={i} className="h-24 rounded-2xl" style={{ background: p.tone, opacity: 1 - i * 0.2 }} />)}</div>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="m-0 text-3xl font-semibold tracking-tight">{p.name}</h1>
          {p.was && p.was > p.price && <span className="flex items-center gap-3 flex-wrap"><span className="text-xs font-bold px-2.5 py-1 rounded-full bg-danger text-white">Save {money(p.was - p.price)}</span><s className="text-muted">Was {money(p.was)}</s><strong className="text-2xl text-danger">Now {money(p.price)}</strong></span>}
          {!p.was && <strong className="text-2xl">{money(p.price)}</strong>}
          {oos && <span className="text-sm font-bold text-danger tracking-wider">OUT OF STOCK</span>}
          <span className="text-sm text-muted">★ {avg} · {rv.length || 12} verified reviews · SKU {p.sku}</span>
          <div role="group" aria-label="Buy as" className="flex gap-2 flex-wrap">
            {[['s', 'Single', p.price] as const, ...(p.ct ? [['c', `${p.ct.label} of ${p.ct.size}`, p.ct.price] as const] : [])].map(([k, l, pr]) => <button key={k} onClick={() => setUnit(k)} aria-pressed={unit === k} className={cx('px-4 py-2.5 rounded-2xl border text-left flex flex-col', unit === k ? 'bg-black text-white border-black' : 'border-line')}><span className="text-sm font-semibold">{l}</span><span className="text-xs opacity-80">{money(pr)}</span></button>)}
          </div>
          <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">Availability</span>
            {oos && <span role="status" className="text-danger">Out of stock at every branch · add it to your wishlist and we will let you know when it is back</span>}
            {BR_INFO.map((b) => <span key={b.id} className="flex justify-between gap-2"><span>{b.name.replace(', Accra', '').replace('Adum, Kumasi', 'Adum, Kumasi')}</span><span className={cx((p.stock[b.id] ?? 0) <= 0 ? 'text-danger' : (p.stock[b.id] ?? 0) <= 10 ? 'text-[#b26a00]' : 'text-ok', 'font-medium')}>{stockTxt(p.stock[b.id])}</span></span>)}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => add(p.id, unit)} disabled={oos} aria-disabled={oos} className="h-12 px-6 rounded-full bg-black text-white font-semibold disabled:bg-line disabled:text-muted">{oos ? 'Sold out' : `Add to basket · ${money(unit === 'c' && p.ct ? p.ct.price : p.price)}`}</button>
            <button onClick={() => wishTog(p.id)} aria-pressed={wish.includes(p.id)} className="h-12 px-5 rounded-full border border-black font-semibold">{wish.includes(p.id) ? '♥ Saved to wishlist' : '♡ Save to wishlist'}</button>
            {oos && <button onClick={() => setBis(p.id)} className="h-12 px-5 rounded-full border border-line font-semibold">🔔 Notify me</button>}
            <a href={waHref('', `${p.name} · ${money(p.price)} at ${storeUrl(`p/${p.id}`)}`)} target="_blank" rel="noopener" className="h-12 px-5 rounded-full border border-line font-semibold flex items-center">Share on WhatsApp</a>
          </div>
          <DetailRows p={p} />
        </div>
      </div>
      <section aria-label="You may also like" className="flex flex-col gap-4">
        <h2 className="m-0 text-xl font-semibold">You may also like</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{related.map((x) => <ProductCard key={x.id} p={x} compact />)}</div>
      </section>
      {rec.length > 0 && <section aria-labelledby="rv3-h" className="flex flex-col gap-4"><h2 id="rv3-h" className="m-0 text-xl font-semibold">Recently viewed</h2><div className="flex gap-4 overflow-x-auto pb-2">{rec.map((x) => <MiniCard key={x.id} p={x} />)}</div></section>}
    </main>
  );
}

export function QuickView() {
  const { qv, setQv, byId, add, wish, wishTog, setBis, open } = useShop();
  const [unit, setUnit] = useState<'s' | 'c'>('s');
  const [qty, setQty] = useState(1);
  useEffect(() => { setUnit('s'); setQty(1); }, [qv]);
  const p = qv ? byId[qv] : null;
  if (!p) return null;
  const oos = isOos(p);
  const each = unit === 'c' && p.ct ? p.ct.price : p.price;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setQv(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="qv-h" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] grid sm:grid-cols-2 relative">
        <button onClick={() => setQv(null)} aria-label="Close quick view" className="absolute right-3 top-3 z-10 w-10 h-10 rounded-full bg-white shadow-card text-xl">×</button>
        <div className="relative"><Photo p={p} className="h-64 sm:h-full min-h-[260px]" />{badgesOf(p).length > 0 && <span className="absolute left-3 top-3 flex flex-col gap-1 items-start">{badgesOf(p).map((b) => <span key={b.t} className={cx('text-[11px] font-bold px-2 py-0.5 rounded-full', b.cls)}>{b.t}</span>)}</span>}</div>
        <div className="p-6 flex flex-col gap-3">
          <span className="text-xs text-muted">{p.cat} · {p.sku}</span>
          <h2 id="qv-h" className="m-0 text-2xl font-semibold">{p.name}</h2>
          <Price p={p} big />
          {/* A short teaser here; the full description is on the product page ("See full details"). */}
          <p className="m-0 text-sm leading-6 text-sub">{plainText(p.desc, 200)}</p>
          <div role="group" aria-label="Buy as" className="flex gap-2 flex-wrap">{[['s', `Single · ${money(p.price)}`] as const, ...(p.ct ? [['c', `${p.ct.label} of ${p.ct.size} · ${money(p.ct.price)}`] as const] : [])].map(([k, l]) => <button key={k} onClick={() => setUnit(k)} aria-pressed={unit === k} className={cx('text-sm px-3.5 py-2 rounded-full border', unit === k ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}</div>
          <div className="rounded-2xl bg-canvas p-3 flex flex-col gap-1 text-sm"><strong>Stock by branch</strong>{BR_INFO.map((b) => <span key={b.id} className="flex justify-between"><span>{b.short}</span><span className="text-muted">{stockTxt(p.stock[b.id])}</span></span>)}</div>
          {!oos ? (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="flex items-center rounded-full border border-line"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer" className="w-10 h-10 text-lg">−</button><span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span><button onClick={() => setQty(qty + 1)} aria-label="More" className="w-10 h-10 text-lg">+</button></span>
              <button onClick={() => { add(p.id, unit, qty); setQv(null); }} className="flex-1 h-11 rounded-full bg-black text-white font-semibold whitespace-nowrap">Add to basket · {money(each * qty)}</button>
            </div>
          ) : <button onClick={() => { setQv(null); setBis(p.id); }} className="h-11 rounded-full border border-black font-semibold">🔔 Notify me when it’s back</button>}
          <div className="flex gap-4 items-center flex-wrap"><button onClick={() => wishTog(p.id)} aria-pressed={wish.includes(p.id)} className="text-sm font-semibold">{wish.includes(p.id) ? '♥' : '♡'} Wishlist</button><button onClick={() => open(p.id)} className="text-sm font-semibold underline">See full details →</button></div>
        </div>
      </div>
    </div>
  );
}

export function Notify() {
  const { bis, setBis, byId, me } = useShop();
  const [f, setF] = useState({ name: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { setF({ name: me?.name || '', phone: me ? '0' + me.phone : '', email: me?.email || '' }); setErr(''); setDone(false); }, [bis, me]);
  const p = bis ? byId[bis] : null;
  if (!p) return null;
  const close = () => setBis(null);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="bis-h" onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-[28px] p-6 flex flex-col gap-3">
        {!done ? (
          <>
            <h2 id="bis-h" className="m-0 text-xl font-semibold">🔔 Tell me when it’s back</h2>
            <span className="text-sm text-muted">We’ll send one message by SMS or email when <strong className="text-black">{p.name}</strong> is back in stock.</span>
            <label className="flex flex-col gap-1 text-sm font-semibold">Your name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" className="field font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">Phone (for SMS)<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="024 555 0142" autoComplete="tel" className="field font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">Email<input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" className="field font-normal" /></label>
            {err && <span role="alert" className="text-sm text-danger">{err}</span>}
            <div className="flex gap-2"><button onClick={() => { if (!f.name.trim()) return setErr('Add your name.'); if (f.phone.replace(/\D/g, '').length < 10 && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Add a phone number or an email so we can tell you.'); writeKey('ecompos.backInStock', [{ ...f, product: p.name, at: Date.now() }, ...readKey<unknown[]>('ecompos.backInStock', [])]); setDone(true); }} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Notify me</button><button onClick={close} className="h-11 px-5 rounded-full border border-line font-semibold">Cancel</button></div>
          </>
        ) : (
          <><h2 className="m-0 text-xl font-semibold">✓ You’re on the list</h2><span className="text-sm text-muted">We’ll message you as soon as it’s back in stock.</span><button onClick={close} className="h-11 px-5 rounded-full bg-black text-white font-semibold w-fit">OK</button></>
        )}
      </div>
    </div>
  );
}

export function Basket() {
  const s = useShop();
  const { cd, setCd, lines, sub, count, wish, byId, W, products, add, setWish, setBis, open, go, bump } = s;
  // How far the "Complete your order" list is rotated by "Show others". An added suggestion leaves the list (it is in
  // the basket now), so the next product slides into its place and the box never runs dry.
  const [shift, setShift] = useState(0);
  if (!cd.open) return null;
  const close = () => setCd({ ...cd, open: false, note: '' });
  const left = W.freeOver - sub;
  // Always-on suggestions (model.ts suggestFor): new arrivals first, then products that go with the basket.
  const ups = suggestFor(products, lines, shift);
  // ± on a basket line: shared with the basket everywhere (store ctx bump), so + stops when nothing more is free.
  const setQty = (pid: string, unit: string, d: number) => bump(pid, unit, d);
  const wl = wish.filter((x) => byId[x]).map((x) => byId[x]);
  return (
    <>
      <div role="presentation" onClick={close} className="fixed inset-0 z-[55] bg-black/40" />
      <aside role="dialog" aria-modal="true" aria-labelledby="cd-h" className="fixed right-0 top-0 bottom-0 z-[56] w-full max-w-[440px] bg-white flex flex-col shadow-card">
        <div className="p-5 border-b border-line flex items-center gap-3 flex-wrap">
          <h2 id="cd-h" className="m-0 text-lg font-semibold flex-1">Your basket</h2>
          <span role="tablist" className="flex gap-1 p-1 rounded-full bg-canvas">
            <button role="tab" aria-selected={cd.tab === 'cart'} onClick={() => setCd({ ...cd, tab: 'cart' })} className={cx('text-sm px-3 py-1.5 rounded-full', cd.tab === 'cart' && 'bg-black text-white font-semibold')}>Basket · {count}</button>
            <button role="tab" aria-selected={cd.tab === 'wish'} onClick={() => setCd({ ...cd, tab: 'wish' })} className={cx('text-sm px-3 py-1.5 rounded-full', cd.tab === 'wish' && 'bg-black text-white font-semibold')}>♡ Saved · {wl.length}</button>
          </span>
          <button onClick={close} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-canvas text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          <NoticeModal msg={cd.note} onClose={() => setCd({ ...cd, note: '' })} />
          {cd.tab === 'cart' && (
            <>
              {W.freeOn && W.freeOver > 0 && lines.length > 0 && <div className="flex flex-col gap-1.5"><span className="text-sm">{left > 0 ? <>Add <strong>{money(left)}</strong> more for free delivery</> : <strong className="text-ok">🎉 You get free delivery</strong>}</span><span className="h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-ok" style={{ width: `${Math.min(100, (sub / W.freeOver) * 100)}%` }} /></span></div>}
              {!lines.length && <div className="flex flex-col items-center gap-3 py-10 text-center"><span className="text-4xl">🛒</span><strong>Your basket is empty</strong><button onClick={() => { close(); go(''); }} className="h-11 px-5 rounded-full bg-black text-white font-semibold">Start shopping</button></div>}
              {lines.map((l) => (
                <div key={l.pid + l.unit} className="flex gap-3 items-start border-b border-line pb-3">
                  {l.p.img ? <img src={l.p.img} alt="" className="w-16 h-16 rounded-2xl flex-none object-contain bg-white border border-line p-1" /> : <span className="w-16 h-16 rounded-2xl flex-none" style={{ background: l.p.tone }} />}
                  <div className="flex-1 flex flex-col gap-1 min-w-0"><strong className="text-sm">{l.p.name}</strong><span className="text-xs text-muted">{l.unitName} · {money(l.each)}</span>
                    <div className="flex items-center gap-2"><button onClick={() => setQty(l.pid, l.unit, -1)} aria-label={`Fewer ${l.p.name}`} className="w-8 h-8 rounded-full border border-line">−</button><span className="w-6 text-center text-sm font-semibold">{l.qty}</span><button onClick={() => setQty(l.pid, l.unit, 1)} aria-label={`More ${l.p.name}`} className="w-8 h-8 rounded-full border border-line">+</button></div>
                    <div className="flex gap-3 mt-0.5"><button onClick={() => { setWish((w) => Array.from(new Set([...w, l.pid]))); setQty(l.pid, l.unit, -l.qty); setCd({ ...cd, note: `${l.p.name} moved to your wish list` }); }} aria-label={`Move ${l.p.name} to your wish list`} className="text-xs font-semibold flex items-center gap-1 hover:underline"><span aria-hidden>♡</span>Move to wish list</button><button onClick={() => setQty(l.pid, l.unit, -l.qty)} aria-label={`Remove ${l.p.name} from basket`} className="text-xs text-danger hover:underline">Remove</button></div>
                  </div>
                  <strong className="text-sm">{money(l.total)}</strong>
                </div>
              ))}
              {lines.length > 0 && ups.length > 0 && (
                <section aria-labelledby="up-h" className="mt-2 rounded-3xl bg-canvas p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2"><strong id="up-h" className="text-sm">Complete your order</strong><button onClick={() => setShift((k) => k + ups.length)} className="text-xs font-semibold underline">Show others</button></div>
                  {ups.map(({ p: u, why }) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <button onClick={() => open(u.id)} aria-label={`View ${u.name}`} className="w-12 h-12 rounded-2xl flex-none overflow-hidden bg-white border border-line">{u.img ? <img src={u.img} alt="" className="w-full h-full object-contain p-1" /> : <span className="block w-full h-full" style={{ background: u.tone }} />}</button>
                      <span className="flex-1 min-w-0 flex flex-col"><span className="text-sm font-medium truncate">{u.name}</span><span className="text-xs text-muted flex items-center gap-1.5 flex-wrap">{why === 'New in' ? <span className="px-1.5 py-px rounded-full bg-danger text-white text-[10px] font-bold">New in</span> : <span className="truncate">{why}</span>}<span aria-hidden>·</span><span className="text-black font-semibold">{money(u.price)}</span></span></span>
                      {/* Added quietly (no pop-up); the next suggestion slides into its place. */}
                      <button onClick={() => add(u.id, 's', 1, true)} aria-label={`Add ${u.name}`} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white flex-none">+ Add</button>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {cd.tab === 'wish' && (
            <>
              {!wl.length && <p className="text-sm text-muted text-center py-10 m-0">Tap ♡ on any product to save it here.</p>}
              {wl.map((p) => (
                <div key={p.id} className="flex gap-3 items-center border-b border-line pb-3">
                  <button onClick={() => open(p.id)} aria-label={`View ${p.name}`} className="w-16 h-16 rounded-2xl flex-none" style={{ background: p.tone }} />
                  <span className="flex-1 flex flex-col min-w-0"><strong className="text-sm">{p.name}</strong><span className="text-xs">{money(p.price)}</span><span className={cx('text-xs', isOos(p) ? 'text-danger' : 'text-muted')}>{stockLine(p)}</span></span>
                  <span className="flex flex-col gap-1 items-end">{!isOos(p) ? <button onClick={() => add(p.id)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white">Add to basket</button> : <button onClick={() => setBis(p.id)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black">🔔 Notify me</button>}<button onClick={() => setWish((W2) => W2.filter((x) => x !== p.id))} className="text-xs underline">Remove</button></span>
                </div>
              ))}
            </>
          )}
        </div>
        {lines.length > 0 && cd.tab === 'cart' && (
          <div className="p-5 border-t border-line flex flex-col gap-2">
            <div className="flex justify-between"><span>Subtotal</span><strong>{money(sub)}</strong></div>
            <span className="text-xs text-muted">Delivery and any discount code are worked out at checkout.</span>
            <button onClick={() => { close(); go('checkout'); }} className="h-12 rounded-full bg-black text-white font-semibold flex items-center justify-center gap-2"><Svg d="lock" size={16} />Checkout securely →</button>
            <button onClick={() => { close(); go('checkout'); }} className="h-11 rounded-full border border-line font-semibold">View basket</button>
          </div>
        )}
      </aside>
    </>
  );
}
