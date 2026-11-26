import { useState } from 'react';
import { bName, dAgo, dayTxt, FBR, FLOAT, MT, money, outstanding, placeName, RANK, SRC, takings, TODAY, type Src } from '../../data/finance';
import { cx } from '../../lib/format';
import { Card, Field, num, Pills, r2, stamp, T, type Ctx } from './shared';

const NOTES: [string, number][] = [['200', 200], ['100', 100], ['50', 50], ['20', 20], ['10', 10], ['5', 5], ['2', 2], ['1', 1], ['Coins (GHS total)', 0]];

export function Cashup({ c }: { c: Ctx }) {
  const { S, setS, SU, scope, myBr, me, role, flash } = c;
  const br = SU && scope !== 'all' ? scope : myBr;
  const [cnt, setCnt] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const isStaff = role === 'staff';
  const counted = r2(NOTES.reduce((a, [k, v]) => a + (v ? v * num(cnt[k] || '') : num(cnt[k] || '')), 0));
  const cashSales = isStaff ? Math.round(takings(br, TODAY).cash * 0.4) : takings(br, TODAY).cash;
  const expected = r2(FLOAT + cashSales);
  const variance = r2(counted - expected);
  const any = NOTES.some(([k]) => num(cnt[k] || '') > 0);
  const label = !any ? 'Difference' : Math.abs(variance) < 0.005 ? 'Exact — well done' : variance < 0 ? 'Short' : 'Over';
  const tone = !any ? '' : Math.abs(variance) < 0.005 ? 'text-ok' : variance < 0 ? 'text-danger' : 'text-[#b26a00]';
  const needWhy = any && Math.abs(variance) >= 1;
  const list = S.cus.filter((x) => (SU ? scope === 'all' || x.br === scope : isStaff ? x.by === me : x.br === myBr)).sort((a, b) => (a.day < b.day ? 1 : -1));

  const submit = () => {
    if (!any) return setErr('Type how many of each note you counted.');
    if (needWhy && !note.trim()) return setErr('Say why the count is different.');
    setS((s) => ({ ...s, cus: [{ id: 'CU-' + Date.now(), br, day: TODAY, till: 'Till 1', expected, counted, variance, note: note.trim(), by: me }, ...s.cus] }));
    setCnt({}); setNote(''); setErr('');
    flash(`Cash-up saved · ${money(Math.max(0, counted - FLOAT))} to bank. The deposit form is filled in for you.`);
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_1fr] items-start">
      <Card title="Count the drawer" sub={`${isStaff ? 'Your till' : bName(br) + ' · Till 1'} · ${dayTxt(TODAY)} · type how many of each note you have`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {NOTES.map(([k, v]) => (
            <label key={k} className="flex flex-col gap-1 p-3 rounded-2xl bg-canvas text-[13px] font-semibold">
              <span>{v ? `GHS ${k}` : k} <span className="font-normal text-muted">= {money(v ? v * num(cnt[k] || '') : num(cnt[k] || ''))}</span></span>
              <input inputMode={v ? 'numeric' : 'decimal'} value={cnt[k] || ''} onChange={(e) => { setCnt((x) => ({ ...x, [k]: v ? e.target.value.replace(/\D/g, '').slice(0, 5) : e.target.value.replace(/[^0-9.]/g, '').slice(0, 8) })); setErr(''); }} placeholder="0" className="px-3 py-2 rounded-xl border border-line bg-white font-normal text-[15px]" />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm p-4 rounded-2xl border border-line">
          <span>Counted in the drawer</span><strong className="text-right">{money(counted)}</strong>
          <span className="text-muted">Opening float</span><span className="text-right">{money(FLOAT)}</span>
          <span className="text-muted">Cash sales today</span><span className="text-right">{money(cashSales)}</span>
          <span>Expected in the drawer</span><strong className="text-right">{money(expected)}</strong>
          <strong className={cx('border-t border-line pt-1.5', tone)}>{label}</strong><strong className={cx('text-right border-t border-line pt-1.5', tone)}>{(variance > 0 ? '+ ' : variance < 0 ? '− ' : '') + money(Math.abs(variance))}</strong>
        </div>
        {needWhy && <Field label="Why is it different? (needed)" value={note} onChange={(v) => { setNote(v); setErr(''); }} ph="e.g. gave GHS 20 change twice" />}
        {err && <span role="alert" className="text-sm text-danger">{err}</span>}
        <button onClick={submit} className="btn-primary">Submit cash-up · {money(counted)}</button>
        <span className="text-xs text-muted">After the count, MNest UnifiedPOS works out what to bank and fills in the deposit for you. The float stays in the drawer for tomorrow.</span>
      </Card>
      <Card title="Cash-up history" sub={SU ? 'All branches · newest first' : isStaff ? 'Your cash-ups' : `${bName(myBr)} branch`}>
        {list.length === 0 ? <span className="text-sm text-muted">No cash-ups yet.</span> : (
          <T head={['Day', 'Branch · till', 'Expected', 'Counted', 'Difference']} rows={list.slice(0, 20).map((x) => [<span key="d">{dayTxt(x.day)}<br /><span className="text-xs text-muted">{x.by}</span></span>, <span key="w">{bName(x.br)} · {x.till}{x.note && <><br /><span className="text-xs text-muted">“{x.note}”</span></>}</span>, money(x.expected), money(x.counted), <b key="v" className={x.variance < 0 ? 'text-danger' : x.variance > 0 ? 'text-[#b26a00]' : 'text-ok'}>{x.variance ? (x.variance > 0 ? '+ ' : '− ') + money(Math.abs(x.variance)) : 'Exact'}</b>])} />
        )}
      </Card>
    </div>
  );
}

type DF = { br: string; mode: 'one' | 'range' | 'week'; src: Src; day: string; from: string; to: string; amount: string; acc: string; slip: string; note: string };

export function Deposits({ c }: { c: Ctx }) {
  const { S, setS, SU, brs, myBr, me, flash } = c;
  const [pop, setPop] = useState(false);
  const [dlTab, setDlTab] = useState<'all' | 'pending' | 'verified' | 'flagged'>(SU ? 'pending' : 'all');
  const [shown, setShown] = useState(8);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [df, setDf] = useState<DF>({ br: brs[0] ?? myBr, mode: 'one', src: 'cash', day: dAgo(1), from: dAgo(3), to: dAgo(1), amount: '', acc: 'gcb', slip: '', note: '' });
  const up = (p: Partial<DF>) => { setDf((x) => ({ ...x, ...p })); setErr(''); };
  const OUT = outstanding(S).filter((o) => brs.includes(o.br));
  const days = df.mode === 'one' ? [df.day] : df.mode === 'week' ? Array.from({ length: 7 }, (_, i) => dAgo(i + 1)) : rangeDays(df.from, df.to);
  const breakdown = days.map((d) => ({ d, amt: OUT.filter((o) => o.br === df.br && o.src === df.src && o.day === d).reduce((a, o) => a + o.amount, 0) })).filter((x) => x.amt > 0);
  const suggested = breakdown.reduce((a, x) => a + x.amt, 0);
  const accs = S.acc.filter((a) => a.kind !== 'clearing');
  const isMomo = df.src !== 'cash';

  const record = () => {
    const amt = r2(num(df.amount || String(suggested)));
    if (!amt) return setErr('Enter the amount.');
    if (!df.slip.trim()) return setErr(isMomo ? 'Enter the transaction ID.' : 'Enter the bank slip number.');
    setS((s) => ({ ...s, dep: [{ id: 'DEP-0' + (300 + s.dep.length), br: df.br, days, src: df.src, amount: amt, acc: df.acc, slip: df.slip.trim(), note: df.note, status: SU ? 'verified' : 'pending', by: me, at: stamp(), ts: Date.now() }, ...s.dep] }));
    setPop(false);
    up({ amount: '', slip: '', note: '' });
    flash(`${money(amt)} recorded to ${placeName(df.acc, S)}${SU ? '' : ' · waiting for the Admin to check it against the statement'}`);
  };
  const setStatus = (id: string, status: 'verified' | 'flagged') => {
    if (status === 'flagged' && !(why[id] || '').trim()) return flash('Add a note for the branch before flagging.', true);
    setS((s) => ({ ...s, dep: s.dep.map((d) => (d.id === id ? { ...d, status, why: why[id] } : d)) }));
    flash(status === 'verified' ? 'Deposit checked against the statement' : 'Deposit flagged · the branch has been told');
  };

  const base = S.dep.filter((d) => brs.includes(d.br));
  const dl = base.filter((d) => dlTab === 'all' || d.status === dlTab);

  const form = (
    <Card title="Move takings to the bank" sub={`${bName(df.br)} · record the deposit with the slip or transaction ID`} actions={pop ? <button onClick={() => setPop(false)} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button> : undefined}>
      {SU && brs.length > 1 && <Pills opts={FBR.filter((b) => brs.includes(b.id)).map((b) => [b.id, b.name] as [string, string])} value={df.br} onChange={(v) => up({ br: v })} />}
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Which days are you sending</span><Pills opts={[['one', 'One day'], ['range', 'A range of days'], ['week', 'Last 7 days']]} value={df.mode} onChange={(v) => up({ mode: v })} /></div>
      <Pills small opts={[['cash', SRC.cash], ['momo', SRC.momo], ['ghpay', SRC.ghpay]]} value={df.src} onChange={(v) => up({ src: v, acc: v === 'cash' ? 'gcb' : 'eco' })} />
      <div className="flex gap-3 flex-wrap">
        {df.mode === 'one' && <Field label="Takings from (day)" type="date" value={df.day} onChange={(v) => up({ day: v })} />}
        {df.mode === 'range' && <><Field label="From" type="date" value={df.from} onChange={(v) => up({ from: v })} /><Field label="To" type="date" value={df.to} onChange={(v) => up({ to: v })} /></>}
        {df.mode === 'week' && <div className="flex flex-col gap-1 text-[13px] font-semibold flex-1">Days included<span className="font-normal text-muted py-2.5">{dayTxt(days[days.length - 1])} – {dayTxt(days[0])}</span></div>}
        <Field label="Amount (GHS)" inputMode="decimal" value={df.amount} onChange={(v) => up({ amount: v.replace(/[^0-9.]/g, '') })} ph={suggested ? suggested.toFixed(2) : '0.00'} />
      </div>
      <span className="text-xs text-muted">{suggested ? `Still to bank for these days: ${money(suggested)}. Leave the amount blank to use it.` : 'Nothing is waiting to be banked for these days.'}</span>
      {breakdown.length > 1 && <div className="p-3 rounded-2xl bg-canvas text-sm">{breakdown.map((x) => <div key={x.d} className="flex justify-between"><span>{dayTxt(x.d)}</span><span>{money(x.amt)}</span></div>)}</div>}
      <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Send to the bank or keep at the store</span><Pills small opts={accs.map((a) => [a.id, a.name] as [string, string])} value={df.acc} onChange={(v) => up({ acc: v })} /></div>
      <div className="flex gap-3 flex-wrap">
        <Field label={isMomo ? 'Transaction ID' : 'Bank slip number'} value={df.slip} onChange={(v) => up({ slip: v })} ph={isMomo ? 'e.g. 77412039' : 'e.g. GCB-552188'} />
        <Field label="Note (optional)" value={df.note} onChange={(v) => up({ note: v })} />
      </div>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
      <button onClick={record} className="btn-primary">Record deposit · {money(num(df.amount || String(suggested)))}</button>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      {OUT.length > 0 && c.role !== 'staff' && (
        <Card title={`Waiting to be banked · ${money(OUT.reduce((a, o) => a + o.amount, 0))}`} sub="Money taken at the tills that has not reached the bank yet. Tap Bank this to record the deposit.">
          <T head={['Takings day', 'Branch', 'What', 'Amount', 'Action']} rows={OUT.map((o) => [<span key="d" className={o.late ? 'text-danger font-semibold' : ''}>{dayTxt(o.day)}{o.late ? ' · late' : ''}</span>, bName(o.br), SRC[o.src], money(o.amount), <button key="b" onClick={() => { up({ br: o.br, mode: 'one', day: o.day, src: o.src, amount: String(o.amount), acc: o.src === 'cash' ? 'gcb' : 'eco' }); setPop(true); }} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white">Bank this</button>])} />
        </Card>
      )}
      {!pop && form}
      {pop && <div className="fixed inset-0 z-[600] bg-black/45 flex justify-center items-start p-4 pt-10 overflow-y-auto"><div role="dialog" aria-modal="true" className="w-full max-w-[620px]">{form}</div></div>}
      <Card title="Deposits" sub={SU ? 'Tick each one off against the bank or MoMo statement' : 'Deposits your branch recorded · the Admin checks each one'} actions={<div className="flex gap-2 flex-wrap items-center"><button onClick={() => setPop(true)} className="btn-dark min-h-9 text-xs">+ Record a deposit</button></div>}>
        <Pills small opts={([['all', 'All'], ['pending', 'Waiting'], ['verified', 'Checked'], ['flagged', 'Does not match']] as const).map(([k, l]) => [k, `${l} · ${k === 'all' ? base.length : base.filter((d) => d.status === k).length}`] as ['all' | 'pending' | 'verified' | 'flagged', string])} value={dlTab} onChange={(v) => { setDlTab(v); setShown(8); }} />
        {dl.length === 0 && <span className="text-sm text-muted">Nothing here.</span>}
        {dl.slice(0, shown).map((d) => (
          <article key={d.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
            <div className="flex gap-3 items-start flex-wrap">
              <span className={cx('pill', d.status === 'verified' ? 'bg-green-100 text-green-800' : d.status === 'flagged' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{d.status === 'verified' ? 'Checked' : d.status === 'flagged' ? 'Does not match' : 'Waiting'}</span>
              <div className="flex-1 flex flex-col min-w-[200px]"><strong className="text-sm">{d.id} · {bName(d.br)} → {placeName(d.acc, S)}</strong><span className="text-xs text-muted">{SRC[d.src]} · takings {d.days.map(dayTxt).join(', ')} · slip {d.slip} · by {d.by} · {d.at}</span>{(d.note || d.why) && <span className="text-xs text-danger">{d.why || d.note}</span>}</div>
              <strong>{money(d.amount)}</strong>
            </div>
            {SU && d.status === 'pending' && (
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => setStatus(d.id, 'verified')} className="text-xs font-semibold px-3 py-2 rounded-full bg-ok text-white">Matches the statement</button>
                <button onClick={() => setStatus(d.id, 'flagged')} className="text-xs font-semibold px-3 py-2 rounded-full bg-danger text-white">Does not match</button>
                <input aria-label="Note for the branch" value={why[d.id] || ''} onChange={(e) => setWhy((w) => ({ ...w, [d.id]: e.target.value }))} placeholder="Note for the branch (needed to flag)" className="flex-1 min-w-[200px] text-sm px-3 py-2 rounded-full border border-line" />
              </div>
            )}
          </article>
        ))}
        {dl.length > shown && <button onClick={() => setShown((n) => n + 8)} className="btn-ghost w-fit">Show more</button>}
      </Card>
    </div>
  );
}

function rangeDays(from: string, to: string) {
  const out: string[] = [];
  const a = new Date(from), b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return out;
  for (let d = new Date(b); d >= a && out.length < 31; d.setDate(d.getDate() - 1)) out.push(d.toISOString().slice(0, 10));
  return out.filter((d) => d <= TODAY);
}

export function Moves({ c }: { c: Ctx }) {
  const { S, setS, SU, role, me, flash } = c;
  const myTypes = MT.filter((t) => RANK[t[2]] <= RANK[role]);
  const [type, setType] = useState(myTypes[0][0]);
  const t = MT.find((x) => x[0] === type)!;
  const [f, setF] = useState({ amount: '', ref: '', note: '', from: t[4], to: t[5] });
  const [err, setErr] = useState('');
  const payee = t[5] === 'payee';
  const accIds = S.acc.map((a) => a.id);
  const fromOpts = Array.from(new Set([t[4], ...(['transfer', 'supplier', 'salary', 'tax', 'drawing', 'loan'].includes(type) ? accIds.filter((x) => x !== 'ghipss') : [])]));
  const toOpts = Array.from(new Set([t[5], ...(type === 'transfer' || type === 'capital' || type === 'sweep' ? accIds.filter((x) => x !== 'ghipss' && x !== f.from) : [])]));
  const needsOk = !SU && RANK[role] < 3 && type !== 'safe';
  const pick = (k: string) => { const n = MT.find((x) => x[0] === k)!; setType(k); setF({ amount: '', ref: '', note: '', from: n[4], to: n[5] }); setErr(''); };

  const go = () => {
    const a = r2(num(f.amount));
    if (!a) return setErr('Enter the amount.');
    if (payee && !f.ref.trim()) return setErr('Say who was paid, with the invoice or reference.');
    setS((s) => ({ ...s, mov: [{ id: 'MV-0' + (82 + s.mov.length), type, amount: a, from: f.from, to: f.to, ref: f.ref, note: f.note, status: needsOk ? 'pending' : 'approved', by: me, at: stamp(), ts: Date.now() }, ...s.mov] }));
    setF({ ...f, amount: '', ref: '', note: '' });
    flash(needsOk ? 'Sent to the Admin for approval' : `${t[1]} · ${money(a)} recorded`);
  };
  const decide = (id: string, ok: boolean) => { setS((s) => ({ ...s, mov: s.mov.map((m) => (m.id === id ? { ...m, status: ok ? 'approved' : 'rejected' } : m)) })); flash(ok ? 'Movement approved' : 'Movement rejected', !ok); };
  const ml = S.mov.filter((m) => SU || m.by === me || RANK[role] >= 2);

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_1fr] items-start">
      <Card title="Record a money movement" sub={needsOk ? 'Movements above your level go to the Admin for approval' : 'Every movement is recorded against your name'}>
        <Pills small opts={myTypes.map((x) => [x[0], x[1]] as [string, string])} value={type} onChange={pick} />
        <span className="text-[13px] text-sub px-3 py-2 rounded-xl bg-canvas">{t[3]}</span>
        <div className="flex gap-3 flex-wrap">
          <Field label="Amount (GHS)" inputMode="decimal" value={f.amount} onChange={(v) => setF({ ...f, amount: v.replace(/[^0-9.]/g, '').slice(0, 12) })} ph="0.00" />
          <Field label={payee ? 'Paid to (name) and reference' : 'Reference'} value={f.ref} onChange={(v) => setF({ ...f, ref: v })} ph={payee ? 'e.g. Volta Electronics · INV 2231' : 'e.g. slip or transfer ref'} />
        </div>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">From</span><Pills small opts={fromOpts.map((id) => [id, placeName(id, S)] as [string, string])} value={f.from} onChange={(v) => setF({ ...f, from: v })} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">To</span><Pills small opts={toOpts.map((id) => [id, placeName(id, S)] as [string, string])} value={f.to} onChange={(v) => setF({ ...f, to: v })} /></div>
        <Field label="Note (optional)" value={f.note} onChange={(v) => setF({ ...f, note: v })} />
        {err && <span role="alert" className="text-sm text-danger">{err}</span>}
        <button onClick={go} className="btn-primary">{needsOk ? 'Send for approval' : 'Record movement'}{num(f.amount) ? ` · ${money(num(f.amount))}` : ''}</button>
      </Card>
      <Card title="Movements" sub={SU ? 'All branches · approve the ones waiting' : 'Movements you can see'}>
        {ml.length === 0 && <span className="text-sm text-muted">No movements recorded yet.</span>}
        {ml.map((m) => (
          <article key={m.id} className="p-4 rounded-2xl border border-line flex flex-col gap-2">
            <div className="flex gap-3 items-start flex-wrap">
              <span className={cx('pill', m.status === 'approved' ? 'bg-green-100 text-green-800' : m.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900')}>{m.status === 'approved' ? 'Done' : m.status === 'rejected' ? 'Rejected' : 'Waiting'}</span>
              <div className="flex-1 flex flex-col min-w-[200px]"><strong className="text-sm">{MT.find((x) => x[0] === m.type)?.[1]} · {placeName(m.from, S)} → {placeName(m.to, S)}</strong><span className="text-xs text-muted">{m.id} · {m.ref || 'no reference'} · by {m.by} · {m.at}</span></div>
              <strong>{money(m.amount)}</strong>
            </div>
            {SU && m.status === 'pending' && <div className="flex gap-2"><button onClick={() => decide(m.id, true)} className="text-xs font-semibold px-3 py-2 rounded-full bg-ok text-white">Approve</button><button onClick={() => decide(m.id, false)} className="text-xs font-semibold px-3 py-2 rounded-full border border-danger text-danger">Reject</button></div>}
          </article>
        ))}
      </Card>
    </div>
  );
}
