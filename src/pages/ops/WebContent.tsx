import { useEffect, useState } from 'react';
import { devLog } from '../../lib/sec';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BRS, PRODUCTS0, brName, now, type Product } from '../../data/catalogue';
import { PEOPLE } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { FAQ0, HERO_ART, NAV_NAMES0, branchArt, useWeb, type Code, type Faq, type Job, type Review, type Upd, type Web } from '../../data/web';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { Card, Pills } from '../finance/shared';
import { Head, Msg, Switch } from '../money/ui';
import { removeBackground } from '../../lib/bgRemove';
import { companyLogo } from '../../lib/brand';
import { POLICY_TEMPLATES, POLICY_TOKENS, fillTokens, toBlocks } from '../../data/policies';
import { tokensOf } from '../store/model';
import { FAQ_GROUPS } from '../../data/webContent';
import { readPolicyDoc } from '../../lib/docImport';
import { markStaffStore, storeUrl } from '../../lib/site';
import { seoOf, shownDesc, writeDescription, type DescTone } from '../../lib/describe';
import ProductDesc from '../../components/ProductDesc';

const D = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 16);
const TABS: [string, string][] = [['codes', 'Discount codes'], ['careers', 'Careers / Job adverts'], ['updates', 'Store updates'], ['products', 'Product descriptions'], ['about', 'About us'], ['branches', 'Branch information'], ['reviews', 'What customers say'], ['pages', 'Pages'], ['seo', 'SEO & advanced'], ['plugins', 'Plugins & apps'], ['delivery', 'Delivery charges'], ['site', 'Store name, logo & settings']];
const inp = 'field py-2 font-normal';
const L = ({ l, children }: { l: string; children: React.ReactNode }) => <label className="text-[13px] font-semibold flex flex-col gap-1">{l}{children}</label>;

