// Customer 360 "Relationship" panel inside Customers (§5.5), role-aware (§6.4).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SALES, WEB_ORDERS, COLLECTIONS, type Customer, type WebOrder, type Collection } from '../../data/sell';
import { readKey } from '../../lib/persist';
import { cx, ghs } from '../../lib/format';
import { BR, addNote, firstName, fillTemplate, fmtWhen, health, isOverdue, lifecycle, logMessage, owesOf, phoneKey, spendOf, uid, type Deal, type Feedback, type Task } from './model';
import { Pill, TierPill, btnG, btnS, inp, useCrm } from './ui';
import NoticeModal from '../../components/Notice';
import { WebActivity } from './WebCard';
import { pushWebCode } from './web';

type Ev = { at: number; kind: string; text: string };

export default function Relationship({ customer: x }: { customer: Customer }) {
  const m = useCrm(); const { c } = m; const staff = c.role === 'staff'; const full = c.role === 'superuser' || c.role === 'manager';
  const [act, setAct] = useState<'' | 'note' | 'task' | 'deal' | 'message' | 'feedback'>('');
  const [txt, setTxt] = useState(''); const [val, setVal] = useState(''); const [tpl, setTpl] = useState(m.settings.templates[0]?.id || ''); const [rate, setRate] = useState(0);
  const [msg, setMsg] = useState('');
  const pk = phoneKey(x.phone); const same = (p?: string) => !!p && phoneKey(p) === pk;
  const s = spendOf(x); const h = health(x); const life = lifecycle(x); const owe = owesOf(x);
  const notes = m.notes.filter((n) => same(n.customerPhone) && (!staff || n.by === c.me));
  const deals = m.deals.filter((d) => same(d.customerPhone) && d.stage !== 'Won' && d.stage !== 'Lost' && (!staff || d.owner === c.me));
  const tasks = m.tasks.filter((t) => t.status === 'open' && (same(t.relatedTo.id) || t.relatedTo.name === x.name) && (!staff || t.assignee === c.me));
  const fb = m.feedback.filter((f) => same(f.customerPhone));
  const owner = deals[0]?.owner || m.notes.find((n) => same(n.customerPhone))?.by || '—';
  const tags = [x.tier === 'Gold' && 'VIP', x.group === 'Wholesale' && 'Wholesale', owe > 0 && 'Credit customer', ['Ama Owusu', 'Comfort Nyarko', 'Kwame Ntim'].includes(x.name) && 'Hire purchase', x.birthday && new Date(x.birthday).getMonth() === new Date().getMonth() && 'Birthday soon'].filter(Boolean) as string[];
  // Unified timeline from the existing keys (read, never copied).
  const tl: Ev[] = [
    ...SALES.filter((v) => v.cust === x.name).slice(0, 12).map((v) => ({ at: v.ts, kind: v.ch === 'web' ? 'Web order' : 'Till sale', text: `Sale #${v.no} · ${v.lines.map((l) => l.name).slice(0, 2).join(', ')} · ${ghs(v.total)}` })),
    ...readKey<{ no: string; ts: number; total: number; cust?: { phone: string }; method: string }[]>('ecompos.sales2', []).filter((v) => same(v.cust?.phone)).map((v) => ({ at: v.ts, kind: 'Till sale', text: `Sale #${v.no} · ${v.method.split(' · ')[0]} · ${ghs(v.total)}` })),
    ...readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS).filter((o) => same(o.phone)).map((o) => ({ at: Date.now() - 864e5, kind: 'Web order', text: `#${o.id} · ${o.items.length} items · ${o.status}` })),
    ...readKey<Collection[]>('ecompos.collect2', COLLECTIONS).filter((o) => same(o.phone)).map((o) => ({ at: Date.now() - 2 * 864e5, kind: 'Collect', text: `Collect order #${o.no} · ${o.status}` })),
    ...readKey<{ cust: string; amt: number; method: string; at: string; sale: string }[]>('ecompos.creditPays2', []).filter((p) => p.cust === x.name).map((p) => ({ at: new Date(p.at).getTime() || Date.now(), kind: 'Credit payment', text: `${ghs(p.amt)} on sale #${p.sale} · ${p.method}` })),
    ...readKey<{ at: string; to: string; via: string; text: string; by: string }[]>('ecompos.smsOutbox', []).filter((o) => same(o.to)).slice(0, 8).map((o) => ({ at: Date.now() - 3600e3, kind: 'Message', text: `${o.via} · ${o.text.slice(0, 70)}${o.text.length > 70 ? '…' : ''} · ${o.by}` })),
    ...readKey<{ id: string; ref: string; title: string; status: string }[]>('ecompos.tickets2', []).filter((t) => fb.some((f) => f.id === t.ref)).map((t) => ({ at: Date.now() - 1800e3, kind: 'Ticket', text: `${t.id} · ${t.title} · ${t.status}` })),
    ...notes.map((n) => ({ at: n.at, kind: n.kind === 'note' ? 'Note' : n.kind === 'call' ? 'Call' : n.kind === 'visit' ? 'Visit' : n.kind === 'feedback' ? 'Feedback' : 'Update', text: `${n.text} · ${n.by}` })),
    ...x.codes.map((k) => ({ at: Date.now() - 5 * 864e5, kind: 'Loyalty', text: `Code ${k.code} · ${k.txt}${k.used ? ' · used' : ''}` })),
  ].filter((e) => e.at).sort((a, b) => b.at - a.at).slice(0, staff ? 6 : 14);
  const done = (t: string) => { setMsg(t); setAct(''); setTxt(''); setVal(''); setRate(0); };
  const doIt = () => {
    if (act === 'note') { if (!txt.trim()) return; addNote(c, x.phone, 'note', txt.trim()); return done('Note added'); }
    if (act === 'task') { if (!txt.trim()) return; const t: Task = { id: uid('TK'), type: 'Call', title: txt.trim(), relatedTo: { kind: 'customer', id: x.phone, name: x.name }, assignee: staff ? c.me : owner !== '—' ? owner : c.me, assignedBy: c.me, branch: x.br, dueAt: Date.now() + 864e5, status: 'open', auto: false, source: 'Customer profile' }; m.setTasks([t, ...m.tasks]); return done(`Follow-up added for ${t.assignee}`); }
    if (act === 'deal') { if (!txt.trim() || !(parseFloat(val) > 0)) return setMsg('Add what they want and the value.'); const d: Deal = { id: uid('DL'), customerPhone: x.phone, customer: x.name, title: txt.trim(), value: parseFloat(val), stage: m.settings.stages[0], probability: 20, owner: c.me, branch: x.br, linkedDocs: [], expectedClose: Date.now() + 14 * 864e5, stageSince: Date.now(), nextFollowUp: Date.now() + 864e5, items: [{ name: txt.trim(), qty: 1, price: parseFloat(val) }] }; m.setDeals([d, ...m.deals]); return done(`Deal ${d.id} created`); }
    if (act === 'message') { if (!x.sms && !x.whatsapp) return setMsg(`${firstName(x.name)} has not agreed to SMS or WhatsApp.`); const tp = m.settings.templates.find((t) => t.id === tpl)!; const text = fillTemplate(tp.text, { first: firstName(x.name), staff: c.me, branch: BR[x.br] }); const via = x.whatsapp ? 'WhatsApp' : 'SMS'; if (via === 'WhatsApp') window.open(`https://wa.me/233${pk}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); logMessage(c, via, x.phone, text); addNote(c, x.phone, 'message', `${via} · ${tp.name}`); return done(`${via} sent · logged in Messages`); }
    if (act === 'feedback') { if (!rate) return setMsg('Choose a rating from 1 to 5.'); const f: Feedback = { id: uid('FB'), customerPhone: x.phone, customer: x.name, rating: rate, comment: txt.trim(), channel: 'Till', branch: x.br, staff: c.me, kind: rate <= 2 ? 'complaint' : 'rating', category: rate <= 2 ? 'Other' : undefined, status: rate <= 2 ? 'open' : 'resolved', at: Date.now(), slaDueAt: Date.now() + m.settings.slaHours.complaint * 36e5 }; m.setFeedback([f, ...m.feedback]); return done(rate <= 2 ? 'Logged as a complaint · your Supervisor handles it first' : 'Feedback logged'); }
  };
  const issueCode = () => { const code = `${firstName(x.name).toUpperCase().slice(0, 4)}10-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; m.setCusts(m.custs.map((y) => (y.id === x.id ? { ...y, codes: [{ code, txt: '10% off · issued from the CRM', used: false }, ...y.codes] } : y))); pushWebCode({ code, value: 10, type: 'pct', note: `Customer code · ${x.name}`, by: c.me, only: x.phone, days: 60 }); addNote(c, x.phone, 'system', `Code ${code} issued · works in store and at the webstore checkout`); setMsg(`Code ${code} issued · 10% off in store or online (tied to ${x.phone})`); };
  return (
    <section className="bg-white rounded-[28px] shadow-card p-5 flex flex-col gap-4" aria-labelledby="rel-h">
      <div className="flex justify-between gap-3 flex-wrap items-start">
        <div><h2 id="rel-h" className="m-0 text-lg font-semibold">Relationship</h2><span className="text-[13px] text-muted">{staff ? 'What you need to serve them well' : 'Everything this customer has done with us, in one place'}</span></div>
        <div className="flex gap-1.5 flex-wrap"><TierPill tier={x.tier} /><Pill t={life} tone={life === 'At risk' || life === 'Lapsed' ? 'warn' : life === 'Loyal' ? 'ok' : 'teal'} />{tags.map((t) => <Pill key={t} t={t} />)}</div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {staff ? <>
          <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Points</span><br /><b className="text-lg">{x.points}</b></div>
          <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Last visit</span><br /><b className="text-lg">{s.last ? fmtWhen(s.last) : '—'}</b></div>
          {owe > 0 && <div className="rounded-2xl p-3" style={{ background: '#fbeaea' }}><span className="text-xs text-muted">Owes</span><br /><b className="text-lg" style={{ color: '#c62828' }}>{ghs(owe)}</b></div>}
          <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Open follow-up</span><br /><b className="text-sm">{tasks[0]?.title || 'None'}</b></div>
        </> : <>
          <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Lifetime spend</span><br /><b className="text-lg">{ghs(s.total)}</b><br /><span className="text-xs text-muted">{s.count} visits</span></div>
          {full ? <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Health score</span><br /><b className="text-lg" style={{ color: h.score >= 70 ? '#1f7a2a' : h.score >= 40 ? '#b26a00' : '#c62828' }}>{h.score} / 100</b><br /><span className="text-xs text-muted">{h.why}</span></div> : <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Last visit</span><br /><b className="text-lg">{s.last ? fmtWhen(s.last) : '—'}</b></div>}
          <div className="rounded-2xl p-3" style={{ background: owe ? '#fbeaea' : '#f6f7f8' }}><span className="text-xs text-muted">Credit owed</span><br /><b className="text-lg" style={{ color: owe ? '#c62828' : undefined }}>{ghs(owe)}</b></div>
          <div className="rounded-2xl bg-[#f6f7f8] p-3"><span className="text-xs text-muted">Owner</span><br /><b className="text-lg">{owner}</b></div>
        </>}
      </div>
      <WebActivity phone={x.phone} staff={staff} />
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setAct(act === 'note' ? '' : 'note')} className={btnS}>Add note</button>
        {staff ? <button onClick={() => setAct(act === 'feedback' ? '' : 'feedback')} className={btnS}>Log feedback</button> : <><button onClick={() => setAct(act === 'task' ? '' : 'task')} className={btnS}>Add task</button><button onClick={() => setAct(act === 'deal' ? '' : 'deal')} className={btnS}>Create deal</button></>}
        <button onClick={() => setAct(act === 'message' ? '' : 'message')} className={btnS}>{staff ? 'Send approved message' : 'Send message'}</button>
        {!staff && <button onClick={issueCode} className={btnG}>Issue code</button>}
      </div>
      {act && <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#f6f7f8]">
        {act === 'message' ? <><select aria-label="Message" value={tpl} onChange={(e) => setTpl(e.target.value)} className={inp}>{m.settings.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><span className="text-xs text-muted">{x.whatsapp ? 'Goes by WhatsApp.' : x.sms ? 'Goes by SMS.' : 'No SMS or WhatsApp consent · this message cannot be sent.'}{!staff && <> Need a custom message? <Link to="/messages" className="underline">Open Messages</Link>.</>}</span></>
          : act === 'feedback' ? <div role="radiogroup" aria-label="Rating" className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rate === n} onClick={() => setRate(n)} className={cx('w-12 h-12 rounded-full border text-base font-semibold', rate >= n ? 'bg-black text-white border-black' : 'bg-white border-line')}>{n}</button>)}</div> : null}
        {act !== 'message' && <input aria-label="Details" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={act === 'note' ? 'e.g. Prefers delivery after 5pm' : act === 'task' ? 'e.g. Call about the fridge after payday' : act === 'deal' ? 'What do they want?' : 'What did they say? (optional)'} className={inp} />}
        {act === 'deal' && <input aria-label="Value in GHS" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Value (GHS)" className={inp} />}
        <button onClick={doIt} className="w-fit min-h-10 px-4 rounded-full text-white text-sm font-semibold" style={{ background: '#0b5c5c' }}>Save</button>
      </div>}
      <NoticeModal msg={msg} onClose={() => setMsg('')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2"><b className="text-sm">Timeline</b>{tl.map((e, i) => <div key={i} className="flex gap-3 text-sm"><span className="w-24 shrink-0"><Pill t={e.kind} tone={e.kind === 'Ticket' ? 'bad' : e.kind === 'Message' ? 'info' : e.kind.includes('payment') ? 'ok' : 'mute'} /></span><span className="flex-1">{e.text}<br /><span className="text-xs text-muted">{fmtWhen(e.at)}</span></span></div>)}{!tl.length && <span className="text-xs text-muted">Nothing yet.</span>}</div>
        <div className="flex flex-col gap-3">
          {!!deals.length && <div className="flex flex-col gap-1.5"><b className="text-sm">Open deals</b>{deals.map((d) => <div key={d.id} className="flex justify-between text-sm"><span>{d.title} · {d.stage}</span>{!staff && <b>{ghs(d.value)}</b>}</div>)}</div>}
          <div className="flex flex-col gap-1.5"><b className="text-sm">{staff ? 'My follow-ups' : 'Follow-ups'}</b>{tasks.map((t) => <div key={t.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{t.title}<br /><span className="text-xs text-muted">{t.assignee} · {fmtWhen(t.dueAt)}</span></span>{isOverdue(t) && <Pill t="Overdue" tone="warn" />}</div>)}{!tasks.length && <span className="text-xs text-muted">None open.</span>}</div>
          {!staff && <div className="flex flex-col gap-1.5"><b className="text-sm">Satisfaction</b>{fb.map((f) => <div key={f.id} className="text-sm">{f.rating}/5 · {f.comment || f.category} <span className="text-xs text-muted">· {fmtWhen(f.at)}</span></div>)}{!fb.length && <span className="text-xs text-muted">No ratings yet.</span>}</div>}
        </div>
      </div>
    </section>
  );
}
