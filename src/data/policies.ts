// Store policy templates (Terms of sale, Privacy, Returns & refunds, Delivery, Cookies) for the online store.
// Written to work for any business on MNest UnifiedPOS: {tokens} are filled in from the company's own store
// settings when the page is shown (fillTokens below), so a new company only edits what is different for them.
// Formatting understood by the store page: "## " starts a heading, "- " starts a bullet, a blank line starts a
// new paragraph. These are general templates, not legal advice: each business should have them reviewed by a
// lawyer before launch (the Post to online editor says so).

/** Tokens that can be used in policy text, with what each one becomes. Shown as help in Post to online. */
export const POLICY_TOKENS: [string, string][] = [
  ['{business}', 'Store name'], ['{phone}', 'Phone'], ['{whatsapp}', 'WhatsApp'], ['{email}', 'Email'],
  ['{address}', 'Main branch address'], ['{website}', 'Website address'], ['{hours}', 'Opening hours'],
];

/** Values used to fill the tokens (built by the store from its settings). */
export type TokenValues = Record<'business' | 'phone' | 'whatsapp' | 'email' | 'address' | 'website' | 'hours', string>;

/** Replace every {token} with the company's value; unknown tokens are left as typed so mistakes stay visible. */
export const fillTokens = (text: string, v: TokenValues) => text.replace(/\{(business|phone|whatsapp|email|address|website|hours)\}/g, (_, k: keyof TokenValues) => v[k] || '');

