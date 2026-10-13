# Architecture

Phase 1 design. Later phases implement the modules described here. No production region is selected.

## System

One deployable application. One shared backend. One multi-tenant database. Four role-separated interfaces live in the same web application and call the same API:

| Interface | Who uses it | What it is for |
| --- | --- | --- |
| Customer portal | Invited customer users | Drafts, answers, uploads, signature, submission package |
| Compliance workspace | Maker, checker, authorised approver | Review, evidence, the three-stage workflow |
| Employee dashboard | Tenant staff who are not the compliance decision path | Queues, processing times, expiry, follow-up workload |
| Super-admin | Platform operators | Tenants, template versions, checklist configuration, retention policy |

Adding a tenant is a data row and configuration. It does not copy the codebase.

The repository uses that stack: a TypeScript monorepo, a NestJS API that owns business rules, a Next.js app for the four interfaces, PostgreSQL, and Prisma migrations. Object storage sits behind an interface. The provider and region stay unselected. The Phase 7 comparison records prices and leaves the selection empty. PDF generation overlays the immutable source bytes with `pdf-lib`. It does not redraw the templates.

## Backend modules

Each module is a server boundary. The browser does not enforce tenancy, approval, or document rules.

| Module | Responsibility |
| --- | --- |
| Authentication | Sessions, MFA for privileged users, rate limits |
| Tenants | Tenant lifecycle and settings |
| Users and permissions | Roles and permission checks |
| Invitations | Token issue, expiry, revocation, single use |
| Customers | Customer party and customer type |
| Applications | Onboarding case, status, version |
| Form schemas | Versioned mapping from template fields to inputs, including configured extra checklist rows |
| Answers | Values for source fields and configured fields |
| Ownership and beneficial owners | The three repeating tables and the 5% rule as data, not as a client-only table |
| Documents | Uploads, checklist row, domestic/international line, malware scan state |
| Templates | The four registered PDFs, version, letterhead owner |
| PDF generation | Overlay using the placement spec. Unresolved rectangles block generation of that slot |
| Signature evidence | Method, explicit authorisation, consent, evidence. Image signatures are not treated as verifiable electronic signatures |
| Compliance reviews | Maker and checker outcomes, reasons, document version |
| Approvals | Authorised final approver. Segregation of duties |
| Risk assessments | Human risk decision. An assistive classifier may suggest completeness. It cannot approve |
| Notifications | Delivery records and duplicate suppression |
| Scheduled jobs | Idempotent reminders and escalations |
| Reporting | Figures read from the database, with permission-filtered exports |
| Retention | Policy, legal hold, deletion approval, quarantine before irreversible delete |
| Audit | Append-only events, including sensitive-file access |

## Tenant data model

Every tenant-owned row has `tenantId`, or a parent that has it and is the only access path. Parent ownership that is allowed:

- An answer belongs to an application. The application has `tenantId`.
- A file belongs to a document. The document belongs to an application or to a tenant-owned template asset.
- A beneficial-owner row belongs to an application.
- An audit event for a tenant record carries that `tenantId`.

Platform tables that are not tenant data: the global template registry (the four source PDFs and their hashes), permission catalogues, and the cloud-region decision record once it exists. A tenant's letterhead image is tenant data even if the template definition is global.

Prisma migrations are the only schema change path. Cross-tenant foreign keys are not allowed. A row in tenant A cannot reference a customer, file, or user in tenant B.

Access goes through tenant-scoped repositories. Those repositories set the PostgreSQL session variable used by row-level security (for example `app.tenant_id`) inside the transaction, then query. RLS is a second barrier, not a substitute for the repository filter. Background workers set the tenant context explicitly for each job. A worker with a database role that bypasses RLS is not used for tenant data.

Super-admin does not imply access to customer identity files. Opening a passport, licence, or generated KYC package requires a separate permission, a recorded business purpose, and an audit event. List and search results omit those file bytes.

## Document model

The source files in `docs/templates/source/` are version 1 of each template. Hashes are in the template registry. Later edits create a new template version. Submitted packages store the template version they were built from and are immutable.

Letterhead owner is a column on the document type, not a global switch. Defaults from the registry: KYC uses the MYKA header already in the PDF; the PEP forms and the responsible sourcing policy do not take a customer letterhead.

Customer type (local company, foreign company, mine, individual) selects which templates and which of the 13 checklist rows apply. It does not add questions that are not in the field inventory. Extra checklist categories are configuration rows with an effective date, not edits to the KYC PDF.

Domestic and international text on KYC items 8–11 stays as printed. Each of those item numbers has one Yes, one No, and one Comments cell.

Generation may not run for a slot whose placement status is `unresolved`. The responsible sourcing policy body is not regenerated from markdown. The PDF bytes are preserved, and only the Name, Signature, and Stamp slots are overlaid after their page-point rectangles are calibrated.

## Approval

States, in order: draft, submitted, maker review, checker review, authorised approval. Corrections return the case to the step the segregation rules require and clear the review states those rules name. A material change after approval opens a controlled reassessment. It does not silently edit the approved package.

A user cannot approve their own maker work. Maker, checker, and authorised approver are different people when the segregation rule says so. Conflicting assignments are rejected by the server. Each outcome stores the actor, the reason, the evidence ids, the timestamp, and the document version.

## Jobs and retention

The job list is the design: invitation follow-up, incomplete draft, missing document, correction request, review SLA, expiry reminder, escalation. Each designed job has an idempotency key, a retry policy, a delivery record, and a duplicate-notification check. Phase 6 records `draft_idle`, `correction`, `review_overdue`, `review_escalation`, and `document_expiry` with an idempotency key. A live mail provider is outside this design. Invitation follow-up and missing-document jobs are still design items.

Retention policies have an effective date, a record category, and a legal-hold flag. Deletion requires an approval. The first step is soft-delete or quarantine. Irreversible deletion refuses rows under a legal hold. Backup and replica expiry has to follow the same policy once a provider is chosen. No provider is chosen in this phase.

## What is explicitly not decided

- Cloud provider, region, and monthly cost. Phase 7 records a price comparison. The selected provider and region stay empty.
- Staging and production accounts, and CI, stay undecided. Local backup tooling is Phase 8. It is not a production restore.
- Answer-rectangle coordinates still marked `unresolved` in the placement spec.
- Business data is not deleted or reset without a reviewed migration plan and a verified backup.
