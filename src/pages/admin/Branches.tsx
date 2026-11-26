import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BRANCHES } from '../../data/nav';
import { EMPS0, ini } from '../../data/people';
import { PRODUCTS0, now } from '../../data/catalogue';
import { SALES } from '../../data/sell';
import { useSession } from '../../lib/session';
import { usePersist } from '../../lib/persist';
import { cx, ghs } from '../../lib/format';
import { Card, T } from '../finance/shared';
import { Msg } from '../money/ui';
import { DEVICES0, DEVICES_KEY, type Device } from '../../data/devices';

const INFO: Record<string, { code: string; opened: string; addr: string; phone: string; tills: string[] }> = {
  osu: { code: 'OSU', opened: 'Mar 2019', addr: '12 Oxford Street, Osu, Accra · GA-123-4567', phone: '+233 30 000 1111', tills: ['Till 1 · Sunmi T2', 'Till 2 · Sunmi T2'] },
  legon: { code: 'ELG', opened: 'Jun 2021', addr: '7 Lagos Avenue, East Legon, Accra · GA-492-1187', phone: '+233 30 000 2222', tills: ['Till 1 · Sunmi T2', 'Till 2 · Android tablet'] },
  adum: { code: 'ADM', opened: 'Feb 2023', addr: 'Prempeh II Street, Adum, Kumasi · AK-039-5510', phone: '+233 32 000 3333', tills: ['Till 1 · Sunmi V2'] },
};
type Req = { name: string; town: string; notes: string; at: string; status: string };

