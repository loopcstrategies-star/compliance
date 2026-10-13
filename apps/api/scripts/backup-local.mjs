import { spawnSync } from 'node:child_process';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const LOCAL_PORTS = new Set(['127.0.0.1:54329', 'localhost:54329', '0.0.0.0:54329']);
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

function compose(args) {
  const text = args.join(' ');
  if (/\b(drop|create|insert|update|delete|truncate|alter|grant)\b/i.test(text)) {
    throw new Error('Refusing a statement that would change the database.');
  }
  const databaseFlag = args.indexOf('-d');
  if (databaseFlag !== -1 && args[databaseFlag + 1] !== 'myka') {
    throw new Error('Refusing a database other than the local development database.');
  }
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', ...args], {
    cwd: root,
    encoding: 'buffer',
  });
  if (result.status !== 0) {
    throw new Error('docker compose failed');
  }
  return result.stdout;
}

const directory = path.join(tmpdir(), `myka-local-copy-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const dump = compose(['pg_dump', '-U', 'postgres', '-d', 'myka', '--no-owner', '--no-acl']);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(dump), cipher.final()]);
writeFileSync(path.join(directory, 'myka.dump.enc'), Buffer.concat([iv, cipher.getAuthTag(), ciphertext]));

const storageSource = process.env.FILE_STORAGE_DIR
  ? path.resolve(process.env.FILE_STORAGE_DIR)
  : path.join(root, 'apps', 'api', 'storage');
const storageCopy = path.join(directory, 'files');
if (existsSync(storageSource)) {
  cpSync(storageSource, storageCopy, { recursive: true });
} else {
  mkdirSync(storageCopy);
}

const listed = compose([
  'psql',
  '-U',
  'postgres',
  '-d',
  'myka',
  '-t',
  '-A',
  '-c',
  'SELECT storage_key || \'|\' || sha256 FROM stored_files LIMIT 1',
]).toString().trim();
if (!listed) {
  console.log('no-stored-file');
} else {
  const [storageKey, sha256] = listed.split('|');
  if (!/^[0-9a-f-]{36}$/i.test(storageKey) || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Stored file reference could not be checked.');
  }
  const copied = path.join(storageCopy, storageKey);
  if (!existsSync(copied)) {
    throw new Error('Stored file was not present in the copied directory.');
  }
  const actual = createHash('sha256').update(readFileSync(copied)).digest('hex');
  if (actual !== sha256) {
    throw new Error('Copied file checksum did not match the database.');
  }
  console.log('checksum-ok');
}
console.log('backup-copy-ok');
