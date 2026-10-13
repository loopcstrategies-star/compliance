import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const ALLOW_PENDING_MFA = 'allowPendingMfa';
export const PERMISSIONS = 'permissions';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const AllowPendingMfa = () => SetMetadata(ALLOW_PENDING_MFA, true);
export const RequirePermissions = (...keys: string[]) => SetMetadata(PERMISSIONS, keys);
