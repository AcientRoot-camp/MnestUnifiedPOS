// Shared helpers for the serverless functions in /api (the leading underscore keeps this file from becoming an endpoint).
// Storage is a Redis database reached over its REST API (Upstash, or Vercel KV which is Upstash). Set either pair in
// the host's environment variables:
//   KV_REST_API_URL + KV_REST_API_TOKEN        (Vercel KV / Upstash integration)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// COMPANY_ID (optional) keeps one company's barcodes and clock data apart from another's on a shared database.

/** The database settings, or null when none are configured (the endpoints then answer 503 and the tills work alone). */
export function kvConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
/** Run one Redis command, e.g. kv(['SET', 'k', 'v', 'NX']). Output: the command's result. Throws on a database error. */
export async function kv(cmd) {
  const c = kvConf();
  if (!c) throw new Error('not configured');
  const r = await fetch(c.url, { method: 'POST', headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `database error ${r.status}`);
  return j.result;
}
/** Company key prefix. */
export const co = () => String(process.env.COMPANY_ID || 'default').replace(/[^\w-]/g, '').slice(0, 40) || 'default';
/** Same-site only: the request's Origin must be the host this function is served from (stops other sites using it). */
export function sameSite(req) {
  const origin = req.headers.origin || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  try { return !!host && new URL(origin).host === host; } catch { return false; }
}
/** Read a small JSON body (max 20 KB). Output: the parsed object, or null when it is missing, too big or not JSON. */
export async function body(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 20480) return null; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
/** Send a JSON answer with a status code. */
export function send(res, status, obj) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
/** GS1 mod-10 check digit (same as src/lib/barcode.ts). */
export const checkDigit = (d) => { let sum = 0; for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += parseInt(d[i], 10) * w; return String((10 - (sum % 10)) % 10); };
