import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { navName, type Web } from '../../data/web';
import { usePersist } from '../../lib/persist';
import { cx } from '../../lib/format';
import { useShop } from './ctx';
import { BIZ, BR_INFO, NAVY, dirHref, embedHref, ini, mapsHref, money, waHref } from './model';
import { COMPANY_LOGO, POWERED_BY_LOGO, companyLogo } from '../../lib/brand';
import NoticeModal from '../../components/Notice';
import { useSession } from '../../lib/session';
import { clearStaffStore, isStaffStore, portalUrl } from '../../lib/site';
import { StoreInstall } from '../../components/InstallPrompt';
import { ChristmasHat } from '../../components/Seasonal';
import { seasonOf } from '../../lib/season';
import { ChatAssistant } from './Chat';
import { SearchPanel, type SearchPanelApi } from './SearchPanel';

export const PAGE_SLUG: Record<string, string> = { about: 'about-us', branches: 'branches', contact: 'contact', updates: 'updates', reviews: 'reviews', careers: 'careers-opportunities', faqs: 'faqs' };
export const pageOn = (W: Web, k: string) => W.pages.find((p) => p.slug === PAGE_SLUG[k])?.live !== false;
export const bizName = (W: Web) => W.site.name?.trim() || BIZ;

const I = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M18 6 6 18M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  chev: 'M6 9l6 6 6-6',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user: 'M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  check: 'M20 6 9 17l-5-5',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
};
export function Svg({ d, size = 20, className = '' }: { d: keyof typeof I; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={I[d]} /></svg>;
}

export function Skeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="fixed inset-0 z-[100] bg-white flex flex-col">
      <span className="sr-only">Loading the shop…</span>
      <div className="h-8 bg-black" />
      <div className="h-[72px]" style={{ background: NAVY }} />
      <div className="px-[var(--gut)] py-6 flex flex-col gap-6">
        <div className="sk h-[300px] rounded-3xl" />
        <div className="flex gap-6"><div className="hidden md:flex flex-col gap-3 w-60">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="sk h-6" />)}</div>
          <div className="flex-1 grid gap-4 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex flex-col gap-2"><div className="sk h-40" /><div className="sk h-4 w-3/4" /><div className="sk h-4 w-1/2" /></div>)}</div></div>
        <span className="text-sm text-muted text-center">Loading the shop…</span>
      </div>
    </div>
  );
}

