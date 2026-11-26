// Sends the Order Confirmation PDF to the customer's email through the /api/send-email serverless function.
// Every attempt is also logged in this browser (ecompos.emailOutbox) so staff can see what was sent or failed.
import { blobToBase64 } from './pdf';
import { readKey, writeKey } from './persist';

/** Outcome of an email attempt: sent by the email service, or failed (not configured, offline, rejected). */
export type EmailResult = 'sent' | 'failed';

/**
 * Email an Order Confirmation.
 * Inputs: to → customer email; name → customer name; orderNo; business → store name; total → formatted total;
 *         pdf → the Order Confirmation PDF. Output: 'sent' only when the email service accepted it.
 */
export async function emailOrderConfirmation(p: { to: string; name: string; orderNo: string; business: string; total: string; pdf: Blob }): Promise<EmailResult> {
  let result: EmailResult = 'failed';
  try {
    const r = await fetch((import.meta.env.VITE_EMAIL_API as string | undefined) || '/api/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: p.to, name: p.name, orderNo: p.orderNo, business: p.business, total: p.total, pdf: await blobToBase64(p.pdf) }),
    });
    result = r.ok ? 'sent' : 'failed';
  } catch { result = 'failed'; }
  writeKey('ecompos.emailOutbox', [{ at: Date.now(), to: p.to, orderNo: p.orderNo, kind: 'Order Confirmation', result }, ...readKey<unknown[]>('ecompos.emailOutbox', [])].slice(0, 200));
  return result;
}
