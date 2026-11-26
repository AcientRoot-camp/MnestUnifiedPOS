import { useNavigate } from 'react-router-dom';
import { ACCOUNTS } from '../data/nav';
import { usePersist, writeKey } from '../lib/persist';
import { useSession } from '../lib/session';
import { devLog, mfaOk, onDefaultPw, SUPPORT } from '../lib/sec';
import type { Notice } from '../pages/admin/dev/Updates';
import type { StaffMsg } from './TopBar';
import { useState } from 'react';
import { portalUrl } from '../lib/site';

/** Training watermark, notices from MNest UnifiedPOS Support, and the "viewing as" banner for support. */
export default function SystemOverlays() {
  const { session, signIn, signOut } = useSession();
  const nav = useNavigate();
  const [train] = usePersist('ecompos.training2', { on: false });
  const [notices, setNotices] = usePersist<Notice[]>('ecompos.announcements', []);
  const [meta] = usePersist<Record<string, { held?: string; heldNote?: string }>>('ecompos.companyMeta', {});
  const [msgs, setMsgs] = usePersist<StaffMsg[]>('ecompos.staffMsgs', []);
  const [later, setLater] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem('ecompos.later') || '[]'); } catch { return []; } });
  const snooze = (id: string) => { const n2 = [...later, id]; setLater(n2); try { sessionStorage.setItem('ecompos.later', JSON.stringify(n2)); } catch { /* blocked */ } };
  const [view] = usePersist<{ as: string; name: string; issue?: string } | null>('ecompos.devView', null);
  if (!session) return null;
  const held = session.role !== 'developer' ? meta.main?.held : '';
  if (held) return (
    <div className="fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="hold-h" className="bg-white w-full max-w-md rounded-[28px] p-6 flex flex-col gap-3 text-center items-center">
        <span className="text-3xl">⏸</span>
        <h2 id="hold-h" className="m-0 text-xl font-semibold">Company account on hold</h2>
        <p className="m-0 text-sm text-sub">Ebenezer Unique Ventures is on hold · {held}. Nobody in the company can work until it is settled. {session.role === 'superuser' ? 'Please contact MNest UnifiedPOS Support to settle the licence.' : 'Please speak to your Admin.'}</p>
        <button onClick={() => { window.localStorage.removeItem('ecompos.session'); window.location.href = portalUrl(); }} className="btn-primary">Sign out</button>
      </div>
    </div>
  );
  const me = session.name;
  const pending = notices.filter((n) => n.state !== 'Cancelled' && n.to.includes(session.role) && !n.seen.includes(me));
  const n = pending.filter((x) => !later.includes(x.id))[0];
  const sm = msgs.filter((x) => x.to.includes(session.role) && (x.br === 'all' || x.br === session.branch) && !x.readBy.includes(me) && x.from !== me && !later.includes(x.id))[0];
  const viewing = view && view.as === session.username && session.role !== 'developer' && session.via === 'support';
  const weakPw = !viewing && session.username && onDefaultPw(session.username) && !later.includes('pw:' + session.username);
  return (
    <>
      {train.on && (
        <>
          <div aria-hidden className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center overflow-hidden"><span className="text-[64px] sm:text-[96px] font-extrabold tracking-[0.2em] text-danger/[0.07] -rotate-[22deg] whitespace-nowrap select-none">TRAINING MODE</span></div>
          <div role="status" className="sticky top-0 z-40 bg-danger text-white text-center text-xs font-bold tracking-wider py-1">TRAINING MODE · practice data only, not for real sales</div>
        </>
      )}
      {weakPw && (
        <div role="alert" className="sticky top-0 z-40 bg-black text-white text-sm px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
          <span>🔐 Zero Trust · you are still using a shared default password. Anyone who knows it could sign in as you. Change it now.</span>
          <button onClick={() => window.dispatchEvent(new CustomEvent('ecompos:openMe'))} className="h-8 px-3 rounded-full bg-white text-black text-xs font-semibold">Change my password</button>
          <button onClick={() => snooze('pw:' + session.username)} className="text-xs underline text-white/80">Remind me later</button>
        </div>
      )}
      {viewing && (
        <div role="status" className="sticky top-0 z-40 bg-[#f2b705] text-black text-sm px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
          <span>You are viewing <b>{view!.name}</b>’s account as MNest UnifiedPOS Support · everything you do is logged against support</span>
          <button onClick={() => { const sup = ACCOUNTS.find((a) => a.role === 'developer')!; devLog(`Came back from ${view!.name}'s account`, 'User accounts', view!.issue || ''); writeKey('ecompos.devView', null); if (!mfaOk(SUPPORT)) { signOut(); nav('/'); return; } signIn(sup, ''); nav('/developer/accounts'); }} className="h-8 px-3 rounded-full bg-black text-white text-xs font-semibold">Back to the Developer console</button>
        </div>
      )}
      {sm && !n && !viewing && (
        <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="sm-h" className="bg-white w-full max-w-md rounded-[28px] p-6 flex flex-col gap-3">
            <span className="text-xs font-semibold text-brand uppercase tracking-wider">Message from {sm.from} (Admin)</span>
            <h2 id="sm-h" className="m-0 text-xl font-semibold">{sm.title}</h2>
            <p className="m-0 text-sm text-sub leading-6 whitespace-pre-line">{sm.body}</p>
            <div className="flex gap-2 flex-wrap"><button onClick={() => setMsgs((L) => L.map((x) => (x.id === sm.id ? { ...x, readBy: [...x.readBy, me] } : x)))} className="btn-primary">{sm.confirm ? 'I have read it' : 'Got it'}</button><button onClick={() => snooze(sm.id)} className="btn-ghost">Remind me later</button></div>
            {sm.confirm && <span className="text-xs text-muted">The Admin asked everyone to confirm they have read this.</span>}
          </div>
        </div>
      )}
      {n && !viewing && (
        <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="ntc-h" className="bg-white w-full max-w-md rounded-[28px] p-6 flex flex-col gap-3">
            <span className="text-xs font-semibold text-brand uppercase tracking-wider">{n.kind} · from MNest UnifiedPOS Support</span>
            <h2 id="ntc-h" className="m-0 text-xl font-semibold">{n.title}</h2>
            <p className="m-0 text-sm text-sub leading-6">{n.msg}</p>
            <span className="text-xs text-muted">{n.when} · about {n.dur}{n.offline ? ' · tills keep selling offline' : ''}</span>
            <div className="flex gap-2 flex-wrap"><button onClick={() => setNotices((L) => L.map((x) => (x.id === n.id ? { ...x, seen: [...x.seen, me] } : x)))} className="btn-primary">Got it</button><button onClick={() => snooze(n.id)} className="btn-ghost">Remind me later</button></div>
          </div>
        </div>
      )}
    </>
  );
}
