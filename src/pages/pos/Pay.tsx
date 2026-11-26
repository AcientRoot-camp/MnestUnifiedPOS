// Sell Now · Take payment (sell.md §2.6).
import { useEffect, useState } from 'react';
import { ACCOUNTS } from '../../data/nav';
import { usePersist } from '../../lib/persist';
import { creds, secLog } from '../../lib/sec';
import { cx, ghs } from '../../lib/format';
import { netOf, nowTxt, phClean, type Cust } from './model';
import { QR } from './Docs';
import { PORTAL_BASE } from '../../lib/site';

export type PayM = 'cash' | 'momo' | 'ghpay' | 'split' | 'credit';
export const PAY_NAME: Record<PayM | 'hp' | 'account', string> = { cash: 'Cash', momo: 'Mobile Money', ghpay: 'GhPay', split: 'Split', credit: 'Credit sale', hp: 'Hire purchase', account: 'On account' };
const PERM_KEY: Record<PayM, string> = { cash: 'cash', momo: 'momo', ghpay: 'ghpay', split: 'split', credit: 'credit' };
export type PayDone = { method: string; parts: { m: string; amt: number }[]; change: number; cashRecv?: number; momoNet?: string; payRef?: string; kind: 'sale' | 'credit'; paidNow?: number; balance?: number; due?: string; allowedBy?: string; offline?: boolean };
export type CredReq = { id: string; cust: string; br: string; amount: number; paidNow: number; due: string; by: string; at: string; status: 'pending' | 'approved' | 'rejected'; note?: string };

