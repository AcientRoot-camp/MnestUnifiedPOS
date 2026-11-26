// Online store inside the CRM: a card for the role homes and a web-activity block for each customer.
import { Link } from 'react-router-dom';
import { usePersist } from '../../lib/persist';
import { useWeb } from '../../data/web';
import { ghs } from '../../lib/format';
import { BR, fmtWhen, type Lead } from './model';
import { Pill } from './ui';
import { WK, webOf, webStats, type ShopOrder } from './web';

/** Live: re-renders when an order, sign-up or review lands on the store. */
export function OnlineStoreCard({ br, leads, canPost }: { br: string; leads: Lead[]; canPost: boolean }) {
  usePersist<Record<string, ShopOrder>>(WK.orders, {});
  usePersist<unknown[]>(WK.users, []);
  const [W] = useWeb();
  const s = webStats(br);
  const web = leads.filter((l) => (l.source === 'Website' || l.source === 'Hire-purchase application') && l.createdBy === 'Online store' && (br === 'all' || l.branch === br));
  const fresh = web.filter((l) => l.status === 'New');
  const crmCodes = W.codes.filter((c) => /^CRM/.test(c.note));
  return (
    <section className="bg-white rounded-3xl shadow-card p-5 flex flex-col gap-3 min-w-0 xl:col-span-2" aria-labelledby="crm-web-h">
      <div className="flex justify-between gap-3 items-start flex-wrap">
        <div><h2 id="crm-web-h" className="m-0 text-lg font-semibold">Online store</h2><span className="text-[13px] text-muted">Sign-ups, orders, messages and reviews from the webstore arrive here as customers, leads, follow-ups and feedback</span></div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/crm/leads" className="text-sm underline">Website leads</Link>
          {canPost && <Link to="/web/codes" className="text-sm underline">Discount codes</Link>}
          {canPost && <Link to="/web/reviews" className="text-sm underline">What customers say</Link>}
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          ['Online orders · 7 days', String(s.orders), ghs(s.revenue)],
          ['Store accounts', String(s.accounts), `${s.offers} agreed to offers`],
          ['New website leads', String(fresh.length), `${web.length} from the store in total`],
          ['Baskets left', String(s.baskets), 'Signed-in shoppers'],
          ['Webstore rating', s.reviews ? `${s.stars.toFixed(1)} / 5` : '—', `${s.reviews} reviews · ${s.hidden} hidden`],
        ].map(([l, v, n]) => <div key={l} className="rounded-2xl bg-[#f6f7f8] p-3 flex flex-col gap-0.5 min-w-0"><span className="text-xs text-muted">{l}</span><b className="text-xl font-semibold">{v}</b><span className="text-xs text-muted truncate">{n}</span></div>)}
      </div>
      {fresh.length > 0 && <div className="flex flex-col divide-y divide-line">
        {fresh.slice(0, 4).map((l) => <div key={l.id} className="py-2 flex items-center gap-3 text-sm flex-wrap"><span className="flex-1 min-w-[180px]"><b>{l.name}</b> · {l.interest}<br /><span className="text-xs text-muted">{l.source} · {BR[l.branch]} · {l.owner} · {fmtWhen(l.createdAt)}</span></span><Pill t={l.nextStep} tone="teal" /></div>)}
      </div>}
      {crmCodes.length > 0 && <span className="text-xs text-muted">{crmCodes.length} CRM code{crmCodes.length > 1 ? 's' : ''} live at the webstore checkout · {crmCodes.reduce((a, c) => a + c.used, 0)} used</span>}
    </section>
  );
}

/** Online store account, orders, wish list and basket for one customer (Relationship panel). */
export function WebActivity({ phone, staff }: { phone: string; staff: boolean }) {
  usePersist<Record<string, ShopOrder>>(WK.orders, {});
  usePersist<unknown[]>(WK.users, []);
  const { user, orders, spend } = webOf(phone);
  if (!user && !orders.length) return <div className="rounded-2xl bg-[#f6f7f8] p-3 text-sm text-muted">No online store account or web orders yet.</div>;
  return (
    <div className="rounded-2xl border border-line p-3 flex flex-col gap-2 text-sm" aria-label="Online store activity">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="flex-1">Online store</b>
        {user ? <Pill t={user.verified ? 'Account verified' : 'Account not verified'} tone={user.verified ? 'ok' : 'warn'} /> : <Pill t="Guest checkout" />}
        {user && <Pill t={user.offers ? 'Agreed to offers' : 'No offers'} tone={user.offers ? 'teal' : 'mute'} />}
      </div>
      {user && <span className="text-xs text-muted">Signed up {user.created}{staff ? '' : ` · ${user.email}`} · {user.wish?.length || 0} in wish list · {user.cart?.length ? `${user.cart.reduce((a, l) => a + l.qty, 0)} item(s) left in basket` : 'basket empty'}</span>}
      <span className="text-xs">{orders.length} web order{orders.length === 1 ? '' : 's'} · {ghs(spend)} spent online</span>
      {orders.slice(0, staff ? 3 : 5).map((o) => <div key={o.no} className="flex items-center gap-2 flex-wrap text-[13px]"><span className="flex-1 min-w-[160px]">#{o.no} · {o.lines.map((l) => l.name).slice(0, 2).join(', ')}{o.lines.length > 2 ? '…' : ''}<br /><span className="text-xs text-muted">{o.at} · {o.fulfil === 'D' ? 'Delivery' : o.fulfil === 'P' ? 'Pickup' : 'In store'} · {o.pay}</span></span><b>{ghs(o.total)}</b>{o.status === 'Cancelled' && <Pill t="Cancelled" tone="bad" />}{o.returnReq && <Pill t="Return asked" tone="warn" />}</div>)}
    </div>
  );
}
