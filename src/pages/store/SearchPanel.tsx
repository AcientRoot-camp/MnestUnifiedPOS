// Results panel under the online store's search box (Shell.tsx): shows store-wide results as the shopper types —
// products, Help & policies (full text), FAQs, branches, pages, careers and news — grouped, with the matching words
// highlighted. Arrow keys move through the results, Enter opens the highlighted one (or, with nothing highlighted,
// shows all matching products in the shop), Escape closes.
import { forwardRef, useImperativeHandle, useMemo, useState, type KeyboardEvent } from 'react';
import { cx } from '../../lib/format';
import { useShop } from './ctx';
import { marks, searchStore, terms, type Hit, type HitGroup } from './search';

/** What Shell's search input asks of the panel: handle a key press (true when the panel used it). */
export type SearchPanelApi = { key: (e: KeyboardEvent<HTMLInputElement>) => boolean };

/** Text with the query words in bold. */
function Hl({ text, ts }: { text: string; ts: string[] }) {
  return <>{marks(text, ts).map((m, i) => (m.mark ? <b key={i} className="font-semibold text-black bg-[#fff1b8] rounded-sm px-px">{m.t}</b> : <span key={i}>{m.t}</span>))}</>;
}
const ICON: Record<string, string> = { products: '🛍️', help: '📄', faqs: '❓', branches: '📍', pages: '🔗' };

/**
 * Inputs: the query, onAll (show every matching product in the shop) and onClose (hide the search row).
 * Shows nothing until the query has two letters.
 */
export const SearchPanel = forwardRef<SearchPanelApi, { q: string; onAll: () => void; onClose: () => void }>(function SearchPanel({ q, onAll, onClose }, ref) {
  const { W, products, open, go, setMd, setCookies, byId } = useShop();
  const [active, setActive] = useState(-1);
  const ts = useMemo(() => terms(q), [q]);
  const groups: HitGroup[] = useMemo(() => (q.trim().length >= 2 ? searchStore(q, W, products) : []), [q, W, products]);
  const flat = groups.flatMap((g) => g.hits);
  const nProd = groups.find((g) => g.key === 'products')?.hits.length || 0;
  // A new query starts with nothing highlighted.
  const [lastQ, setLastQ] = useState(q); if (lastQ !== q) { setLastQ(q); setActive(-1); }

  /** Open a result: product page, a store page, the order tracker or the cookie choice. */
  const choose = (h: Hit) => {
    onClose();
    if (h.go.k === 'product') open(h.go.id);
    else if (h.go.k === 'track') setMd({ k: 'look' });
    else if (h.go.k === 'cookies') setCookies('');
    else go(h.go.path);
  };
  useImperativeHandle(ref, () => ({
    key: (e) => {
      if (!flat.length) return false;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % flat.length); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? flat.length - 1 : a - 1)); return true; }
      if (e.key === 'Enter' && active >= 0 && flat[active]) { e.preventDefault(); choose(flat[active]); return true; }
      return false;
    },
  }));

  if (q.trim().length < 2) return null;
  let idx = -1;
  return (
    <div role="listbox" aria-label="Search results" className="absolute left-0 right-0 top-full mt-2 z-40 bg-white text-black rounded-3xl shadow-[0_18px_50px_rgba(0,0,0,0.22)] border border-black/5 max-h-[min(70vh,620px)] overflow-y-auto">
      {!groups.length && (
        <div className="p-6 flex flex-col gap-2 items-start">
          <strong className="text-[15px]">No results for “{q.trim()}”</strong>
          <span className="text-sm text-muted">Try another word, check the spelling, or browse the help pages.</span>
          <div className="flex gap-2 flex-wrap mt-1">{[['FAQs', 'faqs'], ['Branches', 'branches'], ['Contact us', 'contact']].map(([l, p]) => <button key={p} onClick={() => { onClose(); go(p); }} className="h-9 px-3.5 rounded-full border border-line text-xs font-semibold hover:border-black">{l}</button>)}</div>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label} className="py-2 border-b border-line last:border-0">
          <h3 className="m-0 px-5 pt-2 pb-1.5 text-[11px] font-bold tracking-[0.14em] uppercase text-muted flex items-center gap-2"><span aria-hidden>{ICON[g.key]}</span>{g.label}</h3>
          {g.hits.map((h) => { idx += 1; const i = idx; const p = h.go.k === 'product' ? byId[h.go.id] : null; return (
            <button key={g.key + h.title + i} role="option" aria-selected={active === i} onMouseEnter={() => setActive(i)} onClick={() => choose(h)}
              className={cx('w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors', active === i ? 'bg-canvas' : 'hover:bg-canvas')}>
              {p ? <span className="w-11 h-11 rounded-xl flex-none overflow-hidden bg-white border border-line">{p.img ? <img src={p.img} alt="" className="w-full h-full object-contain p-1" /> : <span className="block w-full h-full" style={{ background: p.tone }} />}</span> : null}
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[14px] font-medium leading-snug"><Hl text={h.title} ts={ts} /></span>
                <span className="text-xs text-muted truncate">{h.sub}</span>
                {h.snippet && <span className="text-[13px] text-sub leading-snug line-clamp-2"><Hl text={h.snippet} ts={ts} /></span>}
              </span>
              <span aria-hidden className="text-muted text-lg">›</span>
            </button>
          ); })}
          {g.key === 'products' && nProd > 0 && <button onClick={() => { onAll(); }} className="mx-5 my-1.5 text-sm font-semibold underline">See all products for “{q.trim()}” →</button>}
        </section>
      ))}
      {groups.length > 0 && <div className="px-5 py-3 text-[11px] text-muted bg-canvas rounded-b-3xl hidden sm:block">↑ ↓ to move · Enter to open · Esc to close</div>}
    </div>
  );
});
