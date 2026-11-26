// One live camera scanner for the whole system: product barcodes (Sell Now, Products, Inventory) and QR codes (the HR
// time clock). It opens the back camera (HTTPS is required) and reads codes with the browser's own BarcodeDetector
// when the browser says it supports the formats asked for; otherwise (iPhone Safari, Firefox, Windows) it uses ZXing,
// which reads 1-D barcodes and QR codes. ZXing is only downloaded when it is needed.
import { useEffect, useRef, useState } from 'react';

/** Formats, named as BarcodeDetector names them. */
export type CodeFormat = 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e' | 'itf' | 'code_128' | 'qr_code';
export const PRODUCT_FORMATS: CodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128', 'qr_code'];
/** Why the camera could not be used: refused, no camera, failed to start, or the browser cannot open cameras. */
export type CamErr = 'denied' | 'nocam' | 'failed' | 'unsupported';

/** Short confirmation when a code is read: a vibration (phones) and a beep. */
export function scanFeedback() {
  try { navigator.vibrate?.(60); } catch { /* not supported */ }
  try {
    const A = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!A) return;
    const ctx = new A(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1760; g.gain.value = 0.06;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.09);
    o.onended = () => ctx.close();
  } catch { /* audio blocked */ }
}

type Det = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type BDType = { new (o: { formats: string[] }): Det; getSupportedFormats?: () => Promise<string[]> };
type Stopper = { stop: () => void };

/**
 * Live camera reader. Inputs: the formats to read, onRead, and continuous. Normally onRead is called once with the
 * first code and the camera stops. continuous (tablet / phone tills and stocking): the camera stays on and every new
 * code is passed on; the same code is ignored for 2 s (so one held box is not counted many times) and any code for
 * 0.8 s after a read, giving the user time to move to the next item.
 * Output: { host (ref for the element that shows the video), on, start(onErr), stop }.
 * Reader choice: BarcodeDetector if it supports every format asked for (checked with a 1.5 s limit, because on some
 * devices it exists but cannot read), else ZXing. If BarcodeDetector fails 3 times in a row, it switches to ZXing.
 */
export function useCodeCamera(formats: CodeFormat[], onRead: (raw: string) => void, continuous = false) {
  const host = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number>();
  const zx = useRef<Stopper | null>(null);
  const read = useRef(onRead); read.current = onRead;
  const lastRead = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [on, setOn] = useState(false);

  const stop = () => {
    window.clearTimeout(timer.current);
    try { zx.current?.stop(); } catch { /* already stopped */ }
    zx.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (host.current) host.current.innerHTML = '';
    setOn(false);
  };
  useEffect(() => stop, []); // the camera always turns off when the screen closes

  /** A code was read: feedback, then stop the camera and hand the code on (or, continuous, keep going). */
  const got = (raw: string) => {
    if (!stream.current) return;
    if (continuous) {
      const now = Date.now(); const L = lastRead.current;
      if (now - L.at < 800 || (raw === L.code && now - L.at < 2000)) return;
      lastRead.current = { code: raw, at: now }; scanFeedback(); read.current(raw); return;
    }
    scanFeedback(); stop(); read.current(raw);
  };

  /** ZXing on the same video element (iPhone Safari, Firefox, Windows Chrome …). */
  const startZxing = async (v: HTMLVideoElement) => {
    const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
    const F = lib.BarcodeFormat;
    const map: Record<CodeFormat, number> = { ean_13: F.EAN_13, ean_8: F.EAN_8, upc_a: F.UPC_A, upc_e: F.UPC_E, itf: F.ITF, code_128: F.CODE_128, qr_code: F.QR_CODE };
    const hints = new Map(); hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, formats.map((f) => map[f]));
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 250 });
    if (!stream.current) return;
    zx.current = await reader.decodeFromVideoElement(v, (res) => { if (res) got(res.getText()); });
  };

  const start = async (onErr: (e: CamErr) => void) => {
    if (!navigator.mediaDevices?.getUserMedia) return onErr('unsupported');
    try {
      setOn(true);
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.current = st;
      const v = document.createElement('video');
      v.setAttribute('playsinline', 'true'); v.muted = true; v.srcObject = st;
      v.style.cssText = 'width:100%;height:100%;object-fit:cover';
      if (host.current) { host.current.innerHTML = ''; host.current.appendChild(v); }
      await v.play().catch(() => undefined);
      let det: Det | null = null;
      try {
        const BD = (window as unknown as { BarcodeDetector?: BDType }).BarcodeDetector;
        if (BD) {
          const sup = BD.getSupportedFormats ? await Promise.race([BD.getSupportedFormats(), new Promise<string[]>((r) => setTimeout(() => r([]), 1500))]) : formats;
          if (formats.every((f) => sup.includes(f))) det = new BD({ formats });
        }
      } catch { det = null; }
      if (!det) return void startZxing(v).catch(() => onErr('unsupported'));
      let fails = 0;
      const tick = async () => {
        if (!stream.current || !det) return;
        try {
          const r = await det.detect(v); fails = 0;
          if (r?.[0]?.rawValue) got(r[0].rawValue);
          if (!stream.current) return;
          timer.current = window.setTimeout(tick, 400);
        } catch {
          if (++fails >= 3) { det = null; return void startZxing(v).catch(() => onErr('unsupported')); }
          timer.current = window.setTimeout(tick, 600);
        }
      };
      timer.current = window.setTimeout(tick, 500);
    } catch (err) {
      stop();
      const n = (err as { name?: string })?.name;
      onErr(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'nocam' : 'failed');
    }
  };
  return { host, on, start, stop };
}