export default function WebContent() {
  const { tab = 'updates' } = useParams();
  const nav = useNavigate();
  const { session } = useSession();
  const role = session?.role ?? 'superuser';
  const SU = role === 'superuser';
  const DEV = role === 'developer';
  const me = DEV ? 'MNest UnifiedPOS Support' : PEOPLE[role].name;
  const [W, up] = useWeb();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const done = (m: string) => { setErr(''); setMsg(m); };
  // Admin, Managers and MNest UnifiedPOS Support can post. Discount codes and job adverts stay with the Admin.
  const canPost = SU || role === 'manager' || DEV;
  const tabs = TABS.filter(([k]) => (k !== 'codes' && k !== 'careers') || SU);
  const T = tabs.some(([k]) => k === tab) ? tab : 'updates';
  useEffect(() => { if (DEV && msg) devLog(`Post to webstore · ${msg}`, 'Post to webstore'); }, [msg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Head title={TABS.find((t) => t[0] === T)![1]} sub={`Post to online · everything you post here goes live on the ${W.site.name || 'Ebenezer Unique Ventures'} online store straight away${W.lastPost ? ` · last post ${new Date(W.lastPost).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}`}><Link to="/shop" className="btn-ghost">View online store</Link></Head>
      <Pills small opts={tabs} value={T} onChange={(t) => nav(`/web/${t}`)} />
      {!canPost && <div className="card p-4 text-sm">Only the Admin and Managers can post to the online store. Ask your Manager if something on the store needs changing.</div>}
      <Msg text={msg} onClose={() => setMsg('')} />
      {err && <div role="alert" className="px-4 py-3 rounded-2xl bg-red-50 border border-danger text-sm text-danger">{err}</div>}
      {canPost && T === 'codes' && <Codes W={W} up={up} me={me} done={done} setErr={setErr} />}
      {canPost && T === 'updates' && <Updates W={W} up={up} done={done} setErr={setErr} />}
      {canPost && T === 'careers' && SU && <Careers W={W} up={up} done={done} setErr={setErr} />}
      {canPost && T === 'products' && <Descs W={W} up={up} done={done} />}
      {canPost && T === 'about' && <About W={W} up={up} done={done} />}
      {canPost && T === 'branches' && <Branches W={W} up={up} done={done} />}
      {canPost && T === 'reviews' && <Reviews W={W} up={up} done={done} setErr={setErr} />}
      {canPost && T === 'pages' && <Pages W={W} up={up} done={done} setErr={setErr} />}
      {canPost && T === 'seo' && <Seo W={W} up={up} done={done} />}
      {canPost && T === 'plugins' && <Card title="Plugins & apps" sub={`${Object.values(W.plugins).filter(Boolean).length} switched on`}>{[['whatsapp', 'WhatsApp chat button', 'Messaging · customers tap to chat with the branch'], ['reviews', 'Product reviews', 'Social proof · customers rate what they bought'], ['ga', 'Google Analytics 4', 'Analytics · visits, sources and sales'], ['pixel', 'Meta Pixel', 'Ads · measure Facebook and Instagram ads'], ['chat', 'Live chat', 'Support · chat with shoppers in real time'], ['mailchimp', 'Mailchimp', 'Email · send newsletters to customers']].map(([k, n, d]) => <div key={k} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{n}</b> {W.plugins[k] && <span className="pill bg-green-100 text-green-800 ml-1">On</span>}<br /><span className="text-xs text-muted">{d}</span></span><Switch on={!!W.plugins[k]} onChange={() => { up({ plugins: { ...W.plugins, [k]: !W.plugins[k] } }); done(`${n} ${W.plugins[k] ? 'switched off' : 'switched on'}`); }} label={n} /></div>)}</Card>}
      {canPost && T === 'delivery' && <Delivery W={W} up={up} done={done} />}
      {canPost && T === 'site' && <Site W={W} up={up} done={done} />}
    </>
  );
}

function Codes({ W, up, me, done, setErr }: { W: Web; up: (p: Partial<Web>) => void; me: string; done: (m: string) => void; setErr: (e: string) => void }) {
  const [f, setF] = useState<Code>({ code: '', type: 'pct', value: 10, cap: 0, min: 0, from: D(0), to: D(7), limit: 0, once: true, note: '', paused: false, banner: false, used: 0, by: me });
  const [push, setPush] = useState('');
  const st = (c: Code) => (c.paused ? 'Paused' : new Date(c.to) < new Date() ? 'Ended' : new Date(c.from) > new Date() ? 'Scheduled' : 'Live');
  const offer = (c: Code) => (c.type === 'pct' ? `${c.value}% off${c.cap ? ` (up to ${ghs(c.cap)})` : ''}` : c.type === 'cash' ? `${ghs(c.value)} off` : 'Free delivery') + (c.min ? ` · orders over ${ghs(c.min)}` : '');
  const setC = (code: string, p: Partial<Code>) => up({ codes: W.codes.map((c) => (c.code === code ? { ...c, ...p } : c)) });
  return (
    <div className="grid gap-6 xl:grid-cols-2 items-start">
      <Card title="Create a discount code" sub="Only the Admin can create codes. Customers type the code at checkout; it only works between the start and end time you set.">
        <div className="flex gap-2 items-end"><L l="Code"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="e.g. XMAS10" className={inp} /></L><button onClick={() => setF({ ...f, code: 'EUV' + Math.random().toString(36).slice(2, 7).toUpperCase() })} className="btn-ghost">✨ Generate</button></div>
        <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Discount</span><Pills small opts={[['pct', 'Percentage'], ['cash', 'Cash off'], ['ship', 'Free delivery']]} value={f.type} onChange={(v) => setF({ ...f, type: v })} /></div>
        <div className="grid grid-cols-3 gap-2">{f.type !== 'ship' && <L l={f.type === 'pct' ? 'Percent off' : 'Cash off (GHS)'}><input inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: parseFloat(e.target.value) || 0 })} className={inp} /></L>}{f.type === 'pct' && <L l="Most it can take off (GHS)"><input inputMode="decimal" value={f.cap || ''} onChange={(e) => setF({ ...f, cap: parseFloat(e.target.value) || 0 })} placeholder="No limit" className={inp} /></L>}<L l="Minimum order (GHS)"><input inputMode="decimal" value={f.min || ''} onChange={(e) => setF({ ...f, min: parseFloat(e.target.value) || 0 })} placeholder="0" className={inp} /></L></div>
        <div className="grid grid-cols-2 gap-2"><L l="Starts"><input type="datetime-local" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inp} /></L><L l="Ends"><input type="datetime-local" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inp} /></L></div>
        <div className="flex gap-1.5 flex-wrap">{[['24 hours', 1], ['1 week', 7], ['This month', 30]].map(([l, n]) => <button key={l as string} onClick={() => setF({ ...f, from: D(0), to: D(n as number) })} className="text-xs px-3 py-1.5 rounded-full border border-line">{l as string}</button>)}</div>
        <L l="Total uses allowed"><input inputMode="numeric" value={f.limit || ''} onChange={(e) => setF({ ...f, limit: parseInt(e.target.value, 10) || 0 })} placeholder="No limit" className={inp} /></L>
        <button aria-pressed={f.once} onClick={() => setF({ ...f, once: !f.once })} className={cx('text-sm px-3.5 py-2 rounded-full border w-fit', f.once ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{f.once ? '✓ ' : ''}One use per customer (checked by phone number)</button>
        <L l="Note for staff (optional)"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Christmas promotion" className={inp} /></L>
        <span className="text-xs text-muted">{f.code || 'CODE'} gives {offer(f)}</span>
        <button onClick={() => { if (f.code.length < 4) return setErr('The code needs at least 4 letters or numbers.'); if (W.codes.some((c) => c.code === f.code)) return setErr('That code already exists.'); if (new Date(f.to) <= new Date(f.from)) return setErr('The end time must be after the start time.'); up({ codes: [f, ...W.codes] }); done(`${f.code} created`); setF({ ...f, code: '', note: '' }); }} className="btn-primary w-fit">Create code</button>
      </Card>
      <Card title="Your discount codes" sub={`${W.codes.filter((c) => st(c) === 'Live').length} live · ${W.codes.length} in total`}>
        {!W.codes.length && <span className="text-sm text-muted">No codes yet. Create one on the left.</span>}
        {W.codes.map((c) => (
          <div key={c.code} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5">
            <div className="flex justify-between gap-2"><b className="tracking-wider">{c.code}</b><span className={cx('pill', st(c) === 'Live' ? 'bg-green-100 text-green-800' : 'bg-canvas')}>{st(c)}</span></div>
            <span className="text-sm">{offer(c)} <span className="text-xs text-muted">· by {c.by}</span></span>
            <span className="text-xs text-muted">{new Date(c.from).toLocaleString('en-GB')} – {new Date(c.to).toLocaleString('en-GB')} · {c.limit ? `${c.limit} uses` : 'no limit'}{c.once ? ' · once per customer' : ''} · used {c.used} times</span>
            {/^CRM/.test(c.note) && <span className="text-xs flex gap-1.5 flex-wrap items-center"><span className="pill bg-[#eef6f6] text-[#0b5c5c]">From the CRM</span>{c.note.replace(/^CRM · /, '')}{c.only ? ` · only for +233 ${c.only.slice(0, 2)} ${c.only.slice(2, 5)} ${c.only.slice(5)}` : ''} · <Link to="/crm/feedback" className="underline">Open CRM</Link></span>}
            {c.pushed && <span className="text-xs text-ok">{c.pushed}</span>}
            <div className="flex gap-2 flex-wrap">{!c.only && <button onClick={() => setPush(push === c.code ? '' : c.code)} className="btn-dark min-h-9 text-xs">📣 Push to customers</button>}<button onClick={() => setC(c.code, { banner: !c.banner })} className="btn-ghost min-h-9 text-xs">{c.banner ? 'Remove store banner' : 'Show as store banner'}</button><button onClick={() => setC(c.code, { paused: !c.paused })} className="btn-ghost min-h-9 text-xs">{c.paused ? 'Resume' : 'Pause'}</button><button onClick={() => up({ codes: W.codes.filter((x) => x.code !== c.code) })} className="btn-ghost min-h-9 text-xs text-danger">Delete</button></div>
            {push === c.code && <div className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-2"><span>“Use code <b>{c.code}</b> for {offer(c)} at shop.ebenezerunique.com.gh until {new Date(c.to).toLocaleDateString('en-GB')}.”</span><span className="text-xs text-muted">Goes by SMS and WhatsApp to 2,140 customers who agreed to offers.</span><div className="flex gap-2"><button onClick={() => { setC(c.code, { pushed: `Sent to 2,140 customers · ${now()}` }); setPush(''); done(`${c.code} sent to customers`); }} className="btn-primary min-h-9 text-xs">Send now</button><button onClick={() => setPush('')} className="btn-ghost min-h-9 text-xs">Cancel</button></div></div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

function Updates({ W, up, done, setErr }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void; setErr: (e: string) => void }) {
  const blank: Upd = { id: '', title: '', kind: 'New stock', body: '', cta: '', pinned: false, live: true, at: '' };
  const [f, setF] = useState<Upd>(blank);
  const save = (live: boolean) => { if (f.title.trim().length < 3 || f.body.trim().length < 5) return setErr('Add a title and the update.'); const u = { ...f, id: f.id || 'u' + Date.now(), live, at: f.at || now() }; up({ updates: f.id ? W.updates.map((x) => (x.id === f.id ? u : x)) : [u, ...W.updates] }); done(live ? 'Posted to the store' : 'Saved as draft'); setF(blank); };
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Card title={f.id ? 'Edit update' : 'Post an update'}>
          <L l="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. New stock of 32-inch TVs at Osu" className={inp} /></L>
          <L l="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inp}>{['New stock', 'Offer', 'Announcement', 'Event', 'Closing times'].map((k) => <option key={k}>{k}</option>)}</select></L>
          <L l="Update"><textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="What do you want customers to know?" className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
          <div className="grid sm:grid-cols-2 gap-2"><L l="Button text (optional)"><input value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} placeholder="e.g. Shop the offer" className={inp} /></L><L l="Button opens"><select value={f.to || 'shop'} onChange={(e) => setF({ ...f, to: e.target.value as Upd['to'] })} className={inp}><option value="shop">Shop</option><option value="branches">Branches</option><option value="contact">Contact</option><option value="about">About us</option></select></L></div>
          <div className="flex items-center gap-3 flex-wrap">{f.img && <img src={f.img} alt="" className="w-20 h-14 object-cover rounded-xl" />}<label className="btn-ghost cursor-pointer">🖼 {f.img ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => readImg(e.target.files?.[0], (u) => setF({ ...f, img: u }))} /></label>{f.img && <button onClick={() => setF({ ...f, img: '' })} className="text-xs underline">Remove photo</button>}</div>
          <button aria-pressed={f.pinned} onClick={() => setF({ ...f, pinned: !f.pinned })} className={cx('text-sm px-3.5 py-2 rounded-full border w-fit', f.pinned ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{f.pinned ? '✓ ' : ''}Pin to the top of the store home page</button>
          <div className="flex gap-2"><button onClick={() => save(true)} className="btn-primary">{f.id ? 'Save & post' : 'Post update'}</button><button onClick={() => save(false)} className="btn-ghost">Save as draft</button>{f.id && <button onClick={() => setF(blank)} className="btn-ghost">Cancel</button>}</div>
        </Card>
        <Card title="Posted updates">{!W.updates.length && <span className="text-sm text-muted">Nothing posted yet. Updates show on the store home page and on its Updates page.</span>}{W.updates.map((u) => <div key={u.id} className="p-3 rounded-2xl border border-line flex flex-col gap-1 text-sm"><div className="flex justify-between gap-2"><b>{u.title}</b><span className={cx('pill', u.live ? 'bg-green-100 text-green-800' : 'bg-canvas')}>{u.pinned ? 'Pinned · ' : ''}{u.live ? 'Live' : 'Draft'}</span></div><span className="text-xs text-muted">{u.kind} · {u.at}</span><span>{u.body}</span><div className="flex gap-2"><button onClick={() => setF(u)} className="text-xs font-semibold underline">Edit</button><button onClick={() => up({ updates: W.updates.map((x) => (x.id === u.id ? { ...x, live: !x.live } : x)) })} className="text-xs font-semibold underline">{u.live ? 'Hide' : 'Show'}</button><button onClick={() => up({ updates: W.updates.filter((x) => x.id !== u.id) })} className="text-xs font-semibold underline text-danger">Delete</button></div></div>)}</Card>
      </div>
    </>
  );
}

const DOCS = ['CV / résumé', 'Cover letter', 'Certificates', 'Driving licence', 'Reference letter'];
function Careers({ W, up, done, setErr }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void; setErr: (e: string) => void }) {
  const blank: Job = { id: '', title: '', dept: 'Sales', br: 'osu', type: 'Full time', salMin: '', salMax: '', open: true, apps: 0, summary: '', role: 'Sales', openings: 1, closes: D(21).slice(0, 10), showSal: true, duties: '', reqs: '', offer: '', docs: ['CV / résumé'], draft: false };
  const [j, setJ] = useState<Job>(blank);
  const ta = 'p-3 rounded-2xl border border-line font-normal text-sm';
  const save = (draft: boolean) => { if (j.title.trim().length < 3) return setErr('Add the job title.'); if (!j.summary.trim()) return setErr('Add a short summary of the job.'); const x = { ...j, id: j.id || 'j' + Date.now(), draft, docs: (j.docs || []).filter((d) => !/ghana\s*card/i.test(d)) }; up({ jobs: j.id ? W.jobs.map((y) => (y.id === j.id ? x : y)) : [x, ...W.jobs] }); done(draft ? 'Job saved as draft' : 'Job published on Careers & opportunities'); setJ(blank); };
  return (
    <div className="grid gap-6 xl:grid-cols-2 items-start">
      <Card title={j.id ? 'Edit job advert' : 'Post a job'} sub="Only the Admin can post jobs. Open jobs appear on the store’s Careers & opportunities page; applications go to People & HR → Recruitment.">
        <div className="grid sm:grid-cols-2 gap-2">
          <L l="Job title"><input value={j.title} onChange={(e) => setJ({ ...j, title: e.target.value })} placeholder="e.g. Sales assistant" className={inp} /></L>
          <L l="Department"><select value={j.dept} onChange={(e) => setJ({ ...j, dept: e.target.value })} className={inp}>{['Sales', 'Warehouse', 'Delivery', 'Finance', 'Management'].map((d) => <option key={d}>{d}</option>)}</select></L>
          <L l="Branch"><select value={j.br} onChange={(e) => setJ({ ...j, br: e.target.value })} className={inp}>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
          <L l="Job type"><select value={j.type} onChange={(e) => setJ({ ...j, type: e.target.value })} className={inp}>{['Full time', 'Part time', 'Contract', 'National service', 'Internship'].map((t) => <option key={t}>{t}</option>)}</select></L>
          <L l="Role in the system"><select value={j.role} onChange={(e) => setJ({ ...j, role: e.target.value })} className={inp}>{['Sales', 'Supervisor', 'Manager', 'Rider', 'No system access'].map((t) => <option key={t}>{t}</option>)}</select></L>
          <L l="Openings"><input inputMode="numeric" value={j.openings || ''} onChange={(e) => setJ({ ...j, openings: parseInt(e.target.value, 10) || 0 })} className={inp} /></L>
          <L l="Salary from (GHS / month)"><input inputMode="numeric" value={j.salMin} onChange={(e) => setJ({ ...j, salMin: e.target.value.replace(/\D/g, '') })} className={inp} /></L>
          <L l="Salary to"><input inputMode="numeric" value={j.salMax} onChange={(e) => setJ({ ...j, salMax: e.target.value.replace(/\D/g, '') })} className={inp} /></L>
          <L l="Closing date"><input type="date" value={j.closes} onChange={(e) => setJ({ ...j, closes: e.target.value })} className={inp} /></L>
        </div>
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Show the salary on the advert</span><Switch on={j.showSal !== false} onChange={() => setJ({ ...j, showSal: j.showSal === false })} label="Show salary" /></div>
        <L l="About the job (short summary)"><textarea rows={3} value={j.summary} onChange={(e) => setJ({ ...j, summary: e.target.value })} placeholder="Who you are looking for and what they will do." className={ta} /></L>
        <L l="Duties (one per line)"><textarea rows={3} value={j.duties} onChange={(e) => setJ({ ...j, duties: e.target.value })} className={ta} /></L>
        <L l="Requirements (one per line)"><textarea rows={3} value={j.reqs} onChange={(e) => setJ({ ...j, reqs: e.target.value })} className={ta} /></L>
        <L l="What we offer (one per line)"><textarea rows={3} value={j.offer} onChange={(e) => setJ({ ...j, offer: e.target.value })} className={ta} /></L>
        <span className="text-[13px] font-semibold">Documents applicants must upload</span>
        <div className="flex gap-1.5 flex-wrap">{DOCS.map((d) => { const on = (j.docs || []).includes(d); return <button key={d} aria-pressed={on} onClick={() => setJ({ ...j, docs: on ? (j.docs || []).filter((x) => x !== d) : [...(j.docs || []), d] })} className={cx('text-xs px-3 py-1.5 rounded-full border', on ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{on ? '✓ ' : ''}{d}</button>; })}</div>
        <span className="text-xs text-muted">The CV is asked for by default. Applicants are never asked for a Ghana Card online; the branch checks it at interview.</span>
        <div className="flex gap-2 flex-wrap"><button onClick={() => save(false)} className="btn-primary">Publish job</button><button onClick={() => save(true)} className="btn-ghost">Save as draft</button>{j.id && <button onClick={() => setJ(blank)} className="btn-ghost">Cancel</button>}</div>
      </Card>
      <Card title="Job adverts" sub={`${W.jobs.filter((x) => x.open && !x.draft).length} open · ${W.jobs.reduce((a, x) => a + x.apps, 0)} applications`}>
        {!W.jobs.length && <span className="text-sm text-muted">No job adverts yet.</span>}
        {W.jobs.map((x) => <div key={x.id} className="p-3 rounded-2xl border border-line text-sm flex flex-col gap-1"><div className="flex justify-between gap-2"><b>{x.title}</b><span className={cx('pill', x.draft ? 'bg-canvas' : x.open ? 'bg-green-100 text-green-800' : 'bg-canvas')}>{x.draft ? 'Draft' : x.open ? 'Open' : 'Closed'}</span></div><span className="text-xs text-muted">{x.dept} · {brName(x.br)} · {x.type}{x.salMin ? ` · GHS ${x.salMin}–${x.salMax}` : ''}{x.closes ? ` · closes ${x.closes}` : ''} · {x.apps} applications</span><div className="flex gap-3 flex-wrap"><button onClick={() => setJ({ ...blank, ...x })} className="text-xs font-semibold underline">Edit</button><button onClick={() => up({ jobs: W.jobs.map((y) => (y.id === x.id ? { ...y, open: !y.open } : y)) })} className="text-xs font-semibold underline">{x.open ? 'Close' : 'Reopen'}</button><Link to="/staff" className="text-xs font-semibold underline">View applicants ↗</Link><button onClick={() => up({ jobs: W.jobs.filter((y) => y.id !== x.id) })} className="text-xs font-semibold underline text-danger">Delete</button></div></div>)}
      </Card>
    </div>
  );
}

const readImg = (f: File | undefined, cb: (url: string) => void, maxMb = 5) => { if (!f) return; if (f.size > maxMb * 1024 * 1024) { alert(`${f.name} is bigger than ${maxMb} MB.`); return; } const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsDataURL(f); };

/**
 * Post to online → Product descriptions. The description itself is the product's shared description (the same text
 * Sell Now and Products show, lib/describe.ts), so editing or generating it here changes it everywhere; sale prices,
 * extra highlights and Google text stay online-only (W.desc).
 */
function Descs({ W, up, done }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void }) {
  const [P, setP] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const live = P.filter((p) => p.status === 'live' && p.web);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(live[0]?.id ?? '');
  const [extra, setExtra] = useState({ features: '', audience: '', keywords: '', tone: 'Friendly', length: 'Medium' });
  const p = live.find((x) => x.id === sel);
  const d = p ? W.desc[p.id] ?? { desc: p.desc, bullets: '', seoTitle: `${p.name} | Ebenezer Unique Ventures`, seoDesc: `Buy ${p.name} online at ${ghs(p.price)}. Delivery in Accra & Kumasi.`, live: true, sale: '' } : null;
  const setD = (x: Partial<NonNullable<typeof d>>) => p && d && up({ desc: { ...W.desc, [p.id]: { ...d, ...x } } });
  // The shared description (POS + online store) and its setter: writes the product record.
  const shared = p ? shownDesc(p, W.desc[p.id]?.desc || '') : '';
  const setShared = (v: string) => p && setP((L) => L.map((x) => (x.id === p.id ? { ...x, desc: v } : x)));
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr] items-start">
      <Card title="Products" sub={`${live.length} on the online store`}><input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className={inp} />{live.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase())).map((x) => <button key={x.id} onClick={() => setSel(x.id)} aria-pressed={sel === x.id} className={cx('text-left p-2.5 rounded-xl text-sm', sel === x.id ? 'bg-brand-50 ring-2 ring-brand' : 'hover:bg-canvas')}><b>{x.name}</b><br /><span className="text-xs text-muted">{x.cat} · {ghs(x.price)}{W.desc[x.id]?.sale ? ' · on sale' : ''}</span></button>)}</Card>
      {p && d ? (
        <Card title={p.name} sub={`${p.cat} · ${ghs(p.price)} · ${d.live ? 'Live on the store' : 'Taken down'}`}>
          <div className="p-3 rounded-2xl bg-canvas flex flex-col gap-2"><span className="text-sm font-semibold">🔻 Reduced price (sale) · normal price {ghs(p.price)}{p.carton ? ` · carton ${ghs(p.carton)}` : ''}</span>
            <div className="grid sm:grid-cols-2 gap-2"><L l="Sale price (GHS)"><input inputMode="decimal" value={d.sale} onChange={(e) => setD({ sale: e.target.value })} placeholder="e.g. 129.00" className={inp} /></L>{p.carton ? <L l="Carton sale price (GHS)"><input inputMode="decimal" value={d.ctSale || ''} onChange={(e) => setD({ ctSale: e.target.value })} placeholder="optional" className={inp} /></L> : <span />}<L l="Sale starts"><input type="date" value={d.saleFrom || ''} onChange={(e) => setD({ saleFrom: e.target.value })} className={inp} /></L><L l="Sale ends"><input type="date" value={d.saleTo || ''} onChange={(e) => setD({ saleTo: e.target.value })} className={inp} /></L></div>
            {parseFloat(d.sale) >= p.price && <span className="text-xs text-danger">The sale price must be lower than {ghs(p.price)}.</span>}
            {parseFloat(d.sale) > 0 && parseFloat(d.sale) < p.price && <span className="text-sm">Preview: <s className="text-muted">{ghs(p.price)}</s> <b className="text-danger">{ghs(parseFloat(d.sale))}</b> · saving {ghs(p.price - parseFloat(d.sale))} ({Math.round((1 - parseFloat(d.sale) / p.price) * 100)}% off){d.saleTo ? ` · until ${d.saleTo}` : ''}</span>}
            <div className="flex gap-2"><button onClick={() => { if (!(parseFloat(d.sale) > 0) || parseFloat(d.sale) >= p.price) return; if (d.saleFrom && d.saleTo && d.saleTo < d.saleFrom) return; done(`Reduced price saved · ${p.name} shows ${ghs(parseFloat(d.sale))} on the store`); }} className="btn-dark min-h-9 text-xs">Save reduced price</button>{d.sale && <button onClick={() => { setD({ sale: '', ctSale: '', saleFrom: '', saleTo: '' }); done(`Sale ended · ${p.name} is back to ${ghs(p.price)}`); }} className="btn-ghost min-h-9 text-xs">End sale</button>}</div>
          </div>
          <div className="p-3 rounded-2xl bg-brand-50 flex flex-col gap-2">
            <span className="text-sm"><b>✨ Description writer</b> · drafts a description, highlights and Google text from the product name, category, price and the details you add. Always read and edit before publishing.</span>
            <L l="Key features or details (comma separated)"><input value={extra.features} onChange={(e) => setExtra({ ...extra, features: e.target.value })} placeholder="e.g. long-grain, aromatic, 5kg resealable bag" className={inp} /></L>
            <div className="grid grid-cols-2 gap-2"><L l="Who is it for (optional)"><input value={extra.audience} onChange={(e) => setExtra({ ...extra, audience: e.target.value })} placeholder="e.g. families, hotels and offices" className={inp} /></L><L l="Search keywords (optional)"><input value={extra.keywords} onChange={(e) => setExtra({ ...extra, keywords: e.target.value })} placeholder="e.g. smart TV Accra" className={inp} /></L></div>
            <div className="flex gap-3 flex-wrap items-center"><span className="text-xs font-semibold">Tone</span><Pills small opts={[['Friendly', 'Friendly'], ['Premium', 'Premium'], ['Simple', 'Simple']]} value={extra.tone} onChange={(v) => setExtra({ ...extra, tone: v })} /><span className="text-xs font-semibold">Length</span><Pills small opts={[['Short', 'Short'], ['Medium', 'Medium'], ['Long', 'Long']]} value={extra.length} onChange={(v) => setExtra({ ...extra, length: v })} /></div>
            {/* Same writer as Products → Add / Edit (lib/describe.ts), so the POS and the website get one description. */}
            <button onClick={() => { const t = writeDescription({ name: p.name, cat: p.cat, price: p.price, ctSize: p.carton ? p.ctSize || 12 : undefined, ctLabel: p.ctLabel, byWeight: p.byWeight, features: [extra.features, extra.keywords].filter(Boolean).join(', '), audience: extra.audience, tone: extra.tone as DescTone }); setShared(extra.length === 'Short' ? t.split('\n## ')[0] : t); const g = seoOf(p.name, t, p.price); setD({ seoTitle: g.title, seoDesc: g.desc }); }} className="btn-dark w-fit">Write it for me</button>
          </div>
          <L l={`Description · shared with Sell Now and Products · ${shared.length} characters`}><textarea rows={10} value={shared} onChange={(e) => setShared(e.target.value)} placeholder="Write the description or press Write it for me. Use ## for a heading and - for a bullet point." className="p-3 rounded-2xl border border-line font-normal text-sm leading-6" /></L>
          <div className="p-4 rounded-2xl border border-line max-h-[320px] overflow-y-auto"><span className="text-xs font-semibold text-muted block mb-2">Preview</span><ProductDesc text={shared} dense /></div>
          <L l="Highlights (one per line)"><textarea rows={4} value={d.bullets} onChange={(e) => setD({ bullets: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
          <div className="grid sm:grid-cols-2 gap-2"><L l={`Google title · ${d.seoTitle.length}/60`}><input value={d.seoTitle} onChange={(e) => setD({ seoTitle: e.target.value })} className={inp} /></L><L l={`Google description · ${d.seoDesc.length}/155`}><input value={d.seoDesc} onChange={(e) => setD({ seoDesc: e.target.value })} className={inp} /></L></div>
          <div className="p-3 rounded-2xl border border-line text-sm"><span className="text-xs text-ok">shop.ebenezerunique.com.gh › {p.cat.toLowerCase()}</span><br /><span className="text-[#1a0dab] text-base">{d.seoTitle}</span><br /><span className="text-muted">{d.seoDesc}</span></div>
          <div className="flex gap-2 flex-wrap"><button onClick={() => { if (parseFloat(d.sale) >= p.price) return; setD({ live: true }); done(`${p.name} published to the online store`); }} className="btn-primary">Publish to online store</button><button onClick={() => done('Draft saved')} className="btn-ghost">Save as draft</button>{d.live && <button onClick={() => { setD({ live: false }); done(`${p.name} taken down`); }} className="btn-ghost text-danger">Take down</button>}</div>
        </Card>
      ) : <Card><span className="text-sm text-muted">Pick a product on the left to write its online description.</span></Card>}
    </div>
  );
}

function Pics({ pics, set, max = 8 }: { pics: string[]; set: (p: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {pics.map((u, i) => <div key={i} className="relative w-24 h-20 rounded-xl overflow-hidden border border-line"><img src={u} alt={`Picture ${i + 1}`} className="w-full h-full object-cover" />{i === 0 && <span className="absolute left-1 top-1 text-[10px] font-bold px-1.5 rounded-full bg-black text-white">Cover</span>}<div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 text-white text-[10px]">{i > 0 ? <button onClick={() => set([u, ...pics.filter((_, j) => j !== i)])} className="px-1.5 py-0.5">Set cover</button> : <span />}<button onClick={() => set(pics.filter((_, j) => j !== i))} className="px-1.5 py-0.5">Remove</button></div></div>)}
        {pics.length < max && <label className="w-24 h-20 rounded-xl border-2 border-dashed border-line flex items-center justify-center text-xs text-muted cursor-pointer text-center">+ Add picture<input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => Array.from(e.target.files || []).slice(0, max - pics.length).forEach((f) => readImg(f, (u) => set([...pics, u].slice(0, max))))} /></label>}
      </div>
      <span className="text-xs text-muted">{pics.length} of {max} pictures · JPG or PNG, up to 5 MB each</span>
    </div>
  );
}

function About({ W, up, done }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void }) {
  const [a, setA] = useState(W.about);
  const ta = 'p-3 rounded-2xl border border-line font-normal text-sm';
  return (
    <Card title="About us">
      <div className="grid sm:grid-cols-2 gap-2"><L l="Page title"><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} className={inp} /></L><L l="Founded"><input value={a.founded} onChange={(e) => setA({ ...a, founded: e.target.value })} placeholder="e.g. 2019" className={inp} /></L></div>
      <L l="Short introduction"><textarea rows={3} value={a.short} onChange={(e) => setA({ ...a, short: e.target.value })} className={ta} /></L>
      <L l="Story heading"><input value={a.storyTitle || ''} onChange={(e) => setA({ ...a, storyTitle: e.target.value })} placeholder="Our story" className={inp} /></L>
      <L l="Our story (blank line starts a new paragraph)"><textarea rows={7} value={a.story} onChange={(e) => setA({ ...a, story: e.target.value })} className={ta} /></L>
      <div className="grid md:grid-cols-3 gap-2"><L l="Our aim"><textarea rows={3} value={a.aim || ''} onChange={(e) => setA({ ...a, aim: e.target.value })} className={ta} /></L><L l="Our vision"><textarea rows={3} value={a.vision || ''} onChange={(e) => setA({ ...a, vision: e.target.value })} className={ta} /></L><L l="Our mission"><textarea rows={3} value={a.mission || ''} onChange={(e) => setA({ ...a, mission: e.target.value })} className={ta} /></L></div>
      <L l="What we stand for (one per line)"><textarea rows={4} value={a.values} onChange={(e) => setA({ ...a, values: e.target.value })} className={ta} /></L>
      <span className="text-[13px] font-semibold">Facts shown as boxes</span>
      <div className="grid grid-cols-3 gap-2">{[0, 2, 4].map((i) => <div key={i} className="flex flex-col gap-1"><input aria-label={`Fact ${i / 2 + 1} label`} value={a.facts[i]} onChange={(e) => { const f = [...a.facts]; f[i] = e.target.value; setA({ ...a, facts: f }); }} className={inp} /><input aria-label={`Fact ${i / 2 + 1} value`} value={a.facts[i + 1]} onChange={(e) => { const f = [...a.facts]; f[i + 1] = e.target.value; setA({ ...a, facts: f }); }} className={inp} /></div>)}</div>
      <span className="text-[13px] font-semibold">Pictures (the cover shows beside your story)</span>
      <Pics pics={a.photos || []} set={(photos) => setA({ ...a, photos })} />
      <button onClick={() => { up({ about: a }); done('About us published'); }} className="btn-primary w-fit">Publish About us</button>
    </Card>
  );
}

function Branches({ W, up, done }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void }) {
  const [b, setB] = useState<string>(BRS[0].id);
  const [f, setF] = useState(W.branches[b]);
  const [P] = usePersist<Product[]>('ecompos.products2', PRODUCTS0);
  const pick = (id: string) => { setB(id); setF(W.branches[id]); };
  const T = (k: keyof typeof f, l: string, ph = '') => <L l={l}><input value={(f[k] as string) || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} className={inp} /></L>;
  const live = P.filter((p) => p.web && p.status === 'live');
  return (
    <Card title={brName(b)} sub="Name, address and phone come from Branches">
      <Pills small opts={BRS.map((x) => [x.id, x.name] as [string, string])} value={b} onChange={pick} />
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Show this branch on the online store</span><Switch on={f.show} onChange={() => setF({ ...f, show: !f.show })} label="Show this branch on the online store" /></div>
      <div className="grid sm:grid-cols-3 gap-2">{T('hours', 'Opening hours')}{T('whatsapp', 'WhatsApp', '+233 24 …')}{T('email', 'Email')}</div>
      {T('services', 'Services')}
      <L l="About this branch"><textarea rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Opposite the Osu Castle road junction, free parking in front." className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
      <div className="grid sm:grid-cols-2 gap-2">{T('manager', 'Branch manager')}{T('landmark', 'Landmark (how to find us)')}{T('parking', 'Parking')}{T('areas', 'Delivery areas')}{T('pays', 'Ways to pay')}{T('map', 'Google Maps link (optional)', 'https://maps.google.com/…')}</div>
      <div className="flex gap-2 items-end flex-wrap">{T('lat', 'Latitude')}{T('lng', 'Longitude')}<button onClick={() => { if (!navigator.geolocation) return done('This device cannot share its location.'); navigator.geolocation.getCurrentPosition((pos) => setF({ ...f, lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }), () => done('Location was not shared. Type the latitude and longitude instead.')); }} className="btn-ghost">📍 Use my current location</button></div>
      <span className="text-[13px] font-semibold">Branch pictures</span>
      <Pics pics={f.photos || []} set={(photos) => setF({ ...f, photos })} />
      {/* Until photos are uploaded the store shows this branch's illustrations (data/web.ts branchArt); either way the
          pictures change by themselves every few seconds, using "Change picture every" from Store settings. */}
      {!(f.photos || []).length && <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">No photos yet, so the store shows these illustrations of the branch, changing every {W.site.heroInterval || 4} s:</span>
        <div className="flex gap-2">{branchArt(b, BRS.findIndex((x) => x.id === b)).map((u) => <img key={u} src={u} alt="" className="w-28 h-16 rounded-lg object-cover border border-line" />)}</div>
      </div>}
      <div className="rounded-2xl bg-canvas p-3 text-xs leading-relaxed flex flex-col gap-0.5">
        <b className="text-[13px]">Recommended photo size</b>
        <span><b>1600 × 1000 px</b> (16:10, landscape) · at least 1200 × 750 px · JPG, ideally under 500 KB. Take the shop front from across the road in daylight, plus one or two of the showroom inside. Keep the shop name and door near the middle: the card trims a little from the edges.</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Products stocked at this branch</span><Pills small opts={[['all', 'All products'], ['none', 'None'], ['pick', 'Pick products']]} value={f.stocked || 'all'} onChange={(v) => setF({ ...f, stocked: v as 'all' | 'none' | 'pick' })} /></div>
      {f.stocked === 'pick' && <div className="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto p-2 rounded-2xl bg-canvas">{live.map((p) => { const on = (f.picked || []).includes(p.id); return <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={on} onChange={() => setF({ ...f, picked: on ? (f.picked || []).filter((x) => x !== p.id) : [...(f.picked || []), p.id] })} className="accent-brand" />{p.name}</label>; })}</div>}
      <button onClick={() => { up({ branches: { ...W.branches, [b]: f } }); done(`${brName(b)} branch page published`); }} className="btn-primary w-fit">Publish branch page</button>
    </Card>
  );
}

function Reviews({ W, up, done, setErr }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void; setErr: (e: string) => void }) {
  const blank: Review = { id: '', name: '', place: '', text: '', product: '', stars: 5, verified: true, hidden: false };
  const [f, setF] = useState<Review>(blank);
  const [show, setShow] = useState<'all' | 'shown' | 'hidden'>('all');
  const [crmFb] = usePersist<{ id: string; reviewId?: string; status: string; kind: string }[]>('ecompos.crm.feedback', []);
  const inCrm = (id: string) => crmFb.find((x) => x.reviewId === id);
  return (
    <div className="grid gap-6 xl:grid-cols-2 items-start">
      <Card title={f.id ? 'Edit review' : 'Add a review'} sub="For reviews customers gave you in person or on WhatsApp.">
        <div className="grid sm:grid-cols-2 gap-2"><L l="Customer name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></L><L l="Town or area"><input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} placeholder="e.g. Osu, Accra" className={inp} /></L></div>
        <L l="What they said"><textarea rows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
        <L l="Product (optional)"><input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} className={inp} /></L>
        <div className="flex items-center gap-2"><span className="text-[13px] font-semibold">Rating</span>{[1, 2, 3, 4, 5].map((s) => <button key={s} aria-label={`${s} stars`} aria-pressed={f.stars === s} onClick={() => setF({ ...f, stars: s })} className={cx('text-xl', s <= f.stars ? 'text-[#f2b705]' : 'text-[#d9d9d9]')}>★</button>)}</div>
        <button aria-pressed={f.verified} onClick={() => setF({ ...f, verified: !f.verified })} className={cx('text-sm px-3.5 py-2 rounded-full border w-fit', f.verified ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{f.verified ? '✓ ' : ''}Verified buyer (bought from us)</button>
        <div className="flex gap-2"><button onClick={() => { if (f.name.trim().length < 2 || f.text.trim().length < 5) return setErr('Add the customer name and what they said.'); const r = { ...f, id: f.id || 'r' + Date.now() }; up({ reviews: f.id ? W.reviews.map((x) => (x.id === f.id ? r : x)) : [r, ...W.reviews] }); done('Review posted'); setF(blank); }} className="btn-primary">{f.id ? 'Save review' : 'Post review'}</button>{f.id && <button onClick={() => setF(blank)} className="btn-ghost">Cancel</button>}</div>
      </Card>
      <Card title="What customers say · reviews" sub="Reviews customers write on the store are posted straight away. Hide bad or unacceptable ones here (you can show them again later) or delete them.">
        <Pills small opts={[['all', `All · ${W.reviews.length}`], ['shown', 'Shown'], ['hidden', `🙈 Hidden · ${W.reviews.filter((r) => r.hidden).length}`]]} value={show} onChange={setShow} />
        {W.reviews.some((r) => r.flagged) && <div className="flex gap-2 flex-wrap items-center p-3 rounded-2xl bg-warn-bg text-sm"><span className="flex-1">⚑ {W.reviews.filter((r) => r.flagged).length} review(s) flagged for rude words, phone numbers or links</span><button onClick={() => { up({ reviews: W.reviews.map((r) => (r.flagged ? { ...r, hidden: true } : r)) }); done('Flagged reviews hidden'); }} className="btn-ghost min-h-9 text-xs">Hide all flagged</button><button onClick={() => { up({ reviews: W.reviews.filter((r) => !r.flagged) }); done('Flagged reviews deleted'); }} className="btn-ghost min-h-9 text-xs text-danger">Delete all flagged</button></div>}
        {W.reviews.filter((r) => show === 'all' || (show === 'hidden') === r.hidden).map((r) => <div key={r.id} className={cx('p-3 rounded-2xl border border-line text-sm flex flex-col gap-1', r.hidden && 'opacity-60')}><div className="flex justify-between gap-2"><span><b>{r.name}</b> <span className="text-xs text-muted">{r.place}{r.product ? ` · ${r.product}` : ''}</span></span><span className="text-[#f2b705]">{'★'.repeat(r.stars)}<span className="text-[#d9d9d9]">{'★'.repeat(5 - r.stars)}</span></span></div><span>“{r.text}”</span><span className="text-xs">{r.verified && <span className="pill bg-green-100 text-green-800 mr-1">Verified buyer</span>}{r.hidden && <span className="pill bg-canvas">Hidden</span>}{r.flagged && <span className="pill bg-amber-100 text-amber-900 ml-1">⚑ Flagged</span>}{inCrm(r.id) && <Link to="/crm/feedback" className="pill bg-[#eef6f6] text-[#0b5c5c] ml-1">In CRM · {inCrm(r.id)!.id} · {inCrm(r.id)!.kind === 'complaint' ? `complaint ${inCrm(r.id)!.status}` : 'rating'}</Link>}</span><div className="flex gap-2"><button onClick={() => setF(r)} className="text-xs font-semibold underline">Edit</button><button onClick={() => up({ reviews: W.reviews.map((x) => (x.id === r.id ? { ...x, hidden: !x.hidden } : x)) })} className="text-xs font-semibold underline">{r.hidden ? 'Show' : 'Hide'}</button><button onClick={() => up({ reviews: W.reviews.filter((x) => x.id !== r.id) })} className="text-xs font-semibold underline text-danger">Delete</button></div></div>)}
      </Card>
    </div>
  );
}

function Pages({ W, up, done, setErr }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void; setErr: (e: string) => void }) {
  const blank = { slug: '', title: '', body: '', editing: '', img: '', inNav: false, inFooter: true, seoTitle: '', seoDesc: '' };
  const [f, setF] = useState(blank);
  // The page editor opens as a window (Create a new page / Edit); lastPub links to the page just published.
  const [open, setOpen] = useState(false);
  const [lastPub, setLastPub] = useState('');
  const [names, setNames] = useState<Record<string, string>>(W.navNames);
  const fq0 = { id: '', cat: 'Orders & delivery', q: '', a: '', on: true };
  const [fq, setFq] = useState<Faq>(fq0);
  const ta = 'p-3 rounded-2xl border border-line font-normal text-sm';
  const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  /** Read an uploaded policy document: Word/text replaces the page text; a PDF is attached to the page. */
  const uploadDoc = async (slug: string, title: string, file: File) => {
    try {
      const r = await readPolicyDoc(file);
      up({ pages: W.pages.map((x) => (x.slug !== slug ? x : r.kind === 'text' ? { ...x, body: r.text, updated: today() } : { ...x, doc: { name: r.name, dataUrl: r.dataUrl }, updated: today() })) });
      // Store content lives in browser storage; a large PDF can exceed it, so check the save really happened.
      if (r.kind === 'pdf') setTimeout(() => { try { if (!(localStorage.getItem('ecompos.web2') || '').includes(r.name)) setErr('That PDF is too large to save on this device. Try a smaller PDF, or upload the Word version instead.'); } catch { /* ignore */ } }, 300);
      done(r.kind === 'text' ? `${title} updated from ${r.name}` : `${r.name} added to ${title}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'That document could not be read.'); }
  };
  const own = W.pages.filter((p) => !p.builtin && !p.policy);
  /** Open the editor on a page (or empty, for a new page). */
  const edit = (pg?: (typeof W.pages)[number]) => { setF(pg ? { ...blank, slug: pg.slug, title: pg.title, body: pg.body, editing: pg.slug, img: pg.img || '', inNav: !!pg.inNav, inFooter: pg.inFooter !== false, seoTitle: pg.seoTitle || '', seoDesc: pg.seoDesc || '' } : blank); setOpen(true); };
  /**
   * Save the page. publish: true makes it live on the online store (menu / footer as chosen); false keeps it as a
   * draft that only staff can see here. Store policies are always live, so for them this just saves the text.
   */
  const save = (publish: boolean) => {
    if (f.title.trim().length < 2) return setErr('Give the page a name (at least 2 letters).');
    if (!f.slug) return setErr('Give the page an address, e.g. wholesale.');
    if (!f.editing && W.pages.some((p) => p.slug === f.slug)) return setErr(`The address /pages/${f.slug} is already used by another page. Choose another.`);
    if (f.body.trim().length < 10) return setErr('Add some content to the page before saving it.');
    const old = W.pages.find((p) => p.slug === f.editing);
    const policy = !!old?.policy;
    const pg = { slug: f.slug, title: f.title.trim(), body: f.body, img: f.img, inNav: f.inNav, inFooter: f.inFooter, seoTitle: f.seoTitle, seoDesc: f.seoDesc, updated: today() };
    const live = policy ? true : publish;
    up({ pages: f.editing ? W.pages.map((p) => (p.slug === f.editing ? { ...p, ...pg, live } : p)) : [...W.pages, { ...pg, live, builtin: false }] });
    done(policy ? `${pg.title} saved` : live ? `${pg.title} is published on the online store` : `${pg.title} saved as a draft (not on the store yet)`);
    setLastPub(live && !policy ? pg.slug : ''); setOpen(false); setF(blank);
  };
  const preview = toBlocks(fillTokens(f.body, tokensOf(W)));
  const moveFaq = (i: number) => { if (i === 0) return; const n = [...W.faqs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; up({ faqs: n }); };
  return (
    <>
      {/* Your own pages: create, publish, unpublish, view and delete pages that appear on the online store. */}
      <Card title="Your pages" sub="Create a page (for example Wholesale orders, Installation services or Warranty), then publish it to show it on the online store, in the top menu, the footer or both.">
        <div className="flex gap-2 flex-wrap items-center"><button onClick={() => edit()} className="btn-primary">＋ Create a new page</button>
          {lastPub && W.pages.some((p) => p.slug === lastPub) && <a href={storeUrl(`pages/${lastPub}`)} onClick={markStaffStore} target="_blank" rel="noopener" className="text-sm font-semibold underline">View “{W.pages.find((p) => p.slug === lastPub)?.title}” on the store →</a>}</div>
        {!own.length && <span className="text-sm text-muted p-4 rounded-2xl bg-canvas">You have not created any pages yet. Press “Create a new page” to add one.</span>}
        {own.length > 0 && <div className="flex flex-col">{own.map((p) => (
          <div key={p.slug} className="flex items-center gap-3 flex-wrap py-3 border-b border-line last:border-0">
            {p.img ? <img src={p.img} alt="" className="w-14 h-10 object-cover rounded-lg flex-none" /> : <span className="w-14 h-10 rounded-lg bg-canvas flex-none flex items-center justify-center text-muted">📄</span>}
            <span className="flex-1 min-w-[200px] text-sm"><b>{p.title}</b> <span className={cx('pill ml-1', p.live ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{p.live ? 'Published' : 'Draft'}</span><br />
              <span className="text-xs text-muted">/pages/{p.slug}{p.live ? `${p.inNav ? ' · in the top menu' : ''}${p.inFooter !== false ? ' · in the footer' : ''}${!p.inNav && p.inFooter === false ? ' · link only (not in a menu)' : ''}` : ' · only staff can see it'}{p.updated ? ` · updated ${p.updated}` : ''}</span></span>
            <button onClick={() => edit(p)} className="text-xs font-semibold underline">Edit</button>
            <button onClick={() => { up({ pages: W.pages.map((x) => (x.slug === p.slug ? { ...x, live: !x.live, updated: today() } : x)) }); done(p.live ? `${p.title} taken off the store (now a draft)` : `${p.title} is published on the online store`); setLastPub(p.live ? '' : p.slug); }} className={cx('text-xs font-semibold px-3 py-1.5 rounded-full', p.live ? 'border border-line' : 'bg-black text-white')}>{p.live ? 'Unpublish' : 'Publish'}</button>
            {p.live && <a href={storeUrl(`pages/${p.slug}`)} onClick={markStaffStore} target="_blank" rel="noopener" className="text-xs font-semibold underline">View on store</a>}
            <button onClick={() => { if (!window.confirm(`Delete the page “${p.title}”? It will be removed from the online store.`)) return; up({ pages: W.pages.filter((x) => x.slug !== p.slug) }); done(`${p.title} deleted`); if (lastPub === p.slug) setLastPub(''); }} className="text-xs font-semibold underline text-danger">Delete</button>
          </div>))}</div>}
      </Card>
      {open && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="pg-h" onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl bg-white rounded-[28px] p-6 flex flex-col gap-4 my-6">
            <div className="flex justify-between items-center gap-2"><h2 id="pg-h" className="m-0 text-lg font-semibold">{f.editing ? `Edit page · ${f.title}` : 'Create a new page'}</h2><button onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas text-xl">×</button></div>
            <div className="grid gap-5 lg:grid-cols-2 items-start">
              <div className="flex flex-col gap-3">
                <L l="Page name"><input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: f.editing ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} placeholder="e.g. Installation services" className={inp} /></L>
                <L l="Page address"><input value={f.slug} disabled={!!f.editing} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="installation-services" className={cx(inp, f.editing && 'opacity-60')} /></L>
                <span className="text-xs text-muted -mt-1">{W.seo.domain || 'your-store'}/pages/{f.slug || '…'}</span>
                <L l="Content"><textarea rows={W.pages.find((x) => x.slug === f.editing)?.policy ? 18 : 12} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={'Write the page here.\n\n## A heading\nA paragraph.\n- A bullet point'} className={ta} /></L>
                <span className="text-xs text-muted">Start a line with <b>## </b> for a heading and <b>- </b> for a bullet point. A blank line starts a new paragraph. These words fill in automatically: {POLICY_TOKENS.map(([k, l]) => `${k} (${l.toLowerCase()})`).join(', ')}.</span>
                <div className="flex items-center gap-3 flex-wrap">{f.img && <img src={f.img} alt="" className="w-20 h-14 object-cover rounded-xl" />}<label className="btn-ghost cursor-pointer">🖼 {f.img ? 'Change image' : 'Add an image'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => readImg(e.target.files?.[0], (u) => setF({ ...f, img: u }))} /></label>{f.img && <button onClick={() => setF({ ...f, img: '' })} className="text-xs underline">Remove image</button>}</div>
                {!W.pages.find((x) => x.slug === f.editing)?.policy && <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Where it shows on the store</span><div className="flex gap-2 flex-wrap"><button aria-pressed={f.inNav} onClick={() => setF({ ...f, inNav: !f.inNav })} className={cx('text-sm px-3.5 py-2 rounded-full border', f.inNav ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{f.inNav ? '✓ ' : ''}Top menu</button><button aria-pressed={f.inFooter} onClick={() => setF({ ...f, inFooter: !f.inFooter })} className={cx('text-sm px-3.5 py-2 rounded-full border', f.inFooter ? 'border-brand bg-brand-50 text-brand font-semibold' : 'border-line')}>{f.inFooter ? '✓ ' : ''}Footer (Help &amp; policies)</button></div></div>}
                <div className="grid sm:grid-cols-2 gap-2"><L l="Google title (optional)"><input value={f.seoTitle} onChange={(e) => setF({ ...f, seoTitle: e.target.value })} placeholder={f.title ? `${f.title} | ${W.site.name || 'Our store'}` : ''} className={inp} /></L><L l="Google description (optional)"><input value={f.seoDesc} onChange={(e) => setF({ ...f, seoDesc: e.target.value })} className={inp} /></L></div>
              </div>
              {/* Live preview: how the page will read on the store (same headings, paragraphs and bullets). */}
              <div className="rounded-3xl border border-line p-5 flex flex-col gap-3 lg:sticky lg:top-4 max-h-[70vh] overflow-y-auto" aria-label="Page preview">
                <span className="text-xs font-semibold text-muted">PREVIEW</span>
                {f.img && <img src={f.img} alt="" className="w-full max-h-48 object-cover rounded-2xl" />}
                <h3 className="m-0 text-2xl font-semibold tracking-tight">{f.title || 'Page name'}</h3>
                {preview.length ? preview.map((b, i) => b.t === 'h' ? <h4 key={i} className="m-0 mt-2 text-base font-semibold">{b.text}</h4> : b.t === 'ul' ? <ul key={i} className="m-0 pl-5 text-sm leading-6">{b.items.map((x) => <li key={x}>{x}</li>)}</ul> : <p key={i} className="m-0 text-sm leading-6 text-sub">{b.text}</p>) : <span className="text-sm text-muted">The content will show here as you type.</span>}
              </div>
            </div>
            <div className="flex gap-2 justify-end flex-wrap">
              <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
              {W.pages.find((x) => x.slug === f.editing)?.policy ? <button onClick={() => save(true)} className="btn-primary">Save changes</button>
                : <><button onClick={() => save(false)} className="btn-ghost">Save as draft</button><button onClick={() => save(true)} className="btn-primary">Publish page</button></>}
            </div>
          </section>
        </div>
      )}
      <Card title="Show or hide store pages" sub="A hidden page disappears from the menu, mobile menu and footer, and its address opens the home page instead. The home page and checkout are always on.">
        <div className="grid gap-2 md:grid-cols-2">{W.pages.filter((p) => p.builtin && p.slug !== 'shop').map((p) => <div key={p.slug} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{p.title}</b><br /><span className="text-xs text-muted">{p.live ? 'Shown' : 'Hidden'}</span></span><Switch on={p.live} onChange={() => up({ pages: W.pages.map((x) => (x.slug === p.slug ? { ...x, live: !x.live } : x)) })} label={p.title} /></div>)}<div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas opacity-70"><span className="text-sm"><b>Home &amp; Checkout</b><br /><span className="text-xs text-muted">Always on</span></span></div></div>
      </Card>
      {/* Store policies: the five legal pages every store must have. Always present (they cannot be deleted); each can
          be edited, reset to the ready-made template, or replaced by an uploaded document shown in the store's style. */}
      <Card title="Store policies" sub="Terms of sale, Privacy, Returns & refunds, Delivery and Cookies are always on your store, linked from the footer and checkout. Start from the ready-made text, edit it for your business, or upload your own document.">
        <span className="text-xs p-3 rounded-2xl bg-canvas">⚖️ These templates are a starting point, not legal advice. Words in braces such as <b>{'{business}'}</b> or <b>{'{phone}'}</b> fill in automatically from Store name, logo &amp; settings. Please have a lawyer review your policies before you launch.</span>
        <div className="flex flex-col">{POLICY_TEMPLATES.map((t) => { const pg = W.pages.find((x) => x.slug === t.slug); if (!pg) return null; const isTemplate = pg.body === t.body; return (
          <div key={t.slug} className="flex items-center gap-2 flex-wrap text-sm py-3 border-b border-line last:border-0">
            <span className="flex-1 min-w-[200px]"><b>{pg.title}</b><br /><span className="text-xs text-muted">Updated {pg.updated || '—'} · {isTemplate ? 'Ready-made text' : 'Your own text'}{pg.doc ? ` · PDF: ${pg.doc.name}` : ''}</span></span>
            <button onClick={() => { setF({ ...blank, slug: pg.slug, title: pg.title, body: pg.body, editing: pg.slug, img: pg.img || '', inNav: !!pg.inNav, inFooter: pg.inFooter !== false, seoTitle: pg.seoTitle || '', seoDesc: pg.seoDesc || '' }); setOpen(true); }} className="text-xs font-semibold underline">Edit text</button>
            <label className="text-xs font-semibold underline cursor-pointer">Upload document<input type="file" accept=".docx,.pdf,.txt,.md" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadDoc(pg.slug, pg.title, file); }} /></label>
            {pg.doc && <button onClick={() => { up({ pages: W.pages.map((x) => (x.slug === pg.slug ? { ...x, doc: undefined, updated: today() } : x)) }); done(`PDF removed from ${pg.title}`); }} className="text-xs font-semibold underline">Remove PDF</button>}
            {!isTemplate && <button onClick={() => { if (!window.confirm(`Replace your ${pg.title} text with the ready-made template? Your current text will be lost.`)) return; up({ pages: W.pages.map((x) => (x.slug === pg.slug ? { ...x, body: t.body, updated: today() } : x)) }); done(`${pg.title} reset to the template`); }} className="text-xs font-semibold underline">Reset to template</button>}
            <a href={storeUrl(`pages/${pg.slug}`)} onClick={markStaffStore} className="text-xs font-semibold underline">View</a>
          </div>); })}</div>
        <span className="text-xs text-muted">Upload a Word (.docx) or text file to replace the page text — headings and bullet points are kept and shown in your store's style. Upload a PDF (under 2 MB) to show it on the page with a download button, alongside the text.</span>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Card title="FAQs" sub={`${W.faqs.filter((x) => x.on).length} shown on the FAQs page`}>
          <div className="grid sm:grid-cols-2 gap-2"><L l="Question"><input value={fq.q} onChange={(e) => setFq({ ...fq, q: e.target.value })} className={inp} /></L><L l="Group"><select value={fq.cat} onChange={(e) => setFq({ ...fq, cat: e.target.value })} className={inp}>{FAQ_GROUPS.map((c) => <option key={c}>{c}</option>)}</select></L></div>
          <L l="Answer"><textarea rows={3} value={fq.a} onChange={(e) => setFq({ ...fq, a: e.target.value })} className={ta} /></L>
          <div className="flex gap-2 flex-wrap"><button onClick={() => { if (fq.q.trim().length < 5 || fq.a.trim().length < 5) return setErr('Add the question and the answer.'); up({ faqs: fq.id ? W.faqs.map((x) => (x.id === fq.id ? fq : x)) : [...W.faqs, { ...fq, id: 'fq' + Date.now() }] }); done('FAQ saved'); setFq(fq0); }} className="btn-primary">{fq.id ? 'Save FAQ' : 'Add FAQ'}</button>{fq.id && <button onClick={() => setFq(fq0)} className="btn-ghost">Cancel</button>}<button onClick={() => { up({ faqs: FAQ0 }); done('Suggested FAQs restored'); }} className="btn-ghost">Restore suggested FAQs</button></div>
          <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">{W.faqs.map((x, i) => <div key={x.id} className={cx('flex items-start gap-2 p-2 rounded-xl border border-line text-sm', !x.on && 'opacity-50')}><span className="flex-1"><b>{x.q}</b><br /><span className="text-xs text-muted">{x.cat}</span></span><button aria-label="Move up" disabled={i === 0} onClick={() => moveFaq(i)} className="text-xs underline disabled:opacity-30">↑</button><button onClick={() => setFq(x)} className="text-xs underline">Edit</button><button onClick={() => up({ faqs: W.faqs.map((y) => (y.id === x.id ? { ...y, on: !y.on } : y)) })} className="text-xs underline">{x.on ? 'Hide' : 'Show'}</button><button onClick={() => up({ faqs: W.faqs.filter((y) => y.id !== x.id) })} className="text-xs underline text-danger">Delete</button></div>)}</div>
        </Card>
        <Card title="Rename the main pages" sub="These names show in the store menu, footer and page headings.">
          <div className="grid sm:grid-cols-2 gap-2">{Object.keys(NAV_NAMES0).map((k) => <L key={k} l={NAV_NAMES0[k]}><input value={names[k] || ''} onChange={(e) => setNames({ ...names, [k]: e.target.value })} placeholder={NAV_NAMES0[k]} className={inp} /></L>)}</div>
          <div className="flex gap-2"><button onClick={() => { up({ navNames: names }); done('Page names published'); }} className="btn-primary">Publish names</button><button onClick={() => setNames({})} className="btn-ghost">Use the standard names</button></div>
        </Card>
      </div>
    </>
  );
}

function Seo({ W, up, done }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void }) {
  const [s, setS] = useState(W.seo);
  const [rd, setRd] = useState(['', '']);
  const checks: [boolean, string][] = [[s.title.length >= 30 && s.title.length <= 60, 'Site title is 30–60 characters'], [s.desc.length >= 120 && s.desc.length <= 160, 'Meta description is 120–160 characters'], [s.robots === 'index', 'Search engines can find the store'], [!!s.ga, 'Google Analytics is connected'], [!!s.keywords, 'Keywords are set']];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <Card title="Search & sharing">
        <L l="Store address (domain)"><input value={s.domain} onChange={(e) => setS({ ...s, domain: e.target.value })} placeholder="shop.yourcompany.com" className={inp} /></L>
        <L l={`Site title · ${s.title.length}/60`}><input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} className={inp} /></L>
        <L l={`Meta description · ${s.desc.length}/160`}><textarea rows={3} value={s.desc} onChange={(e) => setS({ ...s, desc: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
        <L l="Keywords"><input value={s.keywords} onChange={(e) => setS({ ...s, keywords: e.target.value })} className={inp} /></L>
        <div className="p-3 rounded-2xl border border-line text-sm"><span className="text-xs text-ok">{s.domain}</span><br /><span className="text-[#1a0dab] text-base">{s.title}</span><br /><span className="text-muted">{s.desc}</span></div>
        <span className="text-[13px] font-semibold">Advanced</span>
        <L l="Search engines"><select value={s.robots} onChange={(e) => setS({ ...s, robots: e.target.value })} className={inp}><option value="index">Let search engines find the store</option><option value="noindex">Hide the store from search engines</option></select></L>
        <L l="Google Analytics 4 ID"><input value={s.ga} onChange={(e) => setS({ ...s, ga: e.target.value })} placeholder="G-XXXXXXXXXX" className={inp} /></L>
        <span className="text-[13px] font-semibold">Redirects</span>
        {s.redirects.map(([a, b], i) => <div key={i} className="flex items-center gap-2 text-sm"><code>{a}</code> → <code>{b}</code><button onClick={() => setS({ ...s, redirects: s.redirects.filter((_, j) => j !== i) })} className="text-xs underline text-danger">Remove</button></div>)}
        <div className="flex gap-2"><input aria-label="Redirect from" value={rd[0]} onChange={(e) => setRd([e.target.value, rd[1]])} placeholder="/old-page" className={inp} /><input aria-label="Redirect to" value={rd[1]} onChange={(e) => setRd([rd[0], e.target.value])} placeholder="/pages/new-page" className={inp} /><button onClick={() => { if (rd[0].startsWith('/') && rd[1].startsWith('/')) { setS({ ...s, redirects: [...s.redirects, [rd[0], rd[1]]] }); setRd(['', '']); } }} className="btn-ghost">Add redirect</button></div>
        <button onClick={() => { up({ seo: s }); done('SEO settings published'); }} className="btn-primary w-fit">Publish SEO settings</button>
      </Card>
      <Card title={`SEO health ${Math.round((checks.filter((c) => c[0]).length / checks.length) * 100)}%`}>{checks.map(([ok, t]) => <span key={t} className="text-sm">{ok ? '✅' : '⚠️'} {t}</span>)}<span className="text-xs font-semibold">sitemap.xml</span><pre className="text-[11px] p-2 rounded-xl bg-canvas overflow-x-auto">{W.pages.filter((p) => p.live).map((p) => `https://${s.domain}/pages/${p.slug}`).join('\n')}</pre><span className="text-xs font-semibold">robots.txt</span><pre className="text-[11px] p-2 rounded-xl bg-canvas">{s.robots === 'index' ? `User-agent: *\nAllow: /\nSitemap: https://${s.domain}/sitemap.xml` : 'User-agent: *\nDisallow: /'}</pre></Card>
    </div>
  );
}

function Delivery({ W, up, done }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void }) {
  const [z, setZ] = useState(W.zones);
  const [free, setFree] = useState({ on: W.freeOn, over: W.freeOver, collect: W.collect });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <Card title="Delivery areas and charges" sub="Customers pick one of these areas at checkout. The charge is added to their order; turn an area off to stop delivering there.">
        {z.map((a, i) => <div key={i} className="flex gap-2 items-end flex-wrap p-3 rounded-2xl bg-canvas"><L l="Area"><input value={a.name} onChange={(e) => setZ(z.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inp} /></L><L l="Charge (GHS)"><input inputMode="decimal" value={a.fee} onChange={(e) => setZ(z.map((x, j) => (j === i ? { ...x, fee: parseFloat(e.target.value) || 0 } : x)))} className={cx(inp, 'w-24')} /></L><L l="Delivery time"><input value={a.eta} onChange={(e) => setZ(z.map((x, j) => (j === i ? { ...x, eta: e.target.value } : x)))} placeholder="Same day" className={cx(inp, 'w-28')} /></L><button onClick={() => setZ(z.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className={cx('btn min-h-9 text-xs', a.on ? 'bg-ok text-white' : 'btn-ghost')}>{a.on ? 'On' : 'Off'}</button><button aria-label="Move up" disabled={i === 0} onClick={() => { const n = [...z]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setZ(n); }} className="btn-ghost min-h-9 text-xs disabled:opacity-30">↑</button><button onClick={() => setZ(z.filter((_, j) => j !== i))} className="btn-ghost min-h-9 text-xs text-danger">Remove</button></div>)}
        <button onClick={() => setZ([...z, { name: '', fee: 0, eta: 'Same day', on: true }])} className="btn-ghost w-fit">+ Add a delivery area</button>
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Free delivery when the order is big enough</span><Switch on={free.on} onChange={() => setFree({ ...free, on: !free.on })} label="Free delivery" /></div>
        {free.on && <L l="Free on orders over (GHS)"><input inputMode="decimal" value={free.over} onChange={(e) => setFree({ ...free, over: parseFloat(e.target.value) || 0 })} className={cx(inp, 'w-32')} /></L>}
        <L l="Click & collect · collection charge (GHS)"><input inputMode="decimal" value={free.collect} onChange={(e) => setFree({ ...free, collect: parseFloat(e.target.value) || 0 })} placeholder="0 = free" className={cx(inp, 'w-32')} /></L>
        <div className="flex gap-2"><button onClick={() => { up({ zones: z.filter((x) => x.name.trim()), freeOn: free.on, freeOver: free.over, collect: free.collect }); done('Delivery charges published'); }} className="btn-primary">Publish delivery charges</button><button onClick={() => { setZ(W.zones); setFree({ on: W.freeOn, over: W.freeOver, collect: W.collect }); }} className="btn-ghost">Undo changes</button></div>
      </Card>
      <Card title="What shoppers will see"><span className="text-xs font-semibold">Checkout · choose your area</span>{z.filter((a) => a.on && a.name).map((a, i) => <div key={i} className="flex justify-between text-sm p-2 rounded-xl border border-line"><span>{a.name}<br /><span className="text-xs text-muted">{a.eta}</span></span><b>{a.fee ? ghs(a.fee) : 'Free'}</b></div>)}{free.on && <span className="text-xs text-ok">Free delivery on orders over {ghs(free.over)}</span>}<span className="text-xs text-muted">Click & collect: {free.collect ? ghs(free.collect) : 'free'}</span></Card>
    </div>
  );
}

function Site({ W, up, done }: { W: Web; up: (p: Partial<Web>) => void; done: (m: string) => void }) {
  const [s, setS] = useState(W.site);
  const T = (k: keyof typeof s, l: string, ph = '') => <L l={l}><input value={(s[k] as string) || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} placeholder={ph} className={inp} /></L>;
  const pics = s.heroPics || [];
  const badSoc = Object.entries(s.social).filter(([, v]) => v && !/^https:\/\//.test(v)).map(([k]) => k);
  const publish = () => { if (badSoc.length) return done(`Use full https:// addresses for: ${badSoc.join(', ')}`); const log = [`${new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · store settings published`, ...(s.log || [])].slice(0, 6); setS({ ...s, log }); up({ site: { ...s, log } }); done('Store settings published'); };
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <div className="flex flex-col gap-6">
        <Card title="Store name & logo">
          {T('name', 'Online store name', 'Ebenezer Unique Ventures')}
          <span className="text-xs text-muted">Leave blank to use the company name.</span>
          <div className="flex items-center gap-3 flex-wrap"><img src={s.logo || companyLogo()} alt="Store logo" className="w-16 h-16 rounded-xl object-contain border border-line" /><label className="btn-ghost cursor-pointer">🖼 Upload store logo<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 2 * 1024 * 1024) return alert(`${f.name} is bigger than 2 MB.`); removeBackground(f).then((r) => setS({ ...s, logo: r.url })); }} /></label>{s.logo && <button onClick={() => setS({ ...s, logo: '' })} className="text-xs underline">Use the default logo</button>}</div>
        </Card>
        <Card title="Home page">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Big picture at the top</span><Pills small opts={[['slides', 'Sliding pictures'], ['single', 'One picture'], ['video', 'Video'], ['none', 'No picture']]} value={s.heroVideo && s.hero === 'video' ? 'video' : s.hero} onChange={(v) => setS({ ...s, hero: v, heroVideo: v === 'video' ? s.heroVideo : '' })} /></div>
          {s.hero !== 'video' && s.hero !== 'none' && <>
            <Pics pics={pics} set={(heroPics) => setS({ ...s, heroPics })} />
            {/* Recommended picture size: the card is about 1.9 : 1 on computers, 3 : 2 on tablets and 4 : 3 on phones, and
                pictures are enlarged to fill it, so a 16 : 9 landscape picture with the subject in the middle suits all three. */}
            <div className="rounded-2xl bg-canvas p-3 text-xs leading-relaxed flex flex-col gap-0.5">
              <b className="text-[13px]">Recommended picture size</b>
              <span><b>1920 × 1080 px</b> (16:9, landscape) · at least 1600 × 900 px · JPG (or PNG / WebP), ideally under 500 KB so it loads fast (5 MB at most).</span>
              <span>Keep the main subject in the <b>middle</b>: phones and upright tablets show a tall frame, so they may show only the centre half of the picture’s width, and computers trim a little from the top and bottom. Avoid text in the picture; the heading is added by the store.</span>
            </div>
            {/* Built-in illustrations (data/web.ts HERO_ART): shown when no photos are uploaded, or mixed in with them. */}
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">Built-in illustrations · {HERO_ART.length}</span>
              <div className="flex gap-2 flex-wrap">{HERO_ART.map((a) => <img key={a.src} src={a.src} alt={a.name} title={a.name} className="w-28 h-[50px] rounded-lg object-cover border border-line" />)}</div>
              {pics.length
                ? <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted">Also show the built-in illustrations after your {pics.length} picture{pics.length === 1 ? '' : 's'}</span><Switch on={!!s.heroArt} onChange={() => setS({ ...s, heroArt: !s.heroArt })} label="Also show the built-in illustrations" /></div>
                : <span className="text-xs text-muted">You have not uploaded pictures, so the store shows these {HERO_ART.length} illustrations{s.hero === 'single' ? ' (only the first, because “One picture” is chosen)' : ', one after another'}.</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Change picture every</span><Pills small opts={[['3', '3 s'], ['4', '4 s'], ['6', '6 s'], ['8', '8 s']]} value={String(s.heroInterval || 4)} onChange={(v) => setS({ ...s, heroInterval: Number(v) })} /></div>
          </>}
          {s.hero === 'video' && <div className="flex items-center gap-3 flex-wrap"><label className="btn-ghost cursor-pointer">🎬 {s.heroVideo ? 'Change video' : 'Upload video'}<input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 60 * 1024 * 1024) return done('The video must be 60 MB or smaller.'); setS({ ...s, hero: 'video', heroVideo: URL.createObjectURL(f) }); }} /></label><span className="text-xs text-muted">MP4 or WebM, up to 60 MB · plays muted on a loop</span></div>}
          {/* Recommended video size: same shape as the pictures; short and light so it starts quickly on mobile data. */}
          {s.hero === 'video' && <div className="rounded-2xl bg-canvas p-3 text-xs leading-relaxed flex flex-col gap-0.5">
            <b className="text-[13px]">Recommended video size</b>
            <span><b>1920 × 1080 px (1080p)</b> or 1280 × 720 px (720p), 16:9 landscape · MP4 (H.264) or WebM.</span>
            <span><b>10–30 seconds</b>, under <b>20 MB</b> (60 MB at most) so it starts quickly on mobile data. It plays muted on a loop, so no sound is needed. Keep the action in the middle: phones and upright tablets may show only the centre half of the video’s width.</span>
          </div>}
          {T('tagline', 'Tagline (small label above the heading)')}
          {T('heroTitle', 'Heading')}
          <L l="Text under the heading"><textarea rows={3} value={s.heroText || ''} onChange={(e) => setS({ ...s, heroText: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Announcement bar at the top of the store</span><Switch on={!!s.announceOn} onChange={() => setS({ ...s, announceOn: !s.announceOn })} label="Announcement bar" /></div>
          {s.announceOn && T('announce', 'Announcement')}
        </Card>
        <Card title="Contact details">
          <div className="grid sm:grid-cols-2 gap-2">{T('phone', 'Phone')}{T('whatsapp', 'WhatsApp')}{T('email', 'Email')}{T('hours', 'Opening hours')}</div>
          <L l="Contact page introduction"><textarea rows={2} value={s.contactIntro || ''} onChange={(e) => setS({ ...s, contactIntro: e.target.value })} className="p-3 rounded-2xl border border-line font-normal text-sm" /></L>
        </Card>
        <Card title="Social links" sub="Full https:// addresses. These drive the icons in the store footer.">
          <div className="grid sm:grid-cols-2 gap-2">{['tiktok', 'instagram', 'facebook', 'whatsapp', 'youtube', 'x'].map((k) => <L key={k} l={k === 'x' ? 'X' : k === 'tiktok' ? 'TikTok' : k === 'youtube' ? 'YouTube' : k === 'whatsapp' ? 'WhatsApp' : k[0].toUpperCase() + k.slice(1)}><input value={s.social[k] || ''} onChange={(e) => setS({ ...s, social: { ...s.social, [k]: e.target.value.trim() } })} placeholder={k === 'whatsapp' ? 'https://wa.me/233…' : `https://www.${k === 'x' ? 'x' : k}.com/yourshop`} className={cx(inp, s.social[k] && !/^https:\/\//.test(s.social[k]) && 'border-danger')} /></L>)}</div>
          {badSoc.length > 0 && <span className="text-xs text-danger">Start these with https:// · {badSoc.join(', ')}</span>}
          {T('trustpilot', 'Trustpilot review link (optional)', 'https://www.trustpilot.com/review/…')}
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">“Get offers by email” box in the footer</span><Switch on={s.newsOn !== false} onChange={() => setS({ ...s, newsOn: s.newsOn === false })} label="Offers by email" /></div>
          {T('footerLine', 'Footer line (under the store name)')}
        </Card>
        <button onClick={publish} className="btn-primary w-fit">Publish store settings</button>
      </div>
      <div className="flex flex-col gap-6">
        <Card title="Header preview"><div className="rounded-2xl p-3 flex items-center gap-2 text-white" style={{ background: '#1a1240' }}><img src={s.logo || companyLogo()} alt="" className="w-8 h-8 rounded-lg bg-white" /><b className="text-sm truncate">{s.name || 'Ebenezer Unique Ventures'}</b><span className="ml-auto text-xs">Sign in · ♡ · 🛍</span></div>{s.announceOn && <span className="text-xs p-2 rounded-xl bg-[#f2b705]">{s.announce}</span>}</Card>
        <Card title="Recent changes">{(s.log || []).length ? (s.log || []).map((l) => <span key={l} className="text-xs text-muted">{l}</span>) : <span className="text-xs text-muted">Nothing published yet.</span>}</Card>
      </div>
    </div>
  );
}
