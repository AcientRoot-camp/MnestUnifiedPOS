// "Nobody signed in at {branch} by 09:00" as a server job (HRSign.md), so it fires even when no device is open, and
// goes to that branch's own manager (not every manager). Vercel Cron calls it at 09:05 Monday–Saturday (vercel.json);
// Ghana time is UTC all year. It reads the sign-ins sent by the tills (api/clock.js) and emails each branch manager once
// a day through Resend. Environment variables:
//   CRON_SECRET        – Vercel sends it as "Authorization: Bearer …"; requests without it are refused
//   BRANCH_MANAGERS    – JSON, e.g. {"osu":{"name":"Osu","email":"ama@…"},"legon":{"name":"East Legon","email":"…"}}
//   ADMIN_EMAIL        – optional, copied on every alert
//   RESEND_API_KEY, EMAIL_FROM – as for api/send-email.js
//   plus the database settings in ../_kv.js
import { co, kv, kvConf, send } from '../_kv.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'Unauthorized' });
  if (!kvConf()) return send(res, 503, { error: 'Clock sync is not configured' });
  let M = {};
  try { M = JSON.parse(process.env.BRANCH_MANAGERS || '{}'); } catch { return send(res, 500, { error: 'BRANCH_MANAGERS is not valid JSON' }); }
  const now = new Date();
  // Sundays are skipped (branches open later); before 09:00 there is nothing to check yet.
  if (now.getUTCDay() === 0 || now.getUTCHours() * 60 + now.getUTCMinutes() < 9 * 60) return send(res, 200, { skipped: true });
  const day = now.toISOString().slice(0, 10);
  const key = process.env.RESEND_API_KEY; const from = process.env.EMAIL_FROM; const admin = process.env.ADMIN_EMAIL;
  const out = [];
  for (const [br, m] of Object.entries(M)) {
    try {
      const n = Number(await kv(['SCARD', `clock:${co()}:${day}:${br}`]));
      if (n > 0) { out.push({ br, signedIn: n }); continue; }
      // Once per branch per day, even if the job runs again.
      const first = await kv(['SET', `late:${co()}:${day}:${br}`, '1', 'NX', 'EX', String(2 * 86400)]);
      if (!first) { out.push({ br, alerted: 'already' }); continue; }
      const name = String(m?.name || br); const to = [m?.email, admin].filter((x) => typeof x === 'string' && x.includes('@'));
      if (!key || !from || !to.length) { out.push({ br, alerted: false, why: 'email not configured' }); continue; }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: `Nobody signed in at ${name} by 09:00`, text: `No one at ${name} has scanned the gate QR today (${day}). Check the branch is open and that staff are signing in.` }),
      });
      out.push({ br, alerted: r.ok });
    } catch {
      out.push({ br, error: true });
    }
  }
  return send(res, 200, { day, branches: out });
}
