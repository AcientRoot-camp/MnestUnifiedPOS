// IT management → Hardware panels (productscan.md §5.2): the device list per branch (barcode scanners S-OSU-1 …,
// label printers, weighing scales), label printer "Test label" sent straight to the printer, the Bluetooth check, and
// the weighing-scale label set-up with a scan test.
import { useState } from 'react';
import { BRS, PRODUCTS0, brName, type Product } from '../../../data/catalogue';
import { DEVICES0, DEVICES_KEY, DEVICE_TYPES, ID_PRE, type Conn, type Device, type DeviceType } from '../../../data/devices';
import { SCALE_KEY, scaleCode, scaleCfg, scaleRead, type ScaleCfg } from '../../../lib/barcode';
import { downloadPrn, labelCommands, sendUsb, usbSupported } from '../../../lib/labelPrint';
import { usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { B, inp } from './ui';

/** The saved device list (demo list until changed). */
export const useDevices = () => usePersist<Device[]>(DEVICES_KEY, DEVICES0);

/**
 * Devices of one type: ID, model, connection, branch, connected switch and Remove, plus a small Add form.
 * Inputs: the device type, the connections offered for it, and act (writes the IT activity log).
 */
export function DeviceList({ type, conns, act }: { type: DeviceType; conns: Conn[]; act: (t: string) => void }) {
  const [L, setL] = useDevices();
  const mine = L.filter((d) => d.type === type);
  const [f, setF] = useState({ model: '', conn: conns[0], branch: BRS[0].id as string, err: '' });
  const add = () => {
    if (f.model.trim().length < 2) return setF({ ...f, err: 'Type the make and model, e.g. Honeywell 1250g.' });
    const short = f.branch === 'legon' ? 'LEG' : f.branch === 'adum' ? 'ADM' : f.branch.toUpperCase().slice(0, 3);
    const pre = `${ID_PRE[type]}-${short}-`; let k = 1; while (L.some((d) => d.id === pre + k)) k++;
    const d: Device = { id: pre + k, model: f.model.trim(), type, conn: f.conn, branch: f.branch, on: true, ...(type === 'Label printer' ? { lang: /zebra/i.test(f.model) ? 'ZPL' : 'TSPL', size: '50 × 30 mm' } : {}) };
    setL([...L, d]); setF({ ...f, model: '', err: '' }); act(`Added ${type.toLowerCase()} ${d.id} · ${d.model} · ${brName(d.branch)}`);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['ID', 'Device', 'Connection', 'Branch', ''].map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{mine.map((d) => <tr key={d.id} className="border-t border-line"><td className="py-2 pr-3 font-mono text-xs">{d.id}</td><td className="py-2 pr-3">{d.model}</td><td className="py-2 pr-3">{d.conn}</td><td className="py-2 pr-3">{brName(d.branch)}</td><td className="py-2 whitespace-nowrap flex gap-1.5 items-center">
          <button role="switch" aria-checked={d.on} aria-label={`${d.id} connected`} onClick={() => { setL(L.map((x) => (x.id === d.id ? { ...x, on: !x.on } : x))); act(`${d.id} ${d.on ? 'disconnected' : 'connected'}`); }} className={cx('text-xs font-semibold px-2.5 py-1 rounded-full', d.on ? 'bg-green-100 text-green-800' : 'bg-[#eee] text-[#666]')}>{d.on ? 'Connected' : 'Off'}</button>
          <button onClick={() => { setL(L.filter((x) => x.id !== d.id)); act(`Removed ${d.id}`); }} className="text-xs text-danger font-semibold">Remove</button></td></tr>)}
          {!mine.length && <tr><td colSpan={5} className="py-2 text-muted">None set up yet.</td></tr>}</tbody></table></div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Add a {type.toLowerCase()}<input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value, err: '' })} placeholder="Make and model" className={inp} /></label>
        <select aria-label="Connection" value={f.conn} onChange={(e) => setF({ ...f, conn: e.target.value as Conn })} className={cx(inp, 'w-36')}>{conns.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Branch" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} className={cx(inp, 'w-40')}>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <button onClick={add} className={B.dark}>Add</button>
      </div>
      {f.err && <span role="alert" className="text-xs text-danger">{f.err}</span>}
    </div>
  );
}

/** "Bluetooth printers and scanners supported." or the warning, from whether this browser has Web Bluetooth. */
export function BluetoothCheck() {
  const ok = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  return ok ? <span className="text-sm text-ok">✓ Bluetooth printers and scanners supported.</span>
    : <span className="text-sm text-[#b26a00]">⚠ Web Bluetooth not available in this browser. Use Chrome on Android/Windows, or connect printers by USB or network.</span>;
}

/**
 * Label printers: the device list, each printer's command language and label size, and "Test label" (sent straight to a
 * USB printer through WebUSB, or downloaded as a printer file). Input: act (activity log).
 */
