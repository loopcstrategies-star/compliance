# Self-hosted operation

This is the same application on a machine you control. It is not a Vercel or Railway deployment. No cloud provider or region is selected.

A development PC is not a suitable permanent public host. A public service needs network controls, restricted administration, availability, backups, and someone responsible for them. Those controls are outside this repository.

## What runs

- PostgreSQL 16 from [docker-compose.yml](../../docker-compose.yml), with the named volume `myka_pg` so rows survive a restart
- The NestJS API from `apps/api`
- The Next.js application from `apps/web`
- Private files on disk through `FILE_STORAGE_DIR`

There is no Redis service. The application does not need one.

## Storage

Local development and this self-hosted layout use the same private directory. `FILE_STORAGE_DIR` is a folder on the host. When it is unset, the API uses `apps/api/storage`. That folder is gitignored. The web server does not publish it. Downloads go through the API, which checks the caller, and identity-file reads require a separate permission and a purpose.

Put the production directory on storage that survives a restart and is not a public web root. Keep a copy of that directory with the database backup. The database stores the file key and checksum. The bytes live only in that directory.

## Sessions and staff sign-in

Set `WEB_ORIGIN` to the web origin and `API_INTERNAL_URL` to the API the web process can reach. The session cookie is HttpOnly. Set `COOKIE_SECURE` to `true` only when the site is served over HTTPS.

Set `NODE_ENV` to `production` on the public process. That hides the authenticator setup QR. Staff and administrators still must enter a valid code. Enrollment has to happen before that production setting is turned on, or through a process that does not expose the secret in logs.

## Start and stop

Start PostgreSQL with `docker compose up -d` and apply migrations with `npm run prisma:deploy -w apps/api` before serving traffic. Build with `npm run build -w apps/api` and `npm run build -w apps/web`, then start with `npm run start -w apps/api` and `npm run start -w apps/web`.

Stop the Node processes, then `docker compose stop`. That leaves the database volume and the file directory in place.

## Backup

The drill in [operations.md](operations.md) checks encrypt and restore on temporary databases. It does not replace a backup of the live database and the private file directory. Take that backup on the self-hosted machine and store it where the application does not serve it.
