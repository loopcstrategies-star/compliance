import { spawnSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const DRILL_DATABASE = 'myka_backup_drill';
const RESTORE_DATABASE = 'myka_restore_check';
const ALLOWED_DATABASES = new Set([DRILL_DATABASE, RESTORE_DATABASE]);
const LOCAL_PORTS = new Set(['127.0.0.1:54329', 'localhost:54329', '0.0.0.0:54329']);

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const APPLICATION_ID = '33333333-3333-4333-8333-333333333333';
const FILE_ID = '44444444-4444-4444-8444-444444444444';
const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555';
const AUDIT_ID = '66666666-6666-4666-8666-666666666666';
const STORAGE_KEY = '88888888-8888-4888-8888-888888888888';

const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? '', 'base64');
if (key.length !== 32) {
  console.error('BACKUP_ENCRYPTION_KEY must be 32 bytes of base64 and must stay outside git.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const published = spawnSync('docker', ['compose', 'port', 'postgres', '5432'], {
  cwd: root,
  encoding: 'utf8',
});
const port = (published.stdout ?? '').trim();
if (published.status !== 0 || !LOCAL_PORTS.has(port)) {
  console.error('Refusing to run: PostgreSQL is not the local drill port.');
  process.exit(1);
}

function compose(args, input) {
  const databaseFlag = args.indexOf('-d');
  if (databaseFlag !== -1 && !ALLOWED_DATABASES.has(args[databaseFlag + 1])) {
    throw new Error('Refusing a database outside the drill allowlist.');
  }
  const statement = args.includes('-c') ? args[args.indexOf('-c') + 1] : '';
  if (statement) {
    const allowed = statement.match(/^(DROP DATABASE IF EXISTS|CREATE DATABASE) (myka_backup_drill|myka_restore_check)$/);
    if (!allowed || !ALLOWED_DATABASES.has(allowed[2])) {
      throw new Error('Refusing a database statement outside the drill allowlist.');
    }
  }
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', ...args], {
    cwd: root,
    input,
    encoding: 'buffer',
  });
  if (result.status !== 0) {
    throw new Error('docker compose failed');
  }
  return result.stdout;
}

function recreate(name) {
  compose(['psql', '-U', 'postgres', '-c', `DROP DATABASE IF EXISTS ${name}`]);
  compose(['psql', '-U', 'postgres', '-c', `CREATE DATABASE ${name}`]);
}

let directory;
try {
  directory = mkdtempSync(path.join(tmpdir(), 'myka-backup-'));
  const filePath = path.join(directory, STORAGE_KEY);
  const bytes = Buffer.from('MYKA backup drill file');
  writeFileSync(filePath, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Synthetic checksum was not produced.');
  }

  recreate(DRILL_DATABASE);
  const seed = `
CREATE TABLE tenants (id UUID PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE customers (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), legal_name TEXT NOT NULL);
CREATE TABLE applications (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), customer_id UUID NOT NULL REFERENCES customers(id));
CREATE TABLE stored_files (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), storage_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL);
CREATE TABLE documents (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), application_id UUID NOT NULL REFERENCES applications(id), file_id UUID NOT NULL REFERENCES stored_files(id));
CREATE TABLE audit_events (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id), action TEXT NOT NULL);
INSERT INTO tenants (id, name) VALUES ('${TENANT_ID}', 'Drill Tenant');
INSERT INTO customers (id, tenant_id, legal_name) VALUES ('${CUSTOMER_ID}', '${TENANT_ID}', 'Drill Metals');
INSERT INTO applications (id, tenant_id, customer_id) VALUES ('${APPLICATION_ID}', '${TENANT_ID}', '${CUSTOMER_ID}');
INSERT INTO stored_files (id, tenant_id, storage_key, sha256) VALUES ('${FILE_ID}', '${TENANT_ID}', '${STORAGE_KEY}', '${sha256}');
INSERT INTO documents (id, tenant_id, application_id, file_id) VALUES ('${DOCUMENT_ID}', '${TENANT_ID}', '${APPLICATION_ID}', '${FILE_ID}');
INSERT INTO audit_events (id, tenant_id, action) VALUES ('${AUDIT_ID}', '${TENANT_ID}', 'backup.drill');
`;
  compose(['psql', '-U', 'postgres', '-d', DRILL_DATABASE, '-v', 'ON_ERROR_STOP=1'], Buffer.from(seed));

  const dump = compose(['pg_dump', '-U', 'postgres', '-d', DRILL_DATABASE, '--no-owner', '--no-acl']);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(dump), cipher.final()]);
  const encryptedPath = path.join(directory, 'myka.dump.enc');
  writeFileSync(encryptedPath, Buffer.concat([iv, cipher.getAuthTag(), ciphertext]));

  const payload = readFileSync(encryptedPath);
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  const sql = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);

  recreate(RESTORE_DATABASE);
  compose(['psql', '-U', 'postgres', '-d', RESTORE_DATABASE, '-v', 'ON_ERROR_STOP=1'], sql);

  const check = `
SELECT CASE
  WHEN (SELECT count(*) FROM tenants) = 1
   AND (SELECT count(*) FROM documents d JOIN stored_files f ON f.id = d.file_id AND f.tenant_id = d.tenant_id) = 1
   AND (SELECT count(*) FROM audit_events WHERE action = 'backup.drill') = 1
   AND (SELECT sha256 FROM stored_files WHERE storage_key = '${STORAGE_KEY}') = '${sha256}'
  THEN 'ok' ELSE 'mismatch' END;
`;
  const verdict = compose(['psql', '-U', 'postgres', '-d', RESTORE_DATABASE, '-t', '-A', '-v', 'ON_ERROR_STOP=1'], Buffer.from(check))
    .toString()
    .trim();
  const restoredHash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  if (verdict !== 'ok' || restoredHash !== sha256) {
    throw new Error('Restored drill data did not match the synthetic source.');
  }
  console.log('backup-ok');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'backup drill failed');
  process.exitCode = 1;
} finally {
  if (directory) {
    try {
      compose(['psql', '-U', 'postgres', '-c', `DROP DATABASE IF EXISTS ${DRILL_DATABASE}`]);
      compose(['psql', '-U', 'postgres', '-c', `DROP DATABASE IF EXISTS ${RESTORE_DATABASE}`]);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'drill cleanup failed');
      process.exitCode = 1;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}
