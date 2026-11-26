// "Scanning with: Camera · Barcode scanner" — a small switch for how this device scans (lib/scanDevice.ts). Phones and
// tablets start on Camera, laptops and desktops on Barcode scanner (USB or Bluetooth); the choice is kept per device.
import { cx } from '../lib/format';
import { isTouchDevice, useScanWay, type ScanWay } from '../lib/scanDevice';

/** Input: onChange (optional) to react when the staff member switches. */
export default function ScanWaySwitch({ onChange, className = '' }: { onChange?: (w: ScanWay) => void; className?: string }) {
  const [way, , setPref] = useScanWay();
  const auto = isTouchDevice() ? 'camera' : 'scanner';
  const pick = (w: ScanWay) => { setPref(w === auto ? 'auto' : w); onChange?.(w); };
  return (
    <div role="group" aria-label="Scanning with" className={cx('flex items-center gap-1.5 text-xs', className)}>
      <span className="text-[#5f5c5a] font-semibold">Scanning with</span>
      {([['camera', '📷 Camera'], ['scanner', '⌨︎ Barcode scanner']] as [ScanWay, string][]).map(([k, l]) => (
        <button key={k} type="button" onClick={() => pick(k)} aria-pressed={way === k} className={cx('h-7 px-2.5 rounded-full font-semibold border', way === k ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9] text-[#3d3a38]')}>{l}</button>
      ))}
    </div>
  );
}
