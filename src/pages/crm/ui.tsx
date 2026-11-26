// Shared CRM pieces. Same header, cards, chips, pills and drawers as the rest of MNest UnifiedPOS.
import { useEffect, type ReactNode } from 'react';
import NoticeModal from '../../components/Notice';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx } from '../../lib/format';
import { CUSTOMERS, type Customer } from '../../data/sell';
import { K, SETTINGS0, ctxOf, ensureCrmSeed, type CrmRequest, type Deal, type Feedback, type Journey, type Lead, type Note, type Segment, type Settings, type Task } from './model';

/** Role context + every CRM list, live across tabs. */
export function useCrm() {
  ensureCrmSeed();
  const { session, viewBranch } = useSession();
  const role = session?.role ?? 'staff';
  const me = session?.name || PEOPLE[role as 'staff']?.name || 'Akua Kyei';
  const c = ctxOf(role, me, session?.branch && session.branch !== 'all' ? session.branch : 'osu');
  const [leads, setLeads] = usePersist<Lead[]>(K.leads, []);
  const [deals, setDeals] = usePersist<Deal[]>(K.deals, []);
  const [tasks, setTasks] = usePersist<Task[]>(K.tasks, []);
  const [notes, setNotes] = usePersist<Note[]>(K.notes, []);
  const [segments, setSegments] = usePersist<Segment[]>(K.segments, []);
  const [journeys, setJourneys] = usePersist<Journey[]>(K.journeys, []);
  const [feedback, setFeedback] = usePersist<Feedback[]>(K.feedback, []);
  const [requests, setRequests] = usePersist<CrmRequest[]>(K.requests, []);
  const [settings, setSettings] = usePersist<Settings>(K.settings, SETTINGS0);
  const [custs, setCusts] = usePersist<Customer[]>(K.customers, CUSTOMERS);
  return { c, vb: c.role === 'superuser' ? viewBranch : c.br, leads, setLeads, deals, setDeals, tasks, setTasks, notes, setNotes, segments, setSegments, journeys, setJourneys, feedback, setFeedback, requests, setRequests, settings, setSettings, custs, setCusts };
}
export type Crm = ReturnType<typeof useCrm>;

export const btnP = 'inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-[9px] rounded-full bg-brand text-white text-sm font-semibold whitespace-nowrap disabled:opacity-40';
export const btnS = 'inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-[9px] rounded-full bg-white border border-brand text-brand text-sm font-semibold whitespace-nowrap disabled:opacity-40';
export const btnG = 'inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-[9px] rounded-full bg-white border border-line text-sm whitespace-nowrap hover:border-black disabled:opacity-40';
export const inp = 'w-full h-11 px-4 rounded-full border border-line text-sm bg-white';

export function Head({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-1 min-w-0"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{title}</h1><p className="m-0 text-sm text-muted">{sub}</p></div>
      {actions && <div className="flex gap-2 flex-wrap items-center">{actions}</div>}
    </header>
  );
}
export function Tile({ l, v, n, tone, onClick }: { l: string; v: ReactNode; n?: string; tone?: 'ok' | 'warn' | 'bad'; onClick?: () => void }) {
  const El = onClick ? 'button' : 'div';
  return (
    <El onClick={onClick} className={cx('bg-white rounded-3xl shadow-card p-4 flex flex-col gap-0.5 min-w-0 text-left', onClick && 'hover:ring-2 hover:ring-brand')}>
      <span className="text-xs text-muted">{l}</span>
      <strong className="text-2xl font-semibold tracking-tight" style={{ color: tone === 'bad' ? '#c62828' : tone === 'warn' ? '#b26a00' : tone === 'ok' ? '#1f7a2a' : undefined }}>{v}</strong>
      {n && <span className="text-xs text-muted">{n}</span>}
    </El>
  );
}
const TONES = { ok: ['#e7f4e8', '#1f7a2a'], warn: ['#fff8e1', '#b26a00'], bad: ['#fbeaea', '#c62828'], info: ['#e3f2fd', '#0b4f8a'], teal: ['#eef6f6', '#0b5c5c'], mute: ['#f2f4f5', '#3d3a38'], dark: ['#000', '#fff'] } as const;
export function Pill({ t, tone = 'mute' }: { t: ReactNode; tone?: keyof typeof TONES }) {
  return <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: TONES[tone][0], color: TONES[tone][1] }}>{t}</span>;
}
export const TIER: Record<string, [string, string]> = { Gold: ['#fff3cd', '#8a6400'], Silver: ['#eceff1', '#455a64'], Bronze: ['#f6e3d4', '#8a4b1f'] };
export const TierPill = ({ tier }: { tier: string }) => <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: TIER[tier]?.[0], color: TIER[tier]?.[1] }}>{tier}</span>;

/** Restricted action: lock note + Request (Manager/Supervisor). Sales staff never see these (hidden by the caller). */
export function Lock({ text, req, onRequest }: { text: string; req?: string; onRequest?: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm px-4 py-2.5 rounded-2xl" style={{ background: '#fff8e1', color: '#7a4a00' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      <span className="flex-1 min-w-[180px]">{text}</span>
      {onRequest && <button onClick={onRequest} className="h-9 px-3.5 rounded-full bg-white border border-[#b26a00] text-[13px] font-semibold">{req || 'Request from Admin'}</button>}
    </div>
  );
}
export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="rounded-3xl border-2 border-dashed border-line p-8 text-center flex flex-col items-center gap-3 text-sm text-muted"><span>{text}</span>{action}</div>;
}
export function Drawer({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[450] bg-black/40 flex justify-end" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-[520px] h-full overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex justify-between gap-3 items-start"><div className="min-w-0"><h2 className="m-0 text-xl font-semibold">{title}</h2>{sub && <span className="text-sm text-muted">{sub}</span>}</div><button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full text-white text-lg flex-none" style={{ background: '#c62828' }}>×</button></div>
        {children}
      </aside>
    </div>
  );
}
export function Toastish({ msg, onClose }: { msg: string; onClose: () => void }) {
  return <NoticeModal msg={msg} onClose={onClose} />;
}
export function Chips<T extends string>({ opts, value, onChange, label }: { opts: [T, string][]; value: T; onChange: (v: T) => void; label?: string }) {
  return <div role="group" aria-label={label} className="flex gap-1.5 flex-wrap">{opts.map(([k, l]) => <button key={k} aria-pressed={value === k} onClick={() => onChange(k)} className={cx('min-h-9 px-3.5 rounded-full border text-[13px]', value === k ? 'bg-black text-white border-black font-semibold' : 'bg-white border-[#d9d9d9]')}>{l}</button>)}</div>;
}
/** Bars for small charts (no new colours). */
export function Bars({ rows, money }: { rows: [string, number, string?][]; money?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return <div className="flex flex-col gap-2">{rows.map(([l, v, note]) => <div key={l} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 truncate">{l}</span><span className="flex-1 h-2.5 rounded-full bg-[#f2f4f5] overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: '#0b5c5c' }} /></span><b className="w-28 text-right">{money ? money(v) : v}</b>{note && <span className="text-xs text-muted w-24 truncate">{note}</span>}</div>)}</div>;
}
export const ICON = {
  phone: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.5 8.5 0 1 1 21 11.5Z" /></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>,
  clock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
};
