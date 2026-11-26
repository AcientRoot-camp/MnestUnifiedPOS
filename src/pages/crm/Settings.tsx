// CRM settings (§5.11, Admin only). Every change is audited.
import { useState } from 'react';
import { cx, ghs } from '../../lib/format';
import { CAPS0, ROLE_NAME, audit, fmtWhen, uid, type Caps, type CrmRole, type Settings as S } from './model';
import { Chips, Head, Pill, Toastish, btnG, btnP, inp, type Crm } from './ui';

const CAP_ROWS: [keyof Caps, string, string[]][] = [
  ['overview', 'View CRM overview', ['company', 'branch', 'team', 'myday']], ['spend', 'Lifetime spend & profit figures', ['full', 'branch', 'spend', 'tier']], ['credit', 'Credit owed / HP balance', ['all', 'own']],
  ['addLead', 'Add lead / capture customer', ['true', 'false']], ['assign', 'Assign / reassign', ['anyone', 'branch', 'team', 'self']], ['deals', 'Create & move deals', ['all', 'limit', 'own']], ['closeDeal', 'Mark deal Won / Lost', ['yes', 'request', 'no']],
  ['notes', 'Add notes, log calls', ['true', 'false']], ['message', 'Send individual message', ['any', 'templates']], ['segmentSend', 'Send to a segment', ['yes', 'branch', 'no']], ['segmentCreate', 'Create segments', ['yes', 'branch', 'no']],
  ['complaints', 'Handle complaints', ['all', 'first', 'log']], ['escalate', 'Escalate to ticket', ['true', 'false']], ['gift', 'Apology code / gift', ['yes', 'limit', 'request']], ['loyaltyEdit', 'Edit loyalty rules', ['yes', 'view', 'no']],
  ['journeys', 'Journeys', ['build', 'view', 'no']], ['exportData', 'Export customer data', ['yes', 'request', 'no']], ['merge', 'Merge duplicates', ['yes', 'request', 'no']], ['del', 'Delete customer record', ['true', 'false']], ['settings', 'CRM settings', ['true', 'false']], ['team', 'Staff CRM performance', ['all', 'branch', 'team', 'own']],
];
const ROLES: CrmRole[] = ['superuser', 'manager', 'supervisor', 'staff'];

