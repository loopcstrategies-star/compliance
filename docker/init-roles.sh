#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v migrator_password="$MYKA_MIGRATOR_PASSWORD" \
  -v app_password="$MYKA_APP_PASSWORD" <<'EOSQL'
CREATE ROLE myka_migrator LOGIN PASSWORD :'migrator_password' BYPASSRLS;
CREATE ROLE myka_app LOGIN PASSWORD :'app_password' NOBYPASSRLS NOSUPERUSER;
GRANT CONNECT, CREATE ON DATABASE myka TO myka_migrator;
GRANT CONNECT ON DATABASE myka TO myka_app;
GRANT USAGE, CREATE ON SCHEMA public TO myka_migrator;
GRANT USAGE ON SCHEMA public TO myka_app;
EOSQL
