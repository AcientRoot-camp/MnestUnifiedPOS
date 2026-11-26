/**
 * Background removal for uploaded logos, so they blend into any MNest UnifiedPOS background.
 *
 * - Hosted on a real domain (https, not localhost): the image goes to the AI service at /api/remove-bg
 *   (or VITE_BG_API), which cuts out the subject however complex the background is.
 * - Not hosted (localhost, file preview, offline) or the AI service is unavailable: the image is cleaned in
 *   the browser. The background colour is read from the edges, flood-filled away, small enclosed pockets of
 *   the same colour are removed, and edge pixels are "un-mixed" from the background so there is no halo.
 * - Images that already have a transparent background are kept as they are.
 */
export type BgResult = { url: string; how: 'ai' | 'local' | 'kept'; note: string };

export function isHosted() {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '' || h.endsWith('.local') || h.endsWith('.localhost') || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  return location.protocol === 'https:' && !local;
}

const readUrl = (f: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(f); });
const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Image could not be read')); i.src = src; });

async function viaAI(file: Blob): Promise<string> {
  const api = (import.meta.env.VITE_BG_API as string | undefined) || '/api/remove-bg';
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25_000);
  try {
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch(api, { method: 'POST', body: fd, signal: ctl.signal });
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new Error(`AI service ${r.status}`);
    return await readUrl(await r.blob());
  } finally {
    clearTimeout(t);
  }
}

/**
 * Finds a thin rectangular frame (a line on all four sides, separated from the artwork by background) and returns
 * the area inside it as [x, y, w, h], or null when there is no frame.
 */
function findFrame(d: Uint8ClampedArray, w: number, h: number): [number, number, number, number] | null {
  const bg = [d[0], d[1], d[2]];
  const isBg = (x: number, y: number) => { const p = (y * w + x) * 4; return Math.max(Math.abs(d[p] - bg[0]), Math.abs(d[p + 1] - bg[1]), Math.abs(d[p + 2] - bg[2])) <= 40; };
  const rowFill = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (!isBg(x, y)) n++; return n / w; };
  const colFill = (x: number) => { let n = 0; for (let y = 0; y < h; y++) if (!isBg(x, y)) n++; return n / h; };
  // From one side: skip margin, find a line covering most of the side, no thicker than 4%, followed by background.
  const side = (len: number, fill: (i: number) => number, at: (k: number) => number, max: number) => {
    let i = 0;
    while (i < len * 0.25 && fill(at(i)) < 0.5) i++;
    if (i >= len * 0.25 || fill(at(i)) < 0.6) return -1;
    const start = i;
    while (i < len * 0.3 && fill(at(i)) >= 0.6) i++;
    if (i - start > Math.max(2, max * 0.04)) return -1;
    return fill(at(i)) < 0.5 ? i : -1; // first row/column inside the frame
  };
  const top = side(h, rowFill, (k) => k, h);
  const bot = side(h, rowFill, (k) => h - 1 - k, h);
  const left = side(w, colFill, (k) => k, w);
  const right = side(w, colFill, (k) => w - 1 - k, w);
  if ([top, bot, left, right].some((v) => v < 0)) return null;
  const pad = 2;
  const x = left + pad, y = top + pad, ww = w - left - right - 2 * pad, hh = h - top - bot - 2 * pad;
  return ww > w * 0.4 && hh > h * 0.4 ? [x, y, ww, hh] : null;
}

