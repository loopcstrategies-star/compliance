import { requireTenantContext, TenantContextError } from './tenant-context';

describe('requireTenantContext', () => {
  it('throws when a worker has no tenant', () => {
    expect(() => requireTenantContext(undefined)).toThrow(TenantContextError);
    expect(() => requireTenantContext(null)).toThrow(TenantContextError);
    expect(() => requireTenantContext('')).toThrow(TenantContextError);
  });

  it('returns the tenant id when it is set', () => {
    expect(requireTenantContext('tenant-a')).toBe('tenant-a');
  });
});
