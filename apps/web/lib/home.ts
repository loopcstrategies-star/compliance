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
  { href: '/workspace/company', label: 'Company Profile', roles: ['super_admin'] },
  { href: '/workspace/requests', label: 'New Request', roles: QUEUE_ROLES },
  { href: '/workspace/waiting', label: 'Waiting List', roles: QUEUE_ROLES },
  { href: '/workspace/customers', label: 'Customer List', roles: QUEUE_ROLES },
  { href: '/workspace/dashboard', label: 'Dashboard', roles: QUEUE_ROLES },
] as const;

export function tabsForRoles(roles: string[]) {
  if (!roles.some((role) => STAFF_ROLES.includes(role))) {
    return [];
  }
  return STAFF_TABS.filter((tab) => tab.roles.some((role) => roles.includes(role)));
}
