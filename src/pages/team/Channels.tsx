// Grow & team → Marketing → "Sell on other channels" (Admin only). Each marketplace (Facebook & Instagram Shop, TikTok
// Shop, Google Shopping, Jumia / Jiji, Amazon / eBay) is switched on through a setup form: the shop's account details,
// which categories to list, where stock comes from and how much to keep back, a price change for marketplace fees,
// which branch fulfils the orders and how often to sync. Only after "Activate" does the channel go live. A connected
// channel shows what is listed, when it last synced, and offers Edit setup, Sync now and Disconnect (details are kept,
// so switching back on reopens the form already filled in). Saved under ecompos.channels2.
import { useState } from 'react';
import { BRS, CATS0, PRODUCTS0, type BrId, type Category, type Product } from '../../data/catalogue';
import { cx } from '../../lib/format';
import { readKey, usePersist } from '../../lib/persist';
import { Card } from '../finance/shared';
import { Switch } from '../money/ui';
import { Modal } from '../admin/dev/ui';

/** One account-detail field in a channel's setup form. kind drives the check made before activating. */
type Field = { id: string; label: string; ph: string; kind: 'text' | 'email' | 'digits' | 'url' | 'number'; req: boolean; hint?: string };
/** A sales channel the business can list its catalogue on. */
type ChanDef = { k: string; name: string; d: string; fields: Field[]; terms: string; feeHint: string };
/** What the Admin set up for one channel. cats empty = every category. */
export type ChanSetup = {
  on: boolean; vals: Record<string, string>; cats: string[]; stockFrom: 'all' | BrId; buffer: number; markup: number;
  orderBr: BrId; freq: string; agree: boolean; since: string; synced: string;
};

const SITE = 'ebenezerunique.com.gh';
const CHANS: ChanDef[] = [
  { k: 'meta', name: 'Facebook & Instagram Shop', d: 'Catalogue synced to your Facebook Page and Instagram · tag products in posts', terms: 'Meta Commerce Policies', feeHint: 'Meta charges a selling fee on checkout orders; most shops leave prices the same.',
    fields: [
      { id: 'page', label: 'Facebook Page name', ph: 'Ebenezer Unique Ventures', kind: 'text', req: true },
      { id: 'ig', label: 'Instagram handle', ph: '@ebenezeruniquegh', kind: 'text', req: false },
      { id: 'cid', label: 'Commerce account ID', ph: 'e.g. 418827301', kind: 'digits', req: true, hint: 'Meta Commerce Manager → Settings → Business assets' },
      { id: 'pixel', label: 'Meta Pixel ID (optional)', ph: 'e.g. 1093847562', kind: 'digits', req: false, hint: 'Loads on the store only after visitors accept cookies' },
    ] },
  { k: 'tiktok', name: 'TikTok Shop', d: 'Catalogue and stock sync · sell from videos and LIVE', terms: 'TikTok Shop Seller Terms', feeHint: 'TikTok Shop takes a commission per order; add it here to keep your margin.',
    fields: [
      { id: 'shop', label: 'TikTok Shop name', ph: 'Ebenezer Unique Ventures', kind: 'text', req: true },
      { id: 'seller', label: 'Seller ID', ph: 'e.g. GHLC7Q2K9X', kind: 'text', req: true, hint: 'TikTok Shop Seller Center → My account' },
      { id: 'pickup', label: 'Pickup / return address', ph: '12 Oxford Street, Osu, Accra', kind: 'text', req: true },
    ] },
  { k: 'google', name: 'Google Shopping', d: 'Free product listings in Google Search, Images and Maps', terms: 'Google Merchant Center policies', feeHint: 'Free listings have no fee, so prices normally stay the same.',
    fields: [
      { id: 'mc', label: 'Merchant Center ID', ph: 'e.g. 5123987740', kind: 'digits', req: true, hint: 'Top right of Google Merchant Center' },
      { id: 'site', label: 'Your website', ph: SITE, kind: 'url', req: true, hint: 'Must be verified and claimed in Merchant Center' },
    ] },
  { k: 'jumia', name: 'Jumia / Jiji marketplaces', d: 'Orders flow into eComPOS like online orders', terms: 'Jumia Vendor Terms and Jiji rules', feeHint: 'Jumia commission on electronics is often 5–10%; add it here to keep your margin.',
    fields: [
      { id: 'email', label: 'Jumia Seller Center email', ph: 'sales@ebenezerunique.com.gh', kind: 'email', req: true },
      { id: 'seller', label: 'Jumia seller ID', ph: 'e.g. GH1A2B3C', kind: 'text', req: true },
      { id: 'jiji', label: 'Jiji shop link (optional)', ph: 'https://jiji.com.gh/shop/ebenezer-unique', kind: 'url', req: false },
    ] },
  { k: 'amazon', name: 'Amazon / eBay (UK store)', d: 'For Western branches · listed in pounds', terms: 'Amazon Business Solutions Agreement and eBay User Agreement', feeHint: 'Amazon and eBay fees are about 8–15%; add them here.',
    fields: [
      { id: 'store', label: 'Store name', ph: 'Ebenezer Unique UK', kind: 'text', req: true },
      { id: 'seller', label: 'Amazon seller ID or eBay user ID', ph: 'e.g. A2X9QK7ZL4M1', kind: 'text', req: true },
      { id: 'rate', label: 'Exchange rate (GHS per £1)', ph: 'e.g. 19.50', kind: 'number', req: true, hint: 'Ghana cedi prices are converted to pounds with this rate' },
    ] },
];
const FREQS = ['Every 15 minutes', 'Hourly', 'Daily at 06:00'];
/** A fresh, empty setup for a channel (orders go to Osu by default, the main branch). */
const blank = (): ChanSetup => ({ on: false, vals: {}, cats: [], stockFrom: 'all', buffer: 1, markup: 0, orderBr: 'osu', freq: 'Hourly', agree: false, since: '', synced: '' });
/** Facebook & Instagram and Google Shopping were already on in the demo, so they start connected with details. */
const SEED: Record<string, ChanSetup> = {
  meta: { ...blank(), on: true, vals: { page: 'Ebenezer Unique Ventures', ig: '@ebenezeruniquegh', cid: '418827301' }, agree: true, since: '3 Feb 2026', synced: 'Today 08:00' },
  google: { ...blank(), on: true, vals: { mc: '5123987740', site: SITE }, agree: true, since: '11 Mar 2026', synced: 'Today 06:00' },
};
const stamp = () => new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const brName = (id: string) => (id === 'all' ? 'all branches' : BRS.find((b) => b.id === id)?.name ?? id);

