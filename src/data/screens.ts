// One entry per prototype artboard not built as a bespoke page.
// Titles, subtitles and section names follow the prototype's headings.
export type Screen = {
  title: string;
  sub: string;
  icon: string;
  navGroup?: string; // nav group whose items become tabs
  kpis: [string, string, string?][];
  table: { title: string; cols: string[]; rows: string[][] };
  sections: { title: string; items: [string, string][] }[];
  primary?: string;
};

export const SCREENS: Record<string, Screen> = {
  mysales: {
    title: 'My sales', sub: 'Everything you sold on your till, by period.', icon: 'mysales', primary: 'Print my sales',
    kpis: [['Sales today', 'GHS 4,280', '38 sales'], ['Average sale', 'GHS 112.60'], ['Returns', 'GHS 0.00'], ['Items sold', '96']],
    table: { title: 'Every sale in this period', cols: ['Sale', 'Time', 'Customer', 'Paid by', 'Total', 'Status'], rows: [['S-1042', '09:42', 'Walk-in', 'MTN MoMo', 'GHS 450.00', 'Paid'], ['S-1039', '09:05', 'Esi Mensah', 'Cash', 'GHS 236.00', 'Paid'], ['S-1036', '08:31', 'Walk-in', 'Card', 'GHS 92.00', 'Paid'], ['S-1031', '08:02', 'Kojo Badu', 'Credit', 'GHS 1,850.00', 'Owing']] },
    sections: [{ title: 'How customers paid', items: [['Cash', 'GHS 1,420'], ['MTN MoMo', 'GHS 1,910'], ['Card', 'GHS 620'], ['Telecel Cash', 'GHS 330']] }, { title: 'What I sold most', items: [['Binatone 16" Standing Fan', '9'], ['GOtv Supa+ Decoder', '6'], ['TCL 43" 4K UHD Google TV', '3']] }],
  },
  proforma: {
    title: 'Pro-forma invoices', sub: 'Quotes customers can accept, then turn into a sale.', icon: 'proforma', primary: 'New pro-forma',
    kpis: [['Open quotes', '7'], ['Value open', 'GHS 48,900'], ['Accepted this month', '12'], ['Expiring this week', '2']],
    table: { title: 'Every receipt and invoice', cols: ['No.', 'Customer', 'Date', 'Valid until', 'Total', 'Status'], rows: [['PF-0231', 'Accra Royal School', '18 Nov', '2 Dec', 'GHS 21,400.00', 'Open'], ['PF-0230', 'Kwesi Owusu', '17 Nov', '1 Dec', 'GHS 3,650.00', 'Approved'], ['PF-0228', 'Grace Church Osu', '12 Nov', '26 Nov', 'GHS 9,800.00', 'Open']] },
    sections: [{ title: 'Upload an invoice', items: [['Scan or photo', 'Read lines automatically'], ['PDF', 'Up to 10 MB']] }, { title: 'Deleted invoices · restorable', items: [['PF-0219', 'Deleted 3 days ago']] }],
  },
  hirepurchase: {
    title: 'Hire purchase', sub: 'Instalment credit agreements, reminders and ownership terms.', icon: 'hirepurchase', primary: 'New agreement',
    kpis: [['Active agreements', '64'], ['Owed to you', 'GHS 182,400'], ['Due this week', 'GHS 12,950', '23 instalments'], ['In arrears', '5', 'GHS 7,820']],
    table: { title: 'Agreements', cols: ['Agreement', 'Customer', 'Item', 'Paid', 'Balance', 'Status'], rows: [['HP-0087', 'Yaw Mensah', 'Samsung 55" 4K TV', 'GHS 1,440', 'GHS 6,480', 'Active'], ['HP-0081', 'Abena Ofori', 'Nasco Fridge 138 L', 'GHS 2,200', 'GHS 1,240', 'Active'], ['HP-0074', 'Kofi Boateng', 'TCL 1.5HP Inverter AC', 'GHS 1,750', 'GHS 5,600', 'Overdue']] },
    sections: [{ title: 'HP charge (flat rate)', items: [['Flat rate', '18% over the term'], ['Minimum deposit', '20%']] }, { title: 'Automatic reminders', items: [['3 days before due', 'SMS & WhatsApp'], ['On due date', 'SMS'], ['7 days late', 'Call list']] }, { title: 'Late payment & default', items: [['Grace period', '7 days'], ['Late fee', '2% per month']] }],
  },
  customers: {
    title: 'Customers', sub: 'Records, loyalty points, credit and reminders.', icon: 'customers', primary: 'Add customer',
    kpis: [['Customers', '3,418'], ['New this month', '142'], ['Loyalty members', '1,206'], ['Owing on credit', 'GHS 14,320']],
    table: { title: 'All customers', cols: ['Name', 'Phone', 'Branch', 'Points', 'Spent', 'Status'], rows: [['Esi Mensah', '024 555 0192', 'Osu', '1,240', 'GHS 12,400', 'Active'], ['Kojo Badu', '020 811 4410', 'East Legon', '380', 'GHS 3,800', 'Owing'], ['Adwoa Asare', '055 302 7781', 'Adum', '2,050', 'GHS 20,500', 'Active']] },
    sections: [{ title: 'Loyalty programme', items: [['Earn', '1 point per GHS 10'], ['Redeem', '100 points = GHS 10']] }, { title: 'Automations', items: [['Birthday offer', 'On'], ['We miss you (60 days)', 'On'], ['Credit reminder', 'On']] }],
  },
  messages: {
    title: 'SMS & email', sub: 'Receipts, offers and updates to customers and staff.', icon: 'messages', primary: 'Write a message',
    kpis: [['Sent this month', '8,420'], ['Delivered', '98.6%'], ['SMS credit', '12,300'], ['WhatsApp', 'Connected']],
    table: { title: 'Recent messages', cols: ['Message', 'Channel', 'To', 'Sent', 'Status'], rows: [['Black Friday at every branch', 'SMS', '3,102 customers', '18 Nov', 'Delivered'], ['Receipt S-1042', 'WhatsApp', '024 555 0192', 'Today', 'Delivered'], ['Instalment reminder', 'SMS', '23 customers', 'Today', 'Pending']] },
    sections: [{ title: 'Automatic notifications', items: [['Receipts', 'SMS & WhatsApp'], ['Delivery updates', 'SMS'], ['Refund steps', 'SMS']] }, { title: 'Occasions & holidays', items: [['Farmers’ Day', '5 Dec'], ['Christmas', '25 Dec']] }],
  },
  collect: {
    title: 'Collect orders', sub: 'Website pickups matched by code at the counter.', icon: 'collect', primary: 'Customer at the counter?',
    kpis: [['Waiting for pickup', '2'], ['Collected today', '9'], ['Overdue (48 h+)', '0'], ['Paid online', '100%']],
    table: { title: 'Waiting at this branch', cols: ['Order', 'Customer', 'Branch', 'Items', 'Placed', 'Status'], rows: [['#34422885', 'Akosua Frimpong', 'Osu, Accra', '3', 'Today 08:12', 'Waiting'], ['#34375371', 'Nana Yeboah', 'Osu, Accra', '1', 'Yesterday', 'Waiting']] },
    sections: [{ title: 'How it works', items: [['1', 'Ask for the 8-digit order code'], ['2', 'Check ID matches the name'], ['3', 'Hand over and mark collected']] }],
  },
  sales: {
    title: 'Sales & returns', sub: 'Returns, exchanges, shifts and cash-up.', icon: 'sales', primary: 'New return or exchange',
    kpis: [['Sales today', 'GHS 18,420'], ['Returns today', 'GHS 236', '2 returns'], ['Open shifts', '4'], ['Cash variance', 'GHS 0.00']],
    table: { title: 'Returns & exchanges', cols: ['Return', 'Sale', 'Item', 'Reason', 'Refund', 'Status'], rows: [['R-0112', 'S-1022', 'Nasco 18" Wall Fan', 'Faulty motor', 'GHS 520.00', 'Approved'], ['R-0111', 'S-1009', 'Binatone 16" Standing Fan', 'Wrong size', 'Exchange', 'Pending']] },
    sections: [{ title: 'Close shift · Till 1 · Akua Kyei', items: [['Expected cash', 'GHS 1,420.00'], ['Counted', '—']] }, { title: 'Cash-up', items: [['Tills closed', '0 of 4'], ['Last cash-up', 'Yesterday 21:04']] }],
  },
  orders: {
    title: 'Orders', sub: 'Every channel: website, WhatsApp, phone and marketplace.', icon: 'orders', primary: 'New order',
    kpis: [['Open orders', '6'], ['Out for delivery', '3'], ['Delivered today', '14'], ['Refunds pending', '1']],
    table: { title: 'Orders & fulfilment', cols: ['Order', 'Channel', 'Customer', 'Delivery', 'Total', 'Status'], rows: [['W-2311', 'Website', 'Efua Amoah', 'Rider · Kwesi', 'GHS 1,850.00', 'On the way'], ['W-2310', 'Website', 'Nana Yeboah', 'Pickup · Osu', 'GHS 3,650.00', 'Waiting'], ['W-2307', 'WhatsApp', 'Kwame Ntim', 'Rider · Yaw', 'GHS 412.00', 'Delivered']] },
    sections: [{ title: 'Delivery zones & rates', items: [['Osu, Labone, Cantonments', 'GHS 25'], ['East Legon, Madina', 'GHS 35'], ['Kumasi central', 'GHS 30']] }, { title: 'Refunds for cancelled online orders', items: [['W-2298', 'GHS 236 · MoMo']] }],
  },
  invoices: {
    title: 'Invoices & Receipts', sub: 'Invoice sheet, saved invoices and uploads, with PAID stamp.', icon: 'invoices', primary: 'New invoice',
    kpis: [['Unpaid invoices', '2', 'GHS 9,240'], ['Paid this month', '48'], ['Overdue', '1'], ['Uploaded', '6']],
    table: { title: 'Saved invoices', cols: ['Invoice', 'Customer', 'Date', 'Due', 'Total', 'Status'], rows: [['INV-0418', 'Accra Royal School', '15 Nov', '29 Nov', 'GHS 7,200.00', 'Pending'], ['INV-0417', 'Mercy Hospital', '10 Nov', '17 Nov', 'GHS 2,040.00', 'Overdue'], ['INV-0415', 'Kwesi Owusu', '8 Nov', '8 Nov', 'GHS 3,650.00', 'Paid']] },
    sections: [{ title: 'Upload an invoice', items: [['Photo or PDF', 'Lines read for you']] }, { title: 'Deleted invoices · restorable', items: [['INV-0402', 'Deleted 5 days ago']] }],
  },
  products: {
    title: 'Products', sub: 'Catalogue for the till and the online shop.', icon: 'products', primary: 'Add product',
    kpis: [['Products', '1,284'], ['Live online', '936'], ['Waiting for approval', '3'], ['No barcode', '18']],
    table: { title: 'Products & catalogue', cols: ['Product', 'SKU', 'Category', 'Price', 'Stock', 'Status'], rows: [['Hisense 43" Smart VIDAA TV', 'SKU-P16', 'TV', 'GHS 3,650.00', '62', 'Live'], ['TCL 252L Double-Door Fridge', 'SKU-P6', 'Fridge', 'GHS 6,499.00', '58', 'Live'], ['Nasco 1.5HP Split Air Conditioner', 'SKU-P11', 'Air Conditioner', 'GHS 5,299.00', '61', 'Live']] },
    sections: [{ title: 'Scan product barcode', items: [['Camera or scanner', 'Finds or creates the product']] }],
  },
  categories: {
    title: 'Categories', sub: 'Group products for the till, reports and online shop.', icon: 'categories', primary: 'Add category',
    kpis: [['Categories', '24'], ['Sub-categories', '61'], ['Empty', '2'], ['Shown online', '19']],
    table: { title: 'All categories', cols: ['Category', 'Products', 'Sub-categories', 'Online', 'Status'], rows: [['TV', '43', '0', 'Yes', 'Active'], ['Fridge', '26', '0', 'Yes', 'Active'], ['Air Conditioner', '23', '0', 'Yes', 'Active']] },
    sections: [],
  },
  inventory: {
    title: 'Inventory', sub: 'Stock levels, counts, rules and shrinkage.', icon: 'inventory', primary: 'Start a stock count',
    kpis: [['Stock value', 'GHS 1.24m'], ['Low stock', '4'], ['Out of stock', '1'], ['Shrinkage this month', '0.4%']],
    table: { title: 'Stock by product', cols: ['Product', 'Osu', 'East Legon', 'Adum', 'Total', 'Status'], rows: [['Nasco 18" Wall Fan', '1', '2', '0', '3', 'Low'], ['Samsung 384L Twin Cooling Fridge', '2', '2', '1', '5', 'Low'], ['Midea 2HP Split AC', '3', '2', '2', '7', 'Active'], ['TCL 43" 4K UHD Google TV', '8', '4', '6', '18', 'Active']] },
    sections: [{ title: 'Stock rules', items: [['Low stock alert', 'Below 5 units'], ['Reorder suggestion', 'Weekly']] }, { title: 'Shrinkage this month', items: [['Damaged', 'GHS 840'], ['Missing at count', 'GHS 310']] }],
  },
  warehouse: {
    title: 'Warehouse & transfers', sub: 'Stock in the warehouse and every branch, and moves between them.', icon: 'warehouse', primary: 'New transfer',
    kpis: [['In the warehouse', 'GHS 620,400'], ['On the move', '2'], ['Waiting to receive', '1'], ['Deliveries this week', '5']],
    table: { title: 'On the move & waiting', cols: ['Transfer', 'From', 'To', 'Items', 'Sent', 'Status'], rows: [['TR-0091', 'Warehouse', 'Adum', '48', 'Today', 'In transit'], ['TR-0090', 'Warehouse', 'Osu', '22', 'Yesterday', 'Pending'], ['TR-0088', 'East Legon', 'Osu', '6', '16 Nov', 'Completed']] },
    sections: [{ title: '✨ Smart stock suggestions', items: [['Move 5 × Nasco 18" Wall Fan', 'Osu → Adum'], ['Reorder Samsung fridges', 'Supplier: Samsung Electronics WA']] }, { title: 'Deliveries received', items: [['GRN-0311', 'Samsung Electronics WA · 17 Nov']] }],
  },
  damages: {
    title: 'Damages & suppliers', sub: 'Record and track losses, and claim back from suppliers.', icon: 'damages', primary: 'Report a damaged item',
    kpis: [['Damages this month', 'GHS 840'], ['Needs action', '2'], ['Claimed from suppliers', 'GHS 520'], ['Written off', 'GHS 320']],
    table: { title: 'Needs action', cols: ['Ref', 'Item', 'Branch', 'Qty', 'Liable', 'Status'], rows: [['DM-0044', 'Evaporated Milk 410 g', 'Osu', '2', 'Supplier', 'Pending'], ['DM-0043', 'Nasco 32" TV (cracked)', 'Adum', '1', 'Transport', 'Open']] },
    sections: [{ title: '✨ Damage intelligence', items: [['Most damaged', 'TV screens · transit'], ['Worst supplier', 'None flagged']] }, { title: 'Suppliers & damage terms', items: [['TCL Ghana', 'Repair or replace under warranty'], ['Nasco', 'Replace on proof']] }],
  },
  contracts: {
    title: 'Contracts', sub: 'Subcontracting payments due vs paid.', icon: 'contracts', primary: 'Record payment',
    kpis: [['Contract value 2026', 'GHS 240,000'], ['Paid', 'GHS 180,000'], ['Arrears', 'GHS 20,000'], ['Documents', '14']],
    table: { title: 'Months · 2026', cols: ['Month', 'Due', 'Paid', 'Balance', 'Status'], rows: [['September', 'GHS 20,000', 'GHS 20,000', 'GHS 0', 'Paid'], ['October', 'GHS 20,000', 'GHS 20,000', 'GHS 0', 'Paid'], ['November', 'GHS 20,000', 'GHS 0', 'GHS 20,000', 'Pending']] },
    sections: [{ title: 'Document register', items: [['Main agreement', 'Signed Jan 2026'], ['Oct payment proof', 'Uploaded']] }],
  },
  reports: {
    title: 'Reports', sub: 'Live sales, profit and trends. Generate, snapshot or build your own.', icon: 'reports', navGroup: 'Reports', primary: 'Generate a report',
    kpis: [['Sales this month', 'GHS 412,800', '▲ 9%'], ['Profit this month', 'GHS 96,300'], ['Online share', '22%'], ['Top branch', 'Osu']],
    table: { title: 'Sales by channel', cols: ['Channel', 'Orders', 'Sales', 'Share'], rows: [['Till', '3,920', 'GHS 322,000', '78%'], ['Website', '640', 'GHS 74,300', '18%'], ['WhatsApp', '110', 'GHS 16,500', '4%']] },
    sections: [{ title: 'Takings by payment method', items: [['MTN MoMo', '41%'], ['Cash', '33%'], ['Card', '14%'], ['Telecel / AirtelTigo', '8%'], ['Bank transfer', '4%']] }, { title: 'Pick a report', items: [['End-of-day', 'Daily'], ['Stock valuation', 'Any date'], ['VAT return', 'Monthly']] }],
  },
  finance: {
    title: 'Finance', sub: 'Cash-up, bank deposits, money movements, refunds and accounts.', icon: 'finance', navGroup: 'Finance', primary: 'Count the drawer',
    kpis: [['Takings today', 'GHS 18,420'], ['Overdue for the bank', 'GHS 6,200'], ['Deposits to confirm', '2'], ['Banks, wallets & safe', 'GHS 184,300']],
    table: { title: 'Every branch today', cols: ['Branch', 'Takings', 'Cash', 'MoMo', 'Banked', 'Status'], rows: [['Osu', 'GHS 8,470', 'GHS 2,900', 'GHS 4,100', 'GHS 0', 'Pending'], ['East Legon', 'GHS 6,080', 'GHS 1,800', 'GHS 3,300', 'GHS 6,200', 'Approved'], ['Adum', 'GHS 3,870', 'GHS 1,400', 'GHS 1,900', 'GHS 0', 'Overdue']] },
    sections: [{ title: 'Finance assistant', items: [['Why is Adum overdue?', 'Cash not banked for 2 days'], ['Best day this week', 'Saturday · GHS 24,100']] }, { title: 'Deposits', items: [['DEP-0201', 'GHS 6,200 · GCB'], ['DEP-0200', 'GHS 4,800 · Ecobank']] }],
  },
  suppliers: {
    title: 'Supplier account', sub: 'Goods in, new products, damages out and claims.', icon: 'suppliers', navGroup: 'Suppliers', primary: 'Record a delivery',
    kpis: [['Suppliers', '38'], ['Owed to suppliers', 'GHS 64,200'], ['Open claims', '2'], ['Deliveries this month', '21']],
    table: { title: 'Supplier details', cols: ['Supplier', 'Contact', 'Terms', 'Owed', 'Status'], rows: [['Samsung Electronics West Africa', 'Efua Kumi', '30 days', 'GHS 18,400', 'Active'], ['Nasco Electronics', 'Kwame Osei', '45 days', 'GHS 32,100', 'Active'], ['TCL Electronics Ghana', 'Kofi Boateng', '30 days', 'GHS 13,700', 'Active']] },
    sections: [{ title: 'Supplier claims', items: [['CL-0019', 'TCL · GHS 4,999'], ['CL-0018', 'Nasco · GHS 200']] }],
  },
  expenses: {
    title: 'Expenses', sub: 'Track every cedi spent, with approvals and budgets.', icon: 'expenses', navGroup: 'Expenses', primary: 'New expense',
    kpis: [['This month', 'GHS 28,400'], ['Waiting for you', '3'], ['Petty cash left', 'GHS 1,250'], ['Over budget', '1 category']],
    table: { title: 'All expenses', cols: ['Ref', 'What', 'Branch', 'By', 'Amount', 'Status'], rows: [['EX-0388', 'Generator fuel', 'East Legon', 'Efua Sarpong', 'GHS 640.00', 'Pending'], ['EX-0387', 'Cleaning supplies', 'Osu', 'Ama Darko', 'GHS 180.00', 'Approved'], ['EX-0385', 'ECG prepaid', 'Adum', 'Yaw Boakye', 'GHS 900.00', 'Approved']] },
    sections: [{ title: 'Where the money went', items: [['Utilities', '34%'], ['Transport', '22%'], ['Repairs', '18%']] }, { title: 'Flagged by the assistant', items: [['Fuel up 40% at East Legon', 'Check generator hours']] }],
  },
  web: {
    title: 'Post to online', sub: 'Store updates, descriptions, pages, SEO and delivery charges.', icon: 'web:updates', navGroup: 'Post to webstore', primary: 'Post an update',
    kpis: [['Visitors this week', '4,812'], ['Products online', '936'], ['Reviews to answer', '3'], ['Active codes', '4']],
    table: { title: 'Your discount codes', cols: ['Code', 'Offer', 'Used', 'Ends', 'Status'], rows: [['BLACKFRI', '15% off electronics', '212', '30 Nov', 'Live'], ['WELCOME10', 'GHS 10 off first order', '1,044', '—', 'Live'], ['XMAS26', '10% off', '0', '26 Dec', 'Pending']] },
    sections: [{ title: 'Posted updates', items: [['New Samsung TVs in store', '2 days ago'], ['Adum branch opens Sundays', '1 week ago']] }, { title: 'Show or hide store pages', items: [['About us', 'Shown'], ['Job adverts', 'Shown'], ['FAQs', 'Shown']] }],
  },
  marketing: {
    title: 'Marketing & sales channels', sub: 'Promotions and campaigns for the till and the website.', icon: 'marketing', primary: 'New campaign',
    kpis: [['Active campaigns', '3'], ['Promotions live', '5'], ['Campaign sales', 'GHS 38,200'], ['Channels', '4']],
    table: { title: 'Campaigns', cols: ['Campaign', 'Channel', 'Audience', 'Sales', 'Status'], rows: [['Black Friday', 'SMS + Web', '3,102', 'GHS 21,400', 'Live'], ['Back to school', 'WhatsApp', '840', 'GHS 9,800', 'Completed'], ['Christmas hampers', 'SMS', '2,500', '—', 'Pending']] },
    sections: [{ title: 'Promotions (till and website)', items: [['Free wall mounting with TVs 43"+', 'Live'], ['10% off fans', 'Live']] }, { title: 'Sell on other channels', items: [['Jumia', 'Connected'], ['Tonaton', 'Not connected']] }],
  },
  staff: {
    title: 'People & HR', sub: 'Sign-in, ID cards, payslips, leave and headcount.', icon: 'staff', primary: 'Add staff member',
    kpis: [['Headcount', '46'], ['On shift now', '18'], ['Leave requests', '1'], ['Late today', '2']],
    table: { title: 'Team', cols: ['Name', 'Role', 'Branch', 'Signed in', 'Status'], rows: [['Ama Darko', 'Manager', 'Osu', '07:52', 'Active'], ['Kwame Asante', 'Supervisor', 'Osu', '07:58', 'Active'], ['Akua Kyei', 'Sales staff', 'Osu', '08:14', 'Active'], ['Yaw Boakye', 'Manager', 'Adum', '—', 'Pending']] },
    sections: [{ title: 'My leave', items: [['Annual leave left', '14 days'], ['Next leave', '23 Dec – 2 Jan']] }, { title: 'Payroll summary', items: [['November gross', 'GHS 92,400'], ['SSNIT', 'GHS 12,012']] }],
  },
  payroll: {
    title: 'Store payroll', sub: 'Salaries, SSNIT, PAYE and payslips.', icon: 'payroll', primary: 'Run payroll',
    kpis: [['Gross pay (Nov)', 'GHS 92,400'], ['SSNIT 13.5%', 'GHS 12,474'], ['PAYE', 'GHS 8,960'], ['Net pay', 'GHS 70,966']],
    table: { title: 'November payslips', cols: ['Staff', 'Gross', 'SSNIT', 'PAYE', 'Net', 'Status'], rows: [['Ama Darko', 'GHS 4,800', 'GHS 264', 'GHS 612', 'GHS 3,924', 'Pending'], ['Kwame Asante', 'GHS 3,200', 'GHS 176', 'GHS 348', 'GHS 2,676', 'Pending'], ['Akua Kyei', 'GHS 2,100', 'GHS 116', 'GHS 156', 'GHS 1,828', 'Pending']] },
    sections: [],
  },
  hospitality: {
    title: 'Hospitality add-on', sub: 'Adom Café · floor plan and kitchen display.', icon: 'hospitality', primary: 'Open a table',
    kpis: [['Tables in use', '7 of 12'], ['Orders in kitchen', '5'], ['Average wait', '11 min'], ['Covers today', '64']],
    table: { title: 'Kitchen display', cols: ['Ticket', 'Table', 'Items', 'Waiting', 'Status'], rows: [['K-221', 'T4', 'Jollof ×2, Kelewele', '6 min', 'Open'], ['K-220', 'T9', 'Banku & tilapia', '12 min', 'Pending'], ['K-219', 'T2', 'Waakye', '15 min', 'Completed']] },
    sections: [],
  },
  branches: {
    title: 'Branches', sub: 'Every branch, one login.', icon: 'branches', navGroup: 'Branches', primary: 'Request a new branch',
    kpis: [['Branches', '3'], ['Staff', '46'], ['Sales today', 'GHS 18,420'], ['Best today', 'Osu']],
    table: { title: 'Branch list', cols: ['Branch', 'City', 'Manager', 'Tills', 'Sales today', 'Status'], rows: [['Osu branch', 'Accra', 'Ama Darko', '4', 'GHS 8,470', 'Active'], ['East Legon branch', 'Accra', 'Efua Sarpong', '3', 'GHS 6,080', 'Active'], ['Adum branch', 'Kumasi', 'Yaw Boakye', '2', 'GHS 3,870', 'Active']] },
    sections: [],
  },
  approvals: {
    title: 'Approvals & issues', sub: 'Discounts, voids, credit sales and sign-off.', icon: 'approvals', primary: 'Report an issue',
    kpis: [['Waiting for you', '5'], ['Approved today', '11'], ['Rejected today', '1'], ['Open issues', '2']],
    table: { title: 'Discount requests from the tills', cols: ['Request', 'Till', 'Item', 'Asked', 'By', 'Status'], rows: [['DR-0141', 'Osu · Till 2', 'Hisense 43" TV', '15%', 'Akua Kyei', 'Pending'], ['DR-0140', 'Adum · Till 1', 'Nasco 18" Wall Fan ×5', 'GHS 700', 'Kofi Antwi', 'Pending'], ['CS-0033', 'East Legon', 'Credit sale GHS 1,850', '—', 'Efua Sarpong', 'Pending']] },
    sections: [{ title: 'Issues', items: [['Till 3 printer jams', 'Osu · open'], ['MoMo delays at Adum', 'Under review']] }],
  },
  tickets: {
    title: 'Issue tickets', sub: 'Help from MNest UnifiedPOS Support.', icon: 'tickets', primary: 'New ticket',
    kpis: [['Open', '3'], ['Waiting on you', '1'], ['Solved this month', '9'], ['Average reply', '38 min']],
    table: { title: 'Tickets', cols: ['Ticket', 'Subject', 'Branch', 'Updated', 'Status'], rows: [['TK-1092', 'Receipt printer not found', 'Osu', '10 min ago', 'Open'], ['TK-1090', 'E-VAT sync slow', 'All', '2 h ago', 'Pending'], ['TK-1088', 'Add a new till', 'Adum', 'Yesterday', 'Waiting']] },
    sections: [],
  },
  users: {
    title: 'Users, levels & permissions', sub: 'Roles, permissions and preview-as-level.', icon: 'users', primary: 'New account',
    kpis: [['Accounts', '49'], ['Admins', '2'], ['MFA on', '100%'], ['Locked', '0']],
    table: { title: 'Accounts', cols: ['Name', 'Username', 'Level', 'Branch', 'Last sign-in', 'Status'], rows: [['Ebenezer Mensah', 'admin', 'Admin', 'All', 'Today 07:40', 'Active'], ['Ama Darko', 'ama', 'Manager', 'Osu', 'Today 07:52', 'Active'], ['Kwame Asante', 'kwame', 'Supervisor', 'Osu', 'Today 07:58', 'Active'], ['Akua Kyei', 'akua', 'Sales staff', 'Osu', 'Today 08:14', 'Active']] },
    sections: [{ title: 'Branch structure', items: [['Admin', 'Every branch'], ['Manager', 'Own branch'], ['Supervisor', 'Own branch, limited'], ['Sales staff', 'Till only']] }],
  },
  audit: {
    title: 'Audit trail', sub: 'Every change recorded, against the person who made it.', icon: 'audit', primary: 'Export log',
    kpis: [['Events today', '1,284'], ['Price changes', '6'], ['Voids', '2'], ['Sign-ins', '41']],
    table: { title: 'Latest events', cols: ['When', 'Who', 'Branch', 'What', 'Detail'], rows: [['09:44', 'Akua Kyei', 'Osu', 'Sale', 'S-1042 · GHS 450.00'], ['09:31', 'Ama Darko', 'Osu', 'Price change', 'TCL 43" TV 5,199 → 4,999'], ['09:02', 'Ebenezer Mensah', 'All', 'Approved', 'Deposit DEP-0201']] },
    sections: [],
  },
  payments: {
    title: 'Payments', sub: 'Gateways, Mobile Money routing and settlements.', icon: 'payments', primary: 'Connect a gateway',
    kpis: [['Settled today', 'GHS 11,240'], ['Pending settlement', 'GHS 3,900'], ['Failed today', '2'], ['Gateways', '3']],
    table: { title: 'Settlements & reconciliation', cols: ['Gateway', 'Method', 'Amount', 'Fee', 'Settled', 'Status'], rows: [['Hubtel', 'MTN MoMo', 'GHS 4,100', 'GHS 41', 'Today', 'Completed'], ['Paystack', 'Card', 'GHS 2,620', 'GHS 51', 'Tomorrow', 'Pending'], ['Hubtel', 'Telecel Cash', 'GHS 980', 'GHS 10', 'Today', 'Completed']] },
    sections: [{ title: 'Payment methods', items: [['Cash', 'On'], ['MTN MoMo', 'On'], ['Telecel Cash', 'On'], ['AirtelTigo Money', 'On'], ['Card', 'On'], ['Bank transfer', 'On'], ['Hire purchase', 'On']] }],
  },
  tax: {
    title: 'Tax & E-VAT', sub: 'Ghana VAT, NHIL and GETFund rates, and the GRA E-VAT connection for every branch.', icon: 'tax', primary: 'File VAT return',
    kpis: [['VAT 15%', 'GHS 41,280'], ['NHIL 2.5%', 'GHS 6,880'], ['GETFund 2.5%', 'GHS 6,880'], ['E-VAT', 'Connected']],
    table: { title: 'Tax collected · by branch', cols: ['Branch', 'Taxable sales', 'VAT', 'NHIL', 'GETFund', 'Status'], rows: [['Osu', 'GHS 128,000', 'GHS 19,200', 'GHS 3,200', 'GHS 3,200', 'Completed'], ['East Legon', 'GHS 96,000', 'GHS 14,400', 'GHS 2,400', 'GHS 2,400', 'Completed'], ['Adum', 'GHS 51,200', 'GHS 7,680', 'GHS 1,280', 'GHS 1,280', 'Pending']] },
    sections: [{ title: 'Ghana · VAT Act 2025 (Act 1151), from 1 January 2026', items: [['VAT', '15%'], ['NHIL', '2.5%'], ['GETFund', '2.5%'], ['Combined', '20%']] }],
  },
  documents: {
    title: 'Documents & stamp', sub: 'Company documents and the PAID stamp for invoices.', icon: 'documents', primary: 'Upload a document',
    kpis: [['Documents', '32'], ['Expiring soon', '1'], ['Stamp', 'Set'], ['Shared', '4']],
    table: { title: 'Documents', cols: ['Document', 'Type', 'Uploaded', 'Expires', 'Status'], rows: [['Business registration', 'Certificate', 'Jan 2024', '—', 'Active'], ['GRA VAT certificate', 'Certificate', 'Jan 2026', 'Dec 2026', 'Pending'], ['Fire permit · Osu', 'Permit', 'Mar 2026', 'Mar 2027', 'Active']] },
    sections: [{ title: 'Company stamp', items: [['PAID stamp', 'Added to paid invoices'], ['Signature', 'Ebenezer Mensah']] }],
  },
  security: {
    title: 'Security centre', sub: 'MFA, Zero Trust, firewall and a tamper-proof log.', icon: 'security', primary: 'Run integrity check',
    kpis: [['MFA enforced', '100%'], ['Blocked requests', '214'], ['Lockouts', '0'], ['Integrity', 'OK']],
    table: { title: 'Tamper-proof security log', cols: ['When', 'Event', 'Who', 'Where', 'Severity'], rows: [['09:12', 'Sign-in', 'Ebenezer Mensah', 'Accra', 'Low'], ['03:40', 'Blocked request', '—', 'Unknown', 'Pending'], ['Yesterday', 'Password changed', 'Ama Darko', 'Accra', 'Low']] },
    sections: [{ title: 'Controls in force', items: [['Multi-factor sign-in', 'Everyone'], ['Firewall & request filter', 'On'], ['Threat & anomaly detection', 'On']] }],
  },
  backup: {
    title: 'Backup & restore', sub: 'Every change kept, restorable any time.', icon: 'backup', primary: 'Download a backup',
    kpis: [['Last backup', 'Today 03:00'], ['Automatic', 'Every night'], ['Kept for', '90 days'], ['Size', '214 MB']],
    table: { title: 'History', cols: ['Backup', 'When', 'Size', 'Type', 'Status'], rows: [['BK-0322', 'Today 03:00', '214 MB', 'Automatic', 'Completed'], ['BK-0321', 'Yesterday 03:00', '213 MB', 'Automatic', 'Completed'], ['BK-0318', '17 Nov 14:22', '211 MB', 'Manual', 'Completed']] },
    sections: [{ title: 'Restore from a backup', items: [['Pick a backup', 'Restores to a copy first']] }],
  },
  settings: {
    title: 'Settings', sub: 'Company, integrations and legal.', icon: 'settings', primary: 'Save changes',
    kpis: [['Company', 'Ebenezer Unique Ventures'], ['Currency', 'GHS'], ['Time zone', 'Africa/Accra'], ['Plan', 'Business']],
    table: { title: 'Integrations', cols: ['Integration', 'Use', 'Status'], rows: [['GRA E-VAT', 'Tax receipts', 'Active'], ['Hubtel', 'MoMo & SMS', 'Active'], ['Paystack', 'Card payments', 'Active'], ['WhatsApp Business', 'Receipts & offers', 'Active']] },
    sections: [{ title: 'Manage company', items: [['Business name & logo', 'Edit'], ['Receipt footer', 'Edit'], ['Working hours', '08:00 – 21:00']] }],
  },
};