export function LabelPrinters({ act }: { act: (t: string) => void }) {
  const [L, setL] = useDevices();
  const [res, setRes] = useState<{ ok: boolean; t: string } | null>(null);
  const printers = L.filter((d) => d.type === 'Label printer');
  const test = async (d: Device) => {
    const cmds = labelCommands(d.lang || 'TSPL', { name: 'Test label', price: 'GHS 0.00', code: '2000000000015' }, 1, d.size);
    if (d.conn === 'USB' && usbSupported()) {
      try { const name = await sendUsb(cmds); setRes({ ok: true, t: `✓ Test label sent to ${d.id} (${name}) · ${d.size}` }); act(`Test label · ${d.id}`); }
      catch (e) { setRes({ ok: false, t: (e as Error).message }); }
    } else { downloadPrn(cmds, `test-label-${d.id}`); setRes({ ok: true, t: `Test label file downloaded for ${d.id} (${d.lang}). ${d.conn === 'USB' ? 'This browser cannot reach USB printers: use Chrome or Edge over HTTPS.' : 'Send it with the printer’s own utility.'}` }); }
  };
  return (
    <div className="flex flex-col gap-3">
      <DeviceList type="Label printer" conns={['USB', 'Bluetooth', 'Network']} act={act} />
      {printers.map((d) => <div key={d.id} className="flex gap-2 items-center flex-wrap p-2.5 rounded-xl bg-white text-sm"><b className="flex-1 min-w-[160px]">{d.id} · {d.model} · labels · {d.conn} · {brName(d.branch)}</b>
        <select aria-label={`${d.id} command language`} value={d.lang || 'TSPL'} onChange={(e) => setL(L.map((x) => (x.id === d.id ? { ...x, lang: e.target.value as Device['lang'] } : x)))} className={cx(inp, 'w-32')}><option value="TSPL">TSPL (Xprinter, TSC)</option><option value="ZPL">ZPL (Zebra)</option></select>
        <select aria-label={`${d.id} label size`} value={d.size || '50 × 30 mm'} onChange={(e) => setL(L.map((x) => (x.id === d.id ? { ...x, size: e.target.value } : x)))} className={cx(inp, 'w-36')}>{['40 × 30 mm', '50 × 25 mm', '50 × 30 mm', '58 × 40 mm'].map((z) => <option key={z}>{z}</option>)}</select>
        <button onClick={() => void test(d)} className={B.dark}>Test label</button></div>)}
      {res && <span role="status" className={cx('text-sm', res.ok ? 'text-ok' : 'text-danger')}>{res.t}</span>}
      <BluetoothCheck />
    </div>
  );
}

/**
 * Weighing scale (HW-08 "For loose rice and gari sold by weight"): the scales, the label prefixes the till decodes
 * (weight 21 / price 22 by default) and a test box that reads a scale label. Input: act (activity log).
 */
export function ScaleSetup({ act }: { act: (t: string) => void }) {
  const [cfg, setCfg] = usePersist<Partial<ScaleCfg>>(SCALE_KEY, {});
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [t, setT] = useState('');
  const c = { ...scaleCfg(), ...cfg };
  const bad = (v: string) => !/^2[1-9]$/.test(v);
  const weighed = P.filter((p) => p.byWeight && p.plu);
  const r = t ? scaleRead(t, P, c) : null;
  const sample = weighed[0] ? scaleCode(weighed[0].plu!, 1.25, false, c) : '';
  return (
    <div className="flex flex-col gap-3">
      <DeviceList type="Weighing scale" conns={['Network', 'USB', 'Bluetooth']} act={act} />
      <span className="text-sm">The scale prints a barcode on each bag. The till reads the item code and the weight (or price) from it: <b>{c.w}</b> + item code + weight in grams, or <b>{c.p}</b> + item code + price in pesewas, then a check digit (EAN-13). Shop barcodes start 200, so scale prefixes are 21–29.</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Weight labels start with<input value={c.w} maxLength={2} onChange={(e) => setCfg({ ...cfg, w: e.target.value.replace(/\D/g, '') })} className={inp} />{bad(c.w) && <span className="text-xs text-danger font-normal">Use 21 to 29.</span>}</label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">Price labels start with<input value={c.p} maxLength={2} onChange={(e) => setCfg({ ...cfg, p: e.target.value.replace(/\D/g, '') })} className={inp} />{(bad(c.p) || c.p === c.w) && <span className="text-xs text-danger font-normal">Use 21 to 29, different from the weight prefix.</span>}</label>
      </div>
      <span className="text-xs text-muted">Products sold by weight: {weighed.length ? weighed.map((p) => `${p.name} (item code ${p.plu})`).join(' · ') : 'none yet · tick “Sold by weight” in Products → Units & variants'}{sample ? ` · sample label for 1.250 kg: ${sample}` : ''}</span>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">Scale label test<input value={t} onChange={(e) => setT(e.target.value.trim())} onBlur={() => t && act(`Scale label test · ${t}`)} placeholder="Scan a scale label here" autoComplete="off" className="h-12 px-4 rounded-2xl border border-black text-[16px] tracking-[0.08em] font-normal outline-none" /></label>
      {t && <span className="text-sm" style={{ color: r ? '#1f7a2a' : '#b26a00' }}>{r ? `✓ ${r.p.name} · ${r.kg.toFixed(3)} kg · GHS ${r.price.toFixed(2)}` : '⚠ Not a scale label for a product sold by weight. Check the prefix and the item code on the scale.'}</span>}
    </div>
  );
}

/** Device type names, for reference on the Devices panel. */
export const deviceTypesTxt = DEVICE_TYPES.join(' · ');
