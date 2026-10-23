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
const jestBin = path.resolve(cwd, '../../node_modules/jest/bin/jest.js');
const jest = spawnSync(process.execPath, [jestBin, '--runInBand', ...process.argv.slice(2)], {
  cwd,
  env,
  stdio: 'inherit',
});
process.exit(jest.status ?? 1);
