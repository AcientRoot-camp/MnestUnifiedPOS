// Reads a policy document a company uploads in Post to online, so the store can show it in its own style.
//  .docx            → text with "## " headings and "- " bullets (unzipped in the browser, no library needed)
//  .txt / .md       → text as written
//  .pdf             → kept as a file the store page embeds, with a download button
// Everything stays in the browser; nothing is sent to a server.

/** Result of reading a document: either text for the page, or a PDF to embed. */
export type DocResult = { kind: 'text'; text: string; name: string } | { kind: 'pdf'; dataUrl: string; name: string };

/** Largest PDF accepted: the store's content is kept in browser storage, which holds only a few megabytes. */
export const MAX_PDF_BYTES = 2 * 1024 * 1024;

/** Read a File as a data: URL (used to keep a PDF). */
const asDataUrl = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(f); });

/**
 * Find one file inside a .docx (a zip archive) and return its text.
 * Walks the zip's central directory, then inflates the entry with the browser's DecompressionStream.
 */
async function unzipEntry(buf: ArrayBuffer, wanted: string): Promise<string | null> {
  const v = new DataView(buf); const u8 = new Uint8Array(buf);
  // End-of-central-directory record: scan back from the end for its signature 0x06054b50.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  let p = v.getUint32(eocd + 16, true); const count = v.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) return null;
    const method = v.getUint16(p + 10, true); const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true); const extraLen = v.getUint16(p + 30, true); const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true); const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = u8.slice(start, start + size);
      if (method === 0) return dec.decode(data);
      if (method !== 8 || typeof DecompressionStream === 'undefined') return null;
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/**
 * Turn Word's document.xml into plain text: headings → "## ", list paragraphs → "- ", one paragraph per line.
 * Headings are recognised by Word's Heading/Title styles, or (for documents typed without styles) a short line
 * that is all bold or at least 14pt and does not end like a sentence. Lists are recognised by Word numbering,
 * a List style, or a typed bullet character at the start.
 */
function docxXmlToText(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const lines: string[] = [];
  Array.from(doc.getElementsByTagNameNS(W, 'p')).forEach((p) => {
    const raw = Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent || '').join('').trim();
    if (!raw) { lines.push(''); return; }
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || '';
    const typedBullet = /^[•◦▪●○·‣–-]\s*/.test(raw);
    const text = raw.replace(/^[•◦▪●○·‣–-]\s*/, '').trim();
    const isList = typedBullet || p.getElementsByTagNameNS(W, 'numPr').length > 0 || /list/i.test(style);
    // Runs that carry text, to test whether the whole line is bold / large.
    const runs = Array.from(p.getElementsByTagNameNS(W, 'r')).filter((r) => Array.from(r.getElementsByTagNameNS(W, 't')).some((t) => (t.textContent || '').trim()));
    const allBold = runs.length > 0 && runs.every((r) => { const b = r.getElementsByTagNameNS(W, 'b')[0]; return b && b.getAttributeNS(W, 'val') !== '0' && b.getAttributeNS(W, 'val') !== 'false'; });
    const size = Math.max(0, ...runs.map((r) => Number(r.getElementsByTagNameNS(W, 'sz')[0]?.getAttributeNS(W, 'val') || 0)));
    const looksHeading = !isList && text.length <= 90 && !/[.,;]$/.test(text) && (allBold || size >= 28);
    lines.push(/^(heading|title)/i.test(style) || looksHeading ? `## ${text}` : isList ? `- ${text}` : text);
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Read an uploaded policy document.
 * Input: f → the chosen file. Output: DocResult. Throws an Error with a plain-language message when the file
 * cannot be used (wrong type, too big, or a Word file that cannot be read).
 */
export async function readPolicyDoc(f: File): Promise<DocResult> {
  const name = f.name; const ext = name.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') {
    if (f.size > MAX_PDF_BYTES) throw new Error(`That PDF is ${(f.size / 1048576).toFixed(1)} MB. Please use one under 2 MB, or upload it as a Word file instead.`);
    return { kind: 'pdf', dataUrl: await asDataUrl(f), name };
  }
  if (ext === 'txt' || ext === 'md') return { kind: 'text', text: (await f.text()).replace(/^#{1,6}\s+/gm, '## ').trim(), name };
  if (ext === 'docx') {
    const xml = await unzipEntry(await f.arrayBuffer(), 'word/document.xml');
    if (!xml) throw new Error('That Word file could not be read. Save it again as .docx (or as a PDF) and try once more.');
    const text = docxXmlToText(xml);
    if (!text) throw new Error('That Word file has no text in it.');
    return { kind: 'text', text, name };
  }
  if (ext === 'doc') throw new Error('Old Word (.doc) files cannot be read. In Word choose Save As › Word Document (.docx) or PDF, then upload that.');
  throw new Error('Please upload a Word (.docx), PDF, or text (.txt / .md) file.');
}
