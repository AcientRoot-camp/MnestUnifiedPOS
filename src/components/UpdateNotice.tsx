// POS update pop-ups, for every signed-in user (mounted in App.tsx):
//   1. "A new update is ready": a newer version was deployed while this screen was open. It offers to reload now, or
//      later so a sale in progress can be finished first (it asks again after 10 minutes).
//   2. "What's new": after signing in on the new version, the changes are listed (data/releases.ts). The user has to
//      scroll to the end and tick that they have read them before the window can be closed. It does not close with
//      Esc or by tapping outside. Each user sees each release once on each device.
import { useEffect, useRef, useState } from 'react';
import { RELEASES } from '../data/releases';
import { useSession } from '../lib/session';

/** How often an open screen checks for a newer deploy (it also checks when the screen is looked at again). */
const CHECK_MS = 5 * 60 * 1000;
const LATER_MS = 10 * 60 * 1000;

/** The built app's main script name (it changes with every deploy), read from a page's HTML. '' if not found. */
const buildOf = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? '';

/** True once the server is serving a different build from the one running here. Never true on the dev server. */
function useNewBuild() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mine = buildOf(document.documentElement.innerHTML);
    if (!mine) return;
    let stop = false;
    const check = async () => {
      try {
        // A fresh copy of the home page, skipping every cache. Offline or an error page: try again later.
        const r = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        const live = r.ok ? buildOf(await r.text()) : '';
        if (!stop && live && live !== mine) setReady(true);
      } catch { /* offline */ }
    };
    const t = window.setInterval(check, CHECK_MS);
    const seen = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', seen);
    window.addEventListener('online', check);
    void check();
    return () => { stop = true; window.clearInterval(t); document.removeEventListener('visibilitychange', seen); window.removeEventListener('online', check); };
  }, []);
  return ready;
}

/** The shared dark backdrop and white card. */
const Shell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="no-print fixed inset-0 z-[900] bg-black/60 flex items-center justify-center p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby={label} className="bg-white w-full max-w-lg max-h-[calc(100dvh-32px)] rounded-[28px] p-6 flex flex-col gap-3 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">{children}</div>
  </div>
);

/**
 * "What's new": every release this user has not read yet, newest first. Inputs: user (username, keys the memory on
 * this device). Renders nothing once the newest release has been read.
 */
function WhatsNew({ user }: { user: string }) {
  const memo = `ecompos.readRelease.${user}`;
  const [pending, setPending] = useState(() => {
    let last = '';
    try { last = localStorage.getItem(memo) || ''; } catch { /* storage blocked */ }
    const at = RELEASES.findIndex((r) => r.id === last);
    // Never read any (new user or device): show just the latest. Otherwise everything newer than the last one read.
    return at === -1 ? RELEASES.slice(0, 1) : RELEASES.slice(0, at);
  });
  const list = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [ticked, setTicked] = useState(false);
  /** Remembers that the end of the list has been seen (at once if it all fits without scrolling). */
  const look = () => { const el = list.current; if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setAtEnd(true); };
  useEffect(() => { look(); window.addEventListener('resize', look); return () => window.removeEventListener('resize', look); }, [pending.length]);
  if (!pending.length) return null;
  const close = () => { try { localStorage.setItem(memo, RELEASES[0].id); } catch { /* storage blocked */ } setPending([]); };
  return (
    <Shell label="wn-h">
      <span className="text-xs font-semibold text-brand uppercase tracking-wider">The system has been updated</span>
      <h2 id="wn-h" className="m-0 text-xl font-semibold">What’s new</h2>
      <div ref={list} onScroll={look} tabIndex={0} aria-label="List of changes" className="flex-1 min-h-[120px] overflow-y-auto flex flex-col gap-4 pr-1">
        {pending.map((r) => (
          <section key={r.id} className="flex flex-col gap-2">
            <div className="flex flex-col"><b className="text-[15px]">{r.title}</b><span className="text-xs text-muted">{r.date}</span></div>
            <ol className="m-0 p-0 list-none flex flex-col gap-2">
              {r.changes.map(([name, what], i) => <li key={name} className="rounded-2xl bg-canvas p-3 flex gap-3"><span aria-hidden className="w-6 h-6 flex-none rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">{i + 1}</span><span className="text-sm leading-relaxed"><b className="block">{name}</b>{what}</span></li>)}
            </ol>
          </section>
        ))}
      </div>
      {!atEnd && <span role="status" className="text-sm font-medium" style={{ color: '#8a4b00' }}>↓ Scroll down to read all the changes.</span>}
      <label className={`flex items-start gap-2.5 text-sm font-medium ${atEnd ? 'cursor-pointer' : 'opacity-50'}`}><input type="checkbox" disabled={!atEnd} checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-0.5 w-5 h-5 flex-none accent-black" /><span>I have read what has changed.</span></label>
      <button onClick={close} disabled={!atEnd || !ticked} className="btn-primary h-12 justify-center disabled:opacity-40 disabled:cursor-not-allowed">Close</button>
    </Shell>
  );
}

/** Both pop-ups. The "update ready" one takes priority over reading the notes of the version now running. */
export default function UpdateNotice() {
  const { session } = useSession();
  const fresh = useNewBuild();
  const [later, setLater] = useState(false);
  useEffect(() => { if (!later) return; const t = window.setTimeout(() => setLater(false), LATER_MS); return () => window.clearTimeout(t); }, [later]);
  if (!session) return null;
  const user = session.username || session.role;
  return (
    <>
      <WhatsNew key={user} user={user} />
      {fresh && !later && (
        <Shell label="up-h">
          <span className="text-xs font-semibold text-brand uppercase tracking-wider">System update</span>
          <h2 id="up-h" className="m-0 text-xl font-semibold">A new update is ready</h2>
          <p className="m-0 text-sm text-sub leading-relaxed">The system has been updated. Finish any sale you are making first (park it to keep it), then update. After updating you will see what has changed.</p>
          <div className="flex gap-2 flex-wrap"><button onClick={() => window.location.reload()} className="btn-primary">Update now</button><button onClick={() => setLater(true)} className="btn-ghost">Later · remind me in 10 minutes</button></div>
        </Shell>
      )}
    </>
  );
}
