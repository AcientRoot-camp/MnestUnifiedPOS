import { useState } from 'react';
import { cx, ghs } from '../../lib/format';
import { usePersist } from '../../lib/persist';
import { Card, Pills } from '../finance/shared';
import { Head, Msg } from '../money/ui';

type St = 'Free' | 'Seated' | 'Ordered' | 'Bill asked';
type Tbl = { n: number; room: 'Main room' | 'Terrace'; seats: number; st: St; guests: number; items: [string, number, number][]; fired: boolean };
const MENU: [string, number][] = [['Jollof with chicken', 85], ['Banku & tilapia', 110], ['Waakye special', 60], ['Kelewele', 25], ['Fried rice & beef', 80], ['Sobolo', 15], ['Malt drink', 12], ['Bottled water', 8]];
const T0: Tbl[] = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, room: i < 8 ? 'Main room' : 'Terrace', seats: i % 3 === 0 ? 6 : 4, st: (['Free', 'Seated', 'Ordered', 'Bill asked', 'Ordered', 'Free', 'Seated', 'Free', 'Ordered', 'Free', 'Free', 'Seated'] as St[])[i], guests: [0, 2, 4, 3, 2, 0, 5, 0, 2, 0, 0, 3][i], items: i % 2 ? [['Jollof with chicken', 2, 85], ['Sobolo', 2, 15]] : i === 2 || i === 8 ? [['Banku & tilapia', 1, 110], ['Kelewele', 2, 25]] : [], fired: i === 2 || i === 4 }));
const COL: Record<St, string> = { Free: 'bg-white border-line', Seated: 'bg-blue-50 border-blue-200', Ordered: 'bg-amber-50 border-amber-300', 'Bill asked': 'bg-red-50 border-red-300' };

