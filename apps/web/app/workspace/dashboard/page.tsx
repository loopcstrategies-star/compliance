import type { ReactNode } from 'react';
import { requireArea } from '../../../lib/session';
import { Icon } from '../../icons';
import { loadBoard, resolveTenant } from '../load-board';

const STATUS_COLOR: Record<string, string> = {
  approved: '#1d4ed8',
  maker_review: '#7c3aed',
  checker_review: '#c2410c',
  correction: '#be123c',
  reassessment: '#b45309',
  submitted: '#0f766e',
  draft: '#64748b',
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tenant?: string; days?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const days = query.days === '60' || query.days === '90' ? Number(query.days) : 30;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const board = failed ? null : await loadBoard('dashboard', tenantId, days);
  const company = tenants.find((tenant) => tenant.id === tenantId)?.name ?? 'This company';
  const suffix = `?tenant=${encodeURIComponent(tenantId)}`;
  const caseHref = (id: string) => `/workspace/cases/${id}?tenant=${tenantId}`;
  const canInvite = me.roles.some((role) => role === 'maker' || role === 'employee');
  const canManage = me.roles.includes('super_admin');
  return (
    <>
      <header className="dash-head">
        <div>
          <h2>Welcome back, {me.displayName}</h2>
          <p>Here&apos;s what&apos;s happening with KYC onboarding today.</p>
        </div>
        <div className="dash-tools">
          {tenants.length > 0 ? (
            <form className="company-pill" action="/workspace/dashboard">
              <Icon name="building" />
              <label>
                <span className="sr-only">Company</span>
                <select name="tenant" defaultValue={tenantId} aria-label="Company">
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="days" value={days} />
              <button type="submit">Show</button>
            </form>
          ) : null}
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
            <Kpi href={`/workspace/dashboard?days=${days}&tenant=${tenantId}`} icon="file" tone="file" value={board.counts.total ?? 0} label="Total applications" />
            <Kpi href={`/workspace/requests${suffix}`} icon="clock" tone="clock" value={board.counts.requests} label="New requests" />
            <Kpi href={`/workspace/waiting${suffix}`} icon="hourglass" tone="hourglass" value={board.counts.waiting} label="Pending review" />
            <Kpi href={`/workspace/customers${suffix}`} icon="check" tone="check" value={board.counts.customers} label="Approved customers" />
            <Kpi href={`/workspace/waiting${suffix}`} icon="alert" tone="alert" value={board.counts.overdue} label="Overdue cases" />
          </section>
          <section className="dash-split">
            <article className="panel">
              <header className="panel-head">
                <h3><Icon name="chart" /> Application overview</h3>
              </header>
              <Donut slices={board.distribution ?? []} />
            </article>
            <article className="panel">
              <header className="panel-head">
                <h3><Icon name="file" /> Recent applications</h3>
                <a href={`/workspace/requests${suffix}`}>View all</a>
              </header>
              <DataTable
                headers={['Reference', 'Applicant', 'Type', 'Opened', 'Status', 'Action']}
                empty="No applications were opened in this period."
                rows={(board.recent ?? []).map((item) => ({
                  key: item.id,
                  cells: [
                    item.id.slice(0, 8).toUpperCase(),
                    item.legalName,
                    label(item.customerType),
                    new Date(item.createdAt).toLocaleDateString(),
                    <span key={item.status} className={`chip ${item.status}`}>{label(item.status)}</span>,
                    <a key="view" href={caseHref(item.id)}>View</a>,
                  ],
                }))}
              />
            </article>
          </section>
          <section className="dash-split even">
            <article className="panel">
              <header className="panel-head">
                <h3><Icon name="clock" /> Waiting list</h3>
                <a href={`/workspace/waiting${suffix}`}>View all</a>
              </header>
              <DataTable
                headers={['Reference', 'Applicant', 'Stage', 'Waiting since', 'Due', 'Action']}
                empty="No applications are waiting."
                rows={(board.waitingPreview ?? []).map((item) => ({
                  key: item.id,
                  cells: [
                    item.id.slice(0, 8).toUpperCase(),
                    item.legalName,
                    <span key={item.status} className={`chip ${item.overdue ? 'overdue' : item.status}`}>{label(item.status)}</span>,
                    new Date(item.statusChangedAt).toLocaleDateString(),
                    item.dueAt ? new Date(item.dueAt).toLocaleDateString() : 'No SLA',
                    <a key="review" href={caseHref(item.id)}>Review</a>,
                  ],
                }))}
              />
            </article>
            <article className="panel">
              <header className="panel-head">
                <h3><Icon name="calendar" /> Expiring documents</h3>
              </header>
              <DataTable
                headers={['Reference', 'Applicant', 'Document', 'Expiry', 'Status']}
                empty="No documents are inside the expiry window."
                rows={(board.expiring ?? []).map((item) => ({
                  key: item.id,
                  cells: [
                    item.applicationId.slice(0, 8).toUpperCase(),
                    item.legalName,
                    item.document,
                    new Date(item.expiresOn).toLocaleDateString(),
                    <span key={item.status} className={`chip ${item.status}`}>{label(item.status)}</span>,
                  ],
                }))}
              />
            </article>
          </section>
          <section className="dash-split">
            <article className="panel">
              <h3><Icon name="bars" /> Quick actions</h3>
              <div className="quick-grid">
                {canManage ? <Action href="/workspace/company/onboarding" icon="plus" title="Add new company" text="Create an onboarding company for customer invitations." /> : null}
                {canInvite ? <Action href={`/workspace/requests${suffix}`} icon="send" title="Send invitation" text="Issue a one-time onboarding link." /> : null}
                {canManage ? <Action href={`/workspace/company/branding?tenant=${tenantId}`} icon="upload" title="Company branding" text="Upload the company logo, stamp, letterhead, and authorised signature." /> : null}
                <Action href="#overview" icon="chart" title="View reports" text="The counts on this page are the report." />
              </div>
            </article>
            <article className="company-card" id="overview">
              <header className="panel-head">
                <h3><Icon name="building" /> Company profile</h3>
                {canManage ? <a href="/workspace/company">Manage</a> : null}
              </header>
              <p><strong>{company}</strong></p>
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

function Kpi({ href, icon, tone, value, label: text }: { href: string; icon: string; tone: string; value: number; label: string }) {
  return (
    <a className={`kpi ${tone}`} href={href}>
      <span className="kpi-icon"><Icon name={icon} /></span>
      <strong>{value}</strong>
      <span>{text}</span>
    </a>
  );
}

function Action({ href, icon, title, text }: { href: string; icon: string; title: string; text: string }) {
  return (
    <a className="tile" href={href}>
      <span className="kpi-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <small>{text}</small>
    </a>
  );
}

function Donut({ slices }: { slices: { status: string; count: number }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) {
    return <p className="notice">No applications were opened in this period.</p>;
  }
  let cursor = 0;
  const gradient = slices
    .map((slice) => {
      const start = cursor;
      cursor += (slice.count / total) * 100;
      return `${STATUS_COLOR[slice.status] ?? '#64748b'} ${start}% ${cursor}%`;
    })
    .join(', ');
  return (
    <div className="overview">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
        <span>{total}</span>
      </div>
      <ul className="legend">
        {slices.map((slice) => (
          <li key={slice.status}>
            <span><i className="swatch" style={{ background: STATUS_COLOR[slice.status] ?? '#64748b' }} />{label(slice.status)}</span>
            <span>{slice.count} · {Math.round((slice.count / total) * 1000) / 10}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="notice">{empty}</p>;
  }
  return (
    <div className="table-wrap">
      <table className="queue">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => <td key={headers[index]}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}
