// Product descriptions shared by the POS (Products → Add product / Edit, Sell Now product info) and the online store
// (product page "See full details", quick view, search). One description per product lives on the product record
// (Product.desc), so whatever is written or generated in the POS is exactly what shoppers see online.
//
// Format (rich text, Shopify-style, typed as plain text so any textarea can edit it):
//   An opening paragraph (one or more paragraphs).
//   ## Highlights            ← a heading
//   - Long-grain and fragrant ← bullet points
//   ## Specifications
//   - Pack size: 5 kg         ← "Label: value" bullets under Specifications become a table
//   ## How to use
//   Plain paragraphs are fine under any heading.
// Old one-paragraph descriptions still display as they are.
//
// writeDescription drafts a full description from what the shop already knows (name, category, price, pack and carton
// size, sold by weight) plus optional details typed by staff, with tips that suit the kind of product. It runs on the
// device, instantly, at no cost; staff should read and edit the draft before saving.

/** One section of a description: a heading with bullets, a specification table or paragraphs. */
export type DescSection = { title: string; bullets: string[]; specs: [string, string][]; paras: string[] };
/** A parsed description: the opening paragraphs and the sections under headings. */
export type ParsedDesc = { intro: string[]; sections: DescSection[] };

/**
 * Split a description into its opening paragraphs and headed sections.
 * Input: the description text. Output: { intro, sections }.
 */
export function parseDescription(text: string): ParsedDesc {
  const out: ParsedDesc = { intro: [], sections: [] };
  let cur: DescSection | null = null; let para: string[] = [];
  const flush = () => { if (!para.length) return; const t = para.join(' ').trim(); if (t) (cur ? cur.paras : out.intro).push(t); para = []; };
  String(text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    const h = /^#{1,3}\s+(.+)$/.exec(line);
    if (h) { flush(); cur = { title: h[1].trim(), bullets: [], specs: [], paras: [] }; out.sections.push(cur); return; }
    const b = /^[-*•]\s+(.+)$/.exec(line);
    if (b) {
      flush();
      if (!cur) { cur = { title: 'Highlights', bullets: [], specs: [], paras: [] }; out.sections.push(cur); }
      // Under a Specifications / Details heading, "Label: value" becomes a table row.
      const kv = /^([^:]{2,32}):\s+(.+)$/.exec(b[1]);
      if (kv && /spec|detail|size|dimension|info/i.test(cur.title)) cur.specs.push([kv[1].trim(), kv[2].trim()]); else cur.bullets.push(b[1].trim());
      return;
    }
    para.push(line);
  });
  flush();
  return out;
}

