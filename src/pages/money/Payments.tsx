import { useState } from 'react';
import { ghs } from '../../lib/format';
import { usePersist } from '../../lib/persist';
import { Card, Pills, T } from '../finance/shared';
import { Head, Msg, Switch } from './ui';

const G = [
  { k: 'paystack', name: 'Paystack', region: 'Ghana · licensed payment service provider', channels: 'Cards, MoMo (all networks), bank transfer, USSD, Apple Pay', health: '99.1% success today · settles next working day', on: true },
  { k: 'hubtel', name: 'Hubtel', region: 'Ghana · licensed payment service provider', channels: 'MoMo prompts at the till and online, cards, Hubtel checkout', health: '98.6% success today · settles next working day', on: true },
  { k: 'ghpay', name: 'GhPay (GhanaPay)', region: 'Ghana · GhIPSS mobile money and bank wallet', channels: 'GhanaPay wallet and any bank app · request to pay', health: '97.9% success today · settles same day', on: true },
  { k: 'momo', name: 'MTN MoMo direct', region: 'Ghana · MoMo Open API', channels: 'Collections and bulk disbursements (salaries, refunds)', health: 'Not connected', on: false },
  { k: 'stripe', name: 'Stripe', region: 'UK, US and Canada stores', channels: 'Cards, Apple Pay, Google Pay, Klarna, Stripe Terminal readers', health: 'Not connected · for a UK branch', on: false },
];
const M: [string, string, string, boolean][] = [
  ['cash', 'Cash', 'Till · cash on delivery', true], ['momo', 'Mobile Money', 'Till · website · pay-by-link', true], ['card', 'Cards', 'Till readers · website', true],
  ['bank', 'Bank transfer / USSD', 'Website · auto-matched', true], ['cod', 'Pay on delivery', 'Website · phone orders', true], ['link', 'Pay-by-link & QR', 'Phone orders · till', true],
  ['gift', 'Gift cards & store credit', 'Till · website', true], ['wallet', 'Apple Pay & Google Pay', 'Website · UK store', false], ['bnpl', 'Buy now, pay later (Klarna, Clearpay)', 'UK / US stores only', false], ['paypal', 'PayPal', 'Diaspora buyers', false],
];
const ST: [string, string, number, number, string][] = [['27 Oct', 'Hubtel', 8420, 211, 'Matched'], ['27 Oct', 'Paystack', 5310, 64, '1 to review'], ['26 Oct', 'Hubtel', 9105, 232, 'Matched'], ['26 Oct', 'Paystack', 4880, 58, 'Matched']];

export default function Payments() {
  const [S, setS] = usePersist('ecompos.payments2', { conn: {} as Record<string, boolean>, primary: 'Hubtel', fallback: true, passFees: false, m: {} as Record<string, boolean>, reviewed: false });
  const [msg, setMsg] = useState('');
  const other = S.primary === 'Hubtel' ? 'Paystack' : 'Hubtel';
  return (
    <>
      <Head title="Payments" sub="MNest UnifiedPOS never holds your money or card numbers. Payments go through licensed gateways connected to your own merchant accounts; every payment is verified with the gateway before an order is marked paid." />
      <Msg text={msg} onClose={() => setMsg('')} />
      <Card title="Connected gateways">
        <div className="grid gap-3 md:grid-cols-2">
          {G.map((g) => { const on = S.conn[g.k] ?? g.on; return (
            <div key={g.k} className="p-4 rounded-2xl border border-line flex flex-col gap-1.5">
              <div className="flex justify-between gap-2"><b>{g.name}</b><span className={on ? 'pill bg-black text-white' : 'pill bg-canvas'}>{on ? 'Connected' : 'Not connected'}</span></div>
              <span className="text-xs text-muted">{g.region}</span><span className="text-sm">{g.channels}</span>
              <span className="text-xs text-sub">{on && !g.on ? 'Connected just now · test payment passed' : g.health}</span>
              <button onClick={() => { if (!on) { setS({ ...S, conn: { ...S.conn, [g.k]: true } }); setMsg(`${g.name} connected · a GHS 1.00 test payment passed and was refunded`); } else setMsg(`${g.name} account settings open in the gateway dashboard`); }} className={on ? 'btn-ghost w-fit min-h-9 text-xs' : 'btn-primary w-fit min-h-9 text-xs'}>{on ? 'Manage account' : 'Connect your account'}</button>
            </div>
          ); })}
        </div>
      </Card>
      <Card title="Mobile Money routing">
        <div className="flex items-center gap-3 flex-wrap"><span className="text-sm font-semibold">Send MoMo prompts through</span><Pills opts={[['Hubtel', 'Hubtel'], ['Paystack', 'Paystack']]} value={S.primary} onChange={(v) => setS({ ...S, primary: v })} /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-sm"><b>Automatic fallback</b><br /><span className="text-xs text-muted">{S.fallback ? `If ${S.primary} times out, the prompt is re-sent through ${other} straight away.` : 'Off · a failed prompt must be re-sent by the cashier.'}</span></span><Switch on={S.fallback} onChange={() => setS({ ...S, fallback: !S.fallback })} label="Automatic fallback" /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-sm"><b>Pass gateway fees to customers</b><br /><span className="text-xs text-muted">Shown as a separate line at checkout where allowed</span></span><Switch on={S.passFees} onChange={() => setS({ ...S, passFees: !S.passFees })} label="Pass gateway fees to customers" /></div>
        <span className="text-[13px] font-semibold">Prompt success today, by network</span>
        <T head={['Network', 'Approved', 'Timed out', 'Avg confirm']} rows={[['MTN', '142', '2', '14 s'], ['Telecel', '31', '0', '18 s'], ['AirtelTigo', '12', '0', '21 s']]} />
      </Card>
      <Card title="Payment methods">
        <div className="grid gap-2 md:grid-cols-2">{M.map((m) => { const on = S.m[m[0]] ?? m[3]; return <div key={m[0]} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-canvas"><span className="text-sm"><b>{m[1]}</b><br /><span className="text-xs text-muted">{m[2]}</span></span><Switch on={on} onChange={() => setS({ ...S, m: { ...S.m, [m[0]]: !on } })} label={m[1]} /></div>; })}</div>
      </Card>
      <Card title="Settlements & reconciliation" sub="Gateway payouts matched to orders automatically">
        <T head={['Paid out', 'Gateway', 'Gross', 'Fees', 'Net to bank', 'Orders', 'Status']} rows={ST.map((t) => [t[0], t[1], ghs(t[2]), ghs(t[2] * 0.0195), ghs(t[2] * 0.9805), String(t[3]), t[4] === 'Matched' || S.reviewed ? <span key="s" className="pill bg-canvas">Matched</span> : <button key="s" onClick={() => { setS({ ...S, reviewed: true }); setMsg('Paystack order W-2298 matched to its refund · settlement reconciled'); }} className="pill bg-black text-white">{t[4]} →</button>])} />
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {[['Card data never stored', 'Hosted payment fields and tokens keep MNest UnifiedPOS outside most PCI DSS scope.'], ['Signed webhooks', 'Every callback is signature-checked and de-duplicated, so no order is paid twice.'], ['Refunds to source', 'Refunds go back to the card or MoMo wallet through the same gateway.'], ['Fraud checks', 'Velocity limits and 3-D Secure on cards; repeated failed MoMo prompts are flagged.']].map(([t, b]) => <div key={t} className="card p-4"><b className="text-sm">{t}</b><p className="m-0 text-[13px] text-muted">{b}</p></div>)}
      </div>
    </>
  );
}
