import { createContext, useContext, type ReactNode } from 'react';
import { cx } from '../../../lib/format';
import type { useDevData } from './data';

export type Ask = { title: string; body: string; cta: string; danger?: boolean; icon?: string; act: () => void; ok?: boolean };
export type DevCtx = { d: ReturnType<typeof useDevData>; act: (what: string, area?: string, issue?: string) => void; say: (m: string) => void; ask: (a: Ask) => void; locked: boolean };
export const Ctx = createContext<DevCtx | null>(null);
export const useDev = () => useContext(Ctx)!;

export function Sec({ title, sub, actions, children, className, id }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className={cx('bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3 min-w-0', className)}>
      {(title || actions) && <div className="flex items-start justify-between gap-3 flex-wrap"><div className="flex flex-col gap-0.5 min-w-0">{title && <h2 id={id} className="m-0 text-lg font-semibold">{title}</h2>}{sub && <span className="text-sm text-muted">{sub}</span>}</div>{actions && <div className="flex gap-2 flex-wrap">{actions}</div>}</div>}
      {children}
    </section>
  );
}
export const btn = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap disabled:opacity-40';
export const B = { primary: cx(btn, 'bg-brand text-white'), dark: cx(btn, 'bg-black text-white'), ghost: cx(btn, 'border border-line bg-white hover:border-black'), danger: cx(btn, 'border border-danger text-danger bg-white'), sm: 'inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold border border-line bg-white hover:border-black whitespace-nowrap' };
export const inp = 'w-full h-10 px-4 rounded-full border border-line text-sm bg-white';
export const ta = 'w-full p-3 rounded-2xl border border-line text-sm';
export function F({ l, children, note }: { l: string; children: ReactNode; note?: string }) {
  return <label className="flex flex-col gap-1 text-[13px] font-semibold min-w-0">{l}{children}{note && <span className="text-xs font-normal text-muted">{note}</span>}</label>;
}
const TONE: Record<string, string> = { ok: 'bg-green-100 text-ok', warn: 'bg-amber-100 text-[#a8492a]', bad: 'bg-red-100 text-danger', info: 'bg-brand-50 text-brand', mute: 'bg-canvas text-sub', dark: 'bg-black text-white' };
export const Tag = ({ t, tone = 'mute' }: { t: ReactNode; tone?: keyof typeof TONE }) => <span className={cx('inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap', TONE[tone])}>{t}</span>;
export function Sw({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={onClick} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas text-left w-full">
      <span className="flex flex-col"><span className="text-sm font-medium">{label}</span>{sub && <span className="text-xs text-muted">{sub}</span>}</span>
      <span className={cx('w-11 h-6 rounded-full p-0.5 flex-none transition-colors', on ? 'bg-ok' : 'bg-[#cfcfcf]')}><span className={cx('block w-5 h-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} /></span>
    </button>
  );
}
export function Kpi({ l, v, n, tone }: { l: string; v: ReactNode; n?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return <div className="bg-white rounded-3xl shadow-card p-4 flex flex-col gap-0.5 min-w-0"><span className="text-xs text-muted">{l}</span><strong className={cx('text-2xl font-semibold tracking-tight', tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-[#b26a00]' : tone === 'ok' ? 'text-ok' : '')}>{v}</strong>{n && <span className="text-xs text-muted">{n}</span>}</div>;
}
export function Chips<T extends string>({ opts, value, onChange, label }: { opts: [T, string][]; value: T; onChange: (v: T) => void; label?: string }) {
  return <div role="group" aria-label={label} className="flex gap-1.5 flex-wrap">{opts.map(([k, l]) => <button key={k} aria-pressed={value === k} onClick={() => onChange(k)} className={cx('text-xs px-3 py-1.5 rounded-full border whitespace-nowrap', value === k ? 'bg-black text-white border-black font-semibold' : 'border-line bg-white hover:border-black')}>{l}</button>)}</div>;
}
export function Modal({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={cx('bg-white w-full max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 flex flex-col gap-3', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex justify-between gap-3"><div><h2 className="m-0 text-xl font-semibold">{title}</h2>{sub && <span className="text-sm text-muted">{sub}</span>}</div><button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl flex-none">×</button></div>
        {children}
      </section>
    </div>
  );
}
export const Err = ({ e }: { e: string }) => (e ? <span role="alert" className="text-sm text-danger">{e}</span> : null);
export const phClean = (v: string) => v.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '').slice(0, 9);
