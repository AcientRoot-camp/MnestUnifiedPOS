// Navigation structure mirrored from the prototype's Sidebar. Non-Admin menus follow the person's permissions.
import { anyOn, can, type Grants, type Perm } from '../lib/perms';
import { readKey } from '../lib/persist';
export type Role = 'superuser' | 'manager' | 'supervisor' | 'staff' | 'developer' | 'rider';

export type NavItem = { id: string; label: string; path: string; badge?: string; tone?: 'warn' };
export type NavGroup = { label: string; items: NavItem[] };

const p = (screen: string, tab?: string) => (tab ? `/${screen}/${tab}` : `/${screen}`);

export const BRANCHES = [
  { id: 'osu', name: 'Osu branch', short: 'Osu', city: 'Accra', manager: 'Ama Darko' },
  { id: 'legon', name: 'East Legon branch', short: 'East Legon', city: 'Accra', manager: 'Efua Sarpong' },
  { id: 'adum', name: 'Adum branch', short: 'Adum', city: 'Kumasi', manager: 'Yaw Boakye' },
];

export const PEOPLE: Record<Role, { name: string; level: string; initials: string; username: string }> = {
  superuser: { name: 'Ebenezer Mensah', level: 'Admin', initials: 'EM', username: 'admin' },
  manager: { name: 'Ama Darko', level: 'Manager', initials: 'AD', username: 'ama' },
  supervisor: { name: 'Kwame Asante', level: 'Supervisor', initials: 'KA', username: 'kwame' },
  staff: { name: 'Akua Kyei', level: 'Sales staff', initials: 'AK', username: 'akua' },
  developer: { name: 'MNest UnifiedPOS Support', level: 'Developer', initials: 'ES', username: 'support' },
  rider: { name: 'Yaw Darko', level: 'Rider', initials: 'YD', username: 'yaw.darko' },
};

// Demo sign-in accounts from BUILD_SPEC.md section 6. Password + personal 6-digit passcode.
export type Account = { username: string; name: string; role: Role; level: string; branch: string; password: string; passcode: string };
export const ACCOUNTS: Account[] = [
  // The Admin signs in with the username "admin" (it was "kofi"; lib/sec.ts migrateAdminUsername moves saved settings).
  { username: 'admin', name: 'Ebenezer Mensah', role: 'superuser', level: 'Admin', branch: 'all', password: 'Adom2026!', passcode: '100026' },
  { username: 'ama', name: 'Ama Darko', role: 'manager', level: 'Manager', branch: 'osu', password: 'Adom2026!', passcode: '111126' },
  { username: 'kwame', name: 'Kwame Asante', role: 'supervisor', level: 'Supervisor', branch: 'osu', password: 'Adom2026!', passcode: '222226' },
  { username: 'akua', name: 'Akua Kyei', role: 'staff', level: 'Sales staff', branch: 'osu', password: 'Adom2026!', passcode: '333326' },
  { username: 'kwesi', name: 'Kwesi Ofori', role: 'staff', level: 'Sales staff', branch: 'osu', password: 'Adom2026!', passcode: '444426' },
  { username: 'support', name: 'MNest UnifiedPOS Support', role: 'developer', level: 'Developer', branch: '', password: 'Support2026!', passcode: '909026' },
  { username: 'yaw.darko', name: 'Yaw Darko', role: 'rider', level: 'Rider', branch: 'osu', password: 'Ride2026!', passcode: '555526' },
];
/** Point the role's display identity at the signed-in account (e.g. kwesi and akua share the staff role). */
export function applyAccount(a: Pick<Account, 'username' | 'name' | 'role' | 'level'>) {
  PEOPLE[a.role] = { name: a.name, level: a.level, initials: a.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(), username: a.username };
}

/** Leave requests waiting for a decision, for the People & HR badge ('' when none). */
function pendingLeave(): string | undefined {
  try { const L = JSON.parse(localStorage.getItem('ecompos.leave2') || 'null') as { status: string }[] | null; const n = (L || []).filter((x) => x.status === 'pending').length; return n ? String(n) : undefined; } catch { return undefined; }
}

