// Deals pipeline (§5.3): board/list, stage totals, weighted forecast, deal drawer.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cx, ghs } from '../../lib/format';
import { BR, addNote, assignable, audit, daysAgo, fmtDate, fmtPhone, fmtWhen, phoneKey, request, scoped, uid, type Deal, type Task, type TaskType } from './model';
import { Chips, Drawer, Empty, Head, Lock, Pill, Toastish, btnG, btnP, btnS, inp, type Crm } from './ui';

const PROB: Record<string, number> = { New: 20, 'Quote sent': 40, Negotiating: 60, 'Awaiting payment': 85, Won: 100, Lost: 0 };
const age = (d: Deal) => { const n = daysAgo(d.stageSince); return n > 7 ? { tone: 'bad' as const, t: `${n} days · stuck` } : n > 3 ? { tone: 'warn' as const, t: `${n} days · slowing` } : { tone: 'mute' as const, t: `${n} day${n === 1 ? '' : 's'} in stage` }; };

export default function Pipeline({ m }: { m: Crm }) {
  const { c } = m; const staff = c.role === 'staff';
  const [view, setView] = useState<'board' | 'list'>('board');
  const [open, setOpen] = useState('');
  const [add, setAdd] = useState<null | { cq: string; phone: string; name: string; title: string; value: string; owner: string; err: string }>(null);
  const [msg, setMsg] = useState('');
  const stages = m.settings.stages;
  const D = scoped(m.deals, c, m.vb);
  const openD = D.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
  const weighted = openD.reduce((a, d) => a + (d.value * d.probability) / 100, 0);
  const cur = m.deals.find((d) => d.id === open);
  const idx = (s: string) => stages.indexOf(s);
  /** Can this person move the deal to stage s? (§4.2) */
  const canMove = (d: Deal, s: string) => {
    if (s === 'Won' || s === 'Lost') return false; // won/lost goes through the drawer with a reason
    if (staff) return d.owner === c.me && idx(s) <= idx('Quote sent');
    if (c.role === 'supervisor') return d.value <= m.settings.limits.supDeal || idx(s) <= idx('Negotiating');
    return true;
  };
  const move = (d: Deal, s: string) => {
    if (!canMove(d, s)) return setMsg(staff ? 'You can move your deals up to Quote sent. Ask your supervisor to close.' : 'Above your limit · ask the Manager.');
    m.setDeals(m.deals.map((x) => (x.id === d.id ? { ...x, stage: s, probability: PROB[s] ?? x.probability, stageSince: Date.now() } : x)));
    addNote(c, d.customerPhone, 'system', `Deal ${d.id} moved to ${s}`); setMsg(`${d.customer} moved to ${s}`);
  };
  const people = assignable(c);
  const saveNew = () => {
    if (!add) return; const cu = m.custs.find((x) => phoneKey(x.phone) === phoneKey(add.phone));
    if (!cu && (add.name.trim().length < 2 || phoneKey(add.phone).length !== 9)) return setAdd({ ...add, err: 'Pick a customer, or type a name and a 9-digit phone number.' });
    if (!add.title.trim() || !(parseFloat(add.value) > 0)) return setAdd({ ...add, err: 'Add what they want and the value.' });
    const d: Deal = { id: uid('DL'), customerPhone: cu?.phone || fmtPhone(add.phone), customer: cu?.name || add.name.trim(), title: add.title.trim(), value: parseFloat(add.value), stage: stages[0], probability: 20, owner: add.owner || c.me, branch: cu?.br && c.role === 'superuser' ? cu.br : c.br, linkedDocs: [], expectedClose: Date.now() + 14 * 864e5, stageSince: Date.now(), nextFollowUp: Date.now() + 864e5, items: [{ name: add.title.trim(), qty: 1, price: parseFloat(add.value) }] };
    m.setDeals([d, ...m.deals]); setAdd(null); setMsg(`Deal ${d.id} created`);
  };
  const Card = ({ d }: { d: Deal }) => { const a = age(d); const i = idx(d.stage); return (
    <article className="bg-white rounded-[20px] border border-line p-3 flex flex-col gap-1.5 text-sm">
      <button onClick={() => setOpen(d.id)} className="text-left flex flex-col gap-0.5"><b>{d.customer}</b><span className="text-xs text-muted">{d.title}</span></button>
      <b className="text-[15px]">{ghs(d.value)}</b>
      <span className="text-xs text-muted">{d.linkedDocs[0] ? `${d.linkedDocs[0].type} ${d.linkedDocs[0].no}` : 'No document yet'} · {d.owner}</span>
      <span className="flex items-center gap-1.5 flex-wrap"><Pill t={a.t} tone={a.tone} />{d.approval?.status === 'pending' && <Pill t="Waiting for approval" tone="warn" />}</span>
      <span className="text-xs text-muted">Next follow-up {fmtWhen(d.nextFollowUp)}{d.nextFollowUp < Date.now() && d.stage !== 'Won' && d.stage !== 'Lost' ? ' · overdue' : ''}</span>
      {d.stage !== 'Won' && d.stage !== 'Lost' && <div className="flex gap-1.5 pt-1">
        <button aria-label={`Move ${d.customer} back`} disabled={i <= 0} onClick={() => move(d, stages[i - 1])} className="w-9 h-9 rounded-full border border-line disabled:opacity-30">‹</button>
        <button aria-label={`Move ${d.customer} forward`} disabled={i >= stages.indexOf('Awaiting payment') || !canMove(d, stages[i + 1])} onClick={() => move(d, stages[i + 1])} className="w-9 h-9 rounded-full border border-line disabled:opacity-30">›</button>
        <button onClick={() => setOpen(d.id)} className="ml-auto h-9 px-3 rounded-full border border-line text-[12px]">Open</button>
      </div>}
    </article>
  ); };
  return (
    <>
      <Head title={staff ? 'My deals' : 'Deals pipeline'} sub={staff ? 'Your deals · move them up to Quote sent, then ask your supervisor to close' : `Quotes and big orders from enquiry to payment · ${c.role === 'superuser' ? (m.vb === 'all' ? 'all branches' : BR[m.vb]) : 'My branch'}`} actions={<>
        <Chips label="View" value={view} onChange={setView} opts={[['board', 'Board'], ['list', 'List']]} />
        <button onClick={() => setAdd({ cq: '', phone: '', name: '', title: '', value: '', owner: '', err: '' })} className={btnP}>+ New deal</button>
      </>} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Open deals</span><br /><strong className="text-2xl font-semibold">{openD.length}</strong></div>
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Open value</span><br /><strong className="text-2xl font-semibold">{ghs(openD.reduce((a, d) => a + d.value, 0))}</strong></div>
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Weighted forecast</span><br /><strong className="text-2xl font-semibold">{ghs(weighted)}</strong><br /><span className="text-xs text-muted">Value × chance of winning</span></div>
        <div className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">Won this month</span><br /><strong className="text-2xl font-semibold" style={{ color: '#1f7a2a' }}>{ghs(D.filter((d) => d.stage === 'Won').reduce((a, d) => a + d.value, 0))}</strong></div>
      </div>
      {!D.length ? <Empty text={staff ? 'You have no deals yet. Turn a lead into a deal from My leads.' : 'No deals yet.'} /> : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {stages.map((s) => { const L = D.filter((d) => d.stage === s); return (
            <section key={s} aria-label={s} className="flex-none w-[260px] rounded-3xl p-3 flex flex-col gap-2" style={{ background: s === 'Won' ? '#e7f4e8' : s === 'Lost' ? '#f2f4f5' : '#eef6f6' }}>
              <div className="flex justify-between items-baseline px-1"><b className="text-sm">{s}</b><span className="text-xs text-muted">{L.length} · {ghs(L.reduce((a, d) => a + d.value, 0))}</span></div>
              {L.map((d) => <Card key={d.id} d={d} />)}
              {!L.length && <span className="text-xs text-muted px-1 py-4 text-center">Nothing here</span>}
            </section>
          ); })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-card overflow-x-auto"><table className="w-full text-sm min-w-[900px]"><thead><tr className="text-left text-xs text-muted uppercase tracking-wide">{['Customer', 'Deal', 'Stage', 'Value', 'Chance', 'Document', 'Owner', 'In stage', 'Next follow-up'].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{D.map((d) => { const a = age(d); return <tr key={d.id} onClick={() => setOpen(d.id)} className="border-t border-line cursor-pointer hover:bg-[#f6f7f8]"><td className="px-3 py-2.5 font-medium">{d.customer}</td><td className="px-3">{d.title}</td><td className="px-3">{d.stage}</td><td className="px-3 whitespace-nowrap">{ghs(d.value)}</td><td className="px-3">{d.probability}%</td><td className="px-3">{d.linkedDocs.map((x) => x.no).join(', ') || '—'}</td><td className="px-3">{d.owner}</td><td className="px-3"><Pill t={a.t} tone={a.tone} /></td><td className="px-3 whitespace-nowrap">{fmtWhen(d.nextFollowUp)}</td></tr>; })}</tbody></table></div>
      )}

      {add && <Drawer title="New deal" sub="Link it to a customer by phone number" onClose={() => setAdd(null)}>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Find a customer<input value={add.cq} onChange={(e) => setAdd({ ...add, cq: e.target.value })} placeholder="Name or phone" className={inp} /></label>
        {add.cq.trim().length >= 2 && m.custs.filter((x) => `${x.name} ${x.phone}`.toLowerCase().includes(add.cq.toLowerCase())).slice(0, 5).map((x) => <button key={x.id} onClick={() => setAdd({ ...add, phone: x.phone, name: x.name, cq: '' })} className="text-left text-sm p-2 rounded-xl hover:bg-[#f6f7f8]">{x.name} · {x.phone}</button>)}
        {add.name && phoneKey(add.phone).length === 9 && m.custs.some((x) => phoneKey(x.phone) === phoneKey(add.phone)) ? <Pill t={`Customer: ${add.name}`} tone="teal" /> : <div className="grid grid-cols-2 gap-2"><input aria-label="Customer name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Customer name" className={inp} /><input aria-label="Phone" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} placeholder="+233 phone" className={inp} /></div>}
        <label className="text-[13px] font-semibold flex flex-col gap-1">What do they want?<input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} placeholder="e.g. 20 standing fans" className={inp} /></label>
        <label className="text-[13px] font-semibold flex flex-col gap-1">Value (GHS)<input inputMode="decimal" value={add.value} onChange={(e) => setAdd({ ...add, value: e.target.value.replace(/[^\d.]/g, '') })} className={inp} /></label>
        {!staff && <label className="text-[13px] font-semibold flex flex-col gap-1">Owner<select value={add.owner} onChange={(e) => setAdd({ ...add, owner: e.target.value })} className={inp}><option value="">Me</option>{people.map((s) => <option key={s.name}>{s.name}</option>)}</select></label>}
        {add.err && <span role="alert" className="text-sm text-danger">{add.err}</span>}
        <button onClick={saveNew} className={btnP}>Create deal</button>
      </Drawer>}
      {cur && <DealDrawer m={m} d={cur} onClose={() => setOpen('')} say={setMsg} move={move} canMove={canMove} />}
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}

