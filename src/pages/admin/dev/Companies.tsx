import { useState } from 'react';
import { usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { removeBackground } from '../../../lib/bgRemove';
import { BIZ0, FEATS, PLANS, dbName, ini, type Company, type Plan } from './data';
import { B, Chips, Err, F, Modal, Sec, Sw, Tag, inp, useDev } from './ui';

function LogoPick({ name, logo, set }: { name: string; logo: string; set: (u: string) => void }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 flex-wrap p-3 rounded-2xl bg-canvas">
      <span className="w-14 h-14 rounded-2xl bg-white border border-line overflow-hidden flex items-center justify-center font-bold">{logo ? <img src={logo} alt="" className="w-full h-full object-contain" /> : ini(name || 'New Co')}</span>
      <span className="flex flex-col flex-1 min-w-[180px]"><span className="text-sm font-semibold">Company logo</span><span className="text-xs text-muted">PNG, JPG, SVG or WebP · up to 2 MB · square works best. The background is removed automatically. Shows on that company's Sell Now, receipts, invoices and online store.</span>{err && <span role="alert" className="text-xs text-danger">{err}</span>}</span>
      <label className={cx(B.sm, 'cursor-pointer')}>{busy ? 'Removing background…' : logo ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="Upload company logo" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!/png|jpe?g|svg|webp/.test(f.type)) return setErr('415 Unsupported Media Type · Use PNG, JPG, SVG or WebP.'); if (f.size > 2 * 1024 * 1024) return setErr('413 Content Too Large · The logo must be 2 MB or smaller.'); setErr(''); setBusy(true); removeBackground(f).then((r) => { set(r.url); setBusy(false); setErr(r.how === 'kept' ? r.note : ''); }); e.target.value = ''; }} /></label>
      {logo && <button onClick={() => set('')} className={B.sm}>Remove</button>}
    </div>
  );
}

export function EditCompany({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, act } = useDev();
  const [types] = usePersist<string[]>('ecompos.bizTypes', BIZ0);
  const c0 = d.cos.find((c) => c.id === id)!;
  const [c, setC] = useState<Company>(c0);
  const [err, setErr] = useState('');
  return (
    <Modal wide title={`Edit company · ${c0.name}`} sub={`Database ${c0.db}`} onClose={onClose}>
      {c0.id === 'main' && <div className="rounded-2xl bg-brand-50 text-brand text-sm p-3">This is the company running this system. Changing its name updates Sell Now, receipts, invoices, the online store and every page.</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        <F l="Business name"><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inp} /></F>
        <F l="Type of business"><select value={c.type} onChange={(e) => setC({ ...c, type: e.target.value })} className={inp}>{types.map((t) => <option key={t}>{t}</option>)}</select></F>
        <F l="Owner / Admin"><input value={c.owner} onChange={(e) => setC({ ...c, owner: e.target.value })} className={inp} /></F>
        <F l="Owner email"><input value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} className={inp} /></F>
        <F l="Phone"><input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className={inp} /></F>
      </div>
      <LogoPick name={c.name} logo={c.logo} set={(logo) => setC({ ...c, logo })} />
      <div className="flex gap-4 flex-wrap items-center"><span className="text-[13px] font-semibold">Plan</span><Chips value={c.plan} onChange={(plan: Plan) => setC({ ...c, plan })} opts={PLANS.map((p) => [p, p] as [Plan, string])} /><span className="text-[13px] font-semibold">Status</span><Chips value={c.status} onChange={(status) => setC({ ...c, status })} opts={[['Active', 'Active'], ['Suspended', 'Suspended · users cannot sign in']]} /></div>
      <span className="text-[13px] font-semibold">System features · {Object.values(c.feats).filter(Boolean).length} of {FEATS.length} on</span>
      <div className="grid gap-1.5 sm:grid-cols-2">{FEATS.map((f) => <Sw key={f} label={f} on={c.feats[f] !== false} onClick={() => setC({ ...c, feats: { ...c.feats, [f]: c.feats[f] === false } })} />)}</div>
      <Err e={err} />
      <div className="flex gap-2 justify-end"><button onClick={onClose} className={B.ghost}>Cancel</button><button onClick={() => { if (c.name.trim().length < 2) return setErr('422 Unprocessable Content · Add the business name.'); if (!/^\S+@\S+\.\S+$/.test(c.email)) return setErr('422 Unprocessable Content · Type a valid owner email.'); d.upCo(id, { ...c, name: c.name.trim() }); act(`Edited company ${c.name.trim()}${c.name !== c0.name ? ` (renamed from ${c0.name})` : ''}${c.status !== c0.status ? ` · ${c.status}` : ''}`, 'New company'); onClose(); }} className={B.primary}>Save company</button></div>
    </Modal>
  );
}

