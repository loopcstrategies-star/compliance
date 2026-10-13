# Operations

The selected host and region stay empty. See [the cloud comparison](../phase7/cloud-comparison.md). This note describes the local application and how to recover it. It does not deploy production.

## Run

1. Copy `.env.example` to `.env`. Set the PostgreSQL and application role passwords, the database URLs, `MFA_ENCRYPTION_KEY`, `WEB_ORIGIN`, and `API_INTERNAL_URL` on the machine. Do not commit `.env`.
2. Start PostgreSQL with `docker compose up -d` from the repository root. The role script runs only when the data volume is first created.
3. From `apps/api`, apply migrations with `npx prisma migrate deploy`.
4. Start the API with `npm run dev:api` and the web app with `npm run dev:web`.
5. Open `http://localhost:3000`. Staff accounts must enroll an authenticator from the verification page before the first successful code. The setup QR is shown only in development and only until that code is accepted.

`GET http://localhost:3001/health` returns `{ "status": "ok" }` when the API process is up.

## Watch

Watch the API process, the PostgreSQL container health check, failed sign-ins, and delivery rows whose status is `failed`. Identity-file downloads are written to the audit log with a purpose. File bytes, passwords, and authenticator secrets are not written to the log.

## Recover

Set `BACKUP_ENCRYPTION_KEY` to 32 bytes of base64 in the shell, not in git. From `apps/api`, run:

```
node scripts/backup-restore.mjs
```

The script dumps `myka`, encrypts the dump with AES-256-GCM, restores it into `myka_restore_check`, checks that the tenant count matches, and drops the temporary database. To recover the live database, decrypt a saved copy of that dump with the same key and restore it with `psql` only after the current data has been copied aside. Do not run that restore against the live database as a drill.
