import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as OTPAuth from 'otpauth';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/auth.service';
import { encryptSecret } from '../src/crypto/secrets';
import { ensureCatalogue } from '../src/seed/catalogue';
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';

describe('tenant isolation', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let tenantA: { id: string };
  let tenantB: { id: string };
  let employeeA: { id: string; email: string };
  let employeeB: { id: string; email: string };
  let customerA: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let reader: { id: string; email: string };
  let employeeSecret: string;
  let adminSecret: string;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);

    tenantA = await admin.tenant.create({ data: { name: 'Tenant A' } });
    tenantB = await admin.tenant.create({ data: { name: 'Tenant B' } });
    const system = await admin.tenant.create({ data: { name: 'Platform', isSystem: true } });
    const roles = Object.fromEntries(
      (await admin.role.findMany()).map((role) => [role.key, role.id]),
    );

    employeeSecret = new OTPAuth.Secret({ size: 20 }).base32;
    adminSecret = new OTPAuth.Secret({ size: 20 }).base32;
    const passwordHash = await hashPassword(PASSWORD);

    employeeA = await createUser(admin, tenantA.id, 'employee-a@example.com', 'Employee A', passwordHash, roles.employee, employeeSecret);
    employeeB = await createUser(admin, tenantB.id, 'employee-b@example.com', 'Employee B', passwordHash, roles.employee, new OTPAuth.Secret({ size: 20 }).base32);
    customerA = await createUser(admin, tenantA.id, 'customer-a@example.com', 'Customer A', passwordHash, roles.customer, null);
    adminUser = await createUser(admin, system.id, 'admin@example.com', 'Platform Admin', passwordHash, roles.super_admin, adminSecret);

    const identityPermission = await admin.permission.findUniqueOrThrow({ where: { key: 'identity_file.read' } });
    const readerRole = await admin.role.create({ data: { key: 'identity_reader_test' } });
    await admin.rolePermission.create({ data: { roleId: readerRole.id, permissionId: identityPermission.id } });
    reader = await createUser(admin, tenantA.id, 'reader-a@example.com', 'Reader A', passwordHash, readerRole.id, null);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('hides the other tenant user on read and write', async () => {
    const agent = await login(employeeA.email);
    await satisfyMfa(agent, employeeSecret);
    const listed = await agent.get('/users').expect(200);
    expect(listed.body.map((user: { email: string }) => user.email)).toContain(employeeA.email);
    expect(JSON.stringify(listed.body)).not.toContain(employeeB.email);
    expect(JSON.stringify(listed.body)).not.toContain('password');

    const missing = await agent.get(`/users/${employeeB.id}`).expect(404);
    expect(JSON.stringify(missing.body)).not.toContain(employeeB.email);

    await agent.patch(`/users/${employeeB.id}`).send({ displayName: 'Taken' }).expect(404);
    const unchanged = await admin.user.findUniqueOrThrow({ where: { id: employeeB.id } });
    expect(unchanged.displayName).toBe('Employee B');
    expect(unchanged.tenantId).toBe(tenantB.id);
  });

  it('rejects a tenant id that does not match the session', async () => {
    const mismatch = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employeeA.email, password: PASSWORD, tenantId: tenantB.id });
    expect(mismatch.status).toBe(403);
    expect(mismatch.headers['set-cookie']).toBeUndefined();

    const agent = await login(employeeA.email);
    await satisfyMfa(agent, employeeSecret);
    const blocked = await agent.get('/users').set('x-tenant-id', tenantB.id).expect(403);
    expect(JSON.stringify(blocked.body)).not.toContain(employeeB.email);

    await agent.patch(`/users/${employeeA.id}`).send({ displayName: 'Moved', tenantId: tenantB.id }).expect(403);
    const still = await admin.user.findUniqueOrThrow({ where: { id: employeeA.id } });
    expect(still.tenantId).toBe(tenantA.id);
    expect(still.displayName).toBe('Employee A');
  });

  it('rejects a logged out session and an expired session', async () => {
    const agent = await login(customerA.email);
    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(201);
    await agent.get('/auth/me').expect(401);

    const again = await login(customerA.email);
    await admin.session.updateMany({
      where: { userId: customerA.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await again.get('/auth/me').expect(401);
  });

  it('blocks a privileged route until MFA succeeds', async () => {
    const agent = await login(employeeA.email);
    const blocked = await agent.get('/users').expect(403);
    expect(blocked.body.message).toBe('MFA required');
    await satisfyMfa(agent, employeeSecret);
    await agent.get('/users').expect(200);
  });

  it('denies identity-file access to a super-admin and audits an authorised reader', async () => {
    const superAdmin = await login(adminUser.email);
    await satisfyMfa(superAdmin, adminSecret);
    await superAdmin.post('/identity-files/access').send({ purpose: 'case review' }).expect(403);
    const auditsAfterDenial = await admin.auditEvent.count({ where: { action: 'identity_file.access' } });
    expect(auditsAfterDenial).toBe(0);

    const allowed = await login(reader.email);
    await allowed.post('/identity-files/access').send({ purpose: '   ' }).expect(400);
    await allowed.post('/identity-files/access').send({ purpose: 'customer dispute 42' }).expect(201);
    const events = await admin.auditEvent.findMany({ where: { actorId: reader.id } });
    expect(events).toHaveLength(1);
    expect(events[0].purpose).toBe('customer dispute 42');
    expect(events[0].tenantId).toBe(tenantA.id);
  });

  it('enforces row level security for the runtime role', async () => {
    const client = new Client({ connectionString: process.env.APP_DATABASE_URL });
    await client.connect();
    try {
      const hidden = await client.query('SELECT id FROM users');
      expect(hidden.rowCount).toBe(0);
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantA.id]);
      const visible = await client.query('SELECT id FROM users');
      const ids = visible.rows.map((row: { id: string }) => row.id);
      expect(ids).toContain(employeeA.id);
      expect(ids).not.toContain(employeeB.id);
      const updated = await client.query(`UPDATE users SET display_name = 'hacked' WHERE id = $1`, [employeeB.id]);
      expect(updated.rowCount).toBe(0);
    } finally {
      await client.end();
    }
    const employee = await admin.user.findUniqueOrThrow({ where: { id: employeeB.id } });
    expect(employee.displayName).toBe('Employee B');
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
  displayName: string,
  passwordHash: string,
  roleId: string,
  mfaBase32: string | null,
) {
  const user = await admin.user.create({
    data: {
      tenantId,
      email,
      displayName,
      passwordHash,
      mfaSecret: mfaBase32 ? encryptSecret(mfaBase32) : null,
    },
  });
  await admin.userRole.create({ data: { tenantId, userId: user.id, roleId } });
  return user;
}
