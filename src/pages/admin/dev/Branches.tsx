import { useState } from 'react';
import { PRODUCTS0, type Product } from '../../../data/catalogue';
import { usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { type Br } from './data';
import { B, Err, F, Modal, Sec, Tag, inp, phClean, useDev } from './ui';
import NoticeModal from '../../../components/Notice';

type Req = { name: string; town: string; notes: string; at: string; status: string };

export default function Branches() {
  const { d, act, locked } = useDev();
  const co = d.co;
  const list = d.brs[co.id] || [];
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const [reqs, setReqs] = usePersist<Req[]>('ecompos.branchRequests2', [{ name: 'Tema', town: 'Tema', notes: 'Community 1 shop · 2 tills', at: '18 Nov', status: 'Requested' }]);
  const today = new Date().toISOString().slice(0, 10);
  const blank = { signed: '', tills: '', name: '', code: '', city: '', addr: '', phone: '', opened: '' };
  const [nb, setNb] = useState(blank);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [ed, setEd] = useState<Br | null>(null);
  const [edErr, setEdErr] = useState('');
  const setL = (f: (l: Br[]) => Br[]) => d.setBrs((M) => ({ ...M, [co.id]: f(M[co.id] || []) }));
  const shared = co.id === 'main' ? P.filter((p) => p.scope === 'all').length : 0;
  const create = () => {
    if (locked) return setErr('423 Locked · Support access is paused by the Admin.');
    if (!nb.signed) return setErr('422 Unprocessable Content · Add the date the purchase agreement was signed.');
    if (nb.signed > today) return setErr('422 Unprocessable Content · The signing date cannot be in the future.');
    if (!(parseInt(nb.tills, 10) > 0)) return setErr('422 Unprocessable Content · How many tills were purchased for this branch?');
    if (!ok) return setErr('A branch can only be created after the Admin and MNest UnifiedPOS Support have both signed the purchase agreement.');
    if (nb.name.trim().length < 2) return setErr('422 Unprocessable Content · Add the branch name.');
    if (!/^[A-Z]{2,4}$/.test(nb.code)) return setErr('422 Unprocessable Content · The short code is 2 to 4 letters.');
    if (list.some((b) => b.code === nb.code)) return setErr(`409 Conflict · ${nb.code} is already used by another branch.`);
    if (list.some((b) => b.name.toLowerCase() === nb.name.trim().toLowerCase())) return setErr('409 Conflict · A branch with this name already exists.');
    if (!nb.city.trim()) return setErr('422 Unprocessable Content · Add the town.');
    if (nb.phone && nb.phone.length !== 9) return setErr('422 Unprocessable Content · Branch phone: 9 digits after +233, without the first 0.');
    if (!nb.opened || nb.opened < nb.signed) return setErr('422 Unprocessable Content · Pick an opening date on or after the signing date.');
    const id = nb.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-3);
    setL((l) => [...l, { id, name: nb.name.trim(), code: nb.code, city: nb.city.trim(), status: 'Open', origin: `Purchase agreement · ${new Date(nb.signed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${nb.tills} tills`, addr: nb.addr, phone: nb.phone, opened: nb.opened, only: 0 }]);
    setReqs((R) => R.map((r) => (r.name.toLowerCase() === nb.name.trim().toLowerCase() ? { ...r, status: 'Created' } : r)));
    act(`Created branch ${nb.name.trim()} (${nb.code}) under ${co.name} · purchase agreement signed ${nb.signed} · ${nb.tills} tills`, 'Company branches');
    setMsg(`✓ ${nb.name.trim()} created under ${co.name} and linked to the company database. The Admin can now assign the manager and staff.`);
    setNb(blank); setOk(false); setErr('');
  };
  return (
    <>
      <Sec title={`Company: ${co.name}`} sub={`Admin ${co.owner} · ${co.email} · ${list.filter((b) => b.status !== 'Archived').length} branches`} actions={<F l="Manage branches of"><select value={d.sel} onChange={(e) => d.setSel(e.target.value)} className={inp}>{d.cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>}>
        <div className="flex flex-col divide-y divide-line">
          {list.map((b) => (
            <div key={b.id} className={cx('flex items-center gap-3 py-3 flex-wrap', b.status === 'Archived' && 'opacity-50')}>
              <span className="flex flex-col flex-1 min-w-[200px]"><strong className="text-sm">{b.name} · {b.code}</strong><span className="text-xs text-muted">{b.city} · {b.origin}</span></span>
              <Tag t={b.status} tone={b.status === 'Open' ? 'ok' : b.status === 'Closed' ? 'warn' : 'mute'} />
              {b.status !== 'Archived' && <><button onClick={() => { setEd(b); setEdErr(''); }} className={B.sm}>Edit</button><button disabled={locked} onClick={() => { setL((l) => l.map((x) => (x.id === b.id ? { ...x, status: x.status === 'Open' ? 'Closed' : 'Open' } : x))); act(`${b.status === 'Open' ? 'Closed' : 'Opened'} branch ${b.name} · ${co.name}`, 'Company branches'); }} className={B.sm}>{b.status === 'Open' ? 'Close' : 'Open'}</button>{list.filter((x) => x.status !== 'Archived').length > 1 && <button disabled={locked} onClick={() => { setL((l) => l.map((x) => (x.id === b.id ? { ...x, status: 'Archived' } : x))); act(`Archived branch ${b.name} · ${co.name}`, 'Company branches'); }} className={B.sm}>Archive</button>}</>}
            </div>
          ))}
        </div>
      </Sec>
      <Sec id="db-h" title="How branch data is stored" sub="New branches connect to the company database automatically. Only branch-specific data is kept per branch.">
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1"><strong>1 · Company (main store)</strong><span className="text-xs text-muted">{co.name} · one database · <code>{co.db}</code></span><span>Shared catalogue: products, categories, selling prices, cost prices, tax &amp; E-VAT, payment options, customers, loyalty, users</span><span className="text-xs font-semibold">{shared} shared products</span></div>
          <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1"><strong>2 · Each branch</strong><span className="text-xs text-muted">Linked to the company catalogue on creation</span><span>Own stock levels, tills and devices, staff, shifts, sales, returns, online collections and opening hours</span></div>
          <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1"><strong>3 · Branch-only items</strong><span className="text-xs text-muted">Stored in the catalogue, tagged to one branch</span><span>Unique products appear only on that branch's Sell Now, stock and online listing</span><span className="text-xs font-semibold">{list.reduce((a, b) => a + b.only, 0)} branch-only products</span></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]"><thead><tr className="text-left text-xs text-muted border-b border-line">{['Branch', 'Catalogue link', 'Shared products', 'Branch-only products'].map((h) => <th key={h} scope="col" className="py-2 pr-3 font-semibold">{h}</th>)}</tr></thead><tbody>{list.filter((b) => b.status !== 'Archived').map((b) => <tr key={b.id} className="border-b border-line"><td className="py-2 pr-3 font-medium">{b.name}</td><td className="pr-3">✓ {co.db}</td><td className="pr-3">{shared}</td><td>{b.only}</td></tr>)}</tbody></table></div>
      </Sec>
      {co.id === 'main' && reqs.length > 0 && <Sec title="Branch requests from the Admin">{reqs.map((r, i) => <div key={i} className="flex items-center gap-3 flex-wrap p-3 rounded-2xl bg-canvas"><span className="flex-1 text-sm"><b>{r.name} · {r.town}</b><br /><span className="text-xs text-muted">{r.notes} · requested {r.at}</span></span><Tag t={r.status} tone={r.status === 'Created' ? 'ok' : 'info'} />{r.status !== 'Created' && <button onClick={() => setNb({ ...nb, name: r.name, city: r.town, code: r.name.slice(0, 3).toUpperCase(), addr: r.notes.split('·')[0].trim(), tills: (r.notes.match(/(\d+)\s*till/) || [])[1] || '' })} className={B.sm}>Use this request</button>}</div>)}</Sec>}
      <Sec title={`Create a new branch under ${co.name}`}>
        <F l="Attach this branch to company"><select value={d.sel} onChange={(e) => d.setSel(e.target.value)} className={inp}>{d.cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
        <span className="text-xs text-muted">The branch will use the {co.db} database.</span>
        <strong className="text-sm">1 · Purchase agreement</strong>
        <div className="grid gap-2 sm:grid-cols-2"><F l="Date signed"><input type="date" max={today} value={nb.signed} onChange={(e) => setNb({ ...nb, signed: e.target.value })} className={inp} /></F><F l="Tills purchased for this branch"><input inputMode="numeric" value={nb.tills} onChange={(e) => setNb({ ...nb, tills: e.target.value.replace(/\D/g, '') })} placeholder="2" className={inp} /></F></div>
        <label className="flex items-start gap-2 text-sm p-3 rounded-2xl bg-canvas"><input type="checkbox" checked={ok} onChange={() => setOk(!ok)} className="w-4 h-4 mt-0.5 accent-brand" />{co.owner} (Admin) and MNest UnifiedPOS Support have both signed this purchase agreement for a new branch</label>
        <strong className="text-sm">2 · Branch details</strong>
        <div className="grid gap-2 sm:grid-cols-2">
          <F l="Branch name"><input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="e.g. Tema branch" className={inp} /></F>
          <F l="Short code (up to 4 letters)"><input value={nb.code} maxLength={4} onChange={(e) => setNb({ ...nb, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} placeholder="TEM" className={inp} /></F>
          <F l="Town"><input value={nb.city} onChange={(e) => setNb({ ...nb, city: e.target.value })} placeholder="Tema" className={inp} /></F>
          <F l="Address and GhanaPostGPS"><input value={nb.addr} onChange={(e) => setNb({ ...nb, addr: e.target.value })} placeholder="Community 1, Tema · GT-000-0000" className={inp} /></F>
          <F l="Branch phone (optional)" note="9 digits after +233, without the first 0"><div className="flex items-center h-10 rounded-full border border-line overflow-hidden"><span className="px-3 text-sm text-muted bg-canvas h-full flex items-center border-r border-line">+233</span><input inputMode="numeric" autoComplete="tel-national" maxLength={12} value={nb.phone} onChange={(e) => setNb({ ...nb, phone: phClean(e.target.value) })} placeholder="24 555 0142" className="flex-1 min-w-0 px-3 outline-none text-sm font-normal" /></div></F>
          <F l="Opening date"><input type="date" min={nb.signed || undefined} value={nb.opened} onChange={(e) => setNb({ ...nb, opened: e.target.value })} className={inp} /></F>
        </div>
        <span className="text-xs text-muted">The branch is linked to the company database automatically: it uses the shared catalogue, prices, tax settings, payment options and customers. Its stock, tills, staff and sales are kept for the branch. The Admin assigns the manager and staff after it is created.</span>
        <Err e={err} />
        <NoticeModal msg={msg} onClose={() => setMsg('')} />
        <button onClick={create} className={cx(B.primary, 'w-fit')}>Create branch under {co.name}</button>
      </Sec>
      {ed && (
        <Modal title={`Edit branch · ${ed.name}`} sub={co.name} onClose={() => setEd(null)}>
          <F l="Branch name"><input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} className={inp} /></F>
          <F l="Town / city"><input value={ed.city} onChange={(e) => setEd({ ...ed, city: e.target.value })} className={inp} /></F>
          <F l="Branch code"><input value={ed.code} maxLength={4} onChange={(e) => setEd({ ...ed, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} className={inp} /></F>
          <Err e={edErr} />
          <div className="flex gap-2 justify-end"><button onClick={() => setEd(null)} className={B.ghost}>Cancel</button><button onClick={() => { if (ed.name.trim().length < 2 || !ed.city.trim()) return setEdErr('422 Unprocessable Content · Add the name and town.'); if (!/^[A-Z]{2,4}$/.test(ed.code)) return setEdErr('422 Unprocessable Content · The code is 2 to 4 letters.'); if (list.some((b) => b.id !== ed.id && b.code === ed.code)) return setEdErr(`409 Conflict · ${ed.code} is already used.`); setL((l) => l.map((x) => (x.id === ed.id ? ed : x))); act(`Edited branch ${ed.name} (${ed.code}) · ${co.name}`, 'Company branches'); setEd(null); }} className={B.primary}>Save changes</button></div>
        </Modal>
      )}
    </>
  );
}
