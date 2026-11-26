// Sample data drawn from the prototype's seeded records.
export type Product = { name: string; cat: string; sku: string; price: number; cost: number; stock: number; tone: string };

export const PRODUCTS: Product[] = [
  { name: 'TCL 43" 4K UHD Google TV', cat: 'TV', sku: 'TV-1001', price: 4999, cost: 4000, stock: 18, tone: '#e4e7ef' },
  { name: 'TCL 55" QLED Google TV', cat: 'TV', sku: 'TV-1002', price: 8999, cost: 7200, stock: 10, tone: '#e4e7ef' },
  { name: 'Nasco 32" HD LED TV', cat: 'TV', sku: 'TV-1003', price: 1850, cost: 1480, stock: 14, tone: '#e4e7ef' },
  { name: 'Nasco 43" Smart Android TV', cat: 'TV', sku: 'TV-1004', price: 3499, cost: 2800, stock: 22, tone: '#e4e7ef' },
  { name: 'Samsung 55" Crystal UHD 4K Smart TV', cat: 'TV', sku: 'TV-1005', price: 9499, cost: 7600, stock: 9, tone: '#e4e7ef' },
  { name: 'LG 50" UHD 4K Smart TV', cat: 'TV', sku: 'TV-1006', price: 7499, cost: 6000, stock: 8, tone: '#e4e7ef' },
  { name: 'TCL 252L Double-Door Fridge', cat: 'Fridge', sku: 'FRG-2001', price: 6499, cost: 5200, stock: 9, tone: '#e3f2fd' },
  { name: 'Nasco 138L Single-Door Fridge', cat: 'Fridge', sku: 'FRG-2002', price: 2899, cost: 2320, stock: 18, tone: '#e3f2fd' },
  { name: 'Samsung 384L Twin Cooling Fridge', cat: 'Fridge', sku: 'FRG-2003', price: 11999, cost: 9600, stock: 5, tone: '#e3f2fd' },
  { name: 'TCL 1.5HP Inverter Split AC', cat: 'Air Conditioner', sku: 'AC-3001', price: 6999, cost: 5600, stock: 14, tone: '#e1f5fe' },
  { name: 'Nasco 1.5HP Split AC', cat: 'Air Conditioner', sku: 'AC-3002', price: 5299, cost: 4240, stock: 15, tone: '#e1f5fe' },
  { name: 'Samsung 1.5HP WindFree AC', cat: 'Air Conditioner', sku: 'AC-3003', price: 9999, cost: 8000, stock: 6, tone: '#e1f5fe' },
  { name: 'Bruhm 300L Chest Freezer', cat: 'Freezer', sku: 'FRZ-4001', price: 5499, cost: 4400, stock: 7, tone: '#ede7f6' },
  { name: 'Binatone 16" Standing Fan', cat: 'Fan', sku: 'FAN-5001', price: 450, cost: 360, stock: 33, tone: '#fff3e0' },
  { name: 'Nasco 18" Wall Fan', cat: 'Fan', sku: 'FAN-5002', price: 520, cost: 416, stock: 3, tone: '#fff3e0' },
  { name: 'DStv HD Decoder & Dish Kit', cat: 'DStv & GOtv', sku: 'DSTV-6001', price: 899, cost: 720, stock: 25, tone: '#e8eaf6' },
];

export const ORDERS = [
  { id: 'S-1042', ch: 'Till · Osu', pay: 'MoMo', total: 450, status: 'Paid', when: '09:42' },
  { id: 'W-2311', ch: 'Website', pay: 'Card', total: 1850, status: 'On the way', when: '09:30' },
  { id: 'S-1041', ch: 'Till · East Legon', pay: 'Card', total: 236, status: 'Paid', when: '09:18' },
  { id: 'W-2310', ch: 'Website · pickup', pay: 'MoMo', total: 3650, status: 'Waiting', when: '08:55' },
  { id: 'S-1040', ch: 'Till · Adum', pay: 'Cash', total: 92, status: 'Paid', when: '08:41' },
  { id: 'HP-0087', ch: 'Hire purchase', pay: 'Deposit', total: 1440, status: 'Active', when: '08:20' },
];

export const PAY_METHODS = [
  { id: 'cash', label: 'Cash', icon: 'cash' },
  { id: 'mtn', label: 'MTN MoMo', icon: 'phone' },
  { id: 'telecel', label: 'Telecel Cash', icon: 'phone' },
  { id: 'at', label: 'AirtelTigo Money', icon: 'phone' },
  { id: 'card', label: 'Card', icon: 'card' },
  { id: 'bank', label: 'Bank transfer', icon: 'bank' },
  { id: 'credit', label: 'Credit', icon: 'credit' },
  { id: 'hp', label: 'Hire purchase', icon: 'hirepurchase' },
];
