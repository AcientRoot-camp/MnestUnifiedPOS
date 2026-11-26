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

/** Native dropdown styled like the app's pills: used for tabs and options on phones and tablets. */
export function PillSelect({ label, value, onChange, items, className }: { label: string; value: string; onChange: (id: string) => void; items: { id: string; label: string }[]; className?: string }) {
  return (
    <label className={cx('relative inline-flex w-full max-w-md', className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 pl-4 pr-10 rounded-full bg-white border border-black text-sm font-semibold appearance-none cursor-pointer">
        {items.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs">▼</span>
    </label>
  );
}

/**
 * Section tabs that fit every screen: a row of pill tabs on laptops and desktops (lg and up), and a dropdown on
 * phones and tablets, where a long row of tabs would run off the screen. badge: a small count shown on the tab
 * (and after the name in the dropdown). Inputs: tabs, the selected id, onChange and an accessible label.
 */
export function Tabs({ tabs, value, onChange, label = 'Sections' }: { tabs: { id: string; label: string; badge?: string | number }[]; value: string; onChange: (id: string) => void; label?: string }) {
  return (
    <>
      <PillSelect className="lg:hidden" label={label} value={value} onChange={onChange} items={tabs.map((t) => ({ id: t.id, label: t.badge ? `${t.label} (${t.badge})` : t.label }))} />
      <div role="tablist" aria-label={label} className="hidden lg:flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={cx('text-sm px-3.5 py-2 rounded-full whitespace-nowrap inline-flex items-center gap-1.5', value === t.id ? 'bg-black text-white font-semibold' : 'text-sub hover:bg-canvas')}
          >
            {t.label}{t.badge ? <span className={cx('pill px-1.5 py-0', value === t.id ? 'bg-white text-black' : 'bg-danger text-white')}>{t.badge}</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Branch picker (All branches / Osu / East Legon / Adum) used on the POS dashboard.
 * Inputs: the selected branch id, a change handler and the branch options.
 * Phones and tablets (below lg) get a dropdown, because four wide pills wrap onto several lines there;
 * laptops and desktops keep the pill row. With a single option (a user tied to one branch) only the pill shows.
 */
export function BranchPills({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <>
      {options.length > 1 && <PillSelect label="Branch" value={value} onChange={onChange} items={options} className="lg:hidden sm:max-w-xs" />}
      <BranchPillRow value={value} onChange={onChange} options={options} className={options.length > 1 ? 'hidden lg:flex' : 'flex'} />
    </>
  );
}

/** The pill row half of BranchPills (laptops and desktops, or a single-branch user on any screen). */
function BranchPillRow({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; className: string }) {
  return (
    <div role="group" aria-label="Branch" className={cx('gap-2 flex-wrap', className)}>
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
