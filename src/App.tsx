// Unified POS portal routes (everything under /pos on a hosted site).
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { TILL, markStaffStore, storeUrl } from './lib/site';
import Guard from './components/Guard';
import AppLayout from './components/AppLayout';
import { useSession } from './lib/session';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Rider from './pages/Rider';
import SystemOverlays from './components/SystemOverlays';
import { PosInstall } from './components/InstallPrompt';
import { NoSignInWatch } from './pages/team/TimeClock';
import ModulePage from './pages/ModulePage';
import { SCREENS } from './data/screens';
import HirePurchase from './pages/hp/HirePurchase';
import Finance from './pages/finance/Finance';
import MySales from './pages/sell/MySales';
import DocsPage from './pages/sell/docs/DocsPage';
import Customers from './pages/sell/Customers';
import Collect from './pages/sell/Collect';
import SalesReturns from './pages/sell/SalesReturns';
import Orders from './pages/sell/Orders';
import Products from './pages/catalogue/Products';
import Categories from './pages/catalogue/Categories';
import Inventory from './pages/catalogue/Inventory';
import Warehouse from './pages/catalogue/Warehouse';
import Damages from './pages/catalogue/Damages';
import Payments from './pages/money/Payments';
import Tax from './pages/money/Tax';
import Contracts from './pages/money/Contracts';
import Reports from './pages/reports/Reports';
import Suppliers from './pages/ops/Suppliers';
import Expenses from './pages/ops/Expenses';
import WebContent from './pages/ops/WebContent';
import Staff from './pages/team/Staff';
import Payroll from './pages/team/Payroll';
import Marketing from './pages/team/Marketing';
import Messages from './pages/team/Messages';
import Hospitality from './pages/team/Hospitality';
import Branches from './pages/admin/Branches';
import Tickets from './pages/admin/Tickets';
import Approvals from './pages/admin/Approvals';
import Users from './pages/admin/Users';
import Audit from './pages/admin/Audit';
import Documents from './pages/admin/Documents';
import Backup from './pages/admin/Backup';
import Settings from './pages/admin/Settings';
import Security from './pages/admin/Security';
import Developer from './pages/admin/Developer';
import CRM from './pages/crm/CRM';
import type { ReactElement } from 'react';

// Screens with a bespoke page; the rest use the shared ModulePage until ported.
const PAGES: Record<string, ReactElement> = {
  hirepurchase: <HirePurchase />,
  mysales: <MySales />,
  proforma: <DocsPage key="pf" mode="pf" />,
  invoices: <DocsPage key="inv" mode="inv" />,
  customers: <Customers />,
  collect: <Collect />,
  orders: <Orders />,
  products: <Products />,
  categories: <Categories />,
  warehouse: <Warehouse />,
  damages: <Damages />,
  payments: <Payments />,
  tax: <Tax />,
  contracts: <Contracts />,
  staff: <Staff />,
  payroll: <Payroll />,
  marketing: <Marketing />,
  messages: <Messages />,
  hospitality: <Hospitality />,
  tickets: <Tickets />,
  approvals: <Approvals />,
  users: <Users />,
  audit: <Audit />,
  documents: <Documents />,
  settings: <Settings />,
  security: <Security />,
};
// Pages that read a sub-tab from the URL.
const TABBED: Record<string, ReactElement> = { crm: <CRM />, reports: <Reports />, suppliers: <Suppliers />, expenses: <Expenses />, web: <WebContent />, branches: <Branches />, developer: <Developer />, backup: <Backup />, sales: <SalesReturns />, inventory: <Inventory /> };
const BESPOKE = ['finance', ...Object.keys(PAGES), ...Object.keys(TABBED)];

/**
 * "Online store" from inside the POS (side menu, dashboard, settings, Post to online all link to /pos/shop).
 * Marks this tab as staff-opened, so the store shows "Staff: open back office", then loads the store in the
 * same tab. location.replace keeps /pos/shop out of the history, so Back from the store returns to the POS page.
 */
function OpenStore() {
  useEffect(() => { markStaffStore(); window.location.replace(storeUrl()); }, []);
  return <p className="p-6 text-sm text-muted" role="status">Opening the online store…</p>;
}

/** Sends an old till address (portal path "/pos" or "/pos/<tab>") to the same tab at the till's new path. */
function TillRedirect() {
  const rest = useParams()['*'];
  return <Navigate to={rest ? `${TILL}/${rest}` : TILL} replace />;
}
const GENERIC = Object.keys(SCREENS).filter((k) => !BESPOKE.includes(k));

/**
 * The Unified POS portal router. main.tsx mounts it with the "/pos" basename, so every path below is relative
 * to /pos (e.g. "/sell" is www.example.com/pos/sell). The online store is a separate router (StoreSite.tsx).
 * Signed out → the sign-in page at any portal address. Riders → their app only. Everyone else → the full portal.
 */
export default function App() {
  const { session } = useSession();
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  if (session.role === 'rider')
    return (
      <Routes>
        <Route path="/rider" element={<><SystemOverlays /><Rider /></>} />
        <Route path="*" element={<Navigate to="/rider" replace />} />
      </Routes>
    );
  return (
    <>
    {/* "Install the POS" pop-up for signed-in branch staff; asks for their 6-digit passcode first (components/InstallPrompt.tsx). */}
    <PosInstall />
    {/* "Nobody signed in by 09:00" alert to the Admin and managers (HR time clock). */}
    <NoSignInWatch />
    <Routes>
      {session.role === 'developer' && <Route path="/" element={<Navigate to="/developer" replace />} />}
      {/* Till (Sell Now). Lives at /pos/sell because /pos itself is the portal. The Guard key stays "pos". */}
      <Route path={TILL} element={<><SystemOverlays /><Guard k="pos" fullscreen><POS /></Guard></>} />
      <Route path={`${TILL}/credit`} element={<><SystemOverlays /><POS /></>} />
      <Route path={`${TILL}/:tab`} element={<><SystemOverlays /><Guard k="pos" fullscreen><POS /></Guard></>} />
      {/* Old till addresses (/pos/pos, /pos/pos/credit …) from bookmarks open the till at its new address. */}
      <Route path="/pos/*" element={<TillRedirect />} />
      <Route path="/rider" element={<><SystemOverlays /><Rider /></>} />
      <Route path="/shop" element={<OpenStore />} />
      <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
      {Object.entries(PAGES).map(([k, el]) => (
        <Route key={k} path={`/${k}`} element={<AppLayout><Guard k={k}>{el}</Guard></AppLayout>} />
      ))}
      {Object.entries(TABBED).flatMap(([k, el]) => [
        <Route key={k} path={`/${k}`} element={<AppLayout><Guard k={k}>{el}</Guard></AppLayout>} />,
        <Route key={k + '-t'} path={`/${k}/:tab`} element={<AppLayout><Guard k={k}>{el}</Guard></AppLayout>} />,
      ])}
      <Route path="/developer/:tab/:sub" element={<AppLayout><Developer /></AppLayout>} />
      <Route path="/finance" element={<AppLayout><Finance /></AppLayout>} />
      <Route path="/finance/:tab" element={<AppLayout><Finance /></AppLayout>} />
      {GENERIC.map((k) => (
        <Route key={k} path={`/${k}`} element={<AppLayout><ModulePage screen={k} /></AppLayout>} />
      ))}
      {GENERIC.map((k) => (
        <Route key={k + '-tab'} path={`/${k}/:tab`} element={<AppLayout><ModulePage screen={k} /></AppLayout>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