/** In-browser removal. Works best on logos with a plain or near-plain background. */
export async function removeLocal(src: string, maxSide = 1024): Promise<{ url: string; kept: boolean }> {
  const img = await loadImg(src);
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const W0 = Math.max(1, Math.round(img.naturalWidth * k)), H0 = Math.max(1, Math.round(img.naturalHeight * k));
  const c0 = document.createElement('canvas'); c0.width = W0; c0.height = H0;
  const x0c = c0.getContext('2d', { willReadFrequently: true })!;
  x0c.drawImage(img, 0, 0, W0, H0);
  // A thin border frame around the artwork (poster-style) would hide the background inside it: cut inside the frame first.
  const f = findFrame(x0c.getImageData(0, 0, W0, H0).data, W0, H0);
  const [fx, fy, w, h] = f ?? [0, 0, W0, H0];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(c0, fx, fy, w, h, 0, 0, w, h);
  const id = cx.getImageData(0, 0, w, h); const d = id.data;
  // Already transparent at the edges? Keep it.
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  if (edge.filter((i) => d[i * 4 + 3] < 200).length > edge.length * 0.5) return { url: src, kept: true };
  // Background colour = median of each channel along the edges.
  const med = (c: number) => { const v = edge.map((i) => d[i * 4 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const dist = (i: number) => Math.max(Math.abs(d[i * 4] - bg[0]), Math.abs(d[i * 4 + 1] - bg[1]), Math.abs(d[i * 4 + 2] - bg[2]));
  // If the edges are not one colour (a photo), say so and keep the original.
  if (edge.filter((i) => dist(i) <= 28).length < edge.length * 0.6) return { url: src, kept: true };
  const gone = new Uint8Array(w * h);
  const stack = edge.slice();
  while (stack.length) {
    const i = stack.pop()!;
    if (gone[i] || dist(i) > 28) continue;
    gone[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1); if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
  }
  // Small enclosed pockets of background colour (gaps between shapes) go too; large ones (part of the art) stay.
  const seen = new Uint8Array(w * h); const pocket = Math.max(60, (w * h) / 900);
  for (let s = 0; s < w * h; s++) {
    if (gone[s] || seen[s] || dist(s) > 10) continue;
    const comp: number[] = []; const st = [s]; seen[s] = 1;
    while (st.length) {
      const i = st.pop()!; comp.push(i);
      const x = i % w, y = (i / w) | 0;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (n >= 0 && !seen[n] && !gone[n] && dist(n) <= 10) { seen[n] = 1; st.push(n); }
    }
    if (comp.length < pocket) comp.forEach((i) => (gone[i] = 1));
  }
  // Un-mix the edge pixels from the background colour (no white halo on dark screens).
  const near = (i: number) => { const x = i % w, y = (i / w) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && gone[ny * w + nx]) return true; } return false; };
  const light = bg[0] + bg[1] + bg[2] > 382;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (gone[i]) { d[p + 3] = 0; continue; }
    if (!near(i)) continue;
    let a = 0;
    for (let c = 0; c < 3; c++) a = Math.max(a, light ? (bg[c] - d[p + c]) / (bg[c] || 1) : (d[p + c] - bg[c]) / (255 - bg[c] || 1));
    a = Math.min(1, Math.max(0, a * 1.15));
    if (a <= 0.02) { d[p + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) d[p + c] = Math.max(0, Math.min(255, Math.round((d[p + c] - (1 - a) * bg[c]) / a)));
    d[p + 3] = Math.round(a * d[p + 3]);
  }
  cx.putImageData(id, 0, 0);
  // Trim the empty margin.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { url: src, kept: true };
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { url: out.toDataURL('image/png'), kept: false };
}

/** Remove the background of an uploaded image: AI when hosted, in-browser otherwise (and as the fallback). */
export async function removeBackground(file: File): Promise<BgResult> {
  const src = await readUrl(file);
  if (file.type === 'image/svg+xml') return { url: src, how: 'kept', note: 'SVG logos are already drawn on a transparent background.' };
  if (isHosted()) {
    try {
      return { url: await viaAI(file), how: 'ai', note: 'Background removed by the AI service.' };
    } catch {
      /* AI not reachable: fall back to the browser */
    }
  }
  try {
    const r = await removeLocal(src);
    return r.kept
      ? { url: src, how: 'kept', note: 'The background is already transparent or too detailed to remove here, so the image was kept as it is.' }
      : { url: r.url, how: 'local', note: isHosted() ? 'The AI service was not reachable, so the background was removed on this device.' : 'Background removed on this device.' };
  } catch {
    return { url: src, how: 'kept', note: 'The background could not be removed, so the image was kept as it is.' };
  }
}
