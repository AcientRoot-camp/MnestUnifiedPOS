import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { LogoMark, Wordmark } from '../components/Logo';
import { Status } from '../components/ui';
import { STAGES, WEB_ORDERS, type WebOrder } from '../data/sell';
import { cx } from '../lib/format';
import { nowTxt, usePersist } from '../lib/persist';

type Job = WebOrder & { proof?: string };
const RIDER = 'Yaw Darko';
const total = (o: WebOrder) => o.items.reduce((a, [q, , p]) => a + q * p, 0) + o.fee;

/** Rider app: delivery orders from the online store and phone/WhatsApp orders. Status changes show live on the customer's tracking page. */
export default function Rider() {
  const [L, setL] = usePersist<Job[]>('ecompos.webOrders2', WEB_ORDERS);
  const [proof, setProof] = useState<string | null>(null);
  const [photo, setPhoto] = useState('');
  const [rcv, setRcv] = useState('');
  const [err, setErr] = useState('');
  const jobs = L.filter((o) => o.type === 'D' && o.status !== 'Cancelled' && (o.stage >= 2 || o.status === 'Delivered'));
  const waiting = L.filter((o) => o.type === 'D' && o.status === 'Active' && o.stage < 2).length;
  const up = (id: string, p: Partial<Job>, label: string) => setL((l) => l.map((x) => (x.id === id ? { ...x, ...p, track: [...x.track, { label, at: nowTxt(), by: RIDER }] } : x)));
  const st = (o: Job) => (o.status === 'Delivered' ? 'Delivered' : o.stage >= 3 ? 'On the way' : 'Pending');
  const cod = (o: Job) => (/paid/i.test(o.pay) ? 0 : total(o));
  return (
    <div className="min-h-screen bg-canvas flex items-start justify-center p-4">
      <div className="w-full max-w-[390px] min-h-[844px] bg-white rounded-[36px] shadow-card overflow-hidden flex flex-col">
        <div className="bg-brand text-white p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2"><LogoMark size={36} /><Wordmark dark className="text-[15px]" /><span className="font-semibold">Rider</span></Link>
            <span className="pill bg-white/15 text-white"><Icon name="bike" size={14} /> On duty</span>
          </div>
          <h1 className="m-0 text-[26px] font-medium tracking-tightest">Deliveries, made simple.</h1>
          <span className="text-sm text-white/80">{RIDER} · Osu branch · {jobs.filter((j) => j.status !== 'Delivered').length} to go{waiting ? ` · ${waiting} being packed` : ''}</span>
        </div>
        <ul className="flex-1 p-4 flex flex-col gap-3 list-none m-0">
          {!jobs.length && <li className="text-sm text-muted text-center py-10">No deliveries yet. Orders appear here once the branch has packed them.</li>}
          {jobs.map((j) => (
            <li key={j.id} className="rounded-3xl border border-line p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center"><b>{j.id}</b><Status s={st(j)} /></div>
              <span className="text-sm flex items-center gap-1.5"><Icon name="pin" size={15} className="text-brand" /> {j.who} · {j.where}</span>
              {j.landmark && <span className="text-xs text-muted">{j.landmark}{j.gps ? ` · ${j.gps}` : ''}</span>}
              <span className="text-xs text-muted">{j.items.reduce((a, [q]) => a + q, 0)} items · {STAGES[j.stage]}{cod(j) ? ` · collect GHS ${cod(j).toFixed(2)} on delivery` : ' · paid online'}</span>
              {j.proof && <img src={j.proof} alt={`Photo proof for ${j.id}`} className="w-full h-28 object-cover rounded-2xl" />}
              {j.status !== 'Delivered' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a href={`tel:${j.phone.replace(/\s/g, '')}`} className="btn-ghost min-h-10 text-xs"><Icon name="phone" size={15} /> Call</a>
                  {j.stage < 4
                    ? <button onClick={() => up(j.id, { stage: 4, rider: j.rider || 'r2' }, 'Out for delivery')} className="btn-dark min-h-10 text-xs"><Icon name="bike" size={15} /> Picked up</button>
                    : <button onClick={() => { setProof(j.id); setPhoto(''); setRcv(j.who); setErr(''); }} className={cx('btn-primary min-h-10 text-xs')}><Icon name="camera" size={15} /> Photo proof</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
        {proof && (
          <div className="p-4 border-t border-line flex flex-col gap-2 bg-brand-50">
            <span className="text-sm font-semibold">Confirm delivery of {proof}</span>
            <span className="text-xs text-sub">Take a photo of the parcel with the customer. The customer sees it on their tracking page.</span>
            <label className="btn-ghost cursor-pointer w-fit"><Icon name="camera" size={15} /> {photo ? 'Retake photo' : 'Take photo'}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f); }} /></label>
            {photo && <img src={photo} alt="Delivery photo" className="w-full h-32 object-cover rounded-2xl" />}
            <label className="flex flex-col gap-1 text-xs font-semibold">Received by<input value={rcv} onChange={(e) => setRcv(e.target.value)} className="px-3 py-2 rounded-full border border-line font-normal text-sm" /></label>
            {err && <span role="alert" className="text-xs text-danger">{err}</span>}
            <div className="flex gap-2">
              <button onClick={() => { if (!photo) return setErr('Take the photo first.'); if (!rcv.trim()) return setErr('Type who received it.'); up(proof, { stage: 5, status: 'Delivered', received: rcv.trim(), proof: photo }, 'Delivered'); setProof(null); }} className="btn-primary"><Icon name="check" /> Delivered</button>
              <button onClick={() => setProof(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
