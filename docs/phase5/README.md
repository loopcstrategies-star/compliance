# Phase 5 — Maker, checker, and final approver

This note describes the code in the repository. It does not re-run the tests.

## What the code does

Submit records a submission with the current document version and the generated package ids ([apps/api/src/reviews/review.service.ts](../../apps/api/src/reviews/review.service.ts)). Decisions are append-only until `supersededAt` is set. The queue filter shows a maker only `submitted`, a checker only `maker_review`, and an authorised approver only `checker_review`. Customer, employee, and super-admin are not limited to one of those stages. A customer still sees only their own application.

Segregation defaults require the maker, checker, and approver to be different people. A conflict returns 409 with `Segregation policy rejects this assignment`. The maker role does not include `review.approve`. A stale document version returns 409 with `Document version is stale`. The wrong stage returns 400 with `This stage is not open`.

[apps/api/src/reviews/material-change.ts](../../apps/api/src/reviews/material-change.ts) moves an open review (`submitted`, `maker_review`, `checker_review`) to `correction`, and an `approved` case to `reassessment`. Both paths increment `documentVersion`, set `statusChangedAt`, and supersede the open submission and its decisions. The approved package bytes are not rewritten by that status change. The compliance workspace is [apps/web/app/compliance/page.tsx](../../apps/web/app/compliance/page.tsx).

## Migration

[20261013140000_phase5_workflow](../../apps/api/prisma/migrations/20261013140000_phase5_workflow/migration.sql) adds `document_version` and creates segregation policies, submissions, and review decisions.

## Tests present

[apps/api/test/workflow.e2e-spec.ts](../../apps/api/test/workflow.e2e-spec.ts) covers self-approval, overlapping roles, another tenant, a return that cannot skip ahead, a new package that invalidates the open version, and reassessment after approval that leaves the approved package bytes unchanged.

A full `npm test` was previously reported on 13 Oct 2026 as 10 suites and 28 tests. That result is not a new run for this note.

## Not verified here

This pass did not execute the tests or apply the migration. Completeness lists gaps and does not itself approve a case; that behavior lives in the review service and is not restated here as a fresh test result.
