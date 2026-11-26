import { useEffect, useMemo, useRef, useState } from 'react';
import { readPhoto } from '../lib/photo';
import { EMPS0, type Emp } from '../data/people';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { ACCOUNTS, BRANCHES, PEOPLE, buildNav } from '../data/nav';
import { readKey, usePersist } from '../lib/persist';
import { credSet, creds, endOtherSessions, pwProblem, secLog } from '../lib/sec';
import { useSession } from '../lib/session';
import NoticeModal from '../components/Notice';
import { PRODUCTS0, type Product } from '../data/catalogue';
import { cartonOf, cleanCode } from '../lib/barcode';

export function SearchBar() {
  const { session } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const all = useMemo(() => buildNav(session?.role ?? 'superuser', session?.username, session?.branch).flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [session]);
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  // Screens, then products by name, SKU, barcode (single or carton) or category. A full barcode scanned into the box
  // (Enter) opens that product.
  const qc = cleanCode(q);
  const prod = q.trim() ? P.filter((p) => p.status === 'live' && (`${p.name} ${p.sku} ${p.cat}`.toLowerCase().includes(q.toLowerCase().trim()) || (qc.length >= 3 && [p.barcode, cartonOf(p)].some((b) => b && b.includes(qc))))).slice(0, 5).map((p) => ({ id: 'prod-' + p.id, label: `${p.name} · barcode ${p.barcode}`, group: 'Product', path: `/products?open=${p.id}` })) : [];
  const exact = qc ? P.find((p) => [p.barcode, cartonOf(p)].includes(qc)) : undefined;
  const hits = q.trim() ? [...(exact ? prod.filter((h) => h.id === 'prod-' + exact.id) : []), ...all.filter((i) => (i.label + ' ' + i.group).toLowerCase().includes(q.toLowerCase())).slice(0, 5), ...prod.filter((h) => !exact || h.id !== 'prod-' + exact.id)].slice(0, 9) : [];
  return (
    <div className="relative w-full">
      <label htmlFor="global-search" className="sr-only">Search MNest UnifiedPOS</label>
      <input
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) {
            nav(hits[0].path);
            setQ('');
          }
        }}
        placeholder="Search name, SKU, barcode, category"
        className="w-full text-[15px] pl-12 pr-5 py-3 rounded-full border border-line bg-white shadow-[rgba(0,0,0,0.06)_0_2px_8px] outline-none focus:border-brand"
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted flex items-center" aria-hidden>
        <Icon name="search" size={18} />
      </span>
      {hits.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-2xl shadow-card p-1.5">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => {
                  nav(h.path);
                  setQ('');
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-canvas text-left text-sm"
              >
                <Icon name={h.id.startsWith('br:') ? 'pin' : h.id} />
                <span className="flex-1">{h.label}</span>
                <span className="text-xs text-muted">{h.group}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type Profile = { photo?: string; phone?: string; email?: string };
/** A message from the Admin. to + br: the groups it is for; who: particular people by name (when set, only they get it). */
export type StaffMsg = { id: string; from: string; title: string; body: string; to: string[]; br: string; who?: string[]; confirm: boolean; readBy: string[]; at: number };
/** Whether a message is for this person. Inputs: the message, their role, name and branch ('' or 'all' for everywhere). */
export const msgFor = (x: StaffMsg, role: string, name: string, branch?: string) =>
  x.who?.length ? x.who.includes(name) : x.to.includes(role) && (x.br === 'all' || !branch || branch === 'all' || x.br === branch);
/** A bell notification for some roles. br: only for that branch's people (and the Admin), e.g. a branch's 09:00 alert.
 * who: only for one person (e.g. "Your staff ID card is ready"). */
export type Notif = { id: string; t: string; s: string; at: number; to: string[]; readBy: string[]; link?: string; br?: string; who?: string };
export const NOTIF0: Notif[] = [
  { id: 'n1', t: 'Discount request', s: 'Till 2 · Osu asked for 15% off a Hisense TV', at: Date.now() - 2 * 6e4, to: ['superuser', 'manager', 'supervisor'], readBy: [], link: '/approvals' },
  { id: 'n2', t: 'Deposit to confirm', s: 'East Legon moved GHS 6,200 to GCB', at: Date.now() - 12 * 6e4, to: ['superuser', 'manager'], readBy: [], link: '/finance/deposits' },
  { id: 'n3', t: 'Low stock', s: 'Nasco 18" Wall Fan · 4 left at Adum', at: Date.now() - 60 * 6e4, to: ['superuser', 'manager', 'supervisor', 'staff'], readBy: [], link: '/inventory' },
  { id: 'n4', t: 'New website order', s: '#34422885 for pickup at Osu', at: Date.now() - 120 * 6e4, to: ['superuser', 'manager', 'supervisor', 'staff'], readBy: [], link: '/collect' },
];
const ago = (ts: number) => { const m = Math.round((Date.now() - ts) / 6e4); return m < 1 ? 'Just now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
export function Avatar({ name, photo, size = 36, dark = true }: { name: string; photo?: string; size?: number; dark?: boolean }) {
  const ini = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className={`rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold flex-none ${dark ? 'bg-black text-white' : 'bg-white text-black'}`} style={{ width: size, height: size }}>{photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : ini}</span>;
}

export function AccountBar() {
  const { session, signOut, viewBranch } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const me = PEOPLE[role];
  const uname = session?.username || me.username;
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const [all, setAll] = useState(false);
  const [modal, setModal] = useState<'' | 'profile' | 'pw' | 'msg'>('');
  const [profiles, setProfiles] = usePersist<Record<string, Profile>>('ecompos.profiles', {});
  const [notifs, setNotifs] = usePersist<Notif[]>('ecompos.notifs', NOTIF0);
  const [msgs, setMsgs] = usePersist<StaffMsg[]>('ecompos.staffMsgs', []);
  const prof = profiles[uname] || {};
  const branch = viewBranch === 'all' ? 'All branches' : BRANCHES.find((b) => b.id === viewBranch)?.short ?? '';
  const forBranch = (n: Notif) => (!n.who || n.who === session?.name) && (!n.br || role === 'superuser' || role === 'developer' || !session?.branch || session.branch === 'all' || session.branch === n.br);
  const mine = [...notifs.filter((n) => n.to.includes(role) && forBranch(n)), ...msgs.filter((m) => msgFor(m, role, me.name, session?.branch) && m.from !== me.name).map((m) => ({ id: m.id, t: `${m.from}: ${m.title}`, s: m.body, at: m.at, to: m.to, readBy: m.readBy, link: undefined }))].sort((a, b) => b.at - a.at);
  const unread = mine.filter((n) => !n.readBy.includes(uname));
  // The account menu sits at the top of the page, so bring it into view when something else asks to open it.
  useEffect(() => { const f = () => { setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }; window.addEventListener('ecompos:openMe', f); return () => window.removeEventListener('ecompos:openMe', f); }, []);
  const [pf, setPf] = useState<Profile>({});
  // Profile photo: saved straight away from the account menu or the "My profile & photo" window.
  const [photoMsg, setPhotoMsg] = useState<null | { text: string; err: boolean }>(null);
  const savePhoto = (photo: string) => { setProfiles((all) => ({ ...all, [uname]: { ...all[uname], photo } })); setPhotoMsg({ text: photo ? '✓ Photo saved' : 'Photo removed', err: false }); };
  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; // cleared, so choosing the same file again still works
    if (!f) return;
    readPhoto(f).then(savePhoto).catch((x: Error) => setPhotoMsg({ text: x.message, err: true }));
  };
  /** Open "My profile & photo" (from the account menu, or the profile at the bottom of the side menu). */
  const openProfile = () => { setPf({ phone: prof.phone ?? '', email: prof.email ?? `${uname}@ebenezerunique.com.gh` }); setPhotoMsg(null); setModal('profile'); setOpen(false); setBell(false); };
  const openProfileRef = useRef(openProfile); openProfileRef.current = openProfile;
  useEffect(() => { const f = () => openProfileRef.current(); window.addEventListener('ecompos:openProfile', f); return () => window.removeEventListener('ecompos:openProfile', f); }, []);
  const [pw, setPw] = useState({ cur: '', n1: '', n2: '', pin: '', err: '', ok: '' });
  const blankMsg = { title: '', body: '', to: ['manager', 'supervisor', 'staff'], br: 'all', mode: 'roles' as 'roles' | 'people', who: [] as string[], q: '', confirm: true, err: '' };
  const [m, setM] = useState(blankMsg);
  /** Everyone a message can go to by name: the user accounts (Admin › Users), open accounts only, not the sender or support. */
  const people = useMemo(() => {
    const saved = readKey<{ name: string; level: string; role: string; br: string; closed?: boolean }[]>('ecompos.accounts3', []);
    // Before Admin › Users has been opened the accounts list is not saved yet: use the sign-in accounts plus every
    // employee on the HR list (people who have left are skipped), the same people Admin › Users starts with.
    const ROLE_OF: Record<string, string> = { Admin: 'superuser', Manager: 'manager', Supervisor: 'supervisor', 'Sales staff': 'staff', Rider: 'rider' };
    const base = ACCOUNTS.map((a) => ({ name: a.name, level: a.level, role: a.role as string, br: a.branch || 'all' }));
    const list: { name: string; level: string; role: string; br: string; closed?: boolean }[] = saved.length ? saved
      : [...base, ...readKey<Emp[]>('ecompos.staff2', EMPS0).filter((e) => e.status !== 'Left' && !base.some((b) => b.name === e.name)).map((e) => ({ name: e.name, level: e.level, role: ROLE_OF[e.level] || 'staff', br: e.br }))];
    return list.filter((p) => !p.closed && p.role !== 'developer' && p.name !== me.name)
      .map((p) => ({ name: p.name, level: p.level, role: p.role, brName: p.br === 'all' || !p.br ? 'All branches' : BRANCHES.find((b) => b.id === p.br)?.short ?? p.br }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [modal, me.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const item = 'flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-canvas text-sm text-left w-full';
  const acc = ACCOUNTS.find((a) => a.username === uname);
  return (
    <div className="flex items-center gap-2 relative">
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-full bg-white border border-line whitespace-nowrap"><Icon name="pin" size={15} /> {branch}</span>
      <button onClick={() => { setBell((v) => !v); setOpen(false); }} aria-label={`Notifications, ${unread.length} new`} aria-expanded={bell} className="relative w-11 h-11 rounded-full bg-white border border-line flex items-center justify-center">
        <Icon name="bell" />
        {unread.length > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-4 text-center">{unread.length}</span>}
      </button>
      <button onClick={() => { setOpen((v) => !v); setBell(false); }} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-line">
        <Avatar name={me.name} photo={prof.photo} />
        <span className="hidden md:flex flex-col text-left leading-tight"><span className="text-sm font-medium">{me.name}</span><span className="text-xs text-muted">{me.level}</span></span>
        <Icon name="chevronDown" size={16} stroke={2} />
      </button>
      {bell && (
        <div className="absolute right-0 top-14 z-40 w-[340px] max-w-[92vw] bg-white rounded-2xl shadow-card p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center"><h2 className="m-0 text-[15px] font-semibold">Notifications</h2><span className="text-xs text-muted">{unread.length} new</span></div>
          {!mine.length && <span className="text-sm text-muted">You are all caught up.</span>}
          {(all ? mine : mine.slice(0, 5)).map((n) => { const isRead = n.readBy.includes(uname); return (
            <Link key={n.id} to={n.link || '#'} onClick={(e) => { if (!n.link) e.preventDefault(); setNotifs((L) => L.map((x) => (x.id === n.id ? { ...x, readBy: Array.from(new Set([...x.readBy, uname])) } : x))); setMsgs((L) => L.map((x) => (x.id === n.id ? { ...x, readBy: Array.from(new Set([...x.readBy, me.name])) } : x))); if (n.link) setBell(false); }} className="flex gap-3 items-start hover:bg-canvas rounded-xl p-1 -m-1">
              <span className={`w-2 h-2 mt-1.5 rounded-full flex-none ${isRead ? 'bg-line' : 'bg-brand'}`} />
              <span className="flex-1 flex flex-col"><span className={`text-sm ${isRead ? '' : 'font-semibold'}`}>{n.t}</span><span className="text-[13px] text-muted">{n.s}</span></span>
              <span className="text-xs text-muted whitespace-nowrap">{ago(n.at)}</span>
            </Link>
          ); })}
          <div className="flex justify-between gap-2 border-t border-line pt-2"><button onClick={() => { setNotifs((L) => L.map((x) => (x.to.includes(role) ? { ...x, readBy: Array.from(new Set([...x.readBy, uname])) } : x)).filter((x) => !(x.to.length === 1 && x.to[0] === role))); setMsgs((L) => L.map((x) => (x.to.includes(role) ? { ...x, readBy: Array.from(new Set([...x.readBy, me.name])) } : x))); }} className="text-xs font-semibold underline">Mark all read &amp; clear</button><button onClick={() => setAll(!all)} className="text-xs font-semibold underline">{all ? 'Show fewer' : 'See all notifications'}</button></div>
        </div>
      )}
      {open && (
        <div role="menu" className="absolute right-0 top-14 z-40 w-80 max-w-[92vw] bg-white rounded-2xl shadow-card p-3 flex flex-col gap-1">
          <div className="flex items-center gap-3 p-2">
            {/* The picture itself is an upload button (camera badge). */}
            <label title="Upload your photo" className="relative flex-none cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-black"><Avatar name={me.name} photo={prof.photo} size={44} /><span aria-hidden className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-white border border-line text-[10px] flex items-center justify-center">📷</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload your photo" className="sr-only" onChange={pickPhoto} /></label><span className="flex flex-col"><strong className="text-sm">{me.name}</strong><span className="text-xs text-muted">{me.level} · {SU ? 'All branches' : BRANCHES.find((b) => b.id === session?.branch)?.short} · @{uname}</span></span></div>
          {photoMsg && <span role={photoMsg.err ? 'alert' : 'status'} className={`px-3 text-xs ${photoMsg.err ? 'text-danger' : 'text-ok'}`}>{photoMsg.text}</span>}
          <button role="menuitem" onClick={openProfile} className={item}>👤 My profile &amp; photo</button>
          <button role="menuitem" onClick={() => { setPw({ cur: '', n1: '', n2: '', pin: '', err: '', ok: '' }); setModal('pw'); setOpen(false); }} className={item}><Icon name="lock" /> My account &amp; password</button>
          <Link role="menuitem" to="/staff" onClick={() => setOpen(false)} className={item}><Icon name="user" /> My sign-in, ID card, payslips &amp; leave</Link>
          {SU && <button role="menuitem" onClick={() => { setM(blankMsg); setModal('msg'); setOpen(false); }} className={item}><Icon name="messages" /> Send a message to staff</button>}
          {SU && <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className={item}><Icon name="settings" /> Settings</Link>}
          {SU && <Link role="menuitem" to="/backup" onClick={() => setOpen(false)} className={item}><Icon name="backup" /> Backup &amp; restore</Link>}
          <button role="menuitem" onClick={signOut} className={`${item} text-danger`}><Icon name="signOut" /> Sign out</button>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-[350] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setModal('')}>
          <section role="dialog" aria-modal="true" aria-label={modal === 'profile' ? 'My profile' : modal === 'pw' ? 'My account & password' : 'Send a message to staff'} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 flex flex-col gap-3">
            <div className="flex justify-between"><h2 className="m-0 text-xl font-semibold">{modal === 'profile' ? 'My profile & photo' : modal === 'pw' ? 'My account & password' : 'Send a message to staff'}</h2><button onClick={() => setModal('')} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button></div>
            {modal === 'profile' && <>
              {/* The photo is saved as soon as it is chosen (no need to press "Save profile"). */}
              <div className="flex items-center gap-3"><Avatar name={me.name} photo={prof.photo} size={64} /><label className="btn-ghost cursor-pointer focus-within:ring-2 focus-within:ring-black">{prof.photo ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickPhoto} /></label>{prof.photo && <button onClick={() => savePhoto('')} className="text-xs underline">Remove</button>}</div>
              {photoMsg && <span role={photoMsg.err ? 'alert' : 'status'} className={`text-sm ${photoMsg.err ? 'text-danger' : 'text-ok'}`}>{photoMsg.text}</span>}
              <span className="text-xs text-muted">JPG, PNG or WebP · shows on your ID card, the side menu and receipts you print.</span>
              <label className="label">Phone<input value={pf.phone} onChange={(e) => setPf({ ...pf, phone: e.target.value })} placeholder="+233 24 000 0000" className="field" /></label>
              <label className="label">Email<input value={pf.email} onChange={(e) => setPf({ ...pf, email: e.target.value })} className="field" /></label>
              <div className="text-sm rounded-2xl bg-canvas p-3"><span className="text-muted">My branch · </span><b>{SU ? 'All branches (Admin)' : BRANCHES.find((b) => b.id === session?.branch)?.name}</b><br /><span className="text-xs text-muted">Only the Admin can move you to another branch.</span></div>
              <div className="flex gap-2 flex-wrap"><button onClick={() => { setProfiles((all) => ({ ...all, [uname]: { ...all[uname], phone: pf.phone, email: pf.email } })); setModal(''); }} className="btn-primary">Save profile</button><button onClick={() => setModal('pw')} className="btn-ghost">Change password or PIN</button></div>
            </>}
            {modal === 'pw' && <>
              <span className="text-sm text-muted">Signed in as <b className="text-black">{uname}</b> · {me.level}. Use a password only you know.</span>
              <label className="label">Current password<input type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" className="field" /></label>
              <label className="label">New password<input type="password" value={pw.n1} onChange={(e) => setPw({ ...pw, n1: e.target.value })} autoComplete="new-password" className="field" /></label>
              <label className="label">Confirm new password<input type="password" value={pw.n2} onChange={(e) => setPw({ ...pw, n2: e.target.value })} autoComplete="new-password" className="field" /></label>
              <label className="label">New 6-digit passcode (optional)<input inputMode="numeric" maxLength={6} value={pw.pin} onChange={(e) => setPw({ ...pw, pin: e.target.value.replace(/\D/g, '') })} className="field" /></label>
              {pw.err && <span role="alert" className="text-sm text-danger">{pw.err}</span>}
              <NoticeModal msg={pw.ok} onClose={() => setPw({ ...pw, ok: '' })} />
              <button onClick={() => { const C = creds(); const curPw = C[uname]?.pw || acc?.password; if (pw.cur !== curPw) return setPw({ ...pw, err: '401 Unauthorized · Your current password is not right.', ok: '' }); if (pw.n1 && pwProblem(pw.n1, uname)) return setPw({ ...pw, err: `422 Unprocessable Content · ${pwProblem(pw.n1, uname)}`, ok: '' }); if (pw.n1 && pw.n1 === curPw) return setPw({ ...pw, err: '422 Unprocessable Content · Choose a password you have not used before.', ok: '' }); if (pw.n1 !== pw.n2) return setPw({ ...pw, err: '422 Unprocessable Content · The two new passwords do not match.', ok: '' }); if (pw.pin && !/^\d{6}$/.test(pw.pin)) return setPw({ ...pw, err: '422 Unprocessable Content · The passcode is 6 digits.', ok: '' }); if (pw.pin && (/^(\d)\1{5}$/.test(pw.pin) || '0123456789'.includes(pw.pin) || '9876543210'.includes(pw.pin))) return setPw({ ...pw, err: '422 Unprocessable Content · That passcode is too easy to guess. Avoid repeats and runs like 123456.', ok: '' }); if (!pw.n1 && !pw.pin) return setPw({ ...pw, err: 'Type a new password or a new passcode.', ok: '' }); credSet(uname, { ...(pw.n1 ? { pw: pw.n1, force: false } : {}), ...(pw.pin ? { passcode: pw.pin } : {}) }); secLog('Password changed', `${me.name} changed ${[pw.n1 && 'their password', pw.pin && 'their passcode'].filter(Boolean).join(' and ')}`, 'low', uname); { const mySid = (JSON.parse(localStorage.getItem('ecompos.session') || 'null') as { sid?: string } | null)?.sid; if (mySid) endOtherSessions(uname, mySid); } setPw({ cur: '', n1: '', n2: '', pin: '', err: '', ok: '✓ Saved. Use it the next time you sign in.' }); }} className="btn-primary w-fit">Save</button>
            </>}
            {modal === 'msg' && <>
              <label className="label">Title<input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} placeholder="e.g. Stock count on Saturday" className="field" /></label>
              <label className="label flex flex-col gap-1">Message<textarea rows={4} value={m.body} onChange={(e) => setM({ ...m, body: e.target.value })} className="w-full p-3 rounded-2xl border border-line text-sm font-normal" /></label>
              <span className="text-[13px] font-semibold">Send to</span>
              {/* Either whole groups (by role and branch) or particular people picked by name. */}
              <div className="flex gap-1 p-1 rounded-full bg-canvas w-fit" role="group" aria-label="Send to groups or particular people">{([['roles', 'Groups'], ['people', 'Particular people']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={m.mode === v} onClick={() => setM({ ...m, mode: v, err: '' })} className={`h-8 px-3.5 rounded-full text-xs ${m.mode === v ? 'bg-white font-semibold shadow-sm' : 'text-muted'}`}>{l}</button>)}</div>
              {m.mode === 'roles' ? <>
                <div className="flex gap-1.5 flex-wrap">{([['manager', 'Managers'], ['supervisor', 'Supervisors'], ['staff', 'Sales staff'], ['rider', 'Riders']] as const).map(([v, l]) => <button key={v} aria-pressed={m.to.includes(v)} onClick={() => setM({ ...m, to: m.to.includes(v) ? m.to.filter((x) => x !== v) : [...m.to, v] })} className={`text-xs px-3 py-1.5 rounded-full border ${m.to.includes(v) ? 'bg-black text-white border-black' : 'border-line'}`}>{m.to.includes(v) ? '✓ ' : ''}{l}</button>)}</div>
                <label className="label">Branch<select value={m.br} onChange={(e) => setM({ ...m, br: e.target.value })} className="field"><option value="all">All branches</option>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              </> : <>
                <input value={m.q} onChange={(e) => setM({ ...m, q: e.target.value })} placeholder="Search by name, role or branch" aria-label="Search employees" className="field" />
                <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto rounded-2xl border border-line p-1.5" role="group" aria-label="Employees">
                  {people.filter((p) => !m.q.trim() || `${p.name} ${p.level} ${p.brName}`.toLowerCase().includes(m.q.trim().toLowerCase())).map((p) => { const on = m.who.includes(p.name); return (
                    <label key={p.name} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer text-sm ${on ? 'bg-canvas' : 'hover:bg-canvas'}`}><input type="checkbox" checked={on} onChange={() => setM({ ...m, who: on ? m.who.filter((x) => x !== p.name) : [...m.who, p.name], err: '' })} className="w-4 h-4 accent-brand flex-none" /><span className="flex-1 min-w-0 truncate"><b className="font-medium">{p.name}</b> <span className="text-muted">· {p.level} · {p.brName}</span></span></label>
                  ); })}
                </div>
                <span className="text-xs text-muted">{m.who.length ? `${m.who.length} selected: ${m.who.join(', ')}` : 'Tick one or more people.'}</span>
              </>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.confirm} onChange={() => setM({ ...m, confirm: !m.confirm })} className="w-4 h-4 accent-brand" />Ask each person to confirm they have read it</label>
              {m.err && <span role="alert" className="text-sm text-danger">{m.err}</span>}
              <button onClick={() => { if (m.title.trim().length < 3 || m.body.trim().length < 5) return setM({ ...m, err: '422 Unprocessable Content · Add a title and the message.' }); const byName = m.mode === 'people'; if (byName ? !m.who.length : !m.to.length) return setM({ ...m, err: byName ? 'Tick at least one person.' : 'Choose who should get it.' }); const picked = people.filter((p) => m.who.includes(p.name)); setMsgs([{ id: 'sm' + Date.now(), from: me.name, title: m.title.trim(), body: m.body.trim(), to: byName ? Array.from(new Set(picked.map((p) => p.role))) : m.to, br: byName ? 'all' : m.br, ...(byName ? { who: m.who } : {}), confirm: m.confirm, readBy: [], at: Date.now() }, ...msgs]); setModal(''); }} className="btn-primary w-fit">Send message</button>
              {msgs.length > 0 && <div className="flex flex-col gap-1.5 border-t border-line pt-2"><strong className="text-sm">Sent messages</strong>{msgs.slice(0, 5).map((x) => <span key={x.id} className="text-xs"><b>{x.title}</b>{x.who?.length ? ` · to ${x.who.join(', ')}` : ''} · {ago(x.at)} ago · read by {x.readBy.length ? x.readBy.join(', ') : 'no one yet'}</span>)}</div>}
            </>}
          </section>
        </div>
      )}
    </div>
  );
}
