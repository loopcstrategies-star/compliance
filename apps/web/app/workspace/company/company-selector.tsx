'use client';

import { useRouter } from 'next/navigation';

export function CompanySelector({
  companies,
  selectedId,
  label = 'Active company',
}: {
  companies: { id: string; name: string }[];
  selectedId?: string;
  label?: string;
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
          router.push(`/workspace/company?tenant=${encodeURIComponent(tenantId)}`);
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
