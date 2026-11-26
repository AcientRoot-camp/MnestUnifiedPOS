// People & HR tabs: Onboarding (§4.3), Leave (§4.7), Performance (§4.8), Documents (§4.9) and Roles & devices
// (§4.10), from GTeam.md. Each reads and writes the shared HR records (shared.tsx useHr) and uses the rules in data/hr.
import { useState } from 'react';
import { inLastDays } from '../../../data/clock';
import { ENT, MATRIX0, OWNER_COLOR, DEVICES0, ROLE_COLS, clashWith, docState, leaveLeft, nextPerm, onbDone, onbSteps, perfScore, type Device, type DocType, type Perm } from '../../../data/hr';
import { SALES } from '../../../data/sell';
import type { Emp } from '../../../data/people';
import { usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { Card } from '../../finance/shared';
import { Switch } from '../../money/ui';
import { Avatar, brTxt, outbox, type HrData } from './shared';

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const startOf = (d: HrData, e: Emp) => d.hrx[e.name]?.start || `${e.since}-01-01`;

/* ======================================================================= Onboarding */

export function Onboarding({ d, staff }: { d: HrData; staff: Emp[] }) {
  const active = staff.filter((e) => e.status === 'Active' || e.status === 'On leave').sort((a, b) => startOf(d, b).localeCompare(startOf(d, a)));
  const [who, setWho] = useState(active[0]?.name || '');
  const e = active.find((x) => x.name === who) || active[0];
  if (!e) return <Card title="Onboarding">No active staff yet.</Card>;
  const steps = onbSteps(e); const done = onbDone(e, d.onb, d.docs);
  const pct = (x: Emp) => Math.round((onbDone(x, d.onb, d.docs).size / onbSteps(x).length) * 100);
  const tick = (k: string) => { const cur = { ...(d.onb[e.name] || {}) }; if (cur[k]) delete cur[k]; else cur[k] = new Date().toISOString().slice(0, 10); d.setOnb({ ...d.onb, [e.name]: cur }); };
  const left = steps.filter((s) => !done.has(s.k)); const hrLeft = left.filter((s) => s.owner === 'HR').length; const empLeft = left.filter((s) => s.owner !== 'HR').length;
  const started = new Date(startOf(d, e)); const monthsIn = (Date.now() - started.getTime()) / (30.44 * 864e5);
  const tips = !left.length ? ['Onboarding is complete. Set a date to review how the first three months went.'] : [
    `${hrLeft} steps are on HR and ${empLeft} need something from ${e.name.split(' ')[0]}.`,
    `Next: ${left[0].t}.`,
    ...(left.some((s) => s.k === 'ssnit' || s.k === 'tin') ? ['SSNIT and TIN hold up the first pay run, so chase those before payday.'] : []),
    ...(left.some((s) => s.k === 'badge' || s.k === 'idcard') ? ['Without the badge and ID card they cannot sign in at the gate or be verified on the floor.'] : []),
  ];
  const fresh = active.filter((x) => (Date.now() - new Date(startOf(d, x)).getTime()) < 61 * 864e5);
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
      <Card title="Staff">{active.map((x) => <button key={x.id} onClick={() => setWho(x.name)} aria-pressed={e.name === x.name} className={cx('flex items-center justify-between gap-2 p-2.5 rounded-xl text-sm text-left', e.name === x.name ? 'bg-black text-white' : 'hover:bg-canvas')}><span className="truncate">{x.name.split(' ')[0]} · {pct(x)}%</span></button>)}</Card>
      <div className="flex flex-col gap-6">
        <section className="card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap"><Avatar e={e} hr={d.hr} s={48} /><div className="flex-1 min-w-0"><h2 className="m-0 text-xl font-semibold">{e.name}</h2><span className="text-sm text-muted">{e.title} · {brTxt(e.br)} · {monthsIn < 12 ? `Started ${started.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : `With the company ${Math.floor(monthsIn / 12)} year${monthsIn >= 24 ? 's' : ''}`}</span></div><b>{done.size} of {steps.length} done</b></div>
          <div className="h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${(done.size / steps.length) * 100}%` }} /></div>
          <ol className="m-0 p-0 list-none flex flex-col">{steps.map((s, i) => { const ok = done.has(s.k); const when = d.onb[e.name]?.[s.k]; return (
            <li key={s.k} className="flex items-start gap-3 py-2.5 border-b border-line last:border-0">
              <button onClick={() => tick(s.k)} role="checkbox" aria-checked={ok} aria-label={s.t} className={cx('w-6 h-6 rounded-lg border-2 flex-none flex items-center justify-center text-xs mt-0.5', ok ? 'bg-brand border-brand text-white' : 'border-[#ccc]')}>{ok ? '✓' : ''}</button>
              <span className="flex-1 min-w-0"><span className={cx('text-sm font-semibold', ok && 'line-through text-muted')}>{i + 1}. {s.t}</span><span className="block text-xs text-muted">{s.note}{ok && when ? ` · done ${when}` : ok && s.doc ? ' · document on file' : ''}</span></span>
              <span className="pill text-white text-[11px]" style={{ background: OWNER_COLOR[s.owner] }}>{s.owner}</span>
            </li>
          ); })}</ol>
        </section>
        <section className="card p-5 flex flex-col gap-2"><b className="text-sm">✨ What to do next</b>{tips.map((t) => <span key={t} className="text-sm p-2.5 rounded-xl bg-canvas">{t}</span>)}</section>
        <Card title="New starters">{fresh.length ? fresh.map((x) => <button key={x.id} onClick={() => setWho(x.name)} className="flex justify-between text-sm p-2 rounded-xl hover:bg-canvas"><span>{x.name} · {x.title}</span><b>{pct(x)}%</b></button>) : <span className="text-sm text-muted">Nobody joined in the last two months.</span>}</Card>
      </div>
    </div>
  );
}

