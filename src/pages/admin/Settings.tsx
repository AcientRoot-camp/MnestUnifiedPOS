import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRANCHES } from '../../data/nav';
import { COMPANY } from '../../data/hirePurchase';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx } from '../../lib/format';
import { COMPANY_ICON, COMPANY_LOGO } from '../../lib/brand';
import { isHosted, removeBackground } from '../../lib/bgRemove';
import { Card, Pills } from '../finance/shared';
import { Msg, Switch } from '../money/ui';

type Tab = 'company' | 'business' | 'branches' | 'store' | 'plan' | 'legal';
const OB: [string, string, string][] = [['logo', 'Add your logo', '/settings'], ['products', 'Add your products', '/products'], ['staff', 'Create staff accounts', '/users'], ['pay', 'Connect MoMo and card payments', '/payments'], ['evat', 'Connect GRA E-VAT', '/tax'], ['store', 'Publish the online store', '/web/site']];

export default function Settings() {
  const { session, stepUp: S } = useSession();
  const SU = (session?.role ?? 'superuser') === 'superuser';
  const [tab0, setTab] = useState<Tab>(SU ? 'company' : 'business');
  const tab: Tab = SU || ['business', 'branches', 'store'].includes(tab0) ? tab0 : 'business';
  const [logo, setLogo] = usePersist<string>('ecompos.logo', '');
  const [biz, setBiz] = usePersist('ecompos.bizInfo2', { name: COMPANY.name, tin: 'C0012345678', reg: 'CS123456789', addr: '12 Oxford Street, Osu', city: 'Accra, Greater Accra', gps: 'GA-123-4567', phone: '+233 30 000 1111', mobile: '+233 24 400 0111', email: COMPANY.email, web: COMPANY.web, vat: 'V0012345678', currency: 'GHS', tz: 'Africa/Accra', footer: 'Thank you for shopping with us. Goods can be returned within 7 days with this receipt.', logo: true });
  const [draft, setDraft] = useState(biz);
  const [ob, setOb] = usePersist<Record<string, boolean>>('ecompos.onboarding2', { logo: true, products: true, staff: true, pay: true });
  const [legal, setLegal] = usePersist('ecompos.legal2', { cookies: true, marketing: true, retention: '7 years', dpo: 'Ebenezer Mensah' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // New logo: background removed (AI when hosted, on this device otherwise) so it blends into every screen and document.
  const upLogo = async (f?: File) => {
    if (!f) return;
    if (!/png|jpe?g|svg|webp/.test(f.type)) return setMsg('415 Unsupported Media Type · Use PNG, JPG, SVG or WebP.');
    if (f.size > 2 * 1024 * 1024) return setMsg('413 Content Too Large · The logo must be 2 MB or smaller.');
    setBusy(true);
    const r = await removeBackground(f);
    setBusy(false);
    setLogo(r.url); setOb({ ...ob, logo: true });
    setMsg(`Logo updated on Sell Now, receipts, invoices, reports and the store · ${r.note}`);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(biz);
  const done = OB.filter(([k]) => ob[k]).length;
  return (
    <>
      <header className="flex flex-col gap-1"><h1 className="m-0 text-[30px] font-medium tracking-tightest">Settings</h1><p className="m-0 text-sm text-muted">Company, business details, branches, online store, plan and privacy.</p></header>
      <Pills opts={([['company', 'Manage company'], ['business', 'Business'], ['branches', 'Branches'], ['store', 'Online store'], ['plan', 'Plan & billing'], ['legal', 'Privacy & legal']] as [Tab, string][]).filter(([k]) => SU || ['business', 'branches', 'store'].includes(k))} value={tab} onChange={setTab} />
      {!SU && <span className="text-sm text-muted">Managers can see the business details. Only the Admin can change them, the logo and the plan.</span>}
      <Msg text={msg} onClose={() => setMsg('')} />
      {tab === 'company' && (
        <>
          <Card title={`Getting started · ${done} of 6 done`}><div className="h-2 rounded-full bg-canvas"><div className="h-full rounded-full bg-brand" style={{ width: `${(done / 6) * 100}%` }} /></div>{OB.map(([k, l, to]) => <div key={k} className="flex items-center gap-3 text-sm"><input type="checkbox" aria-label={l} checked={!!ob[k]} onChange={() => setOb({ ...ob, [k]: !ob[k] })} className="w-4 h-4 accent-[#0b5c5c]" /><span className={cx('flex-1', ob[k] && 'line-through text-muted')}>{l}</span>{!ob[k] && <Link to={to} className="text-xs font-semibold text-brand">Do it →</Link>}</div>)}</Card>
          <Card title="Manage company"><div className="flex items-center gap-4"><img src={logo || COMPANY_LOGO} alt="Company logo" className="w-20 h-20 object-contain" /><div className="flex flex-col gap-1 text-sm"><b>{biz.name}</b><span className="text-muted">{BRANCHES.length} branches · {biz.currency} · {biz.tz}</span><div className="flex gap-2"><label className={cx('btn-ghost min-h-9 text-xs cursor-pointer', busy && 'opacity-50 pointer-events-none')}>{busy ? 'Removing background…' : 'Change logo'}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => { upLogo(e.target.files?.[0]); e.target.value = ''; }} /></label>{logo && <button onClick={() => { setLogo(''); setMsg('Uploaded logo removed · the standard company logo shows again'); }} className="btn-ghost min-h-9 text-xs">Use the standard logo</button>}</div></div></div><span className="text-xs text-muted">Only MNest UnifiedPOS Support can change the registered business name or close the company.</span></Card>
        </>
      )}
      {tab === 'business' && (
        <Card title="Business details" sub="Printed on receipts, invoices, agreements and reports">
          <div className="grid sm:grid-cols-2 gap-2">{([['name', 'Business name · only MNest UnifiedPOS Support can change it'], ['tin', 'TIN'], ['vat', 'VAT registration number'], ['reg', 'Business registration number'], ['addr', 'Address'], ['city', 'Town and region'], ['gps', 'Digital address (GhanaPostGPS)'], ['phone', 'Phone'], ['mobile', 'Mobile'], ['email', 'Email'], ['web', 'Website']] as const).map(([k, l]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l}<input value={String((draft as Record<string, unknown>)[k] ?? '')} readOnly={k === 'name' || !SU} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={cx('field py-2 font-normal', (k === 'name' || !SU) && 'bg-canvas')} /></label>)}</div>
          <label className="text-xs font-semibold flex flex-col gap-1">Receipt footer<textarea rows={2} value={draft.footer} readOnly={!SU} onChange={(e) => setDraft({ ...draft, footer: e.target.value })} className={cx("p-3 rounded-2xl border border-line font-normal text-sm", !SU && "bg-canvas")} /></label>
          <div className="flex items-center gap-3 flex-wrap"><span className="flex gap-1.5" aria-label="Logo on light and dark backgrounds">{['bg-white border border-line', 'bg-black', 'bg-brand'].map((b) => <span key={b} className={cx('w-14 h-14 rounded-xl p-1 flex items-center justify-center', b)}><img src={logo || COMPANY_LOGO} alt="" className="max-w-full max-h-full object-contain" /></span>)}</span>{SU ? <label className={cx('btn-ghost min-h-9 text-xs cursor-pointer', busy && 'opacity-50 pointer-events-none')}>{busy ? 'Removing background…' : 'Change logo'}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => { upLogo(e.target.files?.[0]); e.target.value = ''; }} /></label> : <span className="text-xs text-muted">Logo · Admin only</span>}<span className="text-xs text-muted basis-full">The background is removed automatically so the logo blends into every screen{isHosted() ? ' (AI service)' : ' (on this device until the system is hosted)'}.</span></div>
          {SU && <div className="flex gap-2"><button disabled={!dirty} onClick={() => S(`Save the business details`, () => { setBiz(draft); setMsg('Business details saved · printed on reports and invoices from now'); })} className="btn-primary">Save business details</button>{dirty && <button onClick={() => setDraft(biz)} className="btn-ghost">Discard changes</button>}</div>}
        </Card>
      )}
      {tab === 'business' && (
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          <Card title="Sell Now header"><div className="rounded-2xl bg-black text-white p-3 flex items-center gap-2"><img src={logo || COMPANY_ICON} alt="" className="w-9 h-9 object-contain bg-white rounded-lg p-0.5" /><span className="flex flex-col leading-tight"><b className="text-sm">{draft.name}</b><span className="text-[11px] text-white/70">Sell Now · Osu · Till 1</span></span></div></Card>
          <Card title="Online store header"><div className="rounded-2xl p-3 flex items-center gap-2 text-white" style={{ background: '#1a1240' }}><img src={logo || COMPANY_LOGO} alt="" className="w-9 h-9 object-contain bg-white rounded-lg p-0.5" /><b className="text-sm truncate">{draft.name}</b><span className="ml-auto text-[11px]">Sign in · ♡ · 🛍</span></div><span className="text-xs text-muted">{draft.web}</span></Card>
          <Card title="Receipt"><div className="rounded-xl border border-line p-3 font-mono text-[11px] leading-4 text-center flex flex-col"><b>{draft.name}</b><span>{draft.addr}, {draft.city}</span><span>{draft.gps} · {draft.phone}</span><span>TIN {draft.tin} · VAT {draft.vat || "—"}</span><span className="border-t border-dashed border-black/30 mt-1 pt-1">{draft.footer}</span></div></Card>
        </div>
      )}
      {tab === 'branches' && <Card title="Branches">{BRANCHES.map((b) => <div key={b.id} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-canvas"><span><b>{b.name}</b><br /><span className="text-xs text-muted">{b.city} · Manager {b.manager}</span></span><Link to={`/branches/${b.id}`} className="text-xs font-semibold text-brand">Open →</Link></div>)}</Card>}
      {tab === 'store' && <Card title="Online store"><span className="text-sm">shop.ebenezerunique.com.gh · live</span><div className="flex gap-2 flex-wrap"><Link to="/shop" className="btn-ghost">View online store</Link><Link to="/web/site" className="btn-primary">Store name, logo & settings</Link><Link to="/web/delivery" className="btn-ghost">Delivery charges</Link></div></Card>}
      {tab === 'plan' && <Card title="Plan & billing"><div className="grid sm:grid-cols-3 gap-2">{[['Plan', 'Business · 3 branches'], ['Renews', '1 Jan 2027'], ['Paid by', 'MoMo · 0244 ••• 111']].map(([k, v]) => <div key={k} className="p-3 rounded-2xl bg-canvas text-sm"><span className="text-xs text-muted">{k}</span><br /><b>{v}</b></div>)}</div><span className="text-xs text-muted">Billing is handled by MNest UnifiedPOS Support. Adding a branch changes the plan under the purchase agreement.</span></Card>}
      {tab === 'legal' && <Card title="Privacy & legal" sub="Ghana Data Protection Act, 2012 (Act 843)">{([['cookies', 'Ask website visitors before using cookies'], ['marketing', 'Only message customers who agreed to offers']] as const).map(([k, l]) => <div key={k} className="flex justify-between items-center gap-3 text-sm"><span>{l}</span><Switch on={legal[k]} onChange={() => setLegal({ ...legal, [k]: !legal[k] })} label={l} /></div>)}<div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold">Keep sales records for</span><Pills small opts={[['6 years', '6 years'], ['7 years', '7 years'], ['10 years', '10 years']]} value={legal.retention} onChange={(v) => setLegal({ ...legal, retention: v })} /></div><label className="text-xs font-semibold flex flex-col gap-1">Data protection contact<input value={legal.dpo} onChange={(e) => setLegal({ ...legal, dpo: e.target.value })} className="field py-2 font-normal w-64" /></label></Card>}
    </>
  );
}
