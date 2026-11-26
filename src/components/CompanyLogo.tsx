// The tenant company's logo (currently the MNEST Systems logo), as used on documents, cards and headers.
import { useCompanyLogo } from '../lib/brand';
import { cx } from '../lib/format';

/**
 * The company's logo on a transparent background, so it takes on whatever background it sits on.
 * Inputs: icon → the square "m" mark instead of the full logo (for small spots);
 *         onDark → place it on a small white tile, because the logo's navy cannot be seen on dark backgrounds;
 *         className → size classes; alt → alt text (empty when a visible name sits next to it).
 */
export default function CompanyLogo({ icon, onDark, className, alt = '' }: { icon?: boolean; onDark?: boolean; className?: string; alt?: string }) {
  const src = useCompanyLogo(icon);
  return <img src={src} alt={alt} className={cx('object-contain', onDark && 'bg-white rounded-xl p-1', className)} />;
}
