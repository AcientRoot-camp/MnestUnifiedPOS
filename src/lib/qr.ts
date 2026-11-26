// Real, scannable QR codes (ISO/IEC 18004), drawn without any library. Ported from the prototype's qrMake
// (Staff.dc.html) so the codes match it exactly: byte mode (UTF-8), error correction level M, versions 1–10
// (the smallest that fits), Reed–Solomon over GF(256) with polynomial 0x11D, and the best of the 8 masks by the
// standard penalty score. Used for the HR gate poster, staff badges and the ID card "scan to verify" code.

export type Qr = { size: number; mask: number; ver: number; rows: boolean[][] };

/** ECC codewords per block and number of blocks, level M, versions 1–10 (index 0 unused). */
const ECW = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NBL = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

/** Number of modules available for data + ECC in version v. */
const rawMods = (v: number) => {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
  return r;
};
/** Data codewords available in version v at level M. */
const dataCw = (v: number) => Math.floor(rawMods(v) / 8) - ECW[v] * NBL[v];

/** Multiply two numbers in GF(256) with the QR polynomial 0x11D. */
const gm = (x: number, y: number) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
};

/** The 8 standard mask patterns: true means "flip this module". */
const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/**
 * Encode text as a QR code.
 * Inputs: the text (any Unicode, sent as UTF-8 bytes); optional forceMask (0–7) to skip the mask search.
 * Output: { size, mask, ver, rows } with rows[y][x] = true for a dark module, or null if it needs more than version 10.
 */
export function qrMake(text: string, forceMask?: number): Qr | null {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let ver = 1;
  for (; ver <= 10; ver++) if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCw(ver) * 8) break;
  if (ver > 10) return null;

  // Bit stream: byte mode indicator, length, data, terminator, padding to whole bytes, then pad bytes 0xEC / 0x11.
  const bits: number[] = [];
  const ap = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  ap(4, 4); ap(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => ap(b, 8));
  const cap = dataCw(ver) * 8;
  ap(0, Math.min(4, cap - bits.length)); ap(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) ap(p, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }

  // Reed–Solomon error correction per block, then interleave the blocks.
  const ecl = ECW[ver], nb = NBL[ver], raw = Math.floor(rawMods(ver) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const dv = new Array(ecl).fill(0); dv[ecl - 1] = 1;
  let root = 1;
  for (let i = 0; i < ecl; i++) { for (let j = 0; j < ecl; j++) { dv[j] = gm(dv[j], root); if (j + 1 < ecl) dv[j] ^= dv[j + 1]; } root = gm(root, 2); }
  const rem = (d: number[]) => { const r: number[] = new Array(ecl).fill(0); d.forEach((b) => { const f = b ^ (r.shift() as number); r.push(0); dv.forEach((c, i) => { r[i] ^= gm(c, f); }); }); return r; };
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) { const dl = shortLen - ecl + (i < nShort ? 0 : 1); const dat = data.slice(k, k + dl); k += dl; const ec = rem(dat); if (i < nShort) dat.push(0); blocks.push(dat.concat(ec)); }
  const all: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) all.push(b[i]); });

  // Matrix with function patterns (finders, timing, alignment, format/version areas) marked as fixed.
  const size = ver * 4 + 17;
  const M: boolean[][] = [], F: boolean[][] = [];
  for (let i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
  const sf = (x: number, y: number, d: boolean) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < size; i++) { sf(6, i, i % 2 === 0); sf(i, 6, i % 2 === 0); }
  const fp = (x: number, y: number) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) sf(xx, yy, d !== 2 && d !== 4); } };
  fp(3, 3); fp(size - 4, 3); fp(3, size - 4);
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2; const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2; const pos = [6];
    for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sf(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  // Format bits (level M = 0b00 with the mask), BCH 0x537, XOR 0x5412.
  const fmt = (mask: number) => {
    const d = (0 << 3) | mask; let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412; const g = (i: number) => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) sf(8, i, g(i)); sf(8, 7, g(6)); sf(8, 8, g(7)); sf(7, 8, g(8)); for (let i = 9; i < 15; i++) sf(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) sf(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) sf(8, size - 15 + i, g(i)); sf(8, size - 8, true);
  };
  fmt(0);
  if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const bt = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3); sf(a, c, bt); sf(c, a, bt); } }
  // Place the codewords in the zig-zag order.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
      if (!F[y][x] && i < all.length * 8) { M[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }
  // Masks: try all 8 and keep the lowest penalty (runs of 5+, 2×2 blocks, dark/light balance).
  const apply = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
  const score = () => {
    let p = 0;
    for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (M[y][x] === M[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (M[y][x] === M[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    let dark = 0; M.forEach((r) => r.forEach((c) => { if (c) dark++; }));
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = typeof forceMask === 'number' ? forceMask : 0;
  if (typeof forceMask !== 'number') { let bp = Infinity; for (let m = 0; m < 8; m++) { apply(m); fmt(m); const s = score(); if (s < bp) { bp = s; best = m; } apply(m); } }
  apply(best); fmt(best);
  return { size, mask: best, ver, rows: M };
}
