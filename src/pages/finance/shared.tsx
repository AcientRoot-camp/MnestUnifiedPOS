import { PillSelect } from '../../components/ui';
import type { ReactNode } from 'react';
import { cx } from '../../lib/format';
import type { FinState } from '../../data/finance';

export type Role = 'superuser' | 'manager' | 'supervisor' | 'staff';
export type Ctx = {
  S: FinState;
  setS: (f: (s: FinState) => FinState) => void;
  role: Role;
  SU: boolean;
  me: string;
  myBr: string;
  scope: string; // 'all' or branch id (SU) / own branch
  brs: string[];
  goTab: (t: string) => void;
  flash: (m: string, bad?: boolean) => void;
};

export function Card({ title, sub, actions, children, className }: { title?: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('bg-white rounded-4xl shadow-card p-5 sm:p-6 flex flex-col gap-4 min-w-0', className)}>
      {(title || actions) && (
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">{title && <h2 className="m-0 text-lg font-semibold">{title}</h2>}{sub && <span className="text-[13px] text-muted">{sub}</span>}</div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A choice of options as pill buttons. With three or more options it becomes a dropdown on phones and tablets (below
 * lg), so a long row of choices never runs off a small screen; two options stay as buttons everywhere.
 */
export function Pills<T extends string>({ opts, value, onChange, small }: { opts: [T, string][]; value: T; onChange: (v: T) => void; small?: boolean }) {
  const drop = opts.length >= 3;
  return (
    <>
    {drop && <PillSelect className="lg:hidden" label="Choose" value={value} onChange={(v) => onChange(v as T)} items={opts.map(([id, label]) => ({ id, label }))} />}
    <div className={cx('gap-1.5 flex-wrap', drop ? 'hidden lg:flex' : 'flex')}>
      {opts.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={cx('rounded-full border', small ? 'text-xs px-3 py-1.5' : 'text-[13px] px-3.5 py-2', value === k ? 'bg-black text-white border-black' : 'bg-white border-line hover:bg-canvas')}>
          {l}
        </button>
      ))}
    </div>
    </>
  );
}

export function Field({ label, value, onChange, ph, type = 'text', inputMode }: { label: string; value: string; onChange: (v: string) => void; ph?: string; type?: string; inputMode?: 'decimal' | 'numeric' }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] font-semibold flex-1 min-w-[160px]">
      {label}
      <input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className="field font-normal py-2.5" />
    </label>
  );
}

export function T({ head, rows, foot }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead><tr>{head.map((h, i) => <th key={i} scope="col" className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-3 py-2 border-b border-line">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2.5 border-b border-line align-top">{c}</td>)}</tr>)}
          {foot && <tr className="font-semibold bg-canvas/60">{foot.map((c, j) => <td key={j} className="px-3 py-2.5">{c}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}

export const num = (v: string) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const stamp = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + new Date().toTimeString().slice(0, 5);