/* ======================================================================= Leave */

export function Leave({ d, staff, me, say }: { d: HrData; staff: Emp[]; me: string; say: (m: string, err?: boolean) => void }) {
  const names = new Set(staff.map((e) => e.name));
  const L = d.Lv.filter((l) => names.has(l.who));
  const pend = L.filter((l) => l.status === 'pending');
  const [dec, setDec] = useState<null | { id: string; mode: 'approve' | 'decline'; note: string }>(null);
  const r = dec ? L.find((x) => x.id === dec.id) : undefined;
  const clash = r ? clashWith(r, d.Lv, d.E) : '';
  const decide = () => {
    if (!dec || !r) return;
    if (dec.mode === 'decline' && dec.note.trim().length < 4) return say('Give a reason so they know what would change the answer.', true);
    const st = dec.mode === 'approve' ? 'approved' : 'declined';
    d.setLv((x) => x.map((y) => (y.id === r.id ? { ...y, status: st, hrNote: dec.note.trim() || (st === 'approved' ? 'Approved.' : ''), decided: `${today()} · ${me}` } : y)));
    outbox(r.who, 'My HR + SMS', `Your ${r.kind.toLowerCase()} (${r.from} to ${r.to}) was ${st}. ${dec.note.trim()}`);
    setDec(null); say(`${r.who} told: leave ${st}`);
  };
  const tone = (s: string) => (s === 'pending' ? ['Waiting', 'bg-amber-100 text-amber-900'] : s === 'approved' ? ['Approved', 'bg-green-100 text-green-800'] : ['Declined', 'bg-red-100 text-red-800']);
  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card title="Leave requests" sub={pend.length ? `${pend.length} waiting for a decision` : 'Nothing waiting'}>
        {!L.length && <span className="text-sm text-muted">No leave requests yet. Book leave from an employee profile.</span>}
        {L.map((l) => { const [lbl, cls] = tone(l.status); const c = l.status === 'pending' ? clashWith(l, d.Lv, d.E) : ''; return (
          <div key={l.id} className="rounded-2xl border border-line p-3.5 flex flex-col gap-1.5">
            <div className="flex justify-between gap-2"><b className="text-sm">{l.who} · {l.kind}</b><span className={cx('pill', cls)}>{lbl}</span></div>
            <span className="text-xs text-muted">{l.from} to {l.to} · {l.days} day{l.days === 1 ? '' : 's'} · {l.note || '—'}</span>
            {c && <span className="text-xs text-[#b26a00]">⚠ {c} at the same branch is off then too</span>}
            {l.hrNote && <span className="text-xs">HR: {l.hrNote}{l.decided ? ` · ${l.decided}` : ''}</span>}
            {l.status === 'pending' && <button onClick={() => setDec({ id: l.id, mode: 'approve', note: '' })} className="btn-dark w-fit min-h-9 text-xs">Decide</button>}
          </div>
        ); })}
      </Card>
      <div className="flex flex-col gap-6">
        {r && dec && (
          <section className="card p-5 flex flex-col gap-3">
            <b>{r.who} · {r.kind} · {r.days} days</b><span className="text-xs text-muted">{r.from} to {r.to} · {r.note}</span>
            {clash && <span className="text-xs text-[#b26a00]">⚠ {clash} at the same branch is off then too</span>}
            <div className="flex gap-1 p-1 rounded-full bg-canvas w-fit">{(['approve', 'decline'] as const).map((m) => <button key={m} onClick={() => setDec({ ...dec, mode: m, note: '' })} aria-pressed={dec.mode === m} className={cx('h-9 px-4 rounded-full text-sm font-semibold', dec.mode === m ? (m === 'approve' ? 'bg-green-700 text-white' : 'bg-danger text-white') : '')}>{m === 'approve' ? 'Approve' : 'Decline'}</button>)}</div>
            <div className="flex flex-wrap gap-1.5">{(dec.mode === 'approve' ? ['Approved. Enjoy the break.', 'Approved. Hand over to your supervisor before you go.', 'Approved, cover arranged at the branch.'] : [clash ? `${clash} is already off then, so the branch would be short` : 'The branch would be short of cover on those days', 'Too close to the date — give two weeks’ notice', 'Stocktake week, please pick other dates', 'Not enough leave days left this year']).map((t) => <button key={t} onClick={() => setDec({ ...dec, note: t })} className="text-xs px-3 py-1.5 rounded-full border border-line hover:bg-canvas text-left">{t}</button>)}</div>
            <textarea rows={2} value={dec.note} onChange={(e) => setDec({ ...dec, note: e.target.value })} placeholder={dec.mode === 'approve' ? 'Note (optional)' : 'Reason'} className="p-3 rounded-2xl border border-line text-sm" />
            {dec.mode === 'decline' && <span className="text-xs text-muted">Required. {r.who.split(' ')[0]} sees this in My HR, so say what would change the answer.</span>}
            <div className="flex gap-2"><button onClick={decide} className={dec.mode === 'approve' ? 'btn-primary' : 'h-11 px-5 rounded-full bg-danger text-white font-semibold'}>{dec.mode === 'approve' ? 'Approve and tell them' : 'Decline and tell them'}</button><button onClick={() => setDec(null)} className="btn-ghost">Cancel</button></div>
          </section>
        )}
        <Card title="Leave balances" sub={`Ghana law gives at least 15 working days paid leave a year. This company allows ${ENT} days a year.`}>
          {staff.filter((e) => e.status !== 'Left').map((e) => { const left = leaveLeft(e, d.Lv); return <div key={e.id} className="flex items-center gap-3 text-sm"><span className="w-36 truncate">{e.name}</span><span className="flex-1 h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${(left / ENT) * 100}%` }} /></span><b className="w-20 text-right">{left} of {ENT}</b></div>; })}
        </Card>
      </div>
    </div>
  );
}

/* ======================================================================= Performance */

export function Performance({ d, staff }: { d: HrData; staff: Emp[] }) {
  const act = staff.filter((e) => e.status !== 'Left');
  const soldBy = (n: string) => SALES.filter((s) => s.staff === n && s.ts >= Date.now() - 30 * 864e5 && s.status !== 'voided').reduce((a, s) => a + s.total, 0);
  const maxSale = Math.max(1, ...act.map((e) => soldBy(e.name)));
  const L30 = inLastDays(d.clock, 30);
  const rows = act.map((e) => { const S = L30.filter((c) => c.name === e.name); const days = new Set(S.map((c) => c.day)).size; const late = S.filter((c) => c.late).length; const last = d.reviews.find((r) => r.name === e.name); return { e, sold: soldBy(e.name), days, late, score: perfScore(soldBy(e.name), maxSale, days, late), last }; }).sort((a, b) => b.score - a.score);
  return (
    <div className="flex flex-col gap-6">
      <Card title="Performance" sub="Ratings are worked out from till sales, attendance and reviews, so the numbers come from the system rather than memory.">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]"><thead><tr>{['Employee', 'Role', 'Sales', 'Attendance', 'Punctuality', 'Score', 'Last review'].map((h) => <th key={h} className="text-left text-xs text-muted font-semibold px-2 py-2 border-b border-line">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.e.id} className="border-b border-line"><td className="px-2 py-2 font-semibold">{r.e.name}</td><td className="px-2 py-2">{r.e.level}</td><td className="px-2 py-2 whitespace-nowrap">GHS {r.sold.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td><td className="px-2 py-2">{r.days} days in 30</td><td className="px-2 py-2">{r.late ? `${r.late} late` : 'On time'}</td>
            <td className="px-2 py-2"><span className="flex items-center gap-2"><span className="w-24 h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full" style={{ width: `${r.score}%`, background: r.score >= 70 ? '#1f7a2a' : r.score >= 45 ? '#b26a00' : '#c62828' }} /></span><b>{r.score}</b></span></td>
            <td className="px-2 py-2 text-xs">{r.last ? `${'★'.repeat(r.last.stars)} · ${r.last.at}` : '—'}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Recent reviews">{d.reviews.length ? d.reviews.slice(0, 8).map((r) => <div key={r.id} className="rounded-2xl bg-canvas p-3 flex flex-col gap-0.5"><b className="text-sm">{r.name} <span className="text-[#f2b705]">{'★'.repeat(r.stars)}</span></b><span className="text-sm">{r.note}</span><span className="text-xs text-muted">{r.by} · {r.at}</span></div>) : <span className="text-sm text-muted">No reviews written yet. Open someone in People and tap "Add a review".</span>}</Card>
    </div>
  );
}

/* ======================================================================= Documents */

export function Documents({ d, staff, say }: { d: HrData; staff: Emp[]; say: (m: string) => void }) {
  const [open, setOpen] = useState('');
  const [msgFor, setMsgFor] = useState<null | { doc: string; text: string }>(null);
  const [nt, setNt] = useState({ name: '', required: true, expires: false });
  const issues = (e: Emp) => d.types.filter((t) => docState(d.docs[e.name]?.[t.id], t.required)[2]);
  const total = staff.reduce((a, e) => a + issues(e).length, 0);
  const setDoc = (name: string, id: string, patch: Partial<NonNullable<HrData['docs'][string]>[string]>, log: string) => {
    const cur = d.docs[name]?.[id] || { state: 'missing' as const };
    d.setDocs({ ...d.docs, [name]: { ...(d.docs[name] || {}), [id]: { ...cur, ...patch, log: [{ t: log, at: today() }, ...(cur.log || [])] } } });
  };
  const e = staff.find((x) => x.name === open);
  if (e) {
    const miss = d.types.filter((t) => { const s = d.docs[e.name]?.[t.id]?.state; return t.required && (!s || s === 'missing'); });
    return (
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap"><button onClick={() => setOpen('')} className="text-sm font-semibold">← All employees</button><Avatar e={e} hr={d.hr} s={40} /><div className="flex-1"><b>{e.name}</b><br /><span className="text-xs text-muted">{e.title} · {brTxt(e.br)}</span></div>
          <button onClick={() => { miss.forEach((t) => setDoc(e.name, t.id, { state: 'asked', asked: today() }, 'Asked for by HR')); outbox(e.name, 'My HR', `Please bring: ${miss.map((t) => t.name).join(', ')}`); say(miss.length ? `${miss.length} documents requested from ${e.name}` : 'Nothing missing'); }} className="btn-dark">Request everything missing</button></div>
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]"><thead><tr>{['Name', 'Required', 'Status', 'Reference', 'Expiry', 'Filed', ''].map((h) => <th key={h} className="text-left text-xs text-muted font-semibold px-2 py-2 border-b border-line">{h}</th>)}</tr></thead>
          <tbody>{d.types.map((t) => { const doc = d.docs[e.name]?.[t.id]; const [lbl, col] = docState(doc, t.required); return <tr key={t.id} className="border-b border-line align-top">
            <td className="px-2 py-2 font-semibold">{t.name}{t.note ? <span className="block text-xs text-muted font-normal">{t.note}</span> : null}</td><td className="px-2 py-2">{t.required ? 'Required' : 'Optional'}</td><td className="px-2 py-2 font-semibold text-xs" style={{ color: col }}>{lbl}</td>
            <td className="px-2 py-2 text-xs">{doc?.ref || '—'}</td><td className="px-2 py-2 text-xs">{doc?.exp || '—'}</td><td className="px-2 py-2 text-xs">{doc?.filed || '—'}</td>
            <td className="px-2 py-2 whitespace-nowrap"><span className="flex gap-2 text-xs font-semibold">
              {doc?.state !== 'filed' && <button onClick={() => { setDoc(e.name, t.id, { state: 'asked', asked: today() }, 'Asked for by HR'); say(`${t.name} asked for`); }} className="underline">Ask</button>}
              <button onClick={() => setMsgFor({ doc: t.id, text: `Hello ${e.name.split(' ')[0]}, please bring your ${t.name.toLowerCase()} to HR this week. Thank you.` })} className="underline">Message</button>
              {doc?.state !== 'filed' ? <button onClick={() => { const ref = t.id === 'ghcard' ? window.prompt('Ghana Card number (optional)', 'GHA-') || '' : ''; const exp = t.expires ? window.prompt('Expiry date (YYYY-MM-DD, optional)', '') || '' : ''; setDoc(e.name, t.id, { state: 'filed', filed: new Date().toISOString().slice(0, 10), ref: ref || doc?.ref, exp: exp || undefined }, 'Marked received'); say(`${t.name} filed for ${e.name}`); }} className="underline text-brand">Mark received</button>
                : <button onClick={() => { setDoc(e.name, t.id, { state: 'missing', filed: undefined, ref: undefined, exp: undefined }, 'Removed from file'); say(`${t.name} removed from file`); }} className="underline text-danger">Remove from file</button>}
            </span></td></tr>; })}</tbody></table></div>
        {msgFor && <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><textarea rows={3} value={msgFor.text} onChange={(ev) => setMsgFor({ ...msgFor, text: ev.target.value })} className="p-3 rounded-2xl border border-line text-sm" /><span className="text-xs text-muted">This goes straight to the employee’s account and is kept in the document history.</span><div className="flex gap-2"><button onClick={() => { outbox(e.name, 'My HR', msgFor.text); setDoc(e.name, msgFor.doc, {}, `Message: ${msgFor.text.slice(0, 60)}`); setMsgFor(null); say(`Message sent to ${e.name}`); }} className="btn-primary">Send message</button><button onClick={() => setMsgFor(null)} className="btn-ghost">Cancel</button></div></div>}
        <div className="flex flex-col gap-1"><b className="text-sm">History</b>{d.types.flatMap((t) => (d.docs[e.name]?.[t.id]?.log || []).map((l) => ({ ...l, t2: t.name }))).slice(0, 12).map((l, i) => <span key={i} className="text-xs text-muted">{l.at} · {l.t2}: {l.t}</span>)}</div>
      </section>
    );
  }
  const byBr = [...new Set(staff.map((x) => x.br))];
  return (
    <div className="flex flex-col gap-6">
      <Card title="Employee document accounts" sub={total ? `${total} documents need attention` : 'Every required document is on file'}>
        {byBr.map((b) => <div key={b} className="flex flex-col gap-2"><b className="text-xs text-muted uppercase tracking-wider">{brTxt(b)}</b>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{staff.filter((x) => x.br === b && x.status !== 'Left').map((x) => { const req = d.types.filter((t) => t.required); const onFile = req.filter((t) => d.docs[x.name]?.[t.id]?.state === 'filed').length; const pct = Math.round((onFile / Math.max(1, req.length)) * 100); const iss = issues(x); return (
            <div key={x.id} className="rounded-2xl border border-line p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full flex items-center justify-center flex-none" style={{ background: `conic-gradient(${pct === 100 ? '#1f7a2a' : '#0b5c5c'} ${pct * 3.6}deg, #eee 0)` }}><span className="w-9 h-9 rounded-full bg-white text-[11px] font-bold flex items-center justify-center">{pct}%</span></div><div className="min-w-0"><b className="text-sm block truncate">{x.name}</b><span className="text-xs text-muted">{onFile} of {req.length} required on file</span></div></div>
              <span className={cx('text-xs font-semibold', iss.length ? 'text-[#b26a00]' : 'text-ok')}>{iss.length ? `${iss.length} documents need attention` : 'File complete'}</span>
              <div className="flex flex-wrap gap-1">{iss.slice(0, 3).map((t) => { const [lbl, col] = docState(d.docs[x.name]?.[t.id], t.required); return <span key={t.id} className="text-[11px] px-2 py-0.5 rounded-full border" style={{ color: col, borderColor: col }}>{t.name}: {lbl}</span>; })}</div>
              <button onClick={() => setOpen(x.name)} className="btn-ghost min-h-9 text-xs w-fit">Open document account</button>
            </div>
          ); })}</div></div>)}
      </Card>
      <Card title="Documents this company keeps">
        {d.types.map((t) => <div key={t.id} className="flex items-center gap-3 flex-wrap text-sm py-1.5 border-b border-line last:border-0"><span className="flex-1 min-w-[180px] font-semibold">{t.name}</span>
          <label className="flex items-center gap-1.5 text-xs">Required<Switch on={t.required} onChange={() => d.setTypes(d.types.map((y) => (y.id === t.id ? { ...y, required: !y.required } : y)))} label={`${t.name} required`} /></label>
          <label className="flex items-center gap-1.5 text-xs">Expires<Switch on={t.expires} onChange={() => d.setTypes(d.types.map((y) => (y.id === t.id ? { ...y, expires: !y.expires } : y)))} label={`${t.name} expires`} /></label>
          <button onClick={() => { if (window.confirm(`Stop keeping ${t.name}?`)) d.setTypes(d.types.filter((y) => y.id !== t.id)); }} className="text-xs underline text-danger">Remove</button></div>)}
        <div className="flex gap-2 flex-wrap items-center"><input value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} placeholder="Add a document type, e.g. Guarantor form" className="h-10 px-3.5 rounded-full border border-line text-sm flex-1 min-w-[200px]" /><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={nt.required} onChange={() => setNt({ ...nt, required: !nt.required })} />Required</label><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={nt.expires} onChange={() => setNt({ ...nt, expires: !nt.expires })} />Expires</label>
          <button onClick={() => { if (nt.name.trim().length < 3) return; const t: DocType = { id: 'dt' + Date.now(), name: nt.name.trim(), required: nt.required, expires: nt.expires }; d.setTypes([...d.types, t]); setNt({ name: '', required: true, expires: false }); say(`${t.name} added to the documents this company keeps`); }} className="btn-dark">Add</button></div>
      </Card>
    </div>
  );
}

