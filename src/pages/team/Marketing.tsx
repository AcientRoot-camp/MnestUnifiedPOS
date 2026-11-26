// Grow & team → Marketing ("Marketing & sales channels", GTeam.md §2): new campaign (channel, segment, reach, message
// with the channel's note, preview with the STOP line and sender, Send now / Schedule), messaging providers and
// abandoned-basket reminders, the campaigns table, promotions that apply at the till and the online store (with a
// "+ New promotion" builder) and selling on other channels (both for the Admin only; each channel is set up and
// activated in Channels.tsx). Only customers who opted in to a
// channel are messaged.
import { useState } from 'react';
import { BRS } from '../../data/catalogue';
import { cx } from '../../lib/format';
import { usePersist } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { Card, Pills, T } from '../finance/shared';
import { Head, Msg, Switch } from '../money/ui';
import SellChannels from './Channels';

type Ch = 'WhatsApp' | 'SMS' | 'Email';
type Camp = { name: string; ch: Ch | string; sent: number; orders: number; status: string };
/** Customers opted in to each channel in each segment (demo counts, GTeam.md §2.1). */
const REACH: Record<string, Record<Ch, number>> = {
  'All opted in': { WhatsApp: 1842, SMS: 2310, Email: 640 },
  Wholesale: { WhatsApp: 96, SMS: 120, Email: 31 },
  'Lapsed 60 days': { WhatsApp: 214, SMS: 380, Email: 88 },
  Kumasi: { WhatsApp: 402, SMS: 515, Email: 97 },
};
const SENDER: Record<Ch, string> = { Email: 'hello@ebenezerunique.com.gh', SMS: 'EBENEZERUV', WhatsApp: 'Ebenezer Unique Ventures (WhatsApp Business)' };
const CAMPS0: Camp[] = [
  { name: 'Back to school bundles', ch: 'WhatsApp', sent: 1604, orders: 87, status: 'Sent 2 Sep' },
  { name: 'Kumasi wholesale week', ch: 'SMS', sent: 515, orders: 41, status: 'Sent 14 Oct' },
  { name: 'October newsletter', ch: 'Email', sent: 622, orders: 12, status: 'Sent 1 Oct' },
];
type Promo = { id: string; name: string; rule: string; on: boolean };
/** Demo promotions (structure from GTeam.md §2.4, products from this electronics catalogue). */
const PROMOS0: Promo[] = [
  { id: 'p1', name: 'Buy 2 standing fans, save 5%', rule: 'All branches · till and website', on: true },
  { id: 'p2', name: 'Happy hour on DStv subscriptions', rule: 'Weekdays 16:00–18:00 · 10% off', on: false },
  { id: 'p3', name: 'TV + soundbar + stabiliser bundle', rule: 'TCL 43" TV, TCL 2.1 soundbar and 1000VA stabiliser · GHS 7,499.00', on: true },
  { id: 'p4', name: 'Kumasi only: free delivery over GHS 300', rule: 'Adum branch · website', on: false },
];
// sync is no longer used (channel setups live in Channels.tsx, ecompos.channels2); kept so saved states still load.
type MState = { ch: Ch; aud: string; prov: string; sync: Record<string, boolean> };
const M0: MState = { ch: 'WhatsApp', aud: 'All opted in', prov: 'Hubtel', sync: {} };
const PTYPES = ['% off', 'Fixed price bundle', 'Buy X get Y', 'Free delivery'];

