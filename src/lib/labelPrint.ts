// Barcode labels straight to a label printer (productscan.md §2.5): builds the printer's own commands (TSPL for
// Xprinter / TSC, ZPL for Zebra) and sends them over WebUSB (Chrome / Edge on Windows, Mac, Android, ChromeOS). Where
// WebUSB is not available the same commands download as a .prn file, and the browser's print window remains as a
// fallback. Printers are 203 dpi (8 dots per mm).

/** One label: product name, price text and the barcode number. */
export type LabelData = { name: string; price: string; code: string };
export type PrinterLang = 'TSPL' | 'ZPL';
const DOTS = 8; // 203 dpi

/** "50 × 30 mm" → [50, 30]. */
export const sizeMm = (s = '50 × 30 mm'): [number, number] => { const m = s.match(/(\d+)\D+(\d+)/); return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [50, 30]; };
/** Text safe inside the printer's quoted strings (no quotes or line breaks, ASCII only). */
const safe = (t: string, n = 28) => t.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\^~]/g, '').slice(0, n);
/** Barcode symbology for a number: EAN-13 (12 digits sent; the printer adds the check digit), EAN-8, else Code 128. */
function sym(code: string): { kind: 'EAN13' | 'EAN8' | '128'; data: string } {
  const v = code.replace(/\s/g, '');
  if (/^\d{13}$/.test(v)) return { kind: 'EAN13', data: v.slice(0, 12) };
  if (/^\d{12}$/.test(v)) return { kind: 'EAN13', data: ('0' + v).slice(0, 12) }; // UPC-A prints as EAN-13
  if (/^\d{8}$/.test(v)) return { kind: 'EAN8', data: v.slice(0, 7) };
  return { kind: '128', data: v };
}

/**
 * Printer commands for `count` copies of one label. Layout: name top left, price top right, bars across the middle with
 * the number under them. Inputs: the language, the label, how many and the label size ("50 × 30 mm").
 */
export function labelCommands(lang: PrinterLang, item: LabelData, count: number, size = '50 × 30 mm'): string {
  const [w, h] = sizeMm(size); const W = w * DOTS; const H = h * DOTS; const b = sym(item.code);
  const barH = Math.round(H * 0.45); const n = Math.max(1, Math.min(999, Math.round(count)));
  if (lang === 'ZPL') {
    const bc = b.kind === 'EAN13' ? `^BEN,${barH},Y,N` : b.kind === 'EAN8' ? `^B8N,${barH},Y,N` : `^BCN,${barH},Y,N,N`;
    return ['^XA', '^CI28', `^PW${W}`, `^LL${H}`, '^LH0,0',
      `^FO16,12^A0N,24,22^FB${W - 150},1,0,L^FD${safe(item.name)}^FS`, `^FO${W - 130},12^A0N,26,24^FB114,1,0,R^FD${safe(item.price, 14)}^FS`,
      `^FO${Math.round(W * 0.12)},48^BY2${bc}^FD${b.data}^FS`, `^PQ${n},0,1,Y`, '^XZ', ''].join('\n');
  }
  // TSPL (Xprinter XP-365B, TSC): BARCODE x,y,"type",height,human-readable,rotation,narrow,wide,"data"
  return [`SIZE ${w} mm,${h} mm`, 'GAP 2 mm,0 mm', 'DIRECTION 1', 'REFERENCE 0,0', 'CLS',
    `TEXT 16,12,"2",0,1,1,"${safe(item.name)}"`, `TEXT ${W - 140},12,"2",0,1,1,"${safe(item.price, 14)}"`,
    `BARCODE ${Math.round(W * 0.12)},48,"${b.kind}",${barH},1,0,2,2,"${b.data}"`, `PRINT ${n},1`, ''].join('\r\n');
}

/* ---------- WebUSB ---------- */

type UsbEndpoint = { direction: 'in' | 'out'; type: string; endpointNumber: number };
type UsbAlt = { interfaceClass: number; endpoints: UsbEndpoint[] };
type UsbIface = { interfaceNumber: number; alternates: UsbAlt[] };
type UsbDevice = { productName?: string; opened: boolean; configuration: { interfaces: UsbIface[] } | null; open(): Promise<void>; selectConfiguration(n: number): Promise<void>; claimInterface(n: number): Promise<void>; transferOut(ep: number, data: BufferSource): Promise<unknown>; close(): Promise<void> };
type Usb = { getDevices(): Promise<UsbDevice[]>; requestDevice(o: { filters: object[] }): Promise<UsbDevice> };
const usb = () => (navigator as unknown as { usb?: Usb }).usb;
/** True when this browser can talk to a USB label printer directly. */
export const usbSupported = () => !!usb() && window.isSecureContext;

/** The printer's bulk OUT endpoint (printer class 7 first, then any interface with one). */
function outEndpoint(d: UsbDevice): { iface: number; ep: number } | null {
  const ifs = d.configuration?.interfaces || [];
  const pick = (want7: boolean) => { for (const i of ifs) for (const a of i.alternates) { if (want7 && a.interfaceClass !== 7) continue; const e = a.endpoints.find((x) => x.direction === 'out' && x.type === 'bulk'); if (e) return { iface: i.interfaceNumber, ep: e.endpointNumber }; } return null; };
  return pick(true) || pick(false);
}

/**
 * Send printer commands over USB. The first time, the browser asks which USB device is the printer (a click is
 * needed for that); afterwards the paired printer is used straight away. Output: the printer's name.
 * Throws a short message when it fails, for the caller to show.
 */
export async function sendUsb(cmds: string): Promise<string> {
  const U = usb();
  if (!U || !window.isSecureContext) throw new Error('501 Not Implemented · This browser cannot reach USB printers. Use Chrome or Edge over HTTPS, or download the printer file.');
  let d = (await U.getDevices())[0];
  if (!d) d = await U.requestDevice({ filters: [] }).catch(() => { throw new Error('No printer was chosen.'); });
  if (!d.opened) await d.open();
  if (!d.configuration) await d.selectConfiguration(1);
  const o = outEndpoint(d);
  if (!o) throw new Error('503 Service Unavailable · That USB device does not accept print jobs. Choose the label printer.');
  await d.claimInterface(o.iface).catch(() => undefined); // already claimed by this page is fine
  await d.transferOut(o.ep, new TextEncoder().encode(cmds));
  return d.productName || 'USB label printer';
}

/** Save the commands as a .prn file (copy it to the printer, or send it with the printer's own utility). */
export function downloadPrn(cmds: string, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([cmds], { type: 'application/octet-stream' }));
  a.download = name.replace(/[^\w.-]+/g, '-') + '.prn';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
