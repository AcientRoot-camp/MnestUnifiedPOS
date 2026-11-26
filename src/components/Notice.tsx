// One modal pop-up for every completed action, success, warning and error in MNest UnifiedPOS.
import { useEffect, useRef } from 'react';

export type NoticeKind = 'success' | 'warn' | 'error';

/** Works out the kind from the wording, so existing messages need no changes. */
export function kindOf(text: string): NoticeKind {
  const t = text.replace(/^[✓⚠✗×!\s]+/, '');
  if (/^\d{3}\b|unauthori[sz]ed|wrong|failed|could not|couldn’t|cannot|can’t|not allowed|denied|forbidden|rejected|declined|blocked|locked out|error/i.test(t)) return 'error';
  if (/^(choose|enter|add |type |pick |give |fill|select|tick|check |please|make sure|confirm)|\bfirst\b|over your limit|over the limit|needs? (approval|the)|must |nobody|has not agreed|no .*(consent|email|phone)|only \d|already|not .*yet|skipped|waiting|pending|sent to approvals|request sent/i.test(t)) return 'warn';
  return 'success';
}

const LOOK: Record<NoticeKind, { title: string; bg: string; fg: string; icon: JSX.Element }> = {
  success: { title: 'Done', bg: '#e7f4e8', fg: '#1f7a2a', icon: <path d="M20 6 9 17l-5-5" /> },
  warn: { title: 'Please note', bg: '#fff8e1', fg: '#b26a00', icon: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></> },
  error: { title: 'Not completed', bg: '#fbeaea', fg: '#c62828', icon: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></> },
};

/** Centered modal with an OK button. Enter, Escape or a click outside closes it. */
export default function NoticeModal({ msg, onClose, kind, title }: { msg: string; onClose: () => void; kind?: NoticeKind; title?: string }) {
  const ok = useRef<HTMLButtonElement>(null);
  const last = useRef<Element | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!msg) return;
    last.current = document.activeElement;
    const f = setTimeout(() => ok.current?.focus(), 30);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', key, true);
    return () => { clearTimeout(f); window.removeEventListener('keydown', key, true); (last.current as HTMLElement | null)?.focus?.(); };
  }, [msg]);
  if (!msg) return null;
  const text = msg.replace(/^[✓✔]\s*/, '');
  const k = kind ?? kindOf(text);
  const L = LOOK[k];
  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4 no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role={k === 'error' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="ntc-t" aria-describedby="ntc-m" className="w-full max-w-sm bg-white rounded-[28px] p-6 flex flex-col items-center text-center gap-3 shadow-2xl">
        <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: L.bg, color: L.fg }} aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{L.icon}</svg>
        </span>
        <h2 id="ntc-t" className="m-0 text-lg font-semibold">{title ?? L.title}</h2>
        <p id="ntc-m" className="m-0 text-sm text-[#3d3a38] leading-relaxed whitespace-pre-line">{text}</p>
        <button ref={ok} onClick={onClose} className="mt-1 min-h-11 w-full rounded-full text-white text-sm font-semibold" style={{ background: k === 'error' ? '#c62828' : '#0b5c5c' }}>OK</button>
      </div>
    </div>
  );
}
