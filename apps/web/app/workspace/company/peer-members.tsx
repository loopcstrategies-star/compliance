'use client';

import { useEffect, useState } from 'react';

type PeerMember = {
  userId: string;
  displayName: string;
  jobTitle: string;
  department: string;
  introduction: string;
  hasPhoto: boolean;
};

export function PeerMembers({ tenantId }: { tenantId: string }) {
  const [members, setMembers] = useState<PeerMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/company-network/companies/${tenantId}/members`);
      if (!response.ok) {
        if (!cancelled) {
          setError(response.status === 404 ? 'Representatives are not available for this company.' : 'Could not load representatives.');
          setLoading(false);
        }
        return;
      }
      const payload = await response.json();
      if (!cancelled) {
        setMembers(payload ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (loading) {
    return <p className="notice">Loading representatives…</p>;
  }
  if (error) {
    return <p className="notice error">{error}</p>;
  }
  if (members.length === 0) {
    return <p className="notice">No public representatives listed.</p>;
  }

  return (
    <ul className="network-list network-people-list">
      {members.map((member) => (
        <li key={member.userId}>
          <div className="network-person-row">
            <div className="network-person-avatar network-person-avatar--placeholder" aria-hidden="true">
              {(member.displayName || '?').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{member.displayName}</strong>
              <p className="muted-line">
                {[member.jobTitle, member.department].filter(Boolean).join(' · ') || 'Team member'}
              </p>
              {member.introduction ? <p>{member.introduction}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
