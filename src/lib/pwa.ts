// Installable apps ("Add to home screen" / "Install app") for the online store and the Unified POS.
//
// Two separate apps share this one site:
//   • the online store  → /store.webmanifest (scope "/",     icon public/icons/store-*.png)
//   • the Unified POS   → /pos.webmanifest   (scope "/pos/", icon public/icons/pos-*.png)
// initPwa() runs once at start-up (main.tsx) and links the right manifest for the address that was opened, so
// installing from /pos installs the POS and installing from anywhere else installs the store.
//
// How each browser installs:
//   • Chrome / Edge / Samsung Internet (Android, Windows, Mac, ChromeOS): they fire `beforeinstallprompt`. We keep
//     that event and call prompt() from our own "Install" button (mode 'prompt').
//   • iPhone / iPad: no install event exists; the visitor uses Share › Add to Home Screen (mode 'ios').
//   • Safari on Mac (17+): File › Add to Dock (mode 'mac-safari').
//   • Firefox desktop and others: cannot install web apps, so nothing is offered (mode 'none').
import { useEffect, useState } from 'react';

export type InstallApp = 'store' | 'pos';
export type InstallMode = 'prompt' | 'ios' | 'mac-safari' | 'none';

/** Chrome's install event (not in the TypeScript DOM types). */
type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: BeforeInstallPrompt | null = null; // the browser's install offer, kept until our button uses it
let installed = false;                            // set when the app was installed during this visit
const EVT = 'ecompos:pwa';
const emit = () => window.dispatchEvent(new CustomEvent(EVT));

/** Add or update a <link> / <meta> tag in the page head. */
function headTag(tag: 'link' | 'meta', key: string, attrs: Record<string, string>) {
  const sel = tag === 'link' ? `link[rel="${key}"]` : `meta[name="${key}"]`;
  let el = document.head.querySelector(sel) as HTMLElement | null;
  if (!el) { el = document.createElement(tag); document.head.appendChild(el); }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

/**
 * Start-up: link the app's manifest and home-screen icon, listen for the browser's install offer, and register the
 * service worker (public/sw.js). Input: which app this page belongs to.
 */
export function initPwa(app: InstallApp) {
  const pos = app === 'pos';
  headTag('link', 'manifest', { rel: 'manifest', href: pos ? '/pos.webmanifest' : '/store.webmanifest' });
  headTag('link', 'apple-touch-icon', { rel: 'apple-touch-icon', sizes: '180x180', href: `/icons/${app}-180.png` });
  headTag('meta', 'theme-color', { name: 'theme-color', content: pos ? '#0b5c5c' : '#1a1240' });
  headTag('meta', 'apple-mobile-web-app-title', { name: 'apple-mobile-web-app-title', content: pos ? 'UnifiedPOS' : 'Ebenezer' });
  headTag('meta', 'mobile-web-app-capable', { name: 'mobile-web-app-capable', content: 'yes' });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // hide the browser's own mini banner: our pop-up asks instead (and the POS asks for the PIN first)
    deferred = e as BeforeInstallPrompt;
    emit();
  });
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit(); });
  if ('serviceWorker' in navigator) {
    const reg = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* not available (e.g. private mode): the site still works */ });
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });
  }
}

/** True when the page is already running as an installed app (no browser address bar). */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** How this browser can install the app right now (see the header comment). */
export function installMode(): InstallMode {
  if (installed || isStandalone()) return 'none';
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen tells them apart.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  const macSafari = /Macintosh/.test(ua) && /Version\/(1[7-9]|[2-9]\d)/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);
  return macSafari ? 'mac-safari' : 'none';
}

/**
 * Show the browser's install dialog (mode 'prompt' only). Must be called from a click.
 * Output: 'accepted' when the visitor installed, 'dismissed' when they said no, 'unavailable' when there is no offer.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = deferred;
  if (!ev) return 'unavailable';
  deferred = null; // an offer can only be used once; the browser sends a new one later if the visitor says no
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === 'accepted') installed = true;
  emit();
  return outcome;
}

/** React hook: the current install mode, updated when the browser's offer arrives or the app gets installed. */
export function useInstallMode(): InstallMode {
  const [mode, setMode] = useState<InstallMode>(() => installMode());
  useEffect(() => {
    const up = () => setMode(installMode());
    up();
    window.addEventListener(EVT, up);
    return () => window.removeEventListener(EVT, up);
  }, []);
  return mode;
}
