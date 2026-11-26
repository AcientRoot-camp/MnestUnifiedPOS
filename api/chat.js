// Online store shopping assistant (the chat bubble on every store page): answers free-form shopper questions with Claude.
// Deploys as a serverless function at /api/chat. The chat widget in the browser answers the common questions itself
// (products, stock, order tracking, delivery, branches, returns); it only calls this endpoint for questions it cannot
// answer, sending the shopper's recent messages plus a short fact sheet about the store (products, prices, branches,
// policies) so the answer stays grounded in this shop's own data.
//
// Environment variables on the host:
//   ANTHROPIC_API_KEY – the API key from https://platform.claude.com (stays on the server)
// When it is not set the endpoint answers 503 and the widget keeps working with its built-in answers.
//
// Abuse limits: same-site requests only, small bodies, the last 12 messages of at most 800 characters each,
// a fact sheet of at most 30,000 characters, and short replies (max_tokens 700).
import Anthropic from '@anthropic-ai/sdk';

const MAX_BODY = 96 * 1024;
const MAX_MSGS = 12, MAX_MSG = 800, MAX_FACTS = 30000;
const clean = (s, n) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, n);

/** The assistant's standing instructions. Kept free of per-request data so the prefix can be cached. */
const SYSTEM = `You are the friendly shopping assistant on a Ghanaian retail store's website. You help shoppers find products, compare prices, understand delivery and collection, payments (Mobile Money, card, cash on delivery, hire purchase in store), returns and opening hours.

How to answer:
- Use only the store facts you are given. If the facts do not cover something (a product they do not list, a price, a policy detail), say you are not sure and suggest WhatsApp or calling the branch. Never invent products, prices, stock, discount codes or order details.
- Prices are in Ghana cedis, written like "GHS 145.00".
- Keep replies short: two to five sentences, or a short list. Plain text only, no markdown headings or tables.
- You cannot see orders, payments or accounts and cannot change anything. For order status, ask the shopper to type their 8-digit order number in this chat (the website looks it up) or open My account → Orders.
- Never ask for card numbers, PINs, Mobile Money PINs, passwords or one-time codes. If a shopper offers them, tell them not to share them.
- Be warm and polite; a short "Akwaaba" greeting is welcome at the start of a conversation.`;

/**
 * POST { messages: [{ role: 'user'|'assistant', content: string }], facts: string }
 * Output: 200 { reply } · 400 bad input · 403 other sites · 405 wrong method · 413 too large · 503 not configured ·
 * 502 the AI service failed (the widget then falls back to its own answer).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end('Method Not Allowed'); }
  // Same-site only, so other websites cannot spend this store's AI budget.
  const origin = req.headers.origin || ''; const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  let originHost = ''; try { originHost = new URL(origin).host; } catch { /* missing or malformed Origin */ }
  if (!originHost || !host || originHost !== host) { res.statusCode = 403; return res.end('Forbidden'); }
  if (!process.env.ANTHROPIC_API_KEY) { res.statusCode = 503; return res.end('Chat is not configured'); }

  let body;
  try {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BODY) { res.statusCode = 413; return res.end('Too large'); } chunks.push(c); }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { res.statusCode = 400; return res.end('Bad request'); }

  // Keep the last few turns, alternate roles cleanly and make sure the conversation starts and ends with the shopper.
  const msgs = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MSGS).map((m) => ({ role: m.role, content: clean(m.content, MAX_MSG) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') { res.statusCode = 400; return res.end('Bad request'); }
  const facts = clean(body?.facts, MAX_FACTS);

  try {
    const client = new Anthropic();
    const r = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      // Short chat replies: a deliberate cap keeps answers brief and the cost per message low.
      max_tokens: 700,
      // Chat questions are simple, so the lowest effort keeps replies quick.
      output_config: { effort: 'low' },
      // If the main model declines a harmless shopping question, the API retries it on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // The fixed instructions come first and are cached; the store facts change with stock and prices, so they follow.
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Store facts (today):\n${facts || 'No store facts were sent.'}` },
      ],
      messages: msgs,
    });
    if (r.stop_reason === 'refusal') { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ reply: 'Sorry, I can’t help with that one. For anything about your order, products or delivery, ask me here or message the shop on WhatsApp.' })); }
    const reply = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ reply: reply || 'Sorry, I didn’t catch that. Could you ask another way?' }));
  } catch (e) {
    // Typed SDK errors: a rate limit is worth telling apart in the logs; everything else is a plain service failure.
    if (e instanceof Anthropic.RateLimitError) { res.statusCode = 429; return res.end('Busy, try again shortly'); }
    if (e instanceof Anthropic.APIError) { console.error('chat: API error', e.status, e.message); res.statusCode = 502; return res.end('AI service error'); }
    console.error('chat: failed', e); res.statusCode = 502; return res.end('AI service error');
  }
}
