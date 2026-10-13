import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const MAKER_EMAIL = 'maker-phase5@example.com';
const ADMIN_EMAIL = 'admin-phase5@example.com';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const maker = await prisma.user.findUnique({ where: { email: MAKER_EMAIL }, select: { id: true } });
const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
if (maker && admin) {
  console.log('Development accounts already exist.');
  await prisma.$disconnect();
  process.exit(0);
}

const password = process.env.SEED_DEMO_PASSWORD ?? '';
if (!password) {
  console.error('SEED_DEMO_PASSWORD is required to create a missing development account.');
  await prisma.$disconnect();
  process.exit(1);
}

const passwordHash = await hash(password, { type: argon2id });
let tenant = await prisma.tenant.findFirst({ where: { isSystem: false }, orderBy: { createdAt: 'asc' } });
if (!tenant) {
  tenant = await prisma.tenant.create({ data: { name: 'Tenant A' } });
}
let system = await prisma.tenant.findFirst({ where: { isSystem: true }, orderBy: { createdAt: 'asc' } });
if (!system) {
  system = await prisma.tenant.create({ data: { name: 'Platform', isSystem: true } });
}
const makerRole = await prisma.role.findUnique({ where: { key: 'maker' } });
const adminRole = await prisma.role.findUnique({ where: { key: 'super_admin' } });
if (!makerRole || !adminRole) {
  console.error('Role catalogue is missing.');
  await prisma.$disconnect();
  process.exit(1);
}

if (!maker) {
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: MAKER_EMAIL,
      displayName: 'Phase 5 Maker',
      passwordHash,
    },
  });
  await prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: makerRole.id } });
}
if (!admin) {
  const user = await prisma.user.create({
    data: {
      tenantId: system.id,
      email: ADMIN_EMAIL,
      displayName: 'Phase 5 Admin',
      passwordHash,
    },
  });
  await prisma.userRole.create({ data: { tenantId: system.id, userId: user.id, roleId: adminRole.id } });
}

console.log('Missing development accounts were created.');
await prisma.$disconnect();
