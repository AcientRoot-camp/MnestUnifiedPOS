// Tiny PDF writer for receipts, invoices and order confirmations: no library, runs in the browser.
// It lays out one kind of business document (PdfDoc below) on A4 pages using the PDF built-in Helvetica fonts:
// logo + company details, a title with number and status badge, a details grid, an items table that flows onto
// extra pages (header row repeated), totals, a highlighted code, notes and a footer with page numbers.
// Text is written in WinAnsi (Latin-1) encoding; characters it cannot show are replaced (see winAnsi).

/** A business document to turn into a PDF. */
export type PdfDoc = {
  title: string;                      // e.g. "Order Confirmation", "Sales receipt", "Tax invoice"
  number?: string;                    // e.g. "OC-34452610"
  badge?: { text: string; tone: 'ok' | 'warn' | 'bad' };
  business: { name: string; lines: string[] };   // company name + address / phone / email lines
  logoUrl?: string;                   // drawn top-left when it can be loaded
  meta: [string, string][];           // label → value pairs shown in a grid
  highlight?: [string, string];       // e.g. ["Collection code", "482913"]
  table: { cols: { label: string; w: number; align?: 'left' | 'right' }[]; rows: string[][] };   // w = share of width
  totals: [string, string, boolean?][];   // label, value, bold
  dashedTotals?: boolean;             // a dashed line above the first total (till receipts)
  notes?: string[];                   // paragraphs under the totals
  footer?: string;                    // left side of every page footer
};

const W = 595.28, H = 841.89, M = 40;            // A4 in points, page margin
const BRAND = [0.043, 0.361, 0.361] as const;   // #0b5c5c, the app's brand teal
const INK = [0.1, 0.1, 0.1] as const, MUTED = [0.42, 0.42, 0.42] as const, LINE = [0.88, 0.88, 0.88] as const;

/* Helvetica / Helvetica-Bold character widths (1/1000 em) for ASCII 32–126, from the standard font metrics. */
const HV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

/** Map a JS string to WinAnsi byte values (typographic punctuation kept; emoji and unsupported symbols dropped). */
const SPECIAL: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '·': 0xb7, '×': 0xd7, '−': 0x2d, '✓': 0x2a };
export function winAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0)!;
    if (SPECIAL[ch] !== undefined) out.push(SPECIAL[ch]);
    else if (c >= 32 && c <= 126) out.push(c);
    else if (c >= 160 && c <= 255) out.push(c);
    else if (c === 10 || c === 9) out.push(32);
    // anything else (emoji, other scripts) is left out
  }
  return out;
}
/** Width of a string in points at a font size. */
export const width = (s: string, size: number, bold = false) => winAnsi(s).reduce((a, c) => a + ((c >= 32 && c <= 126 ? (bold ? HB : HV)[c - 32] : c === 0xb7 ? 278 : c === 0x95 ? 350 : 556)), 0) * size / 1000;
/** PDF string literal: bytes with ( ) \ escaped and non-ASCII as octal. */
export const lit = (s: string) => '(' + winAnsi(s).map((c) => (c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c))).join('') + ')';
export const rgb = (c: readonly number[]) => c.map((v) => v.toFixed(3)).join(' ');

/** Break text into lines that fit a width. Long single words are cut. */
export function wrap(text: string, maxW: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  String(text ?? '').split('\n').forEach((para) => {
    let cur = '';
    para.split(/\s+/).filter(Boolean).forEach((word) => {
      let w = word;
      while (width(w, size, bold) > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && width(w.slice(0, k), size, bold) > maxW) k--; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, k)); w = w.slice(k); }
      const next = cur ? cur + ' ' + w : w;
      if (width(next, size, bold) <= maxW) cur = next; else { if (cur) lines.push(cur); cur = w; }
    });
    lines.push(cur);
  });
  return lines.length ? lines : [''];
}

/** Load an image (SVG, PNG …) and re-encode it as JPEG on a white background, for embedding. Null if it fails. */
export async function loadJpeg(url: string): Promise<{ data: Uint8Array; w: number; h: number } | null> {
  try {
    const img = new Image(); img.crossOrigin = 'anonymous';
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('logo')); img.src = url; });
    const scale = Math.min(1, 360 / Math.max(img.naturalWidth || 360, img.naturalHeight || 360));
    const w = Math.max(1, Math.round((img.naturalWidth || 360) * scale)), h = Math.max(1, Math.round((img.naturalHeight || 360) * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    const b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1];
    const bin = atob(b64); const data = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    return { data, w, h };
  } catch { return null; }
}

