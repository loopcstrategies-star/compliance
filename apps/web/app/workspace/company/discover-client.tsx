'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [industry, setIndustry] = useState(searchParams.get('industry') ?? '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextPage = page, overrides?: { q?: string; country?: string; city?: string; industry?: string }) => {
      setLoading(true);
      setError('');
      const nextQ = overrides?.q ?? q;
      const nextCountry = overrides?.country ?? country;
      const nextCity = overrides?.city ?? city;
      const nextIndustry = overrides?.industry ?? industry;
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: '12',
        ...(nextQ ? { q: nextQ } : {}),
        ...(nextCountry ? { country: nextCountry } : {}),
        ...(nextCity ? { city: nextCity } : {}),
        ...(nextIndustry ? { industry: nextIndustry } : {}),
      });
      const response = await fetch(`/api/company-network/discover?${params.toString()}`);
      setLoading(false);
      if (!response.ok) {
        setError('Company discovery is unavailable right now.');
        setData(null);
        return;
      }
      setData(await response.json());
    },
    [page, q, country, city, industry],
  );

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
      <div className="network-section-head">
        <h3>Discover Companies</h3>
        {data ? <span className="muted-line">{data.total} companies</span> : null}
      </div>
      <form className="network-search" onSubmit={onSearch}>
        <label>
          Keywords
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, industry, products, or services"
          />
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
        <button type="submit" disabled={loading}>
          Search
        </button>
      </form>
      {loading ? <p className="notice">Loading companies…</p> : null}
      {error ? (
        <p className="notice error">
          {error}{' '}
          <button type="button" className="button-secondary" onClick={() => void load(page)}>
            Retry
          </button>
        </p>
      ) : null}
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
            <p className="muted-line">
              {(company.introduction || company.productsServices || '').slice(0, 140) || 'No description published.'}
            </p>
            <div className="connection-actions">
              <a className="button-link button-link--outline" href={`/workspace/company/discover/${company.tenantId}`}>
                View profile
              </a>
              <ConnectionActions
                tenantId={company.tenantId}
                connectionId={company.connectionId}
                status={company.connectionStatus}
                onChanged={() => void load(page)}
              />
            </div>
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
