// Products: one catalogue for the till and the website · add, approve, edit, price, track, and the product barcodes
// (productscan.md §2): live barcode checks, camera / handheld scanning, shop-made 200… codes, carton (ITF-14) codes
// and printed barcode labels.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Toast } from '../../components/ui';
import { BRS, CATS0, PRODUCTS0, now, total, type Category, type Product } from '../../data/catalogue';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Pills } from '../finance/shared';
import BarcodeCamera from '../../components/BarcodeCamera';
import { LabelSheet } from '../../components/BarcodeLabel';
import { barcodeCheck, cartonCodeFor, cartonOf, cartonTxt, cleanCode, ctName, nextShopBarcode, perCarton } from '../../lib/barcode';
import { labelCommands, downloadPrn, sendUsb, usbSupported } from '../../lib/labelPrint';
import { labelPrinterFor } from '../../data/devices';
import { claimCodes, serverShopCode } from '../../lib/serverSync';
import { BRANCHES } from '../../data/nav';
import DescEditor from '../../components/DescEditor';
import { plainText, shownDesc } from '../../lib/describe';
import { ScanBox } from './ScanStock';
import ScanWaySwitch from '../../components/ScanWaySwitch';

type NP = { name: string; cat: string; sku: string; barcode: string; cartonBc: string; ctSize: string; ctLabel: NonNullable<Product['ctLabel']>; desc: string; price: string; carton: string; cost: string; qty: string; scope: string; web: boolean; pos: boolean };
const EMPTY: NP = { name: '', cat: 'TV', sku: '', barcode: '', cartonBc: '', ctSize: '12', ctLabel: 'Carton', desc: '', price: '', carton: '', cost: '', qty: '', scope: 'all', web: true, pos: true };
/** Which field a scan fills: the new product's barcode / carton barcode, or the open product's. */
type ScanFor = 'main' | 'carton' | 'editMain' | 'editCarton' | 'unit' | 'variant';
const margin = (p: number, c: number) => (p && c ? `${Math.round(((p - c) / p) * 1000) / 10}%` : '—');

/** Every product photo becomes the same 800 × 800 square (white background, whole product visible), so store and till cards line up. */
function squareImage(src: string, size = 800): Promise<string> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const x = c.getContext('2d'); if (!x) return res(src);
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, size, size);
      const pad = size * 0.06; const k = Math.min((size - pad * 2) / im.width, (size - pad * 2) / im.height);
      const w = im.width * k, h = im.height * k;
      x.imageSmoothingQuality = 'high'; x.drawImage(im, (size - w) / 2, (size - h) / 2, w, h);
      res(c.toDataURL('image/jpeg', 0.86));
    };
    im.onerror = () => res(src);
    im.src = src;
  });
}

