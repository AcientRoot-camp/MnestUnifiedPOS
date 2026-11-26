// Till-side CRM panel inside Sell Now (§6.3): tier & points, birthday, open follow-up, credit owed, quick actions.
import { useState } from 'react';
import { ghs } from '../../lib/format';
import { addNote, isOverdue, owesOf, phoneKey, uid, type Feedback } from './model';
import { Pill, TierPill, useCrm } from './ui';
import NoticeModal from '../../components/Notice';

export default function TillPanel({ phone, onNewCustomer }: { phone: string; onNewCustomer: () => void }) {
  const m = useCrm(); const { c } = m;
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'' | 'note' | 'feedback'>('');
  const [txt, setTxt] = useState(''); const [rate, setRate] = useState(0); const [ok, setOk] = useState('');
  const x = m.custs.find((y) => phoneKey(y.phone) === phoneKey(phone));
  if (!x) return null;
  const owe = owesOf(x);
  const bd = x.birthday ? new Date(x.birthday) : null;
  const bdSoon = bd ? (() => { const n = new Date(); const t = new Date(n.getFullYear(), bd.getMonth(), bd.getDate()); const d = (t.getTime() - new Date(n.toDateString()).getTime()) / 864e5; return d >= 0 && d <= 7; })() : false;
  const fu = m.tasks.find((t) => t.status === 'open' && (phoneKey(t.relatedTo.id) === phoneKey(phone) || t.relatedTo.name === x.name)) ?? null;
  const note = m.notes.find((n) => phoneKey(n.customerPhone) === phoneKey(phone) && (n.kind === 'call' || n.kind === 'note'));
  const save = () => {
    if (mode === 'note') { if (!txt.trim()) return; addNote(c, x.phone, 'note', txt.trim()); setOk('Note saved to their profile'); }
    if (mode === 'feedback') { if (!rate) return; const f: Feedback = { id: uid('FB'), customerPhone: x.phone, customer: x.name, rating: rate, comment: txt.trim(), channel: 'Till', branch: c.br, staff: c.me, kind: rate <= 2 ? 'complaint' : 'rating', category: rate <= 2 ? 'Other' : undefined, status: rate <= 2 ? 'open' : 'resolved', at: Date.now(), slaDueAt: Date.now() + m.settings.slaHours.complaint * 36e5 }; m.setFeedback([f, ...m.feedback]); setOk(rate <= 2 ? 'Logged as a complaint for your Supervisor' : 'Thanks · feedback logged'); }
    setMode(''); setTxt(''); setRate(0);
  };
  return (
    <section aria-label="Customer relationship" className="rounded-2xl border border-[#d9d9d9] bg-white">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-2 px-3.5 min-h-12 text-left text-sm">
        <b className="flex-1">Relationship · {x.name.split(' ')[0]}</b><TierPill tier={x.tier} /><span className="text-xs text-muted">{x.points} pts</span><span aria-hidden className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3.5 pb-3.5 flex flex-col gap-2 text-sm">
        <div className="flex gap-1.5 flex-wrap">
          {bdSoon && <Pill t={`Birthday this week · ${bd!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`} tone="info" />}
          {owe > 0 && <Pill t={`Owes ${ghs(owe)}`} tone="bad" />}
          {fu && <Pill t={isOverdue(fu) ? 'Follow-up overdue' : 'Open follow-up'} tone={isOverdue(fu) ? 'warn' : 'teal'} />}
        </div>
        {(fu || note) && <span className="text-[13px] text-[#3d3a38]">“{fu?.title || note?.text}”{note && !fu ? ` · ${note.by}` : ''}</span>}
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => setMode(mode === 'note' ? '' : 'note')} className="min-h-12 rounded-full border border-[#0b5c5c] text-[#0b5c5c] text-[13px] font-semibold">Add note</button>
          <button onClick={() => setMode(mode === 'feedback' ? '' : 'feedback')} className="min-h-12 rounded-full border border-[#0b5c5c] text-[#0b5c5c] text-[13px] font-semibold">Log feedback</button>
          <button onClick={onNewCustomer} className="min-h-12 rounded-full border border-[#d9d9d9] text-[13px]">Capture new customer</button>
        </div>
        {mode && <div className="flex flex-col gap-2">
          {mode === 'feedback' && <div role="radiogroup" aria-label="Rating" className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rate === n} onClick={() => setRate(n)} className="w-12 h-12 rounded-full border text-base font-semibold" style={rate >= n ? { background: '#000', color: '#fff', borderColor: '#000' } : { borderColor: '#d9d9d9' }}>{n}</button>)}</div>}
          <input aria-label={mode === 'note' ? 'Note' : 'What they said'} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={mode === 'note' ? 'e.g. Wants a fridge after payday' : 'What did they say? (optional)'} className="h-12 rounded-full border border-[#d9d9d9] px-4 text-sm" />
          <button onClick={save} className="min-h-12 rounded-full text-white text-sm font-semibold" style={{ background: '#0b5c5c' }}>Save</button>
        </div>}
        <NoticeModal msg={ok} onClose={() => setOk('')} />
      </div>}
    </section>
  );
}
