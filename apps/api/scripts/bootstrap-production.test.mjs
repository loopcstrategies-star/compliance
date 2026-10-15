import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { verify } from 'argon2';
import { assessTarget, runBootstrap } from './bootstrap-production.mjs';

const lines = readFileSync(new URL('../../../.env', import.meta.url), 'utf8').split(/\r?\n/);
function envValue(key) {
  const line = lines.find((item) => item.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).replace(/^["']|["']$/g, '');
}

test('refuses the local myka database and drill databases for production', () => {
  const myka = assessTarget('postgresql://myka_migrator:secret@127.0.0.1:54329/myka', 'production');
  assert.equal(myka.ok, false);
  assert.equal(myka.reason, 'production-target-rejected');
  const drill = assessTarget('postgresql://myka_migrator:secret@127.0.0.1:54329/myka_workflow_check', 'production');
  assert.equal(drill.ok, false);
  const other = assessTarget('postgresql://myka_migrator:secret@example.com:5432/railway', 'production');
  assert.equal(other.ok, false);
  const railway = assessTarget('postgresql://myka_migrator:secret@postgres.railway.internal:5432/railway', 'production');
  assert.equal(railway.ok, true);
  assert.equal(railway.hostClass, 'railway-internal');
  assert.equal(railway.database, 'railway');
});

test('isolated mode accepts only myka_bootstrap_check on local port 54329', () => {
  const accepted = assessTarget('postgresql://myka_migrator:secret@127.0.0.1:54329/myka_bootstrap_check', 'isolated');
  assert.equal(accepted.ok, true);
  const rejected = assessTarget('postgresql://myka_migrator:secret@127.0.0.1:54329/myka', 'isolated');
  assert.equal(rejected.ok, false);
});

test('creates one platform super-admin and refuses a second run', async () => {
  const password = envValue('MYKA_MIGRATOR_PASSWORD');
  assert.ok(password, 'missing-migrator-password');
  const database = 'myka_bootstrap_check';
  const sql = spawnSync('docker', ['exec', '-i', 'compliance-postgres-1', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: [
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`,
      `DROP DATABASE IF EXISTS ${database};`,
      `CREATE DATABASE ${database};`,
      `GRANT CONNECT, CREATE ON DATABASE ${database} TO myka_migrator;`,
      `GRANT CONNECT ON DATABASE ${database} TO myka_app;`,
    ].join('\n'),
    encoding: 'utf8',
  });
  assert.equal(sql.status, 0, sql.stderr);
  const connectionString = `postgresql://myka_migrator:${encodeURIComponent(password)}@127.0.0.1:54329/${database}`;
  const parsed = new URL(connectionString);
  assert.equal(parsed.hostname, '127.0.0.1');
  assert.equal(parsed.port, '54329');
  assert.equal(parsed.pathname, `/${database}`);
  const schema = spawnSync('docker', ['exec', '-i', 'compliance-postgres-1', 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', 'GRANT USAGE, CREATE ON SCHEMA public TO myka_migrator; GRANT USAGE ON SCHEMA public TO myka_app;'], {
    encoding: 'utf8',
  });
  assert.equal(schema.status, 0, 'schema-grant-failed');
  const migrated = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: connectionString },
    encoding: 'utf8',
    shell: true,
  });
  assert.equal(migrated.status, 0, 'migrate-failed');
  const adminPassword = 'isolated-bootstrap-password';
  const created = await runBootstrap({
    connectionString,
    email: 'Admin.Bootstrap@example.com',
    password: adminPassword,
    mode: 'isolated',
  });
  assert.equal(created.status, 'created');
  assert.equal(created.email, 'admin.bootstrap@example.com');
  assert.equal(created.counts.users, 1);
  assert.equal(created.counts.tenants, 1);
  const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });
  try {
    const row = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin.bootstrap@example.com' },
      include: { tenant: true, roles: { include: { role: true } } },
    });
    assert.equal(row.tenant.name, 'Platform');
    assert.equal(row.tenant.isSystem, true);
    assert.equal(row.displayName, 'Administrator');
    assert.deepEqual(row.roles.map((item) => item.role.key), ['super_admin']);
    assert.equal(await verify(row.passwordHash, adminPassword), true);
    assert.equal(await prisma.customer.count(), 0);
  } finally {
    await prisma.$disconnect();
  }
  const repeated = await runBootstrap({
    connectionString,
    email: 'other@example.com',
    password: adminPassword,
    mode: 'isolated',
  });
  assert.equal(repeated.status, 'aborted');
  assert.equal(repeated.reason, 'existing-users');
  const after = new PrismaClient({ datasources: { db: { url: connectionString } } });
  try {
    assert.equal(await after.user.count(), 1);
    assert.equal(await after.user.findUnique({ where: { email: 'other@example.com' } }), null);
  } finally {
    await after.$disconnect();
  }
});
