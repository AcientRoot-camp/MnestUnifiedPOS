// Ready-made online store content: About us, FAQs, store updates and job postings. Used as the defaults for a
// new store and, once, to top up stores created before this content existed (see mergeWeb in web.ts).
// Everything here is editable in Post to online.
import type { Faq, Job, Upd } from './web';

const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/* ---------- About us ---------- */

/** The About texts the store shipped with before, so stores that never edited them can be upgraded. */
export const OLD_ABOUT = {
  short: 'A family business serving Accra and Kumasi with everyday groceries and household goods. Shop in person or online, by the piece or wholesale by the carton, at the same prices.',
  story: 'Ebenezer Unique Ventures started as a single shop on Oxford Street, Osu, selling rice, oil and household basics to neighbours. Today we serve families, chop bars and small shops across Accra and Kumasi from three branches, in store and online.\n\nWe keep prices the same in every branch and online, sell by the piece or by the carton, and deliver the same day in Accra.',
  values: 'Fair prices, the same in store and online\nWholesale for small businesses\nFriendly service in English and Twi\nSame-day delivery in Accra',
  aim: 'To be the shop every family in our area can rely on, every day.',
  vision: 'A branch close to every home in Accra and Kumasi.',
  mission: 'Good everyday products at fair prices, close to home.',
};

/** Fuller About content: story, aim, vision, mission and values. */
export const ABOUT_V2 = {
  short: 'A family business serving Accra and Kumasi since 2019 with TVs, fridges, air conditioners and home electronics from the brands Ghana trusts: TCL, Nasco, Samsung, LG, Hisense and more. Shop in person at any of our branches or online, always at the same fair prices.',
  story: 'Ebenezer Unique Ventures began in 2019 as a single shop on Oxford Street, Osu. Our founder wanted neighbours to be able to buy a good TV, fridge or fan at an honest price, with a real warranty and someone to call when they need help. Customers came back, told their friends, and the little shop grew.\n\nAs demand grew, we opened our East Legon branch for families in the north of Accra, then our Adum branch in Kumasi for households and businesses in the Ashanti Region. Along the way we added air conditioners with installation, DStv and GOtv, hire purchase so families can pay monthly, and an online store with same-day delivery.\n\nToday we stock genuine products from TCL, Nasco, Samsung, LG, Hisense, Sony, Midea, Bruhm, Binatone and more, keep prices the same in every branch and online, and look after our customers long after they buy.',
  aim: 'To be the electronics shop every family and business in our community can rely on, for the right product at a price they can trust.',
  vision: 'To have one of our branches, or a same-day delivery, within easy reach of every home and business in Ghana, known everywhere for genuine products, honest prices and friendly service.',
  mission: 'To bring genuine TVs, fridges, air conditioners and home electronics close to home, at fair prices that are the same online and in store, with warranty, installation and hire purchase, delivered quickly and served with care in English, Twi and the languages our customers speak.',
  values: 'Fair prices, the same in store and online\nGenuine products with manufacturer warranty\nHonesty in every sale: no hidden charges\nInstallation and after-sales support we stand behind\nFriendly, patient service in English and Twi\nSame-day delivery and quick click and collect\nHire purchase that helps families pay monthly\nKeeping our promises, on time, every time\nLooking after your personal information\nGiving back to the communities we serve',
};

/** The contact intro the store shipped with before (for the one-time upgrade). */
export const OLD_CONTACT_INTRO = 'Wholesale quotes, bulk orders or questions. We reply on WhatsApp within the hour during opening times.';
export const CONTACT_INTRO_V2 = 'Questions about an order, a wholesale quote, hire purchase or a return? Call, WhatsApp, email or send us a message below. A real person replies within the hour during opening times.';

/* ---------- FAQs ---------- */

