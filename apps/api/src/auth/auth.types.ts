export type AuthState = {
  sessionId: string;
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  mfaSatisfied: boolean;
  mfaEnrolled: boolean;
  privileged: boolean;
};
