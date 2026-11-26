// Emails a customer their Order Confirmation PDF after they order on the online store.
// Deploys as a serverless function at /api/send-email (Vercel and Netlify-style hosts pick up the /api folder).
// Uses Resend (https://resend.com). Set these in the host's environment variables:
//   RESEND_API_KEY  – the API key from Resend
//   EMAIL_FROM      – the sender, e.g. "Ebenezer Unique Ventures <orders@yourdomain.com>" (domain verified in Resend)
// The key stays on the server. To stop this endpoint being used to send spam, it only accepts requests from the
// store's own website and writes the subject and message itself: the browser only supplies the order details and PDF.
// If it is not configured or the service fails, the store tells the customer and offers the PDF download instead.

const MAX_BODY = 6 * 1024 * 1024;                     // whole request (base64 PDF is about 4/3 of the file size)
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clean = (s, n) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end('Method Not Allowed'); }
  // Same-site only: the Origin must match the host this function is served from.
  const origin = req.headers.origin || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* missing or malformed Origin */ }
  if (!originHost || !host || originHost !== host) { res.statusCode = 403; return res.end('Forbidden'); }
  const key = process.env.RESEND_API_KEY; const from = process.env.EMAIL_FROM;
  if (!key || !from) { res.statusCode = 503; return res.end('Email is not configured'); }
  try {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BODY) { res.statusCode = 413; return res.end('Too large'); } chunks.push(c); }
    const b = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const to = clean(b.to, 200), orderNo = clean(b.orderNo, 20).replace(/[^\w-]/g, ''), business = clean(b.business, 80) || 'Our shop', name = clean(b.name, 80), total = clean(b.total, 30);
    if (!EMAIL.test(to) || !orderNo || typeof b.pdf !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.pdf)) { res.statusCode = 400; return res.end('Bad request'); }
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;line-height:1.5">
      <p>Hello ${esc(name.split(' ')[0] || 'there')},</p>
      <p>Thank you for your order with <b>${esc(business)}</b>. Your Order Confirmation for order <b>#${esc(orderNo)}</b>${total ? ` (total <b>${esc(total)}</b>)` : ''} is attached as a PDF.</p>
      <p>Keep your order number to track or collect your order. If anything is not right, simply reply to this email.</p>
      <p>Thank you for shopping with us.<br>${esc(business)}</p></div>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `Order Confirmation #${orderNo} · ${business}`, html, attachments: [{ filename: `order-confirmation-${orderNo}.pdf`, content: b.pdf }] }),
    });
    if (!r.ok) { res.statusCode = 502; return res.end(`Email service error ${r.status}`); }
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: true }));
  } catch {
    res.statusCode = 500;
    return res.end('Email failed');
  }
}
