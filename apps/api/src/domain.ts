export const ROLE_KEYS = [
  'customer',
  'employee',
  'maker',
  'checker',
  'authorised_approver',
  'super_admin',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PRIVILEGED_ROLES = new Set<string>([
  'employee',
  'maker',
  'checker',
  'authorised_approver',
  'super_admin',
]);

export const ROLE_PERMISSIONS: Record<RoleKey, string[]> = {
  customer: ['portal.access', 'application.read', 'application.write', 'document.upload', 'document.read', 'package.generate', 'application.submit'],
  employee: ['employee.access', 'user.read', 'user.update', 'invitation.create', 'application.read', 'dashboard.read', 'report.export', 'application.assign'],
  maker: ['compliance.access', 'user.read', 'invitation.create', 'application.read', 'application.write', 'document.upload', 'document.read', 'identity_file.read', 'package.generate', 'review.maker'],
  checker: ['compliance.access', 'user.read', 'application.read', 'application.write', 'document.upload', 'document.read', 'identity_file.read', 'review.checker'],
  authorised_approver: ['compliance.access', 'user.read', 'application.read', 'application.write', 'document.upload', 'document.read', 'identity_file.read', 'review.approve'],
  super_admin: ['admin.access', 'tenant.manage', 'user.read', 'checklist.configure', 'application.read', 'invitation.create', 'letterhead.configure', 'workflow.configure', 'operations.configure', 'role.assign', 'retention.configure', 'retention.approve', 'audit.read'],
};

export const PERMISSION_KEYS = [
  'portal.access',
  'employee.access',
  'compliance.access',
  'admin.access',
  'user.read',
  'user.update',
  'tenant.manage',
  'identity_file.read',
  'invitation.create',
  'application.read',
  'application.write',
  'checklist.configure',
  'document.upload',
  'document.read',
  'package.generate',
  'letterhead.configure',
  'application.submit',
  'review.maker',
  'review.checker',
  'review.approve',
  'workflow.configure',
  'dashboard.read',
  'report.export',
  'application.assign',
  'operations.configure',
  'role.assign',
  'retention.configure',
  'retention.approve',
  'audit.read',
] as const;

export const STAFF_ROLES = ['employee', 'maker', 'checker', 'authorised_approver', 'super_admin'] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const LETTERHEAD_OWNERS = ['myka', 'customer', 'none'] as const;
export type LetterheadOwner = (typeof LETTERHEAD_OWNERS)[number];

export const SIGNATURE_STATEMENT =
  'This record is an image of a signature. It is not a qualified electronic signature.';

export const SIGNATURE_CONSENT =
  'I authorise use of this signature image on the onboarding documents. This image is not a qualified electronic signature.';

export const CUSTOMER_TYPES = ['local_company', 'foreign_company', 'mine', 'individual'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const SESSION_COOKIE = 'myka_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
