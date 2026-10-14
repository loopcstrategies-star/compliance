import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { localDevelopmentTarget, selectedRecoveryAccount } from './demo-mfa.mjs';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const requested = process.argv[2];
if (!localDevelopmentTarget(process.env)) {
  console.error('Refusing MFA recovery: this command runs only against the local development database.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const user = requested
  ? await prisma.user.findUnique({
      where: { email: requested },
      select: { id: true, tenantId: true, roles: { select: { role: { select: { key: true } } } } },
    })
  : null;
const roles = user?.roles.map((row) => row.role.key) ?? [];
const email = selectedRecoveryAccount(requested, roles);
if (!email) {
  console.error('Refusing MFA recovery: name one existing local demo account.');
  await prisma.$disconnect();
  process.exit(1);
}
if (!user) {
  console.log(`missing ${email}`);
  await prisma.$disconnect();
  process.exit(1);
}
await prisma.user.update({
  where: { id: user.id },
  data: { mfaSecret: null, mfaEnrolledAt: null },
});
await prisma.auditEvent.create({
  data: {
    tenantId: user.tenantId,
    actorId: user.id,
    action: 'mfa.recovery',
    targetType: 'user',
    targetId: user.id,
    purpose: 'Local development authenticator recovery',
  },
});
console.log(`recovered ${email}`);
await prisma.$disconnect();
