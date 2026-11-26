import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { navName } from '../../data/web';
import { readKey, writeKey } from '../../lib/persist';
import { cx } from '../../lib/format';
import { useShop } from './ctx';
import { ReviewsBand, UpdateCard } from './Home';
import { ProductCard } from './Product';
import { Crumb, bizName, pageOn } from './Shell';
import { BR_INFO, mapsHref, money, paras, tokensOf, waHref, type BrInfo } from './model';
import { fillTokens, toBlocks, type Block } from '../../data/policies';
import NoticeModal from '../../components/Notice';

const H1 = 'm-0 text-[32px] sm:text-[40px] font-semibold tracking-tight';

const GOLD = '#d4af5a';
const SHADOW = 'shadow-[0_1px_2px_rgba(0,0,0,.04),0_18px_40px_-28px_rgba(0,0,0,.35)]';
const CARD = `rounded-[24px] bg-white ring-1 ring-black/[.07] ${SHADOW}`;
/** Premium page header used by Branches, About, Contact, Updates and FAQs. */
function PageHero({ eyebrow, title, text, children }: { eyebrow: string; title: string; text?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-[28px] px-6 sm:px-10 py-8 sm:py-12 text-white flex flex-col gap-5" style={{ background: 'radial-gradient(120% 140% at 100% 0%, #2a2350 0%, #16123a 45%, #0b0920 100%)' }}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
      <span aria-hidden className="absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-[.08]" style={{ background: GOLD }} />
      <div className="relative flex flex-col gap-2 max-w-3xl">
        <span className="text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color: GOLD }}>{eyebrow}</span>
        <h1 className={cx(H1, 'text-white')}>{title}</h1>
        {text && <div className="m-0 text-base sm:text-lg text-white/75 leading-relaxed">{text}</div>}
      </div>
      {children && <div className="relative">{children}</div>}
    </header>
  );
}
const Glyph = ({ d, size = 18 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none"><path d={d} /></svg>;
const G = {
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  eye: 'M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
  check: 'M20 6 9 17l-5-5',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4l2.7.7a2 2 0 0 1 1.9 2Z',
  chat: 'M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.5 8.5 0 1 1 21 11.5Z',
  mail: 'M4 5h16v14H4zM4 7l8 6 8-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  bag: 'M6 7h12l-1 13H7L6 7Zm3 0a3 3 0 0 1 6 0',
  box: 'M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  card: 'M3 6h18v12H3zM3 10h18',
  tv: 'M3 5h18v12H3zM8 21h8M12 17v4',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  user: 'M16 20v-1a4 4 0 0 0-8 0v1M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
};
const Wrap = ({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) => <main className={cx('px-[var(--gut)] py-8 flex flex-col gap-6', narrow && 'max-w-4xl')}>{children}</main>;

export function About() {
  const { W, go } = useShop();
  const A = W.about;
  const avm = ([[G.target, 'Our aim', A.aim], [G.eye, 'Our vision', A.vision], [G.compass, 'Our mission', A.mission]] as [string, string, string][]).filter((x) => x[2]);
  const values = String(A.values || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const pics = (A.photos || []).filter(Boolean);
  return (
    <Wrap>
      <Crumb items={[['Home', ''], [A.title, null]]} />
      <PageHero eyebrow={A.founded ? `Since ${A.founded}` : 'Who we are'} title={A.title} text={A.short} />
      <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] items-center">
        <div className="flex flex-col gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">Our story</span>
          <h2 className="m-0 text-[26px] sm:text-[30px] font-semibold tracking-tight leading-tight">{A.storyTitle || 'Our story'}</h2>
          {paras(A.story).map((p, i) => <p key={i} className={cx('m-0 leading-7', i === 0 ? 'text-lg text-black' : 'text-base text-sub')}>{p}</p>)}
        </div>
        <div className="relative">
          {pics[0] ? <img src={pics[0]} alt="Our shop" className={cx('w-full h-80 object-cover rounded-[28px]', SHADOW)} /> : <div className="w-full h-80 rounded-[28px] flex items-center justify-center text-sm text-muted" style={{ background: 'linear-gradient(135deg,#eef0f1,#dde1e4)' }}>Shop photo</div>}
          {A.founded && <span className="absolute -bottom-4 left-6 px-4 py-2 rounded-full bg-black text-white text-sm font-semibold shadow-lg">Founded {A.founded}</span>}
        </div>
      </section>
      {avm.length > 0 && <section aria-label="Aim, vision and mission" className="grid gap-4 md:grid-cols-3 pt-4">{avm.map(([ic, k, t]) => <div key={k} className={cx(CARD, 'p-6 flex flex-col gap-3 transition-transform hover:-translate-y-0.5')}><span className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center"><Glyph d={ic} /></span><strong className="text-lg">{k}</strong><p className="m-0 text-sm leading-6 text-sub">{t}</p></div>)}</section>}
      {values.length > 0 && <section className="flex flex-col gap-4"><div><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">Our values</span><h2 className="m-0 text-[26px] font-semibold tracking-tight">What we stand for</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{values.map((v) => <div key={v} className={cx(CARD, 'px-5 py-4 text-sm flex items-start gap-3')}><span className="w-7 h-7 rounded-full flex items-center justify-center flex-none" style={{ background: '#e7f4e8', color: '#1f7a2a' }}><Glyph d={G.check} size={15} /></span><span className="pt-1">{v}</span></div>)}</div></section>}
      {pics.length > 1 && <section aria-label="Pictures of our business" className="grid gap-3 grid-cols-2 md:grid-cols-4">{pics.slice(1).map((u, i) => <img key={i} src={u} alt={`Picture ${i + 2} of our business`} className="w-full h-44 object-cover rounded-[20px] hover:scale-[1.02] transition-transform" />)}</section>}
      {/* Visit our branches: every shown branch with how to find it, when it is open and what it offers. */}
      {pageOn(W, 'branches') && (
        <section aria-labelledby="ab-visit" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1"><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">Visit us</span><h2 id="ab-visit" className="m-0 text-[26px] font-semibold tracking-tight">Visit our branches</h2><p className="m-0 text-sm text-sub max-w-3xl">Every branch carries our full range at the same prices as online. Shop in person, collect an online order for free, buy wholesale by the carton, apply for hire purchase or return an item at whichever branch is closest to you.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {BR_INFO.filter((b) => W.branches[b.id]?.show !== false).map((b) => { const w = W.branches[b.id]; return (
              <article key={b.id} className={cx(CARD, 'p-5 flex flex-col gap-3')}>
                <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center"><Glyph d={G.pin} /></span><div className="min-w-0"><strong className="block text-[15px]">{b.name}</strong><span className="text-xs text-muted">GhanaPostGPS {b.gps}</span></div></div>
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5 text-sm text-sub">
                  <li className="flex gap-2"><Glyph d={G.pin} size={15} /><span>{b.address}{w?.landmark ? ` · ${w.landmark}` : ''}</span></li>
                  <li className="flex gap-2"><Glyph d={G.clock} size={15} /><span>{w?.hours || b.open}</span></li>
                  <li className="flex gap-2"><Glyph d={G.phone} size={15} /><a href={`tel:${b.phone.replace(/\s/g, '')}`} className="hover:underline">{b.phone}</a></li>
                </ul>
                {w?.services && <div className="flex gap-1.5 flex-wrap">{String(w.services).split(/[·,•|]/).map((x) => x.trim()).filter(Boolean).map((x) => <span key={x} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#f2f4f5] text-[#3d3a38]">{x}</span>)}</div>}
                <div className="mt-auto flex gap-2 pt-1"><a href={w?.map || mapsHref(b.address)} target="_blank" rel="noopener" className="flex-1 h-10 rounded-full border border-line text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-black hover:text-black">Directions</a><button onClick={() => go('branches')} className="flex-1 h-10 rounded-full bg-black text-white text-sm font-semibold">Shop this branch</button></div>
              </article>
            ); })}
          </div>
        </section>
      )}
    </Wrap>
  );
}

const IC: Record<string, string> = {
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4l2.7.7a2 2 0 0 1 1.9 2Z',
  mail: 'M4 5h16v14H4zM4 7l8 6 8-6',
  user: 'M16 20v-1a4 4 0 0 0-8 0v1M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  flag: 'M5 21V4h11l-1.5 4L16 12H5',
  car: 'M5 17h14M6 17l1.5-6h9L18 17M7 17v2m10-2v2M8 14h.01M16 14h.01',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  card: 'M3 6h18v12H3zM3 10h18',
};
const Ico = ({ d, size = 16 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none"><path d={IC[d]} /></svg>;

/**
 * Phones only: a filter as one dropdown instead of a row of chips (the chips wrap onto several lines on a small screen).
 * Inputs: label (read by screen readers), the options as [value, text, count], the current value and onChange.
 */
function MobileFilter({ label, opts, value, onChange }: { label: string; opts: [string, string, number][]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="sm:hidden relative block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none w-full h-12 pl-5 pr-12 rounded-full bg-white border border-black/15 text-[15px] font-medium focus:outline-none focus:border-black">
        {opts.map(([v, t, n]) => <option key={v} value={v}>{t} ({n})</option>)}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black/70"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
    </label>
  );
}

function BranchCard({ b, sel, pick }: { b: BrInfo; sel: boolean; pick: () => void }) {
  const { W } = useShop();
  const w = W.branches[b.id];
  const pics = (w?.photos || []).filter(Boolean);
  const [i, setI] = useState(0);
  // Phones: only the first 3 details show until "More details" is tapped, to keep each card short.
  const [more, setMore] = useState(false);
  const tones = ['linear-gradient(135deg,#e7ece6,#d5ddd3)', 'linear-gradient(135deg,#eee6dc,#ddd0c0)', 'linear-gradient(135deg,#e6eaee,#d3dae0)'];
  const gal = pics.length ? pics : [null, null, null];
  const services = String(w?.services || '').split(/[·,•|]/).map((x) => x.trim()).filter(Boolean);
  const rows: [string, string, React.ReactNode][] = ([
    ['clock', 'Hours', w?.hours || b.open], ['phone', 'Phone', b.phone ? <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="hover:underline">{b.phone}</a> : ''],
    ['mail', 'Email', w?.email ? <a href={`mailto:${w.email}`} className="hover:underline [overflow-wrap:anywhere]">{w.email}</a> : ''], ['user', 'Branch manager', w?.manager],
    ['flag', 'Find us', w?.landmark], ['car', 'Parking', w?.parking], ['truck', 'We deliver to', w?.areas], ['card', 'Pay with', w?.pays],
  ] as [string, string, React.ReactNode][]).filter((r) => r[2]);
  return (
    <article role="listitem" className={cx('group rounded-[28px] bg-white overflow-hidden flex flex-col transition-all duration-200', sel ? 'ring-2 ring-black shadow-[0_24px_48px_-24px_rgba(0,0,0,.45)]' : 'ring-1 ring-black/[.08] shadow-[0_1px_2px_rgba(0,0,0,.04),0_18px_40px_-28px_rgba(0,0,0,.35)] hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,.4)]')}>
      <div className="relative h-40 sm:h-56 mx-2.5 sm:mx-3 mt-2.5 sm:mt-3 rounded-[18px] sm:rounded-[20px] overflow-hidden">
        {gal[i] ? <img src={gal[i] as string} alt={`${b.name} branch, picture ${i + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="w-full h-full flex items-center justify-center text-sm text-muted" style={{ background: tones[i % 3] }}>{b.short} branch · picture {i + 1}</div>}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        {gal.length > 1 && <>
          <button onClick={() => setI((i - 1 + gal.length) % gal.length)} aria-label={`Previous picture of ${b.name}`} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur text-lg shadow">‹</button>
          <button onClick={() => setI((i + 1) % gal.length)} aria-label={`Next picture of ${b.name}`} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur text-lg shadow">›</button>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex gap-1.5" aria-hidden>{gal.map((_, k) => <span key={k} className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/60')} />)}</div>
        </>}
      </div>
      <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">{b.short} branch</span>
            <h3 className="m-0 text-lg sm:text-[22px] font-semibold tracking-tight leading-tight">{b.name}</h3>
          </div>
          {sel && <span className="flex-none text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black text-white">Selected</span>}
        </div>
        <div className="flex gap-2.5 text-sm text-sub"><span className="mt-0.5 text-black"><Ico d="pin" /></span><span className="flex flex-col"><span>{b.address}</span><span className="text-xs text-muted">GhanaPostGPS {b.gps}</span></span></div>
        {services.length > 0 && <div className="flex gap-1.5 flex-wrap">{services.map((x) => <span key={x} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#f2f4f5] text-[#3d3a38]">{x}</span>)}</div>}
        <dl className="m-0 grid gap-x-5 gap-y-2.5 sm:gap-y-3 sm:grid-cols-2 pt-3 sm:pt-4 border-t border-line">
          {rows.map(([ic, k, v], n) => <div key={k} className={cx('flex gap-2.5 min-w-0', n >= 3 && !more && 'max-sm:hidden')}><span className="mt-0.5 w-7 h-7 rounded-full bg-[#f2f4f5] text-black flex items-center justify-center flex-none"><Ico d={ic} size={14} /></span><div className="min-w-0"><dt className="text-[11px] text-muted">{k}</dt><dd className="m-0 text-sm leading-snug">{v}</dd></div></div>)}
        </dl>
        {w?.note && <p className={cx('m-0 text-sm text-sub rounded-2xl bg-[#f7f7f5] px-4 py-3', !more && 'max-sm:hidden')}>{w.note}</p>}
        {(rows.length > 3 || w?.note) && <button onClick={() => setMore(!more)} aria-expanded={more} className="sm:hidden w-fit text-sm font-semibold underline underline-offset-4">{more ? 'Fewer details' : 'More details'}</button>}
        <div className="mt-auto flex flex-col gap-2 pt-1 sm:pt-2">
          <button onClick={pick} aria-pressed={sel} aria-controls="br-prods" className={cx('h-11 sm:h-12 rounded-full font-semibold text-sm transition-colors', sel ? 'bg-black text-white' : 'bg-black text-white hover:bg-[#222]')}>{sel ? '✓ Showing this branch' : 'Shop this branch'}</button>
          <div className="flex gap-2"><a href={w?.map || mapsHref(b.address)} target="_blank" rel="noopener" className="flex-1 h-10 sm:h-11 rounded-full border border-line text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-black"><Ico d="pin" size={15} />Directions</a>{w?.whatsapp && <a href={waHref(w.whatsapp, `Hello ${b.short} branch`)} target="_blank" rel="noopener" className="flex-1 h-10 sm:h-11 rounded-full bg-[#25d366] text-white text-sm font-semibold flex items-center justify-center hover:text-white hover:opacity-90">WhatsApp</a>}</div>
        </div>
      </div>
    </article>
  );
}

export function Branches() {
  const { W, products } = useShop();
  const shown = BR_INFO.filter((b) => W.branches[b.id]?.show !== false);
  const [sel, setSel] = useState(shown[0]?.id ?? 'osu');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const b = BR_INFO.find((x) => x.id === sel) ?? BR_INFO[0];
  const items = products.filter((p) => p.stock[sel] != null && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const inSt = items.filter((p) => (p.stock[sel] ?? 0) > 0).length;
  const list = all || q ? items : items.slice(0, 8);
  return (
    <Wrap>
      <Crumb items={[['Home', ''], [navName(W, 'branches'), null]]} />
      <PageHero eyebrow="Visit us" title="Our branches" text="Shop in person, collect your online order or buy wholesale at any of our branches. Prices are the same in every branch and online." />
      <div role="list" aria-label="Branches" className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">{shown.map((x) => <BranchCard key={x.id} b={x} sel={sel === x.id} pick={() => { setSel(x.id); setAll(false); setTimeout(() => document.getElementById('br-prods')?.scrollIntoView({ behavior: 'smooth' }), 40); }} />)}</div>
      {/* What every branch offers, then practical tips for visiting. */}
      <section aria-labelledby="br-every" className="flex flex-col gap-4 pt-2">
        <div><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">At every branch</span><h2 id="br-every" className="m-0 text-[26px] font-semibold tracking-tight">What you can do when you visit</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([[G.bag, 'Shop the full range', 'TVs, fridges, air conditioners, freezers, fans, sound and DStv, at exactly the same prices as online.'],
            [G.box, 'Free click and collect', 'Order online and collect at the branch you choose, usually ready within 2 hours. Bring your collection code.'],
            [G.truck, 'Wholesale by the carton', 'Lower prices per piece when you buy by the carton or crate. Ask about a business account for regular orders.'],
            [G.tv, 'Hire purchase', 'Take home a TV, fridge, freezer or cooker today and pay over 3, 6 or 12 months. Bring your Ghana Card to apply.'],
            [G.refresh, 'Returns and exchanges', 'Return or exchange unused items within 7 days at any branch, whether you bought them online or in store.'],
            [G.card, 'Pay your way', 'Cash, Mobile Money (MTN, Telecel, AirtelTigo) and card. Ask for a VAT receipt with your business name and TIN.'],
          ] as [string, string, string][]).map(([ic, t, d]) => <div key={t} className={cx(CARD, 'p-5 flex gap-4')}><span className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center flex-none"><Glyph d={ic} /></span><span className="flex flex-col gap-1"><strong className="text-[15px]">{t}</strong><span className="text-sm text-sub leading-6">{d}</span></span></div>)}
        </div>
        {/* Plan your visit: premium dark panel (same look as the page headers) with six tip tiles. */}
        <div className="relative overflow-hidden rounded-[28px] p-6 sm:p-10 text-white grid gap-8 lg:grid-cols-[1fr_2fr] items-start" style={{ background: 'radial-gradient(120% 140% at 100% 0%, #2a2350 0%, #16123a 45%, #0b0920 100%)' }}>
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
          <span aria-hidden className="absolute -left-20 -bottom-24 w-64 h-64 rounded-full opacity-[.06]" style={{ background: GOLD }} />
          <div className="relative flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color: GOLD }}>Plan your visit</span>
            <h3 className="m-0 text-[26px] sm:text-[30px] font-semibold tracking-tight leading-tight">Make your trip quick and easy</h3>
            <p className="m-0 text-sm sm:text-base text-white/70 leading-relaxed">A few tips from our branch teams, so you spend less time waiting and more time getting what you came for.</p>
          </div>
          <ul className="relative m-0 p-0 list-none grid gap-3 sm:grid-cols-2">
            {([[G.clock, 'Quietest times', 'Weekday mornings before 11:00. Saturdays and month-end are the busiest.'],
              [G.box, 'Collecting an order', 'Bring your collection code or order number and the phone number you ordered with.'],
              [G.truck, 'Buying in bulk', 'Call or WhatsApp the branch ahead and we will have your cartons packed and ready.'],
              [G.tv, 'Hire purchase', 'Bring your Ghana Card, proof of address and your deposit. Approval usually takes under an hour.'],
              [G.pin, 'Getting there', 'Each branch card shows the landmark, parking and a Directions button for Google Maps.'],
              [G.chat, 'Help in store', 'Ask any team member. We speak English and Twi, and we are happy to help.'],
            ] as [string, string, string][]).map(([ic, t, d]) => (
              <li key={t} className="flex gap-3.5 rounded-2xl p-4 bg-white/[.05] ring-1 ring-white/10 transition-colors hover:bg-white/[.08]">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-none ring-1" style={{ color: GOLD, background: 'rgba(212,175,90,.12)', borderColor: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(212,175,90,.35)' }}><Glyph d={ic} /></span>
                <span className="flex flex-col gap-1 min-w-0"><strong className="text-[15px] font-semibold">{t}</strong><span className="text-sm text-white/65 leading-6">{d}</span></span>
              </li>))}
          </ul>
        </div>
      </section>
      <section id="br-prods" aria-labelledby="brp-h" className="flex flex-col gap-4 pt-6 scroll-mt-40">
        <div className="flex justify-between items-end gap-3 flex-wrap"><div><h2 id="brp-h" className="m-0 text-2xl font-semibold">Products at {b.name}</h2><span className="text-sm text-muted">{inSt} of {items.length} in stock · stock updates as the branch sells</span></div><div role="search" className="w-64 max-w-full h-11 px-4 rounded-full border border-line flex items-center gap-2 focus-within:border-[#0b5c5c]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted flex-none" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this branch" aria-label={`Search products at ${b.name}`} className="flex-1 min-w-0 bg-transparent outline-none text-sm" /></div></div>
        {!items.length && <p className="m-0 text-sm text-muted">No products match at this branch.</p>}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{list.map((p) => <ProductCard key={p.id} p={p} brId={sel} />)}</div>
        {!q && items.length > 8 && <button onClick={() => setAll(!all)} className="self-center h-11 px-6 rounded-full border border-black text-sm font-semibold hover:bg-black hover:text-white">{all ? 'Show fewer' : `Show all ${items.length} products at ${b.short}`}</button>}
      </section>
    </Wrap>
  );
}

export function Contact() {
  const { W, go } = useShop();
  const S = W.site;
  const [f, setF] = useState({ name: '', phone: '', email: '', msg: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const soc = Object.entries(S.social).filter(([, v]) => v);
  const send = () => {
    setOk('');
    if (!f.name.trim()) return setErr('Add your name.');
    if (f.phone.replace(/\D/g, '').length < 10 && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Add a phone number or email so we can reply.');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('That email address does not look right.');
    if (f.msg.trim().length < 5) return setErr('Write your message.');
    writeKey('ecompos.contactMsgs', [{ ...f, id: 'c' + Date.now(), at: new Date().toISOString() }, ...readKey<unknown[]>('ecompos.contactMsgs', [])]);
    setErr(''); setOk(`Thanks ${f.name.split(' ')[0]} · we reply within the hour during opening times.`); setF({ name: '', phone: '', email: '', msg: '' });
  };
  const inp = 'h-12 px-4 rounded-2xl border border-line bg-[#fafafa] font-normal text-sm focus:bg-white focus:border-[#0b5c5c] outline-none transition-colors';
  const ways: [string, string, string, string | undefined][] = [
    [G.phone, 'Call us', String(S.phone || ''), `tel:${String(S.phone || '').replace(/\s/g, '')}`],
    ...(S.whatsapp ? [[G.chat, 'WhatsApp', String(S.whatsapp), waHref(S.whatsapp)] as [string, string, string, string]] : []),
    [G.mail, 'Email', String(S.email || ''), `mailto:${S.email || ''}`],
    [G.clock, 'Opening hours', String(S.hours || ''), undefined],
  ];
  return (
    <Wrap>
      <Crumb items={[['Home', ''], [navName(W, 'contact'), null]]} />
      <PageHero eyebrow="We are here to help" title="Contact us" text={S.contactIntro}>
        {/* Social links as icons only (name kept for screen readers and as a hover tooltip). */}
        {soc.length > 0 && <div className="flex gap-2.5 flex-wrap">{soc.map(([k, v]) => { const label = k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1); return (
          <a key={k} href={/^https?:/.test(v) ? v : k === 'whatsapp' ? waHref(v) : '#'} target="_blank" rel="noopener" aria-label={`${bizName(W)} on ${label}`} title={label} className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-white/[.08] ring-1 ring-white/15 hover:ring-white/50 transition-shadow">
            {k === 'x' ? <span className="w-11 h-11 rounded-full bg-black text-white font-bold flex items-center justify-center">X</span> : <img src={`/assets/social/${k}.png`} alt="" width={44} height={44} className="w-11 h-11 object-contain" />}
          </a>); })}</div>}
      </PageHero>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] items-start">
        <div className="grid gap-3 sm:grid-cols-2">
          {ways.map(([ic, l, v, href]) => { const body = <><span className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center"><Glyph d={ic} /></span><span className="text-xs text-muted mt-2">{l}</span><strong className="text-[15px] [overflow-wrap:anywhere]">{v}</strong></>; return href ? <a key={l} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener" className={cx(CARD, 'p-5 flex flex-col gap-0.5 hover:text-black transition-transform hover:-translate-y-0.5')}>{body}</a> : <div key={l} className={cx(CARD, 'p-5 flex flex-col gap-0.5')}>{body}</div>; })}
        </div>
        <form id="ct-form" onSubmit={(e) => { e.preventDefault(); send(); }} className={cx(CARD, 'p-6 sm:p-7 flex flex-col gap-4 scroll-mt-32')}>
          <div><strong className="text-xl">Send us a message</strong><p className="m-0 text-sm text-muted">We reply within the hour during opening times.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">Name<input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Phone or WhatsApp<input autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="024 555 0142" className={inp} /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Email<input autoComplete="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" className={inp} /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">Message<textarea rows={5} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} className="p-4 rounded-2xl border border-line bg-[#fafafa] font-normal text-sm focus:bg-white focus:border-[#0b5c5c] outline-none transition-colors" /></label>
          </div>
          {err && <span role="alert" className="text-sm text-danger">{err}</span>}
          <NoticeModal msg={ok} onClose={() => setOk('')} />
          <button className="h-12 px-6 rounded-full bg-black text-white font-semibold w-full sm:w-fit inline-flex items-center justify-center gap-2">Send message<Glyph d={G.arrow} size={16} /></button>
        </form>
      </div>
      {/* How can we help: common reasons people get in touch, each with the quickest way to sort it out. */}
      <section aria-labelledby="ct-help" className="flex flex-col gap-4">
        <div><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">How can we help?</span><h2 id="ct-help" className="m-0 text-[26px] font-semibold tracking-tight">Find the fastest answer</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([[G.truck, 'Orders & delivery', 'Where your order is, delivery times, charges and areas.', 'Read about delivery', () => go('pages/delivery')],
            [G.refresh, 'Returns & refunds', 'Change of mind, faulty items and how refunds are paid.', 'Returns policy', () => go('pages/returns')],
            [G.box, 'Wholesale & bulk quotes', 'Prices by the carton, business accounts and large orders.', 'Ask on WhatsApp', () => window.open(waHref(S.whatsapp || S.phone || '', 'Hello, I would like a wholesale quote for:'), '_blank', 'noopener')],
            [G.tv, 'Hire purchase', 'What you can buy, what to bring and how instalments work.', 'Visit a branch', () => go('branches')],
            [G.user, 'Careers', 'Open jobs in our branches, warehouse, delivery and office.', 'See open jobs', () => go('careers')],
            [G.star, 'Feedback & complaints', 'Tell us what went well or what we should fix. We read every message.', 'Send a message', () => document.getElementById('ct-form')?.scrollIntoView({ behavior: 'smooth' })],
          ] as [string, string, string, string, () => void][]).map(([ic, t, d, cta, act]) => (
            <div key={t} className={cx(CARD, 'p-5 flex flex-col gap-2')}>
              <span className="w-11 h-11 rounded-2xl bg-[#f2f4f5] text-black flex items-center justify-center"><Glyph d={ic} /></span>
              <strong className="text-[15px] mt-1">{t}</strong><span className="text-sm text-sub leading-6 flex-1">{d}</span>
              <button onClick={act} className="mt-1 w-fit text-sm font-semibold inline-flex items-center gap-1.5 underline-offset-4 hover:underline">{cta}<Glyph d={G.arrow} size={14} /></button>
            </div>))}
        </div>
      </section>
      <section className="flex flex-col gap-4"><div><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">Visit us</span><h2 className="m-0 text-[26px] font-semibold tracking-tight">Find a branch</h2></div><div className="grid gap-4 md:grid-cols-3">{BR_INFO.filter((b) => W.branches[b.id]?.show !== false).map((b) => <div key={b.id} className={cx(CARD, 'p-5 flex flex-col gap-2')}><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-2xl bg-[#f2f4f5] flex items-center justify-center"><Glyph d={G.pin} /></span><strong className="text-[15px]">{b.name}</strong></div><span className="text-sm text-sub">{b.address}</span><span className="text-xs text-muted">{b.phone} · {W.branches[b.id]?.hours || b.open}</span><a href={W.branches[b.id]?.map || mapsHref(b.address)} target="_blank" rel="noopener" className="mt-1 h-10 rounded-full border border-line text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-black hover:text-black">Directions<Glyph d={G.arrow} size={14} /></a></div>)}</div></section>
    </Wrap>
  );
}

export function Updates() {
  const { W } = useShop();
  const posts = W.updates.filter((u) => u.live).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  // Topic filter built from the kinds of update actually posted (Offer, New stock, Opening times …).
  const kinds = Array.from(new Set(posts.map((u) => u.kind).filter(Boolean)));
  const [kind, setKind] = useState('all');
  const shown = kind === 'all' ? posts : posts.filter((u) => u.kind === kind);
  return (
    <Wrap>
      <Crumb items={[['Home', ''], ['Store updates', null]]} />
      <PageHero eyebrow="News from our shops" title="Store updates" text="The latest from every branch: new stock as it lands, offers and discount codes, changes to opening times, delivery news and everything else worth knowing before you shop." />
      {kinds.length > 1 && <MobileFilter label="Filter updates by topic" value={kind} onChange={setKind} opts={[['all', 'All updates', posts.length], ...kinds.map((k): [string, string, number] => [k, k, posts.filter((u) => u.kind === k).length])]} />}
      {/* Tablet and desktop: topic chips (phones use the dropdown above). */}
      {kinds.length > 1 && <div className="hidden sm:flex gap-2 flex-wrap" role="group" aria-label="Filter updates by topic">{[['all', 'All updates'] as [string, string], ...kinds.map((k) => [k, k] as [string, string])].map(([v, l]) => <button key={v} onClick={() => setKind(v)} aria-pressed={kind === v} className={cx('h-10 px-4 rounded-full text-sm font-medium border transition-colors', kind === v ? 'bg-black text-white border-black' : 'bg-white border-line hover:border-black')}>{l}<span className={cx('ml-1.5 text-xs', kind === v ? 'text-white/60' : 'text-muted')}>{v === 'all' ? posts.length : posts.filter((u) => u.kind === v).length}</span></button>)}</div>}
      {!posts.length && <div className={cx(CARD, 'p-10 text-center text-muted')}>No updates right now. Check back soon.</div>}
      <div className="grid gap-5 lg:grid-cols-2">{shown.map((u) => <div key={u.id} className={cx('rounded-[24px] overflow-hidden', SHADOW, u.pinned && 'ring-2 ring-[#d4af5a]')}><UpdateCard u={u} full /></div>)}</div>
      {/* What customers can expect to find here. */}
      <section aria-labelledby="up-what" className="flex flex-col gap-4 pt-2">
        <div><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-muted">What we post</span><h2 id="up-what" className="m-0 text-[26px] font-semibold tracking-tight">What you will find here</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([[G.star, 'Offers & codes', 'Weekly deals, seasonal sales and discount codes, with the dates they run.'], [G.box, 'New stock', 'New products and restocks the moment they reach our shelves.'], [G.clock, 'Opening times', 'Holiday hours, new branch hours and any temporary closures.'], [G.truck, 'Delivery news', 'New delivery areas, free-delivery offers and cut-off times.']] as [string, string, string][]).map(([ic, t, d]) => <div key={t} className={cx(CARD, 'p-5 flex flex-col gap-2')}><span className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center"><Glyph d={ic} /></span><strong className="text-[15px] mt-1">{t}</strong><span className="text-sm text-sub leading-6">{d}</span></div>)}
        </div>
      </section>
    </Wrap>
  );
}

export function Reviews() {
  const { W } = useShop();
  return <main className="py-8 flex flex-col gap-6"><div className="px-[var(--gut)]"><Crumb items={[['Home', ''], [navName(W, 'reviews'), null]]} /></div><ReviewsBand page /></main>;
}

export function Faqs() {
  const { W, go } = useShop();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const vis = W.faqs.filter((f) => f.on && f.q && f.a);
  const k = q.trim().toLowerCase();
  const allCats = Array.from(new Set(vis.map((f) => f.cat)));
  const hits = vis.filter((f) => (!k || (f.q + ' ' + f.a + ' ' + f.cat).toLowerCase().includes(k)) && (cat === 'all' || f.cat === cat));
  const groups = Array.from(new Set(hits.map((f) => f.cat)));
  return (
    <Wrap>
      <Crumb items={[['Home', ''], [navName(W, 'faqs'), null]]} />
      <PageHero eyebrow="Help centre" title="Frequently asked questions" text={`Quick answers about orders, delivery, payments and returns · ${vis.length} questions.`}>
        <div role="search" className="flex items-center gap-2 h-14 px-5 rounded-full bg-white text-black max-w-2xl border-2 border-transparent focus-within:border-[#d4af5a]"><span className="text-muted"><Glyph d={G.search} /></span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the questions, e.g. delivery" aria-label="Search FAQs" className="flex-1 min-w-0 outline-none bg-transparent text-[15px]" />{q && <button onClick={() => setQ('')} className="text-sm text-muted underline">Clear</button>}</div>
      </PageHero>
      <MobileFilter label="FAQ topic" value={cat} onChange={setCat} opts={[['all', 'All topics', vis.length], ...allCats.map((c): [string, string, number] => [c, c, vis.filter((f) => f.cat === c).length])]} />
      {/* Tablet and desktop: topic chips (phones use the dropdown above). */}
      <div className="hidden sm:flex gap-2 flex-wrap" role="group" aria-label="Topics">{[['all', 'All topics'] as [string, string], ...allCats.map((c) => [c, c] as [string, string])].map(([v, l]) => <button key={v} onClick={() => setCat(v)} aria-pressed={cat === v} className={cx('h-10 px-4 rounded-full text-sm font-medium border transition-colors', cat === v ? 'bg-black text-white border-black' : 'bg-white border-line hover:border-black')}>{l}<span className={cx('ml-1.5 text-xs', cat === v ? 'text-white/60' : 'text-muted')}>{v === 'all' ? vis.length : vis.filter((f) => f.cat === v).length}</span></button>)}</div>
      {!hits.length && <p className="m-0 text-sm">No question matches that. Try another word, or <button onClick={() => go('contact')} className="underline font-semibold">ask us directly</button>.</p>}
      <div className="grid gap-8 lg:grid-cols-2 items-start">
        {groups.map((g) => (
          <section key={g} className="flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold flex items-center gap-2"><span className="w-1.5 h-5 rounded-full" style={{ background: GOLD }} aria-hidden />{g}</h2>
            {hits.filter((f) => f.cat === g).map((f) => <details key={f.id} className={cx(CARD, 'group px-5 py-4 open:ring-black/20')}><summary className="flex justify-between items-center gap-3 cursor-pointer list-none font-medium"><span>{f.q}</span><span aria-hidden="true" className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center flex-none text-lg leading-none group-open:rotate-45 transition-transform">+</span></summary><div className="pt-3 mt-3 border-t border-line flex flex-col gap-2">{paras(f.a).map((p, i) => <p key={i} className="m-0 text-sm leading-6 text-sub">{p}</p>)}</div></details>)}
          </section>
        ))}
      </div>
    </Wrap>
  );
}

const jobOpen = (j: { open: boolean; draft?: boolean; closes?: string }) => j.open && !j.draft && (!j.closes || j.closes >= new Date().toISOString().slice(0, 10));
const brN = (id: string) => BR_INFO.find((b) => b.id === id)?.name ?? id;
const sal = (j: { salMin: string; salMax: string; showSal?: boolean }) => (j.showSal !== false && j.salMin ? `${money(Number(j.salMin)).replace('.00', '')}${j.salMax ? ' – ' + money(Number(j.salMax)).replace('.00', '') : ''} a month` : '');
const closesTxt = (c?: string) => (c ? 'Closes ' + new Date(c + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Open until filled');

/** Dark gold text for small labels on white: the brand gold (#d4af5a) is too light to read on white. */
const GOLD_INK = '#8a6a1f';
/** A round navy badge with a gold line icon, used on Careers and the policy pages. Input: an icon path from G. */
const GoldIcon = ({ d }: { d: string }) => <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-none" style={{ background: '#16123a', color: GOLD }}><Glyph d={d} size={20} /></span>;
/** A small uppercase label above a section heading. */
const Kicker = ({ children }: { children: React.ReactNode }) => <span className="text-[11px] font-semibold uppercase tracking-[.2em]" style={{ color: GOLD_INK }}>{children}</span>;

/**
 * Careers & opportunities: premium header, why work here, how to apply, then the open roles with filters by
 * team and branch. Roles come from Post to online › Jobs (only open, non-draft roles that have not closed).
 */
export function Careers() {
  const { W, go } = useShop();
  const jobs = W.jobs.filter(jobOpen);
  const [dept, setDept] = useState('All');
  const [br, setBr] = useState('all');
  const depts = ['All', ...Array.from(new Set(jobs.map((j) => j.dept).filter(Boolean)))];
  const brs = Array.from(new Set(jobs.map((j) => j.br).filter(Boolean)));
  const shown = jobs.filter((j) => (dept === 'All' || j.dept === dept) && (br === 'all' || j.br === br));
  const biz = bizName(W);
  // Why work here: kept general so the same page suits any business using the platform.
  const perks: [string, string, string][] = [
    [G.star, 'Training on the job', 'We show you how everything works, from the till to the stock room, and keep teaching as you grow.'],
    [G.card, 'Pay shown upfront', 'Where a salary is listed you see it before you apply, so there are no surprises.'],
    [G.compass, 'Room to grow', 'Learn new roles across sales, stock, delivery and supervision as you gain experience.'],
    [G.user, 'A team behind you', 'Friendly colleagues and managers who answer questions and help you do well.'],
  ];
  const steps: [string, string][] = [['Choose a role', 'Find a job that suits you below and read what it involves.'], ['Apply online', 'Fill in a short form and upload your CV. It takes a few minutes.'], ['We call you', `If you are shortlisted, ${biz} contacts you by phone or WhatsApp.`]];
  const toJobs = () => document.getElementById('open-roles')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <Wrap>
      <Crumb items={[['Home', ''], ['Careers', null]]} />
      <PageHero eyebrow="Careers & opportunities" title={`Grow with ${biz}`} text="We hire friendly, honest people for our branches, warehouse and delivery team. Find a role that suits you and apply online in a few minutes.">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={toJobs} className="h-12 px-6 rounded-full font-semibold text-[#16123a] inline-flex items-center gap-2 hover:brightness-105" style={{ background: GOLD }}>See open roles <Glyph d={G.arrow} size={16} /></button>
          <span className="text-sm text-white/75">{jobs.length} open role{jobs.length === 1 ? '' : 's'} across {brs.length} location{brs.length === 1 ? '' : 's'}</span>
        </div>
      </PageHero>

      {/* Why work with us */}
      <section aria-labelledby="cr-why" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1"><Kicker>Why work with us</Kicker><h2 id="cr-why" className="m-0 text-[26px] font-semibold tracking-tight">A good place to start and to grow</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{perks.map(([d, t, x]) => <div key={t} className={cx(CARD, 'p-5 flex flex-col gap-3')}><GoldIcon d={d} /><strong className="text-base">{t}</strong><span className="text-sm text-sub leading-relaxed">{x}</span></div>)}</div>
      </section>

      {/* How to apply: three numbered steps on one band */}
      <section aria-labelledby="cr-how" className={cx(CARD, 'p-6 sm:p-8 flex flex-col gap-5')}>
        <div className="flex flex-col gap-1"><Kicker>How to apply</Kicker><h2 id="cr-how" className="m-0 text-xl font-semibold tracking-tight">Three simple steps</h2></div>
        <ol className="m-0 p-0 list-none grid gap-5 md:grid-cols-3">{steps.map(([t, x], i) => <li key={t} className="flex gap-3"><span className="w-9 h-9 rounded-full flex items-center justify-center flex-none text-sm font-bold" style={{ background: '#16123a', color: GOLD }}>{i + 1}</span><span className="flex flex-col gap-0.5"><strong className="text-[15px]">{t}</strong><span className="text-sm text-sub leading-relaxed">{x}</span></span></li>)}</ol>
      </section>

      {/* Open roles, filtered by team and branch */}
      <section id="open-roles" aria-labelledby="cr-roles" className="flex flex-col gap-4 scroll-mt-32">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1"><Kicker>Open roles</Kicker><h2 id="cr-roles" className="m-0 text-[26px] font-semibold tracking-tight">{shown.length} role{shown.length === 1 ? '' : 's'} available</h2></div>
          {brs.length > 1 && <label className="flex items-center gap-2 text-sm"><span className="text-sub">Location</span><select value={br} onChange={(e) => setBr(e.target.value)} className="h-10 pl-4 pr-8 rounded-full border border-line bg-white text-sm"><option value="all">All locations</option>{brs.map((b) => <option key={b} value={b}>{brN(b)}</option>)}</select></label>}
        </div>
        {depts.length > 2 && <div role="group" aria-label="Filter by team" className="flex gap-2 flex-wrap">{depts.map((d) => <button key={d} aria-pressed={dept === d} onClick={() => setDept(d)} className={cx('h-9 px-4 rounded-full text-sm border transition-colors', dept === d ? 'bg-[#16123a] text-white border-[#16123a]' : 'bg-white border-line hover:border-black')}>{d}{d !== 'All' && <span className={cx('ml-1.5 text-xs', dept === d ? 'text-white/70' : 'text-muted')}>{jobs.filter((j) => j.dept === d).length}</span>}</button>)}</div>}
        {!shown.length && <div className={cx(CARD, 'p-6 text-sm text-sub')}>{jobs.length ? 'No roles match these filters. Try another team or location.' : 'There are no open roles right now. Check back soon, or follow us on social media for new openings.'}</div>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((j) => (
          <button key={j.id} onClick={() => go(`careers/${j.id}`)} className={cx(CARD, 'group relative overflow-hidden text-left p-6 flex flex-col gap-3 transition hover:-translate-y-0.5 hover:ring-black/20')}>
            {/* gold hairline that appears on hover */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
            <Kicker>{j.dept}</Kicker>
            <strong className="text-lg leading-snug">{j.title}</strong>
            <span className="flex gap-x-4 gap-y-1 flex-wrap text-sm text-sub"><span className="inline-flex items-center gap-1.5"><Glyph d={G.pin} size={15} />{brN(j.br)}</span><span className="inline-flex items-center gap-1.5"><Glyph d={G.clock} size={15} />{j.type}</span></span>
            {sal(j) && <span className="text-[15px] font-semibold">{sal(j)}</span>}
            <span className="mt-auto pt-3 border-t border-black/[.06] flex items-center justify-between gap-2 text-sm"><span className="text-muted text-xs">{closesTxt(j.closes)}</span><span className="font-semibold inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">View role <Glyph d={G.arrow} size={15} /></span></span>
          </button>
        ))}</div>
      </section>
    </Wrap>
  );
}

export function JobPage() {
  const { id = '' } = useParams();
  const { W, up, go } = useShop();
  const j = W.jobs.find((x) => x.id === id);
  const ok = j && jobOpen(j);
  const docsReq = (j?.docs?.length ? j.docs : ['CV / résumé']).filter((d) => !/ghana\s*card/i.test(d));
  const [f, setF] = useState({ name: '', phone: '', email: '', town: '', exp: '', avail: '', note: '', ok: false });
  const [files, setFiles] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const submit = () => {
    if (!j) return;
    if (f.name.trim().split(/\s+/).length < 2) return setErr('Add your full name (first and last name).');
    if (f.phone.replace(/\D/g, '').length < 10) return setErr('Add a phone or WhatsApp number we can call.');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('That email address does not look right.');
    const miss = docsReq.find((d) => !files[d]);
    if (miss) return setErr(`Upload your ${miss}.`);
    if (!f.ok) return setErr('Tick the box to confirm your details are true.');
    setErr(''); setBusy(true);
    setTimeout(() => {
      const app = { id: 'a' + Date.now(), name: f.name.trim(), job: `${j.title} · ${brN(j.br)}`, phone: f.phone, stage: 'new', docs: Object.keys(files).map((k) => `${k}: ${files[k]}`), note: [f.town && `Lives in ${f.town}`, f.exp && `${f.exp} years' experience`, f.avail && `Can start ${f.avail}`, f.email, f.note].filter(Boolean).join(' · '), when: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) };
      writeKey('ecompos.apps2', [app, ...readKey<unknown[]>('ecompos.apps2', [])]);
      writeKey('ecompos.jobApps', [{ ...app, jobId: j.id, email: f.email, town: f.town, exp: f.exp, avail: f.avail }, ...readKey<unknown[]>('ecompos.jobApps', [])]);
      up({ jobs: W.jobs.map((x) => (x.id === j.id ? { ...x, apps: x.apps + 1 } : x)) });
      setBusy(false); setDone(`Thank you, ${f.name.split(' ')[0]}. ${bizName(W)} will review your application for ${j.title} and contact you on ${f.phone}.`);
    }, 700);
  };
  const inp = 'h-11 px-4 rounded-full border border-line font-normal text-sm';
  return (
    <Wrap>
      <Crumb items={[['Home', ''], ['Careers', 'careers'], [j?.title || 'Job', null]]} />
      {!ok && <p className="m-0">This job is no longer open. <button onClick={() => go('careers')} className="underline font-semibold">See open jobs</button></p>}
      {ok && j && (
        <>
          {/* Same premium header as the Careers page: team, title, summary and the key facts as chips. */}
          <PageHero eyebrow={j.dept || 'Careers'} title={j.title} text={j.summary}>
            <div className="flex gap-2 flex-wrap">{[brN(j.br), j.type, sal(j), closesTxt(j.closes), j.openings ? `${j.openings} opening${j.openings > 1 ? 's' : ''}` : ''].filter(Boolean).map((c) => <span key={c} className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/[.08] ring-1 ring-white/15 text-white">{c}</span>)}</div>
          </PageHero>
          {/* Two columns on wide screens: the role in detail on the left, the application form on the right. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] items-start">
          {/* The role in detail: each list with gold check marks, in one card. */}
          <div className={cx(CARD, 'p-6 sm:p-8 flex flex-col gap-6')}>
            {([['What you will do', j.duties], ['What we are looking for', j.reqs], ['What we offer', j.offer]] as [string, string | undefined][]).filter(([, v]) => v).map(([h, v]) => <section key={h} className="flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold tracking-tight">{h}</h2><ul className="m-0 p-0 list-none flex flex-col gap-2 text-[15px] leading-relaxed text-sub">{String(v).split('\n').filter(Boolean).map((t) => <li key={t} className="flex gap-2.5"><span className="mt-0.5" style={{ color: GOLD_INK }}><Glyph d={G.check} size={16} /></span><span>{t}</span></li>)}</ul></section>)}
          </div>
          {done ? <div role="status" className="rounded-3xl bg-green-50 border border-ok p-5 flex flex-col gap-1"><strong className="text-ok">Application sent ✓</strong><span className="text-sm">{done}</span></div> : (
            <section aria-labelledby="ap-h" className={cx(CARD, 'p-6 sm:p-8 flex flex-col gap-3')}>
              <h2 id="ap-h" className="m-0 text-xl font-semibold">Apply for this job</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-semibold">Full name<input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></label>
                <label className="flex flex-col gap-1 text-sm font-semibold">Phone or WhatsApp<input autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="024 555 0142" className={inp} /></label>
                <label className="flex flex-col gap-1 text-sm font-semibold">Email<input autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" className={inp} /></label>
                <label className="flex flex-col gap-1 text-sm font-semibold">Town or area you live in<input value={f.town} onChange={(e) => setF({ ...f, town: e.target.value })} placeholder="e.g. Madina" className={inp} /></label>
                <label className="flex flex-col gap-1 text-sm font-semibold">Years of work experience<input inputMode="numeric" value={f.exp} onChange={(e) => setF({ ...f, exp: e.target.value.replace(/\D/g, '') })} placeholder="0" className={inp} /></label>
                <label className="flex flex-col gap-1 text-sm font-semibold">When can you start?<input type="date" value={f.avail} onChange={(e) => setF({ ...f, avail: e.target.value })} className={inp} /></label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-semibold">Why do you want this job? (cover note)<textarea rows={4} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="p-4 rounded-2xl border border-line font-normal text-sm" /></label>
              <div className="flex flex-col gap-2"><strong className="text-sm">Documents</strong><span className="text-xs text-muted">PDF, Word or a clear photo · up to 10 MB each</span>
                {docsReq.map((d) => (
                  <label key={d} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas cursor-pointer">
                    <span className="text-sm"><strong>{d}</strong> <span className="text-xs text-danger">Required</span><br /><span className="text-xs text-muted">{files[d] || 'No file chosen'}</span></span>
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-line">{files[d] ? 'Change' : 'Upload'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp" className="sr-only" aria-label={`Upload ${d}`} onChange={(e) => { const fl = e.target.files?.[0]; if (!fl) return; if (fl.size > 10 * 1024 * 1024) return setErr(`${fl.name} is bigger than 10 MB.`); setErr(''); setFiles({ ...files, [d]: fl.name }); }} />
                  </label>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.ok} onChange={() => setF({ ...f, ok: !f.ok })} className="w-4 h-4 mt-0.5 accent-black" /><span>I confirm the information and documents are true, and I agree that {bizName(W)} may contact me about this and future jobs.</span></label>
              {err && <span role="alert" className="text-sm text-danger">{err}</span>}
              <button onClick={submit} disabled={busy} className="h-12 px-6 rounded-full bg-black text-white font-semibold w-fit disabled:opacity-60">{busy ? 'Sending…' : 'Send application'}</button>
            </section>
          )}
          </div>
        </>
      )}
    </Wrap>
  );
}

/**
 * Policy and custom pages (Privacy, Terms of sale, Returns & refunds, Delivery, Cookies, and pages added in Post to online).
 * Premium layout: dark header with the update date and reading time, a sticky numbered "On this page" list,
 * the text in a white card with numbered gold section headings, a contact line, then links to the other policies.
 * The text fills {business}, {phone} … from the store settings and turns "## " headings and "- " bullets into blocks.
 */
export function CustomPage() {
  const { slug = '' } = useParams();
  const { W, go } = useShop();
  const p = W.pages.find((x) => x.slug === slug && !x.builtin && (x.live || x.policy));
  if (!p) return <Wrap narrow><h1 className={H1}>Page not found</h1><button onClick={() => go('')} className="h-11 px-5 rounded-full bg-black text-white font-semibold w-fit">Back to the shop</button></Wrap>;
  const T = tokensOf(W);
  const blocks = toBlocks(fillTokens(p.body, T));
  const anchor = (h: string) => 'sec-' + h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const heads = blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h');
  const toc = heads.length >= 3; // the contents list only helps on longer pages
  // Reading time at about 200 words a minute.
  const words = blocks.reduce((a, b) => a + (b.t === 'ul' ? b.items.join(' ') : b.text).split(/\s+/).length, 0);
  const mins = Math.max(1, Math.round(words / 200));
  const others = W.pages.filter((x) => x.policy && x.slug !== p.slug);
  const jump = (h: string) => document.getElementById(anchor(h))?.scrollIntoView({ behavior: 'smooth' });
  const firstP = blocks.findIndex((b) => b.t === 'p'); // the opening paragraph is set a little larger, as a lead
  let n = 0; // running section number
  return (
    <Wrap>
      <Crumb items={[['Home', ''], [p.title, null]]} />
      <PageHero eyebrow={p.policy ? 'Store policy' : 'Information'} title={fillTokens(p.title, T)} text={`Updated ${p.updated || '1 Nov 2026'} · ${mins} min read`} />
      <div className={cx('grid gap-6 items-start', toc && 'lg:grid-cols-[260px_minmax(0,1fr)]')}>
        {toc && (
          <aside className="lg:sticky lg:top-28 flex flex-col gap-4">
            <nav aria-label="On this page" className={cx(CARD, 'p-5 flex flex-col gap-3')}>
              <Kicker>On this page</Kicker>
              <ol className="m-0 p-0 list-none flex flex-col gap-1">{heads.map((h, i) => <li key={h.text}><a href={`#${anchor(h.text)}`} onClick={(e) => { e.preventDefault(); jump(h.text); }} className="flex gap-2.5 py-1 text-sm text-sub hover:text-black"><span className="w-5 flex-none text-xs font-semibold tabular-nums pt-px" style={{ color: GOLD_INK }}>{String(i + 1).padStart(2, '0')}</span><span>{h.text}</span></a></li>)}</ol>
            </nav>
          </aside>
        )}
        <article className={cx(CARD, 'p-6 sm:p-10 flex flex-col gap-4 min-w-0', !toc && 'max-w-4xl')}>
          {p.img && <img src={p.img} alt="" className="w-full max-h-80 object-cover rounded-2xl" />}
          {blocks.map((b, i) => {
            if (b.t === 'h') { n += 1; return (
              <h2 key={i} id={anchor(b.text)} className={cx('m-0 text-xl sm:text-[22px] font-semibold tracking-tight scroll-mt-32 flex items-baseline gap-3', i > 0 && 'mt-4 pt-6 border-t border-black/[.06]')}>
                <span className="text-sm font-semibold tabular-nums" style={{ color: GOLD_INK }}>{String(n).padStart(2, '0')}</span><span>{b.text}</span>
              </h2>); }
            if (b.t === 'ul') return <ul key={i} className="m-0 p-0 list-none flex flex-col gap-2 text-[15px] sm:text-base leading-7 text-sub">{b.items.map((t, k) => <li key={k} className="flex gap-3"><span aria-hidden className="mt-[11px] w-1.5 h-1.5 rounded-full flex-none" style={{ background: GOLD }} /><span>{t}</span></li>)}</ul>;
            return <p key={i} className={cx('m-0 leading-7', i === firstP ? 'text-[17px] sm:text-lg text-black/80' : 'text-[15px] sm:text-base text-sub')}>{b.text}</p>;
          })}
          {/* Who to ask: the store's own phone and email, from Post to online settings. */}
          {(T.phone || T.email) && <p className="m-0 mt-4 pt-6 border-t border-black/[.06] text-sm text-sub">Questions about this {p.policy ? 'policy' : 'page'}? {T.phone && <>Call <a href={`tel:${T.phone.replace(/\s/g, '')}`} className="font-semibold text-black underline underline-offset-2">{T.phone}</a></>}{T.phone && T.email && ' or '}{T.email && <>email <a href={`mailto:${T.email}`} className="font-semibold text-black underline underline-offset-2">{T.email}</a></>}.</p>}
        </article>
      </div>
      {/* Uploaded PDF version (Post to online › Store policies): shown in the page, with a download button. */}
      {p.doc && (
        <section aria-label={`${p.title} document`} className={cx(CARD, 'p-5 sm:p-6 flex flex-col gap-3')}>
          <div className="flex items-center justify-between gap-3 flex-wrap"><span className="flex items-center gap-3"><GoldIcon d={G.box} /><span className="flex flex-col"><strong className="text-base">Full document</strong><span className="text-xs text-muted">{p.doc.name}</span></span></span><a href={p.doc.dataUrl} download={p.doc.name} className="h-10 px-4 rounded-full bg-[#16123a] text-white text-sm font-semibold inline-flex items-center hover:text-white">Download PDF</a></div>
          <object data={p.doc.dataUrl} type="application/pdf" aria-label={p.doc.name} className="w-full h-[75vh] rounded-2xl border border-line bg-canvas">
            <p className="p-5 text-sm">Your browser cannot show the document here. <a href={p.doc.dataUrl} download={p.doc.name} className="underline font-semibold">Download it</a> to read it.</p>
          </object>
        </section>
      )}
      {/* The other store policies, one tap away. */}
      {others.length > 0 && (
        <nav aria-label="Other store policies" className="flex flex-col gap-3">
          <Kicker>Other store policies</Kicker>
          <div className="flex gap-2 flex-wrap">{others.map((x) => <button key={x.slug} onClick={() => go(`pages/${x.slug}`)} className="h-10 px-4 rounded-full bg-white ring-1 ring-black/10 text-sm font-medium inline-flex items-center gap-2 hover:ring-black/40">{fillTokens(x.title, T)}<Glyph d={G.arrow} size={14} /></button>)}</div>
        </nav>
      )}
      <button onClick={() => go('')} className="h-11 px-5 rounded-full border border-black font-semibold w-fit">Back to the shop</button>
    </Wrap>
  );
}
