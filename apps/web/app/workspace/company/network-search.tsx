'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function NetworkSearch({ initialQ = '' }: { initialQ?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const query = q.trim();
    router.push(
      query
        ? `/workspace/company/discover?q=${encodeURIComponent(query)}`
        : '/workspace/company/discover',
    );
  }

  return (
    <form className="network-global-search" onSubmit={onSubmit} role="search">
      <label className="sr-only" htmlFor="network-global-q">
        Search companies
      </label>
      <input
        id="network-global-q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search companies, industries, or partners..."
        autoComplete="off"
      />
      <button type="submit">Search</button>
    </form>
  );
}
