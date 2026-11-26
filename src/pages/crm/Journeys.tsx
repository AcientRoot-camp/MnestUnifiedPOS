// Customer journeys (§5.9): trigger → wait → condition → action, with results. Admin builds; Manager views branch results.
import { useState } from 'react';
import { cx, ghs } from '../../lib/format';
import { BR, audit, uid, type Journey, type Step } from './model';
import { Head, Lock, Pill, Toastish, btnG, btnP, inp, type Crm } from './ui';

const KIND: Record<Step['kind'], [string, string]> = { trigger: ['When', '#0b5c5c'], wait: ['Wait', '#5f5c5a'], condition: ['Only if', '#b26a00'], action: ['Then', '#1f7a2a'] };

export default function Journeys({ m }: { m: Crm }) {
  const { c } = m; const admin = c.caps.journeys === 'build';
  const [sel, setSel] = useState(m.journeys[0]?.id || '');
  const [step, setStep] = useState<{ kind: Step['kind']; text: string }>({ kind: 'action', text: '' });
  const [nj, setNj] = useState('');
  const [msg, setMsg] = useState('');
  const cur = m.journeys.find((j) => j.id === sel) ?? m.journeys[0];
  const up = (id: string, p: Partial<Journey>) => m.setJourneys(m.journeys.map((j) => (j.id === id ? { ...j, ...p } : j)));
  const stat = (j: Journey) => (c.role === 'superuser' ? { ...j.stats } : { sent: j.byBranch[c.br]?.sent || 0, converted: j.byBranch[c.br]?.converted || 0, revenue: Math.round(j.stats.revenue * ((j.byBranch[c.br]?.converted || 0) / Math.max(1, j.stats.converted))) });
  return (
    <>
      <Head title="Customer journeys" sub={admin ? 'Automatic messages and follow-ups · they respect consent and “Reply STOP to opt out”' : 'Automatic messages and follow-ups · results for My branch'} actions={admin ? <span className="flex gap-2"><input aria-label="New journey name" value={nj} onChange={(e) => setNj(e.target.value)} placeholder="New journey name" className="h-10 rounded-full border border-line bg-white px-4 text-sm" /><button onClick={() => { if (nj.trim().length < 3) return setMsg('Name the journey first.'); const j: Journey = { id: uid('JR'), name: nj.trim(), trigger: 'Choose a trigger', channel: 'SMS · sender ID EBENEZERUV', steps: [{ kind: 'trigger', text: 'Choose a trigger' }], active: false, stats: { sent: 0, converted: 0, revenue: 0 }, byBranch: {} }; m.setJourneys([...m.journeys, j]); setSel(j.id); setNj(''); audit(c, 'CRM journey created', j.name); }} className={btnP}>+ New journey</button></span> : undefined} />
      {!admin && <Lock text="Journeys are built and switched on by the Admin. You can see how they perform at your branch." />}
      <div className="grid gap-5 xl:grid-cols-[380px_1fr] items-start">
        <section className="flex flex-col gap-2" aria-label="Journeys">
          {m.journeys.map((j) => { const s = stat(j); return (
            <div key={j.id} className={cx('bg-white rounded-[20px] shadow-card p-4 flex flex-col gap-2', cur?.id === j.id && 'ring-2 ring-brand')}>
              <div className="flex justify-between gap-2 items-start"><button onClick={() => setSel(j.id)} className="text-left flex flex-col"><b className="text-sm">{j.name}</b><span className="text-xs text-muted">{j.channel}</span></button>
                {admin ? <button role="switch" aria-checked={j.active} aria-label={`${j.name} ${j.active ? 'on' : 'off'}`} onClick={() => { up(j.id, { active: !j.active }); audit(c, 'CRM journey switched', `${j.name} ${j.active ? 'off' : 'on'}`); setMsg(`${j.name} switched ${j.active ? 'off' : 'on'}`); }} className="flex items-center gap-2 text-xs"><span className="w-11 h-6 rounded-full p-0.5" style={{ background: j.active ? '#1f7a2a' : '#cccccc' }}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', j.active && 'translate-x-5')} /></span>{j.active ? 'On' : 'Off'}</button> : <Pill t={j.active ? 'On' : 'Off'} tone={j.active ? 'ok' : 'mute'} />}</div>
              <div className="grid grid-cols-3 gap-2 text-xs"><span><b className="text-sm block">{s.sent}</b>sent</span><span><b className="text-sm block">{s.converted}</b>responded</span><span><b className="text-sm block">{s.revenue ? ghs(s.revenue) : '—'}</b>sales</span></div>
            </div>
          ); })}
        </section>
        {cur && <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-4 min-w-0">
          <div className="flex justify-between gap-3 flex-wrap"><div><h2 className="m-0 text-lg font-semibold">{cur.name}</h2><span className="text-[13px] text-muted">{cur.channel} · {cur.active ? 'running' : 'switched off'}</span></div>{c.role === 'superuser' && <div className="flex gap-2 flex-wrap text-xs">{Object.entries(cur.byBranch).map(([b, v]) => <Pill key={b} t={`${BR[b]} · ${v.converted}/${v.sent}`} />)}</div>}</div>
          <ol className="m-0 p-0 list-none flex flex-col">
            {cur.steps.map((s, i) => <li key={i} className="flex gap-3"><div className="flex flex-col items-center"><span className="w-9 h-9 rounded-full text-white text-[11px] font-bold flex items-center justify-center" style={{ background: KIND[s.kind][1] }}>{i + 1}</span>{i < cur.steps.length - 1 && <span className="w-0.5 flex-1 min-h-6 bg-line" />}</div><div className="pb-4 flex-1 flex items-start gap-2"><span className="flex-1"><span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: KIND[s.kind][1] }}>{KIND[s.kind][0]}</span><br /><span className="text-sm">{s.text}</span></span>{admin && i > 0 && <button onClick={() => up(cur.id, { steps: cur.steps.filter((_, j) => j !== i) })} aria-label={`Remove step ${i + 1}`} className="w-8 h-8 rounded-full border border-line text-sm">×</button>}</div></li>)}
          </ol>
          {admin && <div className="flex gap-2 flex-wrap items-end p-3 rounded-2xl bg-[#f6f7f8]">
            <label className="text-[13px] font-semibold flex flex-col gap-1">Add a step<select value={step.kind} onChange={(e) => setStep({ ...step, kind: e.target.value as Step['kind'] })} className="h-11 rounded-full border border-line bg-white px-4 text-sm"><option value="wait">Wait</option><option value="condition">Only if</option><option value="action">Then</option><option value="trigger">When (change the trigger)</option></select></label>
            <input aria-label="Step details" value={step.text} onChange={(e) => setStep({ ...step, text: e.target.value })} placeholder={step.kind === 'wait' ? 'e.g. Wait 3 days' : step.kind === 'condition' ? 'e.g. Opted in to WhatsApp' : 'e.g. Send a thank-you SMS'} className={cx(inp, 'flex-1 min-w-[200px]')} />
            <button onClick={() => { if (!step.text.trim()) return; up(cur.id, step.kind === 'trigger' ? { trigger: step.text.trim(), steps: [{ kind: 'trigger', text: step.text.trim() }, ...cur.steps.slice(1)] } : { steps: [...cur.steps, { kind: step.kind, text: step.text.trim() }] }); setStep({ ...step, text: '' }); audit(c, 'CRM journey edited', cur.name); }} className={btnG}>Add</button>
          </div>}
          <div className="rounded-2xl p-4 text-sm flex flex-col gap-1" style={{ background: '#eef6f6' }}><b>Providers</b><span>SMS sender ID EBENEZERUV · WhatsApp Business +233 24 000 1111 · Email hello@ebenezerunique.com.gh</span><span className="text-xs text-muted">Every journey checks consent per channel before sending, and every SMS ends with “Reply STOP to opt out”. Sends appear in Messages.</span></div>
        </section>}
      </div>
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}
