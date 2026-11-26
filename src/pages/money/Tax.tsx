import { useState } from 'react';
import { ghs, cx } from '../../lib/format';
import { usePersist } from '../../lib/persist';
import { Card, Pills, T } from '../finance/shared';
import { download, Head, Msg, Switch } from './ui';

const Q = [['0042-1188', 'Adum Till 1'], ['0042-1189', 'Adum Till 1'], ['0042-1190', 'Adum Till 2']];
const TC: [string, number][] = [['In-store POS', 61240], ['Website', 23980], ['Phone', 13420]];
const split = (g: number) => ({ base: g / 1.2, vat: (g / 1.2) * 0.15, nhil: (g / 1.2) * 0.025, getf: (g / 1.2) * 0.025 });

export default function Tax() {
  const [S, setS] = usePersist('ecompos.tax2', { reg: true, synced: false, connected: true, conn: 'gra', mode: 'api', env: 'live', regName: 'Ebenezer Unique Ventures Ltd', tin: 'C0012345678', key: '', ukVat: '' });
  const [price, setPrice] = useState('120');
  const [cfg, setCfg] = useState(false);
  const [ct, setCt] = useState<'conn' | 'tills' | 'send' | 'other'>('conn');
  const [ev, setEv] = usePersist('ecompos.evatCfg', { tills: { osu: ['Till 1 · SDC EUV-OSU-01', 'Till 2 · SDC EUV-OSU-02'], legon: ['Till 1 · SDC EUV-ELG-01'], adum: ['Till 1 · SDC EUV-ADM-01', 'Till 2 · SDC EUV-ADM-02'] } as Record<string, string[]>, web: true, now: true, queue: true, retry: '15 min', copy: true, qr: true, other: { kra: false, firs: false, custom: false } as Record<string, boolean> });
  const [testing, setTesting] = useState('');
  const [msg, setMsg] = useState('');
  const c = split(parseFloat(price) || 0);
  const total = TC.reduce((a, t) => a + t[1], 0);
  const chip = <span className={cx('pill', S.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{S.connected ? `Connected · ${S.env === 'live' ? 'live' : 'sandbox'}` : 'Not connected'}</span>;
  return (
    <>
      <Head title="Tax & E-VAT" sub="Ghana VAT, NHIL and GETFund rates, and the GRA E-VAT connection for every branch." />
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Card title="Ghana · VAT Act 2025 (Act 1151), from 1 January 2026">
          <div className="flex items-center justify-between gap-3"><span className="text-sm"><b>VAT-registered business</b><br /><span className="text-xs text-muted">{S.reg ? 'VAT, NHIL and GETFund are charged on every taxable sale and shown on the receipt.' : 'Not registered · no VAT is charged. Register once taxable sales pass GHS 750,000 a year.'}</span></span><Switch on={S.reg} onChange={() => setS({ ...S, reg: !S.reg })} label="VAT-registered business" /></div>
          <T head={['Tax', 'Rate', 'Charged on', 'Shown on receipt']} rows={[['VAT', '15%', 'Taxable value', 'Separate line'], ['NHIL', '2.5%', 'Same taxable value', 'Separate line'], ['GETFund Levy', '2.5%', 'Same taxable value', 'Separate line'], [<b key="c">Combined</b>, <b key="r">20%</b>, 'NHIL and GETFund now claimable as input tax', '']]} />
          <div className="p-4 rounded-2xl bg-canvas flex flex-col gap-2">
            <label className="text-[13px] font-semibold flex flex-col gap-1">Check a VAT-inclusive shelf price<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} className="field py-2 font-normal w-40" /></label>
            <div className="flex gap-1.5">{['12', '120', '1850', '3650'].map((v) => <button key={v} onClick={() => setPrice(v)} className="text-xs px-3 py-1.5 rounded-full border border-line bg-white">{ghs(+v)}</button>)}</div>
            {[['Taxable value', c.base], ['VAT', c.vat], ['NHIL', c.nhil], ['GETFund', c.getf]].map(([k, v]) => <div key={k as string} className="flex justify-between text-sm"><span>{k as string}</span><b>{ghs(v as number)}</b></div>)}
          </div>
          <span className="text-xs text-muted">Tax classes: standard · zero-rated · exempt · Prices shown tax-inclusive · Withholding tax recorded on B2B invoices</span>
        </Card>
        <Card title="GRA E-VAT" actions={chip}>
          <span className="text-sm">Each sale is sent to the GRA, which returns a validation code, signature and QR code for the receipt.</span>
          <dl className="grid grid-cols-3 gap-2 m-0">{[['Validated today', String(412 + (S.synced ? 3 : 0))], ['Waiting (offline)', S.synced ? '0' : '3'], ['Rejected', '0']].map(([k, v]) => <div key={k} className="p-3 rounded-xl bg-canvas"><dt className="text-xs text-muted">{k}</dt><dd className="m-0 text-xl font-semibold">{v}</dd></div>)}</dl>
          <div className="flex gap-2 flex-wrap"><button onClick={() => setCfg(true)} className="btn-ghost">⚙ Open & configure E-VAT</button><button disabled={S.synced || !S.connected} onClick={() => { setS({ ...S, synced: true }); setMsg('3 receipts sent to GRA and validated'); }} className="btn-primary">{S.synced ? 'All sent' : 'Send 3 waiting receipts now'}</button></div>
          <span className="text-[13px] font-semibold">Queue</span>
          {Q.map((q) => <div key={q[0]} className="flex justify-between text-sm"><span>{q[0]} · {q[1]}</span><span className={cx('pill', S.synced ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{S.synced ? 'Validated' : 'Waiting for connection'}</span></div>)}
          <span className="text-xs text-muted">Osu and East Legon tills are online and validate instantly. Adum Till 1–2 lost internet at 09:12 and queued 3 receipts.</span>
        </Card>
      </div>
      <Card title="Tax collected · October 2026 (Ghana branches)" actions={<button onClick={() => download('vat-return-oct-2026.csv', [['Channel', 'Sales incl. tax', 'VAT', 'NHIL', 'GETFund'], ...[...TC, ['Total', total] as [string, number]].map(([ch, g]) => { const s = split(g); return [ch, g.toFixed(2), s.vat.toFixed(2), s.nhil.toFixed(2), s.getf.toFixed(2)]; })])} className="btn-ghost min-h-9 text-xs">Download return summary</button>}>
        <T head={['Channel', 'Sales (incl. tax)', 'VAT', 'NHIL', 'GETFund']} rows={[...TC, ['Total', total] as [string, number]].map(([ch, g]) => { const s = split(g); return [ch === 'Total' ? <b key="t">Total</b> : ch, ghs(g), ghs(s.vat), ghs(s.nhil), ghs(s.getf)]; })} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="United Kingdom · VAT">{[['Standard', '20%'], ['Reduced', '5%'], ['Zero', '0%']].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><b>{v}</b></div>)}<label className="text-[13px] font-semibold flex flex-col gap-1">VAT registration number (printed on invoices)<input value={S.ukVat} onChange={(e) => setS({ ...S, ukVat: e.target.value })} placeholder="GB 000 0000 00" className="field py-2 font-normal" /></label><span className="text-xs text-muted">Making Tax Digital: VAT totals export to Xero, QuickBooks or Sage, which file the return. EU distance sales: One-Stop-Shop (OSS) VAT available as an add-on.</span></Card>
        <Card title="United States · sales tax"><span className="text-sm">Rates are calculated per delivery address by your tax provider (Stripe Tax, Avalara or TaxJar). Prices are shown before tax.</span><T head={['State', 'Sales this year', 'Nexus']} rows={[['[State with a store]', '[amount]', 'Physical presence · registered'], ['[Other state]', '[amount]', 'Watching economic threshold']]} /></Card>
        <Card title="Canada · GST / HST / PST / QST"><span className="text-sm">Each province gets the correct combination on the receipt: GST only, GST + PST, GST + QST, or HST. Rates are loaded from the tax provider and kept up to date.</span><span className="text-xs text-muted">Prices are shown before tax; GST/HST registration number printed on invoices.</span></Card>
      </div>
      {cfg && (
        <div className="fixed inset-0 z-[500] bg-black/55 flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <section role="dialog" aria-modal="true" aria-label="GRA E-VAT connection" className="w-full max-w-xl bg-white rounded-4xl p-6 flex flex-col gap-4">
            <div className="flex justify-between gap-2"><div><h2 className="m-0 text-lg font-semibold">GRA E-VAT connection</h2><span className="text-sm text-muted">Connect the till and webstore to the Ghana Revenue Authority E-VAT system, and add other tax connectors.</span></div><button onClick={() => setCfg(false)} aria-label="Close" className="text-xl">×</button></div>
            {chip}
            <Pills small opts={[['conn', 'Connection'], ['tills', 'Branches & tills'], ['send', 'Sending options'], ['other', 'Other connectors']]} value={ct} onChange={setCt} />
            {ct === 'tills' && <div className="flex flex-col gap-2">{Object.entries(ev.tills).map(([b, L]) => <div key={b} className="p-3 rounded-2xl bg-canvas text-sm flex flex-col gap-1"><b>{({ osu: 'Osu branch', legon: 'East Legon branch', adum: 'Adum branch' } as Record<string, string>)[b]} · GRA branch ID {b.toUpperCase()}-001</b>{L.map((t) => <span key={t} className="text-xs">✓ {t} · registered</span>)}<button onClick={() => setEv({ ...ev, tills: { ...ev.tills, [b]: [...L, `Till ${L.length + 1} · SDC EUV-${b.slice(0, 3).toUpperCase()}-0${L.length + 1}`] } })} className="text-xs underline w-fit">+ Register another till</button></div>)}<label className="flex items-center justify-between text-sm p-3 rounded-2xl bg-canvas">Online store receipts go to GRA too<Switch on={ev.web} onChange={() => setEv({ ...ev, web: !ev.web })} label="Online store receipts" /></label></div>}
            {ct === 'send' && <div className="flex flex-col gap-2">{([['now', 'Send each receipt to GRA as soon as the sale is paid'], ['queue', 'Keep receipts in a queue when offline and send them later'], ['copy', 'Email the customer a copy of the validated receipt'], ['qr', 'Print the GRA QR code on every receipt']] as const).map(([k, l]) => <label key={k} className="flex items-center justify-between gap-3 text-sm p-3 rounded-2xl bg-canvas">{l}<Switch on={ev[k]} onChange={() => setEv({ ...ev, [k]: !ev[k] })} label={l} /></label>)}<div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold">Retry rejected or queued receipts every</span><Pills small opts={[['5 min', '5 min'], ['15 min', '15 min'], ['1 hour', '1 hour']]} value={ev.retry} onChange={(v) => setEv({ ...ev, retry: v })} /></div></div>}
            {ct === 'other' && <div className="flex flex-col gap-2"><span className="text-sm text-muted">For branches outside Ghana, or to send figures to your accounting system.</span>{([['kra', 'Kenya · KRA eTIMS', 'Electronic tax invoices for a Kenya branch'], ['firs', 'Nigeria · FIRS e-invoicing', 'VAT invoices for a Nigeria branch'], ['custom', 'Custom connector', 'Send receipts to any tax API with your own URL and key']] as const).map(([k, l, d]) => <label key={k} className="flex items-center justify-between gap-3 text-sm p-3 rounded-2xl bg-canvas"><span><b>{l}</b><br /><span className="text-xs text-muted">{d}</span></span><Switch on={ev.other[k]} onChange={() => setEv({ ...ev, other: { ...ev.other, [k]: !ev.other[k] } })} label={l} /></label>)}<Pills small opts={[['gra', 'GRA E-VAT'], ['xero', 'Xero'], ['qb', 'QuickBooks'], ['stripe', 'Stripe Tax']]} value={S.conn} onChange={(v) => setS({ ...S, conn: v })} /></div>}
            {ct === 'conn' && <>
            <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">How you connect</span><Pills small opts={[['api', 'GRA E-VAT API direct (recommended)'], ['vsdc', 'Accredited device (VSDC) at each till'], ['integrator', 'Through an accredited integrator']]} value={S.mode} onChange={(v) => setS({ ...S, mode: v })} /><span className="text-xs text-muted">{S.mode === 'api' ? 'Every till and the website send receipts through MNest UnifiedPOS. Tills queue receipts when offline.' : 'A GRA-certified signing device is plugged into each till.'}</span></div>
            <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Environment</span><Pills small opts={[['sandbox', 'Sandbox (testing)'], ['live', 'Live']]} value={S.env} onChange={(v) => setS({ ...S, env: v })} /></div>
            <span className="text-[13px] font-semibold">Taxpayer</span>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Business name (as registered with GRA)<input value={S.regName} onChange={(e) => setS({ ...S, regName: e.target.value })} className="field py-2 font-normal" /></label>
            <label className="text-[13px] font-semibold flex flex-col gap-1">Taxpayer TIN or Ghana Card PIN<input value={S.tin} onChange={(e) => setS({ ...S, tin: e.target.value })} placeholder="C0012345678 or GHA-123456789-0" className="field py-2 font-normal" /></label>
            <label className="text-[13px] font-semibold flex flex-col gap-1">API key from the GRA portal<input type="password" value={S.key} onChange={(e) => setS({ ...S, key: e.target.value })} placeholder="Paste the key the GRA issued" autoComplete="off" className="field py-2 font-normal" /></label>
            </>}
            {testing && <span className={cx('text-sm', testing.startsWith('✓') ? 'text-ok' : 'text-danger')}>{testing}</span>}
            <div className="flex gap-2 justify-end flex-wrap">
              <button onClick={() => setTesting(/^(C\d{10}|GHA-\d{9}-\d)$/.test(S.tin) ? `✓ Test receipt validated by GRA ${S.env === 'live' ? 'live' : 'sandbox'} · code EV-${Math.floor(Math.random() * 1e6)}` : 'The TIN or Ghana Card PIN is not in the right format.')} className="btn-ghost">Test connection</button>
              <button onClick={() => { setS({ ...S, connected: true }); setCfg(false); setMsg('E-VAT settings saved'); }} className="btn-primary">Save</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