export default function Marketing() {
  // Promotions and other sales channels change prices and listings everywhere: the Admin's only.
  const { session } = useSession();
  const ADMIN = ['superuser', 'developer'].includes(session?.role ?? 'superuser');
  const [S, setS] = usePersist<MState>('ecompos.marketing', M0);
  const [C, setC] = usePersist<Camp[]>('ecompos.campaigns3', CAMPS0);
  const [P, setP] = usePersist<Promo[]>('ecompos.promotions', PROMOS0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(0);
  const [sched, setSched] = useState({ open: false, at: '' });
  const [np, setNp] = useState<null | { name: string; type: string; value: string; brs: string[]; till: boolean; web: boolean; from: string; to: string; t1: string; t2: string }>(null);
  const [msg, setMsg] = useState('');
  const n = REACH[S.aud]?.[S.ch] ?? 0;
  const body = text.trim() || 'Weekend deal at Ebenezer Unique Ventures: 5% off TCL and Samsung TVs until Sunday. Shop: ebenezerunique.com.gh';
  // SMS: count the STOP line too, since it is sent with the message.
  const smsLen = `${body} Reply STOP to opt out`.length; const parts = Math.max(1, Math.ceil(smsLen / 160));
  const note = S.ch === 'SMS' ? `160 characters per SMS · this message uses ${parts} SMS` : S.ch === 'WhatsApp' ? 'Sent as an approved WhatsApp template' : 'Includes an unsubscribe link';
  const campName = () => body.split(/[:.!·]/)[0].trim().split(/\s+/).slice(0, 4).join(' ');
  /** Send now: the button says who it is going to, and a "Sending now" row goes to the top of Campaigns. */
  const sendNow = () => {
    if (body.length < 10) return setMsg('Write the message first.');
    setSending(n); setC((x) => [{ name: campName(), ch: S.ch, sent: n, orders: 0, status: 'Sending now' }, ...x]);
    setTimeout(() => { setC((x) => x.map((c, i) => (i === 0 && c.status === 'Sending now' ? { ...c, status: `Sent ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` } : c))); setSending(0); setMsg(`Sent to ${n.toLocaleString('en-GB')} opted-in customers by ${S.ch}`); }, 2500);
  };
  /** Schedule: queue the campaign for a date and time. */
  const schedule = () => {
    if (!sched.at) return setMsg('Pick the date and time to send.');
    if (new Date(sched.at).getTime() < Date.now()) return setMsg('Pick a time in the future.');
    setC((x) => [{ name: campName(), ch: S.ch, sent: n, orders: 0, status: `Scheduled ${new Date(sched.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` }, ...x]);
    setSched({ open: false, at: '' }); setMsg(`Scheduled for ${n.toLocaleString('en-GB')} customers`);
  };
  /** Save a new promotion from the builder. */
  const savePromo = () => {
    if (!np) return;
    if (np.name.trim().length < 3) return setMsg('Give the promotion a name.');
    if (np.type !== 'Free delivery' && !np.value.trim()) return setMsg(np.type === '% off' ? 'Enter the percentage off.' : np.type === 'Fixed price bundle' ? 'Enter the bundle price.' : 'Enter the deal, e.g. buy 2 get 1 free.');
    if (!np.till && !np.web) return setMsg('Choose the till, the website or both.');
    if (np.from && np.to && np.to < np.from) return setMsg('The end date cannot be before the start date.');
    const where = np.brs.length === BRS.length ? 'All branches' : np.brs.map((b) => BRS.find((x) => x.id === b)?.name).join(', ');
    const rule = [where, [np.till && 'till', np.web && 'website'].filter(Boolean).join(' and '), np.type === '% off' ? `${np.value}% off` : np.type === 'Fixed price bundle' ? `GHS ${(parseFloat(np.value) || 0).toFixed(2)}` : np.type === 'Free delivery' ? `free delivery${np.value ? ` over GHS ${np.value}` : ''}` : np.value, np.t1 && np.t2 ? `${np.t1}–${np.t2}` : '', np.from ? `from ${np.from}${np.to ? ` to ${np.to}` : ''}` : ''].filter(Boolean).join(' · ');
    setP((x) => [...x, { id: 'p' + Date.now(), name: np.name.trim(), rule, on: true }]); setNp(null); setMsg(`${np.name.trim()} is on at the ${[np.till && 'till', np.web && 'website'].filter(Boolean).join(' and ')}`);
  };
  const inp = 'h-10 px-3.5 rounded-full border border-line text-sm font-normal';
  return (
    <>
      <Head title="Marketing & sales channels" sub="Message opted-in customers, run promotions and list your catalogue where people shop" />
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr] items-start">
        <Card title="New campaign">
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Channel</span><Pills small opts={[['WhatsApp', 'WhatsApp'], ['SMS', 'SMS'], ['Email', 'Email']]} value={S.ch} onChange={(v) => setS({ ...S, ch: v as Ch })} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Send to</span><Pills small opts={Object.keys(REACH).map((a) => [a, a] as [string, string])} value={S.aud} onChange={(v) => setS({ ...S, aud: v })} /></div>
          <span className="text-sm"><b>{n.toLocaleString('en-GB')}</b> customers opted in to {S.ch} in this segment</span>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Message<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Weekend deal at Ebenezer Unique Ventures: 5% off TCL and Samsung TVs until Sunday…" className="p-3 rounded-2xl border border-line font-normal text-sm" /><span className="text-xs text-muted font-normal">{note}</span></label>
          <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-1.5"><b className="text-xs text-muted">Preview · {S.ch}</b><span className="text-sm whitespace-pre-wrap">{body}</span><span className="text-xs text-muted">Reply STOP to opt out</span><span className="text-xs text-muted">From: {SENDER[S.ch]}</span></div>
          <span className="text-xs text-muted">Only customers who opted in to {S.ch} (Customers → marketing consent) are messaged. A STOP reply removes consent automatically.</span>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={sendNow} disabled={!!sending} className="btn-primary disabled:opacity-80">{sending ? `Sending to ${sending.toLocaleString('en-GB')} customers` : 'Send now'}</button>
            <button onClick={() => setSched({ ...sched, open: !sched.open })} aria-expanded={sched.open} className="btn-ghost">Schedule</button>
          </div>
          {sched.open && <div className="flex gap-2 flex-wrap items-end rounded-2xl bg-canvas p-3"><label className="text-xs font-semibold flex flex-col gap-1">Send on<input type="datetime-local" value={sched.at} onChange={(e) => setSched({ ...sched, at: e.target.value })} className={inp} /></label><button onClick={schedule} className="btn-dark">Schedule for {n.toLocaleString('en-GB')} customers</button></div>}
        </Card>
        <Card title="Messaging providers" sub="Receipts, OTP codes and order updates">
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">SMS provider</span><Pills small opts={[['Hubtel', 'Hubtel'], ['mNotify', 'mNotify'], ['Arkesel', 'Arkesel'], ['Twilio', 'Twilio']]} value={S.prov} onChange={(v) => setS({ ...S, prov: v })} /></div>
          {['SMS sender ID: EBENEZERUV · approved', 'WhatsApp Business: +233 24 000 1111 · connected', 'Email: hello@ebenezerunique.com.gh · verified'].map((t) => <span key={t} className="text-sm">✅ {t}</span>)}
          <div className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-1"><b>Abandoned basket reminders</b><span className="text-muted">WhatsApp after 1 hour, SMS after 24 hours, only to opted-in shoppers.</span><span><b>41</b> baskets recovered this month</span></div>
        </Card>
      </div>
      <Card title="Campaigns"><T head={['Campaign', 'Channel', 'Sent to', 'Orders from it', 'Status']} rows={C.map((c) => [c.name, c.ch, c.sent ? c.sent.toLocaleString('en-GB') : '—', c.orders ? String(c.orders) : '—', <span key="s" className={cx('pill', c.status.startsWith('Sent ') ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{c.status}</span>])} /><span className="text-xs text-muted">Orders from it: online and till orders that used the campaign’s link or discount code.</span></Card>
      {ADMIN && <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card title="Promotions (till and website)" actions={<button onClick={() => setNp({ name: '', type: '% off', value: '', brs: BRS.map((b) => b.id), till: true, web: true, from: '', to: '', t1: '', t2: '' })} className="text-sm font-semibold text-brand">+ New promotion</button>}>
          {P.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{p.name}</b><br /><span className="text-muted text-xs">{p.rule}</span></span><Switch on={p.on} onChange={() => { setP((x) => x.map((y) => (y.id === p.id ? { ...y, on: !y.on } : y))); setMsg(`${p.name} ${p.on ? 'switched off' : 'switched on'} at the till and online`); }} label={p.name} /></div>)}
          {np && (
            <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
              <b className="text-sm">New promotion</b>
              <label className="text-xs font-semibold flex flex-col gap-1">Name<input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. 10% off air conditioners" className={inp} /></label>
              <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold">Type</span><Pills small opts={PTYPES.map((t) => [t, t] as [string, string])} value={np.type} onChange={(v) => setNp({ ...np, type: v })} /></div>
              <label className="text-xs font-semibold flex flex-col gap-1">{np.type === '% off' ? 'Percentage off' : np.type === 'Fixed price bundle' ? 'Bundle price (GHS)' : np.type === 'Buy X get Y' ? 'The deal' : 'Free delivery over (GHS, optional)'}<input value={np.value} onChange={(e) => setNp({ ...np, value: e.target.value })} placeholder={np.type === 'Buy X get Y' ? 'e.g. Buy 2 fans, get 1 free' : ''} className={inp} /></label>
              <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold">Branches</span><div className="flex gap-1.5 flex-wrap">{BRS.map((b) => <button key={b.id} type="button" aria-pressed={np.brs.includes(b.id)} onClick={() => setNp({ ...np, brs: np.brs.includes(b.id) ? np.brs.filter((x) => x !== b.id) : [...np.brs, b.id] })} className={cx('h-8 px-3 rounded-full text-xs border', np.brs.includes(b.id) ? 'bg-black text-white border-black' : 'border-line')}>{b.name}</button>)}</div></div>
              <div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={np.till} onChange={() => setNp({ ...np, till: !np.till })} />Till</label><label className="flex items-center gap-2"><input type="checkbox" checked={np.web} onChange={() => setNp({ ...np, web: !np.web })} />Website</label></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold flex flex-col gap-1">Starts<input type="date" value={np.from} onChange={(e) => setNp({ ...np, from: e.target.value })} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Ends<input type="date" value={np.to} onChange={(e) => setNp({ ...np, to: e.target.value })} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Daily from (optional)<input type="time" value={np.t1} onChange={(e) => setNp({ ...np, t1: e.target.value })} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Until<input type="time" value={np.t2} onChange={(e) => setNp({ ...np, t2: e.target.value })} className={inp} /></label></div>
              <div className="flex gap-2"><button onClick={savePromo} className="btn-primary">Save promotion</button><button onClick={() => setNp(null)} className="btn-ghost">Cancel</button></div>
            </div>
          )}
        </Card>
        {/* Each channel opens a setup form when switched on and goes live only after Activate (Channels.tsx). */}
        <SellChannels say={setMsg} />
      </div>}
    </>
  );
}
