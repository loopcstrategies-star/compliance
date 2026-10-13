# Operations

The selected host and region stay empty. See [the cloud comparison](../phase7/cloud-comparison.md). Windows development is in [local-windows.md](local-windows.md). A machine you operate is in [self-hosted.md](self-hosted.md). This note does not deploy to Vercel or Railway.

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

The script refuses to run unless the local PostgreSQL port is 54329. It creates synthetic rows in `myka_backup_drill`, writes one synthetic file in a temporary directory, encrypts that dump with AES-256-GCM, restores it into `myka_restore_check`, checks the tenant, the document-to-file link, the audit row, and the file checksum, then drops only those two drill databases. It does not dump or drop `myka`. To recover the live database, take a separate dump and restore it with `psql` only after the current data has been copied aside. Do not run that restore against the live database as a drill.
