import { spawnSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const envFile = new URL('../../../.env', import.meta.url);
dotenv.config({ path: envFile });

const SOURCE = 'myka_filecheck_source';
const DESTINATION = 'myka_filecheck_restore';
const ALLOWED = new Set([SOURCE, DESTINATION]);
const FORBIDDEN = new Set(['myka', 'myka_phase8_check', 'myka_accept_restore']);
const LOCAL_PORTS = new Set(['127.0.0.1:54329', 'localhost:54329', '0.0.0.0:54329']);
const STORAGE_KEY = '77777777-7777-4777-8777-777777777777';
const LABEL = 'MYKA synthetic backup file';

function validKey(value) {
  return Buffer.from(value ?? '', 'base64').length === 32;
}

function ensureKey() {
  if (validKey(process.env.BACKUP_ENCRYPTION_KEY)) {
    return Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, 'base64');
  }
  const current = process.env.BACKUP_ENCRYPTION_KEY ?? '';
  if (current.length > 0) {
    console.error('BACKUP_ENCRYPTION_KEY is set and is not 32 bytes of base64. It was left unchanged.');
    process.exit(1);
  }
  const generated = randomBytes(32).toString('base64');
  const filePath = fileURLToPath(envFile);
  const text = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const line = `BACKUP_ENCRYPTION_KEY=${generated}`;
  const replaced = text.match(/^BACKUP_ENCRYPTION_KEY=.*$/m)
    ? text.replace(/^BACKUP_ENCRYPTION_KEY=.*$/m, line)
    : `${text.replace(/\s*$/, '')}\n${line}\n`;
  writeFileSync(filePath, replaced);
  return Buffer.from(generated, 'base64');
}

const key = ensureKey();
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
  if (/\bdrop\b/i.test(text)) {
    throw new Error('Refusing DROP.');
  }
  const databaseFlag = args.indexOf('-d');
  const name = databaseFlag === -1 ? '' : args[databaseFlag + 1];
  if (FORBIDDEN.has(name) && name !== 'myka') {
    throw new Error('Refusing an unidentified database.');
  }
  if (![...ALLOWED, 'postgres', 'myka'].includes(name)) {
    throw new Error('Refusing an unidentified database.');
  }
  const writes = /\b(create|insert|update|delete|truncate|alter|grant)\b/i.test(text);
  const createDatabase = text === `psql -U postgres -d postgres -c CREATE DATABASE ${SOURCE}`
    || text === `psql -U postgres -d postgres -c CREATE DATABASE ${DESTINATION}`;
  if (name === 'myka' && (writes || input)) {
    throw new Error('Refusing to change the local development database.');
  }
  if (writes && !createDatabase && !ALLOWED.has(name)) {
    throw new Error('Refusing a change outside the filecheck databases.');
  }
  if (input && name !== DESTINATION) {
    throw new Error('Refusing to restore into a database that is not the filecheck restore database.');
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

function encrypt(bytes) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(packed) {
  const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
}

function assertRestoreTarget(name) {
  if (name !== DESTINATION) {
    throw new Error('Refusing to restore into a database that is not the filecheck restore database.');
  }
}

const before = query('myka', 'SELECT count(*) FROM stored_files');
for (const name of [SOURCE, DESTINATION]) {
  if (FORBIDDEN.has(name)) {
    throw new Error('Refusing an unidentified database.');
  }
  const exists = query('postgres', `SELECT 1 FROM pg_database WHERE datname = '${name}'`);
  if (!exists) {
    compose(['psql', '-U', 'postgres', '-d', 'postgres', '-c', `CREATE DATABASE ${name}`]);
  }
  const tables = Number(query(name, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"));
  if (tables !== 0) {
    console.error('Refusing to run: a filecheck database is not empty.');
    process.exit(1);
  }
}

const directory = path.join(tmpdir(), `myka-filecheck-${Date.now()}`);
const sourceFiles = path.join(directory, 'source');
const restoredFiles = path.join(directory, 'restored');
mkdirSync(sourceFiles, { recursive: true });
mkdirSync(restoredFiles, { recursive: true });
const bytes = Buffer.from(`%PDF-1.4\n% ${LABEL}\n%%EOF\n`);
const sha256 = createHash('sha256').update(bytes).digest('hex');
writeFileSync(path.join(sourceFiles, STORAGE_KEY), bytes);
compose([
  'psql',
  '-U',
  'postgres',
  '-d',
  SOURCE,
  '-c',
  'CREATE TABLE stored_files (storage_key text PRIMARY KEY, sha256 text NOT NULL, label text NOT NULL)',
]);
compose([
  'psql',
  '-U',
  'postgres',
  '-d',
  SOURCE,
  '-c',
  `INSERT INTO stored_files (storage_key, sha256, label) VALUES ('${STORAGE_KEY}', '${sha256}', '${LABEL}')`,
]);

const dump = compose(['pg_dump', '-U', 'postgres', '-d', SOURCE, '--no-owner', '--no-acl']);
const packed = encrypt(dump);
writeFileSync(path.join(directory, 'filecheck.dump.enc'), packed);
const restoredDump = decrypt(packed);
assertRestoreTarget(DESTINATION);
compose(['psql', '-U', 'postgres', '-d', DESTINATION, '-v', 'ON_ERROR_STOP=1'], restoredDump);
const restored = query(DESTINATION, 'SELECT storage_key || \'|\' || sha256 || \'|\' || label FROM stored_files');
const [restoredKey, restoredSha, restoredLabel] = restored.split('|');
if (restoredKey !== STORAGE_KEY || restoredSha !== sha256 || restoredLabel !== LABEL) {
  throw new Error('Restored dummy record did not match.');
}
writeFileSync(path.join(restoredFiles, restoredKey), readFileSync(path.join(sourceFiles, restoredKey)));
const copiedSha = createHash('sha256').update(readFileSync(path.join(restoredFiles, restoredKey))).digest('hex');
if (copiedSha !== restoredSha) {
  throw new Error('Restored file checksum did not match.');
}

let badCipherFailed = false;
try {
  const broken = Buffer.from(packed);
  broken[broken.length - 1] ^= 1;
  decrypt(broken);
} catch {
  badCipherFailed = true;
}
if (!badCipherFailed) {
  throw new Error('A damaged backup was accepted.');
}

let refusedMyka = false;
try {
  assertRestoreTarget('myka');
  compose(['psql', '-U', 'postgres', '-d', 'myka', '-c', 'CREATE TABLE stored_files (id int)']);
} catch (error) {
  refusedMyka = error instanceof Error && error.message.includes('filecheck restore database');
}
if (!refusedMyka) {
  throw new Error('A restore aimed at the local development database was not refused.');
}

const after = query('myka', 'SELECT count(*) FROM stored_files');
if (before !== after) {
  throw new Error('The local development file count changed.');
}
console.log('checksum-ok');
console.log('filecheck-ok');
console.log(`myka-count-unchanged ${after}`);
