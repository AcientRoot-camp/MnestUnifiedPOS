import { useState } from 'react';
import { usePersist, writeKey } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { B, Sec, Tag, inp, useDev } from './ui';
import NoticeModal from '../../../components/Notice';

export const HOLIDAYS: [string, string][] = [['01-01', 'New Year’s Day'], ['01-07', 'Constitution Day'], ['03-06', 'Independence Day'], ['05-01', 'May Day'], ['07-01', 'Republic Day'], ['08-04', 'Founders’ Day'], ['09-21', 'Kwame Nkrumah Memorial Day'], ['12-05', 'Farmers’ Day'], ['12-25', 'Christmas Day'], ['12-26', 'Boxing Day']];
export function seasonLine(d = new Date()) {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = HOLIDAYS.find((h) => h[0] === md);
  const next = HOLIDAYS.find((h) => h[0] > md) ?? HOLIDAYS[0];
  const xmas = d.getMonth() === 11;
  return `${today ? `Today: ${today[1]} · ` : ''}${xmas ? '🎅 Father Christmas is showing (1–31 December) · ' : ''}${md === '12-25' ? '🎈 Balloons are up · ' : ''}Next public holiday: ${next[1]} (${new Date(`${d.getFullYear()}-${next[0]}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })})`;
}
const CLEAR_WHAT = 'sample sales, sample orders and collections, training receipts, test customers, sample expenses, sample tickets, practice stock movements and issued staff ID cards';

export default function Training({ sub = '' }: { sub?: string }) {
  const { d, act, locked } = useDev();
  const [tm, setTm] = usePersist('ecompos.training2', { on: false });
  const [cleared, setCleared] = usePersist<string>('ecompos.cleared', '');
  const [tp, setTp] = useState(sub === 'print');
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const tpAt = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <Sec id="tm-h" title={<span className="flex items-center gap-2">Training mode {tm.on ? <Tag t="ON" tone="bad" /> : <Tag t="Off · working system" tone="ok" />}</span>} sub="Use the whole system for staff training. Every screen and every printout (receipts, invoices, reports, test prints) carries a TRAINING MODE watermark.">
      <span className="text-sm">{tm.on ? `Training mode is on for ${d.co.name}. Sales are not recorded and no E-VAT receipts are sent to GRA.` : `${d.co.name} is using the working system. Sales are recorded and E-VAT receipts go to GRA.`}</span>
      <div className="flex gap-2 flex-wrap">
        {!tm.on ? <button disabled={locked} onClick={() => { setTm({ on: true }); writeKey('ecompos.mode', 'training'); act(`Started training mode · ${d.co.name}`, 'Training mode'); }} className={B.dark}>Start training mode</button>
          : <button disabled={locked} onClick={() => { setTm({ on: false }); writeKey('ecompos.mode', 'live'); act(`Ended training · activated the working system · ${d.co.name}`, 'Training mode'); }} className={B.primary}>End training · activate the working system</button>}
        <button onClick={() => setTp(!tp)} className={B.ghost}>Test print</button>
      </div>
      {tp && (
        <div id="sub-print" className="flex flex-col gap-2 items-start scroll-mt-6">
          <article className="print-doc relative w-[302px] max-w-full bg-white border border-line rounded-xl p-4 font-mono text-[12px] leading-5 flex flex-col items-center text-center overflow-hidden">
            {tm.on && <span aria-hidden className="absolute inset-0 flex items-center justify-center text-danger/25 font-bold text-xl tracking-widest -rotate-12 pointer-events-none">TRAINING MODE</span>}
            <strong className="text-sm">{d.co.name}</strong><strong>TEST PRINT</strong><span>{tpAt}</span><span>Printer check · 80 mm</span><span className="break-all">ABCDEFGHIJKLMNOPQRSTUVWXYZ</span><span>0123456789 · GHS 1,234.56</span><span>Mode: {tm.on ? 'TRAINING MODE · NOT VALID' : 'Working system'}</span><span className="mt-1">If you can read every line, the printer is ready.</span>
          </article>
          <div className="flex gap-2 no-print"><button onClick={() => { act('Sent a test print', 'Training mode'); window.print(); }} className={B.dark}>Print</button><button onClick={() => setTp(false)} className={B.ghost}>Close</button></div>
        </div>
      )}
      <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1"><strong className="text-sm">Holidays &amp; seasons · automatic</strong><span className="text-xs text-sub">Runs on the system's own date and time. Father Christmas shows from 1 to 31 December, special days are named, balloons pop up on 25 December, staff are greeted on New Year's Day and every Ghana public holiday is announced. Nothing to set here.</span><span className="text-xs font-semibold mt-1">{seasonLine()}</span></div>
      <div id="sub-clear" className="rounded-2xl border border-danger/40 p-4 flex flex-col gap-2 scroll-mt-6">
        <strong className="text-sm">Clear all company data before first use</strong>
        <span className="text-xs text-sub">Removes the pre-installed and training data so the company starts clean: {CLEAR_WHAT}. Kept: business name and logo, branches, products and prices, users, PINs and rider accounts.</span>
        <NoticeModal msg={cleared} onClose={() => setCleared('')} />
        <div className="flex gap-2 items-end flex-wrap"><label className="flex flex-col gap-1 text-[13px] font-semibold">Type CLEAR to confirm<input value={typed} onChange={(e) => { setTyped(e.target.value); setErr(''); }} placeholder="CLEAR" autoComplete="off" className={cx(inp, 'w-48')} /></label>
          <button aria-disabled={typed !== 'CLEAR'} onClick={() => { if (locked) return setErr('423 Locked · Support access is paused.'); if (typed !== 'CLEAR') return setErr('Type CLEAR in capitals to confirm.'); ['ecompos.webOrders2', 'ecompos.collect2', 'ecompos.stockMoves', 'ecompos.shopOrders', 'ecompos.sysAlerts', 'ecompos.httpLog', 'ecompos.idcards'].forEach((k) => writeKey(k, k === 'ecompos.stockMoves' || k === 'ecompos.shopOrders' || k === 'ecompos.idcards' ? {} : [])); const t = `${d.co.name} cleared on ${tpAt} · ready for first use`; setCleared(t); setTyped(''); act(`Cleared all company data before first use · ${d.co.name}`, 'Training mode'); }} className={cx(B.danger, typed !== 'CLEAR' && 'opacity-40')}>Clear all company data</button></div>
        {err && <span role="alert" className="text-sm text-danger">{err}</span>}
      </div>
    </Sec>
  );
}
