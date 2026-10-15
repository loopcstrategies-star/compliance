import { createRequire } from 'module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const DRILL_DATABASES = new Set([
  'myka',
  'myka_phase8_check',
  'myka_accept_restore',
  'myka_filecheck_source',
  'myka_filecheck_restore',
  'myka_backup_drill',
  'myka_restore_check',
  'myka_workflow_check',
]);

export function assessTarget(connectionString, mode) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    return { ok: false, reason: 'unparseable-url' };
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const port = parsed.port || '5432';
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const hostClass = local
    ? 'local'
    : parsed.hostname.endsWith('.railway.internal')
      ? 'railway-internal'
      : parsed.hostname.endsWith('.up.railway.app')
        ? 'railway-public'
        : 'other';
  const summary = { hostClass, port, database };
  if (!database) {
    return { ok: false, reason: 'missing-database', ...summary };
  }
  if (mode === 'isolated') {
    const allowed = local && port === '54329' && database === 'myka_bootstrap_check';
    return allowed ? { ok: true, ...summary } : { ok: false, reason: 'isolated-target-rejected', ...summary };
  }
  if (mode !== 'production') {
    return { ok: false, reason: 'missing-confirmation', ...summary };
  }
  if (local || port === '54329' || DRILL_DATABASES.has(database) || database !== 'railway' || hostClass === 'other') {
    return { ok: false, reason: 'production-target-rejected', ...summary };
  }
  return { ok: true, ...summary };
}

async function loadHelpers() {
  const ts = require('typescript');
  const dir = mkdtempSync(path.join(tmpdir(), 'myka-bootstrap-'));
  const options = { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } };
  const domainFile = path.join(dir, 'domain.mjs');
  writeFileSync(domainFile, ts.transpileModule(readFileSync(new URL('../src/domain.ts', import.meta.url), 'utf8'), options).outputText);
  const prismaEntry = pathToFileURL(require.resolve('@prisma/client')).href;
  const argonEntry = pathToFileURL(require.resolve('argon2')).href;
  let catalogue = readFileSync(new URL('../src/seed/catalogue.ts', import.meta.url), 'utf8');
  catalogue = catalogue.replace("from '../domain'", `from ${JSON.stringify(pathToFileURL(domainFile).href)}`);
  catalogue = catalogue.replace("from '@prisma/client'", `from ${JSON.stringify(prismaEntry)}`);
  const catalogueFile = path.join(dir, 'catalogue.mjs');
  writeFileSync(catalogueFile, ts.transpileModule(catalogue, options).outputText);
  let password = readFileSync(new URL('../src/auth/password.ts', import.meta.url), 'utf8');
  password = password.replace("from 'argon2'", `from ${JSON.stringify(argonEntry)}`);
  const passwordFile = path.join(dir, 'password.mjs');
  writeFileSync(passwordFile, ts.transpileModule(password, options).outputText);
  const loadedCatalogue = await import(pathToFileURL(catalogueFile).href);
  const loadedPassword = await import(pathToFileURL(passwordFile).href);
  const domain = await import(pathToFileURL(domainFile).href);
  return {
    ensureCatalogue: loadedCatalogue.ensureCatalogue,
    hashPassword: loadedPassword.hashPassword,
    roleCount: domain.ROLE_KEYS.length,
    permissionCount: domain.PERMISSION_KEYS.length,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function runBootstrap({ connectionString, email, password, mode }) {
  const target = assessTarget(connectionString, mode);
  if (!target.ok) {
    return { status: 'aborted', reason: target.reason, target };
  }
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { status: 'aborted', reason: 'invalid-email', target };
  }
  if (password.length < 12) {
    return { status: 'aborted', reason: 'password-too-short', target };
  }
  const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });
  const helpers = await loadHelpers();
  try {
    const role = await prisma.$queryRaw`SELECT current_user AS role, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    const current = role[0];
    if (current?.role !== 'myka_migrator' || current?.rolbypassrls !== true) {
      return { status: 'aborted', reason: 'migrator-role-required', target };
    }
    const [users, tenants, roles, permissions] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.role.count(),
      prisma.permission.count(),
    ]);
    if (users !== 0) {
      return { status: 'aborted', reason: 'existing-users', target, counts: { users, tenants, roles, permissions } };
    }
    if (tenants !== 0) {
      return { status: 'aborted', reason: 'existing-tenants', target, counts: { users, tenants, roles, permissions } };
    }
    const catalogueEmpty = roles === 0 && permissions === 0;
    const catalogueComplete = roles === helpers.roleCount && permissions === helpers.permissionCount;
    if (!catalogueEmpty && !catalogueComplete) {
      return { status: 'aborted', reason: 'partial-catalogue', target, counts: { users, tenants, roles, permissions } };
    }
    const passwordHash = await helpers.hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await helpers.ensureCatalogue(tx);
      const tenant = await tx.tenant.create({ data: { name: 'Platform', isSystem: true } });
      const adminRole = await tx.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalized,
          displayName: 'Administrator',
          passwordHash,
        },
      });
      await tx.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: adminRole.id } });
    });
    return {
      status: 'created',
      target,
      email: normalized,
      counts: {
        users: await prisma.user.count(),
        tenants: await prisma.tenant.count(),
        roles: await prisma.role.count(),
        permissions: await prisma.permission.count(),
      },
    };
  } finally {
    helpers.cleanup();
    await prisma.$disconnect();
  }
}

function printTarget(target) {
  if (!target?.database) {
    return;
  }
  console.log(`target hostClass=${target.hostClass} port=${target.port} database=${target.database}`);
}

async function main() {
  const mode = process.argv.includes('--confirm-production')
    ? 'production'
    : process.argv.includes('--isolated-test')
      ? 'isolated'
      : '';
  const connectionString = process.env.DATABASE_URL ?? '';
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? '';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (!connectionString || !email || !password || !mode) {
    console.log('aborted missing-input');
    process.exit(2);
  }
  const result = await runBootstrap({ connectionString, email, password, mode });
  printTarget(result.target);
  if (result.status !== 'created') {
    console.log(`aborted ${result.reason}`);
    process.exit(1);
  }
  console.log(`bootstrap-created users=${result.counts.users} tenants=${result.counts.tenants} roles=${result.counts.roles} permissions=${result.counts.permissions}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.log(`aborted ${error.code || 'failed'}`);
    process.exit(1);
  });
}
