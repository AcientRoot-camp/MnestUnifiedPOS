// Online store chat assistant: the round chat button at the bottom right of every store page and the chat window it
// opens. Answers come from chatbot.ts: straight from the store's live data for products, stock, orders, delivery,
// payment, returns and branches, and from the AI endpoint (/api/chat) for anything else when it is set up.
// Product cards in the chat add to the basket (with the usual "added to cart" pop-up); order cards show live status.
// The conversation is kept for this browser tab (sessionStorage), so it survives moving between pages.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { COLLECTIONS, WEB_ORDERS, type Collection, type WebOrder } from '../../data/sell';
import { readKey } from '../../lib/persist';
import { cx } from '../../lib/format';
import { useShop } from './ctx';
import { bizName } from './Shell';
import { askAi, factSheet, fallbackReply, localReply, type ChatAct, type ChatCtx, type ChatOrder, type Reply } from './chatbot';
import { buildKb } from './knowledge';
import { isOos, money, orderState, stockLine, type SP } from './model';

/** One chat message. Product cards are kept as ids so a stored conversation always shows live prices and stock. */
type Msg = { id: number; who: 'me' | 'bot'; text: string; pids?: string[]; order?: ChatOrder; acts?: Reply['acts']; ai?: boolean };
const KEY = 'ecompos.shopChat';
const GOLD = '#d4af5a';
const STARTERS: [string, string][] = [['📦', 'Track my order'], ['🏷️', 'Show me items on sale'], ['🚚', 'How much is delivery?'], ['📍', 'Where are your branches?'], ['↩️', 'How do returns work?']];
/** Read the stored conversation (empty in a private window or when storage is blocked). */
const load = (): Msg[] => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') as Msg[]; } catch { return []; } };
const save = (m: Msg[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(m.slice(-40))); } catch { /* storage blocked: the chat still works for this page */ } };

/** Chat bubble icon (speech bubble with three dots). */
/** The shop assistant's illustrated face (public/assets/assistant-avatar.svg), used on the chat button and in the
 *  chat header in place of a plain message icon. Input: size in px. Decorative: the button / header text names it. */
const Avatar = ({ size }: { size: number }) => <img src="/assets/assistant-avatar.svg" alt="" aria-hidden="true" width={size} height={size} className="rounded-full block" style={{ width: size, height: size }} />;

/** Product card inside a reply: photo, name, price, stock, Add to basket and View. */
function ProductRow({ p, onAdd, onView }: { p: SP; onAdd: () => void; onView: () => void }) {
  const oos = isOos(p);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-[#ece9e4]">
      <button onClick={onView} aria-label={`View ${p.name}`} className="w-12 h-12 rounded-xl flex-none overflow-hidden bg-white border border-[#f0eee9]">{p.img ? <img src={p.img} alt="" className="w-full h-full object-contain p-1" /> : <span className="block w-full h-full" style={{ background: p.tone }} />}</button>
      <span className="flex-1 min-w-0 flex flex-col"><span className="text-[13px] font-semibold leading-tight truncate">{p.name}</span>
        <span className="text-[12px]">{p.was && p.was > p.price ? <><s className="text-muted mr-1">{money(p.was)}</s><b className="text-danger">{money(p.price)}</b></> : <b>{money(p.price)}</b>}</span>
        <span className={cx('text-[11px]', oos ? 'text-danger' : 'text-muted')}>{stockLine(p)}</span></span>
      {oos ? <button onClick={onView} className="h-8 px-3 rounded-full border border-black text-[11px] font-semibold flex-none">View</button>
        : <button onClick={onAdd} aria-label={`Add ${p.name} to basket`} className="h-8 px-3 rounded-full bg-black text-white text-[11px] font-semibold flex-none">+ Add</button>}
    </div>
  );
}

