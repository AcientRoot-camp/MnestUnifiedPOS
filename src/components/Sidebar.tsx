import { usePersist } from '../lib/persist';
import type { Grants } from '../lib/perms';
import { Avatar } from './TopBar';
import { CO0, ini as devIni, type Company } from '../pages/admin/dev/data';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon';
import Logo, { LogoMark } from './Logo';
import { BRANCHES, PEOPLE, buildNav, type NavGroup } from '../data/nav';
import { useSession } from '../lib/session';
import { cx } from '../lib/format';
import CompanyLogo from './CompanyLogo';

function readBool(k: string) {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { session, viewBranch, setViewBranch, online } = useSession();
  const [devCos] = usePersist<Company[]>('ecompos.companies', CO0);
  const [devSel, setDevSel] = usePersist<string>('ecompos.devCompany', 'main');
  const devCo = devCos.find((c) => c.id === devSel) ?? devCos[0];
  const role = session?.role ?? 'superuser';
  const me = PEOPLE[role];
  const [grants] = usePersist<Grants>('ecompos.grants', {});
  const [profiles] = usePersist<Record<string, { photo?: string }>>('ecompos.profiles', {});
  const photo = profiles[session?.username || '']?.photo;
  // CRM badges (new leads, overdue follow-ups, open complaints) refresh the moment CRM data changes.
  const [crmTick, setCrmTick] = useState(0);
  useEffect(() => { const f = (e: Event) => { const k = (e as CustomEvent<{ key?: string }>).detail?.key || ''; if (k.startsWith('ecompos.crm.')) setCrmTick((n) => n + 1); }; const g = (e: StorageEvent) => { if (e.key?.startsWith('ecompos.crm.')) setCrmTick((n) => n + 1); }; window.addEventListener('ecompos:persist', f); window.addEventListener('storage', g); const t = setInterval(() => setCrmTick((n) => n + 1), 60_000); return () => { window.removeEventListener('ecompos:persist', f); window.removeEventListener('storage', g); clearInterval(t); }; }, []);
  const groups = useMemo(() => buildNav(role, session?.username, session?.branch, grants), [role, session?.username, session?.branch, grants, crmTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => readBool('ecompos.navCollapsed2'));
  const [bizOpen, setBizOpen] = useState(false);
  const [flyout, setFlyout] = useState('');
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.path, loc.pathname)))?.label;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggleCollapsed = () => {
    const n = !collapsed;
    setCollapsed(n);
    setFlyout('');
    try {
      localStorage.setItem('ecompos.navCollapsed2', n ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const branchLabel =
    viewBranch === 'all' ? 'All branches' : BRANCHES.find((b) => b.id === viewBranch)?.name ?? 'All branches';
  // Tablet and desktop: open by default; people can fold it to the icon strip with the top-left button.
  // Phones: a slide-in drawer, so it is never the narrow strip there.
  const narrow = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <button aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-40 bg-black/50 nav:hidden" />
      )}
      <aside
        aria-label="MNest UnifiedPOS navigation"
        className={cx(
          'bg-black text-white flex flex-col gap-[18px] min-h-screen transition-[width] duration-200 z-50',
          'fixed inset-y-0 left-0 overflow-y-auto nav:sticky nav:top-0 nav:h-screen nav:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          narrow ? 'w-[72px] px-4 py-5 items-center' : 'w-[260px] p-4',
        )}
      >
        {/* Header: collapse + logo */}
        {narrow ? (
          <div className="flex flex-col items-center gap-2.5">
            <button
              onClick={toggleCollapsed}
              aria-label="Expand menu"
              title="Expand menu"
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10"
            >
              <Icon name="menu" size={20} />
            </button>
            <Link to={role === 'developer' ? '/developer' : '/'} aria-label="MNest UnifiedPOS · go to Home" className="w-10 h-10 flex items-center justify-center">
              <LogoMark size={36} />
            </Link>
            <button
              onClick={() => setBizOpen((v) => !v)}
              aria-label={`Switch branch: ${branchLabel}`}
              title={branchLabel}
              className="w-10 h-10 rounded-xl text-xs font-semibold hover:bg-white/10"
            >
              {viewBranch === 'all' ? 'ALL' : viewBranch.slice(0, 3).toUpperCase()}
            </button>
            <span aria-hidden className="w-[26px] h-px bg-white/20" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <button
                onClick={mobileOpen ? onClose : toggleCollapsed}
                aria-label={mobileOpen ? 'Close menu' : 'Collapse menu'}
                aria-expanded={!mobileOpen ? true : undefined}
                title={mobileOpen ? 'Close menu' : 'Collapse menu'}
                className="w-9 h-9 flex-none rounded-xl bg-white/[0.12] flex items-center justify-center"
              >
                <Icon name="menu" />
              </button>
              <Link to={role === 'developer' ? '/developer' : '/'} aria-label="MNest UnifiedPOS · go to Home" className="flex-1 flex justify-center py-0.5 rounded-2xl">
                <Logo size={72} dark textClass="text-[15px]" />
              </Link>
            </div>
            <button
              onClick={() => setBizOpen((v) => !v)}
              aria-expanded={bizOpen}
              className="flex items-center gap-2.5 p-2 rounded-2xl bg-white/[0.06] text-left"
            >
              <span className={cx('w-9 h-9 flex-none rounded-xl overflow-hidden', role === 'developer' && 'bg-white')}>
                {role === 'developer' ? (devCo?.logo ? <img src={devCo.logo} alt="" className="w-full h-full object-contain" /> : <span className="w-full h-full flex items-center justify-center text-black text-xs font-bold">{devIni(devCo?.name || '')}</span>) : <CompanyLogo icon className="w-full h-full" />}
              </span>
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{role === 'developer' ? devCo?.name : 'Ebenezer Unique Ventures'}</span>
                <span className="text-xs text-white/70">{role === 'developer' ? `Company in view · ${devCo?.plan} plan` : branchLabel}</span>
              </span>
              <Icon name="chevronDown" size={16} stroke={2} />
            </button>
          </>
        )}

        {bizOpen && role === 'developer' && (
          <div className={cx('flex flex-col gap-1 p-2 rounded-2xl bg-canvas text-black', narrow && 'absolute left-[76px] top-28 w-64 shadow-card')}>
            <span className="text-xs text-muted px-2 py-1">Companies on this server · switch company</span>
            {devCos.map((c) => (
              <button key={c.id} aria-pressed={devSel === c.id} onClick={() => { setDevSel(c.id); setBizOpen(false); }} className={cx('text-left p-2.5 rounded-xl flex flex-col gap-0.5', devSel === c.id ? 'bg-white' : 'hover:bg-white/70')}>
                <span className={cx('text-sm', devSel === c.id ? 'font-semibold' : 'font-normal')}>{c.name}</span>
                <span className="text-xs text-muted">{c.type} · {c.plan}{c.status === 'Suspended' ? ' · suspended' : ''}</span>
              </button>
            ))}
          </div>
        )}
        {bizOpen && role !== 'developer' && (
          <div className={cx('flex flex-col gap-1 p-2 rounded-2xl bg-canvas text-black', narrow && 'absolute left-[76px] top-28 w-64 shadow-card')}>
            <span className="text-xs text-muted px-2 py-1">Ebenezer Unique Ventures · switch branch</span>
            {(role === 'superuser'
              ? [{ id: 'all', name: 'All branches', sub: 'Admin view · oversees every branch' }, ...BRANCHES.map((b) => ({ id: b.id, name: `${b.name} · ${b.city}`, sub: `Manager ${b.manager}` }))]
              : BRANCHES.filter((b) => b.id === session?.branch).map((b) => ({ id: b.id, name: `${b.name} · ${b.city}`, sub: 'Your assigned branch · you can only view this branch' })))
              .map((b) => (
                <button
                  key={b.id}
                  aria-pressed={viewBranch === b.id}
                  onClick={() => {
                    setViewBranch(b.id);
                    setBizOpen(false);
                  }}
                  className={cx('text-left p-2.5 rounded-xl flex flex-col gap-0.5', viewBranch === b.id ? 'bg-white' : 'hover:bg-white/70')}
                >
                  <span className={cx('text-sm', viewBranch === b.id ? 'font-semibold' : 'font-normal')}>{b.name}</span>
                  <span className="text-xs text-muted">{b.sub}</span>
                </button>
              ))}
          </div>
        )}

        <nav aria-label="Sections" className={cx('flex flex-col', narrow ? 'gap-1.5 items-center' : 'gap-3.5')}>
          {!narrow && role !== 'developer' && (
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cx('flex items-center gap-3 min-h-10 px-3 rounded-[14px] text-sm', isActive ? 'bg-white/[0.14] font-semibold' : 'hover:bg-white/[0.08]')
              }
            >
              <Icon name="home" />
              <span>Home</span>
            </NavLink>
          )}
          {groups.map((g) =>
            narrow ? (
              <RailGroup key={g.label} g={g} flyout={flyout} setFlyout={setFlyout} active={activeGroup === g.label} />
            ) : (
              <ExpandedGroup
                key={g.label}
                g={g}
                open={activeGroup === g.label ? open[g.label] !== false : !!open[g.label]}
                active={activeGroup === g.label}
                onToggle={() => setOpen((o) => ({ ...o, [g.label]: !(activeGroup === g.label ? o[g.label] !== false : !!o[g.label]) }))}
                onPick={onClose}
              />
            ),
          )}
        </nav>

        <div className={cx('mt-auto flex flex-col gap-2.5', narrow ? 'items-center' : 'items-stretch')}>
          {narrow ? (
            <>
              <span role="img" aria-label={online ? 'Online · synced' : 'Offline · selling continues'} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <span className={cx('w-2.5 h-2.5 rounded-full', online ? 'bg-green-500 ring-4 ring-green-500/25' : 'bg-amber-400 ring-4 ring-amber-400/25')} />
              </span>
              <button onClick={() => window.dispatchEvent(new CustomEvent('ecompos:openProfile'))} title="My profile & photo" aria-label={`My profile and photo: ${me.name}, ${me.level}`}><Avatar name={me.name} photo={photo} size={32} dark={false} /></button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-xs">
                <span aria-hidden className={cx('w-2 h-2 rounded-full', online ? 'bg-green-500 ring-[3px] ring-green-500/25' : 'bg-amber-400 ring-[3px] ring-amber-400/25')} />
                {online ? 'Online · everything synced' : 'Offline · keeps selling, syncs later'}
              </span>
              <button onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('ecompos:openProfile')); }} aria-haspopup="dialog" title="My profile & photo" aria-label={`My profile and photo: ${me.name}, ${me.level}`} className="flex items-center gap-2.5 p-1.5 rounded-[14px] hover:bg-white/10 text-left">
                <Avatar name={me.name} photo={photo} size={32} dark={false} />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{me.name}</span>
                  <span className="text-xs text-white/70">{me.level}</span>
                </span>
                <span aria-hidden className="ml-auto text-xs opacity-80">📷</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function isActive(path: string, current: string) {
  return current === path || (path !== '/' && current.startsWith(path + '/') && !path.includes('/', 1));
}

