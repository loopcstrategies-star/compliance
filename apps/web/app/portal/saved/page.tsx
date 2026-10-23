import Link from 'next/link';
import { requireArea } from '../../../lib/session';
import { Shell } from '../../shell';

export default async function PortalSavedPage() {
  const me = await requireArea(['customer']);
  return (
    <Shell title="Customer portal" me={me}>
      <section className="panel portal-status-panel">
        <h1>Draft saved</h1>
        <p className="notice">
          Your answers are stored on the server. You can leave this page and continue later from the same account — nothing has been
          submitted for review.
        </p>
        <p>
          <Link className="button-link" href="/portal">
            Continue application
          </Link>
        </p>
      </section>
    </Shell>
  );
}
