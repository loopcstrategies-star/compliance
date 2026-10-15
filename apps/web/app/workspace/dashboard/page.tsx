import { requireArea } from '../../../lib/session';
import { TenantPicker } from '../tenant-picker';
import { loadBoard, resolveTenant } from '../load-board';

const COLORS = ['#1d4ed8', '#7c3aed', '#c2410c', '#b45309', '#166534', '#64748b', '#9f1239'];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tenant?: string; days?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const days = query.days === '60' || query.days === '90' ? Number(query.days) : 30;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const board = failed ? null : await loadBoard('dashboard', tenantId, days);
  const suffix = `?tenant=${encodeURIComponent(tenantId)}`;
  const canInvite = me.roles.some((role) => role === 'maker' || role === 'employee');
  const canManage = me.roles.includes('super_admin');
  return (
    <>
      <header className="dash-head">
        <div>
          <h2>Welcome back, {me.displayName}</h2>
          <p>KYC onboarding activity for the signed-in company.</p>
        </div>
        <div className="dash-tools">
          <TenantPicker tenants={tenants} tenantId={tenantId} href="/workspace/dashboard" />
          <nav className="days" aria-label="Application window">
            {[30, 60, 90].map((value) => (
              <a key={value} href={`/workspace/dashboard?days=${value}&tenant=${tenantId}`} aria-current={days === value ? 'true' : undefined}>
                Last {value} days
              </a>
            ))}
          </nav>
        </div>
      </header>
      {board ? (
        <>
          <section className="kpi-row">
            <a href={`/workspace/dashboard?days=${days}&tenant=${tenantId}`}>
              <span>Total applications</span>
              <strong>{board.counts.total ?? 0}</strong>
              <small>Opened in the last {board.windowDays ?? days} days</small>
            </a>
            <a href={`/workspace/requests${suffix}`}>
              <span>New requests</span>
              <strong>{board.counts.requests}</strong>
              <small>Submitted and not yet in review</small>
            </a>
            <a href={`/workspace/waiting${suffix}`}>
              <span>Pending review</span>
              <strong>{board.counts.waiting}</strong>
              <small>In review, correction, or reassessment</small>
            </a>
            <a href={`/workspace/customers${suffix}`}>
              <span>Approved customers</span>
              <strong>{board.counts.customers}</strong>
              <small>Authoritative approved status</small>
            </a>
            <a href={`/workspace/waiting${suffix}`}>
              <span>Overdue cases</span>
              <strong>{board.counts.overdue}</strong>
              <small>Past the operations hours</small>
            </a>
          </section>
          <section className="dash-grid">
            <article className="panel">
              <h3>Application overview</h3>
              <Donut slices={board.distribution ?? []} />
            </article>
            <article className="panel">
              <header className="panel-head">
                <h3>Recent applications</h3>
                <a href={`/workspace/requests${suffix}`}>View all</a>
              </header>
              <SimpleTable
                rows={(board.recent ?? []).map((item) => [
                  item.id.slice(0, 8),
                  item.legalName,
                  item.customerType.replaceAll('_', ' '),
                  new Date(item.createdAt).toLocaleDateString(),
                  item.status.replaceAll('_', ' '),
                  `/workspace/cases/${item.id}?tenant=${tenantId}`,
                ])}
                headers={['Reference', 'Applicant', 'Type', 'Opened', 'Status', '']}
                empty="No applications were opened in this period."
              />
            </article>
            <article className="panel">
              <header className="panel-head">
                <h3>Waiting list</h3>
                <a href={`/workspace/waiting${suffix}`}>View all</a>
              </header>
              <SimpleTable
                rows={(board.waitingPreview ?? []).map((item) => [
                  item.id.slice(0, 8),
                  item.legalName,
                  item.status.replaceAll('_', ' '),
                  new Date(item.statusChangedAt).toLocaleDateString(),
                  item.dueAt ? new Date(item.dueAt).toLocaleString() : 'No SLA',
                  `/workspace/cases/${item.id}?tenant=${tenantId}`,
                ])}
                headers={['Reference', 'Applicant', 'Stage', 'Waiting since', 'Due', '']}
                empty="No applications are waiting."
              />
            </article>
            <article className="panel">
              <h3>Expiring documents</h3>
              <SimpleTable
                rows={(board.expiring ?? []).map((item) => [
                  item.applicationId.slice(0, 8),
                  item.legalName,
                  item.document,
                  new Date(item.expiresOn).toLocaleDateString(),
                  item.status.replaceAll('_', ' '),
                ])}
                headers={['Reference', 'Applicant', 'Document', 'Expiry', 'Status']}
                empty="No documents are inside the expiry window."
              />
            </article>
          </section>
          <section className="dash-grid">
            <article className="panel">
              <h3>Quick actions</h3>
              <div className="actions">
                {canManage ? <a className="tile" href={`/workspace/company?tenant=${tenantId}#copy`}>Add new company</a> : null}
                {canInvite ? <a className="tile" href={`/workspace/requests${suffix}`}>Send invitation</a> : null}
                {canManage ? <a className="tile" href={`/workspace/company?tenant=${tenantId}#templates`}>Upload templates</a> : null}
                <a className="tile" href="#overview">View this dashboard</a>
              </div>
            </article>
            <article className="panel" id="overview">
              <header className="panel-head">
                <h3>Company profile</h3>
                {canManage ? <a href={`/workspace/company?tenant=${tenantId}`}>Manage</a> : null}
              </header>
              <ul className="readiness">
                <li>Forms are loaded from the template catalogue.</li>
                <li>Answer placements remain blocked until a measured rectangle exists.</li>
                <li>Email delivery is not configured. Invitations return an accept path.</li>
                <li>Approval switches are saved from Settings.</li>
              </ul>
            </article>
          </section>
        </>
      ) : (
        <p className="notice error">The dashboard could not be loaded.</p>
      )}
    </>
  );
}

function Donut({ slices }: { slices: { status: string; count: number }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) {
    return <p className="notice">No applications were opened in this period.</p>;
  }
  let cursor = 0;
  const gradient = slices
    .map((slice, index) => {
      const start = cursor;
      cursor += (slice.count / total) * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
    })
    .join(', ');
  return (
    <div className="overview">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
        <span>{total}</span>
      </div>
      <ul>
        {slices.map((slice) => (
          <li key={slice.status}>
            {slice.status.replaceAll('_', ' ')} · {slice.count} · {Math.round((slice.count / total) * 1000) / 10}%
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) {
    return <p className="notice">{empty}</p>;
  }
  const action = headers[headers.length - 1] === '';
  return (
    <div className="table-wrap">
      <table className="queue">
        <thead>
          <tr>
            {headers.filter((header) => header).map((header) => (
              <th key={header}>{header}</th>
            ))}
            {action ? <th>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')}>
              {row.slice(0, action ? -1 : undefined).map((cell, index) => (
                <td key={`${cell}-${index}`}>{cell}</td>
              ))}
              {action ? (
                <td>
                  <a href={row[row.length - 1]}>View</a>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
