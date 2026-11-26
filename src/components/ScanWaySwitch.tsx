// "Scanning with: Camera · Barcode scanner" — a small switch for how this device scans (lib/scanDevice.ts). Phones and
// tablets start on Camera, laptops and desktops on Barcode scanner (USB or Bluetooth); the choice is kept per device.
// Staff can switch either way at any time:
//   • Camera asks for the device's camera straight away (the browser shows its "Allow camera?" prompt) and says what
//     happened beside the switch. Only once the camera is allowed does onChange('camera') fire, so the screen can open
//     its camera scanner knowing it will work.
//   • Barcode scanner (USB or Bluetooth; it types the code and presses Enter) fires onChange('scanner') at once: the
//     screen closes its camera and puts the cursor in its scan box, and the switch confirms the scanner is ready.
import { useEffect, useState } from 'react';
import { cx } from '../lib/format';
import { isTouchDevice, useScanWay, type ScanWay } from '../lib/scanDevice';
import { CAM_ERR } from './BarcodeCamera';
import type { CamErr } from '../lib/camera';

/**
 * Ask for the camera now (must run inside the tap). Output: '' when it may be used, otherwise the reason it cannot.
 * The test stream is stopped at once, so the screen's own scanner can open the camera next.
 */
async function askCamera(): Promise<'' | CamErr> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    st.getTracks().forEach((t) => t.stop());
    return '';
  } catch (e) {
    const n = (e as DOMException)?.name;
    return n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'nocam' : 'failed';
  }
}

/** Input: onChange (optional), told the new way once it is ready (for Camera: after the camera was allowed). */
export default function ScanWaySwitch({ onChange, className = '' }: { onChange?: (w: ScanWay) => void; className?: string }) {
  const [way, , setPref] = useScanWay();
  const auto = isTouchDevice() ? 'camera' : 'scanner';
  const [cam, setCam] = useState<null | { state: 'asking' | 'ok' | 'err'; text: string }>(null);
  // "Camera allowed" is a short confirmation; problems stay until the next tap.
  useEffect(() => { if (cam?.state !== 'ok') return; const t = window.setTimeout(() => setCam(null), 3000); return () => window.clearTimeout(t); }, [cam]);
  const pick = async (w: ScanWay) => {
    setPref(w === auto ? 'auto' : w);
    if (w !== 'camera') { setCam({ state: 'ok', text: '✓ Barcode scanner ready · scan an item now (USB or Bluetooth scanner). The camera is off.' }); onChange?.(w); return; }
    setCam({ state: 'asking', text: 'Allow the camera when your browser asks. It is used to scan the barcodes on items.' });
    const why = await askCamera();
    if (why) return setCam({ state: 'err', text: CAM_ERR[why] });
    setCam({ state: 'ok', text: '✓ Camera allowed · point it at an item’s barcode' });
    onChange?.('camera');
  };
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div role="group" aria-label="Scanning with" className="flex items-center gap-1.5 text-xs flex-wrap">
        <span className="text-[#5f5c5a] font-semibold">Scanning with</span>
        {([['camera', '📷 Camera'], ['scanner', '⌨︎ Barcode scanner']] as [ScanWay, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => { void pick(k); }} aria-pressed={way === k} disabled={cam?.state === 'asking'} className={cx('h-7 px-2.5 rounded-full font-semibold border disabled:opacity-60', way === k ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9] text-[#3d3a38]')}>{l}</button>
        ))}
      </div>
      {cam && <span role={cam.state === 'err' ? 'alert' : 'status'} className={cx('text-xs', cam.state === 'err' ? 'text-[#c62828]' : cam.state === 'ok' ? 'text-[#1f7a2a] font-semibold' : 'text-[#8a4b00]')}>{cam.text}</span>}
    </div>
  );
}
