import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePersist, nowTxt } from '../../lib/persist';
import { Card, Pills, T } from '../finance/shared';
import { Msg, Switch } from '../money/ui';
import { useSession } from '../../lib/session';

type Bk = { id: string; at: string; size: string; kind: string; status: string };
const H0: Bk[] = [{ id: 'BK-0322', at: 'Today 03:00', size: '214 MB', kind: 'Automatic', status: 'Completed' }, { id: 'BK-0321', at: 'Yesterday 03:00', size: '213 MB', kind: 'Automatic', status: 'Completed' }, { id: 'BK-0318', at: '17 Nov 14:22', size: '211 MB', kind: 'Manual', status: 'Completed' }];

export default function Backup() {
  const [H, setH] = usePersist<Bk[]>('ecompos.backups2', H0);
  const [auto, setAuto] = usePersist('ecompos.autoBk2', { on: true, time: '10min', keep: '90', where: 'MNest UnifiedPOS cloud (encrypted)' });
  const { stepUp: S } = useSession();
  const [restore, setRestore] = useState<{ name: string; data: Record<string, string> } | null>(null);
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState('');
  const [cloud, setCloud] = usePersist('ecompos.bkCloud2', { email: 'ebenezer@ebenezerunique.com.gh', mail: true, gmail: true, outlook: false, drive: false, onedrive: false, dropbox: false, icloud: false } as Record<string, string | boolean>);
  const { tab } = useParams();
  useEffect(() => { if (tab) document.getElementById(`bk-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [tab]);
  const keys = () => Object.keys(localStorage).filter((k) => k.startsWith('ecompos.'));
  const download = () => {
    const data = Object.fromEntries(keys().filter((k) => k !== 'ecompos.session').map((k) => [k, localStorage.getItem(k) ?? '']));
    const blob = new Blob([JSON.stringify({ app: 'MNestPOS', version: 1, at: new Date().toISOString(), data })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ecompos-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setH((x) => [{ id: 'BK-0' + (323 + x.length), at: nowTxt(), size: `${Math.max(1, Math.round(blob.size / 1024))} KB`, kind: 'Manual', status: 'Completed' }, ...x]);
    setMsg(`Backup downloaded · ${Object.keys(data).length} records`);
  };
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Backup & restore</h1><p className="m-0 text-sm text-muted">Every sale, product, customer and setting, kept safe and restorable. Backups are encrypted and never include passwords.</p></header>
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div id="bk-download" className="scroll-mt-6 min-w-0"><Card title="Download a backup" sub="A single file with all your data, to keep on your own computer or drive"><button onClick={download} className="btn-primary w-fit">Download a backup</button></Card></div>
        <div id="bk-auto" className="scroll-mt-6 min-w-0"><Card title="Automatic backup"><div className="flex items-center justify-between"><span className="text-sm">{auto.on ? `${auto.time === '10min' ? 'Every 10 minutes' : `Every night at ${auto.time}`} · kept for ${auto.keep} days` : 'Off'}</span><Switch on={auto.on} onChange={() => setAuto({ ...auto, on: !auto.on })} label="Automatic backup" /></div><div className="flex gap-2 flex-wrap items-center"><span className="text-xs font-semibold">Time</span><Pills small opts={[['10min', 'Every 10 minutes'], ['01:00', 'Nightly 01:00'], ['03:00', 'Nightly 03:00'], ['23:00', 'Nightly 23:00']]} value={auto.time} onChange={(v) => setAuto({ ...auto, time: v })} /><span className="text-xs font-semibold">Keep for</span><Pills small opts={[['30', '30 days'], ['90', '90 days'], ['365', '1 year']]} value={auto.keep} onChange={(v) => setAuto({ ...auto, keep: v })} /></div><span className="text-xs text-muted">Stored in {auto.where}.</span></Card></div>
        <div id="bk-restore" className="scroll-mt-6 min-w-0"><Card title="Restore from a backup" sub="Restoring replaces the data on this system with the backup. Make a fresh backup first.">
          <label className="btn-ghost w-fit cursor-pointer">Choose file<input type="file" accept="application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; f.text().then((t) => { try { const j = JSON.parse(t); if (j.app !== 'MNestPOS' || !j.data) throw new Error(); setRestore({ name: f.name, data: j.data }); } catch { setMsg('That file is not an MNest UnifiedPOS backup.'); } }); }} /></label>
          {restore && (() => { const cur = keys().filter((k) => k !== 'ecompos.session'); const inB = Object.keys(restore.data); const added = inB.filter((k) => !cur.includes(k)); const changed = inB.filter((k) => cur.includes(k) && localStorage.getItem(k) !== restore.data[k]); const gone = cur.filter((k) => !inB.includes(k)); return <div className="p-4 rounded-2xl bg-warn-bg flex flex-col gap-2 text-sm"><b>{restore.name}</b>
            <span className="font-semibold">What will change</span><span>{changed.length} records changed · {added.length} new · {mode === 'replace' ? `${gone.length} removed` : `${gone.length} kept as they are`}</span>{changed.slice(0, 5).map((k) => <span key={k} className="text-xs text-muted">↻ {k.replace('ecompos.', '')}</span>)}
            <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">How</span><Pills small opts={[['merge', 'Merge · add and update, keep everything else'], ['replace', 'Replace · make it exactly like the backup']]} value={mode} onChange={setMode} /></div>
            {mode === 'replace' && <label className="text-xs font-semibold flex flex-col gap-1">Type REPLACE to confirm<input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field py-2 font-normal" /></label>}
            <span className="text-xs text-muted">A safety backup of what is here now is downloaded first, so you can undo this.</span>
            <div className="flex gap-2"><button onClick={() => { setRestore(null); setConfirm(''); }} className="btn-ghost min-h-9 text-xs">Cancel</button><button disabled={mode === 'replace' && confirm !== 'REPLACE'} onClick={() => S(`Restore a backup (${mode})`, () => { download(); if (mode === 'replace') gone.forEach((k) => localStorage.removeItem(k)); inB.forEach((k) => localStorage.setItem(k, restore.data[k])); setH((x) => [{ id: 'BK-0' + (400 + x.length), at: nowTxt(), size: `${inB.length} records`, kind: mode === 'replace' ? 'Restore · replace' : 'Restore · merge', status: 'Completed' }, ...x]); setRestore(null); setConfirm(''); setMsg(`Restored by ${mode} · safety backup downloaded · reloading`); setTimeout(() => window.location.reload(), 1200); })} className="btn-primary min-h-9 text-xs disabled:opacity-40">{mode === 'replace' ? 'Replace with this backup' : 'Merge this backup'}</button></div>
          </div>; })()}
        </Card></div>
        <div id="bk-cloud" className="scroll-mt-6 min-w-0"><Card title="Send to mail & cloud" sub="A copy of every automatic backup goes here as well, so it survives even if this server is lost.">
          <label className="text-xs font-semibold flex flex-col gap-1">Email the backup link to<input value={String(cloud.email)} onChange={(e) => setCloud({ ...cloud, email: e.target.value })} className="field py-2 font-normal" /></label>
          {([['mail', 'Email a download link'], ['gmail', 'Gmail'], ['outlook', 'Outlook'], ['drive', 'Google Drive'], ['onedrive', 'OneDrive'], ['dropbox', 'Dropbox'], ['icloud', 'iCloud']] as const).map(([k, l]) => <div key={k} className="flex items-center justify-between"><span className="text-sm">{l}</span><Switch on={!!cloud[k]} onChange={() => setCloud({ ...cloud, [k]: !cloud[k] })} label={l} /></div>)}
          <button onClick={() => { if (!/^\S+@\S+\.\S+$/.test(String(cloud.email))) return setMsg('422 Unprocessable Content · Type a valid email address.'); setMsg(`Latest backup sent to ${[cloud.mail && String(cloud.email), ...(['gmail', 'outlook', 'drive', 'onedrive', 'dropbox', 'icloud'] as const).filter((k) => cloud[k]).map((k) => ({ gmail: 'Gmail', outlook: 'Outlook', drive: 'Google Drive', onedrive: 'OneDrive', dropbox: 'Dropbox', icloud: 'iCloud' })[k])].filter(Boolean).join(', ')}`); }} className="btn-dark w-fit">Send the latest backup now</button>
        </Card></div>
        <div id="bk-history" className="scroll-mt-6 min-w-0"><Card title="History"><T head={['Backup', 'When', 'Size', 'Type', 'Status']} rows={H.map((b) => [b.id, b.at, b.size, b.kind, b.status])} /></Card></div>
      </div>
    </>
  );
}
