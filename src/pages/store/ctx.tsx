import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersist } from '../../lib/persist';
import { HOLDS_KEY, setHold, syncWebHold, touchHold, type Holds } from '../../lib/stock';
import { ORDERS0, USERS0, sellsOnlineAt, totalStock, useStoreData, type Line, type SP, type ShopOrder, type ShopUser } from './model';

export type AuthMode = 'in' | 'up' | 'verify' | 'twofa' | 'reset' | 'sent' | 'newpw' | 'oauth' | 'otp';
export type Modal =
  | { k: 'look' }
  | { k: 'track'; no: string }
  | { k: 'receipt'; no: string; invoice?: boolean; kind?: 'confirmation' }
  | { k: 'return'; no: string }
  | { k: 'confirm'; title: string; body: string; cta: string; danger?: boolean; act: () => void }
  | { k: 'addr' } | { k: 'profile' } | { k: 'pw' } | { k: 'del' };

type Ctx = ReturnType<typeof useShopState>;
const C = createContext<Ctx | null>(null);
export const useShop = () => useContext(C)!;

function useShopState() {
  const nav = useNavigate();
  const data = useStoreData();
  const { products } = data;
  const [users, setUsers] = usePersist<ShopUser[]>('ecompos.shopUsers', USERS0);
  const [sess, setSess] = usePersist<string>('ecompos.shopSession', '');
  const [guestCart, setGuestCart] = usePersist<Line[]>('ecompos.shopCart', []);
  const [guestWish, setGuestWish] = usePersist<string[]>('ecompos.shopWish', []);
  const [recent, setRecent] = usePersist<string[]>('ecompos.shopRecent', []);
  const [orders, setOrders] = usePersist<Record<string, ShopOrder>>('ecompos.shopOrders', ORDERS0);
  const [cookies, setCookies] = usePersist<string>('ecompos.shopCookies', '');
  const me = useMemo(() => (sess ? users.find((u) => u.email === sess) ?? null : null), [users, sess]);
  const upMe = useCallback((patch: Partial<ShopUser> | ((u: ShopUser) => Partial<ShopUser>)) => {
    setUsers((L) => L.map((u) => (u.email === sess ? { ...u, ...(typeof patch === 'function' ? patch(u) : patch) } : u)));
  }, [sess, setUsers]);
  const cart = me ? me.cart || [] : guestCart;
  const wish = me ? me.wish || [] : guestWish;
  const setCart = useCallback((f: (l: Line[]) => Line[]) => { if (me) upMe((u) => ({ cart: f(u.cart || []) })); else setGuestCart(f); }, [me, upMe, setGuestCart]);
  const setWish = useCallback((f: (l: string[]) => string[]) => { if (me) upMe((u) => ({ wish: f(u.wish || []) })); else setGuestWish(f); }, [me, upMe, setGuestWish]);

  const [toast, setToast] = useState<{ t: string; ms: number; id: number } | null>(null);
  const timer = useRef<number>();
  const say = useCallback((t: string, ms = 4000) => setToast({ t, ms, id: Date.now() }), []);
  // Notices now show as a modal pop-up that stays until the shopper taps OK (no auto-dismiss).
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [authAfter, setAuthAfter] = useState<string>('');
  const [qv, setQv] = useState<string | null>(null);
  const [bis, setBis] = useState<string | null>(null);
  const [cd, setCd] = useState<{ open: boolean; tab: 'cart' | 'wish'; note: string }>({ open: false, tab: 'cart', note: '' });
  // "Added to cart" pop-up (Shell.tsx AddedModal): shown after adding instead of opening the cart drawer.
  const [added, setAdded] = useState<null | { name: string; sub: string; img?: string; tone?: string }>(null);
  const [md, setMd] = useState<Modal | null>(null);
  const [q, setQ] = useState('');

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])) as Record<string, SP>, [products]);
  const lines = cart.filter((l) => byId[l.pid]).map((l) => { const p = byId[l.pid]; const each = l.unit === 'c' && p.ct ? p.ct.price : p.price; return { ...l, p, each, total: each * l.qty, unitName: l.unit === 'c' && p.ct ? `${p.ct.label} of ${p.ct.size}` : 'Single' }; });
  const sub = lines.reduce((a, l) => a + l.total, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);

  /* ---------- live stock holds for this basket (lib/stock.ts) ---------- */
  // One hold per basket: the signed-in shopper's, or this browser's guest basket.
  const holdOwner = 'web:' + (sess || 'guest');
  const [holds] = usePersist<Holds>(HOLDS_KEY, {});
  const unitsOf = (l: Line) => (l.unit === 'c' ? l.qty * (byId[l.pid]?.ct?.size || 12) : l.qty);
  const cartKey = JSON.stringify(cart);
  // Whenever the basket changes, hold exactly what is in it, so the till and the website both show those units
  // as taken. Taking items out (or emptying the basket) gives them straight back.
  useEffect(() => {
    const want: Record<string, number> = {};
    cart.forEach((l) => { want[l.pid] = (want[l.pid] || 0) + unitsOf(l); });
    syncWebHold(holdOwner, want, (p, br) => sellsOnlineAt(p, data.W, br));
  }, [cartKey, holdOwner]); // eslint-disable-line react-hooks/exhaustive-deps
  // Switching basket (signing in or out) lets go of the previous basket's hold; a signed-in shopper's saved basket
  // is held again when they come back.
  const prevOwner = useRef(holdOwner);
  useEffect(() => { if (prevOwner.current !== holdOwner) { setHold(prevOwner.current, null); prevOwner.current = holdOwner; } }, [holdOwner]);
  // While the store is open in a visible tab, keep the basket's hold alive (holds lapse 60 minutes after the last visit).
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') touchHold(holdOwner); }, 5 * 60e3);
    return () => window.clearInterval(t);
  }, [holdOwner]);
  /**
   * Units of a product this shopper can still add: what is free on the site, plus what this basket already holds,
   * minus what is already in the basket (correct even if the basket's hold lapsed while they were away).
   */
  const room = useCallback((pid: string) => {
    const p = byId[pid]; if (!p) return 0;
    const mine = (holds[holdOwner]?.lines || []).filter((l) => l.pid === pid).reduce((a, l) => a + l.qty, 0);
    const inBasket = cart.filter((l) => l.pid === pid).reduce((a, l) => a + unitsOf(l), 0);
    return Math.max(0, totalStock(p) + mine - inBasket);
  }, [byId, holds, holdOwner, cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback((pid: string, unit: 's' | 'c' = 's', qty = 1, quiet = false) => {
    const p = byId[pid];
    if (!p) return;
    // Only add what is really free: the rest may be in this basket already, in other baskets, or at a till.
    const need = unit === 'c' ? qty * (p.ct?.size || 12) : qty; const left = room(pid);
    if (left < need) { say(left <= 0 ? `Sorry, there are no more ${p.name} available right now.` : `Only ${left} more ${p.name} available right now${unit === 'c' ? `, not enough for a ${p.ct?.label.toLowerCase() || 'carton'} of ${p.ct?.size || 12}` : ''}.`); return; }
    setCart((L) => { const hit = L.find((l) => l.pid === pid && l.unit === unit); return hit ? L.map((l) => (l === hit ? { ...l, qty: l.qty + qty } : l)) : [...L, { pid, unit, qty }]; });
    setWish((W) => W.filter((x) => x !== pid));
    // Confirm with a pop-up ("… added to cart" · Continue shopping / Go to cart); the cart drawer stays closed.
    if (!quiet) { setQv(null); setAdded({ name: p.name, sub: `${qty} × ${unit === 'c' && p.ct ? `${p.ct.label.toLowerCase()} of ${p.ct.size}` : 'single'}`, img: p.img, tone: p.tone }); }
  }, [byId, setCart, setWish, room, say]);
  const wishTog = useCallback((pid: string) => {
    const on = wish.includes(pid);
    setWish((W) => (on ? W.filter((x) => x !== pid) : [...W, pid]));
    say(on ? 'Removed from your wishlist' : 'Saved to your wishlist', 3000);
  }, [wish, setWish, say]);
  const open = useCallback((pid: string) => { setRecent((R) => [pid, ...R.filter((x) => x !== pid)].slice(0, 8)); setQv(null); setCd((c) => ({ ...c, open: false })); nav(`/p/${pid}`); window.scrollTo(0, 0); }, [nav, setRecent]);
  const go = useCallback((path: string) => { setCd((c) => ({ ...c, open: false })); setMd(null); nav(path === '' ? '/' : `/${path}`); window.scrollTo(0, 0); }, [nav]);
  const signIn = useCallback((email: string) => { setSess(email); setAuth(null); setGuestCart([]); const n = users.find((u) => u.email === email)?.name || email; say(`Signed in · welcome, ${n.split(' ')[0]}`); if (authAfter) { const a = authAfter; setAuthAfter(''); go(a); } }, [setSess, setGuestCart, users, say, authAfter, go]);
  const signOut = useCallback(() => { setSess(''); say('You are signed out'); go(''); }, [setSess, say, go]);

  /** Change a basket line by d (±1); adding more is refused when nothing more is free. */
  const bump = useCallback((pid: string, unit: string, d: number) => {
    if (d > 0) { const p = byId[pid]; const need = unit === 'c' ? d * (p?.ct?.size || 12) : d; if (!p || room(pid) < need) { say(`Sorry, there are no more ${p?.name || 'of this item'} available right now.`); return; } }
    setCart((L) => L.map((l) => (l.pid === pid && l.unit === unit ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0));
  }, [byId, room, say, setCart]);

  return { ...data, added, setAdded, nav, holdOwner, room, bump, users, setUsers, sess, setSess, me, upMe, cart, setCart, wish, setWish, recent, setRecent, orders, setOrders, cookies, setCookies, toast, setToast, say, auth, setAuth, setAuthAfter, qv, setQv, bis, setBis, cd, setCd, md, setMd, q, setQ, byId, lines, sub, count, add, wishTog, open, go, signIn, signOut };
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const v = useShopState();
  return <C.Provider value={v}>{children}</C.Provider>;
}
