'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ConnectionActions } from './connection-actions';
import type { NetworkProfile } from './network-types';

type DiscoverResponse = {
  items: Array<NetworkProfile & { connectionStatus: string; connectionId: string | null }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function DiscoverClient() {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(nextPage = page) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: '12',
      ...(q ? { q } : {}),
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(industry ? { industry } : {}),
    });
    const response = await fetch(`/api/company-network/discover?${params.toString()}`);
    setLoading(false);
    if (!response.ok) {
      setError('Company discovery is unavailable right now.');
      setData(null);
      return;
    }
    setData(await response.json());
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load(1);
  }

  return (
    <section className="panel network-panel">
      <form className="network-search" onSubmit={onSearch}>
        <label>
          Company name
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search companies" />
        </label>
        <label>
          Country
          <input value={country} onChange={(event) => setCountry(event.target.value)} />
        </label>
        <label>
          City
          <input value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <label>
          Industry
          <input value={industry} onChange={(event) => setIndustry(event.target.value)} />
        </label>
        <button type="submit">Search</button>
      </form>
      {loading ? <p className="notice">Loading companies…</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <p className="notice">No discoverable companies match these filters.</p>
      ) : null}
      <div className="company-card-grid">
        {data?.items.map((company) => (
          <article key={company.tenantId} className="company-network-card">
            <div className="company-network-card-head">
              <img
                src={`/api/company-network/companies/${company.tenantId}/logo`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h3>
                  <Link href={`/workspace/company/discover/${company.tenantId}`}>{company.companyName}</Link>
                </h3>
                <p>{company.headline || 'No headline yet'}</p>
              </div>
            </div>
            <p className="muted-line">
              {[company.industry, company.city, company.country].filter(Boolean).join(' · ') || 'Location not set'}
            </p>
            <ConnectionActions
              tenantId={company.tenantId}
              connectionId={company.connectionId}
              status={company.connectionStatus}
            />
          </article>
        ))}
      </div>
      {data && data.totalPages > 1 ? (
        <div className="network-pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              void load(next);
            }}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages || loading}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(next);
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
