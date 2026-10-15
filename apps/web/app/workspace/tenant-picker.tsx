export function TenantPicker({
  tenants,
  tenantId,
  href,
}: {
  tenants: { id: string; name: string }[];
  tenantId: string;
  href: string;
}) {
  if (tenants.length === 0) {
    return null;
  }
  return (
    <form action={href}>
      <label>
        Company
        <select name="tenant" defaultValue={tenantId}>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Show this company</button>
    </form>
  );
}
