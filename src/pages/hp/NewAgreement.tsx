import { useMemo, useState, type ReactNode } from 'react';
import Icon from '../../components/Icon';
import { COMPANY, CREATE_CHECKS, HP_CATALOGUE, SEED, TERM_CHECKS, TERMS, type HPRaw } from '../../data/hirePurchase';
import { nowTxt } from '../../lib/persist';
import { cx, ghs } from '../../lib/format';

const BR_IDX = { osu: 0, legon: 1, adum: 2 } as const;
const KNOWN = [...SEED.map((a) => ({ name: a.customer, phone: a.phone, biz: a.buyer === 'biz' })), { name: 'Esi Mensah', phone: '+233 24 555 0192', biz: false }, { name: 'Kojo Badu', phone: '+233 20 811 4410', biz: false }, { name: 'Accra Royal School', phone: '+233 30 222 1100', biz: true }];

type Line = { name: string; price: number; qty: number };

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-line"><span className="text-[13px] font-bold uppercase tracking-wide text-brand">{n} · {title}</span>{children}</div>
  );
}

export default function NewAgreement({ branch, onCreate }: { branch: string; onCreate: (a: HPRaw) => void }) {
  const br = (['osu', 'legon', 'adum'].includes(branch) ? branch : 'osu') as keyof typeof BR_IDX;
  const [buyer, setBuyer] = useState<'ind' | 'biz'>('ind');
  const biz = buyer === 'biz';
  const [tgChk, setTgChk] = useState<Record<number, boolean>>({});
  const [tgAt, setTgAt] = useState('');
  const [tw, setTw] = useState({ name: '', tel: '', gName: '', gTel: '' });
  const [cq, setCq] = useState('');
  const [cust, setCust] = useState<{ name: string; isNew: boolean } | null>(null);
  const [cgOk, setCgOk] = useState(false);
  const [f, setF] = useState({ phone: '', card: '', addr: '', emp: '', gName: '', gPhone: '', gAddr: '', tin: '', bizAddr: '', bizMob: '', respName: '', respNum: '' });
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [depMode, setDepMode] = useState('25');
  const [depPct, setDepPct] = useState(25);
  const [depCash, setDepCash] = useState('');
  const [term, setTerm] = useState('6');
  const [termCustom, setTermCustom] = useState('');
  const [rate, setRate] = useState('');
  const [discMode, setDiscMode] = useState('none');
  const [allowWhy, setAllowWhy] = useState('');
  const [discVal, setDiscVal] = useState('');
  const [freq, setFreq] = useState<'Monthly' | 'Weekly'>('Monthly');
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const d9 = (v: string) => v.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '');
  const twOk = tw.name.trim().length >= 2 && d9(tw.tel).length === 9 && tw.gName.trim().length >= 2 && d9(tw.gTel).length === 9;
  const tgReady = twOk && TERM_CHECKS(biz).every((_, i) => tgChk[i]);
  const acceptTerms = () => {
    const at = nowTxt(); setTgAt(at);
    // Carry the names and numbers forward so nobody types them twice.
    if (biz) { set({ bizMob: d9(tw.tel), respName: tw.gName.trim(), respNum: d9(tw.gTel) }); }
    else { set({ phone: d9(tw.tel), gName: tw.gName.trim(), gPhone: d9(tw.gTel) }); }
    if (!cust) setCq(tw.name.trim());
  };
  const hits = cq.trim() ? KNOWN.filter((c) => c.biz === biz && (c.name + c.phone).toLowerCase().includes(cq.toLowerCase())).slice(0, 6) : [];
  const canAdd = cq.trim().length >= 2 && !KNOWN.some((c) => c.name.toLowerCase() === cq.trim().toLowerCase());
  const res = q.trim() ? HP_CATALOGUE.filter((c) => (c[0] + ' ' + c[2]).toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const stockOf = (name: string) => HP_CATALOGUE.find((c) => c[0] === name)?.[3][BR_IDX[br]] ?? 0;

  // Maths mirrors the prototype's summary panel.
  const goods = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const tax = biz ? goods * 0.2 : 0;
  const disc = discMode === 'pct' ? ((goods + tax) * (parseFloat(discVal) || 0)) / 100 : discMode === 'cash' || discMode === 'allow' ? parseFloat(discVal) || 0 : 0;
  const cash = Math.max(0, goods + tax - disc);
  const termN = term === 'custom' ? Math.min(60, parseInt(termCustom, 10) || 0) : Number(term);
  const dep = depMode === 'cash' ? Math.min(cash, parseFloat(depCash) || 0) : (cash * depPct) / 100;
  const depP = cash ? (dep / cash) * 100 : 0;
  const fin = cash - dep;
  const rateS = rate.trim();
  const rateN = rateS === '' ? 0 : parseFloat(rateS);
  const rateOk = rateS === '' || (!isNaN(rateN) && rateN >= 0 && rateN <= 100);
  const charge = rateOk ? (fin * rateN) / 100 : 0;
  const total = fin + charge;
  const count = freq === 'Weekly' ? Math.round((termN * 52) / 12) : termN;
  const inst = count ? total / count : 0;
  const depOk = depP >= 10 - 1e-9;
  const custName = cust?.name ?? '';
  const ready = CREATE_CHECKS.every((_, i) => checks[i]) && depOk && lines.length > 0 && termN > 0 && rateOk && !!custName && !!tgAt && cgOk;
  const readyLine = !tgAt ? 'Accept the terms first' : !custName || !cgOk ? (biz ? 'Search or add the business' : 'Search or add the customer') : !lines.length ? 'Search and add the items' : !rateOk ? 'Fix the HP charge rate or leave it blank' : !depOk ? 'Raise the deposit to at least 10%' : ready ? (cash > 10000 ? 'Over GHS 10,000.00 · goes to a Manager for approval first' : 'Ready · next: print the agreement for signing') : 'Tick every check to continue';

  const preview = useMemo(() => {
    const now = new Date();
    return Array.from({ length: Math.min(6, count) }, (_, i) => {
      const d = new Date(now);
      if (freq === 'Weekly') d.setDate(d.getDate() + 7 * (i + 1));
      else { d.setMonth(d.getMonth() + i + 1); d.setDate(5); }
      return { no: i + 1, due: d.toLocaleDateString('en-GB'), amt: inst };
    });
  }, [count, freq, inst]);

  const add = (c: (typeof HP_CATALOGUE)[number]) => {
    const left = c[3][BR_IDX[br]];
    setLines((L) => {
      const i = L.findIndex((l) => l.name === c[0]);
      if (i >= 0) return L.map((l, j) => (j === i && l.qty < left ? { ...l, qty: l.qty + 1 } : l));
      return left > 0 ? [...L, { name: c[0], price: c[1], qty: 1 }] : L;
    });
    setQ('');
  };

  const create = () => {
    if (!ready) return;
    const now = new Date();
    const id = `HP-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    onCreate({
      id, customer: custName, phone: biz ? f.bizMob : f.phone, guarantor: biz ? `Respondent · ${f.respName}` : f.gName || 'Guarantor',
      item: lines.map((l) => (l.qty > 1 ? `${l.name} × ${l.qty}` : l.name)).join(', '), goods, depPct: Math.round(depP * 10) / 10, term: termN,
      branch: br, startY: now.getFullYear(), startM: now.getMonth() - 1, paid: 0, overdueDays: 0, state: 'active', buyer, tin: f.tin,
      rate: rateN, disc, items: lines, depMethod: 'Cash',
      gPhone: biz ? f.respNum : f.gPhone, gAddr: f.gAddr, card: f.card, addr: biz ? f.bizAddr : f.addr, emp: f.emp, respNum: f.respNum,
      termsTo: { name: tw.name.trim(), tel: d9(tw.tel), gName: tw.gName.trim(), gTel: d9(tw.gTel), at: tgAt },
    });
  };

  const input = (label: string, value: string, on: (v: string) => void, ph = '') => (
    <label className="flex flex-col gap-1 text-[13px] font-semibold">{label}<input value={value} onChange={(e) => on(e.target.value)} placeholder={ph} className="field font-normal py-2.5" /></label>
  );
  const pills = (opts: [string, string][], v: string, on: (k: string) => void) => (
    <div className="flex gap-1.5 flex-wrap">{opts.map(([k, l]) => <button key={k} type="button" aria-pressed={v === k} onClick={() => on(k)} className={cx('text-[13px] px-3.5 py-2 rounded-full border', v === k ? 'bg-black text-white border-black' : 'border-line bg-white')}>{l}</button>)}</div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <section className="card p-5 sm:p-6 flex flex-col gap-4" aria-labelledby="new-h">
        <h2 id="new-h" className="m-0 text-lg font-semibold">New hire purchase agreement</h2>

        {!tgAt ? (
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-brand-50 border border-brand-100">
            <div className="flex flex-col gap-0.5"><span className="text-xs font-bold uppercase tracking-wide text-brand">Step 0 · before you start</span><strong>Hire purchase terms & conditions</strong><span className="text-[13px] text-sub">Read these to the customer (and guarantor) in a language they understand. Both must understand and accept them before the agreement is filled in.</span></div>
            <ol className="list-decimal pl-5 text-[13px] flex flex-col gap-1">{TERMS(COMPANY.name).map(([h, t]) => <li key={h}><strong>{h}</strong> · {t}</li>)}</ol>
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white border border-line">
              <strong className="text-sm">Terms read to</strong>
              <div className="grid sm:grid-cols-2 gap-3">
                {input(biz ? 'Business name' : 'Customer name', tw.name, (v) => setTw({ ...tw, name: v }), biz ? 'e.g. Accra Royal School' : 'Full name')}
                <label className="flex flex-col gap-1 text-[13px] font-semibold">{biz ? 'Business Tel' : 'Customer Tel'}<span className="flex items-center gap-2"><span className="text-sm font-bold">+233</span><input inputMode="numeric" maxLength={12} value={tw.tel} onChange={(e) => setTw({ ...tw, tel: e.target.value.replace(/[^\d ]/g, '') })} placeholder="24 555 0142" className="field font-normal py-2.5" /></span>{tw.tel && d9(tw.tel).length !== 9 ? <span className="text-xs text-danger font-normal">Enter 9 digits after +233</span> : <span className="text-xs text-muted font-normal">9 digits after +233, without the first 0</span>}</label>
                {input(biz ? 'Authorised officer name' : 'Guarantor name', tw.gName, (v) => setTw({ ...tw, gName: v }), biz ? 'Who signs for the business' : 'Full name')}
                <label className="flex flex-col gap-1 text-[13px] font-semibold">{biz ? 'Authorised officer Tel' : 'Guarantor Tel'}<span className="flex items-center gap-2"><span className="text-sm font-bold">+233</span><input inputMode="numeric" maxLength={12} value={tw.gTel} onChange={(e) => setTw({ ...tw, gTel: e.target.value.replace(/[^\d ]/g, '') })} placeholder="24 555 0142" className="field font-normal py-2.5" /></span>{tw.gTel && d9(tw.gTel).length !== 9 ? <span className="text-xs text-danger font-normal">Enter 9 digits after +233</span> : <span className="text-xs text-muted font-normal">9 digits after +233, without the first 0</span>}</label>
              </div>
            </div>
            {TERM_CHECKS(biz, { name: tw.name, tel: d9(tw.tel), gName: tw.gName, gTel: d9(tw.gTel) }).map((c, i) => <label key={i} className="flex gap-2.5 items-start text-sm"><input type="checkbox" checked={!!tgChk[i]} onChange={() => setTgChk((x) => ({ ...x, [i]: !x[i] }))} className="mt-0.5 w-4 h-4 accent-[#0b5c5c]" />{c}</label>)}
            <div className="flex items-center gap-3 flex-wrap"><button disabled={!tgReady} onClick={acceptTerms} className="btn-primary">Terms accepted · continue to the agreement</button><span className="text-xs text-muted">{tgReady ? 'Ready to continue' : !twOk ? `Add the ${biz ? 'business and authorised officer' : 'customer and guarantor'} name and Tel, then tick all three` : 'Tick all three to continue'}</span></div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 rounded-2xl bg-[#f3fbf4] border border-ok text-sm"><span className="flex flex-col"><strong className="text-ok">✓ Terms read, understood and accepted · {tgAt}</strong><span className="text-xs text-sub">Read to {tw.name.trim()} (Tel +233 {d9(tw.tel)}) and {biz ? 'authorised officer' : 'guarantor'} {tw.gName.trim()} (Tel +233 {d9(tw.gTel)})</span></span><button onClick={() => setTgAt('')} className="text-xs underline">Read terms again</button></div>
        )}

        {tgAt && !cgOk && (
          <div className="flex flex-col gap-3 p-4 rounded-2xl border border-line">
            <div className="flex flex-col gap-0.5"><span className="text-xs font-bold uppercase tracking-wide text-brand">Step 1 · assign the customer</span><strong>Who is this agreement for?</strong><span className="text-[13px] text-sub">Search the customer database by name or phone. If they are not there yet, add them as a new customer.</span></div>
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Customer type</span>{pills([['ind', 'Individual'], ['biz', 'Business']], buyer, (k) => { setBuyer(k as 'ind' | 'biz'); setCust(null); })}<span className="text-xs text-muted">{biz ? 'Business buyers are charged VAT 15% + NHIL & GETFund 2.5% each' : 'Individuals pay no VAT or levies'}</span></div>
            {!cust ? (
              <div className="relative flex flex-col gap-1">
                <label htmlFor="cq" className="text-[13px] font-semibold">{biz ? 'Business name · search or add' : 'Customer name · search or add'}</label>
                <input id="cq" value={cq} onChange={(e) => setCq(e.target.value)} placeholder={biz ? 'Search a business, or type a new one' : 'Search by name or phone, or type a new customer’s name'} className="field" />
                {hits.map((h) => <button key={h.name} onClick={() => { setCust({ name: h.name, isNew: false }); set({ phone: h.phone, bizMob: h.phone }); setCq(''); }} className="text-left px-4 py-2.5 rounded-xl hover:bg-canvas text-sm flex justify-between"><b>{h.name}</b><span className="text-xs text-muted">{h.phone} · Saved customer</span></button>)}
                {canAdd && <button onClick={() => { setCust({ name: cq.trim().replace(/\s+/g, ' '), isNew: true }); setCq(''); }} className="text-left text-sm font-semibold text-brand px-4 py-2">+ Add “{cq.trim()}” as a new {biz ? 'business' : 'customer'}</button>}
              </div>
            ) : (
              <div className="flex justify-between items-center gap-2 px-4 py-3 rounded-2xl bg-canvas"><span><strong>{cust.name}</strong> <span className="text-xs text-muted">· {cust.isNew ? 'New customer · saved to Customers when the agreement is created' : 'Existing customer'}</span></span><button onClick={() => setCust(null)} className="text-xs underline">Change</button></div>
            )}
            <div className="flex items-center gap-3 flex-wrap"><button disabled={!cust} onClick={() => setCgOk(true)} className="btn-dark">{cust ? `Continue with ${cust.name} →` : 'Continue'}</button><span className="text-xs text-muted">{cust ? 'Next: customer details, guarantor and items' : biz ? 'Search or add the business first' : 'Search or add the customer first'}</span></div>
          </div>
        )}

        {tgAt && cgOk && (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 rounded-2xl bg-[#f3fbf4] border border-ok text-sm"><span><strong className="text-ok">✓ Customer assigned: {custName}</strong> <span className="text-muted">· {biz ? 'Business buyer' : cust?.isNew ? 'New customer' : 'Existing customer'}</span></span><button onClick={() => setCgOk(false)} className="text-xs underline">Change customer</button></div>

            <Step n="1" title="Customer & guarantor details">
              {biz ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {input('Business TIN', f.tin, (v) => set({ tin: v }), 'C000XXXXXXX')}
                  {input('Business address or digital address', f.bizAddr, (v) => set({ bizAddr: v }), 'e.g. GA-492-1187')}
                  {input('Business mobile', f.bizMob, (v) => set({ bizMob: v }), '024 000 0000')}
                  {input('Respondent name', f.respName, (v) => set({ respName: v }), 'Who signs for the business')}
                  {input('Respondent number', f.respNum, (v) => set({ respNum: v }), '024 000 0000')}
                  {input('Respondent address', f.gAddr, (v) => set({ gAddr: v }), 'House no., street, area, town · or GhanaPostGPS')}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {input('Customer phone', f.phone, (v) => set({ phone: v }), '024 000 0000')}
                  {input('Ghana Card number', f.card, (v) => set({ card: v }), 'GHA-XXXXXXXXX-X')}
                  {input('Digital address', f.addr, (v) => set({ addr: v }), 'e.g. GA-492-1187')}
                  {input('Employer / monthly income', f.emp, (v) => set({ emp: v }), 'Employer · GHS per month')}
                  {input('Guarantor name', f.gName, (v) => set({ gName: v }), 'Full name')}
                  <label className="flex flex-col gap-1 text-[13px] font-semibold">Guarantor phone
                    <span className="flex items-center gap-2"><span className="text-sm text-muted">+233</span><input maxLength={12} value={f.gPhone} onChange={(e) => set({ gPhone: e.target.value.replace(/[^\d ]/g, '') })} placeholder="24 555 0142" className="field font-normal py-2.5" /></span>
                    {f.gPhone && f.gPhone.replace(/\D/g, '').length !== 9 ? <span className="text-xs text-danger font-normal">Enter 9 digits after +233</span> : <span className="text-xs text-muted font-normal">9 digits after +233, without the first 0</span>}
                  </label>
                  <div className="sm:col-span-2">{input('Guarantor address', f.gAddr, (v) => set({ gAddr: v }), 'House no., street, area, town · or GhanaPostGPS')}</div>
                </div>
              )}
            </Step>

            <Step n="2" title="Items on hire purchase · search everything in stock">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hpq" className="text-[13px] font-semibold">Search products in stock</label>
                <input id="hpq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search products in stock · e.g. freezer, fridge, TV" className="field" />
                {res.map((c) => {
                  const n = c[3][BR_IDX[br]];
                  return (
                    <button key={c[0]} disabled={!n} onClick={() => add(c)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-canvas text-left disabled:opacity-50">
                      <span className="flex-1 flex flex-col"><strong className="text-sm">{c[0]}</strong><span className={cx('text-xs', n ? 'text-ok' : 'text-danger')}>{n ? `${n} in stock` : 'Out of stock'} · {c[2]}</span></span>
                      <strong className="text-sm">{ghs(c[1])}</strong><span className="text-xs font-semibold text-brand">{lines.some((l) => l.name === c[0]) ? 'Add one more' : 'Add'}</span>
                    </button>
                  );
                })}
                {q.trim() && !res.length && <span className="text-xs text-muted">No product in stock matches that search.</span>}
              </div>
              {lines.length > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-2xl bg-canvas">
                  <strong className="text-sm">Hire purchase items · {lines.reduce((a, l) => a + l.qty, 0)}</strong>
                  {lines.map((l) => (
                    <div key={l.name} className="flex items-center gap-2 text-sm">
                      <span className="flex-1"><strong>{l.name}</strong><br /><span className="text-xs text-muted">{ghs(l.price)} each · {stockOf(l.name) - l.qty} left</span></span>
                      <button aria-label="One less" onClick={() => setLines((L) => L.map((x) => (x.name === l.name ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="w-8 h-8 rounded-full border border-line bg-white">−</button>
                      <strong className="w-5 text-center">{l.qty}</strong>
                      <button aria-label="One more" onClick={() => setLines((L) => L.map((x) => (x.name === l.name && x.qty < stockOf(l.name) ? { ...x, qty: x.qty + 1 } : x)))} className="w-8 h-8 rounded-full border border-line bg-white">+</button>
                      <strong className="w-24 text-right">{ghs(l.price * l.qty)}</strong>
                      <button aria-label={`Remove ${l.name}`} onClick={() => setLines((L) => L.filter((x) => x.name !== l.name))} className="w-8 h-8 rounded-full text-danger"><Icon name="close" size={15} /></button>
                    </div>
                  ))}
                  <span className="flex justify-between text-sm border-t border-line pt-2"><span>Cash price of all items</span><b>{ghs(goods)}</b></span>
                </div>
              )}
            </Step>

            <div className="grid sm:grid-cols-2 gap-3">
              <Step n="3" title="Deposit">
                <select value={depMode === 'cash' || depMode === 'pct' ? depMode : String(depPct)} onChange={(e) => { const v = e.target.value; setDepMode(v); if (v !== 'cash' && v !== 'pct') setDepPct(Number(v)); }} className="field py-2.5">
                  {[['10', '10%'], ['20', '20%'], ['25', '25%'], ['30', '30%'], ['50', '50%'], ['pct', 'Custom %'], ['cash', 'Cash amount (GHS)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {depMode === 'pct' && input('Deposit (%)', String(depPct), (v) => setDepPct(Math.min(100, parseFloat(v) || 0)), 'e.g. 15')}
                {depMode === 'cash' && input('Deposit amount (GHS)', depCash, setDepCash, '0.00')}
                <span className={cx('text-xs', depOk ? 'text-muted' : 'text-danger')}>{depOk ? `${ghs(dep)} paid on signing` : 'Minimum deposit is 10% of the cash price'}</span>
              </Step>
              <Step n="4" title="Term">
                <select value={term} onChange={(e) => setTerm(e.target.value)} className="field py-2.5">{[['3', '3 months'], ['6', '6 months'], ['9', '9 months'], ['12', '12 months'], ['18', '18 months'], ['24', '24 months'], ['custom', 'Custom']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                {term === 'custom' && input('Months', termCustom, (v) => setTermCustom(v.replace(/\D/g, '')), 'e.g. 18')}
                <span className="text-xs text-muted">{termN ? `${termN} months · up to 60` : 'Enter the number of months'}</span>
              </Step>
              <Step n="·" title="HP charge · flat rate (%) · optional">
                <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} placeholder="Optional, e.g. 12" className={cx('field py-2.5', !rateOk && 'border-danger')} />
                <span className={cx('text-xs', rateOk ? 'text-muted' : 'text-danger')}>{rateS === '' ? 'Optional · leave blank for no HP charge (interest-free)' : rateOk ? `${rateN}% of the amount financed = ${ghs(charge)}` : 'Enter a percentage between 0 and 100, or leave it blank'}</span>
              </Step>
              <Step n="·" title="Discount">
                <select value={discMode} onChange={(e) => setDiscMode(e.target.value)} className="field py-2.5">{[['none', 'No discount'], ['pct', 'Percentage'], ['cash', 'Cash amount'], ['allow', 'Custom allowance']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                {discMode !== 'none' && input(discMode === 'pct' ? 'Per cent' : discMode === 'allow' ? 'Allowance (GHS)' : 'Cash amount (GHS)', discVal, setDiscVal, discMode === 'pct' ? '5' : '0.00')}
                {discMode === 'allow' && input('Reason for the allowance', allowWhy, setAllowWhy, 'e.g. Trade-in of an old cooker')}
                {disc > 0 && <span className="text-xs text-muted">Cash price after discount {ghs(cash)}</span>}
              </Step>
            </div>
            <Step n="5" title="Pay every">{pills([['Monthly', 'Monthly'], ['Weekly', 'Weekly']], freq, (k) => setFreq(k as 'Monthly' | 'Weekly'))}</Step>
            <Step n="6" title="Checks before creating the agreement">
              <span className="text-xs text-muted">Signing comes after: once the agreement is created, print it with all the items, then the customer and guarantor sign the printed copy by hand.</span>
              {CREATE_CHECKS.map((c, i) => <label key={c} className="flex gap-2.5 items-center text-sm"><input type="checkbox" checked={!!checks[i]} onChange={() => setChecks((x) => ({ ...x, [i]: !x[i] }))} className="w-4 h-4 accent-[#0b5c5c]" />{c}</label>)}
            </Step>
            <div className="flex items-center gap-3 flex-wrap"><button onClick={create} disabled={!ready} className="btn-primary">Create agreement & take deposit</button><span className="text-xs text-muted">{readyLine}</span></div>
          </>
        )}
      </section>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
        <section className="rounded-3xl bg-black text-white p-5 flex flex-col gap-2 text-sm">
          <h2 className="m-0 text-lg font-semibold">Agreement summary</h2>
          {(biz
            ? [['Goods price', ghs(goods)], ['VAT 15%', '+ ' + ghs(goods * 0.15)], ['NHIL 2.5% · GETFund 2.5%', '+ ' + ghs(goods * 0.05)], ['Cash price incl. taxes · business', ghs(goods + tax)]]
            : [['Cash price · individual, no VAT or levies', ghs(goods)]]
          ).map(([l, v]) => <div key={l} className="flex justify-between gap-3 text-[#c9c6c4]"><span>{l}</span><span>{v}</span></div>)}
          {disc > 0 && <div className="flex justify-between text-[#c9c6c4]"><span>Discount</span><span>− {ghs(disc)}</span></div>}
          <div className="flex justify-between text-[#c9c6c4]"><span>Deposit ({Math.round(depP * 10) / 10}%)</span><span>− {ghs(dep)}</span></div>
          <div className="flex justify-between text-[#c9c6c4]"><span>Amount financed</span><span>{ghs(fin)}</span></div>
          <div className="flex justify-between text-[#c9c6c4]"><span>HP charge ({rateN || 0}% flat)</span><span>+ {ghs(charge)}</span></div>
          <div className="flex justify-between font-semibold border-t border-[#3d3a38] pt-2"><span>Total payable on credit</span><span>{ghs(total)}</span></div>
          <div className="flex justify-between font-semibold"><span>{count} {freq.toLowerCase()} instalments of</span><span>{ghs(inst)}</span></div>
          <div className="flex justify-between text-[#c9c6c4]"><span>Total cost incl. deposit</span><span>{ghs(total + dep)}</span></div>
          <span className="text-xs text-[#c9c6c4] pt-1">The customer pays {ghs(charge)} more than the cash price for paying over time.</span>
        </section>
        <section className="card p-5 flex flex-col gap-1.5 text-sm">
          <h3 className="m-0 text-[15px] font-semibold">Schedule preview</h3>
          {preview.length === 0 && <span className="text-xs text-muted">Add items to see the schedule.</span>}
          {preview.map((p) => <div key={p.no} className="flex justify-between"><span>{p.no} · {p.due}</span><span>{ghs(p.amt)}</span></div>)}
          {count > 6 && <span className="text-xs text-muted">… and {count - 6} more</span>}
        </section>
      </aside>
    </div>
  );
}
