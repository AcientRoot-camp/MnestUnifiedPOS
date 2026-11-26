// Which way this device scans barcodes. Tablets and phones use their own camera; laptops and desktops use a barcode
// scanner plugged in by USB or paired by Bluetooth (it types the code and presses Enter, like a keyboard). Detected
// from the device (a touch screen with a coarse pointer, or a phone / tablet browser), and staff can change it for
// this device; the choice is kept on the device (ecompos.scanPref). Used by Sell Now and by stocking screens.
import { readKey, usePersist } from './persist';

export type ScanWay = 'camera' | 'scanner';
export type ScanPref = 'auto' | ScanWay;
export const SCAN_PREF_KEY = 'ecompos.scanPref';

/** True on phones and tablets (touch screen as the main pointer, or a mobile / tablet browser, iPad included). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(pointer: fine)').matches;
  return mobileUa || coarse;
}
/** How this device scans: the staff member's choice, else camera on phones / tablets and scanner on computers. */
export const scanWayOf = (pref: ScanPref = readKey<ScanPref>(SCAN_PREF_KEY, 'auto')): ScanWay => (pref === 'auto' ? (isTouchDevice() ? 'camera' : 'scanner') : pref);
/** React hook: [the way this device scans, the saved preference, change it]. */
export function useScanWay(): [ScanWay, ScanPref, (p: ScanPref) => void] {
  const [pref, setPref] = usePersist<ScanPref>(SCAN_PREF_KEY, 'auto');
  return [scanWayOf(pref), pref, setPref];
}
