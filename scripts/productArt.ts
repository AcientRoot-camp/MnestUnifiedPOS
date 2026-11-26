// Draws a product illustration for every product in the demo catalogue, in the same style as the online store's hero
// (soft navy-to-amber light, drop shadows, simple flat shapes), and saves them as public/assets/products/<id>.svg.
// The catalogue points each product's photo (img) at its file, so the store, the till, the chat and search all show it.
// Each drawing follows the product: a TV's width grows with its screen size and its picture changes colour; fridges
// are table-top, single-door, double-door or side-by-side; fans are standing, table, wall, ceiling, tower or
// rechargeable; washing machines are front-load, top-load or twin-tub; and so on. The brand is printed on the product.
//
// Run after changing the catalogue:  npx esbuild scripts/productArt.ts --bundle --platform=node --outfile=/tmp/art.cjs && node /tmp/art.cjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { PRODUCTS0, type Product } from '../src/data/catalogue';

const W = 800, H = 800;
/** Small deterministic number from a product id, for picture colours and finishes. */
const seed = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const brandOf = (p: Product) => p.name.split(' ')[0].toUpperCase();
const num = (re: RegExp, s: string, d: number) => { const m = re.exec(s); return m ? parseFloat(m[1]) : d; };

/** Shared defs: background light, shadow and the metal / plastic finishes. */
function defs(hue: number) {
  return `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eeeaff"/><stop offset="0.6" stop-color="#f6f1ff"/><stop offset="1" stop-color="#ffe9d6"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.42" r="0.55"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,18%)"/><stop offset="0.5" stop-color="hsl(${(hue + 30) % 360},75%,45%)"/><stop offset="0.8" stop-color="hsl(${(hue + 160) % 360},90%,62%)"/><stop offset="1" stop-color="#ffd166"/></linearGradient>
<linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9bfc8"/><stop offset="0.45" stop-color="#f4f6f9"/><stop offset="1" stop-color="#a7adb7"/></linearGradient>
<linearGradient id="white" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e3e7ed"/><stop offset="0.5" stop-color="#ffffff"/><stop offset="1" stop-color="#d6dbe2"/></linearGradient>
<linearGradient id="black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34343b"/><stop offset="1" stop-color="#0e0e12"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c2533"/><stop offset="1" stop-color="#3d4b63"/></linearGradient>
<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#1a1240" flood-opacity="0.28"/></filter>
</defs>`;
}
/** Frame: background, soft floor shadow, the product drawing on top. */
const frame = (hue: number, body: string, floorW = 420) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(hue)}
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>
<ellipse cx="400" cy="690" rx="${floorW / 2}" ry="26" fill="#1a1240" opacity="0.10"/>
${body}</svg>`;
const label = (x: number, y: number, t: string, size: number, fill: string, anchor = 'middle', weight = 700, ls = 2) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${ls}">${esc(t)}</text>`;

/* ---------- drawings (each returns the product's shapes) ---------- */

