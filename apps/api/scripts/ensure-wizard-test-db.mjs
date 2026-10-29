import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env') });

const migratorPass = process.env.MYKA_MIGRATOR_PASSWORD;
const appPass = process.env.MYKA_APP_PASSWORD;
if (!migratorPass || !appPass) {
  console.error('MYKA_MIGRATOR_PASSWORD and MYKA_APP_PASSWORD are required');
  process.exit(1);
}

const db = 'myka_network_test_20261029';
const container = 'compliance-postgres-1';
const out = path.join(root, '.env.network-test');

function dockerPsql(args, input) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', ...args], {
    input,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const exists = dockerPsql(['-tAc', `SELECT 1 FROM pg_database WHERE datname='${db}'`]).trim();
if (exists) {
  console.error(
    `Database ${db} already exists. Refusing to grant permissions, modify the database, or overwrite .env.network-test.`,
  );
  process.exit(1);
}

dockerPsql(['-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${db}`]);
dockerPsql([
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  `GRANT CONNECT, CREATE ON DATABASE ${db} TO myka_migrator; GRANT CONNECT ON DATABASE ${db} TO myka_app;`,
]);
dockerPsql([
  '-d',
  db,
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  'GRANT USAGE, CREATE ON SCHEMA public TO myka_migrator; GRANT USAGE ON SCHEMA public TO myka_app;',
]);

const migUrl = `postgresql://myka_migrator:${encodeURIComponent(migratorPass)}@127.0.0.1:54329/${db}`;
const appUrl = `postgresql://myka_app:${encodeURIComponent(appPass)}@127.0.0.1:54329/${db}`;
fs.writeFileSync(out, `DATABASE_URL=${migUrl}\nAPP_DATABASE_URL=${appUrl}\n`, 'utf8');
console.log(`ready isolated local database ${db}`);
