import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BRS, brName, now } from '../../data/catalogue';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import { download, Head, Msg } from '../money/ui';

type Step = { role: string; who: string; action?: 'approved' | 'rejected' | 'returned'; note?: string; at?: string };
type Exp = { id: string; date: string; by: string; lvl: string; br: string; cat: string; sub: string; vendor: string; amount: number; method: string; note: string; rcpt: string; noRcpt: string; status: 'pending' | 'approved' | 'rejected' | 'returned' | 'reimbursed' | 'paid'; steps: Step[]; risk: number; flags: string[]; hist: string[] };
const CATS: Record<string, string[]> = { Utilities: ['ECG prepaid', 'Water', 'Internet'], 'Transport & fuel': ['Generator fuel', 'Vehicle fuel', 'Trotro & taxi', 'Mileage'], Repairs: ['Building', 'Equipment', 'Vehicle'], 'Cleaning & supplies': ['Cleaning', 'Stationery', 'Packaging'], 'Staff welfare': ['Lunch', 'Uniforms', 'Training'], Other: ['Bank charges', 'Donations', 'Other'] };
const RULES0 = { auto: 200, sup: 1000, mgr: 5000 };
const chain = (amt: number, r = RULES0): Step[] => (amt <= r.auto ? [] : [{ role: 'Supervisor', who: 'Kwame Asante' }, ...(amt > r.sup ? [{ role: 'Manager', who: 'Ama Darko' }] : []), ...(amt > r.mgr ? [{ role: 'Admin', who: 'Ebenezer Mensah' }] : [])]);
const riskOf = (e: Partial<Exp>) => { const f: string[] = []; let s = 10; if (!e.rcpt) { s += 30; f.push('No receipt attached'); } if ((e.amount ?? 0) > 2000) { s += 20; f.push('Large amount for this category'); } if (/fuel/i.test(e.sub ?? '') && (e.amount ?? 0) > 500) { s += 15; f.push('Fuel spend is 40% above this branch’s average'); } if ((e.amount ?? 0) % 100 === 0 && (e.amount ?? 0) >= 500) { s += 10; f.push('Round-number amount'); } return { risk: Math.min(99, s), flags: f }; };
const band = (r: number) => (r >= 60 ? 'High' : r >= 35 ? 'Medium' : 'Low');
const mk = (id: string, date: string, by: string, lvl: string, br: string, cat: string, sub: string, vendor: string, amount: number, method: string, note: string, rcpt: string, status: Exp['status'], acted: number): Exp => { const steps = chain(amount).map((s, i) => (i < acted ? { ...s, action: 'approved' as const, at: date } : s)); const r = riskOf({ amount, rcpt, sub }); return { id, date, by, lvl, br, cat, sub, vendor, amount, method, note, rcpt, noRcpt: rcpt ? '' : 'Market trader gave no receipt', status, steps, ...r, hist: [`Submitted by ${by} · ${date}`] }; };
const SEED: Exp[] = [
  mk('EX-0388', '20 Nov 2026', 'Efua Sarpong', 'Manager', 'legon', 'Transport & fuel', 'Generator fuel', 'Total Energies Legon', 640, 'Petty cash', 'Generator ran 9 hours during ECG outage', '', 'pending', 0),
  mk('EX-0387', '19 Nov 2026', 'Ama Darko', 'Manager', 'osu', 'Cleaning & supplies', 'Cleaning', 'Melcom Osu', 180, 'Petty cash', 'Mops, bleach and bin bags', 'melcom-0412.jpg', 'approved', 0),
  mk('EX-0386', '18 Nov 2026', 'Kofi Antwi', 'Supervisor', 'adum', 'Repairs', 'Equipment', 'Kumasi Cold Room Services', 2400, 'Bank transfer', 'Chest freezer compressor replaced', 'kcr-inv-221.pdf', 'pending', 1),
  mk('EX-0385', '17 Nov 2026', 'Yaw Boakye', 'Manager', 'adum', 'Utilities', 'ECG prepaid', 'ECG Adum', 900, 'MoMo', 'Prepaid units for the month', 'ecg-token.jpg', 'approved', 1),
  mk('EX-0384', '15 Nov 2026', 'Akua Kyei', 'Sales staff', 'osu', 'Transport & fuel', 'Trotro & taxi', 'Taxi', 60, 'Own money', 'Delivered order W-2290 when the rider was off', '', 'approved', 0),
  mk('EX-0383', '12 Nov 2026', 'Kwame Asante', 'Supervisor', 'osu', 'Staff welfare', 'Lunch', 'Chop Bar Osu', 350, 'Own money', 'Stock-take lunch for 7 staff', 'chopbar.jpg', 'pending', 0),
];

