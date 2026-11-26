import { GROUP_ICONS, ITEM_ICONS, UI_ICONS, type UiIcon } from '../data/icons';

type Props = {
  /** A UI icon key, a nav item id, a nav group label, or a raw SVG path. */
  name?: UiIcon | string;
  d?: string;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
};

export function iconPath(name: string): string {
  return (
    (UI_ICONS as Record<string, string>)[name] ??
    ITEM_ICONS[name] ??
    GROUP_ICONS[name] ??
    ITEM_ICONS.pin
  );
}

export default function Icon({ name, d, size = 18, stroke = 1.8, className, label }: Props) {
  const path = d ?? iconPath(name ?? 'pin');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: 'none' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={path} />
    </svg>
  );
}