/**
 * Lay out a PdfDoc and return the PDF file as a Blob.
 * Coordinates below are measured from the top of the page (y grows downwards) and flipped when written.
 */
export async function renderPdf(doc: PdfDoc): Promise<Blob> {
  const logo = doc.logoUrl ? await loadJpeg(doc.logoUrl) : null;
  const pages: string[][] = [[]];
  let ops = pages[0];
  const Y = (y: number) => (H - y).toFixed(2);
  const text = (x: number, y: number, s: string, size = 10, bold = false, color: readonly number[] = INK, align: 'left' | 'right' = 'left') => {
    const tx = align === 'right' ? x - width(s, size, bold) : x;
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${tx.toFixed(2)} ${Y(y)} Td ${lit(s)} Tj ET`);
  };
  const rect = (x: number, y: number, w: number, h: number, fill: readonly number[]) => ops.push(`${rgb(fill)} rg ${x.toFixed(2)} ${Y(y + h)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const hline = (x1: number, x2: number, y: number, color: readonly number[] = LINE, lw = 0.8) => ops.push(`${rgb(color)} RG ${lw} w ${x1.toFixed(2)} ${Y(y)} m ${x2.toFixed(2)} ${Y(y)} l S`);
  const newPage = () => { ops = []; pages.push(ops); return M + 10; };
  const bottom = H - M - 30;

  // --- Header: logo + business on the left, title / number / badge on the right ---
  let y = M;
  let bx = M;
  if (logo) { const lh = 54, lw = Math.min(110, (logo.w / logo.h) * lh); ops.push(`q ${lw.toFixed(2)} 0 0 ${lh} ${M} ${Y(y + lh)} cm /Im1 Do Q`); bx = M + lw + 12; }
  text(bx, y + 14, doc.business.name, 14, true);
  doc.business.lines.forEach((l, i) => text(bx, y + 29 + i * 11.5, l, 8.5, false, MUTED));
  text(W - M, y + 18, doc.title, 20, true, BRAND, 'right');
  if (doc.number) text(W - M, y + 34, doc.number, 10, false, INK, 'right');
  if (doc.badge) {
    const fill = doc.badge.tone === 'ok' ? [0.86, 0.95, 0.87] : doc.badge.tone === 'bad' ? [0.99, 0.89, 0.89] : [1, 0.95, 0.82];
    const ink = doc.badge.tone === 'ok' ? [0.08, 0.4, 0.13] : doc.badge.tone === 'bad' ? [0.6, 0.1, 0.1] : [0.5, 0.33, 0];
    const bw = width(doc.badge.text, 9, true) + 16;
    rect(W - M - bw, y + 42, bw, 16, fill); text(W - M - 8, y + 53.5, doc.badge.text, 9, true, ink, 'right');
  }
  y += Math.max(70, 34 + doc.business.lines.length * 11.5);
  hline(M, W - M, y, BRAND, 2); y += 16;

  // --- Details grid (3 columns) ---
  const colW = (W - 2 * M) / 3;
  for (let i = 0; i < doc.meta.length; i += 3) {
    let rowH = 0;
    doc.meta.slice(i, i + 3).forEach(([k, v], j) => {
      const x = M + j * colW; text(x, y + 8, k.toUpperCase(), 7, true, MUTED);
      const lines = wrap(v, colW - 12, 9.5); lines.forEach((l, n) => text(x, y + 21 + n * 12, l, 9.5)); rowH = Math.max(rowH, 18 + lines.length * 12);
    });
    y += rowH + 6;
  }

  // --- Highlight box (e.g. collection code) ---
  if (doc.highlight) {
    y += 4; rect(M, y, W - 2 * M, 34, [0.95, 0.96, 0.96]);
    text(M + 12, y + 21, doc.highlight[0], 10, true); text(W - M - 12, y + 23, doc.highlight[1], 16, true, INK, 'right'); y += 46;
  }

  // --- Items table: header row in brand colour, wrapped cells, flows onto new pages ---
  const tw = W - 2 * M; const share = doc.table.cols.reduce((a, c) => a + c.w, 0);
  const xs: number[] = []; let acc = M; doc.table.cols.forEach((c) => { xs.push(acc); acc += (c.w / share) * tw; });
  const cw = (i: number) => (doc.table.cols[i].w / share) * tw;
  const head = () => { rect(M, y, tw, 20, BRAND); doc.table.cols.forEach((c, i) => text(c.align === 'right' ? xs[i] + cw(i) - 6 : xs[i] + 6, y + 13.5, c.label, 8.5, true, [1, 1, 1], c.align === 'right' ? 'right' : 'left')); y += 20; };
  y += 6; head();
  doc.table.rows.forEach((r, ri) => {
    const cells = r.map((v, i) => wrap(v, cw(i) - 12, 9));
    const rh = Math.max(...cells.map((c) => c.length)) * 11.5 + 9;
    if (y + rh > bottom) { y = newPage(); head(); }
    if (ri % 2) rect(M, y, tw, rh, [0.975, 0.98, 0.98]);
    cells.forEach((lines, i) => { const right = doc.table.cols[i].align === 'right'; lines.forEach((l, n) => text(right ? xs[i] + cw(i) - 6 : xs[i] + 6, y + 13 + n * 11.5, l, 9, false, INK, right ? 'right' : 'left')); });
    y += rh; hline(M, W - M, y);
  });
  if (!doc.table.rows.length) { text(M + 6, y + 16, 'No items.', 9, false, MUTED); y += 24; }

  // --- Totals, right-aligned ---
  y += 10;
  if (doc.dashedTotals) { if (y + 24 > bottom) y = newPage(); ops.push('q [4 3] 0 d'); hline(M, W - M, y, INK, 0.9); ops.push('Q'); y += 6; }
  doc.totals.forEach(([k, v, bold]) => {
    if (y + 18 > bottom) y = newPage();
    if (bold) { hline(W - M - 230, W - M, y + 2, INK, 0.8); y += 4; }
    text(W - M - 110, y + 12, k, bold ? 10.5 : 9.5, !!bold, bold ? INK : MUTED, 'right'); text(W - M, y + 12, v, bold ? 10.5 : 9.5, !!bold, INK, 'right'); y += bold ? 20 : 16;
  });

  // --- Notes ---
  (doc.notes || []).forEach((p) => {
    y += 6;
    wrap(p, tw, 9).forEach((l) => { if (y + 14 > bottom) y = newPage(); text(M, y + 11, l, 9, false, MUTED); y += 12.5; });
  });

  // --- Footer on every page ---
  pages.forEach((p, i) => { ops = p; hline(M, W - M, H - M - 14); if (doc.footer) text(M, H - M, doc.footer, 7.5, false, MUTED); text(W - M, H - M, `Page ${i + 1} of ${pages.length}`, 7.5, false, MUTED, 'right'); });

  return assemble(pages, logo);
}

/**
 * Write the PDF objects (catalog, pages, fonts, optional logo image, page contents) with a correct xref table.
 * Fonts: F1 Helvetica, F2 Helvetica-Bold, F3 Times-Roman, F4 Times-Bold, F5 Times-Italic, F6 Helvetica-Oblique
 * (all PDF built-ins, nothing embedded). size: the page size in points (A4 by default; the receipt uses its own).
 */
export function assemble(pages: string[][], logo: { data: Uint8Array; w: number; h: number } | null, size: [number, number] = [W, H]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = []; const offsets: number[] = []; let len = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const nPages = pages.length;
  // Object numbers: 1 catalog, 2 pages, 3–8 the six fonts, 9 image (if any), then page + content pairs.
  const FONTS = ['Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Helvetica-Oblique'];
  const IMG = 3 + FONTS.length;
  const first = logo ? IMG + 1 : IMG;
  const pageNum = (i: number) => first + i * 2;
  const obj = (n: number, body: string | Uint8Array[]) => { offsets[n] = len; push(`${n} 0 obj\n`); if (typeof body === 'string') push(body); else body.forEach((b) => push(b)); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${nPages} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(' ')}] >>`);
  FONTS.forEach((f, i) => obj(3 + i, `<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`));
  const fontRes = FONTS.map((_, i) => `/F${i + 1} ${3 + i} 0 R`).join(' ');
  if (logo) obj(IMG, [enc.encode(`<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n`), logo.data, enc.encode('\nendstream')]);
  pages.forEach((ops, i) => {
    const content = ops.join('\n');
    // Content uses only bytes 0–127 (non-ASCII text is octal-escaped), so its length equals its character count.
    obj(pageNum(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size[0].toFixed(2)} ${size[1].toFixed(2)}] /Resources << /Font << ${fontRes} >>${logo ? ` /XObject << /Im1 ${IMG} 0 R >>` : ''} >> /Contents ${pageNum(i) + 1} 0 R >>`);
    obj(pageNum(i) + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const total = first + nPages * 2;
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** Save a Blob as a file download. */
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Read a Blob as base64 (no data: prefix), e.g. to attach a PDF to an email. */
export const blobToBase64 = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => bad(r.error); r.readAsDataURL(b); });
