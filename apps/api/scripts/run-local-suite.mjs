
import dotenv from 'dotenv';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

dotenv.config({ path: path.join(root, '.env') });

// Override the production/default URLs with the dedicated test URLs.
const testEnvPath = path.join(root, '.env.wizard-test');
const loaded = dotenv.config({ path: testEnvPath, override: true });

if (loaded.error) {
  console.error('Missing .env.wizard-test. Run ensure-wizard-test-db.mjs first.');
  process.exit(1);
}

const appUrl = process.env.APP_DATABASE_URL;
const migrationUrl = process.env.DATABASE_URL;

function isExpectedTestDatabase(value) {
  try {
    const url = new URL(value);
    return (
      ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      url.port === '54329' &&
      url.pathname === '/myka_wizard_test'
    );
  } catch {
    return false;
  }
}

if (
  !isExpectedTestDatabase(appUrl) ||
  !isExpectedTestDatabase(migrationUrl)
) {
  console.error(
    'Refusing to run: both database URLs must target local myka_wizard_test on port 54329.',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: migrationUrl,
  APP_DATABASE_URL: appUrl,
  LOCAL_MFA_DEFER: 'true',
  FILE_STORAGE_DIR: path.join(root, 'apps/api/storage-test'),
};

const pattern = process.argv[2] || 'company-network';

console.log('Test database: local myka_wizard_test');
console.log(`Test pattern: ${pattern}`);

const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'apps/api/scripts/run-tests.js'),
    `--testPathPatterns=${pattern}`,
  ],
  {
    stdio: 'inherit',
    env,
    cwd: path.join(root, 'apps/api'),
  },
);

process.exit(result.status ?? 1);
