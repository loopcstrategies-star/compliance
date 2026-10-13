export class TenantContextError extends Error {
  constructor() {
    super('Tenant context is required');
    this.name = 'TenantContextError';
  }
}

export function requireTenantContext(tenantId: string | null | undefined): string {
  if (!tenantId) {
    throw new TenantContextError();
  }
  return tenantId;
}
