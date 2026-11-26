// Site layout for a hosted MNest UnifiedPOS deployment (e.g. www.mnestsystems.com):
//   /            → the online store (public front page of the system)
//   /pos/...     → the Unified POS portal (staff sign-in, dashboard, till, every back-office module)
// The two halves are separate React Router trees, so moving between them is a full page load.

/** URL prefix of the Unified POS portal. The portal's router uses it as its basename. */
export const PORTAL_BASE = '/pos';

/** Till path inside the portal (full URL: /pos/sell). It cannot be "/pos" because that is the portal itself. */
export const TILL = '/sell';

/**
 * True when a browser path belongs to the portal: "/pos" or anything under "/pos/". Case does not matter,
 * so /POS, /Pos and /pOs/products all open the portal (main.tsx then rewrites the prefix to lower case).
 */
export const isPortalPath = (pathname: string) => { const p = pathname.toLowerCase(); return p === PORTAL_BASE || p.startsWith(PORTAL_BASE + '/'); };

/* ---------- "Staff: open back office" on the online store ----------
 * The link back to the POS is only for staff who opened the store from inside the POS. Clicking "Online store"
 * in the POS marks this browser tab (sessionStorage: per tab, gone when the tab closes); the store shows the
 * link only while that mark is present AND someone is signed in. Customers who open the website directly never
 * get the mark, so they never see the link. */
const STAFF_STORE_KEY = 'ecompos.staffStore';

/** Mark this tab as "staff browsing the store from the POS". Called just before leaving the POS for the store. */
export const markStaffStore = () => { try { sessionStorage.setItem(STAFF_STORE_KEY, '1'); } catch { /* storage blocked: link simply not shown */ } };
/** Whether this tab was opened on the store from the POS. */
export const isStaffStore = () => { try { return sessionStorage.getItem(STAFF_STORE_KEY) === '1'; } catch { return false; } };
/** Remove the mark, e.g. when staff go back to the POS with "Staff: open back office". */
export const clearStaffStore = () => { try { sessionStorage.removeItem(STAFF_STORE_KEY); } catch { /* ignore */ } };

/**
 * Absolute address of an online store page, for links that leave the portal or are shared outside the app.
 * Input: path → store path without a leading slash (e.g. "p/123"); empty for the store home page.
 * Output: e.g. "https://www.mnestsystems.com/p/123".
 */
export const storeUrl = (path = '') => `${window.location.origin}/${path.replace(/^\/+/, '')}`;

/** Address of the portal's front door (sign-in page when signed out), used for full-page redirects such as sign-out. */
export const portalUrl = () => `${window.location.origin}${PORTAL_BASE}`;
