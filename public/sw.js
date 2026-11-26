// Service worker for the installable apps (the online store at / and the Unified POS at /pos/).
// Browsers only offer "Install" for a site with a service worker that handles page loads. This one is deliberately
// small: every page load goes to the network as normal (so prices, stock and orders are always live), and only when
// the device is offline does it show a short "You are offline" page instead of the browser's error screen.
// Nothing else (data, images, scripts) is cached, so there is never stale stock or prices.

self.addEventListener('install', () => self.skipWaiting());           // take over straight away after an update
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/** The page shown when a page is opened with no connection. */
const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>You are offline</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;background:#f2f4f5;color:#111;text-align:center;padding:24px}
.c{max-width:360px;background:#fff;border-radius:24px;padding:28px;box-shadow:0 18px 40px -28px rgba(0,0,0,.35)}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 18px;color:#555;line-height:1.5}
button{height:44px;padding:0 22px;border:0;border-radius:999px;background:#111;color:#fff;font-weight:600;font-size:15px}</style></head>
<body><div class="c"><h1>You are offline</h1><p>Check your internet connection, then try again.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener('fetch', (e) => {
  // Only page loads (navigations). Everything else goes to the network untouched.
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
