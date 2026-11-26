import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Toast } from '../../components/ui';
import { CATS0, PRODUCTS0, type Category, type Product } from '../../data/catalogue';
import { usePersist } from '../../lib/persist';
import { cx } from '../../lib/format';

const COLORS = ['#0b5c5c', '#b26a00', '#0b6bcb', '#6b3fa0', '#c62828', '#000000', '#1f7a2a', '#e91e63'];
const BLANK: Category = { name: '', desc: '', parent: '', color: COLORS[0], till: true, online: true, archived: false };

export default function Categories() {
  const [L, setL] = usePersist<Category[]>('ecompos.cats2', CATS0);
  const [prods, setProds] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [sel, setSel] = useState<string>('');
  const [form, setForm] = useState<Category>(BLANK);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const active = L.filter((c) => !c.archived);
  const archived = L.filter((c) => c.archived);
  const count = (n: string) => prods.filter((p) => p.cat === n && p.status === 'live').length;
  const editing = !!sel;
  const open = (c?: Category) => { setSel(c?.name ?? ''); setForm(c ? { ...c } : BLANK); setErr(''); };
  const move = (i: number, d: number) => setL((x) => { const a = x.filter((c) => !c.archived); const b = x.filter((c) => c.archived); const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return [...a, ...b]; });

  const save = () => {
    const n = form.name.trim();
    if (n.length < 2) return setErr('Enter the category name.');
    if (L.some((c) => c.name.toLowerCase() === n.toLowerCase() && c.name !== sel)) return setErr('A category with this name already exists.');
    if (form.parent === n) return setErr('A category cannot sit under itself.');
    if (editing) {
      setL((x) => x.map((c) => (c.name === sel ? { ...form, name: n } : c.parent === sel ? { ...c, parent: n } : c)));
      if (n !== sel) setProds((x) => x.map((p) => (p.cat === sel ? { ...p, cat: n } : p)));
      setToast(`${n} saved · the till, the website and Products update straight away`);
    } else {
      setL((x) => [...x.filter((c) => !c.archived), { ...form, name: n }, ...x.filter((c) => c.archived)]);
      setToast(`${n} added`);
    }
    setSel(n);
  };
  const inUse = editing ? count(sel) : 0;

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Categories</h1><p className="m-0 text-sm text-muted">Group products for the till, the website and reports · {active.length} categories · {archived.length} archived</p></div>
        <div className="flex gap-2"><Link to="/products" className="btn-ghost">Back to products</Link><button onClick={() => open()} className="btn-primary">Add category</button></div>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px] items-start">
        <section className="card p-5 sm:p-6 flex flex-col gap-2">
          <div><h2 className="m-0 text-lg font-semibold">All categories</h2><span className="text-[13px] text-muted">Order here is the order on the till and the website</span></div>
          {active.map((c, i) => (
            <div key={c.name} className={cx('flex items-center gap-2 p-2 rounded-2xl', sel === c.name ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}>
              <button onClick={() => open(c)} className="flex-1 flex items-center gap-3 text-left">
                <span className="w-9 h-9 rounded-xl flex-none" style={{ background: c.color }} />
                <span className="flex flex-col"><b className="text-sm">{c.parent ? <span className="text-muted font-normal">{c.parent} › </span> : null}{c.name}</b><span className="text-xs text-muted">{count(c.name)} products · {[c.till && 'till', c.online && 'website'].filter(Boolean).join(' & ') || 'not shown'}</span></span>
              </button>
              {!c.till && !c.online && <span className="pill bg-canvas text-muted">Hidden</span>}
              <button aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="w-8 h-8 rounded-full border border-line disabled:opacity-30">↑</button>
              <button aria-label={`Move ${c.name} down`} disabled={i === active.length - 1} onClick={() => move(i, 1)} className="w-8 h-8 rounded-full border border-line disabled:opacity-30">↓</button>
            </div>
          ))}
          {archived.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted uppercase">Archived · not shown anywhere</span>
              {archived.map((a) => <div key={a.name} className="flex items-center justify-between text-sm"><span>{a.name}</span><button onClick={() => { setL((x) => x.map((c) => (c.name === a.name ? { ...c, archived: false } : c))); setToast(`${a.name} restored`); }} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-line">Restore</button></div>)}
            </div>
          )}
        </section>
        <section className="card p-5 sm:p-6 flex flex-col gap-3 xl:sticky xl:top-6">
          <h2 className="m-0 text-lg font-semibold">{editing ? `Edit ${sel}` : 'New category'}</h2>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Category name<input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr(''); }} placeholder="e.g. Baby care" className="field py-2.5 font-normal" /></label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Description (shown on the website)<textarea rows={2} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="One line customers see under the category name" className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Sits under<select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className="field py-2.5 font-normal"><option value="">Top level (main category)</option>{active.filter((c) => !c.parent && c.name !== sel).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Colour on the till</span><div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} aria-label={`Colour ${c}`} aria-pressed={form.color === c} onClick={() => setForm({ ...form, color: c })} className={cx('w-9 h-9 rounded-xl', form.color === c && 'ring-4 ring-offset-2 ring-brand-100')} style={{ background: c }} />)}</div></div>
          <div className="flex gap-2 flex-wrap">{([['till', 'Show on the till (Sell Now)'], ['online', 'Show on the website']] as const).map(([k, l]) => <button key={k} aria-pressed={form[k]} onClick={() => setForm({ ...form, [k]: !form[k] })} className={cx('text-sm px-3.5 py-2 rounded-full border', form[k] ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{form[k] ? '✓ ' : ''}{l}</button>)}</div>
          {err && <span role="alert" className="text-sm text-danger">{err}</span>}
          <button onClick={save} className="btn-primary">{editing ? 'Save changes' : 'Add category'}</button>
          {editing && (
            <div className="flex gap-3 items-center flex-wrap">
              <Link to="/products" className="text-sm font-semibold text-brand">View its products</Link>
              <button disabled={inUse > 0} onClick={() => { setL((x) => x.map((c) => (c.name === sel ? { ...c, archived: true } : c))); setToast(`${sel} archived`); open(); }} className="btn-ghost min-h-9 text-xs text-danger disabled:opacity-40">Archive</button>
              <span className="text-xs text-muted">{inUse > 0 ? `Move its ${inUse} products to another category before archiving.` : 'Archived categories can be restored any time.'}</span>
            </div>
          )}
          <span className="text-xs text-muted">Managers can add and edit categories. Changes appear on the till, the website and in Products straight away.</span>
        </section>
      </div>
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}
