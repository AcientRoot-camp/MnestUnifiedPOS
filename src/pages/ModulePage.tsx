import { useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Kpi, PageHeader, Section, Table, Toast } from '../components/ui';
import { SCREENS } from '../data/screens';
import { buildNav } from '../data/nav';
import { useSession } from '../lib/session';
import { cx } from '../lib/format';

export default function ModulePage({ screen }: { screen: string }) {
  const s = SCREENS[screen];
  const { tab } = useParams();
  const { session } = useSession();
  const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const group = useMemo(() => (s.navGroup ? buildNav(session?.role ?? 'superuser', session?.username, session?.branch).find((g) => g.label === s.navGroup) : undefined), [s, session]);
  const tabItem = group?.items.find((i) => i.path.endsWith('/' + tab));
  const rows = s.table.rows.filter((r) => r.join(' ').toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title={tabItem ? `${s.title} · ${tabItem.label}` : s.title}
        sub={s.sub}
        icon={tabItem?.id ?? s.icon}
        actions={s.primary && <button onClick={() => setToast(`${s.primary} · coming in the next build`)} className="btn-primary"><Icon name="plus" /> {s.primary}</button>}
      />
      {group && (
        <nav aria-label={`${s.title} sections`} className="flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">
          {group.items.filter((i) => !i.id.startsWith('br:') && i.id !== 'addbranch').map((i) => (
            <NavLink key={i.id} to={i.path} end className={({ isActive }) => cx('flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-full whitespace-nowrap', isActive ? 'bg-black text-white font-semibold' : 'text-sub hover:bg-canvas')}>
              <Icon name={i.id} size={15} /> {i.label}
            </NavLink>
          ))}
        </nav>
      )}
      <section aria-label="Key figures" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {s.kpis.map(([l, v, n]) => (
          <Kpi key={l} label={l} value={v} note={n} tone={n?.startsWith('▲') ? 'up' : undefined} />
        ))}
      </section>
      <div className={cx('grid gap-6', s.sections.length > 0 && 'xl:grid-cols-[1.6fr_1fr]')}>
        <Section
          title={s.table.title}
          actions={
            <div className="relative">
              <label htmlFor="mod-q" className="sr-only">Filter {s.table.title}</label>
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input id="mod-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="pl-9 pr-4 py-2 text-sm rounded-full border border-line w-48" />
            </div>
          }
        >
          {rows.length ? <Table cols={s.table.cols} rows={rows} /> : <p className="text-sm text-muted m-0">Nothing matches “{q}”.</p>}
        </Section>
        {s.sections.length > 0 && (
          <div className="flex flex-col gap-6">
            {s.sections.map((sec) => (
              <Section key={sec.title} title={sec.title}>
                {sec.items.map(([a, b]) => (
                  <div key={a} className="flex justify-between gap-3 text-sm py-1 border-b border-line last:border-0">
                    <span className="text-sub">{a}</span>
                    <b className="text-right">{b}</b>
                  </div>
                ))}
              </Section>
            ))}
          </div>
        )}
      </div>
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}
