// Seasonal touches for the online store and the POS (components/Seasonal.tsx):
//   15–31 December  → a Christmas hat on the store's sign-in / account icon;
//   25 December     → a Christmas celebration pop-up with falling snow (store and POS);
//   26 December     → a Boxing Day pop-up with two people exchanging a gift (store and POS).
// Dates use the device's own calendar (local time), so Ghana sees them on Ghana's date.
//
// Preview: add ?season=YYYY-MM-DD to any store or POS address (e.g. ?season=2026-12-25) to see that day's touches
// now. It is remembered for the browser tab (sessionStorage) so moving between pages keeps it; ?season=off ends it.

const PREVIEW_KEY = 'ecompos.seasonDate';

/**
 * The date the seasonal features should use: today, or the preview date from ?season=YYYY-MM-DD.
 * Output: a Date at local midnight of that day.
 */
export function seasonDate(): Date {
  try {
    const q = new URLSearchParams(window.location.search).get('season');
    if (q === 'off') sessionStorage.removeItem(PREVIEW_KEY);
    else if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) sessionStorage.setItem(PREVIEW_KEY, q);
    const p = sessionStorage.getItem(PREVIEW_KEY);
    if (p) { const [y, m, d] = p.split('-').map(Number); return new Date(y, m - 1, d); }
  } catch { /* storage blocked: use today */ }
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** True while a preview date is active (shown as a small "Preview" note so nobody mistakes it for the real date). */
export function seasonPreviewing(): boolean {
  try { return !!sessionStorage.getItem(PREVIEW_KEY); } catch { return false; }
}

export type Season = {
  /** 15–31 December: Christmas hat on the store's sign-in / account icon. */
  hat: boolean;
  /** Which celebration pop-up today gets, if any. */
  day: 'christmas' | 'boxing' | null;
  /** yyyy-mm-dd of the date used (keys the "already shown today" memory). */
  key: string;
};

/** The seasonal features for a date (default: seasonDate()). */
export function seasonOf(d: Date = seasonDate()): Season {
  const m = d.getMonth() + 1; const day = d.getDate();
  const key = `${d.getFullYear()}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    hat: m === 12 && day >= 15,
    day: m === 12 && day === 25 ? 'christmas' : m === 12 && day === 26 ? 'boxing' : null,
    key,
  };
}
