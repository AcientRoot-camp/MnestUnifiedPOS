// Segments (§5.6): saved segments, live counts, no-code rule builder, send / export / tasks.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cx, ghs } from '../../lib/format';
import { BR, RULE_FIELDS, audit, firstName, fillTemplate, logMessage, matches, owesOf, request, uid, type Rule, type Segment, type Task } from './model';
import { Chips, Empty, Head, Lock, Pill, TierPill, Toastish, btnG, btnP, btnS, inp, type Crm } from './ui';
import { pushWebCode } from './web';

const label = (r: Rule) => { const f = RULE_FIELDS.find((x) => x[0] === r.field); return `${f?.[1] ?? r.field}${r.field === 'lastBuy' ? ' > ' : ': '}${r.field === 'branch' ? BR[r.value] : r.value}`; };

/** Puts the webstore code before “Reply STOP to opt out”. */
const withCode = (t: string, add: string) => (!add ? t : /\s*Reply STOP/i.test(t) ? t.replace(/\s*(Reply STOP)/i, `${add} $1`) : t + add);

export default function Segments({ m }: { m: Crm }) {
  const { c } = m;
  const [sel, setSel] = useState('');
  const [build, setBuild] = useState<null | { name: string; rules: Rule[]; field: string; value: string; err: string }>(null);
  const [send, setSend] = useState<null | { via: 'SMS' | 'WhatsApp' | 'Email'; tpl: string; web: number }>(null);
  const [msg, setMsg] = useState('');
  const pool = c.role === 'superuser' ? (m.vb === 'all' ? m.custs : m.custs.filter((x) => x.br === m.vb)) : m.custs.filter((x) => x.br === c.br);
  const segs = m.segments.filter((s) => s.scope === 'company' || c.role === 'superuser' || s.branch === c.br);
  const members = (s: Segment) => pool.filter((x) => matches(x, s.rules));
  const cur = segs.find((s) => s.id === sel) ?? segs[0];
  const curM = cur ? members(cur) : [];
  const limit = m.settings.limits.mgrSegment;
  const canCreate = c.caps.segmentCreate !== 'no';
  const consented = (via: string) => curM.filter((x) => (via === 'SMS' ? x.sms : via === 'WhatsApp' ? x.whatsapp : x.email_ok));
  const doSend = () => {
    if (!send || !cur) return; const tp = m.settings.templates.find((t) => t.id === send.tpl)!; const to = consented(send.via);
    if (!to.length) return setMsg(`Nobody in this segment agreed to ${send.via}.`);
    if (c.role === 'manager' && to.length > limit) { request('segment-send', `Send “${tp.name}” by ${send.via} to ${to.length} customers in ${cur.name} (over ${limit})`, c, { segment: cur.id, via: send.via, n: to.length }); setSend(null); return setMsg('Over your send limit · request sent to Approvals'); }
    const wc = send.web ? pushWebCode({ code: `${cur.name.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() || 'CRM'}${send.web}-${Math.floor(Math.random() * 900 + 100)}`, value: send.web, note: `Segment · ${cur.name}`, by: c.me, limit: to.length, days: 14 }) : null;
    to.forEach((x) => logMessage(c, send.via, x.phone, withCode(fillTemplate(tp.text, { first: firstName(x.name), staff: c.me, branch: BR[x.br] }), wc ? ` Shop online and use code ${wc.code} for GHS ${send.web} off.` : ''), 1, `Segment · ${cur.name}`));
    audit(c, 'CRM segment send', `${to.length} ${send.via} to ${cur.name}${wc ? ` · webstore code ${wc.code}` : ''}`); setSend(null);
    setMsg(`${to.length} ${send.via} sent · ${curM.length - to.length} left out (no consent) · logged in Messages${wc ? `\nWebstore code ${wc.code} (GHS ${send.web} off, ${to.length} uses, 14 days) is live in Post to webstore › Discount codes` : ''}`);
  };
  const exportCsv = () => { if (!cur) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[['Name', 'Phone', 'Branch', 'Tier', 'Owes'], ...curM.map((x) => [x.name, x.phone, BR[x.br], x.tier, owesOf(x).toFixed(2)])].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = `segment-${cur.name.toLowerCase().replace(/\W+/g, '-')}.csv`; a.click(); audit(c, 'CRM export', `Segment ${cur.name} · ${curM.length} rows`); setMsg('Exported · logged in the Audit trail'); };
  const tasksFor = () => { if (!cur) return; const T: Task[] = curM.map((x) => ({ id: uid('TK'), type: 'Call', title: `${cur.name} · check in with ${x.name}`, relatedTo: { kind: 'customer', id: x.phone, name: x.name }, assignee: m.deals.find((d) => d.customerPhone === x.phone)?.owner || (x.br === 'osu' ? 'Akua Kyei' : x.br === 'legon' ? 'Adjoa Badu' : 'Kojo Appiah'), assignedBy: c.me, branch: x.br, dueAt: Date.now() + 864e5, status: 'open', auto: false, source: `Segment · ${cur.name}` })); m.setTasks([...T, ...m.tasks]); setMsg(`${T.length} follow-ups created for the owners`); };
  const saveSeg = () => {
    if (!build) return; if (build.name.trim().length < 2) return setBuild({ ...build, err: 'Give the segment a name.' }); if (!build.rules.length) return setBuild({ ...build, err: 'Add at least one rule.' });
    const rules = c.role === 'manager' ? [{ field: 'branch', op: 'is', value: c.br }, ...build.rules.filter((r) => r.field !== 'branch')] : build.rules;
    const s: Segment = { id: uid('SG'), name: build.name.trim(), scope: c.role === 'superuser' ? 'company' : 'branch', branch: c.role === 'superuser' ? 'all' : c.br, rules, createdBy: c.me };
    m.setSegments([...m.segments, s]); setSel(s.id); setBuild(null); setMsg(`Segment ${s.name} saved · ${members(s).length} customers`);
  };
  return (
    <>
      <Head title="Segments" sub={c.role === 'supervisor' ? 'Saved groups of customers · view only' : c.role === 'manager' ? 'Groups of customers in My branch · create and send to branch segments' : 'Groups of customers by tier, spend, credit, lifecycle and consent'} actions={canCreate ? <button onClick={() => setBuild({ name: '', rules: [], field: 'tier', value: 'Gold', err: '' })} className={btnP}>+ New segment</button> : undefined} />
      {c.role === 'supervisor' && <Lock text="Supervisors use saved segments. Creating and sending to segments is done by the Manager or the Admin." />}
      <div className="grid gap-5 xl:grid-cols-[340px_1fr] items-start">
        <section className="bg-white rounded-3xl shadow-card p-4 flex flex-col gap-1.5" aria-label="Saved segments">
          {segs.map((s) => { const n = members(s).length; return <button key={s.id} aria-pressed={cur?.id === s.id} onClick={() => setSel(s.id)} className={cx('flex justify-between items-center gap-2 p-3 rounded-2xl text-left text-sm', cur?.id === s.id ? 'bg-[#eef6f6] ring-2 ring-brand' : 'hover:bg-[#f6f7f8]')}><span className="flex flex-col"><b className="font-medium">{s.name}</b><span className="text-xs text-muted">{s.scope === 'company' ? 'Company' : `${BR[s.branch]} branch`} · {s.createdBy}</span></span><Pill t={n} tone={n ? 'teal' : 'mute'} /></button>; })}
        </section>
        {cur ? <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-4 min-w-0">
          <div className="flex justify-between gap-3 flex-wrap"><div><h2 className="m-0 text-lg font-semibold">{cur.name}</h2><span className="text-[13px] text-muted">{curM.length} customer{curM.length === 1 ? '' : 's'}{c.role !== 'superuser' ? ' in My branch' : ''}</span></div>
            <div className="flex gap-2 flex-wrap">
              {c.caps.segmentSend !== 'no' && <><Link to="/marketing" onClick={() => audit(c, 'CRM segment to Marketing', cur.name)} className={btnS}>Send campaign</Link><button onClick={() => setSend({ via: 'SMS', tpl: m.settings.templates[0].id, web: 0 })} className={btnS}>Send message</button></>}
              {c.caps.exportData === 'yes' ? <button onClick={exportCsv} className={btnG}>Export CSV</button> : c.caps.exportData === 'request' ? <button onClick={() => { request('export', `Export segment ${cur.name} (${curM.length} rows)`, c, { segment: cur.id }); setMsg('Export request sent to Approvals'); }} className={btnG}>Request export</button> : null}
              {(c.role === 'superuser' || c.role === 'manager') && <button onClick={tasksFor} className={btnG}>Create tasks for owners</button>}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">{cur.rules.map((r, i) => <Pill key={i} t={label(r)} tone="teal" />)}</div>
          {send && <div className="p-4 rounded-2xl border border-line flex flex-col gap-2">
            <Chips label="Channel" value={send.via} onChange={(v) => setSend({ ...send, via: v })} opts={[['SMS', `SMS · ${consented('SMS').length}`], ['WhatsApp', `WhatsApp · ${consented('WhatsApp').length}`], ['Email', `Email · ${consented('Email').length}`]]} />
            <select aria-label="Message" value={send.tpl} onChange={(e) => setSend({ ...send, tpl: e.target.value })} className={inp}>{m.settings.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            {c.caps.segmentSend !== 'no' && <label className="flex items-center gap-2 text-sm">Webstore code<select aria-label="Webstore discount code" value={send.web} onChange={(e) => setSend({ ...send, web: Number(e.target.value) })} className="h-10 rounded-full border border-line px-3 text-[13px] bg-white"><option value={0}>None</option>{[10, 20, 50].map((v) => <option key={v} value={v}>GHS {v} off at the online store</option>)}</select></label>}
            <span className="text-xs text-muted">Only customers who agreed to {send.via} receive it · sender ID EBENEZERUV · “Reply STOP to opt out” is included.{c.role === 'manager' ? ` Sends to more than ${limit} customers go to the Admin for approval.` : ''}</span>
            <div className="flex gap-2"><button onClick={doSend} className={btnP}>Send to {consented(send.via).length}</button><button onClick={() => setSend(null)} className={btnG}>Cancel</button></div>
          </div>}
          {curM.length ? <div className="flex flex-col divide-y divide-line">{curM.map((x) => <div key={x.id} className="py-2.5 flex items-center gap-3 text-sm flex-wrap"><span className="flex-1 min-w-[160px]">{x.name}<br /><span className="text-xs text-muted">{x.phone} · {BR[x.br]} · {[x.sms && 'SMS', x.whatsapp && 'WhatsApp', x.email_ok && 'Email'].filter(Boolean).join(' · ') || 'No consent'}</span></span><TierPill tier={x.tier} />{owesOf(x) > 0 && <Pill t={`Owes ${ghs(owesOf(x))}`} tone="bad" />}</div>)}</div> : <Empty text="No customers in this segment." />}
        </section> : <Empty text="No segments yet." />}
      </div>
      {build && <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3" aria-label="New segment">
        <h2 className="m-0 text-lg font-semibold">New {c.role === 'manager' ? 'branch ' : ''}segment</h2>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Name<input value={build.name} onChange={(e) => setBuild({ ...build, name: e.target.value, err: '' })} placeholder="e.g. Gold customers on WhatsApp" className={inp} /></label>
        <div className="flex gap-2 flex-wrap items-end">
          <label className="text-[13px] font-semibold flex flex-col gap-1">Where<select value={build.field} onChange={(e) => setBuild({ ...build, field: e.target.value, value: RULE_FIELDS.find((f) => f[0] === e.target.value)![2][0] })} className="h-11 rounded-full border border-line px-4 text-sm">{RULE_FIELDS.filter((f) => c.role === 'superuser' || f[0] !== 'branch').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Is<select value={build.value} onChange={(e) => setBuild({ ...build, value: e.target.value })} className="h-11 rounded-full border border-line px-4 text-sm">{RULE_FIELDS.find((f) => f[0] === build.field)![2].map((v) => <option key={v} value={v}>{build.field === 'branch' ? BR[v] : v}</option>)}</select></label>
          <button onClick={() => setBuild({ ...build, rules: [...build.rules.filter((r) => r.field !== build.field), { field: build.field, op: 'is', value: build.value }] })} className={btnS}>+ Add rule</button>
        </div>
        <div className="flex gap-1.5 flex-wrap">{build.rules.map((r, i) => <button key={i} onClick={() => setBuild({ ...build, rules: build.rules.filter((_, j) => j !== i) })} className="min-h-9 px-3 rounded-full bg-[#eef6f6] text-brand text-[13px] font-semibold" aria-label={`Remove rule ${label(r)}`}>{label(r)} ×</button>)}{!build.rules.length && <span className="text-xs text-muted">No rules yet · everyone matches.</span>}</div>
        <span className="text-sm">Matches <b>{pool.filter((x) => matches(x, build.rules)).length}</b> customer(s) right now{c.role === 'manager' ? ' in My branch' : ''}.</span>
        {build.err && <span role="alert" className="text-sm text-danger">{build.err}</span>}
        <div className="flex gap-2"><button onClick={saveSeg} className={btnP}>Save segment</button><button onClick={() => setBuild(null)} className={btnG}>Cancel</button></div>
      </section>}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}
