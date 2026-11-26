import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Fit, bizInfo } from '../pos/Docs';
import { companyBiz, downloadPdf, hpReceiptDoc } from '../../lib/docPdfs';
import { companyLogo } from '../../lib/brand';
import Icon from '../../components/Icon';
import { COMPANY, dueOf, scheduleRows, type HPAg, type HPPayment } from '../../data/hirePurchase';
import { ghs } from '../../lib/format';
import { cx } from '../../lib/format';
import CompanyLogo from '../../components/CompanyLogo';

const PAPER = { A4: ['A4', '820px'], Letter: ['letter', '816px'], A5: ['A5 landscape', '794px'] } as const;
/* ---------- Real A4 / Letter pages ----------
   Every block is measured at the true page width, then each sheet is filled before the next one starts.
   Headings stay with the block after them, and a table that runs over repeats its header as "(continued)". */
export const SHEETS = { A4: { w: 794, h: 1123, css: 'A4 portrait', label: 'A4' }, Letter: { w: 816, h: 1056, css: 'letter portrait', label: 'Letter' } } as const;
export type Sheet = keyof typeof SHEETS;
export type Block = { key: string; node: ReactNode; keepNext?: boolean; group?: string; groupHead?: ReactNode };
const PAD = 48, FOOT = 46, RUN = 34;
function PagedDoc({ blocks, sheet, foot, runTitle }: { blocks: Block[]; sheet: Sheet; foot: string; runTitle: string }) {
  const S = SHEETS[sheet];
  const meas = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<{ items: (number | string)[] }[]>([]);
  const heads = Array.from(new Map(blocks.filter((b) => b.group && b.groupHead).map((b) => [b.group!, b.groupHead])).entries());
  useLayoutEffect(() => {
    const plan = () => {
      const el = meas.current; if (!el) return;
      const hOf = (k: string) => (el.querySelector(`[data-m="${k}"]`) as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
      const hb = blocks.map((_, i) => hOf(String(i)));
      const hh: Record<string, number> = Object.fromEntries(heads.map(([g]) => [g, hOf('h-' + g)]));
      const usable = (first: boolean) => S.h - PAD * 2 - FOOT - (first ? 0 : RUN);
      const out: { items: (number | string)[] }[] = []; let cur: (number | string)[] = []; let left = usable(true);
      const newPage = () => { out.push({ items: cur }); cur = []; left = usable(false); };
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        // keep a heading (and any chain of headings) with the first real block after it
        let need = hb[i]; let j = i;
        while (blocks[j]?.keepNext && j + 1 < blocks.length) { j++; need += hb[j]; }
        if (need > left && cur.length) newPage();
        // a row continuing a table on a fresh page gets the table header again
        if (b.group && cur.length === 0 && out.length && blocks[i - 1]?.group === b.group && hh[b.group]) { cur.push('h-' + b.group); left -= hh[b.group]; }
        cur.push(i); left -= hb[i];
      }
      if (cur.length) out.push({ items: cur });
      setPages(out);
    };
    plan();
    document.fonts?.ready.then(plan).catch(() => undefined);
  }, [blocks, sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = (items: (number | string)[], n: number, of: number) => (
    <article key={n} className="hp-sheet bg-white text-black flex flex-col relative overflow-hidden" style={{ width: S.w, height: S.h, padding: PAD, fontSize: 12.5, lineHeight: 1.55, breakAfter: n < of - 1 ? 'page' : 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
      {n > 0 && <div className="flex justify-between text-[11px] text-muted border-b border-line pb-1.5 mb-3" style={{ height: RUN - 12 }}><span>{runTitle} · No. {foot.split(' · ')[0]}</span><span>(continued)</span></div>}
      <div className="flex-1 min-h-0">{items.map((k) => typeof k === 'string' ? <div key={k}>{heads.find(([g]) => 'h-' + g === k)?.[1]}</div> : <div key={blocks[k].key} style={{ display: 'flow-root' }}>{blocks[k].node}</div>)}</div>
      <footer className="flex justify-between gap-3 text-[11px] text-muted border-t border-line pt-2" style={{ height: FOOT - 8 }}><span>{foot}</span><span>Hirer's initials ________ Owner's initials ________</span><span>Page {n + 1} of {of}</span></footer>
    </article>
  );
  return (
    <>
      <div ref={meas} aria-hidden className="absolute -left-[99999px] top-0 invisible" style={{ width: S.w - PAD * 2, fontSize: 12.5, lineHeight: 1.55 }}>
        {blocks.map((b, i) => <div key={b.key} data-m={String(i)} style={{ display: 'flow-root' }}>{b.node}</div>)}
        {heads.map(([g, h]) => <div key={g} data-m={'h-' + g} style={{ display: 'flow-root' }}>{h}</div>)}
      </div>
      <style>{`@media print{@page{size:${S.css};margin:0}.hp-sheets{transform:none!important}.hp-sheet{box-shadow:none!important}}`}</style>
      <div className="print-doc mx-auto rounded-2xl p-3 sm:p-5" style={{ maxWidth: S.w + 40, background: '#e4e6e9' }}>
        <Fit width={S.w}><div className="hp-sheets flex flex-col gap-5">{pages.map((p, i) => page(p.items, i, pages.length))}</div></Fit>
      </div>
    </>
  );
}

function DocShell({ title, onClose, children, pages, foot, extra, blocks, runTitle }: { title: string; onClose: () => void; children?: ReactNode; pages?: ReactNode[]; foot?: string; extra?: ReactNode; blocks?: Block[]; runTitle?: string }) {
  const [paper, setPaper] = useState<keyof typeof PAPER>('A4');
  const [sheet, setSheet] = useState<Sheet>('A4');
  return (
    <div className="fixed inset-0 z-[600] bg-black/60 overflow-y-auto p-4 sm:p-8">
      <div className="no-print max-w-[820px] mx-auto mb-3 flex items-center gap-2 flex-wrap">
        <strong className="text-white text-sm flex-1">{title}</strong>
        {blocks ? <span className="flex gap-1 p-1 rounded-full bg-white/15" role="group" aria-label="Paper">{(Object.keys(SHEETS) as Sheet[]).map((k) => <button key={k} onClick={() => setSheet(k)} aria-pressed={sheet === k} className={`text-xs px-3 py-1.5 rounded-full ${sheet === k ? 'bg-white text-black font-semibold' : 'text-white'}`}>{SHEETS[k].label}</button>)}</span> : <>
        <span className="flex gap-1 p-1 rounded-full bg-white/15">{(Object.keys(PAPER) as (keyof typeof PAPER)[]).map((k) => <button key={k} onClick={() => setPaper(k)} aria-pressed={paper === k} className={`text-xs px-3 py-1.5 rounded-full ${paper === k ? 'bg-white text-black font-semibold' : 'text-white'}`}>{k === 'A5' ? 'A5 landscape' : k}</button>)}</span>
        </>}
        {extra}
        <button onClick={() => window.print()} className="btn bg-white text-black"><Icon name="printer" /> Print or save as PDF</button>
        <button onClick={onClose} className="btn bg-white/15 text-white">Close</button>
      </div>
      {!blocks && <style>{`@media print{@page{size:${PAPER[paper][0]};margin:10mm}}`}</style>}
      {blocks ? <PagedDoc blocks={blocks} sheet={sheet} foot={foot || ''} runTitle={runTitle || title} /> : pages ? <div className="print-doc mx-auto rounded-2xl p-3 sm:p-5 flex flex-col gap-5" style={{ maxWidth: `calc(${PAPER[paper][1]} + 40px)`, background: '#e4e6e9' }}>
        {pages.map((pg, i) => <article key={i} className="bg-white shadow-card p-8 sm:p-12 leading-relaxed text-black flex flex-col" style={{ fontSize: paper === 'A5' ? 11.5 : 13, breakAfter: i < pages.length - 1 ? 'page' : 'auto', minHeight: paper === 'A5' ? 560 : 1060 }}>
          <div className="flex-1">{pg}</div>
          <footer className="mt-8 pt-2 border-t border-line flex justify-between gap-3 flex-wrap text-[11px] text-muted"><span>{foot}</span><span>Hirer's initials ________ Owner's initials ________</span><span>Page {i + 1} of {pages.length}</span></footer>
        </article>)}
      </div> : <article className="print-doc mx-auto bg-white rounded-2xl shadow-card p-8 sm:p-12 leading-relaxed text-black" style={{ maxWidth: PAPER[paper][1], fontSize: paper === 'A5' ? 11.5 : 13 }}>{children}</article>}
    </div>
  );
}

function Letterhead({ kicker, title, no, date, bleed }: { kicker: string; title: string; no: string; date: string; bleed?: number }) {
  return (
    <div className={cx('flex justify-between gap-6 p-6 mb-6 flex-wrap text-white', !bleed && '-mx-8 -mt-8 sm:-mx-12 sm:-mt-12')} style={{ background: 'linear-gradient(110deg,#000 70%,#0b5c5c 70%)', ...(bleed ? { margin: `-${bleed}px -${bleed}px 24px` } : {}) }}>
      <div className="flex gap-3">
        <CompanyLogo className="w-16 h-16" alt={`${COMPANY.name} logo`} />
        <div className="flex flex-col text-xs text-white/80">
          <strong className="text-base text-white">{COMPANY.name}</strong>
          <span>Tel: {COMPANY.tel}</span>
          <span>Email: {COMPANY.email}</span>
          <span>Website: {COMPANY.web}</span>
          <span>{COMPANY.addr}</span>
        </div>
      </div>
      <div className="flex flex-col text-right text-xs">
        <span className="uppercase tracking-[0.14em] text-white/75 font-semibold">{kicker}</span>
        <strong className="text-lg text-white">{title}</strong>
        <span>No. <b>{no}</b></span>
        <span>{date}</span>
      </div>
    </div>
  );
}

function KV({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="flex-1 min-w-[200px] rounded-xl border border-line p-3">
      <span className="text-[11px] uppercase tracking-wider text-muted">{title}</span>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-0.5"><span className="text-muted">{k}</span><strong className="text-right">{v}</strong></div>
      ))}
    </div>
  );
}

function ItemsTable({ c }: { c: HPAg }) {
  const items = c.a.items?.length ? c.a.items : [{ name: c.a.item, price: c.a.goods, qty: 1 }];
  return (
    <>
      <table className="w-full border-collapse my-3">
        <caption className="sr-only">Items on hire purchase</caption>
        <thead><tr className="bg-canvas">{['#', 'Item description', 'Qty', 'Unit price', 'Amount'].map((h) => <th key={h} scope="col" className="text-left p-2 border border-line">{h}</th>)}</tr></thead>
        <tbody>
          {items.map((i, n) => (
            <tr key={i.name}><td className="p-2 border border-line">{n + 1}</td><td className="p-2 border border-line">{i.name}</td><td className="p-2 border border-line">{i.qty}</td><td className="p-2 border border-line">{ghs(i.price)}</td><td className="p-2 border border-line">{ghs(i.price * i.qty)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end">
        <div className="w-72">
          {(c.biz
            ? [['Goods price', ghs(c.a.goods)], ['VAT 15%', ghs(c.vat)], ['NHIL 2.5% · GETFund 2.5%', ghs(c.lev)], ['Cash price incl. taxes', ghs(c.cash)]]
            : [['Cash price · no VAT or levies', ghs(c.cash)]]
          ).map(([l, v]) => <div key={l} className="flex justify-between py-0.5"><span>{l}</span><b>{v}</b></div>)}
        </div>
      </div>
    </>
  );
}

function Schedule({ c }: { c: HPAg }) {
  const rows = scheduleRows(c);
  const start = dueOf(c.a.startY, c.a.startM, 0);
  return (
    <table className="w-full border-collapse my-3">
      <caption className="sr-only">Instalment schedule</caption>
      <thead><tr className="bg-canvas">{['No.', 'Due date', 'Instalment', 'Remaining after payment', 'Paid on', 'Status'].map((h) => <th key={h} scope="col" className="text-left p-2 border border-line">{h}</th>)}</tr></thead>
      <tbody>
        <tr className="bg-canvas/60"><td className="p-2 border border-line">0</td><td className="p-2 border border-line">{start}</td><td className="p-2 border border-line">Deposit {ghs(c.dep)}</td><td className="p-2 border border-line">{ghs(c.total)}</td><td className="p-2 border border-line">{start}</td><td className="p-2 border border-line">Paid</td></tr>
        {rows.map((r) => (
          <tr key={r.no}><td className="p-2 border border-line">{r.no}</td><td className="p-2 border border-line">{r.due}</td><td className="p-2 border border-line">{ghs(r.amount)}</td><td className="p-2 border border-line">{ghs(r.after)}</td><td className="p-2 border border-line">{r.paidOn}</td><td className="p-2 border border-line">{r.status}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

const SCOLS = ['8%', '17%', '17%', '24%', '17%', '17%'];
const SHEAD = ['No.', 'Due date', 'Instalment', 'Remaining after payment', 'Paid on', 'Status'];
const Cols = () => <colgroup>{SCOLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
function SchedHead() {
  return <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}><Cols /><thead><tr className="bg-canvas">{SHEAD.map((h) => <th key={h} scope="col" className="text-left p-2 border border-line text-[11.5px]">{h}</th>)}</tr></thead></table>;
}
function SchedRow({ cells, shade }: { cells: ReactNode[]; shade?: boolean }) {
  return <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}><Cols /><tbody><tr className={shade ? 'bg-canvas/60' : ''}>{cells.map((v, i) => <td key={i} className="p-2 border border-line border-t-0 text-[11.5px]">{v}</td>)}</tr></tbody></table>;
}

const fmtTel = (v?: string) => { const d = (v || '').replace(/\D/g, '').replace(/^233/, '').replace(/^0/, ''); return d.length === 9 ? `+233 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : v || '—'; };
function hirer(c: HPAg): [string, string][] {
  return c.biz
    ? [['Business', c.a.customer], ['Represented by', c.a.guarantor.replace(/^Respondent · /, '') || '—'], ['TIN', c.a.tin || '—'], ['Phone', fmtTel(c.a.phone)], ['Address', c.a.addr || '—']]
    : [['Customer', c.a.customer], ['Phone', fmtTel(c.a.phone)], ['Ghana Card', c.a.card || '—'], ['Address', c.a.addr || '—'], ['Employer', c.a.emp || '—']];
}
/** Guarantor (individual) or authorised officer (business): name, Tel and address. */
function guarantor(c: HPAg): [string, string][] {
  return [['Name', c.a.guarantor.replace(/^Respondent · /, '').replace(/^Guarantor$/, '') || '—'], ['Tel', fmtTel(c.a.gPhone || c.a.respNum)], ['Address', c.a.gAddr || '—']];
}

export function AgreementDoc({ c, onClose }: { c: HPAg; onClose: () => void }) {
  const date = dueOf(c.a.startY, c.a.startM, 0);
  // The 13 clauses of the prototype agreement (HirePurchase.dc.html), filled in from this agreement.
  const items = c.a.items?.length ? c.a.items : [{ name: c.a.item, price: c.a.goods, qty: 1 }];
  const itemsTxt = items.map((l) => (l.qty > 1 ? `${l.qty} × ` : '') + l.name).join('; ');
  const resp = c.biz ? c.a.guarantor.replace(/^Respondent · /, '') : '';
  const guar = !c.biz ? c.a.guarantor.replace(/^Guarantor$/, '') || 'the guarantor named above' : '';
  const firstDue = dueOf(c.a.startY, c.a.startM, 1);
  const tel = COMPANY.tel.split(' · ')[0];
  const clauses: [string, string][] = [
    ['Parties and interpretation', `This Hire Purchase Agreement (“the Agreement”) is made between ${COMPANY.name}, whose principal place of business is at ${COMPANY.addr} (Tel: ${tel}; Email: ${COMPANY.email}) (“the Owner”, which expression includes its successors and assigns), and ${c.a.customer} of the address stated in this Agreement${c.biz ? `, a business acting through ${resp || 'its authorised officer'}` : ''} (“the Hirer”). Headings are for convenience only, words in the singular include the plural, and the Schedules form part of this Agreement.`],
    ['The goods', `The Owner agrees to let, and the Hirer agrees to take on hire, the goods described in Schedule 1, namely ${itemsTxt} (“the Goods”). The Hirer confirms that the Goods have been inspected, are of satisfactory quality and fit for the purpose for which they are required, and were received in good working condition at the Owner’s ${c.branch} branch on the date of this Agreement.`],
    ['Cash price', `The cash price of the Goods is ${ghs(c.cash)}${c.biz ? ', inclusive of VAT at 15% and the NHIL and GETFund levies at 2.5% each' : ', with no VAT, NHIL or GETFund charged on a sale to an individual'}${(c.a.disc || 0) > 0 ? `, after a discount of ${ghs(c.a.disc || 0)} allowed by the Owner` : ''}. All amounts in this Agreement are stated and payable in Ghana cedis (GHS).`],
    ['Deposit', `On signing this Agreement the Hirer has paid a deposit of ${ghs(c.dep)}, being ${Math.round(c.cash ? (c.dep / c.cash) * 100 : 0)}% of the cash price, receipt of which the Owner acknowledges. The deposit is applied towards the cash price, leaving a balance of ${ghs(c.fin)} to be financed under this Agreement. The deposit is not refundable except as provided by law.`],
    ['Hire purchase charge', c.rate > 0 ? `In consideration of the Owner allowing the balance to be paid over time, a flat hire purchase charge of ${c.rate}% is applied to the amount financed, being ${ghs(c.charge)}. The remaining amount payable by the Hirer after the deposit is therefore ${ghs(c.total)}, and the total cost of the Goods including the deposit is ${ghs(c.total + c.dep)}. The rate is fixed for the full term and shall not be increased.` : `No hire purchase charge is applied to this Agreement; the balance is payable interest-free. The remaining amount payable by the Hirer after the deposit is therefore ${ghs(c.total)}, and the total cost of the Goods including the deposit is ${ghs(c.total + c.dep)}, equal to the cash price.`],
    ['Instalments and payment', `The Hirer shall pay ${c.a.term} consecutive monthly ${c.a.term === 1 ? 'instalment' : 'instalments'} of ${ghs(c.inst)}, the first falling due on ${firstDue} and each following instalment on the same day of every month, as set out in Schedule 3. Payment may be made in cash at any branch, by Mobile Money, bank transfer or card, and is treated as received only when cleared funds reach the Owner. An official receipt shall be issued for every payment.`],
    ['Late payment', 'Time of payment is of the essence of this Agreement. A grace period of seven (7) days applies to each instalment; thereafter a late payment fee of GHS 50.00 per missed instalment becomes payable, and the Owner may send reminders to the Hirer and the guarantor by SMS, telephone or letter. Any payment received is applied first to late fees and then to the oldest instalment outstanding.'],
    ['Ownership of the goods', 'The Goods remain the sole and absolute property of the Owner until every instalment and all other sums due under this Agreement have been paid in full, and until then the Hirer holds the Goods as bailee only. On full payment, title to the Goods passes to the Hirer automatically and the Owner shall issue a completion certificate.'],
    ['Care, use and risk', 'While any amount remains unpaid, the Hirer shall keep the Goods in good repair at the address stated above, use them with reasonable care and only for their intended purpose, and notify the Owner in writing within seven (7) days of any change of address, loss or damage. The Hirer shall not sell, pledge, sublet, lend or otherwise part with possession of the Goods, or allow any lien to arise over them. Risk of loss or damage passes to the Hirer on delivery.'],
    ['Default and repossession', 'If the Hirer fails to pay two or more instalments after their grace periods, breaches any material term of this Agreement, or becomes insolvent, the Owner may serve written notice requiring the default to be remedied within fourteen (14) days. If it is not remedied, the Owner may terminate this Agreement and, subject to the Hire Purchase Act, 1974 (NRCD 292), recover possession of the Goods. Sums already paid shall be credited against the amount owing, and the Hirer remains liable for any shortfall and the reasonable costs of recovery.'],
    ['Early settlement', 'The Hirer may settle this Agreement early at any time by giving notice and paying the balance outstanding, less a rebate of fifty per cent (50%) of the unearned portion of the hire purchase charge. On early settlement, ownership passes to the Hirer in accordance with clause 8.'],
    [c.biz ? 'Authorised officer' : 'Guarantee', c.biz ? `${resp || 'The authorised officer named above'} confirms that he or she is authorised to bind the Hirer to this Agreement and accepts personal responsibility for the punctual payment of the instalments and other sums falling due, which the Owner may recover directly without first proceeding against the Hirer.` : `${guar} unconditionally guarantees the punctual payment of all instalments and other sums due under this Agreement and agrees that the Owner may recover any unpaid amount directly from the guarantor without first proceeding against the Hirer. This guarantee continues until all sums are paid in full.`],
    ['Entire agreement, notices and governing law', 'This Agreement, with its Schedules, is the entire agreement between the parties and replaces any earlier understanding. No change is valid unless made in writing and signed by both parties. Notices may be delivered by hand, post, SMS or email to the addresses and numbers given above. This Agreement is governed by the laws of the Republic of Ghana, including the Hire Purchase Act, 1974 (NRCD 292) and the Sale of Goods Act, 1962 (Act 137), and the parties submit to the jurisdiction of the courts of Ghana.'],
  ];
  const decl = `${c.biz ? 'The authorised officer' : `The Hirer${c.a.guarantor ? ' and the guarantor' : ''}`} confirm that this Agreement, including the terms, the cash price, the deposit, the hire purchase charge and the instalment schedule, has been read over and explained in a language understood, that a copy has been received, and that it is signed freely and voluntarily.`;
  return (
    <DocShell title={`Hire purchase agreement · ${c.a.id}`} onClose={onClose} foot={`${c.a.id} · ${COMPANY.name}`} runTitle="Hire purchase agreement" blocks={[
      { key: 'head', node: <Letterhead bleed={48} kicker="LEGAL AGREEMENT" title="HIRE PURCHASE AGREEMENT" no={c.a.id} date={`Made at ${c.branch} branch on ${date}`} /> },
      { key: 'intro', node: <p className="mt-0">THIS HIRE PURCHASE AGREEMENT is made on <strong>{date}</strong> between the parties named below.</p> },
      { key: 'parties', node: <div className="flex gap-3 my-3"><KV title="The Owner" rows={[['Name', COMPANY.name], ['Tel', COMPANY.tel.split(' · ')[0]], ['Branch', c.branch]]} /><KV title="The Hirer" rows={hirer(c)} /><KV title={c.biz ? 'Authorised officer' : 'Guarantor'} rows={guarantor(c)} /></div> },
      ...(c.a.termsTo ? [{ key: 'tread', node: <p className="text-[11.5px] text-sub mt-0">Terms and conditions read to {c.a.termsTo.name} (Tel {fmtTel(c.a.termsTo.tel)}) and {c.biz ? 'authorised officer' : 'guarantor'} {c.a.termsTo.gName} (Tel {fmtTel(c.a.termsTo.gTel)}), and accepted on {c.a.termsTo.at}.</p> }] : []),
      { key: 'whereas', node: <p><strong>WHEREAS</strong> the Owner is the owner of the goods described in Schedule 1, and the Hirer wishes to take the goods on hire purchase and to pay for them by a deposit and instalments as set out in Schedule 2 and Schedule 3;</p>, keepNext: true },
      { key: 'agreed', node: <p><strong>NOW IT IS AGREED as follows:</strong></p>, keepNext: true },
      { key: 's1h', node: <h3 className="font-semibold text-sm mt-4 mb-0">Schedule 1 · Goods on hire purchase</h3>, keepNext: true },
      { key: 's1', node: <ItemsTable c={c} /> },
      { key: 's2h', node: <h3 className="font-semibold text-sm mt-4 mb-0">Schedule 2 · Financial summary</h3>, keepNext: true },
      { key: 's2', node: <div className="grid grid-cols-2 gap-x-8 my-2">{([['Cash price', ghs(c.cash)], [`Less deposit (${Math.round((c.dep / c.cash) * 100)}%)`, ghs(c.dep)], ['Balance after deposit (amount financed)', ghs(c.fin)], [`Add HP charge (${c.rate}% flat)`, ghs(c.charge)], ['Remaining payable in instalments', ghs(c.total)], [`${c.a.term} monthly instalments of`, ghs(c.inst)], ['Paid to date', ghs(c.total - c.balance)], ['Balance remaining', ghs(c.balance)], ['Total cost incl. deposit', ghs(c.total + c.dep)]] as [string, string][]).map(([l, v]) => <div key={l} className={cx('flex justify-between border-b border-line py-1', l.startsWith('Remaining') && 'bg-black text-white px-2 font-semibold', l === 'Balance remaining' && c.status === 'In arrears' && 'text-danger font-semibold')}><span>{l}</span><span>{v}</span></div>)}</div> },
      { key: 'th', node: <h3 className="font-semibold text-sm mt-4 mb-1">Terms of the agreement</h3>, keepNext: true },
      ...clauses.map(([h, t], n) => ({ key: 'cl' + n, node: <div className="flex gap-2 mb-2"><span className="w-6 flex-none text-right font-semibold">{n + 1}.</span><div><strong className="block">{h}</strong>{t}</div></div> })),
      { key: 'decl', node: <div className="rounded-2xl p-4 mt-2 mb-2" style={{ background: '#eef6f6' }}><strong>Declaration. </strong>{decl}</div> },
      { key: 's3h', node: <><h3 className="font-semibold text-sm mt-4 mb-1">Schedule 3 · Instalment schedule</h3><p className="mt-0 mb-2 text-[11.5px]">After the deposit of {ghs(c.dep)}, the remaining amount of {ghs(c.total)} is paid in {c.a.term} monthly instalments as shown below.</p></>, keepNext: true },
      { key: 's3th', node: <SchedHead />, keepNext: true },
      { key: 's3r0', group: 's3', groupHead: <><h3 className="font-semibold text-sm mt-0 mb-1">Schedule 3 · Instalment schedule (continued)</h3><SchedHead /></>, node: <SchedRow shade cells={['0', date, `Deposit ${ghs(c.dep)}`, ghs(c.total), date, 'Paid']} /> },
      ...scheduleRows(c).map((rw) => ({ key: 's3r' + rw.no, group: 's3', groupHead: <><h3 className="font-semibold text-sm mt-0 mb-1">Schedule 3 · Instalment schedule (continued)</h3><SchedHead /></>, node: <SchedRow cells={[rw.no, rw.due, ghs(rw.amount), ghs(rw.after), rw.paidOn, <span key="s" className={cx(rw.status === 'Overdue' && 'text-danger font-semibold', rw.status === 'Paid' && 'text-ok')}>{rw.status}</span>]} /> })),
      { key: 'sigh', node: <><h3 className="font-semibold text-sm mt-6 mb-1">Signatures</h3><p className="text-xs mt-0">IN WITNESS WHEREOF the parties have signed this Agreement on the date first written above.</p></>, keepNext: true },
      { key: 'sigs', keepNext: true, node: <div className="grid grid-cols-3 gap-6 mt-3">{[['For and on behalf of ' + COMPANY.name, 'Name', 'Ebenezer Mensah'], [c.biz ? `For and on behalf of ${c.a.customer} (the Hirer)` : 'The Hirer', 'Name', c.biz ? c.a.guarantor.replace(/^Respondent · /, '') : c.a.customer], [c.biz ? 'Witness' : 'Guarantor', 'Name', c.biz ? '' : c.a.guarantor.replace(/^Guarantor$/, '')]].map(([r0, l, n], k) => <div key={r0} className="flex flex-col gap-1"><strong className="text-[12px]">{r0}</strong><span className="h-12 border-b border-black" /><span className="text-xs text-muted">Signature</span><span className="text-xs">{l}: <b>{n}</b></span>{k === 1 && <span className="text-xs">Phone: {fmtTel(c.biz ? c.a.respNum : c.a.phone)}{!c.biz && c.a.card ? ` · Ghana Card ${c.a.card}` : ''}</span>}{k === 2 && !c.biz && <span className="text-xs">Phone: {fmtTel(c.a.gPhone)}</span>}<span className="text-xs">Date: ......................</span></div>)}</div> },
      { key: 'copy', node: <p className="text-xs text-muted mt-5">Both parties keep a signed copy · the Hirer’s signed copy is uploaded to agreement {c.a.id} in {COMPANY.name}’s system.</p> },
    ]} />
  );
}

export function ReceiptDoc({ c, pay, onClose }: { c: HPAg; pay: { no: number; label: string; amt: number; method: string; at: string; ref?: string }; onClose: () => void }) {
  const paidSoFar = pay.no === 0 ? 0 : pay.no;
  const pct = Math.round((paidSoFar / c.a.term) * 100);
  const no = 'HPR-' + c.a.id.replace('HP-', '') + '-' + String(pay.no).padStart(2, '0');
  return (
    <DocShell title={`Receipt · ${no}`} onClose={onClose} extra={<button onClick={() => { void downloadPdf(hpReceiptDoc(c, pay, companyBiz(bizInfo(), companyLogo())), no); }} className="btn bg-white text-black">⬇ Download PDF</button>}>
      <Letterhead kicker={pay.no === 0 ? 'Official receipt · deposit' : 'Official receipt'} title="HIRE PURCHASE RECEIPT" no={no} date={pay.at} />
      <div className="flex gap-3 flex-wrap">
        <KV title="Received from" rows={hirer(c)} />
        <KV title="Agreement" rows={[['Agreement', c.a.id], ['Items', c.a.item], ['Term', `${c.a.term} months`]]} />
      </div>
      <div className="my-4 rounded-2xl bg-brand-50 p-4 flex justify-between items-center flex-wrap gap-3">
        <div className="flex flex-col"><span className="text-xs text-muted">Amount received</span><strong className="text-2xl">{ghs(pay.amt)}</strong></div>
        <div className="text-xs flex flex-col text-right">
          <span>{pay.label}</span>
          <span>Paid by {pay.method}{pay.ref ? ` · ref ${pay.ref}` : ''}</span>
          <span>Balance after: <b>{ghs(Math.max(0, c.total - paidSoFar * c.inst))}</b></span>
        </div>
      </div>
      <div className="flex justify-between text-xs mb-1"><span>Progress · {paidSoFar} of {c.a.term} instalments</span><b>{pct}% paid</b></div>
      <div className="h-2 rounded-full bg-canvas overflow-hidden"><div className="h-full bg-ok" style={{ width: `${pct}%` }} /></div>
      <h3 className="font-semibold text-sm mt-5">Items on this agreement</h3>
      <ItemsTable c={c} />
      {!c.biz && <p className="text-xs text-muted">Sale to an individual · no VAT, NHIL or GETFund charged on this agreement.</p>}
      <div className="flex justify-between text-xs mt-6"><span>Received by · Ebenezer Mensah</span><span>Paid by · {c.a.customer}</span></div>
    </DocShell>
  );
}

export function StatementDoc({ c, pays, onClose }: { c: HPAg; pays: HPPayment[]; onClose: () => void }) {
  return (
    <DocShell title={`Statement · ${c.a.id}`} onClose={onClose} extra={<span className="text-white text-xs">Customer receipt · A5 / A4 · choose the paper size</span>}>
      <Letterhead kicker="Account statement" title="HIRE PURCHASE STATEMENT" no={c.a.id} date={new Date().toLocaleDateString('en-GB')} />
      <div className="flex gap-3 flex-wrap">
        <KV title="Hirer" rows={hirer(c)} />
        <KV title="Account summary" rows={[['Total payable', ghs(c.total)], ['Paid', `${c.paid} of ${c.a.term}`], ['Balance', ghs(c.balance)], ['Status', c.status]]} />
      </div>
      <h3 className="font-semibold text-sm mt-5">Instalment schedule</h3>
      <Schedule c={c} />
      {pays.length > 0 && <p className="text-xs text-muted">{pays.length} payment(s) recorded in MNest UnifiedPOS this session.</p>}
    </DocShell>
  );
}