/* ======================================================================= Roles & devices */

export function Roles({ say }: { say: (m: string) => void }) {
  const [M, setM] = usePersist<[string, Perm[]][]>('ecompos.roleMatrix', MATRIX0);
  const [alerts, setAlerts] = usePersist<Record<string, boolean>>('ecompos.hrAlerts2', { void: true, refund: true, nosign: true, drawer: false });
  const [dev, setDev] = usePersist<Device[]>('ecompos.signedDevices', DEVICES0);
  const cell = (p: Perm) => (p === 'Y' ? 'bg-brand text-white' : p === 'PIN' ? 'border-2 border-brand text-brand' : 'bg-[#eee] text-[#999]');
  return (
    <div className="flex flex-col gap-6">
      <Card title="What each role may do" sub="Tap a cell to change it: allowed, needs a PIN, or not allowed">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]"><thead><tr><th className="text-left text-xs text-muted font-semibold px-2 py-2">Action</th>{ROLE_COLS.map((r) => <th key={r} className="text-xs text-muted font-semibold px-2 py-2">{r}</th>)}</tr></thead>
          <tbody>{M.map(([a, ps], i) => <tr key={a} className="border-t border-line"><td className="px-2 py-2">{a}</td>{ps.map((p, j) => <td key={j} className="px-1 py-1.5 text-center"><button onClick={() => { const n = M.map((r, k) => (k === i ? [r[0], r[1].map((x, l) => (l === j ? nextPerm(x) : x))] as [string, Perm[]] : r)); setM(n); say(`${a} · ${ROLE_COLS[j]}: ${{ Y: 'Allowed', PIN: 'Needs a PIN', '-': 'Not allowed' }[nextPerm(p)]}`); }} aria-label={`${a} for ${ROLE_COLS[j]}: ${p}`} className={cx('w-20 h-8 rounded-full text-xs font-semibold', cell(p))}>{p === 'Y' ? 'Allowed' : p === 'PIN' ? 'PIN' : '—'}</button></td>)}</tr>)}</tbody></table></div>
        <span className="text-xs text-muted">Per-person permissions live in Users & permissions; this matrix is the role default.</span>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card title="Alerts to the Admin">{([['void', 'Voided sales', 'Instant WhatsApp to the Admin'], ['refund', 'Refunds over GHS 200', 'Instant WhatsApp'], ['nosign', 'Nobody signed in by 09:00', 'Push to the branch manager'], ['drawer', 'Drawer opened without a sale', 'Push notification']] as [string, string, string][]).map(([k, l, s]) => <div key={k} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{l}</b><br /><span className="text-xs text-muted">{s}</span></span><Switch on={!!alerts[k]} onChange={() => setAlerts({ ...alerts, [k]: !alerts[k] })} label={l} /></div>)}</Card>
        <Card title="Signed-in devices">{dev.map((x) => <div key={x.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{x.name}</b> · {x.kind}<br /><span className="text-xs text-muted">{x.state || x.seen}</span></span>{x.state ? <span className="pill bg-[#eee] text-[#555]">{x.state}</span> : <button onClick={() => { setDev(dev.map((y) => (y.id === x.id ? { ...y, state: 'Locked' } : y))); say(`${x.name} signed out and locked`); }} className="text-xs font-semibold underline text-danger">Sign out &amp; lock</button>}</div>)}</Card>
      </div>
    </div>
  );
}
