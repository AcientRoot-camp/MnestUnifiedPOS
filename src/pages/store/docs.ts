// Online store documents: builds the Order Confirmation / receipt / invoice PDFs with the store's own name,
// contact details and logo (from Post to online settings), and emails the Order Confirmation once per order.
// Each document has its own design: the Order Confirmation keeps the standard layout (lib/pdf.ts); the receipt is the
// "Midnight & Gold" digital receipt and the invoice the "Burgundy & Ink" A4 tax invoice (lib/pdfStyles.ts).
import type { Web } from '../../data/web';
import { companyLogo } from '../../lib/brand';
import { shopDocData, shopOrderDoc, type Biz } from '../../lib/docPdfs';
import { renderInvoice, renderReceipt } from '../../lib/pdfStyles';
import { storeUrl } from '../../lib/site';
import { bizInfo } from '../pos/Docs';
import { emailOrderConfirmation, type EmailResult } from '../../lib/email';
import { downloadBlob, renderPdf } from '../../lib/pdf';
import { bizName } from './Shell';
import { brInfo, money, type ShopOrder } from './model';

/** The store's business block for documents: name, phone · email, website, logo. */
export const shopBiz = (W: Web): Biz => ({
  name: bizName(W),
  lines: [[W.site.phone, W.site.email].filter(Boolean).join(' · '), W.seo.domain].filter(Boolean) as string[],
  logo: W.site.logo || companyLogo(),
});

export type ShopDocKind = 'confirmation' | 'receipt' | 'invoice';
const fileName = (o: ShopOrder, kind: ShopDocKind) => `${kind === 'confirmation' ? 'order-confirmation' : kind}-${o.no}.pdf`;

/**
 * Build one of the store documents as a PDF Blob. The invoice also prints the company's TIN (company details used on
 * till invoices); the receipt's QR code opens the order page on the store.
 */
export function shopOrderPdf(o: ShopOrder, W: Web, kind: ShopDocKind): Promise<Blob> {
  if (kind === 'confirmation') return renderPdf(shopOrderDoc(o, shopBiz(W), brInfo(o.brId), kind));
  const data = shopDocData(o, { ...shopBiz(W), tin: bizInfo().tin }, brInfo(o.brId), kind, storeUrl(`done/${o.no}`));
  return kind === 'invoice' ? renderInvoice(data) : renderReceipt(data);
}

/** Download one of the store documents as a PDF file. */
export async function downloadShopDoc(o: ShopOrder, W: Web, kind: ShopDocKind) {
  downloadBlob(await shopOrderPdf(o, W, kind), fileName(o, kind));
}

// Orders being emailed right now, so a double render (React StrictMode, quick re-visits) never sends twice.
const sending = new Set<string>();

/**
 * Email the Order Confirmation PDF to the customer, once per order.
 * Returns the result, or null when there is nothing to do (no email, already sent, or already in progress).
 */
export async function emailConfirmationOnce(o: ShopOrder, W: Web): Promise<EmailResult | null> {
  if (!o.email || o.emailed === 'sent' || sending.has(o.no)) return null;
  sending.add(o.no);
  try {
    const pdf = await shopOrderPdf(o, W, 'confirmation');
    return await emailOrderConfirmation({ to: o.email, name: o.name, orderNo: o.no, business: bizName(W), total: money(o.total), pdf });
  } finally { sending.delete(o.no); }
}