/** Order card inside a reply: number, status, a four-step progress line and the collection code. */
function OrderCard({ o, onOpen }: { o: ChatOrder; onOpen: () => void }) {
  return (
    <div className="p-3 rounded-2xl bg-white border border-[#ece9e4] flex flex-col gap-2.5">
      <div className="flex justify-between items-start gap-2"><span className="flex flex-col"><span className="text-[11px] text-muted">Order</span><b className="text-sm">#{o.no}</b></span><span className={cx('text-[11px] font-bold px-2 py-0.5 rounded-full', o.cancelled ? 'bg-red-100 text-red-800' : o.idx === 3 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900')}>{o.status}</span></div>
      {!o.cancelled && <ol className="m-0 p-0 list-none grid grid-cols-4 gap-1" aria-label="Progress">{o.names.map((n, i) => <li key={n} className="flex flex-col gap-1"><span className={cx('h-1.5 rounded-full', i <= o.idx ? 'bg-ok' : 'bg-[#e6e3de]')} /><span className={cx('text-[10px] leading-tight', i === o.idx ? 'font-semibold' : 'text-muted')}>{n}</span></li>)}</ol>}
      <div className="flex justify-between items-center gap-2 text-[12px]">{o.total ? <span className="text-muted">{money(o.total)}{o.where ? ` · ${o.where}` : ''}</span> : <span />}{o.code && <span className="font-mono font-bold tracking-[0.2em]">{o.code}</span>}</div>
      <button onClick={onOpen} className="h-8 rounded-full border border-black text-[11px] font-semibold">Open order details</button>
    </div>
  );
}