/** The five store policies. Always present in Post to online; they can be edited, reset or replaced by a document. */
export const POLICY_TEMPLATES: { slug: string; title: string; body: string }[] = [
  {
    slug: 'terms', title: 'Terms of sale', body: `These terms apply to every purchase from {business}, whether you order on our website ({website}), on WhatsApp, by phone or in one of our branches. By placing an order you agree to these terms, so please read them carefully.

## Who we are
{business} is the seller of every product on this website. You can reach us on {phone}, on WhatsApp at {whatsapp}, by email at {email}, or at our main branch: {address}.

## Prices and payment
- All prices are in Ghana cedis (GHS) and include VAT and levies where they apply.
- Prices are the same online and in our branches unless an offer says otherwise.
- We accept Mobile Money, card, bank transfer and, where shown at checkout, cash or MoMo on delivery.
- Your order is confirmed only when payment is verified, or when you choose pay on delivery and we accept the order.
- If a price on the website is clearly wrong, we will contact you before your order is confirmed. You can then buy at the correct price or cancel for a full refund.

## Your order
- After checkout you receive an order number by SMS, WhatsApp or email. Keep it to track or collect your order.
- We may decline or cancel an order if an item is out of stock, if we cannot verify payment, or if we cannot deliver to your address. Any money paid is refunded in full.
- Quantities may be limited on offers and wholesale (carton) prices.

## Offers and discount codes
- Discount codes are valid only between their start and end dates and may have a minimum spend or usage limit.
- Only one code can be used per order unless the offer says otherwise. Codes cannot be exchanged for cash.

## Hire purchase
Some items can be bought on hire purchase in our branches. Hire purchase is covered by a separate written agreement that sets out the deposit, instalments and what happens if a payment is missed.

## Delivery, collection and returns
How we deliver is explained in our Delivery policy, and how to return an item in our Returns & refunds policy. Both form part of these terms.

## Warranty
Electrical and electronic items come with the manufacturer's warranty. Keep your receipt: we will help you make a claim.

## Our responsibility to you
We take care to describe our products accurately. If something goes wrong with your order, contact us and we will put it right. Nothing in these terms limits your rights under the laws of Ghana.

## Changes to these terms
We may update these terms from time to time. The version on this page when you place your order is the one that applies.

## Contact us
Questions about these terms? Call {phone}, WhatsApp {whatsapp} or email {email}. We are open {hours}.`,
  },
  {
    slug: 'privacy', title: 'Privacy policy', body: `{business} respects your privacy. This policy explains what personal information we collect when you shop with us, why we collect it, how we keep it safe and the choices you have. It follows the Data Protection Act, 2012 (Act 843).

## What we collect
- Contact details: your name, phone number, WhatsApp number and email address.
- Delivery details: your delivery address, landmark and GhanaPostGPS address.
- Order details: what you bought, when, how you paid and your order history.
- Account details: your sign-in details and wishlist, if you create an account.
- Messages: what you send us through the contact form, WhatsApp, reviews or job applications.
- Technical details: basic information about the device and browser you use, collected through cookies (see our Cookies policy).

## Why we use it
- To take, deliver and support your orders, including SMS and WhatsApp order updates.
- To process payments and refunds and keep the records the law requires.
- To answer your questions and complaints.
- To send offers by email, SMS or WhatsApp, but only if you agree. You can stop them at any time.
- To prevent fraud and keep our website secure.
- To improve our products, website and service.

## Payments
Card and Mobile Money payments are handled by licensed payment providers. We never see or store your full card number or MoMo PIN.

## Who we share it with
We share only what is needed with delivery riders and courier partners, payment providers, and SMS and email services that send your order updates. We do not sell your personal information. We may share information when the law requires it.

## How long we keep it
We keep order and payment records for as long as the law requires for tax and accounting. Other information is kept only while it is needed for the purpose it was collected for, then deleted or anonymised.

## How we protect it
Your information is stored securely, access is limited to staff who need it, and every access to customer records is logged.

## Your rights
You can ask to see the personal information we hold about you, ask us to correct it, ask us to delete it, or object to how we use it. You can also withdraw your consent to marketing at any time. If you have an account, you can do much of this under My account › Privacy & data. If you are not satisfied with our answer, you can complain to the Data Protection Commission of Ghana.

## Changes to this policy
We may update this policy. The date at the top shows when it last changed.

## Contact us
To ask a question or use your rights, email {email}, call {phone} or write to us at {address}.`,
  },
  {
    slug: 'returns', title: 'Returns & refunds', body: `We want you to be happy with everything you buy from {business}. If something is not right, here is how to return or exchange it.

## Changed your mind
- Bring back unused items in their original packaging with your receipt or order number within 7 days of purchase or delivery.
- You can choose an exchange, store credit or a refund to your original payment method.
- Returns are accepted at any of our branches.

## Faulty, damaged or wrong items
- Tell us within 48 hours of delivery if an item arrives damaged, faulty or is not what you ordered. A photo on WhatsApp ({whatsapp}) helps us sort it out quickly.
- We will replace the item or give you a full refund, including any delivery charge.
- Electrical and electronic items are also covered by the manufacturer's warranty. Bring the item and receipt to a branch and we will help you claim it.

## Items we cannot take back
DStv and GOtv subscriptions cannot be refunded once activated. Items damaged after delivery through misuse, power surges without a stabiliser, or installation by someone other than our technicians cannot be returned, though the manufacturer’s warranty may still apply.

## How refunds are paid
- Refunds go back to the way you paid: Mobile Money, card, bank transfer or cash in branch.
- Mobile Money refunds are usually sent within 24 hours. Card and bank refunds can take 5–10 working days to reach your account.
- We will tell you by SMS or WhatsApp when your refund has been sent.

## Cancelling an order
You can cancel an online order free of charge before it leaves our branch. Contact us with your order number and we will refund you in full.

## Hire purchase items
Returns of items bought on hire purchase follow the terms of your hire purchase agreement.

## Need help?
Call {phone}, WhatsApp {whatsapp} or email {email}. We are open {hours}.`,
  },
  {
    slug: 'delivery', title: 'Delivery', body: `{business} delivers to homes, offices and businesses, and you can also collect your order free from any branch.

## Where and how fast
- Same-day delivery in our local areas for orders placed before 15:00 on a working day.
- Orders placed after 15:00, on Sundays or on public holidays go out the next working day.
- Other parts of Ghana are served by courier, usually within 1–3 working days.
- The delivery areas, charges and expected times are shown at checkout before you pay.

## Delivery charges
- The charge depends on your area and is shown at checkout.
- Orders over the free-delivery amount shown in your basket are delivered free in our local areas.
- Large items such as cookers, freezers and TVs may have a separate charge, shown before you pay.

## Click and collect
- Choose click and collect at checkout and pick the branch that suits you. Collection is free.
- We send you a message with a collection code when your order is ready, usually within 2 hours during opening times.
- Bring the code (or your order number) and the phone number used to order. Orders are held for 3 days.

## Tracking your order
Use Track order on our website with your order number. We also send SMS and WhatsApp updates when your order is packed, out for delivery and delivered.

## When your order arrives
- Please check your items when the rider arrives. If anything is missing or damaged, tell the rider and contact us within 48 hours.
- If you chose pay on delivery, please have cash or Mobile Money ready.
- If nobody is available, the rider will call you. We will try once more, or you can collect from the branch.

## Contact us about a delivery
Call {phone} or WhatsApp {whatsapp} with your order number. We are open {hours}.`,
  },
  {
    slug: 'cookies', title: 'Cookies', body: `This policy explains how {business} uses cookies and similar technologies on {website}, and how you can control them.

## What cookies are
Cookies are small files saved on your phone or computer when you visit a website. They help the website remember you and work properly.

## Cookies we use
- Essential cookies keep your basket, checkout and sign-in working. The website cannot work without them, so they are always on.
- Preference cookies remember choices such as your branch and recently viewed products.
- Analytics cookies help us understand which pages are used, so we can improve the website. They are only used if you accept them.
- Marketing cookies, if we use them, help us show relevant offers on other websites. They are only used if you accept them.

## Your choices
- When you first visit, our cookie banner lets you accept all cookies or keep only the essential ones.
- You can change your choice at any time with Cookie settings at the bottom of the page.
- You can also delete or block cookies in your browser settings. If you block essential cookies, your basket and sign-in will not work.

## Third-party services
Some features, such as maps, payment pages and social media links, are provided by other companies that may set their own cookies. Their own privacy and cookie policies apply.

## Changes to this policy
We may update this policy when we change the cookies we use. The date at the top shows when it last changed.

## Contact us
Questions about cookies? Email {email} or call {phone}.`,
  },
];

