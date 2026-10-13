# Local setup on Windows

This is the development setup. A personal computer is not a public production host. It does not provide the network controls, availability, backups, or monitoring that a public service needs. Self-hosting on a machine you operate is described in [self-hosted.md](self-hosted.md). No cloud host is selected.

## Prerequisites

- Node.js with npm
- Docker, with the Docker engine running

## Environment

Copy `.env.example` to `.env` in the repository root. Set these names on that machine. Do not commit `.env`.

- `POSTGRES_PASSWORD`
- `MYKA_MIGRATOR_PASSWORD`
- `MYKA_APP_PASSWORD`
- `DATABASE_URL`
- `APP_DATABASE_URL`
- `MFA_ENCRYPTION_KEY`
- `WEB_ORIGIN` as `http://localhost:3000`
- `API_INTERNAL_URL` as `http://localhost:3001`
- `FILE_STORAGE_DIR` for a private folder, or leave it empty to use `apps/api/storage`
- `SEED_DEMO_PASSWORD` only when creating local development accounts
- `BACKUP_ENCRYPTION_KEY` in the shell when running the backup drill, not in git

`FILE_STORAGE_DIR` and `apps/api/storage` are outside git. Files written there remain after the API process stops.

## Start

From the repository root:

```
docker compose up -d
```

Wait until the PostgreSQL health check is healthy. The role script runs only when the data volume is first created. Then:

```
npm run prisma:deploy -w apps/api
npm run dev:api
npm run dev:web
```

Open `http://localhost:3000`. The web app calls the API through `API_INTERNAL_URL`. The session cookie is HttpOnly. Staff and administrators must complete an authenticator code. In development, the setup QR is shown until the first accepted code.

`GET http://localhost:3001/health` returns `{ "status": "ok" }` when the API is up.

## Stop

Stop the API and web processes in their terminals. Then:

```
docker compose stop
```

`docker compose stop` keeps the database volume. Do not remove the volume if you need the existing rows.

## Tests

`npm test` from the repository root resets every tenant row in the database named by `DATABASE_URL`. Point that process at a separate database before a test run. Do not aim it at the database you use for local sign-in.

There is no ESLint script. Typecheck the API with `npx tsc --noEmit` in `apps/api`, and the web app with `npx tsc --noEmit` in `apps/web`.

## Troubleshooting

- Sign-in says the details were not accepted when the email is absent or the password does not match. The API tests delete users in the database they are given.
- A privileged account with no completed authenticator enrollment is sent to the verification page. The QR is hidden after a valid code, and it is hidden entirely when `NODE_ENV` is `production`.
- If `GET /health` fails, the API process is not listening on port 3001.
- If the web pages load and the API calls fail, check that `API_INTERNAL_URL` is `http://localhost:3001` and that the API process is running.
