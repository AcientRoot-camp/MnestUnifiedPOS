import { useState } from 'react';
import { readKey, usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { ALERTS0, type Alert } from './data';
import { B, Chips, Kpi, Sec, Tag, useDev } from './ui';

type Check = { name: string; st: 'ok' | 'warn' | 'fail'; result: string };
const MARK = { ok: '✓', warn: '!', fail: '×' } as const;

export function runChecks(brs: { id: string; status: string }[]): Check[] {
  const tk = readKey<{ status: string; to?: string; forwarded?: boolean }[]>('ecompos.tickets2', []);
  const openTk = tk.filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  const col = readKey<{ status: string }[]>('ecompos.collect2', []);
  const waiting = col.filter((c) => c.status === 'ready' || c.status === 'prep' || c.status === 'waiting').length;
  const tills = readKey<Record<string, string[]>>('ecompos.tills2', { osu: ['Till 1', 'Till 2'], legon: ['Till 1'], adum: ['Till 1', 'Till 2'] });
  const noTill = brs.filter((b) => b.status === 'Open' && !(tills[b.id] || []).length);
  return [
    { name: 'Database', st: 'ok', result: 'Healthy · 18 ms queries' },
    { name: 'API & app servers', st: 'ok', result: '99.96% uptime · 210 ms average' },
    { name: 'Paystack gateway', st: 'ok', result: 'Live keys valid · webhooks arriving' },
    { name: 'Mobile Money', st: 'warn', result: 'Telecel timeouts 30% (normal under 5%)' },
    { name: 'E-VAT link to GRA', st: 'warn', result: '3 receipts queued for 2 h' },
    { name: 'Tills sync', st: 'fail', result: 'Osu Till 2 offline for 47 min' },
    { name: 'Backups', st: 'ok', result: 'Last full backup today 03:00 · test restore passed' },
    { name: 'Storage', st: 'ok', result: '41% used of 50 GB' },
    { name: 'SSL certificates', st: 'ok', result: 'Valid for 68 more days' },
    { name: 'Support tickets', st: openTk >= 3 ? 'warn' : 'ok', result: `${openTk} open${openTk >= 3 ? ' · 3 or more waiting' : ''}` },
    { name: 'Online collections', st: waiting >= 3 ? 'warn' : 'ok', result: `${waiting} order${waiting === 1 ? '' : 's'} waiting to be collected` },
    { name: 'New branches', st: noTill.length ? 'warn' : 'ok', result: noTill.length ? `No till registered at ${noTill.map((b) => (b as { name?: string }).name || b.id).join(', ')}` : 'Every open branch has a till' },
  ];
}

export default function Monitor() {
  const { d, act, locked } = useDev();
  const [al, setAl] = usePersist<Alert[]>('ecompos.sysAlerts', ALERTS0);
  const [last, setLast] = usePersist('ecompos.lastCheck', 'Today 03:00 (nightly)');
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<'open' | 'Critical' | 'Warning' | 'Info' | 'Resolved' | 'all'>('open');
  const run = () => { setBusy(true); setChecks([]); setTimeout(() => { const c = runChecks(d.brs[d.co.id] || []); setChecks(c); setBusy(false); const t = 'Today ' + new Date().toTimeString().slice(0, 5); setLast(t); act(`Ran a full health check · ${c.filter((x) => x.st === 'fail').length} failed, ${c.filter((x) => x.st === 'warn').length} warnings`, 'System monitor'); }, 1400); };
  const up = (id: string, p: Partial<Alert>) => setAl((L) => L.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const shown = al.filter((a) => (f === 'all' ? true : f === 'open' ? a.state !== 'Resolved' : f === 'Resolved' ? a.state === 'Resolved' : a.sev === f && a.state !== 'Resolved'));
  const open = al.filter((a) => a.state !== 'Resolved');
  return (
    <>
      <Sec title="Smart system monitor" sub={<>Watches tills, payments, E-VAT, backups, errors and tickets around the clock. It spots failures and unusual patterns, explains the likely cause and suggests a fix. Last full check: <b className="text-black">{last}</b></>} actions={<button onClick={run} disabled={busy || locked} className={B.dark}>{busy && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}{busy ? 'Checking all systems…' : 'Run full health check'}</button>}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi l="Open alerts" v={open.length} tone={open.length ? 'warn' : 'ok'} />
          <Kpi l="Critical" v={open.filter((a) => a.sev === 'Critical').length} tone={open.some((a) => a.sev === 'Critical') ? 'bad' : 'ok'} />
          <Kpi l="Auto-fix available" v={open.filter((a) => a.auto).length} />
          <Kpi l="Resolved this week" v={al.filter((a) => a.state === 'Resolved').length} tone="ok" />
        </div>
        {checks.length > 0 && <div className="grid gap-2 md:grid-cols-2">{checks.map((c) => <div key={c.name} className={cx('flex items-start gap-3 p-3 rounded-2xl', c.st === 'ok' ? 'bg-green-50' : c.st === 'warn' ? 'bg-amber-50' : 'bg-red-50')}><span className={cx('w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-none', c.st === 'ok' ? 'bg-ok' : c.st === 'warn' ? 'bg-[#b26a00]' : 'bg-danger')}>{MARK[c.st]}</span><span className="flex flex-col text-sm"><strong>{c.name}</strong><span className="text-sub">{c.st === 'warn' ? 'Warning: ' : c.st === 'fail' ? 'Fail: ' : ''}{c.result}</span></span></div>)}</div>}
      </Sec>
      <Chips label="Filter alerts" value={f} onChange={setF} opts={[['open', `Open · ${open.length}`], ['Critical', 'Critical'], ['Warning', 'Warning'], ['Info', 'Info'], ['Resolved', 'Resolved'], ['all', 'All']]} />
      {!shown.length && <div className="bg-white rounded-3xl shadow-card p-6 text-center flex flex-col gap-1"><strong className="text-ok">✓ No issues in this view</strong><span className="text-sm text-muted">The monitor keeps watching and alerts you the moment something fails.</span></div>}
      {shown.map((a) => (
        <article key={a.id} className={cx('bg-white rounded-3xl shadow-card p-5 flex flex-col gap-2 border-l-4', a.sev === 'Critical' ? 'border-danger' : a.sev === 'Warning' ? 'border-[#b26a00]' : 'border-brand')}>
          <div className="flex justify-between gap-3 flex-wrap"><span className="flex items-center gap-2 flex-wrap"><Tag t={a.sev} tone={a.sev === 'Critical' ? 'bad' : a.sev === 'Warning' ? 'warn' : 'info'} /><strong>{a.title}</strong></span><Tag t={a.state} tone={a.state === 'Resolved' ? 'ok' : a.state === 'Acknowledged' ? 'info' : 'mute'} /></div>
          <span className="text-xs text-muted">{a.area} · detected {a.when} · {a.source}</span>
          <p className="m-0 text-sm">{a.detail}</p>
          <div className="grid gap-2 md:grid-cols-2 text-sm"><div className="p-3 rounded-2xl bg-canvas"><strong>Likely cause · </strong>{a.cause}</div><div className="p-3 rounded-2xl bg-brand-50"><strong>Suggested fix · </strong>{a.fix}</div></div>
          {a.state !== 'Resolved' && <div className="flex gap-2 flex-wrap">
            {a.auto && <button disabled={locked} onClick={() => { up(a.id, { state: 'Resolved' }); act(`Auto-fix on ${a.id} · ${a.auto}`, 'System monitor'); }} className={B.primary}>Run auto-fix</button>}
            {a.state === 'Open' && <button disabled={locked} onClick={() => { up(a.id, { state: 'Acknowledged' }); act(`Acknowledged ${a.id} · ${a.title}`, 'System monitor'); }} className={B.ghost}>Acknowledge</button>}
            <button disabled={locked || a.notified} onClick={() => { up(a.id, { notified: true }); act(`Told the Admin about ${a.id} · ${a.title}`, 'System monitor'); }} className={B.ghost}>{a.notified ? '✓ Admin notified' : 'Notify Admin'}</button>
            <button disabled={locked} onClick={() => { up(a.id, { state: 'Resolved' }); act(`Marked ${a.id} resolved`, 'System monitor'); }} className={B.ghost}>Mark resolved</button>
          </div>}
        </article>
      ))}
    </>
  );
}
