import { useState } from 'react';
import { sessions, sessionEnd } from '../../../lib/sec';
import { cx } from '../../../lib/format';
import { SETUP } from './data';
import { B, Chips, Err, F, Modal, Sec, Tag, inp, useDev } from './ui';

const fmt = (iso: string) => (iso ? new Date(iso + 'T00:00').toLocaleDateString('en-GB') : '—');
const REASONS = ['Licence expired and not renewed', 'Payment not received', 'Owner asked for a pause', 'Other'];

export default function Setup() {
  const { d, act, ask, locked } = useDev();
  const [pay, setPay] = useState<{ id: string; kind: 'renew' | 'release'; ref: string; amt: string; exp: string; err: string } | null>(null);
  const [hold, setHold] = useState<{ id: string; r: string; other: string; note: string; err: string } | null>(null);
  const stamp = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date().toTimeString().slice(0, 5);
  const addHist = (id: string, what: string) => d.upMeta(id, { hist: [{ at: stamp(), what, by: 'MNest UnifiedPOS Support' }, ...(d.meta[id]?.hist || [])] });
  return (
    <>
      <Sec title="First-time set-up & hand-over">
        <ol className="m-0 p-0 list-none grid gap-2 md:grid-cols-2">{SETUP.map(([t, s], i) => <li key={t} className="flex gap-3 p-3 rounded-2xl bg-canvas"><span className="w-7 h-7 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center flex-none">{i + 1}</span><span className="flex flex-col"><strong className="text-sm">{t}</strong><span className="text-xs text-muted">{s}</span></span></li>)}</ol>
        <div className="rounded-2xl bg-brand-50 p-4 flex flex-col gap-1"><strong className="text-sm">Purchase agreement</strong><span className="text-sm">Licensed to Ebenezer Unique Ventures Ltd · Growth plan · 3 branches · renews 01/01/2027</span><span className="text-xs text-sub">After hand-over the Admin owns the business data. The developer keeps backend access for maintenance and support only, and only while the Admin allows it.</span></div>
      </Sec>
      <div id="sub-logins" className="scroll-mt-6" /><Sec id="sl-h" title="Admin logins & account hold" sub="Reset a company Admin's password or PIN, or put the account on hold in rare cases when the licence or payment is not settled. Every action is confirmed first and recorded in the audit trail.">
        {d.cos.map((c) => {
          const m = d.meta[c.id] || { licExp: '', auto: false, hist: [], adminLast: 'Never' };
          const days = m.licExp ? Math.ceil((new Date(m.licExp).getTime() - Date.now()) / 864e5) : 999;
          const warns = [days < 0 ? 'Licence expired' : days <= 30 ? `Licence expires in ${days} days` : '', m.held ? 'Company on hold' : '', c.status === 'Suspended' ? 'Suspended' : ''].filter(Boolean);
          return (
            <div key={c.id} className={cx('p-4 rounded-2xl border flex flex-col gap-2', m.held ? 'border-danger bg-red-50/40' : 'border-line')}>
              <div className="flex justify-between gap-2 flex-wrap"><strong>{c.name}</strong><span className="flex gap-1.5 flex-wrap">{warns.map((w) => <Tag key={w} t={w} tone={/hold|expired|Suspended/.test(w) ? 'bad' : 'warn'} />)}</span></div>
              <span className="text-xs text-muted">Admin {c.owner} · {c.email} · last sign-in {m.adminLast}</span>
              {m.held && <span className="text-sm text-danger font-semibold">ON HOLD · all users of the company and its branches · {m.held}{m.heldNote ? ` · ${m.heldNote}` : ''}</span>}
              <div className="flex gap-3 items-end flex-wrap">
                <span className="text-sm">{days < 0 ? `Licence expired ${fmt(m.licExp)}` : `Licence valid to ${fmt(m.licExp)}`}</span>
                <F l="Licence expires"><input type="date" value={m.licExp} onChange={(e) => { d.upMeta(c.id, { licExp: e.target.value }); addHist(c.id, `Licence expiry changed to ${fmt(e.target.value)}`); act(`Changed licence expiry for ${c.name} to ${fmt(e.target.value)}`, 'Set-up & hand-over'); }} className={cx(inp, 'w-44')} /></F>
                <button role="switch" aria-checked={m.auto} onClick={() => { d.upMeta(c.id, { auto: !m.auto }); act(`${m.auto ? 'Turned off' : 'Turned on'} auto-disable at expiry for ${c.name}`, 'Set-up & hand-over'); }} className="flex items-center gap-2 text-sm h-10"><span className={cx('w-10 h-6 rounded-full p-0.5', m.auto ? 'bg-ok' : 'bg-[#cfcfcf]')}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', m.auto && 'translate-x-4')} /></span>Auto-disable all users if unpaid at expiry</button>
              </div>
              {m.hist.length > 0 && <details><summary className="text-xs font-semibold cursor-pointer">Licence &amp; hold history ({m.hist.length})</summary><div className="flex flex-col gap-0.5 pt-1">{m.hist.map((h, i) => <span key={i} className="text-xs text-sub">{h.at} · {h.what} · {h.by}</span>)}</div></details>}
              <div className="flex gap-2 flex-wrap">
                <button disabled={locked} onClick={() => ask({ title: `Reset ${c.owner}'s password?`, body: `A temporary password is sent to ${c.email}. ${c.owner} must change it at the next sign-in.`, cta: 'Reset password', act: () => { addHist(c.id, 'Admin password reset'); act(`Reset the Admin password for ${c.name} (${c.owner})`, 'Set-up & hand-over'); } })} className={B.sm}>Reset password</button>
                <button disabled={locked} onClick={() => ask({ title: `Reset ${c.owner}'s PIN?`, body: `A new 6-digit passcode is sent to ${c.phone} by SMS.`, cta: 'Reset PIN', act: () => { addHist(c.id, 'Admin passcode reset'); act(`Reset the Admin passcode for ${c.name} (${c.owner})`, 'Set-up & hand-over'); } })} className={B.sm}>Reset PIN</button>
                {!m.held ? <><button disabled={locked} onClick={() => setHold({ id: c.id, r: REASONS[0], other: '', note: '', err: '' })} className={cx(B.sm, 'text-danger border-danger')}>Hold account</button><button disabled={locked} onClick={() => setPay({ id: c.id, kind: 'renew', ref: '', amt: '', exp: new Date(new Date(m.licExp || Date.now()).getTime() + 365 * 864e5).toISOString().slice(0, 10), err: '' })} className={B.sm}>Record payment &amp; renew</button></>
                  : <button disabled={locked} onClick={() => setPay({ id: c.id, kind: 'release', ref: '', amt: '', exp: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), err: '' })} className={cx(B.sm, 'bg-brand text-white border-brand')}>Record payment &amp; reactivate</button>}
              </div>
            </div>
          );
        })}
      </Sec>
      {pay && (() => { const c = d.cos.find((x) => x.id === pay.id)!; return (
        <Modal title={pay.kind === 'renew' ? `Record payment & renew · ${c.name}` : `Record payment & reactivate · ${c.name}`} sub={pay.kind === 'release' ? 'Every user of the company can sign in again once you continue.' : 'The licence is extended to the new date.'} onClose={() => setPay(null)}>
          <F l="Payment reference or receipt number"><input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder="e.g. MoMo ref 7QX21D or RCPT-2026-118" className={inp} /></F>
          <F l="Amount paid (GHS)"><input inputMode="decimal" value={pay.amt} onChange={(e) => setPay({ ...pay, amt: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0.00" className={inp} /></F>
          <F l="New licence expiry date"><input type="date" value={pay.exp} onChange={(e) => setPay({ ...pay, exp: e.target.value })} className={inp} /></F>
          <Err e={pay.err} />
          <div className="flex gap-2 justify-end"><button onClick={() => setPay(null)} className={B.ghost}>Cancel</button><button onClick={() => { if (pay.ref.trim().length < 4) return setPay({ ...pay, err: '422 Unprocessable Content · Add the payment reference.' }); if (!(parseFloat(pay.amt) > 0)) return setPay({ ...pay, err: '422 Unprocessable Content · Add the amount paid.' }); if (!pay.exp || pay.exp <= new Date().toISOString().slice(0, 10)) return setPay({ ...pay, err: '422 Unprocessable Content · The new expiry date must be in the future.' }); const line = `Payment ${pay.ref.trim()} · GHS ${parseFloat(pay.amt).toFixed(2)} · licence to ${fmt(pay.exp)}${pay.kind === 'release' ? ' · reactivated' : ''}`; d.upMeta(c.id, { licExp: pay.exp, held: '', heldNote: '' }); addHist(c.id, line); if (pay.kind === 'release') d.upCo(c.id, { status: 'Active' }); act(`${c.name} · ${line}`, 'Set-up & hand-over'); setPay(null); }} className={B.primary}>Continue</button></div>
        </Modal>
      ); })()}
      {hold && (() => { const c = d.cos.find((x) => x.id === hold.id)!; return (
        <Modal title={`Put ${c.name} on hold?`} onClose={() => setHold(null)}>
          <span className="text-sm text-sub">{c.owner} (Admin) and every user of the company and its branches (managers, supervisors, sales staff and riders) will be blocked until it is settled.</span>
          <span className="text-[13px] font-semibold">Why is the account on hold?</span>
          <Chips label="Reason" value={hold.r} onChange={(r) => setHold({ ...hold, r })} opts={REASONS.map((r) => [r, r] as [string, string])} />
          {hold.r === 'Other' && <F l="State the reason"><input value={hold.other} onChange={(e) => setHold({ ...hold, other: e.target.value })} placeholder="Type the reason for holding this company" className={inp} /></F>}
          <F l="Note for the record (optional)"><input value={hold.note} onChange={(e) => setHold({ ...hold, note: e.target.value })} placeholder="e.g. Invoice INV-2026-118 unpaid since 1 Oct" className={inp} /></F>
          <Err e={hold.err} />
          <div className="flex gap-2 justify-end"><button onClick={() => setHold(null)} className={B.ghost}>Cancel</button><button onClick={() => { const why = hold.r === 'Other' ? hold.other.trim() : hold.r; if (!why) return setHold({ ...hold, err: '422 Unprocessable Content · State the reason.' }); d.upMeta(c.id, { held: why, heldNote: hold.note.trim() }); addHist(c.id, `Put on hold · ${why}${hold.note ? ` · ${hold.note}` : ''}`); if (c.id === 'main') sessions().filter((s) => s.username !== 'support').forEach((s) => sessionEnd(s.sid)); act(`Put ${c.name} on hold · ${why}`, 'Set-up & hand-over'); setHold(null); }} className={cx(B.primary, 'bg-danger')}>Continue</button></div>
        </Modal>
      ); })()}
    </>
  );
}