export function buildNav(role: Role, username?: string, branch?: string, grants?: Grants): NavGroup[] {
  if (role === 'rider') return [];
  if (role === 'developer')
    return [
      { label: 'System', items: [
        { id: 'developer', label: 'Developer console', path: p('developer') },
        { id: 'security', label: 'Security centre', path: p('security') },
        { id: 'devmonitor', label: 'System monitor', path: p('developer', 'monitor') },
        { id: 'tickets', label: 'Escalated tickets', path: p('developer', 'escalated') },
        { id: 'audit', label: 'Audit trail', path: p('audit') },
        { id: 'devupdates', label: 'Updates & maintenance', path: p('developer', 'updates') },
        { id: 'devsetup', label: 'Set-up & hand-over', path: p('developer', 'setup') },
        { id: 'devactivity', label: 'My activity', path: p('developer', 'activity') },
        { id: 'devlimits', label: 'Access limits', path: p('developer', 'limits') },
      ] },
      { label: 'Company', items: [
        { id: 'devcomanage', label: 'Manage companies', path: '/developer/company/list' },
        { id: 'devcompanies', label: 'New company', path: '/developer/company/new' },
        { id: 'devbiztypes', label: 'Types of business', path: '/developer/company/types' },
        { id: 'devbranches', label: 'Company branches', path: p('developer', 'branches') },
        { id: 'branches', label: 'Branches overview', path: p('branches') },
      ] },
      { label: 'IT management', items: [
        { id: 'devit:int', label: 'Integrations & API', path: '/developer/it/int' },
        { id: 'devit:host', label: 'Hosting & security', path: '/developer/it/host' },
        { id: 'devit:hw', label: 'Hardware, devices & offline', path: '/developer/it/hw' },
        { id: 'devit:dev', label: 'All connected devices', path: '/developer/it/devices' },
        { id: 'devit:http', label: 'HTTP errors & status codes', path: '/developer/it/http' },
      ] },
      { label: 'Users & account', items: [
        { id: 'devsulogin', label: 'Admin logins & hold', path: '/developer/setup/logins' },
        { id: 'devaccounts', label: 'All user accounts', path: p('developer', 'accounts') },
        { id: 'devacc:branch', label: 'Accounts by branch', path: '/developer/accounts/branch' },
        { id: 'devacc:locked', label: 'Locked accounts', path: '/developer/accounts/locked' },
        { id: 'devacc:held', label: 'Accounts on hold', path: '/developer/accounts/held' },
        { id: 'devacc:reset', label: 'Password & PIN resets', path: '/developer/accounts/reset' },
        { id: 'devacc:perms', label: 'Roles & permissions', path: '/developer/accounts/perms' },
        { id: 'devacc:signins', label: 'Sign-in history', path: '/developer/accounts/signins' },
        { id: 'devacc:audit', label: 'Account changes by support', path: '/developer/accounts/audit' },
      ] },
      { label: 'Report', items: [
        { id: 'devrep:all', label: 'All branches', path: '/reports/br-all' },
        ...BRANCHES.map((b) => ({ id: 'devrep:' + b.id, label: b.name.replace(/\s*branch$/i, '') + ' branch', path: `/reports/br-${b.id}` })),
      ] },
      { label: 'Training mode', items: [
        { id: 'devtrain', label: 'Training mode on / off', path: p('developer', 'training') },
        { id: 'devtprint', label: 'Test print', path: '/developer/training/print' },
        { id: 'devclear', label: 'Clear company data', path: '/developer/training/clear' },
      ] },
      { label: 'Backup & restore', items: [
        { id: 'backup', label: 'Download a backup', path: '/backup/download' },
        { id: 'bkauto', label: 'Automatic backup', path: '/backup/auto' },
        { id: 'bkcloud', label: 'Send to mail & cloud', path: '/backup/cloud' },
        { id: 'bkrestore', label: 'Restore from a backup', path: '/backup/restore' },
        { id: 'bkhist', label: 'Backup history', path: '/backup/history' },
      ] },
      { label: 'Post to webstore', items: [
        { id: 'web:updates', label: 'Store updates', path: p('web', 'updates') },
        { id: 'web:products', label: 'Product descriptions', path: p('web', 'products') },
        { id: 'web:about', label: 'About us', path: p('web', 'about') },
        { id: 'web:branches', label: 'Branch information', path: p('web', 'branches') },
        { id: 'web:reviews', label: 'What customers say', path: p('web', 'reviews') },
        { id: 'web:pages', label: 'Pages', path: p('web', 'pages') },
        { id: 'web:seo', label: 'SEO & advanced', path: p('web', 'seo') },
        { id: 'web:plugins', label: 'Plugins & apps', path: p('web', 'plugins') },
        { id: 'web:delivery', label: 'Delivery charges', path: p('web', 'delivery') },
        { id: 'web:site', label: 'Store name, logo & settings', path: p('web', 'site') },
      ] },
    ];
  const isAdmin = role === 'superuser';
  const isMgr = role === 'manager';
  const isSup = role === 'supervisor';
  const c = (k: Perm) => can(role, username, k, grants);
  const any = (...k: Perm[]) => k.some(c);
  const allOff = !anyOn(role, username, grants);
  const mgrUp = isAdmin || (isMgr && !allOff);
  const myBr = BRANCHES.find((b) => b.id === branch);
  // Credit sales badge = customers who still owe money on credit sales.
  const owing = readKey<{ credits?: { total: number; paid: number }[] }[]>('ecompos.customers2', []).filter((x) => (x.credits || []).some((k) => k.total - k.paid > 0.005)).length;
  const sell: NavItem[] = [
    ...(c('sales.make') ? [{ id: 'pos', label: 'Sell Now', path: p('sell') }] : []),
    { id: 'mysales', label: 'My sales', path: p('mysales') },
    { id: 'credit', label: 'Credit sales', path: p('sell', 'credit'), ...(owing ? { badge: String(owing) } : {}) },
    ...(c('invoices.use') ? [{ id: 'proforma', label: 'Pro-forma invoices', path: p('proforma') }] : []),
    ...(c('hirepurchase.use') ? [{ id: 'hirepurchase', label: 'Hire purchase', path: p('hirepurchase'), badge: '2' }] : []),
    ...(any('customers.view', 'customers.create', 'customers.manage') ? [{ id: 'customers', label: 'Customers', path: p('customers') }] : []),
    ...(c('sales.make') ? [{ id: 'collect', label: 'Collect orders', path: p('collect'), badge: '2' }] : []),
    ...(any('sales.make', 'returns.start') ? [{ id: 'sales', label: 'Sales & returns', path: p('sales') }] : []),
    // Opens the online store website in this tab with the "Staff: open back office" link (App.tsx OpenStore).
    { id: 'shop', label: 'Online store', path: p('shop') },
    { id: 'orders', label: 'Orders', path: p('orders'), badge: '6' },
    ...(c('invoices.use') ? [{ id: 'invoices', label: 'Invoices & Receipts', path: p('invoices'), badge: '2' }] : []),
  ];
  // CRM (MNestPOS_CRM_Prompt.md §4.3): one CRM, role-filtered. Badges read ecompos.crm.* directly (scoped like the screens).
  const me = ACCOUNTS.find((a) => a.username === username)?.name ?? '';
  const isStaff = role === 'staff';
  const inScope = <T extends { branch?: string; owner?: string; assignee?: string; staff?: string }>(L: T[]) => (isAdmin ? L : isStaff ? L.filter((x) => (x.owner ?? x.assignee ?? x.staff) === me) : L.filter((x) => x.branch === branch));
  const today0 = new Date().setHours(0, 0, 0, 0);
  const crmLeads = inScope(readKey<{ branch: string; owner: string; status: string }[]>('ecompos.crm.leads', [])).filter((l) => l.status === 'New' && (isStaff || !l.owner)).length;
  const crmOver = inScope(readKey<{ branch: string; assignee: string; status: string; dueAt: number }[]>('ecompos.crm.tasks', [])).filter((t) => t.status === 'open' && t.dueAt < today0).length;
  const crmOpen = inScope(readKey<{ branch: string; staff: string; kind: string; status: string }[]>('ecompos.crm.feedback', [])).filter((f) => f.kind === 'complaint' && f.status !== 'resolved').length;
  const crm: NavItem[] = [
    { id: 'crm', label: isStaff ? 'My day' : 'CRM overview', path: p('crm') },
    { id: 'crm:leads', label: isStaff ? 'My leads' : 'Leads', path: p('crm', 'leads'), ...(crmLeads ? { badge: String(crmLeads) } : {}) },
    { id: 'crm:pipeline', label: isStaff ? 'My deals' : 'Deals pipeline', path: p('crm', 'pipeline') },
    { id: 'crm:tasks', label: isStaff ? 'My follow-ups' : 'Follow-ups & tasks', path: p('crm', 'tasks'), ...(crmOver ? { badge: String(crmOver), tone: 'warn' as const } : {}) },
    ...(!isStaff ? [{ id: 'crm:segments', label: 'Segments', path: p('crm', 'segments') }, { id: 'crm:loyalty', label: 'Loyalty & rewards', path: p('crm', 'loyalty') }] : []),
    { id: 'crm:feedback', label: isStaff ? 'Log feedback' : 'Feedback & complaints', path: p('crm', 'feedback'), ...(crmOpen ? { badge: String(crmOpen) } : {}) },
    ...(isAdmin || isMgr ? [{ id: 'crm:journeys', label: 'Customer journeys', path: p('crm', 'journeys') }] : []),
    ...(!isStaff ? [{ id: 'crm:team', label: 'Team performance', path: p('crm', 'team') }] : []),
    ...(isAdmin ? [{ id: 'crm:settings', label: 'CRM settings', path: p('crm', 'settings') }] : []),
  ];
  const groups: NavGroup[] = [
    { label: 'Sell', items: sell },
    { label: 'CRM', items: crm },
    {
      label: 'Catalogue',
      items: [
        { id: 'products', label: 'Products', path: p('products') },
        ...(any('categories.manage', 'products.manage') ? [{ id: 'categories', label: 'Categories', path: p('categories') }] : []),
        ...(any('stock.view', 'stock.manage', 'stock.count', 'stock.alerts') ? [{ id: 'inventory', label: 'Inventory', path: p('inventory'), badge: '4' }] : []),
        ...(any('stock.view', 'stock.manage', 'stock.count') ? [{ id: 'warehouse', label: 'Warehouse & transfers', path: p('warehouse') }] : []),
        ...(any('stock.view', 'stock.manage', 'returns.start') ? [{ id: 'damages', label: 'Damages & suppliers', path: p('damages') }] : []),
      ],
    },
    ...(c('contracts.use') ? [{ label: 'Money', items: [{ id: 'contracts', label: 'Contracts', path: p('contracts') }] }] : []),
    {
      label: 'Reports',
      items: [
        { id: 'reports', label: 'Generate a report', path: p('reports') },
        { id: 'rep:overview', label: 'Snapshot', path: p('reports', 'overview') },
        { id: 'rep:system', label: 'Reference reports', path: p('reports', 'system') },
        { id: 'rep:builder', label: 'Custom report', path: p('reports', 'builder') },
        { id: 'rep:crm', label: 'CRM reports', path: p('reports', 'crm') },
      ],
    },
    {
      label: 'Finance',
      items: [
        { id: 'finance', label: 'Overview', path: p('finance'), badge: isAdmin ? '2' : undefined },
        { id: 'fin:cashup', label: 'Cash-up', path: p('finance', 'cashup') },
        { id: 'fin:deposits', label: 'Bank deposits', path: p('finance', 'deposits') },
        { id: 'fin:moves', label: 'Money movements', path: p('finance', 'moves') },
        { id: 'fin:refunds', label: 'Refunds', path: p('finance', 'refunds'), badge: isAdmin || isMgr ? '3' : undefined },
        ...(isAdmin ? [{ id: 'fin:accounts', label: 'Bank accounts', path: p('finance', 'accounts') }, { id: 'fin:assistant', label: 'Finance assistant', path: p('finance', 'assistant') }] : []),
      ],
    },
    {
      label: 'Suppliers',
      items: [
        { id: 'suppliers', label: 'Overview', path: p('suppliers') },
        { id: 'sup:in', label: 'Goods in', path: p('suppliers', 'in') },
        { id: 'sup:new', label: 'New product', path: p('suppliers', 'new') },
        { id: 'sup:out', label: 'Damages out', path: p('suppliers', 'out') },
        { id: 'sup:claims', label: 'Claims', path: p('suppliers', 'claims') },
        { id: 'sup:book', label: 'Supplier details', path: p('suppliers', 'book') },
        ...(isAdmin ? [{ id: 'sup:manage', label: 'Manage suppliers', path: p('suppliers', 'manage') }] : []),
      ],
    },
    {
      label: 'Expenses',
      items: [
        ...(role !== 'staff' ? [{ id: 'expenses', label: 'Overview', path: p('expenses') }] : []),
        { id: 'exp:mine', label: 'My expenses', path: p('expenses', 'mine') },
        { id: 'exp:new', label: 'New expense', path: p('expenses', 'new') },
        ...(role !== 'staff' ? [{ id: 'exp:inbox', label: 'Approvals', path: p('expenses', 'inbox'), badge: '3' }, { id: 'exp:all', label: 'All expenses', path: p('expenses', 'all') }] : []),
        ...(isAdmin || isMgr ? [{ id: 'exp:petty', label: 'Petty cash', path: p('expenses', 'petty') }, { id: 'exp:budget', label: 'Budgets', path: p('expenses', 'budget') }] : []),
        { id: 'exp:reimb', label: 'Reimbursements', path: p('expenses', 'reimb') },
        ...(isAdmin ? [{ id: 'exp:set', label: 'Settings', path: p('expenses', 'set') }] : []),
      ],
    },
    ...(isAdmin || isMgr
      ? [{
          label: 'Post to webstore',
          items: [
            ...(isAdmin ? [{ id: 'web:codes', label: 'Discount codes', path: p('web', 'codes') }] : []),
            { id: 'web:updates', label: 'Store updates', path: p('web', 'updates') },
            { id: 'web:products', label: 'Product descriptions', path: p('web', 'products') },
            { id: 'web:about', label: 'About us', path: p('web', 'about') },
            { id: 'web:branches', label: 'Branch information', path: p('web', 'branches') },
            { id: 'web:reviews', label: 'What customers say', path: p('web', 'reviews') },
            { id: 'web:pages', label: 'Pages', path: p('web', 'pages') },
            { id: 'web:seo', label: 'SEO & advanced', path: p('web', 'seo') },
            { id: 'web:plugins', label: 'Plugins & apps', path: p('web', 'plugins') },
            { id: 'web:delivery', label: 'Delivery charges', path: p('web', 'delivery') },
            { id: 'web:site', label: 'Store name, logo & settings', path: p('web', 'site') },
          ],
        }]
      : []),
    {
      label: 'Grow & team',
      items: [
        ...(mgrUp ? [{ id: 'marketing', label: 'Marketing', path: p('marketing') }] : []),
        // Admin only: how many leave requests are waiting for a decision (People & HR → Leave).
        { id: 'staff', label: 'People & HR', path: p('staff'), badge: isAdmin ? pendingLeave() : undefined },
        { id: 'payroll', label: 'Payroll', path: p('payroll') },
      ],
    },
    {
      label: 'Branches',
      items: isAdmin
        ? [{ id: 'branches', label: 'All branches', path: p('branches') }, { id: 'br:osu', label: 'Osu', path: p('branches', 'osu') }, { id: 'br:legon', label: 'East Legon', path: p('branches', 'legon') }, { id: 'br:adum', label: 'Adum, Kumasi', path: p('branches', 'adum') }, { id: 'addbranch', label: 'Request new branch', path: p('branches', 'request') }]
        : c('branches.view') && myBr ? [{ id: 'branches', label: 'My branch', path: p('branches') }, { id: `br:${myBr.id}`, label: myBr.short, path: p('branches', myBr.id) }] : [],
    },
    {
      label: isAdmin ? 'Admin' : 'Settings',
      items: isAdmin
        ? [
            { id: 'approvals', label: 'Approvals & issues', path: p('approvals'), badge: '5' },
            { id: 'tickets', label: 'Issue tickets', path: p('tickets'), badge: '3' },
            { id: 'users', label: 'Users & permissions', path: p('users') },
            { id: 'audit', label: 'Audit trail', path: p('audit') },
            { id: 'payments', label: 'Payments', path: p('payments') },
            { id: 'tax', label: 'Tax & E-VAT', path: p('tax'), badge: '3' },
            { id: 'messages', label: 'SMS & email', path: p('messages') },
            { id: 'documents', label: 'Documents & stamp', path: p('documents') },
            { id: 'backup', label: 'Backup & restore', path: p('backup') },
            { id: 'settings', label: 'Settings', path: p('settings') },
          ]
        : [
            { id: 'messages', label: 'SMS & email', path: p('messages') },
            ...(any('approvals.decide', 'returns.approve', 'issues.receive') ? [{ id: 'approvals', label: 'Approvals & issues', path: p('approvals'), badge: '5' }] : []),
            { id: 'tickets', label: 'Issue tickets', path: p('tickets') },
            // Settings and Documents & stamp are the Admin's only (company-wide set-up).
          ],
    },
  ];
  void isSup;
  return groups.filter((g) => g.items.length);
}
