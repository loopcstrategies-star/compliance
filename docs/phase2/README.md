# Phase 2 — Authentication and tenant isolation

This note describes the code in the repository. It does not re-run the tests.

## What the code does

Passwords are hashed with Argon2id in `hashPassword` in [apps/api/src/auth/auth.service.ts](../../apps/api/src/auth/auth.service.ts). Login compares the hash with `verify`. A failed password or an unknown email returns 401. More than 10 attempts for one email inside 60 seconds returns 429. The limiter is an in-memory map on the API process.

A session stores the SHA-256 hash of a random token, not the raw token. The browser receives `myka_session` as an HttpOnly cookie, `sameSite` lax, path `/`, for 8 hours (`SESSION_TTL_MS` in [apps/api/src/domain.ts](../../apps/api/src/domain.ts)). `secure` is set only when `COOKIE_SECURE` is `true`. Logout sets `revokedAt`. A tenant id on the request that does not match the user is rejected.

Privileged roles are employee, maker, checker, authorised_approver, and super_admin. Their sessions start with `mfaSatisfied` false. A customer session starts satisfied. Confirming a 6-digit TOTP (SHA1, 30-second period, window 1) sets `mfaSatisfied` and, on the first success, `mfaEnrolledAt`. The secret is stored encrypted. `GET /auth/mfa/setup` returns an otpauth URI only outside production, only for a privileged user, and only while `mfaEnrolledAt` is null. The URI is not written to the log.

`identity_file.read` is a permission key and is not in the super-admin grant list in `ROLE_PERMISSIONS`.

Tenant-owned queries run inside `withTenant`, which sets `app.tenant_id` with `set_config` for the transaction ([apps/api/src/tenant/tenant-context.ts](../../apps/api/src/tenant/tenant-context.ts) and [apps/api/src/prisma/prisma.service.ts](../../apps/api/src/prisma/prisma.service.ts)).

## Migrations

- [20261012180000_init](../../apps/api/prisma/migrations/20261012180000_init/migration.sql) creates tenants, users, sessions, roles, permissions, role grants, and audit events. It enables and forces row-level security on users, sessions, user roles, and audit events.
- [20261013150000_mfa_enrolled](../../apps/api/prisma/migrations/20261013150000_mfa_enrolled/migration.sql) adds `mfa_enrolled_at` on users.

## Tests present

- [apps/api/test/isolation.e2e-spec.ts](../../apps/api/test/isolation.e2e-spec.ts) covers cross-tenant user read and write, a mismatched tenant header, logout, an expired session, MFA before a privileged route, super-admin denial of an identity file, and row-level security for the runtime role.
- [apps/api/test/mfa.e2e-spec.ts](../../apps/api/test/mfa.e2e-spec.ts) covers the current and previous code, another account’s code, and setup hidden in production and from a customer.
- [apps/api/src/tenant/tenant-context.spec.ts](../../apps/api/src/tenant/tenant-context.spec.ts) covers the tenant-context helper.

A full `npm test` was previously reported on 13 Oct 2026 as 10 suites and 28 tests. That result is not a new run for this note.

## Not verified here

This pass did not execute the tests, apply migrations, or query the database. The in-memory login limiter is not described by an end-to-end test in the files above.
