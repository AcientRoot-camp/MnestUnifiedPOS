// Per-person permissions granted by the Admin in Users & permissions (ecompos.grants).
// CAN = which levels may hold a permission, DEF = which levels have it on by default (M Manager, S Supervisor, N Sales staff).
import { readKey } from './persist';
import type { Role } from '../data/nav';

export type Perm =
  | 'stock.view' | 'branches.view' | 'sales.make' | 'products.manage' | 'categories.manage' | 'stock.manage' | 'stock.count' | 'stock.alerts'
  | 'invoices.use' | 'contracts.use' | 'hirepurchase.use' | 'customers.view' | 'customers.create' | 'customers.manage'
  | 'returns.start' | 'returns.approve' | 'approvals.decide' | 'shifts.manage' | 'issues.receive'
  | 'reports.sales' | 'reports.team' | 'reports.returns' | 'reports.inventory' | 'reports.customers' | 'reports.shifts' | 'reports.purchases';

export const PERMS: [Perm, string, string, string, string][] = [
  // key, label, group, CAN, DEF
  ['sales.make', 'Sell at the till', 'Selling', 'MSN', 'MSN'],
  ['invoices.use', 'Pro-forma invoices & invoices', 'Selling', 'MSN', 'MSN'],
  ['hirepurchase.use', 'Hire purchase', 'Selling', 'MSN', 'MSN'],
  ['returns.start', 'Start returns & exchanges', 'Selling', 'MSN', 'MSN'],
  ['returns.approve', 'Approve returns & refunds', 'Approvals', 'MS', 'MS'],
  ['approvals.decide', 'Approve discounts & credit', 'Approvals', 'MS', 'MS'],
  ['issues.receive', 'Receive issues from staff', 'Approvals', 'MS', 'MS'],
  ['shifts.manage', 'Manage shifts & cash-up', 'Approvals', 'MS', 'MS'],
  ['customers.view', 'See customer profiles', 'Customers', 'MS', 'MS'],
  ['customers.create', 'Add customers', 'Customers', 'MSN', 'MSN'],
  ['customers.manage', 'Manage customers & credit', 'Customers', 'M', 'M'],
  ['stock.view', 'See stock levels', 'Stock', 'MSN', 'MSN'],
  ['products.manage', 'Add & edit products', 'Stock', 'MS', 'MS'],
  ['categories.manage', 'Add & edit categories', 'Stock', 'MSN', 'MSN'],
  ['stock.manage', 'Adjust stock & purchase orders', 'Stock', 'M', ''],
  ['stock.count', 'Stock counts', 'Stock', 'MS', 'S'],
  ['stock.alerts', 'Stock alerts', 'Stock', 'M', ''],
  ['branches.view', 'See my branch page', 'Branch', 'MSN', 'MS'],
  ['contracts.use', 'Contracts', 'Money', 'M', ''],
  ['reports.sales', 'Sales reports', 'Reports', 'M', 'M'],
  ['reports.team', 'Team reports', 'Reports', 'MS', 'MS'],
  ['reports.returns', 'Returns reports', 'Reports', 'MS', 'M'],
  ['reports.inventory', 'Inventory reports', 'Reports', 'MS', 'M'],
  ['reports.customers', 'Customer reports', 'Reports', 'M', 'M'],
  ['reports.shifts', 'Shift reports', 'Reports', 'MS', 'MS'],
  ['reports.purchases', 'Purchase reports', 'Reports', 'M', ''],
];
const LV: Partial<Record<Role, string>> = { manager: 'M', supervisor: 'S', staff: 'N' };
export const PERM_LABEL = Object.fromEntries(PERMS.map((p) => [p[0], p[1]])) as Record<Perm, string>;
export type Grants = Record<string, Partial<Record<Perm, boolean>>>;
export const canHold = (role: Role, p: Perm) => role === 'superuser' || (LV[role] ? PERMS.find((x) => x[0] === p)![3].includes(LV[role]!) : false);
export const isDefault = (role: Role, p: Perm) => role === 'superuser' || (LV[role] ? PERMS.find((x) => x[0] === p)![4].includes(LV[role]!) : false);
/** Admin holds everything. Others get the default unless the Admin changed it, and never above the ceiling. */
export function can(role: Role, username: string | undefined, p: Perm, grants: Grants = readKey<Grants>('ecompos.grants', {})) {
  if (role === 'superuser') return true;
  if (!canHold(role, p)) return false;
  const g = grants[username || '']?.[p];
  return g === undefined ? isDefault(role, p) : g;
}
export const anyOn = (role: Role, username: string | undefined, grants?: Grants) => PERMS.some(([k]) => can(role, username, k, grants));

/** Which permission a page needs, and the polite name used on the "turned off" screen. */
export const PAGE_PERM: Record<string, [Perm[], string]> = {
  pos: [['sales.make'], 'Selling'], collect: [['sales.make'], 'Collect orders'], sales: [['sales.make', 'returns.start'], 'Sales & returns'],
  proforma: [['invoices.use'], 'Pro-forma invoices'], invoices: [['invoices.use'], 'Invoices & Receipts'], hirepurchase: [['hirepurchase.use'], 'Hire purchase'],
  customers: [['customers.view', 'customers.create', 'customers.manage'], 'Customers'], categories: [['categories.manage', 'products.manage'], 'Categories'],
  inventory: [['stock.view', 'stock.manage', 'stock.count', 'stock.alerts'], 'Inventory'], warehouse: [['stock.view', 'stock.manage', 'stock.count'], 'Warehouse & transfers'],
  damages: [['stock.view', 'stock.manage', 'returns.start'], 'Damages & suppliers'], contracts: [['contracts.use'], 'Contracts'],
  approvals: [['approvals.decide', 'returns.approve', 'issues.receive'], 'Approvals & issues'], branches: [['branches.view'], 'Branches'],
};
// Settings and Documents & stamp are company-wide set-up: the Admin's only (also hidden from other roles' menus).
export const ADMIN_ONLY = ['users', 'audit', 'backup', 'settings', 'documents'];
export const MANAGER_UP = ['payments', 'tax', 'marketing'];