export function TopStrip() {
  const { W } = useShop();
  const sd = W.zones.filter((z) => z.on && /same/i.test(z.eta)).map((z) => (/kumasi/i.test(z.name) ? 'Kumasi' : z.name.split(/[,/(]/)[0].trim()));
  const towns = Array.from(new Set(sd.map((t) => (/osu|legon|accra|labone|cantonments/i.test(t) ? 'Accra' : t))));
  const freeBar = W.freeOn && W.freeOver > 0 ? `Free delivery${towns.length ? ' in ' + towns.join(', ') : ''} on orders over ${money(W.freeOver).replace('.00', '')}` : `Same-day delivery${towns.length ? ' in ' + towns.join(', ') : ''}`;
  const m = new Date().getMonth();
  const chip = m === 11 ? ['🎄', 'Christmas offers'] : m === 10 ? ['🛍', 'Black Friday week'] : null;
  // "Staff: open back office" only for a signed-in user who opened the store from inside the POS (lib/site.ts).
  // Customers visiting the website directly never see it.
  const { session } = useSession();
  const staff = !!session && isStaffStore();
  // One run of the scrolling message: season chip, announcement (if on) and the delivery offer.
  const run = (copy: boolean) => (
    <span className="flex items-center gap-6 pr-12 flex-none whitespace-nowrap" aria-hidden={copy || undefined}>
      {chip && <span className="px-2.5 py-0.5 rounded-full bg-white/15 font-semibold">{chip[0]} {chip[1]}</span>}
      {W.site.announceOn && W.site.announce && <span>📣 {W.site.announce}</span>}
      <span>{freeBar}</span>
    </span>
  );
  return (
    <div className="bg-black text-white text-[12.5px] px-[var(--gut)] py-2 flex items-center gap-4">
      {/* Marquee: the message scrolls right to left in a loop (index.css .marquee). The run is drawn twice so the
          loop has no gap; the copy is hidden from screen readers. Hover or keyboard focus pauses it, and it stays
          still for visitors whose device asks for reduced motion. */}
      <div className="marquee flex-1 min-w-0" role="marquee" aria-label="Offers and delivery news" tabIndex={0}>
        <div className="marquee-track">{run(false)}{run(true)}</div>
      </div>
      {/* Full page load: the POS is a separate app under /pos, outside the store's router. */}
      {staff && <a href={portalUrl()} onClick={clearStaffStore} className="flex-none text-white underline underline-offset-2 hover:text-white/80">Staff: open back office</a>}
    </div>
  );
}

export function PromoBar() {
  const { W } = useShop();
  const [closed, setClosed] = useState('');
  const now = Date.now();
  const promo = W.codes.find((c) => c.banner && !c.paused && new Date(c.from).getTime() <= now && new Date(c.to).getTime() >= now);
  const txt = promo ? (promo.type === 'pct' ? `${promo.value}% off${promo.min ? ` orders over ${money(promo.min)}` : ''} with code` : promo.type === 'cash' ? `${money(promo.value)} off with code` : 'Free delivery with code') : '';
  const key = promo ? promo.code : W.site.announceOn ? 'ann' : '';
  if (!key || closed === key) return null;
  return (
    <div role="region" aria-label={promo ? 'Discount code' : 'Announcement'} className="bg-[#f2b705] text-black text-sm px-[var(--gut)] py-2 flex items-center justify-center gap-3 text-center">
      <span className="flex-1">{promo ? <>🎉 {txt} <strong className="tracking-wider">{promo.code}</strong></> : W.site.announce}</span>
      <button onClick={() => setClosed(key)} aria-label="Close" className="w-7 h-7 rounded-full hover:bg-black/10">×</button>
    </div>
  );
}

function BizMark({ W, light = true }: { W: Web; light?: boolean }) {
  const n = bizName(W);
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      {/* light = dark header with white text: the logo's navy needs a white tile behind it to stay visible. */}
      {/* Slightly smaller on phones so the name and the header icons (search, sign in, wishlist, basket) all fit. */}
      <img src={W.site.logo || companyLogo()} alt="" className={cx('w-11 h-11 sm:w-14 sm:h-14 object-contain flex-none', light && 'bg-white rounded-xl p-1')} />
      {/* Very narrow phones (under 380px): logo only, so the name is never cut off; the home button still announces the name.
          min-w-0 + truncate stay as a safety net for unusually long names. */}
      <span className={cx('max-sm:hidden flex flex-col min-w-0 text-left font-bold text-[11px] sm:text-[13px] leading-[1.1] uppercase tracking-[.06em] sm:tracking-[.08em]', light ? 'text-white' : 'text-black')}>{n.split(/\s+/).filter(Boolean).map((w, i) => <span key={i} className="block whitespace-nowrap truncate">{w}</span>)}</span>
    </span>
  );
}

