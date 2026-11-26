// IT management: integrations, hosting, hardware (scanners, label printers, scales, devices) and HTTP errors.
import { eanOk } from '../../../lib/barcode';
import { BluetoothCheck, DeviceList, LabelPrinters, ScaleSetup, deviceTypesTxt, useDevices } from './Hardware';
import { useState } from 'react';
import { usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { at } from '../../../lib/sec';
import { HTTP, HTTPLOG0, type HttpLog } from './data';
import { B, Chips, Sec, Tag, inp, useDev } from './ui';

type Res = { ic: '✓' | '!' | '⚠'; t: string; fix?: string };
type Item = { id: string; title: string; sub: string; badge?: string };
type St = { v: Record<string, string>; t: Record<string, boolean>; res?: Res[]; list?: Item[]; set?: boolean };
type Field = [key: string, label: string, ph?: string, opts?: string[]];
type Row = { id: string; g: string; title: string; detail: string; fields?: Field[]; toggles?: [string, string][]; actions?: string[]; info?: string[]; switchOnly?: boolean; listTitle?: string; scan?: boolean; code?: string };
const G: [string, string][] = [['int', 'Integrations & API'], ['host', 'Hosting & security'], ['hw', 'Hardware, devices & offline'], ['http', 'HTTP errors & status codes']];

const ROWS: Row[] = [
  { id: 'sms', g: 'int', title: 'SMS', detail: 'Receipts, reminders and sign-in codes by text', fields: [['prov', 'Provider', '', ['Hubtel', 'Arkesel', 'mNotify', "Africa's Talking", 'Twilio']], ['client', 'Client ID', 'e.g. hubtel-client-…'], ['key', 'API key', 'Paste the API key'], ['sender', 'Sender ID (3–11 letters)', 'EBENEZER'], ['test', 'Test number', '24 555 0142']], toggles: [['receipts', 'Receipts by SMS'], ['credit', 'Credit reminders'], ['hp', 'Hire purchase reminders'], ['otp', 'Sign-in codes (OTP)']], actions: ['Send test SMS'] },
  { id: 'email', g: 'int', title: 'Email delivery · Resend', detail: 'Email receipts, invoices and documents', fields: [['key', 'API key', 're_…'], ['domain', 'Sending domain', 'mail.ebenezerunique.com.gh'], ['fromName', 'From name', 'Ebenezer Unique Ventures'], ['from', 'From email', 'receipts@…'], ['reply', 'Reply-to', 'info@…']], toggles: [['receipts', 'Email receipts'], ['credit', 'Credit sale emails'], ['hp', 'Hire purchase documents'], ['pf', 'Pro-forma invoices'], ['greet', 'Occasion greetings'], ['opens', 'Track opens']], actions: ['Verify domain', 'Send test email'] },
  { id: 'keys', g: 'int', title: 'API keys', detail: 'Let other systems read products, orders and stock', fields: [['name', 'Key name', 'e.g. Website sync'], ['mode', 'Mode', '', ['Live', 'Test']], ['scopes', 'Scopes', 'products, orders, stock']], actions: ['Create key'], listTitle: 'Keys' },
  { id: 'hooks', g: 'int', title: 'Webhooks', detail: 'Tell another system when something happens', fields: [['url', 'Endpoint URL', 'https://example.com/hooks/mnestpos'], ['events', 'Events', '', ['order.paid', 'stock.changed', 'order.paid, stock.changed']]], actions: ['Add endpoint'], listTitle: 'Endpoints' },
  { id: 'paystack', g: 'int', title: 'Paystack', detail: 'Cards, MoMo and bank payments online', fields: [['pub', 'Public key', 'pk_live_…'], ['sec', 'Secret key', 'sk_live_…'], ['mode', 'Mode', '', ['Live', 'Test']]], actions: ['Test connection'] },
  { id: 'momo', g: 'int', title: 'Mobile Money', detail: 'MTN MoMo, Telecel Cash, AirtelTigo Money', fields: [['mtn', 'MTN MoMo merchant ID', 'e.g. 0244000111'], ['tel', 'Telecel Cash merchant ID', ''], ['at', 'AirtelTigo Money merchant ID', ''], ['test', 'Test number', '24 555 0142']], toggles: [['prompt', 'Send payment prompts'], ['auto', 'Auto-detect approvals']], actions: ['Send test prompt'] },
  { id: 'acct', g: 'int', title: 'Accounting', detail: 'Xero, QuickBooks Online or Sage Business Cloud', fields: [['sys', 'System', '', ['Xero', 'QuickBooks Online', 'Sage Business Cloud']], ['sales', 'Account code for sales', '200'], ['vat', 'Account code for VAT/levies', '820'], ['sync', 'Sync', '', ['Daily', 'Weekly', 'After every update']]], toggles: [['s', 'Send sales'], ['v', 'Send VAT/NHIL/GETFund'], ['p', 'Send payouts/fees']], actions: ['Sync now'] },
  { id: 'migrate', g: 'int', title: 'Move from another system', detail: 'Import products and customers', fields: [['from', 'Import from', '', ['Shopify', 'WooCommerce', 'Square', 'Lightspeed', 'CSV file']], ['file', 'File name', 'products.csv']], actions: ['Check file', 'Import'] },
  { id: 'zap', g: 'int', title: 'Zapier / Make', detail: 'Connect to thousands of apps', fields: [['hook', 'Catch hook URL', 'https://hooks.zapier.com/…'], ['trig', 'Trigger', '', ['New sale', 'New online order', 'Low stock']]], actions: ['Send test'] },
  { id: 'hr', g: 'int', title: 'HR system', detail: 'Share staff records, roles and hours', toggles: [['staff', 'Share staff records'], ['roles', 'Share roles'], ['hours', 'Share hours worked']] },
  { id: 'gql', g: 'int', title: 'GraphQL & headless', detail: 'Build your own storefront', fields: [['origins', 'Allowed origins', 'https://shop.ebenezerunique.com.gh']], actions: ['Issue token'], code: 'POST https://api.mnestpos.app/graphql\nAuthorization: Bearer <token>' },
  { id: 'domain', g: 'host', title: 'Custom domain', detail: 'Use your own address for the online store', fields: [['d', 'Domain', 'shop.ebenezerunique.com.gh']], actions: ['Add domain', 'Verify DNS'] },
  { id: 'loc', g: 'host', title: 'Data location', detail: 'Hosted in the EU · Africa-region hosting on Pro', fields: [['r', 'Region', '', ['EU (Ireland)', 'Africa (Cape Town) · Pro']]], actions: ['Schedule a move'], info: ['A move takes about 15 minutes. Tills keep selling offline while it runs.'] },
  { id: 'status', g: 'host', title: 'System status', detail: 'status.mnestpos.app · 99.9% uptime target', info: ['Last 90 days: 99.96% uptime', 'No incidents in the last 30 days'] },
  { id: 'sectest', g: 'host', title: 'Security testing', detail: 'Annual penetration test · report on request', fields: [['auto', 'Keep testing automatically', '', ['Daily', 'Weekly', 'After every update']]], actions: ['Run security & function test now'] },
  { id: 'ssl', g: 'host', title: 'SSL certificates', detail: 'Auto-renew · valid for 68 more days', toggles: [['auto', 'Renew automatically']] },
  { id: 'printers', g: 'hw', title: 'Receipt printers', detail: '80 mm network and 58 mm Bluetooth', fields: [['ip', '80 mm printer IP', '192.168.1.40'], ['bt', '58 mm Bluetooth name', 'MPT-II']], actions: ['Print test page'] },
  { id: 'scanners', g: 'hw', title: 'Barcode scanners', detail: 'USB and Bluetooth scanners plus phone camera', scan: true },
  { id: 'drawers', g: 'hw', title: 'Cash drawers', detail: 'Opened by the printer', actions: ['Open drawer'] },
  { id: 'labels', g: 'hw', title: 'Label printers', detail: 'Shelf and barcode labels' },
  { id: 'scale', g: 'hw', title: 'Weighing scale', detail: 'For goods sold by weight (none in the current range)' },
  { id: 'offline', g: 'hw', title: 'Offline selling', detail: 'Tills keep a local copy and sync later', switchOnly: true },
  { id: 'data', g: 'hw', title: 'Save mobile data', detail: 'Smaller images and fewer background syncs', switchOnly: true },
  { id: 'power', g: 'hw', title: 'Power-cut protection', detail: 'Every sale is saved on the device first', switchOnly: true },
  { id: 'devices', g: 'hw', title: 'Devices', detail: 'Supported: Android 9+ with 2 GB RAM, iPad, Windows, web', actions: ['Check all devices'], listTitle: 'Registered devices' },
];
const DEV0: Item[] = [{ id: 'd1', title: 'Osu Till 1 · Sunmi T2', sub: 'Android 11 · last seen 1 min ago', badge: 'Online' }, { id: 'd2', title: 'Osu Till 2 · Sunmi T2', sub: 'Android 11 · last seen 47 min ago', badge: 'Offline' }, { id: 'd3', title: 'East Legon Till 1 · Sunmi V2', sub: 'Android 9 · last seen 2 min ago', badge: 'Online' }, { id: 'd4', title: 'Adum Till 1 · iPad', sub: 'iPadOS 17 · last seen 5 min ago', badge: 'Online' }, { id: 'd5', title: 'Adum Till 2 · Windows', sub: 'Chrome · last seen 3 min ago', badge: 'Online' }];
const IT0: Record<string, St> = {
  sms: { v: { prov: 'Hubtel', sender: 'EBENEZER' }, t: { receipts: true, credit: true, hp: true, otp: true } },
  email: { v: {}, t: { receipts: true } },
  keys: { v: { mode: 'Live' }, t: {}, list: [{ id: 'k1', title: 'Website sync · ek_live_••••3f9a', sub: 'Live · products, orders, stock · created 2 Mar 2026', badge: 'Active' }] },
  hooks: { v: {}, t: {}, list: [{ id: 'w1', title: 'https://erp.ebenezerunique.com.gh/hooks', sub: 'order.paid, stock.changed · secret ••••8c1d', badge: 'Active' }] },
  paystack: { v: { pub: 'pk_live_••••a12b', sec: 'sk_live_••••9e4f', mode: 'Live' }, t: {}, set: true },
  momo: { v: { mtn: '0244000111' }, t: { prompt: true, auto: true }, set: true },
  offline: { v: {}, t: { on: true } }, power: { v: {}, t: { on: true } }, data: { v: {}, t: { on: false } }, ssl: { v: {}, t: { auto: true } },
  hr: { v: {}, t: {} }, devices: { v: {}, t: {}, list: DEV0 },
};

function test(r: Row, a: string, s: St): Res[] {
  const v = s.v;
  const need = (k: string, label: string): Res | null => (!v[k]?.trim() ? { ic: '!', t: `${label} is missing`, fix: `Paste the ${label.toLowerCase()} from the provider’s dashboard.` } : null);
  const out = (...x: (Res | null)[]) => { const r2 = x.filter(Boolean) as Res[]; return r2; };
  if (r.id === 'sms') { const e = out(need('key', 'API key'), v.sender && !/^[A-Za-z0-9]{3,11}$/.test(v.sender) ? { ic: '!', t: 'Sender ID must be 3–11 letters or numbers', fix: 'Use a short name like EBENEZER.' } : null, (v.test || '').replace(/\D/g, '').replace(/^0/, '').length !== 9 ? { ic: '!', t: 'Test number needs 9 digits after +233', fix: 'Type it without the first 0.' } : null); return e.length ? e : [{ ic: '✓', t: `Test SMS delivered through ${v.prov || 'Hubtel'} · “Test from ${v.sender || 'MNest UnifiedPOS'}”` }, { ic: '⚠', t: 'Sender ID still waiting for NCA approval', fix: 'Messages show as “Info” until the sender ID is approved (1–3 days).' }]; }
  if (r.id === 'email') { const e = out(need('key', 'API key'), need('domain', 'Sending domain')); if (e.length) return e; return a === 'Verify domain' ? [{ ic: '✓', t: `SPF and DKIM found for ${v.domain}` }, { ic: '⚠', t: 'DMARC record not found', fix: `Add a TXT record _dmarc.${v.domain} with “v=DMARC1; p=none”.` }] : [{ ic: '✓', t: `Test email sent from ${v.from || 'receipts@' + v.domain} · delivered in 1.2 s` }]; }
  if (r.id === 'paystack') { const e = out(need('pub', 'Public key'), need('sec', 'Secret key')); return e.length ? e : [{ ic: '✓', t: `${v.mode || 'Live'} keys valid · account Ebenezer Unique Ventures` }, { ic: '✓', t: 'Webhook reached the server in 180 ms' }]; }
  if (r.id === 'momo') { if (!v.mtn && !v.tel && !v.at) return [{ ic: '!', t: 'No merchant ID set', fix: 'Add at least the MTN MoMo merchant ID.' }]; return [{ ic: '✓', t: 'MTN MoMo prompt delivered and approved in 9 s' }, { ic: '⚠', t: 'Telecel Cash timeouts at 30% this morning', fix: 'Offer MTN MoMo or cash if a Telecel prompt does not arrive within 60 seconds.' }]; }
  if (r.id === 'acct') return [{ ic: '✓', t: `Synced 214 sales and VAT/NHIL/GETFund to ${v.sys || 'Xero'} · account ${v.sales || '200'}` }];
  if (r.id === 'migrate') return a === 'Check file' ? (v.file ? [{ ic: '✓', t: `${v.file}: 1,214 products, 12 columns recognised` }, { ic: '⚠', t: '14 rows have no barcode', fix: 'They import without one; add barcodes later in Products.' }] : [{ ic: '!', t: 'No file chosen', fix: 'Type or choose the export file name.' }]) : [{ ic: '✓', t: `Imported 1,200 products from ${v.from || 'CSV file'} · 14 skipped` }];
  if (r.id === 'zap') return v.hook?.startsWith('https://') ? [{ ic: '✓', t: `Sent a sample “${v.trig || 'New sale'}” to the hook · 200 OK` }] : [{ ic: '!', t: 'Hook URL must start with https://', fix: 'Copy the Catch Hook URL from Zapier or Make.' }];
  if (r.id === 'gql') return [{ ic: '✓', t: `Token issued · gql_••••${Math.random().toString(36).slice(2, 6)} · allowed origins ${v.origins || 'none'}` }];
  if (r.id === 'domain') return !v.d ? [{ ic: '!', t: 'No domain typed', fix: 'Type the address, e.g. shop.yourcompany.com.' }] : a === 'Add domain' ? [{ ic: '✓', t: `${v.d} added · point a CNAME to stores.mnestpos.app` }] : [{ ic: '⚠', t: `CNAME for ${v.d} not found yet`, fix: 'DNS changes can take up to 24 hours. Check again later.' }];
  if (r.id === 'loc') return [{ ic: '✓', t: `Move to ${v.r || 'EU (Ireland)'} scheduled for tonight 02:00 · about 15 minutes` }];
  if (r.id === 'sectest') return [{ ic: '✓', t: 'Sign-in firewall blocked 9 of 9 attack patterns' }, { ic: '✓', t: 'All 48 function tests passed' }, { ic: '⚠', t: 'Edge WAF not connected', fix: 'See Security centre › Code & edge.' }];
  if (r.id === 'printers') return v.ip ? [{ ic: '✓', t: `Test page printed on ${v.ip}` }] : [{ ic: '!', t: 'Printer IP missing', fix: 'Print the printer’s self-test page to find its IP.' }];
  if (r.id === 'drawers') return [{ ic: '✓', t: 'Drawer opened through the receipt printer' }];
  if (r.id === 'labels') return [{ ic: '✓', t: `Test label printed · ${v.size || '40 × 30 mm'}` }];
  if (r.id === 'scale') return [{ ic: '✓', t: 'Scale paired · reads 0.000 kg' }];
  if (r.id === 'devices') return [{ ic: '✓', t: '4 devices online and in sync' }, { ic: '!', t: 'Osu Till 2 offline for 47 min', fix: 'Turn its Wi-Fi off and on, or plug in the network cable.' }];
  return [{ ic: '✓', t: 'Done' }];
}

export default function It({ sub = '' }: { sub?: string }) {
  const { act, locked } = useDev();
  const [S, setS] = usePersist<Record<string, St>>('ecompos.it', IT0);
  const [log, setLog] = usePersist<HttpLog[]>('ecompos.httpLog', HTTPLOG0);
  const [g, setG] = useState<'all' | 'int' | 'host' | 'hw' | 'http'>(sub === 'devices' ? 'hw' : (['int', 'host', 'hw', 'http'].includes(sub) ? sub : 'all') as 'all');
  const [open, setOpen] = useState(sub === 'devices' ? 'devices' : '');
  const [scan, setScan] = useState('');
  const [hq, setHq] = useState('');
  const [lf, setLf] = useState('all');
  const [cls, setCls] = useState('all');
  const st = (id: string): St => { const x = S[id]; return { ...x, v: x?.v || {}, t: x?.t || {} }; };
  const up = (id: string, p: Partial<St>) => setS((M) => ({ ...M, [id]: { ...(M[id] || { v: {}, t: {} }), ...p } }));
  const devs = st('devices').list || [];
  const [hw] = useDevices();
  /** "{n} connected" for the hardware rows backed by the device list (productscan.md §5.2). */
  const hwCount: Record<string, number> = { scanners: hw.filter((d) => d.type === 'Barcode scanner' && d.on).length, labels: hw.filter((d) => d.type === 'Label printer' && d.on).length, scale: hw.filter((d) => d.type === 'Weighing scale' && d.on).length };
  const logAct = (t: string) => act(t, 'IT management');
  const svc = ['paystack', 'momo', 'sms'].filter((k) => st(k).set || (k === 'sms' && st('sms').v.key)).length;
  const doAct = (r: Row, a: string) => {
    if (locked) return;
    const s = st(r.id);
    if (r.id === 'keys' && a === 'Create key') { if (!s.v.name) return up(r.id, { res: [{ ic: '!', t: 'Name the key first', fix: 'e.g. Website sync' }] }); const tail = Math.random().toString(16).slice(2, 6); const mode = (s.v.mode || 'Live').toLowerCase(); up(r.id, { list: [...(s.list || []), { id: 'k' + Date.now(), title: `${s.v.name} · ek_${mode}_••••${tail}`, sub: `${s.v.mode || 'Live'} · ${s.v.scopes || 'products, orders, stock'} · created today`, badge: 'Active' }], res: [{ ic: '✓', t: `Key created · copy it now: ek_${mode}_${Math.random().toString(36).slice(2, 14)}${tail}` }], v: { ...s.v, name: '' } }); return act(`Created API key ${s.v.name}`, 'IT management'); }
    if (r.id === 'hooks' && a === 'Add endpoint') { if (!s.v.url?.startsWith('https://')) return up(r.id, { res: [{ ic: '!', t: 'The endpoint must start with https://', fix: 'Use a secure address.' }] }); up(r.id, { list: [...(s.list || []), { id: 'w' + Date.now(), title: s.v.url, sub: `${s.v.events || 'order.paid'} · secret ••••${Math.random().toString(16).slice(2, 6)}`, badge: 'Active' }], res: [{ ic: '✓', t: 'Endpoint added' }], v: { ...s.v, url: '' } }); return act(`Added webhook ${s.v.url}`, 'IT management'); }
    const res = test(r, a, s);
    up(r.id, { res, set: res.every((x) => x.ic !== '!') ? true : s.set });
    act(`${r.title} · ${a} · ${res.map((x) => x.ic + ' ' + x.t).join(' · ')}`, 'IT management');
  };
  const itemAct = (r: Row, it: Item, a: string) => {
    const s = st(r.id);
    if (a === 'Revoke') up(r.id, { list: (s.list || []).map((x) => (x.id === it.id ? { ...x, badge: 'Revoked' } : x)) });
    if (a === 'Delete' || a === 'Forget') up(r.id, { list: (s.list || []).filter((x) => x.id !== it.id) });
    if (a === 'Ping') up(r.id, { res: [{ ic: '✓', t: `Ping to ${it.title} · 200 OK in 240 ms` }] });
    if (a === 'New secret') up(r.id, { list: (s.list || []).map((x) => (x.id === it.id ? { ...x, sub: x.sub.replace(/••••\w+/, '••••' + Math.random().toString(16).slice(2, 6)) } : x)), res: [{ ic: '✓', t: 'New signing secret issued · update it on the receiving system' }] });
    act(`${r.title} · ${a} · ${it.title}`, 'IT management');
  };
  const itemActs = (r: Row, it: Item) => (r.id === 'keys' ? (it.badge === 'Revoked' ? ['Delete'] : ['Revoke', 'Delete']) : r.id === 'hooks' ? ['Ping', 'New secret', 'Delete'] : ['Forget']);
  const regSeen = (c: number) => log.filter((l) => l.code === c).length;
  const logShown = log.filter((l) => (lf === 'all' || String(l.code)[0] === lf) && (!hq || `${l.code} ${l.reason} ${l.msg} ${l.page}`.toLowerCase().includes(hq.toLowerCase())));
  const reg = HTTP.filter(([c, r, , u]) => (cls === 'all' || String(c)[0] === cls) && (!hq || `${c} ${r} ${u}`.toLowerCase().includes(hq.toLowerCase())));
  const csv = () => { const rows = [['Code', 'Reason', 'Message', 'Page', 'User', 'Time'], ...log.map((l) => [l.code, l.reason, l.msg, l.page, l.by, new Date(l.ts).toISOString()])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'mnestpos-http-errors.csv'; a.click(); act('Downloaded the HTTP error log', 'IT management'); };
  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap"><Chips value={g} onChange={setG} opts={[['all', 'All'], ...G] as [typeof g, string][]} /><span className="text-sm text-muted">{devs.length} devices ({devs.filter((x) => x.badge === 'Offline').length} offline) · {svc} of 3 payment &amp; SMS services set up</span></div>
      {(g === 'all' || g === 'http') && (
        <div className="grid gap-5 xl:grid-cols-2 items-start">
          <Sec id="http-h" title="Errors shown to users" sub={`${log.length} recorded`} actions={<><button onClick={csv} className={B.sm}>Download CSV</button><button onClick={() => { setLog([]); act('Cleared the HTTP error log', 'IT management'); }} className={B.sm}>Clear log</button></>}>
            <p className="m-0 text-sm text-sub">Every error message in MNest UnifiedPOS shows the matching status code from the IANA HTTP Status Code Registry, e.g. “401 Unauthorized · Wrong PIN”. Each one is recorded here.</p>
            <div className="flex gap-2 flex-wrap"><input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Search code, reason, message or screen" aria-label="Search status codes and errors" className={cx(inp, 'flex-1 min-w-[200px]')} /><select value={lf} onChange={(e) => setLf(e.target.value)} aria-label="Filter errors by status" className={cx(inp, 'w-40')}><option value="all">All errors</option><option value="4">4xx · client</option><option value="5">5xx · server</option></select></div>
            {!logShown.length && <span className="text-sm text-muted">No errors recorded yet.</span>}
            {logShown.map((l) => <div key={l.id} className="flex gap-3 items-start p-2.5 rounded-2xl bg-canvas text-sm"><Tag t={l.code} tone={l.code >= 500 ? 'bad' : 'warn'} /><span className="flex-1 flex flex-col min-w-0"><span><b>{l.reason}</b> · {l.msg}</span><span className="text-xs text-muted">{l.page} · {l.by} · {at(l.ts)}</span></span></div>)}
          </Sec>
          <Sec id="reg-h" title="HTTP Status Code Registry" sub={`${HTTP.length} codes used by MNest UnifiedPOS · source: IANA`}>
            <Chips value={cls} onChange={setCls} opts={[['all', 'All'], ['2', '2xx Success'], ['3', '3xx Redirection'], ['4', '4xx Client error'], ['5', '5xx Server error']]} />
            <div className="flex flex-col divide-y divide-line">{reg.map(([c, r, ref, u]) => <div key={c} className="flex gap-3 items-center py-2 text-sm"><b className="w-10">{c}</b><span className="flex-1 flex flex-col"><span className="font-medium">{r} <span className="text-xs text-muted">· {['', '', 'Success', 'Redirection', 'Client error', 'Server error'][Math.floor(c / 100)]} · {ref}</span></span><span className="text-xs text-sub">{u}</span></span>{regSeen(c) > 0 && <Tag t={`seen ${regSeen(c)}×`} />}</div>)}</div>
          </Sec>
        </div>
      )}
      {G.filter(([k]) => k !== 'http' && (g === 'all' || g === k)).map(([k, title]) => (
        <Sec key={k} title={title}>
          <div className="flex flex-col divide-y divide-line">
            {ROWS.filter((r) => r.g === k).map((r) => { const s = st(r.id); const isOpen = open === r.id; const status = r.switchOnly ? '' : r.id in hwCount ? `${hwCount[r.id]} connected` : s.set || s.list?.length ? 'Set up' : r.fields ? 'Not set up' : 'Ready'; return (
              <div key={r.id} id={r.id === 'devices' ? 'sub-devices' : undefined} className="py-3 flex flex-col gap-3 scroll-mt-6">
                <div className="flex items-center gap-3 flex-wrap"><span className="flex-1 min-w-[200px] flex flex-col"><strong className="text-sm">{r.title}</strong><span className="text-xs text-muted">{r.detail}</span></span>
                  {r.switchOnly ? <button role="switch" aria-checked={!!s.t.on} aria-label={r.title} onClick={() => { up(r.id, { t: { on: !s.t.on } }); act(`${s.t.on ? 'Turned off' : 'Turned on'} ${r.title}`, 'IT management'); }} className={cx('w-11 h-6 rounded-full p-0.5', s.t.on ? 'bg-ok' : 'bg-[#cfcfcf]')}><span className={cx('block w-5 h-5 rounded-full bg-white transition-transform', s.t.on && 'translate-x-5')} /></button>
                    : <><Tag t={status} tone={status === 'Set up' || /^[1-9]\d* connected/.test(status) ? 'ok' : status === 'Not set up' || status === '0 connected' ? 'warn' : 'mute'} /><button onClick={() => setOpen(isOpen ? '' : r.id)} aria-expanded={isOpen} className={B.sm}>{isOpen ? 'Close' : 'Open'}</button></>}
                </div>
                {isOpen && (
                  <div className="rounded-2xl bg-canvas p-4 flex flex-col gap-3">
                    {r.info?.map((t) => <span key={t} className="text-sm">{t}</span>)}
                    {/* Device lists and set-up for scanners, label printers and scales (pages/admin/dev/Hardware.tsx). */}
                    {r.id === 'scanners' && <><DeviceList type="Barcode scanner" conns={['USB', 'Bluetooth', 'Camera']} act={logAct} /><BluetoothCheck /></>}
                    {r.id === 'labels' && <LabelPrinters act={logAct} />}
                    {r.id === 'scale' && <ScaleSetup act={logAct} />}
                    {r.id === 'devices' && <span className="text-xs text-muted">Device types: {deviceTypesTxt}</span>}
                    {r.listTitle && <div className="flex flex-col gap-2"><strong className="text-sm">{r.listTitle}</strong>{(s.list || []).map((it) => <div key={it.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white flex-wrap"><span className="flex-1 min-w-[180px] flex flex-col"><strong className="text-sm break-all">{it.title}</strong><span className="text-xs text-muted">{it.sub}</span></span>{it.badge && <Tag t={it.badge} tone={it.badge === 'Online' || it.badge === 'Active' ? 'ok' : 'bad'} />}{itemActs(r, it).map((a) => <button key={a} onClick={() => itemAct(r, it, a)} className={B.sm}>{a}</button>)}</div>)}{!(s.list || []).length && <span className="text-xs text-muted">None yet.</span>}</div>}
                    {r.fields && <div className="grid gap-2 sm:grid-cols-2">{r.fields.map(([fk, l, ph, opts]) => <label key={fk} className="flex flex-col gap-1 text-[13px] font-semibold">{l}{opts ? <select value={s.v[fk] || opts[0]} onChange={(e) => up(r.id, { v: { ...s.v, [fk]: e.target.value } })} className={inp}>{opts.map((o) => <option key={o}>{o}</option>)}</select> : <input value={s.v[fk] || ''} onChange={(e) => up(r.id, { v: { ...s.v, [fk]: e.target.value } })} placeholder={ph} autoComplete="off" className={inp} />}</label>)}</div>}
                    {/* Scanner test (productscan.md §5.2): valid EAN/UPC, still reading, or a warning about the scanner set-up. */}
                    {r.scan && <label className="flex flex-col gap-1 text-[13px] font-semibold">Scanner test<input value={scan} onChange={(e) => setScan(e.target.value.trim())} placeholder="Scan a barcode here" autoComplete="off" className="h-12 px-4 rounded-2xl border border-black text-[16px] tracking-[0.08em] font-normal outline-none" /><span className="text-xs font-normal" style={{ color: !scan ? '#5f5c5a' : eanOk(scan) ? '#1f7a2a' : '#b26a00' }}>{!scan ? 'Click in the box and scan any product barcode.' : eanOk(scan) ? `✓ Read ${scan} · valid ${scan.length === 8 ? 'EAN-8' : scan.length === 12 ? 'UPC-A' : 'EAN-13'} barcode. The scanner works.` : /^\d+$/.test(scan) && scan.length < 8 ? `Reading… ${scan}` : `⚠ Read "${scan}" · not a standard EAN/UPC check digit. Fine if it is your own shop code; otherwise set the scanner to add Enter (CR) with no prefix.`}</span></label>}
                    {r.toggles && <div className="grid gap-1.5 sm:grid-cols-2">{r.toggles.map(([tk, l]) => <button key={tk} role="switch" aria-checked={!!s.t[tk]} onClick={() => up(r.id, { t: { ...s.t, [tk]: !s.t[tk] } })} className={cx('flex justify-between items-center px-3 py-2 rounded-xl text-sm', s.t[tk] ? 'bg-green-50' : 'bg-white')}><span>{l}</span><span className="text-xs font-semibold">{s.t[tk] ? 'On' : 'Off'}</span></button>)}</div>}
                    {r.code && <pre className="m-0 p-3 rounded-xl bg-black text-white text-xs overflow-x-auto">{r.code}</pre>}
                    {r.actions && <div className="flex gap-2 flex-wrap">{r.actions.map((a) => <button key={a} disabled={locked} onClick={() => doAct(r, a)} className={B.dark}>{a}</button>)}</div>}
                    {s.res && s.res.length > 0 && <div role="status" className="flex flex-col gap-1.5">{s.res.map((x, i) => <span key={i} className="text-sm"><strong className={x.ic === '✓' ? 'text-ok' : x.ic === '!' ? 'text-danger' : 'text-[#b26a00]'}>{x.ic}</strong> {x.t}{x.fix && <><br /><span className="text-xs ml-4"><strong>Fix:</strong> {x.fix}</span></>}</span>)}</div>}
                  </div>
                )}
              </div>
            ); })}
          </div>
        </Sec>
      ))}
    </>
  );
}
