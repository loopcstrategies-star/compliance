const STAFF_ROLES = ['employee', 'maker', 'checker', 'authorised_approver', 'super_admin'];

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
  { href: '/workspace', label: 'Overview', roles: STAFF_ROLES },
  { href: '/portal', label: 'Customer portal', roles: ['customer'] },
  { href: '/compliance', label: 'Review', roles: ['maker', 'checker', 'authorised_approver'] },
  { href: '/employee', label: 'Operations', roles: ['employee'] },
  { href: '/admin', label: 'Administration', roles: ['super_admin'] },
] as const;

export function tabsForRoles(roles: string[]) {
  return STAFF_TABS.filter((tab) => tab.roles.some((role) => roles.includes(role)));
}
