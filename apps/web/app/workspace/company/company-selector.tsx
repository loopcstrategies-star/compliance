'use client';

import { useRouter } from 'next/navigation';

export function CompanySelector({
  companies,
  selectedId,
  label = 'Company',
  basePath = '/workspace/company/branding',
}: {
  companies: { id: string; name: string }[];
  selectedId?: string;
  label?: string;
  basePath?: string;
}) {
  const router = useRouter();

  if (companies.length === 0) {
    return null;
  }

  return (
    <label className="company-selector">
      {label}
      <select
        value={selectedId ?? ''}
        onChange={(event) => {
          const tenantId = event.target.value;
          if (!tenantId) {
            return;
          }
          router.push(`${basePath}?tenant=${encodeURIComponent(tenantId)}`);
        }}
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </label>
  );
}
