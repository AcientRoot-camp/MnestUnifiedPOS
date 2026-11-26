import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AccountPage, AuthModal, Modals } from './store/Account';
import { Checkout, Done } from './store/Checkout';
import { ShopProvider, useShop } from './store/ctx';
import Home from './store/Home';
import { About, Branches, Careers, Contact, CustomPage, Faqs, JobPage, Reviews, Updates } from './store/Pages';
import { Basket, Notify, ProductPage, QuickView } from './store/Product';
import { Footer, Header, Overlays, PromoBar, Skeleton, TopStrip, bizName, pageOn } from './store/Shell';
import { SeasonCelebration } from '../components/Seasonal';

/** A page the store owner hid in Post to online opens Home instead. */
function On({ k, children }: { k: string; children: ReactNode }) {
  const { W } = useShop();
  return pageOn(W, k) ? <>{children}</> : <Navigate to="/" replace />;
}

function Store() {
  const { W } = useShop();
  const loc = useLocation();
  const [boot, setBoot] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setBoot(false), 2000); return () => window.clearTimeout(t); }, []);
  // Browser tab / window header for the online store: just the business name (e.g. "Ebenezer Unique Ventures").
  useEffect(() => { document.title = bizName(W); return () => { document.title = 'MNest UnifiedPOS'; }; }, [W]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="min-h-screen bg-white text-black font-[Inter,system-ui,sans-serif]" style={{ ['--gut' as string]: 'clamp(1rem, 6vw, 7rem)' }}>
      {boot && <Skeleton />}
      <TopStrip />
      <PromoBar />
      <Header />
      {/* Page content always fills at least one screen, so the footer stays below the fold and never jumps up
          when a short page (Reviews, a policy, an empty search) opens or when a page changes size while loading. */}
      <div className="min-h-[100svh]">
      <Routes>
        <Route index element={<Home />} />
        <Route path="about" element={<On k="about"><About /></On>} />
        <Route path="branches" element={<On k="branches"><Branches /></On>} />
        <Route path="contact" element={<On k="contact"><Contact /></On>} />
        <Route path="updates" element={<On k="updates"><Updates /></On>} />
        <Route path="reviews" element={<On k="reviews"><Reviews /></On>} />
        <Route path="faqs" element={<On k="faqs"><Faqs /></On>} />
        <Route path="careers" element={<On k="careers"><Careers /></On>} />
        <Route path="careers/:id" element={<On k="careers"><JobPage /></On>} />
        <Route path="pages/:slug" element={<CustomPage />} />
        <Route path="p/:id" element={<ProductPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="done/:no" element={<Done />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="account/:tab" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      <Footer />
      <Basket />
      <QuickView />
      <Notify />
      <AuthModal />
      <Modals />
      <Overlays />
      {/* 25 December: Merry Christmas · 26 December: Happy Boxing Day (components/Seasonal.tsx; once a day per device). */}
      <SeasonCelebration where="store" biz={bizName(W)} />
    </div>
  );
}

export default function Shop() {
  return <ShopProvider><Store /></ShopProvider>;
}