export default function Branches() {
  const { tab } = useParams();
  const nav = useNavigate();
  const { session, setViewBranch, viewBranch } = useSession();
  const SU = ['superuser', 'developer'].includes(session?.role ?? 'superuser');
  const myBr = session?.branch ?? 'osu';
  const list = SU ? BRANCHES : BRANCHES.filter((b) => b.id === myBr);
  const [reqs, setReqs] = usePersist<Req[]>('ecompos.branchRequests2', []);
  const [sel, setSel] = useState(tab && INFO[tab] ? tab : list[0].id);
  const [sub, setSub] = useState<'details' | 'team' | 'activity' | 'tills' | 'hours' | 'stock'>('details');
  const [req, setReq] = useState(tab === 'request');
  const [f, setF] = useState({ name: '', town: '', notes: '', err: '' });
  const [msg, setMsg] = useState('');
  const [tills, setTills] = usePersist<Record<string, string[]>>('ecompos.tills2', Object.fromEntries(Object.entries(INFO).map(([k, v]) => [k, v.tills])));
  const [hw] = usePersist<Device[]>(DEVICES_KEY, DEVICES0); // scanners, label printers and scales per branch
  const b = BRANCHES.find((x) => x.id === sel)!;
  const I = INFO[sel];
  const team = EMPS0.filter((e) => e.br === sel);
  const today = SALES.filter((s) => s.br === sel && new Date(s.ts).toDateString() === new Date().toDateString());
  const [mv] = usePersist<Record<string, Record<string, number>>>('ecompos.stockMoves', {});
  const lowN = PRODUCTS0.filter((p) => p.status === 'live' && p.track !== 'digital' && p.stock[sel as 'osu'] <= p.reorder).length;
  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Branches</h1><p className="m-0 text-sm text-muted">Ebenezer Unique Ventures · {BRANCHES.length} branches · one company, one catalogue, shared customers · new branches are created by MNest UnifiedPOS Support under a purchase agreement</p></div>
        {SU && <button onClick={() => setReq(true)} className="btn-primary shadow-[0_6px_20px_rgba(84,51,235,0.25)]">Request a new branch</button>}
      </header>
      <Msg text={msg} onClose={() => setMsg('')} />
      {req && SU && (
        <Card title="Request a new branch" sub="MNest UnifiedPOS Support sets it up under the purchase agreement and tells you when it is ready.">
          <div className="grid sm:grid-cols-2 gap-2"><label className="text-[13px] font-semibold flex flex-col gap-1">Proposed branch name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, err: '' })} placeholder="e.g. Tema branch" className="field py-2 font-normal" /></label><label className="text-[13px] font-semibold flex flex-col gap-1">Town<input value={f.town} onChange={(e) => setF({ ...f, town: e.target.value, err: '' })} placeholder="e.g. Tema" className="field py-2 font-normal" /></label></div>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Notes (tills needed, opening date)<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
          {f.err && <span className="text-sm text-danger">{f.err}</span>}
          <div className="flex gap-2"><button onClick={() => { setReq(false); nav('/branches'); }} className="btn-ghost">Cancel</button><button onClick={() => { if (f.name.trim().length < 3 || f.town.trim().length < 2) return setF({ ...f, err: 'Enter the branch name and town.' }); setReqs((x) => [{ name: f.name, town: f.town, notes: f.notes, at: now(), status: 'Sent to MNest UnifiedPOS Support' }, ...x]); setReq(false); setMsg(`Request for ${f.name} sent to MNest UnifiedPOS Support`); setF({ name: '', town: '', notes: '', err: '' }); }} className="btn-primary">Send request</button></div>
          {reqs.map((r, i) => <span key={i} className="text-xs text-muted">{r.name} · {r.town} · {r.status} · {r.at}</span>)}
        </Card>
      )}
      <div className="grid gap-6 xl:grid-cols-[480px_1fr] items-start">
        <div className="flex flex-col gap-3">{list.map((x) => <button key={x.id} onClick={() => { setSel(x.id); nav(`/branches/${x.id}`); }} aria-pressed={sel === x.id} className={cx('card p-4 text-left flex flex-col gap-2', sel === x.id && 'ring-2 ring-black')}><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-black text-white text-xs font-bold flex items-center justify-center">{INFO[x.id].code}</span><span className="flex-1"><b>{x.name}</b><br /><span className="text-xs text-muted">{x.city}</span></span><span className="pill bg-ok text-white">Open</span></div><span className="text-sm text-sub">Manager {x.manager} · {EMPS0.filter((e) => e.br === x.id).length} people · {(tills[x.id] ?? []).length} tills</span></button>)}{reqs.length > 0 && <span className="text-xs text-muted px-2">{reqs.length} new branch request(s) with MNest UnifiedPOS Support</span>}</div>
        <section className="card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex justify-between gap-3 flex-wrap"><div><span className="text-xs text-muted">Branch {I.code} · opened {I.opened}</span><h2 className="m-0 text-[26px] font-semibold">{b.name}</h2><span className="text-sm text-sub">{I.addr}</span></div>{SU && <button onClick={() => { setViewBranch(viewBranch === sel ? 'all' : sel); setMsg(viewBranch === sel ? 'Back to All branches · Admin view of every branch' : `The whole system now shows ${b.name} only`); }} className="btn-dark">{viewBranch === sel ? 'Back to All branches' : 'Switch the system to this branch'}</button>}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[['Sales today', ghs(today.reduce((a, s) => a + s.total, 0))], ['Orders today', String(today.length)], ['Team', `${team.length} people`], ['Tills', String((tills[sel] ?? []).length)]].map(([k, v]) => <div key={k} className="p-3 rounded-2xl bg-canvas"><span className="text-xs text-muted">{k}</span><br /><b className="text-lg">{v}</b></div>)}</div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1 p-1 rounded-full bg-canvas">{(['details', 'team', 'activity', 'tills', 'hours', 'stock'] as const).map((k) => <button key={k} onClick={() => setSub(k)} aria-pressed={sub === k} className={cx('text-sm py-2 rounded-full', sub === k ? 'bg-white shadow-card font-semibold' : 'text-sub')}>{{ details: 'Details', team: 'Team', activity: 'Activity', tills: 'Tills & devices', hours: 'Hours & services', stock: 'Stock' }[k]}</button>)}</div>
          {sub === 'details' && <><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[['Branch name', b.name], ['Product database', `Linked to the Ebenezer Unique Ventures company catalogue · ${PRODUCTS0.filter((p) => p.scope === 'all').length} shared products · 0 only at this branch`], ['Created by', 'Set up at installation'], ['Short code', I.code], ['Town or city', b.city], ['Address', I.addr], ['Phone', I.phone], ['Email', `${sel}@ebenezerunique.com.gh`], ['Manager', b.manager], ['GRA E-VAT branch ID', '[GRA branch ID]'], ['Status', 'Open']].map(([k, v]) => <label key={k} className="text-xs text-muted flex flex-col gap-1">{k}<input defaultValue={v} readOnly={!SU || k === 'Product database' || k === 'Created by' || k === 'Status'} aria-readonly={!SU} className={cx('px-4 py-2.5 rounded-3xl text-sm text-black', SU ? 'border border-line' : 'bg-canvas border border-transparent cursor-default focus:outline-none')} /></label>)}</div>
            {/* Managers, supervisors and sales staff can only view branch details; the Admin changes them. */}
            <span className="text-xs text-muted">{SU ? "As Admin you can edit every branch's details, hours and tills. Only MNest UnifiedPOS Support can close a branch or change the business name." : '👁 View only · branch details, hours and tills are changed by the Admin.'}</span><span className="text-xs p-3 rounded-2xl bg-canvas">🔒 Closing a branch, temporarily or permanently, is done by MNest UnifiedPOS Support (the system developer). Raise a ticket under Support if a branch needs to close.</span></>}
          {sub === 'team' && team.map((e) => <div key={e.id} className="flex items-center gap-3 text-sm"><span className="w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center" style={{ background: e.color }}>{ini(e.name)}</span><span className="flex-1"><b>{e.name}</b><br /><span className="text-xs text-muted">{e.title}</span></span><span className="pill bg-canvas">{e.status}</span></div>)}
          {sub === 'activity' && <><T head={['Time', 'Sale', 'Staff', 'Total']} rows={today.slice(0, 12).map((s) => [new Date(s.ts).toTimeString().slice(0, 5), '#' + s.no, s.staff, ghs(s.total)])} /><button onClick={() => window.print()} className="btn-ghost w-fit">Export today's activity (PDF)</button></>}
          {sub === 'tills' && <>{(tills[sel] ?? []).map((t, i) => <div key={i} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-canvas"><span>{t}</span><span className="flex gap-2 items-center"><span className="pill bg-green-100 text-green-800">Online</span>{SU && <button onClick={() => setTills({ ...tills, [sel]: tills[sel].filter((_, j) => j !== i) })} className="text-xs underline text-danger">Remove</button>}</span></div>)}{SU && <button onClick={() => { setTills({ ...tills, [sel]: [...(tills[sel] ?? []), `Till ${(tills[sel] ?? []).length + 1} · Android tablet`] }); setMsg('Till added · pair it by signing in on the device'); }} className="btn-ghost w-fit">Add till or device</button>}
            {/* Scanners, label printers and scales at this branch (IT management → Hardware; productscan.md §5.4). */}
            {(['Barcode scanner', 'Label printer', 'Weighing scale'] as const).map((ty) => { const d = hw.filter((x) => x.type === ty && x.branch === sel); return <div key={ty} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-canvas gap-2 flex-wrap"><span>{ty} · {d.length ? d.map((x) => `${x.id} ${x.model} (${x.conn === 'USB' ? 'USB handheld' : x.conn})`).join(', ') : ty === 'Barcode scanner' ? 'USB handheld' : '—'}</span><span className={cx('pill', d.some((x) => x.on) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{d.some((x) => x.on) ? 'Connected' : 'Not set up'}</span></div>; })}
            <Link to="/developer/it/hw" className="text-xs text-brand font-semibold">Manage scanners and printers in IT management</Link></>}
          {sub === 'hours' && [['Monday – Friday', '08:00 – 21:00'], ['Saturday', '08:00 – 21:00'], ['Sunday', sel === 'adum' ? '10:00 – 16:00' : 'Closed'], ['Services', 'Click & collect · delivery · hire purchase']].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><b>{v}</b></div>)}
          {sub === 'stock' && (() => { const L = PRODUCTS0.filter((p) => p.status === 'live' && p.track !== 'digital').map((p) => ({ p, n: Math.max(0, p.stock[sel as 'osu'] - Number(mv[p.name]?.[sel] || 0)) })); const val = L.reduce((a, x) => a + x.n * x.p.cost, 0); return <>
            <div className="flex items-center gap-3 flex-wrap"><span className="text-sm flex-1">{lowN} products are at or below their reorder level here.</span>{SU && <span className="pill bg-brand-50 text-brand">Stock value at cost · {ghs(val)} · Admin only</span>}<Link to="/warehouse" className="btn-dark min-h-9 text-xs">Transfer stock between branches</Link></div>
            <T head={SU ? ['Product', 'In stock', 'Reorder at', 'Value at cost'] : ['Product', 'In stock', 'Reorder at']} rows={L.map(({ p, n }) => SU ? [p.name, String(n), String(p.reorder), ghs(n * p.cost)] : [p.name, String(n), String(p.reorder)])} /></>; })()}
        </section>
      </div>
    </>
  );
}
