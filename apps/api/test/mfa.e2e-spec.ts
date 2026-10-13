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
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';

describe('authenticator enrollment', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let secretA: string;
  let secretB: string;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);
    const tenant = await admin.tenant.create({ data: { name: 'MFA Tenant' } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    secretA = new OTPAuth.Secret({ size: 20 }).base32;
    secretB = new OTPAuth.Secret({ size: 20 }).base32;
    await createUser(admin, tenant.id, 'mfa-a@example.com', passwordHash, roles.maker, secretA);
    await createUser(admin, tenant.id, 'mfa-b@example.com', passwordHash, roles.checker, secretB);
    await createUser(admin, tenant.id, 'mfa-c@example.com', passwordHash, roles.customer, null);
    await createUser(admin, tenant.id, 'mfa-d@example.com', passwordHash, roles.employee, secretB);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app?.close();
    await admin?.$disconnect();
  });

  it('accepts the current and previous code, and rejects another account', async () => {
    const first = await login('mfa-a@example.com');
    const setup = await first.get('/auth/mfa/setup').expect(200);
    expect(setup.body.otpauthUri).toContain('otpauth://totp/');
    expect(setup.body.otpauthUri).toContain('mfa-a%40example.com');
    await first.post('/auth/mfa').send({ code: '000000' }).expect(401);

    const previous = codeAt(secretA, Date.now() - 30_000);
    await first.post('/auth/mfa').send({ code: previous }).expect(201);
    await first.get('/auth/mfa/setup').expect(404);

    const second = await login('mfa-b@example.com');
    const otherSetup = await second.get('/auth/mfa/setup').expect(200);
    expect(otherSetup.body.otpauthUri).not.toBe(setup.body.otpauthUri);
    await second.post('/auth/mfa').send({ code: codeAt(secretA, Date.now()) }).expect(401);
    await second.post('/auth/mfa').send({ code: codeAt(secretB, Date.now()) }).expect(201);
  });

  it('hides setup in production and from a customer', async () => {
    const customer = await login('mfa-c@example.com');
    await customer.get('/auth/mfa/setup').expect(404);

    const pending = await login('mfa-d@example.com');
    process.env.NODE_ENV = 'production';
    try {
      await pending.get('/auth/mfa/setup').expect(404);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
    await pending.get('/auth/mfa/setup').expect(200);
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }
});

function codeAt(secret: string, timestamp: number): string {
  return new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate({ timestamp });
}

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
