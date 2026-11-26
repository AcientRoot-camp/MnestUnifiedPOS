// Hardware devices per branch (productscan.md §5.2–5.4): barcode scanners, label printers, weighing scales and the
// rest, as listed in IT management → Hardware and Branches → Tills & devices. Kept on the device (ecompos.devices);
// a hosted system keeps them on the server.
import { readKey } from '../lib/persist';

/** Device type names, as the system shows them. */
export const DEVICE_TYPES = ['Till', 'Receipt printer', 'Barcode scanner', 'Cash drawer', 'Label printer', 'Weighing scale', 'Phone / tablet'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
export type Conn = 'USB' | 'Bluetooth' | 'Camera' | 'Network';
/**
 * One device. lang / size: a label printer's command language and label size. on: connected and in use.
 * id: short code like S-OSU-1 (scanner), L-OSU-1 (label printer), W-OSU-1 (weighing scale).
 */
export type Device = { id: string; model: string; type: DeviceType; conn: Conn; branch: string; on: boolean; lang?: 'TSPL' | 'ZPL'; size?: string };
export const DEVICES_KEY = 'ecompos.devices';
export const DEVICES0: Device[] = [
  { id: 'S-OSU-1', model: 'Honeywell 1250g', type: 'Barcode scanner', conn: 'USB', branch: 'osu', on: true },
  { id: 'S-OSU-2', model: 'Honeywell 1250g', type: 'Barcode scanner', conn: 'USB', branch: 'osu', on: true },
  { id: 'S-LEG-1', model: 'Zebra CS4070', type: 'Barcode scanner', conn: 'Bluetooth', branch: 'legon', on: true },
  { id: 'S-ADM-1', model: 'Phone camera', type: 'Barcode scanner', conn: 'Camera', branch: 'adum', on: true },
  { id: 'L-OSU-1', model: 'Xprinter XP-365B', type: 'Label printer', conn: 'USB', branch: 'osu', on: true, lang: 'TSPL', size: '50 × 30 mm' },
  { id: 'W-OSU-1', model: 'CAS CL5200 label scale', type: 'Weighing scale', conn: 'Network', branch: 'osu', on: true },
];
/** Short id prefix per type, used when adding a device (S-OSU-3, L-ADM-1 …). */
export const ID_PRE: Record<DeviceType, string> = { 'Till': 'T', 'Receipt printer': 'P', 'Barcode scanner': 'S', 'Cash drawer': 'D', 'Label printer': 'L', 'Weighing scale': 'W', 'Phone / tablet': 'M' };
/** The devices saved on this device (the demo list until something is changed). */
export const devices = () => readKey<Device[]>(DEVICES_KEY, DEVICES0);
/** A branch's label printer (the first connected one), else undefined. */
export const labelPrinterFor = (br: string, L = devices()) => L.find((d) => d.type === 'Label printer' && d.branch === br && d.on);