export default function Products() {
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role];
  const [L, setL] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [cats] = usePersist<Category[]>('ecompos.cats2', CATS0);
  const [pq, setPq] = useState('');
  const [cat, setCat] = useState('All');
  const [adding, setAdding] = useState(false);
  const [np, setNp] = useState<NP>(EMPTY);
  const [imgs, setImgs] = useState<string[]>([]);
  const [imgErr, setImgErr] = useState('');
  const [addErr, setAddErr] = useState('');
  const [scan, setScan] = useState<'' | 'cam' | 'usb'>('');
  const [scanFor, setScanFor] = useState<ScanFor>('main');
  const [scanIn, setScanIn] = useState('');
  const [labels, setLabels] = useState<null | { n: string; err?: string }>(null); // print barcode labels dialog
  const [params, setParams] = useSearchParams();
  const [sent, setSent] = useState('');
  const [bulk, setBulk] = useState(false);
  const [bulkP, setBulkP] = useState<Record<string, string>>({});
  const [sel, setSel] = useState('');
  const [tab, setTab] = useState<'details' | 'units' | 'pricing' | 'tracking'>('details');
  const [edit, setEdit] = useState<Partial<Product>>({});
  const [q, setQ] = useState<Record<string, { cost?: string; rej?: string; rejOpen?: boolean; err?: string }>>({});
  const [toast, setToast] = useState('');
  const set = (p: Partial<NP>) => { setNp((x) => ({ ...x, ...p })); setAddErr(''); };
  // Opening stock counted by scanning (tablet / phone camera or a barcode scanner): each scan of this product's barcode
  // adds 1; the first scan fills in the barcode when it is still empty.
  const [countScan, setCountScan] = useState(false);
  const [countMsg, setCountMsg] = useState('');
  const countOne = (raw: string) => {
    const c = cleanCode(raw); if (!c) return;
    setNp((x) => {
      if (!x.barcode || cleanCode(x.barcode) === c) { const q = (parseInt(x.qty, 10) || 0) + 1; setCountMsg(`✓ ${c} · ${q} counted`); return { ...x, barcode: x.barcode || c, qty: String(q) }; }
      setCountMsg(`${c} is a different barcode from this product (${x.barcode}). Only this product's barcode is counted.`); return x;
    });
  };
  const [uf, setUf] = useState({ label: 'Half carton', size: '', price: '', bc: '' }); // new extra unit (Units & variants)
  const [vf, setVf] = useState({ size: '', price: '', bc: '' }); // new variant (another size)
  /** Every code on the product being edited (its own codes are not a clash with themselves, but a unit may not repeat one). */
  const codesOfEv = (x: Product) => [cleanCode(x.barcode), cartonOf(x), ...(x.units || []).map((u) => cleanCode(u.bc || ''))].filter(Boolean);
  /**
   * Add a variant (another size) of a product: a new product linked to it (variantOf) with its own SKU, price, stock
   * (starts at 0) and barcode (a shop code when none is given). Non-Admins send it for approval like any new product.
   */
  const addVariant = async (pa: Product) => {
    const size = vf.size.trim(); const price = parseFloat(vf.price) || 0;
    if (size.length < 1 || !(price > 0)) return setToast('Type the size and its price.');
    // The name without its size: "Nasco 138L Fridge" → "Nasco Fridge", so the variant reads "Nasco 210L Fridge".
    const base = (pa.size && pa.name.endsWith(pa.size) ? pa.name.slice(0, -pa.size.length) : pa.name.replace(/\s*\d+(\.\d+)?\s*(kg|g|l|ml)$/i, '')).trim();
    const name = `${base} ${size}`;
    if (L.some((x) => x.name.toLowerCase() === name.toLowerCase())) return setToast(`${name} already exists.`);
    const chk = vf.bc ? barcodeCheck(vf.bc, L) : null; if (chk?.block) return setToast(chk.msg);
    const id = 'p' + Date.now();
    const bc = cleanCode(vf.bc) || (await serverShopCode()) || nextShopBarcode(L);
    const clash = await claimCodes(id, name, [bc]); if (clash) return setToast(clash);
    const v: Product = { ...pa, id, name, sku: `${pa.sku}-${size.replace(/\W+/g, '').toUpperCase()}`, barcode: bc, cartonBc: undefined, units: undefined, price, sale: undefined, saleFrom: undefined, saleTo: undefined, carton: undefined, cost: SU ? pa.cost : 0, stock: { osu: 0, legon: 0, adum: 0 }, wh: 0, reserved: 0, sold30: 0, status: SU ? 'live' : 'pending', variantOf: pa.id, size, by: `${me.name} (${me.level})`, when: now(), serials: undefined, img: pa.img };
    setL((x) => [v, ...x]); setVf({ size: '', price: '', bc: '' });
    setToast(SU ? `${name} added as a variant · receive stock for it in Inventory` : `${name} sent to the Admin for approval`);
  };
  // From Sell Now "Add as new product": open the form with the scanned barcode filled in (/products?barcode=…).
  // From global search: open a product (/products?open=<id>).
  useEffect(() => { const o = params.get('open'); if (o) { setSel(o); setEdit({}); setTab('details'); setAdding(false); params.delete('open'); setParams(params, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const b = params.get('barcode'); if (b) { setAdding(true); setSel(''); setNp((x) => ({ ...x, barcode: cleanCode(b) })); params.delete('barcode'); setParams(params, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Open the scan dialog for one field (camera first). */
  const openScan = (f: ScanFor) => { setScanFor(f); setScanIn(''); setScan('cam'); };
  const up = (id: string, p: Partial<Product>) => setL((x) => x.map((y) => (y.id === id ? { ...y, ...p } : y)));

  const catNames = cats.filter((c) => !c.archived).map((c) => c.name);
  const live = L.filter((p) => p.status === 'live');
  // Search by name, SKU, category or barcode (main or carton).
  const shown = live.filter((p) => (cat === 'All' || p.cat === cat) && (!pq.trim() || (p.name + p.sku + p.barcode + cartonOf(p) + p.cat).toLowerCase().includes(cleanCode(pq).toLowerCase() || pq.toLowerCase())));
  const queue = L.filter((p) => p.status === 'pending' && (SU || p.by?.startsWith(me.name)));
  const e = L.find((p) => p.id === sel);
  const ev = e ? { ...e, ...edit } : null;
  // Scheduled sale checks: the sale price must be below the normal price and the dates in order (blocks Save).
  const saleErr = !ev || ev.sale === undefined ? '' : !(ev.sale > 0) ? 'Type a sale price above GHS 0.00, or remove the sale.' : ev.sale >= ev.price ? `The sale price must be lower than the selling price (${ghs(ev.price)}).` : ev.saleFrom && ev.saleTo && ev.saleTo < ev.saleFrom ? 'The sale cannot end before it starts.' : '';
  const npP = parseFloat(np.price) || 0, npC = parseFloat(np.cost) || 0;
  // Live barcode checks (productscan.md §2.1). A carton code must also differ from the single code.
  const bcNew = barcodeCheck(np.barcode, L);
  const ctNew = np.cartonBc ? (cleanCode(np.cartonBc) === cleanCode(np.barcode) ? { msg: 'The carton barcode must be different from the single barcode.', color: '#c62828', block: true } : barcodeCheck(np.cartonBc, L)) : null;
  const bcEdit = ev && edit.barcode !== undefined ? barcodeCheck(ev.barcode, L, ev.id) : null;
  const ctEdit = ev && edit.cartonBc !== undefined && ev.cartonBc ? (cleanCode(ev.cartonBc) === cleanCode(ev.barcode) ? { msg: 'The carton barcode must be different from the single barcode.', color: '#c62828', block: true } : barcodeCheck(ev.cartonBc, L, ev.id)) : null;

  const save = async () => {
    if (np.name.trim().length < 2) return setAddErr('Enter the product name.');
    if (L.some((p) => p.name.toLowerCase() === np.name.trim().toLowerCase())) return setAddErr('A product with this name already exists.');
    if (!(npP > 0)) return setAddErr('Enter the selling price.');
    if (bcNew.block) return setAddErr(bcNew.msg);
    if (ctNew?.block) return setAddErr(ctNew.msg);
    if (SU && npC && npC >= npP) return setAddErr('The cost price is higher than the selling price.');
    const ctN = parseInt(np.ctSize, 10) || 12;
    if (parseFloat(np.carton) > 0 && !(ctN > 1)) return setAddErr('A carton must hold more than one single.');
    const id = 'p' + Date.now();
    // Barcodes are unique per company: the server checks them against every till (409 when another product has it).
    // A shop code with no barcode typed comes from the server's sequence; offline, the device's own checks apply.
    const main = cleanCode(np.barcode) || (await serverShopCode()) || nextShopBarcode(L);
    const ctCode = np.carton && np.cartonBc ? cleanCode(np.cartonBc) : '';
    const clash = await claimCodes(id, np.name.trim(), [main, ctCode].filter(Boolean));
    if (clash) return setAddErr(clash);
    const q0 = parseInt(np.qty, 10) || 0;
    const stock = { osu: 0, legon: 0, adum: 0 };
    if (np.scope === 'all') { stock.osu = Math.ceil(q0 / 3); stock.legon = Math.floor(q0 / 3); stock.adum = q0 - stock.osu - stock.legon; } else stock[np.scope as 'osu'] = q0;
    const p: Product = { id, name: np.name.trim(), cat: np.cat, sku: np.sku || 'SKU-' + id.slice(-6), barcode: main, cartonBc: ctCode || undefined, price: npP, carton: parseFloat(np.carton) || undefined, ...(parseFloat(np.carton) > 0 ? { ctSize: ctN, ctLabel: np.ctLabel } : {}), cost: SU ? npC : 0, stock, wh: 0, reserved: 0, reorder: 5, sold30: 0, web: np.web, pos: np.pos, status: SU ? 'live' : 'pending', desc: np.desc, supplier: '', track: 'batch', scope: np.scope as Product['scope'], by: `${me.name} (${me.level})`, when: now() };
    if (imgs[0]) p.img = imgs[0];
    p.isNew = true;
    setL((x) => [p, ...x]);
    setAdding(false); setNp(EMPTY); setImgs([]);
    if (SU) setToast(`${p.name} is live on ${[p.pos && 'Sell Now', p.web && 'the website'].filter(Boolean).join(' and ')}.`);
    else setSent(p.name);
  };

  const addImgs = (files: FileList | null) => {
    if (!files) return;
    const ok = Array.from(files).filter((f) => /image\/(png|jpeg|webp)/.test(f.type) && f.size < 2e6);
    if (ok.length < files.length) setImgErr('Some files were skipped: use PNG, JPG or WebP under 2 MB.'); else setImgErr('');
    ok.slice(0, 6 - imgs.length).forEach((f) => { const r = new FileReader(); r.onload = () => squareImage(String(r.result)).then((u) => setImgs((x) => [...x, u].slice(0, 6))); r.readAsDataURL(f); });
  };
  /** A scanned code fills the chosen field and closes the dialog; the live check under the field then explains it. */
  const acceptScan = (code: string) => {
    const c = cleanCode(code);
    if (!c) return;
    if (scanFor === 'main') set({ barcode: c });
    else if (scanFor === 'carton') set({ cartonBc: c });
    else if (scanFor === 'editMain') setEdit({ ...edit, barcode: c });
    else if (scanFor === 'unit') setUf((u) => ({ ...u, bc: c }));
    else if (scanFor === 'variant') setVf((v) => ({ ...v, bc: c }));
    else setEdit({ ...edit, cartonBc: c });
    setScan(''); setScanIn('');
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Products</h1><p className="m-0 text-sm text-muted">One catalogue for the till and the website</p></div>
        <div className="flex gap-2 flex-wrap">
          <label className="btn-ghost cursor-pointer">Import CSV / supplier list<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(ev2) => { const f = ev2.target.files?.[0]; if (!f) return; f.text().then((t) => { const rows = t.split(/\r?\n/).slice(1).filter(Boolean); setToast(`${rows.length} rows read from ${f.name}. Check them in Bulk edit before publishing.`); }); }} /></label>
          <button onClick={() => setBulk(!bulk)} aria-pressed={bulk} className={bulk ? 'btn-dark' : 'btn-ghost'}>Bulk edit</button>
          <button onClick={() => { setAdding(true); setSel(''); }} className="btn-primary"><Icon name="plus" /> Add product</button>
        </div>
      </header>
      <div className="card p-4 flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[13px] font-semibold flex-1 min-w-[260px]">Search products<input value={pq} onChange={(x) => setPq(x.target.value)} placeholder="Search products by name, SKU, barcode or category" className="field font-normal py-2.5" /></label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Category<select value={cat} onChange={(x) => setCat(x.target.value)} className="px-4 py-2.5 rounded-full border border-line font-normal"><option value="All">All categories ({live.length})</option>{catNames.map((c) => <option key={c} value={c}>{c} ({live.filter((p) => p.cat === c).length})</option>)}</select></label>
        <span className="text-sm text-muted pb-2.5">{shown.length} products</span>
        <Link to="/categories" className="text-sm font-semibold text-brand pb-2.5">+ Add or manage categories</Link>
        <span className="text-xs text-muted w-full">Collections: Popular this week · Wholesale deals · New in</span>
      </div>

      {adding && (
        <section className="card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex justify-between gap-2"><h2 className="m-0 text-lg font-semibold">Add product</h2><span className="text-xs text-muted">Adding as {me.level}</span></div>
          <div className="grid md:grid-cols-2 gap-3">
            <L2 label="Product name"><input value={np.name} onChange={(x) => set({ name: x.target.value })} placeholder='e.g. TCL 43" 4K UHD Google TV' className="field py-2.5 font-normal" /></L2>
            <L2 label={<span>Category</span>}><select aria-label="Category" value={np.cat} onChange={(x) => set({ cat: x.target.value })} className="field py-2.5 font-normal">{catNames.map((c) => <option key={c}>{c}</option>)}</select><Link to="/categories" className="text-xs text-brand font-normal">Add a new category</Link></L2>
            <L2 label="SKU"><input value={np.sku} onChange={(x) => set({ sku: x.target.value })} placeholder="Made for you if blank" className="field py-2.5 font-normal" /></L2>
            <L2 label={<span>Barcode (from the product packaging)</span>}>
              <BcField value={np.barcode} onChange={(v) => set({ barcode: v })} onScan={() => openScan('main')} check={bcNew} label="Barcode" />
              <button onClick={() => set({ barcode: nextShopBarcode(L) })} className="text-xs text-brand font-semibold w-fit">No barcode on the pack? Create a shop barcode</button>
            </L2>
            {parseFloat(np.carton) > 0 && (
              <L2 label={<span>Carton barcode (ITF-14 · on the outer carton)</span>}>
                <div className="flex gap-2 flex-wrap font-normal"><label className="flex items-center gap-1.5 text-xs">Singles in one<input inputMode="numeric" aria-label="Singles in one carton" value={np.ctSize} onChange={(x) => set({ ctSize: x.target.value.replace(/\D/g, '') })} className="w-16 px-2 py-1.5 rounded-lg border border-line" /></label><Pills small opts={[['Carton', 'Carton'], ['Crate', 'Crate'], ['Pack', 'Pack']]} value={np.ctLabel} onChange={(v) => set({ ctLabel: v as NP['ctLabel'] })} /></div>
                <BcField value={np.cartonBc} onChange={(v) => set({ cartonBc: v })} onScan={() => openScan('carton')} check={ctNew || { msg: `Scanning it sells or receives a whole ${np.ctLabel.toLowerCase()} of ${parseInt(np.ctSize, 10) || 12}. Leave empty to use the standard code made from the single barcode.`, color: '#5f5c5a', block: false }} label="Carton barcode" />
                {cartonCodeFor(np.barcode) && <button onClick={() => set({ cartonBc: cartonCodeFor(np.barcode) })} className="text-xs text-brand font-semibold w-fit">Make from the single barcode ({cartonCodeFor(np.barcode)})</button>}
              </L2>
            )}
          </div>
          {/* Shared description (POS + online store) with ✨ Auto-generate and a preview (components/DescEditor). */}
          <DescEditor value={np.desc} onChange={(v) => set({ desc: v })} input={{ name: np.name, cat: np.cat, price: parseFloat(np.price) || undefined, ctSize: parseFloat(np.carton) > 0 ? parseInt(np.ctSize, 10) || 12 : undefined, ctLabel: np.ctLabel }} />
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Product images · the first one is the main image on the till and website <span className="font-normal text-muted">{imgs.length} of 6 · PNG, JPG or WebP, under 2 MB each</span></span>
            <div className="flex gap-2 flex-wrap">
              {imgs.map((s, i) => <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-line"><img src={s} alt={np.name} className="w-full h-full object-cover" />{i === 0 ? <span className="absolute left-1 top-1 pill bg-black text-white">Main</span> : <button onClick={() => setImgs((x) => [x[i], ...x.filter((_, j) => j !== i)])} className="absolute left-1 bottom-1 text-[10px] px-1.5 py-0.5 rounded bg-white">Make main</button>}<button aria-label="Remove image" onClick={() => setImgs((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 w-5 h-5 rounded-full bg-white text-xs">×</button></div>)}
              {imgs.length < 6 && <label className="w-24 h-24 rounded-xl border-2 border-dashed border-line flex flex-col items-center justify-center text-xs text-muted cursor-pointer hover:bg-canvas"><Icon name="camera" />Add images<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(x) => addImgs(x.target.files)} /></label>}
            </div>
            {imgErr && <span className="text-xs text-danger">{imgErr}</span>}
            <span className="text-xs text-muted">Alt text is filled in from the product name for screen readers. Photos are resized for the website automatically.</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <L2 label="Selling price (GHS)"><input type="number" min={0} step="0.01" value={np.price} onChange={(x) => set({ price: x.target.value })} placeholder="0.00" className="field py-2.5 font-normal" /></L2>
            <L2 label="Carton / crate / pack price (optional)"><input type="number" min={0} step="0.01" value={np.carton} onChange={(x) => set({ carton: x.target.value })} placeholder="0.00" className="field py-2.5 font-normal" /></L2>
            {SU ? <L2 label="Cost price (GHS) · Admin only"><input type="number" min={0} step="0.01" value={np.cost} onChange={(x) => set({ cost: x.target.value })} placeholder="0.00" className="field py-2.5 font-normal" /><span className="text-xs font-normal text-muted">Profit per unit {ghs(Math.max(0, npP - npC))} · {margin(npP, npC)}</span></L2> : <div className="p-3 rounded-2xl bg-canvas text-xs"><b>Cost price</b><br />Hidden from your account · the Admin adds the cost price and approves the product before it appears on Sell Now and the website.</div>}
            <L2 label={<span className="flex justify-between w-full">Opening stock<button type="button" onClick={() => { setCountScan(!countScan); setCountMsg(''); }} aria-expanded={countScan} className="text-xs text-brand font-semibold">{countScan ? 'Done counting' : '▦ Count by scanning'}</button></span>}><input type="number" min={0} value={np.qty} onChange={(x) => set({ qty: x.target.value })} placeholder="0" className="field py-2.5 font-normal" />
              {countScan && <div className="flex flex-col gap-1.5 mt-1 font-normal"><ScanBox multi compact label="Scan each unit to count opening stock" onCode={countOne} /><ScanWaySwitch />{countMsg && <span role="status" className="text-xs">{countMsg}</span>}</div>}</L2>
            <L2 label="Available at"><select value={np.scope} onChange={(x) => set({ scope: x.target.value })} className="field py-2.5 font-normal"><option value="all">Every branch</option>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name} only</option>)}</select><span className="text-xs font-normal text-muted">{np.scope === 'all' ? 'Opening stock is split across the branches.' : 'Only this branch can sell it.'}</span></L2>
          </div>
          <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Where it's sold · both are on for every new product</span><div className="flex gap-2 flex-wrap">{([['pos', 'Sell Now (till)', 'Shows on every till'], ['web', 'Website', 'Shows in the online shop']] as const).map(([k, l, n]) => <button key={k} aria-pressed={np[k]} onClick={() => set({ [k]: !np[k] } as Partial<NP>)} className={cx('text-left p-3 rounded-2xl border min-w-[200px]', np[k] ? 'border-brand bg-brand-50' : 'border-line')}><b className="text-sm">{np[k] ? '✓ ' : ''}{l}</b><br /><span className="text-xs text-muted">{n}</span></button>)}</div></div>
          {addErr && <span role="alert" className="text-sm text-danger">{addErr}</span>}
          <div className="flex gap-2 justify-end"><button onClick={() => { setAdding(false); setNp(EMPTY); }} className="btn-ghost">Cancel</button><button onClick={save} className="btn-primary">{SU ? 'Save product' : 'Send for approval'}</button></div>
        </section>
      )}

      {sent && <div className="card p-4 flex items-center gap-3 flex-wrap bg-brand-50"><span className="flex-1 text-sm">{sent} was sent to Ebenezer Mensah (Admin) for approval. It will appear on Sell Now and the website once the cost price is added and it is approved. You will get a notification.</span><button onClick={() => setSent('')} className="btn-ghost min-h-9 text-xs">Close</button></div>}

      {queue.length > 0 && (
        <section className="card p-5 sm:p-6 flex flex-col gap-3">
          <div className="flex justify-between items-center"><div><h2 className="m-0 text-lg font-semibold">{SU ? 'Waiting for your approval' : 'Sent for approval'}</h2><span className="text-[13px] text-muted">{SU ? 'Add the cost price, then approve to publish on Sell Now and the website' : 'The Admin adds the cost price and approves'}</span></div><span className="pill bg-danger text-white">{queue.length}</span></div>
          {queue.map((p) => {
            const s = q[p.id] || {};
            const c = parseFloat(s.cost || '') || 0;
            return (
              <div key={p.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
                <div className="flex justify-between gap-2 flex-wrap"><b>{p.name}</b><span className="pill bg-amber-100 text-amber-900">Waiting</span></div>
                <span className="text-xs text-muted">{p.cat} · selling price {ghs(p.price)} · barcode {p.barcode} · opening stock {total(p)}</span>
                <span className="text-sm line-clamp-3">{plainText(p.desc)}</span>
                <span className="text-xs text-muted">Added by {p.by} · {p.when} · will show {[p.pos && 'on Sell Now', p.web && 'on the website'].filter(Boolean).join(' and ')}</span>
                {SU && (
                  <div className="flex gap-2 items-end flex-wrap">
                    <label className="flex flex-col gap-1 text-xs font-semibold">Cost price (GHS) · Admin only<input type="number" min={0} step="0.01" value={s.cost || ''} onChange={(x) => setQ({ ...q, [p.id]: { ...s, cost: x.target.value, err: '' } })} placeholder="0.00" className="px-3 py-2 rounded-full border border-line font-normal w-36" /></label>
                    <span className="text-xs text-muted pb-2">Profit per unit {ghs(Math.max(0, p.price - c))}</span>
                    <button onClick={() => { if (!(c > 0)) return setQ({ ...q, [p.id]: { ...s, err: 'Add the cost price before approving.' } }); up(p.id, { status: 'live', cost: c }); setToast(`${p.name} approved and published. ${p.by?.split(' (')[0]} was notified.`); }} className="btn bg-ok text-white min-h-9 text-xs">Approve & publish</button>
                    <button onClick={() => setQ({ ...q, [p.id]: { ...s, rejOpen: true } })} className="btn-ghost min-h-9 text-xs text-danger">Reject</button>
                  </div>
                )}
                {s.err && <span className="text-xs text-danger">{s.err}</span>}
                {s.rejOpen && <div className="flex gap-2 items-end flex-wrap"><label className="flex flex-col gap-1 text-xs font-semibold flex-1">Tell {p.by?.split(' ')[0]} why (they will be notified)<input value={s.rej || ''} onChange={(x) => setQ({ ...q, [p.id]: { ...s, rej: x.target.value } })} placeholder="e.g. Duplicate of an existing product" className="px-3 py-2 rounded-full border border-line font-normal" /></label><button onClick={() => { up(p.id, { status: 'rejected', reason: s.rej || 'No reason given' }); setToast(`${p.name} rejected`); }} className="btn bg-danger text-white min-h-9 text-xs">Confirm reject</button><button onClick={() => setQ({ ...q, [p.id]: { ...s, rejOpen: false } })} className="btn-ghost min-h-9 text-xs">Cancel</button></div>}
              </div>
            );
          })}
        </section>
      )}

      <div className={cx('grid gap-6 items-start', ev && '2xl:grid-cols-[1fr_520px]')}>
        <section className="card p-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[760px]">
            <thead><tr>{['Product', 'Price', ...(SU ? ['Cost', 'Profit · margin'] : []), 'Stock (all)', 'Website', 'Till'].map((h) => <th key={h} scope="col" className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-2 py-2 border-b border-line">{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className={cx(sel === p.id && 'bg-brand-50')}>
                  <td className="px-2 py-2 border-b border-line"><button onClick={() => { setSel(p.id); setEdit({}); setTab('details'); setAdding(false); }} className="flex items-center gap-3 text-left"><span className="w-10 h-10 rounded-xl bg-canvas text-brand flex items-center justify-center flex-none"><Icon name="products" /></span><span><b>{p.name}</b><br /><span className="text-xs text-muted">{p.sku} · {p.cat}</span>{p.scope !== 'all' && <span className="pill bg-canvas ml-1">{BRS.find((b) => b.id === p.scope)?.name} only</span>}{total(p) <= p.reorder && p.track !== 'digital' && <span className="pill bg-red-100 text-red-800 ml-1">Low</span>}</span></button></td>
                  <td className="px-2 py-2 border-b border-line">{bulk ? <input aria-label={`New price for ${p.name}`} value={bulkP[p.id] ?? ''} onChange={(x) => setBulkP({ ...bulkP, [p.id]: x.target.value })} placeholder={p.price.toFixed(2)} className="w-24 px-2 py-1 rounded-lg border border-line" /> : ghs(p.price)}</td>
                  {SU && <><td className="px-2 py-2 border-b border-line">{ghs(p.cost)}</td><td className="px-2 py-2 border-b border-line">{ghs(p.price - p.cost)} · {margin(p.price, p.cost)}</td></>}
                  <td className="px-2 py-2 border-b border-line">{p.track === 'digital' ? '—' : total(p)}</td>
                  {(['web', 'pos'] as const).map((k) => <td key={k} className="px-2 py-2 border-b border-line"><button role="switch" aria-checked={p[k]} aria-label={`${k === 'web' ? 'Website' : 'Till'}: ${p.name}`} onClick={() => up(p.id, { [k]: !p[k] })} className={cx('w-10 h-6 rounded-full relative', p[k] ? 'bg-ok' : 'bg-[#cccccc]')}><span className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', p[k] ? 'left-[18px]' : 'left-0.5')} /></button></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="text-sm text-muted p-3">No product matches that search or category.</p>}
          {bulk && <div className="flex gap-2 justify-end p-3"><button onClick={() => { setBulkP({}); setBulk(false); }} className="btn-ghost">Cancel</button><button onClick={() => { const n = Object.entries(bulkP).filter(([, v]) => parseFloat(v) > 0); setL((x) => x.map((p) => (bulkP[p.id] && parseFloat(bulkP[p.id]) > 0 ? { ...p, price: parseFloat(bulkP[p.id]) } : p))); setBulkP({}); setBulk(false); setToast(`${n.length} prices updated on the till and website`); }} className="btn-primary">Save {Object.values(bulkP).filter((v) => parseFloat(v) > 0).length} price changes</button></div>}
        </section>

        {ev && e && (
          <section className="card p-5 sm:p-6 flex flex-col gap-4 2xl:sticky 2xl:top-6">
            <div className="flex gap-3 items-center"><span className="w-14 h-14 rounded-2xl bg-canvas text-brand flex items-center justify-center"><Icon name="products" size={26} /></span><div className="flex-1"><h2 className="m-0 text-lg font-semibold">{e.name}</h2><span className="text-xs text-muted">SKU {e.sku} · barcode {e.barcode}</span></div><button onClick={() => setSel('')} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas"><Icon name="close" /></button></div>
            <Pills small opts={[['details', 'Details'], ['units', 'Units & variants'], ['pricing', 'Pricing'], ['tracking', 'Tracking']]} value={tab} onChange={setTab} />
            {tab === 'details' && (
              <>
                <L2 label="Name"><input value={ev.name} onChange={(x) => setEdit({ ...edit, name: x.target.value })} className="field py-2.5 font-normal" /></L2>
                {/* Shared description: a product with none yet shows the same generated text the online store shows. */}
                <DescEditor value={edit.desc ?? shownDesc(ev)} onChange={(v) => setEdit({ ...edit, desc: v })} input={{ name: ev.name, cat: ev.cat, price: ev.price, ctSize: ev.carton ? ev.ctSize || 12 : undefined, ctLabel: ev.ctLabel, byWeight: ev.byWeight }} />
                <div className="grid grid-cols-2 gap-3">
                  <L2 label="Category"><select value={ev.cat} onChange={(x) => setEdit({ ...edit, cat: x.target.value })} className="field py-2.5 font-normal">{catNames.map((c) => <option key={c}>{c}</option>)}</select></L2>
                  <L2 label="Tax class"><select className="field py-2.5 font-normal"><option>Standard (VAT + levies)</option><option>Zero-rated</option><option>Exempt</option></select></L2>
                  <L2 label="Custom field: country of origin"><input placeholder="Ghana" className="field py-2.5 font-normal" /></L2>
                  <L2 label="Reorder at"><input type="number" value={ev.reorder} onChange={(x) => setEdit({ ...edit, reorder: parseInt(x.target.value, 10) || 0 })} className="field py-2.5 font-normal" /></L2>
                </div>
                <L2 label={<span>Barcode</span>}><BcField value={ev.barcode} onChange={(v) => setEdit({ ...edit, barcode: v })} onScan={() => openScan('editMain')} check={bcEdit || { msg: `${ev.barcode} · the till finds this product when it is scanned.`, color: '#5f5c5a', block: false }} label="Barcode" /></L2>
                <button onClick={() => setLabels({ n: String(Math.min(100, Math.max(1, total(e) || 24))) })} className="btn-ghost w-fit"><Icon name="barcode" /> Print barcode labels</button>
                <span className="text-xs text-muted">Available at: {e.scope === 'all' ? 'Osu · East Legon · Adum' : BRS.find((b) => b.id === e.scope)?.name}</span>
              </>
            )}
            {tab === 'units' && (() => {
              // One stock pool counted in singles (kg for weighed goods). The carton holds this product's own number of
              // singles; extra units (e.g. half carton) and variants (sizes) each have their own barcode.
              const per = perCarton(ev); const kids = L.filter((x) => x.variantOf === e.id);
              const ufBc = uf.bc ? (codesOfEv(ev).includes(cleanCode(uf.bc)) ? { msg: 'This barcode is already on this product.', color: '#c62828', block: true } : barcodeCheck(uf.bc, L, e.id)) : null;
              const vfBc = vf.bc ? barcodeCheck(vf.bc, L) : null;
              return (
              <>
                <span className="text-[13px] font-semibold">Selling units (one stock pool, counted in {ev.byWeight ? 'kg' : 'singles'})</span>
                {[['Single', ev.byWeight ? '1 kg' : '1 unit', ghs(ev.price) + (ev.byWeight ? ' / kg' : ''), ev.barcode], ...(ev.carton ? [[ctName(ev), `${per} units`, ghs(ev.carton), cartonOf(ev)]] : []), ...(ev.units || []).map((u) => [u.label, `${u.size} units`, ghs(u.price), u.bc || ''])].map(([l, c, pr, b], k) => <div key={k} className="flex justify-between gap-2 text-sm p-3 rounded-xl bg-canvas flex-wrap items-center"><b>{l}</b><span className="text-muted">{c}</span><span className="text-xs text-muted font-mono">{b || 'no barcode'}</span><b>{pr}</b>{k > (ev.carton ? 1 : 0) && <button onClick={() => setEdit({ ...edit, units: (ev.units || []).filter((_, n) => n !== k - (ev.carton ? 2 : 1)) })} aria-label={`Remove ${l}`} className="text-xs text-danger font-semibold">Remove</button>}</div>)}
                {ev.carton ? (
                  <>
                    <div className="flex gap-2 flex-wrap items-end"><L2 label="Singles in one"><input inputMode="numeric" value={String(ev.ctSize ?? 12)} onChange={(x) => setEdit({ ...edit, ctSize: parseInt(x.target.value.replace(/\D/g, ''), 10) || undefined })} className="field py-2 w-24 font-normal" /></L2><div className="flex flex-col gap-1"><span className="text-[13px] font-semibold">Called</span><Pills small opts={[['Carton', 'Carton'], ['Crate', 'Crate'], ['Pack', 'Pack']]} value={ctName(ev)} onChange={(v) => setEdit({ ...edit, ctLabel: v as Product['ctLabel'] })} /></div><L2 label={`${ctName(ev)} price (GHS)`}><input type="number" step="0.01" value={ev.carton} onChange={(x) => setEdit({ ...edit, carton: parseFloat(x.target.value) || undefined })} className="field py-2 w-32 font-normal" /></L2></div>
                    <L2 label={<span>{ctName(ev)} barcode (ITF-14)</span>}><BcField value={ev.cartonBc ?? ''} onChange={(v) => setEdit({ ...edit, cartonBc: v })} onScan={() => openScan('editCarton')} check={ctEdit || { msg: ev.cartonBc ? `Scanning it sells or receives a whole ${cartonTxt(ev)}.` : `Empty: the till uses the standard code ${cartonOf(ev) || '(needs a 13-digit single barcode)'} · a whole ${cartonTxt(ev)}.`, color: '#5f5c5a', block: false }} label="Carton barcode" /></L2>
                  </>
                ) : !ev.byWeight && <button onClick={() => setEdit({ ...edit, carton: Math.round(ev.price * 12 * 0.92), ctSize: 12, ctLabel: 'Carton' })} className="btn-ghost w-fit min-h-9 text-xs">Sell by the carton too</button>}
                {/* Extra unit (productscan.md §2.3): e.g. half carton, its own size, price and barcode. */}
                {!ev.byWeight && <details className="rounded-2xl border border-line p-3"><summary className="text-sm font-semibold cursor-pointer">Add unit (e.g. half carton)</summary>
                  <div className="grid sm:grid-cols-3 gap-2 mt-3"><L2 label="Name"><input value={uf.label} onChange={(x) => setUf({ ...uf, label: x.target.value })} placeholder="Half carton" className="field py-2 font-normal" /></L2><L2 label="Singles in it"><input inputMode="numeric" value={uf.size} onChange={(x) => setUf({ ...uf, size: x.target.value.replace(/\D/g, '') })} placeholder={String(Math.max(2, Math.round(per / 2)))} className="field py-2 font-normal" /></L2><L2 label="Price (GHS)"><input inputMode="decimal" value={uf.price} onChange={(x) => setUf({ ...uf, price: x.target.value })} placeholder="0.00" className="field py-2 font-normal" /></L2></div>
                  <L2 label={<span>Its barcode (optional)</span>}><BcField value={uf.bc} onChange={(v) => setUf({ ...uf, bc: v })} onScan={() => openScan('unit')} check={ufBc || { msg: 'Scanning it sells or receives this unit.', color: '#5f5c5a', block: false }} label="Unit barcode" /></L2>
                  <button onClick={() => { const size = parseInt(uf.size, 10) || 0; const price = parseFloat(uf.price) || 0; if (uf.label.trim().length < 2 || size < 2 || !(price > 0)) return setToast('Give the unit a name, how many singles it holds (2 or more) and a price.'); if (ufBc?.block) return setToast(ufBc.msg); setEdit({ ...edit, units: [...(ev.units || []), { id: 'u' + Date.now().toString(36), label: uf.label.trim(), size, price, bc: cleanCode(uf.bc) || undefined }] }); setUf({ label: 'Half carton', size: '', price: '', bc: '' }); }} className="btn-dark min-h-9 text-xs w-fit mt-2">Add this unit</button>
                </details>}
                {/* Variants (sizes): each is its own product with its own SKU, price, stock and barcode. */}
                <span className="text-[13px] font-semibold">Variants</span>
                <table className="w-full text-sm"><thead><tr>{['Size', 'SKU', 'Price', 'Stock', 'Barcode'].map((h) => <th key={h} className="text-left text-xs text-muted p-1">{h}</th>)}</tr></thead><tbody><tr><td className="p-1">{ev.size || 'Standard'}</td><td className="p-1">{e.sku}</td><td className="p-1">{ghs(e.price)}</td><td className="p-1">{total(e)}</td><td className="p-1 font-mono text-xs">{e.barcode}</td></tr>{kids.map((k) => <tr key={k.id}><td className="p-1"><button onClick={() => { setSel(k.id); setEdit({}); }} className="underline">{k.size}</button>{k.status === 'pending' ? ' · waiting for approval' : ''}</td><td className="p-1">{k.sku}</td><td className="p-1">{ghs(k.price)}</td><td className="p-1">{total(k)}</td><td className="p-1 font-mono text-xs">{k.barcode}</td></tr>)}</tbody></table>
                {!ev.variantOf && <details className="rounded-2xl border border-line p-3"><summary className="text-sm font-semibold cursor-pointer">Add variant (another size)</summary>
                  <div className="grid sm:grid-cols-2 gap-2 mt-3"><L2 label="Size"><input value={vf.size} onChange={(x) => setVf({ ...vf, size: x.target.value })} placeholder="e.g. 10kg or 2L" className="field py-2 font-normal" /></L2><L2 label="Price (GHS)"><input inputMode="decimal" value={vf.price} onChange={(x) => setVf({ ...vf, price: x.target.value })} placeholder="0.00" className="field py-2 font-normal" /></L2></div>
                  <L2 label={<span>Its barcode</span>}><BcField value={vf.bc} onChange={(v) => setVf({ ...vf, bc: v })} onScan={() => openScan('variant')} check={vfBc || { msg: 'Empty: a shop barcode (200…) is made for it.', color: '#5f5c5a', block: false }} label="Variant barcode" /></L2>
                  <button onClick={() => void addVariant(e)} className="btn-dark min-h-9 text-xs w-fit mt-2">{SU ? 'Add variant' : 'Send variant for approval'}</button>
                </details>}
                {/* Sold by weight: price per kg, stock in kg; the scale label carries the PLU (lib/barcode.ts scaleRead). */}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!ev.byWeight} onChange={(x) => setEdit({ ...edit, byWeight: x.target.checked, ...(x.target.checked ? { carton: undefined } : {}) })} className="w-4 h-4 accent-[#0b5c5c]" />Sold by weight (price per kg, e.g. loose rice or gari)</label>
                {ev.byWeight && <L2 label="Scale item code (PLU, 5 digits)"><input inputMode="numeric" value={ev.plu || ''} onChange={(x) => setEdit({ ...edit, plu: x.target.value.replace(/\D/g, '').slice(0, 5) })} placeholder="e.g. 00101" className="field py-2 w-32 font-normal" /><span className="text-xs font-normal text-muted">Set the same code on the weighing scale. Its labels then scan at the till with the weight and price.</span>{ev.plu && L.some((x) => x.id !== e.id && x.byWeight && x.plu === ev.plu) && <span role="alert" className="text-xs text-danger font-normal">Item code {ev.plu} is already used by another product.</span>}</L2>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-4 h-4 accent-[#0b5c5c]" />Sell as part of a bundle (e.g. “Weekly essentials pack”)</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-4 h-4 accent-[#0b5c5c]" />Offer add-ons at the till (gift wrap, delivery bag)</label>
              </>
              ); })()}
            {tab === 'pricing' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <L2 label="Selling price (GHS)"><input type="number" step="0.01" value={ev.price} onChange={(x) => setEdit({ ...edit, price: parseFloat(x.target.value) || 0 })} className="field py-2.5 font-normal" /></L2>
                  {SU && <L2 label="Cost price (GHS) · Admin only"><input type="number" step="0.01" value={ev.cost} onChange={(x) => setEdit({ ...edit, cost: parseFloat(x.target.value) || 0 })} className="field py-2.5 font-normal" /></L2>}
                </div>
                {SU ? <div className="grid grid-cols-2 gap-2 text-sm"><div className="p-3 rounded-xl bg-canvas">Profit per single<br /><b>{ghs(ev.price - ev.cost)}</b></div><div className="p-3 rounded-xl bg-canvas">Margin<br /><b>{margin(ev.price, ev.cost)}</b></div><span className="text-xs text-muted col-span-2">Cost price and profit are visible to the Admin only.</span></div> : <span className="text-xs text-muted">Cost price and profit are visible to the Admin only.</span>}
                <span className="text-[13px] font-semibold">Price lists</span>
                {[['Retail', ev.price], ['Wholesale (10+)', ev.price * 0.93], ['Staff', ev.price * 0.9]].map(([g, p]) => <div key={g as string} className="flex justify-between text-sm"><span>{g as string}</span><b>{ghs(p as number)}</b></div>)}
                {/* Scheduled sale: saved on the product and shown on the Sell Now card and the online store as the
                    normal price crossed out next to the sale price (lib/pricing.ts). Empty dates = no limit. */}
                <span className="text-[13px] font-semibold">Scheduled sale</span>
                <div className="grid grid-cols-3 gap-2">
                  <L2 label="Sale price"><input type="number" step="0.01" min="0" inputMode="decimal" placeholder="GHS 0.00" value={ev.sale ?? ''} onChange={(x) => setEdit({ ...edit, sale: x.target.value === '' ? undefined : parseFloat(x.target.value) || 0 })} className="field py-2 font-normal" /></L2>
                  <L2 label="Starts"><input type="date" value={ev.saleFrom ?? ''} max={ev.saleTo || undefined} onChange={(x) => setEdit({ ...edit, saleFrom: x.target.value || undefined })} className="field py-2 font-normal" /></L2>
                  <L2 label="Ends"><input type="date" value={ev.saleTo ?? ''} min={ev.saleFrom || undefined} onChange={(x) => setEdit({ ...edit, saleTo: x.target.value || undefined })} className="field py-2 font-normal" /></L2>
                </div>
                {saleErr ? <span role="alert" className="text-xs text-danger">{saleErr}</span>
                  : ev.sale ? <span className="text-xs text-muted">Till and website show <s>{ghs(ev.price)}</s> <b className="text-black">{ghs(ev.sale)}</b> ({Math.round((1 - ev.sale / ev.price) * 100)}% off){ev.saleFrom || ev.saleTo ? ` · ${ev.saleFrom ? 'from ' + ev.saleFrom : ''}${ev.saleTo ? ' until ' + ev.saleTo : ''}` : ' · until you remove it'}.</span>
                  : <span className="text-xs text-muted">Set a lower price to put this product on sale on the till and the website.</span>}
                {(ev.sale !== undefined || ev.saleFrom || ev.saleTo) && <button onClick={() => setEdit({ ...edit, sale: undefined, saleFrom: undefined, saleTo: undefined })} className="btn-ghost w-fit min-h-9 text-xs">Remove sale</button>}
              </>
            )}
            {tab === 'tracking' && (
              <>
                <Pills small opts={[['batch', 'Batch & expiry'], ['serial', 'Serial numbers'], ['digital', 'Digital / service'], ['none', 'Quantity only']]} value={ev.track} onChange={(v) => setEdit({ ...edit, track: v })} />
                {ev.track === 'batch' && <><div className="text-sm p-3 rounded-xl bg-canvas">Lot L2409 · Osu<br /><span className="text-xs text-muted">Expires 14 Jan 2027 · 40 units</span></div><div className="text-sm p-3 rounded-xl bg-red-50">Lot L2406 · Adum<br /><span className="text-xs text-danger">Expires 9 Nov 2026 · alert on</span></div><span className="text-xs text-muted">Expired lots are blocked at the till automatically.</span></>}
                {ev.track === 'serial' && <span className="text-sm">Each unit needs a serial number scanned when received and when sold (phones, electronics, appliances).</span>}
                {ev.track === 'digital' && <span className="text-sm">No stock is held. Sold as a service, booking or download; gift cards issue a code by SMS or email.</span>}
                {ev.track === 'none' && <span className="text-sm">Stock is counted by quantity only.</span>}
                <span className="text-xs text-muted">Stock now: {BRS.map((b) => `${b.name} ${e.stock[b.id]}`).join(' · ')} · warehouse {e.wh}</span>
              </>
            )}
            {(bcEdit?.block || ctEdit?.block) && <span role="alert" className="text-xs text-danger">{(bcEdit?.block ? bcEdit : ctEdit)!.msg}</span>}
            <button onClick={async () => { const fix = { ...edit, ...(edit.barcode !== undefined ? { barcode: cleanCode(edit.barcode) || e.barcode } : {}), ...(edit.cartonBc !== undefined ? { cartonBc: cleanCode(edit.cartonBc) || undefined } : {}) }; const after = { ...e, ...fix } as Product; const fresh = codesOfEv(after).filter((c) => !codesOfEv(e).includes(c)); const clash = fresh.length ? await claimCodes(e.id, after.name, fresh) : ''; if (clash) return setToast(clash); up(e.id, fix); setEdit({}); setToast(`${ev.name} saved · the till and website update straight away`); }} disabled={!Object.keys(edit).length || !!saleErr || !!bcEdit?.block || !!ctEdit?.block} className="btn-primary">{Object.keys(edit).length ? 'Save changes' : 'Saved'}</button>
          </section>
        )}
      </div>

      {/* Scan product barcode (productscan.md §2.2): camera or handheld scanner; a read fills the field and closes. */}
      {scan && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center p-4 pt-16" style={{ background: 'rgba(0,0,0,.45)' }} onClick={() => setScan('')}>
          <section role="dialog" aria-modal="true" aria-labelledby="sc-h" onClick={(x) => x.stopPropagation()} className="w-full max-w-[460px] bg-white rounded-[28px] p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center gap-2"><h2 id="sc-h" className="m-0 text-lg font-semibold">Scan product barcode</h2><button onClick={() => setScan('')} className="h-9 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#c62828' }}>Close</button></div>
            <div className="flex items-center gap-2"><span className="text-[13px] font-semibold">Scan with</span><Pills small opts={[['cam', 'Camera'], ['usb', 'Handheld scanner']]} value={scan} onChange={setScan} /></div>
            {scan === 'cam' ? (
              <>
                <BarcodeCamera key={scanFor} onRead={acceptScan} height={220} />
                <span className="text-xs text-muted">Uses the camera on a phone, tablet or laptop.</span>
              </>
            ) : (
              <>
                <span className="text-sm">USB or Bluetooth handheld scanners work like a keyboard. Click in the box below, then scan the barcode on the pack. The scanner types the number and presses Enter for you.</span>
                <label className="flex flex-col gap-1 text-xs font-semibold">Waiting for scanner…<input autoFocus value={scanIn} onChange={(x) => setScanIn(x.target.value)} onKeyDown={(x) => { if (x.key === 'Enter' || x.keyCode === 13) { x.preventDefault(); acceptScan(scanIn); } }} placeholder="Scan now" autoComplete="off" className="h-14 px-4 rounded-2xl border-2 border-black font-normal text-[18px] tracking-[0.08em] outline-none" /></label>
              </>
            )}
            <span className="text-xs text-muted">Works with EAN-13, EAN-8, UPC-A and carton (ITF-14) barcodes.</span>
          </section>
        </div>
      )}
      {/* Print barcode labels (productscan.md §2.5): quantity, preview, then print to the branch label printer. */}
      {labels && e && (() => { const n = Math.max(1, Math.min(200, parseInt(labels.n, 10) || 1)); const brId = session?.branch && session.branch !== 'all' ? session.branch : 'osu'; const br = BRANCHES.find((b) => b.id === brId)?.short || 'Osu'; const lp = labelPrinterFor(brId); const item = { name: e.name, price: ghs(e.price) + (e.byWeight ? '/kg' : ''), code: e.barcode }; const cmds = labelCommands(lp?.lang || 'TSPL', item, n, lp?.size); const sent = (how: string) => { setLabels(null); setToast(`Sent ${n} labels to ${br} label printer${how}`); }; return (<>
        <div className="fixed inset-0 z-[500] bg-black/60 overflow-y-auto p-4" onClick={() => setLabels(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="lb-h" onClick={(x) => x.stopPropagation()} className="no-print max-w-[720px] mx-auto bg-white rounded-[28px] p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center gap-2"><h2 id="lb-h" className="m-0 text-lg font-semibold">Print barcode labels · {e.name}</h2><button onClick={() => setLabels(null)} className="h-9 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#c62828' }}>Close</button></div>
            <div className="flex gap-3 items-end flex-wrap">
              <label className="flex flex-col gap-1 text-[13px] font-semibold">How many labels<input type="number" min={1} max={200} value={labels.n} onChange={(x) => setLabels({ n: x.target.value })} className="field py-2 w-28 font-normal" /></label>
              <span className="text-sm text-muted pb-2">Barcode {e.barcode} · {item.price}</span>
            </div>
            {/* The branch's label printer from IT management → Hardware (productscan.md §2.5). */}
            <span className="text-sm">{lp ? <>Printer: <b>{lp.id} · {lp.model} · labels · {lp.conn} · {br}</b> · {lp.lang} commands · {lp.size}</> : <>No label printer is set up for {br}. Add one in IT management → Hardware, or print from the browser.</>}</span>
            <span className="text-xs text-muted">For products with no barcode, after a price change, and for shelf-edge labels.</span>
            <div className="max-h-[42vh] overflow-auto rounded-2xl border border-line"><LabelSheet item={item} count={n} /></div>
            {labels.err && <span role="alert" className="text-sm text-danger">{labels.err}</span>}
            <div className="flex gap-2 justify-end flex-wrap">
              <button onClick={() => setLabels(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => { downloadPrn(cmds, `labels-${e.sku}-${n}`); sent(' · printer file downloaded'); }} className="btn-ghost">Download printer file</button>
              <button onClick={() => { const done = () => { window.removeEventListener('afterprint', done); sent(''); }; window.addEventListener('afterprint', done); window.print(); }} className="btn-ghost">Print from the browser</button>
              {lp?.conn === 'USB' && <button disabled={!usbSupported()} title={usbSupported() ? 'Sends the label commands straight to the USB printer' : 'Needs Chrome or Edge over HTTPS'} onClick={() => { sendUsb(cmds).then(() => sent('')).catch((x: Error) => setLabels({ n: labels.n, err: x.message })); }} className="btn-primary disabled:opacity-40">Send {n} label{n === 1 ? '' : 's'} to the printer</button>}
            </div>
          </section>
        </div>
        {/* The copy that prints from the browser: outside the dialog and its overlay, shown only when printing. */}
        <LabelSheet item={item} count={n} print />
      </>); })()}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}

// A string label wraps the control in <label>; a label holding its own button uses a plain group so clicks don't hit the button.
function L2({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  if (typeof label !== 'string') return <div role="group" className="flex flex-col gap-1 text-[13px] font-semibold">{label}{children}</div>;
  return <label className="flex flex-col gap-1 text-[13px] font-semibold">{label}{children}</label>;
}

/**
 * A barcode input with a Scan button and the live check under it (productscan.md §2.1). The border is black when it has
 * a value and light grey when empty. Letters are allowed (shop's own custom codes); spaces are removed.
 */
function BcField({ value, onChange, onScan, check, label }: { value: string; onChange: (v: string) => void; onScan: () => void; check: { msg: string; color: string }; label: string }) {
  return (
    <>
      <div className="flex gap-2">
        <input aria-label={label} value={value} onChange={(x) => onChange(x.target.value.replace(/\s/g, ''))} placeholder="Scan with a scanner or type the number" autoComplete="off" inputMode="numeric" className="flex-1 min-w-0 h-11 px-4 rounded-full border font-normal text-sm tracking-wide outline-none" style={{ borderColor: value ? '#000000' : '#ebebeb' }} />
        <button type="button" onClick={onScan} className="btn-dark min-h-10 whitespace-nowrap"><Icon name="barcode" /> Scan barcode</button>
      </div>
      <span className="text-xs font-normal" style={{ color: check.color }} aria-live="polite">{check.msg}</span>
    </>
  );
}
