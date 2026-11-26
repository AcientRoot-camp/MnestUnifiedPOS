// Talking to the server endpoints in /api (productscan.md §2.1, HRSign.md): the company-wide barcode register (unique
// barcodes, shop-code numbers from one sequence) and time-clock sign-ins for the 09:00 server check. Every call has a
// short time limit; when the server is not set up (503) or the device is offline, the tills carry on with the checks
// they already make on the device, so selling and adding products never stop.

/** POST JSON with a time limit. Output: { status, data } or null when the server could not be reached. */
async function post(path: string, body: unknown, ms = 4000): Promise<{ status: number; data: Record<string, unknown> } | null> {
  if (typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Claim barcodes for a product on the server, so no other till can give them to another product.
 * Output: '' when they are free (or the server is not set up / unreachable), else the 409 message to show.
 */
export async function claimCodes(pid: string, name: string, codes: string[]): Promise<string> {
  if (!codes.length) return '';
  const r = await post('/api/barcodes', { op: 'claim', pid, name, codes });
  if (r?.status === 409) return `409 Conflict · Already exists or clashes: barcode. ${String(r.data.code || '')} is used by ${String(r.data.owner || 'another product')} on another till.`;
  return '';
}

/** The next shop barcode ("200…") from the server's sequence, or '' when the server is not set up or unreachable. */
export async function serverShopCode(): Promise<string> {
  const r = await post('/api/barcodes', { op: 'shop' });
  const c = r?.status === 200 ? String(r.data.code || '') : '';
  return /^200\d{10}$/.test(c) ? c : '';
}

/** Tell the server about a time-clock sign-in or sign-out (fire and forget; failures are ignored). */
export function pushPunch(br: string, name: string, kind: 'in' | 'out', at = Date.now()) {
  void post('/api/clock', { br, name, kind, at }, 3000);
}