function tv(p: Product, hue: number) {
  const inch = num(/(\d+)"/, p.name, 43); const w = Math.round(320 + (Math.min(inch, 85) - 24) * 6.4); const h = Math.round(w * 0.58);
  const x = 400 - w / 2, y = 380 - h / 2; const thin = /qled|oled|mini-led|uled|nanocell|bravia/i.test(p.name) ? 6 : 12;
  const tag = /oled/i.test(p.name) ? 'OLED' : /qled/i.test(p.name) ? 'QLED' : /mini-led/i.test(p.name) ? 'MINI LED' : /4k|uhd|crystal|nanocell|uled|bravia/i.test(p.name) ? '4K UHD' : /fhd/i.test(p.name) ? 'FULL HD' : 'HD';
  const sun = 0.68 + (hue % 20) / 100;
  return `<g filter="url(#sh)">
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${thin + 4}" fill="url(#black)"/>
<rect x="${x + thin}" y="${y + thin}" width="${w - thin * 2}" height="${h - thin * 2 - 6}" rx="4" fill="url(#scr)"/>
<circle cx="${x + w * sun}" cy="${y + h * 0.36}" r="${h * 0.14}" fill="#ffd166" opacity="0.92"/>
<path d="M${x + thin} ${y + h * 0.72} C ${x + w * 0.25} ${y + h * 0.58}, ${x + w * 0.45} ${y + h * 0.7}, ${x + w * 0.62} ${y + h * 0.6} S ${x + w * 0.9} ${y + h * 0.56}, ${x + w - thin} ${y + h * 0.64} L${x + w - thin} ${y + h - thin - 6} L${x + thin} ${y + h - thin - 6} Z" fill="#1a1240" opacity="0.85"/>
${label(x + thin + 18, y + thin + 32, tag, Math.max(16, w / 26), '#ffffff', 'start', 700, 1)}
${label(400, y + h - 2, brandOf(p), 13, '#c9ccd4', 'middle', 700, 3)}
<rect x="${400 - w * 0.22}" y="${y + h}" width="10" height="${Math.max(40, 690 - (y + h) - 14)}" fill="#1b1b20" transform="rotate(14 ${400 - w * 0.22} ${y + h})"/>
<rect x="${400 + w * 0.22 - 10}" y="${y + h}" width="10" height="${Math.max(40, 690 - (y + h) - 14)}" fill="#1b1b20" transform="rotate(-14 ${400 + w * 0.22} ${y + h})"/>
</g>`;
}

function fridge(p: Product, hue: number) {
  const n = p.name.toLowerCase(); const finish = seed(p.id) % 3 === 0 ? 'url(#black)' : seed(p.id) % 3 === 1 ? 'url(#steel)' : 'url(#white)';
  const dark = finish === 'url(#black)'; const handle = dark ? '#8a8f99' : '#7d838d'; const txt = dark ? '#cfd3da' : '#6b7280';
  if (/side-by-side|instaview/.test(n)) {
    const x = 220, y = 120, w = 360, h = 560;
    return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${finish}"/>
<line x1="400" y1="${y}" x2="400" y2="${y + h}" stroke="${dark ? '#000' : '#8d939d'}" stroke-width="4"/>
<rect x="384" y="${y + 120}" width="8" height="200" rx="4" fill="${handle}"/><rect x="408" y="${y + 120}" width="8" height="200" rx="4" fill="${handle}"/>
<rect x="${x + 40}" y="${y + 110}" width="110" height="150" rx="10" fill="url(#glass)"/><rect x="${x + 64}" y="${y + 200}" width="62" height="40" rx="6" fill="#0d1117"/>
${/instaview/.test(n) ? `<rect x="${x + 220}" y="${y + 90}" width="110" height="200" rx="10" fill="url(#glass)" opacity="0.85"/>` : ''}
${label(400, y + h - 24, brandOf(p), 18, txt)}</g>`;
  }
  const table = /table-top/.test(n); const dbl = /double/.test(n);
  const litres = num(/(\d+)L/i, p.name, 200); const h = table ? 300 : Math.round(380 + Math.min(litres, 450) * 0.55); const w = table ? 260 : 230 + Math.min(litres, 450) * 0.12;
  const x = 400 - w / 2, y = 690 - 14 - h; const split = dbl ? y + h * 0.3 : y + h * 0.18;
  return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${finish}"/>
<line x1="${x}" y1="${split}" x2="${x + w}" y2="${split}" stroke="${dark ? '#000' : '#8d939d'}" stroke-width="4"/>
<rect x="${x + w - 30}" y="${y + 26}" width="9" height="${Math.max(40, split - y - 52)}" rx="4.5" fill="${handle}"/>
<rect x="${x + w - 30}" y="${split + 28}" width="9" height="${Math.min(200, (y + h - split) * 0.45)}" rx="4.5" fill="${handle}"/>
${/inverter|digital|smart/i.test(n) ? `<rect x="${x + 24}" y="${split + 26}" width="62" height="36" rx="6" fill="#1f2a3a"/>${label(x + 55, split + 51, '3°C', 17, '#5fd4ff', 'middle', 700, 0)}` : ''}
${label(400, y + h - 24, brandOf(p), 17, txt)}
<rect x="${x + 12}" y="${y + h}" width="22" height="10" rx="3" fill="#555"/><rect x="${x + w - 34}" y="${y + h}" width="22" height="10" rx="3" fill="#555"/></g>`;
}

function aircon(p: Product) {
  const n = p.name.toLowerCase(); const hp = num(/([\d.]+)HP/i, p.name, 1.5);
  if (/floor/.test(n)) {
    return `<g filter="url(#sh)"><rect x="300" y="120" width="200" height="560" rx="30" fill="url(#white)"/>
<rect x="326" y="170" width="148" height="260" rx="14" fill="#e6eaf0"/>${Array.from({ length: 9 }, (_, i) => `<rect x="336" y="${186 + i * 26}" width="128" height="8" rx="4" fill="#c9ced6"/>`).join('')}
<rect x="350" y="470" width="100" height="40" rx="8" fill="#1f2a3a"/>${label(400, 497, '24°C', 20, '#5fd4ff', 'middle', 700, 0)}
${label(400, 620, brandOf(p), 18, '#6b7280')}${label(400, 646, `${hp}HP`, 14, '#9aa1ab')}</g>`;
  }
  const w = 500 + hp * 30; const x = 400 - w / 2;
  return `<g filter="url(#sh)"><rect x="${x}" y="230" width="${w}" height="150" rx="34" fill="url(#white)"/>
<rect x="${x + 30}" y="336" width="${w - 60}" height="22" rx="11" fill="#c9ced6"/><rect x="${x + 34}" y="345" width="${w - 68}" height="6" rx="3" fill="#9aa1ab"/>
<circle cx="${x + w - 44}" cy="276" r="7" fill="#2ecc71"/>${label(x + 40, 292, /inverter|windfree/i.test(n) ? 'INVERTER' : `${hp}HP`, 24, '#5b6270', 'start', 700, 3)}
${label(x + w - 70, 300, brandOf(p), 18, '#8a909b', 'end', 700, 2)}</g>
<g opacity="0.6" stroke="#8fd3ff" stroke-width="6" stroke-linecap="round" fill="none">${[0.2, 0.4, 0.6, 0.8].map((f) => `<path d="M${x + w * f} 400 q16 40 0 80 q-16 40 0 80"/>`).join('')}</g>
<g filter="url(#sh)"><rect x="560" y="560" width="70" height="120" rx="14" fill="url(#white)"/><rect x="572" y="574" width="46" height="26" rx="4" fill="#1f2a3a"/><circle cx="595" cy="636" r="10" fill="#c9ced6"/></g>`;
}

function freezer(p: Product) {
  const litres = num(/(\d+)L/i, p.name, 250); const w = 360 + Math.min(litres, 500) * 0.45; const x = 400 - w / 2, y = 420, h = 260;
  return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="url(#white)"/>
<rect x="${x - 6}" y="${y - 36}" width="${w + 12}" height="48" rx="14" fill="url(#steel)"/><rect x="${x + w / 2 - 60}" y="${y + 10}" width="120" height="14" rx="7" fill="#7d838d"/>
<rect x="${x + 26}" y="${y + 54}" width="54" height="26" rx="5" fill="#1f2a3a"/><circle cx="${x + 40}" cy="${y + 67}" r="5" fill="#2ecc71"/>
${label(400, y + h - 34, brandOf(p), 20, '#6b7280')}${label(400, y + h - 10, `${Math.round(litres)} L`, 14, '#9aa1ab')}</g>`;
}

function fan(p: Product) {
  const n = p.name.toLowerCase();
  const head = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8ecf2" stroke-width="7"/>
<circle cx="${cx}" cy="${cy}" r="${r - 10}" fill="#ffffff" opacity="0.35"/>
<g fill="#7cc4f2" opacity="0.92">${[0, 120, 240].map((a) => `<ellipse cx="${cx}" cy="${cy - r * 0.45}" rx="${r * 0.22}" ry="${r * 0.46}" transform="rotate(${a} ${cx} ${cy})"/>`).join('')}</g>
<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="#e8ecf2"/>`;
  if (/ceiling/.test(n)) return `<g filter="url(#sh)"><rect x="392" y="90" width="16" height="170" fill="#c9ced6"/><ellipse cx="400" cy="270" rx="56" ry="30" fill="url(#white)"/>
${[0, 120, 240].map((a) => `<rect x="400" y="258" width="290" height="34" rx="17" fill="#d9c3a2" transform="rotate(${a + 10} 400 275)"/>`).join('')}<ellipse cx="400" cy="300" rx="34" ry="16" fill="#eef1f5"/>${label(400, 380, brandOf(p), 18, '#6b7280')}</g>`;
  if (/tower/.test(n)) return `<g filter="url(#sh)"><rect x="345" y="130" width="110" height="520" rx="50" fill="url(#white)"/>${Array.from({ length: 16 }, (_, i) => `<rect x="365" y="${200 + i * 22}" width="70" height="8" rx="4" fill="#c9ced6"/>`).join('')}
<ellipse cx="400" cy="672" rx="95" ry="18" fill="url(#steel)"/><circle cx="400" cy="168" r="10" fill="#2ecc71"/>${label(400, 600, brandOf(p), 16, '#6b7280')}</g>`;
  if (/rechargeable/.test(n)) return `<g filter="url(#sh)"><rect x="210" y="210" width="380" height="430" rx="40" fill="url(#white)"/>${head(400, 410, 150)}
<path d="M310 210 q90 -90 180 0" fill="none" stroke="#9aa1ab" stroke-width="16" stroke-linecap="round"/><rect x="250" y="590" width="80" height="22" rx="8" fill="#2ecc71"/>${label(500, 610, brandOf(p), 16, '#6b7280')}</g>`;
  if (/wall/.test(n)) return `<g filter="url(#sh)"><rect x="360" y="420" width="80" height="140" rx="16" fill="url(#white)"/>${head(400, 330, 170)}${label(400, 540, brandOf(p), 14, '#6b7280')}</g>`;
  const table = /table/.test(n); const top = table ? 300 : 230; const r = table ? 140 : 150;
  return `<g filter="url(#sh)"><rect x="392" y="${top + r - 10}" width="16" height="${672 - (top + r - 10)}" fill="#d9dde3"/><ellipse cx="400" cy="672" rx="${table ? 90 : 120}" ry="20" fill="url(#steel)"/>
${head(400, top, r)}${label(400, 662, brandOf(p), 14, '#6b7280')}</g>`;
}

function dstv(p: Product) {
  const n = p.name.toLowerCase(); const go = /gotv/.test(n);
  if (/subscription/.test(n)) {
    const pack = p.name.replace(/ subscription.*$/i, '');
    return `<g filter="url(#sh)"><rect x="170" y="230" width="460" height="300" rx="28" fill="${go ? '#0f9d58' : '#0b57d0'}"/>
<rect x="170" y="230" width="460" height="300" rx="28" fill="url(#glow)" opacity="0.35"/><rect x="214" y="300" width="74" height="56" rx="8" fill="#e8c76a"/>
${label(590, 300, go ? 'GOtv' : 'DStv', 40, '#ffffff', 'end', 800, 1)}${label(214, 430, pack.toUpperCase(), 30, '#ffffff', 'start', 800, 1)}${label(214, 474, '1 MONTH · ACTIVATED ON YOUR SMARTCARD', 15, '#dbe7ff', 'start', 700, 1)}</g>`;
  }
  const dish = /dish|kit/.test(n) || /lnb/.test(n);
  const box = /lnb/.test(n) ? '' : `<g filter="url(#sh)"><rect x="230" y="470" width="${/explora/.test(n) ? 340 : 300}" height="${/explora/.test(n) ? 120 : 96}" rx="14" fill="url(#black)"/>
${label(260, 530, go ? 'GOtv' : 'DStv', 28, go ? '#37d67a' : '#4aa3ff', 'start', 800, 1)}<rect x="${/explora/.test(n) ? 460 : 430}" y="510" width="70" height="22" rx="4" fill="#0b2a4a"/>${label(/explora/.test(n) ? 495 : 465, 527, '12:45', 14, '#7fd1ff', 'middle', 700, 0)}<circle cx="${/explora/.test(n) ? 548 : 512}" cy="560" r="6" fill="#2ecc71"/></g>`;
  const dishG = dish ? `<g filter="url(#sh)"><ellipse cx="${/lnb/.test(n) ? 400 : 520}" cy="${/lnb/.test(n) ? 330 : 280}" rx="${/lnb/.test(n) ? 190 : 150}" ry="${/lnb/.test(n) ? 200 : 160}" fill="url(#white)" transform="rotate(-20 ${/lnb/.test(n) ? 400 : 520} ${/lnb/.test(n) ? 330 : 280})"/>
<line x1="${/lnb/.test(n) ? 400 : 520}" y1="${/lnb/.test(n) ? 330 : 280}" x2="${/lnb/.test(n) ? 260 : 410}" y2="${/lnb/.test(n) ? 520 : 400}" stroke="#9aa1ab" stroke-width="10"/><rect x="${/lnb/.test(n) ? 230 : 385}" y="${/lnb/.test(n) ? 510 : 392}" width="56" height="40" rx="8" fill="#5b6270"/></g>` : '';
  return dishG + box;
}

function sound(p: Product) {
  const n = p.name.toLowerCase();
  if (/flip|xb13|bluetooth speaker/.test(n)) return `<g filter="url(#sh)"><rect x="250" y="330" width="300" height="190" rx="95" fill="hsl(${seed(p.id) % 360},55%,42%)"/>
<rect x="290" y="360" width="220" height="130" rx="65" fill="#000" opacity="0.18"/><circle cx="340" cy="425" r="40" fill="#000" opacity="0.25"/><circle cx="460" cy="425" r="40" fill="#000" opacity="0.25"/>${label(400, 432, brandOf(p), 22, '#ffffff')}</g>`;
  if (/partybox/.test(n)) return `<g filter="url(#sh)"><rect x="250" y="150" width="300" height="520" rx="30" fill="url(#black)"/><circle cx="400" cy="300" r="100" fill="#1f1f25" stroke="#ff4fd8" stroke-width="8"/>
<circle cx="400" cy="300" r="40" fill="#2b2b33"/><circle cx="400" cy="520" r="100" fill="#1f1f25" stroke="#39c6ff" stroke-width="8"/><circle cx="400" cy="520" r="40" fill="#2b2b33"/>${label(400, 196, brandOf(p), 24, '#ffffff')}</g>`;
  const sub = /subwoofer|5\.1|3\.1|2\.1|home theatre/.test(n); const tall = /home theatre/.test(n);
  return `<g filter="url(#sh)"><rect x="140" y="${tall ? 520 : 470}" width="${sub ? 380 : 520}" height="70" rx="35" fill="url(#black)"/>
${Array.from({ length: 10 }, (_, i) => `<circle cx="${190 + i * (sub ? 32 : 46)}" cy="${tall ? 555 : 505}" r="5" fill="#3a3a42"/>`).join('')}${label(sub ? 330 : 400, tall ? 610 : 565, brandOf(p), 14, '#7c7f88')}
${sub ? `<rect x="550" y="${tall ? 330 : 380}" width="140" height="${tall ? 330 : 280}" rx="18" fill="url(#black)"/><circle cx="620" cy="${tall ? 500 : 520}" r="50" fill="#1f1f25"/><circle cx="620" cy="${tall ? 500 : 520}" r="20" fill="#2b2b33"/>` : ''}
${tall ? `<rect x="150" y="250" width="70" height="250" rx="14" fill="url(#black)"/><circle cx="185" cy="330" r="20" fill="#1f1f25"/><circle cx="185" cy="420" r="24" fill="#1f1f25"/>` : ''}</g>`;
}

function washer(p: Product) {
  const n = p.name.toLowerCase();
  if (/twin tub/.test(n)) return `<g filter="url(#sh)"><rect x="190" y="250" width="420" height="420" rx="20" fill="url(#white)"/><rect x="200" y="226" width="200" height="40" rx="10" fill="#7cc4f2" opacity="0.8"/><rect x="410" y="226" width="190" height="40" rx="10" fill="#7cc4f2" opacity="0.8"/>
<rect x="220" y="290" width="360" height="60" rx="10" fill="#e6eaf0"/>${[260, 330, 470, 540].map((x) => `<circle cx="${x}" cy="320" r="18" fill="#c9ced6"/>`).join('')}${label(400, 620, brandOf(p), 20, '#6b7280')}</g>`;
  if (/top load/.test(n)) return `<g filter="url(#sh)"><rect x="230" y="230" width="340" height="440" rx="22" fill="url(#white)"/><rect x="230" y="200" width="340" height="70" rx="16" fill="url(#steel)"/>
<rect x="400" y="215" width="140" height="36" rx="6" fill="#1f2a3a"/>${label(470, 240, '45 MIN', 16, '#7fd1ff', 'middle', 700, 0)}<circle cx="290" cy="235" r="20" fill="#c9ced6"/>${label(400, 620, brandOf(p), 20, '#6b7280')}</g>`;
  return `<g filter="url(#sh)"><rect x="220" y="200" width="360" height="470" rx="24" fill="url(#white)"/><rect x="220" y="200" width="360" height="80" rx="20" fill="#eef1f5"/>
<rect x="420" y="222" width="130" height="36" rx="6" fill="#1f2a3a"/>${label(485, 247, '1400', 16, '#7fd1ff', 'middle', 700, 0)}<circle cx="270" cy="240" r="20" fill="#c9ced6"/>
<circle cx="400" cy="460" r="135" fill="url(#steel)"/><circle cx="400" cy="460" r="105" fill="url(#glass)"/><path d="M320 470 q40 -40 80 0 q40 40 80 0" stroke="#7cc4f2" stroke-width="10" fill="none" opacity="0.8"/>${label(400, 640, brandOf(p), 16, '#6b7280')}</g>`;
}

function micro(p: Product) {
  return `<g filter="url(#sh)"><rect x="160" y="300" width="480" height="300" rx="22" fill="${seed(p.id) % 2 ? 'url(#black)' : 'url(#white)'}"/><rect x="190" y="330" width="320" height="240" rx="12" fill="url(#glass)"/>
<rect x="210" y="350" width="280" height="200" rx="8" fill="#ffffff" opacity="0.06"/><rect x="530" y="340" width="84" height="32" rx="5" fill="#0b2a4a"/>${label(572, 363, '1:30', 16, '#7fd1ff', 'middle', 700, 0)}
${Array.from({ length: 9 }, (_, i) => `<rect x="${534 + (i % 3) * 28}" y="${392 + Math.floor(i / 3) * 28}" width="20" height="18" rx="4" fill="#9aa1ab"/>`).join('')}<circle cx="572" cy="530" r="22" fill="#c9ced6"/>${label(350, 590, brandOf(p), 14, '#9aa1ab')}</g>`;
}

function power(p: Product) {
  const n = p.name.toLowerCase();
  if (/fridge guard/.test(n)) return `<g filter="url(#sh)"><rect x="300" y="250" width="200" height="300" rx="30" fill="url(#white)"/><rect x="350" y="300" width="100" height="60" rx="10" fill="#e6eaf0"/>
<rect x="372" y="318" width="14" height="26" rx="3" fill="#5b6270"/><rect x="414" y="318" width="14" height="26" rx="3" fill="#5b6270"/><circle cx="360" cy="420" r="9" fill="#2ecc71"/><circle cx="400" cy="420" r="9" fill="#f5b041"/><circle cx="440" cy="420" r="9" fill="#e74c3c"/>
<rect x="370" y="550" width="20" height="60" rx="4" fill="#9aa1ab"/><rect x="410" y="550" width="20" height="60" rx="4" fill="#9aa1ab"/>${label(400, 500, brandOf(p), 16, '#6b7280')}</g>`;
  if (/ups/.test(n)) return `<g filter="url(#sh)"><rect x="300" y="200" width="200" height="470" rx="20" fill="url(#black)"/><rect x="330" y="250" width="140" height="70" rx="8" fill="#0b2a4a"/>${label(400, 295, '230V', 22, '#7fd1ff', 'middle', 700, 0)}
<circle cx="400" cy="380" r="22" fill="#2b2b33" stroke="#2ecc71" stroke-width="4"/>${label(400, 620, brandOf(p), 18, '#c9ccd4')}</g>`;
  return `<g filter="url(#sh)"><rect x="210" y="280" width="380" height="330" rx="24" fill="url(#white)"/><circle cx="330" cy="400" r="70" fill="#f4f6f9" stroke="#c9ced6" stroke-width="6"/>
<path d="M285 410 A50 50 0 0 1 375 410" stroke="#9aa1ab" stroke-width="6" fill="none"/><line x1="330" y1="410" x2="360" y2="370" stroke="#e74c3c" stroke-width="5" stroke-linecap="round"/>
<rect x="440" y="350" width="110" height="44" rx="6" fill="#1f2a3a"/>${label(495, 381, '220V', 20, '#7fd1ff', 'middle', 700, 0)}<rect x="440" y="420" width="50" height="50" rx="8" fill="#e6eaf0"/><rect x="500" y="420" width="50" height="50" rx="8" fill="#e6eaf0"/>
${label(400, 575, brandOf(p), 18, '#6b7280')}</g>`;
}

function dispenser(p: Product) {
  return `<g filter="url(#sh)"><rect x="300" y="320" width="200" height="350" rx="22" fill="url(#white)"/><path d="M330 320 L330 180 Q330 120 400 120 Q470 120 470 180 L470 320 Z" fill="#9fd8ff" opacity="0.8"/>
<rect x="380" y="100" width="40" height="30" rx="8" fill="#3b82f6"/><rect x="330" y="380" width="140" height="80" rx="12" fill="#eef1f5"/><rect x="350" y="400" width="26" height="40" rx="6" fill="#e74c3c"/><rect x="424" y="400" width="26" height="40" rx="6" fill="#3b82f6"/>
<rect x="340" y="500" width="120" height="10" rx="5" fill="#c9ced6"/>${label(400, 620, brandOf(p), 16, '#6b7280')}</g>`;
}

/** The right drawing for a product, from its category (and name for the odd ones). */
function draw(p: Product): string {
  const hue = seed(p.id) % 360;
  switch (p.cat) {
    case 'TV': return frame(hue, tv(p, hue), 460);
    case 'Fridge': return frame(hue, fridge(p, hue), 380);
    case 'Air Conditioner': return frame(hue, aircon(p), 440);
    case 'Freezer': return frame(hue, freezer(p), 520);
    case 'Fan': return frame(hue, fan(p), 300);
    case 'DStv & GOtv': return frame(hue, dstv(p), 420);
    case 'Sound & Home Theatre': return frame(hue, sound(p), 520);
    case 'Washing Machine': return frame(hue, washer(p), 420);
    case 'Microwave': return frame(hue, micro(p), 500);
    case 'Stabiliser & Power': return frame(hue, power(p), 380);
    case 'Water Dispenser': return frame(hue, dispenser(p), 260);
    default: return frame(hue, `<g filter="url(#sh)"><rect x="250" y="250" width="300" height="300" rx="30" fill="url(#white)"/>${label(400, 410, brandOf(p), 28, '#6b7280')}</g>`);
  }
}

mkdirSync('public/assets/products', { recursive: true });
PRODUCTS0.forEach((p) => writeFileSync(`public/assets/products/${p.id}.svg`, draw(p)));
console.log(`Drew ${PRODUCTS0.length} product illustrations into public/assets/products/`);
