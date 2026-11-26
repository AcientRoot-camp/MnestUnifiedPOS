import { useState } from 'react';
import { bName, CREDIT_PAYMENTS, dAgo, dayTxt, EXPENSES_MONTH, FBR, FLOAT, insights, monthDays, money, MON, outstanding, OVERDUE_CREDIT, OWED, takings, TODAY, balOf } from '../../data/finance';
import { cx } from '../../lib/format';
import { Card, Pills, T, type Ctx } from './shared';

const SEV = { high: ['Act now', 'bg-danger'], mid: ['Soon', 'bg-[#b26a00]'], low: ['Tip', 'bg-[#0b6bcb]'], info: ['Insight', 'bg-brand'] } as const;

export default function Overview({ c }: { c: Ctx }) {
  const { S, SU, brs, scope, goTab, role } = c;
  const [dhDays, setDhDays] = useState<'7' | '14'>('7');
  const T0 = brs.reduce((a, id) => { const t = takings(id, TODAY); return { cash: a.cash + t.cash, momo: a.momo + t.momo, ghpay: a.ghpay + t.ghpay, card: a.card + t.card, credit: a.credit + t.credit, total: a.total + t.total }; }, { cash: 0, momo: 0, ghpay: 0, card: 0, credit: 0, total: 0 });
  const OUT = outstanding(S).filter((o) => brs.includes(o.br));
  const OUTL = OUT.filter((o) => o.late);
  const outLate = OUTL.reduce((a, o) => a + o.amount, 0);
  const dToday = S.dep.filter((d) => brs.includes(d.br) && new Date(d.ts).toDateString() === new Date().toDateString());
  const pendDep = S.dep.filter((d) => d.status === 'pending');
  const pendMov = S.mov.filter((m) => m.status === 'pending');
  const accTotal = S.acc.reduce((a, x) => a + balOf(x.id, S).bal, 0);
  const isStaff = role === 'staff';

  const kpis = SU
    ? [
        { l: scope === 'all' ? 'Takings today · all branches' : `Takings today · ${bName(scope)}`, v: money(T0.total), s: `${money(T0.cash)} cash · ${money(T0.momo)} MoMo`, go: '' },
        { l: 'Banked today', v: money(dToday.reduce((a, d) => a + d.amount, 0)), s: `${dToday.length} deposits recorded today`, sc: 'text-ok', go: 'deposits' },
        { l: 'Overdue for the bank', v: money(outLate), s: outLate ? `${OUTL.length} items from earlier days` : 'Every earlier day is banked', sc: outLate ? 'text-danger' : 'text-ok', ring: outLate ? 'ring-2 ring-danger' : '', go: 'deposits' },
        { l: 'Waiting for your check', v: String(pendDep.length + pendMov.length), s: `${pendDep.length} deposits · ${pendMov.length} movements`, sc: 'text-[#b26a00]', ring: pendDep.length + pendMov.length ? 'ring-2 ring-[#b26a00]' : '', go: 'deposits' },
        { l: 'In banks, wallets & safe', v: money(accTotal), s: `${S.acc.length} accounts`, go: 'accounts' },
        { l: 'Owed to the business', v: money(OWED), s: `${money(OVERDUE_CREDIT)} overdue`, sc: 'text-danger', go: '' },
      ]
    : isStaff
      ? [
          { l: 'My till today', v: money(Math.round(T0.total * 0.4)), s: 'Sales by you', go: '' },
          { l: 'Cash I took', v: money(Math.round(T0.cash * 0.4)), s: 'Plus the GHS 500.00 float in the drawer', go: 'cashup' },
          { l: 'MoMo I took', v: money(Math.round(T0.momo * 0.4)), s: 'Goes straight to the merchant wallet', go: '' },
          { l: 'My cash-up today', v: S.cus.some((x) => x.day === TODAY && x.by === c.me) ? 'Done' : 'Not yet', s: 'Count the drawer before you leave', go: 'cashup' },
        ]
      : [
          { l: `Takings today · ${bName(c.myBr)}`, v: money(T0.total), s: `${money(T0.cash)} cash · ${money(T0.momo)} MoMo`, go: '' },
          { l: 'Not yet banked', v: money(OUT.reduce((a, o) => a + o.amount, 0)), s: outLate ? `${money(outLate)} from earlier days` : 'Earlier days are banked', sc: outLate ? 'text-danger' : 'text-ok', go: 'deposits' },
          { l: 'Cash-up today', v: S.cus.some((x) => x.br === c.myBr && x.day === TODAY) ? 'Done' : 'Not yet', s: 'Every till before closing', go: 'cashup' },
          { l: 'Deposits waiting for the Admin', v: String(S.dep.filter((d) => d.br === c.myBr && d.status === 'pending').length), s: 'Checked against the bank statement', go: 'deposits' },
        ];

  const ins = SU ? insights(S, scope) : [];
  const days = Array.from({ length: 7 }, (_, i) => dAgo(6 - i));
  const chBars = days.map((d) => {
    const tk = brs.reduce((a, id) => { const t = takings(id, d); return a + t.cash + t.momo + t.ghpay; }, 0);
    const bk = S.dep.filter((x) => brs.includes(x.br) && x.days.includes(d) && x.status !== 'flagged').reduce((a, x) => a + x.amount / x.days.length, 0);
    return { d, tk, bk, gap: tk - bk };
  });
  const chMax = Math.max(...chBars.map((b) => b.tk), 1);
  const mix = [['Cash', T0.cash, 'in the drawers'], ['MoMo', T0.momo, 'merchant wallets'], ['GhPay', T0.ghpay, 'GhIPSS settlement'], ['Card', T0.card, 'settles next working day'], ['Credit', T0.credit, 'owed by customers']] as const;

  const todo: { done: boolean; t: string; b: string; cta?: string; go?: string }[] = SU
    ? [
        { done: !pendDep.length, t: pendDep.length ? `Check ${pendDep.length} deposits against the bank statement` : 'All deposits checked', b: pendDep.length ? `${money(pendDep.reduce((a, d) => a + d.amount, 0))} recorded by the branches` : 'Nothing waiting', cta: 'Check now', go: 'deposits' },
        { done: !pendMov.length, t: pendMov.length ? `Approve ${pendMov.length} money movements` : 'No movements waiting', b: pendMov.length ? 'Requested by managers and supervisors' : 'Nothing waiting', cta: 'Review', go: 'moves' },
        { done: !OUTL.length, t: OUTL.length ? 'Chase overdue banking' : 'Every earlier day is banked', b: OUTL.length ? Array.from(new Set(OUTL.map((o) => bName(o.br)))).join(', ') + ' still owe the bank' : 'All branches are up to date', cta: 'See what is owed', go: 'deposits' },
        { done: FBR.every((b) => S.cus.some((x) => x.br === b.id && x.day === TODAY)), t: 'Cash-ups at closing', b: `${FBR.filter((b) => S.cus.some((x) => x.br === b.id && x.day === TODAY)).length} of ${FBR.length} branches counted today`, cta: 'Open cash-up', go: 'cashup' },
      ]
    : [
        { done: S.cus.some((x) => x.br === c.myBr && x.day === TODAY), t: 'Count the drawer at closing', b: 'Type how many of each note you have', cta: 'Cash-up', go: 'cashup' },
        { done: !OUTL.length, t: OUTL.length ? 'Bank the money from earlier days' : 'Earlier days are banked', b: OUTL.length ? money(outLate) + ' still to take to the bank' : 'Nothing overdue', cta: 'Record deposit', go: 'deposits' },
        { done: false, t: 'Keep the GHS 500.00 float in the drawer', b: 'It stays for tomorrow’s change' },
      ];

  const dh = Array.from({ length: Number(dhDays) }, (_, i) => dAgo(i + 1));

  return (
    <>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k) => (
          <button key={k.l} onClick={() => k.go && goTab(k.go)} className={cx('card p-[22px] flex flex-col gap-2 text-left', 'ring' in k && k.ring, k.go ? 'hover:bg-canvas/40' : 'cursor-default')}>
            <span className="text-[13px] text-muted">{k.l}</span>
            <strong className="text-[24px] leading-tight font-medium tracking-tightest">{k.v}</strong>
            <span className={cx('text-xs', ('sc' in k && k.sc) || 'text-muted')}>{k.s}</span>
          </button>
        ))}
      </div>

      {SU && (
        <section className="rounded-4xl bg-black text-white p-5 sm:p-6 flex flex-col gap-3">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center text-lg">✦</span><div><h2 className="m-0 text-lg font-semibold">Finance assistant</h2><span className="text-[13px] text-white/70">Reads takings, banking, cash-ups and expenses from every branch</span></div></div>
            <button onClick={() => goTab('assistant')} className="btn bg-white text-black">See all {ins.length} insights</button>
          </div>
          {ins.slice(0, 3).map((i) => (
            <div key={i.title} className="flex gap-3 items-start p-3 rounded-2xl bg-white/[0.08]">
              <span className={cx('pill text-white', SEV[i.sev][1])}>{SEV[i.sev][0]}</span>
              <div className="flex-1 flex flex-col gap-0.5"><strong className="text-sm">{i.title}</strong><span className="text-[13px] text-white/75">{i.body}</span></div>
              {i.act && i.tab && <button onClick={() => goTab(i.tab!)} className="text-xs font-semibold px-3 py-2 rounded-full bg-white text-black whitespace-nowrap">{i.act}</button>}
            </div>
          ))}
        </section>
      )}

      {SU && scope === 'all' && (
        <Card title="Every branch today" sub="Live from the tills · tap a branch to focus on it">
          <T
            head={['Branch', 'Takings today', 'Cash', 'MoMo', 'Not yet banked', 'Cash-up', 'Status']}
            rows={FBR.map((b) => {
              const t = takings(b.id, TODAY);
              const o = outstanding(S).filter((x) => x.br === b.id);
              const late = o.some((x) => x.late);
              const cu = S.cus.some((x) => x.br === b.id && x.day === TODAY);
              return [<span key="n"><b>{b.name}</b><br /><span className="text-xs text-muted">{b.lead}</span></span>, money(t.total), money(t.cash), money(t.momo), money(o.reduce((a, x) => a + x.amount, 0)), cu ? 'Done' : 'Not yet', <span key="s" className={cx('pill', late ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}>{late ? 'Overdue banking' : 'Up to date'}</span>];
            })}
            foot={['All branches', money(FBR.reduce((a, b) => a + takings(b.id, TODAY).total, 0)), money(FBR.reduce((a, b) => a + takings(b.id, TODAY).cash, 0)), money(FBR.reduce((a, b) => a + takings(b.id, TODAY).momo, 0)), money(outstanding(S).reduce((a, x) => a + x.amount, 0)), '', '']}
          />
        </Card>
      )}

      {!isStaff && (
        <>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={() => downloadCsv(c)} className="btn-ghost">Download finance report (CSV)</button>
            <button onClick={() => window.print()} className="btn-ghost">Print finance report</button>
          </div>
          <Card title="Credit payments collected · last 7 days" sub="Part payments from credit customers. They are added to what each branch must bank." actions={<strong className="text-lg">{money(CREDIT_PAYMENTS.filter((p) => brs.includes(p.br)).reduce((a, p) => a + p.amt, 0))}</strong>}>
            <T head={['When', 'Branch', 'Customer', 'Sale', 'Paid by', 'Taken by', 'Amount']} rows={CREDIT_PAYMENTS.filter((p) => brs.includes(p.br)).map((p) => [`Today, ${p.h}:30`, bName(p.br), p.cust, '#' + p.no, p.meth, p.by, money(p.amt)])} />
          </Card>
          <Card title={`Expenses per branch · ${MON[new Date().getMonth()]} ${new Date().getFullYear()}`} sub="Approved and paid expenses from the Expenses module against each branch's takings this month.">
            <T
              head={['Branch', 'Takings this month', 'Expenses', 'Expenses %', 'After expenses']}
              rows={brs.map((id) => {
                const tk = monthDays().reduce((a, d) => a + takings(id, d).total, 0);
                const ex = EXPENSES_MONTH[id];
                const p = (ex / tk) * 100;
                return [bName(id), money(tk), money(ex), <span key="p" className={cx(p > 12 ? 'text-danger font-semibold' : 'text-ok')}>{p.toFixed(1)}%</span>, money(tk - ex)];
              })}
            />
            <span className="text-xs text-muted">Guide: keep expenses under 12% of takings. Red means a branch is above it.</span>
          </Card>
          <Card title="Daily branch history" sub="Takings, banking and cash-up difference for each earlier day" actions={<Pills small opts={[['7', 'Last 7 days'], ['14', 'Last 14 days']]} value={dhDays} onChange={setDhDays} />}>
            <T
              head={['Day', ...brs.map((id) => bName(id))]}
              rows={dh.map((d) => [dayTxt(d), ...brs.map((id) => {
                const t = takings(id, d);
                const cu = S.cus.find((x) => x.br === id && x.day === d);
                const late = outstanding(S).some((o) => o.br === id && o.day === d);
                return <span key={id}>{money(t.total)}<br /><span className={cx('text-xs', late ? 'text-danger' : cu?.variance ? 'text-[#b26a00]' : 'text-muted')}>{late ? 'Not fully banked' : cu?.variance ? `Cash-up ${money(cu.variance)}` : 'Banked · balanced'}</span></span>;
              })])}
            />
          </Card>
        </>
      )}

      <Card title={isStaff ? 'My takings · last 7 days' : 'Taken vs banked · last 7 days'}>
        <div className="flex gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand" />Cash, MoMo & GhPay taken</span><span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#22c55e]" />Banked</span></div>
        <div className="flex items-end gap-3 h-48" role="img" aria-label="Taken versus banked bar chart">
          {chBars.map((b) => (
            <div key={b.d} className="flex-1 flex items-end gap-1 h-full" title={`${dayTxt(b.d)}: taken ${money(b.tk)}, banked ${money(b.bk)}`}>
              <div className="flex-1 rounded-t-lg bg-brand" style={{ height: `${(b.tk / chMax) * 100}%` }} />
              <div className="flex-1 rounded-t-lg bg-[#22c55e]" style={{ height: `${(b.bk / chMax) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex gap-3">{chBars.map((b) => <span key={b.d} className="flex-1 text-center text-[11px] text-muted">{dayTxt(b.d).split(' ')[0]}<br /><span className={b.gap > 1 && b.d !== TODAY ? 'text-danger' : ''}>{b.d === TODAY ? 'today' : b.gap > 1 ? `− ${Math.round(b.gap).toLocaleString()}` : '✓'}</span></span>)}</div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={isStaff ? 'How my customers paid today' : 'How customers paid today'}>
          {mix.map(([l, v, w]) => (
            <div key={l} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm"><span>{l} <span className="text-muted">· {w}</span></span><strong>{money(v)}</strong></div>
              <div className="h-2 rounded-full bg-canvas overflow-hidden"><div className="h-full bg-brand" style={{ width: `${T0.total ? (v / T0.total) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </Card>
        <Card title={SU ? 'Your finance to-do' : 'What to do today'}>
          {todo.map((t) => (
            <div key={t.t} className={cx('flex gap-3 items-start p-3 rounded-2xl', t.done ? 'bg-[#f1f8f2]' : 'bg-[#fff6ec]')}>
              <span className={cx('w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center flex-none', t.done ? 'bg-ok' : 'bg-[#b26a00]')}>{t.done ? '✓' : '!'}</span>
              <div className="flex-1 flex flex-col"><strong className="text-sm">{t.t}</strong><span className="text-xs text-muted">{t.b}</span></div>
              {!t.done && t.cta && t.go && <button onClick={() => goTab(t.go!)} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white whitespace-nowrap">{t.cta}</button>}
            </div>
          ))}
        </Card>
      </div>
      <span className="sr-only">Float per till {money(FLOAT)}</span>
    </>
  );
}

function downloadCsv(c: Ctx) {
  const rows = [['Branch', 'Day', 'Cash', 'MoMo', 'GhPay', 'Card', 'Credit', 'Total']];
  c.brs.forEach((id) => Array.from({ length: 7 }, (_, i) => dAgo(i)).forEach((d) => { const t = takings(id, d); rows.push([bName(id), d, t.cash, t.momo, t.ghpay, t.card, t.credit, t.total].map(String)); }));
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ecompos-finance-${TODAY}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
