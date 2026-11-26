// Staff identity cards (IDCard.md): the card itself at bank-card size (85.6 × 54 mm, ISO/IEC 7810 ID-1) front and back,
// the HR "ID cards" tab (pick an employee, photo, Issue card, Print both sides, Send digital copy, replace, card printer
// and batch sheet printing), the employee's "My ID card" panel, and the "Verify ID card" scanner. All inner sizes are in
// mm so the printed card is exactly bank-card size.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import BarcodeCamera from '../../components/BarcodeCamera';
import { qrMake } from '../../lib/qr';
import { readKey, usePersist, writeKey } from '../../lib/persist';
import { LOGO_KEY } from '../../lib/brand';
import { secLog } from '../../lib/sec';
import { cx } from '../../lib/format';
import { HR_KEY, type HrRec } from '../../data/clock';
import type { Emp } from '../../data/people';
import { IDC_KEY, brFull, brTag, daysLeft, iniOf, idQrText, issueCard, monYr, noteCard, outOfDate, phoneFmt, plus2y, signOf, staffNoOf, toneOf, verifyId, type IdCheck, type IdMap, type IdRec } from '../../data/idcard';
import { bizInfo } from '../pos/Docs';
import { NOTIF0 } from '../../components/TopBar';

const TEAL = '#0b5c5c';
const CARD: CSSProperties = { width: '85.6mm', height: '54mm', boxSizing: 'border-box', borderRadius: '3.2mm', overflow: 'hidden', background: '#ffffff', border: '1px solid #d9dede', boxShadow: 'rgba(0,0,0,0.16) 0 4px 16px 0', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', color: '#000', flex: 'none' };
const LBL: CSSProperties = { fontSize: '1.9mm', letterSpacing: '0.1em', color: '#5f5c5a' };

/** The photo for an employee: the one uploaded for the ID card (HR record), else the older ID photo store. */
export function photoOf(e: Emp, hr: Record<string, HrRec>): string | undefined {
  return hr[e.name]?.photo || readKey<Record<string, string>>('ecompos.idPhotos', {})[e.id] || undefined;
}

/** Everything printed on one card. hrCopy: the HR copy also shows the employee's phone on the back. */
type Face = { e: Emp; rec?: IdRec; photo?: string; code: string; company: string; logo: string; hrCopy?: boolean };

/** Identity QR drawn as a CSS grid of black / white cells (no image, so it prints sharp), 24 × 24 mm with 1 mm padding. */
function IdQr({ text }: { text: string }) {
  const q = useMemo(() => qrMake(text), [text]);
  if (!q) return <span style={{ width: '24mm', height: '24mm' }} />;
  return (
    <span role="img" aria-label="Identity QR code" style={{ width: '24mm', height: '24mm', padding: '1mm', boxSizing: 'border-box', background: '#ffffff', border: '0.3mm solid #ebebeb', borderRadius: '1.2mm', display: 'grid', gridTemplateColumns: `repeat(${q.size}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
      {q.rows.flatMap((r, y) => r.map((c, x) => <span key={`${y}-${x}`} style={{ background: c ? '#000000' : '#ffffff' }} />))}
    </span>
  );
}

/** Front: teal header (logo, company, STAFF IDENTITY CARD, branch tag), photo or initials, the four fields, footer strip. */
export function IdFront({ e, rec, photo, company, logo }: Face) {
  const exp = rec?.exp || plus2y();
  return (
    <div className="id-card" style={CARD}>
      <div style={{ height: '11mm', flex: 'none', background: TEAL, color: '#fff', padding: '0 3mm', display: 'flex', gap: '2mm', alignItems: 'center' }}>
        {logo && <img src={logo} alt="" style={{ height: '7mm', width: 'auto', maxWidth: '16mm', objectFit: 'contain', flex: 'none' }} />}
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}><strong style={{ fontSize: '3.1mm', fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company}</strong><span style={{ fontSize: '1.9mm', letterSpacing: '0.14em', color: '#a9d4d4' }}>STAFF IDENTITY CARD</span></span>
        <span style={{ fontSize: '2mm', fontWeight: 700, letterSpacing: '0.08em', padding: '0.8mm 2mm', borderRadius: '1mm', background: 'rgba(255,255,255,0.18)', whiteSpace: 'nowrap' }}>{brTag(e.br)}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '2.6mm 3mm', display: 'flex', gap: '3mm' }}>
        <span aria-hidden="true" style={{ position: 'relative', width: '22mm', height: '28mm', flex: 'none', borderRadius: '1.6mm', overflow: 'hidden', background: toneOf(e.name), color: '#fff', fontSize: '8mm', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.4mm solid #e4f3f3' }}>
          {iniOf(e.name)}{photo && <img src={photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: '0.5mm' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.3mm' }}><span style={LBL}>NAME</span><strong style={{ fontSize: '4mm', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{e.name}</strong></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.3mm' }}><span style={LBL}>POSITION</span><strong style={{ fontSize: '3.1mm', fontWeight: 600, lineHeight: 1.15 }}>{e.level}</strong></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.3mm' }}><span style={LBL}>BRANCH</span><strong style={{ fontSize: '3.1mm', fontWeight: 600, lineHeight: 1.15 }}>{brFull(e.br)}</strong></span>
          <span style={{ display: 'flex', gap: '4mm' }}><span style={{ display: 'flex', flexDirection: 'column', gap: '0.3mm' }}><span style={LBL}>STAFF NO.</span><strong style={{ fontSize: '2.9mm', fontWeight: 700, letterSpacing: '0.04em' }}>{rec?.no || staffNoOf(e)}</strong></span><span style={{ display: 'flex', flexDirection: 'column', gap: '0.3mm' }}><span style={LBL}>VALID TO</span><strong style={{ fontSize: '2.9mm', fontWeight: 600 }}>{monYr(exp)}</strong></span></span>
        </span>
      </div>
      <div style={{ height: '4mm', flex: 'none', background: '#e4f3f3' }} />
    </div>
  );
}

/** Back: teal band, the identity QR ("SCAN TO VERIFY"), holder line, terms, lost-card line, signatures, issue / expiry. */
export function IdBack({ e, rec, code, company, hrCopy }: Face) {
  const no = rec?.no || staffNoOf(e); const exp = rec?.exp || plus2y();
  const text = idQrText(no, e.name, e.level, e.br, company, code, rec);
  const small: CSSProperties = { fontSize: '2.2mm', lineHeight: 1.35, color: '#3d3a38' };
  return (
    <div className="id-card" style={CARD}>
      <div style={{ height: '6mm', flex: 'none', background: TEAL }} />
      <div style={{ flex: 1, minHeight: 0, padding: '2.4mm 3mm', display: 'flex', gap: '3mm' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '1mm', alignItems: 'center', flex: 'none' }}>
          <IdQr text={text} />
          <span style={{ fontSize: '1.9mm', letterSpacing: '0.06em', color: '#5f5c5a', textAlign: 'center' }}>SCAN TO VERIFY</span>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.6mm' }}>
            <strong style={{ fontSize: '2.6mm', fontWeight: 700 }}>{e.name} · {no}</strong>
            <span style={small}>This card stays the property of {company} and must be carried at work. Scanning the code shows the holder’s name, position, branch and staff number.</span>
            <span style={small}>Report a lost card to HR the same day. Found cards may be returned to any branch.</span>
          </span>
          <span style={{ display: 'flex', gap: '3mm', alignItems: 'flex-end' }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4mm' }}><span style={{ height: '5mm', borderBottom: '0.3mm solid #000' }} /><span style={{ fontSize: '1.9mm', letterSpacing: '0.06em', color: '#5f5c5a' }}>HOLDER’S SIGNATURE</span></span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4mm' }}><span style={{ height: '5mm', borderBottom: '0.3mm solid #000', display: 'flex', alignItems: 'flex-end', fontSize: '2.4mm', fontStyle: 'italic', color: TEAL }}>{rec ? signOf(rec.by) : ''}</span><span style={{ fontSize: '1.9mm', letterSpacing: '0.06em', color: '#5f5c5a' }}>FOR HR</span></span>
          </span>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm', fontSize: '1.9mm', color: '#5f5c5a' }}><span>Issued {rec ? monYr(new Date(rec.issuedTs).toISOString().slice(0, 10)) : '—'}</span><span>Expires {monYr(exp)}</span>{hrCopy && <span>{phoneFmt(e.phone)}</span>}</span>
        </span>
      </div>
      <div style={{ height: '4mm', flex: 'none', background: '#e4f3f3' }} />
    </div>
  );
}

/**
 * The copies that print, placed straight under <body> (outside the app) and hidden on screen. While an ID card prints
 * the whole app is hidden (index.css), so the page holds only the cards: nothing else takes space, the browser does not
 * shrink the page to fit the app, and no blank pages follow. Inputs: the card on screen and, for HR, the batch sheet.
 */
function PrintCopies({ face, sheet = [] }: { face: Face; sheet?: Face[] }) {
  return createPortal(
    <div className="id-prints" aria-hidden="true">
      <div className="id-both"><IdFront {...face} /><IdBack {...face} /></div>
      <div className="id-cr80"><div className="id-page"><IdFront {...face} hrCopy={false} /></div><div className="id-page"><IdBack {...face} hrCopy={false} /></div></div>
      {sheet.length > 0 && <div className="id-sheet"><div className="id-grid">{sheet.map((f) => <IdFront key={f.e.id} {...f} />)}</div><div className="id-grid id-backs">{sheet.map((f) => <IdBack key={f.e.id} {...f} />)}</div></div>}
    </div>,
    document.body,
  );
}

/**
 * Print one ID card layout. The body gets a class so the print stylesheet (index.css) shows only that layout:
 * 'both' front and back on A4 to cut out, 'cr80' one side per 85.6 × 54 mm page for a PVC card printer (or Save as
 * PDF), 'sheet' up to 10 cards per A4 page (fronts, then backs in mirrored order for double-sided printing).
 */
export function printId(kind: 'both' | 'cr80' | 'sheet') {
  const st = document.createElement('style');
  st.textContent = kind === 'cr80' ? '@media print{@page{size:85.6mm 54mm;margin:0}}' : '@media print{@page{size:A4;margin:10mm}}';
  const cls = `print-id-${kind}`;
  document.head.appendChild(st); document.body.classList.add('print-id', cls);
  const off = () => { document.body.classList.remove('print-id', cls); st.remove(); window.removeEventListener('afterprint', off); };
  window.addEventListener('afterprint', off);
  window.print();
}

/** Banner at the top of the tab: teal for done, red for an error, with a dismiss button. */
function Banner({ m, onClose }: { m: { t: string; bad?: boolean } | null; onClose: () => void }) {
  if (!m) return null;
  return <div role={m.bad ? 'alert' : 'status'} className="no-print flex items-center gap-3 px-4 py-3 rounded-2xl text-white text-sm" style={{ background: m.bad ? '#c62828' : TEAL }}><span className="flex-1">{m.t}</span><button onClick={onClose} aria-label="Dismiss" className="text-lg leading-none">×</button></div>;
}

/** Crop a photo to the card's 22:28 passport shape and shrink it to a ~600 px tall JPEG. Output: a data URL. */
function passport(src: string): Promise<string> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const H = Math.min(600, im.height); const W = Math.round((H * 22) / 28);
      const r = 22 / 28; let sw = im.width, sh = im.height;
      if (sw / sh > r) sw = sh * r; else sh = sw / r; // keep the middle, cut the sides (or top / bottom)
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); if (!x) return res(src);
      x.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H);
      res(c.toDataURL('image/jpeg', 0.85));
    };
    im.onerror = () => rej(new Error('bad image'));
    im.src = src;
  });
}

/**
 * HR "ID cards" tab (Admin and eComPOS Support): employee picker (active staff; people who left are not listed),
 * the card front and back, and the actions panel. Inputs: the roster in view, badge codes, the HR admin's name and
 * all employees (for the verifier).
 */
export function IdCardsTab({ E, codes, me }: { E: Emp[]; codes: Record<string, string>; me: string }) {
  const [I, setI] = usePersist<IdMap>(IDC_KEY, {});
  const [hr] = usePersist<Record<string, HrRec>>(HR_KEY, {});
  const [logo] = usePersist<string>(LOGO_KEY, '');
  const staff = E.filter((e) => e.status !== 'Left');
  const [who, setWho] = useState(staff[0]?.name || '');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [rep, setRep] = useState(''); // reason when replacing a card
  const company = bizInfo().name;
  const e = staff.find((x) => x.name === who) || staff[0];
  if (!e) return <span className="text-sm text-muted">No active staff to make cards for.</span>;
  const rec = I[e.name]; const photo = photoOf(e, hr);
  const face: Face = { e, rec, photo, code: codes[e.name] || '', company, logo, hrCopy: true };
  const left = rec ? daysLeft(rec) : 0;
  const save = (N: IdMap, t: string, sev: 'low' | 'medium' = 'low') => { setI(N); secLog('ID card', `${t} · ${e.name} · by ${me}`, sev, me); };
  const issue = (send: boolean) => {
    const N = issueCard(I, e, me, { send });
    save(N, send ? 'Card issued and digital copy sent' : 'Card issued');
    if (send) {
      // The message that goes with the digital copy (build: SMS / email / in-app), and a bell notice for the employee.
      const O = readKey<{ to: string; subject: string; body: string; at: string; ts: number; kind: string }[]>('ecompos.outbox', []);
      writeKey('ecompos.outbox', [{ to: e.name, subject: 'Your staff ID card', body: `Hello ${e.name}, your ${company || 'company'} ID card (${N[e.name].no}) is now in your account under My HR. Keep it with you at work; the QR on it proves who you are.`, at: new Date().toLocaleDateString('en-GB'), ts: Date.now(), kind: 'hr-idcard' }, ...O].slice(0, 300));
      const role = { Manager: 'manager', Supervisor: 'supervisor', 'Sales staff': 'staff', Rider: 'rider', Admin: 'superuser' }[e.level];
      const notifs = readKey<unknown[]>('ecompos.notifs', NOTIF0);
      writeKey('ecompos.notifs', [{ id: `ID-${Date.now()}`, t: 'Your staff ID card is ready', s: 'Open People & HR to view, print or download it.', at: Date.now(), to: [role], who: e.name, readBy: [], link: '/staff' }, ...notifs]);
    }
    setMsg({ t: send ? `ID card sent to ${e.name}. They can view, print or download it in My HR.` : `ID card issued for ${e.name}. Print it and hand it over.` });
  };
  const onPhoto = (f?: File | null) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) return setMsg({ t: 'Choose a photo file (JPG or PNG).', bad: true });
    if (f.size > 2 * 1024 * 1024) return setMsg({ t: 'That photo is over 2 MB. Use a smaller one.', bad: true });
    const r = new FileReader();
    r.onload = () => passport(String(r.result)).then((url) => {
      const H = readKey<Record<string, HrRec>>(HR_KEY, {});
      writeKey(HR_KEY, { ...H, [e.name]: { ...(H[e.name] || {}), photo: url } }); // fires ecompos:hr: every screen updates
      setI(noteCard(readKey<IdMap>(IDC_KEY, {}), e.name, 'Photo changed', me)); secLog('ID card', `Photo changed · ${e.name} · by ${me}`, 'low', me);
      setMsg({ t: `Photo saved for ${e.name}.` });
    }).catch(() => setMsg({ t: 'Choose a photo file (JPG or PNG).', bad: true }));
    r.readAsDataURL(f);
  };
  const print = (kind: 'both' | 'cr80' | 'sheet') => { if (rec) setI(noteCard(I, e.name, kind === 'sheet' ? 'Printed on a batch sheet' : kind === 'cr80' ? 'Printed for the card printer' : 'Printed both sides', me)); printId(kind); };
  const sheet = staff.filter((x) => I[x.name]).slice(0, 10);
  const expiring = staff.filter((x) => I[x.name] && daysLeft(I[x.name]) <= 30);
  const stale = staff.filter((x) => outOfDate(I[x.name], x));
  return (
    <div className="flex flex-col gap-4">
      <Banner m={msg} onClose={() => setMsg(null)} />
      {(expiring.length > 0 || stale.length > 0) && <div className="no-print rounded-2xl px-4 py-3 text-sm bg-[#fff4e0] text-[#7a4a00]">{expiring.length > 0 && <span className="block">Cards expiring within 30 days or expired: {expiring.map((x) => `${x.name} (${monYr(I[x.name].exp)})`).join(', ')}.</span>}{stale.length > 0 && <span className="block">Card details out of date — reissue: {stale.map((x) => x.name).join(', ')}.</span>}</div>}
      <div className="no-print flex gap-1.5 flex-wrap items-center"><span className="text-[13px] text-[#5f5c5a] mr-1">Employee</span>
        {staff.map((x) => <button key={x.id} type="button" onClick={() => { setWho(x.name); setMsg(null); setRep(''); }} aria-pressed={x.name === e.name} className="text-xs px-3 py-[7px] rounded-full" style={{ background: x.name === e.name ? TEAL : '#fff', color: x.name === e.name ? '#fff' : '#000', border: `1px solid ${x.name === e.name ? TEAL : '#ebebeb'}` }}>{x.name}</button>)}
      </div>
      <div className="flex flex-wrap gap-5 items-start">
        <section className="id-print flex-[0_1_auto] flex flex-wrap gap-[18px]" aria-label="ID card, front and back">
          <div className="flex flex-col gap-[7px]"><span className="no-print text-[11px] font-bold tracking-[0.1em] text-[#5f5c5a]">FRONT · 85.6 × 54 mm</span><IdFront {...face} /></div>
          <div className="flex flex-col gap-[7px]"><span className="no-print text-[11px] font-bold tracking-[0.1em] text-[#5f5c5a]">BACK · 85.6 × 54 mm</span><IdBack {...face} /></div>
        </section>
        <section aria-label="ID card actions" className="no-print flex-[1_1_300px] min-w-0 bg-white rounded-3xl p-5 flex flex-col gap-3 shadow-card">
          <h2 className="m-0 text-[17px] font-semibold">{e.name}’s card</h2>
          <span className="text-[13px] text-[#3d3a38]">Scanning the QR shows: {e.name} · {e.level} · {e.br === 'all' ? 'all branches' : brFull(e.br)} · {company}</span>
          <span className="text-[12.5px] text-[#5f5c5a]">Printed at 85.6 × 54 mm, the same size as a bank card, so it fits a normal badge holder and any card printer. Print at 100% (“Actual size”), not “Fit to page”.</span>
          <div className="flex flex-col gap-1 text-[12.5px] text-[#5f5c5a]"><span>{rec ? `Issued ${rec.issued} by ${rec.by}${rec.issueNo > 1 ? ` · issue ${rec.issueNo}` : ''}` : 'Not issued yet'}</span><span>{rec?.sent ? `Digital copy sent ${rec.sent}` : 'No digital copy sent yet'}</span>{rec && <span style={{ color: left < 0 ? '#c62828' : left <= 30 ? '#b26a00' : undefined }}>{left < 0 ? `Expired ${monYr(rec.exp)} — reissue the card` : left <= 30 ? `Expires in ${left} days — reissue it before ${monYr(rec.exp)}` : `Valid to ${monYr(rec.exp)}`}</span>}</div>
          {outOfDate(rec, e) && <span className="text-[12.5px] font-semibold text-[#b26a00]">Card details out of date — reissue. The role, branch or name changed since this card was issued.</span>}
          {!photo && <span className="text-[12.5px] font-semibold text-[#b26a00]">No photo yet — the card prints with initials until one is added. A passport-style photo works best.</span>}
          <label className="relative inline-flex items-center gap-2 self-start text-[13px] font-semibold px-4 py-2.5 rounded-full cursor-pointer" style={{ border: `1px dashed ${TEAL}`, color: TEAL }}>Upload a photo<input type="file" accept="image/*" onChange={(x) => { onPhoto(x.target.files?.[0]); x.target.value = ''; }} className="absolute w-px h-px opacity-0" /></label>
          <div className="flex gap-2 flex-wrap pt-1.5 border-t border-[#ebebeb]">
            <button type="button" onClick={() => issue(false)} className="text-[13px] font-semibold px-[18px] py-[11px] rounded-full border border-[#ebebeb] bg-white">Issue card</button>
            <button type="button" onClick={() => print('both')} className="text-[13px] font-semibold px-[18px] py-[11px] rounded-full border border-[#ebebeb] bg-white">Print both sides</button>
            <button type="button" onClick={() => issue(true)} className="text-[13px] font-semibold px-[18px] py-[11px] rounded-full text-white" style={{ background: TEAL }}>Send digital copy</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => print('cr80')} className="text-xs font-semibold px-3.5 py-2 rounded-full border border-[#ebebeb] bg-white">Card printer / PDF (CR80, one side per page)</button>
            <button type="button" disabled={!sheet.length} onClick={() => print('sheet')} className="text-xs font-semibold px-3.5 py-2 rounded-full border border-[#ebebeb] bg-white disabled:opacity-40">Print sheet ({sheet.length} issued card{sheet.length === 1 ? '' : 's'}, up to 10 per A4)</button>
          </div>
          {/* Lost or damaged card: a new issue; the old card stops verifying straight away. */}
          {rec && (rep ? (
            <div className="flex gap-2 flex-wrap items-center"><span className="text-xs font-semibold">Why replace it?</span>{['Lost card', 'Damaged card', 'Details changed'].map((w) => <button key={w} type="button" onClick={() => { save(issueCard(I, e, me, { replace: w }), `Card replaced (${w})`, 'medium'); setRep(''); setMsg({ t: `New card issued for ${e.name} (${w.toLowerCase()}). The old card no longer verifies. Print the new one and hand it over.` }); }} className="text-xs px-3 py-1.5 rounded-full border border-black">{w}</button>)}<button type="button" onClick={() => setRep('')} className="text-xs underline">Cancel</button></div>
          ) : <button type="button" onClick={() => setRep('ask')} className="self-start text-xs font-semibold text-[#c62828]">Report lost card / replace card</button>)}
          {rec?.log?.length ? <details className="text-xs text-[#5f5c5a]"><summary className="cursor-pointer font-semibold">Card history ({rec.log.length})</summary>{rec.log.map((l, k) => <span key={k} className="block">{new Date(l.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {l.t} · {l.by}</span>)}</details> : null}
        </section>
      </div>
      <PrintCopies face={face} sheet={sheet.map((x) => ({ e: x, rec: I[x.name], photo: photoOf(x, hr), code: codes[x.name] || '', company, logo }))} />
      <VerifyId E={E} />
    </div>
  );
}

/**
 * My HR → "My ID card" (Manager, Supervisor, Sales staff, Rider): shown only once HR has sent the digital copy.
 * Same front and back without the phone. Inputs: the signed-in employee and their badge code.
 */
export function MyIdCard({ e, code }: { e: Emp; code: string }) {
  const [I] = usePersist<IdMap>(IDC_KEY, {});
  const [hr] = usePersist<Record<string, HrRec>>(HR_KEY, {});
  const [logo] = usePersist<string>(LOGO_KEY, '');
  const rec = I[e.name];
  if (!rec?.sent) return null;
  const face: Face = { e, rec, photo: photoOf(e, hr), code, company: bizInfo().name, logo };
  return (
    <div className="id-print bg-white rounded-3xl p-5 flex flex-col gap-3 shadow-card lg:col-span-2">
      <div className="no-print flex justify-between gap-2 items-center flex-wrap"><h2 className="m-0 text-[17px] font-semibold">My ID card</h2><span className="text-xs text-[#5f5c5a]">85.6 × 54 mm · front and back</span></div>
      <div className="flex gap-4 flex-wrap"><IdFront {...face} /><IdBack {...face} /></div>
      <PrintCopies face={face} />
      <button type="button" onClick={() => printId('both')} className="no-print self-start text-[13px] font-semibold px-4 py-2.5 rounded-full border border-[#ebebeb] bg-white">Print or save both sides</button>
    </div>
  );
}

/**
 * "Verify ID card" (Admin, Manager, Supervisor, security): scan the card's QR with the camera, or type / paste the text.
 * Shows photo, name, position, branch, staff number, status and valid-to, with green "Valid card" or the red reason.
 * Input: the roster.
 */
export function VerifyId({ E }: { E: Emp[] }) {
  const [cam, setCam] = useState(false);
  const [typed, setTyped] = useState('');
  const [res, setRes] = useState<IdCheck | null>(null);
  const [hr] = usePersist<Record<string, HrRec>>(HR_KEY, {});
  const check = (raw: string) => { setCam(false); const r = verifyId(raw, E, readKey<IdMap>(IDC_KEY, {}), bizInfo().name); setRes(r); secLog('ID card verified', `${r.emp?.name || 'Unknown card'} · ${r.reason}`, r.ok ? 'low' : 'medium'); };
  const e = res?.emp;
  return (
    <section aria-labelledby="vid-h" className="no-print bg-white rounded-3xl p-5 flex flex-col gap-3 shadow-card">
      <div className="flex justify-between items-center gap-2 flex-wrap"><h2 id="vid-h" className="m-0 text-[17px] font-semibold">Verify ID card</h2><button type="button" onClick={() => { setCam(!cam); setRes(null); }} aria-expanded={cam} className="h-10 px-4 rounded-full text-white text-sm font-semibold" style={{ background: TEAL }}>{cam ? 'Close camera' : 'Scan a card'}</button></div>
      <span className="text-sm text-[#5f5c5a]">Scan the QR on the back of a staff ID card to check it is real, current and belongs to someone still working here.</span>
      {cam && <BarcodeCamera onRead={check} formats={['qr_code']} height={220} caption="Hold the card’s QR inside the frame" />}
      <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); if (typed.trim()) check(typed); }}><label className="sr-only" htmlFor="vid-in">Card QR text</label><input id="vid-in" value={typed} onChange={(x) => setTyped(x.target.value)} placeholder="Or paste the scanned text (ECOMPOS|ID|…)" autoComplete="off" className="flex-1 min-w-0 h-11 px-4 rounded-full border border-[#ebebeb] text-sm" /><button type="submit" className="h-11 px-4 rounded-full bg-black text-white text-sm font-semibold">Check</button></form>
      {res && (
        <div role="status" className="rounded-2xl p-4 flex gap-4 items-start flex-wrap" style={{ border: `2px solid ${res.ok ? '#1f7a2a' : '#c62828'}` }}>
          {e && <span className="w-[66px] h-[84px] rounded-lg overflow-hidden flex items-center justify-center text-white text-xl font-semibold flex-none" style={{ background: toneOf(e.name) }}>{photoOf(e, hr) ? <img src={photoOf(e, hr)} alt={`Photo of ${e.name}`} className="w-full h-full object-cover" /> : iniOf(e.name)}</span>}
          <div className="flex-1 min-w-[180px] flex flex-col gap-0.5 text-sm">
            <b className={cx('text-base', res.ok ? 'text-[#1f7a2a]' : 'text-[#c62828]')}>{res.ok ? '✓ Valid card' : `✕ ${res.reason}`}</b>
            {e && <><span><b>{e.name}</b> · {e.level}</span><span>{brFull(e.br)} · {res.rec?.no || staffNoOf(e)}</span><span>Status: {res.status}{res.rec ? ` · valid to ${monYr(res.rec.exp)}` : ''}</span></>}
          </div>
        </div>
      )}
    </section>
  );
}