export function Header() {
  const s = useShop();
  const { W, me, count, wish, go, q, setQ } = s;
  // Christmas hat on the sign-in / account icon from 15 to 31 December.
  const hat = useMemo(() => seasonOf().hat, []);
  const [mob, setMob] = useState(false);
  const [srch, setSrch] = useState(false);
  // Store-wide results under the search box (SearchPanel): open while typing, closed after a choice or Escape.
  const [panel, setPanel] = useState(false);
  const panelRef = useRef<SearchPanelApi>(null);
  // A click anywhere outside the search row closes the results (the typed words stay).
  useEffect(() => {
    if (!panel) return;
    const off = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('#shop-search-row')) setPanel(false); };
    document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off);
  }, [panel]);
  useEffect(() => { if (srch) setTimeout(() => document.getElementById('shop-q')?.focus(), 30); }, [srch]);
  // Search row width: it starts level with the "Branches" link and ends the same distance from the right edge,
  // so it sits centred under the menu instead of running from the logo to the basket. When the menu links are
  // hidden (smaller screens) or Branches is turned off, inset stays null and the row uses the normal page margins.
  const [inset, setInset] = useState<number | null>(null);
  useEffect(() => {
    if (!srch) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>('header [data-nav="branches"]');
      const left = el && el.offsetParent ? el.getBoundingClientRect().left : 0;
      setInset(left > 0 && left < window.innerWidth / 2 ? Math.round(left) : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [srch]);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMob(false); setMenu(false); }, [loc.pathname]);
  const extra = W.pages.filter((p) => !p.builtin && !p.policy && p.live && p.inNav);
  const links: ([string, () => void] | [string, () => void, string])[] = [
    [navName(W, 'shop'), () => go('')],
    ...(['about', 'branches', 'contact'] as const).filter((k) => pageOn(W, k)).map((k) => [navName(W, k), () => go(k), k] as [string, () => void, string]),
    ...(pageOn(W, 'updates') && W.updates.some((u) => u.live) ? [[navName(W, 'updates'), () => go('updates')] as [string, () => void]] : []),
    ...(pageOn(W, 'faqs') ? [[navName(W, 'faqs'), () => go('faqs')] as [string, () => void]] : []),
    ...extra.map((p) => [p.title, () => go(`pages/${p.slug}`)] as [string, () => void]),
    [navName(W, 'track'), () => s.setMd({ k: 'look' })],
  ];
  // "See all products": filter the shop by the words and scroll to the products.
  const doSearch = () => { setPanel(false); go(''); setTimeout(() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' }), 60); };
  const menuItems: [string, string, string][] = [['My account', 'account', ''], ['Orders', 'account/orders', String(me?.orders.length || 0)], ['Addresses', 'account/addresses', String(me?.addr.length || 0)], ['Wishlist', 'account/wishlist', String(wish.length)], ['Login & security', 'account/security', ''], ['Privacy & data', 'account/privacy', '']];
  return (
    <header className="sticky top-0 z-40 text-white" style={{ background: NAVY }}>
      <div className="px-[var(--gut)] h-[72px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => setMob(!mob)} aria-label={mob ? 'Close menu' : 'Open menu'} aria-expanded={mob} aria-controls="shop-mobnav" className="xl:hidden w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center flex-none"><Svg d={mob ? 'close' : 'menu'} /></button>
          <button onClick={() => go('')} aria-label={`${bizName(W)} · home`} className="min-w-0"><BizMark W={W} /></button>
          <nav aria-label="Shop" className="hidden xl:flex items-center ml-3 min-w-0 overflow-x-auto">
            {/* Hover / keyboard focus: gold text (#d4af5a, the colour of the page-header eyebrows such as "We are here to help"). */}
            {links.map(([l, f, k]) => <button key={l} onClick={f} data-nav={k} className="text-[15px] px-3 py-3 rounded-full whitespace-nowrap transition-colors hover:text-[#d4af5a] focus-visible:text-[#d4af5a]">{l}</button>)}
          </nav>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1.5 flex-none">
          <button onClick={() => setSrch(!srch)} aria-label={srch ? 'Hide search' : 'Search the shop'} aria-expanded={srch} aria-controls="shop-search-row" className={cx('w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors', srch ? 'bg-white text-black' : 'hover:bg-white/10')}><Svg d={srch ? 'close' : 'search'} /></button>
          {/* Signed out: Sign in / Sign up as a person icon on every screen size (phone, tablet, desktop), between search
              and the wishlist; the label shows on hover and is read out by screen readers. */}
          {/* 15–31 December: a Christmas hat sits on the sign-in / account icon (components/Seasonal.tsx, lib/season.ts). */}
          {!me && <button onClick={() => s.setAuth('in')} aria-label="Sign in or sign up" title="Sign in / Sign up" className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full hover:bg-white/10 flex items-center justify-center"><Svg d="user" />{hat && <ChristmasHat size={20} className="absolute left-1/2 top-0 -translate-x-[30%] -translate-y-[2px] rotate-[14deg]" />}</button>}
          {me && (
            <div className="relative">
              <button onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-2 h-10 pl-1 pr-3 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold"><span className="relative w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold">{ini(me.name)}{hat && <ChristmasHat size={20} className="absolute left-1/2 -top-[11px] -translate-x-[20%] rotate-[14deg]" />}</span><span className="hidden sm:inline">{me.name.split(' ')[0]}</span><Svg d="chev" size={16} /></button>
              {menu && (
                <div role="menu" aria-label="Your account" className="absolute right-0 top-12 w-72 bg-white text-black rounded-3xl shadow-card border border-line p-2 z-50">
                  <div className="flex items-center gap-3 p-3 border-b border-line"><span className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold">{ini(me.name)}</span><span className="flex flex-col min-w-0"><strong className="text-sm">{me.name}</strong><span className="text-xs text-muted truncate">{me.email}</span><span className={cx('text-[11px] font-semibold', me.verified ? 'text-ok' : 'text-[#b26a00]')}>{me.verified ? '✓ Verified' : 'Email not verified'}</span></span></div>
                  {menuItems.map(([l, p, n]) => <button key={l} role="menuitem" onClick={() => go(p)} className="w-full flex justify-between px-3 py-2.5 rounded-2xl hover:bg-canvas text-sm"><span>{l}</span><span className="text-muted">{n}</span></button>)}
                  <button role="menuitem" onClick={s.signOut} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl hover:bg-canvas text-sm text-danger"><Svg d="out" size={16} />Sign out</button>
                </div>
              )}
            </div>
          )}
          {/* Signed in, tablet and desktop: a sign-out icon beside the account menu (phones sign out from the menu). */}
          {me && <button onClick={s.signOut} aria-label="Sign out" title="Sign out" className="hidden sm:flex w-11 h-11 rounded-full hover:bg-white/10 items-center justify-center"><Svg d="out" /></button>}
          <button onClick={() => s.setCd({ open: true, tab: 'wish', note: '' })} aria-label={`Wishlist, ${wish.length} saved`} title="Wishlist" className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full hover:bg-white/10 flex items-center justify-center text-xl">♡{wish.length > 0 && <span className="absolute top-0.5 right-0.5 min-w-5 h-5 px-1 rounded-full bg-danger text-[11px] font-bold flex items-center justify-center">{wish.length}</span>}</button>
          <button onClick={() => s.setCd({ open: true, tab: 'cart', note: '' })} aria-label={`Basket, ${count} items`} title="Basket" className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black flex items-center justify-center"><Svg d="bag" /><span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">{count}</span></button>
        </div>
      </div>
      {mob && (
        <nav id="shop-mobnav" aria-label="Shop menu" className="xl:hidden flex flex-col px-[var(--gut)] pb-4 gap-1 border-t border-white/10">
          {links.map(([l, f]) => <button key={l} onClick={() => { setMob(false); f(); }} className="group text-left text-[15px] py-3 border-b border-white/10 flex justify-between transition-colors hover:text-[#d4af5a]"><span>{l}</span><span className="text-white/50 group-hover:text-[#d4af5a]">›</span></button>)}
          {!me ? <button onClick={() => { setMob(false); s.setAuth('in'); }} className="mt-2 h-11 rounded-full bg-white text-black font-semibold">Sign in / Sign up</button> : <button onClick={() => { setMob(false); s.signOut(); }} className="mt-2 h-11 rounded-full border border-white/40 font-semibold">Sign out</button>}
        </nav>
      )}
      <div id="shop-search-row" className={cx('pb-3 relative', inset == null && 'px-[var(--gut)]', srch ? 'flex' : 'hidden')} style={inset != null ? { paddingLeft: inset, paddingRight: inset } : undefined}>
        <div role="search" className="w-full flex items-center gap-2 h-12 pl-4 pr-2 rounded-full bg-white text-black border-2 border-transparent transition-[border-color,box-shadow] duration-150 focus-within:border-[#0b5c5c] focus-within:shadow-[0_0_0_4px_rgba(11,92,92,0.25)]">
          <Svg d="search" size={18} className="text-muted flex-none" />
          <label htmlFor="shop-q" className="sr-only">Search the shop</label>
          <input id="shop-q" autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPanel(true); }} onFocus={() => setPanel(true)} onKeyDown={(e) => { if (panel && panelRef.current?.key(e)) return; if (e.key === 'Enter') doSearch(); if (e.key === 'Escape') { if (panel) setPanel(false); else setSrch(false); } }} placeholder="Search products, help, policies and more" aria-autocomplete="list" aria-expanded={panel && q.trim().length >= 2} className="flex-1 min-w-0 bg-transparent border-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 text-[15px]" />
          {q && <button onClick={() => setQ('')} className="text-sm text-muted px-2 underline">Clear</button>}
        </div>
        {/* Everything on the store: products, Help & policies, FAQs, branches, pages and news (search.ts). */}
        {srch && panel && <div className={cx('absolute top-full -mt-2', inset == null ? 'left-[var(--gut)] right-[var(--gut)]' : '')} style={inset != null ? { left: inset, right: inset } : undefined}><SearchPanel ref={panelRef} q={q} onAll={doSearch} onClose={() => { setPanel(false); setSrch(false); }} /></div>}
      </div>
    </header>
  );
}

