// Time-clock sign-ins reach the server (HRSign.md), so the 09:00 check (api/cron/no-sign-in.js) knows which branches
// have had nobody sign in even when no device has the system open. Deploys as /api/clock. Needs the database settings
// in _kv.js; without them it answers 503 and the device-side check still runs.
//
// POST { br, name, kind: 'in' | 'out', at } → 200 { ok: true }
import { body, co, kv, kvConf, sameSite, send } from './_kv.js';

/** The day in Ghana (Africa/Accra is UTC+0 all year) as YYYY-MM-DD. */
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Method Not Allowed' }); }
  if (!sameSite(req)) return send(res, 403, { error: 'Forbidden' });
  if (!kvConf()) return send(res, 503, { error: 'Clock sync is not configured' });
  const b = await body(req);
  const br = String(b?.br || '').replace(/[^\w-]/g, '').slice(0, 20); const name = String(b?.name || '').slice(0, 80);
  const at = Number(b?.at) || Date.now();
  if (!br || !name || (b?.kind !== 'in' && b?.kind !== 'out') || Math.abs(at - Date.now()) > 36e5 * 26) return send(res, 400, { error: 'Bad request' });
  try {
    if (b.kind === 'in') {
      const k = `clock:${co()}:${dayOf(at)}:${br}`;
      await kv(['SADD', k, name]);
      await kv(['EXPIRE', k, String(3 * 86400)]);
    }
    return send(res, 200, { ok: true });
  } catch {
    return send(res, 502, { error: 'Database error' });
  }
}
