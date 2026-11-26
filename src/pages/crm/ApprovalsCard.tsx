// CRM requests inside Approvals (§9): export, merge, close deal over limit, gift over limit, large segment sends, loyalty changes.
import { useState } from 'react';
import { ghs } from '../../lib/format';
import { BR, audit, firstName, fmtWhen, logMessage, matches, phoneKey, type CrmRequest, type Settings } from './model';
import { Pill, useCrm } from './ui';
import { pushWebCode } from './web';

const TYPE: Record<CrmRequest['type'], string> = { export: 'Export data', merge: 'Merge duplicates', 'close-deal': 'Close a deal', gift: 'Apology gift', 'segment-send': 'Segment send', loyalty: 'Loyalty change' };
const ADMIN_ONLY: CrmRequest['type'][] = ['export', 'merge', 'loyalty', 'segment-send'];

export default function CrmApprovals() {
  const m = useCrm(); const { c } = m;
  const [note, setNote] = useState('');
  if (c.role !== 'superuser' && c.role !== 'manager') return null;
  const mine = m.requests.filter((r) => c.role === 'superuser' || (r.branch === c.br && r.requestedBy !== c.me));
  const canDecide = (r: CrmRequest) => c.role === 'superuser' || (!ADMIN_ONLY.includes(r.type) && (r.role === 'Supervisor' || r.role === 'Sales staff'));
  const decide = (r: CrmRequest, ok: boolean) => {
    m.setRequests(m.requests.map((x) => (x.id === r.id ? { ...x, status: ok ? 'approved' : 'rejected', decidedBy: c.me, decidedAt: Date.now() } : x)));
    if (ok && r.type === 'close-deal') m.setDeals(m.deals.map((d) => (d.id === r.payload.deal ? { ...d, stage: String(r.payload.want || 'Won'), probability: r.payload.want === 'Lost' ? 0 : 100, stageSince: Date.now(), lostReason: r.payload.reason as string | undefined, approval: d.approval ? { ...d.approval, status: 'approved' } : undefined } : d)));
    if (!ok && r.type === 'close-deal') m.setDeals(m.deals.map((d) => (d.id === r.payload.deal ? { ...d, approval: d.approval ? { ...d.approval, status: 'rejected' } : undefined } : d)));
    if (ok && r.type === 'loyalty') m.setSettings({ ...m.settings, loyalty: r.payload.loyalty as Settings['loyalty'] });
    if (ok && r.type === 'gift') { const f = m.feedback.find((x) => x.id === r.payload.feedback); const val = Number(r.payload.value) || 20; if (f) { const code = `SORRY${val}-${firstName(f.customer).toUpperCase().slice(0, 4)}${Math.floor(Math.random() * 90 + 10)}`; m.setCusts(m.custs.map((x) => (phoneKey(x.phone) === phoneKey(f.customerPhone) ? { ...x, codes: [{ code, txt: `GHS ${val} off · apology`, used: false }, ...x.codes] } : x))); m.setFeedback(m.feedback.map((x) => (x.id === f.id ? { ...x, status: 'resolved', apology: code } : x))); pushWebCode({ code, value: val, note: `Apology · ${f.customer} · ${f.id}`, by: c.me, only: phoneKey(f.customerPhone).length === 9 ? f.customerPhone : undefined, days: 30 }); } }
    if (ok && r.type === 'segment-send') { const s = m.segments.find((x) => x.id === r.payload.segment); const via = String(r.payload.via || 'SMS'); if (s) { const to = m.custs.filter((x) => matches(x, s.rules) && (via === 'SMS' ? x.sms : via === 'WhatsApp' ? x.whatsapp : x.email_ok)); logMessage(c, via, `${to.length} customers · ${s.name}`, `Approved segment send by ${r.requestedBy}`, to.length, `Segment · ${s.name}`); } }
    audit(c, 'CRM approval', `${r.id} ${TYPE[r.type]} ${ok ? 'approved' : 'declined'}${note ? ` · ${note}` : ''}`); setNote('');
  };
  const pend = mine.filter((r) => r.status === 'pending');
  return (
    <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3 xl:col-span-2" aria-labelledby="crmreq-h">
      <div className="flex justify-between gap-2 flex-wrap"><div><h2 id="crmreq-h" className="m-0 text-lg font-semibold">CRM requests · {pend.length}</h2><span className="text-[13px] text-muted">{c.role === 'superuser' ? 'Exports, merges, deals and gifts over a limit, large segment sends and loyalty changes' : 'Deals and gifts from your Supervisor and Sales staff · exports, merges and loyalty changes go to the Admin'}</span></div></div>
      <input aria-label="Note for the decision (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the decision (optional)" className="h-10 rounded-full border border-line px-4 text-sm" />
      {mine.map((r) => <div key={r.id} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between gap-2 flex-wrap"><span><b>{r.id} · {TYPE[r.type]}</b> <span className="text-xs text-muted">· {r.requestedBy} ({r.role}) · {r.branch === 'all' ? 'Company' : BR[r.branch]} · {fmtWhen(r.at)}</span></span><Pill t={r.status === 'pending' ? 'Waiting' : r.status === 'approved' ? `Approved · ${r.decidedBy}` : `Declined · ${r.decidedBy}`} tone={r.status === 'pending' ? 'warn' : r.status === 'approved' ? 'ok' : 'mute'} /></div>
        <span>{r.title}</span>
        {r.type === 'gift' && <span className="text-xs text-muted">Value {ghs(Number(r.payload.value) || 0)}</span>}
        {r.status === 'pending' && (canDecide(r) ? <div className="flex gap-2"><button onClick={() => decide(r, true)} className="min-h-10 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#0b5c5c' }}>Approve</button><button onClick={() => decide(r, false)} className="min-h-10 px-4 rounded-full border border-line text-sm">Decline</button></div> : <span className="text-xs" style={{ color: '#7a4a00' }}>🔒 Only the Admin can decide this request.</span>)}
        {r.status === 'approved' && r.type === 'export' && <span className="text-xs" style={{ color: '#1f7a2a' }}>Approved · {r.requestedBy} can now download the file. Logged in the Audit trail.</span>}
      </div>)}
      {!mine.length && <span className="text-sm text-muted">No CRM requests.</span>}
    </section>
  );
}