/** Extra questions added on top of the original list (ids fqm… so they never clash with fq1–fq13). */
export const MORE_FAQS: Faq[] = ([
  ['Orders & delivery', 'Do you deliver outside Accra and Kumasi?', 'Yes. We send orders to the rest of Ghana by courier. Delivery usually takes 1–3 working days and the charge is shown at checkout.'],
  ['Orders & delivery', 'Can I change or cancel my order?', 'Yes, until it leaves the branch. Call or WhatsApp us with your order number and we will change it or cancel it with a full refund.'],
  ['Orders & delivery', 'What happens if I am not home for my delivery?', 'The rider will call you. If we cannot reach you, we will try again or you can collect the order from the branch at no extra cost.'],
  ['Orders & delivery', 'Can someone else receive my order?', 'Yes. Add their name and phone number in the delivery note at checkout, or tell the rider when they call.'],
  ['Click & collect', 'How long do you keep my click and collect order?', 'We keep your order for 3 days after it is ready. We send a reminder before we return the items to the shelf.'],
  ['Click & collect', 'Can I pay when I collect?', 'Yes. You can pay online at checkout, or pay at the branch with cash, Mobile Money or card when you collect.'],
  ['Payments', 'Is it safe to pay online?', 'Yes. Payments are handled by licensed payment providers and are protected. We never see or store your full card number or Mobile Money PIN.'],
  ['Payments', 'My Mobile Money payment failed. What should I do?', 'Check that you approved the prompt on your phone and have enough balance, then try again. If money left your wallet but your order was not confirmed, contact us with the transaction ID and we will sort it out.'],
  ['Payments', 'Can I get a VAT invoice for my business?', 'Yes. Add your business name and TIN at checkout or at the till, and your receipt will show them.'],
  ['Returns & refunds', 'How long does a refund take?', 'Mobile Money refunds are usually sent within 24 hours. Card and bank refunds can take 5–10 working days to show in your account.'],
  ['Returns & refunds', 'Can I return an item to a different branch?', 'Yes. You can return or exchange items at any of our branches, whether you bought them online or in store.'],
  ['Hire purchase', 'What can I buy on hire purchase?', 'Selected home appliances and electronics such as TVs, fridges, freezers and cookers. Look for the hire purchase label in store or ask a branch.'],
  ['Hire purchase', 'What do I need to apply for hire purchase?', 'A valid Ghana Card, proof of address, a working phone number and a deposit. A guarantor may be needed for some items. Visit any branch to apply.'],
  ['Hire purchase', 'What happens if I miss an instalment?', 'Contact us as soon as you can. We will agree a plan with you. Late payments may attract a fee as set out in your hire purchase agreement.'],
  ['Wholesale & business', 'How do I get wholesale prices?', 'Buy by the carton or crate online or in store and the wholesale price is applied automatically. For large or regular orders, ask us for a quote.'],
  ['Wholesale & business', 'Can my business open a credit account?', 'Regular business customers can apply for a credit account at any branch. Approval depends on your buying history.'],
  ['Shopping with us', 'Do products online show real stock?', 'Yes. Stock on the website comes straight from our branch tills, so what you see is what is on the shelf.'],
  ['Shopping with us', 'Can I ask for a product you do not stock?', 'Yes. Send us a message on the Contact page or WhatsApp and we will try to stock it for you.'],
  ['Account & support', 'I forgot my password. What do I do?', 'Choose Sign in, then Forgot password, and we will send you a code by SMS or email to set a new one.'],
  ['Privacy & security', 'What do you do with my personal information?', 'We use it only to take, deliver and support your orders, and to send offers if you agree. We never sell it. See our Privacy policy for the details.'],
  ['Privacy & security', 'How do I delete my account?', 'Go to My account › Privacy & data and choose Delete my account, or contact us and we will do it for you.'],
] as [string, string, string][]).map(([cat, q, a], i) => ({ id: 'fqm' + (i + 1), cat, q, a, on: true }));

/** Every FAQ group, in the order the editor offers them. */
export const FAQ_GROUPS = ['Orders & delivery', 'Click & collect', 'Payments', 'Returns & refunds', 'Hire purchase', 'Wholesale & business', 'Shopping with us', 'Account & support', 'Privacy & security'];

/* ---------- Store updates ---------- */

