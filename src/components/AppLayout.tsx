import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import SystemOverlays from './SystemOverlays';
import { AccountBar, SearchBar } from './TopBar';
import Icon from './Icon';
import { LogoMark, Wordmark } from './Logo';
import BackButton from './BackButton';

export default function AppLayout({ children, bare }: { children: ReactNode; bare?: boolean }) {
  const [mob, setMob] = useState(false);
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar mobileOpen={mob} onClose={() => setMob(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <SystemOverlays />
        <div className="nav:hidden sticky top-0 z-30 flex items-center gap-2.5 px-3.5 py-2.5 bg-black text-white">
          <button onClick={() => setMob(true)} aria-label="Open menu" className="w-10 h-10 rounded-xl bg-white/[0.12] flex items-center justify-center">
            <Icon name="menu" />
          </button>
          <LogoMark size={36} />
          <Wordmark dark className="text-[17px]" />
        </div>
        <main className={bare ? 'flex-1 min-w-0' : 'flex-1 min-w-0 px-4 sm:px-8 pt-7 pb-12 flex flex-col gap-6'}>
          {!bare && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="xl:flex-1 flex items-center"><BackButton /></div>
              <div className="flex-[0_1_520px] min-w-[260px] w-full sm:w-auto">
                <SearchBar />
              </div>
              <div className="flex-1 flex justify-end">
                <AccountBar />
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
