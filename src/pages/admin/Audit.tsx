import { usePersist } from '../../lib/persist';
import { SUPPORT, type DevAct } from '../../lib/sec';
import { useMemo, useState } from 'react';
import { SALES } from '../../data/sell';
import { brName } from '../../data/catalogue';
import { cx } from '../../lib/format';
import { Card, Pills, T } from '../finance/shared';
import { download } from '../money/ui';

type Ev = { ts: number; who: string; br: string; kind: string; what: string };
const FIX: Ev[] = [
  { ts: Date.now() - 9 * 6e4, who: 'Ama Darko', br: 'osu', kind: 'Price change', what: 'Binatone 16" Standing Fan · GHS 430.00 → GHS 450.00' },
  { ts: Date.now() - 50 * 6e4, who: 'Ebenezer Mensah', br: 'all', kind: 'Approval', what: 'Approved deposit DEP-0215 · GHS 6,200.00' },
  { ts: Date.now() - 80 * 6e4, who: 'Ebenezer Mensah', br: 'all', kind: 'Sign-in', what: 'Signed in · Osu · passcode verified' },
  { ts: Date.now() - 3 * 36e5, who: 'Efua Sarpong', br: 'legon', kind: 'Void', what: 'Voided sale #34391022 · customer changed mind' },
  { ts: Date.now() - 26 * 36e5, who: 'MNest UnifiedPOS Support', br: 'all', kind: 'Account change', what: 'Reset password for Kwesi Ofori (ticket T-1029)' },
  { ts: Date.now() - 30 * 36e5, who: 'Ebenezer Mensah', br: 'all', kind: 'Permission', what: 'Turned on “Approve returns” for Nana Ampofo' },
];

export default function Audit() {
  const [dev] = usePersist<DevAct[]>('ecompos.devLog', []);
  const evs = useMemo(() => [...FIX, ...dev.map((x) => ({ ts: x.ts, who: SUPPORT, br: 'all', kind: 'Support action', what: x.what + (x.issue ? ` · issue: ${x.issue}` : '') })), ...SALES.slice(0, 120).map((s) => ({ ts: s.ts, who: s.staff, br: s.br, kind: s.status === 'voided' ? 'Void' : 'Sale', what: `#${s.no} · GHS ${s.total.toFixed(2)} · ${s.method}` }))].sort((a, b) => b.ts - a.ts), [dev]);
  const [kind, setKind] = useState('all');
  const [who, setWho] = useState('');
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const L = evs.filter((e) => (kind === 'all' || e.kind === kind) && (!who || e.who === who) && e.ts >= new Date(from).getTime() && e.ts < new Date(to).getTime() + 864e5);
  const kinds = Array.from(new Set(evs.map((e) => e.kind)));
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Audit trail</h1><p className="m-0 text-sm text-muted">Every sale, price change, void, approval, sign-in and account change, recorded against the person who made it. Records cannot be edited or deleted.</p></header>
      <Card title={`${L.length} events · ${new Date(from).toLocaleDateString('en-GB')} – ${new Date(to).toLocaleDateString('en-GB')}`} actions={<div className="flex gap-2"><button onClick={() => download('audit-trail.csv', [['When', 'Who', 'Branch', 'What happened', 'Detail'], ...L.map((e) => [new Date(e.ts).toLocaleString('en-GB'), e.who, e.br === 'all' ? 'All' : brName(e.br), e.kind, e.what])])} className="btn-ghost min-h-9 text-xs">Export CSV</button><button onClick={() => window.print()} className="btn-ghost min-h-9 text-xs">Export PDF</button></div>}>
        <div className="flex gap-3 flex-wrap items-end">
          <label className="text-xs font-semibold flex flex-col gap-1">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal" /></label>
          <label className="text-xs font-semibold flex flex-col gap-1">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal" /></label>
          <label className="text-xs font-semibold flex flex-col gap-1">User<select value={who} onChange={(e) => setWho(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal"><option value="">Everyone</option>{Array.from(new Set(evs.map((e) => e.who))).map((w) => <option key={w}>{w}</option>)}</select></label>
        </div>
        <Pills small opts={[['all', 'All'], ...kinds.map((k) => [k, k] as [string, string])]} value={kind} onChange={setKind} />
        <div className="print-doc"><T head={['When', 'Who', 'Branch', 'What happened', 'Detail']} rows={L.slice(0, 80).map((e) => [new Date(e.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), e.who, e.br === 'all' ? 'All branches' : brName(e.br), <span key="k" className={cx('pill', e.kind === 'Void' ? 'bg-red-100 text-red-800' : e.kind === 'Sale' ? 'bg-canvas' : 'bg-brand-50 text-brand')}>{e.kind}</span>, e.what])} /></div>
      </Card>
    </>
  );
}
