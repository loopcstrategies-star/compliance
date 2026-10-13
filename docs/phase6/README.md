# Phase 6 — Employee dashboard and follow-up records

This note describes the code in the repository. It does not re-run the tests.

## What the code does

[apps/api/src/operations/operations.service.ts](../../apps/api/src/operations/operations.service.ts) counts one tenant’s cases and lists documents whose `expiresOn` falls inside the expiry lead. Assignment is allowed only for an open stage, and the assignee must hold the role for that stage. A wrong role returns 409 with `Assignee cannot take this stage`.

Defaults, created when a tenant has no policy row, are 48 hours for maker, checker, and approver, 7 days for a draft reminder, 30 days for the expiry lead, and an empty escalation address. `run` records a delivery when a draft or correction has been idle for the reminder period, when a review is overdue, when that overdue age reaches twice the stage limit, and when a document is inside the expiry lead. The kinds are `draft_idle`, `correction`, `review_overdue`, `review_escalation`, and `document_expiry`.

The idempotency key is `tenant:application:kind:yyyy-mm-dd`. A second record for the same key is skipped. `record` sets status `sent` when a recipient address is present and `suppressed` when it is empty. That method writes a database row and does not open a network connection. The repeating timer starts only when `OPERATIONS_TICK` is the string `true`. Tests call `run(now)` directly.

`exportCsv` returns a CSV of id, status, legal name, customer type, document version, assignee id, and status-changed time for the caller’s tenant. The employee page is [apps/web/app/employee/page.tsx](../../apps/web/app/employee/page.tsx).

## Migration

[20261013160000_phase6_operations](../../apps/api/prisma/migrations/20261013160000_phase6_operations/migration.sql) adds `assignee_id`, `status_changed_at`, and `expires_on`, and creates operations policies and deliveries, including a unique idempotency key and forced row-level security.

## Tests present

[apps/api/test/operations.e2e-spec.ts](../../apps/api/test/operations.e2e-spec.ts) covers one tenant’s counts, separated queues, a rejected assignment, processing time, expiry, reminders, and a tenant CSV export.

A full `npm test` was previously reported on 13 Oct 2026 as 10 suites and 28 tests. That result is not a new run for this note.

## Not verified here

This pass did not execute the tests or apply the migration. A live mail provider is not implemented. `sent` means a delivery row was stored, not that a message left the machine. Invitation follow-up and missing-document jobs from the Phase 1 design are not kinds in `run`.
