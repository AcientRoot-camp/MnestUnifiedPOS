// Reports → CRM group (§9): growth, retention cohorts, pipeline conversion, follow-up completion, satisfaction, loyalty liability.
import { ghs } from '../../lib/format';
import { BR, lifecycle, scoped } from './model';
import { Bars, useCrm } from './ui';

export default function CrmReports() {
  const m = useCrm(); const { c } = m;
  const scopeTxt = c.role === 'superuser' ? (m.vb === 'all' ? 'All branches' : BR[m.vb]) : c.role === 'staff' ? 'My customers' : 'My branch';
  const cs = c.role === 'superuser' ? (m.vb === 'all' ? m.custs : m.custs.filter((x) => x.br === m.vb)) : m.custs.filter((x) => x.br === c.br);
  const deals = scoped(m.deals, c, m.vb); const tasks = scoped(m.tasks, c, m.vb); const fb = scoped(m.feedback, c, m.vb);
  const years = Array.from(new Set(cs.map((x) => x.since.split(' ').pop() || ''))).sort();
  const growth = years.map((y) => [y, cs.filter((x) => x.since.endsWith(y)).length] as [string, number]);
  const cohorts = years.map((y) => { const L = cs.filter((x) => x.since.endsWith(y)); const still = L.filter((x) => !['Lapsed'].includes(lifecycle(x))).length; return [y, L.length, still, L.length ? Math.round((still / L.length) * 100) : 0] as const; });
  const won = deals.filter((d) => d.stage === 'Won').length; const lost = deals.filter((d) => d.stage === 'Lost').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const rated = fb.filter((f) => f.rating); const avg = rated.length ? rated.reduce((a, f) => a + f.rating, 0) / rated.length : 0;
  const pts = cs.reduce((a, x) => a + x.points, 0); const liab = (pts / m.settings.loyalty.burnPoints) * m.settings.loyalty.burnValue;
  const csv = () => { const rows = [['Report', 'Value'], ['Scope', scopeTxt], ['Customers', cs.length], ['Pipeline conversion', `${won + lost ? Math.round((won / (won + lost)) * 100) : 0}%`], ['Follow-ups completed', `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`], ['Average rating', avg.toFixed(2)], ['Loyalty liability (GHS)', liab.toFixed(2)], ...cohorts.map((x) => [`Retention ${x[0]}`, `${x[3]}% (${x[2]}/${x[1]})`])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'crm-report.csv'; a.click(); };
  const box = 'bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between gap-3 flex-wrap items-center"><span className="text-sm text-muted">CRM reports · {scopeTxt}</span><button onClick={csv} className="h-10 px-4 rounded-full bg-white border border-black text-sm font-semibold">Download CSV</button></div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[['Pipeline conversion', `${won + lost ? Math.round((won / (won + lost)) * 100) : 0}%`, `${won} won · ${lost} lost`], ['Follow-ups completed', `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`, `${done} of ${tasks.length}`], ['Average satisfaction', avg ? `${avg.toFixed(1)} / 5` : '—', `${rated.length} ratings`], ['Loyalty liability', ghs(liab), `${pts.toLocaleString('en-GB')} unused points`]].map(([l, v, n]) => <div key={l} className="bg-white rounded-3xl shadow-card p-4"><span className="text-xs text-muted">{l}</span><br /><strong className="text-2xl font-semibold">{v}</strong><br /><span className="text-xs text-muted">{n}</span></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <section className={box}><h2 className="m-0 text-lg font-semibold">Customer growth</h2><span className="text-[13px] text-muted">New customers by the year they joined</span><Bars rows={growth} /></section>
        <section className={box}><h2 className="m-0 text-lg font-semibold">Retention cohorts</h2><span className="text-[13px] text-muted">Of the customers who joined each year, how many still buy</span>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted uppercase tracking-wide"><th className="py-2">Joined</th><th>Customers</th><th>Still buying</th><th>Retention</th></tr></thead><tbody>{cohorts.map((x) => <tr key={x[0]} className="border-t border-line"><td className="py-2">{x[0]}</td><td>{x[1]}</td><td>{x[2]}</td><td><b>{x[3]}%</b></td></tr>)}</tbody></table>
        </section>
        <section className={box}><h2 className="m-0 text-lg font-semibold">Pipeline by stage</h2><Bars money={ghs} rows={m.settings.stages.map((s) => [s, deals.filter((d) => d.stage === s).reduce((a, d) => a + d.value, 0), `${deals.filter((d) => d.stage === s).length}`])} /></section>
        <section className={box}><h2 className="m-0 text-lg font-semibold">Satisfaction by channel</h2><Bars rows={Array.from(new Set(rated.map((f) => f.channel))).map((ch) => { const L = rated.filter((f) => f.channel === ch); return [ch, Number((L.reduce((a, f) => a + f.rating, 0) / L.length).toFixed(1)), `${L.length}`] as [string, number, string]; })} /></section>
      </div>
    </div>
  );
}