const TEAL = '#0b5c5c';
const SHADOW = 'rgba(69,36,219,0.34) 0 4px 24px 0';
const pill = (on: boolean) => cx('px-4 rounded-full border text-sm font-medium', on ? 'bg-black text-white border-black' : 'bg-white text-black border-[#d9d9d9]');
const Phone = ({ v, set, id, label }: { v: string; set: (x: string) => void; id: string; label: string }) => (
  <label htmlFor={id} className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">{label}
    <span className="flex items-center h-12 rounded-full border border-[#d9d9d9] bg-white px-4 gap-2"><b className="text-black">+233</b><input id={id} inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/[^\d ]/g, '').slice(0, 12))} placeholder="24 555 0142" className="flex-1 min-w-0 outline-none bg-transparent font-normal text-black text-[15px]" /></span>
    <span className="text-xs font-normal text-[#5f5c5a]">9 digits after +233, without the first 0</span>
  </label>
);
const due = (days: number) => new Date(Date.now() + days * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Pay({ total, cust, online, me, role, SU, br, till, owes, payAllow, creditFirst, onBack, onDone, onHP, onIntro }: {
  total: number; cust: Cust | null; online: boolean; me: { name: string; level: string }; role: string; username: string; SU: boolean; br: string; till: string; owes: number;
  payAllow: Record<string, boolean> | undefined; creditFirst: boolean; onBack: () => void; onDone: (d: PayDone) => void; onHP: () => void; onIntro: () => void;
}) {
  const [m, setM] = useState<PayM>(creditFirst ? 'credit' : 'cash');
  const [once, setOnce] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<PayM | null>(null);
  const [askPin, setAskPin] = useState(''); const [askErr, setAskErr] = useState('');
  const [tender, setTender] = useState(''); const [exact, setExact] = useState(false);
  const [net, setNet] = useState(''); const [wallet, setWallet] = useState(cust?.phone ? phClean(cust.phone) : '');
  const [momoSt, setMomoSt] = useState<'' | 'wait' | 'timeout'>(''); const [mref, setMref] = useState('');
  const [ghRef] = useState('GHP-' + Math.random().toString(36).slice(2, 8).toUpperCase()); const [ghPhone, setGhPhone] = useState(cust?.phone ? phClean(cust.phone) : ''); const [ghSent, setGhSent] = useState(false);
  const [sp, setSp] = useState<{ kind: 'momo' | 'ghpay'; cash: string; other: string }>({ kind: 'momo', cash: '', other: '' });
  const [now, setNow] = useState(''); const [days, setDays] = useState(30); const [pickDate, setPickDate] = useState('');
  const [reqs, setReqs] = usePersist<CredReq[]>('ecompos.creditReq2', []);
  const [reqId, setReqId] = useState(''); const [apPin, setApPin] = useState(''); const [apErr, setApErr] = useState('');
  const [err, setErr] = useState('');
  const first = me.name.split(' ')[0];
  const locked = (k: PayM) => { if (SU || once[k]) return false; const g = payAllow?.[PERM_KEY[k]]; return g === undefined ? role === 'staff' && k === 'credit' : !g; };
  useEffect(() => { if (wallet && !net) setNet(netOf(wallet)); }, [wallet]); // eslint-disable-line react-hooks/exhaustive-deps

  const cash = exact ? total : parseFloat(tender) || 0;
  const paidNow = Math.min(total, Math.max(0, parseFloat(now) || 0));
  const bal = Math.max(0, total - paidNow);
  const dueTxt = pickDate ? new Date(pickDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : due(days);
  const req = reqs.find((r) => r.id === reqId);
  const approved = SU || req?.status === 'approved';
  const spCash = parseFloat(sp.cash) || 0; const spOther = parseFloat(sp.other) || 0; const spLeft = Math.round((total - spCash - spOther) * 100) / 100;
  const base = { allowedBy: once[m], offline: !online };

  const managerPin = (p: string) => ACCOUNTS.find((a) => (a.role === 'manager' || a.role === 'superuser') && (creds()[a.username]?.passcode || a.passcode) === p);
  const allow = () => { const who = managerPin(askPin); if (!who || !ask) return setAskErr('401 Unauthorized · That is not a Manager or Admin PIN.'); setOnce({ ...once, [ask]: who.name }); setM(ask); secLog('Payment method allowed once', `${who.name} allowed ${PAY_NAME[ask]} for one sale by ${me.name}`, 'low', who.username); setAsk(null); setAskPin(''); setAskErr(''); };
  const finishCash = () => { if (cash < total) return setErr(`Short by ${ghs(total - cash)}. Take more cash or choose another method.`); onDone({ ...base, method: 'Cash', parts: [{ m: 'Cash', amt: cash }], change: cash - total, cashRecv: cash, kind: 'sale' }); };
  const sendPrompt = () => { if (phClean(wallet).length !== 9) return setErr("Enter the customer's wallet number: 9 digits after +233."); setErr(''); setMomoSt('wait'); };
  const sendCredit = () => {
    if (!cust || !cust.name || phClean(cust.phone).length !== 9) return setErr('A credit sale needs the customer’s name and phone number. Add them in the Customer section.');
    const id = 'CS-' + Date.now().toString().slice(-5);
    setReqs([{ id, cust: `${cust.name} · ${cust.phone}`, br, amount: bal, paidNow, due: dueTxt, by: me.name, at: nowTxt(), status: 'pending' }, ...reqs]); setReqId(id); setErr('');
  };
  const approveHere = () => { const a = ACCOUNTS.find((x) => x.role === 'superuser' && (creds()[x.username]?.passcode || x.passcode) === apPin); if (!a) return setApErr('401 Unauthorized · That is not the Admin PIN.'); setReqs(reqs.map((r) => (r.id === reqId ? { ...r, status: 'approved', note: `Approved at ${till} by ${a.name} with PIN` } : r))); secLog('Approval signed', `${a.name} approved credit sale ${reqId} (${ghs(bal)}) at ${till} · PIN`, 'low', a.username); setApPin(''); setApErr(''); };
  const finishCredit = (account = false) => onDone({ ...base, method: account ? 'On account' : 'Credit sale', parts: paidNow ? [{ m: 'Paid now', amt: paidNow }] : [], change: 0, kind: 'credit', paidNow, balance: bal, due: dueTxt });

  const tiles: [PayM, string][] = [['cash', 'Cash'], ['momo', 'Mobile Money'], ['ghpay', 'GhPay'], ['split', 'Split'], ['credit', 'Credit sale']];
  const cta = (label: string, ready: boolean, fn: () => void, color = TEAL) => <button onClick={fn} disabled={!ready} className="h-[52px] rounded-full text-white text-base font-medium disabled:cursor-not-allowed" style={{ background: ready ? color : '#cfcfcf', boxShadow: ready ? SHADOW : 'none' }}>{label}</button>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3"><button onClick={onBack} aria-label="Back to the sale" className="w-10 h-10 rounded-full border border-[#d9d9d9] bg-white text-xl flex items-center justify-center">‹</button><h2 className="m-0 text-xl font-medium tracking-[-0.03em] flex-1">Take payment</h2><b className="text-[22px] font-medium">{ghs(total)}</b></div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
        {tiles.map(([k, l]) => { const lk = locked(k); return <button key={k} aria-pressed={m === k} onClick={() => { if (lk) { setAsk(k); return; } setM(k); setErr(''); }} className={cx('h-[52px] rounded-2xl border text-sm font-medium flex flex-col items-center justify-center leading-tight', m === k && !lk ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]', lk && 'opacity-60')}>{lk ? '🔒 ' : ''}{l}{lk && <span className="text-[10px] font-normal">Locked</span>}</button>; })}
      </div>

      {ask && <div role="alertdialog" className="rounded-[18px] border-2 border-black p-4 flex flex-col gap-2.5 bg-white">
        <b>{PAY_NAME[ask]} is turned off for {first}</b>
        <span className="text-sm text-[#5f5c5a]">A Manager or the Admin can allow it for this sale with their PIN. To change it for good, open Users & permissions.</span>
        <input type="password" inputMode="numeric" maxLength={6} value={askPin} onChange={(e) => setAskPin(e.target.value.replace(/\D/g, ''))} placeholder="Manager or Admin PIN" aria-label="Manager or Admin PIN" className="h-12 rounded-full border border-[#d9d9d9] px-4 tracking-[0.4em]" />
        {askErr && <span role="alert" className="text-xs text-[#c62828]">{askErr}</span>}
        <div className="flex gap-2 flex-wrap"><button onClick={() => { setAsk(null); setAskErr(''); }} className="h-10 px-4 rounded-full border border-[#d9d9d9] text-sm">Cancel</button><button onClick={allow} className="h-10 px-4 rounded-full bg-black text-white text-sm font-semibold">Manager PIN · allow for this sale</button><a href={`${PORTAL_BASE}/users`} className="h-10 px-4 rounded-full border border-black text-sm inline-flex items-center">Open Users & permissions</a></div>
      </div>}

      {m === 'cash' && <div className="flex flex-col gap-3">
        <span className="text-[13px] font-semibold text-[#3d3a38]">Cash tendered</span>
        <div className="grid grid-cols-4 gap-2"><button aria-pressed={exact} onClick={() => { setExact(true); setTender(''); setErr(''); }} className={cx('h-12 rounded-full border text-sm font-semibold', exact ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>Exact</button></div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Or type the amount received
          <span className={cx('flex items-center h-12 rounded-full border bg-white px-4 gap-2', !exact && tender && cash < total ? 'border-[#c62828]' : 'border-[#d9d9d9]')}><b className="text-black">GHS</b><input inputMode="decimal" value={tender} onChange={(e) => { setTender(e.target.value.replace(/[^\d.]/g, '')); setExact(false); setErr(''); }} className="flex-1 min-w-0 outline-none bg-transparent text-black text-[17px] font-semibold" placeholder="0.00" /></span>
        </label>
        {(exact || tender) ? <div className="rounded-2xl px-4 py-3 text-[15px] font-semibold" style={{ background: cash >= total ? '#f2f4f5' : '#fbeaea', color: cash >= total ? '#000' : '#7d1a1a' }}>{cash >= total ? `Change due ${ghs(cash - total)}` : `Short by ${ghs(total - cash)}`}</div>
          : <span className="text-sm" style={{ color: '#b26a00' }}>Tap <b>Exact</b> or type the amount received to complete the sale.</span>}
        {cta('Complete sale · open drawer', (exact || !!tender) && cash >= total, finishCash)}
      </div>}

      {m === 'momo' && <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">{['MTN', 'Telecel', 'AirtelTigo'].map((n) => <button key={n} aria-pressed={net === n} onClick={() => setNet(n)} className={cx('h-12 rounded-2xl border text-sm font-medium', net === n ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{n}</button>)}</div>
        <Phone v={wallet} set={(v) => { setWallet(v); setMomoSt(''); }} id="pay-wallet" label="Customer's wallet number" />
        {netOf(wallet) && <span className="text-xs font-semibold" style={{ color: '#1f7a2a' }}>✓ {netOf(wallet)} number detected</span>}
        {online ? (momoSt !== 'wait' ? cta(`Send ${net || 'MoMo'} payment prompt`, phClean(wallet).length === 9, sendPrompt) : <div className="rounded-2xl bg-[#e3f0fb] p-4 flex flex-col gap-2 text-sm" role="status">
          <b style={{ color: '#0b4f8a' }}>Prompt sent via Hubtel · waiting for PIN</b>
          <span>The customer approves {ghs(total)} on their phone. The status is checked with the gateway before the sale completes.</span>
          <div className="flex gap-2 flex-wrap"><button onClick={() => onDone({ ...base, method: `Mobile Money · ${net || netOf(wallet) || 'MTN'}`, parts: [{ m: 'Mobile Money', amt: total }], change: 0, momoNet: net || netOf(wallet) || 'MTN', payRef: 'HUB-' + Date.now().toString().slice(-8), kind: 'sale' })} className="h-11 px-5 rounded-full bg-black text-white text-sm font-semibold">Customer approved</button><button onClick={() => setMomoSt('timeout')} className="h-11 px-5 rounded-full border border-[#d9d9d9] bg-white text-sm">Timed out · resend</button></div>
        </div>) : <div className="rounded-2xl p-4 flex flex-col gap-2 text-sm text-white" style={{ background: '#332f2d' }}>
          <b>MoMo to merchant (offline)</b><span>Ask the customer to send {ghs(total)} to the merchant number 0244 000 111, then type the transaction reference from their SMS.</span>
          <input value={mref} onChange={(e) => setMref(e.target.value)} placeholder="MoMo transaction reference" aria-label="MoMo transaction reference" className="h-11 rounded-full px-4 text-black" />
          <button disabled={mref.trim().length < 4} onClick={() => onDone({ ...base, method: `Mobile Money · ${net || 'MTN'} · to merchant (offline)`, parts: [{ m: 'Mobile Money', amt: total }], change: 0, momoNet: net || 'MTN', payRef: mref.trim(), kind: 'sale' })} className="h-11 rounded-full bg-white text-black text-sm font-semibold disabled:opacity-50">Record and verify when back online</button>
        </div>}
        {momoSt === 'timeout' && <span className="text-sm" style={{ color: '#b26a00' }}>The prompt timed out. Check the number and send it again.</span>}
      </div>}

      {m === 'ghpay' && <div className="flex flex-col gap-3">
        <div className="rounded-[20px] p-4 flex gap-4 items-center text-white" style={{ background: '#0b3b2e' }}>
          <span className="bg-white rounded-xl p-2 flex-none"><QR seed={ghRef + total} size={128} /></span>
          <div className="flex flex-col gap-1 text-sm"><b className="text-lg">GhPay · {ghs(total)}</b><span>Scan with any Ghanaian bank app or GhanaPay wallet. Paid instantly through GhIPSS.</span><span className="text-white/70">Ref {ghRef}</span></div>
        </div>
        <span className="text-[13px] font-semibold text-[#3d3a38]">Or send a payment request to the customer's phone</span>
        <div className="flex gap-2 items-start"><div className="flex-1"><Phone v={ghPhone} set={setGhPhone} id="pay-gh" label="Customer phone" /></div><button onClick={() => { if (phClean(ghPhone).length !== 9) return setErr('Enter 9 digits after +233.'); setErr(''); setGhSent(true); }} className="h-12 px-5 rounded-full bg-black text-white text-sm font-semibold mt-[22px]">Send</button></div>
        {ghSent && <span role="status" className="text-sm" style={{ color: '#0b4f8a' }}>Request sent to +233 {phClean(ghPhone)} · waiting for the customer to approve</span>}
        {!online && <span className="text-sm text-[#c62828]">GhPay needs the internet. Use cash or MoMo to merchant while offline.</span>}
        {cta('Payment received · complete sale', online, () => onDone({ ...base, method: 'GhPay', parts: [{ m: 'GhPay', amt: total }], change: 0, payRef: ghRef, kind: 'sale' }))}
      </div>}

      {m === 'split' && <div className="flex flex-col gap-3">
        <div className="flex gap-2">{(['momo', 'ghpay'] as const).map((k) => <button key={k} aria-pressed={sp.kind === k} onClick={() => setSp({ ...sp, kind: k })} className={cx(pill(sp.kind === k), 'h-11')}>{k === 'momo' ? 'Cash + MoMo' : 'Cash + GhPay'}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Cash amount<span className="flex items-center h-12 rounded-full border border-[#d9d9d9] px-4 gap-2"><b className="text-black">GHS</b><input inputMode="decimal" value={sp.cash} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); setSp({ ...sp, cash: v, other: String(Math.max(0, Math.round((total - (parseFloat(v) || 0)) * 100) / 100)) }); }} className="flex-1 min-w-0 outline-none font-normal text-black" /></span></label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">{sp.kind === 'momo' ? 'MoMo' : 'GhPay'} amount<span className="flex items-center h-12 rounded-full border border-[#d9d9d9] px-4 gap-2"><b className="text-black">GHS</b><input inputMode="decimal" value={sp.other} onChange={(e) => setSp({ ...sp, other: e.target.value.replace(/[^\d.]/g, '') })} className="flex-1 min-w-0 outline-none font-normal text-black" /></span></label>
        </div>
        <div role="status" className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: Math.abs(spLeft) < 0.01 ? '#e7f4e8' : '#fff4e5', color: Math.abs(spLeft) < 0.01 ? '#1f7a2a' : '#8a4b00' }}>{Math.abs(spLeft) < 0.01 ? '✓ Both parts add up to the total' : spLeft > 0 ? `${ghs(spLeft)} left to cover` : `${ghs(-spLeft)} more than the total`}</div>
        {cta('Take both payments', Math.abs(spLeft) < 0.01 && spCash > 0 && spOther > 0, () => onDone({ ...base, method: `Split · Cash + ${sp.kind === 'momo' ? 'MoMo' : 'GhPay'}`, parts: [{ m: 'Cash', amt: spCash }, { m: sp.kind === 'momo' ? 'Mobile Money' : 'GhPay', amt: spOther }], change: 0, payRef: sp.kind === 'ghpay' ? ghRef : 'HUB-' + Date.now().toString().slice(-8), kind: 'sale' }))}
      </div>}

      {m === 'credit' && <div className="flex flex-col gap-3">
        <button onClick={onIntro} className="w-fit h-9 px-4 rounded-full border border-[#d9d9d9] bg-white text-sm">ⓘ What is a credit sale?</button>
        <div className="rounded-2xl bg-[#f2f4f5] p-3.5 flex flex-col gap-0.5 text-sm">{cust?.name && phClean(cust.phone).length === 9 ? <><b>{cust.name}</b><span className="text-[#5f5c5a]">{cust.phone} · goods total {ghs(total)}</span></> : <span className="text-[#c62828]">Add the customer’s name and phone number in the Customer section. A credit sale cannot be anonymous.</span>}</div>
        {owes > 0 && <div className="rounded-2xl p-3 text-sm" style={{ background: '#fff4e5', color: '#8a4b00' }}>⚠ {cust?.name.split(' ')[0]} already owes {ghs(owes)} on earlier credit sales.</div>}
        <span className="text-[13px] font-semibold text-[#3d3a38]">Paying something now?</span>
        <div className="flex gap-2 flex-wrap">{([['Nothing now', 0], ['Half', Math.round(total / 2 * 100) / 100], ['Round it', Math.floor(total / 100) * 100 || Math.floor(total / 10) * 10]] as [string, number][]).map(([l, v]) => <button key={l} aria-pressed={paidNow === v && (now !== '' || v === 0)} onClick={() => setNow(String(v))} className={cx(pill(paidNow === v && (now !== '' || v === 0)), 'h-10')}>{l}</button>)}</div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Amount paid now (GHS)<input inputMode="decimal" value={now} onChange={(e) => setNow(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" className="h-12 rounded-full border border-[#d9d9d9] px-4 font-normal text-black" /></label>
        <span className="text-[13px] font-semibold text-[#3d3a38]">When is the balance due?</span>
        <div className="flex gap-2 flex-wrap">{([['1 week', 7], ['2 weeks', 14], ['30 days', 30], ['60 days', 60]] as [string, number][]).map(([l, d]) => <button key={l} aria-pressed={!pickDate && days === d} onClick={() => { setDays(d); setPickDate(''); }} className={cx(pill(!pickDate && days === d), 'h-10')}>{l}</button>)}</div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[#3d3a38]">Or pick the date<input type="date" value={pickDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPickDate(e.target.value)} className="h-12 rounded-full border border-[#d9d9d9] px-4 font-normal text-black" /></label>
        <div className="rounded-2xl p-4 flex justify-between items-center" style={{ background: '#e7f2f2' }}><span className="flex flex-col text-sm"><b>Balance on account</b><span className="text-[#5f5c5a]">Due {dueTxt}</span></span><b className="text-xl" style={{ color: TEAL }}>{ghs(bal)}</b></div>
        {!SU && reqId && <div role="status" className={cx('rounded-[18px] p-4 flex flex-col gap-1.5 text-sm', req?.status === 'approved' ? 'bg-[#e7f4e8]' : req?.status === 'rejected' ? 'bg-[#fbeaea]' : 'bg-black text-white')}>
          <b>{req?.status === 'approved' ? '✓ Credit sale approved' : req?.status === 'rejected' ? 'Credit sale not approved' : 'Waiting for the Admin to approve'}</b>
          <span>{req?.status === 'approved' ? req.note || 'Approved by the Admin.' : req?.status === 'rejected' ? req.note || 'Take payment another way.' : `${reqId} · ${ghs(bal)} owed by ${cust?.name} · due ${dueTxt}. The Admin reviews it on their account.`}</span>
          {req?.status === 'pending' && <div className="flex flex-col gap-1.5 pt-1"><span className="text-xs" style={{ color: '#f2b705' }}>Admin here? Approve with PIN</span><div className="flex gap-2"><input type="password" inputMode="numeric" maxLength={6} value={apPin} onChange={(e) => setApPin(e.target.value.replace(/\D/g, ''))} aria-label="Admin 6-digit PIN" placeholder="••••••" className="h-10 w-36 rounded-full px-4 text-black tracking-[0.3em]" /><button onClick={approveHere} disabled={apPin.length !== 6} className="h-10 px-4 rounded-full bg-white text-black text-sm font-semibold disabled:opacity-50">Approve now</button></div>{apErr && <span role="alert" className="text-xs text-[#ffb4b4]">{apErr}</span>}</div>}
        </div>}
        {SU || approved ? cta(`Complete credit sale · ${ghs(bal)} owed`, !!cust?.name && phClean(cust?.phone || '').length === 9, () => finishCredit())
          : !reqId ? cta('Send to the Admin for approval', !!cust?.name && phClean(cust?.phone || '').length === 9, sendCredit, '#000') : cta('Waiting for approval…', false, () => undefined)}
      </div>}

      <div className="flex flex-col gap-2 pt-1 border-t border-[#ebebeb]">
        <span className="text-xs text-[#5f5c5a] pt-2">Other methods</span>
        <div className="rounded-2xl border border-[#ebebeb] p-3 flex items-center gap-3 flex-wrap"><span className="flex-1 min-w-[160px] text-sm"><b>Hire purchase</b> · credit paid in instalments</span><button onClick={onHP} className="h-10 px-4 rounded-full bg-black text-white text-sm font-semibold">Set up agreement & take deposit</button></div>
        <div className="rounded-2xl border border-[#ebebeb] p-3 flex items-center gap-3 flex-wrap"><span className="flex-1 min-w-[160px] text-sm"><b>On account</b> · a business or regular customer settles later on their account</span><button onClick={() => { if (!cust?.name || phClean(cust.phone).length !== 9) return setErr('Put on account needs the customer’s name and phone number.'); if (!SU && !approved) { setM('credit'); return setErr('On-account sales need the Admin’s approval. Send it for approval below.'); } finishCredit(true); }} className="h-10 px-4 rounded-full border border-black bg-white text-sm font-semibold">Put on account</button></div>
      </div>
      {err && <div role="alert" className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#fbeaea', color: '#7d1a1a' }}>{err}</div>}
    </div>
  );
}