/** The short policy texts the store shipped with before, used to upgrade stores that never edited them. */
export const OLD_POLICY_BODIES: Record<string, string> = {
  terms: 'These terms apply to every order placed on our online store or in our branches.\n\nPrices are in Ghana cedis and include VAT and levies where they apply. We may correct obvious pricing mistakes before an order is confirmed.',
  privacy: 'We collect only what we need to take and deliver your order: your name, phone number, delivery address and order history.\n\nWe do not sell your data. You can ask us to see or delete it at any time under My account › Privacy & data. This policy follows the Data Protection Act, 2012 (Act 843).',
  returns: 'Bring back unused items with the receipt within 7 days for an exchange or refund. Faulty electrical items are covered by the manufacturer’s warranty; we help you claim it.',
  delivery: 'Same-day delivery in Accra for orders placed before 15:00. Kumasi deliveries go out the next working day. You can also click and collect from any branch.',
  cookies: 'We use a few cookies to keep your basket and sign-in working. Analytics cookies are only used if you accept them.',
};

/** One block of a policy page after parsing the simple formatting. */
export type Block = { t: 'h'; text: string } | { t: 'p'; text: string } | { t: 'ul'; items: string[] };

/** Turn policy text into headings, paragraphs and bullet lists for the store page. */
export function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  String(text || '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('## ')) out.push({ t: 'h', text: line.slice(3).trim() });
    else if (/^[-•*]\s+/.test(line)) { const item = line.replace(/^[-•*]\s+/, ''); const last = out[out.length - 1]; if (last?.t === 'ul') last.items.push(item); else out.push({ t: 'ul', items: [item] }); }
    else out.push({ t: 'p', text: line });
  });
  return out;
}
