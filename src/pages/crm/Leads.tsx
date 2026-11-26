// Leads (§5.2): table, filters, bulk actions, lead drawer, convert, create deal, duplicate banner.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BRANCHES } from '../../data/nav';
import { CUSTOMERS, type Customer } from '../../data/sell';
import { cx, ghs } from '../../lib/format';
import { BR, addNote, assignable, audit, fillTemplate, firstName, fmtDate, fmtPhone, fmtWhen, logMessage, phoneKey, request, scoped, uid, type Deal, type Lead, type LeadStatus } from './model';
import { Chips, Drawer, Empty, Head, Lock, Pill, TierPill, Toastish, btnG, btnP, btnS, inp, type Crm } from './ui';

const ST: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
const TONE: Record<LeadStatus, 'info' | 'teal' | 'warn' | 'ok' | 'mute'> = { New: 'info', Contacted: 'teal', Qualified: 'warn', Converted: 'ok', Lost: 'mute' };
const blank = { name: '', phone: '', email: '', source: 'Walk-in', interest: '', estValue: '', branch: '', owner: '', sms: true, whatsapp: true, emailOk: false, err: '' };

export default function Leads({ m }: { m: Crm }) {
  const { c } = m; const staff = c.role === 'staff';
  const [sp, setSp] = useSearchParams();
  const [st, setSt] = useState<'all' | LeadStatus>('all');
  const [src, setSrc] = useState('all');
  const [own, setOwn] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState('');
  const [form, setForm] = useState<typeof blank | null>(null);
  const [bulk, setBulk] = useState<'' | 'assign' | 'message' | 'lost'>('');
  const [bulkVal, setBulkVal] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (sp.get('new')) { setForm({ ...blank, branch: c.role === 'superuser' ? 'osu' : c.br }); sp.delete('new'); setSp(sp, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const people = assignable(c);
  const L = useMemo(() => scoped(m.leads, c, m.vb).filter((l) => (st === 'all' || l.status === st) && (src === 'all' || l.source === src) && (own === 'all' || (own === '' ? !l.owner : l.owner === own)) && (!q.trim() || `${l.name} ${l.phone} ${l.interest} ${l.owner}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.createdAt - a.createdAt), [m.leads, c, m.vb, st, src, own, q]);
  const picked = L.filter((l) => sel[l.id]);
  const cur = m.leads.find((l) => l.id === open);
  const up = (id: string, p: Partial<Lead>) => m.setLeads(m.leads.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const dupOf = (phone: string) => (phoneKey(phone).length === 9 ? m.custs.find((x) => phoneKey(x.phone) === phoneKey(phone)) : undefined);
  // Round-robin per branch (CRM settings → assignment rules), or the creator for Sales staff.
  const autoOwner = (br: string) => { if (staff) return c.me; if (m.settings.assignment !== 'round-robin') return ''; const pool = people.filter((s) => s.br === br && s.role === 'staff'); if (!pool.length) return ''; const load = (n: string) => m.leads.filter((l) => l.owner === n && l.status !== 'Converted' && l.status !== 'Lost').length; return [...pool].sort((a, b) => load(a.name) - load(b.name))[0].name; };

  const save = () => {
    if (!form) return; const d = phoneKey(form.phone);
    if (form.name.trim().length < 2) return setForm({ ...form, err: 'Add the name.' });
    if (d.length !== 9) return setForm({ ...form, err: 'Phone: 9 digits after +233, without the first 0.' });
    if (m.leads.some((l) => phoneKey(l.phone) === d && l.status !== 'Lost' && l.status !== 'Converted')) return setForm({ ...form, err: 'A lead with this number is already open.' });
    const br = form.branch || c.br;
    const lead: Lead = { id: uid('LD'), name: form.name.trim(), phone: fmtPhone(d), email: form.email.trim(), source: form.source, interest: form.interest.trim(), estValue: parseFloat(form.estValue) || 0, branch: br, owner: form.owner || autoOwner(br), status: 'New', consent: { sms: form.sms, whatsapp: form.whatsapp, email: form.emailOk }, createdBy: c.me, createdAt: Date.now(), lastContactAt: Date.now(), nextStepAt: Date.now() + 864e5, nextStep: 'First call' };
    m.setLeads([lead, ...m.leads]); setForm(null); setMsg(`${lead.name} added${lead.owner ? ` · owner ${lead.owner}` : ' · not assigned yet'}`);
  };
  const convert = (l: Lead) => {
    const ex = dupOf(l.phone);
    if (ex) { up(l.id, { status: 'Converted' }); addNote(c, ex.phone, 'system', `Lead ${l.id} (${l.interest}) merged into this profile`); audit(c, 'CRM merge', `Lead ${l.id} merged into customer ${ex.name}`); setMsg(`Merged into ${ex.name}’s profile`); return; }
    const nc: Customer = { ...CUSTOMERS[0], id: 'c' + Date.now(), name: l.name, phone: l.phone, email: l.email, group: l.source === 'Pro-forma request' ? 'Wholesale' : 'Retail', since: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), tier: 'Bronze', points: 0, limit: 1000, sms: l.consent.sms, whatsapp: l.consent.whatsapp, email_ok: l.consent.email, br: l.branch, credits: [], codes: [], gifts: [] };
    m.setCusts([nc, ...m.custs]); up(l.id, { status: 'Converted' }); addNote(c, l.phone, 'system', `Customer created from lead ${l.id}`); setMsg(`${l.name} is now a customer · one profile per phone number`);
  };
  const createDeal = (l: Lead) => {
    const d: Deal = { id: uid('DL'), customerPhone: l.phone, customer: l.name, title: l.interest || 'New deal', value: l.estValue, stage: m.settings.stages[0], probability: 20, owner: l.owner || c.me, branch: l.branch, linkedDocs: [], expectedClose: Date.now() + 14 * 864e5, stageSince: Date.now(), nextFollowUp: Date.now() + 864e5, items: l.interest ? [{ name: l.interest, qty: 1, price: l.estValue }] : [] };
    m.setDeals([d, ...m.deals]); up(l.id, { status: l.status === 'New' ? 'Qualified' : l.status }); setMsg(`Deal ${d.id} created in ${d.stage}`);
  };
  const runBulk = () => {
    if (!picked.length) return;
    if (bulk === 'assign') { if (!bulkVal) return setMsg('Choose who to assign to.'); m.setLeads(m.leads.map((l) => (sel[l.id] ? { ...l, owner: bulkVal } : l))); audit(c, 'CRM reassignment', `${picked.length} lead(s) assigned to ${bulkVal}`); setMsg(`${picked.length} lead${picked.length === 1 ? '' : 's'} assigned to ${bulkVal}`); }
    if (bulk === 'message') { const tp = m.settings.templates.find((t) => t.id === (bulkVal || m.settings.templates[0].id))!; const ok = picked.filter((l) => l.consent.sms); ok.forEach((l) => { const text = fillTemplate(tp.text, { first: firstName(l.name), staff: c.me, branch: BR[l.branch], interest: l.interest }); logMessage(c, 'SMS', l.phone, text); addNote(c, l.phone, 'message', `SMS · ${tp.name}`); }); m.setLeads(m.leads.map((l) => (sel[l.id] && l.consent.sms ? { ...l, lastContactAt: Date.now(), status: l.status === 'New' ? 'Contacted' : l.status } : l))); setMsg(`${ok.length} SMS sent${picked.length - ok.length ? ` · ${picked.length - ok.length} skipped (no SMS consent)` : ''} · logged in Messages`); }
    if (bulk === 'lost') { if (!bulkVal) return setMsg('Choose the reason.'); m.setLeads(m.leads.map((l) => (sel[l.id] ? { ...l, status: 'Lost', lostReason: bulkVal } : l))); setMsg(`${picked.length} marked lost · ${bulkVal}`); }
    setSel({}); setBulk(''); setBulkVal('');
  };
  const dup = form ? dupOf(form.phone) : undefined;
  return (
    <>
      <Head title={staff ? 'My leads' : 'Leads'} sub={staff ? 'People interested in buying who you are looking after' : `New enquiries from the till, website, WhatsApp, phone, pro-forma and hire-purchase · ${c.role === 'superuser' ? (m.vb === 'all' ? 'all branches' : BR[m.vb]) : 'My branch'}`} actions={<button onClick={() => setForm({ ...blank, branch: c.role === 'superuser' ? (m.vb === 'all' ? 'osu' : m.vb) : c.br })} className={btnP}>+ New lead</button>} />
      <div className="flex gap-2 flex-wrap items-center">
        <Chips label="Status" value={st} onChange={setSt} opts={[['all', `All · ${scoped(m.leads, c, m.vb).length}`], ...ST.map((s) => [s, `${s} · ${scoped(m.leads, c, m.vb).filter((l) => l.status === s).length}`] as [LeadStatus, string])]} />
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or interest" aria-label="Search leads" className="h-11 rounded-full border border-line bg-white px-4 text-sm flex-1 min-w-[220px]" />
        <select aria-label="Source" value={src} onChange={(e) => setSrc(e.target.value)} className="h-11 rounded-full border border-line bg-white px-4 text-sm"><option value="all">Every source</option>{m.settings.sources.map((s) => <option key={s}>{s}</option>)}</select>
        {!staff && <select aria-label="Owner" value={own} onChange={(e) => setOwn(e.target.value)} className="h-11 rounded-full border border-line bg-white px-4 text-sm"><option value="all">Every owner</option><option value="">Not assigned</option>{people.map((s) => <option key={s.name}>{s.name}</option>)}</select>}
      </div>
      {picked.length > 0 && <div className="flex gap-2 flex-wrap items-center p-3 rounded-2xl bg-black text-white text-sm">
        <span className="flex-1">{picked.length} selected</span>
        {c.caps.assign !== 'self' && <button onClick={() => { setBulk('assign'); setBulkVal(''); }} className="h-9 px-3.5 rounded-full bg-white text-black text-[13px] font-semibold">Assign to</button>}
        <button onClick={() => { setBulk('message'); setBulkVal(m.settings.templates[0].id); }} className="h-9 px-3.5 rounded-full bg-white text-black text-[13px] font-semibold">Send message</button>
        <button onClick={() => { setBulk('lost'); setBulkVal(''); }} className="h-9 px-3.5 rounded-full bg-white/15 text-white text-[13px]">Mark lost</button>
        {bulk && <div className="w-full flex gap-2 flex-wrap items-center">
          {bulk === 'assign' && <select aria-label="Assign to" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} className="h-9 rounded-full px-3 text-black text-[13px]"><option value="">Choose…</option>{people.map((s) => <option key={s.name}>{s.name}</option>)}</select>}
          {bulk === 'message' && <select aria-label="Approved message" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} className="h-9 rounded-full px-3 text-black text-[13px]">{m.settings.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
          {bulk === 'lost' && <select aria-label="Lost reason" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} className="h-9 rounded-full px-3 text-black text-[13px]"><option value="">Reason…</option>{m.settings.lostReasons.map((r) => <option key={r}>{r}</option>)}</select>}
          <button onClick={runBulk} className="h-9 px-4 rounded-full text-white text-[13px] font-semibold" style={{ background: '#0b5c5c' }}>Apply</button>
          {bulk === 'message' && <span className="text-xs text-white/70">Only leads who agreed to SMS receive it. Reply STOP to opt out is added.</span>}
        </div>}
      </div>}
      {!L.length ? <Empty text={q || st !== 'all' ? 'No leads match these filters.' : staff ? 'No leads yet. Add someone who asked about a product.' : 'No leads yet.'} action={<button onClick={() => setForm({ ...blank, branch: c.br })} className={btnP}>+ New lead</button>} /> : (
        <>
          <div className="hidden lg:block bg-white rounded-3xl shadow-card overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead><tr className="text-left text-xs text-muted uppercase tracking-wide">{['', 'Name', 'Phone', 'Source', 'Interest', 'Est. value', 'Branch', 'Owner', 'Status', 'Last contact', 'Next step'].map((h, i) => <th key={i} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{L.map((l) => <tr key={l.id} className="border-t border-line hover:bg-[#f6f7f8] cursor-pointer" onClick={() => setOpen(l.id)}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${l.name}`} checked={!!sel[l.id]} onChange={() => setSel({ ...sel, [l.id]: !sel[l.id] })} className="w-4 h-4 accent-[#0b5c5c]" /></td>
                <td className="px-3 py-2.5 font-medium">{l.name}</td><td className="px-3 whitespace-nowrap">{l.phone}</td><td className="px-3">{l.source}</td><td className="px-3">{l.interest}</td><td className="px-3 whitespace-nowrap">{l.estValue ? ghs(l.estValue) : '—'}</td><td className="px-3">{BR[l.branch]}</td><td className="px-3">{l.owner || <Pill t="Not assigned" tone="warn" />}</td><td className="px-3"><Pill t={l.status} tone={TONE[l.status]} /></td><td className="px-3 whitespace-nowrap">{fmtWhen(l.lastContactAt)}</td><td className="px-3">{l.nextStep}{l.nextStepAt < Date.now() && !['Converted', 'Lost'].includes(l.status) && <> <Pill t="Overdue" tone="warn" /></>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="lg:hidden flex flex-col gap-2">{L.map((l) => <div key={l.id} className="bg-white rounded-[20px] shadow-card p-4 flex gap-3 items-start"><input type="checkbox" aria-label={`Select ${l.name}`} checked={!!sel[l.id]} onChange={() => setSel({ ...sel, [l.id]: !sel[l.id] })} className="w-5 h-5 mt-1 accent-[#0b5c5c]" /><button onClick={() => setOpen(l.id)} className="flex-1 text-left flex flex-col gap-1"><span className="flex justify-between gap-2"><b>{l.name}</b><Pill t={l.status} tone={TONE[l.status]} /></span><span className="text-sm text-muted">{l.interest} · {l.source} · {l.estValue ? ghs(l.estValue) : '—'}</span><span className="text-xs text-muted">{l.owner || 'Not assigned'} · next: {l.nextStep}</span></button></div>)}</div>
        </>
      )}

      {form && <Drawer title="New lead" sub="One profile per phone number, across the till, website and phone" onClose={() => setForm(null)}>
        {dup && <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2 flex-wrap" style={{ background: '#fff8e1', color: '#7a4a00' }}><span className="flex-1">This number belongs to <b>{dup.name}</b> <TierPill tier={dup.tier} /></span><Link to="/customers" className="underline font-semibold">open profile</Link>{c.caps.merge === 'yes' ? <button onClick={() => { setForm(null); setMsg(`Use the existing profile for ${dup.name} · no duplicate created`); }} className="underline font-semibold">merge</button> : c.caps.merge === 'request' ? <button onClick={() => { request('merge', `Merge new enquiry into ${dup.name} (${dup.phone})`, c, { phone: dup.phone }); setMsg('Merge request sent to Approvals'); }} className="underline font-semibold">request merge</button> : null}</div>}
        <label className="text-[13px] font-semibold flex flex-col gap-1">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, err: '' })} className={inp} /></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Phone<span className="flex items-center h-11 rounded-full border border-line px-4 gap-2 bg-white"><b>+233</b><input inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d ]/g, ''), err: '' })} placeholder="24 555 0142" className="flex-1 min-w-0 outline-none font-normal" /></span><span className="text-xs text-muted font-normal">9 digits after +233, without the first 0</span></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Email (optional)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[13px] font-semibold flex flex-col gap-1">Source<select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inp}>{m.settings.sources.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Est. value (GHS)<input inputMode="decimal" value={form.estValue} onChange={(e) => setForm({ ...form, estValue: e.target.value.replace(/[^\d.]/g, '') })} className={inp} /></label>
        </div>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Interested in<input value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} placeholder="e.g. TCL 1.5HP Inverter Split Air Conditioner" className={inp} /></label>
        {c.role === 'superuser' && <label className="text-[13px] font-semibold flex flex-col gap-1">Branch<select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className={inp}>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.short}</option>)}</select></label>}
        {!staff && <label className="text-[13px] font-semibold flex flex-col gap-1">Owner<select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={inp}><option value="">{m.settings.assignment === 'round-robin' ? 'Automatic (round-robin)' : 'Not assigned'}</option>{people.filter((s) => s.br === (form.branch || c.br)).map((s) => <option key={s.name}>{s.name}</option>)}</select></label>}
        <fieldset className="flex flex-col gap-1.5"><legend className="text-[13px] font-semibold mb-1">Consent</legend>{([['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['emailOk', 'Email']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" checked={form[k]} onChange={() => setForm({ ...form, [k]: !form[k] })} className="w-5 h-5 accent-[#0b5c5c]" />They agree to {l} messages</label>)}</fieldset>
        {form.err && <span role="alert" className="text-sm text-danger">{form.err}</span>}
        <button onClick={save} className={btnP}>Save lead</button>
      </Drawer>}

      {cur && <LeadDrawer m={m} l={cur} onClose={() => setOpen('')} up={up} convert={convert} createDeal={createDeal} say={setMsg} dupName={dupOf(cur.phone)?.name} />}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}

function LeadDrawer({ m, l, onClose, up, convert, createDeal, say, dupName }: { m: Crm; l: Lead; onClose: () => void; up: (id: string, p: Partial<Lead>) => void; convert: (l: Lead) => void; createDeal: (l: Lead) => void; say: (s: string) => void; dupName?: string }) {
  const { c } = m; const [note, setNote] = useState('');
  const acts = m.notes.filter((n) => phoneKey(n.customerPhone) === phoneKey(l.phone)).sort((a, b) => b.at - a.at);
  const people = assignable(c);
  return (
    <Drawer title={l.name} sub={`${l.id} · ${l.source} · ${BR[l.branch]} · added ${fmtDate(l.createdAt)}`} onClose={onClose}>
      {dupName && l.status !== 'Converted' && <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#fff8e1', color: '#7a4a00' }}>This number belongs to <b>{dupName}</b> · Convert merges the lead into that profile.</div>}
      <dl className="m-0 grid grid-cols-2 gap-2 text-sm">{[['Phone', l.phone], ['Email', l.email || '—'], ['Interested in', l.interest || '—'], ['Est. value', l.estValue ? ghs(l.estValue) : '—'], ['Next step', `${l.nextStep} · ${fmtWhen(l.nextStepAt)}`], ['Created by', l.createdBy]].map(([k, v]) => <div key={k} className="rounded-xl bg-[#f6f7f8] p-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 font-medium">{v}</dd></div>)}</dl>
      <label className="text-[13px] font-semibold flex flex-col gap-1">Status<select value={l.status} onChange={(e) => up(l.id, { status: e.target.value as LeadStatus, lastContactAt: Date.now() })} className={inp}>{ST.map((s) => <option key={s}>{s}</option>)}</select></label>
      {c.caps.assign !== 'self' && <label className="text-[13px] font-semibold flex flex-col gap-1">Owner<select value={l.owner} onChange={(e) => { up(l.id, { owner: e.target.value }); audit(c, 'CRM reassignment', `${l.id} assigned to ${e.target.value || 'nobody'}`); }} className={inp}><option value="">Not assigned</option>{people.map((s) => <option key={s.name}>{s.name}</option>)}</select></label>}
      <fieldset className="flex flex-col gap-1"><legend className="text-[13px] font-semibold mb-1">Consent</legend>{(['sms', 'whatsapp', 'email'] as const).map((k) => <label key={k} className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" checked={l.consent[k]} onChange={() => up(l.id, { consent: { ...l.consent, [k]: !l.consent[k] } })} className="w-5 h-5 accent-[#0b5c5c]" />{k === 'sms' ? 'SMS' : k === 'whatsapp' ? 'WhatsApp' : 'Email'}</label>)}</fieldset>
      <div className="flex gap-2 flex-wrap">
        {l.status !== 'Converted' && <button onClick={() => convert(l)} className={btnP}>Convert to customer</button>}
        <button onClick={() => createDeal(l)} className={btnS}>Create deal</button>
        <a href={`tel:+233${phoneKey(l.phone)}`} onClick={() => { addNote(c, l.phone, 'call', 'Called'); up(l.id, { lastContactAt: Date.now(), status: l.status === 'New' ? 'Contacted' : l.status }); }} className={btnG}>Call</a>
      </div>
      <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Notes</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did they say? What happens next?" className="p-3 rounded-2xl border border-line text-sm" /><button onClick={() => { if (!note.trim()) return; addNote(c, l.phone, 'note', note.trim()); setNote(''); up(l.id, { lastContactAt: Date.now() }); say('Note added'); }} className={cx(btnG, 'w-fit')}>Add note</button></div>
      <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Activity</span>{acts.map((n) => <div key={n.id} className="text-sm border-l-2 border-brand pl-3"><b className="font-medium">{n.kind}</b> · {n.text}<br /><span className="text-xs text-muted">{n.by} · {n.role} · {fmtWhen(n.at)}</span></div>)}{!acts.length && <span className="text-xs text-muted">No activity yet.</span>}</div>
      {c.role === 'staff' && <span className="text-xs text-muted">Your Supervisor can reassign this lead if you need help.</span>}
      {c.role === 'supervisor' && l.estValue > m.settings.limits.supDeal && <Lock text={`Deals over ${ghs(m.settings.limits.supDeal)} need the Manager to mark them won.`} />}
    </Drawer>
  );
}
