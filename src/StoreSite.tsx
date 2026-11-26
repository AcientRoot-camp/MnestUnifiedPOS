// Router for the public side of the site: the online store served from the domain root
// (e.g. www.mnestsystems.com). The Unified POS portal lives under /pos and is loaded by main.tsx instead.
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Shop from './pages/Shop';

/**
 * Old store links used a /shop prefix (e.g. /shop/p/123 in shared WhatsApp messages or QR codes).
 * Sends them to the same page at its new root address, keeping any query string or #hash.
 */
function LegacyShopRedirect() {
  const loc = useLocation();
  const to = loc.pathname.replace(/^\/shop/i, '') || '/';
  return <Navigate to={{ pathname: to, search: loc.search, hash: loc.hash }} replace />;
}

/** Store routes: the legacy /shop redirect, then every other path handled by the store itself. */
export default function StoreSite() {
  return (
    <Routes>
      <Route path="/shop/*" element={<LegacyShopRedirect />} />
      <Route path="/*" element={<Shop />} />
    </Routes>
  );
}