function ListEdit({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  return <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">{label}</span><div className="flex gap-1.5 flex-wrap">{items.map((x) => <button key={x} onClick={() => onChange(items.filter((y) => y !== x))} aria-label={`Remove ${x}`} className="min-h-9 px-3 rounded-full bg-[#eef6f6] text-brand text-[13px] font-semibold">{x} ×</button>)}</div><div className="flex gap-2"><input aria-label={`Add to ${label}`} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onChange([...items, v.trim()]); setV(''); } }} placeholder="Type and press Enter" className={cx(inp, 'flex-1')} /><button onClick={() => { if (v.trim()) { onChange([...items, v.trim()]); setV(''); } }} className={btnG}>Add</button></div></div>;
}

export default function Settings({ m }: { m: Crm }) {
  const { c } = m; const s = m.settings;
  const [tab, setTab] = useState<'pipeline' | 'rules' | 'templates' | 'matrix' | 'data'>('pipeline');
  const [tpl, setTpl] = useState({ name: '', text: '' });
  const [msg, setMsg] = useState('');
  const save = (p: Partial<S>, what: string) => { m.setSettings({ ...s, ...p }); audit(c, 'CRM settings changed', what); setMsg(`${what} · saved and logged`); };
  const caps = (r: CrmRole) => ({ ...CAPS0[r], ...(s.caps?.[r] || {}) });
  const setCap = (r: CrmRole, k: keyof Caps, v: string) => { const val = v === 'true' ? true : v === 'false' ? false : v; save({ caps: { ...(s.caps || {}), [r]: { ...(s.caps?.[r] || {}), [k]: val } } }, `${ROLE_NAME[r]} · ${CAP_ROWS.find((x) => x[0] === k)?.[1]} set to ${v}`); };
  const n = (label: string, val: number, set: (v: number) => void, unit: string) => <label className="text-[13px] font-semibold flex flex-col gap-1">{label}<span className="flex items-center h-11 rounded-full border border-line bg-white px-4 gap-2"><input inputMode="decimal" defaultValue={val} onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== val) set(v); }} className="flex-1 min-w-0 outline-none font-normal" /><span className="text-xs text-muted font-normal">{unit}</span></span></label>;
  const reqs = m.requests.filter((r) => r.type === 'export' || r.type === 'merge');
  return (
    <>
      <Head title="CRM settings" sub="Admin only · pipeline, assignment, response times, limits, templates, permissions and data protection · every change is audited" />
      <Chips label="Section" value={tab} onChange={setTab} opts={[['pipeline', 'Pipeline & sources'], ['rules', 'Assignment, SLAs & limits'], ['templates', 'Message templates'], ['matrix', 'Permissions'], ['data', 'Data protection']]} />
      {tab === 'pipeline' && <section className="bg-white rounded-3xl shadow-card p-5 grid gap-5 lg:grid-cols-2">
        <ListEdit label="Pipeline stages (in order)" items={s.stages} onChange={(v) => { if (!v.includes('Won') || !v.includes('Lost')) return setMsg('Keep the Won and Lost stages.'); save({ stages: v }, 'Pipeline stages'); }} />
        <ListEdit label="Lost reasons" items={s.lostReasons} onChange={(v) => save({ lostReasons: v }, 'Lost reasons')} />
        <ListEdit label="Lead sources" items={s.sources} onChange={(v) => save({ sources: v }, 'Lead sources')} />
        <ListEdit label="Tags" items={s.tags} onChange={(v) => save({ tags: v }, 'Tags')} />
      </section>}
      {tab === 'rules' && <div className="grid gap-5 lg:grid-cols-2 items-start">
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">Assignment rules</h2>
          {([['round-robin', 'Round-robin per branch', 'New leads go to the Sales staff member with the fewest open leads'], ['category', 'By product category', 'TVs to one person, air conditioners to another'], ['manual', 'Manual', 'A Manager or Supervisor hands out every lead']] as const).map(([k, l, d]) => <label key={k} className="flex gap-3 items-start p-3 rounded-2xl border border-line text-sm cursor-pointer"><input type="radio" name="assign" checked={s.assignment === k} onChange={() => save({ assignment: k }, `Assignment rule: ${l}`)} className="mt-1 w-5 h-5 accent-[#0b5c5c]" /><span><b className="font-medium">{l}</b><br /><span className="text-xs text-muted">{d}</span></span></label>)}
          <h3 className="m-0 text-sm font-semibold pt-2">Response times (SLA)</h3>
          <div className="grid grid-cols-2 gap-2">{n('Answer a complaint within', s.slaHours.complaint, (v) => save({ slaHours: { ...s.slaHours, complaint: v } }, 'Complaint SLA'), 'hours')}{n('First contact with a lead within', s.slaHours.lead, (v) => save({ slaHours: { ...s.slaHours, lead: v } }, 'Lead SLA'), 'hours')}</div>
        </section>
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">Role value limits</h2>
          {n('Deal value a Supervisor can close', s.limits.supDeal, (v) => save({ limits: { ...s.limits, supDeal: v } }, `Supervisor deal limit ${ghs(v)}`), 'GHS')}
          {n('Gift or apology value a Supervisor can issue', s.limits.supGift, (v) => save({ limits: { ...s.limits, supGift: v } }, `Supervisor gift limit ${ghs(v)}`), 'GHS')}
          {n('Segment size a Manager can message without approval', s.limits.mgrSegment, (v) => save({ limits: { ...s.limits, mgrSegment: v } }, `Manager segment limit ${v}`), 'customers')}
          <h3 className="m-0 text-sm font-semibold pt-2">Health-score weighting</h3>
          <div className="grid grid-cols-2 gap-2">{(Object.keys(s.health) as (keyof S['health'])[]).map((k) => <span key={k}>{n(k === 'recency' ? 'How recently they bought' : k === 'spend' ? 'How much they spend' : k === 'frequency' ? 'How often they buy' : k === 'credit' ? 'Credit in good standing' : 'Satisfaction', s.health[k], (v) => save({ health: { ...s.health, [k]: v } }, `Health weight · ${k} ${v}`), '%')}</span>)}</div>
          <span className="text-xs text-muted">Weights add up to {Object.values(s.health).reduce((a, b) => a + b, 0)}% · the score is scaled to 0–100 either way.</span>
        </section>
      </div>}
      {tab === 'templates' && <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">Approved message templates for Sales staff</h2><span className="text-[13px] text-muted">Sales staff can only send these. Use {'{first}'}, {'{staff}'}, {'{branch}'} and {'{interest}'} to fill in names.</span>
        {s.templates.map((t) => <div key={t.id} className="p-3 rounded-2xl border border-line flex gap-3 items-start text-sm"><span className="flex-1"><b className="font-medium">{t.name}</b><br /><span className="text-muted">{t.text}</span></span><button onClick={() => save({ templates: s.templates.filter((x) => x.id !== t.id) }, `Template removed · ${t.name}`)} className="h-9 px-3 rounded-full border border-line text-[12px]">Remove</button></div>)}
        <div className="grid gap-2 p-3 rounded-2xl bg-[#f6f7f8]"><input aria-label="Template name" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} placeholder="Template name" className={inp} /><textarea aria-label="Template text" rows={3} value={tpl.text} onChange={(e) => setTpl({ ...tpl, text: e.target.value })} placeholder="Hello {first}, … Reply STOP to opt out." className="p-3 rounded-2xl border border-line text-sm bg-white" /><button onClick={() => { if (!tpl.name.trim() || !tpl.text.trim()) return setMsg('Add a name and the message.'); const text = /stop/i.test(tpl.text) ? tpl.text.trim() : `${tpl.text.trim()} Reply STOP to opt out.`; save({ templates: [...s.templates, { id: uid('t'), name: tpl.name.trim(), text }] }, `Template added · ${tpl.name.trim()}`); setTpl({ name: '', text: '' }); }} className={cx(btnP, 'w-fit')}>Add template</button></div>
      </section>}
      {tab === 'matrix' && <section className="bg-white rounded-3xl shadow-card overflow-x-auto"><table className="w-full text-sm min-w-[860px]"><thead><tr className="text-left text-xs text-muted uppercase tracking-wide"><th className="px-4 py-3 font-semibold">Capability</th>{ROLES.map((r) => <th key={r} className="px-3 py-3 font-semibold">{ROLE_NAME[r]}</th>)}</tr></thead>
        <tbody>{CAP_ROWS.map(([k, l, opts]) => <tr key={k} className="border-t border-line"><td className="px-4 py-2.5">{l}</td>{ROLES.map((r) => { const v = String(caps(r)[k]); const changed = v !== String(CAPS0[r][k]); return <td key={r} className="px-3 py-2"><select aria-label={`${l} · ${ROLE_NAME[r]}`} disabled={r === 'superuser' && (k === 'settings' || k === 'del')} value={v} onChange={(e) => setCap(r, k, e.target.value)} className={cx('h-9 rounded-full border px-3 text-[13px] bg-white', changed ? 'border-brand text-brand font-semibold' : 'border-line')}>{opts.map((o) => <option key={o} value={o}>{o === 'true' ? '✓ Yes' : o === 'false' ? '✗ No' : o}</option>)}</select></td>; })}</tr>)}</tbody></table>
        <div className="p-4 flex gap-2 items-center flex-wrap"><button onClick={() => save({ caps: {} }, 'Permissions reset to the defaults')} className={btnG}>Reset to defaults</button><span className="text-xs text-muted">Highlighted cells differ from the default. Deleting customer records and CRM settings always stay with the Admin.</span></div></section>}
      {tab === 'data' && <div className="grid gap-5 lg:grid-cols-2 items-start">
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3"><h2 className="m-0 text-lg font-semibold">Consent and retention</h2>
          <span className="text-sm">Consent is recorded per channel (SMS, WhatsApp, email) on every customer and lead. Messages only go to people who agreed, and every SMS carries “Reply STOP to opt out”.</span>
          {n('Keep customer records for', s.retentionMonths, (v) => save({ retentionMonths: v }, `Retention ${v} months`), 'months')}
          <div className="rounded-2xl p-4 text-sm" style={{ background: '#eef6f6' }}>Customer data is handled under Ghana’s Data Protection Act, 2012 (Act 843) and, for UK customers, the UK GDPR. Customers can ask for a copy of their data or for it to be erased; erasure keeps sales and tax records the law requires.</div>
        </section>
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-2"><h2 className="m-0 text-lg font-semibold">Export and erasure requests</h2>{reqs.map((r) => <div key={r.id} className="flex items-center gap-3 text-sm border-t border-line pt-2"><span className="flex-1">{r.title}<br /><span className="text-xs text-muted">{r.requestedBy} · {r.role} · {fmtWhen(r.at)}</span></span><Pill t={r.status} tone={r.status === 'pending' ? 'warn' : r.status === 'approved' ? 'ok' : 'mute'} /></div>)}{!reqs.length && <span className="text-sm text-muted">No requests.</span>}<span className="text-xs text-muted">Decide them in Approvals.</span></section>
      </div>}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}
