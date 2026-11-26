// Camera barcode viewfinder (productscan.md §1.2): a dark box (#1a1a1a) with a white 3 px rounded frame 70% wide,
// a red #c62828 2 px scan line across the middle and the caption "Hold the barcode inside the frame". The live video
// sits behind the frame. It starts as soon as it is shown (the user has just tapped a camera button), reads one code
// (vibrate + beep, camera off), and passes it to onRead. Errors show inside the panel, never as an alert.
import { useEffect, useState } from 'react';
import { PRODUCT_FORMATS, useCodeCamera, type CamErr, type CodeFormat } from '../lib/camera';

/** Panel texts for camera problems, in the system's HTTP-style wording (503 no camera / could not open, 501 browser cannot). */
export const CAM_ERR: Record<CamErr, string> = {
  denied: '503 Service Unavailable · Could not open the camera: permission was refused. Allow the camera for this site in your browser settings, or use a handheld scanner or type the number.',
  nocam: '503 Service Unavailable · No camera was found on this device. Use a handheld scanner or type the number.',
  failed: '503 Service Unavailable · Could not open the camera. Close other apps using it, or use a handheld scanner or type the number.',
  unsupported: '501 Not Implemented · This browser cannot open the camera here. Use Chrome or Safari over HTTPS, a handheld scanner, or type the number.',
};

/**
 * Inputs: onRead (the code read), height of the viewfinder in px, formats (default: every product barcode type + QR),
 * caption under the frame, continuous (keep scanning item after item, see lib/camera.ts). Output: the viewfinder with
 * its own error line.
 */
export default function BarcodeCamera({ onRead, height = 220, formats = PRODUCT_FORMATS, caption = 'Hold the barcode inside the frame', className = '', continuous = false }: { onRead: (raw: string) => void; height?: number; formats?: CodeFormat[]; caption?: string; className?: string; continuous?: boolean }) {
  const [err, setErr] = useState('');
  const cam = useCodeCamera(formats, onRead, continuous);
  useEffect(() => { cam.start((e) => setErr(CAM_ERR[e])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl" style={{ height, background: '#1a1a1a' }} aria-label="Camera viewfinder">
        <div ref={cam.host} className="absolute inset-0" />
        {/* Frame, scan line and caption on top of the video. */}
        <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="relative rounded-xl" style={{ width: '70%', height: '55%', border: '3px solid #ffffff' }}>
            <span className="absolute left-2 right-2 top-1/2 -translate-y-1/2 animate-pulse" style={{ height: 2, background: '#c62828' }} />
          </div>
          <span className="text-white text-xs font-medium drop-shadow">{caption}</span>
        </div>
      </div>
      {err && <span role="alert" className="block mt-2 text-sm text-[#c62828]">{err}</span>}
    </div>
  );
}
