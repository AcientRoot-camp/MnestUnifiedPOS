import { useState } from 'react';
import { CUSTOMERS, type Customer } from '../../data/sell';
import { SEED as HP } from '../../data/hirePurchase';
import { PEOPLE } from '../../data/nav';
import { cx } from '../../lib/format';
import { usePersist, nowTxt } from '../../lib/persist';
import { useSession } from '../../lib/session';
import { Card, Pills } from '../finance/shared';
import { download, Head, Msg, Switch } from '../money/ui';

type Tab = 'send' | 'auto' | 'occ' | 'log';
type Out = { at: string; by: string; via: string; to: string; n: number; kind: string; text: string; status: string };
const TPL: [string, string, string][] = [
  ['', 'Write my own', ''],
  ['thanks', 'Thank you', 'Hello {name}, thank you for shopping with {business}. We hope to see you again soon.'],
  ['stock', 'New stock', 'Hello {name}, new stock has arrived at {business}. Come and see us or order on WhatsApp {phone}.'],
  ['promo', 'Promotion', 'Hello {name}, this week only: use code {code} for 10% off at {business}. Reply STOP to opt out.'],
  ['remind', 'Payment reminder', 'Hello {name}, a reminder that {amount} is due on {due}. Pay by MoMo to {phone}. Thank you, {business}.'],
  ['hours', 'Opening hours', 'Hello {name}, {business} is open Mon–Sat 8:00–20:00 and Sun 12:00–18:00. Call {phone} any time.'],
];
const PH = ['{name}', '{business}', '{phone}', '{amount}', '{due}', '{code}'];
const AUTO: [string, string, string, string][] = [
  ['sale', 'Sales', 'Receipt after every sale', 'Thank you {name}. Receipt {receipt}: {amount} paid. {business}'],
  ['credit', 'Credit', 'When a credit sale is made', 'Hello {name}, {amount} is on your account. Due by {due}. {business}'],
  ['hp', 'Hire purchase', 'When an instalment is received', 'Thank you {name}. Instalment received: {amount}. Balance {balance}. {business}'],
  ['proforma', 'Pro-forma', 'When a pro-forma is sent', 'Hello {name}, your quotation is ready: {amount}. Valid until {due}.'],
  ['payment', 'Payments', 'When a MoMo or card payment is confirmed', 'Hello {name}, we received {amount}. Thank you, {business}.'],
  ['order', 'Orders', 'When an online order changes status', 'Hello {name}, order {order} is now {status}. Track it at {link}.'],
];
const OCC0: [string, string][] = [['New Year’s Day', '1 Jan'], ['Constitution Day', '7 Jan'], ['Independence Day', '6 Mar'], ['Easter', 'Apr'], ['May Day', '1 May'], ['Eid al-Fitr', 'varies'], ['Republic Day', '1 Jul'], ['Founders’ Day', '4 Aug'], ['Kwame Nkrumah Memorial Day', '21 Sep'], ['Farmers’ Day', '5 Dec'], ['Christmas', '25 Dec'], ['Boxing Day', '26 Dec']];

