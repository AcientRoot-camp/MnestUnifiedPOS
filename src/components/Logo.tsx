import { cx } from '../lib/format';

/**
 * MNest UnifiedPOS logo. The logo file still has the old "eCom" wordmark baked in, so the cart artwork is cropped
 * above it and the product name is set as text by <Wordmark>: navy "MNest" and teal "UnifiedPOS".
 */
/** Brand colours, matched to the MNest "m" mark used as the favicon (public/favicon.svg). */
export const BRAND_NAVY = '#012149';
export const BRAND_TEAL = '#01807B';

/**
 * The "MNest UnifiedPOS" product name as text: "MNest" in navy, "UnifiedPOS" in teal, on every screen.
 * Inputs: dark → the wordmark sits on a black background (sidebar, mobile header, footers). Navy text cannot be read
 *         on black, so it is wrapped in a white pill instead of changing the brand colours.
 *         className → extra classes, typically the font size.
 *         logo → show the MNEST logo image (public/assets/mnest-wordmark.png, green-and-navy "mnest"; ?v= forces browsers
 *                to load a replaced file) in place of the
 *                word "MNest" (used on the sign-in page). It is sized in em, so it scales with the font size.
 * Output: an inline element reading "MNest UnifiedPOS".
 */
export function Wordmark({ dark, className, logo }: { dark?: boolean; className?: string; logo?: boolean }) {
  const name = (
    <span className={cx('font-extrabold tracking-[-0.02em] leading-none whitespace-nowrap', logo && 'inline-flex items-center gap-[0.3em]', className)}>
      {logo
        ? <img src="/assets/mnest-wordmark.png?v=2" alt="MNest" className="inline-block w-auto" style={{ height: '0.82em' }} />
        : <span style={{ color: BRAND_NAVY }}>MNest</span>}{logo ? null : ' '}
      <span style={{ color: BRAND_TEAL }}>UnifiedPOS</span>
    </span>
  );
  return dark ? <span className="inline-flex px-3 py-1 rounded-full bg-white">{name}</span> : name;
}

/**
 * The shopping-cart artwork, cropped above its baked-in wordmark.
 * teal → uses mnestpos-logo-teal.png, the same artwork with the green cart recoloured to teal (boxes unchanged).
 */
export function LogoMark({ size = 36, className, teal }: { size?: number; className?: string; teal?: boolean }) {
  // The artwork fills the top ~83% of the square image.
  return (
    <span aria-hidden className={cx('block overflow-hidden flex-none', className)} style={{ width: size, height: Math.round(size * 0.83) }}>
      <img src={teal ? '/assets/mnestpos-logo-teal.png' : '/assets/ecompos-logo-dark.png'} alt="" style={{ width: size, height: size }} className="object-contain object-top" />
    </span>
  );
}

/**
 * Cart artwork with the "MNest UnifiedPOS" wordmark under it.
 * Inputs: size → artwork width in px; dark → black background (wordmark goes in a white pill);
 *         navy → the sign-in look, which swaps the cart artwork to its teal version; textClass → wordmark font size;
 *         logoWord → the MNEST logo image instead of the word "MNest" (see Wordmark `logo`).
 */
export default function Logo({ size = 88, dark, navy, textClass = 'text-[20px]', logoWord }: { size?: number; dark?: boolean; navy?: boolean; textClass?: string; logoWord?: boolean }) {
  return (
    <span role="img" aria-label="MNest UnifiedPOS" className="flex flex-col items-center gap-0.5">
      <LogoMark size={size} teal={navy} />
      <Wordmark dark={dark} className={textClass} logo={logoWord} />
    </span>
  );
}
