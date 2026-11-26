import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { Toast } from '../../components/ui';
import { build, dueOf, EMPTY_HP, RULES, scheduleRows, SEED, type HPAg, type HPState, type HPStatus } from '../../data/hirePurchase';
import { usePersist, nowTxt } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { cx, ghs } from '../../lib/format';
import { AgreementDoc, ReceiptDoc, StatementDoc } from './HPDocs';
import NewAgreement from './NewAgreement';
import Intro, { HP_INTRO, introSeen } from '../../components/Intro';
import { Tabs } from '../../components/ui';

type Tab = 'new' | 'list' | 'rules';
const STATUS_CLS: Record<HPStatus, string> = {
  Active: 'bg-black text-white',
  'In arrears': 'bg-danger text-white',
  Completed: 'bg-ok text-white',
  Defaulted: 'bg-danger text-white',
  Repossession: 'bg-[#6b6866] text-white',
};
const ROW_CLS = { Paid: 'bg-ok text-white', Overdue: 'bg-danger text-white', 'Due next': 'bg-black text-white', Upcoming: 'bg-white text-black border border-line' };
const FILTERS: [string, string][] = [['all', 'All'], ['Active', 'Active'], ['In arrears', 'In arrears'], ['Completed', 'Completed'], ['Defaulted', 'Defaulted']];

