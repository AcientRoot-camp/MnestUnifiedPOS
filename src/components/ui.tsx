import NoticeModal from './Notice';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { cx } from '../lib/format';

export function PageHeader({ title, sub, icon, actions }: { title: string; sub?: string; icon?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] font-medium tracking-tightest leading-tight">{title}</h1>
          {sub && <p className="m-0 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

export function Kpi({ label, value, note, to, tone }: { label: string; value: string; note?: string; to?: string; tone?: 'up' | 'down' }) {
  const body = (
    <>
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[26px] leading-tight font-medium tracking-tightest whitespace-nowrap">{value}</span>
      {note && <span className={cx('text-xs', tone === 'up' ? 'text-ok' : tone === 'down' ? 'text-danger' : 'text-sub')}>{note}</span>}
      {to && <span className="text-xs font-semibold text-brand mt-auto">Open history →</span>}
    </>
  );
  const cls = 'card p-[22px] flex flex-col gap-2 text-left min-w-0';
  return to ? (
    <Link to={to} className={cls + ' hover:ring-2 hover:ring-brand-100'}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Section({ title, children, actions, className }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cx('bg-white rounded-4xl shadow-card p-5 sm:p-6 flex flex-col gap-4 min-w-0', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

const STATUS: Record<string, string> = {
  Paid: 'bg-green-100 text-green-800',
  Completed: 'bg-green-100 text-green-800',
  Collected: 'bg-green-100 text-green-800',
  Delivered: 'bg-green-100 text-green-800',
  Approved: 'bg-green-100 text-green-800',
  Active: 'bg-green-100 text-green-800',
  Live: 'bg-green-100 text-green-800',
  'On the way': 'bg-amber-100 text-amber-900',
  Pending: 'bg-amber-100 text-amber-900',
  Waiting: 'bg-amber-100 text-amber-900',
  Owing: 'bg-amber-100 text-amber-900',
  'In transit': 'bg-amber-100 text-amber-900',
  Open: 'bg-blue-100 text-blue-900',
  New: 'bg-blue-100 text-blue-900',
  Overdue: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
  Cancelled: 'bg-red-100 text-red-800',
  Low: 'bg-red-100 text-red-800',
};

export function Status({ s }: { s: string }) {
  return <span className={cx('pill', STATUS[s] ?? 'bg-canvas text-sub')}>{s}</span>;
}

export function Table({ cols, rows }: { cols: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-3 py-2 border-b border-line">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-canvas/60">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-3 border-b border-line align-middle">
                  {typeof c === 'string' && STATUS[c] ? <Status s={c} /> : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx('text-sm px-4 py-2 rounded-full whitespace-nowrap', value === t.id ? 'bg-black text-white font-semibold' : 'text-sub hover:bg-canvas')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function BranchPills({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div role="group" aria-label="Branch" className="flex gap-2 flex-wrap">
      {options.map((b) => (
        <button
          key={b.id}
          aria-pressed={value === b.id}
          onClick={() => onChange(b.id)}
          className={cx(
            'text-sm px-[18px] py-2.5 min-h-11 rounded-full border shadow-[rgba(0,0,0,0.06)_0_2px_8px]',
            value === b.id ? 'bg-black text-white border-black' : 'bg-white text-black border-line',
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

/** Completed actions show as a modal pop-up (see Notice). */
export function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return <NoticeModal msg={msg} onClose={onClose} />;
}