function DealDrawer({ m, d, onClose, say, move, canMove }: { m: Crm; d: Deal; onClose: () => void; say: (s: string) => void; move: (d: Deal, s: string) => void; canMove: (d: Deal, s: string) => boolean }) {
  const { c } = m; const staff = c.role === 'staff';
  const [reason, setReason] = useState(''); const [want, setWant] = useState<'' | 'Won' | 'Lost'>('');
  const [doc, setDoc] = useState({ type: 'Pro-forma', no: '' });
  const [tk, setTk] = useState<{ type: TaskType; title: string; due: string }>({ type: 'Call', title: '', due: new Date(Date.now() + 864e5).toISOString().slice(0, 10) });
  const up = (p: Partial<Deal>) => m.setDeals(m.deals.map((x) => (x.id === d.id ? { ...x, ...p } : x)));
  const timeline = m.notes.filter((n) => phoneKey(n.customerPhone) === phoneKey(d.customerPhone)).sort((a, b) => b.at - a.at);
  const tasks = m.tasks.filter((t) => t.relatedTo.kind === 'deal' && t.relatedTo.id === d.id);
  const pf = d.linkedDocs.find((x) => x.type === 'Pro-forma');
  const overLimit = c.role === 'supervisor' && d.value > m.settings.limits.supDeal;
  const close = () => {
    if (!want) return; if (want === 'Lost' && !reason) return say('Choose why it was lost.');
    if (staff || overLimit) {
      request('close-deal', `Mark ${d.id} ${d.customer} as ${want} (${ghs(d.value)}${overLimit ? ', over the Supervisor limit' : ''})`, c, { deal: d.id, want, reason });
      up({ approval: { requestedBy: c.me, status: 'pending', want } }); say(staff ? 'Asked your supervisor to close it' : 'Sent to Approvals for the Manager'); setWant(''); return;
    }
    up({ stage: want, probability: want === 'Won' ? 100 : 0, stageSince: Date.now(), lostReason: want === 'Lost' ? reason : undefined, approval: undefined });
    addNote(c, d.customerPhone, 'system', `Deal ${d.id} marked ${want}${want === 'Lost' ? ` · ${reason}` : ''}`); audit(c, 'CRM deal closed', `${d.id} marked ${want}`); say(`${d.customer} marked ${want}`); setWant('');
  };
  return (
    <Drawer title={d.customer} sub={`${d.id} · ${d.title} · ${BR[d.branch]}`} onClose={onClose}>
      <dl className="m-0 grid grid-cols-2 gap-2 text-sm">{[['Value', ghs(d.value)], ['Stage', d.stage], ['Chance', `${d.probability}%`], ['Owner', d.owner], ['Expected close', fmtDate(d.expectedClose)], ['Phone', d.customerPhone]].map(([k, v]) => <div key={k} className="rounded-xl bg-[#f6f7f8] p-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 font-medium">{v}</dd></div>)}</dl>
      {d.stage !== 'Won' && d.stage !== 'Lost' && <label className="text-[13px] font-semibold flex flex-col gap-1">Move to stage<select value={d.stage} onChange={(e) => move(d, e.target.value)} className={inp}>{m.settings.stages.filter((s) => s !== 'Won' && s !== 'Lost').map((s) => <option key={s} disabled={s !== d.stage && !canMove(d, s)}>{s}</option>)}</select></label>}
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Items</span>{d.items.map((i) => <div key={i.name} className="flex justify-between text-sm"><span>{i.qty} × {i.name}</span><b>{ghs(i.qty * i.price)}</b></div>)}</div>
      <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Linked documents</span>
        {d.linkedDocs.map((x) => <div key={x.no} className="flex items-center gap-2 text-sm"><Pill t={x.type} tone="teal" /><span className="flex-1">{x.no}</span><Link to={x.type === 'Pro-forma' ? '/proforma' : x.type === 'Invoice' ? '/invoices' : x.type === 'Contract' ? '/contracts' : '/hirepurchase'} className="underline text-[13px]">Open</Link></div>)}
        {!d.linkedDocs.length && <span className="text-xs text-muted">No documents linked yet.</span>}
        <div className="flex gap-2"><select aria-label="Document type" value={doc.type} onChange={(e) => setDoc({ ...doc, type: e.target.value })} className="h-10 rounded-full border border-line px-3 text-sm">{['Pro-forma', 'Invoice', 'Contract', 'Hire-purchase agreement'].map((t) => <option key={t}>{t}</option>)}</select><input aria-label="Document number" value={doc.no} onChange={(e) => setDoc({ ...doc, no: e.target.value.toUpperCase() })} placeholder="e.g. PF-OSU-0231" className="flex-1 h-10 rounded-full border border-line px-3 text-sm" /><button onClick={() => { if (!doc.no.trim()) return; up({ linkedDocs: [...d.linkedDocs, { type: doc.type, no: doc.no.trim() }] }); setDoc({ ...doc, no: '' }); say('Document linked'); }} className={btnG}>Link</button></div>
        {pf && !d.linkedDocs.some((x) => x.type === 'Invoice') && !staff && <Link to="/proforma" onClick={() => { up({ linkedDocs: [...d.linkedDocs, { type: 'Invoice', no: pf.no.replace('PF', 'INV') }], stage: 'Awaiting payment', probability: 85, stageSince: Date.now() }); addNote(c, d.customerPhone, 'system', `Pro-forma ${pf.no} converted to an invoice`); }} className={cx(btnS, 'w-fit')}>Convert pro-forma to invoice</Link>}
      </div>
      <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Tasks</span>{tasks.map((t) => <div key={t.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{t.type} · {t.title}<br /><span className="text-xs text-muted">{t.assignee} · {fmtWhen(t.dueAt)}</span></span>{t.status === 'done' ? <Pill t="Done" tone="ok" /> : <button onClick={() => m.setTasks(m.tasks.map((x) => (x.id === t.id ? { ...x, status: 'done', doneAt: Date.now() } : x)))} className="h-9 px-3 rounded-full border border-line text-[12px]">Mark done</button>}</div>)}
        <div className="flex gap-2 flex-wrap"><select aria-label="Task type" value={tk.type} onChange={(e) => setTk({ ...tk, type: e.target.value as TaskType })} className="h-10 rounded-full border border-line px-3 text-sm">{(['Call', 'WhatsApp', 'SMS', 'Email', 'Visit', 'Collect payment', 'Deliver', 'Feedback call'] as TaskType[]).map((t) => <option key={t}>{t}</option>)}</select><input aria-label="Task" value={tk.title} onChange={(e) => setTk({ ...tk, title: e.target.value })} placeholder="What to do" className="flex-1 min-w-[140px] h-10 rounded-full border border-line px-3 text-sm" /><input type="date" aria-label="Due" value={tk.due} onChange={(e) => setTk({ ...tk, due: e.target.value })} className="h-10 rounded-full border border-line px-3 text-sm" /><button onClick={() => { if (!tk.title.trim()) return; const t: Task = { id: uid('TK'), type: tk.type, title: tk.title.trim(), relatedTo: { kind: 'deal', id: d.id, name: d.customer }, assignee: d.owner, assignedBy: c.me, branch: d.branch, dueAt: new Date(tk.due + 'T10:00').getTime(), status: 'open', auto: false, source: 'Manual' }; m.setTasks([t, ...m.tasks]); up({ nextFollowUp: t.dueAt }); setTk({ ...tk, title: '' }); say('Follow-up added'); }} className={btnG}>Add</button></div>
      </div>
      {d.stage !== 'Won' && d.stage !== 'Lost' && <div className="flex flex-col gap-2 p-3 rounded-2xl border border-line">
        <span className="text-[13px] font-semibold">{staff ? 'Ask your supervisor to close' : 'Mark won or lost'}</span>
        {d.approval?.status === 'pending' ? <Pill t={`Waiting for approval to mark ${d.approval.want}`} tone="warn" /> : <>
          <Chips label="Outcome" value={want} onChange={setWant} opts={[['Won', 'Won'], ['Lost', 'Lost']]} />
          {want === 'Lost' && <select aria-label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inp}><option value="">Why was it lost?</option>{m.settings.lostReasons.map((r) => <option key={r}>{r}</option>)}</select>}
          {overLimit && <Lock text={`This deal is over your limit of ${ghs(m.settings.limits.supDeal)}. It goes to Approvals for the Manager.`} />}
          <button disabled={!want} onClick={close} className={cx(btnP, 'w-fit')}>{staff ? 'Ask supervisor to close' : overLimit ? 'Request approval' : `Mark ${want || 'won or lost'}`}</button>
        </>}
      </div>}
      {d.lostReason && <span className="text-sm">Lost reason: {d.lostReason}</span>}
      <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Timeline</span>{timeline.map((n) => <div key={n.id} className="text-sm border-l-2 border-brand pl-3">{n.text}<br /><span className="text-xs text-muted">{n.by} · {fmtWhen(n.at)}</span></div>)}{!timeline.length && <span className="text-xs text-muted">Nothing yet.</span>}</div>
    </Drawer>
  );
}