export const MORE_UPDATES: Upd[] = [
  { id: 'u3', title: 'Black Friday week: up to 15% off electronics', kind: 'Offer', body: 'Use code BLACKFRI at checkout for 15% off TVs, phones and small appliances (minimum spend GHS 300, up to GHS 500 off). Online and in every branch while stocks last.', cta: 'Shop the offer', to: 'shop', pinned: false, live: true, at: '20 Nov' },
  { id: 'u4', title: 'Free delivery on orders over GHS 500', kind: 'Delivery', body: 'Spend GHS 500 or more and we deliver free to Osu, Labone, Cantonments, East Legon, Adum, Ahodwo and Asokwa. Order before 15:00 for same-day delivery.', cta: 'Start shopping', to: 'shop', pinned: false, live: true, at: '15 Nov' },
  { id: 'u5', title: 'Business prices for hotels, schools and offices', kind: 'Wholesale', body: 'Buying several TVs, fridges or air conditioners? Ask any branch for a pro-forma invoice with business prices, installation and a credit account for regular orders.', cta: 'Contact us', to: 'contact', pinned: false, live: true, at: '9 Nov' },
  { id: 'u6', title: 'Hire purchase now at all three branches', kind: 'Announcement', body: 'Take home a TV, fridge, freezer or air conditioner today and pay over 3, 6 or 12 months. Bring your Ghana Card and a small deposit to any branch to apply.', cta: 'See branches', to: 'branches', pinned: false, live: true, at: '4 Nov' },
  { id: 'u7', title: 'Christmas opening hours', kind: 'Opening times', body: 'From 15 December all branches open until 22:00, and on Sundays from 10:00 to 18:00. We close on Christmas Day and reopen on Boxing Day at 12:00.', cta: 'See branches', to: 'branches', pinned: false, live: true, at: '1 Nov' },
  { id: 'u8', title: 'Pay with GhPay and Paystack', kind: 'New', body: 'You can now pay online with GhPay and Paystack, as well as Mobile Money, card and bank transfer. Pay on delivery is still available.', cta: 'Start shopping', to: 'shop', pinned: false, live: true, at: '28 Oct' },
];

/* ---------- Careers & opportunities ---------- */

/** Builds one job posting (ids j101…, so they never clash with the original j1/j2). */
const J = (n: number, title: string, dept: string, br: string, type: string, salMin: string, salMax: string, openings: number, closesIn: number, summary: string, duties: string[], reqs: string[], offer: string[], docs: string[] = ['CV / résumé']): Job => ({
  id: 'j' + (100 + n), title, dept, br, type, salMin, salMax, open: true, apps: (n * 7) % 23, summary, role: dept, openings, closes: day(closesIn), showSal: true,
  duties: duties.join('\n'), reqs: reqs.join('\n'), offer: offer.join('\n'), docs,
});
const STD = ['Monthly salary paid on time', 'SSNIT contributions', 'Staff discount on everything we sell', 'Training and a clear path to promotion'];

