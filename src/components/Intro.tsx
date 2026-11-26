// "Before you start" coach screen (sell.md §4): credit sales, pro-forma and hire purchase.
import { useState } from 'react';
import { readKey, writeKey } from '../lib/persist';
import { cx } from '../lib/format';

export type IntroDef = {
  id: string; color: string; icon: string; title: string; tagline: string; what: string;
  points: string[]; forYou?: string; example: string;
  terms: [string, string][]; questions: [string, string][];
  check: { q: string; answers: [string, boolean][] }; cta: string;
};

/** Seen per person (ecompos.introSeen) so "Don't show this again for me" sticks for that account only. */
export const introSeen = (id: string, user: string) => !!readKey<Record<string, string[]>>('ecompos.introSeen', {})[user]?.includes(id);
const markSeen = (id: string, user: string) => { const S = readKey<Record<string, string[]>>('ecompos.introSeen', {}); writeKey('ecompos.introSeen', { ...S, [user]: Array.from(new Set([...(S[user] || []), id])) }); };

export default function Intro({ d, user, onBack, onGo }: { d: IntroDef; user: string; onBack: () => void; onGo: () => void }) {
  const [term, setTerm] = useState('');
  const [qa, setQa] = useState('');
  const [pick, setPick] = useState(-1);
  const [never, setNever] = useState(false);
  const go = () => { if (never) markSeen(d.id, user); onGo(); };
  return (
    <div className="fixed inset-0 z-[600] bg-black/55 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`in-${d.id}`}>
      <section className="bg-white w-full sm:max-w-[640px] max-h-[94vh] overflow-y-auto flex flex-col" style={{ borderRadius: 24 }}>
        <header className="text-white p-6 flex gap-4 items-start" style={{ background: d.color, borderRadius: '24px 24px 0 0' }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px] flex-none" style={{ background: 'rgba(255,255,255,0.18)' }} aria-hidden>{d.icon}</span>
          <div className="flex flex-col gap-1"><span className="text-[11px] font-bold tracking-[0.12em] opacity-85">BEFORE YOU START</span><h2 id={`in-${d.id}`} className="m-0 text-[24px] font-semibold tracking-tight">{d.title}</h2><span className="text-sm opacity-90">{d.tagline}</span></div>
        </header>
        <div className="p-6 flex flex-col gap-4 text-sm">
          <p className="m-0 leading-relaxed">{d.what}</p>
          <ol className="m-0 p-0 list-none flex flex-col gap-2">{d.points.map((p, i) => <li key={i} className="flex gap-3 items-start"><span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-none" style={{ background: d.color }}>{i + 1}</span><span className="pt-0.5">{p}</span></li>)}</ol>
          {d.forYou && <div className="rounded-2xl p-3.5" style={{ background: '#fff6ec' }}><b>For you: </b>{d.forYou}</div>}
          <div className="rounded-2xl p-3.5" style={{ background: '#eef6f6' }}><b>Example: </b>{d.example}</div>
          <div className="flex flex-col gap-2"><strong>✦ Key terms <span className="font-normal text-[#5f5c5a]">· tap a chip to explain it</span></strong>
            <div className="flex gap-1.5 flex-wrap">{d.terms.map(([t]) => <button key={t} aria-pressed={term === t} onClick={() => setTerm(term === t ? '' : t)} className={cx('text-[13px] px-3 py-1.5 rounded-full border', term === t ? 'bg-black text-white border-black' : 'bg-white border-[#d9d9d9]')}>{t}</button>)}</div>
            {term && <div role="status" className="rounded-xl bg-[#f2f4f5] p-3"><b>{term}: </b>{d.terms.find((x) => x[0] === term)?.[1]}</div>}
          </div>
          <div className="flex flex-col gap-1.5"><strong>✦ Common questions</strong>
            {d.questions.map(([q, a]) => <div key={q} className="rounded-xl border border-[#ebebeb]"><button aria-expanded={qa === q} onClick={() => setQa(qa === q ? '' : q)} className="w-full text-left px-3.5 py-2.5 flex justify-between gap-2 font-medium"><span>{q}</span><span aria-hidden>{qa === q ? '−' : '+'}</span></button>{qa === q && <p className="m-0 px-3.5 pb-3 text-[#3d3a38]">{a}</p>}</div>)}
          </div>
          <div className="flex flex-col gap-2"><strong>✦ Quick check</strong><span>{d.check.q}</span>
            <div className="flex flex-col gap-1.5">{d.check.answers.map(([a, ok], i) => <button key={a} onClick={() => setPick(i)} className={cx('text-left px-4 py-2.5 rounded-full border', pick === i ? (ok ? 'bg-[#e7f4e8] border-[#1f7a2a] text-[#1f7a2a] font-semibold' : 'bg-[#fbeaea] border-[#c62828] text-[#7d1a1a]') : 'bg-white border-[#d9d9d9]')}>{a}{pick === i ? (ok ? ' ✓' : ' ✗') : ''}</button>)}</div>
            {pick >= 0 && <span role="status" className={d.check.answers[pick][1] ? 'text-[#1f7a2a] font-semibold' : 'text-[#c62828]'}>{d.check.answers[pick][1] ? 'Correct.' : `Not quite · the answer is “${d.check.answers.find((x) => x[1])?.[0]}”.`}</span>}
          </div>
        </div>
        <footer className="p-5 border-t border-[#ebebeb] flex items-center gap-3 flex-wrap sticky bottom-0 bg-white" style={{ borderRadius: '0 0 24px 24px' }}>
          <label className="flex items-center gap-2 text-sm flex-1 min-w-[200px]"><input type="checkbox" checked={never} onChange={() => setNever(!never)} className="w-4 h-4 accent-black" />Don't show this again for me</label>
          <button onClick={onBack} className="h-11 px-5 rounded-full border border-[#d9d9d9] bg-white text-sm font-medium">Go back</button>
          <button onClick={go} className="h-11 px-5 rounded-full text-white text-sm font-semibold" style={{ background: d.color }}>{d.cta}</button>
        </footer>
      </section>
    </div>
  );
}

export const CREDIT_INTRO: IntroDef = {
  id: 'credit', color: '#0b5c5c', icon: '🤝', title: 'What is a credit sale?', tagline: 'The customer takes the goods today and pays later.',
  what: 'A credit sale is a sale where payment is deferred to a future date, but the items bought on credit are handed over or delivered to the customer straight away. The customer owns the goods from today and owes the business the balance until it is paid.',
  points: [
    'Record the customer’s name and phone number — a credit sale cannot be anonymous.',
    'The customer may pay part now; the rest becomes the balance owed.',
    'Agree a due date. The balance shows in red until it is paid.',
    'Part payments are recorded under Customers → Owing on credit, and SMS reminders can be sent.',
    'Prints as CREDIT SALES RECEIPT and CREDIT SALES INVOICE.',
  ],
  forYou: 'Admin sales go through straight away and the Admin approves others; everyone else’s credit sales go to the Admin for approval first.',
  example: 'Yaw buys a GHS 4,000 fridge. He pays GHS 1,000 today and takes the fridge home. He owes GHS 3,000, due by 30 November.',
  terms: [
    ['Credit', 'Goods now, money later. The business trusts the customer to pay the balance.'],
    ['Deferred payment', 'Payment moved to a later date that both sides agree.'],
    ['Paid now', 'Any amount the customer pays today. It reduces the balance straight away.'],
    ['Balance owed', 'What is left to pay after the amount paid now.'],
    ['Due date', 'The day the balance must be paid. After it, the balance is overdue.'],
    ['Credit limit', 'The most a customer may owe at once. Set on the customer’s profile.'],
    ['Part payment', 'Paying some of the balance before the due date. Recorded in Customers.'],
    ['Approval', 'The Admin checks and approves a credit sale before the goods leave.'],
  ],
  questions: [
    ['Is a credit sale the same as hire purchase?', 'No. In a credit sale the customer owns the goods straight away. In hire purchase the item belongs to the shop until the last instalment, and there is a monthly charge.'],
    ['What if the customer does not pay by the due date?', 'The balance turns overdue (red) in Customers. Send an SMS reminder, move the due date if agreed, or ask the Admin about the next step.'],
    ['Can the customer pay with MoMo later?', 'Yes. Record each part payment in Customers → Owing on credit with Cash, Mobile Money or GhPay and the reference.'],
    ['Does the stock leave the shop?', 'Yes. Stock is taken when the sale is completed, the same as a paid sale.'],
  ],
  check: { q: 'Who owns the goods after a credit sale?', answers: [['The customer, straight away', true], ['The business, until paid', false], ['Nobody until approval', false]] },
  cta: 'I understand — make a credit sale',
};

export const PF_INTRO: IntroDef = {
  id: 'proforma', color: '#0b6b6b', icon: '📄', title: 'What is a pro-forma invoice?', tagline: 'A quotation sent before a sale — not a bill.',
  what: 'A pro-forma invoice tells the customer exactly what they would buy and what it would cost, so they can approve it, raise a purchase order or arrange payment. Nothing is sold until it is accepted and converted.',
  points: [
    'Not a demand for payment and not a tax invoice (no VAT claim).',
    'No sale is recorded and no stock moves.',
    'Set the validity (e.g. 14 days) and any advance.',
    'Businesses need it for purchase orders or approval.',
    'Tap Convert when accepted.',
  ],
  example: 'Accra Royal School asks for 4 Nasco 1.5HP air conditioners. You send CIE-PF-0042, valid 14 days with a 50% advance. They accept, you tap Convert, and it becomes a sales invoice.',
  terms: [
    ['Pro-forma', 'A preliminary invoice that shows the goods and prices before the sale.'],
    ['Quotation / estimate', 'Another name for the price offer. Prices may still change.'],
    ['Validity', 'How long the prices and stock are held, e.g. 14 days.'],
    ['Advance', 'Part of the total paid before delivery, e.g. 30% or 50%.'],
    ['Convert', 'Turn the accepted pro-forma into a real invoice with the same lines.'],
    ['Tax invoice', 'The final invoice with VAT, NHIL and GETFund. Only this one supports a VAT claim.'],
  ],
  questions: [
    ['Does a pro-forma reduce stock?', 'No. Stock only moves when it is converted and the sale is made.'],
    ['Can the customer pay against a pro-forma?', 'Yes, an advance can be recorded with the bank reference. The final invoice shows it as paid.'],
    ['What happens when it expires?', 'It is marked Expired. Send a new one with current prices, or extend the validity.'],
    ['Why do businesses ask for it?', 'To get approval, raise a purchase order or open a letter of credit before they pay.'],
  ],
  check: { q: 'Can a customer claim VAT on a pro-forma invoice?', answers: [['Yes, it shows VAT', false], ['No — only on a tax invoice', true], ['Only if they paid an advance', false]] },
  cta: 'I understand — create a pro-forma',
};

export const HP_INTRO: IntroDef = {
  id: 'hirepurchase', color: '#a8492a', icon: '📅', title: 'What is hire purchase?', tagline: 'Deposit now, the rest in monthly instalments.',
  what: 'The customer pays a deposit and takes the item, then pays the rest over 3, 6, 9, 12 or a custom number of months, with a 1.5% per month charge. The item stays the business’s until the last instalment is paid.',
  points: [
    'Collect the deposit and details (ID and guarantor for individuals; TIN, address and respondent for businesses).',
    'Choose the term.',
    'The agreement is drafted, signed and uploaded.',
    'Each instalment is recorded; missed ones turn Overdue.',
    'Ownership passes after the last instalment.',
  ],
  example: 'Ama buys a GHS 3,200 gas cooker. She pays a 25% deposit (GHS 800) and about GHS 436 a month for 6 months. The cooker is hers after the sixth payment.',
  terms: [
    ['Deposit', 'The first payment, at least 10% of the cash price, taken before the item leaves.'],
    ['Instalment', 'Each regular payment after the deposit.'],
    ['Term', 'How many months the customer has to pay.'],
    ['Hire purchase charge', 'The extra cost for paying over time, a flat % per month on the amount financed.'],
    ['Guarantor', 'A person who agrees to pay if the customer does not.'],
    ['Ownership', 'Passes to the customer only after the last instalment.'],
    ['Default', 'Instalments not paid after reminders. The Admin decides the next step.'],
  ],
  questions: [
    ['How is it different from a credit sale?', 'In a credit sale the customer owns the goods at once and there is no charge. In hire purchase the shop owns the item until the end, and a monthly charge applies.'],
    ['Can a business buy on hire purchase?', 'Yes. Record the TIN, business address and the person who represents the business.'],
    ['Can the customer pay off early?', 'Yes. An early settlement quote gives back part of the unearned charge.'],
    ['What if an instalment is missed?', 'After the 7-day grace period a late fee is added and the agreement shows In arrears. Reminders go out automatically.'],
  ],
  check: { q: 'When does the customer own a hire purchase item?', answers: [['When they take it home', false], ['After the last instalment', true], ['After paying half', false]] },
  cta: 'I understand — start hire purchase',
};