export default function Hospitality() {
  const [T, setT] = usePersist<Tbl[]>('ecompos.tables2', T0);
  const [room, setRoom] = useState<'Main room' | 'Terrace'>('Main room');
  const [sel, setSel] = useState(3);
  const [tickets, setTickets] = usePersist<{ id: string; t: number; items: string; at: number; done: boolean }[]>('ecompos.kds2', [{ id: 'K-221', t: 3, items: 'Banku & tilapia, Kelewele ×2', at: Date.now() - 6 * 60000, done: false }, { id: 'K-220', t: 5, items: 'Jollof with chicken ×2, Sobolo ×2', at: Date.now() - 12 * 60000, done: false }]);
  const [msg, setMsg] = useState('');
  const t = T.find((x) => x.n === sel)!;
  const sub = t.items.reduce((a, i) => a + i[1] * i[2], 0);
  const up = (p: Partial<Tbl>) => setT((x) => x.map((y) => (y.n === sel ? { ...y, ...p } : y)));
  const add = (m: [string, number]) => { const i = t.items.findIndex((x) => x[0] === m[0]); up({ items: i >= 0 ? t.items.map((x, j) => (j === i ? [x[0], x[1] + 1, x[2]] : x)) : [...t.items, [m[0], 1, m[1]]], st: t.st === 'Free' || t.st === 'Seated' ? 'Ordered' : t.st, guests: t.guests || 2, fired: false }); };
  return (
    <>
      <Head title="Adom Café · floor" sub="Hospitality add-on · East Legon · same menu, stock and payments as the shop" />
      <Msg text={msg} onClose={() => setMsg('')} />
      <div className="flex gap-4 flex-wrap items-center text-xs">{(['Free', 'Seated', 'Ordered', 'Bill asked'] as St[]).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cx('w-4 h-4 rounded border', COL[s])} />{s} · {T.filter((x) => x.st === s).length}</span>)}<span className="flex-1" /><Pills small opts={[['Main room', 'Main room'], ['Terrace', 'Terrace']]} value={room} onChange={setRoom} /></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_400px] items-start">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{T.filter((x) => x.room === room).map((x) => <button key={x.n} onClick={() => setSel(x.n)} aria-pressed={sel === x.n} className={cx('h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-1', COL[x.st], sel === x.n && 'ring-4 ring-brand-100')}><b className="text-lg">T{x.n}</b><span className="text-xs">{x.st}</span><span className="text-[11px] text-muted">{x.guests ? `${x.guests} guests` : `${x.seats} seats`}</span></button>)}</div>
          {room === 'Terrace' && <span className="text-xs text-muted">Guests at terrace tables can scan the table QR code to order and pay by MoMo or card from their phone.</span>}
        </Card>
        <Card title={`Table ${t.n}`} sub={`${t.guests} guests · ${t.st}`}>
          <div className="flex gap-1.5 flex-wrap">{MENU.map((m) => <button key={m[0]} onClick={() => add(m)} className="text-xs px-3 py-1.5 rounded-full border border-line">+ {m[0]} · {ghs(m[1])}</button>)}</div>
          {t.items.map((i) => <div key={i[0]} className="flex justify-between text-sm"><span>{i[1]} × {i[0]}</span><span>{ghs(i[1] * i[2])}</span></div>)}
          {!t.items.length && <span className="text-sm text-muted">No order yet. Tap the menu to add food and drinks.</span>}
          <div className="border-t border-line pt-2 text-sm flex flex-col gap-1"><div className="flex justify-between"><span>Food & drinks</span><span>{ghs(sub)}</span></div><div className="flex justify-between"><span>Service charge 10%</span><span>{ghs(sub * 0.1)}</span></div><div className="flex justify-between font-semibold text-base"><span>Total</span><span>{ghs(sub * 1.1)}</span></div></div>
          <div className="flex gap-2 flex-wrap">
            <button disabled={!t.items.length || t.fired} onClick={() => { setTickets((x) => [{ id: 'K-2' + (22 + x.length), t: t.n, items: t.items.map((i) => `${i[0]}${i[1] > 1 ? ' ×' + i[1] : ''}`).join(', '), at: Date.now(), done: false }, ...x]); up({ fired: true }); setMsg(`Table ${t.n} sent to the kitchen`); }} className="btn-dark">{t.fired ? 'In the kitchen' : 'Fire course to kitchen'}</button>
            {t.st !== 'Free' && <button onClick={() => up({ st: 'Bill asked' })} className="btn-ghost">Bill asked</button>}
            <button disabled={!t.items.length} onClick={() => { up({ st: 'Free', items: [], guests: 0, fired: false }); setMsg(`Table ${t.n} paid · ${ghs(sub * 1.1)} · receipt printed`); window.print(); }} className="btn-primary">Print bill · take payment</button>
          </div>
        </Card>
      </div>
      <Card title="Kitchen display" sub="Tickets also print on the kitchen printer over the local network, even when the internet is down">
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">{tickets.filter((k) => !k.done).map((k) => { const mins = Math.round((Date.now() - k.at) / 60000); return <div key={k.id} className={cx('p-4 rounded-2xl border-2 flex flex-col gap-2', mins > 10 ? 'border-danger bg-red-50' : 'border-line')}><div className="flex justify-between"><b>{k.id} · T{k.t}</b><span className={cx('text-xs font-semibold', mins > 10 && 'text-danger')}>{mins} min</span></div><span className="text-sm">{k.items}</span><button onClick={() => setTickets((x) => x.map((y) => (y.id === k.id ? { ...y, done: true } : y)))} className="btn-primary min-h-9 text-xs">Ready to serve</button></div>; })}{!tickets.some((k) => !k.done) && <span className="text-sm text-muted">No tickets waiting.</span>}</div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[['Delivery apps', 'Bolt Food and Glovo orders arrive here; Uber Eats, Deliveroo and DoorDash for Western branches.'], ['Reservations & waitlist', '3 bookings tonight · 2 walk-ins waiting, told by SMS when a table frees up.'], ['Recipe costing', 'Jollof with chicken: cost GHS 31.40, sells GHS 85.00 (63% margin). Ingredients deduct from stock.'], ['Happy hour & menu rules', 'Drinks 15% off 16:00–18:00 weekdays. Allergens and calories shown where the law requires.']].map(([t2, b]) => <div key={t2} className="card p-4"><b className="text-sm">{t2}</b><p className="m-0 text-[13px] text-muted">{b}</p></div>)}</div>
    </>
  );
}
