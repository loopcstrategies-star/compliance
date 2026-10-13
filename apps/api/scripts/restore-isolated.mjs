import { spawnSync } from 'node:child_process';
import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const DESTINATION = 'myka_accept_restore';
const READ_ONLY = new Set(['postgres', 'myka']);
const LOCAL_PORTS = new Set(['127.0.0.1:54329', 'localhost:54329', '0.0.0.0:54329']);
const encryptedPath = process.argv[2];
if (!encryptedPath) {
  console.error('Pass the encrypted copy path.');
  process.exit(1);
}

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
  console.error('Refusing to run: PostgreSQL is not the local development port.');
  process.exit(1);
}

function compose(args, input) {
  const text = args.join(' ');
  if (/\b(drop|truncate|delete|update|insert|alter|grant)\b/i.test(text)) {
    throw new Error('Refusing a statement that would change an existing database.');
  }
  if (/\bcreate\b/i.test(text) && text !== `psql -U postgres -d postgres -c CREATE DATABASE ${DESTINATION}`) {
    throw new Error('Refusing a create outside the isolated restore database.');
  }
  const databaseFlag = args.indexOf('-d');
  const name = databaseFlag === -1 ? '' : args[databaseFlag + 1];
  if (name !== DESTINATION && !READ_ONLY.has(name)) {
    throw new Error('Refusing an unidentified database.');
  }
  if (name === 'myka' && !/^\s*psql\b/.test(text)) {
    throw new Error('Refusing to change the local development database.');
  }
  if (input && name !== DESTINATION) {
    throw new Error('Refusing to restore into a database that is not the isolated restore database.');
  }
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', ...args], {
    cwd: root,
    input,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error('docker compose failed');
  }
  return result.stdout;
}

function query(database, sql) {
  return compose(['psql', '-U', 'postgres', '-d', database, '-t', '-A', '-c', sql]).toString().trim();
}

const packed = readFileSync(encryptedPath);
const iv = packed.subarray(0, 12);
const tag = packed.subarray(12, 28);
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
const dump = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
if (!dump.subarray(0, 80).toString('utf8').includes('PostgreSQL database dump')) {
  throw new Error('Decrypted copy is not a database dump.');
}

const exists = query('postgres', `SELECT 1 FROM pg_database WHERE datname = '${DESTINATION}'`);
if (!exists) {
  compose(['psql', '-U', 'postgres', '-d', 'postgres', '-c', `CREATE DATABASE ${DESTINATION}`]);
}
const tables = Number(query(DESTINATION, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"));
if (tables !== 0) {
  console.error('Refusing to restore: the isolated database is not empty.');
  process.exit(1);
}

compose(['psql', '-U', 'postgres', '-d', DESTINATION, '-v', 'ON_ERROR_STOP=1'], dump);
const sourceTables = query('myka', "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1");
const restoredTables = query(DESTINATION, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1");
if (!sourceTables || sourceTables !== restoredTables) {
  throw new Error('Restored tables do not match the local development database.');
}
console.log(`tables-match ${sourceTables.split('\n').length}`);