/** The chat button and window. Placed once in the store's overlays (Shell.tsx). */
export function ChatAssistant() {
  const s = useShop();
  const { W, products, orders, me, count, sub, byId, add, open: openProduct, go, setCd, setMd, setAuth } = s;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  useEffect(() => save(msgs), [msgs]);
  // Keep the newest message in view and the cursor in the box while the window is open.
  // Keep the newest message in view. A new chat (no messages yet) starts at the top instead, so the welcome
  // illustration and the starter questions are the first thing the customer sees.
  useEffect(() => { if (!open) return; const el = logRef.current; if (!el) return; if (!msgs.length && !busy) el.scrollTo({ top: 0 }); else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) inRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);

  // The assistant's knowledge of the whole store, rebuilt only when the store's content or products change.
  const kb = useMemo(() => buildKb(W, products), [W, products]);
  // The product the conversation is about: the first product card in the latest reply that showed one.
  const lastPid = [...msgs].reverse().find((m) => m.who === 'bot' && m.pids?.length)?.pids?.[0];
  /** What the assistant can see right now (store data, this shopper's basket and orders, live order status). */
  const ctx: ChatCtx = useMemo(() => ({
    kb, last: lastPid ? byId[lastPid] : undefined,
    W, products, orders, myOrders: me?.orders || [], signedIn: !!me, name: me?.name, count, sub, biz: bizName(W),
    status: (no: string) => {
      const wo = readKey<WebOrder[]>('ecompos.webOrders2', WEB_ORDERS); const col = readKey<Collection[]>('ecompos.collect2', COLLECTIONS);
      // An order this store has never seen is "not found" rather than "Order placed".
      if (!orders[no] && !wo.some((x) => x.id === no || x.trackId === no) && !col.some((x) => x.no === no)) return null;
      return orderState(no, wo, col, orders[no]);
    },
  }), [W, products, orders, me, count, sub, kb, lastPid, byId]);

  const push = (m: Omit<Msg, 'id'>) => setMsgs((L) => [...L, { ...m, id: Date.now() + Math.random() }]);
  const botMsg = (r: Reply): Omit<Msg, 'id'> => ({ who: 'bot', text: r.text, pids: r.products?.map((p) => p.id), order: r.order, acts: r.acts, ai: r.ai });

  /** Send one message: answer from the store data, else ask the AI, else the friendly fallback. */
  const send = async (raw: string) => {
    const q = raw.trim().slice(0, 600);
    if (!q || busy) return;
    setTxt(''); push({ who: 'me', text: q }); setBusy(true);
    const local = localReply(q, ctx);
    if (local) { await new Promise((ok) => setTimeout(ok, 350)); push(botMsg(local)); setBusy(false); return; }
    const history = [...msgs, { who: 'me' as const, text: q }].slice(-12).map((m) => ({ role: m.who === 'me' ? 'user' as const : 'assistant' as const, content: m.text }));
    const ai = await askAi(history, factSheet(ctx));
    push(ai ? { who: 'bot', text: ai, ai: true } : botMsg(fallbackReply(ctx, q)));
    setBusy(false);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void send(txt); };
  /** Run a reply button. Anything that opens another window closes the chat first, so the two never overlap. */
  const act = (a: ChatAct) => {
    if (a.k === 'ask') return void send(a.text);
    if (a.k === 'url') { window.open(a.href, a.href.startsWith('tel:') ? '_self' : '_blank', 'noopener'); return; }
    setOpen(false);
    if (a.k === 'cart') setCd({ open: true, tab: 'cart', note: '' });
    else if (a.k === 'track') setMd({ k: 'track', no: a.no });
    else if (a.k === 'signin') setAuth('in');
    else go(a.path);
  };
  const first = me?.name.split(' ')[0];

  return (
    <>
      {/* "Hello" greeting bubble attached to the launcher (left of it) while the chat is closed; tapping it opens the chat. */}
      {!open && <button onClick={() => setOpen(true)} aria-label="Hello! Chat with our shop assistant" className="fixed right-[84px] bottom-[26px] z-[45] h-9 pl-3.5 pr-4 rounded-full rounded-br-md bg-white text-[#1a1240] text-sm font-semibold flex items-center gap-1.5 shadow-[0_8px_24px_rgba(26,18,64,0.22)] border border-black/5 hover:-translate-y-0.5 transition-transform"><span aria-hidden>👋</span>Hello</button>}
      {/* Launcher: the shop assistant's illustrated face in a gold ring, bottom right (× while the chat is open). */}
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="shop-chat" aria-label={open ? 'Close the chat' : 'Chat with our shop assistant'}
        className="fixed right-4 bottom-4 z-[45] w-14 h-14 rounded-full text-white flex items-center justify-center shadow-[0_10px_30px_rgba(26,18,64,0.35)] transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(145deg,#2a1d63,#1a1240)', boxShadow: `0 0 0 2px ${GOLD}, 0 10px 30px rgba(26,18,64,0.35)` }}>
        {/* Closed: the shop assistant's face; open: a × to close. */}
        {open ? <span className="text-2xl leading-none" aria-hidden>×</span> : <Avatar size={52} />}
      </button>
      {open && (
        // A floating chat card above the chat button, like the chat widgets on other websites (no backdrop; × or Esc
        // closes it). Phones: tall enough to read the answers comfortably, about 80% of the screen height (between 440
        // and 700 px, and never taller than the space above the chat button), up to 380 px wide with an 8 px margin. Tablets and computers:
        // 360 × 520 px.
        <div id="shop-chat" role="dialog" aria-label="Shop assistant chat" className="fixed z-[60] right-2 bottom-[84px] w-[min(380px,calc(100vw-16px))] h-[min(clamp(440px,80dvh,700px),calc(100dvh-96px))] sm:right-4 sm:bottom-[88px] sm:w-[360px] sm:h-[min(520px,calc(100dvh-120px))] flex flex-col bg-[#faf8f5] rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:border sm:border-black/5">
          {/* Header: navy, gold hairline, assistant identity and online dot. */}
          <div className="relative px-3.5 py-2.5 sm:px-4 sm:pt-4 sm:pb-3.5 text-white flex items-center gap-2.5 sm:gap-3" style={{ background: 'linear-gradient(135deg,#2a1d63 0%,#1a1240 70%)' }}>
            <span className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center flex-none" style={{ background: 'rgba(255,255,255,0.08)', boxShadow: `0 0 0 1.5px ${GOLD}` }}><Avatar size={36} /><span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-[#2ecc71] ring-2 ring-[#1a1240]" /></span>
            <span className="flex-1 min-w-0 flex flex-col"><b className="text-[14px] sm:text-[15px] leading-tight truncate">{bizName(W)}</b><span className="text-xs text-white/70">Shop assistant · online</span></span>
            {msgs.length > 0 && <button onClick={() => setMsgs([])} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20">New chat</button>}
            <button onClick={() => setOpen(false)} aria-label="Close the chat" className="w-9 h-9 rounded-full hover:bg-white/10 text-xl leading-none">×</button>
            <span className="absolute left-0 right-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${GOLD},transparent)` }} />
          </div>
          <div ref={logRef} role="log" aria-live="polite" aria-busy={busy} className="flex-1 overflow-y-auto px-3 py-3 sm:px-3.5 sm:py-4 flex flex-col gap-3">
            {/* Welcome card with starter questions (always at the top of a conversation). */}
            <div className="rounded-3xl bg-white border border-[#ece9e4] p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
              {/* Illustration: the shop assistant at the counter, waving, with help bubbles (delivery, orders, prices). */}
              <img src="/assets/assistant-welcome.svg" alt="" aria-hidden="true" className="block w-full aspect-[8/3] rounded-2xl object-cover" />
              <span className="text-[15px] font-semibold">Akwaaba{first ? `, ${first}` : ''} 👋</span>
              <span className="text-[12.5px] sm:text-[13px] text-sub leading-relaxed">I’m the {bizName(W)} shop assistant. Type any question, or just a few words, about our products, your order, delivery, payment, returns, our policies, branches or jobs.</span>
              <div className="flex flex-wrap gap-1.5">{STARTERS.map(([i, q]) => <button key={q} onClick={() => void send(q)} className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-[#f4f1ec] hover:bg-[#ebe6de] text-[11.5px] sm:text-[12px] font-medium">{i} {q}</button>)}</div>
            </div>
            {msgs.map((m) => m.who === 'me' ? (
              <div key={m.id} className="self-end max-w-[85%] px-3.5 py-2.5 rounded-[20px] rounded-br-md text-[14px] text-white whitespace-pre-line" style={{ background: '#1a1240' }}>{m.text}</div>
            ) : (
              <div key={m.id} className="self-start w-full max-w-[92%] flex flex-col gap-2">
                <div className="px-3.5 py-2.5 rounded-[20px] rounded-bl-md bg-white border border-[#ece9e4] text-[14px] leading-relaxed whitespace-pre-line">{m.text}</div>
                {m.pids?.filter((id) => byId[id]).map((id) => <ProductRow key={id} p={byId[id]} onAdd={() => add(id)} onView={() => { setOpen(false); openProduct(id); }} />)}
                {m.order && <OrderCard o={m.order} onOpen={() => act({ k: 'track', no: m.order!.no })} />}
                {m.acts && m.acts.length > 0 && <div className="flex flex-wrap gap-1.5">{m.acts.map((a) => <button key={a.label} onClick={() => act(a.act)} className="h-8 px-3 rounded-full border text-[12px] font-semibold hover:bg-white" style={{ borderColor: GOLD }}>{a.label}</button>)}</div>}
                {m.ai && <span className="text-[10px] text-muted pl-1">AI answer · check prices and stock on the product page</span>}
              </div>
            ))}
            {busy && <div className="self-start px-4 py-3 rounded-[20px] rounded-bl-md bg-white border border-[#ece9e4] flex gap-1" aria-label="Typing">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9a948a] animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />)}</div>}
          </div>
          <form onSubmit={submit} className="p-2 sm:p-3 bg-white border-t border-[#ece9e4] flex flex-col gap-1 sm:gap-1.5">
            <div className="flex items-center gap-2 h-11 sm:h-12 pl-4 pr-1.5 rounded-full border border-[#d9d9d9] focus-within:border-black focus-within:shadow-[0_0_0_4px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow]">
              <input ref={inRef} value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={600} placeholder="Type any question or a few words…" aria-label="Your message" autoComplete="off" className="flex-1 min-w-0 h-full bg-transparent text-[14px] outline-none focus:outline-none focus-visible:outline-none" />
              <button disabled={!txt.trim() || busy} aria-label="Send" className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-40" style={{ background: '#1a1240' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
            </div>
            <span className="text-[9.5px] sm:text-[10px] text-muted text-center">Automated assistant · never share PINs, passwords or card numbers</span>
          </form>
        </div>
      )}
    </>
  );
}
