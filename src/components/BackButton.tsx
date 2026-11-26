// Back button beside the search bar. Hidden on the home screen; goes to the previous screen, or one level up.
import { useLocation, useNavigate } from 'react-router-dom';

export default function BackButton() {
  const loc = useLocation();
  const nav = useNavigate();
  if (loc.pathname === '/' || loc.pathname === '') return null;
  const up = '/' + loc.pathname.split('/').filter(Boolean).slice(0, -1).join('/');
  const go = () => { const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0; if (idx > 0) nav(-1); else nav(up); };
  return (
    <button onClick={go} aria-label="Go back" title="Back" className="group inline-flex items-center gap-2 h-12 pl-3 pr-4 rounded-full border border-line bg-white text-sm font-semibold shadow-[rgba(0,0,0,0.06)_0_2px_8px] hover:border-brand hover:text-brand focus-visible:border-brand transition-colors">
      <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center group-hover:bg-brand transition-colors" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </span>
      Back
    </button>
  );
}
