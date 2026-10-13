import { spawnSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? '', 'base64');
if (key.length !== 32) {
  console.error('BACKUP_ENCRYPTION_KEY must be 32 bytes of base64 and must stay outside git.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const directory = mkdtempSync(path.join(tmpdir(), 'myka-backup-'));
const encryptedPath = path.join(directory, 'myka.dump.enc');

function compose(args, input) {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'postgres', ...args], {
    cwd: root,
    input,
    encoding: 'buffer',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString() || 'docker compose failed');
  }
  return result.stdout;
}

const dump = compose(['pg_dump', '-U', 'postgres', '-d', 'myka', '--no-owner', '--no-acl']);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(dump), cipher.final()]);
writeFileSync(encryptedPath, Buffer.concat([iv, cipher.getAuthTag(), ciphertext]));

const payload = readFileSync(encryptedPath);
const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
decipher.setAuthTag(payload.subarray(12, 28));
const sql = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);

compose(['psql', '-U', 'postgres', '-c', 'DROP DATABASE IF EXISTS myka_restore_check']);
compose(['psql', '-U', 'postgres', '-c', 'CREATE DATABASE myka_restore_check']);
compose(['psql', '-U', 'postgres', '-d', 'myka_restore_check'], sql);

const source = compose(['psql', '-U', 'postgres', '-d', 'myka', '-t', '-A', '-c', 'SELECT count(*) FROM tenants']).toString().trim();
const restored = compose([
  'psql',
  '-U',
  'postgres',
  '-d',
  'myka_restore_check',
  '-t',
  '-A',
  '-c',
  'SELECT count(*) FROM tenants',
]).toString().trim();
compose(['psql', '-U', 'postgres', '-c', 'DROP DATABASE IF EXISTS myka_restore_check']);
rmSync(directory, { recursive: true, force: true });

if (!source || source === '0' || source !== restored) {
  throw new Error('Restored tenant count did not match the source database.');
}
console.log('backup-ok');
