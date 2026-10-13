const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const cwd = path.resolve(__dirname, '..');
const env = process.env;
const generate = spawnSync('npx prisma generate', {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});
if (generate.status !== 0) {
  process.exit(generate.status ?? 1);
}
const prisma = spawnSync('npx prisma migrate deploy', {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});
if (prisma.status !== 0) {
  process.exit(prisma.status ?? 1);
}
const jest = spawnSync('npx jest --runInBand', {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});
process.exit(jest.status ?? 1);
