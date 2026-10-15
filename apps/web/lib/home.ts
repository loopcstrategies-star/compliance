const STAFF_ROLES = ['employee', 'maker', 'checker', 'authorised_approver', 'super_admin'];
const QUEUE_ROLES = STAFF_ROLES;

export function homeForRoles(roles: string[]): string {
  if (roles.some((role) => STAFF_ROLES.includes(role))) {
    return '/workspace';
  }
  if (roles.includes('customer')) {
    return '/portal';
  }
  return '/login';
}

export const STAFF_TABS = [
  { href: '/workspace/dashboard', label: 'Dashboard', roles: QUEUE_ROLES, group: 'main' },
  { href: '/workspace/company', label: 'Company Profile', roles: ['super_admin'], group: 'main' },
  { href: '/workspace/requests', label: 'New Request', roles: QUEUE_ROLES, group: 'main' },
  { href: '/workspace/waiting', label: 'Waiting List', roles: QUEUE_ROLES, group: 'main' },
  { href: '/workspace/customers', label: 'Customer List', roles: QUEUE_ROLES, group: 'main' },
  { href: '/workspace/settings', label: 'Settings', roles: ['super_admin'], group: 'utility' },
  { href: '/workspace/audit', label: 'Audit Logs', roles: ['super_admin'], group: 'utility' },
  { href: '/workspace/help', label: 'Help', roles: QUEUE_ROLES, group: 'utility' },
] as const;

export function tabsForRoles(roles: string[]) {
  if (!roles.some((role) => STAFF_ROLES.includes(role))) {
    return [];
  }
  return STAFF_TABS.filter((tab) => tab.roles.some((role) => roles.includes(role)));
}
