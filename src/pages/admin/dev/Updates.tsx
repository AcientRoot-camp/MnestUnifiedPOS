import { useState } from 'react';
import { usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { TASKS0 } from './data';
import { B, Chips, Err, F, Sec, Tag, inp, ta, useDev } from './ui';
import NoticeModal from '../../../components/Notice';

export type Notice = { id: string; kind: string; title: string; msg: string; when: string; whenTs: number; dur: string; offline: boolean; to: string[]; seen: string[]; state: 'Scheduled' | 'Sent' | 'Cancelled'; by: string };
const KINDS: [string, string][] = [['update', 'System update'], ['maint', 'Scheduled maintenance'], ['notice', 'General notice']];
const AUD: [string, string][] = [['superuser', 'Admin'], ['manager', 'Managers'], ['supervisor', 'Supervisors'], ['staff', 'Sales staff'], ['rider', 'Riders']];
const slot = (k: string, date: string, time: string) => { const d = new Date(); if (k === 'tonight') { d.setHours(23, 0, 0, 0); } else if (k === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); } else if (k === 'sunday') { d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(21, 0, 0, 0); } else return new Date(`${date}T${time || '00:00'}`); return d; };
const suggest = (k: string, when: string, dur: string, off: boolean) => (k === 'notice' ? 'Hello team, ' : `MNest UnifiedPOS will ${k === 'update' ? 'update to version 2.5.0 (faster offline sync and a new E-VAT receipt format)' : 'be down for maintenance'} on ${when} for about ${dur}. ${off ? 'Tills keep selling offline and sync afterwards.' : 'Please finish open sales before then.'} No action is needed.`);