function ExpandedGroup({ g, open, active, onToggle, onPick }: { g: NavGroup; open: boolean; active: boolean; onToggle: () => void; onPick: () => void }) {
  const sum = g.items.reduce((a, i) => a + (parseInt(i.badge ?? '', 10) || 0), 0);
  const id = `navg-${g.label.replace(/\W+/g, '-')}`;
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className={cx('flex items-center gap-2 w-full min-h-[34px] px-3 rounded-xl text-left', active ? 'bg-brand' : 'hover:bg-white/[0.08]')}
      >
        <Icon name={g.label} size={16} />
        <span className="flex-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/90">{g.label}</span>
        {!open && sum > 0 && <span className="text-[11px] font-semibold min-w-5 px-1.5 py-0.5 rounded-full bg-danger text-center">{sum}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden className="flex-none"><path d="M5 12h14" />{!open && <path d="M12 5v14" />}</svg>
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-0.5">
          {g.items.map((i) => (
            <NavLink
              key={i.id}
              to={i.path}
              end
              onClick={onPick}
              className={({ isActive }) =>
                cx('flex items-center gap-3 min-h-10 px-3 rounded-[14px] text-sm', isActive ? 'bg-white/[0.14] font-semibold' : 'hover:bg-white/[0.08]')
              }
            >
              <Icon name={i.id.startsWith('br:') ? 'pin' : i.id} />
              <span className="flex-1">{i.label}</span>
              {i.badge && <span className="text-xs font-medium min-w-5 px-[7px] py-0.5 rounded-full text-center" style={{ background: i.tone === 'warn' ? '#b26a00' : '#c62828' }} title={i.tone === 'warn' ? 'Overdue' : undefined}>{i.badge}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function RailGroup({ g, flyout, setFlyout, active }: { g: NavGroup; flyout: string; setFlyout: (s: string) => void; active: boolean }) {
  const on = flyout === g.label;
  const sum = g.items.reduce((a, i) => a + (parseInt(i.badge ?? '', 10) || 0), 0);
  return (
    <div className="relative">
      <button
        onClick={() => setFlyout(on ? '' : g.label)}
        aria-label={g.label + (sum ? `, ${sum} needing attention` : '')}
        aria-expanded={on}
        title={g.label}
        className={cx('relative w-10 h-10 rounded-xl flex items-center justify-center', on ? 'bg-white text-black' : active ? 'bg-brand' : 'hover:bg-white/10')}
      >
        <Icon name={g.label} size={19} />
        {sum > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-4 text-center">{sum}</span>
        )}
      </button>
      {on && (
        <div className="absolute left-[52px] top-0 w-60 bg-white text-black rounded-[14px] p-1.5 flex flex-col gap-0.5 shadow-card z-50">
          <span className="text-xs text-muted px-2.5 py-1">{g.label}</span>
          {g.items.map((i) => (
            <NavLink
              key={i.id}
              to={i.path}
              end
              onClick={() => setFlyout('')}
              className={({ isActive }) => cx('flex items-center gap-2.5 min-h-[38px] px-2.5 rounded-[10px] text-[13.5px]', isActive ? 'bg-canvas font-semibold' : 'hover:bg-canvas')}
            >
              <Icon name={i.id.startsWith('br:') ? 'pin' : i.id} size={17} />
              <span className="flex-1 truncate">{i.label}</span>
              {i.badge && <span className="text-[11px] font-semibold min-w-5 px-[7px] py-0.5 rounded-full text-white text-center" style={{ background: i.tone === 'warn' ? '#b26a00' : '#c62828' }}>{i.badge}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
