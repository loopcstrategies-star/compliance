import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { localDevelopmentTarget, selectedDemoAccount } from './demo-mfa.mjs';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const email = selectedDemoAccount(process.argv[2]);
if (!localDevelopmentTarget(process.env)) {
  console.error('Refusing MFA recovery: this command runs only against the local development database.');
  process.exit(1);
}
if (!email) {
  console.error('Refusing MFA recovery: name one existing local demo account.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const user = await prisma.user.findUnique({ where: { email }, select: { id: true, tenantId: true } });
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
