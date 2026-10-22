import { requireArea } from '../../../lib/session';

export default async function HelpPage() {
  await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  return (
    <>
      <h2>Help</h2>
      <section className="panel">
        <h3>Invite an applicant</h3>
        <p>A maker or employee issues a one-time link from New Request. The link opens an application without a password. If email is not configured, copy the accept path. The page does not claim the message was sent.</p>
      </section>
      <section className="panel">
        <h3>Review a case</h3>
        <p>Submitted applications stay in New Request until a maker records the first decision. That moves the case to the waiting list. Approval is the only status that appears in Customer List.</p>
      </section>
      <section className="panel">
        <h3>PDF generation</h3>
        <p>Answer, checkbox, signature, and stamp placements that have not been measured remain blocked during PDF generation. Company Profile is used to upload and save the company logo, stamp, letterhead image, and authorised person’s signature; these image uploads do not replace template-placement measurement.</p>
      </section>
    </>
  );
}
