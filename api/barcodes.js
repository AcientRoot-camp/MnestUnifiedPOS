// Company-wide barcode register (productscan.md §2.1, §6): one product per barcode across every till and device, and
// the next shop barcode ("200" + 9 digits + check digit) from one server sequence, so two tills never make the same code.
// Deploys as /api/barcodes (Vercel / Netlify-style /api folder). Needs the database settings described in _kv.js;
// without them it answers 503 and the tills fall back to checking on their own device.
//
// POST { op: 'claim', pid, name, codes: [..] } → 200 { ok: true }  |  409 { code, owner } when another product has it
// POST { op: 'shop' }                         → 200 { code: '200…' }
// POST { op: 'release', pid, codes: [..] }    → 200 { ok: true } (frees codes a product no longer uses)
import { body, checkDigit, co, kv, kvConf, sameSite, send } from './_kv.js';

const CODE = /^[A-Za-z0-9]{1,32}$/;
const key = (c) => `bc:${co()}:${c.toUpperCase()}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Method Not Allowed' }); }
  if (!sameSite(req)) return send(res, 403, { error: 'Forbidden' });
  if (!kvConf()) return send(res, 503, { error: 'Barcode register is not configured' });
  const b = await body(req);
  if (!b || typeof b.op !== 'string') return send(res, 400, { error: 'Bad request' });
  try {
    if (b.op === 'shop') {
      // INCR is atomic, so each call gets its own number; numbers already claimed by hand are skipped.
      for (let i = 0; i < 20; i++) {
        const n = 100000 + Number(await kv(['INCR', `bcseq:${co()}`]));
        const base = '200' + String(n).padStart(9, '0'); const code = base + checkDigit(base);
        if (!(await kv(['EXISTS', key(code)]))) return send(res, 200, { code });
      }
      return send(res, 503, { error: 'No free shop barcode found' });
    }
    const pid = String(b.pid || '').slice(0, 40); const name = String(b.name || '').slice(0, 120);
    const codes = Array.isArray(b.codes) ? [...new Set(b.codes.map((c) => String(c).replace(/\s/g, '')).filter((c) => CODE.test(c)))].slice(0, 20) : [];
    if (!pid || !codes.length) return send(res, 400, { error: 'Bad request' });
    if (b.op === 'release') {
      for (const c of codes) { const v = await kv(['GET', key(c)]); if (v && JSON.parse(v).pid === pid) await kv(['DEL', key(c)]); }
      return send(res, 200, { ok: true });
    }
    if (b.op !== 'claim') return send(res, 400, { error: 'Bad request' });
    // Check all first so a clash on the second code does not leave the first one claimed.
    for (const c of codes) { const v = await kv(['GET', key(c)]); if (v) { const o = JSON.parse(v); if (o.pid !== pid) return send(res, 409, { code: c, owner: o.name }); } }
    for (const c of codes) {
      const ok = await kv(['SET', key(c), JSON.stringify({ pid, name, at: Date.now() }), 'NX']);
      if (!ok) { const o = JSON.parse(await kv(['GET', key(c)]) || '{}'); if (o.pid !== pid) return send(res, 409, { code: c, owner: o.name }); }
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 502, { error: 'Database error' });
  }
}
