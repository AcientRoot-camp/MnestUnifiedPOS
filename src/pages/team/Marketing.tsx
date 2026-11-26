import { useState } from 'react';
import { cx } from '../../lib/format';
import { usePersist } from '../../lib/persist';
import { Card, Pills, T } from '../finance/shared';
import { Head, Msg, Switch } from '../money/ui';

type Camp = { name: string; ch: string; to: string; sent: number; orders: number; status: string };
const C0: Camp[] = [{ name: 'Black Friday', ch: 'SMS + WhatsApp', to: 'All opted-in', sent: 3102, orders: 214, status: 'Sent' }, { name: 'Back to school', ch: 'WhatsApp', to: 'Families', sent: 840, orders: 61, status: 'Sent' }, { name: 'Christmas hampers', ch: 'SMS', to: 'Wholesale', sent: 0, orders: 0, status: 'Scheduled · 1 Dec 09:00' }];
const AUD: Record<string, number> = { 'All opted-in': 2140, 'Bought in last 30 days': 860, Wholesale: 310, Families: 840, 'Owes money': 6 };

export default function Marketing() {
  const [ch, setCh] = useState('SMS');
  const [to, setTo] = useState('All opted-in');
  const [text, setText] = useState('Weekend deal at Ebenezer Unique Ventures: 10% off TCL and Samsung TVs until Sunday. Shop: ebenezerunique.com.gh');
  const [from, setFrom] = useState('EBENEZERUV');
  const [when, setWhen] = useState('');
  const [C, setC] = usePersist<Camp[]>('ecompos.campaigns2', C0);
  const [promo, setPromo] = usePersist<Record<string, boolean>>('ecompos.promos2', { rice: true, fans: true, bundle: false });
  const [chans, setChans] = usePersist<Record<string, boolean>>('ecompos.channels2', { gshop: true, meta: true, tiktok: false, jumia: true, tonaton: false });
  const [msg, setMsg] = useState('');
  const full = `${text}${ch !== 'Email' ? ' · Reply STOP to opt out' : ''}`;
  const send = (sched: boolean) => { if (text.trim().length < 10) return setMsg('Write the message first.'); setC((x) => [{ name: text.slice(0, 28) + '…', ch, to, sent: sched ? 0 : AUD[to], orders: 0, status: sched ? `Scheduled · ${when ? new Date(when).toLocaleString('en-GB') : 'tomorrow 09:00'}` : 'Sent' }, ...x]); setMsg(sched ? 'Campaign scheduled' : `Sent to ${AUD[to].toLocaleString()} opted-in customers`); };
  return (
    <>
      <Head title="Marketing & sales channels" sub="Message opted-in customers, run promotions and list your catalogue where people shop" />
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr] items-start">
        <Card title="New campaign">
          <Pills small opts={[['SMS', 'SMS'], ['WhatsApp', 'WhatsApp'], ['Email', 'Email']]} value={ch} onChange={setCh} />
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Send to</span><Pills small opts={Object.keys(AUD).map((a) => [a, `${a} · ${AUD[a].toLocaleString()}`] as [string, string])} value={to} onChange={setTo} /></div>
          <label className="text-[13px] font-semibold flex flex-col gap-1">Message<textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} className="p-3 rounded-2xl border border-line font-normal text-sm" /><span className="text-xs text-muted font-normal">{full.length} characters · {ch === 'SMS' ? `${Math.ceil(full.length / 160)} SMS each` : ch}</span></label>
          <div className="p-3 rounded-2xl bg-[#e3f2fd] text-sm">Preview · {full}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">From:</span><Pills small opts={[['EBENEZERUV', 'EBENEZERUV (SMS)'], ['+233 24 000 1111', 'WhatsApp +233 24 000 1111']]} value={from} onChange={setFrom} /></div>
          <div className="flex gap-2 flex-wrap items-end"><button onClick={() => send(false)} className="btn-primary">Send now</button><label className="text-xs font-semibold flex flex-col gap-1">Or pick a time<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal" /></label><button onClick={() => send(true)} className="btn-ghost">Schedule</button></div>
        </Card>
        <Card title="Messaging providers" sub="Receipts, OTP codes and order updates">
          {['SMS sender ID: EBENEZERUV · approved', 'WhatsApp Business: +233 24 000 1111 · connected', 'Email: hello@ebenezerunique.com.gh · verified'].map((t) => <span key={t} className="text-sm">✅ {t}</span>)}
          <div className="p-3 rounded-2xl bg-canvas text-sm"><b>Abandoned basket reminders</b><br /><span className="text-muted">WhatsApp after 1 hour, SMS after 24 hours, only to opted-in shoppers.</span><br /><b>23</b> baskets recovered this month</div>
        </Card>
      </div>
      <Card title="Campaigns"><T head={['Campaign', 'Channel', 'Sent to', 'Orders from it', 'Status']} rows={C.map((c) => [c.name, c.ch, c.sent ? `${c.sent.toLocaleString()} · ${c.to}` : c.to, String(c.orders), <span key="s" className={cx('pill', c.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{c.status}</span>])} /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Promotions (till and website)">{[['rice', 'Free wall mounting with any TV 43" or bigger', 'Till and website · until Sunday'], ['fans', '10% off standing fans', 'Till and website · this month'], ['bundle', 'TV + DStv HD kit bundle, save GHS 300', 'Website only']].map(([k, n, d]) => <div key={k} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{n}</b><br /><span className="text-xs text-muted">{d}</span></span><Switch on={!!promo[k]} onChange={() => setPromo({ ...promo, [k]: !promo[k] })} label={n} /></div>)}</Card>
        <Card title="Sell on other channels">{[['gshop', 'Google Shopping', 'Free listings from your catalogue'], ['meta', 'Facebook & Instagram Shop', 'Synced every hour'], ['tiktok', 'TikTok Shop', 'Not connected'], ['jumia', 'Jumia', 'Orders arrive in Orders'], ['amazon', 'Amazon & eBay', 'Sell abroad · listings synced daily'], ['tonaton', 'Tonaton', 'Not connected']].map(([k, n, d]) => <div key={k} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{n}</b><br /><span className="text-xs text-muted">{d}</span></span><Switch on={!!chans[k]} onChange={() => setChans({ ...chans, [k]: !chans[k] })} label={n} /></div>)}<span className="text-xs text-muted">Meta, TikTok and Google tags load only after visitors accept cookies. Every product has a share link and a printable QR code.</span></Card>
      </div>
    </>
  );
}
