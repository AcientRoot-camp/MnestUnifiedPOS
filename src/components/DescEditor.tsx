// Product description field for the POS (Products → Add product, and Edit → Details) with "✨ Auto-generate":
// drafts a full, Shopify-style description from the product's name, category, price and pack (lib/describe.ts),
// optionally using key details and a tone the staff member picks, and a Preview that shows it exactly as Sell Now
// and the online store will. The text is saved on the product, so the POS and the website share one description.
import { useState } from 'react';
import { isStubDesc, writeDescription, type DescInput, type DescTone } from '../lib/describe';
import { cx } from '../lib/format';
import ProductDesc from './ProductDesc';

/**
 * Inputs: value / onChange (the description text), input (what is known about the product, for the generator),
 * label (field label). The textarea keeps aria-label "Description".
 */
export default function DescEditor({ value, onChange, input, label = 'Description (Sell Now and online store)' }: { value: string; onChange: (v: string) => void; input: DescInput; label?: string }) {
  const [gen, setGen] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [o, setO] = useState<{ features: string; tone: DescTone; audience: string }>({ features: '', tone: 'Friendly', audience: '' });
  const [note, setNote] = useState('');
  const has = !isStubDesc({ name: input.name, cat: input.cat, desc: value });
  /** Write the draft into the field and show the preview so staff read it before saving. */
  const run = () => {
    if (input.name.trim().length < 2) { setNote('Type the product name first, so the description can be written for it.'); return; }
    onChange(writeDescription({ ...input, ...o }));
    setGen(false); setView('preview'); setNote('✓ Description written. Read it, edit anything that is not right, then save the product.');
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="flex gap-1.5">
          <button type="button" onClick={() => { setGen(!gen); setNote(''); }} aria-expanded={gen} className="h-8 px-3 rounded-full text-xs font-semibold bg-brand-50 text-brand hover:bg-brand-100">✨ Auto-generate</button>
          <button type="button" onClick={() => setView(view === 'edit' ? 'preview' : 'edit')} aria-pressed={view === 'preview'} disabled={!value.trim()} className="h-8 px-3 rounded-full text-xs font-semibold border border-line disabled:opacity-40">{view === 'edit' ? 'Preview' : 'Edit text'}</button>
        </span>
      </div>
      {gen && (
        <div className="p-3 rounded-2xl bg-canvas flex flex-col gap-2">
          <span className="text-xs text-sub">Writes an opening paragraph, highlights, a specification table, how to use and storage tips from the name, category, price and pack size. Add anything else you know (comma separated; “Brand: Royal Aroma” style items go into the table).</span>
          <input value={o.features} onChange={(e) => setO({ ...o, features: e.target.value })} placeholder="Key details, e.g. long-grain, aromatic, Brand: Royal Aroma, Origin: Thailand" aria-label="Key details" className="field py-2 font-normal text-sm" />
          <input value={o.audience} onChange={(e) => setO({ ...o, audience: e.target.value })} placeholder="Who it is for (optional), e.g. families and chop bars" aria-label="Who it is for" className="field py-2 font-normal text-sm" />
          <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Tone</span>{(['Friendly', 'Premium', 'Simple'] as DescTone[]).map((t) => <button type="button" key={t} onClick={() => setO({ ...o, tone: t })} aria-pressed={o.tone === t} className={cx('h-8 px-3 rounded-full text-xs font-semibold', o.tone === t ? 'bg-black text-white' : 'bg-white border border-line')}>{t}</button>)}
            <button type="button" onClick={run} className="ml-auto h-9 px-4 rounded-full bg-black text-white text-xs font-semibold">{has ? 'Replace with new description' : 'Generate description'}</button></div>
        </div>
      )}
      {view === 'edit'
        ? <textarea aria-label="Description" rows={value.split('\n').length > 6 ? 10 : 4} value={value} onChange={(e) => onChange(e.target.value)} placeholder="What it is, size or pack, and why customers buy it. Use ## for a heading and - for a bullet point." className="p-3 rounded-2xl border border-line font-normal text-sm leading-6" />
        : <div className="p-4 rounded-2xl border border-line max-h-[360px] overflow-y-auto" aria-label="Description preview"><ProductDesc text={value} dense /></div>}
      {note && <span role="status" className="text-xs text-ok">{note}</span>}
      {!note && <span className="text-xs text-muted">Shown on Sell Now (product info) and on the online store’s product page.</span>}
    </div>
  );
}
