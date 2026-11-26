// App entry point. Decides, from the address typed in the browser, which half of the system to load:
// the online store at the domain root, or the Unified POS portal under /pos (see lib/site.ts).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './lib/session';
import App from './App';
import StoreSite from './StoreSite';
import './index.css';
import { migrateOldLogo } from './lib/brand';
import { isPortalPath, PORTAL_BASE } from './lib/site';
import { ensureCrmSeed } from './pages/crm/model';
import { startStoreSync } from './pages/crm/web';
import { initPwa } from './lib/pwa';
import { migrateProducts } from './lib/barcode';
import { migrateCatalogue } from './lib/catalogMigrate';
import { migrateAdminName, migrateAdminUsername } from './lib/sec';

migrateOldLogo();
// The demo shop now sells electronics: switch saved grocery products and their demo records over (once per device).
migrateCatalogue();
// Products saved before per-product carton sizes and weighed goods: give them their real sizes (once per device).
migrateProducts();
// The Admin's username is now "admin" (was "kofi"): move settings saved under the old one (once per device).
migrateAdminUsername();
// The Admin's name is now "Ebenezer Mensah" (was "Kofi Adom"): records saved under the old name follow (once per device).
migrateAdminName();
ensureCrmSeed();
startStoreSync();

// Chosen once per page load. The portal router gets "/pos" as its basename, so its internal links
// ("/", "/products", "/sell" …) resolve to /pos, /pos/products, /pos/sell without any change to those links.
const portal = isPortalPath(window.location.pathname);
// /POS or /Pos also opens the portal: rewrite the typed prefix to "/pos" before the router starts, so the address
// bar, the router's basename and every link the portal builds all agree.
if (portal && !window.location.pathname.startsWith(PORTAL_BASE)) {
  const { pathname, search, hash } = window.location;
  window.history.replaceState(window.history.state, '', PORTAL_BASE + pathname.slice(PORTAL_BASE.length) + search + hash);
}

// Installable app: the POS manifest under /pos, the store manifest everywhere else (lib/pwa.ts).
initPwa(portal ? 'pos' : 'store');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={portal ? PORTAL_BASE : undefined}>
      <SessionProvider>
        {portal ? <App /> : <StoreSite />}
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
