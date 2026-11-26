// Loyalty & rewards (§5.7): rules (Admin edits through Approvals), performance and liability.
import { useState } from 'react';
import { BRANCHES } from '../../data/nav';
import { cx, ghs } from '../../lib/format';
import { BR, request, type Settings } from './model';
import { Bars, Head, Lock, Pill, Tile, Toastish, btnG, btnP, type Crm } from './ui';

export default function Loyalty({ m }: { m: Crm }) {
  const { c } = m; const admin = c.caps.loyaltyEdit === 'yes';
  const L = m.settings.loyalty;
  const [draft, setDraft] = useState<Settings['loyalty']>(L);
  const [msg, setMsg] = useState('');
  const pending = m.requests.find((r) => r.type === 'loyalty' && r.status === 'pending');
  const pool = c.role === 'superuser' ? (m.vb === 'all' ? m.custs : m.custs.filter((x) => x.br === m.vb)) : m.custs.filter((x) => x.br === c.br);
  const points = pool.reduce((a, x) => a + x.points, 0);
  const issued = Math.round(points * 1.35); const redeemed = issued - points;
  const liability = (points / L.burnPoints) * L.burnValue;
  const dirty = JSON.stringify(draft) !== JSON.stringify(L);
  const num = (k: keyof Settings['loyalty'], label: string, unit: string) => (
    <label className="text-[13px] font-semibold flex flex-col gap-1">{label}<span className="flex items-center h-11 rounded-full border border-line bg-white px-4 gap-2"><input disabled={!admin} inputMode="decimal" value={String(draft[k])} onChange={(e) => setDraft({ ...draft, [k]: parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0 })} className="flex-1 min-w-0 outline-none font-normal disabled:bg-transparent" /><span className="text-xs text-muted font-normal">{unit}</span></span></label>
  );
  return (
    <>
      <Head title="Loyalty & rewards" sub={`${L.earnPer === 10 ? '1 point per GHS 10' : `1 point per GHS ${L.earnPer}`} · ${L.burnPoints} points = GHS ${L.burnValue} off · Bronze · Silver (GHS ${L.silver.toLocaleString('en-GB')}/yr) · Gold (GHS ${L.gold.toLocaleString('en-GB')}/yr) · till and online`} />
      {!admin && <Lock text="Loyalty rules are set by the Admin. Changes go through Approvals." />}
      {pending && <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#fff8e1', color: '#7a4a00' }}>A change to the rules is waiting in Approvals ({pending.requestedBy} · {pending.title}). It applies once approved.</div>}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile l="Members" v={pool.length} n={c.role === 'superuser' ? (m.vb === 'all' ? 'All branches' : BR[m.vb]) : 'My branch'} />
        <Tile l="Points issued" v={issued.toLocaleString('en-GB')} />
        <Tile l="Points redeemed" v={redeemed.toLocaleString('en-GB')} />
        <Tile l="Liability" v={ghs(liability)} n="Value of unused points" tone="warn" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold">Members by tier</h2>
          <Bars rows={(['Gold', 'Silver', 'Bronze'] as const).map((t) => [t, pool.filter((x) => x.tier === t).length])} />
          <h3 className="m-0 text-sm font-semibold pt-2">Points issued vs redeemed</h3>
          <Bars rows={[['Issued', issued], ['Redeemed', redeemed], ['Unused', points]]} />
        </section>
        <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold">Rules</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {num('earnPer', 'Earn 1 point per', 'GHS spent')}{num('burnPoints', 'Points to redeem', 'points')}{num('burnValue', 'Worth', 'GHS off')}{num('expiryMonths', 'Points expire after', 'months')}
            {num('silver', 'Silver from', 'GHS / year')}{num('gold', 'Gold from', 'GHS / year')}{num('referral', 'Referral reward', 'GHS each')}{num('birthday', 'Birthday reward', 'GHS voucher')}
          </div>
          <fieldset className="flex flex-col gap-1.5"><legend className="text-[13px] font-semibold mb-1">Branches that take part</legend>{BRANCHES.map((b) => { const on = !draft.excluded.includes(b.id); return <label key={b.id} className="flex items-center gap-2 text-sm min-h-10"><input type="checkbox" disabled={!admin} checked={on} onChange={() => setDraft({ ...draft, excluded: on ? [...draft.excluded, b.id] : draft.excluded.filter((x) => x !== b.id) })} className="w-5 h-5 accent-[#0b5c5c]" />{b.name}{!on && <Pill t="Excluded" tone="warn" />}</label>; })}</fieldset>
          {admin && <div className="flex gap-2 flex-wrap"><button disabled={!dirty || !!pending} onClick={() => { request('loyalty', `Change loyalty rules (${Object.keys(draft).filter((k) => JSON.stringify(draft[k as keyof typeof draft]) !== JSON.stringify(L[k as keyof typeof L])).join(', ')})`, c, { loyalty: draft }); setMsg('Sent to Approvals · applies once approved'); }} className={btnP}>Submit for approval</button><button disabled={!dirty} onClick={() => setDraft(L)} className={btnG}>Discard changes</button></div>}
          <span className={cx('text-xs text-muted')}>Every change is recorded in the Audit trail with who made it and their role.</span>
        </section>
      </div>
      <Toastish msg={msg} onClose={() => setMsg('')} />
    </>
  );
}