export default function Updates() {
  const { act, locked } = useDev();
  const [L, setL] = usePersist<Notice[]>('ecompos.announcements', []);
  const [runs, setRuns] = usePersist<Record<string, string>>('ecompos.taskRuns', {});
  const [busy, setBusy] = useState('');
  const [k, setK] = useState('update');
  const [title, setTitle] = useState('MNest UnifiedPOS 2.5.0 update');
  const [sl, setSl] = useState('tonight');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('22:00');
  const [dur, setDur] = useState('30 minutes');
  const [off, setOff] = useState(true);
  const [to, setTo] = useState(['superuser', 'manager', 'supervisor', 'staff']);
  const whenD = slot(sl, date, time);
  const whenTxt = isNaN(+whenD) ? '—' : whenD.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const [msg, setMsg] = useState('');
  const text = msg || suggest(k, whenTxt, dur, off);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const send = () => {
    setOk('');
    if (locked) return setErr('423 Locked · Support access is paused by the Admin.');
    if (title.trim().length < 4) return setErr('422 Unprocessable Content · Add a title.');
    if (text.trim().length < 10) return setErr('422 Unprocessable Content · Write the message.');
    if (sl === 'custom' && (isNaN(+whenD) || whenD.getTime() < Date.now())) return setErr('422 Unprocessable Content · Pick a date and time in the future.');
    if (!to.length) return setErr('422 Unprocessable Content · Choose who should see it.');
    const n: Notice = { id: 'N' + Date.now(), kind: KINDS.find((x) => x[0] === k)![1], title: title.trim(), msg: text.trim(), when: whenTxt, whenTs: whenD.getTime(), dur, offline: off, to, seen: [], state: 'Scheduled', by: 'MNest UnifiedPOS Support' };
    setL([n, ...L]);
    act(`Scheduled notice “${n.title}” for ${whenTxt} · to ${to.map((x) => AUD.find((a) => a[0] === x)?.[1]).join(', ')}`, 'Updates & maintenance');
    setOk(`✓ Scheduled · users see it as a pop-up from now and it stays in their notifications.`); setErr('');
  };
  const run = (id: string, name: string) => { if (locked) return; setBusy(id); setTimeout(() => { const r = { db: 'Healthy · 2,140 old sessions removed · 18 ms queries', evat: '3 receipts re-sent · all accepted by GRA', idx: '1,214 products re-indexed', restore: 'Restored to a test copy in 4 min · all tables match', keys: 'New Paystack and MoMo keys active · old keys revoked' }[id] || 'Done'; setRuns({ ...runs, [id]: `${r} · today ${new Date().toTimeString().slice(0, 5)}` }); setBusy(''); act(`${name} · ${r}`, 'Updates & maintenance'); }, 1200); };
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr] items-start">
      <Sec title="Updates" sub={<>Running <b className="text-black">MNest UnifiedPOS 2.4.1</b> · Available: 2.5.0 · faster offline sync, new E-VAT receipt format</>}>
        <div role="form" aria-label="Notify users" className="flex flex-col gap-3">
          <strong className="text-sm">Notify users</strong>
          <div className="flex gap-2 items-center flex-wrap"><span className="text-[13px] font-semibold">Type</span><Chips label="Notice type" value={k} onChange={(v) => { setK(v); setMsg(''); setTitle(v === 'update' ? 'MNest UnifiedPOS 2.5.0 update' : v === 'maint' ? 'Scheduled maintenance' : ''); }} opts={KINDS} /></div>
          <F l="Title"><input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></F>
          <F l="Message to users · write your own or edit the suggestion" note={`${600 - text.length} characters left`}><textarea rows={4} maxLength={600} value={text} onChange={(e) => setMsg(e.target.value)} className={ta} /></F>
          <div className="flex gap-2 items-center flex-wrap"><span className="text-[13px] font-semibold">When</span><Chips label="When" value={sl} onChange={setSl} opts={[['tonight', 'Tonight 23:00'], ['tomorrow', 'Tomorrow 06:00'], ['sunday', 'Sunday 21:00'], ['custom', 'Pick a date and time']]} /></div>
          {sl === 'custom' && <div className="grid grid-cols-2 gap-2"><F l="Date"><input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></F><F l="Time"><input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={inp} /></F></div>}
          <div className="flex gap-3 items-end flex-wrap"><F l="Expected duration"><select value={dur} onChange={(e) => setDur(e.target.value)} className={cx(inp, 'w-44')}>{['15 minutes', '30 minutes', '1 hour', '2 hours'].map((x) => <option key={x}>{x}</option>)}</select></F><label className="flex items-center gap-2 text-sm h-10"><input type="checkbox" checked={off} onChange={() => setOff(!off)} className="w-4 h-4 accent-brand" />Tills keep selling offline</label></div>
          <div className="flex gap-2 items-center flex-wrap"><span className="text-[13px] font-semibold">Send to</span>{AUD.map(([v, l]) => <button key={v} role="checkbox" aria-checked={to.includes(v)} onClick={() => setTo(to.includes(v) ? to.filter((x) => x !== v) : [...to, v])} className={cx('text-xs px-3 py-1.5 rounded-full border', to.includes(v) ? 'bg-black text-white border-black font-semibold' : 'border-line')}>{to.includes(v) ? '✓' : '+'} {l}</button>)}</div>
          <div className="rounded-2xl bg-canvas p-3 text-sm"><strong>Preview · </strong>{title || 'Title'} — {text} <span className="text-xs text-muted">({whenTxt} · {dur})</span></div>
          <Err e={err} />
          <NoticeModal msg={ok} onClose={() => setOk('')} />
          <button onClick={send} disabled={locked} className={cx(B.primary, 'w-fit')}>Schedule &amp; notify users</button>
          <span className="text-xs text-muted">Users see it as a pop-up when they sign in or while they are using the system, and it stays in their notifications.</span>
        </div>
        {L.length > 0 && <div className="flex flex-col gap-2"><strong className="text-sm">Sent notices</strong>{L.map((n) => <div key={n.id} className={cx('p-3 rounded-2xl border border-line flex items-center gap-3 flex-wrap', n.state === 'Cancelled' && 'opacity-60')}><span className="flex-1 min-w-[200px] flex flex-col"><strong className="text-sm">{n.title}</strong><span className="text-xs text-muted">{n.kind} · {n.when} · {n.to.map((x) => AUD.find((a) => a[0] === x)?.[1]).join(', ')}</span><span className="text-xs">Seen by {n.seen.length ? n.seen.join(', ') : 'no one yet'}</span></span><Tag t={n.state} tone={n.state === 'Cancelled' ? 'mute' : 'info'} />{n.state !== 'Cancelled' && <button onClick={() => { setL(L.map((x) => (x.id === n.id ? { ...x, state: 'Cancelled' } : x))); act(`Cancelled notice “${n.title}”`, 'Updates & maintenance'); }} className={B.sm}>Cancel</button>}</div>)}</div>}
      </Sec>
      <Sec title="Maintenance tasks">
        {TASKS0.map((t) => <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-canvas flex-wrap"><span className="flex-1 min-w-[180px] flex flex-col"><strong className="text-sm">{t.name}</strong><span className={cx('text-xs', runs[t.id] ? 'text-ok' : 'text-muted')}>{runs[t.id] ? `✓ ${runs[t.id]}` : t.last}</span></span><button disabled={!!busy || locked} onClick={() => run(t.id, t.name)} className={B.sm}>{busy === t.id ? 'Running…' : t.btn}</button></div>)}
      </Sec>
    </div>
  );
}