export default function HirePurchase() {
  const { viewBranch, session } = useSession();
  const [S, setS] = usePersist<HPState>('ecompos.hpState2', EMPTY_HP);
  const [tab, setTab] = useState<Tab>('list');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState('');
  const [modal, setModal] = useState<'' | 'pay' | 'quote' | 'default'>('');
  const [method, setMethod] = useState('MoMo');
  const [payRef, setPayRef] = useState('');
  const [doc, setDoc] = useState<'' | 'agreement' | 'statement' | { no: number }>('');
  const [toast, setToast] = useState('');
  const [intro, setIntro] = useState(() => !introSeen('hirepurchase', session?.username || 'me'));
  const up = (p: Partial<HPState>) => setS((s) => ({ ...s, ...p }));

  const all = useMemo(() => [...SEED, ...S.created].map((a) => build(a, S)), [S]);
  const inBr = all.filter((x) => viewBranch === 'all' || x.a.branch === viewBranch);
  const shown = inBr.filter((x) => filter === 'all' || x.status === filter || (filter === 'Defaulted' && x.status === 'Repossession'));
  const cur: HPAg | undefined = shown.find((x) => x.a.id === sel) ?? shown[0] ?? inBr[0];

  const live = inBr.filter((x) => !x.done && x.a.state !== 'default');
  const arrears = inBr.filter((x) => x.overdue && x.a.state !== 'default');
  const kpis = [
    { l: 'Active agreements', v: String(live.length), n: `${inBr.filter((x) => x.done).length} completed` },
    { l: 'Still to collect', v: ghs(live.reduce((a, x) => a + x.balance, 0)), n: 'Instalments not yet paid' },
    { l: 'Due next', v: String(live.filter((x) => !x.overdue).length), n: 'Instalments due on the 5th' },
    { l: 'In arrears', v: ghs(arrears.reduce((a, x) => a + x.inst * x.missed + x.fee, 0)), n: `${arrears.length} customers · late fees included`, red: true },
  ];
  const scopeLine = viewBranch === 'all' ? 'all branches' : { osu: 'Osu', legon: 'East Legon', adum: 'Adum' }[viewBranch] + ' branch';

  const recordPay = () => {
    if (!cur) return;
    const no = cur.paid + 1;
    const amt = cur.inst + (cur.overdue ? cur.fee / Math.max(1, cur.missed) : 0);
    const p = { no, amt, method, ref: payRef, at: nowTxt() };
    up({ extraPaid: { ...S.extraPaid, [cur.a.id]: (S.extraPaid[cur.a.id] || 0) + 1 }, pays: { ...S.pays, [cur.a.id]: [...(S.pays[cur.a.id] || []), p] } });
    setModal('');
    setPayRef('');
    setToast(`Thank you, ${cur.a.customer.split(' ')[0]}. Instalment ${no} of ${cur.a.term} received · receipt sent by SMS`);
    setDoc({ no });
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="m-0 text-[30px] font-medium tracking-tightest">Hire purchase</h1>
            <button onClick={() => setIntro(true)} className="text-[13px] px-3 py-1.5 rounded-full border border-brand text-brand inline-flex items-center gap-1.5">ⓘ What is hire purchase?</button>
          </div>
          <p className="m-0 text-sm text-muted">Buy now on credit, pay in instalments · the item belongs to the shop until the last instalment · {scopeLine}</p>
        </div>
        <Tabs label="Hire purchase sections" tabs={([['new', 'New agreement'], ['list', 'Agreements'], ['rules', 'Terms & settings']] as [Tab, string][]).map(([k, l]) => ({ id: k, label: l }))} value={tab} onChange={(k) => setTab(k as Tab)} />
      </header>

      <section aria-label="Key figures" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k) => (
          <div key={k.l} className={cx('rounded-3xl p-[22px] flex flex-col gap-2 shadow-card', k.red ? 'bg-danger text-white' : 'bg-white')}>
            <span className={cx('text-[13px]', k.red ? 'text-white' : 'text-muted')}>{k.l}</span>
            <span className="text-[26px] leading-tight font-medium tracking-tightest">{k.v}</span>
            <span className={cx('text-xs', k.red ? 'text-white' : 'text-sub')}>{k.n}</span>
          </div>
        ))}
      </section>

      {tab === 'list' && (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr] items-start">
          <section className="card p-5 flex flex-col gap-3" aria-labelledby="ag-h">
            <h2 id="ag-h" className="m-0 text-lg font-semibold">Agreements</h2>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(([k, l]) => (
                <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cx('text-[13px] px-3 py-1.5 rounded-full border', filter === k ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>
              ))}
            </div>
            {shown.length === 0 && <span className="text-sm text-muted">No agreements here.</span>}
            {shown.map((x) => {
              const on = cur?.a.id === x.a.id;
              return (
                <button key={x.a.id} aria-pressed={on} onClick={() => { setSel(x.a.id); setModal(''); }} className={cx('text-left rounded-2xl p-3.5 flex flex-col gap-1.5', on ? 'border-[2.5px] border-ok bg-[#f3fbf4]' : 'border border-line bg-white hover:bg-canvas')}>
                  <span className="flex justify-between items-center gap-2"><b className="text-sm">{x.a.customer}</b><span className={cx('pill', STATUS_CLS[x.status])}>{x.status}</span></span>
                  <span className="text-xs text-muted">{x.a.id} · {x.a.item}</span>
                  <span className="h-1.5 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-ok" style={{ width: `${Math.round((x.paid / x.a.term) * 100)}%` }} /></span>
                  <span className="flex justify-between text-xs"><span>{x.paid} of {x.a.term} instalments paid</span><span>{ghs(x.balance)} left</span></span>
                </button>
              );
            })}
          </section>

          {cur && <Detail c={cur} S={S} up={up} openModal={setModal} setDoc={setDoc} setToast={setToast} />}
        </div>
      )}

      {tab === 'new' && <NewAgreement branch={session?.branch && viewBranch === 'all' ? session.branch : viewBranch === 'all' ? 'osu' : viewBranch} onCreate={(a) => { up({ created: [...S.created, a] }); setSel(a.id); setTab('list'); setFilter('all'); setToast(`Agreement ${a.id} created · deposit taken. Next: print the agreement for signing.`); }} />}

      {tab === 'rules' && (
        <div className="grid gap-6 md:grid-cols-2">
          {([['HP charge (flat rate)', RULES.rates], ['Late payment & default', RULES.late], ['Ownership & agreement terms', RULES.own]] as [string, string[]][]).map(([t, l]) => (
            <section key={t} className="card p-6 flex flex-col gap-2"><h2 className="m-0 text-lg font-semibold">{t}</h2>{l.map((x) => <div key={x} className="text-sm px-3 py-2.5 rounded-xl bg-canvas">{x}</div>)}</section>
          ))}
          <section className="card p-6 flex flex-col gap-2">
            <h2 className="m-0 text-lg font-semibold">Automatic reminders</h2>
            {RULES.reminders.map((x) => <label key={x} className="text-sm flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-canvas"><input type="checkbox" defaultChecked className="w-4 h-4 accent-[#0b5c5c]" />{x}</label>)}
          </section>
        </div>
      )}

      {/* Record instalment */}
      {modal === 'pay' && cur && (
        <Modal title={`Record instalment ${cur.paid + 1} · due ${dueOf(cur.a.startY, cur.a.startM, cur.paid + 1)}`} onClose={() => setModal('')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[13px] font-semibold">Amount (GHS)<input readOnly value={(cur.inst + (cur.overdue ? cur.fee / Math.max(1, cur.missed) : 0)).toFixed(2)} className="field bg-canvas" /></label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">Reference<input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="MoMo or bank reference" className="field" /></label>
          </div>
          <div className="flex gap-2 flex-wrap">{['Cash', 'MoMo', 'Bank transfer', 'Card'].map((m) => <button key={m} aria-pressed={method === m} onClick={() => setMethod(m)} className={cx('text-sm px-4 py-2 rounded-full border', method === m ? 'bg-black text-white border-black' : 'border-line')}>{m}</button>)}</div>
          {cur.overdue && cur.fee > 0 && <span className="text-xs text-danger">Includes late fee of {ghs(cur.fee / Math.max(1, cur.missed))} (charged after the 7-day grace period).</span>}
          <div className="flex gap-2 justify-end"><button onClick={() => setModal('')} className="btn-ghost">Cancel</button><button onClick={recordPay} className="btn-primary">Save & print receipt</button></div>
        </Modal>
      )}
      {modal === 'default' && cur && (
        <Modal title={`${cur.a.state === 'default' ? 'Repossess item' : 'Mark as defaulted'}?`} onClose={() => setModal('')}>
          <span className="text-sm text-sub">This goes to the Admin for approval. The customer and guarantor are notified, and any amount already paid is kept on the statement. Repossessed items return to stock as used.</span>
          <div className="flex gap-2 justify-end"><button onClick={() => setModal('')} className="btn-ghost">Cancel</button><button onClick={() => { up({ defSent: { ...S.defSent, [cur.a.id]: true } }); setModal(''); setToast('Sent to the Admin for approval'); }} className="btn bg-danger text-white">Send for approval</button></div>
        </Modal>
      )}

      {intro && <Intro d={HP_INTRO} user={session?.username || 'me'} onBack={() => setIntro(false)} onGo={() => { setIntro(false); setTab('new'); }} />}

      {cur && doc === 'agreement' && <AgreementDoc c={cur} onClose={() => { setDoc(''); up({ hand: { ...S.hand, [cur.a.id]: { ...S.hand[cur.a.id], printed: S.hand[cur.a.id]?.printed || nowTxt() } } }); }} />}
      {cur && doc === 'statement' && <StatementDoc c={cur} pays={S.pays[cur.a.id] || []} onClose={() => setDoc('')} />}
      {cur && typeof doc === 'object' && (
        <ReceiptDoc
          c={cur}
          pay={(() => {
            if (doc.no === 0) return { no: 0, label: 'Deposit on signing', amt: cur.dep, method: cur.a.depMethod || 'Cash', at: dueOf(cur.a.startY, cur.a.startM, 0) };
            const p = (S.pays[cur.a.id] || []).find((x) => x.no === doc.no);
            return { no: doc.no, label: `Instalment ${doc.no} of ${cur.a.term}`, amt: p?.amt ?? cur.inst, method: p?.method ?? 'Cash', ref: p?.ref, at: p?.at ?? scheduleRows(cur)[doc.no - 1]?.paidOn ?? '' };
          })()}
          onClose={() => setDoc('')}
        />
      )}
      <Toast msg={toast} onClose={() => setToast('')} />
    </>
  );
}

