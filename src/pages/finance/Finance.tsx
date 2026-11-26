import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Toast } from '../../components/ui';
import { bName, FBR, insights, outstanding, seedFinance, type FinState } from '../../data/finance';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx } from '../../lib/format';
import { Accounts, Assistant, Refunds } from './Admin';
import { Cashup, Deposits, Moves } from './Banking';
import Overview from './Overview';
import type { Ctx } from './shared';

const TL: Record<string, string> = { overview: 'Overview', cashup: 'Cash-up', deposits: 'Bank deposits', moves: 'Money movements', refunds: 'Refunds', accounts: 'Bank accounts', assistant: 'Finance assistant' };

export default function Finance() {
  const { tab } = useParams();
  const nav = useNavigate();
  const { session, viewBranch, setViewBranch } = useSession();
  const role = (session?.role ?? 'superuser') as 'superuser' | 'manager' | 'supervisor' | 'staff';
  const SU = role === 'superuser';
  const me = PEOPLE[role].name;
  const myBr = session?.branch ?? 'osu';
  const [S, setS0] = usePersist<FinState>('ecompos.finance2', seedFinance());
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const tabs = SU ? ['overview', 'cashup', 'deposits', 'moves', 'refunds', 'accounts', 'assistant'] : ['overview', 'cashup', 'deposits', 'moves', 'refunds'];
  const T = tab && tabs.includes(tab) ? tab : 'overview';
  const scope = SU ? (viewBranch === 'all' || FBR.some((b) => b.id === viewBranch) ? viewBranch : 'all') : myBr;
  const brs = scope === 'all' ? FBR.map((b) => b.id) : [scope];
  useEffect(() => setMsg(null), [T]);

  const c: Ctx = {
    S, setS: (f) => setS0((s) => f(s)), role, SU, me, myBr, scope, brs,
    goTab: (t) => nav(t === 'overview' ? '/finance' : `/finance/${t}`),
    flash: (t, bad) => setMsg({ t, bad }),
  };
  const N: Record<string, number> = {
    refunds: S.refunds.filter((r) => brs.includes(r.br) && ['Refund initiated', 'Approved', 'Payment sent'].includes(r.status)).length,
    deposits: SU ? S.dep.filter((d) => d.status === 'pending').length : outstanding(S).filter((o) => o.late && brs.includes(o.br)).length,
    moves: SU ? S.mov.filter((m) => m.status === 'pending').length : 0,
    assistant: SU ? insights(S, scope).filter((i) => i.sev === 'high').length : 0,
  };
  const title = SU ? 'Finance' : role === 'staff' ? 'My till money' : `Finance · ${bName(myBr)} branch`;
  const note = SU ? 'Every branch’s takings, banking, cash-ups and money movements in one place. Only you see the totals across all branches.' : role === 'staff' ? 'What you took today, and your cash-up at closing.' : 'Your branch’s takings, banking and cash-ups.';

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{title}{T !== 'overview' ? ` · ${TL[T]}` : ''}</h1><p className="m-0 text-sm text-muted max-w-2xl">{note}</p></div>
        <span className="flex flex-col items-end text-xs"><span className="font-semibold">{me} · {PEOPLE[role].level}</span><span className="text-muted">As of {new Date().toTimeString().slice(0, 5)} today</span></span>
      </header>
      <nav aria-label="Finance sections" className="flex gap-1 p-1 rounded-full bg-white shadow-card w-fit max-w-full overflow-x-auto">
        {tabs.map((t) => (
          <button key={t} onClick={() => c.goTab(t)} aria-current={T === t ? 'page' : undefined} className={cx('text-sm px-3.5 py-2 rounded-full whitespace-nowrap inline-flex items-center gap-1.5', T === t ? 'bg-black text-white font-semibold' : 'text-sub hover:bg-canvas')}>
            {TL[t]}{N[t] ? <span className={cx('pill px-1.5 py-0', T === t ? 'bg-white text-black' : 'bg-danger text-white')}>{N[t]}</span> : null}
          </button>
        ))}
      </nav>
      {SU && T !== 'accounts' && T !== 'assistant' && (
        <div role="group" aria-label="Branch" className="flex gap-2 flex-wrap">
          {[['all', 'All branches'], ...FBR.map((b) => [b.id, b.name])].map(([id, l]) => (
            <button key={id} aria-pressed={scope === id} onClick={() => setViewBranch(id)} className={cx('text-sm px-4 py-2 rounded-full border', scope === id ? 'bg-black text-white border-black' : 'bg-white border-line')}>{l}</button>
          ))}
        </div>
      )}
      {T === 'overview' && <Overview c={c} />}
      {T === 'cashup' && <Cashup c={c} />}
      {T === 'deposits' && <Deposits c={c} />}
      {T === 'moves' && <Moves c={c} />}
      {T === 'refunds' && <Refunds c={c} />}
      {T === 'accounts' && <Accounts c={c} />}
      {T === 'assistant' && <Assistant c={c} />}
      <Toast msg={msg?.t ?? ''} onClose={() => setMsg(null)} />
    </>
  );
}