/**
 * Products a channel would list with this setup: live, marked for the website, in the chosen categories, and with
 * more stock (from the chosen branch or all branches) than the units kept back. Kept-back units stop a marketplace
 * selling the last item that is already in a customer's hands at the till.
 */
function listed(P: Product[], s: ChanSetup) {
  return P.filter((p) => p.status === 'live' && p.web && (!s.cats.length || s.cats.includes(p.cat)))
    .filter((p) => (s.stockFrom === 'all' ? Object.values(p.stock).reduce((a, b) => a + b, 0) : p.stock[s.stockFrom]) > s.buffer);
}

/** Brand and product names keep their capitals inside a sentence ("Enter the TikTok Shop name", not "tiktok shop"). */
const PROPER = /^(Facebook|Instagram|TikTok|Jumia|Jiji|Meta|Amazon|Merchant)\b/;
/** A field label as it reads mid-sentence: "Seller ID" → "seller ID"; brand names are left as they are. */
const midSentence = (l: string) => { const t = l.replace(/ \(optional\)$/, ''); return PROPER.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1); };

/** Check one field; returns the error message or ''. */
function fieldError(f: Field, v: string) {
  const t = v.trim();
  if (!t) return f.req ? `Enter the ${midSentence(f.label)}.` : '';
  if (f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `${f.label} is not a valid email address.`;
  if (f.kind === 'digits' && !/^\d{6,16}$/.test(t)) return `${f.label.replace(/ \(optional\)$/, '')} should be 6 to 16 digits.`;
  if (f.kind === 'url' && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(t)) return `${f.label.replace(/ \(optional\)$/, '')} is not a valid web address.`;
  if (f.kind === 'number' && !(parseFloat(t) > 0)) return `${f.label} must be a number above 0.`;
  return '';
}

/** The "Sell on other channels" card. Input: say(message) shows the page's message banner. */
export default function SellChannels({ say }: { say: (m: string) => void }) {
  const [S, setS] = usePersist<Record<string, ChanSetup>>('ecompos.channels2', SEED);
  const P = readKey<Product[]>('ecompos.products2', PRODUCTS0);
  const cats = readKey<Category[]>('ecompos.cats2', CATS0).filter((c) => !c.archived && c.online).map((c) => c.name);
  const [edit, setEdit] = useState<{ k: string; f: ChanSetup } | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [off, setOff] = useState<string | null>(null);
  const of = (k: string) => S[k] ?? blank();

  /** Switch clicked: switching on opens the setup form (already filled in if it was set up before); off asks first. */
  const toggle = (k: string) => {
    if (of(k).on) return setOff(k);
    setErrs([]); setEdit({ k, f: { ...of(k), agree: false } });
  };
  /** Activate / Save: check every detail, then put the channel live and note the first sync. */
  const activate = () => {
    if (!edit) return;
    const def = CHANS.find((c) => c.k === edit.k)!; const f = edit.f;
    const e = def.fields.map((x) => fieldError(x, f.vals[x.id] || '')).filter(Boolean);
    if (!listed(P, f).length) e.push('No products match these settings. Choose more categories or keep back fewer units.');
    if (f.markup < 0 || f.markup > 50) e.push('Price change must be between 0% and 50%.');
    if (!f.agree) e.push(`Tick to confirm your products follow the ${def.terms}.`);
    if (e.length) return setErrs(e);
    const was = of(edit.k).on; const now = stamp(); const n = listed(P, f).length;
    setS({ ...S, [edit.k]: { ...f, on: true, since: was && f.since ? f.since : now, synced: now } });
    setEdit(null); setErrs([]);
    say(was ? `${def.name} setup saved · ${n} products re-synced` : `${def.name} is live · ${n} products listed, orders go to ${brName(f.orderBr)}`);
  };
  /** Sync now: send current prices and stock to the channel straight away. */
  const syncNow = (k: string) => { const s = of(k); setS({ ...S, [k]: { ...s, synced: stamp() } }); say(`${CHANS.find((c) => c.k === k)!.name} synced · ${listed(P, s).length} products, prices and stock updated`); };
  /** Disconnect: listings come down; the details stay so it can be switched back on quickly. */
  const disconnect = (k: string) => { setS({ ...S, [k]: { ...of(k), on: false } }); setOff(null); say(`${CHANS.find((c) => c.k === k)!.name} disconnected · listings hidden, your setup details are kept`); };

  const inp = 'h-10 px-3.5 rounded-full border border-line text-sm font-normal w-full';
  const def = edit && CHANS.find((c) => c.k === edit.k)!;
  const f = edit?.f; const set = (p: Partial<ChanSetup>) => edit && setEdit({ ...edit, f: { ...edit.f, ...p } });
  const n = f ? listed(P, f).length : 0;
  // Price preview: the first listed product before and after the price change (and in pounds for the UK store).
  const ex = f ? listed(P, f)[0] : undefined;
  const exPrice = ex && f ? ex.price * (1 + f.markup / 100) : 0;
  const rate = f ? parseFloat(f.vals.rate || '') : NaN;
  return (
    <Card title="Sell on other channels">
      {CHANS.map((c) => { const s = of(c.k); return (
        <div key={c.k} className="flex flex-col gap-2 p-3 rounded-2xl bg-canvas">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm min-w-0"><b>{c.name}</b>{s.on && <span className="pill bg-green-100 text-green-800 ml-2 text-[10px]">Connected</span>}<br /><span className="text-muted text-xs">{c.d}</span></span>
            <Switch on={s.on} onChange={() => toggle(c.k)} label={c.name} />
          </div>
          {s.on && (
            <div className="flex flex-col gap-1.5 border-t border-line pt-2">
              <span className="text-xs text-sub">{listed(P, s).length} products listed · {s.cats.length ? s.cats.join(', ') : 'all categories'} · stock from {brName(s.stockFrom)}, {s.buffer} kept back · {s.markup ? `prices +${s.markup}%` : 'same prices as the store'} · orders to {brName(s.orderBr)} · {s.freq.toLowerCase()}</span>
              <span className="text-xs text-muted">Connected since {s.since || '—'} · last synced {s.synced || '—'}</span>
              <div className="flex gap-2 flex-wrap"><button onClick={() => { setErrs([]); setEdit({ k: c.k, f: { ...s } }); }} className="btn-ghost min-h-8 text-xs">Edit setup</button><button onClick={() => syncNow(c.k)} className="btn-ghost min-h-8 text-xs">Sync now</button></div>
            </div>
          )}
        </div>
      ); })}
      <span className="text-xs text-muted">Meta, TikTok and Google tags load only after visitors accept cookies. Every product has a share link and a printable QR code.</span>

      {edit && def && f && (
        <Modal wide title={`${f.on ? 'Edit' : 'Activate'} ${def.name}`} sub="Fill in the details, then activate. Nothing is listed until you do." onClose={() => setEdit(null)}>
          <b className="text-sm mt-1">1. Account details</b>
          <div className="grid gap-2 sm:grid-cols-2">
            {def.fields.map((x) => (
              <label key={x.id} className="text-xs font-semibold flex flex-col gap-1">{x.label}{x.req && <span className="sr-only"> (required)</span>}
                <input value={f.vals[x.id] || ''} onChange={(e) => set({ vals: { ...f.vals, [x.id]: e.target.value } })} placeholder={x.ph} inputMode={x.kind === 'digits' ? 'numeric' : x.kind === 'number' ? 'decimal' : x.kind === 'email' ? 'email' : undefined} aria-required={x.req} className={inp} />
                {x.hint && <span className="font-normal text-muted">{x.hint}</span>}
              </label>
            ))}
          </div>
          {def.k === 'google' && <span className="text-xs text-muted">Product feed for Merchant Center: <b className="break-all">https://{(f.vals.site || SITE).replace(/^https?:\/\//, '').replace(/\/$/, '')}/feeds/google.xml</b></span>}

          <b className="text-sm mt-2">2. What to list</b>
          <div className="flex gap-1.5 flex-wrap">
            <button type="button" aria-pressed={!f.cats.length} onClick={() => set({ cats: [] })} className={cx('h-8 px-3 rounded-full text-xs border', !f.cats.length ? 'bg-black text-white border-black' : 'border-line bg-white')}>All categories</button>
            {cats.map((c) => { const sel = f.cats.includes(c); return <button key={c} type="button" aria-pressed={sel} onClick={() => set({ cats: sel ? f.cats.filter((x) => x !== c) : [...f.cats, c] })} className={cx('h-8 px-3 rounded-full text-xs border', sel ? 'bg-black text-white border-black' : 'border-line bg-white')}>{c}</button>; })}
          </div>
          <span className="text-xs text-muted">Only live products marked “Show on website” are listed · <b className="text-black">{n} products</b> with these settings.</span>

          <b className="text-sm mt-2">3. Stock and price</b>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-semibold flex flex-col gap-1">Stock from<select value={f.stockFrom} onChange={(e) => set({ stockFrom: e.target.value as ChanSetup['stockFrom'] })} className={inp}><option value="all">All branches</option>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Keep back (units)<input type="number" min={0} value={f.buffer} onChange={(e) => set({ buffer: Math.max(0, parseInt(e.target.value) || 0) })} className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Price change (%)<input type="number" min={0} max={50} value={f.markup} onChange={(e) => set({ markup: parseFloat(e.target.value) || 0 })} className={inp} /></label>
          </div>
          <span className="text-xs text-muted">{def.feeHint}{ex && <> Example: {ex.name} GHS {ex.price.toLocaleString('en-GB', { minimumFractionDigits: 2 })} → <b className="text-black">{def.k === 'amazon' && rate > 0 ? `£${(exPrice / rate).toFixed(2)}` : `GHS ${exPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</b> on {def.name.split(' ')[0]}.</>}</span>

          <b className="text-sm mt-2">4. Orders and sync</b>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold flex flex-col gap-1">Orders go to<select value={f.orderBr} onChange={(e) => set({ orderBr: e.target.value as BrId })} className={inp}>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name} branch</option>)}</select></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Sync prices and stock<select value={f.freq} onChange={(e) => set({ freq: e.target.value })} className={inp}>{FREQS.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <label className="flex items-start gap-2 text-sm mt-1"><input type="checkbox" checked={f.agree} onChange={() => set({ agree: !f.agree })} className="mt-1" />I confirm our products and listings follow the {def.terms}.</label>

          {errs.length > 0 && <div role="alert" className="rounded-2xl bg-red-50 text-danger px-4 py-3 text-sm flex flex-col gap-0.5">{errs.map((x) => <span key={x}>{x}</span>)}</div>}
          <div className="flex gap-2 flex-wrap"><button onClick={activate} className="btn-primary">{f.on ? 'Save changes' : `Activate ${def.name.split(' ')[0]}`}</button><button onClick={() => setEdit(null)} className="btn-ghost">Cancel</button></div>
        </Modal>
      )}
      {off && (
        <Modal title={`Disconnect ${CHANS.find((c) => c.k === off)!.name}?`} onClose={() => setOff(null)}>
          <span className="text-sm text-sub">Your listings come down from {CHANS.find((c) => c.k === off)!.name} at the next sync and no new orders arrive from it. Orders already received are not affected. Your setup details are kept, so you can switch it back on later.</span>
          <div className="flex gap-2"><button onClick={() => disconnect(off)} className="btn-primary bg-danger border-danger">Disconnect</button><button onClick={() => setOff(null)} className="btn-ghost">Keep connected</button></div>
        </Modal>
      )}
    </Card>
  );
}