export default function Companies({ manage }: { manage: (id: string) => void }) {
  const { d, act, locked } = useDev();
  const [types, setTypes] = usePersist<string[]>('ecompos.bizTypes', BIZ0);
  const [btNew, setBtNew] = useState('');
  const [btErr, setBtErr] = useState('');
  const [edit, setEdit] = useState('');
  const blank = { name: '', type: types[0], owner: '', email: '', phone: '', branch: '', city: '', logo: '', plan: 'Growth' as Plan, att: 'no', par: d.cos[0]?.id || '' };
  const [n, setN] = useState(blank);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<null | { nm: string; db: string; br: string; ow: string; em: string; pw: string; linked: string; logo: string }>(null);
  const par = d.cos.find((c) => c.id === n.par);
  const db = dbName(n.name);
  const create = () => {
    if (locked) return setErr('423 Locked · Support access is paused by the Admin.');
    if (n.name.trim().length < 3) return setErr('422 Unprocessable Content · Add the company name.');
    if (d.cos.some((c) => c.name.toLowerCase() === n.name.trim().toLowerCase())) return setErr('409 Conflict · A company with this name already exists.');
    if (d.cos.some((c) => c.db === db)) return setErr(`409 Conflict · The database ${db} already exists. Change the name slightly.`);
    const owner = n.att === 'yes' && par ? par.owner : n.owner.trim();
    const email = n.att === 'yes' && par ? par.email : n.email.trim();
    if (owner.split(/\s+/).length < 2) return setErr('422 Unprocessable Content · Add the owner’s full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('422 Unprocessable Content · Type the owner’s email address.');
    if (n.att !== 'yes' && n.phone.replace(/\D/g, '').length < 9) return setErr('422 Unprocessable Content · Add the owner’s phone number.');
    if (!n.branch.trim() || !n.city.trim()) return setErr('422 Unprocessable Content · Add the first branch name and town.');
    const id = 'c' + Date.now();
    const co: Company = { id, name: n.name.trim(), type: n.type, plan: n.plan, owner, email, phone: n.att === 'yes' && par ? par.phone : n.phone, logo: n.logo, db, since: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), status: 'Active', feats: Object.fromEntries(FEATS.map((f) => [f, true])), parent: n.att === 'yes' ? par?.id : undefined, domain: n.att === 'yes' && par ? par.domain : email.split('@')[1], city: n.city.trim() };
    d.setCos((L) => [...L, co]);
    d.setBrs((B2) => ({ ...B2, [id]: [{ id: id + '-1', name: n.branch.trim(), code: n.branch.trim().slice(0, 3).toUpperCase(), city: n.city.trim(), status: 'Open', origin: 'Set-up · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), only: 0 }] }));
    d.upMeta(id, { licExp: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), auto: true, hist: [{ at: new Date().toLocaleDateString('en-GB'), what: 'Company created', by: 'MNest UnifiedPOS Support' }], adminLast: 'Never' });
    const pw = 'Start-' + Math.random().toString(36).slice(2, 7) + '!';
    act(`Created company ${co.name} · new database ${db} · Admin ${owner}${co.parent ? ` · attached to ${par?.name}` : ''}`, 'New company');
    setDone({ nm: co.name, db, br: `${n.branch.trim()} · ${n.city.trim()}`, ow: owner, em: email, pw, linked: co.parent ? par!.name : '', logo: n.logo });
    setErr('');
  };
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr] items-start">
        <div className="flex flex-col gap-5">
          <div id="sub-types" className="scroll-mt-6" /><Sec id="bt-h" title="Types of business" sub="Add the kinds of businesses you set up on MNest UnifiedPOS. They appear when you create or edit a company.">
            <div className="flex gap-2 flex-wrap">{types.map((t) => { const used = d.cos.filter((c) => c.type === t).length; return <span key={t} className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-canvas text-sm"><strong className="font-semibold">{t}</strong><span className="text-xs text-muted">{used ? `${used} compan${used > 1 ? 'ies' : 'y'}` : 'not used'}</span>{!used && <button onClick={() => { setTypes(types.filter((x) => x !== t)); act(`Removed business type ${t}`, 'New company'); }} aria-label={`Remove ${t}`} className="w-6 h-6 rounded-full hover:bg-white">×</button>}</span>; })}</div>
            <div className="flex gap-2"><input aria-label="New type of business" value={btNew} onChange={(e) => { setBtNew(e.target.value); setBtErr(''); }} placeholder="e.g. Bakery, Electronics, Salon" className={inp} /><button onClick={() => { const t = btNew.trim(); if (t.length < 3) return setBtErr('422 Unprocessable Content · Type the business type.'); if (types.some((x) => x.toLowerCase() === t.toLowerCase())) return setBtErr('409 Conflict · That type is already on the list.'); setTypes([...types, t]); setBtNew(''); act(`Added business type ${t}`, 'New company'); }} className={B.dark}>Add type</button></div>
            <Err e={btErr} />
          </Sec>
          <div id="sub-list" className="scroll-mt-6" /><Sec id="cl-h" title="Companies on this MNest UnifiedPOS server" sub={`${d.cos.length} companies · each with its own database`}>
            {d.cos.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5">
                <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-canvas overflow-hidden flex items-center justify-center text-xs font-bold flex-none">{c.logo ? <img src={c.logo} alt="" className="w-full h-full object-contain" /> : ini(c.name)}</span><strong className="flex-1">{c.name} {c.id === 'main' && <Tag t="This system" tone="info" />}{c.parent && <Tag t="Attached" tone="mute" />}</strong></div>
                <span className="text-xs text-muted">{c.type} · {c.plan} plan · Admin {c.owner} · {(d.brs[c.id] || []).filter((b) => b.status !== 'Archived').length} branches · since {c.since}</span>
                {c.status === 'Suspended' && <Tag t="Suspended · users cannot sign in" tone="bad" />}
                <span className="text-xs">Database: <code>{c.db}</code>{c.parent && <> · 🔗 linked to {d.cos.find((x) => x.id === c.parent)?.name}</>}</span>
                <div className="flex gap-2"><button onClick={() => setEdit(c.id)} className={B.sm}>Edit company</button><button onClick={() => manage(c.id)} className={B.sm}>Manage branches</button></div>
              </div>
            ))}
          </Sec>
        </div>
        <div id="sub-new" className="scroll-mt-6 flex flex-col"><Sec id="nc-h" title="Create a new company" sub="Each company gets its own new database, completely separate from every other company, with the same MNest UnifiedPOS features. Its owner becomes the company's Admin.">
          {done ? (
            <div role="status" className="rounded-2xl bg-green-50 p-4 flex flex-col gap-1.5 text-sm">
              <strong className="text-base text-ok flex items-center gap-2">{done.logo && <img src={done.logo} alt="" className="w-8 h-8 rounded-lg object-contain" />}✓ {done.nm} is ready</strong>
              <span>✓ New database created · <b>{done.db}</b> · empty and separate from all other companies</span>
              <span>✓ All system features set up · Sell Now, online store, orders, riders, inventory, returns, hire purchase, invoices, reports</span>
              <span>✓ First branch: {done.br}</span>
              {done.linked && <span>🔗 Attached to {done.linked} · one Admin now controls both companies</span>}
              <span>✓ Admin account: {done.ow} · {done.em} · temporary password <b>{done.pw}</b> (must be changed at first sign-in)</span>
              <button onClick={() => { setDone(null); setN(blank); }} className={cx(B.dark, 'w-fit mt-2')}>Create another company</button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-canvas p-3 flex flex-col gap-2"><strong className="text-sm">Attach this new company to an existing company?</strong><span className="text-xs text-muted">Attach it when the same owner runs another business: one Admin controls both companies on the same domain, while each company keeps its own separate database.</span>
                <Chips label="Attach to an existing company" value={n.att} onChange={(att) => setN({ ...n, att })} opts={[['no', 'No · standalone company'], ['yes', 'Yes · same owner and domain']]} />
                {n.att === 'yes' && <F l="Attach to"><select value={n.par} onChange={(e) => setN({ ...n, par: e.target.value })} className={inp}>{d.cos.filter((c) => !c.parent).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <F l="Company name"><input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="e.g. Kofi Stores Ltd" className={inp} /></F>
                <F l="Type of business"><select value={n.type} onChange={(e) => setN({ ...n, type: e.target.value })} className={inp}>{types.map((t) => <option key={t}>{t}</option>)}</select></F>
                {n.att === 'yes' && par ? <div className="sm:col-span-2 rounded-2xl bg-brand-50 p-3 text-sm">🔗 <b>Admin: {par.owner} · {par.email}</b><br /><span className="text-xs">Same Admin and same domain ({par.domain}) as {par.name}. The new company gets its own separate database. {par.owner} signs in with the same login and controls both companies.</span></div> : <>
                  <F l="Owner (becomes Admin)"><input value={n.owner} onChange={(e) => setN({ ...n, owner: e.target.value })} placeholder="Full name" className={inp} /></F>
                  <F l="Owner's email (sign-in)"><input value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} placeholder="owner@company.com" className={inp} /></F>
                  <F l="Owner's phone"><input value={n.phone} onChange={(e) => setN({ ...n, phone: e.target.value })} placeholder="+233 24 000 0000" className={inp} /></F>
                </>}
                <F l="First branch name"><input value={n.branch} onChange={(e) => setN({ ...n, branch: e.target.value })} placeholder="e.g. Madina branch" className={inp} /></F>
                <F l="Town / city"><input value={n.city} onChange={(e) => setN({ ...n, city: e.target.value })} placeholder="e.g. Accra" className={inp} /></F>
              </div>
              <LogoPick name={n.name} logo={n.logo} set={(logo) => setN({ ...n, logo })} />
              <div className="flex gap-2 items-center flex-wrap"><span className="text-[13px] font-semibold">Plan</span><Chips value={n.plan} onChange={(plan: Plan) => setN({ ...n, plan })} opts={PLANS.map((p) => [p, p] as [Plan, string])} /></div>
              <div className="rounded-2xl bg-canvas p-3 text-sm flex flex-col gap-1"><span>New database name: <b>{n.name.trim() ? db : '—'}</b></span><span className="text-xs text-muted">Same features as every company:</span><div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">{FEATS.map((f) => <span key={f}>✓ {f}</span>)}</div></div>
              <Err e={err} />
              <button onClick={create} className={cx(B.primary, 'w-fit')}>Create company &amp; new database</button>
            </>
          )}
        </Sec></div>
      </div>
      {edit && <EditCompany id={edit} onClose={() => setEdit('')} />}
    </>
  );
}
