# Phase 3 — Invitations and onboarding drafts

This note describes the code in the repository. It does not re-run the tests.

## What the code does

Customer onboarding starts from an invitation. `INVITATION_TTL_MS` in [apps/api/src/domain.ts](../../apps/api/src/domain.ts) is 7 days. Invitation issue, accept, revoke, and single use are implemented in [apps/api/src/invitations/invitation.service.ts](../../apps/api/src/invitations/invitation.service.ts). The raw invitation token is not written to the log.

A customer, an application, and answers belong to one tenant. Answers are saved against the form catalogue in [apps/api/src/seed/form-catalogue.ts](../../apps/api/src/seed/form-catalogue.ts). An unknown field is rejected. Customer type selects which templates and checklist rows apply. The domestic VAT checklist row is required for a local company. An extra checklist category is visible only in the tenant that owns it. The customer portal is [apps/web/app/portal/page.tsx](../../apps/web/app/portal/page.tsx).

## Migration

[20261013000000_phase3_drafts](../../apps/api/prisma/migrations/20261013000000_phase3_drafts/migration.sql) creates customers, invitations, form schemas, form fields, applicability rules, checklist categories, applications, and answers.

## Tests present

[apps/api/test/drafts.e2e-spec.ts](../../apps/api/test/drafts.e2e-spec.ts) covers a used, revoked, or expired invitation and the raw token staying out of the log; another tenant’s draft hidden and an unknown field rejected; the domestic VAT row required only for a local company; and an extra checklist category shown only in its tenant.

A full `npm test` was previously reported on 13 Oct 2026 as 10 suites and 28 tests. That result is not a new run for this note.

## Not verified here

This pass did not execute the tests or apply the migration. Individual onboarding does not add questions beyond the form catalogue; that limit is configuration in the catalogue, not a separate test named in this file beyond the unknown-field rejection.
