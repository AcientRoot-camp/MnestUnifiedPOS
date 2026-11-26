// Company branding helpers: which logo files represent the tenant company (Ebenezer Unique Ventures) on screens,
// receipts, invoices, reports and the online store, plus a one-time migration of saved data to the current logo.
import { readKey, usePersist } from './persist';

/**
 * The company's own logo (not the MNest UnifiedPOS product logo). Ebenezer Unique Ventures uses the MNEST Systems
 * logo, the same artwork tiled in the sign-in page background.
 * COMPANY_LOGO → full logo ("m" mark + "MNEST Systems" text) for documents and larger spots.
 * COMPANY_ICON → the "m" mark alone, for small square spots where the text would be unreadable.
 * An uploaded logo (Settings) still replaces both.
 */
export const COMPANY_LOGO = '/assets/mnest-logo-tight.svg';
export const COMPANY_ICON = '/assets/mnest-icon.svg';
/**
 * "Powered by" credit in the online store footer: the MNEST Systems wordmark (big "mNEST" with "Systems" under it).
 * Put the image at public/assets/mnest-powered-by.png (transparent background). Until that file exists, the footer
 * falls back to COMPANY_LOGO, so it never shows a broken image.
 */
export const POWERED_BY_LOGO = '/assets/mnest-powered-by.png';
export const LOGO_KEY = 'ecompos.logo';

/** Live company logo: re-renders everywhere the moment the Admin uploads a new one. icon → the square mark. */
export function useCompanyLogo(icon = false) {
  const [logo] = usePersist<string>(LOGO_KEY, '');
  return logo || (icon ? COMPANY_ICON : COMPANY_LOGO);
}
/** Non-hook version of useCompanyLogo, for code outside React components. */
export const companyLogo = (icon = false) => readKey<string>(LOGO_KEY, '') || (icon ? COMPANY_ICON : COMPANY_LOGO);

/** Bump when the default logo changes, so the migration below runs again once per browser. */
const LOGO_VERSION = '3';

/**
 * One-time clean-up so every screen shows the MNEST Systems logo:
 * - saved data pointing at older logo files (ebenezer-*, company-logo.png, company-icon.png) now points at the new ones;
 * - a previously uploaded company logo and the online store's own logo override are cleared, because the business
 *   asked for the MNEST Systems logo everywhere. The Admin can still upload a different logo afterwards.
 */
export function migrateOldLogo() {
  try {
    if (localStorage.getItem('ecompos.logoMigrated') === LOGO_VERSION) return;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('ecompos.')) continue;
      const v = localStorage.getItem(k);
      if (!v || !/\/assets\/(ebenezer-|company-(icon|logo)\.png)/.test(v)) continue;
      localStorage.setItem(k, v
        .replace(/\/assets\/ebenezer-icon\.(png|jpg)/g, COMPANY_ICON).replace(/\/assets\/ebenezer-logo\.(svg|png)/g, COMPANY_LOGO)
        .replace(/\/assets\/company-icon\.png/g, COMPANY_ICON).replace(/\/assets\/company-logo\.png/g, COMPANY_LOGO));
    }
    localStorage.removeItem(LOGO_KEY);
    const web = readKey<{ site?: { logo?: string } } | null>('ecompos.web2', null);
    if (web?.site?.logo) localStorage.setItem('ecompos.web2', JSON.stringify({ ...web, site: { ...web.site, logo: '' } }));
    localStorage.setItem('ecompos.logoMigrated', LOGO_VERSION);
  } catch {
    /* storage blocked */
  }
}