const SOC: [string, string][] = [['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['whatsapp', 'WhatsApp'], ['youtube', 'YouTube'], ['x', 'X']];
const socHref = (k: string, v: string) => (!v ? '#' : /^https?:\/\//.test(v) ? v : k === 'whatsapp' ? waHref(v) : `https://www.${k === 'x' ? 'x' : k}.com/${v.replace(/^@/, '')}`);

/**
 * Premium store footer: deep navy with a gold hairline, four columns (brand + social, Explore + email offers,
 * Help & policies, main shop + map) and a bottom bar (MNEST Systems 2026 · payment methods · Powered by).
 */
export function Footer() {
  const { W, go, say, setCookies, setMd } = useShop();
  const [email, setEmail] = useState('');
  const [nm, setNm] = useState('');
  const main = BR_INFO[0];
  const mainW = W.branches[main.id];
  const n = bizName(W);
  const pol = W.pages.filter((p) => p.policy || (!p.builtin && p.live && p.inFooter));
  const explore = (['about', 'branches', 'contact', 'careers', 'faqs', 'reviews', 'updates'] as const).filter((k) => pageOn(W, k));
  const GOLD = '#d4af5a';
  const head = 'text-[11px] font-semibold uppercase tracking-[.22em]';
  const link = 'text-left text-[14px] text-white/75 w-fit transition-colors hover:text-[#d4af5a] focus-visible:text-[#d4af5a]';
  // Phones only: which link section is open (Explore / Help & policies fold away so the footer stays short).
  const [acc, setAcc] = useState('');
  const exploreItems: [string, () => void][] = explore.map((k) => [navName(W, k), () => go(k)]);
  const helpItems: [string, () => void][] = [['Track your order', () => setMd({ k: 'look' })], ...pol.map((p): [string, () => void] => [p.title, () => go(`pages/${p.slug}`)]), ['Cookie settings', () => setCookies('')]];
  /** One fold-away link section for phones: a full-width row with a chevron, opening to a two-column list. */
  const accRow = (id: string, title: string, items: [string, () => void][]) => {
    const on = acc === id;
    return (
      <div key={id} className="border-b border-white/10">
        <button onClick={() => setAcc(on ? '' : id)} aria-expanded={on} aria-controls={`ft-${id}`} className="w-full flex items-center justify-between py-4 text-left">
          <span className={head} style={{ color: GOLD }}>{title}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx('text-white/70 transition-transform duration-200', on && 'rotate-180')}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {/* Shown/hidden by class: a `hidden` attribute would lose to the `grid` display class. */}
        <div id={`ft-${id}`} className={cx('pb-5 grid-cols-2 gap-x-4 gap-y-3', on ? 'grid' : 'hidden')}>{items.map(([l, f]) => <button key={l} onClick={f} className={link}>{l}</button>)}</div>
      </div>
    );
  };
  // Email offers field + Join button, shared by the desktop column and the phone card.
  const newsRow = (
    <>
      <div className="flex items-center gap-1 h-12 pl-4 pr-1 rounded-full bg-white/[.07] ring-1 ring-white/15 focus-within:ring-[#d4af5a] transition-shadow"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email for offers" className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/40 outline-none focus-visible:outline-none" /><button onClick={() => { if (!/^\S+@\S+\.\S+$/.test(email)) return setNm('Type a valid email address.'); setNm('Thanks · you will get our offers by email.'); setEmail(''); }} className="h-10 px-4 rounded-full text-sm font-semibold text-black" style={{ background: GOLD }}>Join</button></div>
      {nm && <span role="status" className="text-xs text-white/70">{nm}</span>}
    </>
  );
  return (
    <footer className="relative text-white mt-16" style={{ background: 'linear-gradient(180deg, #16123a 0%, #0b0920 100%)' }}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
      {/* Phones (under 640px): one centred column · brand, email offers card, fold-away link sections, main shop card.
          Tablet and desktop: the columns grid, unchanged. Phone-only and desktop-only blocks use sm:hidden / hidden sm:flex. */}
      <div className="px-[var(--gut)] pt-12 sm:pt-14 pb-10 grid gap-8 sm:gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_auto] items-start">
        {/* Brand: logo, name, location line, short about, social icons (centred on phones). */}
        <div className="flex flex-col gap-4 min-w-0 max-sm:items-center max-sm:text-center">
          <span className="flex items-center gap-3 max-sm:flex-col max-sm:gap-2.5"><img src={W.site.logo || companyLogo()} alt="" className="w-12 h-12 max-sm:w-16 max-sm:h-16 object-contain bg-white rounded-2xl p-1.5" /><span className="flex flex-col max-sm:items-center"><span className="text-lg max-sm:text-xl font-semibold leading-tight" aria-label={n}>{n}</span>{W.site.footerLine && <span className="text-xs" style={{ color: GOLD }}>{W.site.footerLine}</span>}</span></span>
          {/* Short about text, address and hours are full white (requested) so they read clearly on the dark footer. */}
          {W.about.short && <p className="m-0 text-sm leading-6 text-white max-w-sm line-clamp-4">{W.about.short}</p>}
          <div className="flex flex-col gap-2.5 max-sm:items-center">
            <span className={head} style={{ color: GOLD }}>Follow us</span>
            <div className="flex gap-2 flex-wrap max-sm:justify-center">
              {SOC.map(([k, l]) => (
                <a key={k} href={socHref(k, W.site.social[k])} target="_blank" rel="noopener" aria-label={`${n} on ${l}`} title={l} onClick={(e) => { if (!W.site.social[k]) { e.preventDefault(); say(`${l} link not set yet · add it in Post to online`); } }} className={cx('w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ring-1 ring-white/15 transition-shadow hover:ring-[#d4af5a]', !W.site.social[k] && 'opacity-50')}>
                  {k === 'x' ? <span className="w-10 h-10 rounded-full bg-black text-white font-bold flex items-center justify-center">X</span> : <img src={`/assets/social/${k}.png`} alt="" width={40} height={40} />}
                </a>
              ))}
            </div>
          </div>
          {W.site.trustpilot && <a href={W.site.trustpilot} target="_blank" rel="noopener" className={link}>★ Review us on Trustpilot</a>}
        </div>
        {/* Phones: email offers as a full-width card under the brand. */}
        {W.site.newsOn !== false && (
          <div className="sm:hidden rounded-3xl bg-white/[.05] ring-1 ring-white/10 p-5 flex flex-col gap-2.5 text-center">
            <span className="text-base font-semibold">Get offers by email</span>
            <span className="text-xs text-white -mt-1">Weekly deals and new stock. Unsubscribe any time.</span>
            {newsRow}
          </div>
        )}
        {/* Phones: Explore and Help & policies fold away (tap a row to open it). */}
        <div className="sm:hidden border-t border-white/10">
          {accRow('explore', 'Explore', exploreItems)}
          {accRow('help', 'Help & policies', helpItems)}
        </div>
        {/* Tablet and desktop: Explore, with the email offers sign-up underneath (kept here as requested). */}
        <div className="hidden sm:flex flex-col gap-4">
          <nav aria-label="Store pages" className="flex flex-col gap-2.5">
            <span className={head} style={{ color: GOLD }}>Explore</span>
            {explore.map((k) => <button key={k} onClick={() => go(k)} className={link}>{navName(W, k)}</button>)}
          </nav>
          {W.site.newsOn !== false && (
            <div className="flex flex-col gap-2 mt-2 w-full max-w-xs">
              <span className="text-sm font-semibold">Get offers by email</span>
              <span className="text-xs text-white">Weekly deals and new stock. Unsubscribe any time.</span>
              {newsRow}
            </div>
          )}
        </div>
        {/* Help & policies: order help, every store policy and the cookie settings. */}
        <nav aria-label="Help and policies" className="hidden sm:flex flex-col gap-2.5">
          <span className={head} style={{ color: GOLD }}>Help &amp; policies</span>
          <button onClick={() => setMd({ k: 'look' })} className={link}>Track your order</button>
          {pol.map((p) => <button key={p.slug} onClick={() => go(`pages/${p.slug}`)} className={link}>{p.title}</button>)}
          {/* Reopens the cookie banner so visitors can change their choice (promised in the Cookies policy). */}
          <button onClick={() => setCookies('')} className={link}>Cookie settings</button>
        </nav>
        {/* Main shop block. Its width is set by the "<business> · <branch>" heading alone: every other line uses
            w-0 min-w-full (fills the block without widening it), so the map runs exactly from the heading's
            first letter to the last letter of the branch name. Longer lines wrap within that width. */}
        {/* Phones: a full-width, centred card, so the map spans the screen. */}
        <div className="inline-flex flex-col gap-1.5 w-fit lg:justify-self-end lg:text-right max-sm:w-full max-sm:items-center max-sm:text-center max-sm:rounded-3xl max-sm:bg-white/[.04] max-sm:ring-1 max-sm:ring-white/10 max-sm:p-5">
          <span className={cx('w-0 min-w-full', head)} style={{ color: GOLD }}>Visit our main shop</span>
          <strong className="whitespace-nowrap max-sm:whitespace-normal mt-1">{n} · {main.short}</strong>
          <span className="w-0 min-w-full text-sm text-white">{main.address}</span>
          {/* Opening hours: one line per "·" part (e.g. "Mon–Sat 7:30–21:00" / "Sun 10:00–18:00") so times never split mid-range. */}
          <span className="w-0 min-w-full text-sm text-white flex flex-col">{(mainW?.hours || main.open).split(/\s*·\s*/).map((t) => <span key={t}>{t}</span>)}</span>
          <div className="w-0 min-w-full flex flex-wrap gap-x-3 gap-y-1 mt-1 lg:justify-end max-sm:justify-center"><a href={dirHref(main.address)} target="_blank" rel="noopener" className="text-sm text-white underline underline-offset-4 decoration-white/30 hover:text-[#d4af5a] hover:decoration-[#d4af5a]">Get directions</a><a href={mainW?.map || mapsHref(main.address)} target="_blank" rel="noopener" className="text-sm text-white underline underline-offset-4 decoration-white/30 hover:text-[#d4af5a] hover:decoration-[#d4af5a]">Open in Google Maps</a></div>
          <div role="region" aria-label="Map of our main shop" className="w-0 min-w-full mt-3 rounded-3xl max-sm:rounded-2xl overflow-hidden h-44 max-sm:h-48 bg-white/5 ring-1 ring-white/10">
            <span className="sr-only">Map of {main.address}</span>
            <iframe src={embedHref(main.address)} title={`Map of ${n}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen className="w-full h-full border-0" />
          </div>
        </div>
      </div>
      {/* Bottom bar: copyright line, accepted payments, platform credit · all text in white. */}
      {/* Phones: centred and stacked, with extra bottom space so the floating chat button never covers the credit. */}
      <div className="border-t border-white/10 px-[var(--gut)] py-5 max-sm:pb-24 grid gap-3 md:grid-cols-[auto_1fr_auto] items-center text-[12.5px] text-white max-md:justify-items-center">
        <span className="max-md:order-3">MNEST Systems 2026</span>
        {/* Accepted payment methods: desktop and tablet only (hidden on phones to keep the footer short). */}
        <div className="hidden md:flex gap-1.5 flex-wrap justify-center items-center" aria-label="Payment methods we accept"><span className="mr-1">We accept</span>{['MTN MoMo', 'Telecel Cash', 'AirtelTigo', 'Visa', 'Mastercard', 'Bank transfer'].map((m) => <span key={m} className="px-2.5 py-1 rounded-full bg-white/[.06] ring-1 ring-white/15 text-[11px] text-white">{m}</span>)}</div>
        {/* "Powered by" credit: the MNEST Systems wordmark (lib/brand POWERED_BY_LOGO; always the platform's own logo,
            never the store's) on a small white tile, because its navy lettering would disappear on the dark footer. If
            that image is missing it falls back to COMPANY_LOGO. The alt text keeps the name for screen readers. */}
        <span className="inline-flex items-center gap-2">Powered by<span className="inline-flex items-center justify-center rounded-md bg-white px-1 py-0.5 ring-1 ring-white/20"><img src={POWERED_BY_LOGO} alt="MNEST Systems" onError={(e) => { if (!e.currentTarget.src.endsWith(COMPANY_LOGO)) e.currentTarget.src = COMPANY_LOGO; }} className="h-7 w-auto" /></span></span>
      </div>
    </footer>
  );
}

export function Overlays() {
  const { W, cookies, setCookies, toast, setToast, say } = useShop();
  const [train] = usePersist('ecompos.training2', { on: false });
  const [xmas, setXmas] = useState(() => new Date().getMonth() === 11);
  return (
    <>
      {/* "Install the app" pop-up: waits until the cookie choice is made, so the two never overlap. */}
      <StoreInstall name={bizName(W)} ready={!!cookies} onInstalled={() => say(`${bizName(W)} is installed · open it from your home screen or desktop`)} />
      {/* The floating WhatsApp button was removed: the shop assistant (bottom right) offers WhatsApp and calls in its replies. */}
      {!cookies && (
        <div role="dialog" aria-label="Cookies" className="fixed left-4 right-4 bottom-4 sm:left-auto sm:max-w-md z-50 bg-white text-black rounded-3xl shadow-card border border-line p-4 flex flex-col gap-3">
          <span className="text-sm">🍪 We use a few cookies to keep your basket and sign-in working. With your permission we also use analytics cookies to improve the store.</span>
          <div className="flex gap-2 justify-end"><button onClick={() => setCookies('essential')} className="h-10 px-4 rounded-full border border-line text-sm font-semibold">Essential only</button><button onClick={() => setCookies('all')} className="h-10 px-4 rounded-full bg-black text-white text-sm font-semibold">Accept all</button></div>
        </div>
      )}
      {/* Shop assistant chat (Chat.tsx): bottom right. */}
      <ChatAssistant />
      <NoticeModal msg={toast?.t || ''} onClose={() => setToast(null)} />
      <AddedModal />
      {train.on && <div role="status" className="fixed top-0 inset-x-0 z-[90] bg-danger text-white text-center text-xs font-bold tracking-wider py-1">TRAINING MODE · practice data only, not for real sales</div>}
      {xmas && <div role="status" className="fixed left-1/2 -translate-x-1/2 top-24 z-[70] bg-[#c62828] text-white rounded-full pl-5 pr-2 py-2 flex items-center gap-3 shadow-card"><span className="text-sm font-semibold">🎄 Merry Christmas from all of us! 🎅</span><button onClick={() => setXmas(false)} aria-label="Close the Christmas balloons" className="w-7 h-7 rounded-full hover:bg-white/15">×</button></div>}
    </>
  );
}

/**
 * "Added to cart" pop-up: after a shopper adds an item the cart drawer stays closed and this card confirms it
 * ("{item} added to cart") with two buttons: Continue shopping (closes it) and Go to cart (opens the cart).
 * Escape or a click outside closes it; focus starts on Go to cart and returns where it was when it closes.
 */
function AddedModal() {
  const { added, setAdded, setCd, count } = useShop();
  const goRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!added) return;
    const back = document.activeElement as HTMLElement | null;
    goRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdded(null); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [added, setAdded]);
  if (!added) return null;
  const close = () => setAdded(null);
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={close}>
      <section role="dialog" aria-modal="true" aria-labelledby="added-h" onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] bg-white text-black rounded-[28px] p-6 flex flex-col gap-4 shadow-card">
        <div className="flex items-center gap-4">
          <span className="relative w-16 h-16 rounded-2xl overflow-hidden flex-none flex items-center justify-center" style={{ background: added.tone || '#f2f4f5' }}>
            {added.img && <img src={added.img} alt="" className="w-full h-full object-cover" />}
            <span aria-hidden className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full bg-[#1f7a2a] border-2 border-white flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          </span>
          <span className="flex flex-col min-w-0">
            <h2 id="added-h" className="m-0 text-[17px] font-semibold leading-snug">{added.name} added to cart</h2>
            <span className="text-sm text-muted">{added.sub} · {count} item{count === 1 ? '' : 's'} in your cart</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={close} className="h-12 rounded-full border border-black text-sm font-semibold">Continue shopping</button>
          <button ref={goRef} type="button" onClick={() => { close(); setCd({ open: true, tab: 'cart', note: '' }); }} className="h-12 rounded-full bg-black text-white text-sm font-semibold">Go to cart</button>
        </div>
      </section>
    </div>
  );
}

export function Crumb({ items }: { items: [string, string | null][] }) {
  const { go } = useShop();
  return <nav aria-label="Breadcrumb" className="text-sm text-muted flex gap-2 flex-wrap">{items.map(([l, p], i) => <span key={i} className="flex gap-2">{i > 0 && <span>/</span>}{p != null ? <button onClick={() => go(p)} className="underline underline-offset-2 hover:text-black">{l}</button> : <span className="text-black">{l}</span>}</span>)}</nav>;
}
