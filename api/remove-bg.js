// AI background removal for uploaded logos, used by the app once it is hosted on a domain.
// Deploys as a serverless function at /api/remove-bg (Vercel and Netlify-style hosts pick up the /api folder).
// Set REMOVE_BG_API_KEY in the host's environment variables (key from https://www.remove.bg/api).
// The key stays on the server; the browser only ever sends the image here.
// If the key is missing or the service fails, the app falls back to removing the background in the browser.
export const config = { api: { bodyParser: false } };

const MAX = 5 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end('Method Not Allowed'); }
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key) { res.statusCode = 503; return res.end('AI background removal is not configured'); }
  try {
    // Read the raw multipart body and forward it unchanged.
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX) { res.statusCode = 413; return res.end('Image too large'); } chunks.push(c); }
    const inForm = await new Request('http://local', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body: Buffer.concat(chunks) }).formData();
    const file = inForm.get('image');
    if (!file || typeof file === 'string' || !/^image\/(png|jpe?g|webp)$/.test(file.type)) { res.statusCode = 415; return res.end('Send a PNG, JPG or WebP image'); }
    const out = new FormData();
    out.append('image_file', file, file.name || 'logo');
    out.append('size', 'auto');
    out.append('format', 'png');
    const r = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': key }, body: out });
    if (!r.ok) { res.statusCode = 502; return res.end(`AI service error ${r.status}`); }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.statusCode = 500;
    return res.end('Background removal failed');
  }
}