export default function Messages() {
  const { session } = useSession();
  const me = PEOPLE[session?.role ?? 'staff'].name;
  const [tab, setTab] = useState<Tab>('send');
  const [customers] = usePersist<Customer[]>('ecompos.customers2', CUSTOMERS);
  const [by, setBy] = useState('SMS');
  const [to, setTo] = useState<'pick' | 'all' | 'owing' | 'hp'>('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [tpl, setTpl] = useState('');
  const [subj, setSubj] = useState('');
  const [text, setText] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState('');
  const [auto, setAuto] = usePersist<Record<string, { sms: boolean; email: boolean; text: string }>>('ecompos.autoMsg3', Object.fromEntries(AUTO.map(([k, , , t]) => [k, { sms: true, email: k === 'proforma', text: t }])));
  const [rem, setRem] = usePersist('ecompos.reminders3', { on: true, when: ['1 week before', 'On the due day'] as string[], via: 'SMS & email' });
  const [occ, setOcc] = usePersist<Record<string, boolean>>('ecompos.occasions2', { Christmas: true, 'New Year’s Day': true, 'Independence Day': true });
  const [mine, setMine] = usePersist<[string, string][]>('ecompos.myOccasions', []);
  const [nOcc, setNOcc] = useState({ name: '', date: '' });
  const [out, setOut] = usePersist<Out[]>('ecompos.smsOutbox', []);
  const [lf, setLf] = useState({ via: 'all', kind: 'all', q: '' });
  const [msg, setMsg] = useState('');
  const hpNames = HP.filter((a) => a.state === 'active').map((a) => a.customer);
  const recips = to === 'all' ? customers.filter((c) => (by === 'Email' ? c.email && c.email_ok : c.sms)) : to === 'owing' ? customers.filter((c) => c.credits.some((k) => k.total > k.paid)) : to === 'hp' ? customers.filter((c) => hpNames.includes(c.name)) : customers.filter((c) => picked.includes(c.id));
  const fill = (t: string, c?: Customer) => t.replace(/{name}/g, (c?.name || 'Ama').split(' ')[0]).replace(/{business}/g, 'Ebenezer Unique Ventures').replace(/{phone}/g, '0244 000 111').replace(/{amount}/g, c ? `GHS ${c.credits.reduce((a, k) => a + Math.max(0, k.total - k.paid), 0).toFixed(2)}` : 'GHS 120.00').replace(/{due}/g, c?.credits.find((k) => k.total > k.paid)?.due || '30 Nov').replace(/{code}/g, 'EUV10');
  const hits = q.trim() ? customers.filter((c) => (c.name + c.phone).toLowerCase().includes(q.toLowerCase()) && !picked.includes(c.id)).slice(0, 6) : [];
  const dueSoon = HP.filter((a) => a.state === 'active').slice(0, 3);
  const log = out.filter((o) => (lf.via === 'all' || o.via.includes(lf.via)) && (lf.kind === 'all' || o.kind === lf.kind) && (!lf.q || `${o.to} ${o.text}`.toLowerCase().includes(lf.q.toLowerCase())));
  const send = () => {
    if (!recips.length) return setMsg('Choose who should get it.');
    if (text.trim().length < 5) return setMsg('Write the message.');
    if (by !== 'SMS' && !subj.trim()) return setMsg('Add an email subject.');
    if (when === 'later' && !at) return setMsg('Pick when to send it.');
    setOut([{ at: when === 'later' ? at.replace('T', ' ') : nowTxt(), by: me, via: by === 'Both' ? 'SMS & email' : by, to: recips.length === 1 ? recips[0].name : `${recips.length} customers`, n: recips.length, kind: tpl ? TPL.find((t) => t[0] === tpl)![1] : 'Custom', text: fill(text, recips[0]), status: when === 'later' ? 'Scheduled' : 'Sent' }, ...out]);
    setMsg(`${when === 'later' ? 'Scheduled' : 'Sent'} to ${recips.length} customer${recips.length === 1 ? '' : 's'} by ${by === 'Both' ? 'SMS & email' : by}`); setText(''); setSubj(''); setTpl('');
  };
  return (
    <>
      <Head title="SMS & email" sub="Message customers at any time, and send automatic notifications for sales, credit, hire purchase, pro-forma invoices, payments, orders and special occasions." />
      <Pills opts={[['send', 'Send a message'], ['auto', 'Automatic messages'], ['occ', 'Occasions & holidays'], ['log', `Message log · ${out.length}`]]} value={tab} onChange={setTab} />
      <Msg text={msg} onClose={() => setMsg('')} />
      {tab === 'send' && (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr] items-start">
          <Card title="Send a message">
            <span className="text-[13px] font-semibold">1 · Send by</span><Pills small opts={[['SMS', 'SMS'], ['Email', 'Email'], ['Both', 'SMS & email']]} value={by} onChange={setBy} />
            <span className="text-[13px] font-semibold">2 · To</span><Pills small opts={[['pick', 'Choose customers'], ['all', 'All customers'], ['owing', 'Owing on credit'], ['hp', 'Hire purchase customers']]} value={to} onChange={setTo} />
            {to === 'pick' && <><input aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers by name or phone" className="field py-2" />{hits.map((c) => <button key={c.id} onClick={() => { setPicked([...picked, c.id]); setQ(''); }} className="text-left text-sm p-2 rounded-xl hover:bg-canvas">{c.name} · {c.phone}</button>)}<div className="flex gap-1.5 flex-wrap">{picked.map((id) => { const c = customers.find((x) => x.id === id); return c ? <span key={id} className="pill bg-canvas">{c.name} <button aria-label={`Remove ${c.name}`} onClick={() => setPicked(picked.filter((x) => x !== id))}>×</button></span> : null; })}</div></>}
            <span className="text-xs text-muted">{recips.length} customer{recips.length === 1 ? '' : 's'} will get this{to === 'all' ? ' (only those who agreed to messages)' : ''}</span>
            <span className="text-[13px] font-semibold">3 · Message</span>
            <div className="flex gap-1.5 flex-wrap"><span className="text-xs self-center">Start from a template</span>{TPL.map(([k, l, t]) => <button key={k} aria-pressed={tpl === k} onClick={() => { setTpl(k); setText(t); }} className={cx('text-xs px-3 py-1.5 rounded-full border', tpl === k ? 'bg-black text-white border-black' : 'border-line')}>{l}</button>)}</div>
            {by !== 'SMS' && <label className="text-xs font-semibold flex flex-col gap-1">Email subject<input value={subj} onChange={(e) => setSubj(e.target.value)} placeholder="e.g. New stock has arrived" className="field py-2 font-normal" /></label>}
            <label className="text-xs font-semibold flex flex-col gap-1">Message · {text.length} characters{by !== 'Email' ? ` · ${Math.max(1, Math.ceil(text.length / 160))} SMS` : ''}<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hello {name}, ..." className="p-3 rounded-2xl border border-line font-normal text-sm" /></label>
            <div className="flex gap-1.5 flex-wrap">{PH.map((p) => <button key={p} onClick={() => setText(text + p)} className="text-xs px-2.5 py-1 rounded-full bg-canvas font-mono">{p}</button>)}</div>
            <span className="text-[13px] font-semibold">4 · When to send</span><Pills small opts={[['now', 'Send now'], ['later', 'Schedule']]} value={when} onChange={setWhen} />{when === 'later' && <input aria-label="Send at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="field py-2 w-fit" />}
            <button onClick={send} className="btn-primary w-fit">{when === 'later' ? 'Schedule message' : 'Send message'}</button>
          </Card>
          <Card title="Preview">{text ? <div className="rounded-3xl bg-canvas p-4 text-sm whitespace-pre-line"><span className="text-xs text-muted block mb-1">To {recips[0]?.name || 'customer'}{by !== 'SMS' && subj ? ` · ${subj}` : ''}</span>{fill(text, recips[0])}</div> : <span className="text-sm text-muted">Pick a template or write a message to see how it looks.</span>}</Card>
        </div>
      )}
      {tab === 'auto' && (
        <div className="grid gap-6 xl:grid-cols-2 items-start">
          <Card title="Automatic messages" sub="Sent by the system when these things happen">{AUTO.map(([k, area, when2]) => { const a = auto[k] || { sms: false, email: false, text: '' }; return <div key={k} className="p-3 rounded-2xl border border-line flex flex-col gap-2"><div className="flex justify-between items-center gap-2 flex-wrap"><span className="text-sm"><b>{area}</b><br /><span className="text-xs text-muted">{when2}</span></span><span className="flex gap-3 items-center text-xs">SMS <Switch on={a.sms} onChange={() => setAuto({ ...auto, [k]: { ...a, sms: !a.sms } })} label={`${area} by SMS`} /> Email <Switch on={a.email} onChange={() => setAuto({ ...auto, [k]: { ...a, email: !a.email } })} label={`${area} by email`} /></span></div><textarea rows={2} value={a.text} onChange={(e) => setAuto({ ...auto, [k]: { ...a, text: e.target.value } })} aria-label={`${area} message`} className="p-2 rounded-xl border border-line text-xs" /></div>; })}</Card>
          <Card title="Payment reminders" sub="Hire purchase instalments and credit sale balances">
            <div className="flex justify-between items-center"><span className="text-sm font-semibold">Send reminders automatically</span><Switch on={rem.on} onChange={() => setRem({ ...rem, on: !rem.on })} label="Payment reminders" /></div>
            <span className="text-[13px] font-semibold">When</span>
            <div className="flex gap-1.5 flex-wrap">{['1 week before', '2 days before', 'On the due day'].map((w) => <button key={w} aria-pressed={rem.when.includes(w)} onClick={() => setRem({ ...rem, when: rem.when.includes(w) ? rem.when.filter((x) => x !== w) : [...rem.when, w] })} className={cx('text-xs px-3 py-1.5 rounded-full border', rem.when.includes(w) ? 'bg-black text-white border-black' : 'border-line')}>{rem.when.includes(w) ? '✓ ' : ''}{w}</button>)}</div>
            <span className="text-[13px] font-semibold">Send by</span><Pills small opts={[['SMS', 'SMS'], ['Email', 'Email'], ['SMS & email', 'SMS & email']]} value={rem.via} onChange={(v) => setRem({ ...rem, via: v })} />
            <span className="text-xs font-semibold">Due soon</span>{dueSoon.map((a) => <span key={a.id} className="text-xs">{a.customer} · {a.id}</span>)}
            <button onClick={() => { setOut([...dueSoon.map((a): Out => ({ at: nowTxt(), by: 'System', via: rem.via, to: a.customer, n: 1, kind: 'Payment reminder', text: `Hello ${a.customer.split(' ')[0]}, your hire purchase instalment on ${a.id} is due soon. Thank you, Ebenezer Unique Ventures.`, status: 'Sent' })), ...out]); setMsg(`${dueSoon.length} due reminders checked and sent`); }} className="btn-dark w-fit min-h-9 text-xs">Check &amp; send due reminders now</button>
          </Card>
        </div>
      )}
      {tab === 'occ' && (
        <Card title="Occasions & holidays" sub="Automatic yearly greetings to customers who agreed to messages">
          <div className="grid gap-2 md:grid-cols-2">{[...OCC0, ...mine].map(([n, d]) => <div key={n} className="flex justify-between items-center p-3 rounded-2xl bg-canvas text-sm"><span><b>{n}</b><br /><span className="text-xs text-muted">{d}</span></span><Switch on={!!occ[n]} onChange={() => setOcc({ ...occ, [n]: !occ[n] })} label={n} /></div>)}</div>
          <span className="text-[13px] font-semibold">Add your own event</span>
          <div className="flex gap-2 flex-wrap items-end"><input value={nOcc.name} onChange={(e) => setNOcc({ ...nOcc, name: e.target.value })} placeholder="e.g. Shop anniversary" aria-label="Event name" className="field py-2" /><input type="date" value={nOcc.date} onChange={(e) => setNOcc({ ...nOcc, date: e.target.value })} aria-label="Event date" className="field py-2 w-44" /><button onClick={() => { if (nOcc.name.trim().length < 3 || !nOcc.date) return setMsg('Add the event name and date.'); const d = new Date(nOcc.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); setMine([...mine, [nOcc.name.trim(), d]]); setOcc({ ...occ, [nOcc.name.trim()]: true }); setNOcc({ name: '', date: '' }); }} className="btn-primary">Add event</button></div>
        </Card>
      )}
      {tab === 'log' && (
        <Card title="Message log" actions={<button onClick={() => download('message-log.csv', [['When', 'By', 'Via', 'To', 'Recipients', 'Type', 'Status', 'Message'], ...log.map((o) => [o.at, o.by, o.via, o.to, o.n, o.kind, o.status, o.text])])} className="btn-ghost min-h-9 text-xs">Download CSV</button>}>
          <div className="flex gap-2 flex-wrap"><select value={lf.via} onChange={(e) => setLf({ ...lf, via: e.target.value })} className="field py-2 w-36" aria-label="Channel"><option value="all">All channels</option><option value="SMS">SMS</option><option value="Email">Email</option></select><select value={lf.kind} onChange={(e) => setLf({ ...lf, kind: e.target.value })} className="field py-2 w-44" aria-label="Type"><option value="all">All types</option>{Array.from(new Set(out.map((o) => o.kind))).map((k) => <option key={k}>{k}</option>)}</select><input value={lf.q} onChange={(e) => setLf({ ...lf, q: e.target.value })} placeholder="Search" aria-label="Search the log" className="field py-2 flex-1 min-w-[160px]" /></div>
          {!log.length && <span className="text-sm text-muted">No messages yet.</span>}
          {log.map((o, i) => <div key={i} className="p-3 rounded-2xl border border-line text-sm flex flex-col gap-1"><div className="flex justify-between gap-2 flex-wrap"><b>{o.to}</b><span className={cx('pill', o.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{o.status}</span></div><span className="text-xs text-muted">{o.at} · {o.via} · {o.kind} · by {o.by}</span><span>{o.text}</span></div>)}
        </Card>
      )}
    </>
  );
}
