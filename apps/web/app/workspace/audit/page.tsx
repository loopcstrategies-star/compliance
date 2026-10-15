import { requireArea } from '../../../lib/session';
import { apiGet } from '../../../lib/api';
import { resolveTenant } from '../load-board';

type AuditRow = { id: string; action: string; targetType: string | null; createdAt: string; quarantined: boolean };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const me = await requireArea(['super_admin']);
  const query = await searchParams;
  const { tenantId, failed } = await resolveTenant(me, query.tenant);
  const rows = failed ? null : await apiGet<AuditRow[]>(`/audit?tenantId=${encodeURIComponent(tenantId)}`);
  return (
    <>
      <h2>Audit logs</h2>
      {rows ? (
        rows.length === 0 ? (
          <p className="notice">No audit events are stored for this company.</p>
        ) : (
          <div className="table-wrap">
            <table className="queue">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>{row.action}</td>
                    <td>{row.quarantined ? 'Held from view' : row.targetType || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p className="notice error">The audit log could not be loaded.</p>
      )}
    </>
  );
}
