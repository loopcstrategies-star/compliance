# Phase 4 — Templates, uploads, and packages

This note describes the code in the repository. It does not re-run the tests.

## What the code does

Four source PDFs are registered in [apps/api/src/seed/template-catalogue.ts](../../apps/api/src/seed/template-catalogue.ts): KYC (9 pages), PEP declaration (1), PEP questionnaire (1), and responsible sourcing (2). Generation reads those files and refuses to continue when the file hash does not match the stored template hash ([apps/api/src/packages/package.service.ts](../../apps/api/src/packages/package.service.ts)).

Every form field on the generated plan is returned as blocked with reason `unresolved`. Those slots are not drawn. Letterhead is drawn only when the template owner is `customer`, the letterhead placement status is `measured`, and a rectangle is stored. The KYC letterhead placement is that measured rectangle (`x` 36.55, `y` 734.62, width 123.75, height 78.6). The other three templates do not have a measured letterhead rectangle, so their letterhead stays blocked.

Uploads are checked in [apps/api/src/files/upload.filter.ts](../../apps/api/src/files/upload.filter.ts) and stored through [apps/api/src/files/file.service.ts](../../apps/api/src/files/file.service.ts). The size cap is 10 MB. An image signature requires the authorisation and consent flags. The stored statement says the image is not a qualified electronic signature (`SIGNATURE_STATEMENT` in [apps/api/src/domain.ts](../../apps/api/src/domain.ts)).

## Migration

[20261013120000_phase4_packages](../../apps/api/prisma/migrations/20261013120000_phase4_packages/migration.sql) creates template versions, placements, stored files, documents, signature evidence, letterheads, and generated packages.

## Tests present

[apps/api/test/packages.e2e-spec.ts](../../apps/api/test/packages.e2e-spec.ts) covers rejected uploads (type, size, EICAR, PDF JavaScript), file bytes kept out of the log, cross-tenant file hiding, identity-file purpose and audit, packages whose hash matches the registered template, blocked signature slots absent from the painted list, and customer letterhead inside the measured KYC rectangle. A responsible-sourcing package with a customer owner still matches the source hash and blocks `rspolicy.letterhead`.

A full `npm test` was previously reported on 13 Oct 2026 as 10 suites and 28 tests. That result is not a new run for this note.

## Not verified here

This pass did not execute the tests or open the PDFs. Unresolved answer rectangles in [docs/phase1/field-placement-spec.md](../phase1/field-placement-spec.md) stay unpainted. That is the current generator behavior, not a claim that every rectangle has been measured.
