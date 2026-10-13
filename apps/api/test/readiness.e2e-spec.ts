import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as OTPAuth from 'otpauth';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/auth.service';
import { encryptSecret } from '../src/crypto/secrets';
import { ensureCatalogue } from '../src/seed/catalogue';
import { writePrivateFile } from '../src/files/storage';
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';

describe('role areas', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let employeeSecret: string;
  let makerSecret: string;
  let adminSecret: string;
  let fileId: string;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);
    const tenant = await admin.tenant.create({ data: { name: 'Readiness Tenant' } });
    const system = await admin.tenant.create({ data: { name: 'Platform', isSystem: true } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    employeeSecret = new OTPAuth.Secret({ size: 20 }).base32;
    makerSecret = new OTPAuth.Secret({ size: 20 }).base32;
    adminSecret = new OTPAuth.Secret({ size: 20 }).base32;
    const customer = await createUser(admin, tenant.id, 'customer-ready@example.com', passwordHash, roles.customer, null);
    await createUser(admin, tenant.id, 'employee-ready@example.com', passwordHash, roles.employee, employeeSecret);
    await createUser(admin, tenant.id, 'maker-ready@example.com', passwordHash, roles.maker, makerSecret);
    await createUser(admin, system.id, 'admin-ready@example.com', passwordHash, roles.super_admin, adminSecret);
    const party = await admin.customer.create({
      data: { tenantId: tenant.id, userId: customer.id, legalName: 'Ready Metals', customerType: 'local_company' },
    });
    const application = await admin.application.create({ data: { tenantId: tenant.id, customerId: party.id } });
    const written = writePrivateFile(Buffer.from('%PDF-1.4\n%%EOF'));
    const file = await admin.storedFile.create({
      data: {
        tenantId: tenant.id,
        storageKey: written.storageKey,
        mediaType: 'application/pdf',
        byteSize: written.sha256.length,
        sha256: written.sha256,
        scanStatus: 'clean',
      },
    });
    await admin.document.create({
      data: { tenantId: tenant.id, applicationId: application.id, fieldKey: 'kyc.docs.1', fileId: file.id },
    });
    fileId = file.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('sends each role to its own area and keeps identity files from the super-admin', async () => {
    const customer = await login('customer-ready@example.com');
    await customer.get('/applications/current').expect(200);
    await customer.get('/dashboard').expect(403);
    await customer.get('/tenants').expect(403);

    const employee = await login('employee-ready@example.com');
    await satisfyMfa(employee, employeeSecret);
    await employee.get('/dashboard').expect(200);
    await employee.get('/tenants').expect(403);

    const maker = await login('maker-ready@example.com');
    await satisfyMfa(maker, makerSecret);
    await maker.get('/applications').expect(200);
    await maker.get('/dashboard').expect(403);

    const platform = await login('admin-ready@example.com');
    await satisfyMfa(platform, adminSecret);
    await platform.get('/tenants').expect(200);
    await platform.get(`/files/${fileId}`).expect(403);
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }

  async function satisfyMfa(agent: request.Agent, secret: string) {
    const code = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();
    await agent.post('/auth/mfa').send({ code }).expect(201);
  }
});

async function createUser(
  admin: PrismaClient,
  tenantId: string,
  email: string,
  passwordHash: string,
  roleId: string,
  mfaBase32: string | null,
) {
  const user = await admin.user.create({
    data: {
      tenantId,
      email,
      displayName: email,
      passwordHash,
      mfaSecret: mfaBase32 ? encryptSecret(mfaBase32) : null,
    },
  });
  await admin.userRole.create({ data: { tenantId, userId: user.id, roleId } });
  return user;
}