export const MORE_JOBS: Job[] = [
  J(1, 'Cashier', 'Sales', 'osu', 'Full time', '1800', '2300', 2, 21, 'Serve customers at the till quickly, accurately and with a smile.', ['Ring up sales on the till and take cash, MoMo and card payments', 'Count and balance your till at the end of each shift', 'Help customers with questions and returns'], ['SHS certificate or higher', 'Good with numbers and honest', 'Speaks English and Twi'], STD),
  J(2, 'Cashier', 'Sales', 'adum', 'Full time', '1700', '2200', 2, 25, 'Serve customers at our busy Kumasi branch till.', ['Take payments and issue receipts', 'Balance your till every shift', 'Keep the till area tidy'], ['SHS certificate or higher', 'Accurate and trustworthy', 'Speaks English and Twi'], STD),
  J(3, 'Sales assistant', 'Sales', 'legon', 'Full time', '1800', '2400', 2, 18, 'Help customers find what they need and keep the shop floor full and tidy.', ['Greet and help customers on the shop floor', 'Refill shelves and check prices and expiry dates', 'Pack click and collect orders'], ['SHS certificate or higher', 'Friendly and hard-working', 'Able to stand for long periods'], STD),
  J(4, 'Sales assistant (weekends)', 'Sales', 'osu', 'Part time', '900', '1200', 3, 30, 'Weekend shifts on the shop floor, ideal for students.', ['Help customers and keep shelves tidy on Saturdays and Sundays', 'Support the tills at busy times'], ['Aged 18 or over', 'Available every weekend', 'Friendly and reliable'], ['Paid per shift', 'Staff discount', 'Flexible hours around your studies']),
  J(5, 'Branch supervisor', 'Management', 'legon', 'Full time', '3200', '4200', 1, 20, 'Lead the shop floor team and make sure every shift runs smoothly.', ['Plan shifts and lead a team of 8–12', 'Approve discounts, returns and till cash-ups', 'Keep stock, displays and cleanliness to standard', 'Handle customer complaints'], ['3+ years in retail, 1+ as a supervisor', 'Strong leader and problem solver', 'Comfortable with a computerised till system'], [...STD, 'Performance bonus']),
  J(6, 'Assistant branch manager', 'Management', 'adum', 'Full time', '4500', '6000', 1, 28, 'Support the branch manager to run the Adum branch profitably.', ['Run the branch when the manager is away', 'Track sales, stock and staff performance', 'Lead stock counts and banking', 'Coach and develop the team'], ['HND or degree in business or related field', '4+ years in retail management', 'Good with reports and numbers'], [...STD, 'Performance bonus', 'Medical cover']),
  J(7, 'Stock controller', 'Inventory', 'osu', 'Full time', '2600', '3400', 1, 21, 'Keep our stock records accurate from delivery to shelf.', ['Receive deliveries and check them against orders', 'Run stock counts and investigate differences', 'Raise reorders when stock is low', 'Record damaged and expired stock'], ['Experience in stock control or warehousing', 'Very accurate and organised', 'Good computer skills'], STD),
  J(8, 'Warehouse assistant', 'Warehouse', 'osu', 'Full time', '1700', '2100', 3, 15, 'Receive, store and send out stock from our central warehouse.', ['Unload and check deliveries', 'Pick and pack transfers to branches', 'Keep the warehouse clean and safe'], ['Physically fit', 'Reliable and careful', 'Forklift experience is a plus'], [...STD, 'Safety boots and uniform provided']),
  J(9, 'Delivery rider', 'Delivery', 'osu', 'Full time', '1600', '2100', 2, 14, 'Deliver online orders around Osu, Labone and Cantonments.', ['Deliver orders safely and on time', 'Collect payment on delivery and take photo proof', 'Look after the company motorbike'], ['Valid motorbike licence (class A)', 'Knows Accra well', 'Owns a smartphone'], ['Monthly salary plus delivery bonus', 'Fuel, helmet and rain gear provided', 'SSNIT contributions'], ['CV / résumé', 'Driving licence']),
  J(10, 'Delivery rider', 'Delivery', 'adum', 'Full time', '1500', '2000', 2, 14, 'Deliver online orders around Adum, Ahodwo and Asokwa.', ['Deliver orders safely and on time', 'Collect payment on delivery', 'Keep the motorbike in good condition'], ['Valid motorbike licence (class A)', 'Knows Kumasi well', 'Owns a smartphone'], ['Monthly salary plus delivery bonus', 'Fuel and helmet provided', 'SSNIT contributions'], ['CV / résumé', 'Driving licence']),
  J(11, 'Van driver', 'Delivery', 'legon', 'Full time', '2200', '2800', 1, 21, 'Drive our van for large deliveries and branch transfers.', ['Deliver appliances and bulk orders', 'Move stock between the warehouse and branches', 'Carry out daily vehicle checks'], ['Valid class B or C licence', '3+ years driving experience', 'Clean driving record'], [...STD, 'Overtime pay'], ['CV / résumé', 'Driving licence']),
  J(12, 'Customer service officer', 'Customer service', 'osu', 'Full time', '2200', '2800', 2, 24, 'Answer customers on phone, WhatsApp, email and the website chat.', ['Answer questions about orders, delivery and returns', 'Solve problems and follow up until they are fixed', 'Log every conversation in our system'], ['SHS or higher; diploma is a plus', 'Excellent spoken and written English', 'Patient and calm under pressure'], STD),
  J(13, 'Online orders coordinator', 'E-commerce', 'osu', 'Full time', '2600', '3300', 1, 20, 'Make sure every online order is packed, dispatched and delivered on time.', ['Watch incoming orders and assign them to branches and riders', 'Keep customers updated by SMS and WhatsApp', 'Fix delivery problems quickly'], ['Experience in e-commerce, logistics or customer service', 'Organised and quick to act', 'Confident with computers and smartphones'], STD),
  J(14, 'Social media & content officer', 'Marketing', 'osu', 'Full time', '2800', '3800', 1, 30, 'Create posts, photos and videos that bring customers to our shops and website.', ['Plan and post on Instagram, TikTok, Facebook and WhatsApp', 'Photograph products and write product descriptions', 'Reply to comments and messages'], ['Diploma or degree in marketing, communications or similar', 'A portfolio of social media work', 'Creative and up to date with trends'], STD, ['CV / résumé', 'Portfolio or links to your work']),
  J(15, 'Marketing intern', 'Marketing', 'osu', 'Internship', '800', '1000', 2, 30, 'Six-month internship supporting our marketing and online store team.', ['Help prepare offers, posts and in-store displays', 'Research what customers want', 'Support events and promotions'], ['Current student or recent graduate', 'Interested in marketing and retail', 'Good writing skills'], ['Monthly allowance', 'Mentoring from our marketing lead', 'Certificate on completion']),
  J(16, 'Accounts officer', 'Finance', 'osu', 'Full time', '3200', '4200', 1, 25, 'Keep our books accurate and our payments on time.', ['Record sales, expenses and supplier payments', 'Reconcile bank and Mobile Money statements', 'Prepare VAT and payroll figures'], ['HND or degree in accounting; ICAG part-qualified is a plus', '2+ years accounting experience', 'Good with spreadsheets and accounting software'], [...STD, 'Support for professional exams'], ['CV / résumé', 'Certificates']),
  J(17, 'Credit & hire purchase officer', 'Finance', 'legon', 'Full time', '2800', '3600', 1, 21, 'Assess hire purchase applications and follow up on instalments.', ['Check applications, IDs and guarantors', 'Explain agreements clearly to customers', 'Follow up on missed payments politely'], ['Experience in credit, microfinance or collections', 'Fair, firm and well organised', 'Good communicator in English and Twi'], [...STD, 'Collections bonus']),
  J(18, 'IT support officer', 'IT', 'osu', 'Full time', '3000', '4000', 1, 30, 'Keep our tills, printers, scanners and network running across all branches.', ['Set up and fix tills, receipt printers and barcode scanners', 'Support staff with the MNest UnifiedPOS system', 'Look after the network and Wi-Fi'], ['Diploma or degree in IT or computer science', 'Hands-on hardware and networking experience', 'Willing to travel between branches'], [...STD, 'Transport allowance']),
  J(19, 'Security officer', 'Operations', 'adum', 'Full time', '1600', '2000', 2, 18, 'Keep our customers, staff and stock safe.', ['Watch the shop floor and entrance', 'Check deliveries and staff exits', 'Respond to incidents calmly'], ['Security training or experience', 'Alert, honest and physically fit', 'Able to work shifts'], [...STD, 'Uniform provided']),
  J(20, 'Cleaner', 'Operations', 'legon', 'Full time', '1300', '1600', 1, 14, 'Keep the branch spotless for our customers.', ['Clean the shop floor, toilets and staff areas', 'Remove waste and recycling', 'Report spills and hazards'], ['Reliable and thorough', 'Previous cleaning experience is a plus'], [...STD, 'Uniform provided']),
];