export default function Expenses() {
  const { tab: rawTab = '' } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const me = PEOPLE[role];
  const myBr = session?.branch ?? 'osu';
  const [E, setE] = usePersist<Exp[]>('ecompos.expenses2', SEED);
  const [rules, setRules] = usePersist('ecompos.expRules2', RULES0);
  const [budget, setBudget] = usePersist<Record<string, number>>('ecompos.budgets2', { Utilities: 4000, 'Transport & fuel': 2500, Repairs: 3000, 'Cleaning & supplies': 1200, 'Staff welfare': 1500, Other: 800 });
  const [petty, setPetty] = usePersist('ecompos.petty2', { osu: { float: 1500, topped: 0, spent: 240, custodian: 'Ama Darko' }, legon: { float: 1500, topped: 500, spent: 1820, custodian: 'Efua Sarpong' }, adum: { float: 1000, topped: 0, spent: 310, custodian: 'Yaw Boakye' } } as Record<string, { float: number; topped: number; spent: number; custodian: string }>);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState('');
  const go = (t: string) => nav(t ? `/expenses/${t}` : '/expenses');
  const ROLE_LBL: Record<string, string> = { superuser: 'Admin', manager: 'Manager', supervisor: 'Supervisor', staff: 'Sales staff' };
  const myTurn = (e: Exp) => { if (e.status !== 'pending') return false; const w = e.steps.find((s) => !s.action); return !!w && (w.who === me.name || w.role === ROLE_LBL[role]); };
  const inbox = E.filter(myTurn);
  const vis = E.filter((e) => role === 'superuser' || e.br === myBr || e.by === me.name);
  const mine = E.filter((e) => e.by === me.name);
  const month = vis.filter((e) => ['approved', 'paid', 'reimbursed'].includes(e.status)).reduce((a, e) => a + e.amount, 0);
  const tabs: [string, string][] = [['', 'Overview'], ['mine', 'My expenses'], ['new', 'New expense'], ['inbox', `Approvals${inbox.length ? ' · ' + inbox.length : ''}`], ['all', 'All expenses'], ['petty', 'Petty cash'], ['budget', 'Budgets'], ['reimb', 'Reimbursements'], ['set', 'Settings']].filter(([k]) => role !== 'staff' || ['mine', 'new', 'reimb'].includes(k)).filter(([k]) => k !== 'set' || role === 'superuser').filter(([k]) => !['petty', 'budget'].includes(k) || role === 'superuser' || role === 'manager') as [string, string][];
  const tab = tabs.some(([k]) => k === rawTab) ? rawTab : tabs[0][0];
  const cur = E.find((e) => e.id === open);
  const decide = (e: Exp, action: 'approved' | 'rejected' | 'returned', note: string) => {
    if (action !== 'approved' && !note.trim()) return setMsg('Write a reason to reject or return.');
    setE((x) => x.map((y) => { if (y.id !== e.id) return y; const steps = [...y.steps]; const i = steps.findIndex((s) => !s.action); steps[i] = { ...steps[i], action, note, at: now(), who: me.name }; const done = action !== 'approved' ? action : steps.every((s) => s.action) ? 'approved' : 'pending'; return { ...y, steps, status: done as Exp['status'], hist: [...y.hist, `${action[0].toUpperCase() + action.slice(1)} by ${me.name}${note ? ` · “${note}”` : ''} · ${now()}`] }; }));
    setMsg(`${e.id} ${action}`);
  };
  const Row = (e: Exp) => <button key={e.id} onClick={() => setOpen(e.id)} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl border border-line hover:bg-canvas flex-wrap text-sm"><span className="flex-1 min-w-[200px]"><b>{e.vendor} · {ghs(e.amount)}</b><br /><span className="text-xs text-muted">{e.id} · {e.by} · {brName(e.br)} · {e.cat} · {e.date}</span></span><span className={cx('pill', e.risk >= 60 ? 'bg-red-100 text-red-800' : e.risk >= 35 ? 'bg-amber-100 text-amber-900' : 'bg-canvas')}>Risk {band(e.risk)}</span><StatusPill e={e} /></button>;

  return (
    <>
      <Head title="Expenses" sub="Track every cedi spent, with receipts, approvals, petty cash and budgets."><button onClick={() => go('new')} className="btn-primary">+ New expense</button></Head>
      <Pills opts={tabs} value={tab} onChange={go} />
      <Msg text={msg} onClose={() => setMsg('')} />

      {tab === '' && (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">{[['Spent this month', ghs(month), 'Approved and paid'], ['Waiting for you', String(inbox.length), inbox.length ? ghs(inbox.reduce((a, e) => a + e.amount, 0)) : 'Nothing to sign'], ['Petty cash left', ghs(Object.values(petty).reduce((a, p) => a + p.float + p.topped - p.spent, 0)), 'All branches'], ['Flagged', String(vis.filter((e) => e.risk >= 35 && e.status === 'pending').length), 'Medium or high risk']].map(([l, v, n]) => <div key={l} className="card p-5 flex flex-col gap-1"><span className="text-[13px] text-muted">{l}</span><strong className="text-[26px] font-medium tracking-tightest">{v}</strong><span className="text-xs text-sub">{n}</span></div>)}</div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Branch profit this month" sub="Sales less approved expenses"><T head={['Branch', 'Sales', 'Expenses', 'Profit']} rows={BRS.map((b) => { const s = { osu: 182400, legon: 131000, adum: 84200 }[b.id]; const x = vis.filter((e) => e.br === b.id && e.status !== 'rejected').reduce((a, e) => a + e.amount, 0) + { osu: 9800, legon: 11200, adum: 7400 }[b.id]; return [b.name, ghs(s), ghs(x), ghs(s * 0.2 - x)]; })} /></Card>
            <Card title="Where the money went">{Object.keys(CATS).map((c) => { const v = vis.filter((e) => e.cat === c && e.status !== 'rejected').reduce((a, e) => a + e.amount, 0); return <div key={c} className="flex flex-col gap-1"><div className="flex justify-between text-sm"><span>{c}</span><b>{ghs(v)}</b></div><div className="h-2 rounded-full bg-canvas"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (v / Math.max(1, month)) * 100)}%` }} /></div></div>; })}<span className="text-xs text-muted">Approved and paid expenses dated this month.</span></Card>
            <Card title="Budgets worth watching">{Object.entries(budget).map(([c, b]) => { const v = vis.filter((e) => e.cat === c && e.status !== 'rejected').reduce((a, e) => a + e.amount, 0); return v / b > 0.5 ? <div key={c} className="flex justify-between text-sm"><span>{c}</span><b className={v > b ? 'text-danger' : 'text-[#b26a00]'}>{Math.round((v / b) * 100)}% of {ghs(b)}</b></div> : null; })}</Card>
            <Card title="Flagged by the assistant">{vis.filter((e) => e.risk >= 35).map(Row)}{!vis.some((e) => e.risk >= 35) && <span className="text-sm text-muted">Nothing flagged.</span>}</Card>
          </div>
        </>
      )}
      {tab === 'mine' && <Card title="My expenses" sub={`${mine.length} claims · ${ghs(mine.reduce((a, e) => a + e.amount, 0))}`}>{mine.length ? mine.map(Row) : <span className="text-sm text-muted">You have not claimed anything yet.</span>}</Card>}
      {tab === 'new' && <NewExp me={me.name} lvl={me.level} br={myBr} rules={rules} E={E} pettyLeft={petty[myBr] ? petty[myBr].float + petty[myBr].topped - petty[myBr].spent : 0} onSave={(e) => { setE((x) => [e, ...x]); if (e.method === 'Petty cash') setPetty((p) => ({ ...p, [e.br]: { ...p[e.br], spent: p[e.br].spent + e.amount } })); setMsg(e.status === 'approved' ? `${e.id} auto-approved (under ${ghs(rules.auto)})` : `${e.id} sent to ${e.steps[0].who} (${e.steps[0].role})`); go('mine'); }} n={E.length} />}
      {tab === 'inbox' && <Card title="Waiting for you" sub={`${inbox.length} to sign off as ${ROLE_LBL[role]}`} actions={inbox.filter((e) => e.risk < 35).length > 0 ? <button onClick={() => inbox.filter((e) => e.risk < 35).forEach((e) => decide(e, 'approved', ''))} className="btn-dark min-h-9 text-xs">Approve {inbox.filter((e) => e.risk < 35).length} low-risk</button> : undefined}>{inbox.length ? inbox.map(Row) : <span className="text-sm text-muted">Nothing is waiting for you.</span>}</Card>}
      {tab === 'all' && <AllExp E={vis} onOpen={setOpen} />}
      {tab === 'petty' && <Card title="Petty cash">{Object.entries(petty).filter(([b]) => role === 'superuser' || b === myBr).map(([b, p]) => <PettyRow key={b} br={b} p={p} onTop={(v) => { setPetty((x) => ({ ...x, [b]: { ...x[b], topped: x[b].topped + v } })); setMsg(`${brName(b)} petty cash topped up by ${ghs(v)}`); }} onCount={(v) => setMsg(v === p.float + p.topped - p.spent ? `${brName(b)} box counted · balances exactly` : `${brName(b)} box is ${ghs(Math.abs(v - (p.float + p.topped - p.spent)))} ${v < p.float + p.topped - p.spent ? 'short' : 'over'} · logged for the Admin`)} />)}</Card>}
      {tab === 'budget' && <Card title="Budgets this month" sub="Monthly budget per category · all branches" actions={<button onClick={() => setMsg('Budgets saved')} className="btn-primary min-h-9 text-xs">Save budgets</button>}>{Object.entries(budget).map(([c, b]) => { const v = vis.filter((e) => e.cat === c && e.status !== 'rejected').reduce((a, e) => a + e.amount, 0); return <div key={c} className="flex items-center gap-3 flex-wrap p-3 rounded-2xl bg-canvas"><span className="flex-1 min-w-[200px] text-sm"><b>{c}</b><br /><span className={cx('text-xs', v > b ? 'text-danger' : 'text-muted')}>{ghs(v)} of {ghs(b)} · {v > b ? 'over budget' : 'within budget'} · {Math.round((v / b) * 100)}%</span></span><label className="text-xs font-semibold flex flex-col gap-0.5">Monthly budget (GHS)<input inputMode="decimal" value={b} onChange={(e) => setBudget({ ...budget, [c]: parseFloat(e.target.value) || 0 })} className="w-28 px-2 py-1.5 rounded-lg border border-line font-normal" /></label></div>; })}</Card>}
      {tab === 'reimb' && <Card title="Reimbursements" sub="Approved claims paid from staff’s own money">{Object.entries(vis.filter((e) => e.method === 'Own money' && e.status === 'approved').reduce<Record<string, Exp[]>>((a, e) => ((a[e.by] = [...(a[e.by] || []), e]), a), {})).map(([who, L]) => <div key={who} className="p-3 rounded-2xl border border-line flex flex-col gap-1.5 text-sm"><div className="flex justify-between"><b>{who}</b><b>{ghs(L.reduce((a, e) => a + e.amount, 0))}</b></div>{L.map((e) => <span key={e.id} className="text-xs text-muted">{e.id} · {e.vendor} · {ghs(e.amount)}</span>)}{role !== 'staff' && <div className="flex gap-2"><button onClick={() => { setE((x) => x.map((y) => (L.includes(y) ? { ...y, status: 'reimbursed', hist: [...y.hist, `Reimbursed by MoMo · ${now()}`] } : y))); setMsg(`${who} reimbursed by MoMo`); }} className="btn-primary min-h-9 text-xs">Pay now</button><button onClick={() => { setE((x) => x.map((y) => (L.includes(y) ? { ...y, status: 'reimbursed', hist: [...y.hist, `Added to the next payslip · ${now()}`] } : y))); setMsg(`Added to ${who}’s next payslip`); }} className="btn-ghost min-h-9 text-xs">Add to the next payslip</button></div>}</div>)}{!vis.some((e) => e.method === 'Own money' && e.status === 'approved') && <span className="text-sm text-muted">Nobody is waiting to be paid back.</span>}</Card>}
      {tab === 'set' && <Card title="Approval rules" sub="Who signs off each expense, by amount">{([['auto', 'Auto-approve up to'], ['sup', 'Supervisor signs up to'], ['mgr', 'Manager signs up to (Admin above)']] as const).map(([k, l]) => <label key={k} className="text-[13px] font-semibold flex flex-col gap-1">{l} (GHS)<input inputMode="decimal" value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: parseFloat(e.target.value) || 0 })} className="field py-2 font-normal w-40" /></label>)}<button onClick={() => setMsg('Approval rules saved')} className="btn-primary w-fit">Save rules</button><span className="text-[13px] font-semibold">Categories</span>{Object.entries(CATS).map(([c, s]) => <span key={c} className="text-sm"><b>{c}</b> · <span className="text-muted">{s.join(', ')}</span></span>)}</Card>}
      {tab === 'set' && <Card title="Categories and who signs" sub="Each category goes to the person who knows it best before the amount rules apply.">{[['Fuel & transport', 'Branch Manager'], ['Repairs & maintenance', 'Branch Manager'], ['Stock & supplies', 'Supervisor'], ['Utilities (ECG, water)', 'Admin'], ['Rent', 'Admin'], ['Staff welfare', 'Branch Manager'], ['Marketing', 'Admin']].map(([c, w]) => <div key={c} className="flex justify-between text-sm py-1.5 border-b border-line last:border-0"><span>{c}</span><b>{w}</b></div>)}</Card>}
      {tab === 'set' && <Card title="Audit log" sub="Every expense action, newest first · read-only · nothing here can be edited or deleted">{E.flatMap((e) => [{ at: e.date, t: `${e.by} submitted ${e.id} · ${e.cat} · ${ghs(e.amount)} · ${e.method}` }, ...e.steps.filter((st) => st.action).map((st) => ({ at: st.at || e.date, t: `${st.who} (${st.role}) ${st.action} ${e.id}${st.note ? ` · “${st.note}”` : ''}` }))]).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40).map((x, k) => <div key={k} className="flex gap-3 text-sm py-1.5 border-b border-line last:border-0"><span className="text-xs text-muted w-28 flex-none">{x.at}</span><span>{x.t}</span></div>)}<button onClick={() => download('expense-audit-log.csv', [['When', 'What'], ...E.flatMap((e) => [[e.date, `${e.by} submitted ${e.id} · ${e.cat} · ${e.amount}`], ...e.steps.filter((st) => st.action).map((st) => [st.at || e.date, `${st.who} (${st.role}) ${st.action} ${e.id}`])])])} className="btn-ghost min-h-9 text-xs w-fit">Download CSV</button></Card>}

      {cur && <Detail e={cur} canAct={myTurn(cur)} actWho={`${me.name} (${ROLE_LBL[role]})`} onClose={() => setOpen('')} onDecide={(a, n) => decide(cur, a, n)} />}
    </>
  );
}

function StatusPill({ e }: { e: Exp }) {
  const w = e.steps.find((s) => !s.action);
  return <span className={cx('pill', e.status === 'approved' || e.status === 'reimbursed' ? 'bg-green-100 text-green-800' : e.status === 'rejected' ? 'bg-red-100 text-red-800' : e.status === 'returned' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900')}>{e.status === 'pending' && w ? `Waiting · ${w.role}` : e.status[0].toUpperCase() + e.status.slice(1)}</span>;
}

function AllExp({ E, onOpen }: { E: Exp[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [risky, setRisky] = useState(false);
  const L = E.filter((e) => (f === 'all' || e.status === f) && (!risky || e.risk >= 35) && (!q || (e.id + e.by + e.vendor + e.note).toLowerCase().includes(q.toLowerCase())));
  return (
    <Card title="All expenses" sub={`${L.length} expenses`} actions={<button onClick={() => download('expenses.csv', [['Reference', 'Date', 'Employee', 'Branch', 'Category', 'Vendor', 'Amount', 'Status', 'Risk'], ...L.map((e) => [e.id, e.date, e.by, brName(e.br), e.cat, e.vendor, e.amount, e.status, band(e.risk)])])} className="btn-ghost min-h-9 text-xs">Export CSV</button>}>
      <label className="text-[13px] font-semibold flex flex-col gap-1">Search<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, person, vendor or purpose" className="field py-2 font-normal" /></label>
      <div className="flex gap-2 flex-wrap items-center"><Pills small opts={[['all', 'All'], ['pending', 'Waiting'], ['approved', 'Approved'], ['returned', 'Returned'], ['rejected', 'Rejected'], ['reimbursed', 'Reimbursed']]} value={f} onChange={setF} /><button aria-pressed={risky} onClick={() => setRisky(!risky)} className={cx('text-xs px-3 py-1.5 rounded-full border', risky ? 'bg-danger text-white border-danger' : 'border-line')}>Flagged only</button></div>
      <T head={['Reference', 'Date', 'Employee', 'Branch', 'Category', 'Vendor', 'Amount', 'Status', 'Risk', '']} rows={L.map((e) => [e.id, e.date, e.by, brName(e.br), e.cat, e.vendor, ghs(e.amount), <StatusPill key="s" e={e} />, band(e.risk), <button key="o" onClick={() => onOpen(e.id)} className="text-xs font-semibold underline">Open</button>])} />
    </Card>
  );
}

function Detail({ e, canAct, actWho, onClose, onDecide }: { e: Exp; canAct: boolean; actWho: string; onClose: () => void; onDecide: (a: 'approved' | 'rejected' | 'returned', n: string) => void }) {
  const [why, setWhy] = useState('');
  return (
    <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-12 overflow-y-auto">
      <section role="dialog" aria-modal="true" aria-label={e.id} className="w-full max-w-2xl bg-white rounded-4xl p-6 flex flex-col gap-3">
        <div className="flex justify-between gap-3"><div><h2 className="m-0 text-lg font-semibold">{e.id} · {e.vendor} · {ghs(e.amount)}</h2><span className="text-sm text-muted">{e.by} ({e.lvl}) · {brName(e.br)} · {e.date} · {e.steps.length ? `${e.steps.length}-step approval` : 'Auto-approved'}</span></div><div className="flex items-start gap-2"><span className={cx('pill', e.risk >= 60 ? 'bg-red-100 text-red-800' : e.risk >= 35 ? 'bg-amber-100 text-amber-900' : 'bg-canvas')}>Risk {band(e.risk)} · {e.risk}</span><button onClick={onClose} aria-label="Close" className="text-xl">×</button></div></div>
        {[['Category', `${e.cat} · ${e.sub}`], ['Paid by', e.method], ['Tax', e.method === 'Bank transfer' ? 'VAT invoice · input tax reclaimable' : 'No VAT invoice'], ['Business purpose', e.note]].map(([k, v]) => <div key={k} className="text-sm"><span className="text-muted">{k} · </span>{v}</div>)}
        <span className="text-sm">{e.rcpt ? `Receipt on file · ${e.rcpt}` : `No receipt — ${e.noRcpt}`}</span>
        {e.flags.length > 0 && <div className="p-3 rounded-2xl bg-warn-bg text-sm flex flex-col gap-1"><b>Why the assistant flagged this</b>{e.flags.map((f) => <span key={f}>• {f}</span>)}</div>}
        <span className="text-[13px] font-semibold">Approval</span>
        {!e.steps.length && <span className="text-sm text-muted">Under the auto-approval limit, so nobody had to sign it off. It is still visible to everyone above.</span>}
        {e.steps.map((s, i) => <div key={i} className="flex items-center gap-2 text-sm"><span className={cx('pill', s.action === 'approved' ? 'bg-green-100 text-green-800' : s.action ? 'bg-red-100 text-red-800' : 'bg-canvas')}>{s.action ?? 'Waiting'}</span><span>{s.role} · {s.who}</span>{s.note && <span className="text-xs text-muted">“{s.note}”</span>}</div>)}
        {canAct && (
          <div className="p-4 rounded-2xl bg-canvas flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Your decision as {actWho}</span>
            <div className="flex gap-1.5 flex-wrap">{['Receipt is unclear', 'Please split by branch', 'Over the budget'].map((t) => <button key={t} onClick={() => setWhy(t)} className="text-xs px-3 py-1.5 rounded-full border border-line bg-white">{t}</button>)}</div>
            <label className="text-xs font-semibold flex flex-col gap-1">Reason or comment — required to reject or return<textarea rows={2} value={why} onChange={(x) => setWhy(x.target.value)} placeholder={`${e.by} will see this`} className="p-2 rounded-xl border border-line font-normal text-sm" /></label>
            <div className="flex gap-2 flex-wrap"><button onClick={() => { onDecide('approved', why); onClose(); }} className="btn bg-ok text-white">Approve</button><button onClick={() => { if (why.trim()) { onDecide('returned', why); onClose(); } else onDecide('returned', ''); }} className="btn-ghost">Return for changes</button><button onClick={() => { if (why.trim()) { onDecide('rejected', why); onClose(); } else onDecide('rejected', ''); }} className="btn border border-danger text-danger">Reject</button></div>
          </div>
        )}
        <span className="text-[13px] font-semibold">History</span>{e.hist.map((h, i) => <span key={i} className="text-xs text-sub">• {h}</span>)}
      </section>
    </div>
  );
}

function PettyRow({ br, p, onTop, onCount }: { br: string; p: { float: number; topped: number; spent: number; custodian: string }; onTop: (v: number) => void; onCount: (v: number) => void }) {
  const [top, setTop] = useState('');
  const [cnt, setCnt] = useState('');
  const bal = p.float + p.topped - p.spent;
  return (
    <div className="p-4 rounded-2xl border border-line flex flex-col gap-2">
      <div className="flex justify-between gap-2 flex-wrap"><span className="text-sm"><b>{brName(br)}</b><br /><span className="text-xs text-muted">Custodian {p.custodian} · float {ghs(p.float)} · topped up {ghs(p.topped)} · spent {ghs(p.spent)}</span></span><b className={cx('text-lg', bal < p.float * 0.2 ? 'text-danger' : '')}>{ghs(bal)}</b></div>
      {bal < p.float * 0.2 && <span className="text-xs text-danger">The float is running low — top it up before the next cash purchase.</span>}
      <div className="flex gap-2 flex-wrap items-end"><label className="text-xs font-semibold flex flex-col gap-0.5">Top up by (GHS)<input inputMode="decimal" value={top} onChange={(e) => setTop(e.target.value)} placeholder="0.00" className="w-28 px-2 py-1.5 rounded-lg border border-line font-normal" /></label><button onClick={() => { const v = parseFloat(top); if (v > 0) { onTop(v); setTop(''); } }} className="btn-ghost min-h-9 text-xs">Record top-up</button><label className="text-xs font-semibold flex flex-col gap-0.5">Cash counted in the box<input inputMode="decimal" value={cnt} onChange={(e) => setCnt(e.target.value)} placeholder="0.00" className="w-28 px-2 py-1.5 rounded-lg border border-line font-normal" /></label><button onClick={() => { const v = parseFloat(cnt); if (v >= 0) { onCount(v); setCnt(''); } }} className="btn-ghost min-h-9 text-xs">Record the count</button></div>
    </div>
  );
}

function NewExp({ me, lvl, br, rules, E, pettyLeft, onSave, n }: { me: string; lvl: string; br: string; rules: typeof RULES0; E: Exp[]; pettyLeft: number; onSave: (e: Exp) => void; n: number }) {
  const [mode, setMode] = useState<'receipt' | 'manual' | 'mileage'>('receipt');
  const [f, setF] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), vendor: '', cat: 'Transport & fuel', sub: 'Vehicle fuel', br, method: 'Petty cash', note: '', rcpt: '', noRcpt: '', km: '', read: '', err: '' });
  const amt = mode === 'mileage' ? (parseFloat(f.km) || 0) * 1.6 : parseFloat(f.amount) || 0;
  const dup = E.find((e) => e.vendor && e.vendor.toLowerCase() === f.vendor.trim().toLowerCase() && Math.abs(e.amount - amt) < 0.01);
  const r = riskOf({ amount: amt, rcpt: f.rcpt, sub: f.sub });
  const steps = chain(amt, rules);
  const policy = [amt > 0 && f.method === 'Petty cash' && amt > pettyLeft ? `Petty cash only has ${ghs(pettyLeft)} left` : '', amt > 500 && !f.rcpt ? 'A receipt is required over GHS 500.00' : ''].filter(Boolean);
  const sugg = /fuel|total|shell|goil/i.test(f.vendor) ? ['Transport & fuel', 'Vehicle fuel'] : /ecg|water|vodafone|mtn/i.test(f.vendor) ? ['Utilities', 'ECG prepaid'] : /melcom|mall|shop/i.test(f.vendor) ? ['Cleaning & supplies', 'Cleaning'] : null;
  const submit = () => {
    if (!(amt > 0)) return setF({ ...f, err: 'Enter the amount.' });
    if (!f.vendor.trim() && mode !== 'mileage') return setF({ ...f, err: 'Say who you paid.' });
    if (f.note.trim().length < 4) return setF({ ...f, err: 'Say what the money was for.' });
    if (!f.rcpt && !f.noRcpt.trim()) return setF({ ...f, err: 'Attach a receipt, or say why there is none.' });
    if (policy.some((p) => p.startsWith('A receipt'))) return setF({ ...f, err: policy.find((p) => p.startsWith('A receipt'))! });
    const date = new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    onSave({ id: 'EX-0' + (389 + n), date, by: me, lvl, br: f.br, cat: mode === 'mileage' ? 'Transport & fuel' : f.cat, sub: mode === 'mileage' ? 'Mileage' : f.sub, vendor: mode === 'mileage' ? `Mileage · ${f.km} km` : f.vendor.trim(), amount: Math.round(amt * 100) / 100, method: f.method, note: f.note, rcpt: f.rcpt, noRcpt: f.noRcpt, status: steps.length ? 'pending' : 'approved', steps, ...r, hist: [`Submitted by ${me} · ${now()}`] });
  };
  return (
    <Card title="New expense" actions={<Pills small opts={[['receipt', 'Snap a receipt'], ['manual', 'Type it in'], ['mileage', 'Mileage']]} value={mode} onChange={setMode} />}>
      {mode === 'receipt' && (
        <div className="p-4 rounded-2xl bg-canvas flex flex-col gap-2">
          <span className="text-sm font-semibold">Snap the receipt and the assistant fills the form</span>
          <div className="flex gap-2 flex-wrap items-center"><label className="btn-ghost cursor-pointer">Choose a photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, rcpt: x.name, read: 'read from your photo' }); }} /></label><button onClick={() => setF({ ...f, rcpt: 'goil-receipt-sample.jpg', amount: '320.00', vendor: 'GOIL Osu', cat: 'Transport & fuel', sub: 'Vehicle fuel', read: 'read from a sample receipt' })} className="btn-ghost">Read a sample receipt</button></div>
          {f.read && <span className="text-xs text-ok">Suggested by the assistant · {f.read}. Check the values below.</span>}
        </div>
      )}
      {mode === 'mileage' ? <label className="text-[13px] font-semibold flex flex-col gap-1">Distance travelled (km)<input inputMode="decimal" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} placeholder="e.g. 48" className="field py-2.5 font-normal w-40" /><span className="text-xs text-muted font-normal">GHS 1.60 per km = {ghs(amt)}</span></label> : (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-[13px] font-semibold flex flex-col gap-1">Amount (GHS)<input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value, err: '' })} placeholder="0.00" className="field py-2.5 font-normal" /></label>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Date<input type="date" value={f.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, date: e.target.value })} className="field py-2.5 font-normal" /></label>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Who you paid<input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value, err: '' })} placeholder="Shop, supplier or person" className="field py-2.5 font-normal" /></label>
        </div>
      )}
      {sugg && f.cat !== sugg[0] && mode !== 'mileage' && <div className="text-sm p-3 rounded-2xl bg-brand-50 flex items-center gap-2 flex-wrap"><span className="flex-1">Assistant suggests: <b>{sugg[0]} · {sugg[1]}</b> <span className="text-xs text-muted">from the vendor name. You can ignore this.</span></span><button onClick={() => setF({ ...f, cat: sugg[0], sub: sugg[1] })} className="btn-dark min-h-9 text-xs">Use it</button></div>}
      {mode !== 'mileage' && <><div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Category</span><Pills small opts={Object.keys(CATS).map((c) => [c, c] as [string, string])} value={f.cat} onChange={(v) => setF({ ...f, cat: v, sub: CATS[v][0] })} /></div><div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Sub-category</span><Pills small opts={CATS[f.cat].map((c) => [c, c] as [string, string])} value={f.sub} onChange={(v) => setF({ ...f, sub: v })} /></div></>}
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Branch</span><Pills small opts={BRS.map((b) => [b.id, b.name] as [string, string])} value={f.br} onChange={(v) => setF({ ...f, br: v })} /></div>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">How it was paid</span><Pills small opts={['Petty cash', 'Own money', 'MoMo', 'Bank transfer', 'Company card'].map((m) => [m, m] as [string, string])} value={f.method} onChange={(v) => setF({ ...f, method: v })} />{f.method === 'Petty cash' && <span className="text-xs text-muted">{ghs(pettyLeft)} left in this branch’s box</span>}</div>
      <label className="text-[13px] font-semibold flex flex-col gap-1">What the money was for<textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value, err: '' })} placeholder="One line is enough — approvers read this first" className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
      <div className="flex gap-3 flex-wrap items-end"><label className="btn-ghost cursor-pointer">Attach a receipt<input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setF({ ...f, rcpt: e.target.files?.[0]?.name ?? f.rcpt })} /></label>{f.rcpt && <span className="text-xs text-ok pb-3">Attached: {f.rcpt}</span>}{!f.rcpt && <label className="text-xs font-semibold flex flex-col gap-1 flex-1">If there is no receipt, say why<input value={f.noRcpt} onChange={(e) => setF({ ...f, noRcpt: e.target.value })} placeholder="e.g. Market trader gave no receipt" className="field py-2 font-normal" /></label>}</div>
      {dup && <span className="text-sm text-danger">{dup.id} has the same vendor and amount — check before you send it.</span>}
      {policy.map((p) => <span key={p} className="text-xs text-[#b26a00]">Policy check • {p}</span>)}
      {amt > 0 && <div className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-1"><span>Risk <b>{band(r.risk)}</b> · {r.risk}</span>{r.flags.map((x) => <span key={x} className="text-xs">What the approver will see • {x}</span>)}<span><b>{ghs(amt)}</b> · {steps.length ? `${steps.length}-step approval · ${steps.map((s) => s.role).join(' → ')}` : `Auto-approved (under ${ghs(rules.auto)})`}</span></div>}
      {f.err && <span role="alert" className="text-sm text-danger">{f.err}</span>}
      <div className="flex gap-2"><button onClick={() => setF({ ...f, amount: '', vendor: '', note: '', rcpt: '', noRcpt: '', km: '', read: '', err: '' })} className="btn-ghost">Clear</button><button onClick={submit} className="btn-primary">{steps.length ? `Send to ${steps[0].who}` : 'Submit'}</button></div>
    </Card>
  );
}
