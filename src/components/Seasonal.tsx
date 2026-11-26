// Seasonal touches shared by the online store and the POS (dates and preview in lib/season.ts):
//   ChristmasHat        – a small Santa hat drawn on top of an icon (store sign-in / account icon, 15–31 December).
//   SeasonCelebration   – 25 December: "Merry Christmas" pop-up with a Christmas tree and falling snow;
//                         26 December: "Happy Boxing Day" pop-up with two people exchanging a gift.
// The pop-up shows once per day on each device (separately for the store and the POS) and closes with its button,
// the ×, Esc or a tap outside, so it never gets in the way of selling or shopping.
import { useEffect, useMemo, useState } from 'react';
import { seasonOf, seasonPreviewing } from '../lib/season';

/**
 * Santa hat to sit on an icon. Place it inside a `relative` button; it is tilted on the top-right of the icon.
 * Input: size in px (width). Output: an SVG hidden from screen readers (decoration only).
 */
export function ChristmasHat({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 44 36" aria-hidden="true" focusable="false" className={`pointer-events-none ${className}`}>
      <path d="M6 28 C10 14 20 4 32 6 C38 7 40 14 36 20 C33 14 28 12 24 14 C30 18 34 24 36 28 Z" fill="#e11d2e" />
      <path d="M24 14 C28 12 33 14 36 20 C34 17 30 15 24 14 Z" fill="#9b1020" opacity="0.5" />
      <rect x="3" y="25" width="36" height="9" rx="4.5" fill="#ffffff" />
      <circle cx="37" cy="21" r="5" fill="#ffffff" />
    </svg>
  );
}

/** The pop-up's words for each day, for customers (store) and for staff (POS). */
const TEXT = {
  christmas: {
    img: '/assets/christmas.svg',
    alt: 'A decorated Christmas tree with presents underneath',
    title: 'Merry Christmas! 🎄',
    store: (biz: string) => `From all of us at ${biz}, thank you for shopping with us this year. We wish you and your family a joyful Christmas, peace and a happy New Year.`,
    pos: (biz: string) => `Merry Christmas, team! Thank you for all your hard work at ${biz} this year. Enjoy the celebrations with your family and loved ones.`,
    store_btn: 'Thank you',
    pos_btn: 'Merry Christmas!',
  },
  boxing: {
    img: '/assets/boxing-day.svg',
    alt: 'Two people smiling and exchanging a wrapped gift',
    title: 'Happy Boxing Day! 🎁',
    store: (biz: string) => `Today is for sharing, giving and spending time together. Thank you for being part of the ${biz} family. Enjoy your Boxing Day!`,
    pos: (biz: string) => `Happy Boxing Day, team! A day for sharing and giving. Thank you for everything you do for our customers at ${biz}.`,
    store_btn: 'Continue shopping',
    pos_btn: 'Happy Boxing Day!',
  },
} as const;

/**
 * Celebration pop-up for 25 and 26 December. Inputs: where ('store' | 'pos', which wording to use and which
 * "already shown today" memory) and biz (the business name in the message). Renders nothing on other days.
 */
export function SeasonCelebration({ where, biz }: { where: 'store' | 'pos'; biz: string }) {
  const s = useMemo(() => seasonOf(), []);
  const memo = `ecompos.season.${s.key}.${where}`;
  const [open, setOpen] = useState(() => {
    if (!s.day) return false;
    try { return !localStorage.getItem(memo) || seasonPreviewing(); } catch { return true; }
  });
  // Remember it was shown today on this device, so it greets once rather than on every page.
  const close = () => { setOpen(false); try { localStorage.setItem(memo, '1'); } catch { /* storage blocked */ } };
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Snowflakes for Christmas: fixed positions, sizes and timings (no random numbers, so it looks the same each render).
  const flakes = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ left: (i * 37) % 100, size: 4 + (i % 4) * 2, dur: 7 + (i % 5) * 1.6, delay: -((i * 0.73) % 9) })), []);
  if (!open || !s.day) return null;
  const t = TEXT[s.day];
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[rgba(10,6,30,0.55)]" onClick={close}>
      {s.day === 'christmas' && (
        <div aria-hidden="true" className="season-snow pointer-events-none absolute inset-0 overflow-hidden">
          {flakes.map((f, i) => <span key={i} style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />)}
        </div>
      )}
      <section role="dialog" aria-modal="true" aria-labelledby="season-h" onClick={(e) => e.stopPropagation()} className="season-pop relative w-full max-w-[440px] bg-white rounded-[28px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <img src={t.img} alt={t.alt} className="block w-full aspect-[16/9] object-cover" />
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 rounded-full bg-black/40 text-white text-xl leading-none hover:bg-black/60">×</button>
        <div className="p-6 flex flex-col gap-3 text-center">
          <h2 id="season-h" className="m-0 text-[26px] font-semibold tracking-tight text-[#1a1240]">{t.title}</h2>
          <p className="m-0 text-[15px] leading-relaxed text-sub">{where === 'store' ? t.store(biz) : t.pos(biz)}</p>
          <button onClick={close} className="self-center h-12 px-7 rounded-full text-white font-semibold" style={{ background: s.day === 'christmas' ? '#c8102e' : '#1a1240' }}>{where === 'store' ? t.store_btn : t.pos_btn}</button>
          {seasonPreviewing() && <span className="text-[11px] text-muted">Preview of {s.key} · add ?season=off to the address to end the preview</span>}
        </div>
      </section>
    </div>
  );
}
