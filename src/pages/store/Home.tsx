import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { cx } from '../../lib/format';
import { useShop } from './ctx';
import { MiniCard, ProductCard } from './Product';
import { pageOn, Svg } from './Shell';
import { BR_INFO, CAT_INFO, NAVY, ini, isOos, stars, type SP } from './model';
import NoticeModal from '../../components/Notice';
import { HERO_ART, isHeroArt } from '../../data/web';

const SORTS: [string, string][] = [['rec', 'Recommended'], ['plh', 'Price: low to high'], ['phl', 'Price: high to low'], ['az', 'Name: A to Z'], ['new', 'Newest first']];
/** Price filter bands for an electronics shop (GHS): accessories, small appliances, mid-range and premium. */
const RANGES: [string, string, string][] = [['Under 1,000', '', '1000'], ['1,000 – 5,000', '1000', '5000'], ['5,000 – 10,000', '5000', '10000'], ['10,000 +', '10000', '']];

function Hero() {
  const { W, go } = useShop();
  const pics = (W.site.heroPics || []).filter(Boolean).slice(0, 8);
  // Pictures to show: the Admin's photos; the five built-in illustrations (data/web.ts HERO_ART) when there are no
  // photos, or after the photos when "Also show the built-in illustrations" is on. "One picture" shows only the first.
  const art = HERO_ART.map((a) => a.src);
  const all = pics.length ? (W.site.heroArt ? [...pics, ...art] : pics) : art;
  const slides = W.site.hero === 'none' ? [] : W.site.hero === 'single' ? all.slice(0, 1) : all;
  const [i, setI] = useState(0);
  // Changes picture every 4 s by default (the Admin can pick 3, 4, 6 or 8 s in Post to webstore).
  const ms = (W.site.heroInterval || 4) * 1000;
  // Tagline pill above the heading: shown only when the Admin sets one in Post to webstore (the old demo tagline is
  // cleared by the content upgrade in data/web.ts mergeWeb).
  const tag = (W.site.tagline || '').trim();
  // Tablets: the whole card (picture + heading and buttons) must fit on the screen under the store header. The
  // header's height varies (the promo bar wraps or can be closed), so where the card starts is measured and handed
  // to the stylesheet as --hero-top (index.css .hero-fit). Re-measured when the window or page size changes.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => el.style.setProperty('--hero-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    const watch = new ResizeObserver(measure); watch.observe(document.body);
    window.addEventListener('resize', measure);
    return () => { watch.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => { if (i >= slides.length) setI(0); }, [slides.length, i]);
  useEffect(() => { if (slides.length < 2) return; const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), ms); return () => window.clearInterval(t); }, [slides.length, ms]);
  return (
    // The big picture / video card at the top of the store.
    // Laptops and desktops (lg+): the picture fills the card and the heading sits over it on a dark gradient.
    // Phones and tablets: the card is stacked. The media frame is a little taller than a banner (4:3 on phones, 3:2 on
    // tablets) and the picture or video is enlarged to fill it (object-cover). Uploaded photos and videos stay centred;
    // on phones and tablets the built-in illustrations are aligned to the right, where their products are, so none of
    // them is cut off. On computers they stay centred: aligned right, the products would slide under the heading. The heading and buttons sit underneath on the navy background.
    // On phones and tablets (portrait and landscape, below 1280 px) the card also runs edge to edge (touching the left
    // and right of the screen, no side gutter, square corners, flush under the header); larger screens keep the gutter.
    <section ref={ref} aria-labelledby="hero-h" className="hero-fit relative mx-[var(--gut)] max-xl:mx-0 max-xl:rounded-none mt-[0.25rem] max-xl:mt-0 overflow-hidden flex flex-col lg:flex-row lg:items-center lg:min-h-[40rem]" style={{ background: NAVY }}>
      {/* Media: 4:3 on phones, 3:2 on tablets, the whole card from lg. The slide controls sit on the picture.
          No frame at all when the Admin chose "None" for the top picture (just the navy card and heading). */}
      {(W.site.heroVideo || slides.length > 0) && <div className="hero-media relative w-full overflow-hidden aspect-[4/3] sm:aspect-[3/2] lg:aspect-auto lg:absolute lg:inset-0">
        {W.site.heroVideo ? <video src={W.site.heroVideo} autoPlay muted loop playsInline aria-label="Video of products from our store" className="absolute inset-0 w-full h-full object-cover object-center" />
          : slides.map((u, k) => <img key={u + k} src={u} alt={k === i ? (HERO_ART.find((a) => a.src === u)?.name || 'Products from our store') : ''} className={cx('absolute inset-0 w-full h-full object-cover transition-opacity duration-700', isHeroArt(u) ? 'object-center max-lg:object-right' : 'object-center', k === i ? 'opacity-100' : 'opacity-0')} />)}
        {/* Dark gradient behind the heading: only where the heading sits over the picture (lg+). */}
        <div aria-hidden="true" className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[rgba(10,6,30,.85)] via-[rgba(10,6,30,.55)] to-transparent" />
        {slides.length > 1 && !W.site.heroVideo && (
          <div className="absolute z-10 right-3 bottom-3 lg:right-4 lg:bottom-4 flex items-center gap-2 bg-black/40 rounded-full px-2 py-1">
            <button onClick={() => setI((i - 1 + slides.length) % slides.length)} aria-label="Previous picture" className="w-8 h-8 text-white text-xl">‹</button>
            {slides.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Show picture ${k + 1}`} aria-current={k === i} className={cx('w-2.5 h-2.5 rounded-full', k === i ? 'bg-white' : 'bg-white/40')} />)}
            <button onClick={() => setI((i + 1) % slides.length)} aria-label="Next picture" className="w-8 h-8 text-white text-xl">›</button>
          </div>
        )}
      </div>}
      <div className="hero-copy relative z-10 p-[1.5rem] sm:p-[2.5rem] lg:p-[3rem] max-w-[42rem] flex flex-col gap-4 text-white">
        {tag && <span className="w-fit text-xs font-semibold px-3 py-1 rounded-full bg-white/15 backdrop-blur">{tag}</span>}
        <h1 id="hero-h" className="m-0 text-[30px] sm:text-[44px] lg:text-[52px] leading-[1.05] font-semibold tracking-tight">{W.site.heroTitle}</h1>
        <p className="m-0 text-base sm:text-lg text-white/85">{W.site.heroText}</p>
        <div className="flex gap-2 flex-wrap"><a href="#featured" className="h-12 px-6 rounded-full bg-white text-black font-semibold flex items-center hover:text-black">Shop now</a>{pageOn(W, 'branches') && <button onClick={() => go('branches')} className="h-12 px-6 rounded-full border border-white/60 text-white font-semibold">Find a branch</button>}</div>
      </div>
    </section>
  );
}

export function UpdateCard({ u, full = false }: { u: { id: string; title: string; kind: string; body: string; cta: string; to?: string; img?: string; at: string }; full?: boolean }) {
  const { go } = useShop();
  const to = u.to === 'branches' ? 'branches' : u.to === 'contact' ? 'contact' : u.to === 'about' ? 'about' : '';
  return (
    <article className="rounded-3xl border border-line bg-white overflow-hidden flex flex-col sm:flex-row">
      {u.img && <img src={u.img} alt="" className="sm:w-48 h-40 sm:h-auto object-cover" />}
      <div className="p-5 flex flex-col gap-2">
        <span className="text-xs text-muted font-semibold uppercase tracking-wider">{u.kind} · {u.at}</span>
        {full ? <h2 className="m-0 text-xl font-semibold">{u.title}</h2> : <strong className="text-base">{u.title}</strong>}
        {full ? u.body.split('\n').filter(Boolean).map((p, i) => <p key={i} className="m-0 text-sm leading-6 text-sub">{p}</p>) : <span className="text-sm text-sub line-clamp-2">{u.body}</span>}
        {u.cta && <button onClick={() => { go(to); if (!to) setTimeout(() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' }), 60); }} className="w-fit text-sm font-semibold px-4 py-2 rounded-full bg-black text-white">{u.cta}</button>}
      </div>
    </article>
  );
}

function Grid() {
  const s = useShop();
  const { products, q, setQ } = s;
  const [cat, setCat] = useState('All');
  const [pmin, setPmin] = useState('');
  const [pmax, setPmax] = useState('');
  const [fNew, setFNew] = useState(false);
  const [br, setBr] = useState('any');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState('rec');
  const [fOpen, setFOpen] = useState(false);
  const min = parseFloat(pmin), max = parseFloat(pmax);
  const priceErr = !isNaN(min) && !isNaN(max) && min > max;
  const qq = q.trim().toLowerCase();
  const list = useMemo(() => {
    let L = products.filter((p) => (cat === 'All' || p.cat === cat) && (!qq || (p.name + ' ' + p.cat + ' ' + p.sku).toLowerCase().includes(qq)) && (isNaN(min) || p.price >= min) && (isNaN(max) || priceErr || p.price <= max) && (!fNew || p.isNew) && (!inStock || (br === 'any' ? !isOos(p) : (p.stock[br] ?? 0) > 0)) && (br === 'any' || p.stock[br] != null));
    L = [...L].sort((a, b) => (sort === 'plh' ? a.price - b.price : sort === 'phl' ? b.price - a.price : sort === 'az' ? a.name.localeCompare(b.name) : sort === 'new' ? Number(b.isNew) - Number(a.isNew) || b.order - a.order : Number(isOos(a)) - Number(isOos(b)) || b.sold - a.sold));
    return L;
  }, [products, cat, qq, min, max, priceErr, fNew, br, inStock, sort]);
  const cats = ['All', ...Array.from(new Set(products.map((p) => p.cat)))];
  const chips: [string, () => void][] = [
    ...(cat !== 'All' ? [[cat, () => setCat('All')] as [string, () => void]] : []),
    ...(pmin || pmax ? [[`GHS ${pmin || '0'} – ${pmax || 'any'}`, () => { setPmin(''); setPmax(''); }] as [string, () => void]] : []),
    ...(fNew ? [['New arrivals', () => setFNew(false)] as [string, () => void]] : []),
    ...(br !== 'any' ? [[BR_INFO.find((b) => b.id === br)?.name ?? br, () => setBr('any')] as [string, () => void]] : []),
    ...(inStock ? [['In stock only', () => setInStock(false)] as [string, () => void]] : []),
  ];
  const clear = () => { setCat('All'); setPmin(''); setPmax(''); setFNew(false); setBr('any'); setInStock(false); setQ(''); };
  useEffect(() => { const f = (e: Event) => setCat((e as CustomEvent).detail); window.addEventListener('shop:cat', f); return () => window.removeEventListener('shop:cat', f); }, []);
  const chk = 'flex items-center gap-2 text-sm cursor-pointer';
  return (
    <section id="featured" aria-labelledby="feat-h" className="px-[var(--gut)] pt-12 flex flex-col gap-4 scroll-mt-40">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 id="feat-h" className="m-0 text-[28px] font-semibold tracking-tight">Shop all products</h2>
        {/* Laptops and up: product count and Sort by in the heading row. Phones and tablets: Sort by moves into the row
            with "Show filters" below, so the two controls sit side by side on one line. */}
        <div className="flex items-center gap-3 flex-wrap"><span role="status" className="text-sm text-muted">{list.length} of {products.length} products</span><label htmlFor="sh-sort" className="hidden lg:inline text-sm font-semibold">Sort by</label><select id="sh-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="hidden lg:block h-10 px-4 rounded-full border border-line bg-white text-sm">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      {qq && <span role="status" className="text-sm">Showing results for “<strong>{q}</strong>” · {list.length} found</span>}
      {chips.length > 0 && <div className="flex gap-2 flex-wrap">{chips.map(([l, f]) => <button key={l} onClick={f} aria-label={`Remove filter ${l}`} className="text-sm pl-3.5 pr-2 py-1.5 rounded-full bg-black text-white flex items-center gap-1.5">{l}<span aria-hidden="true">×</span></button>)}<button onClick={clear} className="text-sm underline px-2">Clear all</button></div>}
      {/* Phones and tablets: filters fold behind a button so the product cards get the full width; laptops and up: sidebar. */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
        {/* Phones and tablets: "Show filters" on the left and Sort by on the right, on the same line. */}
        <div className="lg:hidden w-full flex items-center justify-between gap-2">
          <button onClick={() => setFOpen(!fOpen)} aria-expanded={fOpen} aria-controls="shop-filters" className="h-11 px-3.5 sm:px-5 rounded-full border border-line text-[13px] sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 flex-none whitespace-nowrap"><Svg d="filter" size={16} />{fOpen ? 'Hide filters' : 'Show filters'}</button>
          <span className="flex items-center gap-2 min-w-0"><label htmlFor="sh-sort-m" className="text-[13px] sm:text-sm font-semibold whitespace-nowrap">Sort by</label><select id="sh-sort-m" value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 pl-2.5 pr-1 rounded-full border border-line bg-white text-[13px] sm:text-sm min-w-0 max-w-[12.5rem]">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></span>
        </div>
        <aside id="shop-filters" aria-label="Filter products" className={cx('w-full lg:w-60 flex-none flex-col gap-5 lg:sticky lg:top-40', fOpen ? 'flex' : 'hidden lg:flex')}>
          <div className="flex justify-between items-center"><strong>Filters</strong>{chips.length > 0 && <button onClick={clear} className="text-xs underline">Clear all</button>}</div>
          <div role="group" aria-labelledby="fl-cat" className="flex flex-col gap-1"><h3 id="fl-cat" className="m-0 text-sm font-semibold mb-1">Category</h3>{cats.map((c) => <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cx('flex justify-between text-sm px-3 py-2 rounded-xl text-left', cat === c ? 'bg-black text-white font-semibold' : 'hover:bg-canvas')}><span>{c}</span><span className={cat === c ? 'text-white/70' : 'text-muted'}>{c === 'All' ? products.length : products.filter((p) => p.cat === c).length}</span></button>)}</div>
          <div role="group" aria-labelledby="fl-pr" className="flex flex-col gap-2"><h3 id="fl-pr" className="m-0 text-sm font-semibold">Price (GHS)</h3>
            <div className="flex items-center gap-2"><label htmlFor="fl-min" className="sr-only">Minimum price</label><input id="fl-min" type="number" min={0} placeholder="Min" value={pmin} onChange={(e) => setPmin(e.target.value)} className="w-full h-10 px-3 rounded-full border border-line text-sm" /><span>–</span><label htmlFor="fl-max" className="sr-only">Maximum price</label><input id="fl-max" type="number" min={0} placeholder="Max" value={pmax} onChange={(e) => setPmax(e.target.value)} className="w-full h-10 px-3 rounded-full border border-line text-sm" /></div>
            <div className="flex gap-1.5 flex-wrap">{RANGES.map(([l, a, b]) => <button key={l} onClick={() => { setPmin(a); setPmax(b); }} aria-pressed={pmin === a && pmax === b} className={cx('text-xs px-2.5 py-1 rounded-full border', pmin === a && pmax === b ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}</div>
            {priceErr && <span role="alert" className="text-xs text-danger">Minimum is higher than maximum.</span>}
          </div>
          <div role="group" aria-labelledby="fl-buy" className="flex flex-col gap-2"><h3 id="fl-buy" className="m-0 text-sm font-semibold">Buying options</h3><label className={chk}><input type="checkbox" checked={fNew} onChange={() => setFNew(!fNew)} className="w-4 h-4 accent-black" />New arrivals</label></div>
          <div role="group" aria-labelledby="fl-av" className="flex flex-col gap-2"><h3 id="fl-av" className="m-0 text-sm font-semibold">Availability</h3><label htmlFor="fl-br" className="text-xs text-muted">Branch</label><select id="fl-br" value={br} onChange={(e) => setBr(e.target.value)} className="h-10 px-3 rounded-full border border-line bg-white text-sm"><option value="any">Any branch</option>{BR_INFO.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><label className={chk}><input type="checkbox" checked={inStock} onChange={() => setInStock(!inStock)} className="w-4 h-4 accent-black" />In stock only</label></div>
        </aside>
        <div className="flex-1 w-full min-w-0">
          {!list.length && <div className="rounded-3xl bg-canvas p-10 flex flex-col items-center gap-2 text-center"><strong>No products match these filters</strong><span className="text-sm text-muted">Try a wider price range or another category.</span><button onClick={clear} className="mt-2 h-11 px-5 rounded-full bg-black text-white font-semibold">Clear filters</button></div>}
          {/* Phones 2 per row, tablets 3–4 (smaller cards), computers 4–5. */}
          <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  const { products } = useShop();
  const cats = Array.from(new Set(products.map((p) => p.cat)));
  const pick = (c: string) => { window.dispatchEvent(new CustomEvent('shop:cat', { detail: c })); document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' }); };
  return (
    <section id="categories" aria-labelledby="cats-h" className="px-[var(--gut)] pt-14 flex flex-col gap-6">
      <div><h2 id="cats-h" className="m-0 text-[28px] font-semibold tracking-tight">Shop by category</h2><span className="text-sm text-muted">Everything we sell online, grouped the same way as in our shops</span></div>
      <div role="list" aria-label="Categories" className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {cats.map((c) => { const L = products.filter((p) => p.cat === c); return <a key={c} role="listitem" href="#featured" onClick={(e) => { e.preventDefault(); pick(c); }} className="rounded-3xl p-4 flex flex-col gap-1 min-h-[110px] hover:text-black" style={{ background: CAT_INFO[c]?.[1] ?? '#eef0f1' }}><span className="font-semibold">{c}</span><span className="text-xs text-muted">{L.length} products</span><span className="text-[11px] text-sub line-clamp-2">{L.slice(0, 3).map((p) => p.name.replace(/\s[\d.,]+\s?(kg|g|ml|L)$/i, '')).join(' · ')}</span></a>; })}
      </div>
      {cats.map((c) => { const L = products.filter((p) => p.cat === c); return (
        <div key={c} id={`cat-${c.toLowerCase()}`} className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3"><div><h3 className="m-0 text-xl font-semibold">{c}</h3><span className="text-sm text-muted">{CAT_INFO[c]?.[0] ?? ''}</span></div><button onClick={() => pick(c)} className="text-sm font-semibold underline whitespace-nowrap">See all {L.length}</button></div>
          <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{L.slice(0, 6).map((p) => <ProductCard key={p.id} p={p} compact />)}</div>
        </div>
      ); })}
    </section>
  );
}

export function ReviewsBand({ page = false }: { page?: boolean }) {
  const { W, up, go, me } = useShop();
  const R = W.reviews.filter((r) => !r.hidden);
  const avg = R.length ? (R.reduce((a, r) => a + r.stars, 0) / R.length).toFixed(1) : '0';
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ stars: 5, name: '', place: '', product: '', text: '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Add your name.');
    if (f.text.trim().length < 10) return setErr('Write a few words about how it went (at least 10 characters).');
    const flagged = /rubbish|stupid|scam|\b0\d{9}\b|http/i.test(f.text);
    up({ reviews: [{ id: 'r' + Date.now(), name: f.name.trim(), place: f.place.trim(), product: f.product.trim(), text: f.text.trim(), stars: f.stars, verified: !!me, hidden: false, flagged, at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }, ...W.reviews] });
    setDone(true); setOpen(false); setErr(''); setF({ stars: 5, name: '', place: '', product: '', text: '' });
  };
  const inp = 'h-11 px-4 rounded-full border border-line font-normal text-sm';
  return (
    <section aria-labelledby="rvb-h" className={cx('px-[var(--gut)] flex flex-col gap-5', page ? 'pt-2' : 'pt-14')}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>{page ? <h1 id="rvb-h" className="m-0 text-[32px] font-semibold tracking-tight">What customers say</h1> : <h2 id="rvb-h" className="m-0 text-[28px] font-semibold tracking-tight">What our customers say</h2>}<span className="text-sm text-muted">{R.length ? <><span className="text-[#f2b705]">★</span> {avg} average from {R.length} reviews</> : 'No reviews yet'}</span></div>
        <div className="flex gap-2">{!page && pageOn(W, 'reviews') && <button onClick={() => go('reviews')} className="h-10 px-4 rounded-full border border-line text-sm font-semibold">All reviews</button>}<button onClick={() => { setOpen(!open); setDone(false); }} aria-expanded={open} className="h-10 px-4 rounded-full bg-black text-white text-sm font-semibold">✍ Write a review</button></div>
      </div>
      <NoticeModal msg={done ? 'Thank you! Your review is now live on our website.' : ''} onClose={() => setDone(false)} />
      {open && (
        <form onSubmit={submit} aria-label="Write a review" className="rounded-3xl bg-canvas p-5 flex flex-col gap-3 max-w-2xl">
          <strong>Write a review</strong>
          <div role="group" aria-label="Your rating" className="flex items-center gap-1"><span className="text-sm font-semibold mr-2">Your rating</span>{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setF({ ...f, stars: n })} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={f.stars === n} className={cx('text-2xl', n <= f.stars ? 'text-[#f2b705]' : 'text-[#d9d9d9]')}>★</button>)}</div>
          <div className="grid sm:grid-cols-2 gap-3"><label className="flex flex-col gap-1 text-sm font-semibold">Your name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" className={inp} /></label><label className="flex flex-col gap-1 text-sm font-semibold">Town (optional)<input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} className={inp} /></label></div>
          <label className="flex flex-col gap-1 text-sm font-semibold">What did you buy? (optional)<input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} className={inp} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Your review<textarea rows={4} maxLength={600} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} className="p-4 rounded-2xl border border-line font-normal text-sm" /></label>
          {err && <span role="alert" className="text-sm text-danger">{err}</span>}
          <div className="flex items-center gap-3 flex-wrap"><button className="h-11 px-5 rounded-full bg-black text-white font-semibold">Send review</button><span className="text-xs text-muted">Your review goes live on the store as soon as you send it.</span></div>
        </form>
      )}
      {!R.length && <p className="m-0 text-sm text-muted">No reviews yet. Bought from us? Tell other customers how it went.</p>}
      <div role="list" aria-label="Customer reviews" className={cx('grid gap-4', page ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')}>
        {(page ? R : R.slice(0, 4)).map((r) => (
          <figure key={r.id} role="listitem" className="m-0 rounded-3xl border border-line p-5 flex flex-col gap-3 bg-white">
            <span aria-label={`Rating ${r.stars} out of 5`} className="text-[#f2b705] tracking-wider">{stars(r.stars)}</span>
            <blockquote className="m-0 text-[15px] leading-6">“{r.text}”</blockquote>
            <figcaption className="flex items-center gap-3 mt-auto"><span className="w-9 h-9 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center overflow-hidden">{r.photo ? <img src={r.photo} alt={r.name} className="w-full h-full object-cover" /> : ini(r.name)}</span><span className="flex flex-col"><strong className="text-sm">{r.name}</strong><span className="text-xs text-muted">{[r.place, r.product, r.verified ? '✓ Verified buyer' : ''].filter(Boolean).join(' · ')}</span></span></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * Personal sections of the home page.
 * part='picks'  → Recently viewed + Picked for you (shown above the reviews).
 * part='social' → Instagram / TikTok follow banners (shown after the reviews).
 */
function ForYou({ part }: { part: 'picks' | 'social' }) {
  const { recent, setRecent, byId, products, wish, W } = useShop();
  const rec = recent.filter((x) => byId[x]).map((x) => byId[x]);
  const seen = new Set([...recent, ...wish]);
  const cats = new Set([...recent, ...wish].map((x) => byId[x]?.cat).filter(Boolean));
  const yml: SP[] = products.filter((p) => !seen.has(p.id) && cats.has(p.cat) && !isOos(p)).slice(0, 6);
  const insta = W.site.social.instagram, tt = W.site.social.tiktok;
  const user = (u: string) => '@' + u.replace(/\/$/, '').split('/').pop()!.replace(/^@/, '');
  return (
    <>
      {/* Social banners, each with its platform icon (same icon files as the footer's Follow us row). */}
      {part === 'social' && (insta || tt) && (
        <div className="px-[var(--gut)] pt-14 grid gap-3 sm:grid-cols-2">
          {insta && <a href={/^https?:/.test(insta) ? insta : `https://www.instagram.com/${insta.replace(/^@/, '')}`} target="_blank" rel="noopener" className="rounded-3xl p-5 flex justify-between items-center text-white hover:text-white" style={{ background: 'linear-gradient(90deg,#833ab4,#fd1d1d,#fcb045)' }}><span className="flex items-center gap-3 font-semibold"><img src="/assets/social/instagram.png" alt="" width={36} height={36} className="w-9 h-9 flex-none" />Follow us on Instagram</span><span>{user(insta)} →</span></a>}
          {tt && <a href={/^https?:/.test(tt) ? tt : `https://www.tiktok.com/@${tt.replace(/^@/, '')}`} target="_blank" rel="noopener" className="rounded-3xl p-5 flex justify-between items-center bg-black text-white hover:text-white"><span className="flex items-center gap-3 font-semibold"><span className="w-9 h-9 flex-none rounded-full bg-white/10 flex items-center justify-center"><img src="/assets/social/tiktok.png" alt="" width={20} height={22} className="w-5 h-auto" /></span>Watch us on TikTok</span><span>{user(tt)} →</span></a>}
        </div>
      )}
      {part === 'picks' && rec.length > 0 && <section aria-labelledby="rv2-h" className="px-[var(--gut)] pt-14 flex flex-col gap-4"><div className="flex justify-between items-center"><h2 id="rv2-h" className="m-0 text-xl font-semibold">Recently viewed</h2><button onClick={() => setRecent([])} className="text-sm underline">Clear</button></div><div className="flex gap-4 overflow-x-auto pb-2">{rec.map((p) => <MiniCard key={p.id} p={p} />)}</div></section>}
      {part === 'picks' && yml.length > 0 && <section aria-labelledby="yml-h" className="px-[var(--gut)] pt-14 flex flex-col gap-1"><h2 id="yml-h" className="m-0 text-xl font-semibold">Picked for you</h2><span className="text-sm text-muted mb-3">Based on what you viewed and saved</span><div className="flex gap-4 overflow-x-auto pb-2">{yml.map((p) => <MiniCard key={p.id} p={p} />)}</div></section>}
    </>
  );
}

export default function Home() {
  const { W, go } = useShop();
  const posts = W.updates.filter((u) => u.live).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return (
    <main>
      <Hero />
      {posts.length > 0 && pageOn(W, 'updates') && (
        <section aria-labelledby="upd-h" className="px-[var(--gut)] pt-12 flex flex-col gap-4">
          <div className="flex justify-between items-end gap-3"><h2 id="upd-h" className="m-0 text-[28px] font-semibold tracking-tight">Latest from the store</h2><button onClick={() => go('updates')} className="text-sm font-semibold underline">All updates</button></div>
          <div className="grid gap-4 md:grid-cols-2">{posts.slice(0, 2).map((u) => <UpdateCard key={u.id} u={u} />)}</div>
        </section>
      )}
      <Grid />
      <Categories />
      {/* Recently viewed and Picked for you sit above the customer reviews. */}
      <ForYou part="picks" />
      {W.plugins.reviews !== false && <ReviewsBand />}
      <ForYou part="social" />
    </main>
  );
}