function Detail({ c, S, up, openModal, setDoc, setToast }: { c: HPAg; S: HPState; up: (p: Partial<HPState>) => void; openModal: (m: '' | 'pay' | 'quote' | 'default') => void; setDoc: (d: '' | 'agreement' | 'statement' | { no: number }) => void; setToast: (s: string) => void }) {
  const [quote, setQuote] = useState(false);
  const rows = scheduleRows(c);
  const isDefault = c.a.state === 'default';
  const unearned = (c.charge * (c.a.term - c.paid)) / c.a.term;
  const hand = S.hand[c.a.id] || {};
  const figures: [string, string, boolean?][] = [
    ...(c.biz
      ? ([['Goods price', ghs(c.a.goods)], ['VAT 15%', '+ ' + ghs(c.vat)], ['NHIL 2.5% · GETFund 2.5%', '+ ' + ghs(c.lev)], ['Cash price incl. taxes', ghs(c.cash)]] as [string, string][])
      : ([['Cash price · no VAT or levies', ghs(c.cash)]] as [string, string][])),
    ['Deposit paid', `${ghs(c.dep)} (${c.a.depPct}%)`],
    ['HP charge', `${ghs(c.charge)} (${c.rate}%)`],
    ['Total payable', ghs(c.total)],
    ['Instalment', `${ghs(c.inst)} × ${c.a.term}`],
    ['Balance', ghs(c.balance), c.overdue],
  ];
  const pays = [
    { no: 0, label: 'Deposit on signing', sub: `${dueOf(c.a.startY, c.a.startM, 0)} · ${c.a.depMethod || 'Cash'}`, amt: c.dep },
    ...Array.from({ length: c.paid }, (_, i) => {
      const p = (S.pays[c.a.id] || []).find((x) => x.no === i + 1);
      return { no: i + 1, label: `Instalment ${i + 1} of ${c.a.term}`, sub: `${p?.at ?? rows[i]?.paidOn} · ${p?.method ?? 'Cash'}`, amt: p?.amt ?? c.inst };
    }),
  ].reverse();
  const steps: { k: keyof typeof hand | 'items'; label: string; sub: string; done: boolean; btn?: string; act?: () => void }[] = [
    { k: 'items', label: 'All items added to the agreement', sub: c.a.item, done: true },
    { k: 'printed', label: 'Agreement printed with all the items', sub: hand.printed ? `Printed ${hand.printed}` : 'Open the agreement, then Print or Save a copy', done: !!hand.printed, btn: 'Open & print', act: () => setDoc('agreement') },
    { k: 'signed', label: `Signed by hand by ${c.biz ? 'the authorised officer' : 'the customer and the guarantor'}`, sub: hand.signed ? `Confirmed ${hand.signed}` : hand.printed ? 'Ask them to sign every page of the printed copy' : 'Print the agreement first', done: !!hand.signed, btn: 'Confirm signed', act: hand.printed ? () => mark('signed') : undefined },
    { k: 'uploaded', label: 'Signed copy uploaded to Documents', sub: hand.uploaded ? `On file · ${hand.uploaded}` : 'Optional but recommended', done: !!hand.uploaded, btn: 'Upload copy', act: hand.signed ? () => mark('uploaded') : undefined },
    { k: 'handed', label: 'Item handed over to the customer', sub: hand.handed ? `Handed over ${hand.handed}` : 'After the agreement is signed', done: !!hand.handed, btn: 'Confirm handover', act: hand.signed ? () => mark('handed') : undefined },
  ];
  function mark(k: 'signed' | 'uploaded' | 'handed') {
    up({ hand: { ...S.hand, [c.a.id]: { ...hand, [k]: nowTxt() } } });
  }
  const doneN = steps.filter((s) => s.done).length;
  const [signedCopies, setSignedCopies] = usePersist<Record<string, { name: string; url: string; at: string }>>('ecompos.hpSigned', {});
  const copy = signedCopies[c.a.id];
  const [viewCopy, setViewCopy] = useState(false);

  return (
    <section className="card p-5 sm:p-6 flex flex-col gap-4 min-w-0" aria-labelledby="hp-cur">
      <div className="flex justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{c.a.id} · {c.branch} branch · started {dueOf(c.a.startY, c.a.startM, 0)}</span>
          <h2 id="hp-cur" className="m-0 text-[22px] font-semibold">{c.a.customer}</h2>
          <span className="text-[13px] text-sub">{c.a.item} · {c.a.phone} · guarantor {c.a.guarantor}</span>
        </div>
        <span className={cx('pill h-fit text-sm px-3', STATUS_CLS[c.status])}>{c.status}</span>
      </div>
      <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {figures.map(([l, v, red]) => <div key={l} className="rounded-2xl bg-canvas p-3 flex flex-col gap-0.5"><span className="text-xs text-muted">{l}</span><b className={cx('text-[15px]', red && 'text-danger')}>{v}</b></div>)}
      </div>
      {c.overdue && <div className="text-sm rounded-2xl bg-red-50 border border-red-200 text-red-900 px-4 py-3">{c.missed} {c.missed === 1 ? 'instalment' : 'instalments'} overdue by {c.a.overdueDays} days · {ghs(c.inst * c.missed)} plus late fees {ghs(c.fee)}. Guarantor {c.a.guarantor} has been notified.{isDefault ? ' The agreement is in default.' : ''}</div>}
      {c.done && <div className="text-sm rounded-2xl bg-green-50 border border-green-200 text-green-900 px-4 py-3">All instalments paid. Ownership passed to {c.a.customer}. Certificate of completion issued.</div>}

      <div className="flex gap-2 flex-wrap">
        {!c.done && !isDefault && <button onClick={() => openModal('pay')} className="btn-primary"><Icon name="cash" /> Record instalment</button>}
        <button onClick={() => { up({ reminded: { ...S.reminded, [c.a.id]: true } }); setToast(`Reminder sent by SMS to ${c.a.phone}`); }} className="btn-ghost"><Icon name="messages" /> {S.reminded[c.a.id] ? 'Reminder sent by SMS' : 'Send reminder'}</button>
        <button onClick={() => setQuote((q) => !q)} aria-expanded={quote} className="btn-ghost">Early settlement quote</button>
        <button onClick={() => up({ resched: { ...S.resched, [c.a.id]: true } })} className="btn-ghost">{S.resched[c.a.id] ? 'Reschedule sent for approval' : 'Reschedule'}</button>
        <button onClick={() => setDoc('agreement')} className="btn-ghost"><Icon name="printer" /> Print agreement</button>
        <button onClick={() => setDoc('statement')} className="btn-ghost"><Icon name="documents" /> Statement PDF</button>
        {!c.done && (c.overdue || isDefault) && !S.defSent[c.a.id] && <button onClick={() => openModal('default')} className="btn bg-danger text-white">{isDefault ? 'Repossess item' : 'Mark as defaulted'}</button>}
      </div>

      {quote && (
        <div className="rounded-2xl border border-brand bg-brand-50 p-4 flex flex-col gap-1.5 text-sm">
          <strong>Early settlement quote · valid 7 days</strong>
          <div className="flex justify-between"><span>Balance of instalments</span><span>{ghs(c.balance)}</span></div>
          <div className="flex justify-between"><span>Rebate of unearned HP charge (50%)</span><span>− {ghs(unearned * 0.5)}</span></div>
          <div className="flex justify-between font-semibold text-base"><span>Pay today to own the item</span><span>{ghs(Math.max(0, c.balance - unearned * 0.5))}</span></div>
        </div>
      )}

      <section className={cx('rounded-2xl border p-4 flex flex-col gap-2', hand.handed ? 'border-ok bg-[#f3fbf4]' : 'border-[#d9d9d9] bg-[#f6f7f8]')}>
        <div className="flex justify-between flex-wrap gap-2"><h3 className="m-0 text-[15px] font-semibold">Signing & handover checklist · {doneN} of {steps.length} done</h3><span className="text-xs text-muted">{hand.handed ? 'Complete · the customer has the goods' : !hand.printed ? 'Next: print the agreement' : !hand.signed ? 'Next: signatures on the printed copy' : 'Next: hand over the item'}</span></div>
        {steps.map((s, i) => (
          <div key={s.k} className="flex items-center gap-3">
            <span className={cx('w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center flex-none', s.done ? 'bg-ok' : 'bg-[#9e9e9e]')}>{s.done ? '✓' : i + 1}</span>
            <span className="flex-1 flex flex-col"><strong className="text-sm">{s.label}</strong><span className="text-xs text-muted">{s.sub}</span></span>
            {!s.done && s.btn && <button onClick={s.act} disabled={!s.act} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white disabled:bg-[#bdbdbd]">{s.btn}</button>}
          </div>
        ))}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button onClick={() => setDoc('agreement')} className="text-xs font-semibold px-3 py-2 rounded-full bg-black text-white">Print or save as PDF</button>
          <button onClick={() => { setDoc('agreement'); setToast('Agreement opened · choose Save as PDF in the print dialog to save a copy'); }} className="text-xs font-semibold px-3 py-2 rounded-full border border-line bg-white">Save a copy</button>
          <label className="text-xs font-semibold px-3 py-2 rounded-full border border-black bg-white cursor-pointer">Upload the signed copy<input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 8 * 1024 * 1024) return setToast('The file must be 8 MB or smaller.'); const rd = new FileReader(); rd.onload = () => { setSignedCopies({ ...signedCopies, [c.a.id]: { name: f.name, url: String(rd.result), at: nowTxt() } }); up({ hand: { ...S.hand, [c.a.id]: { ...hand, uploaded: nowTxt(), signed: hand.signed || nowTxt() } } }); setToast(`Signed copy of ${c.a.id} uploaded`); }; rd.readAsDataURL(f); e.target.value = ''; }} /></label>
          {copy && <span className="text-xs flex items-center gap-2" style={{ color: '#1f7a2a' }}>✓ Signed copy on file · {copy.name} · {copy.at}<button onClick={() => setViewCopy(true)} className="underline font-semibold">View signed copy</button></span>}
        </div>
        {viewCopy && copy && <div className="fixed inset-0 z-[650] bg-black/70 flex flex-col p-4" onClick={() => setViewCopy(false)}><div className="bg-white rounded-2xl flex-1 flex flex-col overflow-hidden max-w-4xl w-full mx-auto" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center p-3 border-b border-line"><b className="text-sm">Signed copy · {c.a.id} · {copy.name}</b><button onClick={() => setViewCopy(false)} aria-label="Close" className="w-9 h-9 rounded-full text-white" style={{ background: '#c62828' }}>×</button></div>{copy.url.startsWith('data:image') ? <img src={copy.url} alt={`Signed copy of ${c.a.id}`} className="flex-1 object-contain min-h-0" /> : <iframe title={`Signed copy of ${c.a.id}`} src={copy.url} className="flex-1 w-full" />}</div></div>}
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col"><strong className="text-[15px]">Payments & receipts</strong><span className="text-xs text-muted">A receipt for every payment, including the deposit</span></div>
        {pays.map((p) => (
          <div key={p.no} className="flex items-center gap-3 p-3 rounded-2xl border border-line flex-wrap">
            <span className="flex-1 flex flex-col min-w-[180px]"><strong className="text-sm">{p.label}</strong><span className="text-xs text-muted">HPR-{c.a.id.replace('HP-', '')}-{String(p.no).padStart(2, '0')} · {p.sub}</span></span>
            <b className="text-sm">{ghs(p.amt)}</b>
            <button onClick={() => setDoc({ no: p.no })} className="text-xs font-semibold px-3 py-2 rounded-full border border-line">🧾 Receipt</button>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[560px]">
          <caption className="text-left font-semibold text-[15px] pb-2">Instalment schedule</caption>
          <thead><tr>{['No.', 'Due date', 'Amount', 'Paid on', 'Balance after', 'Status'].map((h) => <th key={h} scope="col" className="text-left text-xs font-semibold text-muted uppercase tracking-wide px-3 py-2 border-b border-line">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.no}><td className="px-3 py-2.5 border-b border-line">{r.no}</td><td className="px-3 py-2.5 border-b border-line">{r.due}</td><td className="px-3 py-2.5 border-b border-line">{ghs(r.amount)}</td><td className="px-3 py-2.5 border-b border-line">{r.paidOn}</td><td className="px-3 py-2.5 border-b border-line">{ghs(r.after)}</td><td className="px-3 py-2.5 border-b border-line"><span className={cx('pill', ROW_CLS[r.status])}>{r.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-20 overflow-y-auto">
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg bg-white rounded-4xl p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center gap-3"><strong className="text-lg">{title}</strong><button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-canvas flex items-center justify-center"><Icon name="close" /></button></div>
        {children}
      </section>
    </div>
  );
}