/** The description as one plain sentence block (for product cards, search, Google text). */
export function plainText(text: string, max = 0): string {
  const d = parseDescription(text);
  const t = [...d.intro, ...d.sections.flatMap((s) => [...s.paras, ...s.bullets])].join(' ').replace(/\s+/g, ' ').trim();
  return max && t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

/* ---------- the writer ---------- */

export type DescTone = 'Friendly' | 'Premium' | 'Simple';
/** What the writer knows about the product. Everything except name and category is optional. */
export type DescInput = {
  name: string; cat: string; price?: number; ctSize?: number; ctLabel?: string; byWeight?: boolean; size?: string;
  /** Extra details typed by staff, comma separated; "Label: value" items go into the specification table. */
  features?: string; tone?: DescTone; audience?: string; biz?: string;
};

/** Size from the name, e.g. "TCL 43\" TV" → "43 inch", "Nasco 138L Fridge" → "138 L", "1.5HP AC" → "1.5 HP", "8kg washer" → "8 kg". */
export function sizeOf(name: string): string {
  const m = /(\d+(?:[.,]\d+)?)\s*(hp|va|kva|kg|g|mg|ml|cl|l|litres?|liters?|inch(?:es)?|w|watts?|pcs|pack)\b/i.exec(name) || /(\d+(?:[.,]\d+)?)\s*(")/.exec(name);
  if (!m) return '';
  const u = m[2].toLowerCase().replace(/^litres?$|^liters?$/, 'L').replace(/^l$/, 'L').replace(/^"$|^inch(es)?$/, 'inch').replace(/^watts?$/, 'W').replace(/^w$/, 'W').replace(/^hp$/, 'HP').replace(/^va$/, 'VA').replace(/^kva$/, 'kVA');
  return `${m[1].replace(',', '.')} ${u}`;
}

/** Kind of product, for tips that suit it (TV, fridge, air conditioner, decoder, soundbar … and groceries for shops that sell them). */
function kindOf(name: string, cat: string): string {
  const n = name.toLowerCase();
  // Electronics first, so "Soundbar" is not soap, "GOtv" is not a TV and "Water Dispenser" is not bottled water.
  const rules: [RegExp, string][] = [[/subscription/, 'subscription'], [/decoder|dish kit|lnb|explora/, 'decoder'], [/soundbar|home theatre|speaker|partybox/, 'sound'],
    [/air condition|split|\bac\b/, 'aircon'], [/dispenser/, 'dispenser'], [/washing|twin tub/, 'washer'], [/microwave/, 'microwave'], [/stabili[sz]er|fridge guard|ups\b/, 'stabiliser'],
    [/freezer/, 'freezer'], [/fridge|refrigerat/, 'fridge'], [/\btv\b|television|bravia|qled|oled/, 'tv'], [/fan\b/, 'fan'],
    [/rice/, 'rice'], [/oil/, 'oil'], [/gari/, 'gari'], [/sugar/, 'sugar'], [/noodle|pasta|spaghetti/, 'noodles'], [/flour|semovita|maize|corn/, 'flour'],
    [/milk/, 'milk'], [/sardine|mackerel|tuna|fish/, 'fish'], [/tomato/, 'tomato'], [/beans|baked/, 'beans'], [/water/, 'water'], [/malt|soda|cola|drink|juice/, 'drink'],
    [/detergent|powder/, 'detergent'], [/soap/, 'soap'], [/bleach|cleaner|disinfect/, 'cleaner'], [/freezer|fridge|refrigerat/, 'freezer'], [/cooker|stove|gas/, 'cooker'],
    [/blender|mixer/, 'blender'], [/fan/, 'fan'], [/tv|television|display/, 'tv'], [/phone|tablet/, 'phone']];
  return rules.find(([re]) => re.test(n))?.[1] || cat.toLowerCase();
}

/** Tips per kind of product: [why customers buy it, how to use it, how to store it]. */
const TIPS: Record<string, [string, string, string]> = {
  fridge: ['Keeps food and drinks fresh and cold, with good space for a Ghanaian family.', 'Let it stand upright for 4 hours after delivery before switching on. Use a fridge guard or stabiliser to protect it from power surges.', 'Keep it 10 cm from the wall and clean the inside every few weeks.'],
  aircon: ['Cools your room quickly and quietly, even in the hottest months.', 'Have it installed by a trained technician (we can install it for you). Set it to 24–26 °C to save power.', 'Clean the filters every 2–4 weeks and have it serviced every 6 months.'],
  decoder: ['Watch DStv or GOtv channels: football, movies, news and kids’ shows.', 'Connect it to your TV with HDMI and activate it with your smartcard number; pay your subscription at the till or by MoMo.', 'Keep it in a ventilated place, away from heat and water.'],
  subscription: ['A month of DStv / GOtv channels, activated on your smartcard.', 'Give us your smartcard or IUC number at checkout; we activate it within minutes.', 'Renew before the due date to avoid interruption.'],
  sound: ['Rich, room-filling sound for movies, music and football.', 'Connect with HDMI ARC, optical cable or Bluetooth.', 'Keep it away from moisture; dust with a soft dry cloth.'],
  washer: ['Takes the hard work out of laundry day.', 'Use the right detergent for the machine type and do not overload the drum.', 'Leave the door open after washing so it stays fresh.'],
  microwave: ['Heat, defrost and cook food in minutes.', 'Use microwave-safe dishes only, and never run it empty.', 'Wipe the inside after use.'],
  stabiliser: ['Protects your TV, fridge and air conditioner from low voltage, high voltage and power surges.', 'Plug the appliance into the stabiliser and the stabiliser into the wall; check the VA rating suits the appliance.', 'Keep it in a dry, ventilated place.'],
  dispenser: ['Hot and cold drinking water on tap at home or in the office.', 'Fit a sealed water bottle on top, then switch on the hot and cold switches.', 'Clean and sanitise it every 3 months.'],
  rice: ['Cooks up fluffy and separate, perfect for jollof, fried rice and everyday plain rice with stew.', 'Rinse two or three times, then cook with about 1½ cups of water per cup of rice until the water is absorbed. Rest for 5 minutes before serving.', 'Keep in a cool, dry place in a sealed container, away from moisture and insects.'],
  oil: ['A clean-tasting cooking oil for frying, stews and soups.', 'Use for frying, sautéing and baking. Do not reuse oil that has darkened or smells burnt.', 'Close the cap tightly and keep away from heat and direct sunlight.'],
  gari: ['Crisp, well-roasted gari for soakings, eba and gari foto.', 'Soak with cold water, sugar and groundnuts, or stir into hot water for eba.', 'Keep sealed and dry; once opened, store in an airtight container.'],
  sugar: ['Fine, clean sugar for tea, porridge, baking and drinks.', 'Use as needed for drinks, cooking and baking.', 'Store in a dry, airtight container to stop clumping and ants.'],
  noodles: ['Quick and filling, ready in minutes for breakfast, lunch or a late-night snack.', 'Cook in boiling water for about 3 minutes, add the seasoning and your favourite vegetables or egg.', 'Keep in a cool, dry place.'],
  flour: ['A kitchen basic for baking, porridge and swallows.', 'Follow your recipe; sift before baking for the best texture.', 'Keep sealed in a cool, dry place.'],
  milk: ['Rich and creamy for tea, coffee, porridge and baking.', 'Shake well before opening. Pour straight into tea, coffee or cereal.', 'Store unopened in a cool, dry place. Once opened, refrigerate and use within 2 days.'],
  fish: ['Ready to eat, rich in protein, great with bread, rice or kenkey.', 'Eat straight from the tin, or add to stews, sauces and salads.', 'Store unopened in a cool, dry place. Once opened, move to a covered container and refrigerate.'],
  tomato: ['Deep, rich tomato flavour for jollof, stews and soups.', 'Fry in hot oil for a few minutes before adding other ingredients to bring out the flavour.', 'Once opened, refrigerate in a covered container and use within a week.'],
  beans: ['Tasty and filling, ready in minutes.', 'Heat gently in a pan or eat cold with bread.', 'Once opened, refrigerate in a covered container.'],
  water: ['Clean, refreshing drinking water for home, work and on the go.', 'Best served chilled.', 'Store away from direct sunlight and strong smells.'],
  drink: ['A refreshing favourite for the family, parties and events.', 'Best served chilled.', 'Store in a cool place away from direct sunlight.'],
  detergent: ['Strong cleaning power for bright, fresh-smelling laundry by hand or machine.', 'Dissolve the recommended amount in water before adding clothes. Test coloured fabrics first.', 'Keep sealed, dry and out of reach of children.'],
  soap: ['Gentle, long-lasting soap for everyday washing.', 'Lather with water and rinse well.', 'Keep dry between uses so it lasts longer.'],
  cleaner: ['Cuts through dirt and germs around the home.', 'Follow the instructions on the label. Do not mix with other cleaning products.', 'Keep tightly closed and out of reach of children.'],
  freezer: ['Large, reliable cold storage for families, shops and chop bars.', 'Let it stand upright for 4 hours after delivery before switching on. Use a voltage stabiliser for best protection.', 'Keep at least 10 cm from the wall for good air flow.'],
  cooker: ['Cook faster and cleaner, with even heat for every pot.', 'Check gas connections with soapy water before first use. Never leave cooking unattended.', 'Keep the burners clean and dry.'],
  blender: ['Smooth soups, pepper, smoothies and juices in seconds.', 'Do not run empty. Add liquids first, then solids.', 'Wash the jug straight after use; never put the motor base in water.'],
  fan: ['Keeps rooms cool and comfortable through the hot season.', 'Place on a flat, stable surface; clean the blades regularly.', 'Unplug before cleaning.'],
  tv: ['Sharp picture and clear sound for movies, football and the news.', 'Use a surge protector. Connect to Wi-Fi to stream your favourite apps.', 'Clean the screen with a soft dry cloth only.'],
  phone: ['Stay connected with a fast, reliable device.', 'Charge fully before first use.', 'Use a case and screen protector.'],
  staples: ['An everyday kitchen staple.', 'Use as needed in your favourite recipes.', 'Keep in a cool, dry place.'],
  tins: ['Long shelf life, always ready in the cupboard.', 'Open and use as needed.', 'Once opened, refrigerate in a covered container.'],
  drinks: ['A refreshing drink for any time of day.', 'Best served chilled.', 'Store in a cool place.'],
  household: ['A household essential that keeps the home clean and fresh.', 'Follow the instructions on the label.', 'Keep out of reach of children.'],
  appliances: ['A dependable appliance for the modern Ghanaian home.', 'Read the manual before first use and use a voltage stabiliser.', 'Keep clean and dry.'],
  electronics: ['Reliable electronics from trusted brands.', 'Use a surge protector.', 'Keep away from water and heat.'],
};
/** Category names (lower case) → the tips above, for products whose name does not say what they are. */
const CAT_KIND: Record<string, string> = {
  'tv': 'tv', 'fridge': 'fridge', 'air conditioner': 'aircon', 'freezer': 'freezer', 'fan': 'fan', 'dstv & gotv': 'decoder', 'sound & home theatre': 'sound',
  'washing machine': 'washer', 'microwave': 'microwave', 'stabiliser & power': 'stabiliser', 'water dispenser': 'dispenser',
};

/** A natural word for the opening line ("a kitchen favourite", not "a staples favourite"). */
const NOUN: Record<string, string> = { tv: 'home entertainment', fridge: 'kitchen', 'air conditioner': 'home', freezer: 'kitchen', fan: 'home', 'dstv & gotv': 'family entertainment', 'sound & home theatre': 'home entertainment', 'washing machine': 'household', microwave: 'kitchen', 'stabiliser & power': 'household', 'water dispenser': 'home', staples: 'kitchen', tins: 'pantry', drinks: 'family', household: 'household', appliances: 'home', electronics: 'home', services: 'customer' };
const cedis = (n: number) => 'GHS ' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Draft a full, Shopify-style description in the shared format (see the top of this file).
 * Input: what is known about the product. Output: the description text, ready to edit.
 */
export function writeDescription(i: DescInput): string {
  const name = i.name.trim() || 'This product'; const cat = i.cat || 'Product';
  const kind = kindOf(name, cat); const tips = TIPS[kind] || TIPS[CAT_KIND[cat.toLowerCase()] || ''] || TIPS[cat.toLowerCase()] || ['A quality product at a fair price.', 'Use as directed on the pack.', 'Keep in a cool, dry place.'];
  const size = i.size || sizeOf(name);
  // Big-ticket items (warranty, hire purchase): appliances and electronics, but not monthly subscriptions or small accessories.
  const big = !/subscription/i.test(name) && (/appliances|electronics|^tv$|fridge|air conditioner|freezer|washing|sound/i.test(cat) || (i.price ?? 0) >= 1000);
  const biz = i.biz || 'our shop';
  const parts = (i.features || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const extraSpecs = parts.map((s) => /^([^:]{2,32}):\s*(.+)$/.exec(s)).filter(Boolean).map((m) => [m![1].trim(), m![2].trim()] as [string, string]);
  const extraPoints = parts.filter((s) => !/^[^:]{2,32}:\s*.+$/.test(s)).map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  // Opening paragraph, in the chosen tone.
  const who = i.audience ? ` Ideal for ${i.audience}.` : '';
  const open = i.tone === 'Premium' ? `Discover ${name}: carefully chosen quality you can taste and trust. ${tips[0]}${who}`
    : i.tone === 'Simple' ? `${name}${size ? `, ${size}` : ''}. ${tips[0]}${who}`
    : `Meet ${name}, a ${NOUN[cat.toLowerCase()] || 'customer'} favourite across Ghana. ${tips[0]}${who}`;
  const second = big
    ? `Buy it from ${biz} with genuine manufacturer warranty, delivery to your door in Accra and Kumasi, and hire purchase available in store with your Ghana Card.`
    : `Order online for same-day delivery in Accra and Kumasi or collect it from your nearest branch${i.ctSize ? `, and save when you buy by the ${(i.ctLabel || 'carton').toLowerCase()}` : ''}.`;

  // Highlights: what staff typed first, then the useful facts.
  const points = [...extraPoints,
    ...(size ? [`${size} ${i.byWeight ? 'per pack' : 'pack'}`] : []),
    ...(i.byWeight ? ['Sold by weight: pay only for what you need'] : []),
    ...(i.ctSize ? [`Also sold as a ${(i.ctLabel || 'carton').toLowerCase()} of ${i.ctSize} at a lower price per piece`] : []),
    ...(big ? ['Genuine product with manufacturer warranty', 'Hire purchase available in store'] : ['Quality checked and stored properly at every branch']),
    'Same-day delivery in Accra and Kumasi, or click & collect'].slice(0, 6);

  // Specification table.
  const specs: [string, string][] = [['Category', cat], ...(size ? [['Pack size', size] as [string, string]] : []),
    ['Sold as', i.byWeight ? 'By weight (per kg)' : i.ctSize ? `Single, or ${(i.ctLabel || 'carton').toLowerCase()} of ${i.ctSize}` : 'Single'],
    ...(i.price ? [['Price', `${cedis(i.price)}${i.byWeight ? ' per kg' : ''}`] as [string, string]] : []),
    ...extraSpecs,
    ...(big ? [['Warranty', 'Manufacturer warranty · keep your receipt'] as [string, string]] : [])];

  return [
    open, '', second, '',
    '## Highlights', ...points.map((p) => `- ${p}`), '',
    '## Specifications', ...specs.map(([k, v]) => `- ${k}: ${v}`), '',
    `## ${big ? 'Set-up and use' : 'How to use'}`, tips[1], '',
    `## ${big ? 'Care' : 'Storage'}`, tips[2],
  ].join('\n');
}

/** Google title (≤ 60 characters) and description (≤ 155) from a product and its description. */
export function seoOf(name: string, desc: string, price?: number) {
  return { title: `${name} | Buy online in Ghana`.slice(0, 60), desc: `${price ? `${name} at ${cedis(price)}. ` : ''}${plainText(desc)}`.slice(0, 155).replace(/\s+\S*$/, '') };
}

/** A product as far as descriptions are concerned (matches data/catalogue Product). */
type DescProduct = { name: string; cat: string; desc?: string; price?: number; carton?: number; ctSize?: number; ctLabel?: string; byWeight?: boolean };
/** True for an empty description or the one-line text new demo products start with ("… Available at every branch and online."). */
export const isStubDesc = (p: DescProduct) => { const t = String(p.desc || '').trim(); return !t || t === `${p.name}. Available at every branch and online.` || t.length < 25; };
/**
 * The description to show for a product, the same in the POS and on the online store: the product's own description;
 * for a product that still has no real one, an older online-only text if there is one, else a generated draft so every
 * product page looks complete. Staff can replace it any time in Products → Edit → Details.
 */
export function shownDesc(p: DescProduct, onlineOld = '', biz = ''): string {
  if (!isStubDesc(p)) return String(p.desc).trim();
  if (onlineOld.trim() && onlineOld.trim() !== String(p.desc || '').trim()) return onlineOld.trim();
  return writeDescription({ name: p.name, cat: p.cat, price: p.price, ctSize: p.carton ? p.ctSize || 12 : undefined, ctLabel: p.ctLabel, byWeight: p.byWeight, biz });
}
